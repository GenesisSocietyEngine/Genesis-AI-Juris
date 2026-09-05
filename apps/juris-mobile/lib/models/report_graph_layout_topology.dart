part of 'report_graph_layout.dart';

int _asciiCompare(String left, String right) => left.compareTo(right);

String _pad(int value, int width) => value.toString().padLeft(width, '0');

bool _hasUnpairedSurrogate(String value) {
  for (int index = 0; index < value.length; index += 1) {
    final int unit = value.codeUnitAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) {
        return true;
      }
      final int next = value.codeUnitAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

void _assertBoundedText(
  ReportGraphFontMetrics metrics,
  String value,
  String label,
  int maximum, {
  bool allowEmpty = true,
}) {
  if (_hasUnpairedSurrogate(value) ||
      value.length > maximum ||
      (!allowEmpty && value.trim().isEmpty)) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      '$label must be valid Unicode text of at most '
      '$maximum UTF-16 units',
    );
  }
  final ({String codePoint, String reason})? issue =
      _governedTextIssue(metrics, value);
  if (issue != null) {
    final String issueMessage = switch (issue.reason) {
      'XML_INVALID' =>
        'contains a character forbidden by the XML 1.0 report renderer',
      'FONT_UNSUPPORTED' =>
        'contains a scalar absent from the governed Roboto fonts',
      _ => 'contains a scalar sequence the governed Roboto shaper cannot '
          'safely render',
    };
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      '$label $issueMessage',
      <String, Object>{
        'codePoint': issue.codePoint,
        'field': label,
        'reason': issue.reason,
      },
    );
  }
}

