import assert from "node:assert/strict";
import test from "node:test";
import { inferDealEconomicsFromText } from "../app/deal-economics";
import { prefillTaxEconomicsFromDeal } from "../app/tax-economics";
import { ECONOMIC_PROMPT_START, synchronizedEconomicPrompt } from "../app/studio-economic-prompt";

const caseText = "Chinese resident buying a UK property worth 1mGBP; 80pct financing at 7,5pct for 10years; five monthly rents totalling £10,800; current gross £129,600/year. 1 time structure fee 15,000 GBP, 10,000 GBP for administration annually.";

test("reviewed economic parameters replace their prior prompt block", () => {
  const deal = inferDealEconomicsFromText(caseText);
  assert.ok(deal);
  const tax = { ...prefillTaxEconomicsFromDeal(undefined, deal), baselineTaxRateBps: 4_000, optimizedTaxRateBps: 2_000 };
  const first = synchronizedEconomicPrompt("Review this case.", { dealEconomics: deal, taxEconomics: tax });
  const second = synchronizedEconomicPrompt(first, { dealEconomics: deal, taxEconomics: { ...tax, baselineTaxRateBps: 4_500 } });
  assert.equal(second.split(ECONOMIC_PROMPT_START).length - 1, 1);
  assert.match(second, /Baseline tax rate: 45\.00%/);
  assert.doesNotMatch(second, /Baseline tax rate: 40\.00%/);
  assert.match(second, /gross annual rent GBP 129,600 less rental-property expenses GBP 25,920.*less annual loan-interest expense GBP 60,000 = annual tax base GBP 43,680/);
  assert.match(second, /annualized over 36 months: GBP 5,000 per year/);
  assert.match(second, /Annual structure & compliance: GBP 10,000/);
});
