import { convertRentalTaxBase, rentalTaxBaseFromDeal } from "./tax-economics";
import type { DealEconomicsV1, StudioDraft, TaxEconomicsV1 } from "./types";

export const ECONOMIC_PROMPT_START = "[STUDIO REVIEWED ECONOMIC PARAMETERS — AUTO-SYNC]";
export const ECONOMIC_PROMPT_END = "[/STUDIO REVIEWED ECONOMIC PARAMETERS]";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const amount = (value: number | null | undefined, currency: string) => value === null || value === undefined
  ? "not stated"
  : `${currency} ${Math.round(value).toLocaleString("en-GB")}`;
const percent = (value: number | null | undefined) => value === null || value === undefined ? "not stated" : `${(value / 100).toFixed(2)}%`;

export function synchronizedEconomicPrompt(source: string, draft: Pick<StudioDraft, "dealEconomics" | "taxEconomics">) {
  const withoutPrevious = source.replace(new RegExp(`\\n*${escapeRegExp(ECONOMIC_PROMPT_START)}[\\s\\S]*?${escapeRegExp(ECONOMIC_PROMPT_END)}\\n*`, "g"), "\n").trim();
  const block = economicPromptBlock(draft.dealEconomics, draft.taxEconomics);
  if (!block) return withoutPrevious;
  return `${withoutPrevious}${withoutPrevious ? "\n\n" : ""}${block}`;
}

export function economicPromptBlock(deal: DealEconomicsV1 | undefined, tax: TaxEconomicsV1 | undefined) {
  if (!deal && !tax) return "";
  const lines = [ECONOMIC_PROMPT_START];
  if (deal) {
    lines.push(
      `Case currency: ${deal.currency}.`,
      `Purchase price: ${amount(deal.purchasePrice, deal.currency)}.`,
      `Loan-to-value: ${percent(deal.loanToValueBps)}; annual loan interest rate: ${percent(deal.annualInterestRateBps)}; repayment basis: ${deal.repaymentBasis}.`,
      `Gross annual rent: ${amount(deal.grossAnnualIncome, deal.currency)}.`,
      `Rental-property expenses: ${amount(deal.annualOperatingCosts, deal.currency)}${deal.annualOperatingCosts === null ? " (not stated; Studio base-case estimate is 20% of gross rent)" : ""}.`,
      `One-off implementation/structure cost from the case: ${amount(deal.oneOffStructureCost, deal.currency)}.`,
      `Annual structure & compliance from the case: ${amount(deal.annualStructureCost, deal.currency)}.`,
    );
  }
  if (tax) {
    const sourceBreakdown = deal ? rentalTaxBaseFromDeal(deal) : null;
    const breakdown = sourceBreakdown && sourceBreakdown.currency === tax.currency
      ? sourceBreakdown
      : sourceBreakdown && tax.fx?.sourceCurrency === sourceBreakdown.currency && tax.fx.targetCurrency === tax.currency
        ? convertRentalTaxBase(sourceBreakdown, tax.currency, tax.fx.rate)
        : null;
    lines.push(
      `Tax presentation currency: ${tax.currency}.`,
      tax.taxInputBasis === "rates" ? "Tax input basis: tax base plus percentage rates." : "Tax input basis: annual cash-tax amounts.",
    );
    if (breakdown) {
      lines.push(`Tax-base rule: gross annual rent ${amount(breakdown.grossAnnualRent, breakdown.currency)} less rental-property expenses ${amount(breakdown.rentalPropertyExpenses, breakdown.currency)}${breakdown.propertyExpensesEstimated ? " (20% base-case estimate)" : ""} less annual loan-interest expense ${amount(breakdown.loanInterestExpense, breakdown.currency)} = annual tax base ${amount(tax.annualTaxBase, tax.currency)}.`);
    } else lines.push(`Annual tax base: ${amount(tax.annualTaxBase, tax.currency)}; confirm gross rent, rental-property expenses and annual loan-interest expense.`);
    lines.push(
      tax.taxInputBasis === "rates"
        ? `Baseline tax rate: ${percent(tax.baselineTaxRateBps)}; optimized tax rate: ${percent(tax.optimizedTaxRateBps)}.`
        : `Baseline annual cash tax: ${amount(tax.baselineAnnualTaxCost, tax.currency)}; optimized annual cash tax: ${amount(tax.optimizedAnnualTaxCost, tax.currency)}.`,
      `One-off implementation: ${amount(tax.implementationCost, tax.currency)}; annualized over ${tax.analysisHorizonMonths} months: ${amount(tax.implementationCost / (tax.analysisHorizonMonths / 12), tax.currency)} per year.`,
      `Annual structure & compliance: ${amount(tax.annualMaintenanceCost, tax.currency)}.`,
      `Terminal tax/unwind: ${amount(tax.terminalTaxOrUnwindCost, tax.currency)}; discount rate: ${percent(tax.annualDiscountRateBps)}; benefit realization: ${percent(tax.benefitRealizationBps)}.`,
    );
    const rateSourceLine = tax.assumptions.match(/^Tax-rate sources:[^\n]+/mu)?.[0];
    if (tax.taxInputBasis === "rates" && rateSourceLine) lines.push(rateSourceLine);
    if (tax.fx) lines.push(`Currency conversion: ECB reference rate as of ${tax.fx.asOf}; 1 ${tax.fx.sourceCurrency} = ${tax.fx.rate.toPrecision(8)} ${tax.fx.targetCurrency}.`);
  }
  lines.push(ECONOMIC_PROMPT_END);
  return lines.join("\n");
}
