library;

import 'dart:collection';
import 'dart:convert';

import 'package:crypto/crypto.dart';

import 'report_contract.dart'
    show
        reportLayoutAlgorithmVersion,
        reportLayoutRendererVersion,
        reportLayoutSchemaVersion;

part 'report_graph_layout_engine.dart';
part 'report_graph_layout_output.dart';
part 'report_graph_layout_text.dart';
part 'report_graph_layout_topology.dart';

const int reportGraphLayoutSchemaVersion = reportLayoutSchemaVersion;
const String reportGraphLayoutAlgorithmVersion = reportLayoutAlgorithmVersion;
const String reportGraphLayoutRendererVersion = reportLayoutRendererVersion;
const String reportGraphFixedUnit = 'micrometre';
const int reportGraphMaxNodes = 200;
const int reportGraphMaxEdges = 500;
const int reportGraphMaxPortraitLanes = 3;
const int reportGraphConnectorCellWidth = 26000;
const int reportGraphConnectorRowHeight = 11000;
const int reportGraphConnectorNodeGap = 3000;
const int reportGraphConnectorMarkerRadius = 2800;
const int reportGraphConnectorMarkerLabelGap = 600;
const int reportGraphConnectorLabelWidth = 10600;
const int reportGraphConnectorLabelHeight = 9000;
const int reportGraphConnectorMinSizeMilliPoints = 6200;
const int reportGraphConnectorIdSizeMilliPoints =
    reportGraphConnectorMinSizeMilliPoints;
const int reportGraphConnectorReferenceSizeMilliPoints =
    reportGraphConnectorMinSizeMilliPoints;
const int reportGraphConnectorIdBaselineOffset = 700;
const int reportGraphConnectorReferencePrimaryBaselineOffset = 3400;
const int reportGraphConnectorReferenceSecondaryBaselineOffset = 7400;
const int reportGraphConnectorLabelXOffset = 400;
const int reportGraphConnectorMarkerCenterXOffset = 14400;
const int reportGraphConnectorRouteLaneXOffset = 18800;
const int reportGraphConnectorRouteLaneStep = 1000;
const int reportGraphConnectorMaxRowsPerSide = 7;
const int reportGraphConnectorMarkerStrokeWidth = 600;
const int reportGraphConnectorLabelStrokeWidth = 400;
const int reportGraphConnectorPathStrokeWidth = 600;
const int reportGraphNodeStrokeWidth = 500;
const int reportGraphRouteClearance = 1000;
const int reportGraphConnectorColumns = 182000 ~/ reportGraphConnectorCellWidth;
const String reportGraphFontMetricsAsset =
    'assets/report_graph/report-graph-font-metrics.v1.json';
const String reportGraphLayoutFixturesAsset =
    'assets/report_graph/report-graph-layout-fixtures.v1.json';

const String _fingerprintKind = 'genesis-juris-report-graph-layout';
final RegExp _idPattern = RegExp(r'^[a-z0-9][a-z0-9_-]{0,79}$');
final RegExp _fingerprintPattern = RegExp(r'^sha256-[a-f0-9]{64}$');
final RegExp _canonicalKeyPattern = RegExp(r'^[A-Za-z][A-Za-z0-9]*$');
const Set<String> _nodeTypes = <String>{
  'actor',
  'cash_flow',
  'deadline',
  'decision',
  'entity',
  'evidence',
  'fact',
  'outcome',
  'tax_rule',
  'trigger',
};

enum ReportGraphLayoutErrorCode {
  fontMetricsInvalid('FONT_METRICS_INVALID'),
  inputInvalid('INPUT_INVALID'),
  nodeExceedsPrintableFrame('NODE_EXCEEDS_PRINTABLE_FRAME'),
  referenceMismatch('REFERENCE_MISMATCH');

  const ReportGraphLayoutErrorCode(this.wireName);

  final String wireName;
}

final class ReportGraphLayoutException implements Exception {
  ReportGraphLayoutException(
    this.code,
    this.message, [
    Map<String, Object> context = const <String, Object>{},
  ]) : context = UnmodifiableMapView<String, Object>(
          Map<String, Object>.from(context),
        );

