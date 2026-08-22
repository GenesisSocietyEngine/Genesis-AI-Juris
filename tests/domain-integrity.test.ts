import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { canonicalFingerprint, caseFingerprint, normalizeStudioDraft, studioStructuralIssues } from "../app/case-integrity";
import { resolveDecisionTiming, resolveLegacyDecisionTiming, stageClockMinute } from "../app/game-engine";
import { legacyScenarios } from "../app/legacy-scenarios";
import { normalizePlayableScenario, playableFingerprint } from "../app/playable-integrity";
import { isSameOriginMutation, readJsonObject } from "../app/request-security";
import { scenarios } from "../app/scenarios";
import type { StudioDraft } from "../app/types";

test("the five bundled manifests are immutable, playable and clock-monotonic across all paths", () => {
  assert.equal(scenarios.length, 5);
  assert.equal(new Set(scenarios.map((item) => item.caseId)).size, 5);
  let terminalPaths = 0;

  for (const scenario of scenarios) {
    const normalized = normalizePlayableScenario(structuredClone(scenario));
    assert.equal(playableFingerprint(normalized), scenario.fingerprint);
    assert.match(scenario.fingerprint, /^sha256-[a-f0-9]{64}$/);

    const walk = (stageId: string, minute: number, completed: string[], missed: string[], depth: number) => {
      assert.ok(depth <= scenario.stages.length, "scenario graph must terminate without a cycle");
      const stage = scenario.stages.find((item) => item.id === stageId);
      assert.ok(stage, `missing stage ${stageId}`);
      if (stage.terminal) { terminalPaths += 1; return; }
      assert.ok(stage.options.length > 0);
      for (const option of stage.options) {
        assert.ok(Object.values(option.effects).some((value) => value !== 0), `${option.id} must affect the outcome`);
        const timing = resolveDecisionTiming(scenario, minute, option, completed, missed);
        assert.ok(timing.transitionMinute >= minute);
        assert.ok(timing.nextStageId);
        const next = scenario.stages.find((item) => item.id === timing.nextStageId);
        assert.ok(next);
        assert.ok(timing.transitionMinute >= stageClockMinute(next));
        walk(next.id, timing.transitionMinute, timing.completedDeadlineIds, [...missed, ...timing.newlyMissedDeadlineIds], depth + 1);
      }
    };
    walk(scenario.initialStageId, scenario.initialClockMinute, [], [], 0);
  }
  assert.equal(terminalPaths, 44);
});

test("central playable validator rejects ambiguous clocks, action IDs, timing and deadline dead ends", () => {
  const invalidClock = structuredClone(scenarios[0]);
  invalidClock.stages[0].time = "25:00";
  assert.throws(() => normalizePlayableScenario(invalidClock), /clock/);

  const duplicateAction = structuredClone(scenarios[0]);
  duplicateAction.stages[1].options[0].id = duplicateAction.stages[0].options[0].id;
  assert.throws(() => normalizePlayableScenario(duplicateAction), /Duplicate action IDs/);

  const partialTiming = structuredClone(scenarios[0]);
  partialTiming.stages[0].options[0].completionDayOffset = 1;
  delete partialTiming.stages[0].options[0].completionMinuteOfDay;
  assert.throws(() => normalizePlayableScenario(partialTiming), /timing must be complete/);

  const stranded = structuredClone(scenarios[0]);
  stranded.stages.push({ id: "deadline_dead_end", day: 20, time: "10:00", phase: { en: "Dead end", ru: "Тупик" }, headline: { en: "Dead end", ru: "Тупик" }, brief: { en: "No path", ru: "Нет пути" }, source: { en: "Test", ru: "Тест" }, materialRefs: [], options: [], terminal: false });
  stranded.deadlines.push({ id: "forced_dead_end", title: { en: "Forced", ru: "Принудительно" }, dueAtMinute: 1, completionActions: [], missedNextStageId: "deadline_dead_end" });
  assert.throws(() => normalizePlayableScenario(stranded), /deadline route can strand/i);
});

