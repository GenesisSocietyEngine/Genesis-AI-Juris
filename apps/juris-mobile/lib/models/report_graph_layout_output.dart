part of 'report_graph_layout.dart';

const int _routeBendPenalty = 250;

final class _ConnectorFrames {
  const _ConnectorFrames({
    required this.bottomGutter,
    required this.nodeFrame,
    required this.topGutter,
  });
  final ReportGraphBox bottomGutter;
  final ReportGraphBox nodeFrame;
  final ReportGraphBox topGutter;
}

int _connectorRowCount(int endpointCount) =>
    (endpointCount / reportGraphConnectorColumns).ceil();
int _connectorGutterHeight(int endpointCount) => endpointCount == 0
    ? 0
    : _connectorRowCount(endpointCount) * reportGraphConnectorRowHeight +
        reportGraphConnectorNodeGap;

_ConnectorFrames _connectorFrames(
  ReportGraphBox graphFrame,
  int topCount,
  int bottomCount,
) {
  final int topHeight = _connectorGutterHeight(topCount);
  final int bottomHeight = _connectorGutterHeight(bottomCount);
  final int bottom = graphFrame.y + graphFrame.height;
  return _ConnectorFrames(
    bottomGutter: ReportGraphBox(
      height: bottomHeight,
      width: graphFrame.width,
      x: graphFrame.x,
      y: bottom - bottomHeight,
    ),
    nodeFrame: ReportGraphBox(
      height: graphFrame.height - topHeight - bottomHeight,
      width: graphFrame.width,
      x: graphFrame.x,
      y: graphFrame.y + topHeight,
    ),
    topGutter: ReportGraphBox(
      height: topHeight,
      width: graphFrame.width,
      x: graphFrame.x,
      y: graphFrame.y,
    ),
  );
}

String _connectorEndpointSide(
  ReportGraphConnectorPair pair,
  String endpointId,
) {
  final bool incoming = pair.incoming.id == endpointId;
  final bool forwardPages = pair.fromPageId.compareTo(pair.toPageId) < 0;
  return incoming == forwardPages ? 'top' : 'bottom';
}

