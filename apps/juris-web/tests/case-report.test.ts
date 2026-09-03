import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { assertCaseReportGenerationAuthorized, buildCaseReportArtifacts, buildCaseReportDefinition, caseReportReceiptBinding, mayPersistGeneratedReportReceipt, type CaseReportOptions } from "../app/case-report";
import { REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS, ReportGraphLayoutError } from "../app/report-graph-layout";
import { caseReportGraphLayoutSvg } from "../app/report-graph-pdf";
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { caseTypeReference } from "../app/case-type-reference";
import { isReportReceiptStale, reportReceipt, validateReportReadiness } from "../app/report-model";
import type { StudioDraft } from "../app/types";

const draft: StudioDraft = {
  caseId: "uk_property_structure",
  version: "1.0.0",
  caseType: caseTypeReference("tax_compliance"),
  parent: null,
  title: "UK property structure",
  jurisdiction: "United Kingdom / PRC / Liechtenstein",
  role: "Cross-border tax adviser",
  premise: "A PRC-resident client considers a five-flat UK property acquisition.",
  classification: { domain: "tax", practiceArea: "International tax planning", difficulty: "Expert", tags: ["real estate"], taxTopics: ["ATED", "WHT"], complianceOnly: true, purpose: "lawful_planning", legalAsOf: "2026-08-23", sourceUrls: ["https://www.gov.uk/"] },
  dealEconomics: {
    kind: "deal-economics-v1", currency: "GBP", purchasePrice: 1_000_000, loanToValueBps: 8_000, annualInterestRateBps: 750, termMonths: 120,
    repaymentBasis: "unknown", grossAnnualIncome: 129_600, annualOperatingCosts: null, oneOffStructureCost: 15_000, annualStructureCost: 10_000,
    otherInitialCosts: null, targetAnnualReturnBps: 1_000, scenarioProbabilities: { interestOnlyBps: 5_000, favorableBps: 2_500, baseBps: 5_000, stressedBps: 2_500 }, assumptions: [],
  },
  nodes: [
    { id: "trigger-1", type: "trigger", title: "Acquisition mandate", detail: "Client requests advice.", x: 20, y: 20 },
    { id: "entity-1", type: "entity", title: "Acquisition vehicle", detail: "Proposed holding entity.", x: 20, y: 160 },
    { id: "cash-flow-1", type: "cash_flow", title: "Acquisition funding", detail: "Funding flow under review.", x: 180, y: 160 },
    { id: "tax-rule-1", type: "tax_rule", title: "Applicable tax rule", detail: "Authority must be confirmed as of the legal date.", x: 340, y: 160 },
    { id: "fact-1", type: "fact", title: "Client residence", detail: "Residence fact to be verified.", x: 500, y: 160 },
    { id: "evidence-1", type: "evidence", title: "Loan term sheet", detail: "Financing basis remains to be confirmed.", x: 320, y: 20 },
    { id: "decision-1", type: "decision", title: "Choose ownership route", detail: "Compare direct and structured holding.", x: 620, y: 20 },
    { id: "outcome-1", type: "outcome", title: "Proceed subject to conditions", detail: "Engagement remains conditional.", x: 920, y: 20 },
  ],
  links: [
    { id: "link-1", from: "trigger-1", to: "evidence-1" },
    { id: "link-2", from: "evidence-1", to: "decision-1" },
    { id: "link-3", from: "decision-1", to: "outcome-1" },
  ],
  editHistory: [
    { id: "history-1", role: "author", source: "prompt", action: "prompt_submitted", message: "SECRET RAW PROMPT CONTENT", createdAt: "2026-08-23T12:00:00.000Z" },
    { id: "history-2", role: "studio", source: "visual", action: "node_updated", message: "Updated the evidence note.", createdAt: "2026-08-23T12:01:00.000Z" },
  ],
  updatedAt: "2026-08-23T12:01:00.000Z",
};

const options: CaseReportOptions = {
  language: "en", profileId: "tax_position_memorandum", profileLabel: "Tax position memorandum", audience: "internal", confidentiality: "confidential", preparedBy: "Reviewer", preparedFor: "Client", matterReference: "MAT-001",
  includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: true, includeTechnicalIds: true,
  generatedAt: "2026-08-23T12:05:00.000Z", currentFingerprint: "sha256-current", workspaceFingerprint: "sha256-current", privateCase: true,
  currentPublicationFingerprint: casePublicationFingerprint(draft), workspacePublicationFingerprint: casePublicationFingerprint(draft),
  reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
};