test("legacy beta identities and timing remain available for old played-case exports", () => {
  assert.equal(legacyScenarios.length, 5);
  assert.ok(legacyScenarios.every((item) => /^[a-f0-9]{64}$/.test(item.fingerprint)));
  const scenario = structuredClone(scenarios[0]);
  const option = scenario.stages[0].options[0];
  scenario.deadlines = [{ id: "expired", title: { en: "Expired", ru: "Истёк" }, dueAtMinute: 0, completionActions: [option.id] }];
  const modern = resolveDecisionTiming(scenario, 0, option, [], []);
  const legacy = resolveLegacyDecisionTiming(scenario, 0, option, [], []);
  assert.deepEqual(modern.completedDeadlineIds, []);
  assert.deepEqual(legacy.completedDeadlineIds, ["expired"]);
});

test("Studio canonicalizes tax classifications and enforces server graph/publication gates", () => {
  const raw = taxDraft();
  raw.classification = { ...raw.classification!, domain: "general", practiceArea: "Transfer pricing", taxTopics: [], complianceOnly: false, legalAsOf: "2026-02-31", sourceUrls: [] };
  const unsafe = normalizeStudioDraft(raw);
  assert.equal(unsafe.classification?.domain, "tax");
  assert.equal(unsafe.classification?.complianceOnly, true);
  assert.equal(unsafe.classification?.legalAsOf, "");
  assert.ok(studioStructuralIssues(unsafe).includes("tax_publication_metadata_required"));

  const valid = normalizeStudioDraft(taxDraft());
  assert.deepEqual(studioStructuralIssues(valid), []);
  const fingerprint = caseFingerprint(valid);
  assert.match(fingerprint, /^sha256-[a-f0-9]{64}$/);
  assert.equal(caseFingerprint(structuredClone(valid)), fingerprint);
  assert.notEqual(caseFingerprint({ ...valid, jurisdiction: "Netherlands · EU" }), fingerprint);

  const disconnected = structuredClone(valid);
  disconnected.links = disconnected.links.filter((link) => link.to !== "outcome-2");
  assert.ok(studioStructuralIssues(disconnected).includes("disconnected_graph"));
  assert.ok(studioStructuralIssues(disconnected).includes("outcome_not_reachable_from_decision"));
  assert.equal(canonicalFingerprint({ b: 2, a: 1 }), "sha256-43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777");
});

test("request guards reject cross-origin, wrong media type and oversized JSON", async () => {
  const sameOrigin = new Request("https://juris.example/api/feedback", { method: "POST", headers: { origin: "https://juris.example", "content-type": "application/json" }, body: "{\"ok\":true}" });
  assert.equal(isSameOriginMutation(sameOrigin), true);
  assert.deepEqual(await readJsonObject(sameOrigin, 64), { ok: true });

  const crossOrigin = new Request("https://juris.example/api/feedback", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
  assert.equal(isSameOriginMutation(crossOrigin), false);
  const wrongType = new Request("https://juris.example/api/feedback", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(await readJsonObject(wrongType), null);
  const oversized = new Request("https://juris.example/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(200) }) });
  assert.equal(await readJsonObject(oversized, 32), null);
});

test("fresh D1 schema has valid seeds, immutable history and lineage collision protection", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of ["0000_worthless_supreme_intelligence.sql", "0001_right_talon.sql", "0002_greedy_darkstar.sql", "0003_unusual_zarda.sql", "0004_petite_komodo.sql"]) {
    db.exec(readFileSync(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));
  }
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("SELECT count(*) AS count FROM cases").get()?.count, 5);
  assert.equal(db.prepare("SELECT count(*) AS count FROM case_versions").get()?.count, 10);

  for (const scenario of scenarios) {
    const current = db.prepare("SELECT current_version AS version, fingerprint FROM cases WHERE id = ?").get(scenario.caseId) as { version: string; fingerprint: string };
    assert.equal(current.version, scenario.version);
    assert.equal(current.fingerprint, scenario.fingerprint);
  }
  for (const scenario of legacyScenarios) {
    assert.equal(db.prepare("SELECT count(*) AS count FROM case_versions WHERE case_id = ? AND version = ? AND fingerprint = ?").get(scenario.caseId, scenario.version, scenario.fingerprint)?.count, 1);
  }
  const defaults = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string; dflt_value: string }>;
  assert.equal(defaults.find((item) => item.name === "product_updates")?.dflt_value, "false");
  assert.equal(defaults.find((item) => item.name === "case_updates")?.dflt_value, "false");
  assert.equal(defaults.find((item) => item.name === "research_invites")?.dflt_value, "false");
  assert.equal(defaults.find((item) => item.name === "license_tier")?.dflt_value, "'community'");

  const insert = db.prepare("INSERT INTO case_versions (case_id,version,fingerprint,parent_case_id,parent_version,parent_fingerprint,change_summary,payload) VALUES (?,?,?,?,?,?,?,?)");
  insert.run(scenarios[0].caseId, "9.0.0", "test-a", scenarios[0].caseId, scenarios[0].version, scenarios[0].fingerprint, "test", "{}");
  assert.throws(() => insert.run(scenarios[0].caseId, "9.0.1", "test-b", scenarios[0].caseId, scenarios[0].version, scenarios[0].fingerprint, "test", "{}"), /UNIQUE/);
  assert.throws(() => insert.run(scenarios[0].caseId, "10.0.0", "test-root", null, null, null, "test", "{}"), /UNIQUE/);
});

