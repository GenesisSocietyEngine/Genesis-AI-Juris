// Offline synthetic protocol controls only; never connects to Flutter or iOS.
import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import '../test_driver/tax_future_driver_contract.dart';
import '../test_driver/tax_future_driver_guard.dart';

final png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=',
);
final source = List.filled(40, 'a').join();
const nonce = '123-1';
void check(bool value, String why) {
  if (!value) throw StateError(why);
}

void refused(void Function() body) {
  try {
    body();
  } on Object {
    return;
  }
  throw StateError('Invalid evidence was accepted');
}

Map<String, dynamic> copy(Map<String, dynamic> value) =>
    jsonDecode(jsonEncode(value)) as Map<String, dynamic>;
FuturePhaseExpectation expected(int index) =>
    FuturePhaseExpectation(futurePhases[index], source, nonce, 100 + index);
Map<String, dynamic> data(int index) {
  final phase = futurePhases[index];
  final result = <String, dynamic>{
    'schema': futureReceiptSchema,
    'selected_test': futureSelectedTest,
    'phase': phase,
    'completed_phase': phase,
    'phase_index': index,
    'control_sha256': index == 0 ? null : List.filled(64, 'b').join(),
    'source_sha': source,
    'run_nonce': nonce,
    'pid': 100 + index,
    'previous_pid': index == 0 ? null : 99 + index,
    'platform': 'ios',
    'support_path': '/owned/Library/Application Support',
    'entry_method': 'programmatic_flutter_test',
    'constructed_fixture': phase.contains('future'),
    'interruption_evidence': false,
    'before': <String, dynamic>{},
    'after': <String, dynamic>{},
    'native_calls': [],
    'clipboard_before': null,
    'clipboard_after': null,
    'screenshots': <dynamic>[
      <String, dynamic>{
        'screenshotName': '$phase-future',
        'bytes': png.toList(),
      },
    ],
  };
  if (phase == 'baseline-write' ||
      phase == 'baseline-read' ||
      phase == 'restored-read') {
    for (final field in [
      'scenario',
      'artifact',
      'workspace_progress',
      'workspace_envelope',
    ]) {
      result[field] = <String, dynamic>{};
    }
  } else if (phase == 'workspace-future') {
    result['persistent_recovery'] = true;
  } else if (phase.startsWith('tax-future-')) {
    result['tax_read_only'] = true;
    if (phase == 'tax-future-safe' || phase == 'tax-future-unsafe') {
      result['export'] = <String, dynamic>{};
      result['clipboard_export_base64'] = 'Zg==';
    }
  } else {
    result.addAll({
      'import_before': <String, dynamic>{},
      'expected_refusal': 'synthetic',
      'imported_raw_base64': 'Zg==',
      'navigation_progress_before_import': true,
    });
  }
  return result;
}

String encoded(Map<String, dynamic> data) =>
    jsonEncode({'result': 'true', 'failureDetails': [], 'data': data});

