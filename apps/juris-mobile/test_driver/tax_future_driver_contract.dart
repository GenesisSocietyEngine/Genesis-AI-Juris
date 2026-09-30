// PREPARATION ONLY. Pure host-side response checks, not application acceptance.
import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

const futurePhases = <String>[
  'baseline-write',
  'baseline-read',
  'workspace-future',
  'tax-future-unsafe',
  'import-future-unsafe',
  'tax-future-safe',
  'import-future-safe',
  'tax-future-tmp',
  'tax-future-bak',
  'restored-read',
];
const futureSelectedTest = 'production application future data preservation';
const futureReceiptSchema = 'tax-ios-future-application-v1';
const futureResponseLimit = 64 * 1024 * 1024;
const futureScreenshotLimit = 4 * 1024 * 1024;

void requireFuture(bool condition, String message) {
  if (!condition) throw FormatException(message);
}

final class FuturePhaseExpectation {
  FuturePhaseExpectation(this.phase, this.source, this.nonce, this.pid) {
    requireFuture(futurePhases.contains(phase), 'Unexpected future phase.');
    requireFuture(
      RegExp(r'^[a-f0-9]{40}$').hasMatch(source),
      'Invalid source SHA.',
    );
    requireFuture(
      RegExp(r'^[0-9]+-[0-9]+$').hasMatch(nonce),
      'Invalid run nonce.',
    );
    requireFuture(pid > 0, 'Expected launched Runner PID is required.');
  }
  final String phase, source, nonce;
  final int pid;
  int get index => futurePhases.indexOf(phase);
}

/// Detect duplicate (including escaped-equivalent) keys before jsonDecode can
/// collapse them. Syntax is still validated by jsonDecode. Numbers embedded in
/// retained original strings are never interpreted as receipt numbers.
Map<String, dynamic> decodeFutureObject(String encoded) {
  requireFuture(
    utf8.encode(encoded).length <= futureResponseLimit,
    'Future response exceeds 64 MiB.',
  );
  final scanner = _UniqueKeys(encoded);
  scanner.value(0);
  scanner.space();
  requireFuture(scanner.offset == encoded.length, 'Trailing JSON data.');
  final dynamic value = jsonDecode(encoded);
  requireFuture(value is Map<String, dynamic>, 'Expected one JSON object.');
  return value as Map<String, dynamic>;
}

final class _UniqueKeys {
  _UniqueKeys(this.text);
  final String text;
  int offset = 0, nodes = 0;
  void space() {
    while (offset < text.length && ' \r\n\t'.contains(text[offset])) {
      offset++;
    }
  }

  String string() {
    final start = offset++;
    while (offset < text.length) {
      final char = text[offset++];
      if (char == r'\') {
        offset++;
      } else if (char == '"') {
        return jsonDecode(text.substring(start, offset)) as String;
      }
    }
    throw const FormatException('Unterminated JSON string.');
  }

  void take(String char) {
    space();
    requireFuture(
      offset < text.length && text[offset] == char,
      'Malformed JSON.',
    );
    offset++;
  }

  void value(int depth) {
    requireFuture(
      depth <= 64 && ++nodes <= 8000000,
      'JSON structure exceeds bounds.',
    );
    space();
    requireFuture(offset < text.length, 'Incomplete JSON.');
    final char = text[offset];
    if (char == '{' || char == '[') {
      offset++;
      final object = char == '{', end = char == '{' ? '}' : ']';
      final keys = <String>{};
      space();
      if (offset < text.length && text[offset] == end) {
        offset++;
        return;
      }
      while (true) {
        space();
        if (object) {
          requireFuture(
            offset < text.length && text[offset] == '"',
            'Missing object key.',
          );
          requireFuture(keys.add(string()), 'Duplicate JSON key.');
          take(':');
        }
        value(depth + 1);
        space();
        requireFuture(offset < text.length, 'Incomplete JSON collection.');
        if (text[offset] == end) {
          offset++;
          return;
        }
        take(',');
      }
    } else if (char == '"') {
      string();
    } else {
      final start = offset;
      while (offset < text.length && !' \r\n\t,]}'.contains(text[offset])) {
        offset++;
      }
      requireFuture(offset > start, 'Missing JSON value.');
    }
  }
}

const _common = <String>{
  'schema',
  'selected_test',
  'phase',
  'completed_phase',
  'phase_index',
  'control_sha256',
  'source_sha',
  'run_nonce',
  'pid',
  'previous_pid',
  'platform',
  'support_path',
  'entry_method',
  'constructed_fixture',
  'interruption_evidence',
  'before',
  'after',
  'native_calls',
  'clipboard_before',
  'clipboard_after',
};

