import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { WebTaxAuthoringDocument } from "../app/tax-authoring";
import { materializeWebTaxAuthoring, parseWebTaxAmount } from "../app/tax-materialize";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";

const corpus = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; request: string; response: string }[] };
const money = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override".split(" ");
const integers = "baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
function amount(cents: string | null) {
  if (cents === null) return "";
  const negative = cents.startsWith("-"), digits = (negative ? cents.slice(1) : cents).padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
function fixture(name = "amounts"): WebTaxAuthoringDocument {
  const command = JSON.parse(corpus.cases.find(entry => entry.name === name)!.request);
  return {
    schema: "web-tax-authoring-artifact-v1", source: command.source, request: command.request,
    edit: Object.fromEntries([...money.map(key => [key, amount(command.request.input[key])]), ...integers.map(key => [key, String(command.request.input[key])])]),
    bindings: command.bindings.map((binding: Record<string, unknown>) => {
      const draft: Record<string, unknown> = { ...binding, amount_text: amount(binding.amount as string) };
      delete draft.amount; return draft;
    }),
    benefits: command.request.input.benefit_items.map((benefit: Record<string, unknown>) => {
      const draft: Record<string, unknown> = { ...benefit, amount_text: amount(benefit.amount as string) };
      delete draft.amount;
      for (const key of ["start_month", "end_month", "realization_bps", "probability_bps"]) draft[key] = benefit[key] === null ? "" : String(benefit[key]);
      draft.note ??= "";
      return draft;
    }),
    required_component_ids: command.required_component_ids, rates_confirmed: true,
    legacy_documents: [], previous_source_documents: [], cached_response: "old result, never authoritative",
  };
}

test("shared raw conversion preserves complete Rust parity for five successful financial fixtures", async () => {
  const runtime = await loadNodeTaxRuntime();
  for (const name of ["amounts", "negative-tax-effect", "dated-benefit", "rates-derived", "manual-override"]) {
    const document = fixture(name), before = JSON.stringify(document);
    const result = materializeWebTaxAuthoring(document, document.source);
    assert.equal(result.status, "ready", JSON.stringify(result));
    if (result.status !== "ready") assert.fail(name);
    const response = runtime.execute(JSON.stringify({ command: "tax_web_calculate", source: document.source, ...result.input }));
    assert.equal(response, corpus.cases.find(entry => entry.name === name)!.response, name);
    assert.equal(JSON.stringify(document), before, "source, edits, legacy and cache remain unchanged");
    assert.ok(Object.isFrozen(result.input.request));
    assert.ok(Object.isFrozen(result.input.bindings));
    assert.equal(document.request.context.revision, "9007199254740993", "no implicit revision bump");
  }
});

test("exact decimal parser preserves cents, negatives and signed i64 endpoints", () => {
  for (const [raw, wire] of [["250000.00", "25000000"], ["-0.01", "-1"], ["0", "0"], ["-0.00", "0"], ["1.2", "120"], ["92233720368547758.07", "9223372036854775807"], ["-92233720368547758.08", "-9223372036854775808"]]) assert.equal(parseWebTaxAmount(raw), wire);
  for (const raw of ["", "1.", ".1", "01", "+1", " 1", "1 ", "1,23", "1e3", "1.001", "NaN", "Infinity", "92233720368547758.08", "-92233720368547758.09", "1".repeat(1000)]) assert.throws(() => parseWebTaxAmount(raw), Error, raw);
});

test("invalid or empty active money never falls back to a previous request or cached result", () => {
  for (const field of money.filter(key => key !== "annual_tax_base_override")) {
    for (const raw of ["", "12.", "wrong"]) {
      const document = fixture(); document.edit[field] = raw;
      const result = materializeWebTaxAuthoring(document, document.source);
      assert.equal(result.status, "incomplete");
      assert.ok(!("input" in result));
      assert.ok(result.issues.some(issue => issue.field === `edit.${field}`));
      assert.equal(document.edit[field], raw);
    }
  }
});

test("u16 and u32 conversion rejects rounding, negatives, fractions and out-of-range wire integers", () => {
  for (const field of integers) for (const raw of ["", "1.0", "-1", "01", "1e2", "9007199254740993", field === "analysis_horizon_months" ? "4294967296" : "65536"]) {
    const document = fixture(); document.request.input.tax_input_basis = "rates"; document.edit[field] = raw;
    assert.equal(materializeWebTaxAuthoring(document, document.source).status, "incomplete", `${field}=${raw}`);
  }
  const document = fixture(); document.request.input.tax_input_basis = "rates"; document.edit.analysis_horizon_months = "4294967295";
  document.edit.baseline_tax_rate_bps = "65535";
  const result = materializeWebTaxAuthoring(document, document.source);
  assert.equal(result.status, "ready", "wire conversion does not replace Rust domain policy");
});

test("source and stale binding mismatches require explicit review instead of rebinding", () => {
  const document = fixture("rates-derived"), before = JSON.stringify(document);
  for (const change of [{ scenario_fingerprint: "a".repeat(64) }, { case_id: "different" }, { fact_ids: [...document.source.fact_ids, "new_fact"] }]) {
    const result = materializeWebTaxAuthoring(document, { ...document.source, ...change });
    assert.equal(result.status, "stale");
    assert.ok(!("input" in result));
  }
  assert.equal(JSON.stringify(document), before);
  document.bindings[0].scenario_fingerprint = "b".repeat(64);
  assert.equal(materializeWebTaxAuthoring(document, document.source).status, "stale");
});

test("rates and required component confirmations cannot be inferred from old calculations", () => {
  for (const change of [(d: WebTaxAuthoringDocument) => { d.rates_confirmed = false; }, (d: WebTaxAuthoringDocument) => { d.bindings[0].confirmed = false; }, (d: WebTaxAuthoringDocument) => { d.bindings[0].confirmation_owner = ""; }, (d: WebTaxAuthoringDocument) => { d.bindings[0].confirmation_as_of = null; }, (d: WebTaxAuthoringDocument) => { d.required_component_ids.push("absent"); }]) {
    const document = fixture("rates-derived"); change(document);
    assert.equal(materializeWebTaxAuthoring(document, document.source).status, "incomplete");
  }
});

test("inactive unfinished drafts are retained and omitted; included benefits use raw nullable numbers", () => {
  const document = fixture("dated-benefit");
  const inactive = structuredClone(document.benefits[0]); inactive.include_in_base_case = false;
  inactive.amount_text = "unfinished"; inactive.start_month = "";
  document.benefits.push(inactive);
  const inactiveBinding = fixture("rates-derived").bindings[0];
  inactiveBinding.include_in_calculation = false; inactiveBinding.confirmed = false;
  inactiveBinding.amount_text = "unfinished"; document.bindings.push(inactiveBinding);
  document.benefits[0].realization_bps = ""; document.benefits[0].probability_bps = "1250";
  const before = JSON.stringify(document), result = materializeWebTaxAuthoring(document, document.source);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") assert.fail(JSON.stringify(result));
  const benefits = (result.input.request.input as Record<string, unknown>).benefit_items as Record<string, unknown>[];
  assert.equal(benefits.length, 1); assert.equal(result.input.bindings.length, 0);
  assert.equal(benefits[0].realization_bps, null); assert.equal(benefits[0].probability_bps, 1250);
  assert.equal(benefits[0].end_month, null); assert.equal(benefits[0].amount, "1200");
  assert.equal(JSON.stringify(document), before);
  for (const key of ["start_month", "end_month", "realization_bps", "probability_bps"]) {
    const invalid = structuredClone(document); invalid.benefits[0][key] = "unfinished";
    assert.equal(materializeWebTaxAuthoring(invalid, invalid.source).status, "incomplete");
  }
});

test("wire-convertible input still receives actual Rust domain errors without a cached fallback", async () => {
  const document = fixture(); document.edit.implementation_cost = "92233720368547758.07";
  const result = materializeWebTaxAuthoring(document, document.source);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") assert.fail(JSON.stringify(result));
  const runtime = await loadNodeTaxRuntime();
  assert.equal(JSON.parse(runtime.execute(JSON.stringify({ command: "tax_web_calculate", source: document.source, ...result.input }))).type, "tax_error");
  assert.equal(document.cached_response, "old result, never authoritative");
});