  final ReportGraphLayoutErrorCode code;
  final String message;
  final Map<String, Object> context;

  @override
  String toString() => 'ReportGraphLayoutException'
      '(${code.wireName}, $message, $context)';
}

Never _fail(
  ReportGraphLayoutErrorCode code,
  String message, [
  Map<String, Object> context = const <String, Object>{},
]) {
  throw ReportGraphLayoutException(code, message, context);
}

final class ReportGraphCaseReference {
  const ReportGraphCaseReference({
    required this.fingerprint,
    required this.id,
    required this.title,
    required this.version,
  });

  factory ReportGraphCaseReference.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'caseRef');
    return ReportGraphCaseReference(
      fingerprint: _jsonString(root['fingerprint'], 'caseRef.fingerprint'),
      id: _jsonString(root['id'], 'caseRef.id'),
      title: _jsonString(root['title'], 'caseRef.title'),
      version: _jsonString(root['version'], 'caseRef.version'),
    );
  }

  final String fingerprint;
  final String id;
  final String title;
  final String version;

  Map<String, Object?> toJson() => <String, Object?>{
        'fingerprint': fingerprint,
        'id': id,
        'title': title,
        'version': version,
      };
}

final class ReportGraphProfileReference {
  const ReportGraphProfileReference({required this.id, required this.kind});

  factory ReportGraphProfileReference.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'profileRef');
    return ReportGraphProfileReference(
      id: _jsonString(root['id'], 'profileRef.id'),
      kind: _jsonString(root['kind'], 'profileRef.kind'),
    );
  }

  final String id;
  final String kind;

  Map<String, Object?> toJson() => <String, Object?>{
        'id': id,
        'kind': kind,
      };
}

final class ReportGraphReportReference {
  const ReportGraphReportReference({
    required this.contentFingerprint,
    required this.modelRendererVersion,
    required this.modelSchemaVersion,
  });

  factory ReportGraphReportReference.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'reportRef');
    return ReportGraphReportReference(
      contentFingerprint: _jsonString(
        root['contentFingerprint'],
        'reportRef.contentFingerprint',
      ),
      modelRendererVersion: _jsonString(
        root['modelRendererVersion'],
        'reportRef.modelRendererVersion',
      ),
      modelSchemaVersion: _jsonInt(
        root['modelSchemaVersion'],
        'reportRef.modelSchemaVersion',
      ),
    );
  }

  final String contentFingerprint;
  final String modelRendererVersion;
  final int modelSchemaVersion;

  Map<String, Object?> toJson() => <String, Object?>{
        'contentFingerprint': contentFingerprint,
        'modelRendererVersion': modelRendererVersion,
        'modelSchemaVersion': modelSchemaVersion,
      };
}

final class ReportGraphPresentation {
  ReportGraphPresentation({
    required this.language,
    required List<String> redactedNodeIds,
    required this.sourceEdgeCount,
    required this.sourceNodeCount,
  }) : redactedNodeIds = List<String>.unmodifiable(redactedNodeIds);

  factory ReportGraphPresentation.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'presentation');
    return ReportGraphPresentation(
      language: _jsonString(root['language'], 'presentation.language'),
      redactedNodeIds: _jsonStringList(
        root['redactedNodeIds'],
        'presentation.redactedNodeIds',
      ),
      sourceEdgeCount: _jsonInt(
        root['sourceEdgeCount'],
        'presentation.sourceEdgeCount',
      ),
      sourceNodeCount: _jsonInt(
        root['sourceNodeCount'],
        'presentation.sourceNodeCount',
      ),
    );
  }

  final String language;
  final List<String> redactedNodeIds;
  final int sourceEdgeCount;
  final int sourceNodeCount;

  Map<String, Object?> toJson() => <String, Object?>{
        'language': language,
        'redactedNodeIds': List<String>.from(redactedNodeIds),
        'sourceEdgeCount': sourceEdgeCount,
        'sourceNodeCount': sourceNodeCount,
      };
}

final class ReportGraphInputNode {
  const ReportGraphInputNode({
    required this.detail,
    required this.id,
    required this.title,
    required this.type,
  });