({String codePoint, String reason})? _governedTextIssue(
  ReportGraphFontMetrics metrics,
  String value,
) {
  final List<int> scalars = value.runes.toList(growable: false);
  for (final int codePoint in scalars) {
    final String codePointLabel =
        'U+${codePoint.toRadixString(16).toUpperCase().padLeft(4, '0')}';
    final bool xmlCharacter = codePoint == 0x09 ||
        codePoint == 0x0a ||
        codePoint == 0x0d ||
        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
        (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    final bool noncharacter = (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
        (codePoint & 0xffff) == 0xfffe ||
        (codePoint & 0xffff) == 0xffff;
    if (!xmlCharacter || noncharacter) {
      return (codePoint: codePointLabel, reason: 'XML_INVALID');
    }
    if (codePoint == 0x09 || codePoint == 0x0a || codePoint == 0x0d) {
      continue;
    }
    if (!metrics.regular.supports(codePoint) ||
        !metrics.medium.supports(codePoint)) {
      return (codePoint: codePointLabel, reason: 'FONT_UNSUPPORTED');
    }
  }
  for (int index = 1; index < scalars.length; index += 1) {
    final int left = scalars[index - 1];
    final int right = scalars[index];
    final String pair = '$left,$right';
    if (metrics.regular.unsafeShapingPairSet.contains(pair) ||
        metrics.medium.unsafeShapingPairSet.contains(pair)) {
      final String leftLabel =
          'U+${left.toRadixString(16).toUpperCase().padLeft(4, '0')}';
      final String rightLabel =
          'U+${right.toRadixString(16).toUpperCase().padLeft(4, '0')}';
      return (
        codePoint: '$leftLabel/$rightLabel',
        reason: 'SHAPING_UNSAFE',
      );
    }
  }
  final Set<int> gdefMarks = <int>{
    ...metrics.regular.gdefMarkCodePoints,
    ...metrics.medium.gdefMarkCodePoints,
  };
  for (final String cluster in _graphemeClusters(value)) {
    final int markCount = cluster.runes.where(gdefMarks.contains).length;
    if (markCount >= 2) {
      return (
        codePoint: 'GDEF_CLASS_3_STACK',
        reason: 'SHAPING_UNSAFE_MARK_STACK',
      );
    }
  }
  return null;
}

void _assertInput(
  ReportGraphFontMetrics metrics,
  ReportGraphLayoutInput input,
) {
  _assertBoundedText(
    metrics,
    input.caseRef.id,
    'caseRef.id',
    140,
    allowEmpty: false,
  );
  _assertBoundedText(
    metrics,
    input.caseRef.version,
    'caseRef.version',
    40,
    allowEmpty: false,
  );
  _assertBoundedText(
    metrics,
    input.caseRef.title,
    'caseRef.title',
    200,
    allowEmpty: false,
  );
  if (!_fingerprintPattern.hasMatch(input.caseRef.fingerprint)) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'caseRef.fingerprint must be a canonical SHA-256 fingerprint',
    );
  }
  _assertBoundedText(
    metrics,
    input.profileRef.id,
    'profileRef.id',
    100,
    allowEmpty: false,
  );
  _assertBoundedText(
    metrics,
    input.profileRef.kind,
    'profileRef.kind',
    100,
    allowEmpty: false,
  );
  if (input.reportRef.modelSchemaVersion < 1) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'reportRef.modelSchemaVersion must be a positive integer',
    );
  }
  _assertBoundedText(
    metrics,
    input.reportRef.modelRendererVersion,
    'reportRef.modelRendererVersion',
    40,
    allowEmpty: false,
  );
  if (!_fingerprintPattern.hasMatch(input.reportRef.contentFingerprint)) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'reportRef.contentFingerprint must be a canonical SHA-256 fingerprint',
    );
  }
  if (input.presentation.language != 'en' &&
      input.presentation.language != 'ru') {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'presentation.language must be en or ru',
    );
  }
  if (input.presentation.sourceNodeCount < 1 ||
      input.presentation.sourceNodeCount > reportGraphMaxNodes) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'presentation.sourceNodeCount must be between 1 and '
      '$reportGraphMaxNodes',
    );
  }
  if (input.presentation.sourceEdgeCount < 0 ||
      input.presentation.sourceEdgeCount > reportGraphMaxEdges) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'presentation.sourceEdgeCount must be between 0 and '
      '$reportGraphMaxEdges',
    );
  }
  if (input.nodes.isEmpty ||
      input.nodes.length > reportGraphMaxNodes ||
      input.nodes.length > input.presentation.sourceNodeCount) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'nodes must contain between 1 and $reportGraphMaxNodes visible nodes',
    );
  }
  if (input.edges.length > reportGraphMaxEdges ||
      input.edges.length > input.presentation.sourceEdgeCount) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'edges must contain at most $reportGraphMaxEdges visible relationships',
    );
  }

  final List<String> sortedRedactions =
      List<String>.from(input.presentation.redactedNodeIds)
        ..sort(_asciiCompare);
  if (sortedRedactions.toSet().length != sortedRedactions.length ||
      List<int>.generate(sortedRedactions.length, (int index) => index).any(
        (int index) =>
            !_idPattern.hasMatch(sortedRedactions[index]) ||
            sortedRedactions[index] !=
                input.presentation.redactedNodeIds[index],
      )) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'redactedNodeIds must be unique, valid IDs in ASCII order',
    );
  }

  final Set<String> nodeIds = <String>{};
  for (final ReportGraphInputNode node in input.nodes) {
    if (!_idPattern.hasMatch(node.id) || !nodeIds.add(node.id)) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Invalid or duplicate node ID ${node.id}',
      );
    }
    if (!_nodeTypes.contains(node.type)) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Unsupported node type ${node.type}',
      );
    }
    _assertBoundedText(
      metrics,
      node.title,
      'node ${node.id} title',
      200,
      allowEmpty: false,
    );
    _assertBoundedText(
      metrics,
      node.detail,
      'node ${node.id} detail',
      4000,
    );
  }
  if (sortedRedactions.any(nodeIds.contains)) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'A redacted node cannot remain in the visible node collection',
    );
  }

  final Set<String> edgeIds = <String>{};
  for (final ReportGraphInputEdge edge in input.edges) {
    if (!_idPattern.hasMatch(edge.id) || !edgeIds.add(edge.id)) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Invalid or duplicate edge ID ${edge.id}',
      );
    }
    if (!nodeIds.contains(edge.from) ||
        !nodeIds.contains(edge.to) ||
        edge.from == edge.to) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Edge ${edge.id} has an invalid endpoint',
      );
    }
    _assertBoundedText(metrics, edge.label, 'edge ${edge.id} label', 200);
    _assertBoundedText(metrics, edge.detail, 'edge ${edge.id} detail', 4000);
    _assertBoundedText(metrics, edge.result, 'edge ${edge.id} result', 4000);
    if (edge.annotations.length > 32) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Edge ${edge.id} annotations are invalid',
      );
    }
    for (final String annotation in edge.annotations) {
      _assertBoundedText(
        metrics,
        annotation,
        'edge ${edge.id} annotation',
        4000,
        allowEmpty: false,
      );
    }
  }

  _validateFontMetrics(metrics);
}

