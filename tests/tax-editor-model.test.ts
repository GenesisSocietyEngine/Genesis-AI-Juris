import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createWebTaxRepository } from "../app/tax-runtime/web-repository";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { createTaxReportExecution } from "../app/tax-report-execution";
import { changeTaxDocument, createTaxEditorAttempts, nextTaxRevision, rebindTaxDocument, taxDocumentFromLegacy, taxDocumentFromPreparation, taxEditorAttachment } from "../app/tax-editor-model";
import { deriveWebTaxSource } from "../app/studio-tax-source";
import { readTaxAttachment } from "../app/tax-authoring";
import { materializeWebTaxAuthoring } from "../app/tax-materialize";
import { taxLegacyReview } from "../app/tax-legacy-review";
import { createHash } from "node:crypto";
import type { StudioDraft } from "../app/types";

const fixture = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/web-source.json", import.meta.url), "utf8"));
const repository = createWebTaxRepository(loadNodeTaxRuntime);
const calculator = createTaxReportExecution(loadNodeTaxRuntime);
async function prepared(revision = "9007199254740993") {
  const draft = structuredClone(fixture.draft) as StudioDraft;
  return { draft, document: taxDocumentFromPreparation(await repository.prepare(draft, { artifact_id: "editor_test", revision, currency: "EUR" })) };
}

test("editor creates through Rust, preserves raw edits, saves/reopens and freshly recomputes equal results", async () => {
  const { draft, document: start } = await prepared();
  let document = start;
  for (const [field, value] of [["baseline_annual_tax_cost", "250000.00"], ["optimized_annual_tax_cost", "200000.00"], ["implementation_cost", "1000.00"]]) document = changeTaxDocument(document, { kind: "edit", field, value });
  assert.equal(document.request.context.revision, "9007199254740996");
  assert.equal(start.edit.baseline_annual_tax_cost, "0.00", "original immutable");
  const current = { ...draft, taxAnalysis: taxEditorAttachment(document) };
  const first = await calculator.calculate(current);
  assert.equal(first.status, "ready", JSON.stringify(first));
  const serialized = JSON.stringify(current), reopened = JSON.parse(serialized) as StudioDraft;
  const second = await calculator.calculate(reopened);
  assert.equal(second.status, "ready", JSON.stringify(second));
  if (first.status !== "ready" || second.status !== "ready") assert.fail("expected two executions");
  assert.deepEqual(second.snapshot.result, first.snapshot.result);
  assert.equal(second.snapshot.result.recognized_annual_tax_saving, "5000000", "money does not scale by 100 twice");
  assert.deepEqual(second.snapshot.command, first.snapshot.command);
  assert.equal(reopened.taxAnalysis!.document, current.taxAnalysis.document);
  assert.equal(first.snapshot.context.revision, "9007199254740996");
});

test("incomplete edits survive attachment reopen and never calculate older request values", async () => {
  const { draft, document: start } = await prepared();
  for (const value of ["", "12.", " 15", "1e3"]) {
    const document = changeTaxDocument(start, { kind: "edit", field: "implementation_cost", value });
    document.cached_response = "historical result only";
    const read = readTaxAttachment(taxEditorAttachment(document));
    assert.equal(read.status, "known");
    if (read.status !== "known") assert.fail("known");
    assert.equal(read.view.edit.implementation_cost, value);
    assert.equal(read.view.request.input.implementation_cost, "0", "old wire value is deliberately untouched");
    assert.equal((await calculator.calculate({ ...draft, taxAnalysis: read.attachment })).status, "incomplete");
  }
});

test("changed rates, modes and component provenance clear prior confirmation without dropping required IDs", async () => {
  const { document: start } = await prepared();
  let document = changeTaxDocument(start, { kind: "rates_confirmed", value: true });
  for (const field of ["baseline_tax_rate_bps", "optimized_tax_rate_bps"]) assert.equal(changeTaxDocument(document, { kind: "edit", field, value: "2000" }).rates_confirmed, false);
  document = changeTaxDocument(document, { kind: "add_binding", id: "income" });
  document = changeTaxDocument(document, { kind: "required", id: "income", value: true });
  document = changeTaxDocument(document, { kind: "binding", index: 0, field: "confirmed", value: true });
  for (const field of ["amount_text", "fact_id", "source_field", "period", "jurisdiction", "confirmation_owner", "confirmation_as_of"]) {
    const next = changeTaxDocument(document, { kind: "binding", index: 0, field, value: "changed" });
    assert.equal(next.bindings[0].confirmed, false, field);
    assert.deepEqual(next.required_component_ids, ["income"]);
  }
  const renamed = changeTaxDocument(document, { kind: "binding", index: 0, field: "component_id", value: "new income" });
  assert.deepEqual(renamed.required_component_ids, ["new income"]);
  assert.equal(renamed.bindings[0].confirmed, false);
});

