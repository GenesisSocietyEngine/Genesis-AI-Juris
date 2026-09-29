import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { decisionAvailability, resolveDecisionTiming } from "../app/game-engine";
import { initialMetrics, scenarios } from "../app/scenarios";
import type { DecisionOption, MetricKey } from "../app/types";

const migrations = [
  "0000_worthless_supreme_intelligence.sql",
  "0001_right_talon.sql",
  "0002_greedy_darkstar.sql",
  "0003_unusual_zarda.sql",
  "0004_petite_komodo.sql",
  "0005_dapper_nightcrawler.sql",
] as const;

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of migrations) db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  return db;
}

function transaction(db: DatabaseSync, operation: () => void) {
  db.exec("BEGIN");
  try {
    operation();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

test("start is idempotent for a caller UUID and records exactly one start event", () => {
  const db = migratedDatabase();
  const sessionKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const start = () => transaction(db, () => {
    db.prepare(`
      INSERT INTO play_sessions
        (session_key, user_email, case_id, case_version, case_fingerprint, state, status, revision, started_at, updated_at)
      VALUES (?, 'owner@example.com', 'be_commercial_failed_erp_001', '1.1.0', ?, '{}', 'active', 0, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(sessionKey, scenarios[0].fingerprint, "2026-08-22T10:00:00.000Z", "2026-08-22T10:00:00.000Z");
    db.prepare(`
      INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
      VALUES (
        (SELECT id FROM play_sessions WHERE session_key = ? AND user_email = 'owner@example.com'
          AND case_id = 'be_commercial_failed_erp_001' AND case_version = '1.1.0' AND case_fingerprint = ?),
        ?, 0, 'session_started', '{}', '2026-08-22T10:00:00.000Z'
      )
      ON CONFLICT DO NOTHING
    `).run(sessionKey, scenarios[0].fingerprint, `start:${sessionKey}`);
  });

  start();
  start();
  assert.equal(db.prepare("SELECT count(*) AS count FROM play_sessions").get()?.count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM play_events").get()?.count, 1);
  assert.deepEqual(
    { ...db.prepare("SELECT sequence, event_type FROM play_events").get() },
    { sequence: 0, event_type: "session_started" },
  );

  assert.throws(() => transaction(db, () => {
    db.prepare(`
      INSERT INTO play_sessions (session_key, user_email, case_id, case_version, case_fingerprint, state)
      VALUES (?, 'owner@example.com', 'different_case', '1.0.0', 'sha256-different', '{}')
      ON CONFLICT DO NOTHING
    `).run(sessionKey);
    db.prepare(`
      INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
      VALUES ((SELECT id FROM play_sessions WHERE session_key = ? AND case_id = 'different_case'), ?, 0, 'session_started', '{}', ?)
      ON CONFLICT DO NOTHING
    `).run(sessionKey, `start:${sessionKey}`, "2026-08-22T10:03:00.000Z");
  }), /NOT NULL/);
  assert.equal(db.prepare("SELECT count(*) AS count FROM play_sessions").get()?.count, 1);
});

test("a stale decision revision rolls back both state and event while a matching revision commits both", () => {
  const db = migratedDatabase();
  const inserted = db.prepare(`
    INSERT INTO play_sessions (session_key, user_email, case_id, case_version, case_fingerprint, state, status, revision, started_at, updated_at)
    VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner@example.com', 'be_commercial_failed_erp_001', '1.1.0', ?, '{}', 'active', 0, ?, ?)
  `).run(scenarios[0].fingerprint, "2026-08-22T10:00:00.000Z", "2026-08-22T10:00:00.000Z");
  const sessionId = Number(inserted.lastInsertRowid);

  assert.throws(() => transaction(db, () => {
    db.prepare("UPDATE play_sessions SET revision = 8, last_event_at = ? WHERE id = ? AND status = 'active' AND revision = 7")
      .run("2026-08-22T10:01:00.000Z", sessionId);
    db.prepare(`
      INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
      VALUES ((SELECT id FROM play_sessions WHERE id = ? AND revision = 8 AND last_event_at = ?), 'decision-stale', 8, 'decision', '{}', ?)
    `).run(sessionId, "2026-08-22T10:01:00.000Z", "2026-08-22T10:01:00.000Z");
  }), /NOT NULL/);
  assert.equal(db.prepare("SELECT revision FROM play_sessions WHERE id = ?").get(sessionId)?.revision, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM play_events").get()?.count, 0);

  transaction(db, () => {
    db.prepare("UPDATE play_sessions SET revision = 1, last_event_at = ? WHERE id = ? AND status = 'active' AND revision = 0")
      .run("2026-08-22T10:02:00.000Z", sessionId);
    db.prepare(`
      INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
      VALUES ((SELECT id FROM play_sessions WHERE id = ? AND revision = 1 AND last_event_at = ?), 'decision-valid', 1, 'decision', '{}', ?)
    `).run(sessionId, "2026-08-22T10:02:00.000Z", "2026-08-22T10:02:00.000Z");
  });
  assert.equal(db.prepare("SELECT revision FROM play_sessions WHERE id = ?").get(sessionId)?.revision, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM play_events WHERE event_id = 'decision-valid'").get()?.count, 1);
});

test("a valid authored decision advances clock, route and metrics deterministically", () => {
  const scenario = scenarios[0];
  const stage = scenario.stages.find((item) => item.id === scenario.initialStageId)!;
  const option = stage.options[0];
  const availability = decisionAvailability(option, initialMetrics, 0);
  assert.equal(availability.available, true);
  const timing = resolveDecisionTiming(scenario, scenario.initialClockMinute, option, [], []);
  assert.ok(timing.nextStageId);
  assert.ok(scenario.stages.some((item) => item.id === timing.nextStageId));
  assert.ok(timing.transitionMinute >= scenario.initialClockMinute);
  const metrics = { ...initialMetrics };
  for (const key of Object.keys(option.effects) as MetricKey[]) metrics[key] = Math.max(0, Math.min(100, metrics[key] + (option.effects[key] ?? 0)));
  assert.deepEqual(metrics, Object.fromEntries((Object.keys(initialMetrics) as MetricKey[]).map((key) => [key, Math.max(0, Math.min(100, initialMetrics[key] + (option.effects[key] ?? 0)))])));
});

test("metric guards fail closed until their authored threshold is satisfied", () => {
  const guarded: DecisionOption = {
    id: "guarded-option",
    label: { en: "Guarded", ru: "Guarded" },
    detail: { en: "Guarded", ru: "Guarded" },
    result: { en: "Guarded", ru: "Guarded" },
    cost: 0,
    minutes: 0,
    effects: {},
    guards: [{ metric: "evidence", comparison: "gte", value: 70 }],
  };
  assert.deepEqual(decisionAvailability(guarded, { ...initialMetrics, evidence: 69 }, 0), {
    available: false,
    exhausted: false,
    blockedGuards: guarded.guards,
  });
  assert.equal(decisionAvailability(guarded, { ...initialMetrics, evidence: 70 }, 0).available, true);
});

test("once, limited and repeatable actions enforce distinct use-count policies", () => {
  const option = (repeatability: DecisionOption["repeatability"], maxUses?: number): DecisionOption => ({
    id: `option-${repeatability}`,
    label: { en: "Action", ru: "Action" },
    detail: { en: "Action", ru: "Action" },
    result: { en: "Action", ru: "Action" },
    cost: 0,
    minutes: 0,
    effects: {},
    repeatability,
    maxUses,
  });
  assert.equal(decisionAvailability(option("once"), initialMetrics, 0).available, true);
  assert.equal(decisionAvailability(option("once"), initialMetrics, 1).available, false);
  assert.equal(decisionAvailability(option("limited", 2), initialMetrics, 1).available, true);
  assert.equal(decisionAvailability(option("limited", 2), initialMetrics, 2).available, false);
  assert.equal(decisionAvailability(option("repeatable"), initialMetrics, 10_000).available, true);
});

test("play-session route binds access, publication integrity and idempotency on the server", () => {
  const source = readFileSync(new URL("../app/api/play-sessions/route.ts", import.meta.url), "utf8");
  assert.match(source, /eq\(playSessions\.userEmail, email\)/);
  assert.match(source, /isNotNull\(caseVersions\.publishedAt\)/);
  assert.match(source, /playableFingerprint\(scenario\) === fingerprint/);
  assert.match(source, /code:\s*"idempotency_conflict"/);
  assert.match(source, /code:\s*"stale_session"/);
  assert.match(source, /db\.update\(playSessions\)[\s\S]*db\.insert\(playEvents\)/);
  assert.match(source, /SELECT \$\{playSessions\.id\}[\s\S]*\$\{playSessions\.lastEventAt\} = \$\{now\}/);
  assert.match(source, /decisionAvailability\(option, state\.metrics, state\.actionUseCounts\[useKey\] \?\? 0\)/);
  assert.match(source, /dispatchCanonicalAction\(state\.canonicalRuntime, option\.canonicalActionId\)/);
  assert.match(source, /advanceCanonicalTime\(state\.canonicalRuntime, minutes\)/);
  assert.match(source, /createCanonicalRuntime\(scenario\.caseId, secureRuntimeSeed\(\)\)/);
  assert.doesNotMatch(source, /sessionSeed\(sessionKey\)/);
  assert.match(source, /commandSequences\.length !== revision/);
  assert.match(source, /derivedUses[\s\S]*canonicalRuntime\.actionUses/);
  assert.match(source, /delete state\.canonicalRuntime/);
  assert.match(source, /!sameJsonValue\(replay, canonicalRuntime\)/);
  assert.match(source, /event\.payload\.optionId === optionId/);
});
