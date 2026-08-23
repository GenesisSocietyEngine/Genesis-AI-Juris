import type { DealEconomicsV1 } from "./types";

export type DealScenarioResult = {
  basis: "amortizing" | "interest_only";
  annualDebtService: number | null;
  annualCashFlow: number | null;
  cashOnCashReturnPercent: number | null;
  targetGapPercent: number | null;
  dscr: number | null;
};

export type DealEconomicsResult = {
  loanPrincipal: number | null;
  initialEquity: number | null;
  netOperatingIncomeBeforeUnknownCosts: number | null;
  amortizing: DealScenarioResult;
  interestOnly: DealScenarioResult;
  missingInputs: string[];
};

export type DealCashFlowProbabilityBand = {
  key: "loss" | "below_target" | "target_to_double" | "strong_upside";
  minimum: number | null;
  maximum: number | null;
  probabilityPercent: number;
};

export type DealCashFlowProbabilityEstimate = {
  bands: DealCashFlowProbabilityBand[];
  targetCashFlow: number | null;
  usesRepaymentBasisPrior: boolean;
  usesOperatingCostStress: boolean;
};

export function normalizeDealEconomics(value: unknown): DealEconomicsV1 | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || value.kind !== "deal-economics-v1") throw new Error("Invalid deal economics model");
  const currency = typeof value.currency === "string" ? value.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Deal economics currency must be a three-letter ISO code");
  const repaymentBasis = value.repaymentBasis === "amortizing" || value.repaymentBasis === "interest_only" || value.repaymentBasis === "unknown"
    ? value.repaymentBasis
    : null;
  if (!repaymentBasis) throw new Error("Invalid deal repayment basis");
  return {
    kind: "deal-economics-v1",
    currency,
    purchasePrice: nullableInteger(value.purchasePrice, "purchase price", 0, 1_000_000_000_000),
    loanToValueBps: nullableInteger(value.loanToValueBps, "loan to value", 0, 10_000),
    annualInterestRateBps: nullableInteger(value.annualInterestRateBps, "annual interest rate", 0, 10_000),
    termMonths: nullableInteger(value.termMonths, "loan term", 1, 1_200),
    repaymentBasis,
    grossAnnualIncome: nullableInteger(value.grossAnnualIncome, "gross annual income", 0, 1_000_000_000_000),
    annualOperatingCosts: nullableInteger(value.annualOperatingCosts, "annual operating costs", 0, 1_000_000_000_000),
    oneOffStructureCost: nullableInteger(value.oneOffStructureCost, "one-off structure cost", 0, 1_000_000_000_000),
    annualStructureCost: nullableInteger(value.annualStructureCost, "annual structure cost", 0, 1_000_000_000_000),
    otherInitialCosts: nullableInteger(value.otherInitialCosts, "other initial costs", 0, 1_000_000_000_000),
    targetAnnualReturnBps: nullableInteger(value.targetAnnualReturnBps, "target annual return", 0, 100_000),
    assumptions: textList(value.assumptions, 12, 500),
  };
}

