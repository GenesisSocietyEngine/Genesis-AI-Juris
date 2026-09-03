import rawFontMetrics from "./report-graph-font-metrics.v1.json";
import { canonicalFingerprint, caseFingerprint } from "./case-integrity";
import type { CanonicalReportModel } from "./report-model";
import type { MetricKey, StudioDraft, StudioLink, StudioNodeType } from "./types";
import {
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
} from "./report-graph-contract";

export {
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
} from "./report-graph-contract";

export const REPORT_GRAPH_FIXED_UNIT = "micrometre" as const;
export const REPORT_GRAPH_MAX_NODES = 200;
export const REPORT_GRAPH_MAX_EDGES = 500;
export const REPORT_GRAPH_MAX_PORTRAIT_LANES = 3;

const PAPER = { height: 297_000, orientation: "portrait" as const, unit: REPORT_GRAPH_FIXED_UNIT, width: 210_000 };
const PRINTABLE_FRAME = { height: 269_000, width: 182_000, x: 14_000, y: 14_000 };
const HEADER_FRAME_ORIGIN = { width: 182_000, x: 14_000, y: 14_000 };
const HEADER_PADDING_Y = 1_500;
const HEADER_GROUP_GAP = 800;
const HEADER_GRAPH_GAP = 4_000;
const GRAPH_FRAME_BOTTOM = 269_000;
const MAX_GRAPH_FRAME_HEIGHT = 238_000;
const FOOTER_FRAME = { height: 9_000, width: 182_000, x: 14_000, y: 274_000 };
export const REPORT_GRAPH_CONNECTOR_CELL_WIDTH = 26_000;
export const REPORT_GRAPH_CONNECTOR_ROW_HEIGHT = 11_000;
export const REPORT_GRAPH_CONNECTOR_NODE_GAP = 3_000;
export const REPORT_GRAPH_CONNECTOR_MARKER_RADIUS = 2_800;
export const REPORT_GRAPH_CONNECTOR_MARKER_LABEL_GAP = 600;
export const REPORT_GRAPH_CONNECTOR_LABEL_WIDTH = 10_600;
export const REPORT_GRAPH_CONNECTOR_LABEL_HEIGHT = 9_000;
export const REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS = 6_200;
export const REPORT_GRAPH_CONNECTOR_ID_SIZE_MILLI_POINTS = REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS;
export const REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS = REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS;
export const REPORT_GRAPH_CONNECTOR_ID_BASELINE_OFFSET = 700;
export const REPORT_GRAPH_CONNECTOR_REFERENCE_PRIMARY_BASELINE_OFFSET = 3_400;
export const REPORT_GRAPH_CONNECTOR_REFERENCE_SECONDARY_BASELINE_OFFSET = 7_400;
export const REPORT_GRAPH_CONNECTOR_LABEL_X_OFFSET = 400;
export const REPORT_GRAPH_CONNECTOR_MARKER_CENTER_X_OFFSET = 14_400;
export const REPORT_GRAPH_CONNECTOR_ROUTE_LANE_X_OFFSET = 18_800;
export const REPORT_GRAPH_CONNECTOR_ROUTE_LANE_STEP = 1_000;
export const REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE = 7;
export const REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH = 600;
export const REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH = 400;
export const REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH = 600;
export const REPORT_GRAPH_NODE_STROKE_WIDTH = 500;
export const REPORT_GRAPH_ROUTE_CLEARANCE = 1_000;
const REPORT_GRAPH_ROUTE_BEND_PENALTY = 250;
export const REPORT_GRAPH_CONNECTOR_COLUMNS = Math.floor(PRINTABLE_FRAME.width / REPORT_GRAPH_CONNECTOR_CELL_WIDTH);
const STANDARD_NODE_WIDTH = 56_000;
const LANE_GAP = 7_000;
const LAYER_GAP = 7_000;
const NODE_PADDING_X = 3_500;
const NODE_PADDING_Y = 3_500;
const BADGE_TITLE_GAP = 1_800;
const TITLE_DETAIL_GAP = 2_000;
const MAX_DETAIL_VISUAL_LINES = Math.floor((
  MAX_GRAPH_FRAME_HEIGHT
  - NODE_PADDING_Y * 2
  - 3_000
  - BADGE_TITLE_GAP
  - 4_000
  - TITLE_DETAIL_GAP
) / 3_300);
const FINGERPRINT_KIND = "genesis-juris-report-graph-layout";
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const FINGERPRINT_PATTERN = /^sha256-[a-f0-9]{64}$/;
const METRIC_KEYS: MetricKey[] = ["evidence", "exposure", "position", "trust"];
export const REPORT_GRAPH_GRAPHEME_BREAK_CONTRACT = {
  rules: ["GB6", "GB7", "GB8", "Extend", "ZWJ", "Virama", "Regional_Indicator_pair"] as const,
  scope: "Governed-font deterministic subset; not a complete UAX #29 extended-grapheme implementation",
  unicodeVersion: "17.0.0",
  uax29Revision: 47,
} as const;

type FontKey = "regular" | "medium";
type FontMetric = {
  advances: Record<string, number>;
  defaultAdvance: number;
  gdefMarkCodePoints: number[];
  mappedCodePointCount: number;
  maxPositiveShapingAdjustments: Record<string, number>;
  maximumInkOverhang: { left: number; right: number };
  maximumPositiveShapingAdjustment: number;
  postScriptName: string;
  sourceByteLength: number;
  sourceFile: string;
  sourceSha256: string;
  sourceVfsPath: string;
  unitsPerEm: number;
  unsafeShapingPairs: string[];
  unsafeShapingTripleOracleThrows: number;
};
type FontMetricsArtifact = {
  format: string;
  schemaVersion: number;
  unitPerEm: number;
  advanceNormalization: string;
  advanceSemantics: string;
  unicodeKeys: string;
  fallback: string;
  source: { package: string; parser: string; parserVersion: string; version: string; vfsModule: string };
  fonts: Record<FontKey, FontMetric>;
};

const FONT_METRICS = rawFontMetrics as FontMetricsArtifact;
const GOVERNED_FONT_FACE_CONTRACT = {
  medium: {
    byteLength: 152_776,
    ink: { left: 1_498, right: 450 },
    positiveAdjustmentCount: 220,
    postScriptName: "Roboto-Medium",
    sha256: "79a763229b01229cfd921a9a0108e58c162d045d828037e32c6fb85ed6f914be",
  },
  regular: {
    byteLength: 152_588,
    ink: { left: 1_510, right: 438 },
    positiveAdjustmentCount: 219,
    postScriptName: "Roboto-Regular",
    sha256: "a93f6bc56ef0349a4426b717c182482bb878534f31077ae5e1b2b4dae7a089d1",
  },
} as const;
const GOVERNED_UNSAFE_SHAPING_PAIR_SETS = [
  new Set(FONT_METRICS.fonts.regular.unsafeShapingPairs),
  new Set(FONT_METRICS.fonts.medium.unsafeShapingPairs),
] as const;
const GOVERNED_GDEF_MARK_CODE_POINTS = new Set([
  ...FONT_METRICS.fonts.regular.gdefMarkCodePoints,
  ...FONT_METRICS.fonts.medium.gdefMarkCodePoints,
]);

export type ReportGraphLanguage = "en" | "ru";

export type ReportGraphLayoutInput = {
  caseRef: {
    fingerprint: string;
    id: string;
    title: string;
    version: string;
  };
  edges: Array<{
    annotations: string[];
    detail: string;
    from: string;
    id: string;
    label: string;
    result: string;
    to: string;
  }>;
  nodes: Array<{
    detail: string;
    id: string;
    title: string;
    type: StudioNodeType;
  }>;
  presentation: {
    language: ReportGraphLanguage;
    redactedNodeIds: string[];
    sourceEdgeCount: number;
    sourceNodeCount: number;
  };
  profileRef: {
    id: string;
    kind: string;
  };
  reportRef: {
    contentFingerprint: string;
    modelRendererVersion: string;
    modelSchemaVersion: number;
  };
};

export type ReportGraphBox = { height: number; width: number; x: number; y: number };
export type ReportGraphPoint = { x: number; y: number };
export type ReportGraphTextLine = { text: string; width: number };
export type ReportGraphConnectorSide = "bottom" | "top";
export type ReportGraphConnectorEndpointGeometry = {
  cellBox: ReportGraphBox;
  column: number;
  direction: "IN" | "OUT";
  directionPageBaseline: ReportGraphPoint;
  endpointId: string;
  labelBox: ReportGraphBox;
  labelInkBox: ReportGraphBox;
  markerBox: ReportGraphBox;
  markerInkBox: ReportGraphBox;
  markerCenter: ReportGraphPoint;
  markerPort: ReportGraphPoint;
  pathPort: ReportGraphPoint;
  row: number;
  side: ReportGraphConnectorSide;
  gutterExitPort: ReportGraphPoint;
  routeLaneX: number;
  targetNodeRef: string;
  targetPageId: string;
  targetNodeBaseline: ReportGraphPoint;
};
export type ReportGraphConnectorPageGeometry = {
  bottomGutter: ReportGraphBox;
  endpoints: ReportGraphConnectorEndpointGeometry[];
  nodeFrame: ReportGraphBox;
  topGutter: ReportGraphBox;
};
export type ReportGraphConnectorEndpoint = ReportGraphConnectorEndpointGeometry & {
  anchor: ReportGraphPoint;
  id: string;
  nodeId: string;
  nodeRef: string;
  pageId: string;
  routePoints: ReportGraphPoint[];
};

export type ReportGraphLayoutNode = {
  box: ReportGraphBox;
  componentId: string;
  dedicatedPage: boolean;
  id: string;
  lane: number;
  layoutLayerId: string;
  pageId: string;
  ref: string;
  text: {
    badge: ReportGraphTextLine;
    detail: {
      allLineCount: number;
      displayedLines: ReportGraphTextLine[];
      fullDetailReference: string | null;
      fullText: string;
      omitted: boolean;
      referenceLine: ReportGraphTextLine | null;
    };
    textHeight: number;
    title: {
      fullText: string;
      lines: ReportGraphTextLine[];
    };
  };
  topologyLayerId: string;
  type: StudioNodeType;
};

