import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the GENESIS: JURIS product metadata and worker entry", async () => {
  const [layout, worker, hosting] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /GENESIS: JURIS CODEX/);
  assert.match(layout, /professional judgment/i);
  assert.match(worker, /\bfetch\b/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