export function calculateDealEconomics(model: DealEconomicsV1): DealEconomicsResult {
  const loanPrincipal = model.purchasePrice !== null && model.loanToValueBps !== null
    ? model.purchasePrice * model.loanToValueBps / 10_000
    : null;
  const initialEquity = model.purchasePrice !== null && loanPrincipal !== null
    ? model.purchasePrice - loanPrincipal + (model.oneOffStructureCost ?? 0) + (model.otherInitialCosts ?? 0)
    : null;
  const netOperatingIncomeBeforeUnknownCosts = model.grossAnnualIncome !== null
    ? model.grossAnnualIncome - (model.annualOperatingCosts ?? 0) - (model.annualStructureCost ?? 0)
    : null;
  const interestOnlyDebtService = loanPrincipal !== null && model.annualInterestRateBps !== null
    ? loanPrincipal * model.annualInterestRateBps / 10_000
    : null;
  const amortizingDebtService = loanPrincipal !== null && model.annualInterestRateBps !== null && model.termMonths !== null
    ? annualAmortizingPayment(loanPrincipal, model.annualInterestRateBps, model.termMonths)
    : null;
  const scenario = (basis: DealScenarioResult["basis"], annualDebtService: number | null): DealScenarioResult => {
    const annualCashFlow = netOperatingIncomeBeforeUnknownCosts !== null && annualDebtService !== null
      ? netOperatingIncomeBeforeUnknownCosts - annualDebtService
      : null;
    const cashOnCashReturnPercent = annualCashFlow !== null && initialEquity !== null && initialEquity > 0
      ? annualCashFlow / initialEquity * 100
      : null;
    const targetPercent = model.targetAnnualReturnBps === null ? null : model.targetAnnualReturnBps / 100;
    const targetGapPercent = cashOnCashReturnPercent !== null && targetPercent !== null ? cashOnCashReturnPercent - targetPercent : null;
    const dscr = netOperatingIncomeBeforeUnknownCosts !== null && annualDebtService !== null && annualDebtService > 0
      ? netOperatingIncomeBeforeUnknownCosts / annualDebtService
      : null;
    return { basis, annualDebtService, annualCashFlow, cashOnCashReturnPercent, targetGapPercent, dscr };
  };
  const missingInputs = [
    model.purchasePrice === null ? "purchase price" : "",
    model.loanToValueBps === null ? "loan-to-value" : "",
    model.annualInterestRateBps === null ? "interest rate" : "",
    model.termMonths === null ? "loan term" : "",
    model.grossAnnualIncome === null ? "gross annual income" : "",
    model.annualOperatingCosts === null ? "property operating costs and vacancy" : "",
    model.otherInitialCosts === null ? "acquisition tax, legal, valuation and financing fees" : "",
    model.targetAnnualReturnBps === null ? "target return" : "",
  ].filter(Boolean);
  return {
    loanPrincipal,
    initialEquity,
    netOperatingIncomeBeforeUnknownCosts,
    amortizing: scenario("amortizing", amortizingDebtService),
    interestOnly: scenario("interest_only", interestOnlyDebtService),
    missingInputs,
  };
}

/**
 * A transparent scenario estimate, not a statistical market forecast. When
 * the repayment basis is unknown it assigns equal weight to interest-only and
 * amortizing. When property costs/vacancy are missing it stresses 10%, 20%
 * and 30% of gross rent with 25%/50%/25% weights. Those explicit weights make
 * the uncertainty visible instead of hiding it inside one optimistic number.
 */
export function estimateDealCashFlowProbabilities(model: DealEconomicsV1, result = calculateDealEconomics(model)): DealCashFlowProbabilityEstimate | null {
  if (model.grossAnnualIncome === null || result.initialEquity === null) return null;
  const repaymentScenarios = model.repaymentBasis === "amortizing"
    ? [{ scenario: result.amortizing, weight: 1 }]
    : model.repaymentBasis === "interest_only"
      ? [{ scenario: result.interestOnly, weight: 1 }]
      : [{ scenario: result.amortizing, weight: 0.5 }, { scenario: result.interestOnly, weight: 0.5 }];
  const costScenarios = model.annualOperatingCosts === null
    ? [{ ratio: 0.1, weight: 0.25 }, { ratio: 0.2, weight: 0.5 }, { ratio: 0.3, weight: 0.25 }]
    : [{ ratio: 0, weight: 1 }];
  const observations = repaymentScenarios.flatMap(({ scenario, weight: repaymentWeight }) => {
    if (scenario.annualCashFlow === null) return [];
    return costScenarios.map(({ ratio, weight: costWeight }) => ({
      cashFlow: scenario.annualCashFlow! - model.grossAnnualIncome! * ratio,
      weight: repaymentWeight * costWeight,
    }));
  });
  if (!observations.length) return null;
  const suppliedTarget = model.targetAnnualReturnBps === null ? null : result.initialEquity * model.targetAnnualReturnBps / 10_000;
  const largestPositive = Math.max(0, ...observations.map((observation) => observation.cashFlow));
  const threshold = Math.max(1, suppliedTarget ?? largestPositive / 2);
  const definitions: Array<Omit<DealCashFlowProbabilityBand, "probabilityPercent"> & { accepts: (cashFlow: number) => boolean }> = [
    { key: "loss", minimum: null, maximum: 0, accepts: (cashFlow) => cashFlow < 0 },
    { key: "below_target", minimum: 0, maximum: threshold, accepts: (cashFlow) => cashFlow >= 0 && cashFlow < threshold },
    { key: "target_to_double", minimum: threshold, maximum: threshold * 2, accepts: (cashFlow) => cashFlow >= threshold && cashFlow < threshold * 2 },
    { key: "strong_upside", minimum: threshold * 2, maximum: null, accepts: (cashFlow) => cashFlow >= threshold * 2 },
  ];
  return {
    bands: definitions.map(({ accepts, ...band }) => ({
      ...band,
      probabilityPercent: observations.filter((observation) => accepts(observation.cashFlow)).reduce((sum, observation) => sum + observation.weight, 0) * 100,
    })),
    targetCashFlow: suppliedTarget,
    usesRepaymentBasisPrior: model.repaymentBasis === "unknown",
    usesOperatingCostStress: model.annualOperatingCosts === null,
  };
}

