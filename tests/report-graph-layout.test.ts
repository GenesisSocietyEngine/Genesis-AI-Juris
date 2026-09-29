import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import rawFixtures from "../parity/report-graph-layout-fixtures.v1.json";
import rawFontMetrics from "../app/report-graph-font-metrics.v1.json";
import { canonicalFingerprint } from "../app/case-integrity";
import {
  buildReportGraphLayout,
  deriveReportGraphLayoutInput,
  reportGraphConnectorPageGeometry,
  reportGraphGraphemeClusters,
  reportGraphGovernedTextIssue,
  reportGraphMeasuredTextWidth,
  ReportGraphLayoutError,
  REPORT_GRAPH_CONNECTOR_COLUMNS,
  REPORT_GRAPH_CONNECTOR_ID_SIZE_MILLI_POINTS,
  REPORT_GRAPH_CONNECTOR_LABEL_WIDTH,
  REPORT_GRAPH_CONNECTOR_LABEL_X_OFFSET,
  REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE,
  REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH,
  REPORT_GRAPH_CONNECTOR_MARKER_RADIUS,
  REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH,
  REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS,
  REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH,
  REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS,
  REPORT_GRAPH_CONNECTOR_ROUTE_LANE_STEP,
  REPORT_GRAPH_NODE_STROKE_WIDTH,
  REPORT_GRAPH_ROUTE_CLEARANCE,
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
  REPORT_GRAPH_GRAPHEME_BREAK_CONTRACT,
  type ReportGraphLayoutInput,
  type ReportGraphLayoutModel,
} from "../app/report-graph-layout";
import { caseReportGraphLayoutSvg } from "../app/report-graph-pdf";
import { buildCanonicalReportModel } from "../app/report-model";
import type { StudioDraft } from "../app/types";

type ExpectedFixture = {
  expected: {
    connectors: Array<{
      adjacencyRecordId: string;
      edgeId: string;
      fromPageId: string;
      id: string;
      incomingId: string;
      outgoingId: string;
      toPageId: string;
    }>;
    layoutFingerprint: string;
    nodePages: Array<{ nodeId: string; pageId: string }>;
  };
  id: string;
  input: ReportGraphLayoutInput;
  tags: string[];
};

const fixtures = rawFixtures as unknown as {
  fixtures: ExpectedFixture[];
  fontSourceHashes: { medium: string; regular: string };
  format: string;
  layoutAlgorithmVersion: string;
  layoutRendererVersion: string;
  layoutSchemaVersion: number;
  schemaVersion: number;
};
const fixture = (id: string) => fixtures.fixtures.find((candidate) => candidate.id === id) ?? assert.fail(`Missing fixture ${id}`);

type FontkitRun = {
  advanceWidth: number;
  bbox: { maxX: number; minX: number };
};
type FontkitFace = {
  layout(value: string): FontkitRun;
};
type GovernedFontMetric = {
  advances: Record<string, number>;
  gdefMarkCodePoints: number[];
  maximumInkOverhang: { left: number; right: number };
  maximumPositiveShapingAdjustment: number;
  maxPositiveShapingAdjustments: Record<string, number>;
  sourceFile: string;
  sourceSha256: string;
  unitsPerEm: number;
  unsafeShapingPairs: string[];
  unsafeShapingTripleOracleThrows: number;
};
type GovernedFontArtifact = {
  format: string;
  schemaVersion: number;
  source: { package: string; version: string; vfsModule: string };
  unitPerEm: number;
  fonts: Record<"regular" | "medium", GovernedFontMetric>;
};

const governedFontMetrics = rawFontMetrics as unknown as GovernedFontArtifact;
const testRequire = createRequire(import.meta.url);
const governedVfs = testRequire(governedFontMetrics.source.vfsModule) as Record<string, string>;
const fontkit = testRequire("@foliojs-fork/fontkit") as { create(bytes: Buffer): FontkitFace };
const governedFaces = Object.fromEntries((["regular", "medium"] as const).map((fontKey) => [
  fontKey,
  fontkit.create(Buffer.from(governedVfs[governedFontMetrics.fonts[fontKey].sourceFile], "base64")),
])) as Record<"regular" | "medium", FontkitFace>;

function ceilFontUnitsToMicrometres(units: number, sizeMilliPoints: number, unitsPerEm: number) {
  assert.equal(Number.isInteger(units) && units >= 0, true);
  const numerator = BigInt(units) * BigInt(sizeMilliPoints) * BigInt(25_400);
  const denominator = BigInt(unitsPerEm) * BigInt(72_000);
  return Number((numerator + denominator - BigInt(1)) / denominator);
}

function actualPositionedRunWidth(fontKey: "regular" | "medium", value: string, sizeMilliPoints: number) {
  const run = governedFaces[fontKey].layout(value);
  const metric = governedFontMetrics.fonts[fontKey];
  assert.equal(run.bbox.minX >= -metric.maximumInkOverhang.left, true, `${fontKey} left ink bound drifted`);
  assert.equal(run.bbox.maxX <= run.advanceWidth + metric.maximumInkOverhang.right, true, `${fontKey} right ink bound drifted`);
  return ceilFontUnitsToMicrometres(
    metric.maximumInkOverhang.left + Math.max(run.advanceWidth, run.bbox.maxX),
    sizeMilliPoints,
    metric.unitsPerEm,
  );
}

function lockedProjection(layout: ReportGraphLayoutModel) {
  return {
    connectors: layout.crossPageConnectorPairs.map((pair) => ({
      adjacencyRecordId: pair.adjacencyRecordId,
      edgeId: pair.edgeId,
      fromPageId: pair.fromPageId,
      id: pair.id,
      incomingId: pair.incoming.id,
      outgoingId: pair.outgoing.id,
      toPageId: pair.toPageId,
    })),
    layoutFingerprint: layout.layoutFingerprint,
    nodePages: layout.nodes.map((node) => ({ nodeId: node.id, pageId: node.pageId })).sort((left, right) => left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0),
  };
}

function pointIsOnBoxBoundary(point: { x: number; y: number }, box: { height: number; width: number; x: number; y: number }) {
  const withinX = point.x >= box.x && point.x <= box.x + box.width;
  const withinY = point.y >= box.y && point.y <= box.y + box.height;
  return withinX && withinY && (point.x === box.x || point.x === box.x + box.width || point.y === box.y || point.y === box.y + box.height);
}

type Box = { height: number; width: number; x: number; y: number };

function boxContains(outer: Box, inner: Box) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function boxesOverlap(left: Box, right: Box) {
  return left.x < right.x + right.width
    && right.x < left.x + left.width
    && left.y < right.y + right.height
    && right.y < left.y + left.height;
}

function expandedBox(box: Box, amount: number): Box {
  return { height: box.height + amount * 2, width: box.width + amount * 2, x: box.x - amount, y: box.y - amount };
}

function segmentIntersectsBox(from: { x: number; y: number }, to: { x: number; y: number }, box: Box) {
  const minimumX = Math.min(from.x, to.x);
  const maximumX = Math.max(from.x, to.x);
  const minimumY = Math.min(from.y, to.y);
  const maximumY = Math.max(from.y, to.y);
  if (from.y === to.y) return from.y >= box.y && from.y <= box.y + box.height && maximumX >= box.x && minimumX <= box.x + box.width;
  if (from.x === to.x) return from.x >= box.x && from.x <= box.x + box.width && maximumY >= box.y && minimumY <= box.y + box.height;
  return true;
}

type Segment = [{ x: number; y: number }, { x: number; y: number }];

