import type { DealEconomicsV1, TaxEconomicsV1 } from "./types";

export type TaxEconomicsResult = {
  baselineAnnualTaxCost: number;
  optimizedAnnualTaxCost: number;
  grossAnnualTaxSaving: number;
  recognizedAnnualTaxSaving: number;
  operatingAnnualBenefit: number;
  annualizedImplementationCost: number;
  netAnnualBenefit: number;
  lifecycleCost: number;
  horizonNetBenefit: number;
  lifecycleRoiPercent: number | null;
  paybackMonths: number | null;
  npv: number;
};

export type RentalTaxBaseBreakdown = {
  currency: string;
  grossAnnualRent: number;
  rentalPropertyExpenses: number;
  loanInterestExpense: number;
  annualTaxBase: number;
  propertyExpensesEstimated: boolean;
};

export function defaultTaxEconomics(currency = "EUR"): TaxEconomicsV1 {
  return {
    kind: "tax-economics-v1",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
    taxInputBasis: "rates",
    annualTaxBase: 0,
    baselineTaxRateBps: 0,
    optimizedTaxRateBps: 0,
    baselineAnnualTaxCost: 0,
    optimizedAnnualTaxCost: 0,
    implementationCost: 0,
    annualMaintenanceCost: 0,
    terminalTaxOrUnwindCost: 0,
    analysisHorizonMonths: 36,
    annualDiscountRateBps: 800,
    benefitRealizationBps: 10000,
    assumptions: "Tax base is prefilled as gross annual rent less rental-property expenses less annual loan-interest expense. Verify every case input and tax rate before relying on the estimate.",
  };
}

export function normalizeTaxEconomics(value: unknown): TaxEconomicsV1 | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || value.kind !== "tax-economics-v1") throw new Error("Invalid tax economics model");
  const currency = typeof value.currency === "string" ? value.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Tax economics currency must be a three-letter ISO code");
  const taxInputBasis = value.taxInputBasis === "rates" ? "rates" : "amounts";
  const fx = normalizeFx(value.fx, currency);
  return {
    kind: "tax-economics-v1",
    currency,
    taxInputBasis,
    annualTaxBase: optionalInteger(value.annualTaxBase, "annual tax base", 0, 1_000_000_000_000),
    baselineTaxRateBps: optionalInteger(value.baselineTaxRateBps, "baseline tax rate", 0, 10_000),
    optimizedTaxRateBps: optionalInteger(value.optimizedTaxRateBps, "optimized tax rate", 0, 10_000),
    baselineAnnualTaxCost: integer(value.baselineAnnualTaxCost, "baseline annual tax cost", 0, 1_000_000_000_000),
    optimizedAnnualTaxCost: integer(value.optimizedAnnualTaxCost, "optimized annual tax cost", 0, 1_000_000_000_000),
    implementationCost: integer(value.implementationCost, "implementation cost", 0, 1_000_000_000_000),
    annualMaintenanceCost: integer(value.annualMaintenanceCost, "annual maintenance cost", 0, 1_000_000_000_000),
    terminalTaxOrUnwindCost: integer(value.terminalTaxOrUnwindCost, "terminal tax or unwind cost", 0, 1_000_000_000_000),
    analysisHorizonMonths: integer(value.analysisHorizonMonths, "analysis horizon", 1, 240),
    annualDiscountRateBps: integer(value.annualDiscountRateBps, "annual discount rate", 0, 5_000),
    benefitRealizationBps: integer(value.benefitRealizationBps, "benefit realization", 0, 10_000),
    assumptions: boundedText(value.assumptions, 4_000),
    ...(fx ? { fx } : {}),
  };
}

