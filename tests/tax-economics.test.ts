import assert from "node:assert/strict";
import test from "node:test";
import { calculateTaxEconomics, normalizeTaxEconomics } from "../app/tax-economics";

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
  assert.equal(result.netAnnualBenefit, 55_000);
  assert.equal(result.paybackMonths, 85_000 / 55_000 * 12);
  assert.equal(result.lifecycleCost, 130_000);
  assert.equal(result.horizonNetBenefit, 80_000);
  assert.equal(result.lifecycleRoiPercent, 80_000 / 130_000 * 100);
  assert.ok(Math.abs(result.npv - 80_000) < 1e-7);
});

test("tax economics keeps downside conservative and reports no payback", () => {
  const result = calculateTaxEconomics(model({ baselineAnnualTaxCost: 100_000, optimizedAnnualTaxCost: 120_000, benefitRealizationBps: 1_000, terminalTaxOrUnwindCost: 40_000 }));
  assert.equal(result.recognizedAnnualTaxSaving, -20_000, "downside is not probability-discounted away");
  assert.equal(result.netAnnualBenefit, -35_000);
  assert.equal(result.paybackMonths, null);
  assert.ok(result.npv < 0);
});

test("tax economics validates caps, currency and zero-investment payback", () => {
  assert.equal(calculateTaxEconomics(model({ implementationCost: 0 })).paybackMonths, 0);
  assert.equal(normalizeTaxEconomics(undefined), undefined);
  assert.throws(() => normalizeTaxEconomics({ ...model(), currency: "EURO" }), /three-letter ISO/);
  assert.throws(() => normalizeTaxEconomics({ ...model(), analysisHorizonMonths: 241 }), /analysis horizon/);
  assert.throws(() => normalizeTaxEconomics({ ...model(), annualDiscountRateBps: 5001 }), /discount rate/);
  assert.throws(() => normalizeTaxEconomics({ ...model(), benefitRealizationBps: 10001 }), /benefit realization/);
});
