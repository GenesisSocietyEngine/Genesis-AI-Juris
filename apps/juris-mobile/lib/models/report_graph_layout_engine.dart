part of 'report_graph_layout.dart';

const ReportGraphBox _paperBox = ReportGraphBox(
  height: 297000,
  width: 210000,
  x: 0,
  y: 0,
);
const ReportGraphBox _printableFrame = ReportGraphBox(
  height: 269000,
  width: 182000,
  x: 14000,
  y: 14000,
);
const ReportGraphBox _headerFrameOrigin = ReportGraphBox(
  height: 0,
  width: 182000,
  x: 14000,
  y: 14000,
);
const int _headerPaddingY = 1500;
const int _headerGroupGap = 800;
const int _headerGraphGap = 4000;
const int _graphFrameBottom = 269000;
const int _maxGraphFrameHeight = 238000;
const ReportGraphBox _footerFrame = ReportGraphBox(
  height: 9000,
  width: 182000,
  x: 14000,
  y: 274000,
);
const int _standardNodeWidth = 56000;
const int _laneGap = 7000;
const int _layerGap = 7000;

final class _HeaderMeasurement {
  const _HeaderMeasurement({
    required this.graphFrame,
    required this.headerFrame,
    required this.headerLayout,
  });

  final ReportGraphBox graphFrame;
  final ReportGraphBox headerFrame;
  final Map<String, Object?> headerLayout;
}

final class _RawLayoutLayer {
  _RawLayoutLayer({
    required this.componentId,
    required this.id,
    required List<String> nodeIds,
    required this.subLayer,
    required this.topologyLayerId,
  }) : nodeIds = List<String>.unmodifiable(nodeIds);

  final String componentId;
  final String id;
  final List<String> nodeIds;
  final int subLayer;
  final String topologyLayerId;
}

final class _MeasuredLayer {
  _MeasuredLayer({
    required this.componentId,
    required this.dedicatedPage,
    required this.height,
    required this.id,
    required List<String> nodeIds,
    required List<_MeasuredNode> nodes,
    required this.subLayer,
    required this.topologyLayerId,
  })  : nodeIds = List<String>.unmodifiable(nodeIds),
        nodes = List<_MeasuredNode>.unmodifiable(nodes);

  factory _MeasuredLayer.fromRaw(
    _RawLayoutLayer raw, {
    required bool dedicatedPage,
    required int height,
    String? id,
    List<String>? nodeIds,
    required List<_MeasuredNode> nodes,
  }) {
    return _MeasuredLayer(
      componentId: raw.componentId,
      dedicatedPage: dedicatedPage,
      height: height,
      id: id ?? raw.id,
      nodeIds: nodeIds ?? raw.nodeIds,
      nodes: nodes,
      subLayer: raw.subLayer,
      topologyLayerId: raw.topologyLayerId,
    );
  }

  _MeasuredLayer replaceNode(_MeasuredNode node) => _MeasuredLayer(
        componentId: componentId,
        dedicatedPage: true,
        height: node.height,
        id: id,
        nodeIds: nodeIds,
        nodes: <_MeasuredNode>[node],
        subLayer: subLayer,
        topologyLayerId: topologyLayerId,
      );

  final String componentId;
  final bool dedicatedPage;
  final int height;
  final String id;
  final List<String> nodeIds;
  final List<_MeasuredNode> nodes;
  final int subLayer;
  final String topologyLayerId;
}

final class _PlannedGraphPage {
  _PlannedGraphPage({
    required this.bottomEndpointCount,
    required this.connectorCapacityFits,
    required List<_MeasuredLayer> layers,
    required this.nodeFrame,
    required this.topEndpointCount,
  }) : layers = List<_MeasuredLayer>.unmodifiable(layers);

  final int bottomEndpointCount;
  final bool connectorCapacityFits;
  final List<_MeasuredLayer> layers;
  final ReportGraphBox nodeFrame;
  final int topEndpointCount;
}

