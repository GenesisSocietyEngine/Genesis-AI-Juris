// Retain and validate source-bound evidence from the application journey.
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:integration_test/integration_test_driver.dart';

const List<String> _phases = <String>[
  'write',
  'read',
  'incomplete-write',
  'incomplete-read',
  'legacy-write',
  'legacy-read',
];

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
  await integrationDriver(
    writeResponseOnFailure: true,
    responseDataCallback: (Map<String, dynamic>? data) async {
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
      // A selected test that produced no report cannot count as acceptance.
      stdout.writeln(
        'tax_application phase=$phase source=$expectedSource '
        'pid=${retained['pid']} evidence=complete',
      );
    },
  );
}