type PdfMakePage = {
  items: Array<{
    item: { inlines?: Array<{ text?: string }> };
    type: string;
  }>;
};

const pdfMakeRuntime = pdfMake as unknown as {
  addVirtualFileSystem: (fonts: unknown) => void;
  createPdf: (definition: TDocumentDefinitions) => {
    _getPages: (options: Record<string, never>, callback: (pages: PdfMakePage[]) => void) => void;
  };
};
pdfMakeRuntime.addVirtualFileSystem(pdfFonts);

function paginateDefinition(definition: TDocumentDefinitions) {
  return new Promise<PdfMakePage[]>((resolve) => pdfMakeRuntime.createPdf(definition)._getPages({}, resolve));
}

function pdfPageText(page: PdfMakePage) {
  return page.items
    .filter((entry) => entry.type === "line")
    .map((entry) => (entry.item.inlines ?? []).map((inline) => inline.text ?? "").join(""))
    .join("\n");
}

function registerStackStartingWith(definition: TDocumentDefinitions, prefix: string) {
  const entry = (definition.content as Content[]).find((candidate) => {
    if (!candidate || typeof candidate !== "object" || !("stack" in candidate) || !Array.isArray(candidate.stack)) return false;
    const first = candidate.stack[0];
    return first && typeof first === "object" && "text" in first && typeof first.text === "string" && first.text.startsWith(prefix);
  });
  return entry && typeof entry === "object" && "stack" in entry
    ? entry as { stack: Content[]; unbreakable?: boolean }
    : assert.fail("Missing register stack " + prefix);
}

function collectTextValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectTextValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectTextValues);
  return [];
}

function collectPdfLinks(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPdfLinks);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.link === "string" ? [record.link] : []),
    ...Object.entries(record).filter(([key]) => key !== "link").flatMap(([, item]) => collectPdfLinks(item)),
  ];
}

test("professional report contains economics, registers, sign-off and a safe audit trail", () => {
  const report = buildCaseReportDefinition(draft, options);
  const source = JSON.stringify(report.content);
  assert.match(source, /TAX POSITION MEMORANDUM/);
  assert.match(source, /Investment and cash-flow analysis/);
  assert.match(source, /Illustrative annual cash-flow probability ranges/);
  assert.match(source, /Facts, evidence and rules register/);
  assert.match(source, /Verification and sign-off/);
  assert.match(source, /Complete graph text alternative/);
  assert.match(source, /Node register/);
  assert.match(source, /Directed adjacency register/);
  assert.match(source, /N01/);
  assert.match(source, /<svg/);
  assert.doesNotMatch(source, /right-hand register/);
  assert.doesNotMatch(source, /landscape/);
  assert.match(source, /AI-assisted revision recorded - raw prompt excluded/);
  assert.doesNotMatch(source, /SECRET RAW PROMPT CONTENT/);
  assert.equal(report.pageOrientation, "portrait");
  assert.equal(report.language, "en-GB");
  assert.equal(report.displayTitle, true);
});

test("client-facing report can omit audit trail and technical identifiers", () => {
  const report = buildCaseReportDefinition(draft, { ...options, audience: "client", includeAuditTrail: true, includeTechnicalIds: true, reviewerName: "Approving partner", reviewerApproved: true });
  const source = JSON.stringify(report.content);
  assert.doesNotMatch(source, /Authoring and review trail/);
  assert.doesNotMatch(source, /\[evidence-1\]/);
  assert.match(source, /Loan term sheet/);
});