_HeaderMeasurement _measureHeaderLayout(
  ReportGraphFontMetrics metrics,
  ReportGraphLayoutInput input,
) {
  final _TextStyle style = _typographyStyles['header']!;
  final String sectionTitle = input.presentation.language == 'en'
      ? 'Professional report graph | BPMN-inspired off-page continuity'
      : 'Граф профессионального отчёта | переходы между страницами в стиле BPMN';
  final String identity = input.presentation.language == 'en'
      ? 'Case ${input.caseRef.id} | version ${input.caseRef.version} | '
          'profile ${input.profileRef.id} | ${input.profileRef.kind}'
      : 'Дело ${input.caseRef.id} | версия ${input.caseRef.version} | '
          'профиль ${input.profileRef.id} | ${input.profileRef.kind}';
  List<_TextLine> wrapped(String text) => _wrapText(
        metrics,
        text,
        _headerFrameOrigin.width,
        style.font,
        style.sizeMilliPoints,
      );
  final List<_TextLine> reportTitleLines = wrapped(input.caseRef.title);
  final List<_TextLine> sectionTitleLines = wrapped(sectionTitle);
  final List<_TextLine> identityLines = wrapped(identity);
  final int contentHeight = _headerPaddingY * 2 +
      (reportTitleLines.length +
              sectionTitleLines.length +
              identityLines.length +
              1) *
          style.lineHeight +
      _headerGroupGap * 3;
  final ReportGraphBox headerFrame = ReportGraphBox(
    height: contentHeight,
    width: _headerFrameOrigin.width,
    x: _headerFrameOrigin.x,
    y: _headerFrameOrigin.y,
  );
  final int graphY = headerFrame.y + headerFrame.height + _headerGraphGap;
  final ReportGraphBox graphFrame = ReportGraphBox(
    height: _graphFrameBottom - graphY,
    width: _printableFrame.width,
    x: _printableFrame.x,
    y: graphY,
  );
  if (graphFrame.height < 60000) {
    _fail(
      ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
      'Measured repeating report header leaves no usable graph frame',
      <String, Object>{'availableHeight': graphFrame.height},
    );
  }
  List<Map<String, Object?>> linesJson(List<_TextLine> lines) =>
      lines.map((_TextLine line) => line.toJson()).toList(growable: false);
  return _HeaderMeasurement(
    graphFrame: graphFrame,
    headerFrame: headerFrame,
    headerLayout: <String, Object?>{
      'contentHeight': contentHeight,
      'groupGap': _headerGroupGap,
      'identity': <String, Object?>{
        'fullText': identity,
        'lines': linesJson(identityLines),
      },
      'paddingY': _headerPaddingY,
      'reportTitle': <String, Object?>{
        'fullText': input.caseRef.title,
        'lines': linesJson(reportTitleLines),
      },
      'sectionTitle': <String, Object?>{
        'fullText': sectionTitle,
        'lines': linesJson(sectionTitleLines),
      },
    },
  );
}

({ReportGraphPoint fromPoint, ReportGraphPoint toPoint}) _directedNodeAnchors(
  ReportGraphLayoutNode from,
  ReportGraphLayoutNode to,
) {
  final int fromCenterX = from.box.x + from.box.width ~/ 2;
  final int fromCenterY = from.box.y + from.box.height ~/ 2;
  final int toCenterX = to.box.x + to.box.width ~/ 2;
  final int toCenterY = to.box.y + to.box.height ~/ 2;
  if (from.box.y + from.box.height <= to.box.y) {
    return (
      fromPoint: ReportGraphPoint(
        x: fromCenterX,
        y: from.box.y + from.box.height,
      ),
      toPoint: ReportGraphPoint(x: toCenterX, y: to.box.y),
    );
  }
  if (to.box.y + to.box.height <= from.box.y) {
    return (
      fromPoint: ReportGraphPoint(x: fromCenterX, y: from.box.y),
      toPoint: ReportGraphPoint(
        x: toCenterX,
        y: to.box.y + to.box.height,
      ),
    );
  }
  if (fromCenterX <= toCenterX) {
    return (
      fromPoint: ReportGraphPoint(
        x: from.box.x + from.box.width,
        y: fromCenterY,
      ),
      toPoint: ReportGraphPoint(x: to.box.x, y: toCenterY),
    );
  }
  return (
    fromPoint: ReportGraphPoint(x: from.box.x, y: fromCenterY),
    toPoint: ReportGraphPoint(
      x: to.box.x + to.box.width,
      y: toCenterY,
    ),
  );
}

int _layersHeight(List<_MeasuredLayer> layers) {
  int height = 0;
  for (int index = 0; index < layers.length; index += 1) {
    height += layers[index].height + (index == 0 ? 0 : _layerGap);
  }
  return height;
}

