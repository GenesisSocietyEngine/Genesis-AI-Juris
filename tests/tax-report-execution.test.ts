import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalWebTaxJson } from "../app/studio-tax-source";
import { taxAttachmentDigest, type TaxAttachmentV1, type WebTaxAuthoringDocument } from "../app/tax-authoring";
import { createTaxReportExecution, type TaxReportExecutionResult } from "../app/tax-report-execution";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import type { TaxRuntime } from "../app/tax-runtime/runtime";
import { formatTaxMoneyCents } from "../app/tax-value-format";
import type { StudioDraft } from "../app/types";

type JsonObject = Record<string, unknown>;
type Response = {
  source_schema: string; source: JsonObject; type: string;
  draft: { request: WebTaxAuthoringDocument["request"]; bindings: JsonObject[]; required_component_ids: string[]; binding_hash_schema: string; binding_hash: string; input_hash: string; missing_inputs: unknown };
  calculation: { context: JsonObject; result: JsonObject; transport_protocol: string; result_schema: string; calculation_version: string; application_policy: string };
};
const corpus = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; request: string; response: string }[] };
const source = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-source.json", import.meta.url), "utf8")) as { draft: StudioDraft };
const money = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override".split(" ");
const integers = "baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const amount = (value: unknown) => {
  if (value === null) return "";
  const cents = String(value), negative = cents.startsWith("-"), digits = (negative ? cents.slice(1) : cents).padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
};
function fixture(name = "amounts") {
  const wire = JSON.parse(corpus.cases.find(entry => entry.name === name)!.request);
  const document: WebTaxAuthoringDocument = {
    schema: "web-tax-authoring-artifact-v1", source: wire.source, request: wire.request,
    edit: Object.fromEntries([...money.map(key => [key, amount(wire.request.input[key])]), ...integers.map(key => [key, String(wire.request.input[key])])]),
    bindings: wire.bindings.map((value: JsonObject) => {
      const binding = { ...value, amount_text: amount(value.amount) }; Reflect.deleteProperty(binding, "amount"); return binding;
    }),
    benefits: wire.request.input.benefit_items.map((value: JsonObject) => {
      const benefit: JsonObject = { ...value, amount_text: amount(value.amount), note: value.note ?? "" };
      delete benefit.amount;
      for (const key of ["start_month", "end_month", "realization_bps", "probability_bps"]) benefit[key] = value[key] === null ? "" : String(value[key]);
      return benefit;
    }),
    rates_confirmed: true, required_component_ids: wire.required_component_ids,
    legacy_documents: [' {"number":18446744073709551617,"decimal":1.2300e+0} \r\n'],
    previous_source_documents: ['{"schema":"future-preserved"}'], cached_response: "POISON cached result",
  };
  const draft = structuredClone(source.draft);
  attach(draft, document);
  return { draft, document };
}
function attach(draft: StudioDraft, document: WebTaxAuthoringDocument) {
  draft.taxAnalysis = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify(document, null, "\t") + "\r\n" };
}
function ready(value: TaxReportExecutionResult) {
  if (value.status !== "ready") assert.fail(JSON.stringify(value));
  return value.snapshot;
}
async function identity(body: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalWebTaxJson(body)));
  return `sha256-${Buffer.from(hash).toString("hex")}`;
}
async function altered(change: (value: Response) => void): Promise<TaxRuntime> {
  const runtime = await loadNodeTaxRuntime();
  return { ...runtime, execute(encoded) {
    const raw = runtime.execute(encoded);
    if (JSON.parse(encoded).command !== "tax_web_calculate") return raw;
    const response = JSON.parse(raw) as Response;
    change(response);
    return JSON.stringify(response);
  } };
}

test("fresh real WASM report evidence equals all five financial corpus results and binds the complete snapshot", async () => {
  let calculations = 0;
  const runtime = await loadNodeTaxRuntime();
  const service = createTaxReportExecution(async () => ({ ...runtime, execute(encoded) {
    if (JSON.parse(encoded).command === "tax_web_calculate") calculations++;
    return runtime.execute(encoded);
  } }));
  for (const name of ["amounts", "negative-tax-effect", "dated-benefit", "rates-derived", "manual-override"]) {
    const { draft } = fixture(name), before = structuredClone(draft);
    const snapshot = ready(await service.calculate(draft));
    const expected = JSON.parse(corpus.cases.find(entry => entry.name === name)!.response);
    assert.deepEqual(snapshot.result, expected.calculation.result, name);
    assert.deepEqual(snapshot.normalized_request, expected.draft.request, name);
    assert.deepEqual(snapshot.bindings, expected.draft.bindings);
    assert.deepEqual(snapshot.required_component_ids, expected.draft.required_component_ids);
    assert.deepEqual(snapshot.missing_inputs, expected.draft.missing_inputs);
    assert.equal(snapshot.input_hash, expected.draft.input_hash); assert.equal(snapshot.binding_hash, expected.draft.binding_hash);
    assert.equal(snapshot.attachment.document, draft.taxAnalysis?.document);
    assert.equal(snapshot.attachment_digest, await taxAttachmentDigest(draft.taxAnalysis));
    assert.equal(snapshot.context.revision, "9007199254740993");
    const { identity: actual, ...body } = snapshot;
    assert.equal(actual, await identity(body));
    assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.draft.nodes[0]) && Object.isFrozen(snapshot.normalized_request.input) && Object.isFrozen(snapshot.result));
    assert.deepEqual(draft, before);
  }
  assert.equal(calculations, 5, "one fresh calculate for every report, no cache adoption");
});