test("durable premise provenance excludes long and compacted raw prompts from internal and client rendered text", async () => {
  const longSecret = `LONG RAW INTAKE PROMPT 7f4c9a11 ${"A".repeat(2_100)}`;
  const compactedSecret = "COMPACTED RAW INTAKE PROMPT b321ddf7";
  const promptDrafts: StudioDraft[] = [{
    ...draft,
    premise: longSecret,
    premisePublication: "prompt-derived",
    editHistory: [{
      id: "prompt-secret",
      role: "author",
      source: "prompt",
      action: "prompt_submitted",
      message: longSecret.slice(0, 2_000),
      createdAt: "2026-08-23T11:59:00.000Z",
    }],
  }, {
    ...draft,
    premise: compactedSecret,
    premisePublication: "prompt-derived",
    editHistory: Array.from({ length: 120 }, (_, index) => ({
      id: `compacted-${index}`,
      role: "studio" as const,
      source: "visual" as const,
      action: "node_updated",
      message: `Compacted authoring event ${index}`,
      createdAt: new Date(Date.UTC(2026, 7, 23, 12, index)).toISOString(),
    })),
  }];
  const variants: CaseReportOptions[] = [
    options,
    { ...options, audience: "client", reviewerName: "Approving partner", reviewerApproved: true },
  ];
  for (const promptDraft of promptDrafts) {
    for (const variant of variants) {
      const definition = buildCaseReportDefinition(promptDraft, variant);
      const staticText = collectTextValues(definition).join("\n");
      assert.equal(staticText.includes(promptDraft.premise), false);
      assert.match(staticText, /raw intake text is excluded/);
      const renderedText = (await paginateDefinition(definition)).map(pdfPageText).join("\n");
      assert.equal(renderedText.includes(promptDraft.premise), false);
    }
  }

  const deliberate = buildCaseReportDefinition({ ...promptDrafts[0], premise: "Deliberately authored professional context.", premisePublication: "author-reviewed" }, options);
  assert.match(collectTextValues(deliberate.content).join("\n"), /Deliberately authored professional context\./);

  const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(appSource, /premise: "", premisePublication: "prompt-derived"/);
  assert.match(appSource, /premise:event\.target\.value,premisePublication:"author-reviewed"/);
  const fallbackBuilder = appSource.slice(appSource.indexOf("function generateDraft"), appSource.indexOf("function applyPromptIteration"));
  assert.match(fallbackBuilder, /const shortTitle = "Rule-based legal scenario"/);
  assert.match(fallbackBuilder, /message: clean/);
  assert.doesNotMatch(fallbackBuilder, /sentences|actorCandidates|deadlineMatch|detail: clean|titleSeed/);
});

test("premise publication provenance changes presentation only, not canonical fingerprints", () => {
  const promptDerived = { ...draft, premisePublication: "prompt-derived" as const };
  const authorReviewed = { ...draft, premisePublication: "author-reviewed" as const };
  assert.equal(caseFingerprint(promptDerived), caseFingerprint(authorReviewed));
  const promptModel = buildCaseReportArtifacts(promptDerived, options).reportModel;
  const reviewedModel = buildCaseReportArtifacts(authorReviewed, options).reportModel;
  assert.equal(promptModel.contentFingerprint, reviewedModel.contentFingerprint);
  assert.notEqual(
    caseReportReceiptBinding(promptDerived, options).presentationFingerprint,
    caseReportReceiptBinding(authorReviewed, options).presentationFingerprint,
  );
  assert.notEqual(
    collectTextValues(buildCaseReportDefinition(promptDerived, options).content).join("\n"),
    collectTextValues(buildCaseReportDefinition(authorReviewed, options).content).join("\n"),
  );
});

test("report links are canonical HTTPS only and rejected values gate external output", () => {
  const unsafeSources = [
    " https://EXAMPLE.com:443/legal/../authority?q=1#section ",
    "https://example.com/authority?q=1#section",
    "javascript:alert(document.domain)",
    "file:///C:/secrets.txt",
    "not a URL",
    "https://user:password@example.com/private",
  ];
  const sourceDraft: StudioDraft = {
    ...draft,
    classification: { ...draft.classification!, sourceUrls: unsafeSources },
  };
  const artifacts = buildCaseReportArtifacts(sourceDraft, options);
  assert.deepEqual(
    artifacts.reportModel.governance.citations.map((citation) => citation.url),
    ["https://example.com/authority?q=1#section"],
  );
  assert.deepEqual(collectPdfLinks(artifacts.definition), ["https://example.com/authority?q=1#section"]);
  const definitionText = collectTextValues(artifacts.definition).join("\n");
  for (const rejected of unsafeSources.slice(2)) assert.equal(definitionText.includes(rejected), false);
  assert.match(artifacts.reportModel.readiness.warnings.join("\n"), /canonical HTTPS URLs without embedded credentials/);

  const external = validateReportReadiness(sourceDraft, {
    profileId: options.profileId,
    status: "final",
    audience: "client",
    preparedBy: options.preparedBy,
    preparedFor: options.preparedFor,
    reviewerName: "Approving partner",
    reviewerApproved: true,
    currentFingerprint: options.currentFingerprint,
    workspaceFingerprint: options.workspaceFingerprint,
  });
  assert.equal(external.ready, false);
  assert.match(external.blockers.join("\n"), /canonical HTTPS URLs without embedded credentials/);

  const normalized = normalizeStudioDraft(sourceDraft);
  assert.deepEqual(normalized.classification?.sourceUrls, [
    "https://EXAMPLE.com:443/legal/../authority?q=1#section",
    "https://example.com/authority?q=1#section",
  ]);
  assert.equal(
    caseFingerprint({ ...draft, classification: { ...draft.classification!, sourceUrls: ["https://example.com"] } }),
    caseFingerprint(normalizeStudioDraft({ ...draft, classification: { ...draft.classification!, sourceUrls: ["https://example.com"] } })),
    "safe v61 HTTPS byte shape must remain stable across normalization",
  );
});

