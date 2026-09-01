import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:juris_mobile/models/report_graph_layout.dart';

const String _defaultMetrics =
    'assets/report_graph/report-graph-font-metrics.v1.json';
const String _defaultFixtures =
    'assets/report_graph/report-graph-layout-fixtures.v1.json';
const String _defaultManifest = 'assets/case_types/report-manifest.v1.json';

void main(List<String> arguments) {
  final Map<String, String?> options = _options(arguments);
  if (!options.containsKey('check')) {
    stderr
        .writeln('Usage: dart run tool/verify_report_graph_layout.dart --check '
            '[--manifest PATH] [--font-metrics PATH] [--fixtures PATH] '
            '[--diagnostics]');
    exitCode = 64;
    return;
  }
  final String metricsPath = options['font-metrics'] ?? _defaultMetrics;
  final String fixturesPath = options['fixtures'] ?? _defaultFixtures;
  final String manifestPath = options['manifest'] ?? _defaultManifest;
  try {
    _validateManifest(manifestPath);
    final ReportGraphFontMetrics metrics = ReportGraphFontMetrics.fromJson(
      _readJson(metricsPath),
    );
    final Map<String, dynamic> root = _readJson(fixturesPath);
    _expect(root['format'] == 'genesis-juris-report-graph-layout-fixtures',
        'fixture format');
    _expect(root['schemaVersion'] == 1, 'fixture schema');
    _expect(root['layoutSchemaVersion'] == reportGraphLayoutSchemaVersion,
        'layout schema');
    _expect(
      root['layoutAlgorithmVersion'] == reportGraphLayoutAlgorithmVersion,
      'layout algorithm',
    );
    _expect(
      root['layoutRendererVersion'] == reportGraphLayoutRendererVersion,
      'layout renderer',
    );
    final List<dynamic> fixtures = root['fixtures'] as List<dynamic>;
    final ReportGraphLayoutEvaluator evaluator =
        ReportGraphLayoutEvaluator(metrics);
    final List<Map<String, Object?>> receipts = <Map<String, Object?>>[];
    for (final dynamic rawFixture in fixtures) {
      final Map<String, dynamic> fixture = rawFixture as Map<String, dynamic>;
      final String fixtureId = fixture['id']! as String;
      final ReportGraphLayoutModel model = evaluator.build(
        ReportGraphLayoutInput.fromJson(fixture['input']),
      );
      final Map<String, dynamic> expected =
          fixture['expected'] as Map<String, dynamic>;
      if (options.containsKey('diagnostics')) {
        final Map<String, Object?> body = model.toJson();
        final Map<String, String> hashes = <String, String>{};
        for (final MapEntry<String, Object?> entry in body.entries) {
          hashes[entry.key] = _fingerprint(entry.value);
        }
        stdout.writeln(jsonEncode(<String, Object?>{
          'cross_page_connector_pairs': body['crossPageConnectorPairs'],
          'fixture_id': fixtureId,
          'section_hashes': hashes,
        }));
      }
      _expect(
        model.layoutFingerprint == expected['layoutFingerprint'],
        '$fixtureId layout fingerprint: expected '
        '${expected['layoutFingerprint']}, got ${model.layoutFingerprint}',
      );
      final List<Map<String, String>> nodePages = model.nodes
          .map((ReportGraphLayoutNode node) => <String, String>{
                'nodeId': node.id,
                'pageId': node.pageId,
              })
          .toList(growable: false)
        ..sort((Map<String, String> left, Map<String, String> right) =>
            left['nodeId']!.compareTo(right['nodeId']!));
      _expect(_deepEqual(nodePages, expected['nodePages']),
          '$fixtureId node-page assignments');
      final List<Map<String, String>> connectors = model.crossPageConnectorPairs
          .map((ReportGraphConnectorPair pair) => <String, String>{
                'adjacencyRecordId': pair.adjacencyRecordId,
                'edgeId': pair.edgeId,
                'fromPageId': pair.fromPageId,
                'id': pair.id,
                'incomingId': pair.incoming.id,
                'outgoingId': pair.outgoing.id,
                'toPageId': pair.toPageId,
              })
          .toList(growable: false);
      _expect(_deepEqual(connectors, expected['connectors']),
          '$fixtureId connector assignments');
      receipts.add(<String, Object?>{
        'connector_count': connectors.length,
        'fixture_id': fixtureId,
        'layout_fingerprint': model.layoutFingerprint,
        'node_count': model.nodes.length,
      });
    }
    stdout.writeln(jsonEncode(<String, Object?>{
      'format': 'genesis-juris-flutter-report-graph-parity-receipt',
      'schema_version': 1,
      'fixture_count': fixtures.length,
      'fixtures_sha256': _fileSha256(fixturesPath),
      'font_metrics_sha256': _fileSha256(metricsPath),
      'manifest_sha256': _fileSha256(manifestPath),
      'receipts': receipts,
      'status': 'pass',
    }));
  } on Object catch (error) {
    stderr.writeln('FAIL Flutter report graph parity: $error');
    exitCode = 1;
  }
}