export function calculateTaxEconomics(model: TaxEconomicsV1): TaxEconomicsResult {
  const baselineAnnualTaxCost = model.taxInputBasis === "rates" ? model.annualTaxBase * model.baselineTaxRateBps / 10_000 : model.baselineAnnualTaxCost;
  const optimizedAnnualTaxCost = model.taxInputBasis === "rates" ? model.annualTaxBase * model.optimizedTaxRateBps / 10_000 : model.optimizedAnnualTaxCost;
  const grossAnnualTaxSaving = baselineAnnualTaxCost - optimizedAnnualTaxCost;
  // Apply uncertainty only to upside. A downside is never probability-discounted away.
  const recognizedAnnualTaxSaving = grossAnnualTaxSaving >= 0
    ? grossAnnualTaxSaving * model.benefitRealizationBps / 10_000
    : grossAnnualTaxSaving;
  const horizonYears = model.analysisHorizonMonths / 12;
  const annualizedImplementationCost = model.implementationCost / horizonYears;
  const operatingAnnualBenefit = recognizedAnnualTaxSaving - model.annualMaintenanceCost;
  const netAnnualBenefit = operatingAnnualBenefit - annualizedImplementationCost;
  const lifecycleCost = model.implementationCost
    + model.annualMaintenanceCost * horizonYears
    + model.terminalTaxOrUnwindCost;
  const horizonNetBenefit = recognizedAnnualTaxSaving * horizonYears - lifecycleCost;
  const lifecycleRoiPercent = lifecycleCost > 0 ? horizonNetBenefit / lifecycleCost * 100 : null;
  const paybackMonths = operatingAnnualBenefit > 0
    ? model.implementationCost === 0 ? 0 : model.implementationCost / operatingAnnualBenefit * 12
    : null;
  const monthlyRate = model.annualDiscountRateBps === 0
    ? 0
    : (1 + model.annualDiscountRateBps / 10_000) ** (1 / 12) - 1;
  let npv = -model.implementationCost;
  for (let month = 1; month <= model.analysisHorizonMonths; month += 1) {
    npv += (operatingAnnualBenefit / 12) / ((1 + monthlyRate) ** month);
  }
  npv -= model.terminalTaxOrUnwindCost / ((1 + monthlyRate) ** model.analysisHorizonMonths);
  return { baselineAnnualTaxCost, optimizedAnnualTaxCost, grossAnnualTaxSaving, recognizedAnnualTaxSaving, operatingAnnualBenefit, annualizedImplementationCost, netAnnualBenefit, lifecycleCost, horizonNetBenefit, lifecycleRoiPercent, paybackMonths, npv };
}

export function rentalTaxBaseFromDeal(model: DealEconomicsV1): RentalTaxBaseBreakdown | null {
  if (model.grossAnnualIncome === null || model.purchasePrice === null || model.loanToValueBps === null || model.annualInterestRateBps === null) return null;
  const propertyExpensesEstimated = model.annualOperatingCosts === null;
  const rentalPropertyExpenses = model.annualOperatingCosts ?? Math.round(model.grossAnnualIncome * 0.2);
  const loanPrincipal = model.purchasePrice * model.loanToValueBps / 10_000;
  const loanInterestExpense = Math.round(loanPrincipal * model.annualInterestRateBps / 10_000);
  return {
    currency: model.currency,
    grossAnnualRent: model.grossAnnualIncome,
    rentalPropertyExpenses,
    loanInterestExpense,
    annualTaxBase: Math.max(0, Math.round(model.grossAnnualIncome - rentalPropertyExpenses - loanInterestExpense)),
    propertyExpensesEstimated,
  };
}

export function convertRentalTaxBase(breakdown: RentalTaxBaseBreakdown, currency: string, rate: number): RentalTaxBaseBreakdown {
  const convert = (value: number) => Math.round(value * rate);
  return {
    ...breakdown,
    currency,
    grossAnnualRent: convert(breakdown.grossAnnualRent),
    rentalPropertyExpenses: convert(breakdown.rentalPropertyExpenses),
    loanInterestExpense: convert(breakdown.loanInterestExpense),
    annualTaxBase: convert(breakdown.annualTaxBase),
  };
}

