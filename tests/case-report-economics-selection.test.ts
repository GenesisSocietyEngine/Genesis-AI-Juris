import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { buildCaseReportDefinition, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";

for (const language of ["en", "ru"] as const) {
  test(`economics selection also controls the decision brief (${language})`, () => {
    const { draft } = buildCanopyPackage("base");
    draft.dealEconomics = {
      kind: "deal-economics-v1", currency: "EUR", purchasePrice: 100000,
      loanToValueBps: 5000, annualInterestRateBps: 500, termMonths: 120,
      repaymentBasis: "interest_only", grossAnnualIncome: 10000, annualOperatingCosts: 1000,
      oneOffStructureCost: 1000, annualStructureCost: 100, otherInitialCosts: 0,
      targetAnnualReturnBps: 1000,
      scenarioProbabilities: { interestOnlyBps: 5000, favorableBps: 2500, baseBps: 5000, stressedBps: 2500 },
      assumptions: ["DEAL_ASSUMPTION_SELECTION_MARKER"],
    };
    draft.nodes.push({ id: "selection-cash-flow", type: "cash_flow", title: "Recorded funding flow", detail: "Graph funding evidence stays visible.", x: 0, y: 0 });
    draft.taxEconomics = {
      kind: "tax-economics-v1", currency: "EUR", taxInputBasis: "amounts",
      annualTaxBase: 0, baselineTaxRateBps: 0, optimizedTaxRateBps: 0,
      baselineAnnualTaxCost: 1000, optimizedAnnualTaxCost: 900,
      implementationCost: 100, annualMaintenanceCost: 10, terminalTaxOrUnwindCost: 0,
      analysisHorizonMonths: 12, annualDiscountRateBps: 500, benefitRealizationBps: 10000,
      assumptions: "TAX_ASSUMPTION_SELECTION_MARKER",
    };
    const original = JSON.stringify(draft);
    const profile = primaryCaseOutput(draft.caseType);
    const options: CaseReportOptions = {
      language, profileId: profile.id, profileLabel: profile.label[language],
      audience: "internal", status: "draft", confidentiality: "draft",
      preparedBy: "Synthetic test", preparedFor: "Product review", matterReference: "SELECTION-TEST",
      includeEconomics: false, includeRegisters: true, includeSources: true,
      includeAuditTrail: false, includeTechnicalIds: false,
      generatedAt: "2026-09-11T12:00:00.000Z", currentFingerprint: caseFingerprint(draft),
      currentPublicationFingerprint: casePublicationFingerprint(draft),
      workspaceFingerprint: null, workspacePublicationFingerprint: null, privateCase: false,
      reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
    };
    const excluded = JSON.stringify(buildCaseReportDefinition(draft, options).content);
    for (const marker of ["DEAL_ASSUMPTION_SELECTION_MARKER", "TAX_ASSUMPTION_SELECTION_MARKER"]) {
      assert.ok(!excluded.includes(marker), "excluded economic assumptions must not reappear in the brief");
    }
    assert.doesNotMatch(excluded, /Economics and scenario analysis|Экономика и сценарный анализ|Further assumptions are in the economics appendix|Остальные допущения - в экономическом приложении/);
    assert.match(excluded, language === "en" ? /Economic assumptions are excluded by report settings/ : /Экономические допущения исключены настройками отчёта/);
    // Omitting a presentation section is not authority to redact the canonical graph.
    for (const node of draft.nodes.filter((item) => item.type === "cash_flow")) {
      assert.ok(excluded.includes(node.title), "cash-flow graph records remain available");
      assert.ok(excluded.includes(node.detail), "cash-flow graph details remain available");
    }
    const included = JSON.stringify(buildCaseReportDefinition(draft, { ...options, includeEconomics: true }).content);
    for (const marker of ["DEAL_ASSUMPTION_SELECTION_MARKER", "TAX_ASSUMPTION_SELECTION_MARKER"]) {
      assert.ok(included.includes(marker), "included assumptions remain available");
    }
    assert.match(included, language === "en" ? /Economics and scenario analysis/ : /Экономика и сценарный анализ/);
    assert.equal(JSON.stringify(draft), original, "report selection must not mutate the case");
  });
}
