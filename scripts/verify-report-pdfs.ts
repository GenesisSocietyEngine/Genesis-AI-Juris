import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { buildCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";
import {
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
} from "../app/report-graph-contract";
import type { CanonicalReportModel } from "../app/report-model";
import type { StudioDraft } from "../app/types";
import { reportPdfFixtures, type ReportPdfFixture } from "./tests/report-pdf-fixtures";
import {
  assertA4Portrait,
  assertPdfDocumentMetadata,
  assertExtractedText,
  compactPdfText,
  discoverPoppler,
  ensureParent,
  extractPdfText,
  inspectPdf,
  portablePath,
  renderAndInspectPdf,
  sha256File,
  splitExtractedPdfPages,
  stripPdfPageFurniture,
} from "./tests/report-pdf-qa";

type JsonRecord = Record<string, unknown>;
type Box = { x: number; y: number; width: number; height: number };
type LayoutApi = {
  REPORT_GRAPH_LAYOUT_SCHEMA_VERSION: number;
  REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION: string;
  REPORT_GRAPH_LAYOUT_RENDERER_VERSION: string;
  deriveReportGraphLayoutInput: (draft: StudioDraft, model: CanonicalReportModel, options: { language: "en" | "ru"; redactedNodeIds?: string[] }) => unknown;
  buildReportGraphLayout: (input: unknown) => unknown;
};

type VerifiedLayout = {
  raw: JsonRecord;
  fingerprint: string;
  nodePages: Record<string, string>;
  textRecords: { nodes: string[]; adjacency: string[]; connectors: string[] };
  counts: { nodes: number; edges: number; graphPages: number; crossPageEdges: number };
};

type PreparedFixture = {
  fixture: ReportPdfFixture;
  options: CaseReportOptions;
  artifacts: ReturnType<typeof buildCaseReportArtifacts>;
  layout: VerifiedLayout;
};

type FixtureResult = {
  id: string;
  family: string;
  tags: string[];
  caseId: string;
  caseType: string;
  profileId: string;
  language: "en" | "ru";
  audience: "internal" | "client";
  nodeCount: number;
  edgeCount: number;
  graphPageCount: number;
  crossPageEdgeCount: number;
  reportPages: number;
  pdfBytes: number;
  pdfSha256: string;
  caseFingerprint: string;
  reportFingerprint: string;
  layoutFingerprint: string;
  pdfPath: string;
  textPath: string;
  graphPages: Array<{ graphPageId: string; reportPage: number }>;
  pages: Array<{
    page: number;
    mediaBox: [number, number, number, number];
    rotationDegrees: number;
    pngPath: string;
    pngSha256: string;
    width: number;
    height: number;
    meanLuminance: number;
    nonWhiteFraction: number;
    nearBlackFraction: number;
  }>;
};

type ReviewSetEntry = {
  family: string;
  language: "en" | "ru";
  audience: "internal" | "client";
  fixtureId: string;
  position: "first" | "middle" | "last";
  reportPage: number;
  pngPath: string;
  pngSha256: string;
};

type VisualBaselineEntry = {
  cohort: string;
  family: string;
  language: "en" | "ru";
  audience: "internal" | "client";
  fixtureId: string;
  graphPageId: string | null;
  height: number;
  layoutFingerprint: string;
  pageRole: "graph" | "first" | "middle" | "last";
  pngPath: string;
  pngSha256: string;
  reportPage: number;
  width: number;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const ARTIFACT_ROOT = resolve(PROJECT_ROOT, ".artifacts");
const UPDATE_VISUAL_BASELINE_ENV = "REPORT_PDF_UPDATE_VISUAL_BASELINE";
const updateVisualBaselineValue = process.env[UPDATE_VISUAL_BASELINE_ENV] ?? "";
if (updateVisualBaselineValue !== "" && updateVisualBaselineValue !== "1") throw new Error(`${UPDATE_VISUAL_BASELINE_ENV} accepts only the explicit value 1`);
const UPDATE_VISUAL_BASELINE = updateVisualBaselineValue === "1";
const outputArguments = process.argv.slice(2);
if (outputArguments.length > 1 || outputArguments.some((value) => value.startsWith("--"))) throw new Error("PDF QA accepts at most one artifact output path and no mutation flags");
const requestedOutput = outputArguments[0] ?? ".artifacts/v62-report-qa";
const OUTPUT_ROOT = resolve(PROJECT_ROOT, requestedOutput);
const FIXTURE_LOCK_PATH = resolve(PROJECT_ROOT, "parity/report-graph-layout-fixtures.v1.json");
const VISUAL_BASELINE_PATH = resolve(PROJECT_ROOT, "parity/report-pdf-visual-baseline.v1.json");
const GENERATED_AT = "2026-09-01T12:00:00.000Z";
const RENDER_DPI = 96;
const REQUIRED_POPPLER_VERSION = "25.07.0";
const EPSILON = 0.02;
const REQUIRED_STRESS_FAMILIES = ["bhopal", "deep", "wide", "fan-out", "fan-in", "disconnected", "cyclic-repair", "long-title", "long-detail", "unicode-en", "unicode-ru", "max-node"] as const;
const VISUAL_SELECTION_POLICY = {
  id: "bhopal-all-graph-plus-complete-review-set",
  version: 2,
  bhopalFixtureId: "golden-bhopal-decision-memorandum",
  reviewSet: "longest fixture in every family/language/audience cohort; distinct first/middle/last report pages",
  requiredStressFamilies: REQUIRED_STRESS_FAMILIES,
} as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown, context: string): JsonRecord {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${context} must be an object`);
  return value as JsonRecord;
}

function array(value: unknown, context: string): unknown[] {
  invariant(Array.isArray(value), `${context} must be an array`);
  return value;
}

function string(value: unknown, context: string): string {
  invariant(typeof value === "string" && value.length > 0, `${context} must be a non-empty string`);
  return value;
}

function number(value: unknown, context: string): number {
  invariant(typeof value === "number" && Number.isFinite(value), `${context} must be a finite number`);
  return value;
}

function getId(value: JsonRecord, context: string) {
  return string(value.id ?? value.nodeId ?? value.edgeId ?? value.pageId, `${context}.id`);
}

function getPageId(value: JsonRecord, context: string) {
  return string(value.pageId ?? value.graphPageId, `${context}.pageId`);
}

function getBox(value: unknown, context: string): Box {
  const candidate = record(value, context);
  return {
    x: number(candidate.x, `${context}.x`),
    y: number(candidate.y, `${context}.y`),
    width: number(candidate.width, `${context}.width`),
    height: number(candidate.height, `${context}.height`),
  };
}

function within(inner: Box, outer: Box) {
  return inner.x + EPSILON >= outer.x
    && inner.y + EPSILON >= outer.y
    && inner.x + inner.width <= outer.x + outer.width + EPSILON
    && inner.y + inner.height <= outer.y + outer.height + EPSILON;
}

function textFromRecord(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const candidate = value as JsonRecord;
  if (typeof candidate.text === "string") return candidate.text;
  if (Array.isArray(candidate.lines)) return candidate.lines.map(textFromRecord).filter(Boolean).join("\n");
  if (Array.isArray(candidate.cells)) return candidate.cells.map(textFromRecord).filter(Boolean).join(" ");
  return "";
}

function textRecords(value: unknown, context: string) {
  return array(value, context).map((item, index) => {
    const text = textFromRecord(item);
    invariant(text.length > 0, `${context}[${index}] has no consumable text/text lines`);
    return text;
  });
}

function containsEllipsis(value: unknown): boolean {
  if (typeof value === "string") return value.includes("…") || value.includes("...");
  if (Array.isArray(value)) return value.some(containsEllipsis);
  if (value && typeof value === "object") return Object.values(value as JsonRecord).some(containsEllipsis);
  return false;
}

function lineMetrics(value: unknown, path = "text"): Array<{ path: string; text: string; width: number }> {
  if (Array.isArray(value)) return value.flatMap((item, index) => lineMetrics(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  const candidate = value as JsonRecord;
  const own = typeof candidate.text === "string" && typeof candidate.width === "number"
    ? [{ path, text: candidate.text, width: candidate.width }]
    : [];
  return [...own, ...Object.entries(candidate).flatMap(([key, child]) => key === "width" ? [] : lineMetrics(child, `${path}.${key}`))];
}

function nodeContentWidth(node: JsonRecord, model: JsonRecord, context: string) {
  if (node.contentBox) return getBox(node.contentBox, `${context}.contentBox`).width;
  const text = node.text && typeof node.text === "object" && !Array.isArray(node.text) ? node.text as JsonRecord : undefined;
  if (typeof text?.contentWidth === "number") return text.contentWidth;
  if (typeof node.contentWidth === "number") return node.contentWidth;
  const nodeBox = getBox(node.box, `${context}.box`);
  const geometry = record(model.nodeGeometry, "layout.nodeGeometry");
  const horizontalPadding = number(geometry.paddingX, "layout.nodeGeometry.paddingX");
  return nodeBox.width - horizontalPadding * 2;
}

function nodeIdsFromLayer(value: unknown, context: string) {
  if (Array.isArray(value)) return value.map((item, index) => typeof item === "string" ? item : getId(record(item, `${context}[${index}]`), `${context}[${index}]`));
  const layer = record(value, context);
  return array(layer.nodeIds ?? layer.nodes, `${context}.nodeIds`).map((item, index) => typeof item === "string" ? item : getId(record(item, `${context}.nodeIds[${index}]`), `${context}.nodeIds[${index}]`));
}

function verifyLayoutModel(rawLayout: unknown, draft: StudioDraft, context: string): VerifiedLayout {
  const model = record(rawLayout, `${context} layout`);
  const fingerprint = string(model.layoutFingerprint, `${context} layout.layoutFingerprint`);
  invariant(/^sha256-[a-f0-9]{64}$/.test(fingerprint), `${context} layout fingerprint is not canonical sha256`);
  invariant(!containsEllipsis({ nodes: model.nodes, nodeTextRecords: model.nodeTextRecords, adjacencyTextRecords: model.adjacencyTextRecords, connectorTextRecords: model.connectorTextRecords }), `${context} layout contains forbidden ellipsis truncation`);

  const printableFrame = getBox(model.printableFrame, `${context} layout.printableFrame`);
  const headerFrame = getBox(model.headerFrame, `${context} layout.headerFrame`);
  const graphFrame = getBox(model.graphFrame, `${context} layout.graphFrame`);
  const footerFrame = getBox(model.footerFrame, `${context} layout.footerFrame`);
  invariant(within(graphFrame, printableFrame), `${context} graph frame is outside the printable frame`);
  invariant(Math.abs(graphFrame.width - printableFrame.width) <= EPSILON, `${context} graph is not full printable width (${graphFrame.width} versus ${printableFrame.width})`);
  const paper = record(model.paper, `${context} layout.paper`);
  const paperWidth = number(paper.width, `${context} layout.paper.width`);
  const paperHeight = number(paper.height, `${context} layout.paper.height`);
  invariant(paperWidth < paperHeight, `${context} layout paper is not portrait`);
  const paperFrame = { x: 0, y: 0, width: paperWidth, height: paperHeight };
  invariant(within(printableFrame, paperFrame), `${context} printable frame is outside the paper`);
  invariant(within(headerFrame, printableFrame), `${context} header frame is outside the printable frame`);
  invariant(within(footerFrame, printableFrame), `${context} footer frame is outside the printable frame`);

  const graphPages = array(model.graphPages, `${context} layout.graphPages`).map((item, index) => record(item, `${context} layout.graphPages[${index}]`));
  invariant(graphPages.length > 0, `${context} layout has no graph pages`);
  const graphPageById = new Map(graphPages.map((page, index) => [getId(page, `${context} graphPage[${index}]`), page]));
  const pageOrderEntries = array(model.pageOrder, `${context} layout.pageOrder`).map((item, index) => record(item, `${context} layout.pageOrder[${index}]`));
  const pageOrder = pageOrderEntries.map((item, index) => getId(item, `${context} layout.pageOrder[${index}]`));
  invariant(new Set(pageOrder).size === pageOrder.length, `${context} layout.pageOrder contains duplicates`);
  for (const pageId of graphPageById.keys()) invariant(pageOrder.includes(pageId), `${context} graph page ${pageId} is absent from pageOrder`);
  invariant(pageOrderEntries.slice(0, graphPages.length).every((item) => item.kind === "graph"), `${context} pageOrder must place every graph page first`);
  invariant(pageOrderEntries.slice(graphPages.length).every((item) => item.kind === "register"), `${context} pageOrder interleaves a graph page after a register`);
  assert.deepEqual(pageOrder.slice(0, graphPages.length), graphPages.map((page, index) => getId(page, `${context} graphPage[${index}]`)), `${context} graph page order changed`);
  const registers = record(model.registers, `${context} layout.registers`);
  const expectedRegisterOrder = ["summary", "nodes", "adjacency", "connectors"].map((name) => getId(record(registers[name], `${context} layout.registers.${name}`), `${context} layout.registers.${name}`));
  assert.deepEqual(pageOrder.slice(graphPages.length), expectedRegisterOrder, `${context} complete registers must follow the full-width graph in summary/nodes/adjacency/connectors order`);

  const layoutNodes = array(model.nodes, `${context} layout.nodes`).map((item, index) => record(item, `${context} layout.nodes[${index}]`));
  invariant(layoutNodes.length === draft.nodes.length, `${context} layout has ${layoutNodes.length} nodes; draft has ${draft.nodes.length}`);
  const draftNodeIds = new Set(draft.nodes.map((item) => item.id));
  const nodeGeometry = record(model.nodeGeometry, `${context} layout.nodeGeometry`);
  const verticalPadding = number(nodeGeometry.paddingY, `${context} layout.nodeGeometry.paddingY`);
  const nodePages: Record<string, string> = {};
  const layoutNodeById = new Map<string, JsonRecord>();
  for (const [index, layoutNode] of layoutNodes.entries()) {
    const nodeId = getId(layoutNode, `${context} layout node ${index}`);
    invariant(draftNodeIds.has(nodeId), `${context} layout contains unknown node ${nodeId}`);
    invariant(!layoutNodeById.has(nodeId), `${context} layout duplicates node ${nodeId}`);
    const pageId = getPageId(layoutNode, `${context} layout node ${nodeId}`);
    const graphPage = graphPageById.get(pageId);
    invariant(graphPage, `${context} node ${nodeId} references unknown graph page ${pageId}`);
    const pageFrame = graphPage.graphFrame ? getBox(graphPage.graphFrame, `${context} graph page ${pageId}.graphFrame`) : graphFrame;
    const box = getBox(layoutNode.box, `${context} layout node ${nodeId}.box`);
    invariant(box.width > 0 && box.height > 0, `${context} node ${nodeId} has a non-positive box`);
    invariant(within(box, pageFrame), `${context} node ${nodeId} is outside graph frame on ${pageId}`);
    const declaredNodeIds = graphPage.nodeIds ?? graphPage.nodes;
    invariant(Array.isArray(declaredNodeIds), `${context} graph page ${pageId} needs nodeIds for page ownership verification`);
    invariant(nodeIdsFromLayer(declaredNodeIds, `${context} graph page ${pageId}.nodeIds`).includes(nodeId), `${context} graph page ${pageId} does not own node ${nodeId}`);
    const contentWidth = nodeContentWidth(layoutNode, model, `${context} layout node ${nodeId}`);
    invariant(contentWidth > 0, `${context} node ${nodeId} has non-positive content width`);
    const lines = lineMetrics(layoutNode.text, `${context} layout node ${nodeId}.text`);
    invariant(lines.length > 0, `${context} node ${nodeId} exposes no measurable text lines`);
    for (const line of lines) invariant(line.width <= contentWidth + EPSILON, `${context} node ${nodeId} ${line.path} width ${line.width} exceeds card content width ${contentWidth}: ${JSON.stringify(line.text)}`);
    const nodeText = record(layoutNode.text, `${context} layout node ${nodeId}.text`);
    const textHeight = number(nodeText.textHeight, `${context} layout node ${nodeId}.text.textHeight`);
    const contentHeight = box.height - verticalPadding * 2;
    invariant(textHeight <= contentHeight + EPSILON, `${context} node ${nodeId} text height ${textHeight} exceeds card content height ${contentHeight}`);
    nodePages[nodeId] = pageId;
    layoutNodeById.set(nodeId, layoutNode);
  }
  invariant([...draftNodeIds].every((id) => layoutNodeById.has(id)), `${context} layout omits a draft node`);

  const layoutLayers = array(model.layoutLayers, `${context} layout.layoutLayers`);
  const layerIds = new Set<string>();
  const nodeLayerOwnership = new Map<string, number>();
  for (const [index, value] of layoutLayers.entries()) {
    const layer = record(value, `${context} layout.layoutLayers[${index}]`);
    const layerId = getId(layer, `${context} layout.layoutLayers[${index}]`);
    invariant(!layerIds.has(layerId), `${context} duplicates layout layer ${layerId}`);
    layerIds.add(layerId);
    const layerBox = getBox(layer.box, `${context} layout layer ${layerId}.box`);
    invariant(layerBox.width > 0 && layerBox.height > 0, `${context} layout layer ${layerId} has a non-positive box`);
    invariant(within(layerBox, graphFrame), `${context} layout layer ${layerId} box is outside the graph frame`);
    const ids = nodeIdsFromLayer(layer, `${context} layout.layoutLayers[${index}]`);
    invariant(ids.length > 0, `${context} layout layer ${layerId} has no nodes`);
    const pages = new Set(ids.map((nodeId) => {
      invariant(nodePages[nodeId], `${context} layer ${index} references unknown node ${nodeId}`);
      const node = layoutNodeById.get(nodeId) as JsonRecord;
      invariant(node.layoutLayerId === layerId, `${context} node ${nodeId} declares layer ${String(node.layoutLayerId)} but ${layerId} owns it`);
      invariant(within(getBox(node.box, `${context} layout node ${nodeId}.box`), layerBox), `${context} layout layer ${layerId} box does not contain member node ${nodeId}`);
      nodeLayerOwnership.set(nodeId, (nodeLayerOwnership.get(nodeId) ?? 0) + 1);
      return nodePages[nodeId];
    }));
    invariant(pages.size === 1, `${context} layout layer ${layerId} is split across pages: ${[...pages].join(", ")}`);
    invariant(layer.pageId === [...pages][0], `${context} layout layer ${layerId} declares page ${String(layer.pageId)} but its nodes are on ${[...pages][0]}`);
    const ownerPage = graphPageById.get(String(layer.pageId));
    invariant(ownerPage, `${context} layout layer ${layerId} references unknown graph page ${String(layer.pageId)}`);
    const pageLayerIds = array(ownerPage.layerIds, `${context} graph page ${String(layer.pageId)}.layerIds`).map((item, itemIndex) => string(item, `${context} graph page ${String(layer.pageId)}.layerIds[${itemIndex}]`));
    invariant(pageLayerIds.includes(layerId), `${context} graph page ${String(layer.pageId)} does not own layout layer ${layerId}`);
  }
  for (const nodeId of draftNodeIds) invariant(nodeLayerOwnership.get(nodeId) === 1, `${context} node ${nodeId} must belong to exactly one layout layer`);

  const connectorRecordsRaw = array(model.connectorTextRecords, `${context} layout.connectorTextRecords`);
  const connectorPairs = array(model.crossPageConnectorPairs, `${context} layout.crossPageConnectorPairs`).map((item, index) => record(item, `${context} layout.crossPageConnectorPairs[${index}]`));
  const connectorPairByEdgeId = new Map<string, JsonRecord>();
  const connectorPairIds = new Set<string>();
  for (const [index, pair] of connectorPairs.entries()) {
    const edgeId = string(pair.edgeId, `${context} connector pair ${index}.edgeId`);
    const pairId = string(pair.id, `${context} connector pair ${index}.id`);
    invariant(/^C\d{3}$/u.test(pairId), `${context} connector ${pairId} does not use compact C### notation`);
    invariant(!connectorPairByEdgeId.has(edgeId), `${context} duplicates a connector pair for edge ${edgeId}`);
    invariant(!connectorPairIds.has(pairId), `${context} duplicates connector pair ${pairId}`);
    connectorPairByEdgeId.set(edgeId, pair);
    connectorPairIds.add(pairId);
  }
  const samePageSegments = array(model.samePageEdgeSegments, `${context} layout.samePageEdgeSegments`).map((item, index) => record(item, `${context} layout.samePageEdgeSegments[${index}]`));
  const segmentByEdgeId = new Map<string, JsonRecord>();
  const segmentIds = new Set<string>();
  for (const [index, segment] of samePageSegments.entries()) {
    const edgeId = string(segment.edgeId, `${context} same-page segment ${index}.edgeId`);
    const segmentId = string(segment.id, `${context} same-page segment ${index}.id`);
    invariant(!segmentByEdgeId.has(edgeId), `${context} duplicates a same-page segment for edge ${edgeId}`);
    invariant(!segmentIds.has(segmentId), `${context} duplicates same-page segment ${segmentId}`);
    segmentByEdgeId.set(edgeId, segment);
    segmentIds.add(segmentId);
  }
  const layoutEdges = array(model.edges, `${context} layout.edges`).map((item, index) => record(item, `${context} layout.edges[${index}]`));
  invariant(layoutEdges.length === draft.links.length, `${context} layout has ${layoutEdges.length} edges; draft has ${draft.links.length}`);
  const draftEdgeById = new Map(draft.links.map((item) => [item.id, item]));
  const layoutEdgeIds = new Set<string>();
  let crossPageEdges = 0;
  for (const [index, layoutEdge] of layoutEdges.entries()) {
    const edgeId = getId(layoutEdge, `${context} layout edge ${index}`);
    invariant(!layoutEdgeIds.has(edgeId), `${context} layout duplicates edge ${edgeId}`);
    layoutEdgeIds.add(edgeId);
    const source = string(layoutEdge.from ?? layoutEdge.sourceNodeId ?? layoutEdge.fromNodeId, `${context} edge ${edgeId}.from`);
    const target = string(layoutEdge.to ?? layoutEdge.targetNodeId ?? layoutEdge.toNodeId, `${context} edge ${edgeId}.to`);
    const canonical = draftEdgeById.get(edgeId);
    invariant(canonical, `${context} layout contains unknown edge ${edgeId}`);
    invariant(canonical.from === source && canonical.to === target, `${context} edge ${edgeId} direction changed: expected ${canonical.from} -> ${canonical.to}; received ${source} -> ${target}`);
    invariant(layoutNodeById.has(source) && layoutNodeById.has(target), `${context} edge ${edgeId} references a missing layout node`);
    const crossPage = nodePages[source] !== nodePages[target];
    const pair = connectorPairByEdgeId.get(edgeId);
    if (crossPage) {
      crossPageEdges += 1;
      invariant(pair, `${context} cross-page edge ${edgeId} has no connector pair`);
      const outgoing = record(pair.outgoing, `${context} connector ${edgeId}.outgoing`);
      const incoming = record(pair.incoming, `${context} connector ${edgeId}.incoming`);
      invariant(outgoing.id === `${String(pair.id)}:OUT`, `${context} cross-page edge ${edgeId} lacks its exact OUT marker`);
      invariant(incoming.id === `${String(pair.id)}:IN`, `${context} cross-page edge ${edgeId} lacks its exact IN marker`);
      invariant(outgoing.nodeId === source && incoming.nodeId === target, `${context} cross-page edge ${edgeId} marker nodes reverse canonical direction`);
      invariant(outgoing.pageId === nodePages[source] && incoming.pageId === nodePages[target], `${context} cross-page edge ${edgeId} marker pages do not match node pages`);
      invariant(pair.fromPageId === nodePages[source] && pair.toPageId === nodePages[target], `${context} cross-page edge ${edgeId} pair pages reverse or change canonical direction`);
      invariant(layoutEdge.connectorId === pair.id, `${context} cross-page edge ${edgeId} does not bind its exact connector pair`);
      invariant(layoutEdge.samePageSegmentId === null && !segmentByEdgeId.has(edgeId), `${context} cross-page edge ${edgeId} unexpectedly has a same-page segment`);
    } else {
      invariant(!pair, `${context} same-page edge ${edgeId} unexpectedly has a cross-page connector pair`);
      invariant(layoutEdge.connectorId === null && typeof layoutEdge.samePageSegmentId === "string", `${context} same-page edge ${edgeId} lacks its directed segment`);
      const segment = segmentByEdgeId.get(edgeId);
      invariant(segment, `${context} same-page edge ${edgeId} does not resolve to a rendered segment`);
      invariant(segment.id === layoutEdge.samePageSegmentId, `${context} same-page edge ${edgeId} binds segment ${String(layoutEdge.samePageSegmentId)} but resolves to ${String(segment.id)}`);
      invariant(segment.fromNodeId === source && segment.toNodeId === target, `${context} same-page segment ${String(segment.id)} reverses or changes edge ${edgeId}`);
      invariant(segment.pageId === nodePages[source], `${context} same-page segment ${String(segment.id)} is on the wrong graph page`);
    }
  }
  for (const edgeId of draftEdgeById.keys()) invariant(layoutEdgeIds.has(edgeId), `${context} layout omits edge ${edgeId}`);
  invariant(connectorPairs.length === crossPageEdges, `${context} exposes ${connectorPairs.length} connector pairs for ${crossPageEdges} cross-page edges`);
  invariant(samePageSegments.length === layoutEdges.length - crossPageEdges, `${context} exposes ${samePageSegments.length} segments for ${layoutEdges.length - crossPageEdges} same-page edges`);

  const declaredSegmentIds = graphPages.flatMap((page, pageIndex) => array(page.edgeSegmentIds, `${context} graphPage[${pageIndex}].edgeSegmentIds`).map((item, itemIndex) => string(item, `${context} graphPage[${pageIndex}].edgeSegmentIds[${itemIndex}]`)));
  invariant(new Set(declaredSegmentIds).size === declaredSegmentIds.length, `${context} graph pages duplicate a same-page segment`);
  assert.deepEqual([...declaredSegmentIds].sort(), [...segmentIds].sort(), `${context} graph-page segment ownership is incomplete`);
  const expectedEndpointIds = connectorPairs.flatMap((pair, pairIndex) => {
    const outgoing = record(pair.outgoing, `${context} connector pair ${pairIndex}.outgoing`);
    const incoming = record(pair.incoming, `${context} connector pair ${pairIndex}.incoming`);
    return [string(outgoing.id, `${context} connector pair ${pairIndex}.outgoing.id`), string(incoming.id, `${context} connector pair ${pairIndex}.incoming.id`)];
  });
  invariant(expectedEndpointIds.length === connectorPairs.length * 2 && new Set(expectedEndpointIds).size === expectedEndpointIds.length, `${context} connector pairs must expose exactly two unique endpoints each`);
  const declaredEndpointIds = graphPages.flatMap((page, pageIndex) => array(page.connectorEndpointIds, `${context} graphPage[${pageIndex}].connectorEndpointIds`).map((item, itemIndex) => string(item, `${context} graphPage[${pageIndex}].connectorEndpointIds[${itemIndex}]`)));
  invariant(new Set(declaredEndpointIds).size === declaredEndpointIds.length, `${context} graph pages duplicate a connector endpoint`);
  assert.deepEqual([...declaredEndpointIds].sort(), [...expectedEndpointIds].sort(), `${context} graph pages must render the exact OUT/IN endpoint pair for every cross-page edge`);

  const adjacencyRecordsRaw = array(model.adjacencyTextRecords, `${context} layout.adjacencyTextRecords`);
  invariant(adjacencyRecordsRaw.length === draft.links.length, `${context} adjacency register has ${adjacencyRecordsRaw.length} rows; expected ${draft.links.length}`);
  const nodeRefById = new Map(layoutNodes.map((item, index) => [getId(item, `${context} layout node ${index}`), string(item.ref, `${context} layout node ${index}.ref`)]));
  const adjacencyByEdgeId = new Map(adjacencyRecordsRaw.map((item, index) => {
    const row = record(item, `${context} adjacency row ${index}`);
    return [string(row.edgeId, `${context} adjacency row ${index}.edgeId`), row] as const;
  }));
  invariant(adjacencyByEdgeId.size === draft.links.length, `${context} adjacency register duplicates an edge row`);
  for (const link of draft.links) {
    const row = adjacencyByEdgeId.get(link.id);
    invariant(row, `${context} adjacency register omits edge ${link.id}`);
    invariant(row.fromNodeRef === nodeRefById.get(link.from) && row.toNodeRef === nodeRefById.get(link.to), `${context} adjacency row ${link.id} reverses or changes canonical direction`);
    invariant(row.label === (link.rule?.label ?? ""), `${context} adjacency row ${link.id} changes its connector label`);
    invariant(row.detail === (link.rule?.detail ?? ""), `${context} adjacency row ${link.id} changes its connector detail`);
    invariant(row.result === (link.rule?.result ?? ""), `${context} adjacency row ${link.id} changes its connector result`);
  }
  invariant(connectorRecordsRaw.length === connectorPairs.length, `${context} connector register has ${connectorRecordsRaw.length} rows for ${connectorPairs.length} pairs`);
  const connectorRecordByEdgeId = new Map<string, JsonRecord>();
  for (const [index, value] of connectorRecordsRaw.entries()) {
    const connector = record(value, `${context} connector text record ${index}`);
    const edgeId = string(connector.edgeId, `${context} connector text record ${index}.edgeId`);
    invariant(!connectorRecordByEdgeId.has(edgeId), `${context} connector register duplicates edge ${edgeId}`);
    const pair = connectorPairByEdgeId.get(edgeId);
    invariant(pair, `${context} connector register references non-cross-page edge ${edgeId}`);
    const adjacency = adjacencyByEdgeId.get(edgeId);
    invariant(adjacency, `${context} connector register references edge ${edgeId} without adjacency row`);
    const outgoing = record(pair.outgoing, `${context} connector pair ${String(pair.id)}.outgoing`);
    const incoming = record(pair.incoming, `${context} connector pair ${String(pair.id)}.incoming`);
    invariant(pair.adjacencyRecordId === adjacency.id && connector.adjacencyRecordId === adjacency.id, `${context} connector ${String(pair.id)} does not bind the canonical adjacency row`);
    invariant(connector.connectorId === pair.id, `${context} connector register edge ${edgeId} binds the wrong pair`);
    invariant(connector.fromNodeRef === outgoing.nodeRef && connector.toNodeRef === incoming.nodeRef, `${context} connector register edge ${edgeId} changes endpoint references`);
    invariant(connector.fromPageId === pair.fromPageId && connector.toPageId === pair.toPageId, `${context} connector register edge ${edgeId} changes endpoint pages`);
    connectorRecordByEdgeId.set(edgeId, connector);
  }
  invariant(connectorRecordByEdgeId.size === connectorPairs.length, `${context} connector register does not cover every cross-page edge`);
  for (const draftNode of draft.nodes) {
    const expectedIncoming = draft.links.filter((link) => link.to === draftNode.id).map((link) => link.id).sort();
    const expectedOutgoing = draft.links.filter((link) => link.from === draftNode.id).map((link) => link.id).sort();
    const nodeRef = nodeRefById.get(draftNode.id);
    const actualIncoming = [...adjacencyByEdgeId].filter(([, row]) => row.toNodeRef === nodeRef).map(([edgeId]) => edgeId).sort();
    const actualOutgoing = [...adjacencyByEdgeId].filter(([, row]) => row.fromNodeRef === nodeRef).map(([edgeId]) => edgeId).sort();
    assert.deepEqual(actualIncoming, expectedIncoming, `${context} canonical incoming adjacency changed for ${draftNode.id}`);
    assert.deepEqual(actualOutgoing, expectedOutgoing, `${context} canonical outgoing adjacency changed for ${draftNode.id}`);
  }

  const nodeText = textRecords(model.nodeTextRecords, `${context} layout.nodeTextRecords`);
  const adjacencyText = textRecords(adjacencyRecordsRaw, `${context} layout.adjacencyTextRecords`);
  const connectorText = connectorRecordsRaw.flatMap((item, index) => {
    const connector = record(item, `${context} layout.connectorTextRecords[${index}]`);
    return [string(connector.outText, `${context} connector text ${index}.outText`), string(connector.inText, `${context} connector text ${index}.inText`)];
  });
  return {
    raw: model,
    fingerprint,
    nodePages,
    textRecords: { nodes: nodeText, adjacency: adjacencyText, connectors: connectorText },
    counts: { nodes: layoutNodes.length, edges: layoutEdges.length, graphPages: graphPages.length, crossPageEdges },
  };
}