export function prefillTaxEconomicsFromDeal(existing: TaxEconomicsV1 | undefined, deal: DealEconomicsV1): TaxEconomicsV1 {
  const unconfigured = !existing || (
    existing.annualTaxBase === 0
    && existing.baselineTaxRateBps === 0
    && existing.optimizedTaxRateBps === 0
    && existing.baselineAnnualTaxCost === 0
    && existing.optimizedAnnualTaxCost === 0
    && existing.implementationCost === 0
    && existing.annualMaintenanceCost === 0
    && !existing.fx
  );
  const base = existing ?? defaultTaxEconomics(deal.currency);
  const currency = unconfigured ? deal.currency : base.currency;
  const rawBreakdown = rentalTaxBaseFromDeal(deal);
  const fxRate = base.fx?.sourceCurrency === deal.currency && base.fx.targetCurrency === currency ? base.fx.rate : null;
  const breakdown = rawBreakdown && (currency === deal.currency || fxRate)
    ? currency === deal.currency ? rawBreakdown : convertRentalTaxBase(rawBreakdown, currency, fxRate as number)
    : null;
  const convertCaseAmount = (value: number | null) => value === null ? null : Math.round(value * (currency === deal.currency ? 1 : fxRate ?? 1));
  const implementationFromCase = convertCaseAmount(deal.oneOffStructureCost);
  const maintenanceFromCase = convertCaseAmount(deal.annualStructureCost);
  return {
    ...base,
    currency,
    taxInputBasis: unconfigured ? "rates" : base.taxInputBasis,
    annualTaxBase: breakdown?.annualTaxBase ?? base.annualTaxBase,
    implementationCost: (unconfigured || base.implementationCost === 0) && implementationFromCase !== null ? implementationFromCase : base.implementationCost,
    annualMaintenanceCost: (unconfigured || base.annualMaintenanceCost === 0) && maintenanceFromCase !== null ? maintenanceFromCase : base.annualMaintenanceCost,
  };
}

export function applyDealChangeToTaxEconomics(model: TaxEconomicsV1, deal: DealEconomicsV1, change: Partial<DealEconomicsV1>) {
  const rate = model.currency === deal.currency ? 1 : model.fx?.sourceCurrency === deal.currency && model.fx.targetCurrency === model.currency ? model.fx.rate : null;
  if (rate === null) return model;
  const next = { ...model };
  if (["grossAnnualIncome", "annualOperatingCosts", "purchasePrice", "loanToValueBps", "annualInterestRateBps"].some((key) => Object.hasOwn(change, key))) {
    const breakdown = rentalTaxBaseFromDeal(deal);
    if (breakdown) next.annualTaxBase = Math.round(breakdown.annualTaxBase * rate);
  }
  if (Object.hasOwn(change, "oneOffStructureCost") && deal.oneOffStructureCost !== null) next.implementationCost = Math.round(deal.oneOffStructureCost * rate);
  if (Object.hasOwn(change, "annualStructureCost") && deal.annualStructureCost !== null) next.annualMaintenanceCost = Math.round(deal.annualStructureCost * rate);
  return next;
}

function normalizeFx(value: unknown, currency: string): TaxEconomicsV1["fx"] {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || value.provider !== "ECB") throw new Error("Invalid tax economics FX metadata");
  const sourceCurrency = typeof value.sourceCurrency === "string" ? value.sourceCurrency.trim().toUpperCase() : "";
  const targetCurrency = typeof value.targetCurrency === "string" ? value.targetCurrency.trim().toUpperCase() : "";
  const rate = value.rate;
  const asOf = typeof value.asOf === "string" ? value.asOf : "";
  if (!/^[A-Z]{3}$/.test(sourceCurrency) || targetCurrency !== currency || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("Invalid tax economics FX metadata");
  return { provider: "ECB", sourceCurrency, targetCurrency, rate, asOf };
}

function optionalInteger(value: unknown, label: string, minimum: number, maximum: number) {
  if (value === undefined || value === null) return 0;
  return integer(value, label, minimum, maximum);
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