void main() {
  late List<Map<String, dynamic>> prior;
  setUp(() {
    prior = <Map<String, dynamic>>[];
    for (var i = 0; i < futurePhases.length; i++) {
      prior.add(
          validateFutureResponse(encoded(data(i)), expected(i), prior).receipt);
    }
  });
  test('all ten exact phases and bound PNGs', () {
    final prior = <Map<String, dynamic>>[];
    for (var i = 0; i < futurePhases.length; i++) {
      final result = validateFutureResponse(
        encoded(data(i)),
        expected(i),
        prior,
      );
      validateFutureRetainedScreenshot(result.receipt, png);
      prior.add(result.receipt);
    }
    check(prior.length == 10, 'missing phase');
  });
  test('unknown phase/source/nonce/expected PID refused', () {
    for (final item in [
      () => FuturePhaseExpectation('write', source, nonce, 100),
      () => FuturePhaseExpectation('baseline-write', 'A' * 40, nonce, 100),
      () => FuturePhaseExpectation('baseline-write', source, '', 100),
      () => FuturePhaseExpectation('baseline-write', source, nonce, 0),
    ]) {
      refused(item);
    }
  });
  test('no-execution true result lacks selected receipt', () {
    for (final value in [
      '{}',
      '{"result":"true","failureDetails":[]}',
      '{"result":"true","failureDetails":[],"data":{}}',
    ]) {
      refused(() => validateFutureResponse(value, expected(0), []));
    }
  });
  test('failed/bool/contradictory test outcome refused', () {
    for (final result in ['false', true, null]) {
      refused(
        () => validateFutureResponse(
          jsonEncode({'result': result, 'failureDetails': [], 'data': data(0)}),
          expected(0),
          [],
        ),
      );
    }
    refused(
      () => validateFutureResponse(
        jsonEncode({
          'result': 'true',
          'failureDetails': ['failed test'],
          'data': data(0),
        }),
        expected(0),
        [],
      ),
    );
  });
  test(
    'duplicate result, escaped test key and nested receipt refused',
    () {
      final raw = encoded(data(0));
      refused(
        () => validateFutureResponse(
          raw.replaceFirst(
            '"result":"true"',
            '"result":"false","result":"true"',
          ),
          expected(0),
          [],
        ),
      );
      refused(
        () => validateFutureResponse(
          raw.replaceFirst(
            '"selected_test":',
            r'"selected_\u0074est":"other","selected_test":',
          ),
          expected(0),
          [],
        ),
      );
      refused(() => decodeFutureObject('{"outer":{"x":1,"x":2}}'));
      check(
        decodeFutureObject(
              '{"a":{"x":1},"b":{"x":2},"raw":"{\\\"x\\\":1}"}',
            ).length ==
            3,
        'distinct objects',
      );
    },
  );
  test('malformed/trailing/deep JSON refused', () {
    for (final value in [
      '{"a":1,}',
      '{}{}',
      '{"a":',
      '{"a":${'[' * 65}0${']' * 65}}',
    ]) {
      refused(() => decodeFutureObject(value));
    }
  });
  test('wrong source/test/phase/index/PID/platform refused', () {
    final mutations = {
      'source_sha': 'c' * 40,
      'selected_test': 'another test',
      'phase': 'baseline-read',
      'completed_phase': 'baseline-read',
      'phase_index': 0.0,
      'pid': 101,
      'run_nonce': '123-2',
      'platform': 'android',
      'entry_method': 'fixture',
      'interruption_evidence': true,
      'constructed_fixture': true,
    };
    for (final change in mutations.entries) {
      final value = data(0);
      value[change.key] = change.value;
      refused(() => validateFutureResponse(encoded(value), expected(0), []));
    }
  });
  test('missing/extra fields and malformed payload refused', () {
    for (final field in [
      'scenario',
      'before',
      'after',
      'native_calls',
      'clipboard_before',
    ]) {
      final value = data(0)..remove(field);
      refused(() => validateFutureResponse(encoded(value), expected(0), []));
    }
    final extra = data(0)..['unexpected'] = true;
    refused(() => validateFutureResponse(encoded(extra), expected(0), []));
    for (final field in ['scenario', 'before', 'native_calls']) {
      final value = data(0)..[field] = 'malformed';
      refused(() => validateFutureResponse(encoded(value), expected(0), []));
    }
  });
  test('missing, duplicate or wrong screenshot refused', () {
    final missing = data(0)..['screenshots'] = [];
    refused(() => validateFutureResponse(encoded(missing), expected(0), []));
    final duplicate = data(0);
    (duplicate['screenshots'] as List).add(
      copy((duplicate['screenshots'] as List).first),
    );
    refused(() => validateFutureResponse(encoded(duplicate), expected(0), []));
    final wrong = data(0);
    wrong['screenshots'][0]['screenshotName'] = 'baseline-read-future';
    refused(() => validateFutureResponse(encoded(wrong), expected(0), []));
  });
  test('invalid or incomplete PNG bytes refused', () {
    for (final bytes in [
      [],
      png.sublist(0, 33),
      [...png]..[0] = 0,
      [...png]..[19] = 0,
      [-1, ...png],
    ]) {
      refused(() => validateFuturePng(bytes));
    }
  });
  test('prior PNG byte/hash/filename corruption refused', () {
    for (final field in ['filename', 'sha256', 'bytes']) {
      final receipt = copy(prior.first);
      receipt['screenshot'][field] = field == 'bytes' ? 999 : 'wrong';
      refused(() => validateFutureRetainedScreenshot(receipt, png));
    }
    final numeric = copy(prior.first);
    numeric['screenshot']['bytes'] = png.length.toDouble();
    refused(() => validateFutureRetainedScreenshot(numeric, png));
  });
  test('missing/reordered/source-mismatched prior chain refused', () {
    refused(
      () => validateFutureResponse(
        encoded(data(2)),
        expected(2),
        prior.take(1).toList(),
      ),
    );
    refused(
      () => validateFutureResponse(encoded(data(2)), expected(2), [
        prior[1],
        prior[0],
      ]),
    );
    final changed = copy(prior[0])..['source_sha'] = 'd' * 40;
    refused(
      () => validateFutureResponse(encoded(data(1)), expected(1), [changed]),
    );
  });
  test('reused/nonprevious PID and stale first control refused', () {
    final reused = data(2)..['pid'] = 100;
    refused(
      () => validateFutureResponse(
        encoded(reused),
        FuturePhaseExpectation(futurePhases[2], source, nonce, 100),
        prior.take(2).toList(),
      ),
    );
    final wrong = data(2)..['previous_pid'] = 100;
    refused(
      () => validateFutureResponse(
        encoded(wrong),
        expected(2),
        prior.take(2).toList(),
      ),
    );
    final stale = data(0)..['control_sha256'] = 'b' * 64;
    refused(() => validateFutureResponse(encoded(stale), expected(0), []));
  });
  test('opaque original string and raw base64 preserved', () {
    final value = data(0);
    value['artifact'] = {
      'original_json': '{ "n":18446744073709551617, "r":1.2300e+0 }\r\n',
      'raw': '77u/ew0K',
    };
    final result = validateFutureResponse(encoded(value), expected(0), []);
    check(
      jsonEncode(result.receipt['artifact']) == jsonEncode(value['artifact']),
      'opaque value changed',
    );
  });
  test(
    'real deadline rejects never-completing request and late completion',
    () async {
      final request = Completer<void>();
      bool expired = false, advanced = false, closed = false;
      try {
        await runTaxDriverPhase<void>(
          timeout: const Duration(milliseconds: 20),
          operation: () async {
            await request.future;
            if (expired) throw StateError('late response');
            advanced = true;
          },
          onFailure: (error, stack) async {
            expired = true;
          },
          close: () async {
            closed = true;
          },
        );
        throw StateError('deadline was ignored');
      } on TimeoutException {
        /* required outcome */
      }
      request.complete();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      check(expired && closed && !advanced, 'late request advanced proof');
    },
  );
  test('driver close failure cannot emit success', () async {
    bool accepted = false;
    try {
      await runTaxDriverPhase<void>(
        timeout: const Duration(seconds: 1),
        operation: () async {},
        onFailure: (error, stack) async {},
        close: () async {
          throw StateError('close');
        },
      );
      accepted = true;
    } on StateError {
      /* required outcome */
    }
    check(!accepted, 'failed close accepted');
  });
}
