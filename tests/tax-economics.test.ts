import assert from "node:assert/strict";
import test from "node:test";
import { calculateTaxEconomics, normalizeTaxEconomics, prefillTaxEconomicsFromDeal, rentalTaxBaseFromDeal } from "../app/tax-economics";
import { inferDealEconomicsFromText } from "../app/deal-economics";

function model(overrides: Record<string, unknown> = {}) {
  return normalizeTaxEconomics({
    kind: "tax-economics-v1",
    currency: "EUR",
    baselineAnnualTaxCost: 250_000,
    optimizedAnnualTaxCost: 180_000,
    implementationCost: 85_000,
    annualMaintenanceCost: 15_000,
    terminalTaxOrUnwindCost: 0,
    analysisHorizonMonths: 36,
    annualDiscountRateBps: 0,
    benefitRealizationBps: 10_000,
    assumptions: "Illustrative documented assumptions.",
    ...overrides,
  })!;
}

test("tax economics deterministically calculates benefit, payback, lifecycle ROI and NPV", () => {
  const result = calculateTaxEconomics(model());
  assert.equal(result.grossAnnualTaxSaving, 70_000);
  assert.equal(result.operatingAnnualBenefit, 55_000);
  assert.equal(result.annualizedImplementationCost, 85_000 / 3);
  assert.equal(result.netAnnualBenefit, 55_000 - 85_000 / 3);
  assert.equal(result.paybackMonths, 85_000 / 55_000 * 12);
  assert.equal(result.lifecycleCost, 130_000);
  assert.equal(result.horizonNetBenefit, 80_000);
  assert.equal(result.lifecycleRoiPercent, 80_000 / 130_000 * 100);
  assert.ok(Math.abs(result.npv - 80_000) < 1e-7);
});

test("tax economics keeps downside conservative and reports no payback", () => {
  const result = calculateTaxEconomics(model({ baselineAnnualTaxCost: 100_000, optimizedAnnualTaxCost: 120_000, benefitRealizationBps: 1_000, terminalTaxOrUnwindCost: 40_000 }));
  assert.equal(result.recognizedAnnualTaxSaving, -20_000, "downside is not probability-discounted away");
  assert.equal(result.operatingAnnualBenefit, -35_000);
  assert.equal(result.netAnnualBenefit, -35_000 - 85_000 / 3);
  assert.equal(result.paybackMonths, null);
  assert.ok(result.npv < 0);
});

test("tax economics derives annual tax from an entered base and percentage rates", () => {
  const result = calculateTaxEconomics(model({ taxInputBasis: "rates", annualTaxBase: 1_000_000, baselineTaxRateBps: 3_500, optimizedTaxRateBps: 200 }));
  assert.equal(result.baselineAnnualTaxCost, 350_000);
  assert.equal(result.optimizedAnnualTaxCost, 20_000);
  assert.equal(result.grossAnnualTaxSaving, 330_000);
  assert.equal(result.operatingAnnualBenefit, 315_000);
  assert.equal(result.netAnnualBenefit, 315_000 - 85_000 / 3);
});

test("property case prefills the rental tax base, case currency and structure costs", () => {
  const deal = inferDealEconomicsFromText("Chinese resident buying a UK property worth 1mGBP; 80pct financing at 7,5pct for 10years; five monthly rents totalling £10,800; current gross £129,600/year. 1 time structure fee 15,000 GBP, 10,000 GBP for administration annually.");
  assert.ok(deal);
  const breakdown = rentalTaxBaseFromDeal(deal);
  assert.deepEqual(breakdown, {
    currency: "GBP",
    grossAnnualRent: 129_600,
    rentalPropertyExpenses: 25_920,
    loanInterestExpense: 60_000,
    annualTaxBase: 43_680,
    propertyExpensesEstimated: true,
  });
  const tax = prefillTaxEconomicsFromDeal(undefined, deal);
  assert.equal(tax.currency, "GBP");
  assert.equal(tax.taxInputBasis, "rates");
  assert.equal(tax.annualTaxBase, 43_680);
  assert.equal(tax.implementationCost, 15_000);
  assert.equal(tax.annualMaintenanceCost, 10_000);
});

test("tax economics validates caps, currency and zero-investment payback", () => {
  assert.equal(calculateTaxEconomics(model({ implementationCost: 0 })).paybackMonths, 0);
  assert.equal(normalizeTaxEconomics(undefined), undefined);
  assert.throws(() => normalizeTaxEconomics({ ...model(), currency: "EURO" }), /three-letter ISO/);
  assert.throws(() => normalizeTaxEconomics({ ...model(), analysisHorizonMonths: 241 }), /analysis horizon/);
  assert.throws(() => normalizeTaxEconomics({ ...model(), annualDiscountRateBps: 5001 }), /discount rate/);
  assert.throws(() => normalizeTaxEconomics({ ...model(), benefitRealizationBps: 10001 }), /benefit realization/);
});