test("source edits block execution; explicit rebind retains exact old document and requires reconfirmation", async () => {
  const { draft, document: start } = await prepared();
  let document = changeTaxDocument(start, { kind: "rates_confirmed", value: true });
  document = changeTaxDocument(document, { kind: "add_binding", id: "income" });
  document = changeTaxDocument(document, { kind: "binding", index: 0, field: "confirmed", value: true });
  const before = taxEditorAttachment(document);
  const changed = { ...draft, title: "Edited source" };
  assert.equal((await calculator.calculate({ ...changed, taxAnalysis: before })).status, "stale");
  const source = await deriveWebTaxSource(changed), rebound = rebindTaxDocument(before, source.descriptor);
  assert.equal(rebound.previous_source_documents.at(-1), before.document);
  assert.equal(rebound.rates_confirmed, false);
  assert.equal(rebound.bindings[0].confirmed, false);
  assert.deepEqual(rebound.edit, document.edit);
  assert.equal(rebound.bindings[0].scenario_fingerprint, source.descriptor.scenario_fingerprint);
  assert.equal(materializeWebTaxAuthoring(rebound, source.descriptor).status, "incomplete");
});

test("both pinned legacy formats retain exact raw originals and full Rust receipts without invented provenance", async () => {
  const { draft, document } = await prepared();
  for (const schema of ["web_amounts_v1", "web_rates_fx_v1"] as const) {
    const raw = ` \n${await readFile(new URL(`../crates/juris-tax-economics/tests/fixtures/adapters/${schema}.json`, import.meta.url), "utf8")}\n `;
    const response = await repository.importLegacy(draft, { artifact_id: document.request.context.artifact_id, revision: nextTaxRevision(document.request.context.revision), schema, original_json: raw });
    const imported = taxDocumentFromLegacy(taxEditorAttachment(document), response);
    assert.equal(imported.converted, true);
    assert.equal(imported.document.legacy_documents.at(-2), raw);
    assert.equal(imported.document.legacy_documents.at(-1), response.response);
    assert.equal(imported.document.edit.baseline_annual_tax_cost, "50000.00");
    assert.equal(imported.document.rates_confirmed, false);
    if (schema === "web_amounts_v1") {
      assert.equal(imported.document.edit.annual_tax_base_override, "");
      assert.equal(imported.document.edit.baseline_tax_rate_bps, "");
      assert.equal(imported.document.edit.optimized_tax_rate_bps, "");
    }
    if (schema === "web_rates_fx_v1") {
      assert.equal(imported.document.request.input.override_owner, null);
      assert.equal(imported.document.request.input.override_as_of, null);
      assert.equal(materializeWebTaxAuthoring(imported.document, imported.document.source).status, "incomplete");
      assert.ok(response.response.includes("1.2300e+0"), "exact FX token retained");
    }
  }
});

test("unknown legacy data is retained but does not silently replace existing edited values", async () => {
  const { draft, document } = await prepared();
  const before = taxEditorAttachment(changeTaxDocument(document, { kind: "edit", field: "implementation_cost", value: "uncompleted." }));
  const original = ' { "future":900719925474099312345 } ';
  const response = await repository.importLegacy(draft, { artifact_id: document.request.context.artifact_id, revision: "9007199254740995", schema: "web_amounts_v1", original_json: original });
  const imported = taxDocumentFromLegacy(before, response);
  assert.equal(imported.converted, false);
  assert.equal(imported.document.edit.implementation_cost, "uncompleted.");
  assert.equal(imported.document.legacy_documents.at(-2), original);
  assert.equal(imported.document.previous_source_documents.at(-1), before.document);
});

test("revision overflow and malformed responses refuse adoption without changing prior work", async () => {
  const { draft, document } = await prepared("18446744073709551615");
  const before = JSON.stringify(document);
  assert.throws(() => changeTaxDocument(document, { kind: "edit", field: "implementation_cost", value: "5" }), /revision limit/);
  assert.equal(JSON.stringify(document), before);
  const response = await repository.prepare(draft, { artifact_id: "one", revision: "0", currency: "EUR" });
  const tampered = JSON.parse(response.response); tampered.request.context.artifact_id = "two";
  assert.throws(() => taxDocumentFromPreparation({ ...response, response: JSON.stringify(tampered) }), /did not match/);
});

