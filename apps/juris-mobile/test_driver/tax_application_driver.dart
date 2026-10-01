// Retain and validate source-bound evidence from the application journey.
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter_driver/flutter_driver.dart';
import 'package:integration_test/common.dart';

import 'tax_driver_guard.dart';

const List<String> _phases = <String>[
  'write',
  'read',
  'incomplete-write',
  'incomplete-read',
  'legacy-write',
  'legacy-read',
];
const String _testName =
    'production application tax journey across process restart';

Future<void> main() async {
  final String phase = Platform.environment['JURIS_TAX_APP_PHASE'] ?? '';
  final String expectedSource =
      Platform.environment['JURIS_ACCEPTANCE_SOURCE_SHA'] ?? '';
  final String output =
      Platform.environment['JURIS_TAX_ACCEPTANCE_OUTPUT'] ?? '';
  final String nonce = Platform.environment['JURIS_ACCEPTANCE_RUN_NONCE'] ?? '';
  final int index = _phases.indexOf(phase);
  if (index < 0 ||
      !RegExp(r'^[a-f0-9]{40}$').hasMatch(expectedSource) ||
      output.isEmpty ||
      nonce.isEmpty) {
    throw StateError(
      'Explicit phase, source SHA and evidence directory required.',
    );
  }
  Future<void> retainResponse(Map<String, dynamic>? data) async {
    final Directory directory = Directory(output);
    await directory.create(recursive: true);
    final Map<String, dynamic> retained = <String, dynamic>{...?data};
    final dynamic screenshots = retained.remove('screenshots');
    if (screenshots is! List<dynamic> || screenshots.length != 1) {
      throw StateError('Exactly one current-phase screenshot is required.');
    }
    {
      for (final dynamic value in screenshots) {
        final Map<String, dynamic> shot = value as Map<String, dynamic>;
        final String name = shot['screenshotName'] as String;
        if (name != '$phase-editor') {
          throw StateError('Unexpected screenshot identity.');
        }
        final List<int> bytes = (shot['bytes'] as List<dynamic>).cast<int>();
        const List<int> signature = <int>[137, 80, 78, 71, 13, 10, 26, 10];
        if (bytes.length < 33 ||
            !List<bool>.generate(
              8,
              (int index) => bytes[index] == signature[index],
            ).every((bool value) => value)) {
          throw StateError('Screenshot is missing a nonempty PNG image.');
        }
        await File('${directory.path}/$name.png').writeAsBytes(bytes);
        retained['screenshot'] = <String, dynamic>{
          'filename': '$name.png',
          'bytes': bytes.length,
          'sha256': sha256.convert(bytes).toString(),
        };
      }
    }
    await File('${directory.path}/$phase.json').writeAsString(
      const JsonEncoder.withIndent('  ').convert(retained),
      flush: true,
    );
    if (retained['schema'] != 'tax-mobile-application-acceptance-v2' ||
        retained['selected_test'] != _testName ||
        retained['phase'] != phase ||
        retained['completed_phase'] != phase ||
        retained['phase_index'] != index ||
        retained['source_sha'] != expectedSource ||
        retained['run_nonce'] != nonce ||
        retained['pid'] is! int ||
        (retained['pid'] as int) <= 0 ||
        retained['entry_method'] != 'programmatic_flutter_test' ||
        retained['artifact'] is! Map<String, dynamic> ||
        retained['scenario'] is! Map<String, dynamic> ||
        retained['workspace_progress'] is! Map<String, dynamic> ||
        retained['native_calls'] is! List<dynamic>) {
      throw StateError('Missing source-bound application evidence.');
    }
    if (index == 0) {
      if (retained['previous_pid'] != null) {
        throw StateError('The first phase unexpectedly has a previous PID.');
      }
    } else {
      // Independent host receipts must establish the complete process chain;
      // the application cannot choose an arbitrary next phase or reuse a PID.
      for (int earlier = 0; earlier < index; earlier++) {
        final Map<String, dynamic> previous = jsonDecode(
          await File(
            '${directory.path}/${_phases[earlier]}.json',
          ).readAsString(),
        ) as Map<String, dynamic>;
        if (previous['schema'] != 'tax-mobile-application-acceptance-v2' ||
            previous['selected_test'] != _testName ||
            previous['phase'] != _phases[earlier] ||
            previous['completed_phase'] != _phases[earlier] ||
            previous['phase_index'] != earlier ||
            previous['source_sha'] != expectedSource ||
            previous['run_nonce'] != nonce ||
            previous['pid'] is! int ||
            previous['pid'] == retained['pid'] ||
            (earlier == index - 1 &&
                previous['pid'] != retained['previous_pid'])) {
          throw StateError('Missing prior phase or new-process evidence.');
        }
      }
    }
  }

  FlutterDriver? driver;
  bool expired = false;
  String stage = 'connect';
  try {
    final Response response = await runTaxDriverPhase<Response>(
      timeout: const Duration(minutes: 4),
      operation: () async {
        driver = await FlutterDriver.connect();
        if (expired)
          throw StateError('Phase already timed out while connecting');
        stage = 'request_data';
        final String value = await driver!.requestData(null);
        if (expired) throw StateError('Late response after phase timeout');
        final Response response = Response.fromJson(value);
        if (!response.allTestsPassed) {
          throw StateError('Selected application test failed: '
              '${response.formattedFailureDetails}');
        }
        stage = 'validate_and_retain';
        await retainResponse(response.data);
        if (expired)
          throw StateError('Phase deadline elapsed during retention');
        return response;
      },
      onFailure: (Object error, StackTrace stack) async {
        expired = true;
        final Directory directory = Directory(output);
        await directory.create(recursive: true);
        final Map<String, dynamic> diagnostic = <String, dynamic>{
          'acceptance': false,
          'source_sha': expectedSource,
          'run_nonce': nonce,
          'phase': phase,
          'selected_test': _testName,
          'driver_stage': stage,
          'error': '$error',
          'stack': '$stack',
          'utc': DateTime.now().toUtc().toIso8601String(),
        };
        final File file = File('${directory.path}/$phase-driver-failure.json');
        // Persist the primary failure before a VM diagnostic can time out.
        await file.writeAsString(jsonEncode(diagnostic), flush: true);
        try {
          diagnostic['vm'] = await captureTaxDriverVm(
            Platform.environment['VM_SERVICE_URL'],
          ).timeout(const Duration(seconds: 12));
        } on Object catch (captureError) {
          diagnostic['vm'] = <String, dynamic>{
            'acceptance': false,
            'capture_error': '$captureError',
          };
        }
        final String encoded = jsonEncode(diagnostic);
        if (utf8.encode(encoded).length > 256 * 1024) {
          diagnostic['vm'] = <String, dynamic>{'output_limit': 256 * 1024};
        }
        await file.writeAsString(jsonEncode(diagnostic), flush: true);
      },
      close: () async => driver?.close(),
      reportCleanupError: (String error) => stderr.writeln(error),
    );
    // These success markers are emitted only after the hard deadline and every
    // original response assertion, screenshot and receipt check have succeeded.
    stdout.writeln('All tests passed.');
    stdout.writeln('tax_application selected_test=$_testName '
        'phase=$phase source=$expectedSource');
    stdout.writeln('tax_application phase=$phase source=$expectedSource '
        'pid=${response.data!['pid']} evidence=complete');
    exit(0);
  } on Object catch (error, stack) {
    expired = true;
    stderr.writeln('tax_application phase=$phase source=$expectedSource '
        'evidence=failed stage=$stage: $error\n$stack');
    // Future.timeout does not cancel an underlying request. Terminate this
    // driver process after bounded diagnostics/close; never accept a late reply.
    exit(1);
  }
}