bool _fontFaceMatches(
  ReportGraphFont font, {
  required int sourceByteLength,
  required int inkLeft,
  required int inkRight,
  required int positiveAdjustmentCount,
  required String postScriptName,
  required String sourceSha256,
}) {
  return font.sourceSha256 == sourceSha256 &&
      font.sourceByteLength == sourceByteLength &&
      font.postScriptName == postScriptName &&
      font.unitsPerEm == 2048 &&
      font.mappedCodePointCount == 923 &&
      font.defaultAdvance == 908 &&
      font.advances.length == font.mappedCodePointCount &&
      !font.advances.values.any((int advance) => advance < 0) &&
      font.maxPositiveShapingAdjustments.length == positiveAdjustmentCount &&
      !font.maxPositiveShapingAdjustments.values.any(
        (int adjustment) => adjustment <= 0 || adjustment > 100,
      ) &&
      font.maximumPositiveShapingAdjustment == 100 &&
      font.maximumInkLeft == inkLeft &&
      font.maximumInkRight == inkRight &&
      font.gdefMarkCodePoints.join(',') ==
          '768,769,771,777,783,803,1155,1156,1157,1158' &&
      font.unsafeShapingPairs.length == 362 &&
      !font.unsafeShapingPairs.any(
        (String pair) => !RegExp(r'^\d+,\d+$').hasMatch(pair),
      ) &&
      font.unsafeShapingTripleOracleThrows == 4682;
}

void _validateFontMetrics(ReportGraphFontMetrics metrics) {
  if (metrics.schemaVersion != 1 ||
      metrics.unitPerEm != 2048 ||
      metrics.sourcePackage != 'pdfmake' ||
      metrics.sourceVersion != '0.2.20' ||
      metrics.sourceParserVersion != '1.9.2') {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Unsupported report graph font metrics artifact',
    );
  }
  if (!_fontFaceMatches(
    metrics.regular,
    sourceByteLength: 152588,
    inkLeft: 1510,
    inkRight: 438,
    positiveAdjustmentCount: 219,
    postScriptName: 'Roboto-Regular',
    sourceSha256:
        'a93f6bc56ef0349a4426b717c182482bb878534f31077ae5e1b2b4dae7a089d1',
  )) {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Invalid regular font metrics',
    );
  }
  if (!_fontFaceMatches(
    metrics.medium,
    sourceByteLength: 152776,
    inkLeft: 1498,
    inkRight: 450,
    positiveAdjustmentCount: 220,
    postScriptName: 'Roboto-Medium',
    sourceSha256:
        '79a763229b01229cfd921a9a0108e58c162d045d828037e32c6fb85ed6f914be',
  )) {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Invalid medium font metrics',
    );
  }
  if (reportGraphConnectorColumns < 1 ||
      _printableFrame.width % reportGraphConnectorCellWidth != 0) {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Connector cells must divide the graph frame exactly',
    );
  }
  if (_textWidth(
        metrics,
        'C999',
        _FontKey.medium,
        reportGraphConnectorIdSizeMilliPoints,
        false,
      ) >
      reportGraphConnectorMarkerRadius * 2) {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Connector pair ID exceeds its deterministic marker box',
    );
  }
  if (_textWidth(
            metrics,
            'OUT G999',
            _FontKey.medium,
            reportGraphConnectorReferenceSizeMilliPoints,
            false,
          ) >
          reportGraphConnectorLabelWidth ||
      _textWidth(
            metrics,
            'N999',
            _FontKey.medium,
            reportGraphConnectorReferenceSizeMilliPoints,
            false,
          ) >
          reportGraphConnectorLabelWidth) {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Connector page or node reference exceeds its deterministic label box',
    );
  }
  final int markerInkRight = reportGraphConnectorMarkerCenterXOffset +
      reportGraphConnectorMarkerRadius +
      reportGraphConnectorMarkerStrokeWidth ~/ 2;
  final int routeHalfStroke = reportGraphConnectorPathStrokeWidth ~/ 2;
  final int firstLaneInkLeft =
      reportGraphConnectorRouteLaneXOffset - routeHalfStroke;
  final int lastLaneInkRight = reportGraphConnectorRouteLaneXOffset +
      (reportGraphConnectorMaxRowsPerSide - 1) *
          reportGraphConnectorRouteLaneStep +
      routeHalfStroke;
  final int nextCellLabelInkLeft = reportGraphConnectorCellWidth +
      reportGraphConnectorLabelXOffset -
      reportGraphConnectorLabelStrokeWidth ~/ 2;
  if (firstLaneInkLeft - markerInkRight < reportGraphRouteClearance ||
      nextCellLabelInkLeft - lastLaneInkRight < reportGraphRouteClearance ||
      reportGraphConnectorRouteLaneStep < reportGraphConnectorPathStrokeWidth) {
    _fail(
      ReportGraphLayoutErrorCode.fontMetricsInvalid,
      'Connector route lanes do not preserve deterministic ink clearance',
    );
  }
}

