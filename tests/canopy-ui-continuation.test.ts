import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage, CANOPY_SCENARIOS, CANOPY_SOURCES, CANOPY_TITLE, CANOPY_UNAVAILABLE, canopySourceText } from "../app/canopy-fixture";
import type { Session } from "../app/canopy-workflow";
import { canopyRunStatus, canopyWorkingCopyPath, loadCanopyCopies, readCanopyLocation } from "../app/canopy/canopy-client-state";
import { canopyScenarioCopy } from "../app/canopy/canopy-ui-copy";
import { workspaceDestination } from "../app/workspace-navigation";

const at = (path: string) => new URL(path, "https://example.test");

test("opening a different copy retains organization/language without inheriting the previous case or run", () => {
  const original = "/canopy?organization=org-a&lang=ru&dossier=case-a&scenario=upside&run=run-a";
  const target = at(workspaceDestination("/matters?dossier=case-b", original));
  assert.equal(target.searchParams.get("dossier"), "case-b");
  assert.equal(target.searchParams.get("organization"), "org-a");
  assert.equal(target.searchParams.get("lang"), "ru");
  const canopy = at(workspaceDestination("/canopy?dossier=case-b", original));
  assert.equal(canopy.searchParams.get("dossier"), "case-b");
  assert.equal(canopy.searchParams.has("scenario"), false);
  assert.equal(canopy.searchParams.has("run"), false);
  const org = at(workspaceDestination("/canopy?organization=org-b", original));
  assert.equal(org.searchParams.get("organization"), "org-b");
  assert.equal(org.searchParams.has("dossier"), false);
  assert.equal(org.searchParams.has("run"), false);
  const switched = at(workspaceDestination("/canopy?scenario=base", original));
  assert.equal(switched.searchParams.get("scenario"), "base");
  assert.equal(switched.searchParams.has("run"), false);
  const oldReturn = "/studio?organization=org-b&return_to=" + encodeURIComponent(original);
  const returnFromDifferentOrganization = at(workspaceDestination("/matters", oldReturn));
  assert.equal(returnFromDifferentOrganization.searchParams.get("organization"), "org-b");
  assert.equal(returnFromDifferentOrganization.searchParams.has("dossier"), false);
});

test("saved copy URLs restore correctly on back/forward and discard obsolete run and return hints on a copy change", () => {
  const first = "/canopy?organization=org-a&lang=ru&dossier=case-a&scenario=base&run=run-a";
  const second = canopyWorkingCopyPath(first + "&return_to=%2Faccount#old", "case-b", "downside");
  assert.deepEqual(readCanopyLocation(first), { id: "case-a", scenario: "base" });
  assert.deepEqual(readCanopyLocation(second), { id: "case-b", scenario: "downside" });
  assert.deepEqual(readCanopyLocation(first), { id: "case-a", scenario: "base" });
  assert.equal(at(second).searchParams.has("run"), false);
  assert.equal(at(second).searchParams.has("return_to"), false);
  assert.equal(at(second).searchParams.get("lang"), "ru");
  assert.equal(at(second).searchParams.get("organization"), "org-a");
  assert.equal(at(second).hash, "");
  assert.equal(at(canopyWorkingCopyPath(second, "case-b", "downside", "run-b")).searchParams.get("run"), "run-b");
});

test("invalid locations cannot select a copy; unknown scenarios fall back to server-resolved Base", () => {
  for (const path of ["/canopy", "/studio?dossier=case-a", "https://other.test/canopy?dossier=case-a", "/canopy?dossier=bad%2Fid", "/canopy?dossier=bad%20id"]) assert.equal(readCanopyLocation(path), null);
  assert.deepEqual(readCanopyLocation("/canopy?dossier=case-a&scenario=unknown"), { id: "case-a", scenario: "base" });
  assert.deepEqual(readCanopyLocation("/canopy?dossier=case-a&scenario=hard_stop_unavailable"), { id: "case-a", scenario: "hard_stop_unavailable" });
});

