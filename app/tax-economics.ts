import type { TaxEconomicsV1 } from "./types";

export type TaxEconomicsResult = {
  grossAnnualTaxSaving: number;
  recognizedAnnualTaxSaving: number;
  netAnnualBenefit: number;
  lifecycleCost: number;
  horizonNetBenefit: number;
  lifecycleRoiPercent: number | null;
  paybackMonths: number | null;
  npv: number;
};

export function defaultTaxEconomics(): TaxEconomicsV1 {
  return {
    kind: "tax-economics-v1",
    currency: "EUR",
    baselineAnnualTaxCost: 0,
    optimizedAnnualTaxCost: 0,
    implementationCost: 0,
    annualMaintenanceCost: 0,
    terminalTaxOrUnwindCost: 0,
    analysisHorizonMonths: 36,
    annualDiscountRateBps: 800,
    benefitRealizationBps: 10000,
    assumptions: "Replace the zero values with documented cash-tax and implementation assumptions before relying on this estimate.",
  };
}

export function normalizeTaxEconomics(value: unknown): TaxEconomicsV1 | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || value.kind !== "tax-economics-v1") throw new Error("Invalid tax economics model");
  const currency = typeof value.currency === "string" ? value.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Tax economics currency must be a three-letter ISO code");
  return {
    kind: "tax-economics-v1",
    currency,
    baselineAnnualTaxCost: integer(value.baselineAnnualTaxCost, "baseline annual tax cost", 0, 1_000_000_000_000),
    optimizedAnnualTaxCost: integer(value.optimizedAnnualTaxCost, "optimized annual tax cost", 0, 1_000_000_000_000),
    implementationCost: integer(value.implementationCost, "implementation cost", 0, 1_000_000_000_000),
    annualMaintenanceCost: integer(value.annualMaintenanceCost, "annual maintenance cost", 0, 1_000_000_000_000),
    terminalTaxOrUnwindCost: integer(value.terminalTaxOrUnwindCost, "terminal tax or unwind cost", 0, 1_000_000_000_000),
    analysisHorizonMonths: integer(value.analysisHorizonMonths, "analysis horizon", 1, 240),
    annualDiscountRateBps: integer(value.annualDiscountRateBps, "annual discount rate", 0, 5_000),
    benefitRealizationBps: integer(value.benefitRealizationBps, "benefit realization", 0, 10_000),
    assumptions: boundedText(value.assumptions, 4_000),
  };
}

export function calculateTaxEconomics(model: TaxEconomicsV1): TaxEconomicsResult {
  const grossAnnualTaxSaving = model.baselineAnnualTaxCost - model.optimizedAnnualTaxCost;
  // Apply uncertainty only to upside. A downside is never probability-discounted away.
  const recognizedAnnualTaxSaving = grossAnnualTaxSaving >= 0
    ? grossAnnualTaxSaving * model.benefitRealizationBps / 10_000
    : grossAnnualTaxSaving;
  const netAnnualBenefit = recognizedAnnualTaxSaving - model.annualMaintenanceCost;
  const horizonYears = model.analysisHorizonMonths / 12;
  const lifecycleCost = model.implementationCost
    + model.annualMaintenanceCost * horizonYears
    + model.terminalTaxOrUnwindCost;
  const horizonNetBenefit = recognizedAnnualTaxSaving * horizonYears - lifecycleCost;
  const lifecycleRoiPercent = lifecycleCost > 0 ? horizonNetBenefit / lifecycleCost * 100 : null;
  const paybackMonths = netAnnualBenefit > 0
    ? model.implementationCost === 0 ? 0 : model.implementationCost / netAnnualBenefit * 12
    : null;
  const monthlyRate = model.annualDiscountRateBps === 0
    ? 0
    : (1 + model.annualDiscountRateBps / 10_000) ** (1 / 12) - 1;
  let npv = -model.implementationCost;
  for (let month = 1; month <= model.analysisHorizonMonths; month += 1) {
    npv += (netAnnualBenefit / 12) / ((1 + monthlyRate) ** month);
  }
  npv -= model.terminalTaxOrUnwindCost / ((1 + monthlyRate) ** model.analysisHorizonMonths);
  return { grossAnnualTaxSaving, recognizedAnnualTaxSaving, netAnnualBenefit, lifecycleCost, horizonNetBenefit, lifecycleRoiPercent, paybackMonths, npv };
}

function integer(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
