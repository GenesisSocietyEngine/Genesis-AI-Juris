import { rentalTaxBaseFromDeal } from "./tax-economics";
import type { DealEconomicsV1, TaxEconomicsV1 } from "./types";

type EcbRate = { provider?: string; sourceCurrency?: string; targetCurrency?: string; rate?: number; asOf?: string };

async function fetchRate(from: string, to: string) {
  const response = await fetch(`/api/fx/ecb?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: "same-origin" });
  const payload = response.ok ? await response.json() as EcbRate : null;
  if (payload?.provider !== "ECB" || payload.sourceCurrency !== from || payload.targetCurrency !== to || typeof payload.rate !== "number" || !Number.isFinite(payload.rate) || payload.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.asOf ?? "")) throw new Error("ECB rate unavailable");
  return { rate: payload.rate, asOf: payload.asOf as string };
}

export async function convertTaxEconomicsCurrency(model: TaxEconomicsV1, deal: DealEconomicsV1 | null | undefined, targetCurrency: string) {
  const sourceCurrency = model.currency;
  const caseCurrency = deal?.currency ?? model.fx?.sourceCurrency ?? sourceCurrency;
  const currentToTarget = await fetchRate(sourceCurrency, targetCurrency);
  const caseToTarget = caseCurrency === sourceCurrency ? currentToTarget : await fetchRate(caseCurrency, targetCurrency);
  const convert = (value: number) => Math.max(0, Math.round(value * currentToTarget.rate));
  const tax: TaxEconomicsV1 = {
    ...model,
    currency: targetCurrency,
    annualTaxBase: convert(model.annualTaxBase),
    baselineAnnualTaxCost: convert(model.baselineAnnualTaxCost),
    optimizedAnnualTaxCost: convert(model.optimizedAnnualTaxCost),
    implementationCost: convert(model.implementationCost),
    annualMaintenanceCost: convert(model.annualMaintenanceCost),
    terminalTaxOrUnwindCost: convert(model.terminalTaxOrUnwindCost),
    fx: { provider: "ECB", sourceCurrency: caseCurrency, targetCurrency, rate: caseToTarget.rate, asOf: caseToTarget.asOf },
  };
  if (deal) {
    const breakdown = rentalTaxBaseFromDeal(deal);
    if (breakdown) tax.annualTaxBase = Math.round(breakdown.annualTaxBase * caseToTarget.rate);
    if (deal.oneOffStructureCost !== null) tax.implementationCost = Math.round(deal.oneOffStructureCost * caseToTarget.rate);
    if (deal.annualStructureCost !== null) tax.annualMaintenanceCost = Math.round(deal.annualStructureCost * caseToTarget.rate);
  }
  return { tax, sourceCurrency, asOf: caseToTarget.asOf };
}
