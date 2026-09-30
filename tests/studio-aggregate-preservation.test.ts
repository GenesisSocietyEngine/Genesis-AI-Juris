import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { caseTypeReference } from "../app/case-type-reference";
import { readStudioAggregate, type StudioAggregateKind } from "../app/studio-aggregate";
import { applyStudioSnapshot, diffStudioSnapshots, snapshotStudioDraft } from "../app/studio-revisions";
import { applyValidatedAIStudioPlan, toStudioAIContext } from "../app/studio-ai-plan";
import type { StudioPromptPlan } from "../app/studio-editing";
import type { TaxAttachmentV1 } from "../app/tax-authoring";
import { deviceDraftEnvelope, readStudioDeviceDraft, removeKnownStudioDeviceDrafts, studioDeviceDraftKey, studioDeviceDraftV2Key, writeStudioDeviceDraft } from "../app/studio-device-storage";
import { createStudioAuthContinuation, readStudioAuthContinuationState, writeStudioAuthContinuation, STUDIO_AUTH_CONTINUATION_KEY } from "../app/studio-auth-continuation";
import { applyCaseType } from "../app/case-type-registry";
import { projectCaseView } from "../app/case-view-projections";
import { synchronizedEconomicPrompt } from "../app/studio-economic-prompt";
import { REPORT_PROFILE_REGISTRY, validateReportReadiness } from "../app/report-model";
import { buildCaseReportArtifacts, caseReportReceiptBinding } from "../app/case-report";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/fiveflats-rent-146000.studio-draft.json", import.meta.url), "utf8"));
const webSource = JSON.parse(readFileSync(new URL("./fixtures/tax-runtime/web-source.json", import.meta.url), "utf8"));
const corpus = JSON.parse(readFileSync(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; response: string }[] };
const prepare = JSON.parse(corpus.cases.find(entry => entry.name === "prepare")!.response);
const rawEdits = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const attachment: TaxAttachmentV1 = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({
  schema: "web-tax-authoring-artifact-v1", source: webSource.descriptor, request: prepare.request,
  edit: Object.fromEntries(rawEdits.map(key => [key, "unfinished"])), bindings: [], benefits: [], required_component_ids: ["unfilled"], rates_confirmed: false,
  legacy_documents: [' {"value":900719925474099312345,"private":"ORIGINAL-PRIVATE-TEXT"} '], previous_source_documents: [], cached_response: '{"historical":true}',
}, null, "\t") + "\r\n" };
const draft = () => normalizeStudioDraft({ ...structuredClone(fixture), taxAnalysis: attachment });

test("normalization preserves complete stale/incomplete attachments and the released legacy fingerprint", () => {
  const legacy = normalizeStudioDraft(fixture);
  assert.equal(caseFingerprint(legacy), "sha256-f3cc75e5bf9fe0b5dca8957cd2d2be5788635701e8bc24279ebd9603dae32c39", "captured from unchanged fe883 legacy normalizer");
  assert.equal(Object.hasOwn(legacy, "taxAnalysis"), false);
  const current = draft();
  assert.equal(current.taxAnalysis!.document, attachment.document);
  assert.notEqual(caseFingerprint(current), caseFingerprint(legacy));
  const other = normalizeStudioDraft({ ...current, taxAnalysis: { ...attachment, document: attachment.document.trimEnd() } });
  assert.notEqual(caseFingerprint(other), caseFingerprint(current), "fingerprint binds exact inner text, not its parsed view");
  const reclassified = normalizeStudioDraft({ ...current, classification: { ...current.classification, domain: "general", practiceArea: "General legal", taxTopics: [] }, nodes: current.nodes.map(node => ({ ...node, type: "fact" })) });
  assert.equal(reclassified.taxAnalysis!.document, attachment.document);
  assert.deepEqual(reclassified.taxEconomics, current.taxEconomics, "inactive legacy inputs survive reclassification when attached");
  assert.throws(() => normalizeStudioDraft({ ...fixture, taxAnalysis: { ...attachment, carrierVersion: 2 } }), /read-only recovery/);
});

