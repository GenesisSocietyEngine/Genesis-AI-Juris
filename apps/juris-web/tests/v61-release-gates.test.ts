import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { recoverFromStaleChunk } from "../app/stale-chunk-recovery";

test("Studio retries the exact save after authorization returns to the original tab", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(source, /PENDING_WORKSPACE_SAVE_KEY/);
  assert.match(source, /parsePendingWorkspaceSave/);
  assert.match(source, /window\.sessionStorage\.setItem\(PENDING_WORKSPACE_SAVE_KEY/);
  assert.match(source, /window\.location\.assign\(`\/signin-with-chatgpt/);
  assert.match(source, /auth_retry=1/);
  assert.match(source, /shareDraftRef\.current\(pending\.action, pending\)/);
  assert.doesNotMatch(source, /window\.open\("\/signin-with-chatgpt/);
  assert.match(source, /Continue sign-in/);
  assert.match(source, /Workspace draft and visibility saved\./);
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
  assert.match(report, /URL\.createObjectURL\(blob\)/);
  assert.doesNotMatch(report, /\/api\//);
});