function reportOptions(fixture: ReportPdfFixture): CaseReportOptions {
  const profile = primaryCaseOutput(fixture.draft.caseType);
  const fingerprint = caseFingerprint(fixture.draft);
  const publicationFingerprint = casePublicationFingerprint(fixture.draft);
  return {
    language: fixture.language,
    profileId: profile.id,
    profileLabel: profile.label[fixture.language],
    audience: fixture.audience,
    confidentiality: "confidential",
    preparedBy: "V62 PDF QA Author",
    preparedFor: "V62 PDF QA Reviewer",
    matterReference: `V62-${fixture.id}`,
    includeEconomics: true,
    includeRegisters: true,
    includeSources: true,
    includeAuditTrail: fixture.audience === "internal",
    includeTechnicalIds: fixture.audience === "internal",
    generatedAt: GENERATED_AT,
    currentFingerprint: fingerprint,
    workspaceFingerprint: fingerprint,
    currentPublicationFingerprint: publicationFingerprint,
    workspacePublicationFingerprint: publicationFingerprint,
    privateCase: true,
    reportReceiptStorageScope: null,
    persistReportReceiptOnDevice: false,
    status: fixture.audience === "client" ? "final" : "draft",
    reviewerName: "V62 PDF QA Reviewer",
    reviewerApproved: true,
  };
}