({int bottomEndpointCount, int topEndpointCount}) _planConnectorCounts(
  List<_MeasuredLayer> layers,
  ReportGraphLayoutInput input,
  Map<String, int> layerOrderByNode,
) {
  final Set<String> nodeIds =
      layers.expand((_MeasuredLayer layer) => layer.nodeIds).toSet();
  final List<int> layerIndexes = layers
      .expand(
        (_MeasuredLayer layer) =>
            layer.nodeIds.map((String nodeId) => layerOrderByNode[nodeId]!),
      )
      .toList(growable: false);
  final int firstLayerIndex = layerIndexes.reduce(
    (int left, int right) => left < right ? left : right,
  );
  final int lastLayerIndex = layerIndexes.reduce(
    (int left, int right) => left > right ? left : right,
  );
  int topEndpointCount = 0;
  int bottomEndpointCount = 0;
  for (final ReportGraphInputEdge edge in input.edges) {
    final bool fromInside = nodeIds.contains(edge.from);
    final bool toInside = nodeIds.contains(edge.to);
    if (fromInside == toInside) {
      continue;
    }
    final String outsideNodeId = fromInside ? edge.to : edge.from;
    final int? outsideLayerIndex = layerOrderByNode[outsideNodeId];
    if (outsideLayerIndex == null ||
        (outsideLayerIndex >= firstLayerIndex &&
            outsideLayerIndex <= lastLayerIndex)) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Connector planning encountered a non-contiguous layer assignment',
        <String, Object>{'edgeId': edge.id},
      );
    }
    if (outsideLayerIndex < firstLayerIndex) {
      topEndpointCount += 1;
    } else {
      bottomEndpointCount += 1;
    }
  }
  return (
    bottomEndpointCount: bottomEndpointCount,
    topEndpointCount: topEndpointCount,
  );
}

_PlannedGraphPage _planPage(
  List<_MeasuredLayer> layers,
  ReportGraphLayoutInput input,
  Map<String, int> layerOrderByNode,
  ReportGraphBox graphFrame,
) {
  final (:bottomEndpointCount, :topEndpointCount) = _planConnectorCounts(
    layers,
    input,
    layerOrderByNode,
  );
  final _ConnectorFrames frames = _connectorFrames(
    graphFrame,
    topEndpointCount,
    bottomEndpointCount,
  );
  final int maximumEndpointCount =
      reportGraphConnectorColumns * reportGraphConnectorMaxRowsPerSide;
  return _PlannedGraphPage(
    bottomEndpointCount: bottomEndpointCount,
    connectorCapacityFits: topEndpointCount <= maximumEndpointCount &&
        bottomEndpointCount <= maximumEndpointCount,
    layers: layers,
    nodeFrame: frames.nodeFrame,
    topEndpointCount: topEndpointCount,
  );
}