test("saved copies search on the server before pagination and never writes", async () => {
  const controller = new AbortController();
  const result = await loadCanopyCopies(async (path, init) => {
    assert.equal(at(path).searchParams.get("q"), CANOPY_TITLE);
    assert.equal(at(path).searchParams.get("limit"), "25");
    assert.equal(init?.signal, controller.signal);
    assert.equal(init?.method ?? "GET", "GET");
    assert.equal(init?.body, undefined);
    return Response.json({ dossiers: [{ dossier_id: "case-a", title: CANOPY_TITLE, updated_at: "2026-09-11" }, { dossier_id: "other", title: "Unrelated", updated_at: "2026-09-11" }] });
  }, controller.signal);
  assert.deepEqual(result.map(item => item.dossier_id), ["case-a"]);
});

test("list authorization, network and malformed-response errors cannot become a misleading empty state", async () => {
  for (const status of [401, 403, 500, 503]) await assert.rejects(loadCanopyCopies(async () => Response.json({ error: "Unavailable" }, { status })), new RegExp(String(status)));
  await assert.rejects(loadCanopyCopies(async () => { throw new TypeError("Network unavailable"); }), /Network unavailable/);
  await assert.rejects(loadCanopyCopies(async () => Response.json({})), /invalid/);
  assert.deepEqual(await loadCanopyCopies(async () => Response.json({ dossiers: [] })), []);
});

function completedSession(prepared: ReturnType<typeof buildCanopyPackage>): Session {
  return { sessionKey: "run-a", caseId: prepared.scenario.caseId, version: prepared.scenario.version, fingerprint: prepared.scenario.fingerprint,
    status: "completed", revision: 9, startedAt: "2026-09-11T10:00:00Z", completedAt: "2026-09-11T10:02:00Z",
    state: { currentStageId: "studio-" + prepared.declaration.terminal, metrics: {} as Session["state"]["metrics"], actionUseCounts: {}, clockMinute: 540, outcome: null, decisions: [] } };
}

test("actual outcome display requires the exact package and a completed terminal server state", () => {
  for (const declaration of [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE]) {
    const prepared = buildCanopyPackage(declaration.id);
    const session = completedSession(prepared);
    assert.equal(canopyRunStatus(null, prepared), "none");
    assert.equal(canopyRunStatus(session, prepared), "completed");
    for (const changed of [{ caseId: "another_case" }, { version: "999.0.0" }, { fingerprint: "different" }, { status: "active" }, { completedAt: null }, { completedAt: "invalid" }]) {
      assert.equal(canopyRunStatus({ ...session, ...changed }, prepared), "mismatch");
    }
    assert.equal(canopyRunStatus({ ...session, state: { ...session.state, currentStageId: "not-in-this-graph" } }, prepared), "mismatch");
    const nonterminal = prepared.scenario.stages.find(stage => !stage.terminal)!;
    assert.equal(canopyRunStatus({ ...session, state: { ...session.state, currentStageId: nonterminal.id } }, prepared), "mismatch");
    assert.equal(canopyRunStatus({ ...session, status: "active", completedAt: null, state: { ...session.state, currentStageId: nonterminal.id } }, prepared), "active");
  }
});

test("an unexpected terminal result stays visible as unexpected instead of receiving the expected recommendation", () => {
  const prepared = buildCanopyPackage("base");
  const differentTerminal = prepared.scenario.stages.find(stage => stage.terminal && stage.id !== "studio-" + prepared.declaration.terminal)!;
  assert.ok(differentTerminal);
  const session = completedSession(prepared);
  assert.equal(canopyRunStatus({ ...session, state: { ...session.state, currentStageId: differentTerminal.id } }, prepared), "unexpected");
});

test("switching presentation language preserves every immutable source and scenario fingerprint", () => {
  const sourcesBefore = CANOPY_SOURCES.map(canopySourceText);
  const before = [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE].map(declaration => buildCanopyPackage(declaration.id));
  for (const item of before) {
    const ru = canopyScenarioCopy(item.declaration.id, "ru");
    const en = canopyScenarioCopy(item.declaration.id, "en");
    assert.notEqual(ru.recommendation, en.recommendation);
    assert.equal(en.recommendation, item.declaration.recommendation);
    const after = buildCanopyPackage(item.declaration.id);
    assert.equal(after.studioFingerprint, item.studioFingerprint);
    assert.equal(after.scenario.fingerprint, item.scenario.fingerprint);
  }
  assert.deepEqual(CANOPY_SOURCES.map(canopySourceText), sourcesBefore);
  assert.equal(buildCanopyPackage("base").scenario.fingerprint, "sha256-4c17139f6cf47399349aeaf27a473bbcb1429e7d6a9cc3eb0766e12ab290b31b");
});