  factory ReportGraphInputNode.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'node');
    return ReportGraphInputNode(
      detail: _jsonString(root['detail'], 'node.detail'),
      id: _jsonString(root['id'], 'node.id'),
      title: _jsonString(root['title'], 'node.title'),
      type: _jsonString(root['type'], 'node.type'),
    );
  }

  final String detail;
  final String id;
  final String title;
  final String type;

  Map<String, Object?> toJson() => <String, Object?>{
        'detail': detail,
        'id': id,
        'title': title,
        'type': type,
      };
}

final class ReportGraphInputEdge {
  ReportGraphInputEdge({
    required List<String> annotations,
    required this.detail,
    required this.from,
    required this.id,
    required this.label,
    required this.result,
    required this.to,
  }) : annotations = List<String>.unmodifiable(annotations);

  factory ReportGraphInputEdge.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'edge');
    return ReportGraphInputEdge(
      annotations: _jsonStringList(root['annotations'], 'edge.annotations'),
      detail: _jsonString(root['detail'], 'edge.detail'),
      from: _jsonString(root['from'], 'edge.from'),
      id: _jsonString(root['id'], 'edge.id'),
      label: _jsonString(root['label'], 'edge.label'),
      result: _jsonString(root['result'], 'edge.result'),
      to: _jsonString(root['to'], 'edge.to'),
    );
  }

  final List<String> annotations;
  final String detail;
  final String from;
  final String id;
  final String label;
  final String result;
  final String to;

  Map<String, Object?> toJson() => <String, Object?>{
        'annotations': List<String>.from(annotations),
        'detail': detail,
        'from': from,
        'id': id,
        'label': label,
        'result': result,
        'to': to,
      };
}

final class ReportGraphLayoutInput {
  ReportGraphLayoutInput({
    required this.caseRef,
    required List<ReportGraphInputEdge> edges,
    required List<ReportGraphInputNode> nodes,
    required this.presentation,
    required this.profileRef,
    required this.reportRef,
  })  : edges = List<ReportGraphInputEdge>.unmodifiable(edges),
        nodes = List<ReportGraphInputNode>.unmodifiable(nodes);

  factory ReportGraphLayoutInput.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(
      source,
      'report graph layout input',
    );
    return ReportGraphLayoutInput(
      caseRef: ReportGraphCaseReference.fromJson(root['caseRef']),
      edges: _jsonList(root['edges'], 'edges')
          .map(ReportGraphInputEdge.fromJson)
          .toList(growable: false),
      nodes: _jsonList(root['nodes'], 'nodes')
          .map(ReportGraphInputNode.fromJson)
          .toList(growable: false),
      presentation: ReportGraphPresentation.fromJson(root['presentation']),
      profileRef: ReportGraphProfileReference.fromJson(root['profileRef']),
      reportRef: ReportGraphReportReference.fromJson(root['reportRef']),
    );
  }

  final ReportGraphCaseReference caseRef;
  final List<ReportGraphInputEdge> edges;
  final List<ReportGraphInputNode> nodes;
  final ReportGraphPresentation presentation;
  final ReportGraphProfileReference profileRef;
  final ReportGraphReportReference reportRef;

  Map<String, Object?> toJson() => <String, Object?>{
        'caseRef': caseRef.toJson(),
        'edges': edges
            .map((ReportGraphInputEdge edge) => edge.toJson())
            .toList(growable: false),
        'nodes': nodes
            .map((ReportGraphInputNode node) => node.toJson())
            .toList(growable: false),
        'presentation': presentation.toJson(),
        'profileRef': profileRef.toJson(),
        'reportRef': reportRef.toJson(),
      };
}

final class ReportGraphFont {
  ReportGraphFont._({
    required Map<int, int> advances,
    required this.defaultAdvance,
    required List<int> gdefMarkCodePoints,
    required this.mappedCodePointCount,
    required Map<int, int> maxPositiveShapingAdjustments,
    required this.maximumInkLeft,
    required this.maximumInkRight,
    required this.maximumPositiveShapingAdjustment,
    required this.postScriptName,
    required this.sourceByteLength,
    required this.sourceSha256,
    required this.unitsPerEm,
    required List<String> unsafeShapingPairs,
    required this.unsafeShapingTripleOracleThrows,
  })  : advances = UnmodifiableMapView<int, int>(Map<int, int>.from(advances)),
        gdefMarkCodePoints = List<int>.unmodifiable(gdefMarkCodePoints),
        maxPositiveShapingAdjustments = UnmodifiableMapView<int, int>(
            Map<int, int>.from(maxPositiveShapingAdjustments)),
        unsafeShapingPairs = List<String>.unmodifiable(unsafeShapingPairs),
        unsafeShapingPairSet = Set<String>.unmodifiable(unsafeShapingPairs);

