import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decisionEconomics } from "../app/report-decision-analysis";
import { buildCaseReportArtifacts, caseReportReceiptBinding, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from "../app/case-integrity";

const draft = normalizeStudioDraft(JSON.parse(readFileSync(new URL("../docs/testing/release-gate-2026-09-23/fiveflats-rent-146000-local-working-copy.studio-draft.json", import.meta.url), "utf8")));
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
