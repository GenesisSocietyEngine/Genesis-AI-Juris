import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { LatestRequestGate } from "../app/latest-request";
import { buildCategoryDemo } from "../app/category-demo-draft";
import { retainStudioReplacement, readStudioArchive, readStudioArchiveBackup, restoreArchivedStudioDraft, studioArchiveKey, STUDIO_ARCHIVE_LIMIT, purgeKnownStudioArchive, deleteArchivedStudioDraft } from "../app/studio-draft-archive";
import { deviceDraftEnvelope, mayPersistStudioDraftOnDevice, removeKnownStudioDeviceDrafts, studioDeviceDraftKey, studioDeviceDraftV2Key } from "../app/studio-device-storage";
import { studioReplacementMessage } from "../app/studio-replacement-message";
import { emptyStudioTimeline } from "../app/studio-revisions";
import { hasStudioEvidenceInput } from "../app/studio-evidence-buffer";
import type { StudioDraft } from "../app/types";

const scope = "a".repeat(64), otherScope = "b".repeat(64);
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["resetStudioDraft", "openCategoryDemo", "cancelCategoryDemo", "enterNewLocalDraft", "replaceStudioDraft", "syncStudioDraft", "syncStudioTimeline", "clearStudioEvidenceBuffers"];
const handlers: string[] = [];
function collect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) handlers.push(node.getText(source));
  ts.forEachChild(node, collect);
}
collect(source); assert.equal(handlers.length, names.length);
function memory() {
  const records = new Map<string, string>(); let failWrite = false;
  return { records, getItem: (key: string) => records.get(key) ?? null,
    get length() { return records.size; }, key: (index: number) => [...records.keys()][index] ?? null,
    setItem: (key: string, value: string) => { if (failWrite) throw new Error("quota"); records.set(key, value); },
    removeItem: (key: string) => { records.delete(key); }, fail: () => { failWrite = true; } };
}
function deferred() {
  let resolve!: (value: StudioDraft) => void, reject!: (error: Error) => void;
  const promise = new Promise<StudioDraft>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(confirm = true) {
  const original = buildCategoryDemo("contract_review", "en");
  const storage = memory();
  const raw = JSON.stringify(deviceDraftEnvelope(scope, original), null, 2);
  storage.setItem(studioDeviceDraftKey(scope), raw);
  const loads = [deferred(), deferred()]; let index = 0, pending = false;
  const state = { draft: original, prompt: "unapplied instruction", navigations: 0, confirmations: [] as string[], phase: "", notices: [] as string[], mutations: 0, url: "https://example.test/studio?view=templates&custom_case=12" };
  const draftRef = { current: original }, contextRef = { current: "context" }, timelineRef = { current: { revisions: [], cursor: 0 } };
  const buffersRef = { current: {} };
  const identity = { phase: "ready", scope, epoch: 1 };
  const code = ts.transpileModule(`${handlers.join("\n")}\n({openCategoryDemo, resetStudioDraft, cancelCategoryDemo});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const noop = () => {};
  const functions = runInNewContext(code, {
    URL, structuredClone, locale: "en", prompt: state.prompt, draftRef, studioStorageScope: scope,
    studioCanDuplicate: true, studioCustomCaseId: null, studioPrivate: false,
    studioSessionAuthority: { getSnapshot: () => identity }, catalogueLaunchRef: { current: 0 }, exampleRequestGateRef: { current: new LatestRequestGate() }, exampleContextRef: contextRef,
    starterCancelledRef: { current: false }, studioEvidenceBuffersRef: buffersRef, studioTimelineRef: timelineRef,
    studioSavedBaseline: { current: null }, savedCaseRequestRef: { current: 0 }, restoredSavedCaseRef: { current: null }, studioChangedBeforeRestoreRef: { current: false },
    studioTaxWriteBaseline: { current: { clear: noop } },
    setArchiveVersion: noop, setStudioOpenRevision: noop, setStudioEvidenceBuffers: noop,
    setStudioPrivate: noop, setStudioCustomCaseId: noop, setStudioCanManagePrivacy: noop, setStudioServerFingerprint: noop, setStudioServerPublicationFingerprint: noop, setStudioCanDuplicate: noop, setStudioCopyProtectionLocked: noop, setSelectedNodeId: noop,
    setDraftState: (next: StudioDraft) => { state.draft = next; state.mutations++; }, setStudioTimelineState: noop,
    mayLeaveStudio: () => !pending, mayPersistStudioDraftOnDevice, hasStudioEvidenceInput, retainStudioReplacement, removeKnownStudioDeviceDrafts, studioReplacementMessage, emptyStudioTimeline,
    blankStudioDraft: () => original, loadCategoryDemo: () => loads[index++].promise,
    setExampleLaunch: (value: unknown) => { if (value === null) state.phase = ""; else if (typeof value === "object") state.phase = (value as { phase: string }).phase; },
    setPrompt: (value: string) => { state.prompt = value; }, navigate: () => { state.navigations++; }, showSessionNotice: (value: string) => state.notices.push(value),
    window: { localStorage: storage, confirm: (value: string) => { state.confirmations.push(value); return confirm; }, get location() { return { href: state.url }; }, history: { state: {}, replaceState: (_state: unknown, _title: string, value: URL) => { state.url = value.toString(); } } },
  }) as { openCategoryDemo: (id: string) => Promise<void>; resetStudioDraft: (draft: StudioDraft) => boolean; cancelCategoryDemo: () => void };
  return { state, storage, raw, loads, functions, draftRef, contextRef, identity, buffersRef, timelineRef, pending: () => { pending = true; } };
}
test("real launch and storage: latest choice wins and original bytes are archived before deletion", async () => {
  const h = harness();
  const first = h.functions.openCategoryDemo("general_advisory"), second = h.functions.openCategoryDemo("tax_planning");
  h.loads[1].resolve(buildCategoryDemo("tax_planning", "en")); await second;
  h.loads[0].resolve(buildCategoryDemo("general_advisory", "en")); await first;
  assert.equal(h.state.draft.caseType?.id, "tax_planning"); assert.equal(h.state.mutations, 1); assert.equal(h.state.navigations, 1); assert.equal(h.state.confirmations.length, 1);
  const archive = readStudioArchive(h.storage, scope);
  assert.equal(archive[0].original, h.raw); assert.equal(archive[0].prompt, "unapplied instruction");
  assert.equal(h.storage.getItem(studioDeviceDraftKey(scope)), null);
});
for (const reason of ["cancel", "navigation", "locale", "workspace", "identity", "edit", "operation"] as const) {
  test(`real replacement is abandoned after ${reason}`, async () => {
    const h = harness(); const original = h.state.draft;
    const task = h.functions.openCategoryDemo("general_advisory");
    if (reason === "cancel") h.functions.cancelCategoryDemo();
    else if (reason === "identity") h.identity.epoch++;
    else if (reason === "edit") h.draftRef.current = structuredClone(original);
    else if (reason === "operation") h.pending(); else h.contextRef.current = reason;
    h.loads[0].resolve(buildCategoryDemo("general_advisory", "en")); await task;
    assert.equal(h.state.mutations, 0); assert.equal(h.state.confirmations.length, 0); assert.equal(h.state.navigations, 0);
    assert.equal(h.storage.getItem(studioDeviceDraftKey(scope)), h.raw); assert.equal(h.storage.getItem(studioArchiveKey(scope)), null);
  });
}
test("cancel preserves stored bytes, graph, prompt, input buffers, undo and URL", () => {
  const h = harness(false); const original = h.state.draft, timeline = h.timelineRef.current, buffers = h.buffersRef.current, url = h.state.url;
  assert.equal(h.functions.resetStudioDraft(buildCategoryDemo("tax_planning", "en")), false);
  assert.equal(h.state.draft, original); assert.equal(h.timelineRef.current, timeline); assert.equal(h.buffersRef.current, buffers); assert.equal(h.state.url, url); assert.equal(h.state.prompt, "unapplied instruction"); assert.equal(h.storage.getItem(studioDeviceDraftKey(scope)), h.raw);
});
test("quota failure blocks the actual replacement before editor or active-slot mutation", () => {
  const h = harness(); h.storage.fail();
  assert.equal(h.functions.resetStudioDraft(buildCategoryDemo("tax_planning", "en")), false);
  assert.equal(h.state.mutations, 0); assert.equal(h.state.prompt, "unapplied instruction"); assert.equal(h.storage.getItem(studioDeviceDraftKey(scope)), h.raw); assert.equal(h.state.notices.length, 1);
});
test("stale chunk failure is silent and current failure remains retryable", async () => {
  const h = harness();
  const first = h.functions.openCategoryDemo("general_advisory"), second = h.functions.openCategoryDemo("tax_planning");
  h.loads[0].reject(new Error("old failure")); await first; assert.equal(h.state.phase, "loading");
  h.loads[1].reject(new Error("current failure")); await second; assert.equal(h.state.phase, "error"); assert.equal(h.state.notices.length, 0); assert.equal(h.state.mutations, 0);
});
test("two same-category copies have distinct identity and restore without saved authority", () => {
  const storage = memory(), draft = buildCategoryDemo("tax_planning", "en");
  retainStudioReplacement(storage, scope, { draft, prompt: "first" });
  retainStudioReplacement(storage, scope, { draft, prompt: "second" });
  const entries = readStudioArchive(storage, scope); assert.equal(entries.length, 2); assert.notEqual(entries[0].id, entries[1].id);
  const restored = restoreArchivedStudioDraft(entries[1]); assert.equal(restored.parent, null); assert.equal(restored.protection, undefined); assert.notEqual(restored.caseId, draft.caseId); assert.equal(entries[1].prompt, "second"); assert.deepEqual(readStudioArchive(storage, otherScope), []);
});
test("full archive never evicts the only copy of an unrelated draft", () => {
  const storage = memory(), draft = buildCategoryDemo("tax_planning", "en");
  for (let i = 0; i < STUDIO_ARCHIVE_LIMIT; i++) retainStudioReplacement(storage, scope, { draft, prompt: String(i) });
  const before = [...storage.records];
  assert.throws(() => retainStudioReplacement(storage, scope, { draft, prompt: "extra" }), /archive-full/); assert.deepEqual([...storage.records], before);
});

test("interleaved tab appends never overwrite a stale archive snapshot", () => {
  const storage = memory(), draft = buildCategoryDemo("tax_planning", "en");
  const originalSet = storage.setItem; let interleave = true;
  storage.setItem = (key, value) => {
    if (interleave) {
      interleave = false;
      retainStudioReplacement(storage, scope, { draft, prompt: "second tab" });
    }
    originalSet(key, value);
  };
  retainStudioReplacement(storage, scope, { draft, prompt: "first tab" });
  assert.deepEqual(readStudioArchive(storage, scope).map(entry => entry.prompt).sort(), ["first tab", "second tab"]);
  const entries = readStudioArchive(storage, scope);
  deleteArchivedStudioDraft(storage, scope, entries[0].id);
  assert.deepEqual(readStudioArchive(storage, scope).map(entry => entry.id), [entries[1].id]);
});

test("concurrent capacity reservation rolls back only this attempt and preserves the winning tab", () => {
  const storage = memory(), draft = buildCategoryDemo("tax_planning", "en");
  for (let index = 0; index < STUDIO_ARCHIVE_LIMIT - 1; index++) retainStudioReplacement(storage, scope, { draft, prompt: `old-${index}` });
  const original = [...storage.records], originalSet = storage.setItem; let interleave = true;
  storage.setItem = (key, value) => {
    if (interleave) {
      interleave = false;
      retainStudioReplacement(storage, scope, { draft, prompt: "winning tab" });
    }
    originalSet(key, value);
  };
  assert.throws(() => retainStudioReplacement(storage, scope, { draft, prompt: "capacity loser" }), /archive-full/);
  const entries = readStudioArchive(storage, scope);
  assert.equal(entries.length, STUDIO_ARCHIVE_LIMIT);
  assert.equal(entries.some(entry => entry.prompt === "capacity loser"), false);
  assert.equal(entries.some(entry => entry.prompt === "winning tab"), true);
  for (const [key, value] of original) assert.equal(storage.getItem(key), value);
});
for (const raw of ['{"format":"future-device","schemaVersion":999}', '{broken', JSON.stringify({ ...deviceDraftEnvelope(scope, buildCategoryDemo("tax_planning", "en")), schemaVersion: 999 }), JSON.stringify(deviceDraftEnvelope(scope, { ...buildCategoryDemo("tax_planning", "en"), protection: { kind: "future-protection" } } as unknown as StudioDraft))]) {
  test("unsupported/corrupt/protected raw active bytes refuse retention and survive unchanged", () => {
    const storage = memory(); storage.setItem(studioDeviceDraftV2Key(scope), raw);
    assert.throws(() => retainStudioReplacement(storage, scope, null)); assert.equal(storage.getItem(studioDeviceDraftV2Key(scope)), raw); assert.equal(storage.getItem(studioArchiveKey(scope)), null);
  });
}
test("future archive is neither overwritten nor purged by known-format cleanup", () => {
  const storage = memory(); const raw = JSON.stringify({ format: "genesis-juris-draft-archive", schemaVersion: 2, scope, entries: [] }); storage.setItem(studioArchiveKey(scope), raw);
  assert.throws(() => retainStudioReplacement(storage, scope, null)); assert.throws(() => purgeKnownStudioArchive(storage, scope)); assert.equal(storage.getItem(studioArchiveKey(scope)), raw);
});

test("recovery backup round-trip retains original bytes and prompt, without saved authority", () => {
  const storage = memory(), draft = buildCategoryDemo("tax_planning", "en");
  const original = JSON.stringify(deviceDraftEnvelope(scope, draft), null, 2);
  storage.setItem(studioDeviceDraftKey(scope), original);
  retainStudioReplacement(storage, scope, { draft, prompt: "unapplied recovery instruction" });
  const entry = readStudioArchive(storage, scope)[0];
  const raw = JSON.stringify({ format: "genesis-juris-archive-backup", schemaVersion: 1, entry });
  const read = readStudioArchiveBackup(raw, scope);
  assert.equal(read.original, original); assert.equal(read.prompt, entry.prompt);
  assert.equal(restoreArchivedStudioDraft(read).parent, null);
  assert.throws(() => readStudioArchiveBackup(raw, otherScope));
  assert.throws(() => readStudioArchiveBackup(raw.replace('"schemaVersion":1', '"schemaVersion":999'), scope));
  assert.throws(() => readStudioArchiveBackup('{broken', scope));
});