  factory ReportGraphFont.fromJson(Object? source, String name) {
    final Map<String, Object?> root = _jsonObject(source, 'font $name');
    final Map<String, Object?> rawAdvances = _jsonObject(
      root['advances'],
      'font $name advances',
    );
    final Map<int, int> advances = <int, int>{};
    for (final MapEntry<String, Object?> entry in rawAdvances.entries) {
      final int? codePoint = int.tryParse(entry.key);
      if (codePoint == null ||
          codePoint < 0 ||
          codePoint > 0x10ffff ||
          entry.value is! int ||
          (entry.value! as int) < 0) {
        throw FormatException('Invalid $name font advance.');
      }
      advances[codePoint] = entry.value! as int;
    }
    final Map<String, Object?> rawAdjustments = _jsonObject(
      root['maxPositiveShapingAdjustments'],
      'font $name maxPositiveShapingAdjustments',
    );
    final Map<int, int> adjustments = <int, int>{};
    for (final MapEntry<String, Object?> entry in rawAdjustments.entries) {
      final int? codePoint = int.tryParse(entry.key);
      if (codePoint == null ||
          codePoint < 0 ||
          codePoint > 0x10ffff ||
          entry.value is! int) {
        throw FormatException('Invalid $name font shaping adjustment.');
      }
      adjustments[codePoint] = entry.value! as int;
    }
    final Map<String, Object?> ink = _jsonObject(
      root['maximumInkOverhang'],
      'font $name maximumInkOverhang',
    );
    final List<Object?> rawMarks = _jsonList(
      root['gdefMarkCodePoints'],
      'font $name gdefMarkCodePoints',
    );
    if (rawMarks.any((Object? value) => value is! int)) {
      throw FormatException('Invalid $name GDEF marks.');
    }
    final int defaultAdvance = _jsonInt(
      root['defaultAdvance'],
      'font $name defaultAdvance',
    );
    final String sourceSha256 = _jsonString(
      root['sourceSha256'],
      'font $name sourceSha256',
    );
    if (defaultAdvance < 0 ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(sourceSha256)) {
      throw FormatException('Invalid $name font metrics.');
    }
    return ReportGraphFont._(
      advances: advances,
      defaultAdvance: defaultAdvance,
      gdefMarkCodePoints: rawMarks.cast<int>(),
      mappedCodePointCount: _jsonInt(
        root['mappedCodePointCount'],
        'font $name mappedCodePointCount',
      ),
      maxPositiveShapingAdjustments: adjustments,
      maximumInkLeft:
          _jsonInt(ink['left'], 'font $name maximumInkOverhang.left'),
      maximumInkRight:
          _jsonInt(ink['right'], 'font $name maximumInkOverhang.right'),
      maximumPositiveShapingAdjustment: _jsonInt(
        root['maximumPositiveShapingAdjustment'],
        'font $name maximumPositiveShapingAdjustment',
      ),
      postScriptName:
          _jsonString(root['postScriptName'], 'font $name postScriptName'),
      sourceByteLength:
          _jsonInt(root['sourceByteLength'], 'font $name sourceByteLength'),
      sourceSha256: sourceSha256,
      unitsPerEm: _jsonInt(root['unitsPerEm'], 'font $name unitsPerEm'),
      unsafeShapingPairs: _jsonStringList(
          root['unsafeShapingPairs'], 'font $name unsafeShapingPairs'),
      unsafeShapingTripleOracleThrows: _jsonInt(
        root['unsafeShapingTripleOracleThrows'],
        'font $name unsafeShapingTripleOracleThrows',
      ),
    );
  }