async function pdfBuffer(definition: ReturnType<typeof buildCaseReportArtifacts>["definition"]) {
  return await new Promise<Buffer>((resolveBuffer, reject) => {
    try {
      pdfMake.createPdf(definition).getBuffer((value) => resolveBuffer(Buffer.from(value)));
    } catch (error) {
      reject(error);
    }
  });
}

function validateFixtureLock(layoutApi: LayoutApi) {
  let lock: JsonRecord;
  try {
    lock = record(JSON.parse(readFileSync(FIXTURE_LOCK_PATH, "utf8")), "report graph fixture lock");
  } catch (error) {
    throw new Error(`Report graph fixture lock is required at ${relative(PROJECT_ROOT, FIXTURE_LOCK_PATH)}; the layout core must generate it before PDF release verification`, { cause: error });
  }
  invariant(typeof lock.format === "string" && lock.format.includes("report-graph-layout"), "Report graph fixture lock has an invalid format");
  invariant(lock.schemaVersion === 1, `Report graph fixture lock schema is ${String(lock.schemaVersion)}; expected 1`);
  const versions = lock.versions && typeof lock.versions === "object" && !Array.isArray(lock.versions) ? lock.versions as JsonRecord : lock;
  invariant((versions.layoutSchemaVersion ?? versions.layoutSchema) === REPORT_GRAPH_LAYOUT_SCHEMA_VERSION, "Report graph fixture lock layout schema version is stale");
  invariant((versions.algorithmVersion ?? versions.layoutAlgorithmVersion) === REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION, "Report graph fixture lock algorithm version is stale");
  invariant((versions.rendererVersion ?? versions.layoutRendererVersion) === REPORT_GRAPH_LAYOUT_RENDERER_VERSION, "Report graph fixture lock renderer version is stale");
  const fixtures = array(lock.fixtures, "report graph fixture lock.fixtures");
  invariant(fixtures.length > 0, "Report graph fixture lock contains no fixtures");
  const fixturesById = new Map<string, JsonRecord>();

  for (const [index, value] of fixtures.entries()) {
    const fixture = record(value, `fixture lock.fixtures[${index}]`);
    const id = string(fixture.id, `fixture lock.fixtures[${index}].id`);
    invariant(!fixturesById.has(id), `Report graph fixture lock duplicates ${id}`);
    fixturesById.set(id, fixture);
    const expected = record(fixture.expected, `fixture lock ${id}.expected`);
    const layout = record(layoutApi.buildReportGraphLayout(fixture.input), `fixture lock ${id} layout`);
    invariant(layout.layoutFingerprint === expected.layoutFingerprint, `Fixture lock ${id} layout fingerprint changed: ${String(layout.layoutFingerprint)} != ${String(expected.layoutFingerprint)}`);
    const nodes = array(layout.nodes, `fixture lock ${id} layout.nodes`).map((item, nodeIndex) => record(item, `fixture lock ${id} node ${nodeIndex}`));
    const actualNodePageRows = nodes
      .map((item, nodeIndex) => ({ nodeId: getId(item, `fixture lock ${id} node ${nodeIndex}`), pageId: getPageId(item, `fixture lock ${id} node ${nodeIndex}`) }))
      .sort((left, right) => left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0);
    const actualNodePages = Object.fromEntries(actualNodePageRows.map((item) => [item.nodeId, item.pageId]));
    if (Array.isArray(expected.nodePages)) {
      assert.deepEqual(actualNodePageRows, expected.nodePages, `Fixture lock ${id} node pages changed`);
    } else assert.deepEqual(actualNodePages, expected.nodePages, `Fixture lock ${id} node pages changed`);
    if (Array.isArray(expected.connectors)) {
      const actual = array(layout.crossPageConnectorPairs, `fixture lock ${id} crossPageConnectorPairs`).map((item, pairIndex) => {
        const pair = record(item, `fixture lock ${id} connector pair ${pairIndex}`);
        const incoming = record(pair.incoming, `fixture lock ${id} connector pair ${pairIndex}.incoming`);
        const outgoing = record(pair.outgoing, `fixture lock ${id} connector pair ${pairIndex}.outgoing`);
        return {
          adjacencyRecordId: pair.adjacencyRecordId,
          edgeId: pair.edgeId,
          fromPageId: pair.fromPageId,
          id: pair.id,
          incomingId: incoming.id,
          outgoingId: outgoing.id,
          toPageId: pair.toPageId,
        };
      });
      assert.deepEqual(actual, expected.connectors, `Fixture lock ${id} connectors changed`);
    }
  }
  return {
    fixturesById,
    summary: { count: fixtures.length, sha256: sha256File(FIXTURE_LOCK_PATH), format: lock.format },
  };
}

