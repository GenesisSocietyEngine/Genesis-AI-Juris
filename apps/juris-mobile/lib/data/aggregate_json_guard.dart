import 'dart:convert';

/// Limits apply only to new aggregate imports and their journal payloads.
/// Ordinary workspace/sidecar reads retain their existing compatibility policy.
Map<String, dynamic> decodeAggregateJson(String original) {
  const int byteLimit = 4 * 1024 * 1024;
  final List<int> encoded = utf8.encode(original);
  if (encoded.length > byteLimit) {
    throw const FormatException('Aggregate JSON exceeds 4 MiB.');
  }
  // Prefixing prevents the UTF-8 decoder from consuming a leading BOM.
  if (utf8.decode([0x20, ...encoded]).substring(1) != original) {
    throw const FormatException(
        'Aggregate JSON must be exact valid UTF-8 text.');
  }
  int depth = 0, nodes = 0, offset = original.startsWith('\ufeff') ? 1 : 0;
  // jsonDecode keeps only the last duplicate object key. Detect that loss
  // before decoding; each object owns its decoded-key set (arrays have none).
  final List<Set<String>?> objectKeys = [];
  final List<bool> expectingKey = [];
  while (offset < original.length) {
    final int char = original.codeUnitAt(offset);
    if (char == 0x20 || char == 0x0a || char == 0x0d || char == 0x09) {
      offset++;
      continue;
    }
    if (char == 0x2c || char == 0x3a) {
      if (expectingKey.isNotEmpty) expectingKey.last = char == 0x2c;
      offset++;
      continue;
    }
    if (char == 0x5d || char == 0x7d) {
      if (--depth < 0)
        throw const FormatException('Invalid aggregate JSON structure.');
      objectKeys.removeLast();
      expectingKey.removeLast();
      offset++;
      continue;
    }
    // String object keys count toward the conservative node budget too.
    if (++nodes > 100000)
      throw const FormatException('Aggregate JSON exceeds 100,000 nodes.');
    if (char == 0x7b || char == 0x5b) {
      if (++depth > 64)
        throw const FormatException('Aggregate JSON exceeds depth 64.');
      objectKeys.add(char == 0x7b ? <String>{} : null);
      expectingKey.add(char == 0x7b);
      offset++;
    } else if (char == 0x22) {
      final int start = offset;
      offset++;
      bool closed = false;
      while (offset < original.length) {
        final int next = original.codeUnitAt(offset++);
        if (next == 0x5c) {
          offset++; // jsonDecode validates the actual escape afterwards.
        } else if (next == 0x22) {
          closed = true;
          break;
        }
      }
      if (!closed)
        throw const FormatException('Unterminated aggregate JSON string.');
      if (objectKeys.isNotEmpty &&
          objectKeys.last != null &&
          expectingKey.last) {
        final String key = jsonDecode(original.substring(start, offset));
        if (!objectKeys.last!.add(key)) {
          throw const FormatException(
              'Aggregate JSON contains duplicate object keys. Original input is unchanged.');
        }
      }
    } else {
      final int start = offset;
      while (offset < original.length &&
          !_delimiter(original.codeUnitAt(offset))) {
        offset++;
      }
      final String token = original.substring(start, offset);
      if (char == 0x2d || (char >= 0x30 && char <= 0x39)) {
        _exactNumber(token);
      } else if (token != 'true' && token != 'false' && token != 'null') {
        throw const FormatException('Invalid aggregate JSON value.');
      }
    }
  }
  if (depth != 0)
    throw const FormatException('Incomplete aggregate JSON structure.');
  final dynamic value = jsonDecode(
      original.startsWith('\ufeff') ? original.substring(1) : original);
  if (value is! Map<String, dynamic>) {
    throw const FormatException('Aggregate JSON must be an object.');
  }
  return value;
}

bool _delimiter(int value) =>
    value == 0x20 ||
    value == 0x09 ||
    value == 0x0a ||
    value == 0x0d ||
    value == 0x2c ||
    value == 0x3a ||
    value == 0x5d ||
    value == 0x7d ||
    value == 0x5b ||
    value == 0x7b ||
    value == 0x22;

final RegExp _number =
    RegExp(r'^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$');

void _exactNumber(String token) {
  if (token.length > 128)
    throw const FormatException(
        'Aggregate numeric token exceeds 128 characters.');
  final RegExpMatch? parsed = _number.firstMatch(token);
  if (parsed == null)
    throw const FormatException('Invalid aggregate JSON number.');
  String encoded;
  try {
    encoded = jsonEncode(jsonDecode(token));
  } on Object {
    throw const FormatException(
        'Aggregate number is not finite or safely representable.');
  }
  final RegExpMatch? converted = _number.firstMatch(encoded);
  if (converted == null || _decimal(parsed) != _decimal(converted)) {
    throw const FormatException(
        'Aggregate number would change value when imported. Original input is unchanged.');
  }
}

String _decimal(RegExpMatch match) {
  final String fraction = match.group(3) ?? '';
  String digits = '${match.group(2)}$fraction'.replaceFirst(RegExp(r'^0+'), '');
  if (digits.isEmpty)
    return '0'; // Positive and negative zero have equal value.
  BigInt exponent =
      BigInt.parse(match.group(4) ?? '0') - BigInt.from(fraction.length);
  final String reduced = digits.replaceFirst(RegExp(r'0+$'), '');
  exponent += BigInt.from(digits.length - reduced.length);
  digits = reduced;
  return '${match.group(1)}$digits@$exponent';
}
