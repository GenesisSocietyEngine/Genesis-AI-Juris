import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalWebTaxJson } from "../app/studio-tax-source";
import { createTaxReportExecution, type TaxReportSnapshot } from "../app/tax-report-execution";
import { buildTaxReportModel, TAX_REPORT_EVIDENCE_SCHEMA, type TaxReportModelOptions, type TaxReportModelResult } from "../app/tax-report-model";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { formatTaxBasisPoints, formatTaxMoneyCents, formatTaxMonths } from "../app/tax-value-format";
import { attach, fixture } from "./helpers/tax-report-fixture";

type Mutable<T> = T extends object ? { -readonly [P in keyof T]: Mutable<T[P]> } : T;
const copy = (snapshot: TaxReportSnapshot) => structuredClone(snapshot) as Mutable<TaxReportSnapshot>;
const corpus = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; response: string }[] };
const options: TaxReportModelOptions = { profileId: "tax_position_memorandum", language: "en", includeEconomics: true };
const execution = createTaxReportExecution(loadNodeTaxRuntime);
async function calculated(name = "amounts") {
  const { draft } = fixture(name), result = await execution.calculate(draft);
  if (result.status !== "ready") assert.fail(JSON.stringify(result));
  return result.snapshot;
}
function ready(result: TaxReportModelResult) {
  if (result.status !== "ready") assert.fail(JSON.stringify(result));
  return result.model;
}
async function fingerprint(value: unknown) {
  return `sha256-${Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalWebTaxJson(value)))).toString("hex")}`;
}

test("both profiles/languages present all five real WASM financial cases with exact values", async () => {
  for (const name of ["amounts", "negative-tax-effect", "dated-benefit", "rates-derived", "manual-override"]) {
    const snapshot = await calculated(name);
    const expected = JSON.parse(corpus.cases.find(entry => entry.name === name)!.response).calculation.result;
    assert.deepEqual(snapshot.result, expected);
    for (const profileId of ["tax_position_memorandum", "economic_assessment"] as const) for (const language of ["en", "ru"] as const) {
      const model = ready(await buildTaxReportModel(snapshot, { ...options, profileId, language }));
      const results = model.sections.find(section => section.id === "results")!;
      const values = results.rows.map(row => row[1]);
      for (const field of ["effective_annual_tax_base", "baseline_annual_tax_cost", "optimized_annual_tax_cost", "recognized_annual_tax_saving", "recognized_recurring_benefits", "recognized_one_off_benefits", "gross_recognized_annual_benefit", "operating_annual_benefit", "annualized_net_benefit", "lifecycle_net_benefit", "npv"]) {
        assert.ok(values.includes(formatTaxMoneyCents(expected[field], "EUR", language)), `${name}/${profileId}/${language}/${field}`);
      }
      assert.ok(values.includes(formatTaxBasisPoints(expected.lifecycle_roi_bps, language)));
      assert.ok(values.includes(formatTaxMonths(expected.payback_months, language)));
      assert.match(results.note!, language === "en" ? /steady-state.*not the dated/ : /постоянного режима/);
      if (name === "rates-derived") {
        const rows = model.sections.find(section => section.id === "components")!.rows;
        for (const binding of snapshot.bindings) {
          assert.ok(rows.some(row => row[1] === binding.confirmation_owner));
          assert.ok(rows.some(row => row[1] === binding.confirmation_as_of));
          assert.ok(rows.some(row => row[1].includes(binding.fact_id as string)));
        }
      }
      if (name === "manual-override") assert.ok(model.sections.some(section => section.id === "override"));
      if (name === "dated-benefit") assert.ok(model.sections.some(section => section.id === "benefits"));
    }
  }
  const model = ready(await buildTaxReportModel(await calculated(), options));
  assert.deepEqual(model.sections.find(section => section.id === "results")!.rows.find(row => row[0] === "Operating annual benefit"), ["Operating annual benefit", "50,000.00 EUR"], "cents must not become 100 times larger or smaller");
  assert.ok(model.sections.find(section => section.id === "inputs")!.rows.every(row => row[0] !== "Baseline tax rate" && row[0] !== "Optimized tax rate"), "inactive amount-mode transport rates are not factual report inputs");
  const rates = ready(await buildTaxReportModel(await calculated("rates-derived"), options));
  assert.ok(rates.sections.find(section => section.id === "inputs")!.rows.some(row => row[0] === "Baseline tax rate"));
});