  final Map<int, int> advances;
  final int defaultAdvance;
  final List<int> gdefMarkCodePoints;
  final int mappedCodePointCount;
  final Map<int, int> maxPositiveShapingAdjustments;
  final int maximumInkLeft;
  final int maximumInkRight;
  final int maximumPositiveShapingAdjustment;
  final String postScriptName;
  final int sourceByteLength;
  final String sourceSha256;
  final int unitsPerEm;
  final List<String> unsafeShapingPairs;
  final Set<String> unsafeShapingPairSet;
  final int unsafeShapingTripleOracleThrows;

  bool supports(int codePoint) => advances.containsKey(codePoint);

  int advanceFor(int codePoint) =>
      (advances[codePoint] ?? defaultAdvance) +
      (maxPositiveShapingAdjustments[codePoint] ?? 0);
}

final class ReportGraphFontMetrics {
  const ReportGraphFontMetrics._({
    required this.advanceNormalization,
    required this.advanceSemantics,
    required this.medium,
    required this.regular,
    required this.schemaVersion,
    required this.sourcePackage,
    required this.sourceParserVersion,
    required this.sourceVersion,
    required this.unitPerEm,
  });

  factory ReportGraphFontMetrics.fromJson(Object? source) {
    final Map<String, Object?> root = _jsonObject(source, 'font metrics');
    if (root['format'] != 'genesis-juris-report-graph-font-metrics') {
      throw const FormatException('Unsupported report graph font metrics.');
    }
    final int schemaVersion = _jsonInt(
      root['schemaVersion'],
      'font metrics schemaVersion',
    );
    final int unitPerEm = _jsonInt(root['unitPerEm'], 'font metrics unitPerEm');
    if (schemaVersion != 1 || unitPerEm != 2048) {
      throw const FormatException('Unsupported report graph font metrics.');
    }
    final Map<String, Object?> fonts = _jsonObject(
      root['fonts'],
      'font metrics fonts',
    );
    final Map<String, Object?> metricSource = _jsonObject(
      root['source'],
      'font metrics source',
    );
    return ReportGraphFontMetrics._(
      advanceNormalization: _jsonString(
        root['advanceNormalization'],
        'font metrics advanceNormalization',
      ),
      advanceSemantics: _jsonString(
        root['advanceSemantics'],
        'font metrics advanceSemantics',
      ),
      medium: ReportGraphFont.fromJson(fonts['medium'], 'medium'),
      regular: ReportGraphFont.fromJson(fonts['regular'], 'regular'),
      schemaVersion: schemaVersion,
      sourcePackage:
          _jsonString(metricSource['package'], 'font metrics source.package'),
      sourceParserVersion: _jsonString(
        metricSource['parserVersion'],
        'font metrics source.parserVersion',
      ),
      sourceVersion:
          _jsonString(metricSource['version'], 'font metrics source.version'),
      unitPerEm: unitPerEm,
    );
  }

  final String advanceNormalization;
  final String advanceSemantics;
  final ReportGraphFont medium;
  final ReportGraphFont regular;
  final int schemaVersion;
  final String sourcePackage;
  final String sourceParserVersion;
  final String sourceVersion;
  final int unitPerEm;
}

final class ReportGraphBox {
  const ReportGraphBox({
    required this.height,
    required this.width,
    required this.x,
    required this.y,
  });

  final int height;
  final int width;
  final int x;
  final int y;

  Map<String, Object?> toJson() => <String, Object?>{
        'height': height,
        'width': width,
        'x': x,
        'y': y,
      };
}

final class ReportGraphPoint {
  const ReportGraphPoint({required this.x, required this.y});

  final int x;
  final int y;

  Map<String, Object?> toJson() => <String, Object?>{'x': x, 'y': y};
}

final class ReportGraphLayoutNode {
  ReportGraphLayoutNode({
    required this.box,
    required this.componentId,
    required this.dedicatedPage,
    required this.id,
    required this.lane,
    required this.layoutLayerId,
    required this.pageId,
    required this.ref,
    required Map<String, Object?> text,
    required this.topologyLayerId,
    required this.type,
  }) : text = _freezeMap(text);