ReportGraphConnectorPageGeometry _connectorPageGeometry({
  required ReportGraphBox graphFrame,
  required List<Map<String, Object?>> graphPages,
  required List<ReportGraphConnectorPair> pairs,
  required String pageId,
}) {
  Map<String, Object?>? page;
  for (final Map<String, Object?> candidate in graphPages) {
    if (candidate['id'] == pageId) {
      page = candidate;
      break;
    }
  }
  if (page == null) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'Unknown report graph page $pageId',
    );
  }
  final List<Map<String, Object?>> entries = <Map<String, Object?>>[];
  for (final String endpointId
      in (page['connectorEndpointIds']! as List<Object?>).cast<String>()) {
    ReportGraphConnectorPair? pair;
    for (final ReportGraphConnectorPair candidate in pairs) {
      if (candidate.incoming.id == endpointId ||
          candidate.outgoing.id == endpointId) {
        pair = candidate;
        break;
      }
    }
    if (pair == null) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Unknown connector endpoint $endpointId',
        <String, Object>{'pageId': pageId},
      );
    }
    final bool incoming = pair.incoming.id == endpointId;
    entries.add(<String, Object?>{
      'direction': incoming ? 'IN' : 'OUT',
      'endpointId': endpointId,
      'side': _connectorEndpointSide(pair, endpointId),
      'targetNodeRef': incoming ? pair.outgoing.nodeRef : pair.incoming.nodeRef,
      'targetPageId': incoming ? pair.fromPageId : pair.toPageId,
    });
  }
  final List<Map<String, Object?>> top = entries
      .where((Map<String, Object?> entry) => entry['side'] == 'top')
      .toList(growable: false);
  final List<Map<String, Object?>> bottom = entries
      .where((Map<String, Object?> entry) => entry['side'] == 'bottom')
      .toList(growable: false);
  final _ConnectorFrames frames = _connectorFrames(
    graphFrame,
    top.length,
    bottom.length,
  );
  final List<ReportGraphConnectorEndpointGeometry> geometries =
      <ReportGraphConnectorEndpointGeometry>[];
  final List<(String, List<Map<String, Object?>>)> groups =
      <(String, List<Map<String, Object?>>)>[
    ('top', top),
    ('bottom', bottom),
  ];
  for (final (String side, List<Map<String, Object?>> sideEntries) in groups) {
    final int rows = _connectorRowCount(sideEntries.length);
    if (rows > reportGraphConnectorMaxRowsPerSide) {
      _fail(
        ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
        'Connector endpoint capacity exceeds its deterministic page-side band',
        <String, Object>{
          'endpointCount': sideEntries.length,
          'maximumEndpointCount':
              reportGraphConnectorColumns * reportGraphConnectorMaxRowsPerSide,
          'pageId': pageId,
          'side': side,
        },
      );
    }
    final int rowOrigin = side == 'top'
        ? graphFrame.y
        : graphFrame.y +
            graphFrame.height -
            rows * reportGraphConnectorRowHeight;
    for (int index = 0; index < sideEntries.length; index += 1) {
      final Map<String, Object?> entry = sideEntries[index];
      final int row = index ~/ reportGraphConnectorColumns;
      final int column = index % reportGraphConnectorColumns;
      final ReportGraphBox cellBox = ReportGraphBox(
        height: reportGraphConnectorRowHeight,
        width: reportGraphConnectorCellWidth,
        x: graphFrame.x + column * reportGraphConnectorCellWidth,
        y: rowOrigin + row * reportGraphConnectorRowHeight,
      );
      final ReportGraphPoint markerCenter = ReportGraphPoint(
        x: cellBox.x + reportGraphConnectorMarkerCenterXOffset,
        y: cellBox.y + cellBox.height ~/ 2,
      );
      final ReportGraphBox markerBox = ReportGraphBox(
        height: reportGraphConnectorMarkerRadius * 2,
        width: reportGraphConnectorMarkerRadius * 2,
        x: markerCenter.x - reportGraphConnectorMarkerRadius,
        y: markerCenter.y - reportGraphConnectorMarkerRadius,
      );
      final ReportGraphBox labelBox = ReportGraphBox(
        height: reportGraphConnectorLabelHeight,
        width: reportGraphConnectorLabelWidth,
        x: cellBox.x + reportGraphConnectorLabelXOffset,
        y: markerCenter.y - reportGraphConnectorLabelHeight ~/ 2,
      );
      final int markerInkInset = reportGraphConnectorMarkerStrokeWidth ~/ 2;
      final int labelInkInset = reportGraphConnectorLabelStrokeWidth ~/ 2;
      final ReportGraphBox markerInkBox = ReportGraphBox(
        height: markerBox.height + markerInkInset * 2,
        width: markerBox.width + markerInkInset * 2,
        x: markerBox.x - markerInkInset,
        y: markerBox.y - markerInkInset,
      );
      final ReportGraphBox labelInkBox = ReportGraphBox(
        height: labelBox.height + labelInkInset * 2,
        width: labelBox.width + labelInkInset * 2,
        x: labelBox.x - labelInkInset,
        y: labelBox.y - labelInkInset,
      );
      final int routeLaneIndex = side == 'top' ? rows - row - 1 : row;
      final int routeLaneX = cellBox.x +
          reportGraphConnectorRouteLaneXOffset +
          routeLaneIndex * reportGraphConnectorRouteLaneStep;
      final ReportGraphPoint markerPort = ReportGraphPoint(
        x: markerInkBox.x + markerInkBox.width,
        y: markerCenter.y,
      );
      geometries.add(
        ReportGraphConnectorEndpointGeometry(
          cellBox: cellBox,
          column: column,
          direction: entry['direction']! as String,
          directionPageBaseline: ReportGraphPoint(
            x: labelBox.x + 300,
            y: labelBox.y + reportGraphConnectorReferencePrimaryBaselineOffset,
          ),
          endpointId: entry['endpointId']! as String,
          gutterExitPort: ReportGraphPoint(
            x: routeLaneX,
            y: side == 'top'
                ? frames.topGutter.y +
                    frames.topGutter.height -
                    reportGraphConnectorNodeGap +
                    reportGraphRouteClearance
                : frames.bottomGutter.y +
                    reportGraphConnectorNodeGap -
                    reportGraphRouteClearance,
          ),
          labelBox: labelBox,
          labelInkBox: labelInkBox,
          markerBox: markerBox,
          markerCenter: markerCenter,
          markerInkBox: markerInkBox,
          markerPort: markerPort,
          pathPort: markerPort,
          routeLaneX: routeLaneX,
          row: row,
          side: side,
          targetNodeBaseline: ReportGraphPoint(
            x: labelBox.x + 300,
            y: labelBox.y +
                reportGraphConnectorReferenceSecondaryBaselineOffset,
          ),
          targetNodeRef: entry['targetNodeRef']! as String,
          targetPageId: entry['targetPageId']! as String,
        ),
      );
    }
  }
  return ReportGraphConnectorPageGeometry(
    bottomGutter: frames.bottomGutter,
    endpoints: geometries,
    nodeFrame: frames.nodeFrame,
    topGutter: frames.topGutter,
  );
}

ReportGraphBox _boxFromJson(Map<String, Object?> source) => ReportGraphBox(
      height: source['height']! as int,
      width: source['width']! as int,
      x: source['x']! as int,
      y: source['y']! as int,
    );

/// Recomputes compact connector bands from serialized schema-1 page data.
ReportGraphConnectorPageGeometry reportGraphConnectorPageGeometry(
  ReportGraphLayoutModel layout,
  String pageId,
) {
  return _connectorPageGeometry(
    graphFrame: _boxFromJson(
      (layout._json['graphFrame']! as Map).cast<String, Object?>(),
    ),
    graphPages: (layout._json['graphPages']! as List)
        .map(
          (Object? page) => (page! as Map).cast<String, Object?>(),
        )
        .toList(growable: false),
    pairs: layout.crossPageConnectorPairs,
    pageId: pageId,
  );
}

ReportGraphBox _expandBox(ReportGraphBox box, int amount) => ReportGraphBox(
      height: box.height + amount * 2,
      width: box.width + amount * 2,
      x: box.x - amount,
      y: box.y - amount,
    );

bool _pointInsideBoxInterior(
  ReportGraphPoint point,
  ReportGraphBox box,
) =>
    point.x > box.x &&
    point.x < box.x + box.width &&
    point.y > box.y &&
    point.y < box.y + box.height;