function orthogonalSegmentsIntersect(left: Segment, right: Segment) {
  const [leftFrom, leftTo] = left;
  const [rightFrom, rightTo] = right;
  const leftVertical = leftFrom.x === leftTo.x;
  const rightVertical = rightFrom.x === rightTo.x;
  const leftMinimumX = Math.min(leftFrom.x, leftTo.x);
  const leftMaximumX = Math.max(leftFrom.x, leftTo.x);
  const leftMinimumY = Math.min(leftFrom.y, leftTo.y);
  const leftMaximumY = Math.max(leftFrom.y, leftTo.y);
  const rightMinimumX = Math.min(rightFrom.x, rightTo.x);
  const rightMaximumX = Math.max(rightFrom.x, rightTo.x);
  const rightMinimumY = Math.min(rightFrom.y, rightTo.y);
  const rightMaximumY = Math.max(rightFrom.y, rightTo.y);
  if (leftVertical && rightVertical) {
    return leftFrom.x === rightFrom.x
      && Math.max(leftMinimumY, rightMinimumY) <= Math.min(leftMaximumY, rightMaximumY);
  }
  if (!leftVertical && !rightVertical) {
    return leftFrom.y === rightFrom.y
      && Math.max(leftMinimumX, rightMinimumX) <= Math.min(leftMaximumX, rightMaximumX);
  }
  const vertical = leftVertical ? left : right;
  const horizontal = leftVertical ? right : left;
  return vertical[0].x >= Math.min(horizontal[0].x, horizontal[1].x)
    && vertical[0].x <= Math.max(horizontal[0].x, horizontal[1].x)
    && horizontal[0].y >= Math.min(vertical[0].y, vertical[1].y)
    && horizontal[0].y <= Math.max(vertical[0].y, vertical[1].y);
}

function assertRouteAvoids(routeId: string, points: Array<{ x: number; y: number }>, frame: Box, obstacles: Array<{ box: Box; id: string }>) {
  assert.equal(points.length >= 2, true, `${routeId} needs at least two points`);
  for (const point of points) {
    assert.equal(point.x >= frame.x && point.x <= frame.x + frame.width, true, `${routeId} x escaped graph frame`);
    assert.equal(point.y >= frame.y && point.y <= frame.y + frame.height, true, `${routeId} y escaped graph frame`);
  }
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    assert.equal(from.x === to.x || from.y === to.y, true, `${routeId} contains a diagonal segment`);
    for (const obstacle of obstacles) {
      assert.equal(segmentIntersectsBox(from, to, obstacle.box), false, `${routeId} intersects ${obstacle.id}`);
    }
  }
}