void _keys(Map<String, dynamic> object, Set<String> expected) {
  requireFuture(
    object.length == expected.length && expected.every(object.containsKey),
    'Missing or unexpected receipt fields.',
  );
}

void validateFutureReceipt(
  Map<String, dynamic> receipt,
  FuturePhaseExpectation expected, {
  required bool retained,
}) {
  final phase = expected.phase;
  final fields = <String>{..._common, retained ? 'screenshot' : 'screenshots'};
  if (phase == 'baseline-write' ||
      phase == 'baseline-read' ||
      phase == 'restored-read') {
    fields.addAll([
      'scenario',
      'artifact',
      'workspace_progress',
      'workspace_envelope',
    ]);
  } else if (phase == 'workspace-future') {
    fields.add('persistent_recovery');
  } else if (phase.startsWith('tax-future-')) {
    fields.add('tax_read_only');
    if (phase == 'tax-future-safe' || phase == 'tax-future-unsafe') {
      fields.addAll(['export', 'clipboard_export_base64']);
    }
  } else {
    fields.addAll([
      'import_before',
      'expected_refusal',
      'imported_raw_base64',
      'navigation_progress_before_import',
    ]);
  }
  _keys(receipt, fields);
  requireFuture(
    receipt['schema'] == futureReceiptSchema &&
        receipt['selected_test'] == futureSelectedTest &&
        receipt['phase'] == phase &&
        receipt['completed_phase'] == phase &&
        receipt['phase_index'] is int &&
        receipt['phase_index'] == expected.index &&
        receipt['source_sha'] == expected.source &&
        receipt['run_nonce'] == expected.nonce &&
        receipt['pid'] is int &&
        receipt['pid'] == expected.pid &&
        receipt['platform'] == 'ios' &&
        receipt['entry_method'] == 'programmatic_flutter_test' &&
        receipt['constructed_fixture'] == phase.contains('future') &&
        receipt['interruption_evidence'] == false,
    'Source/test/phase/process identity mismatch.',
  );
  requireFuture(
    receipt['support_path'] is String &&
        (receipt['support_path'] as String).startsWith('/') &&
        !(receipt['support_path'] as String).split('/').contains('..'),
    'Invalid support path.',
  );
  requireFuture(
    receipt['before'] is Map<String, dynamic> &&
        receipt['after'] is Map<String, dynamic> &&
        receipt['native_calls'] is List<dynamic> &&
        (receipt['clipboard_before'] == null ||
            receipt['clipboard_before'] is String) &&
        (receipt['clipboard_after'] == null ||
            receipt['clipboard_after'] is String),
    'Missing inventory/native/clipboard evidence.',
  );
  if (expected.index == 0) {
    requireFuture(
      receipt['previous_pid'] == null && receipt['control_sha256'] == null,
      'First phase has stale control/process identity.',
    );
  } else {
    requireFuture(
      receipt['previous_pid'] is int &&
          (receipt['previous_pid'] as int) > 0 &&
          receipt['previous_pid'] != expected.pid &&
          receipt['control_sha256'] is String &&
          RegExp(
            r'^[a-f0-9]{64}$',
          ).hasMatch(receipt['control_sha256'] as String),
      'Missing control or new-process evidence.',
    );
  }
  for (final name in [
    'scenario',
    'artifact',
    'workspace_progress',
    'workspace_envelope',
    'import_before',
    'export',
  ]) {
    if (fields.contains(name))
      requireFuture(receipt[name] is Map<String, dynamic>, 'Malformed $name.');
  }
  for (final name in [
    'persistent_recovery',
    'tax_read_only',
    'navigation_progress_before_import',
  ]) {
    if (fields.contains(name))
      requireFuture(receipt[name] == true, 'Missing $name evidence.');
  }
  for (final name in [
    'clipboard_export_base64',
    'imported_raw_base64',
    'expected_refusal',
  ]) {
    if (fields.contains(name))
      requireFuture(
        receipt[name] is String && (receipt[name] as String).isNotEmpty,
        'Missing $name evidence.',
      );
  }
}

