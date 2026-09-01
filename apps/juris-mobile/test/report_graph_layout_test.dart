import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juris_mobile/models/report_graph_layout.dart';

const String _metricsPath =
    'assets/report_graph/report-graph-font-metrics.v1.json';
const String _fixturesPath =
    'assets/report_graph/report-graph-layout-fixtures.v1.json';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ReportGraphFontMetrics metrics;
  late ReportGraphLayoutEvaluator evaluator;
  late Map<String, dynamic> fixtureRoot;

  setUpAll(() {
    metrics = ReportGraphFontMetrics.fromJson(_readJson(_metricsPath));
    evaluator = ReportGraphLayoutEvaluator(metrics);
    fixtureRoot = _readJson(_fixturesPath);
  });

  test('generated parity assets are byte-pinned and versioned', () {
    expect(
      _sha256File(_metricsPath),
      'dce864593f4230771a0466e73eec1f7f2cf3a1024bcc83580975d4e1fefe7dda',
    );
    expect(
      _sha256File(_fixturesPath),
      '7f71a976872aa7266a7c360529430b9bdc6c2978368917bc0d61c0e3a33e249f',
    );
    expect(
      fixtureRoot['format'],
      'genesis-juris-report-graph-layout-fixtures',
    );
    expect(fixtureRoot['schemaVersion'], 1);
    expect(
      fixtureRoot['layoutSchemaVersion'],
      reportGraphLayoutSchemaVersion,
    );
    expect(
      fixtureRoot['layoutAlgorithmVersion'],
      reportGraphLayoutAlgorithmVersion,
    );
    expect(
      fixtureRoot['layoutRendererVersion'],
      reportGraphLayoutRendererVersion,
    );
    expect(
      fixtureRoot['fontSourceHashes'],
      <String, Object?>{
        'medium': metrics.medium.sourceSha256,
        'regular': metrics.regular.sourceSha256,
      },
    );
  });

  test('all web fixtures match node pages, C connectors, and fingerprint', () {
    final List<dynamic> fixtures = fixtureRoot['fixtures'] as List<dynamic>;
    expect(
      fixtures.map((dynamic fixture) => fixture['id']),
      <String>[
        'bhopal-en',
        'deep-en',
        'wide-en',
        'disconnected-en',
        'cyclic-repair-en',
        'unicode-ru',
        'max-node-en',
      ],
    );
    for (final dynamic rawFixture in fixtures) {
      final Map<String, dynamic> fixture = rawFixture as Map<String, dynamic>;
      final ReportGraphLayoutModel model = evaluator.build(
        ReportGraphLayoutInput.fromJson(fixture['input']),
      );
      final Map<String, dynamic> expected =
          fixture['expected'] as Map<String, dynamic>;

      expect(
        model.layoutFingerprint,
        expected['layoutFingerprint'],
        reason: '${fixture['id']} layout fingerprint',
      );
      final List<Map<String, String>> actualNodePages = model.nodes
          .map(
            (ReportGraphLayoutNode node) => <String, String>{
              'nodeId': node.id,
              'pageId': node.pageId,
            },
          )
          .toList(growable: false)
        ..sort(
          (Map<String, String> left, Map<String, String> right) =>
              left['nodeId']!.compareTo(right['nodeId']!),
        );
      expect(
        actualNodePages,
        expected['nodePages'],
        reason: '${fixture['id']} node pages',
      );
      final List<Map<String, String>> actualConnectors =
          model.crossPageConnectorPairs
              .map(
                (ReportGraphConnectorPair pair) => <String, String>{
                  'adjacencyRecordId': pair.adjacencyRecordId,
                  'edgeId': pair.edgeId,
                  'fromPageId': pair.fromPageId,
                  'id': pair.id,
                  'incomingId': pair.incoming.id,
                  'outgoingId': pair.outgoing.id,
                  'toPageId': pair.toPageId,
                },
              )
              .toList(growable: false);
      expect(
        actualConnectors,
        expected['connectors'],
        reason: '${fixture['id']} connectors',
      );
      for (final ReportGraphConnectorPair pair
          in model.crossPageConnectorPairs) {
        expect(pair.id, matches(RegExp(r'^C\d{3}$')));
        expect(pair.incoming.id, '${pair.id}:IN');
        expect(pair.outgoing.id, '${pair.id}:OUT');
        expect(pair.incoming.pageId, pair.toPageId);
        expect(pair.outgoing.pageId, pair.fromPageId);
      }
    }
  });

  test('pagination is deterministic for reordered input collections', () {
    final Map<String, dynamic> fixture = _fixture('bhopal-en');
    final ReportGraphLayoutInput input = ReportGraphLayoutInput.fromJson(
      fixture['input'],
    );
    final ReportGraphLayoutInput reordered = ReportGraphLayoutInput(
      caseRef: input.caseRef,
      edges: input.edges.reversed.toList(growable: false),
      nodes: input.nodes.reversed.toList(growable: false),
      presentation: input.presentation,
      profileRef: input.profileRef,
      reportRef: input.reportRef,
    );
    final ReportGraphLayoutModel baseline = evaluator.build(input);
    final ReportGraphLayoutModel repeated = evaluator.build(input);
    final ReportGraphLayoutModel shuffled = evaluator.build(reordered);
    expect(repeated.layoutFingerprint, baseline.layoutFingerprint);
    expect(shuffled.layoutFingerprint, baseline.layoutFingerprint);
    expect(
        shuffled.canonicalSerialization(), baseline.canonicalSerialization());
  });

  test('layout remains presentation-only and exposes complete text records',
      () {
    final Map<String, dynamic> fixture = _fixture('unicode-ru');
    final ReportGraphLayoutInput input = ReportGraphLayoutInput.fromJson(
      fixture['input'],
    );
    final ReportGraphLayoutModel model = evaluator.build(input);
    final Map<String, Object?> json = model.toJson();
    final Map<String, Object?> reportRef =
        json['reportRef']! as Map<String, Object?>;
    final List<Object?> nodes = json['nodes']! as List<Object?>;
    final List<Object?> nodeRecords = json['nodeTextRecords']! as List<Object?>;
    final List<Object?> adjacencyRecords =
        json['adjacencyTextRecords']! as List<Object?>;
    final List<Object?> connectorRecords =
        json['connectorTextRecords']! as List<Object?>;

    expect(
      reportRef['contentFingerprint'],
      input.reportRef.contentFingerprint,
    );
    expect(nodeRecords, hasLength(input.nodes.length));
    expect(adjacencyRecords, hasLength(input.edges.length));
    expect(
      connectorRecords,
      hasLength(model.crossPageConnectorPairs.length),
    );
    final Map<String, Object?> longNode =
        nodes.cast<Map<String, Object?>>().singleWhere(
              (Map<String, Object?> node) => node['id'] == 'ru_long',
            );
    final Map<String, Object?> text = longNode['text']! as Map<String, Object?>;
    final Map<String, Object?> title = text['title']! as Map<String, Object?>;
    final Map<String, Object?> detail = text['detail']! as Map<String, Object?>;
    expect(title['fullText'], isNot(contains('…')));
    expect(detail['fullText'], isNot(contains('…')));
    expect(
      detail['omitted'],
      isFalse,
      reason: 'complete full-width detail stays visible when it fits',
    );
    expect(detail['fullDetailReference'], isNull);
    expect(
      (detail['displayedLines']! as List<Object?>).length,
      detail['allLineCount'],
    );
  });

  test('layout geometry is portrait A4, integral, and frame bounded', () {
    final ReportGraphLayoutModel model = evaluator.build(
      ReportGraphLayoutInput.fromJson(_fixture('max-node-en')['input']),
    );
    final Map<String, Object?> json = model.toJson();
    final Map<String, Object?> paper = json['paper']! as Map<String, Object?>;
    final Map<String, Object?> graphFrame =
        json['graphFrame']! as Map<String, Object?>;
    expect(
      paper,
      <String, Object?>{
        'height': 297000,
        'orientation': 'portrait',
        'unit': 'micrometre',
        'width': 210000,
      },
    );
    for (final ReportGraphLayoutNode node in model.nodes) {
      expect(node.box.x, greaterThanOrEqualTo(graphFrame['x']! as int));
      expect(node.box.y, greaterThanOrEqualTo(graphFrame['y']! as int));
      expect(
        node.box.x + node.box.width,
        lessThanOrEqualTo(
          (graphFrame['x']! as int) + (graphFrame['width']! as int),
        ),
      );
      expect(
        node.box.y + node.box.height,
        lessThanOrEqualTo(
          (graphFrame['y']! as int) + (graphFrame['height']! as int),
        ),
      );
    }
  });

  test('public result collections and nested JSON are immutable', () {
    final ReportGraphLayoutModel model = evaluator.build(
      ReportGraphLayoutInput.fromJson(_fixture('deep-en')['input']),
    );
    expect(
      () => model.nodes.add(model.nodes.first),
      throwsUnsupportedError,
    );
    expect(
      () => model.crossPageConnectorPairs.add(
        model.crossPageConnectorPairs.first,
      ),
      throwsUnsupportedError,
    );
    expect(
      () => (model.toJson()['nodes']! as List<Object?>).clear(),
      throwsUnsupportedError,
    );
    expect(
      () => (model.toJson()['paper']! as Map<String, Object?>).clear(),
      throwsUnsupportedError,
    );
  });

  test('invalid IDs are rejected before topology or pagination', () {
    final Map<String, dynamic> source = jsonDecode(
      jsonEncode(_fixture('bhopal-en')['input']),
    ) as Map<String, dynamic>;
    final List<dynamic> nodes = source['nodes'] as List<dynamic>;
    (nodes.first as Map<String, dynamic>)['id'] = 'INVALID ID';
    final ReportGraphLayoutInput input = ReportGraphLayoutInput.fromJson(
      source,
    );
    expect(
      () => evaluator.build(input),
      throwsA(
        isA<ReportGraphLayoutException>().having(
          (ReportGraphLayoutException error) => error.code,
          'code',
          ReportGraphLayoutErrorCode.inputInvalid,
        ),
      ),
    );
  });

  test('governed font-face drift fails before layout is accepted', () {
    final Map<String, dynamic> metricSource = jsonDecode(
      jsonEncode(_readJson(_metricsPath)),
    ) as Map<String, dynamic>;
    final Map<String, dynamic> fonts =
        metricSource['fonts'] as Map<String, dynamic>;
    final Map<String, dynamic> regular =
        fonts['regular'] as Map<String, dynamic>;
    regular['sourceByteLength'] = (regular['sourceByteLength'] as int) + 1;
    final ReportGraphLayoutEvaluator tampered = ReportGraphLayoutEvaluator(
      ReportGraphFontMetrics.fromJson(metricSource),
    );
    expect(
      () => tampered.build(
        ReportGraphLayoutInput.fromJson(_fixture('bhopal-en')['input']),
      ),
      throwsA(
        isA<ReportGraphLayoutException>().having(
          (ReportGraphLayoutException error) => error.code,
          'code',
          ReportGraphLayoutErrorCode.fontMetricsInvalid,
        ),
      ),
    );
  });

  test('XML, cmap, and exact-face shaping hazards fail closed', () {
    final Map<String, dynamic> metricSource = _readJson(_metricsPath);
    final Map<String, dynamic> fonts =
        metricSource['fonts'] as Map<String, dynamic>;
    final Map<String, dynamic> regular =
        fonts['regular'] as Map<String, dynamic>;
    final String unsafePair =
        (regular['unsafeShapingPairs'] as List<dynamic>).first as String;
    final List<int> unsafeCodePoints =
        unsafePair.split(',').map(int.parse).toList(growable: false);
    final Map<String, String> hazards = <String, String>{
      String.fromCharCode(0xfdd0): 'XML_INVALID',
      String.fromCharCode(0x1f600): 'FONT_UNSUPPORTED',
      String.fromCharCodes(unsafeCodePoints): 'SHAPING_UNSAFE',
    };
    for (final MapEntry<String, String> hazard in hazards.entries) {
      final Map<String, dynamic> source = jsonDecode(
        jsonEncode(_fixture('bhopal-en')['input']),
      ) as Map<String, dynamic>;
      final List<dynamic> nodes = source['nodes'] as List<dynamic>;
      (nodes.first as Map<String, dynamic>)['title'] = hazard.key;
      expect(
        () => evaluator.build(ReportGraphLayoutInput.fromJson(source)),
        throwsA(
          isA<ReportGraphLayoutException>()
              .having(
                (ReportGraphLayoutException error) => error.code,
                'code',
                ReportGraphLayoutErrorCode.inputInvalid,
              )
              .having(
                (ReportGraphLayoutException error) => error.context['reason'],
                'reason',
                hazard.value,
              ),
        ),
        reason: hazard.value,
      );
    }
  });
}

Map<String, dynamic> _readJson(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

String _sha256File(String path) =>
    sha256.convert(File(path).readAsBytesSync()).toString();

Map<String, dynamic> _fixture(String id) =>
    (_readJson(_fixturesPath)['fixtures'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .singleWhere((Map<String, dynamic> fixture) => fixture['id'] == id);
