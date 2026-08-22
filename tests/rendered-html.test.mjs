import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
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

test("production build keeps the canonical scenario runtime out of the initial client chunk", async () => {
  const assetDirectory = new URL("../dist/client/assets/", import.meta.url);
  const assets = await readdir(assetDirectory);
  const jurisAppName = assets.find((name) => /^JurisApp-.*\.js$/.test(name));
  const scenariosName = assets.find((name) => /^scenarios-.*\.js$/.test(name));
  const legacyName = assets.find((name) => /^legacy-scenarios-.*\.js$/.test(name));
  assert.ok(jurisAppName);
  assert.ok(scenariosName);
  assert.ok(legacyName);

  const [jurisApp, scenarioChunk, jurisStats, scenarioStats, legacyStats] = await Promise.all([
    readFile(new URL(jurisAppName, assetDirectory), "utf8"),
    readFile(new URL(scenariosName, assetDirectory), "utf8"),
    stat(new URL(jurisAppName, assetDirectory)),
    stat(new URL(scenariosName, assetDirectory)),
    stat(new URL(legacyName, assetDirectory)),
  ]);
  const runtimeMarker = "An integrator converter defect was amplified by incomplete customer master data.";
  assert.ok(jurisStats.size < 300_000, `Initial JurisApp chunk grew to ${jurisStats.size} bytes`);
  assert.ok(scenarioStats.size > 300_000, "Canonical runtime did not remain in its lazy scenario chunk");
  assert.ok(legacyStats.size < 20_000, `Legacy compatibility chunk grew to ${legacyStats.size} bytes`);
  assert.doesNotMatch(jurisApp, new RegExp(runtimeMarker.replaceAll(".", "\\.")));
  assert.match(scenarioChunk, new RegExp(runtimeMarker.replaceAll(".", "\\.")));
});
