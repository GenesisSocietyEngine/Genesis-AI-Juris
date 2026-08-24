import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseReportDefinition, caseReportGraphPageIds, caseReportGraphSvg, type CaseReportOptions } from "../app/case-report";
import type { StudioDraft } from "../app/types";

const draft: StudioDraft = {
  caseId: "uk_property_structure",
  version: "1.0.0",
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
  language: "en", audience: "internal", confidentiality: "confidential", preparedBy: "Reviewer", preparedFor: "Client", matterReference: "MAT-001",
  includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: true, includeTechnicalIds: true,
  generatedAt: "2026-08-23T12:05:00.000Z", currentFingerprint: "sha256-current", workspaceFingerprint: "sha256-current", privateCase: true,
};

test("professional report contains economics, registers, sign-off and a safe audit trail", () => {
  const report = buildCaseReportDefinition(draft, options);
  const source = JSON.stringify(report.content);
  assert.match(source, /PROFESSIONAL CASE REPORT/);
  assert.match(source, /Investment and cash-flow analysis/);
  assert.match(source, /Illustrative annual cash-flow probability ranges/);
  assert.match(source, /Facts, evidence and rules register/);
  assert.match(source, /Verification and sign-off/);
  assert.match(source, /Graph and node conditions/);
  assert.match(source, /N01/);
  assert.match(source, /<svg/);
  assert.match(source, /right-hand register/);
  assert.match(source, /AI-assisted revision recorded - raw prompt excluded/);
  assert.doesNotMatch(source, /SECRET RAW PROMPT CONTENT/);
});

test("client-facing report can omit audit trail and technical identifiers", () => {
  const report = buildCaseReportDefinition(draft, { ...options, audience: "client", includeAuditTrail: false, includeTechnicalIds: false });
  const source = JSON.stringify(report.content);
  assert.doesNotMatch(source, /Authoring and review trail/);
  assert.doesNotMatch(source, /\[evidence-1\]/);
  assert.match(source, /Loan term sheet/);
});

test("graph appendix keeps a readable local crop parallel to bounded node-register groups", () => {
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
  const pages = caseReportGraphPageIds(longDraft);
  assert.ok(pages.length >= 6, "a long chain must be sliced rather than scaled as one full-height graph");
  assert.deepEqual(pages.flat().sort(), longDraft.nodes.map((node) => node.id).sort());
  assert.ok(pages.every((page) => page.length >= 1 && page.length <= 4));
  for (const page of pages) {
    const svg = caseReportGraphSvg(longDraft, new Set(page));
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].split(" ").map(Number);
    assert.ok(viewBox && viewBox.length === 4);
    assert.ok(viewBox[2] >= 650, "a graph crop keeps a stable readable width");
    assert.ok(viewBox[3] <= 900, "a graph crop cannot collapse into a full-graph vertical strip");
  }
  const source = JSON.stringify(buildCaseReportDefinition(longDraft, options).content);
  assert.match(source, /"fit":\[410,390\]/);
  assert.match(source, /"unbreakable":true/);
});