/** Conservative compatibility bridge for cases authored before structured
 * deal economics existed. It only accepts numbers next to explicit labels. */
export function inferDealEconomicsFromText(text: string): DealEconomicsV1 | undefined {
  const clean = text.replace(/\u00a0/g, " ").replace(/[’]/g, "'");
  const purchasePrice = labelledMoney(clean, /(?:property|purchase|acquisition)[^\n.;]{0,80}?(?:worth|price|cost(?:ing)?)\s*(?:of\s*)?/i)
    ?? labelledMoney(clean, /\bworth\s*/i);
  const loanToValueBps = percentBeforeLabel(clean, /(?:financ(?:e|ing)|loan(?:-to-value)?|LTV)/i)
    ?? labelledPercent(clean, /(?:loan-to-value|LTV)[^\n.;%]{0,45}?/i);
  const annualInterestRateBps = labelledPercent(clean, /(?:interest|financ(?:e|ing)|loan)[^\n.;%]{0,70}?(?:rate|at)\s*/i);
  const termYears = labelledNumber(clean, /(?:loan|financ(?:e|ing))?[^\n.;]{0,60}?(?:term|for)\s*/i, /\s*years?\b/i);
  const monthlyIncome = labelledMoney(clean, /(?:monthly\s+rent|rent[^\n.;]{0,35}?(?:per\s+month|monthly)|five\s+monthly\s+rents[^\n.;]{0,35}?total(?:ling)?)[^\d£$€]{0,16}/i);
  const annualIncome = labelledMoney(clean, /(?:annual|yearly|gross)[^\n.;]{0,30}?rent[^\d£$€]{0,16}/i)
    ?? labelledMoney(clean, /(?:rent|gross)[^\n.;]{0,30}?(?:per\s+year|annually)[^\d£$€]{0,16}/i);
  const oneOffStructureCost = labelledMoney(clean, /(?:(?:one|1)[- ]?(?:off|time)|setup|creation)[^\n.;]{0,55}?(?:fee|cost)?[^\d£$€]{0,16}/i);
  const annualStructureCost = labelledMoney(clean, /(?:annual\s+(?:administration|admin|structure)|(?:administration|admin|structure)[^\n.;]{0,30}?annually)[^\d£$€]{0,16}/i)
    ?? moneyBeforeLabel(clean, /(?:administration|admin|structure)[^\n.;]{0,30}?annually/i);
  const targetAnnualReturnBps = labelledPercent(clean, /(?:target|at\s+least|reach)[^\n.;%]{0,45}?/i);
  const repaymentBasis = /interest[- ]only/i.test(clean) ? "interest_only" : /amorti[sz](?:ing|ation)/i.test(clean) ? "amortizing" : "unknown";
  if (purchasePrice === null || loanToValueBps === null || annualInterestRateBps === null || termYears === null || (monthlyIncome === null && annualIncome === null)) return undefined;
  const currency = /£|\bGBP\b/i.test(clean) ? "GBP" : /€|\bEUR\b/i.test(clean) ? "EUR" : /\$|\bUSD\b/i.test(clean) ? "USD" : null;
  if (!currency) return undefined;
  return normalizeDealEconomics({
    kind: "deal-economics-v1",
    currency,
    purchasePrice: Math.round(purchasePrice),
    loanToValueBps,
    annualInterestRateBps,
    termMonths: Math.round(termYears * 12),
    repaymentBasis,
    grossAnnualIncome: Math.round(annualIncome ?? (monthlyIncome as number) * 12),
    annualOperatingCosts: null,
    oneOffStructureCost: oneOffStructureCost === null ? null : Math.round(oneOffStructureCost),
    annualStructureCost: annualStructureCost === null ? null : Math.round(annualStructureCost),
    otherInitialCosts: null,
    targetAnnualReturnBps,
    assumptions: [
      "Inputs were conservatively extracted from explicit labels in the case text; confirm them before relying on the result.",
      monthlyIncome !== null && annualIncome === null ? "Monthly rent was annualized by multiplying by 12." : "",
    ].filter(Boolean),
  });
}

