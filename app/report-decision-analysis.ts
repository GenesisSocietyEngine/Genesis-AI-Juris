import { calculateDealEconomics, normalizeDealEconomics } from "./deal-economics";
import type { DealEconomicsV1 } from "./types";

/** Calculation-only interpretation. No tax, market or lender approval is inferred. */
export function decisionEconomics(model: DealEconomicsV1) {
  model = normalizeDealEconomics(model)!;
  const result = calculateDealEconomics(model);
  const selected = model.repaymentBasis === "amortizing" ? (model.termMonths !== null && model.termMonths >= 12 ? result.amortizing : null)
    : model.repaymentBasis === "interest_only" ? result.interestOnly : null;
  const knownCosts = model.annualOperatingCosts !== null && model.annualStructureCost !== null;
  // Null costs in the legacy calculator are a lower bound, never a known zero.
  const costRatio = model.grossAnnualIncome !== null && model.grossAnnualIncome > 0
    && model.annualOperatingCosts !== null ? model.annualOperatingCosts / model.grossAnnualIncome : null;
  const usableRatio = costRatio !== null && costRatio >= 0 && costRatio < 1;
  const debt = selected?.annualDebtService ?? null;
  const sensitivity = selected && debt !== null && knownCosts && usableRatio
    ? [-.1, 0, .1].map(change => {
      const income = model.grossAnnualIncome! * (1 + change);
      const operatingCosts = income * costRatio!;
      const available = income - operatingCosts - model.annualStructureCost!;
      return { change, income, operatingCosts, available, cashFlow: available - debt, dscr: debt > 0 ? available / debt : null };
    }) : [];
  const breakEvenIncome = debt !== null && knownCosts && usableRatio
    ? (debt + model.annualStructureCost!) / (1 - costRatio!) : null;
  const initialCostsKnown = model.oneOffStructureCost !== null && model.otherInitialCosts !== null;
  const targetIncome = breakEvenIncome !== null && initialCostsKnown && result.initialEquity !== null
    && result.initialEquity > 0 && model.targetAnnualReturnBps !== null
    ? (debt! + model.annualStructureCost! + result.initialEquity * model.targetAnnualReturnBps / 10_000) / (1 - costRatio!) : null;
  let firstYearInterest: number | null = null;
  let firstYearPrincipal: number | null = null;
  if (model.repaymentBasis === "amortizing" && model.termMonths !== null && model.termMonths >= 12
    && result.loanPrincipal !== null && model.annualInterestRateBps !== null && debt !== null) {
    let balance = result.loanPrincipal;
    firstYearInterest = 0;
    for (let month = 0; month < 12; month++) {
      const interest = balance * model.annualInterestRateBps / 10_000 / 12;
      firstYearInterest += interest;
      balance -= debt / 12 - interest;
    }
    firstYearPrincipal = result.loanPrincipal - balance;
  }
  return { result, selected, knownCosts, initialCostsKnown, costRatio, sensitivity,
    breakEvenIncome, targetIncome, firstYearInterest, firstYearPrincipal };
}