export type ReportGraphLayoutModel = {
  adjacencyTextRecords: Array<{
    annotations: string[];
    detail: string;
    edgeId: string;
    fromNodeRef: string;
    id: string;
    label: string;
    result: string;
    text: string;
    toNodeRef: string;
  }>;
  caseRef: ReportGraphLayoutInput["caseRef"];
  components: Array<{
    cyclic: boolean;
    id: string;
    nodeIds: string[];
    rootNodeIds: string[];
    terminalNodeIds: string[];
  }>;
  connectorTextRecords: Array<{
    accessibleText: string;
    adjacencyRecordId: string;
    annotations: string[];
    connectorId: string;
    detail: string;
    edgeId: string;
    fromNodeRef: string;
    fromPageId: string;
    id: string;
    inText: string;
    label: string;
    outText: string;
    result: string;
    text: string;
    toNodeRef: string;
    toPageId: string;
  }>;
  crossPageConnectorPairs: Array<{
    adjacencyRecordId: string;
    edgeId: string;
    fromPageId: string;
    id: string;
    incoming: ReportGraphConnectorEndpoint;
    outgoing: ReportGraphConnectorEndpoint;
    toPageId: string;
  }>;
  cyclicRepairs: Array<{
    componentId: string;
    id: string;
    ignoredIncomingEdgeIds: string[];
    promotedNodeId: string;
  }>;
  edges: Array<{
    connectorId: string | null;
    cyclicRepair: boolean;
    fromNodeId: string;
    fromNodeRef: string;
    fromPageId: string;
    id: string;
    samePageSegmentId: string | null;
    toNodeId: string;
    toNodeRef: string;
    toPageId: string;
  }>;
  fixedPoint: {
    description: string;
    millimetre: number;
    unit: typeof REPORT_GRAPH_FIXED_UNIT;
  };
  footerFrame: ReportGraphBox;
  graphFrame: ReportGraphBox;
  graphPages: Array<{
    connectorEndpointIds: string[];
    edgeSegmentIds: string[];
    headerText: string;
    id: string;
    layerIds: string[];
    nodeIds: string[];
    number: number;
    pageLine: ReportGraphTextLine;
  }>;
  headerLayout: {
    contentHeight: number;
    groupGap: number;
    identity: { fullText: string; lines: ReportGraphTextLine[] };
    paddingY: number;
    reportTitle: { fullText: string; lines: ReportGraphTextLine[] };
    sectionTitle: { fullText: string; lines: ReportGraphTextLine[] };
  };
  headerFrame: ReportGraphBox;
  layoutAlgorithmVersion: typeof REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION;
  layoutFingerprint: string;
  layoutLayers: Array<{
    box: ReportGraphBox;
    componentId: string;
    dedicatedPage: boolean;
    height: number;
    id: string;
    nodeIds: string[];
    pageId: string;
    subLayer: number;
    topologyLayerId: string;
    y: number;
  }>;
  layoutRendererVersion: typeof REPORT_GRAPH_LAYOUT_RENDERER_VERSION;
  layoutSchemaVersion: typeof REPORT_GRAPH_LAYOUT_SCHEMA_VERSION;
  nodeTextRecords: Array<{
    detail: string;
    id: string;
    nodeId: string;
    text: string;
    title: string;
    type: StudioNodeType;
  }>;
  nodeGeometry: {
    badgeTitleGap: number;
    dedicatedWidth: number;
    laneGap: number;
    layerGap: number;
    maxDetailVisualLines: number;
    maxPortraitLanes: number;
    paddingX: number;
    paddingY: number;
    standardWidth: number;
    titleDetailGap: number;
  };
  nodes: ReportGraphLayoutNode[];
  pageOrder: Array<{
    id: string;
    kind: "graph" | "register";
    register: "adjacency" | "connectors" | "nodes" | "summary" | null;
  }>;
  paper: typeof PAPER;
  presentation: ReportGraphLayoutInput["presentation"];
  printableFrame: ReportGraphBox;
  profileRef: ReportGraphLayoutInput["profileRef"];
  registers: {
    adjacency: { id: string; recordIds: string[] };
    connectors: { id: string; recordIds: string[] };
    nodes: { id: string; recordIds: string[] };
    summary: { id: string; recordIds: string[] };
  };
  reportRef: ReportGraphLayoutInput["reportRef"];
  samePageEdgeSegments: Array<{
    cyclicRepair: boolean;
    edgeId: string;
    fromPoint: ReportGraphPoint;
    fromNodeId: string;
    id: string;
    pageId: string;
    routePoints: ReportGraphPoint[];
    toPoint: ReportGraphPoint;
    toNodeId: string;
  }>;
  summary: {
    componentCount: number;
    disconnected: boolean;
    rootNodeIds: string[];
    rootNodeRefs: string[];
    terminalNodeIds: string[];
    terminalNodeRefs: string[];
    text: string;
  };
  topologyLayers: Array<{
    componentId: string;
    id: string;
    index: number;
    nodeIds: string[];
    subLayerIds: string[];
  }>;
  typography: {
    advanceNormalization: string;
    advanceSemantics: string;
    fontFamily: "Roboto";
    fontMetricSchemaVersion: number;
    fontSourceHashes: { medium: string; regular: string };
    graphemeBreak: typeof REPORT_GRAPH_GRAPHEME_BREAK_CONTRACT;
    metricUnitsPerEm: number;
    styles: Record<"badge" | "detail" | "detailReference" | "footer" | "header" | "title", {
      font: FontKey;
      inkLeft: number;
      inkRight: number;
      lineHeight: number;
      sizeMilliPoints: number;
    }>;
  };
};

export type ReportGraphLayoutErrorCode =
  | "FONT_METRICS_INVALID"
  | "INPUT_INVALID"
  | "NODE_EXCEEDS_PRINTABLE_FRAME"
  | "REFERENCE_MISMATCH";

export class ReportGraphLayoutError extends Error {
  readonly code: ReportGraphLayoutErrorCode;
  readonly context: Readonly<Record<string, number | string>>;

  constructor(code: ReportGraphLayoutErrorCode, message: string, context: Record<string, number | string> = {}) {
    super(message);
    this.name = "ReportGraphLayoutError";
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}

function fontUnitsToMicrometres(fontUnits: number, font: FontMetric, sizeMilliPoints: number) {
  const numerator = BigInt(fontUnits) * BigInt(sizeMilliPoints) * BigInt(25_400);
  const denominator = BigInt(font.unitsPerEm) * BigInt(72_000);
  return Number((numerator + denominator - BigInt(1)) / denominator);
}

function typographyStyle(fontKey: FontKey, lineHeight: number, sizeMilliPoints: number) {
  const font = FONT_METRICS.fonts[fontKey];
  return {
    font: fontKey,
    inkLeft: fontUnitsToMicrometres(font.maximumInkOverhang.left, font, sizeMilliPoints),
    inkRight: fontUnitsToMicrometres(font.maximumInkOverhang.right, font, sizeMilliPoints),
    lineHeight,
    sizeMilliPoints,
  };
}

const TYPOGRAPHY: ReportGraphLayoutModel["typography"] = {
  advanceNormalization: FONT_METRICS.advanceNormalization,
  advanceSemantics: FONT_METRICS.advanceSemantics,
  fontFamily: "Roboto",
  fontMetricSchemaVersion: FONT_METRICS.schemaVersion,
  fontSourceHashes: {
    medium: FONT_METRICS.fonts.medium.sourceSha256,
    regular: FONT_METRICS.fonts.regular.sourceSha256,
  },
  graphemeBreak: REPORT_GRAPH_GRAPHEME_BREAK_CONTRACT,
  metricUnitsPerEm: FONT_METRICS.unitPerEm,
  styles: {
    badge: typographyStyle("medium", 3_000, 6_800),
    detail: typographyStyle("regular", 3_300, 7_200),
    detailReference: typographyStyle("medium", 3_200, 7_000),
    footer: typographyStyle("regular", 2_800, 6_200),
    header: typographyStyle("medium", 3_500, 7_600),
    title: typographyStyle("medium", 4_000, 9_000),
  },
};

const NODE_TYPE_LABELS: Record<ReportGraphLanguage, Record<StudioNodeType, string>> = {
  en: {
    actor: "ACTOR",
    cash_flow: "CASH FLOW",
    deadline: "DEADLINE",
    decision: "DECISION",
    entity: "ENTITY",
    evidence: "EVIDENCE",
    fact: "FACT",
    outcome: "OUTCOME",
    tax_rule: "TAX RULE",
    trigger: "TRIGGER",
  },
  ru: {
    actor: "УЧАСТНИК",
    cash_flow: "ДЕНЕЖНЫЙ ПОТОК",
    deadline: "СРОК",
    decision: "РЕШЕНИЕ",
    entity: "ОРГАНИЗАЦИЯ",
    evidence: "ДОКАЗАТЕЛЬСТВО",
    fact: "ФАКТ",
    outcome: "РЕЗУЛЬТАТ",
    tax_rule: "НАЛОГОВАЯ НОРМА",
    trigger: "СОБЫТИЕ",
  },
};

function fail(code: ReportGraphLayoutErrorCode, message: string, context: Record<string, number | string> = {}): never {
  throw new ReportGraphLayoutError(code, message, context);
}

function asciiCompare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

function hasUnpairedSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}

export type ReportGraphGovernedTextIssue = {
  codePoint: string;
  reason: "FONT_UNSUPPORTED" | "SHAPING_UNSAFE" | "SHAPING_UNSAFE_MARK_STACK" | "XML_INVALID";
};

export function reportGraphGovernedTextIssue(value: string): ReportGraphGovernedTextIssue | null {
  const scalars = [...value];
  for (const scalar of scalars) {
    const codePoint = scalar.codePointAt(0) as number;
    const codePointLabel = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    const xmlCharacter = codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    const noncharacter = (codePoint >= 0xfdd0 && codePoint <= 0xfdef)
      || (codePoint & 0xffff) === 0xfffe
      || (codePoint & 0xffff) === 0xffff;
    if (!xmlCharacter || noncharacter) return { codePoint: codePointLabel, reason: "XML_INVALID" };
    if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d) continue;
    const key = String(codePoint);
    if (!Object.hasOwn(FONT_METRICS.fonts.regular.advances, key)
      || !Object.hasOwn(FONT_METRICS.fonts.medium.advances, key)) {
      return { codePoint: codePointLabel, reason: "FONT_UNSUPPORTED" };
    }
  }
  for (let index = 1; index < scalars.length; index += 1) {
    const left = scalars[index - 1].codePointAt(0) as number;
    const right = scalars[index].codePointAt(0) as number;
    const pair = `${left},${right}`;
    if (GOVERNED_UNSAFE_SHAPING_PAIR_SETS.some((pairs) => pairs.has(pair))) {
      return {
        codePoint: `U+${left.toString(16).toUpperCase().padStart(4, "0")}/U+${right.toString(16).toUpperCase().padStart(4, "0")}`,
        reason: "SHAPING_UNSAFE",
      };
    }
  }
  for (const cluster of reportGraphGraphemeClusters(value)) {
    const markCount = [...cluster].filter((scalar) => GOVERNED_GDEF_MARK_CODE_POINTS.has(scalar.codePointAt(0) as number)).length;
    if (markCount >= 2) {
      return { codePoint: "GDEF_CLASS_3_STACK", reason: "SHAPING_UNSAFE_MARK_STACK" };
    }
  }
  return null;
}

function assertBoundedText(value: unknown, label: string, maximum: number, allowEmpty = true): asserts value is string {
  if (typeof value !== "string" || hasUnpairedSurrogate(value) || value.length > maximum || (!allowEmpty && !value.trim())) {
    fail("INPUT_INVALID", `${label} must be valid Unicode text of at most ${maximum} UTF-16 units`);
  }
  const issue = reportGraphGovernedTextIssue(value);
  if (issue) {
    const issueMessage = issue.reason === "XML_INVALID"
      ? "contains a character forbidden by the XML 1.0 report renderer"
      : issue.reason === "FONT_UNSUPPORTED"
        ? "contains a scalar absent from the governed Roboto fonts"
        : "contains a scalar sequence the governed Roboto shaper cannot safely render";
    fail("INPUT_INVALID", `${label} ${issueMessage}`, {
      codePoint: issue.codePoint,
      field: label,
      reason: issue.reason,
    });
  }
}