test("tax-bearing nested fields and arrays cannot be lost through a legacy normalizer", () => {
  const cases: Record<string, unknown>[] = [];
  const nested = structuredClone(draft()) as unknown as Record<string, unknown>;
  (nested.nodes as Record<string, unknown>[])[0].futureField = { amount: "900719925474099312345" };
  cases.push(nested);
  for (const [key, value] of Object.entries({ parent: { future: "keep me" }, protection: { kind: "future" }, editHistory: { future: "keep me" } })) cases.push({ ...draft(), [key]: value });
  cases.push({ ...draft(), title: "x".repeat(10_000) });
  for (const candidate of cases) {
    const raw = JSON.stringify(candidate, null, 2) + "\r\n";
    const result = readStudioAggregate(raw, { kind: "draft" });
    assert.notEqual(result.status, "editable");
    assert.ok("rawText" in result); assert.equal(result.rawText, raw);
  }
  const current = draft(), raw = JSON.stringify(current);
  const arrayLoss = readStudioAggregate(raw, { kind: "draft", normalizeDraft: value => { const normalized = normalizeStudioDraft(value); normalized.nodes = normalized.nodes.slice(1); return normalized; } });
  assert.equal(arrayLoss.status, "unsupported"); assert.ok("rawText" in arrayLoss); assert.equal(arrayLoss.rawText, raw);
});

test("raw readers classify versions before normalization and retain future numeric tokens exactly", () => {
  const known = draft();
  const envelopes: [StudioAggregateKind, Record<string, unknown>][] = [
    ["draft", known],
    ["custom-case", { format: "genesis-juris-custom-case", schemaVersion: 5, draft: known }],
    ["device-draft", { format: "genesis-juris-device-draft", schemaVersion: 2, scope: "same", draft: known }],
    ["canonical-markdown", { format: "genesis-juris-canonical-markdown", schemaVersion: 2, draft: known }],
    ["auth-continuation", { version: 2, draft: known }],
  ];
  for (const [kind, envelope] of envelopes) {
    const raw = JSON.stringify(envelope, null, 2) + "\n";
    const read = readStudioAggregate(raw, { kind });
    assert.equal(read.status, "editable", `${kind}: ${JSON.stringify(read)}`);
    if (read.status !== "editable") assert.fail("Known aggregate not editable");
    assert.equal(read.draft.taxAnalysis!.document, attachment.document);
    assert.equal(read.rawText, raw);
    const future = raw.replace('"carrierVersion": 1', '"carrierVersion": 999');
    const result = readStudioAggregate(future, { kind });
    assert.equal(result.status, "unsupported");
    if (result.status === "unsupported") assert.equal(result.rawText, future);
  }
  const future = ' {"format":"genesis-juris-custom-case","schemaVersion":999,"draft":{},"number":900719925474099312345} \r\n';
  for (const kind of ["custom-case", "draft"] as const) {
    const read = readStudioAggregate(future, { kind });
    assert.equal(read.status, "unsupported");
    if (read.status === "unsupported") assert.equal(read.rawText, future);
  }
  for (const schemaVersion of [1, 2, 3, 4]) {
    const raw = JSON.stringify({ format: "genesis-juris-custom-case", schemaVersion, draft: fixture });
    assert.equal(readStudioAggregate(raw, { kind: "custom-case" }).status, "editable", "legacy shape classification remains available to existing seal verifier");
    const taxRaw = JSON.stringify({ format: "genesis-juris-custom-case", schemaVersion, draft: known });
    assert.equal(readStudioAggregate(taxRaw, { kind: "custom-case" }).status, "unsupported", "new data cannot masquerade as an older sealed format");
  }
});

test("raw recovery does not bypass scope denial, duplicate-key detection, byte limits or unknown fields", () => {
  const known = draft();
  const raw = JSON.stringify({ format: "genesis-juris-device-draft", schemaVersion: 999, scope: "other", draft: known });
  assert.deepEqual(readStudioAggregate(raw, { kind: "device-draft", expectedScope: "same" }), { status: "denied", reason: "This Studio document belongs to another scope." });
  assert.equal(Object.hasOwn(readStudioAggregate(raw, { kind: "device-draft", access: "denied" }), "rawText"), false);
  const duplicate = JSON.stringify(known).replace('"taxAnalysis":', '"taxAnalysis":null,"taxAnalysis":');
  assert.equal(readStudioAggregate(duplicate, { kind: "draft" }).status, "corrupt");
  const tooLarge = '"' + "\u00e9".repeat(500_000) + '"';
  const bounded = readStudioAggregate(tooLarge, { kind: "draft", normalizeDraft: () => { throw new Error("must not normalize"); } });
  assert.equal(bounded.status, "corrupt");
  if (bounded.status === "corrupt") assert.match(bounded.reason, /size limit/);
  for (const unverified of [raw.slice(0, -1), raw.replace('"scope":"other"', '"scope":"same","scope":"other"'), tooLarge]) {
    const scoped = readStudioAggregate(unverified, { kind: "device-draft", expectedScope: "same" });
    assert.equal(scoped.status, "denied", "malformed/oversized data cannot establish scoped recovery access");
    assert.equal(Object.hasOwn(scoped, "rawText"), false);
  }
  for (const value of [{ ...known, future: 1 }, { ...known, taxAnalysis: null }, { ...known, taxAnalysis: { ...attachment, extra: true } }]) {
    const read = readStudioAggregate(JSON.stringify(value), { kind: "draft" });
    assert.notEqual(read.status, "editable");
  }
  const envelopeExtra = JSON.stringify({ format: "genesis-juris-device-draft", schemaVersion: 2, scope: "same", draft: known, future: 1 });
  assert.equal(readStudioAggregate(envelopeExtra, { kind: "device-draft", expectedScope: "same" }).status, "unsupported");
});

