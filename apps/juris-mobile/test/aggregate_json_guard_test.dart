import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/data/aggregate_json_guard.dart';

void main() {
  test('leading BOM is preserved as caller text while JSON remains readable',
      () {
    expect(decodeAggregateJson('\ufeff {"n":1.2300e+0}\r\n'), {'n': 1.23});
  });
  test('literal lone surrogate is rejected before encoding replaces it', () {
    final String original = '{"value":"${String.fromCharCode(0xd800)}"}';
    expect(() => decodeAggregateJson(original), throwsFormatException);
  });
  for (final String token in [
    '1.2300e+0',
    '1e308',
    '1e-300',
    '-0',
    '-0.000e+50',
    '9223372036854775807',
    '0.125'
  ]) {
    test('accepts unchanged exact decimal value $token', () {
      expect(decodeAggregateJson('{"n":$token}').containsKey('n'), isTrue);
    });
  }
  for (final String token in [
    '18446744073709551617',
    '9007199254740993.0',
    '0.100000000000000005',
    '1e309',
    '1e-999',
    '-1e999'
  ]) {
    test('rejects rounded or nonfinite numeric value $token', () {
      expect(() => decodeAggregateJson('{"n":$token}'), throwsFormatException);
    });
  }
  test('retained JSON strings are not scanned as numeric values', () {
    const String raw = '{ "amount": 18446744073709551617, "fx":1.2300e+0 }';
    final String encoded = jsonEncode({
      'legacy': {'original_json': raw},
      'escape': 'quote " slash \\ and [ ]'
    });
    expect(decodeAggregateJson(encoded)['legacy']['original_json'], raw);
  });
  for (final String ambiguous in [
    r'{"same":1,"same":2}',
    r'{"same":1,"\u0073ame":2}',
    r'{"nested":{"same":1,"same":2}}',
    r'{"array":[{"same":1,"\u0073ame":2}]}',
  ]) {
    test('rejects duplicate decoded keys $ambiguous', () {
      expect(() => decodeAggregateJson(ambiguous), throwsFormatException);
    });
  }
  test('identical keys in distinct objects and retained raw strings survive',
      () {
    const String raw = r'{"same":1,"\u0073ame":2}';
    final Map<String, dynamic> value = {
      'same': 1,
      'nested': {'same': 2},
      'array': [
        {'same': 3},
        {'same': 4},
      ],
      'original_json': raw,
    };
    expect(decodeAggregateJson(jsonEncode(value)), value);
  });
  test('escaped lone surrogates remain escaped on JSON UTF-8 round trip', () {
    for (final String raw in [
      r'{"value":"\ud800"}',
      r'{"\ud800":"value"}',
    ]) {
      final String encoded = jsonEncode(decodeAggregateJson(raw));
      expect(encoded, raw);
      expect(utf8.decode(utf8.encode(encoded)), raw);
    }
  });
  test('depth limit is checked before decoding', () {
    expect(decodeAggregateJson('{"v":${'[' * 63}0${']' * 63}}')['v'], isList);
    expect(() => decodeAggregateJson('{"v":${'[' * 64}0${']' * 64}}'),
        throwsFormatException);
  });
  test('node budget includes container values and object keys', () {
    expect(
        decodeAggregateJson(
            '{"v":[${List.filled(99997, 'null').join(',')}]}')['v'],
        hasLength(99997));
    expect(
        () => decodeAggregateJson(
            '{"v":[${List.filled(99998, 'null').join(',')}]}'),
        throwsFormatException);
  });
  test('UTF-8 byte and numeric token bounds are independent', () {
    expect(
        () =>
            decodeAggregateJson(jsonEncode({'text': 'é' * (2 * 1024 * 1024)})),
        throwsFormatException);
    expect(() => decodeAggregateJson('{"n":1.${'0' * 127}}'),
        throwsFormatException);
    expect(decodeAggregateJson('{"n":1.${'0' * 126}}')['n'], 1);
  });
  for (final String malformed in [
    '{"a":[}',
    '{"a":01}',
    '{"a":true false}',
    '{"a":"unfinished}',
    '{"a":}',
    '[]',
    '{"a":1e+}',
    '{"a":1{"b":2}}'
  ]) {
    test('rejects malformed JSON $malformed', () {
      expect(() => decodeAggregateJson(malformed), throwsFormatException);
    });
  }
}