function assertStructuralContract(input: ReportGraphLayoutInput, layout: ReportGraphLayoutModel) {
  assert.equal(layout.layoutSchemaVersion, 1);
  assert.equal(layout.layoutAlgorithmVersion, "1.1.0");
  assert.equal(layout.layoutRendererVersion, "2.1.0");
  assert.deepEqual(layout.caseRef, input.caseRef, "case reference must be presentation-only and unchanged");
  assert.deepEqual(layout.reportRef, input.reportRef, "ReportModel reference must remain unchanged");
  assert.deepEqual(layout.profileRef, input.profileRef, "profile reference must remain unchanged");
  assert.deepEqual(layout.presentation, input.presentation, "language/redaction binding must remain unchanged");
  assert.deepEqual(layout.paper, { height: 297_000, orientation: "portrait", unit: "micrometre", width: 210_000 });
  assert.equal(layout.fixedPoint.millimetre, 1_000);
  assert.deepEqual(layout.typography.graphemeBreak, REPORT_GRAPH_GRAPHEME_BREAK_CONTRACT);
  assert.equal(layout.typography.metricUnitsPerEm, 2_048);
  for (const style of Object.values(layout.typography.styles)) {
    assert.equal(Number.isInteger(style.inkLeft) && style.inkLeft > 0, true);
    assert.equal(Number.isInteger(style.inkRight) && style.inkRight > 0, true);
  }
  assert.equal(layout.printableFrame.x + layout.printableFrame.width <= layout.paper.width, true);
  assert.equal(layout.printableFrame.y + layout.printableFrame.height <= layout.paper.height, true);
  assert.equal(boxContains(layout.printableFrame, layout.headerFrame), true);
  assert.equal(layout.headerLayout.contentHeight, layout.headerFrame.height);
  assert.equal(layout.headerLayout.reportTitle.fullText, input.caseRef.title);
  assert.equal(layout.headerLayout.identity.fullText.includes(input.caseRef.id), true);
  assert.equal(layout.headerLayout.identity.fullText.includes(input.profileRef.id), true);
  for (const line of [
    ...layout.headerLayout.reportTitle.lines,
    ...layout.headerLayout.sectionTitle.lines,
    ...layout.headerLayout.identity.lines,
    ...layout.graphPages.map((page) => page.pageLine),
  ]) assert.equal(line.width <= layout.headerFrame.width, true, `header line exceeds frame: ${line.text}`);
  assert.equal(layout.graphFrame.x >= layout.printableFrame.x, true);
  assert.equal(layout.graphFrame.y >= layout.headerFrame.y + layout.headerFrame.height, true);
  assert.equal(layout.graphFrame.x + layout.graphFrame.width <= layout.printableFrame.x + layout.printableFrame.width, true);
  assert.equal(layout.graphFrame.y + layout.graphFrame.height <= layout.printableFrame.y + layout.printableFrame.height, true);
  assert.equal(layout.nodeGeometry.maxPortraitLanes, 3);
  assert.equal(REPORT_GRAPH_CONNECTOR_COLUMNS, 7);
  assert.equal(REPORT_GRAPH_CONNECTOR_ROUTE_LANE_STEP >= REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH, true);
  assert.equal(REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS >= 6_200, true);
  const serializedEndpointById = new Map(layout.crossPageConnectorPairs
    .flatMap((pair) => [pair.outgoing, pair.incoming])
    .map((endpoint) => [endpoint.id, endpoint] as const));

  for (const page of layout.graphPages) {
    const geometry = reportGraphConnectorPageGeometry(layout, page.id);
    assert.equal(boxContains(layout.graphFrame, geometry.topGutter), true);
    assert.equal(boxContains(layout.graphFrame, geometry.bottomGutter), true);
    assert.equal(boxContains(layout.graphFrame, geometry.nodeFrame), true);
    assert.equal(boxesOverlap(geometry.topGutter, geometry.nodeFrame), false);
    assert.equal(boxesOverlap(geometry.bottomGutter, geometry.nodeFrame), false);
    assert.equal(boxesOverlap(geometry.topGutter, geometry.bottomGutter), false);
    assert.equal(geometry.endpoints.length, page.connectorEndpointIds.length);
    assert.deepEqual(geometry.endpoints.map((endpoint) => endpoint.endpointId).sort(), [...page.connectorEndpointIds].sort());

    const occupiedBoxes: Array<{ box: Box; id: string }> = [];
    for (const endpoint of geometry.endpoints) {
      const serialized = serializedEndpointById.get(endpoint.endpointId) ?? assert.fail(`Missing serialized endpoint ${endpoint.endpointId}`);
      const geometryKeys = Object.keys(endpoint) as Array<keyof typeof endpoint>;
      const serializedGeometry = Object.fromEntries(geometryKeys.map((key) => [key, serialized[key]]));
      assert.deepEqual(serializedGeometry, endpoint, `${endpoint.endpointId} derived geometry drifted from the fingerprint-bound endpoint`);
      const gutter = endpoint.side === "top" ? geometry.topGutter : geometry.bottomGutter;
      assert.equal(boxContains(gutter, endpoint.cellBox), true, `${endpoint.endpointId} cell escaped its ${endpoint.side} gutter`);
      assert.equal(boxContains(endpoint.cellBox, endpoint.markerBox), true);
      assert.equal(boxContains(endpoint.cellBox, endpoint.labelBox), true);
      assert.equal(boxContains(endpoint.cellBox, endpoint.markerInkBox), true, `${endpoint.endpointId} marker stroke escaped its cell`);
      assert.equal(boxContains(endpoint.cellBox, endpoint.labelInkBox), true, `${endpoint.endpointId} label stroke escaped its cell`);
      assert.deepEqual(endpoint.markerInkBox, expandedBox(endpoint.markerBox, REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH / 2));
      assert.deepEqual(endpoint.labelInkBox, expandedBox(endpoint.labelBox, REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH / 2));
      assert.equal(boxesOverlap(endpoint.markerInkBox, endpoint.labelInkBox), false, `${endpoint.endpointId} marker ink overlaps its label ink`);
      assert.equal(endpoint.row, Math.floor(geometry.endpoints.filter((candidate) => candidate.side === endpoint.side).findIndex((candidate) => candidate.endpointId === endpoint.endpointId) / REPORT_GRAPH_CONNECTOR_COLUMNS));
      assert.equal(endpoint.column >= 0 && endpoint.column < REPORT_GRAPH_CONNECTOR_COLUMNS, true);
      assert.equal(pointIsOnBoxBoundary(endpoint.markerPort, endpoint.markerInkBox), true);
      assert.deepEqual(endpoint.pathPort, endpoint.markerPort);
      assert.equal(endpoint.routeLaneX - REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH / 2 >= endpoint.markerInkBox.x + endpoint.markerInkBox.width + REPORT_GRAPH_ROUTE_CLEARANCE, true);
      assert.equal(endpoint.routeLaneX + REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH / 2 <= endpoint.cellBox.x + endpoint.cellBox.width, true);
      assert.equal(endpoint.gutterExitPort.x, endpoint.routeLaneX);
      assert.equal(endpoint.gutterExitPort.y >= gutter.y && endpoint.gutterExitPort.y <= gutter.y + gutter.height, true);
      assert.match(endpoint.targetPageId, /^G\d{3}$/);
      assert.match(endpoint.targetNodeRef, /^N\d{2,3}$/);
      assert.equal(endpoint.direction === "IN" || endpoint.direction === "OUT", true);
      occupiedBoxes.push({ box: endpoint.markerInkBox, id: `${endpoint.endpointId}:marker-ink` });
      occupiedBoxes.push({ box: endpoint.labelInkBox, id: `${endpoint.endpointId}:label-ink` });
    }
    for (let left = 0; left < occupiedBoxes.length; left += 1) {
      for (let right = left + 1; right < occupiedBoxes.length; right += 1) {
        assert.equal(boxesOverlap(occupiedBoxes[left].box, occupiedBoxes[right].box), false, `${occupiedBoxes[left].id} overlaps ${occupiedBoxes[right].id}`);
      }
    }
    for (const side of ["top", "bottom"] as const) {
      const sideEndpoints = [...serializedEndpointById.values()]
        .filter((endpoint) => endpoint.pageId === page.id && endpoint.side === side);
      assert.equal(Math.ceil(sideEndpoints.length / REPORT_GRAPH_CONNECTOR_COLUMNS) <= REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE, true);
      assert.equal(
        new Set(sideEndpoints.map((endpoint) => endpoint.routeLaneX)).size,
        sideEndpoints.length,
        page.id + " " + side + " route lanes must be endpoint-unique",
      );
      const bandRoutes = sideEndpoints.map((endpoint) => {
        const lanePoint = { x: endpoint.routeLaneX, y: endpoint.markerPort.y };
        const routePrelude = [endpoint.markerPort, lanePoint, endpoint.gutterExitPort];
        const serializedPrelude = endpoint.direction === "IN"
          ? endpoint.routePoints.slice(0, 3)
          : endpoint.routePoints.slice(-3).reverse();
        assert.deepEqual(serializedPrelude, routePrelude, endpoint.id + " lost its fingerprint-bound connector-band prelude");
        return {
          endpointId: endpoint.id,
          segments: [
            [endpoint.markerPort, lanePoint],
            [lanePoint, endpoint.gutterExitPort],
          ] as Segment[],
        };
      });
      for (let left = 0; left < bandRoutes.length; left += 1) {
        for (let right = left + 1; right < bandRoutes.length; right += 1) {
          for (const leftSegment of bandRoutes[left].segments) {
            for (const rightSegment of bandRoutes[right].segments) {
              assert.equal(
                orthogonalSegmentsIntersect(leftSegment, rightSegment),
                false,
                page.id + " " + side + " connector routes "
                  + bandRoutes[left].endpointId + " and " + bandRoutes[right].endpointId
                  + " merge or form a T-junction in the endpoint band",
              );
            }
          }
        }
      }
    }
    for (const node of layout.nodes.filter((candidate) => candidate.pageId === page.id)) {
      assert.equal(boxContains(geometry.nodeFrame, node.box), true, `${node.id} escaped the connector-safe node frame`);
      for (const occupied of occupiedBoxes) assert.equal(boxesOverlap(expandedBox(node.box, REPORT_GRAPH_NODE_STROKE_WIDTH / 2), occupied.box), false, `${node.id} ink overlaps ${occupied.id}`);
    }
    for (const occupied of occupiedBoxes) {
      assert.equal(boxesOverlap(layout.headerFrame, occupied.box), false);
      assert.equal(boxesOverlap(layout.footerFrame, occupied.box), false);
    }
  }

  const inputNodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const layoutNodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  assert.equal(layoutNodeById.size, input.nodes.length);
  assert.deepEqual([...layoutNodeById.keys()].sort(), input.nodes.map((node) => node.id).sort(), "no node may be orphaned, duplicated, or invented");
  assert.equal(new Set(layout.nodes.map((node) => node.ref)).size, layout.nodes.length);
  const pathHalfWidth = REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH / 2;
  const routeObstacles = (pageId: string, excludedNodeIds: ReadonlySet<string>, excludedEndpointIds: ReadonlySet<string>) => [
    ...layout.nodes
      .filter((node) => node.pageId === pageId && !excludedNodeIds.has(node.id))
      .map((node) => ({ box: expandedBox(node.box, REPORT_GRAPH_NODE_STROKE_WIDTH / 2 + pathHalfWidth), id: `${node.id}:node-ink` })),
    ...[...serializedEndpointById.values()]
      .filter((endpoint) => endpoint.pageId === pageId && !excludedEndpointIds.has(endpoint.id))
      .flatMap((endpoint) => [
        { box: expandedBox(endpoint.markerInkBox, pathHalfWidth), id: `${endpoint.id}:marker-ink` },
        { box: expandedBox(endpoint.labelInkBox, pathHalfWidth), id: `${endpoint.id}:label-ink` },
      ]),
  ];
  for (const node of layout.nodes) {
    const source = inputNodeById.get(node.id) ?? assert.fail(`Unknown layout node ${node.id}`);
    const contentWidth = node.box.width - layout.nodeGeometry.paddingX * 2;
    assert.equal(node.box.x >= layout.graphFrame.x, true);
    assert.equal(node.box.y >= layout.graphFrame.y, true);
    assert.equal(node.box.x + node.box.width <= layout.graphFrame.x + layout.graphFrame.width, true);
    assert.equal(node.box.y + node.box.height <= layout.graphFrame.y + layout.graphFrame.height, true);
    assert.equal(node.text.title.fullText, source.title, "full title is retained independently of visual wrapping");
    assert.equal(node.text.detail.fullText, source.detail, "full detail is retained for the register");
    assert.equal(node.text.title.lines.every((line) => line.width <= contentWidth), true, `${node.id} title line exceeds its measured text box`);
    assert.equal(node.text.detail.displayedLines.every((line) => line.width <= contentWidth), true, `${node.id} detail line exceeds its measured text box`);
    assert.equal(node.text.badge.width <= contentWidth, true);
    assert.equal(node.text.title.lines.some((line) => line.text.endsWith("...") || line.text.endsWith("…")), false, "layout must never introduce title ellipsis");
    const visualDetailLines = node.text.detail.displayedLines.length + (node.text.detail.referenceLine ? 1 : 0);
    assert.equal(visualDetailLines <= layout.nodeGeometry.maxDetailVisualLines, true);
    assert.equal(node.text.textHeight <= node.box.height - layout.nodeGeometry.paddingY * 2, true);
    if (node.text.detail.omitted) {
      assert.equal(node.text.detail.fullDetailReference, `Full detail: ${node.ref}`);
      assert.equal(node.text.detail.referenceLine?.text, `Full detail: ${node.ref}`);
      assert.equal((node.text.detail.referenceLine?.width ?? Number.MAX_SAFE_INTEGER) <= contentWidth, true);
      assert.equal(node.text.detail.allLineCount > visualDetailLines, true);
    } else {
      assert.equal(node.text.detail.fullDetailReference, null);
      assert.equal(node.text.detail.referenceLine, null);
      assert.equal(node.text.detail.displayedLines.length, node.text.detail.allLineCount);
    }
    const page = layout.graphPages.find((candidate) => candidate.id === node.pageId) ?? assert.fail(`Unknown node page ${node.pageId}`);
    assert.equal(page.nodeIds.includes(node.id), true);
  }

  const layerById = new Map(layout.layoutLayers.map((layer) => [layer.id, layer]));
  for (const layer of layout.layoutLayers) {
    assert.equal(layer.nodeIds.length >= 1 && layer.nodeIds.length <= 3, true);
    const members = layer.nodeIds.map((nodeId) => layoutNodeById.get(nodeId) ?? assert.fail(`Unknown member ${nodeId} for ${layer.id}`));
    const minimumX = Math.min(...members.map((node) => node.box.x));
    const maximumX = Math.max(...members.map((node) => node.box.x + node.box.width));
    const minimumY = Math.min(...members.map((node) => node.box.y));
    const maximumHeight = Math.max(...members.map((node) => node.box.height));
    assert.deepEqual(layer.box, { height: maximumHeight, width: maximumX - minimumX, x: minimumX, y: minimumY }, `${layer.id} must serialize its complete measured bounds`);
    assert.equal(layer.y, layer.box.y);
    assert.equal(layer.height, layer.box.height);
    assert.equal(boxContains(layout.graphFrame, layer.box), true);
    assert.equal(members.every((node) => boxContains(layer.box, node.box)), true);
    const pages = new Set(layer.nodeIds.map((id) => layoutNodeById.get(id)?.pageId));
    assert.deepEqual([...pages], [layer.pageId], `atomic layout layer ${layer.id} was cut across pages`);
    const page = layout.graphPages.find((candidate) => candidate.id === layer.pageId) ?? assert.fail(`Unknown layer page ${layer.pageId}`);
    assert.equal(page.layerIds.includes(layer.id), true);
    assert.equal(layer.y + layer.height <= layout.graphFrame.y + layout.graphFrame.height, true);
  }
  for (const topologyLayer of layout.topologyLayers) {
    assert.equal(topologyLayer.subLayerIds.length >= 1, true);
    assert.equal(topologyLayer.subLayerIds.every((id) => layerById.get(id)?.topologyLayerId === topologyLayer.id), true);
    assert.deepEqual(topologyLayer.subLayerIds.flatMap((id) => layerById.get(id)?.nodeIds ?? []), topologyLayer.nodeIds);
  }

  const inputEdgeById = new Map(input.edges.map((edge) => [edge.id, edge]));
  const adjacencyByEdge = new Map(layout.adjacencyTextRecords.map((record) => [record.edgeId, record]));
  assert.equal(layout.edges.length, input.edges.length);
  assert.equal(layout.adjacencyTextRecords.length, input.edges.length);
  for (const edge of layout.edges) {
    const source = inputEdgeById.get(edge.id) ?? assert.fail(`Invented layout edge ${edge.id}`);
    assert.equal(edge.fromNodeId, source.from, "relationship direction must not be reversed");
    assert.equal(edge.toNodeId, source.to, "relationship direction must not be reversed");
    assert.equal(edge.fromNodeRef, layoutNodeById.get(source.from)?.ref);
    assert.equal(edge.toNodeRef, layoutNodeById.get(source.to)?.ref);
    assert.equal(edge.fromPageId, layoutNodeById.get(source.from)?.pageId);
    assert.equal(edge.toPageId, layoutNodeById.get(source.to)?.pageId);
    assert.notEqual(edge.samePageSegmentId === null, edge.connectorId === null, "every edge must be exactly one same-page segment or cross-page pair");
    const adjacency = adjacencyByEdge.get(edge.id) ?? assert.fail(`Missing adjacency record for ${edge.id}`);
    assert.equal(adjacency.fromNodeRef, edge.fromNodeRef);
    assert.equal(adjacency.toNodeRef, edge.toNodeRef);
    assert.equal(adjacency.label, source.label);
    assert.equal(adjacency.detail, source.detail);
    assert.equal(adjacency.result, source.result);
    assert.deepEqual(adjacency.annotations, source.annotations);
  }

  const segmentByEdge = new Map(layout.samePageEdgeSegments.map((segment) => [segment.edgeId, segment]));
  assert.equal(segmentByEdge.size, layout.samePageEdgeSegments.length);
  for (const segment of layout.samePageEdgeSegments) {
    const source = inputEdgeById.get(segment.edgeId) ?? assert.fail(`Orphan segment ${segment.id}`);
    assert.equal(segment.fromNodeId, source.from);
    assert.equal(segment.toNodeId, source.to);
    assert.equal(layoutNodeById.get(source.from)?.pageId, segment.pageId);
    assert.equal(layoutNodeById.get(source.to)?.pageId, segment.pageId);
    const segmentFromBox = layoutNodeById.get(source.from)?.box;
    const segmentToBox = layoutNodeById.get(source.to)?.box;
    assert.ok(segmentFromBox && segmentToBox);
    assert.equal(pointIsOnBoxBoundary(segment.fromPoint, segmentFromBox), true);
    assert.equal(pointIsOnBoxBoundary(segment.toPoint, segmentToBox), true);
    assert.deepEqual(segment.routePoints[0], segment.fromPoint);
    assert.deepEqual(segment.routePoints.at(-1), segment.toPoint);
    assertRouteAvoids(
      segment.id,
      segment.routePoints,
      layout.graphFrame,
      routeObstacles(segment.pageId, new Set([segment.fromNodeId, segment.toNodeId]), new Set()),
    );
  }

  const endpointIds = layout.graphPages.flatMap((page) => page.connectorEndpointIds);
  const connectorIds = new Set<string>();
  for (const pair of layout.crossPageConnectorPairs) {
    assert.match(pair.id, /^C\d{3}$/);
    assert.equal(connectorIds.has(pair.id), false, `duplicate connector ${pair.id}`);
    connectorIds.add(pair.id);
    const source = inputEdgeById.get(pair.edgeId) ?? assert.fail(`Orphan connector ${pair.id}`);
    const adjacency = adjacencyByEdge.get(pair.edgeId) ?? assert.fail(`Missing adjacency for connector ${pair.id}`);
    assert.equal(pair.adjacencyRecordId, adjacency.id);
    assert.equal(pair.outgoing.nodeId, source.from, "OUT marker must retain source direction");
    assert.equal(pair.incoming.nodeId, source.to, "IN marker must retain target direction");
    assert.equal(pair.outgoing.nodeRef, layoutNodeById.get(source.from)?.ref);
    assert.equal(pair.incoming.nodeRef, layoutNodeById.get(source.to)?.ref);
    assert.equal(pair.outgoing.pageId, pair.fromPageId);
    assert.equal(pair.incoming.pageId, pair.toPageId);
    const connectorFromBox = layoutNodeById.get(source.from)?.box;
    const connectorToBox = layoutNodeById.get(source.to)?.box;
    assert.ok(connectorFromBox && connectorToBox);
    assert.equal(pointIsOnBoxBoundary(pair.outgoing.anchor, connectorFromBox), true);
    assert.equal(pointIsOnBoxBoundary(pair.incoming.anchor, connectorToBox), true);
    assert.equal(pair.fromPageId, layoutNodeById.get(source.from)?.pageId);
    assert.equal(pair.toPageId, layoutNodeById.get(source.to)?.pageId);
    assert.notEqual(pair.fromPageId, pair.toPageId);
    assert.equal(pair.outgoing.id, `${pair.id}:OUT`);
    assert.equal(pair.incoming.id, `${pair.id}:IN`);
    assert.equal(pair.outgoing.direction, "OUT");
    assert.equal(pair.outgoing.targetPageId, pair.toPageId);
    assert.equal(pair.outgoing.targetNodeRef, pair.incoming.nodeRef);
    assert.equal(pair.incoming.direction, "IN");
    assert.equal(pair.incoming.targetPageId, pair.fromPageId);
    assert.equal(pair.incoming.targetNodeRef, pair.outgoing.nodeRef);
    for (const endpoint of [pair.outgoing, pair.incoming]) {
      const incomingEndpoint = endpoint.id === pair.incoming.id;
      assert.deepEqual(endpoint.routePoints[0], incomingEndpoint ? endpoint.markerPort : endpoint.anchor);
      assert.deepEqual(endpoint.routePoints.at(-1), incomingEndpoint ? endpoint.anchor : endpoint.markerPort);
      assertRouteAvoids(
        endpoint.id,
        endpoint.routePoints,
        layout.graphFrame,
        routeObstacles(endpoint.pageId, new Set([endpoint.nodeId]), new Set([endpoint.id])),
      );
    }
    assert.equal(endpointIds.filter((id) => id.startsWith(`${pair.id}:`)).length, 2, `${pair.id} must appear as exactly one matched pair`);
    const connectorRecord = layout.connectorTextRecords.find((record) => record.connectorId === pair.id) ?? assert.fail(`Missing connector text ${pair.id}`);
    assert.equal(connectorRecord.adjacencyRecordId, adjacency.id);
    assert.equal(connectorRecord.label, source.label);
    assert.equal(connectorRecord.detail, source.detail);
    assert.equal(connectorRecord.result, source.result);
    assert.deepEqual(connectorRecord.annotations, source.annotations);
    assert.equal(connectorRecord.accessibleText, connectorRecord.text);
    assert.match(connectorRecord.accessibleText, /label=.* \| detail=.* \| result=.* \| annotations=/);
    for (const value of [source.label, source.detail, source.result, ...source.annotations].filter(Boolean)) {
      assert.equal(connectorRecord.accessibleText.includes(value), true, `Connector ${pair.id} omitted relationship value ${value}`);
    }
    assert.match(connectorRecord.outText, new RegExp(`^${pair.id} OUT \\| ${adjacency.id} \\|`));
    assert.match(connectorRecord.inText, new RegExp(`^${pair.id} IN \\| ${adjacency.id} \\|`));
    assert.deepEqual(connectorRecord.text.split("\n"), [connectorRecord.outText, connectorRecord.inText]);
    assert.equal(connectorRecord.text.includes("\\n"), false, "connector text must contain a real line break, not a visible backslash-n");
  }
  assert.equal(layout.crossPageConnectorPairs.length, input.edges.filter((edge) => layoutNodeById.get(edge.from)?.pageId !== layoutNodeById.get(edge.to)?.pageId).length);
  assert.equal(layout.connectorTextRecords.length, layout.crossPageConnectorPairs.length);
  assert.equal(endpointIds.length, layout.crossPageConnectorPairs.length * 2);
  assert.equal(new Set(endpointIds).size, endpointIds.length);

  assert.equal(layout.nodeTextRecords.length, input.nodes.length);
  for (const record of layout.nodeTextRecords) {
    const source = inputNodeById.get(record.nodeId) ?? assert.fail(`Orphan node register record ${record.id}`);
    assert.equal(record.title, source.title);
    assert.equal(record.detail, source.detail);
  }
  const incoming = new Set(input.edges.map((edge) => edge.to));
  const outgoing = new Set(input.edges.map((edge) => edge.from));
  assert.deepEqual(layout.summary.rootNodeIds.slice().sort(), input.nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id).sort());
  assert.deepEqual(layout.summary.terminalNodeIds.slice().sort(), input.nodes.filter((node) => !outgoing.has(node.id)).map((node) => node.id).sort());
  assert.equal(layout.summary.disconnected, layout.summary.componentCount > 1);

  const graphOrder = layout.pageOrder.slice(0, layout.graphPages.length);
  assert.deepEqual(graphOrder.map((item) => item.id), layout.graphPages.map((page) => page.id));
  assert.equal(graphOrder.every((item) => item.kind === "graph" && item.register === null), true);
  assert.deepEqual(layout.pageOrder.slice(layout.graphPages.length), [
    { id: "R-SUMMARY", kind: "register", register: "summary" },
    { id: "R-NODES", kind: "register", register: "nodes" },
    { id: "R-ADJACENCY", kind: "register", register: "adjacency" },
    { id: "R-CONNECTORS", kind: "register", register: "connectors" },
  ]);

  const { layoutFingerprint, ...fingerprintedLayout } = layout;
  assert.equal(layoutFingerprint, canonicalFingerprint({ kind: "genesis-juris-report-graph-layout", layout: fingerprintedLayout }));
}