test("unavailable legacy review is durable and shared by editor and fresh report execution", async () => {
  const { draft, document } = await prepared();
  const response = await repository.importLegacy(draft, { artifact_id: document.request.context.artifact_id, revision: nextTaxRevision(document.request.context.revision), schema: "web_amounts_v1", original_json: ' { "future":900719925474099312345 } ' });
  const unavailable = taxDocumentFromLegacy(taxEditorAttachment(document), response).document;
  const stored = JSON.parse(JSON.stringify({ ...draft, taxAnalysis: taxEditorAttachment(unavailable) })) as StudioDraft;
  assert.equal((await calculator.calculate(stored)).status, "incomplete", "direct execution cannot bypass editor review");
  const reviewed = changeTaxDocument(unavailable, { kind: "acknowledge_unavailable_import" });
  assert.deepEqual(reviewed.edit, unavailable.edit);
  const marker = JSON.parse(reviewed.legacy_documents.at(-1)!);
  assert.equal(marker.receipt_sha256, createHash("sha256").update(response.response).digest("hex"), "complete raw receipt bytes bound by standard SHA-256");
  assert.equal(taxLegacyReview(reviewed.legacy_documents).status, "clear");
  assert.equal((await calculator.calculate(JSON.parse(JSON.stringify({ ...draft, taxAnalysis: taxEditorAttachment(reviewed) })))).status, "ready");
  for (const mutation of [
    (m: Record<string, unknown>) => { m.receipt_index = 0; },
    (m: Record<string, unknown>) => { m.receipt_sha256 = "0".repeat(64); },
    (m: Record<string, unknown>) => { m.original_sha256 = "0".repeat(64); },
    (m: Record<string, unknown>) => { m.extra = true; },
  ]) {
    const invalid = structuredClone(reviewed), changed = { ...marker }; mutation(changed);
    invalid.legacy_documents[invalid.legacy_documents.length - 1] = JSON.stringify(changed);
    assert.equal((await calculator.calculate({ ...draft, taxAnalysis: taxEditorAttachment(invalid) })).status, "incomplete");
  }
  for (const suffix of [JSON.stringify(marker), '{"protocol":"web-tax-legacy-review-v1","protocol":"web-tax-legacy-review-v1"}']) {
    const duplicate = structuredClone(reviewed); duplicate.legacy_documents.push(suffix);
    assert.equal(taxLegacyReview(duplicate.legacy_documents).status, "blocked");
  }
  const changedReceipt = structuredClone(reviewed); changedReceipt.legacy_documents[marker.receipt_index] += " ";
  assert.equal(taxLegacyReview(changedReceipt.legacy_documents).status, "blocked", "equivalent JSON with different raw bytes must be reviewed again");
});

test("attempt invalidation prevents cancelled and superseded async adoption", () => {
  const attempts = createTaxEditorAttempts(), old = attempts.begin();
  attempts.invalidate(); assert.equal(attempts.current(old), false);
  const next = attempts.begin(); assert.equal(attempts.current(next), true);
  const newest = attempts.begin(); assert.equal(attempts.current(next), false); assert.equal(attempts.current(newest), true);
});

test("inactive amount-mode rates remain raw and unavailable; switching to rates requires valid confirmed input", async () => {
  const { draft, document } = await prepared();
  let edited = changeTaxDocument(document, { kind: "edit", field: "baseline_tax_rate_bps", value: "" });
  edited = changeTaxDocument(edited, { kind: "edit", field: "optimized_tax_rate_bps", value: "unfinished." });
  const reopened = JSON.parse(JSON.stringify({ ...draft, taxAnalysis: taxEditorAttachment(edited) }));
  const calculated = await calculator.calculate(reopened);
  assert.equal(calculated.status, "ready", JSON.stringify(calculated));
  if (calculated.status !== "ready") assert.fail("ready");
  assert.equal(calculated.snapshot.normalized_request.input.baseline_tax_rate_bps, 0, "inactive mandatory wire placeholder");
  const authored = JSON.parse(calculated.snapshot.attachment.document);
  assert.equal(authored.edit.baseline_tax_rate_bps, ""); assert.equal(authored.edit.optimized_tax_rate_bps, "unfinished.");
  const active = changeTaxDocument(edited, { kind: "input", field: "tax_input_basis", value: "rates" });
  const result = await calculator.calculate({ ...draft, taxAnalysis: taxEditorAttachment(active) });
  assert.equal(result.status, "incomplete");
  if (result.status !== "incomplete") assert.fail("incomplete");
  assert.ok(result.issues.some(issue => issue.field === "edit.baseline_tax_rate_bps"));
  assert.ok(result.issues.some(issue => issue.field === "rates_confirmed"));
});