function annualAmortizingPayment(principal: number, annualRateBps: number, termMonths: number) {
  if (principal === 0) return 0;
  const monthlyRate = annualRateBps / 10_000 / 12;
  const monthlyPayment = monthlyRate === 0
    ? principal / termMonths
    : principal * monthlyRate / (1 - (1 + monthlyRate) ** -termMonths);
  return monthlyPayment * 12;
}

function labelledMoney(text: string, label: RegExp) {
  const match = text.match(new RegExp(`${label.source}(?:GBP|£|EUR|€|USD|\\$)?\\s*([0-9]+(?:[.,][0-9]+)*)\\s*(m|million|k|thousand)?\\s*(?:GBP|EUR|USD)?`, label.flags));
  if (!match) return null;
  const raw = match[1].replace(/,(?=\d{3}\b)/g, "");
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  return value * (suffix === "m" || suffix === "million" ? 1_000_000 : suffix === "k" || suffix === "thousand" ? 1_000 : 1);
}

function labelledPercent(text: string, label: RegExp) {
  const match = text.match(new RegExp(`${label.source}([0-9]+(?:[.,][0-9]+)?)\\s*(?:%|pct|percent)`, label.flags));
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function percentBeforeLabel(text: string, label: RegExp) {
  const match = text.match(new RegExp(`([0-9]+(?:[.,][0-9]+)?)\\s*(?:%|pct|percent)[^\\n.;]{0,24}?${label.source}`, label.flags));
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function moneyBeforeLabel(text: string, label: RegExp) {
  const match = text.match(new RegExp(`(?:GBP|£|EUR|€|USD|\\$)?\\s*([0-9]+(?:[.,][0-9]+)*)\\s*(m|million|k|thousand)?\\s*(?:GBP|EUR|USD)?[^0-9\\n.;]{0,24}?${label.source}`, label.flags));
  if (!match) return null;
  const value = Number(match[1].replace(/,(?=\d{3}\b)/g, ""));
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  return value * (suffix === "m" || suffix === "million" ? 1_000_000 : suffix === "k" || suffix === "thousand" ? 1_000 : 1);
}

function labelledNumber(text: string, label: RegExp, suffix: RegExp) {
  const match = text.match(new RegExp(`${label.source}([0-9]+(?:[.,][0-9]+)?)${suffix.source}`, `${label.flags}${suffix.flags}`.replace(/(.).*\1/g, "$1")));
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function nullableInteger(value: unknown, label: string, minimum: number, maximum: number) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${label}`);
  return value;
}

function textList(value: unknown, maximumItems: number, maximumLength: number) {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error("Invalid deal economics assumptions");
  return [...new Set(value.map((item) => typeof item === "string" ? item.trim().slice(0, maximumLength) : "").filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