Uint8List validateFuturePng(dynamic value) {
  requireFuture(
    value is List &&
        value.length >= 57 &&
        value.length <= futureScreenshotLimit,
    'Missing or oversized screenshot.',
  );
  final list = value as List;
  requireFuture(
    list.every((dynamic byte) => byte is int && byte >= 0 && byte <= 255),
    'Screenshot contains invalid bytes.',
  );
  final bytes = Uint8List.fromList(list.cast<int>());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  requireFuture(
    List.generate(8, (i) => bytes[i] == signature[i]).every((x) => x),
    'Not a PNG.',
  );
  final data = ByteData.sublistView(bytes);
  var offset = 8, chunks = 0;
  bool idat = false, end = false;
  while (offset + 12 <= bytes.length) {
    final size = data.getUint32(offset),
        name = ascii.decode(bytes.sublist(offset + 4, offset + 8));
    requireFuture(
      size <= futureScreenshotLimit && offset + size + 12 <= bytes.length,
      'Truncated PNG.',
    );
    if (chunks++ == 0) {
      requireFuture(
        name == 'IHDR' &&
            size == 13 &&
            data.getUint32(offset + 8) > 0 &&
            data.getUint32(offset + 12) > 0,
        'PNG has no nonempty IHDR.',
      );
    } else {
      requireFuture(name != 'IHDR', 'Duplicate PNG header.');
    }
    if (name == 'IDAT' && size > 0) idat = true;
    offset += size + 12;
    if (name == 'IEND') {
      requireFuture(size == 0 && offset == bytes.length, 'Invalid PNG end.');
      end = true;
      break;
    }
  }
  requireFuture(end && idat, 'PNG has no image data/end.');
  return bytes;
}

Map<String, dynamic> futureScreenshot(String phase, List<int> bytes) => {
  'filename': '$phase-future.png',
  'bytes': bytes.length,
  'sha256': sha256.convert(bytes).toString(),
};

void validateFutureRetainedScreenshot(
  Map<String, dynamic> receipt,
  List<int> bytes,
) {
  final actual = receipt['screenshot'];
  requireFuture(
    actual is Map<String, dynamic>,
    'Prior screenshot binding is absent.',
  );
  _keys(actual as Map<String, dynamic>, {'filename', 'bytes', 'sha256'});
  requireFuture(
    actual['bytes'] is int &&
        actual['sha256'] is String &&
        RegExp(r'^[a-f0-9]{64}$').hasMatch(actual['sha256'] as String),
    'Malformed prior screenshot length or hash.',
  );
  final png = validateFuturePng(bytes);
  final expected = futureScreenshot(receipt['phase'] as String, png);
  requireFuture(
    expected.entries.every((entry) => actual[entry.key] == entry.value),
    'Prior screenshot bytes do not match receipt.',
  );
}

final class ValidatedFutureResponse {
  ValidatedFutureResponse(this.receipt, this.png);
  final Map<String, dynamic> receipt;
  final Uint8List png;
}

ValidatedFutureResponse validateFutureResponse(
  String encoded,
  FuturePhaseExpectation expected,
  List<Map<String, dynamic>> prior,
) {
  final response = decodeFutureObject(encoded);
  _keys(response, {'result', 'failureDetails', 'data'});
  requireFuture(
    response['result'] == 'true' &&
        response['failureDetails'] is List &&
        (response['failureDetails'] as List).isEmpty &&
        response['data'] is Map<String, dynamic>,
    'Selected future test did not complete successfully.',
  );
  final receipt = response['data'] as Map<String, dynamic>;
  validateFutureReceipt(receipt, expected, retained: false);
  requireFuture(
    prior.length == expected.index,
    'Missing or ambiguous prior phase chain.',
  );
  final pids = <int>{};
  for (var i = 0; i < prior.length; i++) {
    final previous = prior[i];
    requireFuture(previous['pid'] is int, 'Missing prior process identity.');
    validateFutureReceipt(
      previous,
      FuturePhaseExpectation(
        futurePhases[i],
        expected.source,
        expected.nonce,
        previous['pid'] as int,
      ),
      retained: true,
    );
    requireFuture(
      pids.add(previous['pid'] as int) &&
          previous['pid'] != expected.pid &&
          previous['previous_pid'] == (i == 0 ? null : prior[i - 1]['pid']),
      'Broken prior process chain.',
    );
  }
  requireFuture(
    receipt['previous_pid'] == (prior.isEmpty ? null : prior.last['pid']),
    'Current previous PID differs from accepted host chain.',
  );
  final shots = receipt.remove('screenshots');
  requireFuture(
    shots is List && shots.length == 1 && shots.single is Map<String, dynamic>,
    'Exactly one current-phase screenshot is required.',
  );
  final shot = (shots as List).single as Map<String, dynamic>;
  _keys(shot, {'screenshotName', 'bytes'});
  requireFuture(
    shot['screenshotName'] == '${expected.phase}-future',
    'Unexpected screenshot identity.',
  );
  final png = validateFuturePng(shot['bytes']);
  receipt['screenshot'] = futureScreenshot(expected.phase, png);
  return ValidatedFutureResponse(receipt, png);
}