test("semantic binding is locale independent and excludes private full-draft identity", async () => {
  const snapshot = await calculated();
  const expected = await fingerprint({
    schema: TAX_REPORT_EVIDENCE_SCHEMA, attachment_digest: snapshot.attachment_digest,
    source: snapshot.source.descriptor, context: snapshot.context, versions: snapshot.versions,
    normalized_request: snapshot.normalized_request, bindings: snapshot.bindings,
    required_component_ids: snapshot.required_component_ids, input_hash: snapshot.input_hash,
    binding_hash: snapshot.binding_hash, missing_inputs: snapshot.missing_inputs, result: snapshot.result,
  });
  const compare = String.prototype.localeCompare;
  let model;
  try {
    String.prototype.localeCompare = () => { throw new Error("Locale-dependent identity forbidden"); };
    model = ready(await buildTaxReportModel(snapshot, options));
  } finally { String.prototype.localeCompare = compare; }
  assert.equal(model.evidenceFingerprint, expected);
  const unrelated = copy(snapshot);
  unrelated.identity = `sha256-${"9".repeat(64)}`;
  unrelated.draft.updatedAt = "2030-01-01T00:00:00Z";
  unrelated.draft.editHistory = [];
  delete unrelated.draft.protection;
  assert.equal(ready(await buildTaxReportModel(unrelated, options)).evidenceFingerprint, expected);
  const russian = ready(await buildTaxReportModel(snapshot, { ...options, profileId: "economic_assessment", language: "ru" }));
  assert.equal(russian.evidenceFingerprint, expected);
  assert.notEqual(russian.presentationFingerprint, model.presentationFingerprint);
  for (const change of [
    (value: Mutable<TaxReportSnapshot>) => { value.context.revision = "99"; },
    (value: Mutable<TaxReportSnapshot>) => { value.source.descriptor.scenario_fingerprint = "b".repeat(64); },
    (value: Mutable<TaxReportSnapshot>) => { value.versions.calculation_version += "-changed"; },
    (value: Mutable<TaxReportSnapshot>) => { value.result.npv = "1"; },
    (value: Mutable<TaxReportSnapshot>) => { value.input_hash = "c".repeat(64); },
    (value: Mutable<TaxReportSnapshot>) => { value.required_component_ids.push("different"); },
  ]) {
    const changed = copy(snapshot); change(changed);
    assert.notEqual(ready(await buildTaxReportModel(changed, options)).evidenceFingerprint, expected);
  }
  // No financial change, but the complete retained attachment changed.
  const { draft, document } = fixture();
  document.previous_source_documents.push("retained-only change"); attach(draft, document);
  const fresh = await execution.calculate(draft);
  if (fresh.status !== "ready") assert.fail(JSON.stringify(fresh));
  assert.deepEqual(fresh.snapshot.result, snapshot.result);
  assert.notEqual(ready(await buildTaxReportModel(fresh.snapshot, options)).evidenceFingerprint, expected);
});

test("snapshot and options freeze before the first await; output is detached and deeply frozen", async () => {
  const snapshot = copy(await calculated()), selected = { ...options, redactedNodeIds: [] as string[] };
  const before = structuredClone(snapshot), promise = buildTaxReportModel(snapshot, selected);
  snapshot.result.npv = "1";
  snapshot.normalized_request.input.assumptions = "late unapproved mutation";
  snapshot.attachment.document = "late broken attachment";
  selected.language = "ru"; selected.includeEconomics = false; selected.redactedNodeIds.push("fact_a");
  const model = ready(await promise), original = ready(await buildTaxReportModel(before, options));
  assert.deepEqual(model, original);
  assert.ok(Object.isFrozen(model) && Object.isFrozen(model.binding.context) && Object.isFrozen(model.sections[0].rows[0]));
  assert.throws(() => { (model.sections[0].rows as unknown as string[][]).push(["injected", "value"]); });
  const serialized = JSON.stringify(model);
  for (const privateText of ["late unapproved", "POISON cached result", "18446744073709551617", "future-preserved", '"document"', '"normalized_request"', '"draft"']) assert.ok(!serialized.includes(privateText), privateText);
});

test("economics exclusion removes every tax value/provenance row and redaction always blocks", async () => {
  const snapshot = await calculated("manual-override");
  const model = ready(await buildTaxReportModel(snapshot, { ...options, includeEconomics: false }));
  assert.deepEqual(model.sections, []);
  for (const secret of ["Explicit aggregate", "Synthetic reviewer", "100,000.00", "50,000.00", "25000000"]) assert.ok(!JSON.stringify(model).includes(secret));
  for (const includeEconomics of [false, true]) {
    const blocked = await buildTaxReportModel(snapshot, { ...options, includeEconomics, redactedNodeIds: ["fact_a"] });
    assert.equal(blocked.status, "blocked");
    if (blocked.status === "blocked") assert.equal(blocked.code, "redaction_requires_review");
    assert.ok(!Object.hasOwn(blocked, "model"));
  }
  assert.equal((await buildTaxReportModel(snapshot, { ...options, profileId: "decision_memorandum" } as unknown as TaxReportModelOptions)).status, "blocked");
  assert.equal((await buildTaxReportModel(snapshot, { ...options, language: "de" } as unknown as TaxReportModelOptions)).status, "blocked");
  const mismatched = copy(snapshot); mismatched.attachment.document += " ";
  assert.equal((await buildTaxReportModel(mismatched, options)).status, "blocked");
});