function parityInputIdentity(value: unknown, context: string) {
  const input = record(value, context);
  const caseRef = record(input.caseRef, `${context}.caseRef`);
  const presentation = record(input.presentation, `${context}.presentation`);
  const profileRef = record(input.profileRef, `${context}.profileRef`);
  const reportRef = record(input.reportRef, `${context}.reportRef`);
  const nodes = array(input.nodes, `${context}.nodes`).map((item, index) => record(item, `${context}.nodes[${index}]`)).sort((left, right) => String(left.id).localeCompare(String(right.id), "en"));
  const edges = array(input.edges, `${context}.edges`).map((item, index) => record(item, `${context}.edges[${index}]`)).sort((left, right) => String(left.id).localeCompare(String(right.id), "en"));
  return {
    caseRef: { id: caseRef.id, title: caseRef.title, version: caseRef.version },
    edges,
    nodes,
    presentation,
    profileRef,
    reportRef: { modelRendererVersion: reportRef.modelRendererVersion, modelSchemaVersion: reportRef.modelSchemaVersion },
  };
}

function normalizeParityExternalFingerprints(value: unknown, lockedValue: unknown, context: string) {
  const normalized = record(JSON.parse(JSON.stringify(record(value, context))), `${context} clone`);
  const locked = record(lockedValue, `${context} locked value`);
  const normalizedCaseRef = record(normalized.caseRef, `${context}.caseRef`);
  const lockedCaseRef = record(locked.caseRef, `${context} locked.caseRef`);
  normalizedCaseRef.fingerprint = lockedCaseRef.fingerprint;
  const normalizedReportRef = record(normalized.reportRef, `${context}.reportRef`);
  const lockedReportRef = record(locked.reportRef, `${context} locked.reportRef`);
  normalizedReportRef.contentFingerprint = lockedReportRef.contentFingerprint;
  return normalized;
}

