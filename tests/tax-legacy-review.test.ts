import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { taxLegacyDecision, taxLegacyReview } from "../app/tax-legacy-review";
import { taxDocumentFromLegacy, taxDocumentFromPreparation, taxEditorAttachment } from "../app/tax-editor-model";
import { createTaxReportExecution } from "../app/tax-report-execution";
import { createWebTaxRepository } from "../app/tax-runtime/web-repository";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import type { StudioDraft } from "../app/types";

const corpus = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-corpus.json", "utf8")) as { cases: { name: string; response: string }[] };
const receipt = (name: string) => corpus.cases.find(entry => entry.name === name)!.response;
const unavailable = receipt("unavailable-import"), converted = receipt("web_amounts_v1");
const raw = (encoded: string) => JSON.parse(encoded).legacy.original_json as string;

test("complete pinned Rust import receipts and exact explicit decisions remain usable", () => {
  for (const name of ["web_amounts_v1", "web_rates_fx_v1"]) {
    const value = receipt(name), documents = [unavailable, raw(value), value];
    const before = JSON.stringify(documents);
    assert.equal(taxLegacyReview(documents).status, "clear", name);
    assert.equal(JSON.stringify(documents), before);
  }
  const pending = [raw(unavailable), unavailable];
  assert.equal(taxLegacyReview(pending).status, "pending");
  assert.equal(taxLegacyReview([...pending, taxLegacyDecision(pending)]).status, "clear");
});

test("truncated, coerced, future or inconsistent converted records cannot clear an earlier pending review", () => {
  const mutations: Array<[string, (value: ReturnType<typeof JSON.parse>) => void]> = [
    ["missing converted draft", value => { delete value.legacy.status.draft; }],
    ["array status", value => { value.legacy.status.status = ["converted"]; }],
    ["future response field", value => { value.future = true; }],
    ["future legacy schema", value => { value.legacy.schema = "future"; }],
    ["future source version", value => { value.source_schema = "future"; }],
    ["missing source", value => { delete value.source; }],
    ["duplicate source id", value => { value.source.fact_ids.push(value.source.fact_ids[0]); }],
    ["future source field", value => { value.source.future = true; }],
    ["different source identity", value => { value.source.case_id = "changed"; }],
    ["future request version", value => { value.legacy.status.draft.request.input_schema = "future"; }],
    ["missing request input", value => { delete value.legacy.status.draft.request.input; }],
    ["future input field", value => { value.legacy.status.draft.request.input.future = true; }],
    ["missing hash", value => { delete value.legacy.status.draft.input_hash; }],
    ["malformed FX", value => { value.legacy.status.draft.fx_json = "{"; }],
    ["invalid wire cents", value => { value.legacy.status.draft.request.input.implementation_cost = "9223372036854775808"; }],
    ["invalid wire rate", value => { value.legacy.status.draft.request.input.baseline_tax_rate_bps = 65536; }],
    ["future unavailable field", value => { value.legacy.status.draft.unavailable_legacy_fields.push("futureRequired"); }],
    ["duplicate unavailable field", value => { value.legacy.status.draft.unavailable_legacy_fields.push("annualTaxBase", "annualTaxBase"); }],
    ["future provenance field", value => { value.legacy.status.draft.missing_override_provenance.push("futureRequired"); }],
    ["duplicate provenance field", value => { value.legacy.status.draft.missing_override_provenance.push("override_owner", "override_owner"); }],
  ];
  for (const [name, change] of mutations) {
    const value = JSON.parse(converted); change(value);
    const documents = [unavailable, JSON.stringify(value)], before = JSON.stringify(documents);
    assert.equal(taxLegacyReview(documents).status, "blocked", name);
    assert.throws(() => taxLegacyDecision(documents), /cannot be acknowledged/, name);
    assert.equal(JSON.stringify(documents), before, name);
  }
  const value = JSON.parse(unavailable); delete value.legacy.status.reason;
  assert.equal(taxLegacyReview([JSON.stringify(value)]).status, "blocked");
});

test("shared fresh execution refuses a truncated converted-history bypass after deserialization", async () => {
  const draft = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-source.json", "utf8")).draft as StudioDraft;
  const repository = createWebTaxRepository(loadNodeTaxRuntime);
  const document = taxDocumentFromPreparation(await repository.prepare(draft, { artifact_id: "review-bypass", revision: "0", currency: "EUR" }));
  const response = await repository.importLegacy(draft, { artifact_id: "review-bypass", revision: "1", schema: "web_amounts_v1", original_json: raw(unavailable) });
  const imported = taxDocumentFromLegacy(taxEditorAttachment(document), response).document;
  const truncated = JSON.parse(converted); delete truncated.legacy.status.draft;
  imported.legacy_documents.push(JSON.stringify(truncated));
  const reopened = JSON.parse(JSON.stringify({ ...draft, taxAnalysis: taxEditorAttachment(imported) })) as StudioDraft;
  const before = JSON.stringify(reopened);
  let loads = 0;
  const result = await createTaxReportExecution(async () => { loads++; return loadNodeTaxRuntime(); }).calculate(reopened);
  assert.equal(result.status, "incomplete");
  if (result.status !== "incomplete") assert.fail("incomplete expected");
  assert.ok(result.issues.some(issue => issue.code === "legacy_review_required"));
  assert.equal(loads, 0, "refuse before loading/calculating a new result");
  assert.equal(JSON.stringify(reopened), before);
});
