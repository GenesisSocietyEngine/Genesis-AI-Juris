import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decisionEconomics } from "../app/report-decision-analysis";
import { buildCaseReportArtifacts, caseReportReceiptBinding, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { primaryCaseOutput } from "../app/case-type-playbooks";

const draft = normalizeStudioDraft(JSON.parse(readFileSync(new URL("../tests/fixtures/fiveflats-rent-146000.studio-draft.json", import.meta.url), "utf8")));
const options: CaseReportOptions = {
  language: "en", presentationMode: "decision", profileId: "tax_position_memorandum", profileLabel: "Tax position memorandum",
  audience: "internal", confidentiality: "confidential", preparedBy: "", preparedFor: "", matterReference: "",
  includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: false,
  generatedAt: "2026-09-25T15:00:00.000Z", currentFingerprint: caseFingerprint(draft), workspaceFingerprint: null,
  currentPublicationFingerprint: casePublicationFingerprint(draft), workspacePublicationFingerprint: null,
  privateCase: true, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
};
const near = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < .011, `${actual} != ${expected}`);

test("FiveFlats findings reconcile cash, amortization, sensitivity and thresholds", () => {
  const a = decisionEconomics(draft.dealEconomics!);
  near(a.result.netOperatingIncomeBeforeUnknownCosts, 99500);
  near(a.selected!.annualDebtService, 113953.70);
  near(a.selected!.annualCashFlow, -14453.70);
  near(a.firstYearInterest, 58106.15);
  near(a.firstYearPrincipal, 55847.54);
  near(a.breakEvenIncome, 165271.60);
  near(a.targetIncome, 203271.60);
  near(a.sensitivity[0].cashFlow, -25403.70);
  near(a.sensitivity[2].cashFlow, -3503.70);
});
test("unknown costs stay unknown while adverse known-cost findings remain available", () => {
  const a = decisionEconomics({ ...draft.dealEconomics!, annualStructureCost: null, otherInitialCosts: null });
  assert.equal(a.knownCosts, false); assert.equal(a.initialCostsKnown, false);
  assert.ok(a.selected!.annualCashFlow! < 0);
  assert.deepEqual(a.sensitivity, []); assert.equal(a.targetIncome, null); assert.equal(a.breakEvenIncome, null);
});
test("explicit zero, debt-free, zero-interest and nonviable cost ratios do not invent ratios", () => {
  const m = draft.dealEconomics!;
  near(decisionEconomics({ ...m, annualInterestRateBps: 0 }).selected!.annualDebtService, 80000);
  assert.equal(decisionEconomics({ ...m, loanToValueBps: 0 }).selected!.dscr, null);
  assert.equal(decisionEconomics({ ...m, grossAnnualIncome: 0 }).breakEvenIncome, null);
  assert.equal(decisionEconomics({ ...m, annualOperatingCosts: 146000 }).breakEvenIncome, null);
  assert.equal(decisionEconomics({ ...m, annualStructureCost: 0 }).knownCosts, true);
  assert.equal(decisionEconomics({ ...m, repaymentBasis: "unknown" }).selected, null);
  assert.equal(decisionEconomics({ ...m, termMonths: 6 }).firstYearInterest, null);
});
test("decision PDF foregrounds supported findings and removes technical/probability/tax-saving claims", () => {
  const before = JSON.stringify(draft);
  const s = JSON.stringify(buildCaseReportArtifacts(draft, options).definition.content);
  for (const text of ["Reassess financing", "£109,500", "£99,500", "£14,453.70", "£165,271.60", "A tax advantage is not established", "future-dated entries require correction"]) assert.ok(s.includes(text), text);
  assert.doesNotMatch(s, /(?<![0-9])35\.0%|(?<![0-9])5\.0%|14,850|Loss.*100\.0%|fingerprint|Model inventory|Renderer|Scenario probabilities are pre-tax/);
  assert.equal(JSON.stringify(draft), before);
});
test("full format removes probability labels and qualifies arithmetic tax estimates", () => {
  const s = JSON.stringify(buildCaseReportArtifacts(draft, { ...options, presentationMode: "full" }).definition.content);
  assert.doesNotMatch(s, /cash-flow probability ranges|\"Probability\"/);
  assert.match(s, /Unverified tax scenario/);
});
test("formats have different exact receipt identities while non-visible audit controls are inert", () => {
  const decision = caseReportReceiptBinding(draft, options);
  const full = caseReportReceiptBinding(draft, { ...options, presentationMode: "full" });
  assert.equal(decision.reportFingerprint, full.reportFingerprint);
  assert.notEqual(decision.presentationFingerprint, full.presentationFingerprint);
  assert.deepEqual(decision, caseReportReceiptBinding(draft, { ...options, includeAuditTrail: true, includeTechnicalIds: true }));
});
test("decision-tree choice controls diagram and text appendix in both report formats", () => {
  for (const presentationMode of ["decision", "full"] as const) {
    const off = buildCaseReportArtifacts(draft, { ...options, presentationMode, includeDecisionTree: false });
    const on = buildCaseReportArtifacts(draft, { ...options, presentationMode, includeDecisionTree: true });
    const offText = JSON.stringify(off.definition.content), onText = JSON.stringify(on.definition.content);
    assert.doesNotMatch(offText, /<svg|Complete graph text alternative/);
    assert.match(onText, /<svg/); assert.match(onText, /Complete graph text alternative/);
    assert.equal(off.reportModel.contentFingerprint, on.reportModel.contentFingerprint);
    assert.notEqual(off.presentationFingerprint, on.presentationFingerprint);
    if (presentationMode === "decision") {
      assert.match(offText, /Tax position memorandum/);
      assert.match(onText, /£14,453.70/); assert.match(offText, /£14,453.70/);
      const base = off.definition.content as unknown[];
      const appended = on.definition.content as unknown[];
      // First four narrative pages and their findings do not depend on diagram inclusion.
      const pageBreak = base.findIndex(item => JSON.stringify(item).includes("What this assessment rests on"));
      assert.equal(JSON.stringify(appended.slice(0, pageBreak)), JSON.stringify(base.slice(0, pageBreak)));
    }
  }
  assert.equal(caseReportReceiptBinding(draft, options).presentationFingerprint,
    caseReportReceiptBinding(draft, { ...options, includeDecisionTree: false }).presentationFingerprint);
  assert.equal(caseReportReceiptBinding(draft, { ...options, presentationMode: "full" }).presentationFingerprint,
    caseReportReceiptBinding(draft, { ...options, presentationMode: "full", includeDecisionTree: true }).presentationFingerprint);
});
test("decision-tree appendix respects redactions and Russian report language", () => {
  const redactedId = draft.nodes.find(n => n.type === "evidence")!.id;
  const source = { ...draft, nodes: draft.nodes.map(n => n.id === redactedId ? { ...n, title: "SECRET TREE TITLE", detail: "SECRET TREE DETAIL" } : n) };
  const s = JSON.stringify(buildCaseReportArtifacts(source, { ...options, includeDecisionTree: true, redactedNodeIds: [redactedId], language: "ru" }).definition.content);
  assert.doesNotMatch(s, /SECRET TREE TITLE|SECRET TREE DETAIL/);
  assert.match(s, /Полная текстовая альтернатива графа/);
});
test("Medium retains base findings, adds visual graph pages and omits verbose graph registers", () => {
  const base = buildCaseReportArtifacts(draft, options);
  const mediumOptions = { ...options, presentationMode: "medium" as const };
  const medium = buildCaseReportArtifacts(draft, mediumOptions);
  const content = medium.definition.content as unknown[];
  const baseContent = base.definition.content as unknown[];
  const evidenceStart = baseContent.findIndex(item => JSON.stringify(item).includes("What this assessment rests on"));
  assert.equal(JSON.stringify(content.slice(0, evidenceStart)), JSON.stringify(baseContent.slice(0, evidenceStart)));
  const text = JSON.stringify(content);
  assert.match(text, /£14,453.70/); assert.match(text, /£109,500/); assert.match(text, /<svg/);
  assert.doesNotMatch(text, /Complete graph text alternative|Directed adjacency register|Paired connector index/);
  assert.doesNotMatch(text, /BPMN-inspired off-page continuity|Layout 1\./);
  assert.match(text, /Page labels connect branches across pages/);
  assert.equal(content.filter(item => item && typeof item === "object" && "svg" in item).length, medium.layoutModel.graphPages.length);
  assert.equal(base.reportModel.contentFingerprint, medium.reportModel.contentFingerprint);
  assert.notEqual(base.presentationFingerprint, medium.presentationFingerprint);
  assert.notEqual(medium.presentationFingerprint, buildCaseReportArtifacts(draft, { ...options, includeDecisionTree: true }).presentationFingerprint);
  assert.deepEqual(caseReportReceiptBinding(draft, mediumOptions), caseReportReceiptBinding(draft, { ...mediumOptions, includeDecisionTree: false, includeAuditTrail: true, includeTechnicalIds: true }));
});
test("Medium keeps Canopy nonfinancial and respects graph redactions in Russian", () => {
  const canopy = buildCanopyPackage("base").draft;
  const profile = primaryCaseOutput(canopy.caseType);
  const report = buildCaseReportArtifacts(canopy, { ...options, presentationMode: "medium", profileId: profile.id, profileLabel: profile.label.en });
  assert.match(JSON.stringify(report.definition.content), /<svg/);
  assert.doesNotMatch(JSON.stringify(report.definition.content), /Annual cash bridge|Finance adviser|Complete graph text alternative/);
  const evidenceId = draft.nodes.find(n => n.type === "evidence")!.id;
  const source = { ...draft, nodes: draft.nodes.map(n => n.id === evidenceId ? { ...n, title: "MEDIUM PRIVATE TITLE", detail: "MEDIUM PRIVATE DETAIL" } : n) };
  const text = JSON.stringify(buildCaseReportArtifacts(source, { ...options, presentationMode: "medium", language: "ru", redactedNodeIds: [evidenceId] }).definition.content);
  assert.doesNotMatch(text, /MEDIUM PRIVATE TITLE|MEDIUM PRIVATE DETAIL|Полная текстовая альтернатива графа/);
  assert.match(text, /Визуальное дерево решений/);
});
test("redacted records and raw intake are absent and economics exclusion is respected", () => {
  const source = { ...draft, premise: "SECRET RAW INTAKE", premisePublication: undefined, nodes: draft.nodes.map(n => n.id === "evidence-1" ? { ...n, title: "SECRET EVIDENCE" } : n) };
  const s = JSON.stringify(buildCaseReportArtifacts(source, { ...options, redactedNodeIds: ["evidence-1"], includeEconomics: false }).definition.content);
  assert.doesNotMatch(s, /SECRET RAW INTAKE|SECRET EVIDENCE|Annual cash bridge|£165,271/);
});
test("Russian decision report and interest-only report retain material qualifications", () => {
  const source = { ...draft, dealEconomics: { ...draft.dealEconomics!, repaymentBasis: "interest_only" as const } };
  const s = JSON.stringify(buildCaseReportArtifacts(source, options).definition.content);
  assert.match(s, /Principal remains payable/); assert.match(s, /£800,000/);
  assert.match(JSON.stringify(buildCaseReportArtifacts(draft, { ...options, language: "ru" }).definition.content), /Пересмотреть финансирование/);
});

 test("short loans and debt-free deficits do not misstate a financing conclusion", () => {
  const short = { ...draft, dealEconomics: { ...draft.dealEconomics!, termMonths: 6 } };
  const s = JSON.stringify(buildCaseReportArtifacts(short, options).definition.content);
  assert.doesNotMatch(s, /annual cash shortfall|Cash break-even requires/);
  assert.match(s, /less than a year/);
  const noDebt = { ...draft, dealEconomics: { ...draft.dealEconomics!, loanToValueBps: 0, annualOperatingCosts: 160000 } };
  assert.match(JSON.stringify(buildCaseReportArtifacts(noDebt, options).definition.content), /Reassess operating economics/);
  assert.throws(() => decisionEconomics({ ...draft.dealEconomics!, grossAnnualIncome: Number.NaN }), /Invalid/);
});

test("nonfinancial report uses a human objective and no invented financing agenda", () => {
 const source = { ...draft, dealEconomics: undefined, taxEconomics: undefined, premisePublication: 'author-reviewed' as const, premise: 'Decide whether to proceed. Pinned reviewed inputs: {"technicalKey":123}' };
 const s = JSON.stringify(buildCaseReportArtifacts(source, options).definition.content);
 assert.match(s, /Decide whether to proceed/);
 assert.doesNotMatch(s, /technicalKey|Finance adviser|Reading the measures/);
 assert.match(s, /Detailed pinned scenario inputs remain/);
});