function assertParityFixtureIdentity(
  layoutApi: LayoutApi,
  fixture: ReportPdfFixture,
  options: CaseReportOptions,
  artifacts: ReturnType<typeof buildCaseReportArtifacts>,
  fixturesById: Map<string, JsonRecord>,
) {
  if (!fixture.parityFixtureId) return;
  const locked = fixturesById.get(fixture.parityFixtureId);
  invariant(locked, `${fixture.id} references missing parity fixture ${fixture.parityFixtureId}`);
  const lockedInput = record(locked.input, `${fixture.parityFixtureId}.input`);
  const lockedNodes = array(lockedInput.nodes, `${fixture.parityFixtureId}.input.nodes`);
  const lockedEdges = array(lockedInput.edges, `${fixture.parityFixtureId}.input.edges`);
  const lockedProfile = record(lockedInput.profileRef, `${fixture.parityFixtureId}.input.profileRef`);
  invariant(fixture.parityFixtureId === "bhopal-en", `${fixture.id} may only claim the locked bhopal-en identity`);
  invariant(lockedNodes.length === 8 && lockedEdges.length === 9, "Locked bhopal-en parity fixture must remain exactly 8 nodes and 9 edges");
  invariant(lockedProfile.id === "decision_memorandum" && options.profileId === "decision_memorandum", `${fixture.id} must use the decision_memorandum content family`);
  invariant(fixture.draft.nodes.length === 8 && fixture.draft.links.length === 9, `${fixture.id} must remain exactly 8 nodes and 9 edges`);
  const actualInput = layoutApi.deriveReportGraphLayoutInput(fixture.draft, artifacts.reportModel, { language: fixture.language });
  assert.deepEqual(parityInputIdentity(actualInput, `${fixture.id} derived layout input`), parityInputIdentity(lockedInput, `${fixture.parityFixtureId} locked input`), `${fixture.id} no longer has the exact semantic input identity of ${fixture.parityFixtureId}`);
  const normalizedInput = normalizeParityExternalFingerprints(actualInput, lockedInput, `${fixture.id} derived layout input`);
  assert.deepEqual(normalizedInput, lockedInput, `${fixture.id} differs from ${fixture.parityFixtureId} beyond the two governed external fingerprint values`);
  const productionReplay = layoutApi.buildReportGraphLayout(actualInput);
  assert.deepEqual(productionReplay, artifacts.layoutModel, `${fixture.id} production report did not use its exact derived layout input`);
  const lockedLayout = layoutApi.buildReportGraphLayout(lockedInput);
  const normalizedLayout = layoutApi.buildReportGraphLayout(normalizedInput);
  assert.deepEqual(normalizedLayout, lockedLayout, `${fixture.id} normalized layout is not completely identical to ${fixture.parityFixtureId}`);
}

