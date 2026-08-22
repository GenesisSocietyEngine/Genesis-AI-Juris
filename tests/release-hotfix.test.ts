import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveBundledManifest } from "../app/api/catalog/bundled-manifest";
import { bundledCataloguePresentation, mayUseBundledCatalogueFallback, playedCaseFallbackMode } from "../app/catalogue-fallback";
import { legacyScenarios } from "../app/legacy-scenarios";
import { resolvePlayedCaseScenario } from "../app/played-case-loader";
import { scenarios } from "../app/scenarios";
import {
  deviceDraftEnvelope,
  mayPersistStudioDraftOnDevice,
  studioDeviceDraftKey,
  studioDeviceScope,
  unwrapDeviceDraft,
} from "../app/studio-device-storage";
import type { StudioDraft } from "../app/types";

const localDraft: StudioDraft = {
  caseId: "local_case",
  version: "1.0.0",
  parent: null,
  title: "Local case",
  jurisdiction: "Test",
  role: "Counsel",
  premise: "Test premise",
  nodes: [],
  links: [],
  editHistory: [],
  updatedAt: "2026-08-22T00:00:00.000Z",
};

test("device drafts are identity-scoped and reject cross-account envelopes", async () => {
  const ownerScope = await studioDeviceScope(" Owner@Example.com ");
  const normalizedOwnerScope = await studioDeviceScope("owner@example.com");
  const otherScope = await studioDeviceScope("other@example.com");

  assert.ok(ownerScope);
  assert.ok(normalizedOwnerScope);
  assert.ok(otherScope);
  assert.match(ownerScope, /^[a-f0-9]{64}$/);
  assert.equal(ownerScope, normalizedOwnerScope);
  assert.notEqual(ownerScope, otherScope);
  assert.equal(await studioDeviceScope(null), null);
  assert.equal(studioDeviceDraftKey(ownerScope), `genesis-juris-device-draft-v1:${ownerScope}`);
  assert.throws(() => studioDeviceDraftKey("anonymous"), /scope/i);
  assert.throws(() => studioDeviceDraftKey("owner@example.com"), /scope/i);

  const envelope = deviceDraftEnvelope(ownerScope, localDraft);
  assert.deepEqual(unwrapDeviceDraft(envelope, ownerScope), localDraft);
  assert.equal(unwrapDeviceDraft(envelope, otherScope), null);
  assert.equal(unwrapDeviceDraft({ ...envelope, schemaVersion: 2 }, ownerScope), null);
});

test("only local, unprotected and non-private Studio drafts may use device storage", () => {
  assert.equal(mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: false, draft: localDraft }), true);
  assert.equal(mayPersistStudioDraftOnDevice({ canDuplicate: false, customCaseId: null, isPrivate: false, draft: localDraft }), false);
  assert.equal(mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: 7, isPrivate: false, draft: localDraft }), false);
  assert.equal(mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: true, draft: localDraft }), false);

  const protectedDraft: StudioDraft = {
    ...localDraft,
    protection: {
      kind: "case-protection-v1",
      copyProtected: true,
      copyPolicy: "lineage_locked",
      parentCode: null,
      currentCode: "code",
      seal: "seal",
    },
  };
  assert.equal(mayPersistStudioDraftOnDevice({ canDuplicate: true, customCaseId: null, isPrivate: false, draft: protectedDraft }), false);
});