test("presentation-only wire edge fixtures retain signed i64 cents, sub-unit values, null and zero", async () => {
  const snapshot = copy(await calculated());
  snapshot.result.baseline_annual_tax_cost = "9223372036854775807";
  snapshot.result.optimized_annual_tax_cost = "-9223372036854775808";
  snapshot.result.operating_annual_benefit = "-1";
  snapshot.result.annualized_net_benefit = "0";
  snapshot.result.effective_annual_tax_base = null;
  snapshot.result.lifecycle_roi_bps = null;
  snapshot.result.lifecycle_roi_unavailable_reason = "out_of_range";
  snapshot.result.payback_months = null;
  const model = ready(await buildTaxReportModel(snapshot, options));
  const rows = model.sections.find(section => section.id === "results")!.rows;
  assert.ok(rows.some(row => row[1] === "92,233,720,368,547,758.07 EUR"));
  assert.ok(rows.some(row => row[1] === "-92,233,720,368,547,758.08 EUR"));
  assert.ok(rows.some(row => row[1] === "-0.01 EUR"));
  assert.ok(rows.some(row => row[1] === "0.00 EUR"));
  assert.ok(rows.some(row => row[0] === "Simple payback" && row[1] === "Unavailable"));
  assert.ok(rows.some(row => row[1] === "ROI exceeds the supported range."));
  snapshot.result.lifecycle_roi_bps = 0; snapshot.result.lifecycle_roi_unavailable_reason = null; snapshot.result.payback_months = 0;
  const zero = ready(await buildTaxReportModel(snapshot, options));
  assert.ok(zero.sections.some(section => section.rows.some(row => row[1] === "0.00%")));
  assert.ok(zero.sections.some(section => section.rows.some(row => row[0] === "Simple payback" && row[1] === "0 months")));
  snapshot.result.npv = "9223372036854775808";
  assert.equal((await buildTaxReportModel(snapshot, options)).status, "blocked");
});

test("legacy FX projection verifies exact original and preserves rate spelling without reapplying it", async () => {
  const { draft, document } = fixture();
  const fullResponse = corpus.cases.find(entry => entry.name === "web_rates_fx_v1")!.response;
  const legacy = JSON.parse(fullResponse).legacy;
  const valid = fullResponse;
  const changedFx = structuredClone(legacy); changedFx.status.draft.fx_json = changedFx.status.draft.fx_json.replace("1.2300e+0", "1.23");
  const changedHash = structuredClone(legacy); changedHash.original_sha256 = "0".repeat(64);
  const unknown = JSON.stringify({ future: "PRIVATE ORIGINAL", original_json: "DO NOT PRINT", rate: 999 });
  document.legacy_documents = [legacy.original_json, valid, JSON.stringify(legacy), JSON.stringify(changedFx), JSON.stringify(changedHash), unknown];
  attach(draft, document);
  const fresh = await execution.calculate(draft);
  if (fresh.status !== "ready") assert.fail(JSON.stringify(fresh));
  const model = ready(await buildTaxReportModel(fresh.snapshot, options));
  const section = model.sections.find(entry => entry.id === "provenance")!;
  assert.ok(section.rows.some(row => row[0] === "Retained exchange rate" && row[1] === "1.2300e+0"));
  assert.ok(section.rows.some(row => row[1] === "GBP") && section.rows.some(row => row[1] === "EUR"));
  assert.ok(section.rows.some(row => row[0] === "Documents without a supported FX presentation" && row[1] === "4"));
  assert.equal(section.rows.filter(row => row[0] === "Retained exchange rate" && row[1] === "1.2300e+0").length, 2, "full editor response and supported bare legacy record both project correctly");
  assert.match(section.note!, /no exchange conversion is applied again/);
  assert.ok(!JSON.stringify(model).includes("PRIVATE ORIGINAL") && !JSON.stringify(model).includes("DO NOT PRINT"));
  assert.equal(fresh.snapshot.attachment.document, draft.taxAnalysis!.document);
  assert.equal(legacy.status.draft.fx_json.includes("1.2300e+0"), true);
  assert.equal(fresh.snapshot.result.operating_annual_benefit, "5000000");
});

test("long assumptions and source lists remain complete; nullable benefit defaults are explicit", async () => {
  const { draft, document } = fixture("dated-benefit");
  const text = "Retained statement ".repeat(200); // 3,800 characters, within Rust's 4,000-byte policy.
  document.request.input.assumptions = text;
  document.benefits[0].note = text;
  document.benefits[0].realization_bps = "";
  document.benefits[0].probability_bps = "";
  attach(draft, document);
  const result = await execution.calculate(draft);
  if (result.status !== "ready") assert.fail(JSON.stringify(result));
  const model = ready(await buildTaxReportModel(result.snapshot, options));
  assert.equal(model.sections.find(section => section.id === "assumptions")!.rows[0][1], text);
  const benefitRows = model.sections.find(section => section.id === "benefits")!.rows;
  assert.ok(benefitRows.some(row => row[1] === text));
  assert.ok(benefitRows.some(row => row[1] === "Uses overall benefit realization"));
  assert.ok(benefitRows.some(row => row[1] === "Default 100.00%"));
  for (const benefit of result.snapshot.normalized_request.input.benefit_items as { source_node_ids: string[] }[]) for (const id of benefit.source_node_ids) assert.ok(benefitRows.some(row => row[1].includes(id)));
});