ReportGraphLayoutModel _buildReportGraphLayout(
  ReportGraphLayoutEvaluator evaluator,
  ReportGraphLayoutInput input,
) {
  _assertInput(evaluator.metrics, input);
  final List<ReportGraphInputEdge> stableEdges =
      List<ReportGraphInputEdge>.from(input.edges)
        ..sort(
          (ReportGraphInputEdge left, ReportGraphInputEdge right) =>
              _asciiCompare(left.id, right.id),
        );
  final List<ReportGraphInputNode> stableNodes =
      List<ReportGraphInputNode>.from(input.nodes)
        ..sort(
          (ReportGraphInputNode left, ReportGraphInputNode right) =>
              _asciiCompare(left.id, right.id),
        );
  final ReportGraphLayoutInput stableInput = ReportGraphLayoutInput(
    caseRef: input.caseRef,
    edges: stableEdges,
    nodes: stableNodes,
    presentation: ReportGraphPresentation(
      language: input.presentation.language,
      redactedNodeIds: input.presentation.redactedNodeIds,
      sourceEdgeCount: input.presentation.sourceEdgeCount,
      sourceNodeCount: input.presentation.sourceNodeCount,
    ),
    profileRef: input.profileRef,
    reportRef: input.reportRef,
  );
  final _HeaderMeasurement measuredHeader = _measureHeaderLayout(
    evaluator.metrics,
    stableInput,
  );
  final ReportGraphBox graphFrame = measuredHeader.graphFrame;
  final _Topology topology = _deriveTopology(stableInput);
  final List<_RawLayoutLayer> rawLayers = <_RawLayoutLayer>[];
  for (final _TopologyLayer topologyLayer in topology.topologyLayers) {
    final int chunkCount =
        (topologyLayer.nodeIds.length / reportGraphMaxPortraitLanes).ceil();
    for (int subLayerIndex = 0;
        subLayerIndex < chunkCount;
        subLayerIndex += 1) {
      final int start = subLayerIndex * reportGraphMaxPortraitLanes;
      final int end = [
        start + reportGraphMaxPortraitLanes,
        topologyLayer.nodeIds.length,
      ].reduce((int left, int right) => left < right ? left : right);
      rawLayers.add(
        _RawLayoutLayer(
          componentId: topologyLayer.componentId,
          id: 'L-${topologyLayer.componentId}-'
              '${_pad(topologyLayer.index + 1, 2)}-'
              '${_pad(subLayerIndex + 1, 2)}',
          nodeIds: topologyLayer.nodeIds.sublist(start, end),
          subLayer: subLayerIndex,
          topologyLayerId: topologyLayer.id,
        ),
      );
    }
  }

  final List<String> graphNodeOrder = rawLayers
      .expand((_RawLayoutLayer layer) => layer.nodeIds)
      .toList(growable: false);
  final int refWidth = graphNodeOrder.length.toString().length < 2
      ? 2
      : graphNodeOrder.length.toString().length;
  final Map<String, String> refByNode = <String, String>{
    for (int index = 0; index < graphNodeOrder.length; index += 1)
      graphNodeOrder[index]: 'N${_pad(index + 1, refWidth)}',
  };
  final Map<String, ReportGraphInputNode> nodeById =
      <String, ReportGraphInputNode>{
    for (final ReportGraphInputNode node in stableInput.nodes) node.id: node,
  };
  final List<_MeasuredLayer> measuredLayers = <_MeasuredLayer>[];
  for (final _RawLayoutLayer rawLayer in rawLayers) {
    final List<_MeasuredNode> standardNodes = rawLayer.nodeIds
        .map(
          (String nodeId) => _measureNode(
            evaluator.metrics,
            nodeById[nodeId]!,
            refByNode[nodeId]!,
            stableInput.presentation.language,
            _standardNodeWidth,
          ),
        )
        .toList(growable: false);
    final Set<String> oversizedIds = standardNodes
        .where((_MeasuredNode node) => node.height > graphFrame.height)
        .map((_MeasuredNode node) => node.id)
        .toSet();
    if (oversizedIds.isEmpty) {
      measuredLayers.add(
        _MeasuredLayer.fromRaw(
          rawLayer,
          dedicatedPage: false,
          height: standardNodes
              .map((_MeasuredNode node) => node.height)
              .reduce((int left, int right) => left > right ? left : right),
          nodes: standardNodes,
        ),
      );
      continue;
    }
    int normalIndex = 0;
    for (final _MeasuredNode standardNode in standardNodes) {
      if (!oversizedIds.contains(standardNode.id)) {
        normalIndex += 1;
        measuredLayers.add(
          _MeasuredLayer.fromRaw(
            rawLayer,
            dedicatedPage: false,
            height: standardNode.height,
            id: '${rawLayer.id}-S${_pad(normalIndex, 2)}',
            nodeIds: <String>[standardNode.id],
            nodes: <_MeasuredNode>[standardNode],
          ),
        );
        continue;
      }
      final _MeasuredNode fullWidthCompleteNode = _measureNode(
        evaluator.metrics,
        nodeById[standardNode.id]!,
        standardNode.ref,
        stableInput.presentation.language,
        graphFrame.width,
      );
      final _MeasuredNode fullWidthNode =
          fullWidthCompleteNode.height > graphFrame.height
              ? _measureNode(
                  evaluator.metrics,
                  nodeById[standardNode.id]!,
                  standardNode.ref,
                  stableInput.presentation.language,
                  graphFrame.width,
                  graphFrame.height,
                )
              : fullWidthCompleteNode;
      if (fullWidthNode.height > graphFrame.height) {
        _fail(
          ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
          'Node ${standardNode.id} needs ${fullWidthNode.height} '
          '$reportGraphFixedUnit but the full-width graph frame permits '
          '${graphFrame.height}',
          <String, Object>{
            'availableHeight': graphFrame.height,
            'nodeId': standardNode.id,
            'requiredHeight': fullWidthNode.height,
          },
        );
      }
      measuredLayers.add(
        _MeasuredLayer.fromRaw(
          rawLayer,
          dedicatedPage: true,
          height: fullWidthNode.height,
          id: '${rawLayer.id}-D-${standardNode.ref}',
          nodeIds: <String>[standardNode.id],
          nodes: <_MeasuredNode>[fullWidthNode],
        ),
      );
    }
  }

  final Map<String, int> layerOrderByNode = <String, int>{
    for (int index = 0; index < measuredLayers.length; index += 1)
      for (final String nodeId in measuredLayers[index].nodeIds) nodeId: index,
  };
  final List<_PlannedGraphPage> pagePlans = <_PlannedGraphPage>[];
  int nextLayerIndex = 0;
  while (nextLayerIndex < measuredLayers.length) {
    final _MeasuredLayer firstLayer = measuredLayers[nextLayerIndex];
    _PlannedGraphPage? bestPlan;
    final List<_MeasuredLayer> candidateLayers = <_MeasuredLayer>[];
    for (int endIndex = nextLayerIndex;
        endIndex < measuredLayers.length;
        endIndex += 1) {
      final _MeasuredLayer layer = measuredLayers[endIndex];
      if (candidateLayers.isNotEmpty &&
          (firstLayer.dedicatedPage || layer.dedicatedPage)) {
        break;
      }
      candidateLayers.add(layer);
      if (_layersHeight(candidateLayers) > graphFrame.height) {
        break;
      }
      final _PlannedGraphPage candidatePlan = _planPage(
        List<_MeasuredLayer>.from(candidateLayers),
        stableInput,
        layerOrderByNode,
        graphFrame,
      );
      if (candidatePlan.connectorCapacityFits &&
          _layersHeight(candidateLayers) <= candidatePlan.nodeFrame.height) {
        bestPlan = candidatePlan;
      }
      if (firstLayer.dedicatedPage) {
        break;
      }
    }
    if (bestPlan == null) {
      final _PlannedGraphPage failedPlan = _planPage(
        <_MeasuredLayer>[firstLayer],
        stableInput,
        layerOrderByNode,
        graphFrame,
      );
      if (failedPlan.connectorCapacityFits &&
          firstLayer.nodes.length == 1 &&
          failedPlan.nodeFrame.height > 0) {
        final _MeasuredNode measuredNode = firstLayer.nodes.first;
        final ReportGraphInputNode sourceNode = nodeById[measuredNode.id]!;
        final _MeasuredNode completeDedicatedNode = _measureNode(
          evaluator.metrics,
          sourceNode,
          measuredNode.ref,
          stableInput.presentation.language,
          graphFrame.width,
        );
        final _MeasuredNode fittedDedicatedNode =
            completeDedicatedNode.height <= failedPlan.nodeFrame.height
                ? completeDedicatedNode
                : _measureNode(
                    evaluator.metrics,
                    sourceNode,
                    measuredNode.ref,
                    stableInput.presentation.language,
                    graphFrame.width,
                    failedPlan.nodeFrame.height,
                  );
        if (fittedDedicatedNode.height <= failedPlan.nodeFrame.height) {
          final _PlannedGraphPage fittedPlan = _planPage(
            <_MeasuredLayer>[firstLayer.replaceNode(fittedDedicatedNode)],
            stableInput,
            layerOrderByNode,
            graphFrame,
          );
          if (fittedPlan.connectorCapacityFits) {
            bestPlan = fittedPlan;
          }
        }
      }
      if (bestPlan == null) {
        _fail(
          ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
          'Layer ${firstLayer.id} cannot fit beside its deterministic '
          'connector bands',
          <String, Object>{
            'availableHeight': failedPlan.nodeFrame.height,
            'nodeId': firstLayer.nodeIds.first,
            'requiredHeight': firstLayer.height,
          },
        );
      }
    }
    pagePlans.add(bestPlan);
    nextLayerIndex += bestPlan.layers.length;
  }

  final List<ReportGraphLayoutNode> layoutNodes = <ReportGraphLayoutNode>[];
  final List<Map<String, Object?>> layoutLayers = <Map<String, Object?>>[];
  final List<Map<String, Object?>> graphPages = <Map<String, Object?>>[];
  for (int pageIndex = 0; pageIndex < pagePlans.length; pageIndex += 1) {
    final _PlannedGraphPage pagePlan = pagePlans[pageIndex];
    final List<_MeasuredLayer> pageLayers = pagePlan.layers;
    final String pageId = 'G${_pad(pageIndex + 1, 3)}';
    int y = pagePlan.nodeFrame.y;
    final List<String> pageNodeIds = <String>[];
    for (final _MeasuredLayer layer in pageLayers) {
      final int totalWidth = layer.dedicatedPage
          ? graphFrame.width
          : layer.nodes.length * _standardNodeWidth +
              (layer.nodes.length - 1) * _laneGap;
      int x = graphFrame.x + (graphFrame.width - totalWidth) ~/ 2;
      final int layerX = x;
      for (int lane = 0; lane < layer.nodes.length; lane += 1) {
        final _MeasuredNode measuredNode = layer.nodes[lane];
        final ReportGraphInputNode inputNode = nodeById[measuredNode.id]!;
        layoutNodes.add(
          ReportGraphLayoutNode(
            box: ReportGraphBox(
              height: measuredNode.height,
              width: measuredNode.width,
              x: x,
              y: y,
            ),
            componentId: layer.componentId,
            dedicatedPage: layer.dedicatedPage,
            id: measuredNode.id,
            lane: lane,
            layoutLayerId: layer.id,
            pageId: pageId,
            ref: measuredNode.ref,
            text: measuredNode.text,
            topologyLayerId: layer.topologyLayerId,
            type: inputNode.type,
          ),
        );
        pageNodeIds.add(measuredNode.id);
        x += measuredNode.width + _laneGap;
      }
      layoutLayers.add(<String, Object?>{
        'box': ReportGraphBox(
          height: layer.height,
          width: totalWidth,
          x: layerX,
          y: y,
        ).toJson(),
        'componentId': layer.componentId,
        'dedicatedPage': layer.dedicatedPage,
        'height': layer.height,
        'id': layer.id,
        'nodeIds': List<String>.from(layer.nodeIds),
        'pageId': pageId,
        'subLayer': layer.subLayer,
        'topologyLayerId': layer.topologyLayerId,
        'y': y,
      });
      y += layer.height + _layerGap;
    }
    if (y - _layerGap > pagePlan.nodeFrame.y + pagePlan.nodeFrame.height) {
      _fail(
        ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
        'Page $pageId exceeded its connector-safe node frame',
        <String, Object>{'pageId': pageId},
      );
    }
    graphPages.add(<String, Object?>{
      'connectorEndpointIds': <String>[],
      'edgeSegmentIds': <String>[],
      'headerText': '',
      'id': pageId,
      'layerIds': pageLayers
          .map((_MeasuredLayer layer) => layer.id)
          .toList(growable: false),
      'nodeIds': pageNodeIds,
      'number': pageIndex + 1,
      'pageLine': <String, Object?>{'text': '', 'width': 0},
    });
  }
  final _TextStyle headerStyle = _typographyStyles['header']!;
  for (final Map<String, Object?> page in graphPages) {
    final int pageNumber = page['number']! as int;
    final String pageId = page['id']! as String;
    final String pageText = stableInput.presentation.language == 'en'
        ? 'Graph page $pageNumber of ${graphPages.length} | $pageId'
        : 'Страница графа $pageNumber из ${graphPages.length} | $pageId';
    final int pageLineWidth = _textWidth(
      evaluator.metrics,
      pageText,
      headerStyle.font,
      headerStyle.sizeMilliPoints,
    );
    page['headerText'] = '${stableInput.caseRef.title} | $pageText';
    page['pageLine'] = <String, Object?>{
      'text': pageText,
      'width': pageLineWidth,
    };
    if (pageLineWidth > measuredHeader.headerFrame.width) {
      _fail(
        ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
        'Graph page indicator exceeds the measured repeating header',
        <String, Object>{
          'pageId': pageId,
          'requiredWidth': pageLineWidth,
        },
      );
    }
  }

  return _finishReportGraphLayout(
    evaluator: evaluator,
    graphFrame: graphFrame,
    graphPages: graphPages,
    headerFrame: measuredHeader.headerFrame,
    headerLayout: measuredHeader.headerLayout,
    layoutLayers: layoutLayers,
    layoutNodes: layoutNodes,
    nodeById: nodeById,
    pagePlans: pagePlans,
    refByNode: refByNode,
    stableInput: stableInput,
    topology: topology,
  );
}