test("absent, opaque, malformed, incomplete and stale authoring never call the runtime", async () => {
  let loads = 0;
  const service = createTaxReportExecution(async () => { loads++; return loadNodeTaxRuntime(); });
  const absent = fixture().draft; delete absent.taxAnalysis;
  assert.equal((await service.calculate(absent)).status, "absent");
  const future = fixture().draft; future.taxAnalysis = { ...future.taxAnalysis!, carrierVersion: 99 } as unknown as TaxAttachmentV1;
  assert.equal((await service.calculate(future)).status, "unsupported");
  const corrupt = fixture().draft; corrupt.taxAnalysis!.document = "bad JSON";
  assert.equal((await service.calculate(corrupt)).status, "corrupt");
  for (const text of ["", "12.", "not money"]) {
    const { draft, document } = fixture(); document.edit.implementation_cost = text; attach(draft, document);
    assert.equal((await service.calculate(draft)).status, "incomplete");
  }
  const stale = fixture().draft; stale.nodes[0].detail += " changed source";
  assert.equal((await service.calculate(stale)).status, "stale");
  const rates = fixture("rates-derived"); rates.document.rates_confirmed = false; attach(rates.draft, rates.document);
  assert.equal((await service.calculate(rates.draft)).status, "incomplete");
  assert.equal(loads, 0);
});

test("caller mutation across source hashing and runtime loading cannot mix report generations", async () => {
  const runtime = await loadNodeTaxRuntime();
  let release!: (value: TaxRuntime) => void, entered!: () => void;
  const gate = new Promise<TaxRuntime>(resolve => { release = resolve; });
  const loading = new Promise<void>(resolve => { entered = resolve; });
  const service = createTaxReportExecution(() => { entered(); return gate; });
  const { draft } = fixture(), original = structuredClone(draft);
  const result = service.calculate(draft);
  draft.title += " immediate mutation";
  await loading;
  draft.nodes[0].detail += " while runtime loading";
  draft.taxAnalysis!.document = "changed attachment";
  release(runtime);
  const snapshot = ready(await result);
  assert.deepEqual(snapshot.draft, original);
  assert.equal(snapshot.result.baseline_annual_tax_cost, "25000000");
  assert.equal(snapshot.attachment.document, original.taxAnalysis?.document);
});

test("same artifact context with changed raw money freshly changes result and report identity; cache never substitutes", async () => {
  let calls = 0;
  const runtime = await loadNodeTaxRuntime();
  const service = createTaxReportExecution(async () => ({ ...runtime, execute(encoded) { if (JSON.parse(encoded).command === "tax_web_calculate") calls++; return runtime.execute(encoded); } }));
  const { draft, document } = fixture();
  const first = ready(await service.calculate(draft));
  document.edit.optimized_annual_tax_cost = "180000.00";
  document.cached_response = JSON.stringify({ ...first.result, npv: "999999999999999" }); attach(draft, document);
  const second = ready(await service.calculate(draft));
  assert.deepEqual(second.context, first.context);
  assert.notEqual(second.result.npv, first.result.npv);
  assert.notEqual(second.identity, first.identity); assert.notEqual(second.attachment_digest, first.attachment_digest);
  assert.notEqual(second.input_hash, first.input_hash);
  document.cached_response = "different poison"; attach(draft, document);
  const third = ready(await service.calculate(draft));
  assert.deepEqual(third.result, second.result); assert.equal(third.input_hash, second.input_hash);
  assert.notEqual(third.identity, second.identity, "complete attachment includes retained cache text without trusting it");
  assert.equal(calls, 3);
});