test("locked cross-runtime fixture families reproduce exact assignments, connectors, and fingerprints", () => {
  assert.equal(fixtures.format, "genesis-juris-report-graph-layout-fixtures");
  assert.equal(fixtures.schemaVersion, 1);
  assert.equal(fixtures.layoutSchemaVersion, REPORT_GRAPH_LAYOUT_SCHEMA_VERSION);
  assert.equal(fixtures.layoutAlgorithmVersion, REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION);
  assert.equal(fixtures.layoutRendererVersion, REPORT_GRAPH_LAYOUT_RENDERER_VERSION);
  const requiredTags = ["bhopal", "deep", "wide", "fan-out", "fan-in", "disconnected", "cyclic-repair", "long-title", "long-detail", "en", "ru", "max-node-stress"];
  const presentTags = new Set(fixtures.fixtures.flatMap((item) => item.tags));
  for (const tag of requiredTags) assert.equal(presentTags.has(tag), true, `missing required fixture family ${tag}`);
  for (const item of fixtures.fixtures) {
    assert.deepEqual(item.input.nodes.map((node) => node.id), item.input.nodes.map((node) => node.id).sort(), `${item.id} node input is not in canonical ASCII ID order`);
    assert.deepEqual(item.input.edges.map((edge) => edge.id), item.input.edges.map((edge) => edge.id).sort(), `${item.id} edge input is not in canonical ASCII ID order`);
    const before = structuredClone(item.input);
    const layout = buildReportGraphLayout(item.input);
    assert.deepEqual(item.input, before, `${item.id} input was mutated`);
    assert.deepEqual(lockedProjection(layout), item.expected, `${item.id} lock drifted`);
    assertStructuralContract(item.input, layout);
    const shuffled = { ...item.input, edges: [...item.input.edges].reverse(), nodes: [...item.input.nodes].reverse() };
    assert.deepEqual(lockedProjection(buildReportGraphLayout(shuffled)), item.expected, `${item.id} depends on input array order`);
    assert.equal(buildReportGraphLayout(item.input).layoutFingerprint, layout.layoutFingerprint, `${item.id} is nondeterministic`);
  }
});