async function loadLayoutApi(): Promise<LayoutApi> {
  const modulePath = "../app/report-graph-layout";
  let loaded: unknown;
  try {
    loaded = await import(modulePath);
  } catch (error) {
    throw new Error("Report graph layout core is not available at app/report-graph-layout.ts; finish the v62 layout core before running the PDF release harness", { cause: error });
  }
  const api = record(loaded, "report graph layout module") as LayoutApi & JsonRecord;
  invariant(typeof api.deriveReportGraphLayoutInput === "function", "report-graph-layout must export deriveReportGraphLayoutInput");
  invariant(typeof api.buildReportGraphLayout === "function", "report-graph-layout must export buildReportGraphLayout");
  invariant(api.REPORT_GRAPH_LAYOUT_SCHEMA_VERSION === REPORT_GRAPH_LAYOUT_SCHEMA_VERSION, "report-graph-layout schema export does not match report-graph-contract");
  invariant(api.REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION === REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION, "report-graph-layout algorithm export does not match report-graph-contract");
  invariant(api.REPORT_GRAPH_LAYOUT_RENDERER_VERSION === REPORT_GRAPH_LAYOUT_RENDERER_VERSION, "report-graph-layout renderer export does not match report-graph-contract");
  return api;
}

function assertSafeOutputRoot() {
  const prefix = `${ARTIFACT_ROOT}${sep}`;
  invariant(OUTPUT_ROOT.startsWith(prefix) && OUTPUT_ROOT !== ARTIFACT_ROOT, `PDF QA output must be a child of ${ARTIFACT_ROOT}; received ${isAbsolute(requestedOutput) ? requestedOutput : resolve(PROJECT_ROOT, requestedOutput)}`);
}

function cleanOutputRoot() {
  assertSafeOutputRoot();
  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUTPUT_ROOT, { recursive: true });
}

function assertReleasePoppler(tools: ReturnType<typeof discoverPoppler>) {
  for (const name of ["pdfinfo", "pdftotext", "pdftoppm"] as const) {
    const expected = `${name} version ${REQUIRED_POPPLER_VERSION}`;
    invariant(tools.versions[name] === expected, `Release PDF QA requires exact ${expected}; received ${JSON.stringify(tools.versions[name])}`);
  }
}

function prepareFixture(layoutApi: LayoutApi, fixture: ReportPdfFixture, fixturesById: Map<string, JsonRecord>): PreparedFixture {
  const options = reportOptions(fixture);
  const artifacts = buildCaseReportArtifacts(fixture.draft, options);
  assertParityFixtureIdentity(layoutApi, fixture, options, artifacts, fixturesById);
  const layout = verifyLayoutModel(artifacts.layoutModel, fixture.draft, fixture.id);
  return { fixture, options, artifacts, layout };
}

function locateGraphReportPages(layout: VerifiedLayout, extractedPages: string[], fixture: ReportPdfFixture) {
  const graphPages = array(layout.raw.graphPages, `${fixture.id} layout.graphPages`).map((item, index) => record(item, `${fixture.id} layout.graphPages[${index}]`));
  return graphPages.map((page, index) => {
    const graphPageId = getId(page, `${fixture.id} graph page ${index}`);
    const marker = textFromRecord(page.pageLine);
    invariant(marker.length > 0, `${fixture.id} graph page ${graphPageId} has no unique page line`);
    const compactMarker = compactPdfText(marker, fixture.language);
    const matchingPages = extractedPages.flatMap((text, pageIndex) => compactPdfText(text, fixture.language).includes(compactMarker) ? [pageIndex + 1] : []);
    invariant(matchingPages.length === 1, `${fixture.id} graph page ${graphPageId} marker ${JSON.stringify(marker)} occurs on ${matchingPages.length} report pages`);
    return { graphPageId, reportPage: matchingPages[0] };
  });
}

async function verifyFixture(prepared: PreparedFixture, tools: ReturnType<typeof discoverPoppler>): Promise<FixtureResult> {
  const { fixture, options, artifacts, layout } = prepared;
  const model = artifacts.reportModel;
  const pdfPath = resolve(OUTPUT_ROOT, "pdf", `${fixture.id}.pdf`);
  const textPath = resolve(OUTPUT_ROOT, "text", `${fixture.id}.txt`);
  ensureParent(pdfPath);
  ensureParent(textPath);
  const bytes = await pdfBuffer(artifacts.definition);
  invariant(bytes.length >= 10_000, `${fixture.id} PDF is unexpectedly small (${bytes.length} bytes)`);
  writeFileSync(pdfPath, bytes);
  const info = inspectPdf(tools, pdfPath);
  const expectedTitle = artifacts.definition.info?.title;
  invariant(typeof expectedTitle === "string" && expectedTitle.trim().length > 0, `${fixture.id} production definition has no document Title`);
  assertPdfDocumentMetadata(info, bytes, expectedTitle, fixture.language === "en" ? "en-GB" : "ru-RU", pdfPath);
  assertA4Portrait(info, pdfPath);
  if (fixture.minimumPages !== undefined) invariant(info.pages >= fixture.minimumPages, `${fixture.id} has ${info.pages} report pages; expected at least ${fixture.minimumPages}`);
  const extracted = extractPdfText(tools, pdfPath, textPath);
  const extractedPages = splitExtractedPdfPages(extracted, info.pages, pdfPath);
  invariant(!extracted.includes("SECRET RAW PROMPT"), `${fixture.id} leaked the raw prompt marker`);
  invariant(!containsEllipsis(extracted), `${fixture.id} extracted PDF text contains a forbidden ellipsis`);
  assertExtractedText(extracted, fixture.draft.caseId, `${fixture.id} case ID`, fixture.language);
  for (const item of fixture.draft.nodes) assertExtractedText(extracted, item.title, `${fixture.id} node ${item.id} title`, fixture.language);
  for (const item of fixture.draft.links) if (item.rule?.label) assertExtractedText(extracted, item.rule.label, `${fixture.id} connector ${item.id} label`, fixture.language);
  const furnitureFreeExtracted = stripPdfPageFurniture(extracted);
  for (const [index, value] of layout.textRecords.nodes.entries()) assertExtractedText(furnitureFreeExtracted, value, `${fixture.id} complete node text record ${index}`, fixture.language);
  for (const [index, value] of layout.textRecords.adjacency.entries()) assertExtractedText(extracted, value, `${fixture.id} exact adjacency text record ${index}`, fixture.language);
  for (const [index, value] of layout.textRecords.connectors.entries()) assertExtractedText(extracted, value, `${fixture.id} exact connector text record ${index}`, fixture.language);

  const rendered = renderAndInspectPdf(tools, pdfPath, resolve(OUTPUT_ROOT, "png", fixture.id), info, RENDER_DPI);
  const graphPages = locateGraphReportPages(layout, extractedPages, fixture);
  return {
    id: fixture.id,
    family: fixture.family,
    tags: fixture.tags,
    caseId: fixture.draft.caseId,
    caseType: fixture.draft.caseType?.id ?? "general_advisory",
    profileId: options.profileId,
    language: fixture.language,
    audience: fixture.audience,
    nodeCount: fixture.draft.nodes.length,
    edgeCount: fixture.draft.links.length,
    graphPageCount: layout.counts.graphPages,
    crossPageEdgeCount: layout.counts.crossPageEdges,
    reportPages: info.pages,
    pdfBytes: bytes.length,
    pdfSha256: createHash("sha256").update(bytes).digest("hex"),
    caseFingerprint: caseFingerprint(fixture.draft),
    reportFingerprint: model.contentFingerprint,
    layoutFingerprint: layout.fingerprint,
    pdfPath: portablePath(OUTPUT_ROOT, pdfPath),
    textPath: portablePath(OUTPUT_ROOT, textPath),
    graphPages,
    pages: rendered.map((page, index) => ({
      page: page.page,
      mediaBox: info.pageBoxes[index].mediaBox,
      rotationDegrees: info.pageBoxes[index].rotationDegrees,
      pngPath: portablePath(OUTPUT_ROOT, page.path),
      pngSha256: page.sha256,
      width: page.width,
      height: page.height,
      meanLuminance: page.meanLuminance,
      nonWhiteFraction: page.nonWhiteFraction,
      nearBlackFraction: page.nearBlackFraction,
    })),
  };
}