bool _orthogonalSegmentClear(
  ReportGraphPoint from,
  ReportGraphPoint to,
  List<ReportGraphBox> obstacles,
) {
  if (from.x != to.x && from.y != to.y) {
    return false;
  }
  final int minimumX = from.x < to.x ? from.x : to.x;
  final int maximumX = from.x > to.x ? from.x : to.x;
  final int minimumY = from.y < to.y ? from.y : to.y;
  final int maximumY = from.y > to.y ? from.y : to.y;
  for (final ReportGraphBox box in obstacles) {
    if (from.y == to.y) {
      if (from.y > box.y &&
          from.y < box.y + box.height &&
          maximumX > box.x &&
          minimumX < box.x + box.width) {
        return false;
      }
    } else if (from.x > box.x &&
        from.x < box.x + box.width &&
        maximumY > box.y &&
        minimumY < box.y + box.height) {
      return false;
    }
  }
  return true;
}

final class _RouteQueueItem {
  const _RouteQueueItem({
    required this.bends,
    required this.cost,
    required this.state,
  });
  final int bends;
  final int cost;
  final int state;
}

final class _RouteMinHeap {
  final List<_RouteQueueItem> _values = <_RouteQueueItem>[];
  int _before(_RouteQueueItem left, _RouteQueueItem right) {
    final int cost = left.cost - right.cost;
    if (cost != 0) {
      return cost;
    }
    final int bends = left.bends - right.bends;
    return bends != 0 ? bends : left.state - right.state;
  }

  void push(_RouteQueueItem value) {
    _values.add(value);
    int index = _values.length - 1;
    while (index > 0) {
      final int parent = (index - 1) ~/ 2;
      if (_before(_values[parent], _values[index]) <= 0) {
        break;
      }
      final _RouteQueueItem swap = _values[parent];
      _values[parent] = _values[index];
      _values[index] = swap;
      index = parent;
    }
  }

  _RouteQueueItem pop() {
    final _RouteQueueItem first = _values.first;
    final _RouteQueueItem last = _values.removeLast();
    if (_values.isEmpty) {
      return first;
    }
    _values[0] = last;
    int index = 0;
    while (true) {
      final int left = index * 2 + 1;
      final int right = left + 1;
      int smallest = index;
      if (left < _values.length &&
          _before(_values[left], _values[smallest]) < 0) {
        smallest = left;
      }
      if (right < _values.length &&
          _before(_values[right], _values[smallest]) < 0) {
        smallest = right;
      }
      if (smallest == index) {
        break;
      }
      final _RouteQueueItem swap = _values[index];
      _values[index] = _values[smallest];
      _values[smallest] = swap;
      index = smallest;
    }
    return first;
  }

  bool get isNotEmpty => _values.isNotEmpty;
}

final class _RouteNeighbour {
  const _RouteNeighbour({
    required this.direction,
    required this.distance,
    required this.point,
  });
  final int direction;
  final int distance;
  final int point;
}

bool _samePoint(ReportGraphPoint left, ReportGraphPoint right) =>
    left.x == right.x && left.y == right.y;

List<ReportGraphPoint> _compressOrthogonalPoints(
  List<ReportGraphPoint> points,
) {
  final List<ReportGraphPoint> compressed = <ReportGraphPoint>[];
  for (final ReportGraphPoint point in points) {
    final ReportGraphPoint? previous =
        compressed.isEmpty ? null : compressed.last;
    if (previous != null && _samePoint(previous, point)) {
      continue;
    }
    final ReportGraphPoint? beforePrevious =
        compressed.length < 2 ? null : compressed[compressed.length - 2];
    if (beforePrevious != null &&
        previous != null &&
        ((beforePrevious.x == previous.x && previous.x == point.x) ||
            (beforePrevious.y == previous.y && previous.y == point.y))) {
      compressed[compressed.length - 1] = point;
    } else {
      compressed.add(point);
    }
  }
  return compressed;
}

