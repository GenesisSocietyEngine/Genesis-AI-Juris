import assert from "node:assert/strict";
import test from "node:test";
import { defaultTaxEconomics } from "../app/tax-economics";
import { manualTaxRateChange, markManualTaxRate, prefillTaxRates, taxRateOrigin } from "../app/tax-rate-inference";

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

test("manual baseline and optimized zero-rate overrides remain authoritative", () => {
  let manual = defaultTaxEconomics("GBP");
  manual = { ...manual, assumptions: markManualTaxRate(manual, "baseline") };
  manual = { ...manual, assumptions: markManualTaxRate(manual, "optimized") };

  const tax = prefillTaxRates(manual, {
    ...fiveFlats,
    prompt: `${fiveFlats.prompt} Baseline tax rate: 45%; optimized tax rate: 20%.`,
  });

  assert.equal(tax.baselineTaxRateBps, 0);
  assert.equal(tax.optimizedTaxRateBps, 0);
  assert.equal(taxRateOrigin(tax, "baseline"), "manual");
  assert.equal(taxRateOrigin(tax, "optimized"), "manual");
});

test("the UI update boundary commits unchanged manual zero rates and preserves them through later state paths", () => {
  for (const field of ["baseline", "optimized"] as const) {
    const untouched = defaultTaxEconomics("GBP");
    assert.equal(taxRateOrigin(untouched, field), undefined);

    const change = manualTaxRateChange(untouched, field, 0);
    assert.ok(change, `${field} zero must produce an origin-changing state update`);
    const committed = { ...untouched, ...change };
    assert.equal(taxRateOrigin(committed, field), "manual");

    const savedAndLoaded = JSON.parse(JSON.stringify(committed)) as typeof committed;
    const afterUnrelatedEdit = { ...savedAndLoaded, implementationCost: 12_345 };
    const afterReevaluation = prefillTaxRates(afterUnrelatedEdit, {
      ...fiveFlats,
      prompt: `${fiveFlats.prompt} Baseline tax rate: 45%; optimized tax rate: 20%.

[STUDIO REVIEWED ECONOMIC PARAMETERS — AUTO-SYNC]
Baseline tax rate: 99%; optimized tax rate: 1%.
[/STUDIO REVIEWED ECONOMIC PARAMETERS]`,
    });

    assert.equal(field === "baseline" ? afterReevaluation.baselineTaxRateBps : afterReevaluation.optimizedTaxRateBps, 0);
    assert.equal(taxRateOrigin(afterReevaluation, field), "manual");
    assert.equal(afterReevaluation.implementationCost, 12_345);
    assert.equal(manualTaxRateChange(afterReevaluation, field, 0), null);
  }
});

test("manual and prompt origins are resolved independently per field", () => {
  const base = defaultTaxEconomics("GBP");
  const manualBaseline = {
    ...base,
    baselineTaxRateBps: 3_300,
    assumptions: markManualTaxRate(base, "baseline"),
  };
  const tax = prefillTaxRates(manualBaseline, {
    ...fiveFlats,
    prompt: `${fiveFlats.prompt} Baseline tax rate: 45%; optimized tax rate: 18%.`,
  });

  assert.equal(tax.baselineTaxRateBps, 3_300);
  assert.equal(tax.optimizedTaxRateBps, 1_800);
  assert.equal(taxRateOrigin(tax, "baseline"), "manual");
  assert.equal(taxRateOrigin(tax, "optimized"), "prompt");
});

test("a partial explicit prompt rate wins while the other field receives its applicable default", () => {
  const tax = prefillTaxRates(defaultTaxEconomics("GBP"), {
    ...fiveFlats,
    prompt: `${fiveFlats.prompt} Baseline tax rate: 43.25%.`,
  });

  assert.equal(tax.baselineTaxRateBps, 4_325);
  assert.equal(tax.optimizedTaxRateBps, 2_500);
  assert.equal(taxRateOrigin(tax, "baseline"), "prompt");
  assert.equal(taxRateOrigin(tax, "optimized"), "jurisdiction_default");
});

test("unset origins remain unset and UK defaults do not match unrelated words", () => {
  const tax = prefillTaxRates(defaultTaxEconomics("GBP"), {
    prompt: "Review current holding-company obligations.",
    jurisdiction: "United Kingdom",
    caseText: "Parent company governance and reporting.",
  });

  assert.equal(tax.baselineTaxRateBps, 0);
  assert.equal(tax.optimizedTaxRateBps, 0);
  assert.equal(taxRateOrigin(tax, "baseline"), undefined);
  assert.equal(taxRateOrigin(tax, "optimized"), undefined);
  assert.match(tax.assumptions, /baseline=unset; optimized=unset/);
});

test("New England property facts do not activate United Kingdom defaults", () => {
  const tax = prefillTaxRates(defaultTaxEconomics("USD"), {
    prompt: "Review a residential investment.",
    jurisdiction: "United States",
    caseText: "A New England rental property is held by the client.",
  });

  assert.equal(tax.baselineTaxRateBps, 0);
  assert.equal(tax.optimizedTaxRateBps, 0);
  assert.equal(taxRateOrigin(tax, "baseline"), undefined);
  assert.equal(taxRateOrigin(tax, "optimized"), undefined);
});

test("assumption and source metadata are exact and idempotent", () => {
  const first = prefillTaxRates(defaultTaxEconomics("GBP"), fiveFlats);
  const second = prefillTaxRates(first, fiveFlats);

  assert.equal(first.assumptions, "Tax base is prefilled as gross annual rent less rental-property expenses less annual loan-interest expense. Verify every case input and tax rate before relying on the estimate.\nTax-rate sources: baseline=jurisdiction_default; optimized=jurisdiction_default. UK property defaults dated 2026-08-24; verify the taxpayer, profit band, finance-cost treatment and vehicle.");
  assert.strictEqual(second, first);
});

test("inferred rates clear deterministically when their sources are no longer available", () => {
  const inferred = prefillTaxRates(defaultTaxEconomics("GBP"), fiveFlats);
  const cleared = prefillTaxRates(inferred, {
    prompt: "Review the corporate governance position.",
    jurisdiction: "France",
    caseText: "No property or rental facts are supplied.",
  });

  assert.equal(cleared.baselineTaxRateBps, 0);
  assert.equal(cleared.optimizedTaxRateBps, 0);
  assert.equal(taxRateOrigin(cleared, "baseline"), undefined);
  assert.equal(taxRateOrigin(cleared, "optimized"), undefined);
});

test("legacy nonzero rates without provenance are preserved while their origins remain unset", () => {
  const legacy = {
    ...defaultTaxEconomics("EUR"),
    baselineTaxRateBps: 3_100,
    optimizedTaxRateBps: 1_900,
    assumptions: "Legacy imported assumptions.",
  };
  const tax = prefillTaxRates(legacy, {
    prompt: "Review the corporate structure.",
    jurisdiction: "France",
  });

  assert.equal(tax.baselineTaxRateBps, 3_100);
  assert.equal(tax.optimizedTaxRateBps, 1_900);
  assert.equal(taxRateOrigin(tax, "baseline"), undefined);
  assert.equal(taxRateOrigin(tax, "optimized"), undefined);
});