test("catalogue pointers resolve to integrity-checked current and legacy manifests", () => {
  for (const scenario of [...scenarios, ...legacyScenarios]) {
    const resolved = resolveBundledManifest(
      { runtime: legacyScenarios.includes(scenario) ? "legacy-bundled" : "bundled", bundle: "canonical-case-bundle.json" },
      scenario.caseId,
      scenario.version,
      scenario.fingerprint,
    );
    assert.equal(resolved?.kind, "playable-scenario-v1");
    assert.deepEqual(resolved?.scenario, scenario);
  }

  assert.equal(resolveBundledManifest({ runtime: "bundled", bundle: "canonical-case-bundle.json" }, scenarios[0].caseId, scenarios[0].version, "sha256-tampered"), null);
  assert.equal(resolveBundledManifest({ runtime: "bundled", bundle: "canonical-case-bundle.json" }, legacyScenarios[0].caseId, legacyScenarios[0].version, legacyScenarios[0].fingerprint), null);
  assert.equal(resolveBundledManifest({ runtime: "legacy-bundled", bundle: "canonical-case-bundle.json" }, scenarios[0].caseId, scenarios[0].version, scenarios[0].fingerprint), null);
  assert.equal(resolveBundledManifest({ runtime: "external" }, scenarios[0].caseId, scenarios[0].version, scenarios[0].fingerprint), null);
  assert.equal(resolveBundledManifest({ kind: "playable-scenario-v1", scenario: { ...scenarios[0], title: { en: "Tampered", ru: "Изменено" } } }, scenarios[0].caseId, scenarios[0].version, scenarios[0].fingerprint), null);
  assert.equal(resolveBundledManifest({ kind: "playable-scenario-v1", scenario: scenarios[0] }, scenarios[0].caseId, scenarios[0].version, scenarios[0].fingerprint)?.kind, "playable-scenario-v1");
});

