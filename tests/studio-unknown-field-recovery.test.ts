import assert from "node:assert/strict";
import test from "node:test";
import { buildCategoryDemo } from "../app/category-demo-draft";
import { normalizeStudioDraft } from "../app/case-integrity";
import { readStudioAggregate, type StudioAggregateKind } from "../app/studio-aggregate";
import { readStudioDeviceDraft, removeKnownStudioDeviceDrafts, studioDeviceDraftKey, studioDeviceDraftV2Key, writeStudioDeviceDraft } from "../app/studio-device-storage";
import { createStudioAuthContinuation } from "../app/studio-auth-continuation";
import { buildStudioCustomCaseExport } from "../app/studio-tax-export";
import type { StudioDraft } from "../app/types";

const scope = "a".repeat(64);
const source = () => buildCategoryDemo("general_advisory", "en");
const candidates = () => {
  const node = structuredClone(source()); Object.assign(node.nodes[0], { futureReview: { exact: "900719925474099312345" } });
  const position = structuredClone(source()); Object.assign(position.nodes[0], { mapPosition: { x: 1, y: 2, futureUnit: "mm" } });
  const classification = structuredClone(source()); Object.assign(classification.classification!, { futureSourceReview: ["retain"] });
  const root = Object.assign(source(), { futureCarrier: { exact: "900719925474099312345" } });
  return [node, position, classification, root];
};
const carriers: Array<{ kind: StudioAggregateKind; envelope: (draft: StudioDraft) => unknown }> = [
  { kind: "draft", envelope: draft => draft },
  { kind: "device-draft", envelope: draft => ({ format: "genesis-juris-device-draft", schemaVersion: 1, scope, draft }) },
  { kind: "custom-case", envelope: draft => ({ format: "genesis-juris-custom-case", schemaVersion: 4, draft }) },
  { kind: "canonical-markdown", envelope: draft => ({ format: "genesis-juris-canonical-markdown", schemaVersion: 1, draft }) },
  { kind: "auth-continuation", envelope: draft => ({ version: 1, scope, draft }) },
];

for (const carrier of carriers) test(`non-tax future fields retain exact raw recovery in ${carrier.kind}`, () => {
  for (const draft of candidates()) {
    const raw = JSON.stringify(carrier.envelope(draft), null, "\t") + "\r\n";
    const result = readStudioAggregate(raw, { kind: carrier.kind });
    assert.equal(result.status, "unsupported");
    assert.ok("rawText" in result); assert.equal(result.rawText, raw);
    const denied = readStudioAggregate(raw, { kind: carrier.kind, access: "denied" });
    assert.equal(denied.status, "denied"); assert.equal(Object.hasOwn(denied, "rawText"), false);
  }
});

test("legacy envelope extensions cannot masquerade as a supported editable version", () => {
  for (const carrier of carriers.filter(item => item.kind !== "draft")) {
    const raw = JSON.stringify({ ...(carrier.envelope(source()) as object), futureCarrier: { value: "retain" } });
    const result = readStudioAggregate(raw, { kind: carrier.kind });
    assert.equal(result.status, "unsupported"); assert.ok("rawText" in result); assert.equal(result.rawText, raw);
  }
});

test("unsupported non-tax active device slots block fallback, replacement and cleanup without writes", () => {
  for (const draft of candidates()) {
    const original = JSON.stringify({ format: "genesis-juris-device-draft", schemaVersion: 2, scope, draft }, null, "\t") + "\r\n";
    const values = new Map([[studioDeviceDraftV2Key(scope), original], [studioDeviceDraftKey(scope), JSON.stringify(carriers[1].envelope(source()))]]);
    const before = [...values]; let writes = 0;
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { writes++; values.set(key, value); }, removeItem: (key: string) => { writes++; values.delete(key); } };
    const result = readStudioDeviceDraft(storage, scope); assert.equal(result.status, "unsupported");
    assert.throws(() => writeStudioDeviceDraft(storage, scope, source()), /recovery/);
    removeKnownStudioDeviceDrafts(storage, scope);
    assert.deepEqual([...values], before); assert.equal(writes, 0);
  }
});

test("new device/sign-in/export writes reject newer fields before normalization can discard them", () => {
  for (const draft of candidates()) {
    let writes = 0;
    const storage = { getItem: () => null, setItem: () => { writes++; }, removeItem: () => { writes++; } };
    assert.throws(() => writeStudioDeviceDraft(storage, scope, draft), /recovery/);
    assert.equal(writes, 0);
    assert.throws(() => createStudioAuthContinuation({ draft, prompt: "Retain", selectedNodeId: null, scope, customCaseId: null, isPrivate: false, canDuplicate: true }), /recovery/);
    assert.throws(() => buildStudioCustomCaseExport(draft, { exportedAt: "2026-10-19T18:00:00Z", visibility: "private" }), /recovery/);
  }
});

test("ordinary legacy string normalization stays available while structural loss is rejected", () => {
  const draft = source(); draft.title = "  Legacy title  ";
  const read = readStudioAggregate(JSON.stringify(draft), { kind: "draft" });
  assert.equal(read.status, "editable");
  if (read.status === "editable") assert.equal(read.draft.title, "Legacy title");
  const raw = JSON.stringify(source());
  const lost = readStudioAggregate(raw, { kind: "draft", normalizeDraft: value => ({ ...normalizeStudioDraft(value), nodes: [] }) });
  assert.equal(lost.status, "unsupported"); assert.ok("rawText" in lost); assert.equal(lost.rawText, raw);
});