function buildReviewSet(results: FixtureResult[]) {
  const byCohort = new Map<string, FixtureResult[]>();
  for (const result of results) {
    const key = `${result.family}\u0000${result.language}\u0000${result.audience}`;
    byCohort.set(key, [...(byCohort.get(key) ?? []), result]);
  }
  const review: ReviewSetEntry[] = [];
  for (const [, candidates] of [...byCohort].sort(([left], [right]) => left.localeCompare(right))) {
    const fixture = [...candidates].sort((left, right) => right.reportPages - left.reportPages || left.id.localeCompare(right.id))[0];
    const positions = [
      ["first", 0],
      ["middle", Math.floor((fixture.pages.length - 1) / 2)],
      ["last", fixture.pages.length - 1],
    ] as const;
    const seen = new Set<number>();
    for (const [position, index] of positions) {
      if (seen.has(index)) continue;
      seen.add(index);
      const source = resolve(OUTPUT_ROOT, fixture.pages[index].pngPath);
      const target = resolve(OUTPUT_ROOT, "review", `${fixture.family}-${fixture.language}-${fixture.audience}-${position}-p${String(fixture.pages[index].page).padStart(3, "0")}.png`);
      ensureParent(target);
      copyFileSync(source, target);
      review.push({ family: fixture.family, language: fixture.language, audience: fixture.audience, fixtureId: fixture.id, position, reportPage: fixture.pages[index].page, pngPath: portablePath(OUTPUT_ROOT, target), pngSha256: sha256File(target) });
    }
  }
  return review;
}

function visualBaselineEntry(
  result: FixtureResult,
  cohort: VisualBaselineEntry["cohort"],
  pageRole: VisualBaselineEntry["pageRole"],
  reportPage: number,
  graphPageId: string | null = null,
): VisualBaselineEntry {
  const page = result.pages.find((candidate) => candidate.page === reportPage);
  invariant(page, `${result.id} has no rendered PNG for baseline page ${reportPage}`);
  const repositoryPngPath = portablePath(PROJECT_ROOT, resolve(OUTPUT_ROOT, page.pngPath));
  invariant(!isAbsolute(repositoryPngPath) && !repositoryPngPath.startsWith("../") && !repositoryPngPath.includes(":"), `${result.id} baseline PNG path must remain repository-portable: ${repositoryPngPath}`);
  return {
    cohort,
    family: result.family,
    language: result.language,
    audience: result.audience,
    fixtureId: result.id,
    graphPageId,
    height: page.height,
    layoutFingerprint: result.layoutFingerprint,
    pageRole,
    pngPath: repositoryPngPath,
    pngSha256: page.pngSha256,
    reportPage,
    width: page.width,
  };
}

function visualBaselineEntryKey(value: unknown, context: string) {
  const entry = record(value, context);
  const cohort = string(entry.cohort, `${context}.cohort`);
  const fixtureId = string(entry.fixtureId, `${context}.fixtureId`);
  const pageRole = string(entry.pageRole, `${context}.pageRole`);
  if (pageRole === "graph") return `${cohort}|${fixtureId}|graph|${string(entry.graphPageId, `${context}.graphPageId`)}`;
  return `${cohort}|${fixtureId}|${pageRole}`;
}

function selectVisualBaselineEntries(results: FixtureResult[], reviewSet: ReviewSetEntry[]) {
  const entries: VisualBaselineEntry[] = [];
  const bhopal = results.filter((result) => result.id === VISUAL_SELECTION_POLICY.bhopalFixtureId);
  invariant(bhopal.length === 1, `Visual baseline needs exactly one ${VISUAL_SELECTION_POLICY.bhopalFixtureId} result`);
  invariant(bhopal[0].graphPages.length === bhopal[0].graphPageCount && bhopal[0].graphPages.length > 0, "Bhopal visual baseline must include a located report page for every graph page");
  for (const page of bhopal[0].graphPages) entries.push(visualBaselineEntry(bhopal[0], "bhopal", "graph", page.reportPage, page.graphPageId));

  invariant(reviewSet.length > 0, "Visual baseline requires the complete human review set");
  for (const review of reviewSet) {
    const matches = results.filter((result) => result.id === review.fixtureId);
    invariant(matches.length === 1, `Visual review entry needs exactly one ${review.fixtureId} result`);
    const result = matches[0];
    invariant(result.family === review.family && result.language === review.language && result.audience === review.audience, `Visual review metadata drifted for ${review.fixtureId}`);
    const entry = visualBaselineEntry(result, `review:${review.family}:${review.language}:${review.audience}`, review.position, review.reportPage);
    invariant(entry.pngSha256 === review.pngSha256, `Visual review copy hash drifted for ${review.fixtureId} page ${review.reportPage}`);
    entries.push(entry);
  }
  for (const family of REQUIRED_STRESS_FAMILIES) {
    invariant(reviewSet.some((entry) => entry.family === family), `Visual review set does not represent required stress family ${family}`);
    invariant(entries.some((entry) => entry.family === family && entry.pageRole !== "graph"), `Visual baseline does not hash required stress family ${family}`);
  }
  const keys = entries.map((entry, index) => visualBaselineEntryKey(entry, `current visual baseline entry ${index}`));
  invariant(new Set(keys).size === keys.length, "Current visual baseline selection contains duplicate roles");
  invariant(entries.length === bhopal[0].graphPageCount + reviewSet.length, `Visual baseline selected ${entries.length} pages; expected all ${bhopal[0].graphPageCount} Bhopal graph pages plus all ${reviewSet.length} review pages`);
  return entries;
}

function buildVisualBaseline(results: FixtureResult[], reviewSet: ReviewSetEntry[], tools: ReturnType<typeof discoverPoppler>, fixtureLockSha256: string) {
  invariant(results.length === 47, `Visual baseline requires the complete 47-PDF corpus; received ${results.length}`);
  return {
    format: "genesis-juris-report-pdf-visual-baseline",
    schemaVersion: 1,
    baselineVersion: 1,
    selectionPolicy: VISUAL_SELECTION_POLICY,
    layoutContract: {
      schemaVersion: REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
      algorithmVersion: REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
      rendererVersion: REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
      fixtureLockPath: relative(PROJECT_ROOT, FIXTURE_LOCK_PATH).split("\\").join("/"),
      fixtureLockSha256,
    },
    rasterizer: {
      engine: "Poppler pdftoppm",
      binary: "pdftoppm",
      binaryPathPolicy: "runtime-discovered; absolute workstation path intentionally excluded",
      requiredSuiteVersion: REQUIRED_POPPLER_VERSION,
      format: "png",
      dpi: RENDER_DPI,
      versions: tools.versions,
    },
    runtime: { platform: process.platform, architecture: process.arch },
    entries: selectVisualBaselineEntries(results, reviewSet),
  };
}

