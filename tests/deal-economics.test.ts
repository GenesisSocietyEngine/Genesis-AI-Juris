import assert from "node:assert/strict";
import test from "node:test";
import { calculateDealEconomics, inferDealEconomicsFromText, normalizeDealEconomics } from "../app/deal-economics";

const propertyCase = "Chinese resident buying a UK property worth 1mGBP; 80pct financing at 7,5pct for 10years; at least 10pct annual return. Five monthly rents totalling £10,800; current gross £129,600/year. 1 time structure fee 15,000 GBP, 10,000 GBP for administration annually.";

test("legacy labelled property text produces the expected reviewed cash-flow inputs", () => {
  const model = inferDealEconomicsFromText(propertyCase);
  assert.ok(model);
  assert.deepEqual({
    currency: model.currency,
    purchasePrice: model.purchasePrice,
    loanToValueBps: model.loanToValueBps,
    annualInterestRateBps: model.annualInterestRateBps,
    termMonths: model.termMonths,
    grossAnnualIncome: model.grossAnnualIncome,
    oneOffStructureCost: model.oneOffStructureCost,
    annualStructureCost: model.annualStructureCost,
    targetAnnualReturnBps: model.targetAnnualReturnBps,
  }, {
    currency: "GBP", purchasePrice: 1_000_000, loanToValueBps: 8_000, annualInterestRateBps: 750, termMonths: 120,
    grossAnnualIncome: 129_600, oneOffStructureCost: 15_000, annualStructureCost: 10_000, targetAnnualReturnBps: 1_000,
  });
});

test("deal outcome distinguishes interest-only from amortizing debt without inventing a basis", () => {
  const model = inferDealEconomicsFromText(propertyCase);
  assert.ok(model);
  const result = calculateDealEconomics(model);
  assert.equal(result.loanPrincipal, 800_000);
  assert.equal(result.initialEquity, 215_000);
  assert.equal(result.interestOnly.annualDebtService, 60_000);
  assert.ok(Math.abs((result.amortizing.annualDebtService ?? 0) - 113_953.70) < 0.01);
  assert.ok(Math.abs((result.interestOnly.annualCashFlow ?? 0) - 59_600) < 0.01);
  assert.ok(Math.abs((result.amortizing.annualCashFlow ?? 0) - 5_646.30) < 0.01);
  assert.ok((result.interestOnly.targetGapPercent ?? 0) > 0);
  assert.ok((result.amortizing.targetGapPercent ?? 0) < 0);
  assert.ok(result.missingInputs.includes("property operating costs and vacancy"));
});

test("deal economics rejects malformed currency and impossible percentages", () => {
  const model = inferDealEconomicsFromText(propertyCase);
  assert.ok(model);
  assert.throws(() => normalizeDealEconomics({ ...model, currency: "GB" }), /currency/i);
  assert.throws(() => normalizeDealEconomics({ ...model, loanToValueBps: 10_001 }), /loan to value/i);
});
