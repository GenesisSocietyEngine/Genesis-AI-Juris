import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

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

function indexNames(db: DatabaseSync, table: string) {
  return new Set((db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}

test("v12 migration adds lookup indexes and durable play-session storage", () => {
  const db = migratedDatabase();

  assert.ok(indexNames(db, "cases").has("cases_status_title_idx"));
  assert.ok(indexNames(db, "case_feedback").has("case_feedback_user_created_idx"));
  assert.ok(indexNames(db, "update_reads").has("update_reads_user_update_idx"));
  assert.ok(indexNames(db, "case_drafts").has("case_drafts_custom_version_fingerprint_idx"));
  assert.ok(indexNames(db, "play_sessions").has("play_sessions_user_status_updated_idx"));
  assert.ok(indexNames(db, "play_sessions").has("play_sessions_case_version_idx"));
  assert.ok(indexNames(db, "play_events").has("play_events_session_event_uidx"));
  assert.ok(indexNames(db, "play_events").has("play_events_session_sequence_uidx"));
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("play events are ordered, idempotent and removed with their session", () => {
  const db = migratedDatabase();
  const session = db.prepare(`
    INSERT INTO play_sessions (session_key, user_email, case_id, case_version, case_fingerprint, state)
    VALUES ('session-1', 'lawyer@example.com', 'be_commercial_failed_erp_001', '1.1.0', 'sha256-test', '{"stage":"intake"}')
  `).run();
  const sessionId = Number(session.lastInsertRowid);
  db.prepare(`
    INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
    VALUES (?, 'event-1', 0, 'session_started', '{}', '2026-08-22T00:00:00.000Z')
  `).run(sessionId);

  assert.throws(() => db.prepare(`
    INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
    VALUES (?, 'event-1', 1, 'duplicate_retry', '{}', '2026-08-22T00:00:01.000Z')
  `).run(sessionId), /UNIQUE/);
  assert.throws(() => db.prepare(`
    INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
    VALUES (?, 'event-2', 0, 'sequence_collision', '{}', '2026-08-22T00:00:01.000Z')
  `).run(sessionId), /UNIQUE/);
  assert.throws(() => db.prepare(`
    INSERT INTO play_events (play_session_id, event_id, sequence, event_type, payload, occurred_at)
    VALUES (?, 'event-negative', -1, 'invalid', '{}', '2026-08-22T00:00:01.000Z')
  `).run(sessionId), /CHECK/);
  assert.throws(() => db.prepare("UPDATE play_sessions SET status = 'invented' WHERE id = ?").run(sessionId), /CHECK/);
  assert.throws(() => db.prepare("UPDATE play_sessions SET revision = -1 WHERE id = ?").run(sessionId), /CHECK/);

  db.prepare("DELETE FROM play_sessions WHERE id = ?").run(sessionId);
  assert.equal(db.prepare("SELECT count(*) AS count FROM play_events").get()?.count, 0);
});

test("a stale compare-and-swap cannot leave an envelope, draft or audit half-written", () => {
  const db = migratedDatabase();
  db.prepare("INSERT INTO users (email, display_name) VALUES ('owner@example.com', 'Owner')").run();
  const custom = db.prepare(`
    INSERT INTO custom_cases (owner_email, case_id, title, current_version, fingerprint)
    VALUES ('owner@example.com', 'atomic_case', 'Atomic case', '1.0.0', 'sha256-current')
  `).run();
  const customCaseId = Number(custom.lastInsertRowid);
  db.prepare(`
    INSERT INTO case_drafts (custom_case_id, user_email, case_id, version, fingerprint, title, payload)
    VALUES (?, 'owner@example.com', 'atomic_case', '1.0.0', 'sha256-current', 'Atomic case', '{}')
  `).run(customCaseId);

  assert.throws(() => {
    db.exec("BEGIN");
    try {
      db.prepare(`
        UPDATE case_drafts SET fingerprint = 'sha256-new'
        WHERE custom_case_id = ? AND fingerprint = 'sha256-stale'
          AND EXISTS (SELECT 1 FROM custom_cases WHERE id = ? AND fingerprint = 'sha256-stale')
      `).run(customCaseId, customCaseId);
      db.prepare(`
        UPDATE custom_cases SET fingerprint = 'sha256-new'
        WHERE id = ? AND fingerprint = 'sha256-stale'
          AND EXISTS (SELECT 1 FROM case_drafts WHERE custom_case_id = ? AND fingerprint = 'sha256-new')
      `).run(customCaseId, customCaseId);
      db.prepare(`
        INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail)
        VALUES ('owner@example.com', 'case_draft_saved', 'case_draft',
          (SELECT CAST(case_drafts.id AS TEXT) FROM case_drafts
           JOIN custom_cases ON custom_cases.id = case_drafts.custom_case_id
           WHERE case_drafts.fingerprint = 'sha256-new' AND custom_cases.fingerprint = 'sha256-new'), '{}')
      `).run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }, /NOT NULL/);

  assert.equal(db.prepare("SELECT fingerprint FROM custom_cases WHERE id = ?").get(customCaseId)?.fingerprint, "sha256-current");
  assert.equal(db.prepare("SELECT fingerprint FROM case_drafts WHERE custom_case_id = ?").get(customCaseId)?.fingerprint, "sha256-current");
  assert.equal(db.prepare("SELECT count(*) AS count FROM audit_events WHERE event_type = 'case_draft_saved'").get()?.count, 0);
});

test("submission API declares the optimistic-concurrency client contract", () => {
  const source = readFileSync(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8");
  assert.match(source, /payload\.expectedFingerprint/);
  assert.match(source, /payload\.baseFingerprint/);
  assert.match(source, /code:\s*"stale_draft"/);
  assert.match(source, /await db\.batch\(/);
  assert.match(source, /object_id is NOT NULL/);
  assert.match(source, /onConflictDoNothing\(\)/);
  assert.doesNotMatch(source, /await db\.insert\(auditEvents\)[\s\S]*\n\s*return privateJson/);
});
