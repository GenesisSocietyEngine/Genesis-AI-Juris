import type { Content } from "pdfmake/interfaces";
import type { CaseReportOptions } from "./case-report";
import rawFontMetrics from "./report-graph-font-metrics.v1.json";
import {
  REPORT_GRAPH_CONNECTOR_ID_BASELINE_OFFSET,
  REPORT_GRAPH_CONNECTOR_ID_SIZE_MILLI_POINTS,
  REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH,
  REPORT_GRAPH_CONNECTOR_MARKER_RADIUS,
  REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH,
  REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH,
  REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS,
  REPORT_GRAPH_NODE_STROKE_WIDTH,
  type ReportGraphLayoutModel,
  type ReportGraphLayoutNode,
} from "./report-graph-layout";
import type { StudioNodeType } from "./types";

const palette = {
  ink: "#10202c",
  navy: "#163445",
  cyan: "#3d9daa",
  gold: "#c79b3b",
  line: "#b6c4c8",
  mist: "#f5f8f8",
  red: "#a34444",
};

const tr = (language: CaseReportOptions["language"], en: string, ru: string) => language === "en" ? en : ru;
const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MICROMETRES_PER_POINT = 25_400 / 72;
const micrometresToPoints = (value: number) => value / MICROMETRES_PER_POINT;
const milliPointsToMicrometres = (value: number) => value * 25.4 / 72;
const nodeStripe = (type: StudioNodeType) => type === "outcome" ? "#7b68a8" : type === "decision" ? palette.gold : type === "tax_rule" ? "#c27847" : palette.cyan;
type RegisterFontKey = "medium" | "regular";
type RegisterFontMetric = {
  advances: Record<string, number>;
  defaultAdvance: number;
  maxPositiveShapingAdjustments: Record<string, number>;
  maximumInkOverhang: { left: number; right: number };
  unitsPerEm: number;
};
const REGISTER_FONT_METRICS = rawFontMetrics as {
  unitPerEm: number;
  fonts: Record<RegisterFontKey, RegisterFontMetric>;
};
const REGISTER_PAGE_MARGIN_POINTS = 39.685;
const REGISTER_CONTENT_WIDTH_POINTS = micrometresToPoints(210_000) - REGISTER_PAGE_MARGIN_POINTS * 2;
const REGISTER_CONTENT_HEIGHT_POINTS = micrometresToPoints(297_000) - REGISTER_PAGE_MARGIN_POINTS * 2;
const REGISTER_ATOMIC_HEIGHT_LIMIT_POINTS = REGISTER_CONTENT_HEIGHT_POINTS - 80;
const REGISTER_TYPE_SIZE_POINTS = 7;
const REGISTER_TYPE_LINE_HEIGHT = 1.25;
const REGISTER_TYPE_LINE_ALLOWANCE = 4;
const REGISTER_DETAIL_SIZE_POINTS = 7.3;
const REGISTER_DETAIL_LINE_HEIGHT = 1.18;

function registerParagraphWidthPoints(text: string, fontKey: RegisterFontKey, sizePoints: number, characterSpacing: number) {
  const scalars = [...text];
  const font = REGISTER_FONT_METRICS.fonts[fontKey];
  const advance = scalars.reduce((sum, scalar) => {
    const key = String(scalar.codePointAt(0));
    return sum + (font.advances[key] ?? font.defaultAdvance) + (font.maxPositiveShapingAdjustments[key] ?? 0);
  }, 0);
  return advance * sizePoints / font.unitsPerEm + Math.max(0, scalars.length - 1) * characterSpacing;
}

function conservativeRegisterLineCount(text: string, fontKey: RegisterFontKey, sizePoints: number, characterSpacing = 0) {
  return text.replace(/\r\n?/g, "\n").split("\n").reduce((total, paragraph) => {
    const measuredLines = Math.max(1, Math.ceil(registerParagraphWidthPoints(paragraph, fontKey, sizePoints, characterSpacing) / REGISTER_CONTENT_WIDTH_POINTS));
    // Greedy word wrapping can leave a line partially occupied. Doubling the
    // exact-width lower bound is a deterministic upper allowance: adjacent
    // wrapped lines together consume more than one full line of measured text.
    return total + measuredLines * 2;
  }, 0);
}

