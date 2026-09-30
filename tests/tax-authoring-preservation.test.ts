import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parsePreservedJson } from "../app/preserved-json";
import { deriveWebTaxSource } from "../app/studio-tax-source";
import { assertTaxAttachmentMutation, hasTaxAttachment, preserveKnownTaxAttachment, readTaxAttachment, taxAttachmentDigest, type TaxAttachmentV1 } from "../app/tax-authoring";

const source = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-source.json", import.meta.url), "utf8"));
const corpus = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; request: string; response: string }[] };
const prepare = JSON.parse(corpus.cases.find(entry => entry.name === "prepare")!.response);
const editFields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
function document() {
  const request = structuredClone(prepare.request);
  const binding = JSON.parse(corpus.cases.find(entry => entry.name === "rates-derived")!.request).bindings[0];
  delete binding.amount;
  binding.amount_text = "unfinished amount";
  binding.confirmed = false;
  const benefit = JSON.parse(corpus.cases.find(entry => entry.name === "dated-benefit")!.request).request.input.benefit_items[0];
  delete benefit.amount;
  benefit.amount_text = "12.";
  for (const key of ["start_month", "end_month", "realization_bps", "probability_bps"]) benefit[key] = benefit[key] === null ? "" : String(benefit[key]);
  return {
    schema: "web-tax-authoring-artifact-v1", source: structuredClone(source.descriptor), request,
    edit: Object.fromEntries(editFields.map(key => [key, key === "implementation_cost" ? "unfinished" : ""])),
    bindings: [binding], benefits: [benefit], required_component_ids: ["income", "not_filled_yet"], rates_confirmed: false,
    legacy_documents: [' { "original_json": "{ \\"large\\": 900719925474099312345 }" } '],
    previous_source_documents: ['{"schema":"future-archive","number":900719925474099312345}'],
    cached_response: corpus.cases.find(entry => entry.name === "amounts")!.response,
  };
}
const attachment = (value = document()): TaxAttachmentV1 => ({ format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify(value, null, "\t") + "\n" });

test("known incomplete tax attachments preserve exact document text and parse a detached historical view", async () => {
  const original = attachment();
  const read = readTaxAttachment(original);
  assert.equal(read.status, "known");
  if (read.status !== "known") assert.fail(JSON.stringify(read));
  assert.equal(read.attachment.document, original.document);
  assert.equal(preserveKnownTaxAttachment(original)!.document, original.document);
  assert.equal(read.view.edit.implementation_cost, "unfinished");
  assert.equal(read.view.bindings[0].amount_text, "unfinished amount");
  assert.equal(read.view.request.context.revision, "9007199254740993");
  assert.equal(read.view.cached_response, document().cached_response, "cache is retained as a raw historical string");
  read.view.edit.implementation_cost = "other edit";
  assert.equal(original.document, attachment().document, "view mutation cannot rewrite retained storage text");
  assert.equal(await taxAttachmentDigest({ document: original.document, carrierVersion: 1, format: original.format }), await taxAttachmentDigest(original));
  assert.notEqual(await taxAttachmentDigest({ ...original, document: original.document.trimEnd() }), await taxAttachmentDigest(original));
});

test("future versions and unknown members stay unsupported without normalizing original numeric tokens", () => {
  const futureDocument = ' { "schema":"web-tax-authoring-artifact-v2", "number":900719925474099312345, "s":"\\ud800" }\n';
  const fixtures = [
    { ...attachment(), carrierVersion: 2 },
    { ...attachment(), future: { amount: 999 } },
    { ...attachment(), document: futureDocument },
    attachment({ ...document(), future: { unknown: true } } as ReturnType<typeof document>),
  ];
  for (const original of fixtures) {
    const result = readTaxAttachment(original);
    assert.equal(result.status, "unsupported");
    if (result.status !== "unsupported") assert.fail("Future content became editable");
    assert.equal(result.original, original);
    assert.equal((result.original as TaxAttachmentV1).document, original.document);
    assert.throws(() => preserveKnownTaxAttachment(original), /read-only recovery/);
  }
  for (const change of [(value: ReturnType<typeof document>) => { value.source.source_schema = "future"; }, (value: ReturnType<typeof document>) => { value.request.input_schema = "future"; }, (value: ReturnType<typeof document>) => { value.request.input.kind = "tax-economics-v3"; }]) {
    const value = document(); change(value);
    assert.equal(readTaxAttachment(attachment(value)).status, "unsupported");
  }
});

