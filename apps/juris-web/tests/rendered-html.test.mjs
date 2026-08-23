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
  const canonicalRuntimeName = assets.find((name) => /^canonical-runtime-.*\.js$/.test(name));
  const canonicalBundleName = assets.find((name) => /^canonical-case-bundle-.*\.js$/.test(name));
  const legacyName = assets.find((name) => /^legacy-scenarios-.*\.js$/.test(name));
  assert.ok(jurisAppName);
  assert.ok(scenariosName);
  assert.ok(canonicalRuntimeName);
  assert.ok(canonicalBundleName);
  assert.ok(legacyName);

  const [jurisApp, canonicalBundle, manifestSource, jurisStats, scenarioStats, runtimeStats, bundleStats, legacyStats] = await Promise.all([
    readFile(new URL(jurisAppName, assetDirectory), "utf8"),
    readFile(new URL(canonicalBundleName, assetDirectory), "utf8"),
    readFile(new URL("../dist/client/.vite/manifest.json", import.meta.url), "utf8"),
    stat(new URL(jurisAppName, assetDirectory)),
    stat(new URL(scenariosName, assetDirectory)),
    stat(new URL(canonicalRuntimeName, assetDirectory)),
    stat(new URL(canonicalBundleName, assetDirectory)),
    stat(new URL(legacyName, assetDirectory)),
  ]);
  const manifest = JSON.parse(manifestSource);
  const entry = manifest["app/JurisApp.tsx"];
  assert.ok(entry);
  const runtimeMarker = "Asteron accepts Northbridge's without-prejudice EUR 64,500 payment";
  assert.ok(jurisStats.size < 300_000, `Initial JurisApp chunk grew to ${jurisStats.size} bytes`);
  assert.ok(scenarioStats.size < 100_000, `Scenario adapter chunk grew to ${scenarioStats.size} bytes`);
  assert.ok(runtimeStats.size < 50_000, `Canonical reducer chunk grew to ${runtimeStats.size} bytes`);
  assert.ok(bundleStats.size > 300_000, "Canonical case bundle did not remain in its lazy data chunk");
  assert.ok(legacyStats.size < 20_000, `Legacy compatibility chunk grew to ${legacyStats.size} bytes`);
  assert.ok(entry.dynamicImports.includes("app/scenarios.ts"));
  assert.ok(entry.dynamicImports.includes("app/canonical-runtime.ts"));
  assert.equal(entry.imports.some((item) => item.includes("canonical") || item.includes("scenarios")), false);
  assert.equal(jurisApp.includes(runtimeMarker), false);
  assert.equal(canonicalBundle.includes(runtimeMarker), true);
});