  final ReportGraphBox box;
  final String componentId;
  final bool dedicatedPage;
  final String id;
  final int lane;
  final String layoutLayerId;
  final String pageId;
  final String ref;
  final Map<String, Object?> text;
  final String topologyLayerId;
  final String type;

  Map<String, Object?> toJson() => <String, Object?>{
        'box': box.toJson(),
        'componentId': componentId,
        'dedicatedPage': dedicatedPage,
        'id': id,
        'lane': lane,
        'layoutLayerId': layoutLayerId,
        'pageId': pageId,
        'ref': ref,
        'text': text,
        'topologyLayerId': topologyLayerId,
        'type': type,
      };
}

final class ReportGraphConnectorEndpointGeometry {
  const ReportGraphConnectorEndpointGeometry({
    required this.cellBox,
    required this.column,
    required this.direction,
    required this.directionPageBaseline,
    required this.endpointId,
    required this.gutterExitPort,
    required this.labelBox,
    required this.labelInkBox,
    required this.markerBox,
    required this.markerCenter,
    required this.markerInkBox,
    required this.markerPort,
    required this.pathPort,
    required this.routeLaneX,
    required this.row,
    required this.side,
    required this.targetNodeBaseline,
    required this.targetNodeRef,
    required this.targetPageId,
  });

  final ReportGraphBox cellBox;
  final int column;
  final String direction;
  final ReportGraphPoint directionPageBaseline;
  final String endpointId;
  final ReportGraphPoint gutterExitPort;
  final ReportGraphBox labelBox;
  final ReportGraphBox labelInkBox;
  final ReportGraphBox markerBox;
  final ReportGraphPoint markerCenter;
  final ReportGraphBox markerInkBox;
  final ReportGraphPoint markerPort;
  final ReportGraphPoint pathPort;
  final int routeLaneX;
  final int row;
  final String side;
  final ReportGraphPoint targetNodeBaseline;
  final String targetNodeRef;
  final String targetPageId;

  Map<String, Object?> toJson() => <String, Object?>{
        'cellBox': cellBox.toJson(),
        'column': column,
        'direction': direction,
        'directionPageBaseline': directionPageBaseline.toJson(),
        'endpointId': endpointId,
        'gutterExitPort': gutterExitPort.toJson(),
        'labelBox': labelBox.toJson(),
        'labelInkBox': labelInkBox.toJson(),
        'markerBox': markerBox.toJson(),
        'markerCenter': markerCenter.toJson(),
        'markerInkBox': markerInkBox.toJson(),
        'markerPort': markerPort.toJson(),
        'pathPort': pathPort.toJson(),
        'routeLaneX': routeLaneX,
        'row': row,
        'side': side,
        'targetNodeBaseline': targetNodeBaseline.toJson(),
        'targetNodeRef': targetNodeRef,
        'targetPageId': targetPageId,
      };
}

final class ReportGraphConnectorPageGeometry {
  ReportGraphConnectorPageGeometry({
    required this.bottomGutter,
    required List<ReportGraphConnectorEndpointGeometry> endpoints,
    required this.nodeFrame,
    required this.topGutter,
  }) : endpoints =
            List<ReportGraphConnectorEndpointGeometry>.unmodifiable(endpoints);

  final ReportGraphBox bottomGutter;
  final List<ReportGraphConnectorEndpointGeometry> endpoints;
  final ReportGraphBox nodeFrame;
  final ReportGraphBox topGutter;
}

final class ReportGraphConnectorEndpoint {
  ReportGraphConnectorEndpoint({
    required this.anchor,
    required this.id,
    required this.nodeId,
    required this.nodeRef,
    required this.pageId,
  });

  final ReportGraphPoint anchor;
  final String id;
  final String nodeId;
  final String nodeRef;
  final String pageId;
  late final ReportGraphBox cellBox;
  late final int column;
  late final String direction;
  late final ReportGraphPoint directionPageBaseline;
  late final String endpointId;
  late final ReportGraphPoint gutterExitPort;
  late final ReportGraphBox labelBox;
  late final ReportGraphBox labelInkBox;
  late final ReportGraphBox markerBox;
  late final ReportGraphPoint markerCenter;
  late final ReportGraphBox markerInkBox;
  late final ReportGraphPoint markerPort;
  late final ReportGraphPoint pathPort;
  late final int routeLaneX;
  late final List<ReportGraphPoint> routePoints;
  late final int row;
  late final String side;
  late final ReportGraphPoint targetNodeBaseline;
  late final String targetNodeRef;
  late final String targetPageId;

