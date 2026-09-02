import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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
  const clientDirectory = new URL("../dist/client/", import.meta.url);
  const manifestSource = await readFile(new URL(".vite/manifest.json", clientDirectory), "utf8");
  const manifest = JSON.parse(manifestSource);
  const entry = manifest["app/JurisApp.tsx"];
  const scenariosEntry = manifest["app/scenarios.ts"];
  const canonicalRuntimeEntry = manifest["app/canonical-runtime.ts"];
  const legacyEntry = manifest["app/legacy-scenarios.ts"];
  const canonicalBundleEntry = Object.values(manifest).find(
    (candidate) => candidate.name === "canonical-case-bundle",
  );
  for (const candidate of [entry, scenariosEntry, canonicalRuntimeEntry, canonicalBundleEntry, legacyEntry]) {
    assert.ok(candidate?.file?.endsWith(".js"));
    assert.equal(candidate.file.startsWith("../"), false);
  }

  const [jurisApp, canonicalBundle, jurisStats, scenarioStats, runtimeStats, bundleStats, legacyStats] = await Promise.all([
    readFile(new URL(entry.file, clientDirectory), "utf8"),
    readFile(new URL(canonicalBundleEntry.file, clientDirectory), "utf8"),
    stat(new URL(entry.file, clientDirectory)),
    stat(new URL(scenariosEntry.file, clientDirectory)),
    stat(new URL(canonicalRuntimeEntry.file, clientDirectory)),
    stat(new URL(canonicalBundleEntry.file, clientDirectory)),
    stat(new URL(legacyEntry.file, clientDirectory)),
  ]);
  assert.equal(JSON.parse(manifestSource)["app/JurisApp.tsx"].file, entry.file);
  const runtimeMarker = "Asteron accepts Northbridge's without-prejudice EUR 64,500 payment";
  assert.ok(jurisStats.size < 300_000, `Initial JurisApp chunk grew to ${jurisStats.size} bytes`);
  assert.ok(scenarioStats.size < 100_000, `Scenario adapter chunk grew to ${scenarioStats.size} bytes`);
  assert.ok(runtimeStats.size < 50_000, `Canonical reducer chunk grew to ${runtimeStats.size} bytes`);
  assert.ok(bundleStats.size > 300_000, "Canonical case bundle did not remain in its lazy data chunk");
  assert.ok(legacyStats.size < 20_000, `Legacy compatibility chunk grew to ${legacyStats.size} bytes`);
  assert.ok(entry.dynamicImports.includes("app/scenarios.ts"));
  assert.ok(entry.dynamicImports.includes("app/canonical-runtime.ts"));
  assert.ok(entry.dynamicImports.includes("app/HelpView.tsx"));
  assert.ok(entry.dynamicImports.includes("app/InboxPanel.tsx"));
  assert.equal(entry.imports.some((item) => item.includes("canonical") || item.includes("scenarios")), false);
  assert.equal(jurisApp.includes(runtimeMarker), false);
  assert.equal(canonicalBundle.includes(runtimeMarker), true);
});