test("old versions, mismatched source/context/authored request and changed binding identity refuse a snapshot", async () => {
  const changes: ((value: Response) => void)[] = [
    value => { value.type = "tax_prepared"; },
    value => { value.source_schema = "old-source"; },
    value => { value.source.case_id = "other"; },
    value => { value.source.fact_ids = []; },
    value => { value.calculation.context.revision = "1"; },
    value => { value.draft.request.context.artifact_id = "other"; },
    value => { value.draft.request.input.implementation_cost = "1"; },
    value => { value.draft.request.input.benefit_items = [{ unexpected: true }]; },
    value => { value.draft.request.input.extra = "future"; },
    value => { value.draft.request.input.tax_base_mode = "manual_override"; },
    value => { value.draft.request.input.tax_base_formula_id = "unknown formula"; },
    value => { value.draft.request.input.override_owner = "unexpected override"; },
    value => { value.draft.request.input.missing_tax_base_inputs = ["changed"]; },
    value => { value.draft.request.input_schema = "old-input"; },
    value => { value.draft.binding_hash_schema = "future-bindings"; },
    value => { value.draft.input_hash = "A".repeat(64); },
    value => { value.draft.binding_hash = "123"; },
    value => { value.draft.missing_inputs = [1]; },
    value => { value.draft.required_component_ids = []; },
    value => { value.draft.bindings[0].note = "changed provenance"; },
    ...(["transport_protocol", "result_schema", "calculation_version", "application_policy"] as const).map(field => (value: Response) => { value.calculation[field] = "old"; }),
  ];
  for (const change of changes) {
    const result = await createTaxReportExecution(() => altered(change)).calculate(fixture("rates-derived").draft);
    assert.equal(result.status, "invalid_response"); assert.ok(!("snapshot" in result));
  }
  const manual = await createTaxReportExecution(() => altered(value => { value.draft.request.input.tax_base_formula_id = "replaced"; })).calculate(fixture("manual-override").draft);
  assert.equal(manual.status, "invalid_response", "manual mode permits no request field replacement");
});

test("result money remains exact signed i64 cents; nullability, ROI and month bounds are checked", async () => {
  const invalid: [string, unknown][] = [
    ["npv", 9007199254740992], ["npv", "9223372036854775808"], ["npv", "-9223372036854775809"], ["npv", "1.00"], ["npv", "01"], ["npv", "-0"], ["npv", null],
    ["effective_annual_tax_base", 1], ["lifecycle_roi_bps", "1"], ["lifecycle_roi_bps", 2147483648], ["lifecycle_roi_bps", -2147483649], ["lifecycle_roi_bps", 1.5],
    ["lifecycle_roi_unavailable_reason", "unknown"], ["lifecycle_roi_bps", null], ["payback_months", -1], ["payback_months", 4294967296], ["payback_months", "1"],
  ];
  for (const [field, value] of invalid) {
    const result = await createTaxReportExecution(() => altered(response => { response.calculation.result[field] = value; })).calculate(fixture().draft);
    assert.equal(result.status, "invalid_response", `${field}: ${String(value)}`);
  }
  for (const cents of ["9223372036854775807", "-9223372036854775808"]) {
    // Shape validation only: injected financial data is not parity or runtime attestation.
    const snapshot = ready(await createTaxReportExecution(() => altered(response => { response.calculation.result.npv = cents; })).calculate(fixture().draft));
    assert.equal(snapshot.result.npv, cents);
    assert.ok(formatTaxMoneyCents(snapshot.result.npv, "EUR", "en").endsWith(cents.startsWith("-") ? ".08 EUR" : ".07 EUR"));
  }
  const zeroCost = fixture(); zeroCost.document.edit.implementation_cost = "0"; attach(zeroCost.draft, zeroCost.document);
  const real = ready(await createTaxReportExecution(loadNodeTaxRuntime).calculate(zeroCost.draft));
  assert.equal(real.result.lifecycle_roi_bps, null); assert.equal(real.result.lifecycle_roi_unavailable_reason, "non_positive_lifecycle_cost");
  const negative = ready(await createTaxReportExecution(loadNodeTaxRuntime).calculate(fixture("negative-tax-effect").draft));
  assert.equal(negative.result.payback_months, null); assert.equal(negative.result.effective_annual_tax_base, null);
});

test("real Rust domain failures and runtime failures never fall back to stored results", async () => {
  const invalid = fixture(); invalid.document.edit.implementation_cost = "92233720368547758.07"; attach(invalid.draft, invalid.document);
  const result = await createTaxReportExecution(loadNodeTaxRuntime).calculate(invalid.draft);
  assert.equal(result.status, "tax_error"); assert.ok(!("snapshot" in result));
  const failure = await createTaxReportExecution(async () => { throw new Error("unavailable"); }).calculate(fixture().draft);
  assert.equal(failure.status, "runtime_error"); assert.ok(!("snapshot" in failure));
  const malformed = await createTaxReportExecution(() => altered(value => { Reflect.deleteProperty(value.calculation.result, "npv"); })).calculate(fixture().draft);
  assert.equal(malformed.status, "invalid_response");
});