test("wide, cyclic, Unicode, long-detail, and maximum fixtures exercise bounded fallbacks", () => {
  const wide = buildReportGraphLayout(fixture("wide-en").input);
  const wideTopologyLayer = wide.topologyLayers.find((layer) => layer.nodeIds.length === 9) ?? assert.fail("wide layer missing");
  assert.equal(wideTopologyLayer.subLayerIds.length, 3);
  assert.equal(wideTopologyLayer.subLayerIds.every((id) => (wide.layoutLayers.find((layer) => layer.id === id)?.nodeIds.length ?? 4) <= 3), true);

  const cyclicInput = fixture("cyclic-repair-en").input;
  const cyclic = buildReportGraphLayout(cyclicInput);
  assert.equal(cyclic.cyclicRepairs.length, 1);
  assert.equal(cyclic.components[0].cyclic, true);
  assert.equal(cyclic.cyclicRepairs[0].ignoredIncomingEdgeIds.length >= 1, true);
  for (const repairedId of cyclic.cyclicRepairs[0].ignoredIncomingEdgeIds) {
    const source = cyclicInput.edges.find((edge) => edge.id === repairedId) ?? assert.fail("unknown repair edge");
    const output = cyclic.edges.find((edge) => edge.id === repairedId) ?? assert.fail("missing repair edge");
    assert.equal(output.fromNodeId, source.from);
    assert.equal(output.toNodeId, source.to);
    assert.equal(output.cyclicRepair, true);
  }

  const unicode = buildReportGraphLayout(fixture("unicode-ru").input);
  const long = unicode.nodes.find((node) => node.id === "ru_long") ?? assert.fail("RU long node missing");
  assert.equal(long.text.title.fullText, fixture("unicode-ru").input.nodes.find((node) => node.id === "ru_long")?.title);
  assert.equal(long.text.detail.omitted, false, "complete full-width detail should stay visible when it fits");
  assert.equal(long.text.detail.displayedLines.length, long.text.detail.allLineCount);
  assert.equal(long.text.detail.fullDetailReference, null);
  assert.equal(long.text.title.lines.every((line) => !/[\uD800-\uDFFF]/u.test(line.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gu, ""))), true, "wrapping must not split surrogate pairs");

  const maximum = buildReportGraphLayout(fixture("max-node-en").input);
  assert.equal(maximum.nodes.length, 200);
  assert.equal(maximum.graphPages.length > 1, true);
  assert.equal(maximum.crossPageConnectorPairs.length > 1, true);
  assert.equal(maximum.crossPageConnectorPairs.every((pair, index) => pair.id === `C${String(index + 1).padStart(3, "0")}`), true);
  const maximumPageEndpoints = Math.max(...maximum.graphPages.map((page) => page.connectorEndpointIds.length));
  assert.equal(maximumPageEndpoints > REPORT_GRAPH_CONNECTOR_COLUMNS, true, "max-200 must exercise multiple compact connector rows");
  const maximumSideEndpoints = Math.max(...maximum.graphPages.flatMap((page) => {
    const endpoints = maximum.crossPageConnectorPairs
      .flatMap((pair) => [pair.outgoing, pair.incoming])
      .filter((endpoint) => endpoint.pageId === page.id);
    return ["top", "bottom"].map((side) => endpoints.filter((endpoint) => endpoint.side === side).length);
  }));
  assert.equal(maximumSideEndpoints > REPORT_GRAPH_CONNECTOR_COLUMNS * 3, true, "max-200 must exercise high-density multirow route lanes");
  assert.equal(maximumSideEndpoints <= REPORT_GRAPH_CONNECTOR_COLUMNS * REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE, true);
  for (const page of maximum.graphPages) {
    const geometry = reportGraphConnectorPageGeometry(maximum, page.id);
    assert.equal(Math.max(0, ...geometry.endpoints.map((endpoint) => endpoint.row)), Math.max(0, Math.ceil(Math.max(
      geometry.endpoints.filter((endpoint) => endpoint.side === "top").length,
      geometry.endpoints.filter((endpoint) => endpoint.side === "bottom").length,
    ) / REPORT_GRAPH_CONNECTOR_COLUMNS) - 1));
  }
});