  void _applyGeometry(ReportGraphConnectorEndpointGeometry geometry) {
    cellBox = geometry.cellBox;
    column = geometry.column;
    direction = geometry.direction;
    directionPageBaseline = geometry.directionPageBaseline;
    endpointId = geometry.endpointId;
    gutterExitPort = geometry.gutterExitPort;
    labelBox = geometry.labelBox;
    labelInkBox = geometry.labelInkBox;
    markerBox = geometry.markerBox;
    markerCenter = geometry.markerCenter;
    markerInkBox = geometry.markerInkBox;
    markerPort = geometry.markerPort;
    pathPort = geometry.pathPort;
    routeLaneX = geometry.routeLaneX;
    row = geometry.row;
    side = geometry.side;
    targetNodeBaseline = geometry.targetNodeBaseline;
    targetNodeRef = geometry.targetNodeRef;
    targetPageId = geometry.targetPageId;
  }

  void _setRoutePoints(List<ReportGraphPoint> points) {
    routePoints = List<ReportGraphPoint>.unmodifiable(points);
  }

  Map<String, Object?> toJson() => <String, Object?>{
        'anchor': anchor.toJson(),
        'cellBox': cellBox.toJson(),
        'column': column,
        'direction': direction,
        'directionPageBaseline': directionPageBaseline.toJson(),
        'endpointId': endpointId,
        'gutterExitPort': gutterExitPort.toJson(),
        'id': id,
        'labelBox': labelBox.toJson(),
        'labelInkBox': labelInkBox.toJson(),
        'markerBox': markerBox.toJson(),
        'markerCenter': markerCenter.toJson(),
        'markerInkBox': markerInkBox.toJson(),
        'markerPort': markerPort.toJson(),
        'nodeId': nodeId,
        'nodeRef': nodeRef,
        'pageId': pageId,
        'pathPort': pathPort.toJson(),
        'routeLaneX': routeLaneX,
        'routePoints': routePoints
            .map((ReportGraphPoint point) => point.toJson())
            .toList(growable: false),
        'row': row,
        'side': side,
        'targetNodeBaseline': targetNodeBaseline.toJson(),
        'targetNodeRef': targetNodeRef,
        'targetPageId': targetPageId,
      };
}

final class ReportGraphConnectorPair {
  const ReportGraphConnectorPair({
    required this.adjacencyRecordId,
    required this.edgeId,
    required this.fromPageId,
    required this.id,
    required this.incoming,
    required this.outgoing,
    required this.toPageId,
  });

  final String adjacencyRecordId;
  final String edgeId;
  final String fromPageId;
  final String id;
  final ReportGraphConnectorEndpoint incoming;
  final ReportGraphConnectorEndpoint outgoing;
  final String toPageId;

  Map<String, Object?> toJson() => <String, Object?>{
        'adjacencyRecordId': adjacencyRecordId,
        'edgeId': edgeId,
        'fromPageId': fromPageId,
        'id': id,
        'incoming': incoming.toJson(),
        'outgoing': outgoing.toJson(),
        'toPageId': toPageId,
      };
}

final class ReportGraphLayoutModel {
  ReportGraphLayoutModel._({
    required Map<String, Object?> body,
    required List<ReportGraphConnectorPair> crossPageConnectorPairs,
    required this.layoutFingerprint,
    required List<ReportGraphLayoutNode> nodes,
  })  : crossPageConnectorPairs = List<ReportGraphConnectorPair>.unmodifiable(
          crossPageConnectorPairs,
        ),
        nodes = List<ReportGraphLayoutNode>.unmodifiable(nodes),
        _json = _freezeMap(<String, Object?>{
          ...body,
          'layoutFingerprint': layoutFingerprint,
        });