test("active node redactions also suppress unscoped audit messages", () => {
  const secret = "REDACTED_SECRET_713";
  const redactedDraft = structuredClone(draft);
  const evidence = redactedDraft.nodes.find((node) => node.id === "evidence-1");
  assert.ok(evidence);
  evidence.title = `${secret} title`;
  evidence.detail = `${secret} detail`;
  redactedDraft.editHistory.push({
    id: "history-redacted",
    role: "studio",
    source: "visual",
    action: "node_updated",
    message: `Updated ${secret} title with ${secret} detail`,
    createdAt: "2026-08-23T12:02:00.000Z",
  });
  const report = buildCaseReportDefinition(redactedDraft, {
    ...options,
    redactedNodeIds: ["evidence-1"],
  });
  const text = collectTextValues(report.content).join("\\n");
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(evidence.title), false);
  assert.equal(text.includes(evidence.detail), false);
  assert.match(text, /message excluded because report redactions are active/);
});

test("SVG text faces align exactly with pdfmake and svg-to-pdfkit Roboto weight resolution", () => {
  const artifacts = buildCaseReportArtifacts(draft, options);
  const svg = caseReportGraphLayoutSvg(artifacts.layoutModel, artifacts.layoutModel.graphPages[0].id, "en");
  const mediumTags = svg.match(/<text [^>]*data-font-face="Roboto-Medium"[^>]*>/g) ?? [];
  const regularTags = svg.match(/<text [^>]*data-font-face="Roboto-Regular"[^>]*>/g) ?? [];
  assert.equal(mediumTags.length > 0, true);
  assert.equal(regularTags.length > 0, true);
  assert.equal(mediumTags.every((tag) => tag.includes('font-weight="bold"')), true);
  assert.equal(regularTags.every((tag) => tag.includes('font-weight="normal"')), true);
  assert.doesNotMatch(svg, /font-weight="500"/);

  const resolverSource = readFileSync(new URL("../node_modules/pdfmake/src/3rd-party/svg-to-pdfkit/source.js", import.meta.url), "utf8");
  const pdfmakeSource = readFileSync(new URL("../node_modules/pdfmake/build/pdfmake.js", import.meta.url), "utf8");
  assert.match(resolverSource, /'600':'bold'/);
  assert.match(resolverSource, /'500':'normal'/);
  assert.match(resolverSource, /currentElem\.get\('font-weight'\) === 'bold'/);
  assert.match(pdfmakeSource, /bold: 'Roboto-Medium\.ttf'/);
});