test("snapshots, revision diffs and reviewed AI application retain attachments and case-type identity without provider disclosure", () => {
  const current = draft();
  current.caseType = caseTypeReference("tax_planning");
  const snapshot = snapshotStudioDraft(current);
  const next = structuredClone(current);
  next.caseType = caseTypeReference("general_advisory");
  next.taxAnalysis = { ...attachment, document: attachment.document + " " };
  assert.deepEqual(diffStudioSnapshots(snapshot, snapshotStudioDraft(next)).fields, ["caseType", "taxAnalysis"]);
  const restored = applyStudioSnapshot(next, snapshot, current.updatedAt);
  assert.deepEqual(restored.caseType, current.caseType);
  assert.equal(restored.taxAnalysis!.document, attachment.document);
  const plan: StudioPromptPlan = { instruction: "Rename the case", operations: [{ kind: "set_case_field", field: "title", value: "Renamed case" }], diagnostics: [], canApply: true, contextOnly: false, planner: "ai" };
  const applied = applyValidatedAIStudioPlan(current, { plan, locale: "en", createdAt: current.updatedAt }).draft;
  assert.equal(applied.title, "Renamed case");
  assert.equal(applied.taxAnalysis!.document, attachment.document);
  assert.deepEqual(applied.caseType, current.caseType);
  assert.doesNotMatch(JSON.stringify(toStudioAIContext(current)), /taxAnalysis|ORIGINAL-PRIVATE-TEXT|cached_response/);
});

