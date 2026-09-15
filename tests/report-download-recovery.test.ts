import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { pdfBlobFromDocument } from "../app/pdf-blob";
import { startReportDownload } from "../app/report-download";
import { hasLocalChunkRecovery, recoverFromStaleChunk, withLocalChunkRecovery } from "../app/stale-chunk-recovery";
import { reportGenerationErrorMessage } from "../app/report-generation-error";

test("optional report imports reject locally while global stale-chunk recovery is suspended", async () => {
  let reject!: (error: Error) => void;
  const error = new Error("Failed to fetch dynamically imported module: private-url");
  const pending = withLocalChunkRecovery(() => new Promise((_resolve, fail) => { reject = fail; }));
  assert.equal(hasLocalChunkRecovery(), true);
  reject(error); await assert.rejects(pending, value => value === error);
  assert.equal(hasLocalChunkRecovery(), false);
  const copy = reportGenerationErrorMessage(error, "en");
  assert.match(copy, /case is still open/); assert.doesNotMatch(copy, /private-url/);
  const values = new Map<string, string>(); let reloads = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  assert.equal(recoverFromStaleChunk(storage, () => { reloads++; }, error, 1000), true);
  assert.equal(reloads, 1, "normal boot recovery still works after optional report failure");
});

test("concurrent report imports retain local recovery until every import settles", async () => {
  let finishA!: () => void, finishB!: () => void;
  const a = withLocalChunkRecovery(() => new Promise<void>(resolve => { finishA = resolve; }));
  const b = withLocalChunkRecovery(() => new Promise<void>(resolve => { finishB = resolve; }));
  finishA(); await a; assert.equal(hasLocalChunkRecovery(), true);
  finishB(); await b; assert.equal(hasLocalChunkRecovery(), false);
});

test("a later font failure cannot reload Studio after another report import already failed", async () => {
  let rejectA!: (e: Error) => void, rejectB!: (e: Error) => void;
  const a = withLocalChunkRecovery(() => new Promise((_resolve, reject) => { rejectA = reject; }));
  const b = withLocalChunkRecovery(() => new Promise((_resolve, reject) => { rejectB = reject; }));
  const pending = Promise.all([a, b]);
  rejectA(new Error("Failed to fetch dynamically imported module")); await assert.rejects(pending);
  assert.equal(hasLocalChunkRecovery(), true);
  let reloads = 0;
  const inaccessibleStorage = { getItem() { throw new Error("Storage must not be touched"); }, setItem() {}, removeItem() {} };
  assert.equal(recoverFromStaleChunk(inaccessibleStorage, () => { reloads++; }, "vite:preloadError"), false);
  rejectB(new Error("Loading chunk font failed")); await assert.rejects(b);
  assert.equal(reloads, 0); assert.equal(hasLocalChunkRecovery(), false);
});

function streamFixture() {
  const stream = Object.assign(new EventEmitter(), { end() {} });
  const document = { getStream: () => stream } as unknown as Parameters<typeof pdfBlobFromDocument>[0];
  return { stream, promise: pdfBlobFromDocument(document) };
}

test("asynchronous PDF chunk conversion errors reject instead of escaping the report catch", async () => {
  const { stream, promise } = streamFixture();
  assert.doesNotThrow(() => stream.emit("data", Symbol("invalid stream chunk")));
  await assert.rejects(promise, TypeError);
  assert.doesNotThrow(() => { stream.emit("data", new Uint8Array([1])); stream.emit("end"); stream.emit("close"); });
});

test("asynchronous Blob construction failure rejects and premature close cannot resolve a PDF", async () => {
  const { stream, promise } = streamFixture();
  const original = globalThis.Blob;
  try {
    Object.defineProperty(globalThis, "Blob", { configurable: true, writable: true, value: class { constructor() { throw new Error("Blob allocation failed"); } } });
    stream.emit("data", new Uint8Array([1]));
    assert.doesNotThrow(() => stream.emit("end"));
    await assert.rejects(promise, /Blob allocation failed/);
  } finally { globalThis.Blob = original; }
  const closed = streamFixture(); closed.stream.emit("close");
  await assert.rejects(closed.promise, /closed before completion/);
});

test("PDF download keeps editor navigation separate and retains bytes until browser handoff", () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalRevoke = URL.revokeObjectURL;
  let revoked = 0, removed = 0, clicks = 0, failClick = false, release!: () => void;
  const link = { href: "", download: "", target: "", rel: "", remove() { removed++; }, click() { clicks++; if (failClick) throw new Error("Download blocked"); } };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => link, body: { appendChild() {} } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout(callback: () => void, delay: number) { assert.equal(delay, 60_000); release = callback; } } });
  URL.revokeObjectURL = url => { revoked++; originalRevoke(url); };
  try {
    startReportDownload(new Blob(["%PDF-controlled"], { type: "application/pdf" }), "case.pdf");
    assert.equal(link.download, "case.pdf"); assert.equal(link.target, "_blank"); assert.equal(link.rel, "noopener noreferrer");
    assert.equal(clicks, 1); assert.equal(removed, 1); assert.equal(revoked, 0); release(); assert.equal(revoked, 1);
    failClick = true;
    assert.throws(() => startReportDownload(new Blob(["test"]), "case.pdf"), /Download blocked/);
    assert.equal(revoked, 2); assert.equal(removed, 2);
  } finally {
    URL.revokeObjectURL = originalRevoke;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
  }
});