  final List<ReportGraphConnectorPair> crossPageConnectorPairs;
  final String layoutFingerprint;
  final List<ReportGraphLayoutNode> nodes;
  final Map<String, Object?> _json;

  Map<String, Object?> toJson() => _json;

  String canonicalSerialization() => _canonicalJson(_json);
}

final class ReportGraphLayoutEvaluator {
  const ReportGraphLayoutEvaluator(this.metrics);

  final ReportGraphFontMetrics metrics;

  ReportGraphLayoutModel build(ReportGraphLayoutInput input) =>
      _buildReportGraphLayout(this, input);
}

Map<String, Object?> _jsonObject(Object? source, String label) {
  if (source is! Map<String, dynamic>) {
    throw FormatException('Invalid $label.');
  }
  return source.cast<String, Object?>();
}

List<Object?> _jsonList(Object? source, String label) {
  if (source is! List<dynamic>) {
    throw FormatException('Invalid $label.');
  }
  return source.cast<Object?>();
}

String _jsonString(Object? source, String label) {
  if (source is! String) {
    throw FormatException('Invalid $label.');
  }
  return source;
}

int _jsonInt(Object? source, String label) {
  if (source is! int) {
    throw FormatException('Invalid $label.');
  }
  return source;
}

List<String> _jsonStringList(Object? source, String label) {
  final List<Object?> values = _jsonList(source, label);
  if (values.any((Object? item) => item is! String)) {
    throw FormatException('Invalid $label.');
  }
  return values.cast<String>().toList(growable: false);
}

Object? _freezeJson(Object? source) {
  if (source is Map) {
    final Map<String, Object?> frozen = <String, Object?>{};
    for (final MapEntry<dynamic, dynamic> entry in source.entries) {
      if (entry.key is! String) {
        throw const FormatException('JSON object keys must be strings.');
      }
      frozen[entry.key as String] = _freezeJson(entry.value);
    }
    return UnmodifiableMapView<String, Object?>(frozen);
  }
  if (source is List) {
    return List<Object?>.unmodifiable(source.map<Object?>(_freezeJson));
  }
  return source;
}

Map<String, Object?> _freezeMap(Map<String, Object?> source) =>
    _freezeJson(source)! as Map<String, Object?>;

int _canonicalKeyCompare(String left, String right) {
  // Web canonicalFingerprint applies localeCompare after validating an
  // ASCII camel-case object shape. Lowercase-first comparison is the stable
  // Dart equivalent for every key set in this versioned contract.
  final String foldedLeft = left.toLowerCase();
  final String foldedRight = right.toLowerCase();
  final int folded = foldedLeft.compareTo(foldedRight);
  return folded != 0 ? folded : left.compareTo(right);
}

String _canonicalJson(Object? value) {
  if (value == null || value is num || value is bool || value is String) {
    return jsonEncode(value);
  }
  if (value is List) {
    return '[${value.map<String>(_canonicalJson).join(',')}]';
  }
  if (value is Map) {
    final List<MapEntry<String, Object?>> entries = value.entries.map(
      (MapEntry<dynamic, dynamic> entry) {
        if (entry.key is! String) {
          throw const FormatException(
            'Canonical JSON object keys must be strings.',
          );
        }
        return MapEntry<String, Object?>(
          entry.key as String,
          entry.value,
        );
      },
    ).toList(growable: false)
      ..sort(
        (MapEntry<String, Object?> left, MapEntry<String, Object?> right) =>
            _canonicalKeyCompare(left.key, right.key),
      );
    return '{${entries.map<String>((MapEntry<String, Object?> entry) {
      if (!_canonicalKeyPattern.hasMatch(entry.key)) {
        _fail(
          ReportGraphLayoutErrorCode.inputInvalid,
          'Layout fingerprint object key is not canonical ASCII: '
          '${entry.key}',
        );
      }
      return '${jsonEncode(entry.key)}:${_canonicalJson(entry.value)}';
    }).join(',')}}';
  }
  throw FormatException(
      'Unsupported canonical JSON value: ${value.runtimeType}');
}

String _canonicalFingerprint(Map<String, Object?> value) {
  final Digest digest = sha256.convert(utf8.encode(_canonicalJson(value)));
  return 'sha256-$digest';
}