function memoryStorage(initial: [string, string][] = []) {
  const records = new Map(initial);
  return { records, getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
}
const scope = "a".repeat(64);

test("device v2 retains the original v1 migration record and restores incomplete attached work", () => {
  const legacyRaw = JSON.stringify(deviceDraftEnvelope(scope, normalizeStudioDraft(fixture)), null, "\t") + "\n";
  const storage = memoryStorage([[studioDeviceDraftKey(scope), legacyRaw]]);
  const before = readStudioDeviceDraft(storage, scope);
  assert.equal(before.status, "editable");
  const incomplete = { ...draft(), title: "", nodes: [], links: [] };
  const saved = writeStudioDeviceDraft(storage, scope, incomplete);
  assert.equal(storage.records.get(studioDeviceDraftKey(scope)), legacyRaw, "migration cannot delete or reencode the retained original");
  const restored = readStudioDeviceDraft(storage, scope);
  assert.equal(restored.status, "editable");
  if (restored.status !== "editable") assert.fail("Attached device draft did not restore");
  assert.equal(restored.key, studioDeviceDraftV2Key(scope));
  assert.deepEqual(restored.draft, saved);
  assert.equal(restored.draft.taxAnalysis!.document, attachment.document);
  assert.equal(restored.draft.title, "");
  assert.deepEqual(restored.draft.nodes, []);
  assert.throws(() => normalizeStudioDraft(saved), "temporary authoring storage does not relax sealed/publication requirements");
});

test("future, corrupt, denied and unreadable device slots block fallback and cannot be overwritten or cleaned up", () => {
  const legacy = JSON.stringify(deviceDraftEnvelope(scope, normalizeStudioDraft(fixture)));
  const known = { format: "genesis-juris-device-draft", schemaVersion: 2, scope, draft: draft() };
  for (const raw of [
    JSON.stringify({ ...known, schemaVersion: 99 }),
    JSON.stringify({ ...known, draft: { ...known.draft, taxAnalysis: { ...attachment, carrierVersion: 9 } } }),
    JSON.stringify({ ...known, draft: { ...known.draft, taxAnalysis: null } }),
    JSON.stringify({ ...known, scope: "b".repeat(64) }),
    JSON.stringify({ ...known, draft: { ...known.draft, protection: { kind: "future-protection" } } }),
    "{broken",
    "",
  ]) {
    const storage = memoryStorage([[studioDeviceDraftKey(scope), legacy], [studioDeviceDraftV2Key(scope), raw]]);
    const read = readStudioDeviceDraft(storage, scope);
    assert.notEqual(read.status, "editable");
    assert.notEqual(read.status, "empty");
    assert.throws(() => writeStudioDeviceDraft(storage, scope, draft()), /recovery/);
    assert.equal(storage.records.get(studioDeviceDraftV2Key(scope)), raw);
    removeKnownStudioDeviceDrafts(storage, scope);
    // Unknown protection normalizes away in legacy code, so it requires the raw
    // policy guard too; it must not be treated as an editable cleanup candidate.
    assert.equal(storage.records.get(studioDeviceDraftV2Key(scope)), raw);
  }
  const unreadable = { ...memoryStorage(), getItem: () => { throw new Error("storage denied"); } };
  assert.equal(readStudioDeviceDraft(unreadable, scope).status, "unavailable");
  assert.throws(() => writeStudioDeviceDraft(unreadable, scope, draft()), /recovery/);
  const quota = memoryStorage([[studioDeviceDraftKey(scope), legacy]]);
  assert.throws(() => writeStudioDeviceDraft({ ...quota, setItem: () => { throw new Error("quota exceeded"); } }, scope, draft()), /quota/);
  assert.deepEqual([...quota.records], [[studioDeviceDraftKey(scope), legacy]], "failed write cannot acknowledge or damage the original");
});

test("sign-in continuation preserves attachment text and authorizes raw recovery before exposing a future document", () => {
  const saved = createStudioAuthContinuation({ draft: draft(), prompt: "Keep the full prompt", selectedNodeId: null, scope, customCaseId: null, isPrivate: false, canDuplicate: true }, 1000);
  const current = readStudioAuthContinuationState(JSON.stringify(saved), saved.id, scope, 2000);
  assert.equal(current.status, "restored");
  if (current.status === "restored") assert.equal(current.continuation.draft.taxAnalysis!.document, attachment.document);
  const raw = JSON.stringify({ ...saved, draft: { ...saved.draft, taxAnalysis: { ...attachment, document: '{"schema":"future","amount":900719925474099312345}' } } }, null, "\t") + "\n";
  const read = readStudioAuthContinuationState(raw, saved.id, scope, 2000);
  assert.equal(read.status, "unsupported");
  if (read.status === "unsupported") assert.equal(read.rawText, raw);
  const storage = memoryStorage([[STUDIO_AUTH_CONTINUATION_KEY, raw]]);
  assert.throws(() => writeStudioAuthContinuation(storage, saved), /requires recovery/);
  assert.equal(storage.records.get(STUDIO_AUTH_CONTINUATION_KEY), raw);
  for (const [id, account, now] of [["other", scope, 2000], [saved.id, "b".repeat(64), 2000], [saved.id, scope, 902000]] as const) {
    const denied = readStudioAuthContinuationState(raw, id, account, now);
    assert.equal(denied.status, "denied");
    assert.equal(Object.hasOwn(denied, "rawText"), false);
  }
  const protectedRaw = JSON.stringify({ ...saved, draft: { ...saved.draft, protection: { kind: "future-protection" } } });
  assert.equal(readStudioAuthContinuationState(protectedRaw, saved.id, scope, 2000).status, "denied");
});

test("attached authoring data cannot activate legacy tax results, prompt writeback or report receipts", () => {
  const current = draft();
  const reclassified = applyCaseType(current, "general_advisory");
  assert.equal(reclassified.taxAnalysis!.document, attachment.document);
  assert.deepEqual(reclassified.taxEconomics, current.taxEconomics);
  const projection = projectCaseView(current, "economics");
  assert.ok(projection.items.some(item => item.id === "tax-authoring"));
  assert.ok(!projection.items.some(item => item.id === "tax-economics"));
  assert.doesNotMatch(JSON.stringify(toStudioAIContext(current)), /taxEconomics|ORIGINAL-PRIVATE-TEXT/);
  assert.doesNotMatch(synchronizedEconomicPrompt("Keep source", current), /Tax presentation currency|Baseline tax rate|Baseline annual cash tax|annualized over/);
  const profile = REPORT_PROFILE_REGISTRY.profiles.find(item => item.caseTypes.includes(current.caseType?.id ?? "general_advisory"))!;
  const readiness = validateReportReadiness(current, { profileId: profile.id, status: "draft", audience: "internal", preparedBy: "", preparedFor: "", reviewerName: "", reviewerApproved: false, currentFingerprint: caseFingerprint(current), workspaceFingerprint: null });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.blockers.some(message => /tax analysis/.test(message)));
  assert.throws(() => buildCaseReportArtifacts(current, {} as never), /not yet available/);
  assert.throws(() => caseReportReceiptBinding(current, {} as never), /not yet available/);
});