List<ReportGraphPoint> _orthogonalRoute(
  ReportGraphPoint start,
  ReportGraphPoint end,
  ReportGraphBox frame,
  List<ReportGraphBox> obstacles,
  String routeId,
) {
  if ((start.x == end.x || start.y == end.y) &&
      _orthogonalSegmentClear(start, end, obstacles)) {
    return <ReportGraphPoint>[start, end];
  }
  final int frameRight = frame.x + frame.width;
  final int frameBottom = frame.y + frame.height;
  final Set<int> xValues = <int>{frame.x, frameRight, start.x, end.x};
  final Set<int> yValues = <int>{frame.y, frameBottom, start.y, end.y};
  int bounded(int value, int lower, int upper) =>
      value < lower ? lower : (value > upper ? upper : value);
  for (final ReportGraphBox obstacle in obstacles) {
    xValues.add(bounded(obstacle.x, frame.x, frameRight));
    xValues.add(bounded(obstacle.x + obstacle.width, frame.x, frameRight));
    yValues.add(bounded(obstacle.y, frame.y, frameBottom));
    yValues.add(bounded(obstacle.y + obstacle.height, frame.y, frameBottom));
  }
  final List<int> xs = xValues.toList()..sort();
  final List<int> ys = yValues.toList()..sort();
  final List<ReportGraphPoint> points = <ReportGraphPoint>[];
  final Map<String, int> pointIndex = <String, int>{};
  for (final int y in ys) {
    for (final int x in xs) {
      final ReportGraphPoint point = ReportGraphPoint(x: x, y: y);
      if (obstacles.any(
        (ReportGraphBox obstacle) => _pointInsideBoxInterior(point, obstacle),
      )) {
        continue;
      }
      pointIndex['$x,$y'] = points.length;
      points.add(point);
    }
  }
  final int? startIndex = pointIndex['${start.x},${start.y}'];
  final int? endIndex = pointIndex['${end.x},${end.y}'];
  if (startIndex == null || endIndex == null) {
    final ReportGraphPoint blockedPoint = startIndex == null ? start : end;
    final int obstacleIndex = obstacles.indexWhere(
      (ReportGraphBox obstacle) =>
          _pointInsideBoxInterior(blockedPoint, obstacle),
    );
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'Route endpoint lies inside a foreign obstacle',
      <String, Object>{
        'obstacleIndex': obstacleIndex,
        'pointX': blockedPoint.x,
        'pointY': blockedPoint.y,
        'routeEndpoint': startIndex == null ? 'start' : 'end',
        'routeId': routeId,
      },
    );
  }
  final List<List<_RouteNeighbour>> neighbours =
      List<List<_RouteNeighbour>>.generate(
    points.length,
    (int _) => <_RouteNeighbour>[],
  );
  void addLineNeighbours(List<int> indexes, int direction) {
    for (int index = 1; index < indexes.length; index += 1) {
      final int left = indexes[index - 1];
      final int right = indexes[index];
      if (!_orthogonalSegmentClear(points[left], points[right], obstacles)) {
        continue;
      }
      final int distance = (points[left].x - points[right].x).abs() +
          (points[left].y - points[right].y).abs();
      neighbours[left].add(
        _RouteNeighbour(
          direction: direction,
          distance: distance,
          point: right,
        ),
      );
      neighbours[right].add(
        _RouteNeighbour(
          direction: direction,
          distance: distance,
          point: left,
        ),
      );
    }
  }

  for (final int y in ys) {
    final List<int> indexes = <int>[
      for (int index = 0; index < points.length; index += 1)
        if (points[index].y == y) index,
    ]..sort((int left, int right) => points[left].x - points[right].x);
    addLineNeighbours(indexes, 1);
  }
  for (final int x in xs) {
    final List<int> indexes = <int>[
      for (int index = 0; index < points.length; index += 1)
        if (points[index].x == x) index,
    ]..sort((int left, int right) => points[left].y - points[right].y);
    addLineNeighbours(indexes, 2);
  }
  for (final List<_RouteNeighbour> values in neighbours) {
    values.sort(
      (_RouteNeighbour left, _RouteNeighbour right) {
        final int point = left.point - right.point;
        return point != 0 ? point : left.direction - right.direction;
      },
    );
  }
  final int stateCount = points.length * 3;
  const int infinity = 0x3fffffffffffffff;
  final List<int> costs = List<int>.filled(stateCount, infinity);
  final List<int> bends = List<int>.filled(stateCount, infinity);
  final List<int> previous = List<int>.filled(stateCount, -1);
  final int startState = startIndex * 3;
  costs[startState] = 0;
  bends[startState] = 0;
  final _RouteMinHeap queue = _RouteMinHeap();
  queue.push(_RouteQueueItem(bends: 0, cost: 0, state: startState));
  while (queue.isNotEmpty) {
    final _RouteQueueItem current = queue.pop();
    if (current.cost != costs[current.state] ||
        current.bends != bends[current.state]) {
      continue;
    }
    final int currentPoint = current.state ~/ 3;
    final int currentDirection = current.state % 3;
    for (final _RouteNeighbour neighbour in neighbours[currentPoint]) {
      final int bend =
          currentDirection != 0 && currentDirection != neighbour.direction
              ? 1
              : 0;
      final int nextState = neighbour.point * 3 + neighbour.direction;
      final int nextCost =
          current.cost + neighbour.distance + bend * _routeBendPenalty;
      final int nextBends = current.bends + bend;
      if (nextCost > costs[nextState] ||
          (nextCost == costs[nextState] && nextBends >= bends[nextState])) {
        continue;
      }
      costs[nextState] = nextCost;
      bends[nextState] = nextBends;
      previous[nextState] = current.state;
      queue.push(
        _RouteQueueItem(
          bends: nextBends,
          cost: nextCost,
          state: nextState,
        ),
      );
    }
  }
  final List<int> endStates = <int>[
    endIndex * 3 + 1,
    endIndex * 3 + 2,
    endIndex * 3,
  ].where((int state) => costs[state] != infinity).toList()
    ..sort((int left, int right) {
      final int cost = costs[left] - costs[right];
      if (cost != 0) {
        return cost;
      }
      final int bend = bends[left] - bends[right];
      return bend != 0 ? bend : left - right;
    });
  if (endStates.isEmpty) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'No obstacle-free orthogonal route exists',
      <String, Object>{'routeId': routeId},
    );
  }
  final List<ReportGraphPoint> reversed = <ReportGraphPoint>[];
  for (int state = endStates.first; state >= 0; state = previous[state]) {
    reversed.add(points[state ~/ 3]);
    if (state == startState) {
      break;
    }
  }
  final List<ReportGraphPoint> route =
      _compressOrthogonalPoints(reversed.reversed.toList(growable: false));
  if (route.isEmpty ||
      !_samePoint(route.first, start) ||
      !_samePoint(route.last, end)) {
    _fail(
      ReportGraphLayoutErrorCode.inputInvalid,
      'Orthogonal route reconstruction lost an endpoint',
      <String, Object>{'routeId': routeId},
    );
  }
  return route;
}

ReportGraphPoint _pointFromJson(Map<String, Object?> source) =>
    ReportGraphPoint(
      x: source['x']! as int,
      y: source['y']! as int,
    );

