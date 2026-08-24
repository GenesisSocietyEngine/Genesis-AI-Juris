import assert from "node:assert/strict";
import test from "node:test";
import { inferDealEconomicsFromText } from "../app/deal-economics";
import { prefillTaxEconomicsFromDeal } from "../app/tax-economics";
import { convertTaxEconomicsCurrency } from "../app/studio-tax-currency";

test("currency changes convert all monetary tax inputs and re-derive case-linked values", async () => {
  const deal = inferDealEconomicsFromText("UK property worth 1mGBP; 80pct financing at 7.5pct for 10 years; gross rent £129,600/year; 1 time structure fee 15,000 GBP, 10,000 GBP for administration annually.");
  assert.ok(deal);
  const tax = { ...prefillTaxEconomicsFromDeal(undefined, deal), baselineAnnualTaxCost: 1_000, optimizedAnnualTaxCost: 500, terminalTaxOrUnwindCost: 2_000 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ provider: "ECB", sourceCurrency: "GBP", targetCurrency: "USD", rate: 2, asOf: "2026-08-21" });
  try {
    const converted = await convertTaxEconomicsCurrency(tax, deal, "USD");
    assert.equal(converted.tax.currency, "USD");
    assert.equal(converted.tax.annualTaxBase, 87_360);
    assert.equal(converted.tax.implementationCost, 30_000);
    assert.equal(converted.tax.annualMaintenanceCost, 20_000);
    assert.equal(converted.tax.baselineAnnualTaxCost, 2_000);
    assert.equal(converted.tax.optimizedAnnualTaxCost, 1_000);
    assert.equal(converted.tax.terminalTaxOrUnwindCost, 4_000);
    assert.deepEqual(converted.tax.fx, { provider: "ECB", sourceCurrency: "GBP", targetCurrency: "USD", rate: 2, asOf: "2026-08-21" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
