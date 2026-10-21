import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../integration_test/support/framework_failure_capture.dart';

void main() {
  testWidgets('framework still reports the same pending exception',
      (tester) async {
    final originalHandler = FlutterError.onError!;
    final original = StateError('synthetic rendering failure');
    final capture = FrameworkFailureCapture(
      delegate: originalHandler,
      snapshot: () => {},
      publish: (_) {},
    );
    FlutterError.onError = capture.handle;
    try {
      FlutterError.reportError(FlutterErrorDetails(exception: original));
      expect(tester.takeException(), same(original));
    } finally {
      FlutterError.onError = originalHandler;
    }
    expect(capture.evidence['records'] as List, hasLength(1));
  });

  test('retains original framework stack and forwards every failure', () {
    final List<FlutterErrorDetails> forwarded = [];
    Map<String, Object?>? published;
    final FrameworkFailureCapture capture = FrameworkFailureCapture(
      delegate: forwarded.add,
      snapshot: () => {'phase': 'legacy-write', 'bottom': -30.0},
      publish: (value) => published = value,
    );
    final FlutterErrorDetails original = FlutterErrorDetails(
      exception: AssertionError('padding.isNonNegative'),
      stack: StackTrace.fromString('Dialog.build original-frame'),
      context: ErrorDescription('building a dialog'),
      library: 'widgets',
    );
    capture.handle(original);
    expect(forwarded.single, same(original));
    expect(published!['acceptance'], isFalse);
    final record = (published!['records'] as List).single as Map;
    expect(record['stack'], 'Dialog.build original-frame');
    expect(record['context'], 'building a dialog');
    expect(record['metrics'], {'phase': 'legacy-write', 'bottom': -30.0});
  });

  test('bounds repeated failures without dropping delegate calls', () {
    int forwards = 0;
    final capture = FrameworkFailureCapture(
      delegate: (_) => forwards++,
      snapshot: () => {},
      publish: (_) {},
    );
    for (int index = 0; index < 7; index++) {
      capture.handle(FlutterErrorDetails(
        exception: 'x' * 4000,
        stack: StackTrace.fromString('s' * 16000),
      ));
    }
    expect(forwards, 7);
    expect(capture.evidence['omitted'], 3);
    final records = capture.evidence['records'] as List;
    expect(records, hasLength(4));
    expect((records.first['error'] as String).length, lessThan(2100));
    expect((records.first['stack'] as String).length, lessThan(8250));
  });

  test('snapshot and publication failures never replace original forwarding',
      () {
    for (final bool snapshotThrows in [true, false]) {
      FlutterErrorDetails? forwarded;
      final original = FlutterErrorDetails(exception: StateError('primary'));
      final capture = FrameworkFailureCapture(
        delegate: (details) => forwarded = details,
        snapshot: () => snapshotThrows ? throw StateError('metrics') : {},
        publish: (_) => throw StateError('publication'),
      );
      capture.handle(original);
      expect(forwarded, same(original));
      expect(capture.evidence['records'] as List, hasLength(1));
    }
  });
}