final class _Component {
  _Component({
    required this.cyclic,
    required this.id,
    required List<String> nodeIds,
    required List<String> rootNodeIds,
    required List<String> terminalNodeIds,
  })  : nodeIds = List<String>.unmodifiable(nodeIds),
        rootNodeIds = List<String>.unmodifiable(rootNodeIds),
        terminalNodeIds = List<String>.unmodifiable(terminalNodeIds);

  final bool cyclic;
  final String id;
  final List<String> nodeIds;
  final List<String> rootNodeIds;
  final List<String> terminalNodeIds;

  Map<String, Object?> toJson() => <String, Object?>{
        'cyclic': cyclic,
        'id': id,
        'nodeIds': nodeIds,
        'rootNodeIds': rootNodeIds,
        'terminalNodeIds': terminalNodeIds,
      };
}

final class _CyclicRepair {
  _CyclicRepair({
    required this.componentId,
    required this.id,
    required List<String> ignoredIncomingEdgeIds,
    required this.promotedNodeId,
  }) : ignoredIncomingEdgeIds =
            List<String>.unmodifiable(ignoredIncomingEdgeIds);

  final String componentId;
  final String id;
  final List<String> ignoredIncomingEdgeIds;
  final String promotedNodeId;

  Map<String, Object?> toJson() => <String, Object?>{
        'componentId': componentId,
        'id': id,
        'ignoredIncomingEdgeIds': ignoredIncomingEdgeIds,
        'promotedNodeId': promotedNodeId,
      };
}

final class _TopologyLayer {
  _TopologyLayer({
    required this.componentId,
    required this.id,
    required this.index,
    required List<String> nodeIds,
  }) : nodeIds = List<String>.unmodifiable(nodeIds);

  final String componentId;
  final String id;
  final int index;
  final List<String> nodeIds;
}

final class _Topology {
  _Topology({
    required this.components,
    required this.cyclicRepairs,
    required this.repairedEdgeIds,
    required this.topologyLayers,
  });

  final List<_Component> components;
  final List<_CyclicRepair> cyclicRepairs;
  final Set<String> repairedEdgeIds;
  final List<_TopologyLayer> topologyLayers;
}