test("the client fetches one manifest before loading bundled compatibility fallbacks", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const playedCaseLoader = readFileSync(new URL("../app/played-case-loader.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^import\s+\{\s*scenarios\s*\}\s+from\s+["']\.\/scenarios["'];/m);
  assert.doesNotMatch(source, /^import\s+\{\s*legacyScenarios\s*\}\s+from\s+["']\.\/legacy-scenarios["'];/m);
  assert.match(source, /fetch\(`\/api\/catalog\/\$\{encodeURIComponent\(record\.id\)\}\?version=/);
  assert.match(source, /import\("\.\/scenarios"\)/);
  assert.match(playedCaseLoader, /import\("\.\/scenarios"\)/);
  assert.match(playedCaseLoader, /import\("\.\/legacy-scenarios"\)/);
  assert.equal(mayUseBundledCatalogueFallback(null), true);
  assert.equal(mayUseBundledCatalogueFallback(500), true);
  assert.equal(mayUseBundledCatalogueFallback(503), true);
  assert.equal(mayUseBundledCatalogueFallback(200), false);
  assert.equal(mayUseBundledCatalogueFallback(404), false);
  assert.equal(mayUseBundledCatalogueFallback(409), false);
  assert.equal(mayUseBundledCatalogueFallback(429), false);
  assert.equal(playedCaseFallbackMode(null), "bundled");
  assert.equal(playedCaseFallbackMode(503), "bundled");
  assert.equal(playedCaseFallbackMode(200), "legacy-only");
  assert.equal(playedCaseFallbackMode(404), "none");
});

test("played-case loading preserves legacy exports without bypassing server denials", async () => {
  for (const scenario of legacyScenarios) {
    const payload = resolveBundledManifest({ runtime: "legacy-bundled", bundle: "canonical-case-bundle.json" }, scenario.caseId, scenario.version, scenario.fingerprint);
    assert.ok(payload);
    const resolved = await resolvePlayedCaseScenario(
      { id: scenario.id, caseId: scenario.caseId, contentVersion: scenario.version, fingerprint: scenario.fingerprint },
      [],
      async () => Response.json({ fingerprint: scenario.fingerprint, payload }),
    );
    assert.deepEqual(resolved.scenario, scenario);
    assert.equal(resolved.legacyTiming, true);
  }

  const current = scenarios[0];
  const offline = await resolvePlayedCaseScenario(
    { id: current.id, caseId: current.caseId, contentVersion: current.version, fingerprint: current.fingerprint },
    [],
    async () => { throw new Error("offline"); },
  );
  assert.deepEqual(offline.scenario, current);
  assert.equal(offline.legacyTiming, false);

  for (const status of [404, 409]) {
    await assert.rejects(() => resolvePlayedCaseScenario(
      { id: current.id, caseId: current.caseId, contentVersion: current.version, fingerprint: current.fingerprint },
      [],
      async () => Response.json({ error: "denied" }, { status }),
    ), /unavailable/i);
  }

  await assert.rejects(() => resolvePlayedCaseScenario(
    { id: current.id, caseId: current.caseId, contentVersion: current.version, fingerprint: current.fingerprint },
    [],
    async () => Response.json({ fingerprint: current.fingerprint, payload: { kind: "playable-scenario-v1", scenario: { ...current, title: { en: "Tampered", ru: "Изменено" } } } }),
  ), /validation/i);
});

test("leaving a restricted Studio context cannot carry snapshots or history into a local draft", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const enterNewLocalDraft = source.slice(source.indexOf("function enterNewLocalDraft"), source.indexOf("function updateStudioDraft"));
  const generateDraft = source.slice(source.indexOf("function generateDraft"), source.indexOf("function applyPromptIteration"));
  const taxTemplate = source.slice(source.indexOf("function loadTaxTemplate"), source.indexOf("function deleteNode"));
  const resetDraft = source.slice(source.indexOf("function resetStudioDraft"), source.indexOf("function purgeLocalStudioState"));

  assert.match(enterNewLocalDraft, /delete isolated\.protection/);
  assert.match(enterNewLocalDraft, /isolated\.parent = null/);
  assert.match(enterNewLocalDraft, /replaceStudioDraft\(isolated\)/);
  assert.match(generateDraft, /editHistory: \[\]/);
  assert.match(generateDraft, /enterNewLocalDraft\(rebuilt/);
  assert.doesNotMatch(generateDraft, /draftRef\.current\.editHistory|commitStudioDraft/);
  assert.match(taxTemplate, /editHistory: \[\]/);
  assert.match(taxTemplate, /enterNewLocalDraft\(template/);
  assert.doesNotMatch(taxTemplate, /current\.editHistory|commitStudioDraft/);
  assert.match(resetDraft, /enterNewLocalDraft\(clean/);
  assert.doesNotMatch(resetDraft, /commitStudioDraft/);
});

test("compact catalogue metadata retains Russian presentation, urgency and dark-card contrast", () => {
  const entries = Object.values(bundledCataloguePresentation);
  assert.equal(entries.length, 5);
  assert.ok(entries.every((entry) => [entry.titleRu, entry.subtitleRu, entry.sectorRu, entry.summaryRu].every((value) => /[А-Яа-яЁё]/.test(value))));
  assert.deepEqual(entries.map((entry) => entry.urgency).sort(), ["critical", "critical", "elevated", "elevated", "standard"]);

  const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(appSource, /presentation\?\.titleRu/);
  assert.match(appSource, /presentation\?\.subtitleRu/);
  assert.match(appSource, /presentation\?\.sectorRu/);
  assert.match(appSource, /presentation\?\.summaryRu/);
  assert.match(appSource, /presentation\?\.urgency/);

  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.theme-office \.help-video-card \{ color: #edf0eb; --muted: #9eabb1; --cyan: #5bb8c4;/);
  for (const foreground of ["#edf0eb", "#9eabb1", "#5bb8c4", "#d2a85e"]) assert.ok(contrastRatio(foreground, "#09151d") >= 4.5);
});

test("late identity and catalogue responses cannot overwrite newer user intent", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  assert.match(source, /studioChangedBeforeRestoreRef\.current/);
  assert.match(source, /if \(studioChangedBeforeRestoreRef\.current\) return/);
  assert.match(source, /catalogueLaunchRef\.current = launchRequestVersion/);
  assert.ok((source.match(/launchRequestVersion !== catalogueLaunchRef\.current/g) ?? []).length >= 2);
  assert.match(source, /launchRequestVersion === catalogueLaunchRef\.current\) setCatalogueLoading\(false\)/);
});

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map((channel) => Number.parseInt(channel, 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const left = luminance(foreground);
  const right = luminance(background);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