function verifyOrUpdateVisualBaseline(candidate: ReturnType<typeof buildVisualBaseline>) {
  const serialized = `${JSON.stringify(candidate, null, 2)}\n`;
  if (UPDATE_VISUAL_BASELINE) {
    invariant(dirname(VISUAL_BASELINE_PATH) === resolve(PROJECT_ROOT, "parity"), "Visual baseline update target escaped the parity directory");
    writeFileSync(VISUAL_BASELINE_PATH, serialized);
    const persisted = JSON.parse(readFileSync(VISUAL_BASELINE_PATH, "utf8"));
    assert.deepEqual(persisted, candidate, "Persisted visual baseline did not round-trip exactly");
    return { mode: "updated" as const, entries: candidate.entries.length, sha256: sha256File(VISUAL_BASELINE_PATH) };
  }

  let expected: JsonRecord;
  try {
    expected = record(JSON.parse(readFileSync(VISUAL_BASELINE_PATH, "utf8")), "PDF visual baseline");
  } catch (error) {
    throw new Error(`Versioned PDF visual baseline is required at ${relative(PROJECT_ROOT, VISUAL_BASELINE_PATH)}; normal verification never creates it. Run the full reviewed corpus once with ${UPDATE_VISUAL_BASELINE_ENV}=1 only after intentional visual approval`, { cause: error });
  }
  const expectedEntries = array(expected.entries, "PDF visual baseline.entries");
  invariant(expectedEntries.length > 0, `PDF visual baseline has no hashes; populate it explicitly with ${UPDATE_VISUAL_BASELINE_ENV}=1 after the final layout is approved`);
  const expectedMetadata = { ...expected };
  delete expectedMetadata.entries;
  const currentMetadata: JsonRecord = { ...candidate };
  delete currentMetadata.entries;
  assert.deepEqual(expectedMetadata, currentMetadata, `PDF visual baseline metadata changed; inspect the final corpus before using ${UPDATE_VISUAL_BASELINE_ENV}=1`);
  const expectedByKey = new Map<string, JsonRecord>();
  for (const [index, value] of expectedEntries.entries()) {
    const entry = record(value, `PDF visual baseline.entries[${index}]`);
    const key = visualBaselineEntryKey(entry, `PDF visual baseline.entries[${index}]`);
    invariant(!expectedByKey.has(key), `PDF visual baseline duplicates ${key}`);
    expectedByKey.set(key, entry);
  }
  const currentByKey = new Map(candidate.entries.map((entry, index) => [visualBaselineEntryKey(entry, `current visual baseline entry ${index}`), entry]));
  assert.deepEqual([...expectedByKey.keys()].sort(), [...currentByKey.keys()].sort(), `PDF visual baseline page selection changed; inspect before using ${UPDATE_VISUAL_BASELINE_ENV}=1`);
  for (const [key, current] of currentByKey) assert.deepEqual(expectedByKey.get(key), current, `PDF visual regression for ${key}; PNG hash or governed page metadata changed`);
  return { mode: "verified" as const, entries: candidate.entries.length, sha256: sha256File(VISUAL_BASELINE_PATH) };
}

async function main() {
  assertSafeOutputRoot();
  const layoutApi = await loadLayoutApi();
  const fixtureLockValidation = validateFixtureLock(layoutApi);
  const fixtureLock = fixtureLockValidation.summary;
  const fixtures = reportPdfFixtures();
  invariant(fixtures.length === 47, `Expected exactly 47 release PDFs; received ${fixtures.length}`);
  invariant(fixtures.filter((item) => item.family === "golden").length === 32, "Expected exactly 32 bilingual internal/client goldens");
  invariant(fixtures.filter((item) => item.family === "long-content").length === 2, "Expected exactly two long-content reports");
  const bhopalGoldens = fixtures.filter((item) => item.parityFixtureId === "bhopal-en");
  invariant(bhopalGoldens.length === 1 && bhopalGoldens[0].family === "bhopal" && bhopalGoldens[0].tags.includes("golden") && bhopalGoldens[0].tags.includes("release-blocking"), "Expected exactly one release-blocking Bhopal golden bound to bhopal-en");
  for (const family of REQUIRED_STRESS_FAMILIES) invariant(fixtures.some((item) => item.family === family), `Missing release-blocking ${family} fixture`);
  const preparedFixtures = fixtures.map((fixture) => {
    try {
      return prepareFixture(layoutApi, fixture, fixtureLockValidation.fixturesById);
    } catch (error) {
      throw new Error(`Layout preflight ${fixture.id} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  });
  const tools = discoverPoppler(PROJECT_ROOT);
  assertReleasePoppler(tools);
  cleanOutputRoot();
  (pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);

  const results: FixtureResult[] = [];
  for (const prepared of preparedFixtures) {
    const { fixture } = prepared;
    try {
      results.push(await verifyFixture(prepared, tools));
      console.log(`PASS ${fixture.id}`);
    } catch (error) {
      throw new Error(`PDF fixture ${fixture.id} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  const reviewSet = buildReviewSet(results);
  const visualBaselineCandidate = buildVisualBaseline(results, reviewSet, tools, fixtureLock.sha256);
  const families = [...new Set(results.map((item) => item.family))].sort().map((family) => {
    const members = results.filter((item) => item.family === family);
    return { family, fixtures: members.length, reportPages: members.reduce((sum, item) => sum + item.reportPages, 0), fixtureIds: members.map((item) => item.id) };
  });
  const manifest = {
    format: "genesis-juris-v62-report-pdf-qa",
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    layout: {
      schemaVersion: REPORT_GRAPH_LAYOUT_SCHEMA_VERSION,
      algorithmVersion: REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION,
      rendererVersion: REPORT_GRAPH_LAYOUT_RENDERER_VERSION,
      fixtureLock,
    },
    poppler: tools.versions,
    render: { format: "png", dpi: RENDER_DPI, pageSelection: "all", sanity: ["A4 portrait dimensions", "nonblank", "not black", "sha256"] },
    counts: {
      fixtures: results.length,
      golden: results.filter((item) => item.family === "golden").length,
      longContent: results.filter((item) => item.family === "long-content").length,
      stress: results.filter((item) => item.tags.includes("stress")).length,
      reportPages: results.reduce((sum, item) => sum + item.reportPages, 0),
      renderedPngs: results.reduce((sum, item) => sum + item.pages.length, 0),
    },
    families,
    reviewSet,
    fixtures: results,
  };
  const manifestPath = resolve(OUTPUT_ROOT, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  invariant(compactPdfText(JSON.stringify(results)).length > 0, "Manifest unexpectedly contains no fixture data");
  const visualCandidatePath = resolve(OUTPUT_ROOT, "visual-baseline-candidate.json");
  writeFileSync(visualCandidatePath, `${JSON.stringify(visualBaselineCandidate, null, 2)}\n`);
  console.log(`CANDIDATE ${relative(PROJECT_ROOT, visualCandidatePath)} hashes every review-set page plus every Bhopal graph page`);
  const visualBaseline = verifyOrUpdateVisualBaseline(visualBaselineCandidate);
  console.log(`${visualBaseline.mode === "updated" ? "UPDATED" : "PASS"} visual baseline ${relative(PROJECT_ROOT, VISUAL_BASELINE_PATH)} (${visualBaseline.entries} PNGs, ${visualBaseline.sha256})`);
  console.log(`PASS ${results.length} PDFs, ${manifest.counts.reportPages} pages and ${manifest.counts.renderedPngs} rendered PNGs in ${relative(PROJECT_ROOT, OUTPUT_ROOT)}`);
  console.log(`REVIEW ${reviewSet.length} representative first/middle/last PNGs under ${relative(PROJECT_ROOT, resolve(OUTPUT_ROOT, "review"))}`);
}

await main();
