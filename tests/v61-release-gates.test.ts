import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { recoverFromStaleChunk } from "../app/stale-chunk-recovery";

test("Studio keeps authentication recovery guarded and confirms exact save receipts", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /parsePendingWorkspaceSave|shareDraftRef/);
  assert.match(source, /createStudioAuthContinuation/);
  assert.match(source, /verifiedStudioSaveReceipt/);
  assert.match(source, /savedStudioPath/);
  assert.match(source, /Continue to Account/);
  assert.match(source, /Retry save/);
  assert.doesNotMatch(source, /saved changes? in this session/);
});

test("a stale dynamic chunk reloads once and then fails visibly without a loop", () => {
  const values = new Map<string, string>();
  let reloads = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) };
  assert.equal(recoverFromStaleChunk(storage, () => { reloads += 1; }, new Error("ChunkLoadError: Loading chunk 42 failed"), 1_000), true);
  assert.equal(reloads, 1);
  assert.equal(recoverFromStaleChunk(storage, () => { reloads += 1; }, new Error("Failed to fetch dynamically imported module"), 2_000), false);
  assert.equal(reloads, 1);
  assert.equal(recoverFromStaleChunk(storage, () => { reloads += 1; }, new Error("ordinary validation error"), 3_000), false);
});

test("anonymous PDF authoring remains local and does not call an authenticated API", () => {
  const dialog = readFileSync(new URL("../app/CaseReportDialog.tsx", import.meta.url), "utf8");
  const report = readFileSync(new URL("../app/case-report.ts", import.meta.url), "utf8");
  assert.doesNotMatch(dialog, /fetch\(/);
  const download = readFileSync(new URL("../app/report-download.ts", import.meta.url), "utf8");
  assert.match(report, /startReportDownload\(blob/);
  assert.match(download, /URL\.createObjectURL\(blob\)/);
  assert.doesNotMatch(report, /\/api\//);
});