test("Bhopal pagination retains matched connector pairs and obstacle-free serialized routes", () => {
  const input = structuredClone(fixture("bhopal-en").input);
  input.nodes = input.nodes.map((node) => ({ ...node, detail: ((node.detail + " ").repeat(4)).trim() }));
  const layout = buildReportGraphLayout(input);
  assert.equal(layout.graphPages.length > 1, true);
  assert.equal(layout.crossPageConnectorPairs.length > 0, true);
  assertStructuralContract(input, layout);
  const endpointIds = new Set(layout.graphPages.flatMap((page) => page.connectorEndpointIds));
  for (const pair of layout.crossPageConnectorPairs) {
    assert.equal(endpointIds.has(pair.outgoing.id), true);
    assert.equal(endpointIds.has(pair.incoming.id), true);
    assert.equal(pair.outgoing.targetPageId, pair.incoming.pageId);
    assert.equal(pair.incoming.targetPageId, pair.outgoing.pageId);
  }
});

test("maximum permitted report identity wraps into a measured repeating header without clipping", () => {
  const input = structuredClone(fixture("cyclic-repair-en").input);
  input.caseRef.title = "W".repeat(200);
  input.caseRef.id = "case_" + "w".repeat(135);
  input.caseRef.version = "9".repeat(40);
  input.profileRef.id = "profile_" + "w".repeat(92);
  input.profileRef.kind = "kind_" + "w".repeat(95);
  const layout = buildReportGraphLayout(input);
  assert.equal(layout.headerLayout.reportTitle.lines.length > 1, true);
  assert.equal(layout.headerLayout.identity.lines.length > 1, true);
  assert.equal(layout.headerFrame.y + layout.headerFrame.height < layout.graphFrame.y, true);
  assert.equal(boxContains(layout.printableFrame, layout.headerFrame), true);
  const headerLines = [
    ...layout.headerLayout.reportTitle.lines,
    ...layout.headerLayout.sectionTitle.lines,
    ...layout.headerLayout.identity.lines,
  ];
  assert.equal(headerLines.every((line) => line.width <= layout.headerFrame.width), true);
  for (const page of layout.graphPages) {
    assert.equal(page.pageLine.width <= layout.headerFrame.width, true);
    const svg = caseReportGraphLayoutSvg(layout, page.id, "en");
    for (const line of [...headerLines, page.pageLine]) {
      assert.equal(svg.includes(">" + line.text + "</text>"), true, "renderer omitted measured header line: " + line.text);
    }
  }
});

test("English and Russian wrapping preserves governed Roboto combining sequences", () => {
  const title = ("Cafe\u0301 evidence ").repeat(10).trim();
  for (const language of ["en", "ru"] as const) {
    const input = structuredClone(fixture("cyclic-repair-en").input);
    input.presentation.language = language;
    input.caseRef.title = title;
    input.nodes[0].title = title;
    const layout = buildReportGraphLayout(input);
    const node = layout.nodes.find((candidate) => candidate.id === input.nodes[0].id) ?? assert.fail("Unicode node missing");
    assert.equal(node.text.title.lines.length > 1, true);
    for (const lines of [layout.headerLayout.reportTitle.lines, node.text.title.lines]) {
      assert.equal(lines.map((line) => line.text.replaceAll(" ", "")).join(""), title.replaceAll(" ", ""));
      for (const line of lines) {
        assert.doesNotMatch(line.text, /^\p{M}/u, "line begins with a combining continuation");
      }
    }
  }
});

