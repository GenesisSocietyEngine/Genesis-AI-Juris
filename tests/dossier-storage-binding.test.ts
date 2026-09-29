import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dossier document bytes use one logical private R2 binding while D1 remains metadata-only", () => {
  const hosting = JSON.parse(readFileSync(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "DOSSIER_DOCUMENTS");
  assert.match(worker, /DOSSIER_DOCUMENTS:\s*R2Bucket/u);
  assert.doesNotMatch(JSON.stringify(hosting), /https?:|bucket|secret|token|credential/iu);
});