test("strict classification catches escaped duplicate keys, malformed and excessively nested JSON without changing originals", () => {
  for (const raw of ['{"a":1,"\\u0061":2}', '{"x":[{"a":1,"a":2}]}', '{"a":1', '['.repeat(66) + '0' + ']'.repeat(66)]) assert.throws(() => parsePreservedJson(raw));
  assert.deepEqual(parsePreservedJson('{"a":"quoted \\" braces {}", "b":[null,true,false,-0,1e3], "nested":{"a":2}}'), { a: 'quoted " braces {}', b: [null, true, false, -0, 1000], nested: { a: 2 } });
  const original = { ...attachment(), document: attachment().document.replace('"schema":', '"schema":"future", "schema":') };
  const result = readTaxAttachment(original);
  assert.equal(result.status, "corrupt");
  if (result.status !== "corrupt") assert.fail("Duplicate document was not preserved");
  assert.equal(result.original, original);
});

test("stored source and request identity remain internally consistent while enclosing edited source may differ", async () => {
  for (const change of [
    (value: ReturnType<typeof document>) => { value.request.context.case_id = "different"; },
    (value: ReturnType<typeof document>) => { value.request.context.revision = "01"; },
    (value: ReturnType<typeof document>) => { value.request.context.revision = "18446744073709551616"; },
    (value: ReturnType<typeof document>) => { value.source.reference_ids = ["fact_a"]; },
    (value: ReturnType<typeof document>) => { value.source.fact_ids.reverse(); },
    (value: ReturnType<typeof document>) => { value.source.fact_ids = ["\ud800"]; },
    (value: ReturnType<typeof document>) => { value.request.input.analysis_horizon_months = Number.MAX_SAFE_INTEGER + 1; },
  ]) {
    const value = document(); change(value);
    assert.equal(readTaxAttachment(attachment(value)).status, "corrupt");
  }
  const stale = { caseId: "forked_case", taxAnalysis: attachment() };
  assert.equal(readTaxAttachment(stale.taxAnalysis).status, "known", "storage does not silently rebind old source identity");
  const exactUnicode = document();
  const derived = await deriveWebTaxSource({ ...source.draft, caseId: "\ufeffexact" });
  exactUnicode.source = derived.descriptor;
  exactUnicode.request.context.case_id = derived.descriptor.case_id;
  exactUnicode.request.context.scenario_fingerprint = derived.descriptor.scenario_fingerprint;
  assert.equal(readTaxAttachment(attachment(exactUnicode)).status, "known", "valid Unicode identity is not trimmed or normalized");
  for (const value of [null, {}, { carrierVersion: 99 }, attachment()]) assert.equal(hasTaxAttachment({ taxAnalysis: value }), true);
  assert.equal(hasTaxAttachment({}), false);
});

test("complete successful Rust web corpus requests remain supported, including derived components and dated benefits", () => {
  let calculations = 0, components = 0, benefits = 0;
  for (const entry of corpus.cases) {
    const response = JSON.parse(entry.response);
    if (response.type !== "tax_calculated") continue;
    const stored = document(); stored.request = response.draft.request;
    const result = readTaxAttachment(attachment(stored));
    assert.equal(result.status, "known", entry.name);
    calculations++;
    components += stored.request.input.tax_base_components.length;
    benefits += stored.request.input.benefit_items.length;
  }
  assert.equal(calculations, 5);
  assert.ok(components > 0, "the native derived-component fields are exercised");
  assert.ok(benefits > 0, "the native dated-benefit fields are exercised");
});

test("explicit complete-carrier preconditions refuse old-client omission, deletion and stale replacement", async () => {
  const before = attachment();
  const updated = document(); updated.edit.implementation_cost = "still unfinished";
  const after = attachment(updated);
  const precondition = { protocol: "web-tax-attachment-write-v1", expected: await taxAttachmentDigest(before) };
  await assertTaxAttachmentMutation({ before, after, precondition });
  await assertTaxAttachmentMutation({ before: undefined, after, precondition: { protocol: precondition.protocol, expected: null } });
  await assertTaxAttachmentMutation({ before: undefined, after: undefined, precondition: undefined });
  for (const replacement of [undefined, null, {}, { ...before, carrierVersion: 2 }]) await assert.rejects(assertTaxAttachmentMutation({ before, after: replacement, precondition }));
  for (const marker of [undefined, {}, { ...precondition, expected: null }, { ...precondition, expected: "sha256-" + "0".repeat(64) }, { ...precondition, extra: true }]) await assert.rejects(assertTaxAttachmentMutation({ before, after, precondition: marker }));
  await assert.rejects(assertTaxAttachmentMutation({ before: { ...before, carrierVersion: 2 }, after, precondition }));
  assert.equal(before.document, attachment().document, "failed and accepted checks never mutate original content");
  const mutable = { before: structuredClone(before), after: structuredClone(after), precondition: { ...precondition } };
  const checking = assertTaxAttachmentMutation(mutable);
  mutable.before.document = "late changed original";
  mutable.after.document = "late changed candidate";
  mutable.precondition.expected = "sha256-" + "0".repeat(64);
  await checking;
  await assert.rejects(assertTaxAttachmentMutation(mutable), "the later mutable objects themselves never gain validation");
});