test("critical API sources retain exact-version and review-evidence checks", () => {
  const feedback = readFileSync(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8");
  const publication = readFileSync(new URL("../app/api/admin/cases/route.ts", import.meta.url), "utf8");
  const catalogue = readFileSync(new URL("../app/api/catalog/[caseId]/route.ts", import.meta.url), "utf8");
  assert.match(feedback, /caseVersions\.version/);
  assert.match(feedback, /caseVersions\.fingerprint/);
  assert.match(catalogue, /requestedVersion/);
  assert.match(publication, /independent verified practitioner review/);
  assert.match(publication, /currently published version/);
  assert.match(publication, /toPublicStudioDraft\(draft\)/);
  assert.doesNotMatch(publication, /studioDraft:\s*draft\b/);
});

function taxDraft(): StudioDraft {
  return {
    caseId: "cross_border_tax_review",
    version: "1.0.0",
    parent: null,
    title: "Cross-border tax review",
    jurisdiction: "Belgium · EU",
    role: "International tax counsel",
    premise: "Compare a documented operating baseline with compliant alternatives.",
    classification: { domain: "tax", practiceArea: "International tax planning", difficulty: "Advanced", tags: ["tax"], taxTopics: ["Transfer pricing"], complianceOnly: true, purpose: "lawful_planning", legalAsOf: "2026-08-21", sourceUrls: ["https://www.oecd.org/en/topics/global-minimum-tax.html"] },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Proposal", detail: "", x: 10, y: 10 },
      { id: "actor-1", type: "actor", title: "Tax director", detail: "", x: 100, y: 10 },
      { id: "entity-1", type: "entity", title: "Operating company", detail: "", x: 200, y: 10 },
      { id: "cash-1", type: "cash_flow", title: "Royalty", detail: "", x: 300, y: 10 },
      { id: "rule-1", type: "tax_rule", title: "PPT and TP", detail: "", x: 400, y: 10 },
      { id: "evidence-1", type: "evidence", title: "Substance file", detail: "", x: 500, y: 10 },
      { id: "decision-1", type: "decision", title: "Select design", detail: "", x: 600, y: 10 },
      { id: "outcome-1", type: "outcome", title: "Defensible", detail: "", x: 700, y: 10 },
      { id: "outcome-2", type: "outcome", title: "No-go", detail: "", x: 700, y: 100 },
    ],
    links: [
      { id: "link-1", from: "trigger-1", to: "actor-1" }, { id: "link-2", from: "actor-1", to: "entity-1" }, { id: "link-3", from: "entity-1", to: "cash-1" },
      { id: "link-4", from: "cash-1", to: "rule-1" }, { id: "link-5", from: "rule-1", to: "evidence-1" }, { id: "link-6", from: "evidence-1", to: "decision-1" },
      { id: "link-7", from: "decision-1", to: "outcome-1" }, { id: "link-8", from: "decision-1", to: "outcome-2" },
    ],
    editHistory: [],
    updatedAt: "2026-08-21T00:00:00.000Z",
  };
}