_Topology _deriveTopology(ReportGraphLayoutInput input) {
  final List<String> nodeIds = input.nodes
      .map((ReportGraphInputNode node) => node.id)
      .toList(growable: false)
    ..sort(_asciiCompare);
  final Map<String, Set<String>> neighbours = <String, Set<String>>{
    for (final String id in nodeIds) id: <String>{},
  };
  final Map<String, List<ReportGraphInputEdge>> incoming =
      <String, List<ReportGraphInputEdge>>{
    for (final String id in nodeIds) id: <ReportGraphInputEdge>[],
  };
  final Map<String, List<ReportGraphInputEdge>> outgoing =
      <String, List<ReportGraphInputEdge>>{
    for (final String id in nodeIds) id: <ReportGraphInputEdge>[],
  };
  for (final ReportGraphInputEdge edge in input.edges) {
    neighbours[edge.from]!.add(edge.to);
    neighbours[edge.to]!.add(edge.from);
    incoming[edge.to]!.add(edge);
    outgoing[edge.from]!.add(edge);
  }
  for (final List<ReportGraphInputEdge> values in incoming.values) {
    values.sort(
      (ReportGraphInputEdge left, ReportGraphInputEdge right) =>
          _asciiCompare(left.id, right.id),
    );
  }
  for (final List<ReportGraphInputEdge> values in outgoing.values) {
    values.sort(
      (ReportGraphInputEdge left, ReportGraphInputEdge right) =>
          _asciiCompare(left.id, right.id),
    );
  }

  final List<List<String>> rawComponents = <List<String>>[];
  final Set<String> assigned = <String>{};
  for (final String seed in nodeIds) {
    if (assigned.contains(seed)) {
      continue;
    }
    final List<String> pending = <String>[seed];
    final List<String> component = <String>[];
    assigned.add(seed);
    while (pending.isNotEmpty) {
      final String current = pending.removeAt(0);
      component.add(current);
      final List<String> adjacent = neighbours[current]!.toList()
        ..sort(_asciiCompare);
      for (final String neighbour in adjacent) {
        if (assigned.add(neighbour)) {
          pending.add(neighbour);
        }
      }
    }
    component.sort(_asciiCompare);
    rawComponents.add(component);
  }
  rawComponents.sort(
    (List<String> left, List<String> right) =>
        _asciiCompare(left.first, right.first),
  );

  final List<_Component> components = <_Component>[];
  final List<_CyclicRepair> cyclicRepairs = <_CyclicRepair>[];
  final Set<String> repairedEdgeIds = <String>{};
  final List<_TopologyLayer> topologyLayers = <_TopologyLayer>[];
  for (int componentIndex = 0;
      componentIndex < rawComponents.length;
      componentIndex += 1) {
    final List<String> componentNodes = rawComponents[componentIndex];
    final String componentId = 'C${_pad(componentIndex + 1, 2)}';
    final Set<String> componentSet = componentNodes.toSet();
    final Map<String, int> indegree = <String, int>{
      for (final String id in componentNodes)
        id: incoming[id]!
            .where(
              (ReportGraphInputEdge edge) => componentSet.contains(edge.from),
            )
            .length,
    };
    final Set<String> remaining = componentNodes.toSet();
    final List<String> ready = componentNodes
        .where((String id) => indegree[id] == 0)
        .toList(growable: true)
      ..sort(_asciiCompare);
    final Map<String, int> layerByNode = <String, int>{
      for (final String id in componentNodes) id: 0,
    };
    int repairIndex = 0;
    while (remaining.isNotEmpty) {
      if (ready.isEmpty) {
        final List<String> sortedRemaining = remaining.toList()
          ..sort(_asciiCompare);
        final String promotedNodeId = sortedRemaining.first;
        final List<String> ignoredIncomingEdgeIds = incoming[promotedNodeId]!
            .where(
              (ReportGraphInputEdge edge) => remaining.contains(edge.from),
            )
            .map((ReportGraphInputEdge edge) => edge.id)
            .toList(growable: false)
          ..sort(_asciiCompare);
        if (ignoredIncomingEdgeIds.isEmpty) {
          _fail(
            ReportGraphLayoutErrorCode.inputInvalid,
            'Cyclic repair could not identify an incoming edge',
            <String, Object>{'nodeId': promotedNodeId},
          );
        }
        repairIndex += 1;
        repairedEdgeIds.addAll(ignoredIncomingEdgeIds);
        cyclicRepairs.add(
          _CyclicRepair(
            componentId: componentId,
            id: 'CR-$componentId-${_pad(repairIndex, 2)}',
            ignoredIncomingEdgeIds: ignoredIncomingEdgeIds,
            promotedNodeId: promotedNodeId,
          ),
        );
        indegree[promotedNodeId] = 0;
        ready.add(promotedNodeId);
      }
      ready.sort(_asciiCompare);
      final String nodeId = ready.removeAt(0);
      if (!remaining.remove(nodeId)) {
        continue;
      }
      for (final ReportGraphInputEdge edge in outgoing[nodeId]!) {
        if (!remaining.contains(edge.to)) {
          continue;
        }
        layerByNode[edge.to] = [
          layerByNode[edge.to]!,
          layerByNode[nodeId]! + 1,
        ].reduce((int left, int right) => left > right ? left : right);
        final int nextIndegree = indegree[edge.to]! - 1;
        indegree[edge.to] = nextIndegree;
        if (nextIndegree == 0) {
          ready.add(edge.to);
        }
      }
    }
    final List<int> layerIndexes = layerByNode.values.toSet().toList()..sort();
    for (final int layerIndex in layerIndexes) {
      topologyLayers.add(
        _TopologyLayer(
          componentId: componentId,
          id: 'T-$componentId-${_pad(layerIndex + 1, 2)}',
          index: layerIndex,
          nodeIds: componentNodes
              .where((String id) => layerByNode[id] == layerIndex)
              .toList(growable: false)
            ..sort(_asciiCompare),
        ),
      );
    }
    components.add(
      _Component(
        cyclic: cyclicRepairs.any(
          (_CyclicRepair repair) => repair.componentId == componentId,
        ),
        id: componentId,
        nodeIds: componentNodes,
        rootNodeIds: componentNodes
            .where((String id) => incoming[id]!.isEmpty)
            .toList(growable: false),
        terminalNodeIds: componentNodes
            .where((String id) => outgoing[id]!.isEmpty)
            .toList(growable: false),
      ),
    );
  }
  return _Topology(
    components: components,
    cyclicRepairs: cyclicRepairs,
    repairedEdgeIds: repairedEdgeIds,
    topologyLayers: topologyLayers,
  );
}