function registerEntryCanRemainAtomic(detailText: string, bottomMargin: number, leadingDetailLineAllowance = 0) {
  const conservativeHeight = REGISTER_TYPE_LINE_ALLOWANCE * REGISTER_TYPE_SIZE_POINTS * REGISTER_TYPE_LINE_HEIGHT
    + (conservativeRegisterLineCount(detailText, "regular", REGISTER_DETAIL_SIZE_POINTS) + leadingDetailLineAllowance)
      * REGISTER_DETAIL_SIZE_POINTS * REGISTER_DETAIL_LINE_HEIGHT
    + bottomMargin;
  return conservativeHeight <= REGISTER_ATOMIC_HEIGHT_LIMIT_POINTS;
}

function svgPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) throw new Error("Report graph route requires at least two points");
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

function svgLine(
  value: string,
  x: number,
  y: number,
  sizeMilliPoints: number,
  color: string,
  font: "medium" | "regular" = "regular",
  anchor: "start" | "middle" | "end" = "start",
  reserveInk = true,
) {
  const medium = font === "medium";
  const metric = REGISTER_FONT_METRICS.fonts[font];
  const inkLeft = reserveInk && anchor === "start"
    ? Math.ceil(metric.maximumInkOverhang.left * sizeMilliPoints * 25_400 / (metric.unitsPerEm * 72_000))
    : 0;
  return `<text x="${x + inkLeft}" y="${y}" font-family="Roboto" font-size="${milliPointsToMicrometres(sizeMilliPoints)}" font-weight="${medium ? "bold" : "normal"}" data-font-face="${medium ? "Roboto-Medium" : "Roboto-Regular"}" fill="${color}" text-anchor="${anchor}">${xml(value)}</text>`;
}

function svgNode(node: ReportGraphLayoutNode, layout: ReportGraphLayoutModel) {
  const styles = layout.typography.styles;
  const paddingX = layout.nodeGeometry.paddingX;
  const paddingY = layout.nodeGeometry.paddingY;
  let cursor = node.box.y + paddingY;
  const textX = node.box.x + paddingX;
  const lines: string[] = [];
  lines.push(svgLine(node.text.badge.text, textX, cursor + styles.badge.lineHeight * 0.78, styles.badge.sizeMilliPoints, palette.cyan, "medium"));
  cursor += styles.badge.lineHeight + layout.nodeGeometry.badgeTitleGap;
  for (const line of node.text.title.lines) {
    lines.push(svgLine(line.text, textX, cursor + styles.title.lineHeight * 0.78, styles.title.sizeMilliPoints, palette.navy, "medium"));
    cursor += styles.title.lineHeight;
  }
  if (node.text.detail.displayedLines.length || node.text.detail.referenceLine) cursor += layout.nodeGeometry.titleDetailGap;
  for (const line of node.text.detail.displayedLines) {
    lines.push(svgLine(line.text, textX, cursor + styles.detail.lineHeight * 0.78, styles.detail.sizeMilliPoints, palette.ink));
    cursor += styles.detail.lineHeight;
  }
  if (node.text.detail.referenceLine) {
    lines.push(svgLine(node.text.detail.referenceLine.text, textX, cursor + styles.detailReference.lineHeight * 0.78, styles.detailReference.sizeMilliPoints, palette.red, "medium"));
  }
  return `<g data-node-id="${xml(node.id)}"><rect x="${node.box.x}" y="${node.box.y}" width="${node.box.width}" height="${node.box.height}" rx="1200" fill="#ffffff" stroke="${palette.line}" stroke-width="${REPORT_GRAPH_NODE_STROKE_WIDTH}"/><rect x="${node.box.x}" y="${node.box.y}" width="1800" height="${node.box.height}" rx="900" fill="${nodeStripe(node.type)}"/>${lines.join("")}</g>`;
}

