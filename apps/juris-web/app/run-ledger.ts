import type { DecisionOption, Scenario } from "./types";

export type RunLedger = {
  spendEur: number;
  billableMinutes: number;
  fatigue: number;
  cumulativeStrain: number;
  stamina: number;
  staminaModelled: boolean;
  authorizedBudgetEur: number;
  awardEur: number;
  outcomeCostsEur: number;
  financialOutcomeAuthored: boolean;
  spendAuthoritative: boolean;
  costCoverage: "complete" | "partial" | "not-authored";
  billableCoverage: "complete" | "partial" | "not-authored";
};

type LedgerDecision = { option: DecisionOption };
type CanonicalLedgerState = { resources?: Record<string, number>; numericMetrics?: Record<string, number> };

export function deriveRunLedger(scenario: Scenario, decisions: LedgerDecision[], canonical?: CanonicalLedgerState): RunLedger {
  const initial = { ...(scenario.initialResources ?? {
    authorizedBudgetEur: 0,
    spendEur: 0,
    billableMinutes: 0,
    fatigue: 0,
    cumulativeStrain: 0,
    awardEur: 0,
    outcomeCostsEur: 0,
  }) };
  let spendEur = initial.spendEur;
  let billableMinutes = initial.billableMinutes;
  let fatigue = initial.fatigue;
  let cumulativeStrain = initial.cumulativeStrain;
  let awardEur = initial.awardEur;
  let outcomeCostsEur = initial.outcomeCostsEur;
  let financialOutcomeAuthored = initial.awardEur !== 0 || initial.outcomeCostsEur !== 0;
  let authoredCosts = 0;
  let unAuthoredCosts = 0;
  let authoredBillable = 0;
  let unAuthoredBillable = 0;

  for (const { option } of decisions) {
    const authoredCost = scenario.mobileParity ? option.costAuthored === true : true;
    spendEur += authoredCost ? option.cost : 0;
    if (option.billableMinutes !== undefined) {
      billableMinutes += option.billableMinutes;
      authoredBillable += 1;
    } else {
      unAuthoredBillable += 1;
    }
    if (authoredCost) authoredCosts += 1;
    else unAuthoredCosts += 1;
    fatigue = option.resetsFatigue ? 0 : clamp(fatigue + (option.fatigueDelta ?? 0));
    cumulativeStrain = clamp(cumulativeStrain + (option.strainDelta ?? 0));
    if (option.awardEur !== undefined) {
      awardEur = option.awardEur;
      financialOutcomeAuthored = true;
    }
    if (option.outcomeCostsEur !== undefined) {
      outcomeCostsEur = option.outcomeCostsEur;
      financialOutcomeAuthored = true;
    }
  }

  const resources = canonical?.resources ?? {};
  const numericMetrics = canonical?.numericMetrics ?? {};
  if (resources.spend_eur !== undefined) spendEur = resources.spend_eur;
  if (resources.billable_minutes !== undefined) billableMinutes = resources.billable_minutes;
  if (resources.authorized_budget_eur !== undefined) initial.authorizedBudgetEur = resources.authorized_budget_eur;
  if (resources.award_eur !== undefined) awardEur = resources.award_eur;
  if (resources.outcome_costs_eur !== undefined) outcomeCostsEur = resources.outcome_costs_eur;
  if (resources.award_eur !== undefined || resources.outcome_costs_eur !== undefined) financialOutcomeAuthored = true;
  if (numericMetrics.fatigue !== undefined) fatigue = numericMetrics.fatigue;
  if (numericMetrics.cumulative_strain !== undefined) cumulativeStrain = numericMetrics.cumulative_strain;

  const staminaModelled = numericMetrics.fatigue !== undefined || scenario.stages.some((stage) => stage.options.some((option) => option.fatigueDelta !== undefined || option.resetsFatigue));
  const pathCostCoverage = authoredCosts > 0 && unAuthoredCosts === 0 ? "complete" : authoredCosts > 0 ? "partial" : "not-authored";
  const pathBillableCoverage = authoredBillable > 0 && unAuthoredBillable === 0 ? "complete" : authoredBillable > 0 ? "partial" : "not-authored";
  return {
    spendEur,
    billableMinutes,
    fatigue,
    cumulativeStrain,
    stamina: clamp(100 - fatigue),
    staminaModelled,
    authorizedBudgetEur: initial.authorizedBudgetEur,
    awardEur,
    outcomeCostsEur,
    financialOutcomeAuthored,
    spendAuthoritative: resources.spend_eur !== undefined,
    costCoverage: decisions.length > 0 ? pathCostCoverage : authoredCoverage(scenario, "cost"),
    billableCoverage: decisions.length > 0 ? pathBillableCoverage : authoredCoverage(scenario, "billable"),
  };
}

function authoredCoverage(scenario: Scenario, field: "cost" | "billable"): RunLedger["costCoverage"] {
  const options = scenario.stages.flatMap((stage) => stage.options);
  const authored = options.filter((option) => field === "cost" ? (scenario.mobileParity ? option.costAuthored === true : true) : option.billableMinutes !== undefined).length;
  return authored === options.length ? "complete" : authored > 0 ? "partial" : "not-authored";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
