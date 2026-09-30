// PREPARATION ONLY. Never installed/launched; not a substitute for host checks.
// Reference: committed 60c6286 six-phase tax_application_driver.dart + guard.
import 'dart:convert';
import 'dart:io';
import 'package:flutter_driver/flutter_driver.dart';

import 'tax_future_driver_contract.dart';
import 'tax_future_driver_guard.dart';

Future<void> main() async {
  final environment = Platform.environment;
  final expected = FuturePhaseExpectation(
    environment['JURIS_FUTURE_PHASE'] ?? '',
    environment['JURIS_ACCEPTANCE_SOURCE_SHA'] ?? '',
    environment['JURIS_ACCEPTANCE_RUN_NONCE'] ?? '',
    int.tryParse(environment['JURIS_FUTURE_EXPECTED_PID'] ?? '') ?? 0,
  );
  final output = environment['JURIS_FUTURE_OUTPUT'] ?? '';
  requireFuture(
    output.isNotEmpty && File(output).isAbsolute,
    'Absolute future output directory required.',
  );
  final directory = Directory(output);
  FlutterDriver? driver;
  bool expired = false;
  String stage = 'preflight';
  void current() {
    if (expired)
      throw StateError('Future phase deadline/cancellation expired.');
  }

  Future<void> save(String name, List<int> bytes) async {
    current();
    final file = File('${directory.path}/$name');
    await file.create(
      exclusive: true,
    ); // A retry may not overwrite earlier proof.
    current();
    await file.writeAsBytes(bytes, flush: true);
    current();
  }

  Future<String> readBounded(File file) async {
    current();
    requireFuture(
      await file.length() <= futureResponseLimit,
      'Prior receipt exceeds bound.',
    );
    final bytes = await file.readAsBytes();
    current();
    requireFuture(
      bytes.length <= futureResponseLimit,
      'Prior receipt grew beyond bound.',
    );
    return utf8.decode(bytes);
  }

  try {
    await runTaxDriverPhase<void>(
      timeout: const Duration(minutes: 4),
      operation: () async {
        await directory.create(recursive: true);
        current();
        // Existing current/late proof is ambiguous, not permission to overwrite.
        for (final phase in futurePhases.skip(expected.index)) {
          requireFuture(
            !await File('${directory.path}/$phase.json').exists() &&
                !await File('${directory.path}/$phase-future.png').exists(),
            'Current or later phase evidence already exists.',
          );
        }
        final prior = <Map<String, dynamic>>[];
        for (final phase in futurePhases.take(expected.index)) {
          final receipt = decodeFutureObject(
            await readBounded(File('${directory.path}/$phase.json')),
          );
          final screenshot = File('${directory.path}/$phase-future.png');
          requireFuture(
            await screenshot.length() <= futureScreenshotLimit,
            'Prior screenshot exceeds bound.',
          );
          validateFutureRetainedScreenshot(
            receipt,
            await screenshot.readAsBytes(),
          );
          prior.add(receipt);
        }
        current();
        stage = 'connect';
        driver = await FlutterDriver.connect();
        current();
        stage = 'request_data';
        final encoded = await driver!.requestData(null);
        current();
        requireFuture(
          utf8.encode(encoded).length <= futureResponseLimit,
          'Response exceeds bound.',
        );
        await save(
          '${expected.phase}-driver-response.json',
          utf8.encode(encoded),
        );
        stage = 'validate';
        final validated = validateFutureResponse(encoded, expected, prior);
        current();
        stage = 'retain';
        await save('${expected.phase}-future.png', validated.png);
        await save(
          '${expected.phase}.json',
          utf8.encode(
            const JsonEncoder.withIndent('  ').convert(validated.receipt),
          ),
        );
        current();
      },
      onFailure: (Object error, StackTrace stack) async {
        expired = true;
        await directory.create(recursive: true);
        final diagnostic = <String, dynamic>{
          'acceptance': false,
          'schema': 'ios-future-driver-diagnostic-v1',
          'source_sha': expected.source,
          'run_nonce': expected.nonce,
          'phase': expected.phase,
          'selected_test': futureSelectedTest,
          'expected_pid': expected.pid,
          'stage': stage,
          'error': '$error',
          'stack': '$stack',
          'utc': DateTime.now().toUtc().toIso8601String(),
        };
        // A unique diagnostic file preserves the primary error even on retries.
        final name =
            '${expected.phase}-driver-failure-${DateTime.now().microsecondsSinceEpoch}.json';
        final file = File('${directory.path}/$name');
        await file.create(exclusive: true);
        await file.writeAsString(jsonEncode(diagnostic), flush: true);
        try {
          diagnostic['vm'] = await captureTaxDriverVm(
            environment['VM_SERVICE_URL'],
          ).timeout(const Duration(seconds: 12));
        } on Object catch (captureError) {
          diagnostic['vm'] = {
            'acceptance': false,
            'capture_error': '$captureError',
          };
        }
        if (utf8.encode(jsonEncode(diagnostic)).length > 256 * 1024) {
          diagnostic['vm'] = {'output_limit': 256 * 1024};
        }
        await file.writeAsString(jsonEncode(diagnostic), flush: true);
      },
      close: () async => driver?.close(),
      reportCleanupError: stderr.writeln,
    );
    // Neither an uploaded response nor a screenshot is acceptance. The host
    // additionally binds transport/bundle, raw disk, semantic assertions and
    // stopped-process/cleanup records before accepting or advancing a phase.
    stdout.writeln('All tests passed.');
    stdout.writeln(
      'tax_future selected_test=$futureSelectedTest '
      'phase=${expected.phase} source=${expected.source}',
    );
    stdout.writeln(
      'tax_future phase=${expected.phase} source=${expected.source} '
      'pid=${expected.pid} evidence=complete',
    );
    exit(0);
  } on Object catch (error, stack) {
    expired = true;
    stderr.writeln(
      'tax_future phase=${expected.phase} source=${expected.source} '
      'evidence=failed stage=$stage: $error\n$stack',
    );
    // Underlying request futures are not cancellable: exit after bounded
    // diagnostics and close, never adopt a response arriving after the deadline.
    exit(1);
  }
}