/** Render one locked layout page. Its viewBox is the complete A4 portrait
 * printable frame, so pdfmake cannot crop or independently re-layout nodes. */
export function caseReportGraphLayoutSvg(
  layout: ReportGraphLayoutModel,
  pageId: string,
  language: CaseReportOptions["language"],
) {
  const page = layout.graphPages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Unknown report graph page ${pageId}`);
  const nodes = layout.nodes.filter((node) => node.pageId === page.id);
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const paths = layout.samePageEdgeSegments.filter((segment) => segment.pageId === page.id).map((segment) => {
    if (!byId.has(segment.fromNodeId) || !byId.has(segment.toNodeId)) throw new Error(`Unknown node for edge segment ${segment.id}`);
    const repairStyle = segment.cyclicRepair ? " stroke-dasharray=\"1800 1200\"" : "";
    return `<path data-edge-id="${xml(segment.edgeId)}" d="${svgPath(segment.routePoints)}" fill="none" stroke="${palette.cyan}" stroke-width="${REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH}" marker-end="url(#arrow)" opacity="0.9"${repairStyle}/>`;
  });
  const endpoints = page.connectorEndpointIds.map((id) => {
    const pair = layout.crossPageConnectorPairs.find((candidate) => candidate.incoming.id === id || candidate.outgoing.id === id);
    if (!pair) throw new Error(`Unknown connector endpoint ${id}`);
    return { endpointId: id, pair, incoming: pair.incoming.id === id };
  });
  const connectorParts = endpoints.map(({ endpointId, pair, incoming }) => {
    const node = byId.get(incoming ? pair.incoming.nodeId : pair.outgoing.nodeId);
    if (!node) throw new Error(`Unknown connector node for ${endpointId}`);
    const geometry = incoming ? pair.incoming : pair.outgoing;
    const line = `<path data-connector-path="${xml(endpointId)}" d="${svgPath(geometry.routePoints)}" fill="none" stroke="${palette.gold}" stroke-width="${REPORT_GRAPH_CONNECTOR_PATH_STROKE_WIDTH}" marker-end="url(#arrowGold)"/>`;
    const marker = `<g data-connector-endpoint="${xml(endpointId)}" data-adjacency-id="${pair.adjacencyRecordId}" data-connector-side="${geometry.side}" data-connector-row="${geometry.row}" data-connector-column="${geometry.column}" data-target-page="${geometry.targetPageId}" data-target-node="${geometry.targetNodeRef}"><circle cx="${geometry.markerCenter.x}" cy="${geometry.markerCenter.y}" r="${REPORT_GRAPH_CONNECTOR_MARKER_RADIUS}" fill="#ffffff" stroke="${palette.gold}" stroke-width="${REPORT_GRAPH_CONNECTOR_MARKER_STROKE_WIDTH}"/><rect x="${geometry.labelBox.x}" y="${geometry.labelBox.y}" width="${geometry.labelBox.width}" height="${geometry.labelBox.height}" rx="300" fill="#ffffff" stroke="${palette.gold}" stroke-width="${REPORT_GRAPH_CONNECTOR_LABEL_STROKE_WIDTH}"/>${svgLine(pair.id, geometry.markerCenter.x, geometry.markerCenter.y + REPORT_GRAPH_CONNECTOR_ID_BASELINE_OFFSET, REPORT_GRAPH_CONNECTOR_ID_SIZE_MILLI_POINTS, palette.navy, "medium", "middle", false)}${svgLine(`${geometry.direction} ${geometry.targetPageId}`, geometry.directionPageBaseline.x, geometry.directionPageBaseline.y, REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS, palette.navy, "medium", "start", false)}${svgLine(geometry.targetNodeRef, geometry.targetNodeBaseline.x, geometry.targetNodeBaseline.y, REPORT_GRAPH_CONNECTOR_REFERENCE_SIZE_MILLI_POINTS, palette.navy, "medium", "start", false)}</g>`;
    return { line, marker };
  });
  const headerParts: string[] = [];
  const headerStyle = layout.typography.styles.header;
  let headerY = layout.headerFrame.y + layout.headerLayout.paddingY;
  const appendHeaderLines = (lines: typeof layout.headerLayout.reportTitle.lines, color: string) => {
    for (const line of lines) {
      headerParts.push(svgLine(line.text, layout.headerFrame.x, headerY + headerStyle.lineHeight * 0.78, headerStyle.sizeMilliPoints, color, "medium"));
      headerY += headerStyle.lineHeight;
    }
  };
  appendHeaderLines(layout.headerLayout.reportTitle.lines, palette.navy);
  headerY += layout.headerLayout.groupGap;
  appendHeaderLines(layout.headerLayout.sectionTitle.lines, palette.ink);
  headerY += layout.headerLayout.groupGap;
  appendHeaderLines(layout.headerLayout.identity.lines, "#53666e");
  headerY += layout.headerLayout.groupGap;
  appendHeaderLines([page.pageLine], palette.navy);
  const header = headerParts.join("");
  const footer = [
    svgLine(`${tr(language, "Layout", "Макет")} ${layout.layoutSchemaVersion} · ${layout.layoutAlgorithmVersion} · ${layout.layoutRendererVersion}`, layout.footerFrame.x, layout.footerFrame.y + 3_500, 6_200, "#53666e"),
    svgLine(layout.layoutFingerprint, layout.footerFrame.x, layout.footerFrame.y + 6_600, 5_800, "#66777e"),
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${layout.printableFrame.x} ${layout.printableFrame.y} ${layout.printableFrame.width} ${layout.printableFrame.height}" preserveAspectRatio="xMidYMid meet"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${palette.cyan}"/></marker><marker id="arrowGold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${palette.gold}"/></marker></defs><rect x="${layout.printableFrame.x}" y="${layout.printableFrame.y}" width="${layout.printableFrame.width}" height="${layout.printableFrame.height}" fill="${palette.mist}"/>${header}${paths.join("")}${connectorParts.map((part) => part.line).join("")}${nodes.map((node) => svgNode(node, layout)).join("")}${connectorParts.map((part) => part.marker).join("")}${footer}</svg>`;
}

