import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeStudioDraft, caseFingerprint } from "../app/case-integrity";
import { StudioTaxWriteBaseline } from "../app/studio-tax-write-baseline";
import { taxAttachmentDigest, type TaxAttachmentV1 } from "../app/tax-authoring";

const fixture = JSON.parse(readFileSync("tests/fixtures/fiveflats-rent-146000.studio-draft.json", "utf8"));
const corpus = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-corpus.json", "utf8"));
const source = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-source.json", "utf8"));
const request = JSON.parse(corpus.cases.find((entry: { name: string }) => entry.name === "prepare").response).request;
const editFields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const attachment: TaxAttachmentV1 = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({ schema: "web-tax-authoring-artifact-v1", source: source.descriptor, request, edit: Object.fromEntries(editFields.map(key => [key, "unfinished"])), bindings: [], benefits: [], required_component_ids: [], rates_confirmed: false, legacy_documents: [], previous_source_documents: [] }) };
const draft = () => normalizeStudioDraft({ ...fixture, taxAnalysis: attachment });

test("verified baseline binds prior exact carrier despite later tax edits or source reclassification", async () => {
  const authority = new StudioTaxWriteBaseline(), before = draft(), fp = caseFingerprint(before);
  const digest = await taxAttachmentDigest(before.taxAnalysis); authority.capture(before, "account", fp);
  const after = structuredClone(before); after.taxAnalysis = { ...attachment, document: attachment.document + "\n" }; after.title = "Edited source";
  before.taxAnalysis = after.taxAnalysis; // Caller mutation cannot replace the captured prior value.
  const prepared = await authority.prepare(after, "account", fp);
  assert.equal(prepared.mutation?.expected, digest); assert.notEqual(prepared.mutation?.expected, await taxAttachmentDigest(after.taxAnalysis)); assert.equal(prepared.current(), true);
  authority.clear(); assert.equal(prepared.current(), false);
});

test("child and fork use the verified exact parent's carrier; device-only lineage blocks without dropping edits", async () => {
  const authority = new StudioTaxWriteBaseline(), parent = draft(), fp = caseFingerprint(parent);
  authority.capture(parent, "account", fp);
  const child = { ...parent, caseId: "new_fork", version: "1.0.0", parent: { caseId: parent.caseId, version: parent.version, fingerprint: fp }, taxAnalysis: { ...attachment, document: attachment.document + " " } };
  assert.equal((await authority.prepare(child, "account", null)).mutation?.expected, await taxAttachmentDigest(parent.taxAnalysis));
  const text = JSON.stringify(child);
  await assert.rejects(new StudioTaxWriteBaseline().prepare(child, "account", null), /Keep these edits or export/);
  await assert.rejects(authority.prepare(child, "other-account", null), /not verified/);
  assert.equal(JSON.stringify(child), text);
});

test("new roots explicitly bind absence, legacy saves stay compatible, and verified attachment deletion fails", async () => {
  const authority = new StudioTaxWriteBaseline(), current = draft(); current.parent = null;
  assert.deepEqual((await authority.prepare(current, "account", null)).mutation, { protocol: "web-tax-attachment-write-v1", expected: null });
  const fp = caseFingerprint(current); authority.capture(current, "account", fp);
  const deleted = structuredClone(current); delete deleted.taxAnalysis;
  await assert.rejects(authority.prepare(deleted, "account", fp), /preserved/);
  authority.clear(); assert.equal((await authority.prepare(deleted, "account", null)).mutation, undefined);
});