Map<String, String?> _options(List<String> arguments) {
  final Map<String, String?> result = <String, String?>{};
  for (int index = 0; index < arguments.length; index += 1) {
    final String argument = arguments[index];
    if (argument == '--check') {
      result['check'] = null;
    } else if (argument == '--diagnostics') {
      result['diagnostics'] = null;
    } else if (argument == '--manifest' ||
        argument == '--font-metrics' ||
        argument == '--fixtures') {
      if (index + 1 >= arguments.length) {
        throw FormatException('Missing value for $argument.');
      }
      result[argument.substring(2)] = arguments[index += 1];
    } else {
      throw FormatException('Unknown argument: $argument.');
    }
  }
  return result;
}

void _validateManifest(String manifestPath) {
  final Map<String, dynamic> manifest = _readJson(manifestPath);
  final Map<String, dynamic> localManifest = _readJson(_defaultManifest);
  _expect(
    _deepEqual(manifest, localManifest),
    'web/mobile report manifest JSON equality',
  );
  _expect(
    _fileSha256(manifestPath) == _fileSha256(_defaultManifest),
    'web/mobile report manifest byte equality',
  );
  _expect(
    manifest['format'] == 'genesis-juris-report-manifest' &&
        manifest['manifest'] == 'genesis-juris-report-manifest' &&
        manifest['schemaVersion'] == 1,
    'report manifest identity',
  );
  final Map<String, dynamic> layout =
      manifest['layout'] as Map<String, dynamic>;
  _expect(layout['scope'] == 'presentation_only', 'layout scope');
  _expect(
    layout['layoutSchemaVersion'] == reportGraphLayoutSchemaVersion,
    'manifest layout schema',
  );
  _expect(
    layout['layoutAlgorithmVersion'] == reportGraphLayoutAlgorithmVersion,
    'manifest layout algorithm',
  );
  _expect(
    layout['layoutRendererVersion'] == reportGraphLayoutRendererVersion,
    'manifest layout renderer',
  );
}

Map<String, dynamic> _readJson(String path) {
  final Object? decoded = jsonDecode(File(path).readAsStringSync());
  if (decoded is! Map<String, dynamic>) {
    throw FormatException('$path must contain one JSON object.');
  }
  return decoded;
}

String _fileSha256(String path) =>
    sha256.convert(File(path).readAsBytesSync()).toString();

String _fingerprint(Object? value) =>
    'sha256-${sha256.convert(utf8.encode(_canonicalJson(value)))}';

String _canonicalJson(Object? value) {
  if (value == null || value is num || value is bool || value is String) {
    return jsonEncode(value);
  }
  if (value is List) {
    return '[${value.map<String>(_canonicalJson).join(',')}]';
  }
  if (value is Map) {
    final List<MapEntry<String, Object?>> entries = value.entries
        .map((MapEntry<dynamic, dynamic> entry) =>
            MapEntry<String, Object?>(entry.key! as String, entry.value))
        .toList(growable: false)
      ..sort(
          (MapEntry<String, Object?> left, MapEntry<String, Object?> right) =>
              left.key.compareTo(right.key));
    return '{${entries.map<String>((MapEntry<String, Object?> entry) => '${jsonEncode(entry.key)}:${_canonicalJson(entry.value)}').join(',')}}';
  }
  throw FormatException('Unsupported JSON value: ${value.runtimeType}.');
}

bool _deepEqual(Object? left, Object? right) =>
    _canonicalJson(left) == _canonicalJson(right);

void _expect(bool condition, String label) {
  if (!condition) throw StateError(label);
}