test("graph appendix uses deterministic full-width portrait pages and paired connectors", () => {
  const longDraft: StudioDraft = {
    ...draft,
    nodes: Array.from({ length: 18 }, (_, index) => ({
      id: `node-${index + 1}`,
      type: index === 0 ? "trigger" : index === 17 ? "outcome" : index % 4 === 0 ? "decision" : "fact",
      title: `Professional review node ${index + 1}`,
      detail: "A sufficiently detailed register entry that must remain alongside the matching graph segment in the PDF report.",
      x: 0,
      y: 0,
    })),
    links: Array.from({ length: 17 }, (_, index) => ({ id: `edge-${index + 1}`, from: `node-${index + 1}`, to: `node-${index + 2}` })),
  };
  const artifacts = buildCaseReportArtifacts(longDraft, options);
  const { layoutModel } = artifacts;
  assert.ok(layoutModel.graphPages.length >= 2, "a deep graph must paginate rather than scale below the locked typography");
  assert.deepEqual([...layoutModel.nodes.map((node) => node.id)].sort(), longDraft.nodes.map((node) => node.id).sort());
  for (const node of layoutModel.nodes) {
    assert.ok(layoutModel.graphPages.some((page) => page.id === node.pageId));
    assert.ok(node.box.x >= layoutModel.graphFrame.x);
    assert.ok(node.box.y >= layoutModel.graphFrame.y);
    assert.ok(node.box.x + node.box.width <= layoutModel.graphFrame.x + layoutModel.graphFrame.width);
    assert.ok(node.box.y + node.box.height <= layoutModel.graphFrame.y + layoutModel.graphFrame.height);
  }
  assert.ok(layoutModel.crossPageConnectorPairs.length >= 1);
  for (const pair of layoutModel.crossPageConnectorPairs) {
    assert.equal(pair.id.length, 4);
    assert.equal(pair.id[0], "C");
    assert.ok(Number.isInteger(Number(pair.id.slice(1))));
    const fromSvg = caseReportGraphLayoutSvg(layoutModel, pair.fromPageId, "en");
    const toSvg = caseReportGraphLayoutSvg(layoutModel, pair.toPageId, "en");
    assert.equal((fromSvg.match(new RegExp(`data-connector-endpoint="${pair.id}:OUT"`, "g")) ?? []).length, 1);
    assert.equal((toSvg.match(new RegExp(`data-connector-endpoint="${pair.id}:IN"`, "g")) ?? []).length, 1);
    assert.match(fromSvg, new RegExp(pair.adjacencyRecordId));
    assert.match(toSvg, new RegExp(pair.adjacencyRecordId));
    const visualEndpoints = [
      { direction: "OUT", endpointId: pair.outgoing.id, nodeRef: pair.incoming.nodeRef, pageId: pair.toPageId, svg: fromSvg },
      { direction: "IN", endpointId: pair.incoming.id, nodeRef: pair.outgoing.nodeRef, pageId: pair.fromPageId, svg: toSvg },
    ];
    for (const endpoint of visualEndpoints) {
      const groupStart = endpoint.svg.indexOf('<g data-connector-endpoint="' + endpoint.endpointId + '"');
      assert.notEqual(groupStart, -1, "Missing rendered endpoint " + endpoint.endpointId);
      const groupEnd = endpoint.svg.indexOf("</g>", groupStart);
      assert.notEqual(groupEnd, -1, "Unclosed rendered endpoint " + endpoint.endpointId);
      const group = endpoint.svg.slice(groupStart, groupEnd + 4);
      assert.equal(group.includes('data-target-page="' + endpoint.pageId + '"'), true);
      assert.equal(group.includes('data-target-node="' + endpoint.nodeRef + '"'), true);
      assert.equal(group.includes(">" + pair.id + "</text>"), true);
      assert.equal(group.includes(">" + endpoint.direction + " " + endpoint.pageId + "</text>"), true);
      assert.equal(group.includes(">" + endpoint.nodeRef + "</text>"), true);
      const fontSizes = [...group.matchAll(/font-size="([0-9.]+)"/g)].map((match) => Number(match[1]));
      assert.equal(fontSizes.length, 3);
      const minimumMicrometres = REPORT_GRAPH_CONNECTOR_MIN_SIZE_MILLI_POINTS * 25.4 / 72;
      assert.equal(fontSizes.every((size) => size >= minimumMicrometres), true, endpoint.endpointId + " shrank below the accessible connector size");
    }
  }
  const textValues = collectTextValues(artifacts.definition.content);
  for (const pair of layoutModel.crossPageConnectorPairs) {
    const record = layoutModel.connectorTextRecords.find((candidate) => candidate.connectorId === pair.id) ?? assert.fail("Missing connector text " + pair.id);
    const entry = textValues.find((text) => text.includes(record.accessibleText)) ?? assert.fail("Missing connector index entry " + pair.id);
    assert.equal(entry.includes(String.fromCharCode(10)), true);
    assert.equal(entry.includes("\\n"), false);
    for (const value of [record.label, record.detail, record.result, ...record.annotations].filter(Boolean)) assert.equal(entry.includes(value), true);
  }
  const source = JSON.stringify(artifacts.definition.content);
  assert.doesNotMatch(source, /"columns":\[\{"width":"57%"/);
  assert.doesNotMatch(source, /"pageOrientation":"landscape"/);
  assert.match(source, /Complete graph text alternative/);
  assert.match(source, /Paired connector index/);
  const nonTechnicalArtifacts = buildCaseReportArtifacts(longDraft, { ...options, includeTechnicalIds: false });
  const nonTechnicalTextValues = collectTextValues(nonTechnicalArtifacts.definition.content);
  for (const pair of nonTechnicalArtifacts.layoutModel.crossPageConnectorPairs) {
    const heading = nonTechnicalTextValues.find((text) => text.startsWith(pair.id + " · directed edge")) ?? assert.fail("Missing connector heading " + pair.id);
    assert.equal(heading.includes(pair.edgeId), false, "connector heading exposed an omitted technical edge ID");
  }
});

test("bounded graph register rows remain atomic at a real page boundary while oversized rows may flow", async () => {
  const longDraft: StudioDraft = {
    ...draft,
    nodes: Array.from({ length: 18 }, (_, index) => ({
      id: `node-${index + 1}`,
      type: index === 0 ? "trigger" : index === 17 ? "outcome" : index % 4 === 0 ? "decision" : "fact",
      title: `Professional review node ${index + 1}`,
      detail: "A bounded connector register detail that must remain contiguous across a forced report page boundary.",
      x: 0,
      y: 0,
    })),
    links: Array.from({ length: 17 }, (_, index) => ({
      id: `edge-${index + 1}`,
      from: `node-${index + 1}`,
      to: `node-${index + 2}`,
      rule: {
        detail: "A bounded relationship condition remains part of the exact connector text record. ".repeat(2).trim(),
        label: "Requires documented review",
        result: "A bounded relationship outcome remains contiguous with the paired connector. ".repeat(2).trim(),
      },
    })),
  };
  const artifacts = buildCaseReportArtifacts(longDraft, options);
  const pair = artifacts.layoutModel.crossPageConnectorPairs[0] ?? assert.fail("Expected a cross-page connector");
  const record = artifacts.layoutModel.connectorTextRecords.find((candidate) => candidate.connectorId === pair.id)
    ?? assert.fail("Missing connector text record");
  const entry = registerStackStartingWith(artifacts.definition, pair.id + " · directed edge");
  assert.equal("unbreakable" in entry && entry.unbreakable, true);
  const detail = entry.stack[1];
  assert.ok(detail && typeof detail === "object" && "text" in detail && typeof detail.text === "string");
  assert.equal(detail.text.includes("\n" + record.accessibleText), true);
  assert.equal(record.accessibleText.includes("\n"), true);
  assert.equal(record.accessibleText.includes("\\n"), false);

  const paginationDefinition = (registerEntry: Content, fillerLineCount: number): TDocumentDefinitions => ({
    content: [{
      fontSize: 7.3,
      lineHeight: 1.18,
      text: Array.from({ length: fillerLineCount }, (_, index) => "Boundary filler " + String(index + 1).padStart(2, "0")).join("\n"),
    }, registerEntry],
    defaultStyle: { font: "Roboto", fontSize: 9.2, lineHeight: 1.25 },
    pageMargins: [39.685, 39.685, 39.685, 39.685],
    pageSize: "A4",
    styles: {
      graphNodeDetail: { color: "#10202c", fontSize: 7.3, lineHeight: 1.18 },
      graphNodeType: { bold: true, characterSpacing: 0.6, color: "#3d9daa", fontSize: 7 },
    },
  });
  const looseEntry = { ...entry, unbreakable: false } as Content;
  const connectorPages = (pages: PdfMakePage[]) => pages
    .map(pdfPageText)
    .map((text, index) => ({ index, text }))
    .filter((page) => page.text.includes(pair.id));
  let boundary: { fillerLineCount: number; loosePages: PdfMakePage[] } | null = null;
  for (let fillerLineCount = 70; fillerLineCount <= 88; fillerLineCount += 1) {
    const loosePages = await paginateDefinition(paginationDefinition(looseEntry, fillerLineCount));
    if (connectorPages(loosePages).length > 1) {
      boundary = { fillerLineCount, loosePages };
      break;
    }
  }
  assert.ok(boundary, "control row did not split at any forced boundary");
  const atomicPages = await paginateDefinition(paginationDefinition(entry as Content, boundary.fillerLineCount));
  assert.equal(connectorPages(boundary.loosePages).length > 1, true);
  const atomicConnectorPages = connectorPages(atomicPages);
  assert.equal(atomicConnectorPages.length, 1, "atomic connector row split across pages");
  const compact = (value: string) => value.replace(/\s+/g, "");
  assert.equal(compact(atomicConnectorPages[0].text).includes(compact(record.accessibleText)), true);

  const oversizedDraft = structuredClone(longDraft);
  oversizedDraft.nodes[0].detail = "W".repeat(4_000);
  oversizedDraft.links = oversizedDraft.links.map((link) => ({
    ...link,
    rule: { detail: "W".repeat(4_000), result: "W".repeat(4_000) },
  }));
  const oversized = buildCaseReportArtifacts(oversizedDraft, options);
  const oversizedPair = oversized.layoutModel.crossPageConnectorPairs[0] ?? assert.fail("Expected oversized connector");
  const oversizedConnectorEntry = registerStackStartingWith(oversized.definition, oversizedPair.id + " · directed edge");
  assert.equal("unbreakable" in oversizedConnectorEntry && oversizedConnectorEntry.unbreakable, false);
  const adjacency = oversized.layoutModel.adjacencyTextRecords.find((candidate) => candidate.edgeId === oversizedPair.edgeId)
    ?? assert.fail("Missing oversized adjacency");
  const oversizedAdjacencyEntry = registerStackStartingWith(oversized.definition, adjacency.id);
  assert.equal("unbreakable" in oversizedAdjacencyEntry && oversizedAdjacencyEntry.unbreakable, false);
  const nodeRecord = oversized.layoutModel.nodeTextRecords.find((candidate) => candidate.nodeId === oversizedDraft.nodes[0].id)
    ?? assert.fail("Missing oversized node record");
  const oversizedNodeEntry = (oversized.definition.content as Content[]).find((candidate) => {
    if (!candidate || typeof candidate !== "object" || !("stack" in candidate) || !Array.isArray(candidate.stack)) return false;
    const recordDetail = candidate.stack[1];
    return recordDetail && typeof recordDetail === "object" && "text" in recordDetail && recordDetail.text === nodeRecord.text;
  });
  assert.ok(oversizedNodeEntry && typeof oversizedNodeEntry === "object" && "unbreakable" in oversizedNodeEntry);
  assert.equal(oversizedNodeEntry.unbreakable, false);
});

test("layout language changes do not mutate the canonical ReportModel fingerprint", () => {
  const english = buildCaseReportArtifacts(draft, options);
  const russian = buildCaseReportArtifacts(draft, { ...options, language: "ru" });
  assert.equal(english.reportModel.contentFingerprint, russian.reportModel.contentFingerprint);
  assert.notEqual(english.layoutModel.layoutFingerprint, russian.layoutModel.layoutFingerprint);
});

test("the complete PDF definition fails closed for unsupported font scalars and XML characters", () => {
  for (const [preparedBy, reason, codePoint] of [
    ["Reviewer 👩‍⚖️", "FONT_UNSUPPORTED", "U+1F469"],
    [`Reviewer${String.fromCharCode(0)}`, "XML_INVALID", "U+0000"],
  ] as const) {
    assert.throws(
      () => buildCaseReportArtifacts(draft, { ...options, preparedBy }),
      (caught: unknown) => {
        assert.ok(caught instanceof ReportGraphLayoutError);
        assert.equal(caught.code, "INPUT_INVALID");
        assert.equal(caught.context.field, "documentDefinition");
        assert.equal(caught.context.reason, reason);
        assert.equal(caught.context.codePoint, codePoint);
        assert.doesNotMatch(caught.message, /Reviewer|👩/);
        return true;
      },
    );
  }
});

test("receipt storage routing stays outside fingerprints and generation blocks sensitive cases", () => {
  assert.doesNotThrow(() => assertCaseReportGenerationAuthorized(true));
  assert.throws(() => assertCaseReportGenerationAuthorized(false), /inspection-only mode/u);
  const scopeA = "a".repeat(64);
  const localOptions: CaseReportOptions = {
    ...options,
    privateCase: false,
    reportReceiptStorageScope: scopeA,
    persistReportReceiptOnDevice: true,
  };
  assert.equal(mayPersistGeneratedReportReceipt(draft, localOptions), true);
  assert.equal(mayPersistGeneratedReportReceipt(draft, { ...localOptions, privateCase: true }), false);

  const protection = {
    kind: "case-protection-v1" as const,
    copyProtected: false,
    copyPolicy: "fork_allowed" as const,
    parentCode: null,
    currentCode: "",
    seal: "",
  };
  for (const protectedDraft of [
    { ...draft, protection: { ...protection, copyProtected: true, copyPolicy: "lineage_locked" as const } },
    { ...draft, protection: { ...protection, parentCode: "parent-code" } },
    { ...draft, protection: { ...protection, currentCode: "current-code" } },
    { ...draft, protection: { ...protection, seal: "server-seal" } },
  ]) {
    assert.equal(mayPersistGeneratedReportReceipt(protectedDraft, localOptions), false);
  }

  const accountA = caseReportReceiptBinding(draft, localOptions);
  const accountBMemoryOnly = caseReportReceiptBinding(draft, {
    ...localOptions,
    reportReceiptStorageScope: "b".repeat(64),
    persistReportReceiptOnDevice: false,
  });
  assert.deepEqual(accountBMemoryOnly, accountA, "storage scope and eligibility must not affect receipt fingerprints");
});

test("rendered protection identifiers participate in the presentation receipt only when visible", () => {
  const protection = {
    kind: "case-protection-v1" as const,
    copyProtected: false,
    copyPolicy: "fork_allowed" as const,
    parentCode: null,
    currentCode: `sha256-${"a".repeat(64)}`,
    seal: `hmac-sha256-${"b".repeat(64)}`,
  };
  const protectedDraft = { ...draft, protection };
  const changedCode = { ...protectedDraft, protection: { ...protection, currentCode: `sha256-${"c".repeat(64)}` } };
  const changedPolicy = { ...protectedDraft, protection: { ...protection, copyProtected: true, copyPolicy: "lineage_locked" as const } };
  const visible = { ...options, includeTechnicalIds: true };
  assert.notEqual(caseReportReceiptBinding(protectedDraft, visible).presentationFingerprint, caseReportReceiptBinding(changedCode, visible).presentationFingerprint);
  assert.notEqual(caseReportReceiptBinding(protectedDraft, visible).presentationFingerprint, caseReportReceiptBinding(changedPolicy, visible).presentationFingerprint);
  const hidden = { ...options, includeTechnicalIds: false };
  assert.equal(caseReportReceiptBinding(protectedDraft, hidden).presentationFingerprint, caseReportReceiptBinding(changedCode, hidden).presentationFingerprint);
  assert.equal(caseReportReceiptBinding(protectedDraft, hidden).presentationFingerprint, caseReportReceiptBinding(changedPolicy, hidden).presentationFingerprint);
});

test("receipt freshness derives the exact production layout and the legacy landscape path is absent", () => {
  const artifacts = buildCaseReportArtifacts(draft, options);
  const current = caseReportReceiptBinding(draft, options);
  assert.deepEqual(current, {
    reportFingerprint: artifacts.reportModel.contentFingerprint,
    layoutFingerprint: artifacts.layoutModel.layoutFingerprint,
    presentationFingerprint: artifacts.presentationFingerprint,
  });
  const receipt = reportReceipt(artifacts.reportModel, options.generatedAt, {
    layoutSchemaVersion: artifacts.layoutModel.layoutSchemaVersion,
    layoutAlgorithmVersion: artifacts.layoutModel.layoutAlgorithmVersion,
    layoutRendererVersion: artifacts.layoutModel.layoutRendererVersion,
    layoutFingerprint: artifacts.layoutModel.layoutFingerprint,
    presentationFingerprint: artifacts.presentationFingerprint,
  });
  const timestampOnly = caseReportReceiptBinding(draft, { ...options, generatedAt: "2035-01-01T00:00:00.000Z" });
  assert.deepEqual(timestampOnly, current);
  assert.equal(isReportReceiptStale(receipt, draft, options.profileId, timestampOnly), false);

  const renderAffectingChanges: CaseReportOptions[] = [
    { ...options, preparedFor: "A different active recipient" },
    { ...options, preparedBy: "A different preparer" },
    { ...options, matterReference: "MAT-002" },
    { ...options, profileLabel: "Alternate presentation label" },
    { ...options, confidentiality: "internal" },
    { ...options, includeEconomics: false },
    { ...options, includeRegisters: false },
    { ...options, includeSources: false },
    { ...options, includeAuditTrail: false },
    { ...options, includeTechnicalIds: false },
    { ...options, language: "ru" },
    { ...options, audience: "client" },
    { ...options, status: "final" },
    { ...options, reviewerName: "A different reviewer" },
    { ...options, reviewerApproved: true },
    { ...options, redactedNodeIds: ["evidence-1"] },
  ];
  for (const changedOptions of renderAffectingChanges) {
    assert.equal(
      isReportReceiptStale(receipt, draft, options.profileId, caseReportReceiptBinding(draft, changedOptions)),
      true,
    );
  }

  const dialogSource = readFileSync(new URL("../app/CaseReportDialog.tsx", import.meta.url), "utf8");
  const reportSource = readFileSync(new URL("../app/case-report.ts", import.meta.url), "utf8");
  assert.match(dialogSource, /caseReportReceiptBinding\(draft, activeReportOptions\)/);
  assert.match(dialogSource, /isReportReceiptStale\(previousReceipt, draft, profileId, currentReceiptBinding\)/);
  assert.match(dialogSource, /Current content and layout receipt found/);
  assert.match(dialogSource, /full portrait graph/);
  assert.match(dialogSource, /complete text alternative/);
  assert.match(dialogSource, /readStoredReportReceipt\(window\.localStorage/);
  assert.match(reportSource, /try \{\s+writeStoredReportReceipt\(window\.localStorage/, "blocked browser storage cannot fail a completed PDF download");
  assert.doesNotMatch(dialogSource, /localStorage\.getItem/);
  assert.doesNotMatch(reportSource, /localStorage\.setItem/);
  assert.doesNotMatch(reportSource, /caseReportGraphPageIds|caseReportGraphSvg|function graphAppendix|pageOrientation:"landscape"/);
});