function assertInput(input: ReportGraphLayoutInput) {
  if (!input || typeof input !== "object") fail("INPUT_INVALID", "Report graph layout input is required");
  assertBoundedText(input.caseRef?.id, "caseRef.id", 140, false);
  assertBoundedText(input.caseRef?.version, "caseRef.version", 40, false);
  assertBoundedText(input.caseRef?.title, "caseRef.title", 200, false);
  if (!FINGERPRINT_PATTERN.test(input.caseRef?.fingerprint ?? "")) fail("INPUT_INVALID", "caseRef.fingerprint must be a canonical SHA-256 fingerprint");
  assertBoundedText(input.profileRef?.id, "profileRef.id", 100, false);
  assertBoundedText(input.profileRef?.kind, "profileRef.kind", 100, false);
  if (!Number.isInteger(input.reportRef?.modelSchemaVersion) || input.reportRef.modelSchemaVersion < 1) fail("INPUT_INVALID", "reportRef.modelSchemaVersion must be a positive integer");
  assertBoundedText(input.reportRef?.modelRendererVersion, "reportRef.modelRendererVersion", 40, false);
  if (!FINGERPRINT_PATTERN.test(input.reportRef?.contentFingerprint ?? "")) fail("INPUT_INVALID", "reportRef.contentFingerprint must be a canonical SHA-256 fingerprint");
  if (input.presentation?.language !== "en" && input.presentation?.language !== "ru") fail("INPUT_INVALID", "presentation.language must be en or ru");
  if (!Number.isInteger(input.presentation?.sourceNodeCount) || input.presentation.sourceNodeCount < 1 || input.presentation.sourceNodeCount > REPORT_GRAPH_MAX_NODES) fail("INPUT_INVALID", `presentation.sourceNodeCount must be between 1 and ${REPORT_GRAPH_MAX_NODES}`);
  if (!Number.isInteger(input.presentation?.sourceEdgeCount) || input.presentation.sourceEdgeCount < 0 || input.presentation.sourceEdgeCount > REPORT_GRAPH_MAX_EDGES) fail("INPUT_INVALID", `presentation.sourceEdgeCount must be between 0 and ${REPORT_GRAPH_MAX_EDGES}`);
  if (!Array.isArray(input.nodes) || input.nodes.length < 1 || input.nodes.length > REPORT_GRAPH_MAX_NODES || input.nodes.length > input.presentation.sourceNodeCount) fail("INPUT_INVALID", `nodes must contain between 1 and ${REPORT_GRAPH_MAX_NODES} visible nodes`);
  if (!Array.isArray(input.edges) || input.edges.length > REPORT_GRAPH_MAX_EDGES || input.edges.length > input.presentation.sourceEdgeCount) fail("INPUT_INVALID", `edges must contain at most ${REPORT_GRAPH_MAX_EDGES} visible relationships`);
  if (!Array.isArray(input.presentation.redactedNodeIds)) fail("INPUT_INVALID", "presentation.redactedNodeIds must be an array");
  const redactions = [...input.presentation.redactedNodeIds].sort(asciiCompare);
  if (new Set(redactions).size !== redactions.length || redactions.some((id, index) => !ID_PATTERN.test(id) || id !== input.presentation.redactedNodeIds[index])) fail("INPUT_INVALID", "redactedNodeIds must be unique, valid IDs in ASCII order");
  const nodeIds = new Set<string>();
  for (const node of input.nodes) {
    if (!ID_PATTERN.test(node.id) || nodeIds.has(node.id)) fail("INPUT_INVALID", `Invalid or duplicate node ID ${String(node.id)}`);
    nodeIds.add(node.id);
    if (!(node.type in NODE_TYPE_LABELS.en)) fail("INPUT_INVALID", `Unsupported node type ${String(node.type)}`);
    assertBoundedText(node.title, `node ${node.id} title`, 200, false);
    assertBoundedText(node.detail, `node ${node.id} detail`, 4_000);
  }
  if (redactions.some((id) => nodeIds.has(id))) fail("INPUT_INVALID", "A redacted node cannot remain in the visible node collection");
  const edgeIds = new Set<string>();
  for (const edge of input.edges) {
    if (!ID_PATTERN.test(edge.id) || edgeIds.has(edge.id)) fail("INPUT_INVALID", `Invalid or duplicate edge ID ${String(edge.id)}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) fail("INPUT_INVALID", `Edge ${edge.id} has an invalid endpoint`);
    assertBoundedText(edge.label, `edge ${edge.id} label`, 200);
    assertBoundedText(edge.detail, `edge ${edge.id} detail`, 4_000);
    assertBoundedText(edge.result, `edge ${edge.id} result`, 4_000);
    if (!Array.isArray(edge.annotations) || edge.annotations.length > 32) fail("INPUT_INVALID", `Edge ${edge.id} annotations are invalid`);
    for (const annotation of edge.annotations) assertBoundedText(annotation, `edge ${edge.id} annotation`, 4_000, false);
  }
  validateFontMetrics();
}

function validateFontMetrics() {
  if (FONT_METRICS.format !== "genesis-juris-report-graph-font-metrics"
    || FONT_METRICS.schemaVersion !== 1
    || FONT_METRICS.unitPerEm !== 2_048
    || FONT_METRICS.source.package !== "pdfmake"
    || FONT_METRICS.source.version !== "0.2.20"
    || FONT_METRICS.source.parserVersion !== "1.9.2") {
    fail("FONT_METRICS_INVALID", "Unsupported report graph font metrics artifact");
  }
  for (const key of ["regular", "medium"] as const) {
    const font = FONT_METRICS.fonts[key];
    const governed = GOVERNED_FONT_FACE_CONTRACT[key];
    if (!font
      || font.sourceSha256 !== governed.sha256
      || font.sourceByteLength !== governed.byteLength
      || font.postScriptName !== governed.postScriptName
      || font.unitsPerEm !== FONT_METRICS.unitPerEm
      || font.mappedCodePointCount !== 923
      || font.defaultAdvance !== 908
      || Object.keys(font.advances).length !== font.mappedCodePointCount
      || Object.values(font.advances).some((advance) => !Number.isInteger(advance) || advance < 0)
      || Object.keys(font.maxPositiveShapingAdjustments).length !== governed.positiveAdjustmentCount
      || Object.values(font.maxPositiveShapingAdjustments).some((adjustment) => !Number.isInteger(adjustment) || adjustment <= 0 || adjustment > 100)
      || !Number.isInteger(font.maximumPositiveShapingAdjustment)
      || font.maximumPositiveShapingAdjustment !== 100
      || !Number.isInteger(font.maximumInkOverhang.left)
      || !Number.isInteger(font.maximumInkOverhang.right)
      || font.maximumInkOverhang.left !== governed.ink.left
      || font.maximumInkOverhang.right !== governed.ink.right
      || !Array.isArray(font.gdefMarkCodePoints)
      || font.gdefMarkCodePoints.join(",") !== "768,769,771,777,783,803,1155,1156,1157,1158"
      || !Array.isArray(font.unsafeShapingPairs)
      || font.unsafeShapingPairs.length !== 362
      || font.unsafeShapingPairs.some((pair) => !/^\d+,\d+$/.test(pair))
      || font.unsafeShapingTripleOracleThrows !== 4_682) {
      fail("FONT_METRICS_INVALID", `Invalid ${key} font metrics`);
    }
  }
  if (REPORT_GRAPH_CONNECTOR_COLUMNS < 1 || PRINTABLE_FRAME.width % REPORT_GRAPH_CONNECTOR_CELL_WIDTH !== 0) {
    fail("FONT_METRICS_INVALID", "Connector cells must divide the graph frame exactly");
  }
  if (textWidth("C999", "medium", REPORT_GRAPH_CONNECTOR_ID_SIZE_MILLI_POINTS, false) > REPORT_GRAPH_CONNECTOR_MARKER_RADIUS * 2) {
    fail("FONT_METRICS_INVALID", "Connector pair ID exceeds its deterministic marker box");
  }
  if (textWidth("OUT G999", "medium", REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS, false) > REPORT_GRAPH_CONNECTOR_LABEL_WIDTH
    || textWidth("N999", "medium", REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS, false) > REPORT_GRAPH_CONNECTOR_LABEL_WIDTH) {
    fail("FONT_METRICS_INVALID", "Connector page or node reference exceeds its deterministic label box");
  }
  const markerInkRight = REPORT_GRAPH_CONNECTOR_MARKER_CENTER_X_OFFSET
    + REPORT_GRAPH_CONNECTOR_MARKER_RADIUS
    + Math.floor(REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH / 2);
  const routeHalfStroke = Math.floor(REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH / 2);
  const firstLaneInkLeft = REPORT_GRAPH_CONNECTOR_ROUTE_LANE_X_OFFSET - routeHalfStroke;
  const lastLaneInkRight = REPORT_GRAPH_CONNECTOR_ROUTE_LANE_X_OFFSET
    + (REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE - 1) * REPORT_GRAPH_CONNECTOR_ROUTE_LANE_STEP
    + routeHalfStroke;
  const nextCellLabelInkLeft = REPORT_GRAPH_CONNECTOR_CELL_WIDTH
    + REPORT_GRAPH_CONNECTOR_LABEL_X_OFFSET
    - Math.floor(REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH / 2);
  if (firstLaneInkLeft - markerInkRight < REPORT_GRAPH_ROUTE_CLEARANCE
    || nextCellLabelInkLeft - lastLaneInkRight < REPORT_GRAPH_ROUTE_CLEARANCE
    || REPORT_GRAPH_CONNECTOR_ROUTE_LANE_STEP < REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH) {
    fail("FONT_METRICS_INVALID", "Connector route lanes do not preserve deterministic ink clearance");
  }
}

function edgeAnnotations(link: StudioLink) {
  const annotations: string[] = [];
  const rule = link.rule;
  if (!rule) return annotations;
  if (rule.cost !== undefined) annotations.push(`cost=${rule.cost}`);
  if (rule.minutes !== undefined) annotations.push(`minutes=${rule.minutes}`);
  for (const key of METRIC_KEYS) if (rule.effects?.[key] !== undefined) annotations.push(`effect.${key}=${rule.effects[key]}`);
  for (const [index, guard] of (rule.guards ?? []).entries()) annotations.push(`guard.${pad(index + 1, 2)}=${guard.metric}:${guard.comparison}:${guard.value}`);
  if (rule.repeatability !== undefined) annotations.push(`repeatability=${rule.repeatability}`);
  if (rule.maxUses !== undefined) annotations.push(`maxUses=${rule.maxUses}`);
  return annotations;
}

export function deriveReportGraphLayoutInput(
  draft: StudioDraft,
  model: CanonicalReportModel,
  options: { language: ReportGraphLanguage; redactedNodeIds?: readonly string[] },
): ReportGraphLayoutInput {
  const currentCaseFingerprint = caseFingerprint(draft);
  if (model.case.id !== draft.caseId || model.case.version !== draft.version || model.case.fingerprint !== currentCaseFingerprint) {
    fail("REFERENCE_MISMATCH", "Canonical report case reference does not match the Studio draft", { caseId: draft.caseId });
  }
  const modelRedactions = [...model.governance.redactions].sort(asciiCompare);
  const requestedRedactions = [...(options.redactedNodeIds ?? modelRedactions)].sort(asciiCompare);
  if (new Set(requestedRedactions).size !== requestedRedactions.length || requestedRedactions.some((id, index) => id !== modelRedactions[index]) || requestedRedactions.length !== modelRedactions.length) {
    fail("REFERENCE_MISMATCH", "Layout redactions must exactly match the canonical ReportModel redactions");
  }
  const sourceNodeIds = new Set(draft.nodes.map((node) => node.id));
  if (requestedRedactions.some((id) => !sourceNodeIds.has(id))) fail("REFERENCE_MISMATCH", "ReportModel contains an unknown redacted node ID");
  const redactions = new Set(requestedRedactions);
  const nodes = draft.nodes
    .filter((node) => !redactions.has(node.id))
    .map((node) => ({ detail: node.detail, id: node.id, title: node.title, type: node.type }))
    .sort((left, right) => asciiCompare(left.id, right.id));
  const edges = draft.links
    .filter((link) => !redactions.has(link.from) && !redactions.has(link.to))
    .map((link) => ({
      annotations: edgeAnnotations(link),
      detail: link.rule?.detail ?? "",
      from: link.from,
      id: link.id,
      label: link.rule?.label ?? "",
      result: link.rule?.result ?? "",
      to: link.to,
    }))
    .sort((left, right) => asciiCompare(left.id, right.id));
  const input: ReportGraphLayoutInput = {
    caseRef: {
      fingerprint: model.case.fingerprint,
      id: model.case.id,
      title: model.case.title,
      version: model.case.version,
    },
    edges,
    nodes,
    presentation: {
      language: options.language,
      redactedNodeIds: requestedRedactions,
      sourceEdgeCount: draft.links.length,
      sourceNodeCount: draft.nodes.length,
    },
    profileRef: { id: model.profile.id, kind: model.profile.kind },
    reportRef: {
      contentFingerprint: model.contentFingerprint,
      modelRendererVersion: model.rendererVersion,
      modelSchemaVersion: model.schemaVersion,
    },
  };
  assertInput(input);
  return input;
}

function advanceForCodePoint(font: FontMetric, codePoint: number) {
  const advance = font.advances[String(codePoint)];
  const nominal = Number.isInteger(advance) && advance >= 0 ? advance : font.defaultAdvance;
  const shapingAdjustment = font.maxPositiveShapingAdjustments[String(codePoint)] ?? 0;
  return nominal + shapingAdjustment;
}

function textWidth(text: string, fontKey: FontKey, sizeMilliPoints: number, includeInkOverhang = true) {
  const font = FONT_METRICS.fonts[fontKey];
  let advance = 0;
  for (const scalar of text) advance += advanceForCodePoint(font, scalar.codePointAt(0) as number);
  if (text && includeInkOverhang) advance += font.maximumInkOverhang.left + font.maximumInkOverhang.right;
  const numerator = BigInt(advance) * BigInt(sizeMilliPoints) * BigInt(25_400);
  const denominator = BigInt(font.unitsPerEm) * BigInt(72_000);
  return Number((numerator + denominator - BigInt(1)) / denominator);
}

export function reportGraphMeasuredTextWidth(
  text: string,
  fontKey: "medium" | "regular",
  sizeMilliPoints: number,
) {
  return textWidth(text, fontKey, sizeMilliPoints);
}

function isCombining(codePoint: number) {
  return (codePoint >= 0x0300 && codePoint <= 0x036f)
    || (codePoint >= 0x0483 && codePoint <= 0x0489)
    || (codePoint >= 0x0591 && codePoint <= 0x05bd)
    || codePoint === 0x05bf
    || (codePoint >= 0x05c1 && codePoint <= 0x05c2)
    || (codePoint >= 0x0610 && codePoint <= 0x061a)
    || (codePoint >= 0x064b && codePoint <= 0x065f)
    || (codePoint >= 0x0900 && codePoint <= 0x0903)
    || (codePoint >= 0x093a && codePoint <= 0x094f)
    || (codePoint >= 0x0951 && codePoint <= 0x0957)
    || (codePoint >= 0x0962 && codePoint <= 0x0963)
    || (codePoint >= 0x1ab0 && codePoint <= 0x1aff)
    || (codePoint >= 0x1dc0 && codePoint <= 0x1dff)
    || (codePoint >= 0x20d0 && codePoint <= 0x20ff)
    || (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
    || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    || (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)
    || (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
}

const VIRAMA_CODE_POINTS = new Set([
  0x094d, 0x09cd, 0x0a4d, 0x0acd, 0x0b4d, 0x0bcd, 0x0c4d, 0x0ccd,
  0x0d3b, 0x0d3c, 0x0d4d, 0x0dca, 0x0e3a, 0x0f84, 0x1039, 0x103a,
  0x1714, 0x1734, 0x17d2, 0x1a60, 0x1b44, 0x1baa, 0x1bab, 0xa806,
  0xa8c4, 0xa953, 0xa9c0, 0xaaf6, 0xabed, 0x10a3f, 0x11046, 0x11070,
  0x11133, 0x111c0, 0x11235, 0x112ea, 0x1134d, 0x11442, 0x114c2,
  0x115bf, 0x1163f, 0x116b6, 0x1172b, 0x11839, 0x1193d, 0x119e0,
  0x11a34, 0x11a47, 0x11a99, 0x11c3f, 0x11d44, 0x11d45, 0x11d97,
  0x11f41, 0x11f42,
]);

function isVirama(codePoint: number) {
  return VIRAMA_CODE_POINTS.has(codePoint);
}

function isRegionalIndicator(codePoint: number) {
  return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
}

type HangulGraphemeClass = "L" | "LV" | "LVT" | "T" | "V";

function hangulGraphemeClass(codePoint: number): HangulGraphemeClass | null {
  if ((codePoint >= 0x1100 && codePoint <= 0x115f) || (codePoint >= 0xa960 && codePoint <= 0xa97c)) return "L";
  if ((codePoint >= 0x1160 && codePoint <= 0x11a7) || (codePoint >= 0xd7b0 && codePoint <= 0xd7c6)) return "V";
  if ((codePoint >= 0x11a8 && codePoint <= 0x11ff) || (codePoint >= 0xd7cb && codePoint <= 0xd7fb)) return "T";
  if (codePoint >= 0xac00 && codePoint <= 0xd7a3) return (codePoint - 0xac00) % 28 === 0 ? "LV" : "LVT";
  return null;
}

function hangulGraphemeContinues(previousCodePoint: number, codePoint: number) {
  const previous = hangulGraphemeClass(previousCodePoint);
  const current = hangulGraphemeClass(codePoint);
  return (previous === "L" && (current === "L" || current === "V" || current === "LV" || current === "LVT"))
    || ((previous === "LV" || previous === "V") && (current === "V" || current === "T"))
    || ((previous === "LVT" || previous === "T") && current === "T");
}

export function reportGraphGraphemeClusters(text: string) {
  const clusters: string[] = [];
  for (const scalar of text) {
    const codePoint = scalar.codePointAt(0) as number;
    const previous = clusters.at(-1) ?? "";
    const previousScalars = [...previous];
    const previousCodePoint = previousScalars.at(-1)?.codePointAt(0) ?? -1;
    const regionalPair = isRegionalIndicator(codePoint) && previousScalars.length === 1 && isRegionalIndicator(previousCodePoint);
    if (clusters.length && (
      isCombining(codePoint)
      || codePoint === 0x200c
      || codePoint === 0x200d
      || previousCodePoint === 0x200c
      || previousCodePoint === 0x200d
      || isVirama(previousCodePoint)
      || regionalPair
      || hangulGraphemeContinues(previousCodePoint, codePoint)
    )) clusters[clusters.length - 1] += scalar;
    else clusters.push(scalar);
  }
  return clusters;
}

function isLayoutWhitespace(cluster: string) {
  return [...cluster].every((scalar) => {
    const codePoint = scalar.codePointAt(0) as number;
    return (codePoint >= 0x0009 && codePoint <= 0x000d)
      || codePoint === 0x0020
      || codePoint === 0x0085
      || codePoint === 0x00a0
      || codePoint === 0x1680
      || (codePoint >= 0x2000 && codePoint <= 0x200a)
      || codePoint === 0x2028
      || codePoint === 0x2029
      || codePoint === 0x202f
      || codePoint === 0x205f
      || codePoint === 0x3000;
  });
}

function splitLongToken(token: string, maximumWidth: number, font: FontKey, sizeMilliPoints: number) {
  const pieces: string[] = [];
  let current = "";
  for (const cluster of reportGraphGraphemeClusters(token)) {
    const candidate = current + cluster;
    if (current && textWidth(candidate, font, sizeMilliPoints) > maximumWidth) {
      pieces.push(current);
      current = cluster;
    } else current = candidate;
    if (textWidth(current, font, sizeMilliPoints) > maximumWidth) {
      fail("NODE_EXCEEDS_PRINTABLE_FRAME", "A Unicode grapheme cluster is wider than the available text box", { availableWidth: maximumWidth, requiredWidth: textWidth(current, font, sizeMilliPoints) });
    }
  }
  if (current || pieces.length === 0) pieces.push(current);
  return pieces;
}

function wrapParagraph(paragraph: string, maximumWidth: number, font: FontKey, sizeMilliPoints: number) {
  const words: string[] = [];
  let word = "";
  for (const cluster of reportGraphGraphemeClusters(paragraph)) {
    if (isLayoutWhitespace(cluster)) {
      if (word) words.push(word);
      word = "";
    } else word += cluster;
  }
  if (word) words.push(word);
  if (!words.length) return [{ text: "", width: 0 }];
  const lines: ReportGraphTextLine[] = [];
  let current = "";
  for (const item of words) {
    const candidate = current ? `${current} ${item}` : item;
    if (textWidth(candidate, font, sizeMilliPoints) <= maximumWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push({ text: current, width: textWidth(current, font, sizeMilliPoints) });
      current = "";
    }
    if (textWidth(item, font, sizeMilliPoints) <= maximumWidth) current = item;
    else {
      const pieces = splitLongToken(item, maximumWidth, font, sizeMilliPoints);
      for (const piece of pieces.slice(0, -1)) lines.push({ text: piece, width: textWidth(piece, font, sizeMilliPoints) });
      current = pieces.at(-1) as string;
    }
  }
  if (current) lines.push({ text: current, width: textWidth(current, font, sizeMilliPoints) });
  return lines;
}

function wrapText(text: string, maximumWidth: number, font: FontKey, sizeMilliPoints: number) {
  if (!text) return [];
  return text.replace(/\r\n?/g, "\n").split("\n").flatMap((paragraph) => wrapParagraph(paragraph, maximumWidth, font, sizeMilliPoints));
}

function measureHeaderLayout(input: ReportGraphLayoutInput) {
  const style = TYPOGRAPHY.styles.header;
  const sectionTitle = input.presentation.language === "en"
    ? "Professional report graph | BPMN-inspired off-page continuity"
    : "Граф профессионального отчёта | переходы между страницами в стиле BPMN";
  const identity = input.presentation.language === "en"
    ? `Case ${input.caseRef.id} | version ${input.caseRef.version} | profile ${input.profileRef.id} | ${input.profileRef.kind}`
    : `Дело ${input.caseRef.id} | версия ${input.caseRef.version} | профиль ${input.profileRef.id} | ${input.profileRef.kind}`;
  const reportTitleLines = wrapText(input.caseRef.title, HEADER_FRAME_ORIGIN.width, style.font, style.sizeMilliPoints);
  const sectionTitleLines = wrapText(sectionTitle, HEADER_FRAME_ORIGIN.width, style.font, style.sizeMilliPoints);
  const identityLines = wrapText(identity, HEADER_FRAME_ORIGIN.width, style.font, style.sizeMilliPoints);
  const contentHeight = HEADER_PADDING_Y * 2
    + (reportTitleLines.length + sectionTitleLines.length + identityLines.length + 1) * style.lineHeight
    + HEADER_GROUP_GAP * 3;
  const headerFrame = { ...HEADER_FRAME_ORIGIN, height: contentHeight };
  const graphFrame = {
    height: GRAPH_FRAME_BOTTOM - (headerFrame.y + headerFrame.height + HEADER_GRAPH_GAP),
    width: PRINTABLE_FRAME.width,
    x: PRINTABLE_FRAME.x,
    y: headerFrame.y + headerFrame.height + HEADER_GRAPH_GAP,
  };
  if (graphFrame.height < 60_000) {
    fail("NODE_EXCEEDS_PRINTABLE_FRAME", "Measured repeating report header leaves no usable graph frame", { availableHeight: graphFrame.height });
  }
  return {
    graphFrame,
    headerFrame,
    headerLayout: {
      contentHeight,
      groupGap: HEADER_GROUP_GAP,
      identity: { fullText: identity, lines: identityLines },
      paddingY: HEADER_PADDING_Y,
      reportTitle: { fullText: input.caseRef.title, lines: reportTitleLines },
      sectionTitle: { fullText: sectionTitle, lines: sectionTitleLines },
    } satisfies ReportGraphLayoutModel["headerLayout"],
  };
}

type Topology = {
  components: ReportGraphLayoutModel["components"];
  cyclicRepairs: ReportGraphLayoutModel["cyclicRepairs"];
  repairedEdgeIds: Set<string>;
  topologyLayers: Array<Omit<ReportGraphLayoutModel["topologyLayers"][number], "subLayerIds">>;
};

function deriveTopology(input: ReportGraphLayoutInput): Topology {
  const nodeIds = input.nodes.map((node) => node.id).sort(asciiCompare);
  const neighbours = new Map(nodeIds.map((id) => [id, new Set<string>()]));
  const incoming = new Map(nodeIds.map((id) => [id, [] as ReportGraphLayoutInput["edges"]]));
  const outgoing = new Map(nodeIds.map((id) => [id, [] as ReportGraphLayoutInput["edges"]]));
  for (const edge of input.edges) {
    neighbours.get(edge.from)?.add(edge.to);
    neighbours.get(edge.to)?.add(edge.from);
    incoming.get(edge.to)?.push(edge);
    outgoing.get(edge.from)?.push(edge);
  }
  for (const values of incoming.values()) values.sort((left, right) => asciiCompare(left.id, right.id));
  for (const values of outgoing.values()) values.sort((left, right) => asciiCompare(left.id, right.id));

  const rawComponents: string[][] = [];
  const assigned = new Set<string>();
  for (const seed of nodeIds) {
    if (assigned.has(seed)) continue;
    const pending = [seed];
    const component: string[] = [];
    assigned.add(seed);
    while (pending.length) {
      const current = pending.shift() as string;
      component.push(current);
      for (const neighbour of [...(neighbours.get(current) ?? [])].sort(asciiCompare)) {
        if (!assigned.has(neighbour)) {
          assigned.add(neighbour);
          pending.push(neighbour);
        }
      }
    }
    component.sort(asciiCompare);
    rawComponents.push(component);
  }
  rawComponents.sort((left, right) => asciiCompare(left[0], right[0]));

  const components: Topology["components"] = [];
  const cyclicRepairs: Topology["cyclicRepairs"] = [];
  const repairedEdgeIds = new Set<string>();
  const topologyLayers: Topology["topologyLayers"] = [];
  for (const [componentIndex, componentNodes] of rawComponents.entries()) {
    const componentId = `C${pad(componentIndex + 1, 2)}`;
    const componentSet = new Set(componentNodes);
    const indegree = new Map(componentNodes.map((id) => [id, (incoming.get(id) ?? []).filter((edge) => componentSet.has(edge.from)).length]));
    const remaining = new Set(componentNodes);
    const ready = componentNodes.filter((id) => indegree.get(id) === 0).sort(asciiCompare);
    const layerByNode = new Map(componentNodes.map((id) => [id, 0]));
    let repairIndex = 0;
    while (remaining.size) {
      if (!ready.length) {
        const promotedNodeId = [...remaining].sort(asciiCompare)[0];
        const ignoredIncomingEdgeIds = (incoming.get(promotedNodeId) ?? [])
          .filter((edge) => remaining.has(edge.from))
          .map((edge) => edge.id)
          .sort(asciiCompare);
        if (!ignoredIncomingEdgeIds.length) fail("INPUT_INVALID", "Cyclic repair could not identify an incoming edge", { nodeId: promotedNodeId });
        repairIndex += 1;
        for (const edgeId of ignoredIncomingEdgeIds) repairedEdgeIds.add(edgeId);
        cyclicRepairs.push({ componentId, id: `CR-${componentId}-${pad(repairIndex, 2)}`, ignoredIncomingEdgeIds, promotedNodeId });
        indegree.set(promotedNodeId, 0);
        ready.push(promotedNodeId);
      }
      ready.sort(asciiCompare);
      const nodeId = ready.shift() as string;
      if (!remaining.delete(nodeId)) continue;
      for (const edge of outgoing.get(nodeId) ?? []) {
        if (!remaining.has(edge.to)) continue;
        layerByNode.set(edge.to, Math.max(layerByNode.get(edge.to) ?? 0, (layerByNode.get(nodeId) ?? 0) + 1));
        const nextIndegree = (indegree.get(edge.to) ?? 0) - 1;
        indegree.set(edge.to, nextIndegree);
        if (nextIndegree === 0) ready.push(edge.to);
      }
    }
    const layerIndexes = [...new Set(layerByNode.values())].sort((left, right) => left - right);
    for (const layerIndex of layerIndexes) topologyLayers.push({
      componentId,
      id: `T-${componentId}-${pad(layerIndex + 1, 2)}`,
      index: layerIndex,
      nodeIds: componentNodes.filter((id) => layerByNode.get(id) === layerIndex).sort(asciiCompare),
    });
    components.push({
      cyclic: cyclicRepairs.some((repair) => repair.componentId === componentId),
      id: componentId,
      nodeIds: componentNodes,
      rootNodeIds: componentNodes.filter((id) => (incoming.get(id) ?? []).length === 0),
      terminalNodeIds: componentNodes.filter((id) => (outgoing.get(id) ?? []).length === 0),
    });
  }
  return { components, cyclicRepairs, repairedEdgeIds, topologyLayers };
}

type RawLayoutLayer = {
  componentId: string;
  id: string;
  nodeIds: string[];
  subLayer: number;
  topologyLayerId: string;
};

type MeasuredNode = {
  fullHeight: number;
  height: number;
  id: string;
  ref: string;
  text: ReportGraphLayoutNode["text"];
  width: number;
};

type MeasuredLayer = RawLayoutLayer & { dedicatedPage: boolean; height: number; nodes: MeasuredNode[] };

function measureNode(
  inputNode: ReportGraphLayoutInput["nodes"][number],
  ref: string,
  language: ReportGraphLanguage,
  width: number,
  maximumHeight: number | null = null,
): MeasuredNode {
  const contentWidth = width - NODE_PADDING_X * 2;
  const badgeText = `${ref} | ${NODE_TYPE_LABELS[language][inputNode.type]}`;
  const badge = { text: badgeText, width: textWidth(badgeText, TYPOGRAPHY.styles.badge.font, TYPOGRAPHY.styles.badge.sizeMilliPoints) };
  if (badge.width > contentWidth) fail("NODE_EXCEEDS_PRINTABLE_FRAME", "Node badge exceeds the available text box", { availableWidth: contentWidth, nodeId: inputNode.id, requiredWidth: badge.width });
  const titleLines = wrapText(inputNode.title, contentWidth, TYPOGRAPHY.styles.title.font, TYPOGRAPHY.styles.title.sizeMilliPoints);
  const allDetailLines = wrapText(inputNode.detail, contentWidth, TYPOGRAPHY.styles.detail.font, TYPOGRAPHY.styles.detail.sizeMilliPoints);
  const fixedTextHeight = TYPOGRAPHY.styles.badge.lineHeight
    + BADGE_TITLE_GAP
    + titleLines.length * TYPOGRAPHY.styles.title.lineHeight
    + (allDetailLines.length ? TITLE_DETAIL_GAP : 0);
  const fullTextHeight = fixedTextHeight + allDetailLines.length * TYPOGRAPHY.styles.detail.lineHeight;
  const fullHeight = NODE_PADDING_Y * 2 + fullTextHeight;
  const omitted = allDetailLines.length > 0 && maximumHeight !== null && fullHeight > maximumHeight;
  const fullDetailReference = omitted ? `Full detail: ${ref}` : null;
  const referenceLine = fullDetailReference ? {
    text: fullDetailReference,
    width: textWidth(fullDetailReference, TYPOGRAPHY.styles.detailReference.font, TYPOGRAPHY.styles.detailReference.sizeMilliPoints),
  } : null;
  if (referenceLine && referenceLine.width > contentWidth) fail("NODE_EXCEEDS_PRINTABLE_FRAME", "Full-detail reference exceeds the available text box", { availableWidth: contentWidth, nodeId: inputNode.id, requiredWidth: referenceLine.width });
  const availableDetailHeight = omitted
    ? maximumHeight as number
      - NODE_PADDING_Y * 2
      - fixedTextHeight
      - TYPOGRAPHY.styles.detailReference.lineHeight
    : allDetailLines.length * TYPOGRAPHY.styles.detail.lineHeight;
  const displayedLineCount = omitted
    ? Math.max(0, Math.floor(availableDetailHeight / TYPOGRAPHY.styles.detail.lineHeight))
    : allDetailLines.length;
  const displayedLines = allDetailLines.slice(0, displayedLineCount);
  const detailVisualLineCount = displayedLines.length + (referenceLine ? 1 : 0);
  const textHeight = TYPOGRAPHY.styles.badge.lineHeight
    + BADGE_TITLE_GAP
    + titleLines.length * TYPOGRAPHY.styles.title.lineHeight
    + (detailVisualLineCount ? TITLE_DETAIL_GAP : 0)
    + displayedLines.length * TYPOGRAPHY.styles.detail.lineHeight
    + (referenceLine ? TYPOGRAPHY.styles.detailReference.lineHeight : 0);
  return {
    fullHeight,
    height: NODE_PADDING_Y * 2 + textHeight,
    id: inputNode.id,
    ref,
    text: {
      badge,
      detail: { allLineCount: allDetailLines.length, displayedLines, fullDetailReference, fullText: inputNode.detail, omitted, referenceLine },
      textHeight,
      title: { fullText: inputNode.title, lines: titleLines },
    },
    width,
  };
}

function orderedAsciiShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedAsciiShape);
  if (value === null || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => asciiCompare(left, right))) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) fail("INPUT_INVALID", `Layout fingerprint object key is not canonical ASCII: ${key}`);
    result[key] = orderedAsciiShape(item);
  }
  return result;
}

function directedNodeAnchors(from: ReportGraphLayoutNode, to: ReportGraphLayoutNode): { fromPoint: ReportGraphPoint; toPoint: ReportGraphPoint } {
  const fromCenterX = from.box.x + Math.floor(from.box.width / 2);
  const fromCenterY = from.box.y + Math.floor(from.box.height / 2);
  const toCenterX = to.box.x + Math.floor(to.box.width / 2);
  const toCenterY = to.box.y + Math.floor(to.box.height / 2);
  if (from.box.y + from.box.height <= to.box.y) return {
    fromPoint: { x: fromCenterX, y: from.box.y + from.box.height },
    toPoint: { x: toCenterX, y: to.box.y },
  };
  if (to.box.y + to.box.height <= from.box.y) return {
    fromPoint: { x: fromCenterX, y: from.box.y },
    toPoint: { x: toCenterX, y: to.box.y + to.box.height },
  };
  if (fromCenterX <= toCenterX) return {
    fromPoint: { x: from.box.x + from.box.width, y: fromCenterY },
    toPoint: { x: to.box.x, y: toCenterY },
  };
  return {
    fromPoint: { x: from.box.x, y: fromCenterY },
    toPoint: { x: to.box.x + to.box.width, y: toCenterY },
  };
}

function expandBox(box: ReportGraphBox, amount: number): ReportGraphBox {
  return {
    height: box.height + amount * 2,
    width: box.width + amount * 2,
    x: box.x - amount,
    y: box.y - amount,
  };
}

function pointInsideBoxInterior(point: ReportGraphPoint, box: ReportGraphBox) {
  return point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;
}

function orthogonalSegmentClear(from: ReportGraphPoint, to: ReportGraphPoint, obstacles: readonly ReportGraphBox[]) {
  if (from.x !== to.x && from.y !== to.y) return false;
  const minimumX = Math.min(from.x, to.x);
  const maximumX = Math.max(from.x, to.x);
  const minimumY = Math.min(from.y, to.y);
  const maximumY = Math.max(from.y, to.y);
  return obstacles.every((box) => {
    if (from.y === to.y) {
      return !(from.y > box.y && from.y < box.y + box.height && maximumX > box.x && minimumX < box.x + box.width);
    }
    return !(from.x > box.x && from.x < box.x + box.width && maximumY > box.y && minimumY < box.y + box.height);
  });
}

type RouteQueueItem = { bends: number; cost: number; state: number };

class RouteMinHeap {
  private readonly values: RouteQueueItem[] = [];

  private before(left: RouteQueueItem, right: RouteQueueItem) {
    return left.cost - right.cost || left.bends - right.bends || left.state - right.state;
  }

  push(value: RouteQueueItem) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.before(this.values[parent], this.values[index]) <= 0) break;
      [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]];
      index = parent;
    }
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (!this.values.length) return first;
    this.values[0] = last as RouteQueueItem;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.values.length && this.before(this.values[left], this.values[smallest]) < 0) smallest = left;
      if (right < this.values.length && this.before(this.values[right], this.values[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      [this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]];
      index = smallest;
    }
    return first;
  }

  get length() {
    return this.values.length;
  }
}

function compressOrthogonalPoints(points: ReportGraphPoint[]) {
  const compressed: ReportGraphPoint[] = [];
  for (const point of points) {
    const previous = compressed.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    const beforePrevious = compressed.at(-2);
    if (beforePrevious && previous
      && ((beforePrevious.x === previous.x && previous.x === point.x)
        || (beforePrevious.y === previous.y && previous.y === point.y))) {
      compressed[compressed.length - 1] = point;
    } else compressed.push(point);
  }
  return compressed;
}

function orthogonalRoute(
  start: ReportGraphPoint,
  end: ReportGraphPoint,
  frame: ReportGraphBox,
  obstacles: readonly ReportGraphBox[],
  routeId: string,
) {
  if (start.x === end.x || start.y === end.y) {
    if (orthogonalSegmentClear(start, end, obstacles)) return [start, end];
  }
  const frameRight = frame.x + frame.width;
  const frameBottom = frame.y + frame.height;
  const xValues = new Set([frame.x, frameRight, start.x, end.x]);
  const yValues = new Set([frame.y, frameBottom, start.y, end.y]);
  for (const obstacle of obstacles) {
    xValues.add(Math.max(frame.x, Math.min(frameRight, obstacle.x)));
    xValues.add(Math.max(frame.x, Math.min(frameRight, obstacle.x + obstacle.width)));
    yValues.add(Math.max(frame.y, Math.min(frameBottom, obstacle.y)));
    yValues.add(Math.max(frame.y, Math.min(frameBottom, obstacle.y + obstacle.height)));
  }
  const xs = [...xValues].sort((left, right) => left - right);
  const ys = [...yValues].sort((left, right) => left - right);
  const points: ReportGraphPoint[] = [];
  const pointIndex = new Map<string, number>();
  for (const y of ys) {
    for (const x of xs) {
      const point = { x, y };
      if (obstacles.some((obstacle) => pointInsideBoxInterior(point, obstacle))) continue;
      pointIndex.set(`${x},${y}`, points.length);
      points.push(point);
    }
  }
  const startIndex = pointIndex.get(`${start.x},${start.y}`);
  const endIndex = pointIndex.get(`${end.x},${end.y}`);
  if (startIndex === undefined || endIndex === undefined) {
    const blockedPoint = startIndex === undefined ? start : end;
    const obstacleIndex = obstacles.findIndex((obstacle) => pointInsideBoxInterior(blockedPoint, obstacle));
    fail("INPUT_INVALID", "Route endpoint lies inside a foreign obstacle", {
      obstacleIndex,
      pointX: blockedPoint.x,
      pointY: blockedPoint.y,
      routeEndpoint: startIndex === undefined ? "start" : "end",
      routeId,
    });
  }
  const neighbours = Array.from({ length: points.length }, () => [] as Array<{ direction: 1 | 2; distance: number; point: number }>);
  const addLineNeighbours = (indexes: number[], direction: 1 | 2) => {
    for (let index = 1; index < indexes.length; index += 1) {
      const left = indexes[index - 1];
      const right = indexes[index];
      if (!orthogonalSegmentClear(points[left], points[right], obstacles)) continue;
      const distance = Math.abs(points[left].x - points[right].x) + Math.abs(points[left].y - points[right].y);
      neighbours[left].push({ direction, distance, point: right });
      neighbours[right].push({ direction, distance, point: left });
    }
  };
  for (const y of ys) {
    addLineNeighbours(points.map((point, index) => ({ point, index })).filter((item) => item.point.y === y).sort((left, right) => left.point.x - right.point.x).map((item) => item.index), 1);
  }
  for (const x of xs) {
    addLineNeighbours(points.map((point, index) => ({ point, index })).filter((item) => item.point.x === x).sort((left, right) => left.point.y - right.point.y).map((item) => item.index), 2);
  }
  for (const values of neighbours) values.sort((left, right) => left.point - right.point || left.direction - right.direction);
  const stateCount = points.length * 3;
  const costs = new Array<number>(stateCount).fill(Number.POSITIVE_INFINITY);
  const bends = new Array<number>(stateCount).fill(Number.POSITIVE_INFINITY);
  const previous = new Array<number>(stateCount).fill(-1);
  const startState = startIndex * 3;
  costs[startState] = 0;
  bends[startState] = 0;
  const queue = new RouteMinHeap();
  queue.push({ bends: 0, cost: 0, state: startState });
  while (queue.length) {
    const current = queue.pop() as RouteQueueItem;
    if (current.cost !== costs[current.state] || current.bends !== bends[current.state]) continue;
    const currentPoint = Math.floor(current.state / 3);
    const currentDirection = current.state % 3;
    for (const neighbour of neighbours[currentPoint]) {
      const bend = currentDirection !== 0 && currentDirection !== neighbour.direction ? 1 : 0;
      const nextState = neighbour.point * 3 + neighbour.direction;
      const nextCost = current.cost + neighbour.distance + bend * REPORT_GRAPH_ROUTE_BEND_PENALTY;
      const nextBends = current.bends + bend;
      if (nextCost > costs[nextState] || (nextCost === costs[nextState] && nextBends >= bends[nextState])) continue;
      costs[nextState] = nextCost;
      bends[nextState] = nextBends;
      previous[nextState] = current.state;
      queue.push({ bends: nextBends, cost: nextCost, state: nextState });
    }
  }
  const endStates = [endIndex * 3 + 1, endIndex * 3 + 2, endIndex * 3]
    .filter((state) => Number.isFinite(costs[state]))
    .sort((left, right) => costs[left] - costs[right] || bends[left] - bends[right] || left - right);
  if (!endStates.length) fail("INPUT_INVALID", "No obstacle-free orthogonal route exists", { routeId });
  const reversed: ReportGraphPoint[] = [];
  for (let state = endStates[0]; state >= 0; state = previous[state]) {
    reversed.push(points[Math.floor(state / 3)]);
    if (state === startState) break;
  }
  const route = compressOrthogonalPoints(reversed.reverse());
  if (route[0]?.x !== start.x || route[0]?.y !== start.y || route.at(-1)?.x !== end.x || route.at(-1)?.y !== end.y) {
    fail("INPUT_INVALID", "Orthogonal route reconstruction lost an endpoint", { routeId });
  }
  return route;
}

function connectorRowCount(endpointCount: number) {
  return Math.ceil(endpointCount / REPORT_GRAPH_CONNECTOR_COLUMNS);
}

function connectorGutterHeight(endpointCount: number) {
  return endpointCount ? connectorRowCount(endpointCount) * REPORT_GRAPH_CONNECTOR_ROW_HEIGHT + REPORT_GRAPH_CONNECTOR_NODE_GAP : 0;
}

function connectorFrames(graphFrame: ReportGraphBox, topCount: number, bottomCount: number) {
  const topHeight = connectorGutterHeight(topCount);
  const bottomHeight = connectorGutterHeight(bottomCount);
  const bottom = graphFrame.y + graphFrame.height;
  return {
    bottomGutter: { height: bottomHeight, width: graphFrame.width, x: graphFrame.x, y: bottom - bottomHeight },
    nodeFrame: { height: graphFrame.height - topHeight - bottomHeight, width: graphFrame.width, x: graphFrame.x, y: graphFrame.y + topHeight },
    topGutter: { height: topHeight, width: graphFrame.width, x: graphFrame.x, y: graphFrame.y },
  };
}

function connectorEndpointSide(
  pair: ReportGraphLayoutModel["crossPageConnectorPairs"][number],
  endpointId: string,
): ReportGraphConnectorSide {
  const incoming = pair.incoming.id === endpointId;
  const forwardPages = pair.fromPageId < pair.toPageId;
  return incoming === forwardPages ? "top" : "bottom";
}

/** Recompute compact connector bands from serialized page and pair data.
 * The result must exactly match the endpoint geometry serialized in schema 1. */
export function reportGraphConnectorPageGeometry(
  layout: ReportGraphLayoutModel,
  pageId: string,
): ReportGraphConnectorPageGeometry {
  const page = layout.graphPages.find((candidate) => candidate.id === pageId);
  if (!page) fail("INPUT_INVALID", `Unknown report graph page ${pageId}`);
  const entries = page.connectorEndpointIds.map((endpointId) => {
    const pair = layout.crossPageConnectorPairs.find((candidate) => candidate.incoming.id === endpointId || candidate.outgoing.id === endpointId);
    if (!pair) fail("INPUT_INVALID", `Unknown connector endpoint ${endpointId}`, { pageId });
    const incoming = pair.incoming.id === endpointId;
    return {
      direction: incoming ? "IN" as const : "OUT" as const,
      endpointId,
      side: connectorEndpointSide(pair, endpointId),
      targetNodeRef: incoming ? pair.outgoing.nodeRef : pair.incoming.nodeRef,
      targetPageId: incoming ? pair.fromPageId : pair.toPageId,
    };
  });
  const top = entries.filter((entry) => entry.side === "top");
  const bottom = entries.filter((entry) => entry.side === "bottom");
  const frames = connectorFrames(layout.graphFrame, top.length, bottom.length);
  const geometries: ReportGraphConnectorEndpointGeometry[] = [];
  for (const [side, sideEntries] of [["top", top], ["bottom", bottom]] as const) {
    const rows = connectorRowCount(sideEntries.length);
    if (rows > REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE) {
      fail("NODE_EXCEEDS_PRINTABLE_FRAME", "Connector endpoint capacity exceeds its deterministic page-side band", {
        endpointCount: sideEntries.length,
        maximumEndpointCount: REPORT_GRAPH_CONNECTOR_COLUMNS * REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE,
        pageId,
        side,
      });
    }
    const rowOrigin = side === "top"
      ? layout.graphFrame.y
      : layout.graphFrame.y + layout.graphFrame.height - rows * REPORT_GRAPH_CONNECTOR_ROW_HEIGHT;
    for (const [index, entry] of sideEntries.entries()) {
      const row = Math.floor(index / REPORT_GRAPH_CONNECTOR_COLUMNS);
      const column = index % REPORT_GRAPH_CONNECTOR_COLUMNS;
      const cellBox = {
        height: REPORT_GRAPH_CONNECTOR_ROW_HEIGHT,
        width: REPORT_GRAPH_CONNECTOR_CELL_WIDTH,
        x: layout.graphFrame.x + column * REPORT_GRAPH_CONNECTOR_CELL_WIDTH,
        y: rowOrigin + row * REPORT_GRAPH_CONNECTOR_ROW_HEIGHT,
      };
      const markerCenter = {
        x: cellBox.x + REPORT_GRAPH_CONNECTOR_MARKER_CENTER_X_OFFSET,
        y: cellBox.y + Math.floor(cellBox.height / 2),
      };
      const markerBox = {
        height: REPORT_GRAPH_CONNECTOR_MARKER_RADIUS * 2,
        width: REPORT_GRAPH_CONNECTOR_MARKER_RADIUS * 2,
        x: markerCenter.x - REPORT_GRAPH_CONNECTOR_MARKER_RADIUS,
        y: markerCenter.y - REPORT_GRAPH_CONNECTOR_MARKER_RADIUS,
      };
      const labelBox = {
        height: REPORT_GRAPH_CONNECTOR_LABEL_HEIGHT,
        width: REPORT_GRAPH_CONNECTOR_LABEL_WIDTH,
        x: cellBox.x + REPORT_GRAPH_CONNECTOR_LABEL_X_OFFSET,
        y: markerCenter.y - Math.floor(REPORT_GRAPH_CONNECTOR_LABEL_HEIGHT / 2),
      };
      const markerInkInset = Math.floor(REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH / 2);
      const labelInkInset = Math.floor(REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH / 2);
      const markerInkBox = {
        height: markerBox.height + markerInkInset * 2,
        width: markerBox.width + markerInkInset * 2,
        x: markerBox.x - markerInkInset,
        y: markerBox.y - markerInkInset,
      };
      const labelInkBox = {
        height: labelBox.height + labelInkInset * 2,
        width: labelBox.width + labelInkInset * 2,
        x: labelBox.x - labelInkInset,
        y: labelBox.y - labelInkInset,
      };
      const routeLaneIndex = side === "top" ? rows - row - 1 : row;
      const routeLaneX = cellBox.x
        + REPORT_GRAPH_CONNECTOR_ROUTE_LANE_X_OFFSET
        + routeLaneIndex * REPORT_GRAPH_CONNECTOR_ROUTE_LANE_STEP;
      const markerPort = { x: markerInkBox.x + markerInkBox.width, y: markerCenter.y };
      geometries.push({
        cellBox,
        column,
        direction: entry.direction,
        directionPageBaseline: {
          x: labelBox.x + 300,
          y: labelBox.y + REPORT_GRAPH_CONNECTOR_REFERENCE_PRIMARY_BASELINE_OFFSET,
        },
        endpointId: entry.endpointId,
        gutterExitPort: {
          x: routeLaneX,
          y: side === "top"
            ? frames.topGutter.y + frames.topGutter.height - REPORT_GRAPH_CONNECTOR_NODE_GAP + REPORT_GRAPH_ROUTE_CLEARANCE
            : frames.bottomGutter.y + REPORT_GRAPH_CONNECTOR_NODE_GAP - REPORT_GRAPH_ROUTE_CLEARANCE,
        },
        labelBox,
        labelInkBox,
        markerBox,
        markerInkBox,
        markerCenter,
        markerPort,
        pathPort: markerPort,
        routeLaneX,
        row,
        side,
        targetNodeBaseline: {
          x: labelBox.x + 300,
          y: labelBox.y + REPORT_GRAPH_CONNECTOR_REFERENCE_SECONDARY_BASELINE_OFFSET,
        },
        targetNodeRef: entry.targetNodeRef,
        targetPageId: entry.targetPageId,
      });
    }
  }
  return { ...frames, endpoints: geometries };
}

type PlannedGraphPage = {
  bottomEndpointCount: number;
  connectorCapacityFits: boolean;
  layers: MeasuredLayer[];
  nodeFrame: ReportGraphBox;
  topEndpointCount: number;
};

function planConnectorCounts(
  layers: readonly MeasuredLayer[],
  input: ReportGraphLayoutInput,
  layerOrderByNode: ReadonlyMap<string, number>,
) {
  const nodeIds = new Set(layers.flatMap((layer) => layer.nodeIds));
  const layerIndexes = layers.flatMap((layer) => layer.nodeIds.map((nodeId) => layerOrderByNode.get(nodeId) as number));
  const firstLayerIndex = Math.min(...layerIndexes);
  const lastLayerIndex = Math.max(...layerIndexes);
  let topEndpointCount = 0;
  let bottomEndpointCount = 0;
  for (const edge of input.edges) {
    const fromInside = nodeIds.has(edge.from);
    const toInside = nodeIds.has(edge.to);
    if (fromInside === toInside) continue;
    const outsideNodeId = fromInside ? edge.to : edge.from;
    const outsideLayerIndex = layerOrderByNode.get(outsideNodeId);
    if (outsideLayerIndex === undefined || (outsideLayerIndex >= firstLayerIndex && outsideLayerIndex <= lastLayerIndex)) {
      fail("INPUT_INVALID", "Connector planning encountered a non-contiguous layer assignment", { edgeId: edge.id });
    }
    if (outsideLayerIndex < firstLayerIndex) topEndpointCount += 1;
    else bottomEndpointCount += 1;
  }
  return { bottomEndpointCount, topEndpointCount };
}

function planPage(
  layers: MeasuredLayer[],
  input: ReportGraphLayoutInput,
  layerOrderByNode: ReadonlyMap<string, number>,
  graphFrame: ReportGraphBox,
): PlannedGraphPage {
  const counts = planConnectorCounts(layers, input, layerOrderByNode);
  const frames = connectorFrames(graphFrame, counts.topEndpointCount, counts.bottomEndpointCount);
  const maximumEndpointCount = REPORT_GRAPH_CONNECTOR_COLUMNS * REPORT_GRAPH_CONNECTOR_MAX_ROWS_PER_SIDE;
  return {
    ...counts,
    connectorCapacityFits: counts.topEndpointCount <= maximumEndpointCount
      && counts.bottomEndpointCount <= maximumEndpointCount,
    layers,
    nodeFrame: frames.nodeFrame,
  };
}

function layersHeight(layers: readonly MeasuredLayer[]) {
  return layers.reduce((height, layer, index) => height + layer.height + (index ? LAYER_GAP : 0), 0);
}

export function buildReportGraphLayout(input: ReportGraphLayoutInput): ReportGraphLayoutModel {
  assertInput(input);
  const stableInput: ReportGraphLayoutInput = {
    ...input,
    edges: input.edges.map((edge) => ({ ...edge, annotations: [...edge.annotations] })).sort((left, right) => asciiCompare(left.id, right.id)),
    nodes: input.nodes.map((node) => ({ ...node })).sort((left, right) => asciiCompare(left.id, right.id)),
    presentation: { ...input.presentation, redactedNodeIds: [...input.presentation.redactedNodeIds] },
  };
  const { graphFrame, headerFrame, headerLayout } = measureHeaderLayout(stableInput);
  const topology = deriveTopology(stableInput);
  const rawLayers: RawLayoutLayer[] = [];
  const rawSubLayerIds = new Map<string, string[]>();
  for (const topologyLayer of topology.topologyLayers) {
    const chunks = Array.from({ length: Math.ceil(topologyLayer.nodeIds.length / REPORT_GRAPH_MAX_PORTRAIT_LANES) }, (_, index) => topologyLayer.nodeIds.slice(index * REPORT_GRAPH_MAX_PORTRAIT_LANES, (index + 1) * REPORT_GRAPH_MAX_PORTRAIT_LANES));
    for (const [subLayerIndex, nodeIds] of chunks.entries()) {
      const id = `L-${topologyLayer.componentId}-${pad(topologyLayer.index + 1, 2)}-${pad(subLayerIndex + 1, 2)}`;
      rawLayers.push({ componentId: topologyLayer.componentId, id, nodeIds, subLayer: subLayerIndex, topologyLayerId: topologyLayer.id });
      rawSubLayerIds.set(topologyLayer.id, [...(rawSubLayerIds.get(topologyLayer.id) ?? []), id]);
    }
  }
  const graphNodeOrder = rawLayers.flatMap((layer) => layer.nodeIds);
  const refWidth = Math.max(2, String(graphNodeOrder.length).length);
  const refByNode = new Map(graphNodeOrder.map((id, index) => [id, `N${pad(index + 1, refWidth)}`]));
  const nodeById = new Map(stableInput.nodes.map((node) => [node.id, node]));
  const measuredLayers: MeasuredLayer[] = [];
  for (const rawLayer of rawLayers) {
    const standardNodes = rawLayer.nodeIds.map((nodeId) => measureNode(nodeById.get(nodeId) as ReportGraphLayoutInput["nodes"][number], refByNode.get(nodeId) as string, stableInput.presentation.language, STANDARD_NODE_WIDTH));
    const oversizedIds = new Set(standardNodes.filter((node) => node.height > graphFrame.height).map((node) => node.id));
    if (!oversizedIds.size) {
      measuredLayers.push({ ...rawLayer, dedicatedPage: false, height: Math.max(...standardNodes.map((node) => node.height)), nodes: standardNodes });
      continue;
    }
    let normalIndex = 0;
    for (const standardNode of standardNodes) {
      if (!oversizedIds.has(standardNode.id)) {
        normalIndex += 1;
        measuredLayers.push({
          ...rawLayer,
          id: `${rawLayer.id}-S${pad(normalIndex, 2)}`,
          nodeIds: [standardNode.id],
          dedicatedPage: false,
          height: standardNode.height,
          nodes: [standardNode],
        });
        continue;
      }
      const fullWidthCompleteNode = measureNode(nodeById.get(standardNode.id) as ReportGraphLayoutInput["nodes"][number], standardNode.ref, stableInput.presentation.language, graphFrame.width);
      const fullWidthNode = fullWidthCompleteNode.height > graphFrame.height
        ? measureNode(nodeById.get(standardNode.id) as ReportGraphLayoutInput["nodes"][number], standardNode.ref, stableInput.presentation.language, graphFrame.width, graphFrame.height)
        : fullWidthCompleteNode;
      if (fullWidthNode.height > graphFrame.height) fail("NODE_EXCEEDS_PRINTABLE_FRAME", `Node ${standardNode.id} needs ${fullWidthNode.height} ${REPORT_GRAPH_FIXED_UNIT} but the full-width graph frame permits ${graphFrame.height}`, { availableHeight: graphFrame.height, nodeId: standardNode.id, requiredHeight: fullWidthNode.height });
      measuredLayers.push({
        ...rawLayer,
        id: `${rawLayer.id}-D-${standardNode.ref}`,
        nodeIds: [standardNode.id],
        dedicatedPage: true,
        height: fullWidthNode.height,
        nodes: [fullWidthNode],
      });
    }
  }

  const layerOrderByNode = new Map(measuredLayers.flatMap((layer, index) => layer.nodeIds.map((nodeId) => [nodeId, index] as const)));
  const pagePlans: PlannedGraphPage[] = [];
  let nextLayerIndex = 0;
  while (nextLayerIndex < measuredLayers.length) {
    const firstLayer = measuredLayers[nextLayerIndex];
    let bestPlan: PlannedGraphPage | null = null;
    const candidateLayers: MeasuredLayer[] = [];
    for (let endIndex = nextLayerIndex; endIndex < measuredLayers.length; endIndex += 1) {
      const layer = measuredLayers[endIndex];
      if (candidateLayers.length && (firstLayer.dedicatedPage || layer.dedicatedPage)) break;
      candidateLayers.push(layer);
      if (layersHeight(candidateLayers) > graphFrame.height) break;
      const candidatePlan = planPage([...candidateLayers], stableInput, layerOrderByNode, graphFrame);
      if (candidatePlan.connectorCapacityFits && layersHeight(candidateLayers) <= candidatePlan.nodeFrame.height) bestPlan = candidatePlan;
      if (firstLayer.dedicatedPage) break;
    }
    if (!bestPlan) {
      const failedPlan = planPage([firstLayer], stableInput, layerOrderByNode, graphFrame);
      if (failedPlan.connectorCapacityFits && firstLayer.nodes.length === 1 && failedPlan.nodeFrame.height > 0) {
        const measuredNode = firstLayer.nodes[0];
        const sourceNode = nodeById.get(measuredNode.id) as ReportGraphLayoutInput["nodes"][number];
        const completeDedicatedNode = measureNode(sourceNode, measuredNode.ref, stableInput.presentation.language, graphFrame.width);
        const fittedDedicatedNode = completeDedicatedNode.height <= failedPlan.nodeFrame.height
          ? completeDedicatedNode
          : measureNode(sourceNode, measuredNode.ref, stableInput.presentation.language, graphFrame.width, failedPlan.nodeFrame.height);
        if (fittedDedicatedNode.height <= failedPlan.nodeFrame.height) {
          const fittedLayer = {
            ...firstLayer,
            dedicatedPage: true,
            height: fittedDedicatedNode.height,
            nodes: [fittedDedicatedNode],
          };
          const fittedPlan = planPage([fittedLayer], stableInput, layerOrderByNode, graphFrame);
          if (fittedPlan.connectorCapacityFits) bestPlan = fittedPlan;
        }
      }
      if (!bestPlan) {
        fail("NODE_EXCEEDS_PRINTABLE_FRAME", `Layer ${firstLayer.id} cannot fit beside its deterministic connector bands`, {
          availableHeight: failedPlan.nodeFrame.height,
          nodeId: firstLayer.nodeIds[0],
          requiredHeight: firstLayer.height,
        });
      }
    }
    pagePlans.push(bestPlan);
    nextLayerIndex += bestPlan.layers.length;
  }

  const layoutNodes: ReportGraphLayoutNode[] = [];
  const layoutLayers: ReportGraphLayoutModel["layoutLayers"] = [];
  const graphPages: ReportGraphLayoutModel["graphPages"] = [];
  for (const [pageIndex, pagePlan] of pagePlans.entries()) {
    const pageLayers = pagePlan.layers;
    const pageId = `G${pad(pageIndex + 1, 3)}`;
    let y = pagePlan.nodeFrame.y;
    const pageNodeIds: string[] = [];
    for (const layer of pageLayers) {
      const totalWidth = layer.dedicatedPage ? graphFrame.width : layer.nodes.length * STANDARD_NODE_WIDTH + Math.max(0, layer.nodes.length - 1) * LANE_GAP;
      let x = graphFrame.x + Math.floor((graphFrame.width - totalWidth) / 2);
      const layerX = x;
      for (const [lane, measuredNode] of layer.nodes.entries()) {
        const inputNode = nodeById.get(measuredNode.id) as ReportGraphLayoutInput["nodes"][number];
        layoutNodes.push({
          box: { height: measuredNode.height, width: measuredNode.width, x, y },
          componentId: layer.componentId,
          dedicatedPage: layer.dedicatedPage,
          id: measuredNode.id,
          lane,
          layoutLayerId: layer.id,
          pageId,
          ref: measuredNode.ref,
          text: measuredNode.text,
          topologyLayerId: layer.topologyLayerId,
          type: inputNode.type,
        });
        pageNodeIds.push(measuredNode.id);
        x += measuredNode.width + LANE_GAP;
      }
      layoutLayers.push({ box: { height: layer.height, width: totalWidth, x: layerX, y }, componentId: layer.componentId, dedicatedPage: layer.dedicatedPage, height: layer.height, id: layer.id, nodeIds: [...layer.nodeIds], pageId, subLayer: layer.subLayer, topologyLayerId: layer.topologyLayerId, y });
      y += layer.height + LAYER_GAP;
    }
    if (y - LAYER_GAP > pagePlan.nodeFrame.y + pagePlan.nodeFrame.height) {
      fail("NODE_EXCEEDS_PRINTABLE_FRAME", `Page ${pageId} exceeded its connector-safe node frame`, { pageId });
    }
    graphPages.push({ connectorEndpointIds: [], edgeSegmentIds: [], headerText: "", id: pageId, layerIds: pageLayers.map((layer) => layer.id), nodeIds: pageNodeIds, number: pageIndex + 1, pageLine: { text: "", width: 0 } });
  }
  for (const page of graphPages) {
    const pageText = stableInput.presentation.language === "en"
      ? `Graph page ${page.number} of ${graphPages.length} | ${page.id}`
      : `Страница графа ${page.number} из ${graphPages.length} | ${page.id}`;
    page.headerText = `${stableInput.caseRef.title} | ${pageText}`;
    page.pageLine = { text: pageText, width: textWidth(pageText, TYPOGRAPHY.styles.header.font, TYPOGRAPHY.styles.header.sizeMilliPoints) };
    if (page.pageLine.width > headerFrame.width) fail("NODE_EXCEEDS_PRINTABLE_FRAME", "Graph page indicator exceeds the measured repeating header", { pageId: page.id, requiredWidth: page.pageLine.width });
  }

  const layoutNodeById = new Map(layoutNodes.map((node) => [node.id, node]));
  const samePageEdgeSegments: ReportGraphLayoutModel["samePageEdgeSegments"] = [];
  const crossPageConnectorPairs: ReportGraphLayoutModel["crossPageConnectorPairs"] = [];
  const layoutEdges: ReportGraphLayoutModel["edges"] = [];
  for (const [edgeIndex, edge] of stableInput.edges.entries()) {
    const from = layoutNodeById.get(edge.from) as ReportGraphLayoutNode;
    const to = layoutNodeById.get(edge.to) as ReportGraphLayoutNode;
    const cyclicRepair = topology.repairedEdgeIds.has(edge.id);
    const adjacencyRecordId = `A${pad(edgeIndex + 1, 3)}`;
    let samePageSegmentId: string | null = null;
    let connectorId: string | null = null;
    if (from.pageId === to.pageId) {
      samePageSegmentId = `S:${edge.id}:${from.pageId}`;
      const anchors = directedNodeAnchors(from, to);
      samePageEdgeSegments.push({ cyclicRepair, edgeId: edge.id, fromNodeId: edge.from, fromPoint: anchors.fromPoint, id: samePageSegmentId, pageId: from.pageId, routePoints: [], toNodeId: edge.to, toPoint: anchors.toPoint });
    } else {
      connectorId = `C${pad(crossPageConnectorPairs.length + 1, 3)}`;
      const forwardPages = from.pageId < to.pageId;
      crossPageConnectorPairs.push({
        adjacencyRecordId,
        edgeId: edge.id,
        fromPageId: from.pageId,
        id: connectorId,
        incoming: { anchor: { x: to.box.x + Math.floor(to.box.width / 2), y: forwardPages ? to.box.y : to.box.y + to.box.height }, id: `${connectorId}:IN`, nodeId: edge.to, nodeRef: to.ref, pageId: to.pageId } as ReportGraphConnectorEndpoint,
        outgoing: { anchor: { x: from.box.x + Math.floor(from.box.width / 2), y: forwardPages ? from.box.y + from.box.height : from.box.y }, id: `${connectorId}:OUT`, nodeId: edge.from, nodeRef: from.ref, pageId: from.pageId } as ReportGraphConnectorEndpoint,
        toPageId: to.pageId,
      });
    }
    layoutEdges.push({ connectorId, cyclicRepair, fromNodeId: edge.from, fromNodeRef: from.ref, fromPageId: from.pageId, id: edge.id, samePageSegmentId, toNodeId: edge.to, toNodeRef: to.ref, toPageId: to.pageId });
  }
  for (const page of graphPages) {
    page.edgeSegmentIds = samePageEdgeSegments.filter((segment) => segment.pageId === page.id).map((segment) => segment.id);
    page.connectorEndpointIds = crossPageConnectorPairs.flatMap((pair) => [pair.outgoing, pair.incoming]).filter((endpoint) => endpoint.pageId === page.id).map((endpoint) => endpoint.id);
  }

  const connectorGeometryLayout = {
    crossPageConnectorPairs,
    graphFrame,
    graphPages,
  } as ReportGraphLayoutModel;
  for (const page of graphPages) {
    const geometry = reportGraphConnectorPageGeometry(connectorGeometryLayout, page.id);
    for (const endpointGeometry of geometry.endpoints) {
      const pair = crossPageConnectorPairs.find((candidate) => candidate.incoming.id === endpointGeometry.endpointId || candidate.outgoing.id === endpointGeometry.endpointId);
      if (!pair) fail("INPUT_INVALID", "Connector geometry lost its serialized pair", { endpointId: endpointGeometry.endpointId });
      const endpoint = pair.incoming.id === endpointGeometry.endpointId ? pair.incoming : pair.outgoing;
      Object.assign(endpoint, endpointGeometry, { routePoints: [] });
    }
  }

  const nodeObstacleExpansion = REPORT_GRAPH_ROUTE_CLEARANCE
    + Math.floor(REPORT_GRAPH_NODE_STROKE_WIDTH / 2)
    + Math.floor(REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH / 2);
  const endpointObstacleExpansion = REPORT_GRAPH_ROUTE_CLEARANCE
    + Math.floor(REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH / 2);
  const routeObstacles = (pageId: string, excludedNodeIds: ReadonlySet<string>, excludedEndpointIds: ReadonlySet<string>) => [
    ...layoutNodes
      .filter((node) => node.pageId === pageId && !excludedNodeIds.has(node.id))
      .map((node) => expandBox(node.box, nodeObstacleExpansion)),
    ...crossPageConnectorPairs
      .flatMap((pair) => [pair.outgoing, pair.incoming])
      .filter((endpoint) => endpoint.pageId === pageId && !excludedEndpointIds.has(endpoint.id))
      .flatMap((endpoint) => [
        expandBox(endpoint.markerInkBox, endpointObstacleExpansion),
        expandBox(endpoint.labelInkBox, endpointObstacleExpansion),
      ]),
  ];
  for (const segment of samePageEdgeSegments) {
    segment.routePoints = orthogonalRoute(
      segment.fromPoint,
      segment.toPoint,
      graphFrame,
      routeObstacles(segment.pageId, new Set([segment.fromNodeId, segment.toNodeId]), new Set()),
      segment.id,
    );
  }
  for (const pair of crossPageConnectorPairs) {
    for (const endpoint of [pair.outgoing, pair.incoming]) {
      const incoming = endpoint.id === pair.incoming.id;
      const obstacles = routeObstacles(endpoint.pageId, new Set([endpoint.nodeId]), new Set([endpoint.id]));
      const coreRoute = incoming
        ? orthogonalRoute(endpoint.gutterExitPort, endpoint.anchor, graphFrame, obstacles, endpoint.id)
        : orthogonalRoute(endpoint.anchor, endpoint.gutterExitPort, graphFrame, obstacles, endpoint.id);
      const lanePoint = { x: endpoint.routeLaneX, y: endpoint.markerPort.y };
      endpoint.routePoints = incoming
        ? [endpoint.markerPort, lanePoint, endpoint.gutterExitPort, ...coreRoute.slice(1)]
        : [...coreRoute, lanePoint, endpoint.markerPort];
    }
  }

  const nodeTextRecords = layoutNodes.map((node) => {
    const source = nodeById.get(node.id) as ReportGraphLayoutInput["nodes"][number];
    return { detail: source.detail, id: node.ref, nodeId: node.id, text: `${node.ref} | ${NODE_TYPE_LABELS[stableInput.presentation.language][source.type]} | ${source.title}\n${source.detail}`, title: source.title, type: source.type };
  });
  const adjacencyTextRecords = stableInput.edges.map((edge, index) => {
    const fromRef = refByNode.get(edge.from) as string;
    const toRef = refByNode.get(edge.to) as string;
    const fields = [`${fromRef} -> ${toRef}`];
    if (edge.label) fields.push(`label=${edge.label}`);
    if (edge.detail) fields.push(`detail=${edge.detail}`);
    if (edge.result) fields.push(`result=${edge.result}`);
    fields.push(...edge.annotations);
    return { annotations: [...edge.annotations], detail: edge.detail, edgeId: edge.id, fromNodeRef: fromRef, id: `A${pad(index + 1, 3)}`, label: edge.label, result: edge.result, text: fields.join(" | "), toNodeRef: toRef };
  });
  const connectorTextRecords = crossPageConnectorPairs.map((pair, index) => {
    const relationship = stableInput.edges.find((edge) => edge.id === pair.edgeId) as ReportGraphLayoutInput["edges"][number];
    const relationshipText = `label=${relationship.label || "(none)"} | detail=${relationship.detail || "(none)"} | result=${relationship.result || "(none)"} | annotations=${relationship.annotations.join("; ") || "(none)"}`;
    const outText = `${pair.id} OUT | ${pair.adjacencyRecordId} | ${pair.outgoing.nodeRef} | ${pair.fromPageId} -> ${pair.toPageId} | ${relationshipText}`;
    const inText = `${pair.id} IN | ${pair.adjacencyRecordId} | ${pair.incoming.nodeRef} | ${pair.fromPageId} -> ${pair.toPageId} | ${relationshipText}`;
    const accessibleText = `${outText}\n${inText}`;
    return {
      accessibleText,
      adjacencyRecordId: pair.adjacencyRecordId,
      annotations: [...relationship.annotations],
      connectorId: pair.id,
      detail: relationship.detail,
      edgeId: pair.edgeId,
      fromNodeRef: pair.outgoing.nodeRef,
      fromPageId: pair.fromPageId,
      id: `X${pad(index + 1, 3)}`,
      inText,
      label: relationship.label,
      outText,
      result: relationship.result,
      text: accessibleText,
      toNodeRef: pair.incoming.nodeRef,
      toPageId: pair.toPageId,
    };
  });
  const rootNodeIds = topology.components.flatMap((component) => component.rootNodeIds);
  const terminalNodeIds = topology.components.flatMap((component) => component.terminalNodeIds);
  const rootNodeRefs = rootNodeIds.map((id) => refByNode.get(id) as string);
  const terminalNodeRefs = terminalNodeIds.map((id) => refByNode.get(id) as string);
  const summary: ReportGraphLayoutModel["summary"] = {
    componentCount: topology.components.length,
    disconnected: topology.components.length > 1,
    rootNodeIds,
    rootNodeRefs,
    terminalNodeIds,
    terminalNodeRefs,
    text: `Components: ${topology.components.length} | Disconnected: ${topology.components.length > 1 ? "yes" : "no"} | Roots: ${rootNodeRefs.join(", ") || "none"} | Terminals: ${terminalNodeRefs.join(", ") || "none"} | Cyclic repairs: ${topology.cyclicRepairs.length}`,
  };
  const registers: ReportGraphLayoutModel["registers"] = {
    adjacency: { id: "R-ADJACENCY", recordIds: adjacencyTextRecords.map((record) => record.id) },
    connectors: { id: "R-CONNECTORS", recordIds: connectorTextRecords.map((record) => record.id) },
    nodes: { id: "R-NODES", recordIds: nodeTextRecords.map((record) => record.id) },
    summary: { id: "R-SUMMARY", recordIds: ["SUMMARY"] },
  };
  const pageOrder: ReportGraphLayoutModel["pageOrder"] = [
    ...graphPages.map((page) => ({ id: page.id, kind: "graph" as const, register: null })),
    { id: registers.summary.id, kind: "register", register: "summary" },
    { id: registers.nodes.id, kind: "register", register: "nodes" },
    { id: registers.adjacency.id, kind: "register", register: "adjacency" },
    { id: registers.connectors.id, kind: "register", register: "connectors" },
  ];
  const topologyLayers: ReportGraphLayoutModel["topologyLayers"] = topology.topologyLayers.map((layer) => ({ ...layer, subLayerIds: layoutLayers.filter((candidate) => candidate.topologyLayerId === layer.id).map((candidate) => candidate.id) }));
  const base: Omit<ReportGraphLayoutModel, "layoutFingerprint"> = {
    adjacencyTextRecords,
    caseRef: { ...stableInput.caseRef },
    components: topology.components,
    connectorTextRecords,
    crossPageConnectorPairs,
    cyclicRepairs: topology.cyclicRepairs,
    edges: layoutEdges,
    fixedPoint: { description: "All paper, frame, box, line-height, and measured text widths are integer micrometres; font sizes are integer milli-points", millimetre: 1_000, unit: REPORT_GRAPH_FIXED_UNIT },
    footerFrame: { ...FOOTER_FRAME },
    graphFrame: { ...graphFrame },
    graphPages,
    headerFrame: { ...headerFrame },
    headerLayout,
    layoutAlgorithmVersion: REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
    layoutLayers,
    layoutRendererVersion: REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
    layoutSchemaVersion: REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
    nodeGeometry: {
      badgeTitleGap: BADGE_TITLE_GAP,
      dedicatedWidth: graphFrame.width,
      laneGap: LANE_GAP,
      layerGap: LAYER_GAP,
      maxDetailVisualLines: MAX_DETAIL_VISUAL_LINES,
      maxPortraitLanes: REPORT_GRAPH_MAX_PORTRAIT_LANES,
      paddingX: NODE_PADDING_X,
      paddingY: NODE_PADDING_Y,
      standardWidth: STANDARD_NODE_WIDTH,
      titleDetailGap: TITLE_DETAIL_GAP,
    },
    nodeTextRecords,
    nodes: layoutNodes,
    pageOrder,
    paper: { ...PAPER },
    presentation: { ...stableInput.presentation, redactedNodeIds: [...stableInput.presentation.redactedNodeIds] },
    printableFrame: { ...PRINTABLE_FRAME },
    profileRef: { ...stableInput.profileRef },
    registers,
    reportRef: { ...stableInput.reportRef },
    samePageEdgeSegments,
    summary,
    topologyLayers,
    typography: TYPOGRAPHY,
  };
  for (const [pageIndex, page] of graphPages.entries()) {
    const planned = pagePlans[pageIndex];
    const geometry = reportGraphConnectorPageGeometry(base as ReportGraphLayoutModel, page.id);
    if (geometry.nodeFrame.x !== planned.nodeFrame.x
      || geometry.nodeFrame.y !== planned.nodeFrame.y
      || geometry.nodeFrame.width !== planned.nodeFrame.width
      || geometry.nodeFrame.height !== planned.nodeFrame.height) {
      fail("INPUT_INVALID", "Connector page planning did not reach its deterministic geometry", { pageId: page.id });
    }
    for (const nodeId of page.nodeIds) {
      const node = layoutNodeById.get(nodeId) as ReportGraphLayoutNode;
      if (node.box.y < geometry.nodeFrame.y || node.box.y + node.box.height > geometry.nodeFrame.y + geometry.nodeFrame.height) {
        fail("NODE_EXCEEDS_PRINTABLE_FRAME", "Node intersects a reserved connector gutter", { nodeId, pageId: page.id });
      }
    }
  }
  const layoutFingerprint = canonicalFingerprint({ kind: FINGERPRINT_KIND, layout: orderedAsciiShape(base) });
  return { ...base, layoutFingerprint };
}
