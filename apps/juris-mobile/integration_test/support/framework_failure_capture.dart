import 'package:flutter/foundation.dart';

/// Bounded diagnostic evidence for isolated synthetic application acceptance.
/// Always forwards the original error; this is not an exception filter.
final class FrameworkFailureCapture {
  FrameworkFailureCapture({
    required this.delegate,
    required this.snapshot,
    required this.publish,
  });

  final FlutterExceptionHandler delegate;
  final Map<String, Object?> Function() snapshot;
  final void Function(Map<String, Object?>) publish;
  final List<Map<String, Object?>> _records = [];
  int _omitted = 0;

  Map<String, Object?> get evidence => {
        'acceptance': false,
        'records': List<Map<String, Object?>>.unmodifiable(_records),
        'omitted': _omitted,
      };

  void handle(FlutterErrorDetails details) {
    try {
      if (_records.length < 4) {
        Map<String, Object?> metrics;
        try {
          metrics = snapshot();
        } on Object catch (error) {
          metrics = {'snapshot_error_type': '${error.runtimeType}'};
        }
        _records.add({
          'captured_at': DateTime.now().toUtc().toIso8601String(),
          'error': _bounded(details.exceptionAsString(), 2048),
          'stack': _bounded('${details.stack ?? ''}', 8192),
          'library': _bounded(details.library ?? '', 256),
          'context': _bounded(details.context?.toDescription() ?? '', 512),
          'metrics': metrics,
        });
      } else {
        _omitted++;
      }
      publish(evidence);
    } on Object {
      // A broken diagnostic must never replace or swallow the primary failure.
    } finally {
      delegate(details);
    }
  }

  String _bounded(String value, int limit) => value.length <= limit
      ? value
      : '${value.substring(0, limit)} [truncated]';
}