function graphTextAlternative(
  layout: ReportGraphLayoutModel,
  options: CaseReportOptions,
  sectionIndex: number,
): Content[] {
  const { language } = options;
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const pageById = new Map(layout.graphPages.map((page) => [page.id, page]));
  const connectorRecordById = new Map(layout.connectorTextRecords.map((record) => [record.connectorId, record]));
  const nodes = [...layout.nodes].sort((left, right) =>
    (pageById.get(left.pageId)?.number ?? 0) - (pageById.get(right.pageId)?.number ?? 0)
    || left.box.y - right.box.y
    || left.box.x - right.box.x
    || left.id.localeCompare(right.id, "en"),
  );
  const content: Content[] = [
    {
      text: `${sectionIndex}. ${tr(language, "Complete graph text alternative", "Полная текстовая альтернатива графа")}`,
      style: "sectionTitle",
      pageBreak: "before",
      margin: [0, 0, 0, 8],
    },
    {
      text: tr(
        language,
        "This logical-order alternative contains every graph node, directed adjacency and paired page connector. The visual treatment is BPMN-inspired off-page continuity; the GENESIS graph is not a BPMN model. This accessibility-improved PDF is not certified as PDF/UA.",
        "Эта альтернатива в логическом порядке содержит каждый нод, направленную связь и парный межстраничный переход. Визуальное оформление переходов вдохновлено BPMN; граф GENESIS не является моделью BPMN. Этот PDF улучшен с точки зрения доступности, но не сертифицирован как PDF/UA.",
      ),
      style: "notice",
    },
    { text: tr(language, "Diagram summary", "Сводка диаграммы"), style: "subheading", margin: [0, 10, 0, 5] },
    {
      text: `${tr(language, "Components", "Компоненты")}: ${layout.summary.componentCount} · ${tr(language, "Disconnected", "Несвязный")}: ${layout.summary.disconnected ? tr(language, "yes", "да") : tr(language, "no", "нет")} · ${tr(language, "Roots", "Корни")}: ${layout.summary.rootNodeRefs.join(", ") || tr(language, "none", "нет")} · ${tr(language, "Terminals", "Терминалы")}: ${layout.summary.terminalNodeRefs.join(", ") || tr(language, "none", "нет")} · ${tr(language, "Cyclic repairs", "Исправления циклов")}: ${layout.cyclicRepairs.length}`,
      style: "body",
    },
    { text: tr(language, "Node register", "Реестр нодов"), style: "subheading", margin: [0, 14, 0, 5] },
  ];
  for (const node of nodes) {
    const record = layout.nodeTextRecords.find((candidate) => candidate.nodeId === node.id);
    if (!record) throw new Error(`Missing text record for node ${node.id}`);
    content.push({
      stack: [
        {
          text: `${tr(language, "Graph page", "Страница графа")} ${pageById.get(node.pageId)?.number ?? node.pageId}${options.includeTechnicalIds ? ` · ${record.nodeId}` : ""}`,
          style: "graphNodeType",
        },
        { text: record.text, style: "graphNodeDetail" },
      ],
      margin: [0, 0, 0, 9],
      unbreakable: registerEntryCanRemainAtomic(record.text, 9),
    });
  }
  content.push({ text: tr(language, "Directed adjacency register", "Реестр направленных связей"), style: "subheading", margin: [0, 14, 0, 5] });
  for (const record of layout.adjacencyTextRecords) {
    content.push({
      stack: [
        {
          text: `${record.id}${options.includeTechnicalIds ? ` · ${record.edgeId}` : ""} · ${record.fromNodeRef} -> ${record.toNodeRef}`,
          style: "graphNodeType",
        },
        { text: record.text, style: "graphNodeDetail" },
      ],
      margin: [0, 0, 0, 7],
      unbreakable: registerEntryCanRemainAtomic(record.text, 7),
    });
  }
  content.push({ text: tr(language, "Paired connector index", "Индекс парных переходов"), style: "subheading", margin: [0, 14, 0, 5] });
  if (!layout.crossPageConnectorPairs.length) {
    content.push({ text: tr(language, "No off-page connectors are required.", "Межстраничные переходы не требуются."), style: "body" });
  }
  for (const pair of layout.crossPageConnectorPairs) {
    const record = connectorRecordById.get(pair.id);
    if (!record) throw new Error(`Missing text record for connector ${pair.id}`);
    const fromNode = nodeById.get(pair.outgoing.nodeId);
    const toNode = nodeById.get(pair.incoming.nodeId);
    content.push({
      stack: [
        { text: `${pair.id} · ${tr(language, "directed edge", "направленная связь")}${options.includeTechnicalIds ? ` ${pair.edgeId}` : ""}`, style: "graphNodeType" },
        {
          text: `${tr(language, "OUT", "ВЫХОД")} ${pair.outgoing.nodeRef} (${fromNode?.text.title.fullText ?? pair.outgoing.nodeId}) · ${pair.fromPageId} -> ${tr(language, "IN", "ВХОД")} ${pair.incoming.nodeRef} (${toNode?.text.title.fullText ?? pair.incoming.nodeId}) · ${pair.toPageId}\n${record.text}`,
          style: "graphNodeDetail",
        },
      ],
      margin: [0, 0, 0, 7],
      unbreakable: registerEntryCanRemainAtomic(record.text, 7, 16),
    });
  }
  return content;
}

export function buildReportGraphAppendix(
  layout: ReportGraphLayoutModel,
  options: CaseReportOptions,
  sectionIndex: number,
): Content[] {
  const graphPages = layout.graphPages.map((page) => ({
    pageBreak: "before",
    svg: caseReportGraphLayoutSvg(layout, page.id, options.language),
    fit: [
      micrometresToPoints(layout.printableFrame.width),
      micrometresToPoints(layout.printableFrame.height),
    ],
    margin: [0, 0, 0, 0],
  } as Content));
  return [...graphPages, ...graphTextAlternative(layout, options, sectionIndex)];
}