ReportGraphLayoutModel _finishReportGraphLayout({
  required ReportGraphLayoutEvaluator evaluator,
  required ReportGraphBox graphFrame,
  required List<Map<String, Object?>> graphPages,
  required ReportGraphBox headerFrame,
  required Map<String, Object?> headerLayout,
  required List<Map<String, Object?>> layoutLayers,
  required List<ReportGraphLayoutNode> layoutNodes,
  required Map<String, ReportGraphInputNode> nodeById,
  required List<_PlannedGraphPage> pagePlans,
  required Map<String, String> refByNode,
  required ReportGraphLayoutInput stableInput,
  required _Topology topology,
}) {
  final Map<String, ReportGraphLayoutNode> layoutNodeById =
      <String, ReportGraphLayoutNode>{
    for (final ReportGraphLayoutNode node in layoutNodes) node.id: node,
  };
  final List<Map<String, Object?>> samePageEdgeSegments =
      <Map<String, Object?>>[];
  final List<ReportGraphConnectorPair> crossPageConnectorPairs =
      <ReportGraphConnectorPair>[];
  final List<Map<String, Object?>> layoutEdges = <Map<String, Object?>>[];
  for (int edgeIndex = 0;
      edgeIndex < stableInput.edges.length;
      edgeIndex += 1) {
    final ReportGraphInputEdge edge = stableInput.edges[edgeIndex];
    final ReportGraphLayoutNode from = layoutNodeById[edge.from]!;
    final ReportGraphLayoutNode to = layoutNodeById[edge.to]!;
    final bool cyclicRepair = topology.repairedEdgeIds.contains(edge.id);
    final String adjacencyRecordId = 'A${_pad(edgeIndex + 1, 3)}';
    String? samePageSegmentId;
    String? connectorId;
    if (from.pageId == to.pageId) {
      samePageSegmentId = 'S:${edge.id}:${from.pageId}';
      final (:fromPoint, :toPoint) = _directedNodeAnchors(from, to);
      samePageEdgeSegments.add(<String, Object?>{
        'cyclicRepair': cyclicRepair,
        'edgeId': edge.id,
        'fromNodeId': edge.from,
        'fromPoint': fromPoint.toJson(),
        'id': samePageSegmentId,
        'pageId': from.pageId,
        'routePoints': <Object?>[],
        'toNodeId': edge.to,
        'toPoint': toPoint.toJson(),
      });
    } else {
      connectorId = 'C${_pad(crossPageConnectorPairs.length + 1, 3)}';
      final bool forwardPages = from.pageId.compareTo(to.pageId) < 0;
      crossPageConnectorPairs.add(
        ReportGraphConnectorPair(
          adjacencyRecordId: adjacencyRecordId,
          edgeId: edge.id,
          fromPageId: from.pageId,
          id: connectorId,
          incoming: ReportGraphConnectorEndpoint(
            anchor: ReportGraphPoint(
              x: to.box.x + to.box.width ~/ 2,
              y: forwardPages ? to.box.y : to.box.y + to.box.height,
            ),
            id: '$connectorId:IN',
            nodeId: edge.to,
            nodeRef: to.ref,
            pageId: to.pageId,
          ),
          outgoing: ReportGraphConnectorEndpoint(
            anchor: ReportGraphPoint(
              x: from.box.x + from.box.width ~/ 2,
              y: forwardPages ? from.box.y + from.box.height : from.box.y,
            ),
            id: '$connectorId:OUT',
            nodeId: edge.from,
            nodeRef: from.ref,
            pageId: from.pageId,
          ),
          toPageId: to.pageId,
        ),
      );
    }
    layoutEdges.add(<String, Object?>{
      'connectorId': connectorId,
      'cyclicRepair': cyclicRepair,
      'fromNodeId': edge.from,
      'fromNodeRef': from.ref,
      'fromPageId': from.pageId,
      'id': edge.id,
      'samePageSegmentId': samePageSegmentId,
      'toNodeId': edge.to,
      'toNodeRef': to.ref,
      'toPageId': to.pageId,
    });
  }
  for (final Map<String, Object?> page in graphPages) {
    final String pageId = page['id']! as String;
    page['edgeSegmentIds'] = samePageEdgeSegments
        .where(
          (Map<String, Object?> segment) => segment['pageId'] == pageId,
        )
        .map((Map<String, Object?> segment) => segment['id']! as String)
        .toList(growable: false);
    page['connectorEndpointIds'] = crossPageConnectorPairs
        .expand(
          (ReportGraphConnectorPair pair) =>
              <ReportGraphConnectorEndpoint>[pair.outgoing, pair.incoming],
        )
        .where(
          (ReportGraphConnectorEndpoint endpoint) => endpoint.pageId == pageId,
        )
        .map((ReportGraphConnectorEndpoint endpoint) => endpoint.id)
        .toList(growable: false);
  }
  for (final Map<String, Object?> page in graphPages) {
    final ReportGraphConnectorPageGeometry geometry = _connectorPageGeometry(
      graphFrame: graphFrame,
      graphPages: graphPages,
      pairs: crossPageConnectorPairs,
      pageId: page['id']! as String,
    );
    for (final ReportGraphConnectorEndpointGeometry endpointGeometry
        in geometry.endpoints) {
      ReportGraphConnectorPair? pair;
      for (final ReportGraphConnectorPair candidate
          in crossPageConnectorPairs) {
        if (candidate.incoming.id == endpointGeometry.endpointId ||
            candidate.outgoing.id == endpointGeometry.endpointId) {
          pair = candidate;
          break;
        }
      }
      if (pair == null) {
        _fail(
          ReportGraphLayoutErrorCode.inputInvalid,
          'Connector geometry lost its serialized pair',
          <String, Object>{'endpointId': endpointGeometry.endpointId},
        );
      }
      final ReportGraphConnectorEndpoint endpoint =
          pair.incoming.id == endpointGeometry.endpointId
              ? pair.incoming
              : pair.outgoing;
      endpoint._applyGeometry(endpointGeometry);
    }
  }
  final int nodeObstacleExpansion = reportGraphRouteClearance +
      reportGraphNodeStrokeWidth ~/ 2 +
      reportGraphConnectorPathStrokeWidth ~/ 2;
  final int endpointObstacleExpansion =
      reportGraphRouteClearance + reportGraphConnectorPathStrokeWidth ~/ 2;
  List<ReportGraphBox> routeObstacles(
    String pageId,
    Set<String> excludedNodeIds,
    Set<String> excludedEndpointIds,
  ) {
    final List<ReportGraphBox> obstacles = layoutNodes
        .where(
          (ReportGraphLayoutNode node) =>
              node.pageId == pageId && !excludedNodeIds.contains(node.id),
        )
        .map(
          (ReportGraphLayoutNode node) =>
              _expandBox(node.box, nodeObstacleExpansion),
        )
        .toList(growable: true);
    for (final ReportGraphConnectorEndpoint endpoint
        in crossPageConnectorPairs.expand(
      (ReportGraphConnectorPair pair) =>
          <ReportGraphConnectorEndpoint>[pair.outgoing, pair.incoming],
    )) {
      if (endpoint.pageId != pageId ||
          excludedEndpointIds.contains(endpoint.id)) {
        continue;
      }
      obstacles.add(
        _expandBox(endpoint.markerInkBox, endpointObstacleExpansion),
      );
      obstacles.add(
        _expandBox(endpoint.labelInkBox, endpointObstacleExpansion),
      );
    }
    return obstacles;
  }

  for (final Map<String, Object?> segment in samePageEdgeSegments) {
    final List<ReportGraphPoint> route = _orthogonalRoute(
      _pointFromJson(
        (segment['fromPoint']! as Map).cast<String, Object?>(),
      ),
      _pointFromJson(
        (segment['toPoint']! as Map).cast<String, Object?>(),
      ),
      graphFrame,
      routeObstacles(
        segment['pageId']! as String,
        <String>{
          segment['fromNodeId']! as String,
          segment['toNodeId']! as String,
        },
        <String>{},
      ),
      segment['id']! as String,
    );
    segment['routePoints'] = route
        .map((ReportGraphPoint point) => point.toJson())
        .toList(growable: false);
  }
  for (final ReportGraphConnectorPair pair in crossPageConnectorPairs) {
    for (final ReportGraphConnectorEndpoint endpoint
        in <ReportGraphConnectorEndpoint>[pair.outgoing, pair.incoming]) {
      final bool incoming = endpoint.id == pair.incoming.id;
      final List<ReportGraphPoint> coreRoute = incoming
          ? _orthogonalRoute(
              endpoint.gutterExitPort,
              endpoint.anchor,
              graphFrame,
              routeObstacles(
                endpoint.pageId,
                <String>{endpoint.nodeId},
                <String>{endpoint.id},
              ),
              endpoint.id,
            )
          : _orthogonalRoute(
              endpoint.anchor,
              endpoint.gutterExitPort,
              graphFrame,
              routeObstacles(
                endpoint.pageId,
                <String>{endpoint.nodeId},
                <String>{endpoint.id},
              ),
              endpoint.id,
            );
      final ReportGraphPoint lanePoint = ReportGraphPoint(
        x: endpoint.routeLaneX,
        y: endpoint.markerPort.y,
      );
      endpoint._setRoutePoints(
        incoming
            ? <ReportGraphPoint>[
                endpoint.markerPort,
                lanePoint,
                endpoint.gutterExitPort,
                ...coreRoute.skip(1),
              ]
            : <ReportGraphPoint>[
                ...coreRoute,
                lanePoint,
                endpoint.markerPort,
              ],
      );
    }
  }

  final List<Map<String, Object?>> nodeTextRecords =
      layoutNodes.map((ReportGraphLayoutNode node) {
    final ReportGraphInputNode source = nodeById[node.id]!;
    return <String, Object?>{
      'detail': source.detail,
      'id': node.ref,
      'nodeId': node.id,
      'text': '${node.ref} | '
          '${_nodeTypeLabels[stableInput.presentation.language]![source.type]}'
          ' | ${source.title}\n${source.detail}',
      'title': source.title,
      'type': source.type,
    };
  }).toList(growable: false);
  final List<Map<String, Object?>> adjacencyTextRecords =
      <Map<String, Object?>>[];
  for (int index = 0; index < stableInput.edges.length; index += 1) {
    final ReportGraphInputEdge edge = stableInput.edges[index];
    final String fromRef = refByNode[edge.from]!;
    final String toRef = refByNode[edge.to]!;
    final List<String> fields = <String>['$fromRef -> $toRef'];
    if (edge.label.isNotEmpty) {
      fields.add('label=${edge.label}');
    }
    if (edge.detail.isNotEmpty) {
      fields.add('detail=${edge.detail}');
    }
    if (edge.result.isNotEmpty) {
      fields.add('result=${edge.result}');
    }
    fields.addAll(edge.annotations);
    adjacencyTextRecords.add(<String, Object?>{
      'annotations': List<String>.from(edge.annotations),
      'detail': edge.detail,
      'edgeId': edge.id,
      'fromNodeRef': fromRef,
      'id': 'A${_pad(index + 1, 3)}',
      'label': edge.label,
      'result': edge.result,
      'text': fields.join(' | '),
      'toNodeRef': toRef,
    });
  }
  final List<Map<String, Object?>> connectorTextRecords =
      <Map<String, Object?>>[];
  for (int index = 0; index < crossPageConnectorPairs.length; index += 1) {
    final ReportGraphConnectorPair pair = crossPageConnectorPairs[index];
    final ReportGraphInputEdge relationship = stableInput.edges.singleWhere(
      (ReportGraphInputEdge edge) => edge.id == pair.edgeId,
    );
    final String relationshipText =
        'label=${relationship.label.isEmpty ? '(none)' : relationship.label} | '
        'detail=${relationship.detail.isEmpty ? '(none)' : relationship.detail} | '
        'result=${relationship.result.isEmpty ? '(none)' : relationship.result} | '
        'annotations=${relationship.annotations.isEmpty ? '(none)' : relationship.annotations.join('; ')}';
    final String outText = '${pair.id} OUT | '
        '${pair.adjacencyRecordId} | ${pair.outgoing.nodeRef} | '
        '${pair.fromPageId} -> ${pair.toPageId} | $relationshipText';
    final String inText = '${pair.id} IN | '
        '${pair.adjacencyRecordId} | ${pair.incoming.nodeRef} | '
        '${pair.fromPageId} -> ${pair.toPageId} | $relationshipText';
    final String accessibleText = '$outText\n$inText';
    connectorTextRecords.add(<String, Object?>{
      'accessibleText': accessibleText,
      'adjacencyRecordId': pair.adjacencyRecordId,
      'annotations': List<String>.from(relationship.annotations),
      'connectorId': pair.id,
      'detail': relationship.detail,
      'edgeId': pair.edgeId,
      'fromNodeRef': pair.outgoing.nodeRef,
      'fromPageId': pair.fromPageId,
      'id': 'X${_pad(index + 1, 3)}',
      'inText': inText,
      'label': relationship.label,
      'outText': outText,
      'result': relationship.result,
      'text': accessibleText,
      'toNodeRef': pair.incoming.nodeRef,
      'toPageId': pair.toPageId,
    });
  }
  final List<String> rootNodeIds = topology.components
      .expand((_Component component) => component.rootNodeIds)
      .toList(growable: false);
  final List<String> terminalNodeIds = topology.components
      .expand((_Component component) => component.terminalNodeIds)
      .toList(growable: false);
  final List<String> rootNodeRefs =
      rootNodeIds.map((String id) => refByNode[id]!).toList(growable: false);
  final List<String> terminalNodeRefs = terminalNodeIds
      .map((String id) => refByNode[id]!)
      .toList(growable: false);
  final Map<String, Object?> summary = <String, Object?>{
    'componentCount': topology.components.length,
    'disconnected': topology.components.length > 1,
    'rootNodeIds': rootNodeIds,
    'rootNodeRefs': rootNodeRefs,
    'terminalNodeIds': terminalNodeIds,
    'terminalNodeRefs': terminalNodeRefs,
    'text': 'Components: ${topology.components.length} | '
        'Disconnected: ${topology.components.length > 1 ? 'yes' : 'no'} | '
        'Roots: ${rootNodeRefs.isEmpty ? 'none' : rootNodeRefs.join(', ')} | '
        'Terminals: '
        '${terminalNodeRefs.isEmpty ? 'none' : terminalNodeRefs.join(', ')} | '
        'Cyclic repairs: ${topology.cyclicRepairs.length}',
  };
  final Map<String, Object?> registers = <String, Object?>{
    'adjacency': <String, Object?>{
      'id': 'R-ADJACENCY',
      'recordIds': adjacencyTextRecords
          .map((Map<String, Object?> record) => record['id']! as String)
          .toList(growable: false),
    },
    'connectors': <String, Object?>{
      'id': 'R-CONNECTORS',
      'recordIds': connectorTextRecords
          .map((Map<String, Object?> record) => record['id']! as String)
          .toList(growable: false),
    },
    'nodes': <String, Object?>{
      'id': 'R-NODES',
      'recordIds': nodeTextRecords
          .map((Map<String, Object?> record) => record['id']! as String)
          .toList(growable: false),
    },
    'summary': <String, Object?>{
      'id': 'R-SUMMARY',
      'recordIds': <String>['SUMMARY'],
    },
  };
  final List<Map<String, Object?>> pageOrder = graphPages
      .map(
        (Map<String, Object?> page) => <String, Object?>{
          'id': page['id'],
          'kind': 'graph',
          'register': null,
        },
      )
      .toList(growable: true)
    ..addAll(<Map<String, Object?>>[
      <String, Object?>{
        'id': 'R-SUMMARY',
        'kind': 'register',
        'register': 'summary',
      },
      <String, Object?>{
        'id': 'R-NODES',
        'kind': 'register',
        'register': 'nodes',
      },
      <String, Object?>{
        'id': 'R-ADJACENCY',
        'kind': 'register',
        'register': 'adjacency',
      },
      <String, Object?>{
        'id': 'R-CONNECTORS',
        'kind': 'register',
        'register': 'connectors',
      },
    ]);
  final List<Map<String, Object?>> topologyLayers = topology.topologyLayers
      .map(
        (_TopologyLayer layer) => <String, Object?>{
          'componentId': layer.componentId,
          'id': layer.id,
          'index': layer.index,
          'nodeIds': List<String>.from(layer.nodeIds),
          'subLayerIds': layoutLayers
              .where(
                (Map<String, Object?> candidate) =>
                    candidate['topologyLayerId'] == layer.id,
              )
              .map(
                (Map<String, Object?> candidate) => candidate['id']! as String,
              )
              .toList(growable: false),
        },
      )
      .toList(growable: false);
  for (int pageIndex = 0; pageIndex < graphPages.length; pageIndex += 1) {
    final Map<String, Object?> page = graphPages[pageIndex];
    final _PlannedGraphPage planned = pagePlans[pageIndex];
    final ReportGraphConnectorPageGeometry geometry = _connectorPageGeometry(
      graphFrame: graphFrame,
      graphPages: graphPages,
      pairs: crossPageConnectorPairs,
      pageId: page['id']! as String,
    );
    final ReportGraphBox actual = geometry.nodeFrame;
    final ReportGraphBox expected = planned.nodeFrame;
    if (actual.x != expected.x ||
        actual.y != expected.y ||
        actual.width != expected.width ||
        actual.height != expected.height) {
      _fail(
        ReportGraphLayoutErrorCode.inputInvalid,
        'Connector page planning did not reach its deterministic geometry',
        <String, Object>{'pageId': page['id']! as String},
      );
    }
    for (final String nodeId
        in (page['nodeIds']! as List<Object?>).cast<String>()) {
      final ReportGraphLayoutNode node = layoutNodeById[nodeId]!;
      if (node.box.y < actual.y ||
          node.box.y + node.box.height > actual.y + actual.height) {
        _fail(
          ReportGraphLayoutErrorCode.nodeExceedsPrintableFrame,
          'Node intersects a reserved connector gutter',
          <String, Object>{
            'nodeId': nodeId,
            'pageId': page['id']! as String,
          },
        );
      }
    }
  }

  final Map<String, Object?> body = <String, Object?>{
    'adjacencyTextRecords': adjacencyTextRecords,
    'caseRef': stableInput.caseRef.toJson(),
    'components': topology.components
        .map((_Component component) => component.toJson())
        .toList(growable: false),
    'connectorTextRecords': connectorTextRecords,
    'crossPageConnectorPairs': crossPageConnectorPairs
        .map((ReportGraphConnectorPair pair) => pair.toJson())
        .toList(growable: false),
    'cyclicRepairs': topology.cyclicRepairs
        .map((_CyclicRepair repair) => repair.toJson())
        .toList(growable: false),
    'edges': layoutEdges,
    'fixedPoint': <String, Object?>{
      'description': 'All paper, frame, box, line-height, and measured text '
          'widths are integer micrometres; font sizes are integer milli-points',
      'millimetre': 1000,
      'unit': reportGraphFixedUnit,
    },
    'footerFrame': _footerFrame.toJson(),
    'graphFrame': graphFrame.toJson(),
    'graphPages': graphPages,
    'headerFrame': headerFrame.toJson(),
    'headerLayout': headerLayout,
    'layoutAlgorithmVersion': reportGraphLayoutAlgorithmVersion,
    'layoutLayers': layoutLayers,
    'layoutRendererVersion': reportGraphLayoutRendererVersion,
    'layoutSchemaVersion': reportGraphLayoutSchemaVersion,
    'nodeGeometry': <String, Object?>{
      'badgeTitleGap': _badgeTitleGap,
      'dedicatedWidth': graphFrame.width,
      'laneGap': _laneGap,
      'layerGap': _layerGap,
      'maxDetailVisualLines': _maxDetailVisualLines,
      'maxPortraitLanes': reportGraphMaxPortraitLanes,
      'paddingX': _nodePaddingX,
      'paddingY': _nodePaddingY,
      'standardWidth': _standardNodeWidth,
      'titleDetailGap': _titleDetailGap,
    },
    'nodeTextRecords': nodeTextRecords,
    'nodes': layoutNodes
        .map((ReportGraphLayoutNode node) => node.toJson())
        .toList(growable: false),
    'pageOrder': pageOrder,
    'paper': <String, Object?>{
      'height': _paperBox.height,
      'orientation': 'portrait',
      'unit': reportGraphFixedUnit,
      'width': _paperBox.width,
    },
    'presentation': stableInput.presentation.toJson(),
    'printableFrame': _printableFrame.toJson(),
    'profileRef': stableInput.profileRef.toJson(),
    'registers': registers,
    'reportRef': stableInput.reportRef.toJson(),
    'samePageEdgeSegments': samePageEdgeSegments,
    'summary': summary,
    'topologyLayers': topologyLayers,
    'typography': _typographyJson(evaluator.metrics),
  };
  final String layoutFingerprint = _canonicalFingerprint(
    <String, Object?>{
      'kind': _fingerprintKind,
      'layout': body,
    },
  );
  return ReportGraphLayoutModel._(
    body: body,
    crossPageConnectorPairs: crossPageConnectorPairs,
    layoutFingerprint: layoutFingerprint,
    nodes: layoutNodes,
  );
}
