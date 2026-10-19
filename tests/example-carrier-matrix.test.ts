import assert from "node:assert/strict";
import test from "node:test";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { EXAMPLE_REGISTRY, prepareExampleVersion } from "../app/example-registry";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { readStudioAggregate } from "../app/studio-aggregate";
import { applyStudioSnapshot, snapshotStudioDraft } from "../app/studio-revisions";
import { readStudioDeviceDraft, writeStudioDeviceDraft } from "../app/studio-device-storage";
import { buildStudioCustomCaseExport, readStudioCustomCaseExport } from "../app/studio-tax-export";
import { fixture as taxFixture } from "./helpers/tax-report-fixture";

const scope = "a".repeat(64), timestamp = "2026-10-19T18:00:00.000Z";
function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const rows = EXAMPLE_REGISTRY.flatMap(descriptor =>
  (descriptor.family === "converted" ? ["2.2.0", "2.3.0", "2.4.0", descriptor.source.version] : [descriptor.source.version])
    .flatMap(version => (["en", "ru"] as const).map(locale => ({ descriptor, version, locale }))));

test("carrier inventory includes 18 public packages, retained Canopy alternative and exact historical factories", () => {
  assert.equal(EXAMPLE_REGISTRY.filter(row => row.visible).length, 18);
  assert.equal(EXAMPLE_REGISTRY.length, 19);
  assert.equal(rows.length, 68);
});

for (const { descriptor, version, locale } of rows) test(`carrier roundtrip ${descriptor.id}@${version}/${locale}`, async () => {
  const { draft: source } = await prepareExampleVersion(descriptor.id, locale, version);
  const sourceBytes = JSON.stringify(source), sourceFingerprint = caseFingerprint(source);
  const rawSource = readStudioAggregate(sourceBytes, { kind: "draft" });
  assert.equal(rawSource.status, "editable", "historical raw factories retain their established normalization contract");
  if (rawSource.status !== "editable") assert.fail("Historical raw source was rejected");
  assert.deepEqual(rawSource.draft, normalizeStudioDraft(source));
  assert.equal(rawSource.rawText, sourceBytes);
  const first = createExampleWorkingCopy(source), second = createExampleWorkingCopy(source);
  assert.notEqual(first.caseId, second.caseId);
  assert.deepEqual(first.exampleSource, second.exampleSource);
  assert.equal(first.exampleSource?.version, version);
  assert.equal(first.exampleSource?.fingerprint, caseFingerprint(normalizeStudioDraft(source)), "lineage binds the normalized reference, not the raw factory object");
  assert.equal(first.caseType?.id, descriptor.category);
  first.updatedAt = timestamp;
  first.nodes[0].mapPosition = { x: 413, y: 14003 };
  const expected = JSON.parse(JSON.stringify(first));
  const raw = JSON.stringify(expected, null, "\t") + "\r\n";
  const read = readStudioAggregate(raw, { kind: "draft" });
  assert.equal(read.status, "editable");
  if (read.status !== "editable") assert.fail("Known aggregate did not reopen");
  assert.deepEqual(JSON.parse(JSON.stringify(read.draft)), expected);
  assert.equal(read.rawText, raw);

  const storage = memory();
  writeStudioDeviceDraft(storage, scope, first);
  const reopened = readStudioDeviceDraft(storage, scope);
  assert.equal(reopened.status, "editable");
  if (reopened.status !== "editable") assert.fail("Known device draft did not reopen");
  assert.deepEqual(JSON.parse(JSON.stringify(reopened.draft)), expected);
  const amended = structuredClone(first); amended.title = "Synthetic amendment";
  const restored = applyStudioSnapshot(amended, snapshotStudioDraft(first), timestamp);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), expected);

  // Data-codec fixture only: a syntactically shaped seal is not server authority.
  const sealed = { ...first, protection: { kind: "case-protection-v1" as const, copyProtected: true, copyPolicy: "lineage_locked" as const,
    parentCode: null, currentCode: `sha256-${"a".repeat(64)}`, seal: `hmac-sha256-${"b".repeat(64)}` } };
  const exported = buildStudioCustomCaseExport(sealed, { exportedAt: timestamp, visibility: "private" });
  const decoded = readStudioCustomCaseExport(exported.rawText);
  assert.equal(decoded.status, "legacy", "non-tax v4 still requires the existing authoritative seal-verification path");
  const aggregate = readStudioAggregate(exported.rawText, { kind: "custom-case" });
  assert.equal(aggregate.status, "editable");
  if (aggregate.status !== "editable") assert.fail("Known sealed aggregate did not reopen");
  assert.deepEqual(JSON.parse(JSON.stringify(aggregate.draft)), JSON.parse(JSON.stringify(sealed)));
  const future = exported.rawText.replace('"schemaVersion":4', '"schemaVersion":999');
  const recovery = readStudioCustomCaseExport(future);
  assert.equal(recovery.status, "unsupported");
  if (recovery.status !== "unsupported") assert.fail("Unknown envelope was substituted");
  assert.equal(recovery.rawText, future);
  assert.equal(JSON.stringify(source), sourceBytes, "no mutation or backfill of source factory content");
  assert.equal(caseFingerprint(source), sourceFingerprint);
  assert.ok(source.nodes.every(node => !Object.hasOwn(node, "mapPosition")));
});

test("complete retained tax carrier and source reference survive the same device/revision/JSON contracts", () => {
  const { draft: tax } = taxFixture();
  const draft = createExampleWorkingCopy(tax);
  draft.updatedAt = timestamp;
  draft.nodes[0].mapPosition = { x: 413, y: 14003 };
  const storage = memory(); writeStudioDeviceDraft(storage, scope, draft);
  const reopened = readStudioDeviceDraft(storage, scope);
  assert.equal(reopened.status, "editable");
  if (reopened.status !== "editable") assert.fail("Tax carrier did not reopen");
  assert.deepEqual(reopened.draft.taxAnalysis, draft.taxAnalysis);
  assert.deepEqual(reopened.draft.taxEconomics, draft.taxEconomics);
  assert.deepEqual(reopened.draft.exampleSource, draft.exampleSource);
  assert.deepEqual(reopened.draft.nodes[0].mapPosition, draft.nodes[0].mapPosition);
  assert.equal(snapshotStudioDraft(reopened.draft).taxAnalysis?.document, draft.taxAnalysis?.document);
});