test("scalars absent from the governed Roboto cmaps fail closed with precise context", () => {
  for (const [unsupported, expectedCodePoint] of [
    ["\u0915", "U+0915"],
    ["\u200d", "U+200D"],
    ["\u1100", "U+1100"],
    ["\u{1f469}", "U+1F469"],
  ] as const) {
    const input = structuredClone(fixture("cyclic-repair-en").input);
    input.nodes[0].title = "Unsupported " + unsupported;
    assert.throws(() => buildReportGraphLayout(input), (error: unknown) => {
      assert.ok(error instanceof ReportGraphLayoutError);
      assert.equal(error.code, "INPUT_INVALID");
      assert.equal(error.context.codePoint, expectedCodePoint);
      assert.equal(error.context.field, `node ${input.nodes[0].id} title`);
      return true;
    });
  }
});

test("pinned UAX #29 Hangul GB6-8 rules retain L, V, T, LV and LVT sequences", () => {
  const joinedVectors = [
    "\u1100\u1100\u1161\u11a8",
    "\ua960\ud7b0\ud7cb",
    "\uac00\u1161\u11a8",
    "\uac01\u11a8",
  ];
  for (const value of joinedVectors) assert.deepEqual(reportGraphGraphemeClusters(value), [value]);
  assert.deepEqual(reportGraphGraphemeClusters("\u1100\u11a8"), ["\u1100", "\u11a8"]);
  assert.deepEqual(reportGraphGraphemeClusters("\u1161\u1100"), ["\u1161", "\u1100"]);
  assert.deepEqual(reportGraphGraphemeClusters("\u11a8\u1161"), ["\u11a8", "\u1161"]);
  assert.deepEqual(reportGraphGraphemeClusters("\u0915\u094d\u0937"), ["\u0915\u094d\u0937"]);
});

test("XML 1.0-disallowed controls and Unicode noncharacters fail before SVG serialization", () => {
  for (const invalid of ["\u0000", "\u000b", "\ufffe", "\ufdd0", "\u{1fffe}"]) {
    const input = structuredClone(fixture("cyclic-repair-en").input);
    input.nodes[0].title = "Invalid" + invalid + "text";
    assert.throws(
      () => buildReportGraphLayout(input),
      (error: unknown) => error instanceof ReportGraphLayoutError && error.code === "INPUT_INVALID",
      "accepted XML-invalid scalar U+" + (invalid.codePointAt(0) as number).toString(16).toUpperCase(),
    );
  }
  const allowed = structuredClone(fixture("cyclic-repair-en").input);
  allowed.nodes[0].detail = "TAB\tLF\nCR\rallowed";
  assert.doesNotThrow(() => buildReportGraphLayout(allowed));
});

test("exact governed Roboto bounds dominate fontkit shaping and positioned ink at every graph type size", () => {
  const typography = buildReportGraphLayout(fixture("cyclic-repair-en").input).typography;
  const sizes = [...new Set([
    ...Object.values(typography.styles).map((style) => style.sizeMilliPoints),
    REPORT_GRAPH_CONNECTOR_ID_SIZE_MILLI_POINTS,
    REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS,
    5_800,
  ])];
  const vectors = [
    "rt".repeat(100),
    "rt".repeat(2_000),
    ("r\u0301t").repeat(80),
    ("j\u0301rt").repeat(80),
    ("\u03d2\u0301").repeat(80),
    ("r\u200bt").repeat(80),
  ];
  for (const fontKey of ["regular", "medium"] as const) {
    for (const value of vectors) {
      assert.equal(reportGraphGovernedTextIssue(value), null, `${fontKey} oracle vector is not governed`);
      for (const sizeMilliPoints of sizes) {
        const measured = reportGraphMeasuredTextWidth(value, fontKey, sizeMilliPoints);
        const actual = actualPositionedRunWidth(fontKey, value, sizeMilliPoints);
        assert.equal(
          measured >= actual,
          true,
          `${fontKey} ${sizeMilliPoints}mp exact bound ${measured}µm is below fontkit positioned ink ${actual}µm`,
        );
      }
    }
  }
  assert.equal(governedFontMetrics.fonts.regular.maxPositiveShapingAdjustments[String("r".codePointAt(0))], 50);
  assert.equal(governedFontMetrics.fonts.medium.maxPositiveShapingAdjustments[String("r".codePointAt(0))], 50);
});

test("positive-kerning title wrapping and SVG anchors preserve exact Medium ink inside the card", () => {
  const input = structuredClone(fixture("cyclic-repair-en").input);
  input.nodes[0].title = "rt".repeat(100);
  const layout = buildReportGraphLayout(input);
  const node = layout.nodes.find((candidate) => candidate.id === input.nodes[0].id) ?? assert.fail("kerning node missing");
  const contentWidth = node.box.width - layout.nodeGeometry.paddingX * 2;
  assert.equal(node.text.title.lines.length > 1, true);
  for (const line of node.text.title.lines) {
    assert.equal(line.width <= contentWidth, true);
    assert.equal(actualPositionedRunWidth("medium", line.text, layout.typography.styles.title.sizeMilliPoints) <= contentWidth, true);
  }
  const svg = caseReportGraphLayoutSvg(layout, node.pageId, "en");
  const expectedTextX = node.box.x + layout.nodeGeometry.paddingX + layout.typography.styles.title.inkLeft;
  assert.match(svg, new RegExp(`<text x="${expectedTextX}"[^>]*>${node.text.title.lines[0].text}</text>`));
});

test("fixed connector labels fit their boxes with exact Medium shaped ink at the accessible size", () => {
  const metric = governedFontMetrics.fonts.medium;
  const face = governedFaces.medium;
  const scale = REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS * 25_400 / (metric.unitsPerEm * 72_000);
  const marker = face.layout("C999");
  const markerInkLeft = (marker.bbox.minX - marker.advanceWidth / 2) * scale;
  const markerInkRight = (marker.bbox.maxX - marker.advanceWidth / 2) * scale;
  assert.equal(markerInkLeft >= -REPORT_GRAPH_CONNECTOR_MARKER_RADIUS, true);
  assert.equal(markerInkRight <= REPORT_GRAPH_CONNECTOR_MARKER_RADIUS, true);
  for (const value of ["OUT G999", "IN G999", "N999"]) {
    const run = face.layout(value);
    assert.equal(REPORT_GRAPH_CONNECTOR_LABEL_X_OFFSET + run.bbox.minX * scale >= 0, true);
    assert.equal(REPORT_GRAPH_CONNECTOR_LABEL_X_OFFSET + run.bbox.maxX * scale <= REPORT_GRAPH_CONNECTOR_LABEL_WIDTH, true);
  }
});

test("renderer maps every modeled Medium run to pdfmake bold and keeps Regular runs normal", () => {
  const layout = buildReportGraphLayout(fixture("bhopal-en").input);
  const page = layout.graphPages.find((candidate) => candidate.connectorEndpointIds.length > 0) ?? layout.graphPages[0];
  const svg = caseReportGraphLayoutSvg(layout, page.id, "en");
  assert.match(svg, /font-weight="bold" data-font-face="Roboto-Medium"/);
  assert.match(svg, /font-weight="normal" data-font-face="Roboto-Regular"/);
  assert.doesNotMatch(svg, /font-weight="500"/);
});

