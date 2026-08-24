import assert from "node:assert/strict";
import test from "node:test";
import { defaultTaxEconomics } from "../app/tax-economics";
import { prefillTaxRates } from "../app/tax-rate-inference";

const fiveFlats = {
  prompt: "A PRC resident acquires five English flats through a Liechtenstein route. Target annual return: 10%.",
  jurisdiction: "PRC · England · Liechtenstein",
  caseText: "Five rental properties in England with annual rent.",
};

test("labelled prompt rates take priority over jurisdiction defaults", () => {
  const tax = prefillTaxRates(defaultTaxEconomics("GBP"), {
    ...fiveFlats,
    prompt: `${fiveFlats.prompt} Baseline tax rate: 43.25%; optimized tax rate = 18,5%.`,
  });
  assert.equal(tax.baselineTaxRateBps, 4_325);
  assert.equal(tax.optimizedTaxRateBps, 1_850);
  assert.match(tax.assumptions, /baseline=prompt; optimized=prompt/);
});

test("Five Flats uses transparent UK property defaults and ignores an unlabeled return target", () => {
  const tax = prefillTaxRates(defaultTaxEconomics("GBP"), fiveFlats);
  assert.equal(tax.baselineTaxRateBps, 4_000);
  assert.equal(tax.optimizedTaxRateBps, 2_500);
  assert.match(tax.assumptions, /baseline=jurisdiction_default; optimized=jurisdiction_default/);
});

test("auto-synchronized rates do not masquerade as source-prompt rates", () => {
  const tax = prefillTaxRates(defaultTaxEconomics("GBP"), {
    ...fiveFlats,
    prompt: `${fiveFlats.prompt}\n\n[STUDIO REVIEWED ECONOMIC PARAMETERS — AUTO-SYNC]\nBaseline tax rate: 99%; optimized tax rate: 1%.\n[/STUDIO REVIEWED ECONOMIC PARAMETERS]`,
  });
  assert.equal(tax.baselineTaxRateBps, 4_000);
  assert.equal(tax.optimizedTaxRateBps, 2_500);
  assert.match(tax.assumptions, /baseline=jurisdiction_default/);
});

test("manual Studio overrides are preserved", () => {
  const tax = prefillTaxRates({
    ...defaultTaxEconomics("GBP"),
    baselineTaxRateBps: 3_300,
    optimizedTaxRateBps: 1_700,
    assumptions: "Illustrative documented assumptions.\nTax-rate sources: baseline=manual; optimized=manual.",
  }, { ...fiveFlats, prompt: `${fiveFlats.prompt} Baseline tax rate 45%; optimized tax rate 20%.` });
  assert.equal(tax.baselineTaxRateBps, 3_300);
  assert.equal(tax.optimizedTaxRateBps, 1_700);
});