test("exact-face unsafe pairs and stacked GDEF marks fail closed before fontkit or SVG", () => {
  const unsafePair = governedFontMetrics.fonts.regular.unsafeShapingPairs[0] ?? assert.fail("unsafe-pair proof is empty");
  const [left, right] = unsafePair.split(",").map(Number);
  assert.deepEqual(reportGraphGovernedTextIssue(String.fromCodePoint(left, right)), {
    codePoint: `U+${left.toString(16).toUpperCase().padStart(4, "0")}/U+${right.toString(16).toUpperCase().padStart(4, "0")}`,
    reason: "SHAPING_UNSAFE",
  });
  assert.deepEqual(reportGraphGovernedTextIssue("\u00c6\u0300\u0323"), {
    codePoint: "GDEF_CLASS_3_STACK",
    reason: "SHAPING_UNSAFE_MARK_STACK",
  });
  assert.equal(reportGraphGovernedTextIssue("A\u0301"), null);
});

test("detail cards grow past four lines, then use dedicated width before exceptional register deferral", () => {
  const ordinaryInput = structuredClone(fixture("cyclic-repair-en").input);
  ordinaryInput.nodes[0].detail = "Line one\nLine two\nLine three\nLine four";
  const ordinary = buildReportGraphLayout(ordinaryInput);
  const ordinaryNode = ordinary.nodes.find((node) => node.id === ordinaryInput.nodes[0].id) ?? assert.fail("ordinary detail node missing");
  assert.equal(ordinaryNode.text.detail.allLineCount, 4);
  assert.equal(ordinaryNode.text.detail.displayedLines.length, 4);
  assert.equal(ordinaryNode.text.detail.omitted, false);
  assert.equal(ordinaryNode.text.detail.referenceLine, null);

  const dedicatedInput = structuredClone(fixture("cyclic-repair-en").input);
  dedicatedInput.nodes[0].detail = "Measured evidence detail remains in the card when dedicated width makes the complete wrapped record fit. ".repeat(38).trim();
  const dedicated = buildReportGraphLayout(dedicatedInput);
  const dedicatedNode = dedicated.nodes.find((node) => node.id === dedicatedInput.nodes[0].id) ?? assert.fail("dedicated detail node missing");
  assert.equal(dedicatedNode.dedicatedPage, true);
  assert.equal(dedicatedNode.box.width, dedicated.graphFrame.width);
  assert.equal(dedicatedNode.text.detail.allLineCount > 4, true);
  assert.equal(dedicatedNode.text.detail.displayedLines.length, dedicatedNode.text.detail.allLineCount);
  assert.equal(dedicatedNode.text.detail.omitted, false);

  const exceptionalInput = structuredClone(fixture("cyclic-repair-en").input);
  exceptionalInput.nodes[0].detail = `${"A\n".repeat(1_999)}A`;
  const exceptional = buildReportGraphLayout(exceptionalInput);
  const exceptionalNode = exceptional.nodes.find((node) => node.id === exceptionalInput.nodes[0].id) ?? assert.fail("exceptional detail node missing");
  assert.equal(exceptionalNode.dedicatedPage, true);
  assert.equal(exceptionalNode.box.width, exceptional.graphFrame.width);
  assert.equal(exceptionalNode.text.detail.omitted, true);
  assert.equal(exceptionalNode.text.detail.fullDetailReference, `Full detail: ${exceptionalNode.ref}`);
  assert.equal(exceptionalNode.text.detail.displayedLines.length < exceptionalNode.text.detail.allLineCount, true);
});

test("a node that cannot fit even a dedicated full-width page fails closed with precise bounds", () => {
  const input = structuredClone(fixture("cyclic-repair-en").input);
  input.nodes[0].title = `${"A\n".repeat(99)}A`;
  assert.throws(() => buildReportGraphLayout(input), (error: unknown) => {
    assert.ok(error instanceof ReportGraphLayoutError);
    assert.equal(error.code, "NODE_EXCEEDS_PRINTABLE_FRAME");
    assert.equal(error.context.nodeId, input.nodes[0].id);
    assert.equal(typeof error.context.requiredHeight, "number");
    assert.equal(typeof error.context.availableHeight, "number");
    return true;
  });
});

test("StudioDraft helper preserves exact model references and applies only model-bound redactions", () => {
  const draft: StudioDraft = {
    caseId: "layout_helper",
    version: "1.0.0",
    parent: null,
    title: "Layout helper case",
    jurisdiction: "England and Wales",
    role: "Legal adviser",
    premise: "A bounded helper fixture.",
    nodes: [
      { detail: "Start detail", id: "start", title: "Start", type: "trigger", x: 0, y: 0 },
      { detail: "Private detail", id: "private", title: "Private", type: "evidence", x: 0, y: 0 },
      { detail: "End detail", id: "end", title: "End", type: "outcome", x: 0, y: 0 },
    ],
    links: [
      { from: "start", id: "helper_01", rule: { label: "Review", guards: [{ comparison: "gte", metric: "evidence", value: 40 }] }, to: "private" },
      { from: "private", id: "helper_02", rule: { result: "Complete" }, to: "end" },
    ],
    editHistory: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  const model = buildCanonicalReportModel(draft, {
    audience: "internal",
    confidential: true,
    currentFingerprint: "sha256-current",
    preparedBy: "Reviewer",
    preparedFor: "Client",
    profileId: "decision_memorandum",
    redactedNodeIds: ["private"],
    reviewerApproved: false,
    reviewerName: "",
    status: "draft",
    workspaceFingerprint: null,
  });
  const originalFingerprint = model.contentFingerprint;
  const input = deriveReportGraphLayoutInput(draft, model, { language: "en", redactedNodeIds: ["private"] });
  assert.equal(input.reportRef.contentFingerprint, originalFingerprint);
  assert.equal(input.caseRef.fingerprint, model.case.fingerprint);
  assert.equal(input.profileRef.id, model.profile.id);
  assert.deepEqual(input.nodes.map((node) => node.id), ["end", "start"]);
  assert.deepEqual(input.edges, []);
  assert.deepEqual(input.presentation, { language: "en", redactedNodeIds: ["private"], sourceEdgeCount: 2, sourceNodeCount: 3 });
  const layout = buildReportGraphLayout(input);
  assert.equal(layout.reportRef.contentFingerprint, originalFingerprint);
  assert.equal(model.contentFingerprint, originalFingerprint, "layout must never alter the ReportModel fingerprint");
  assert.throws(() => deriveReportGraphLayoutInput(draft, model, { language: "en", redactedNodeIds: [] }), (error: unknown) => error instanceof ReportGraphLayoutError && error.code === "REFERENCE_MISMATCH");
});

test("committed advances are generated from the exact pdfmake Roboto VFS bytes", () => {
  assert.equal(governedFontMetrics.format, "genesis-juris-report-graph-font-metrics");
  assert.equal(governedFontMetrics.schemaVersion, 1);
  assert.equal(governedFontMetrics.unitPerEm, 2_048);
  assert.equal(governedFontMetrics.source.package, "pdfmake");
  assert.equal(governedFontMetrics.source.version, "0.2.20");
  assert.deepEqual(governedFontMetrics.fonts.regular.maximumInkOverhang, { left: 1_510, right: 438 });
  assert.deepEqual(governedFontMetrics.fonts.medium.maximumInkOverhang, { left: 1_498, right: 450 });
  for (const fontKey of ["regular", "medium"] as const) {
    const font = governedFontMetrics.fonts[fontKey];
    const bytes = Buffer.from(governedVfs[font.sourceFile], "base64");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sourceSha256);
    assert.equal(fixtures.fontSourceHashes[fontKey], font.sourceSha256);
    assert.equal(font.unitsPerEm, 2_048);
    assert.equal(font.maximumPositiveShapingAdjustment, 100);
    assert.equal(font.unsafeShapingPairs.length, 362);
    assert.equal(font.gdefMarkCodePoints.length, 10);
    assert.equal(font.unsafeShapingTripleOracleThrows, 4_682);
    assert.equal(Number.isInteger(font.advances[String("Ж".codePointAt(0))]), true, "Cyrillic advance must be committed");
  }
});
