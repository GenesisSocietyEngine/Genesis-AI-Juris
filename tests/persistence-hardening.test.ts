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

test("admin mutations and their audit events commit or roll back together", () => {
  const db = migratedDatabase();
  db.prepare("INSERT INTO users (email, display_name) VALUES ('target@example.com', 'Target user')").run();
  const draftId = Number(db.prepare(`
    INSERT INTO case_drafts (user_email, case_id, version, fingerprint, title, payload, status)
    VALUES ('target@example.com', 'admin_atomic_case', '1.0.0', 'sha256-admin', 'Admin atomic case', '{}', 'submitted')
  `).run().lastInsertRowid);
  const feedbackId = Number(db.prepare(`
    INSERT INTO case_feedback (case_id, case_version, user_email, source, category, rating, comment)
    VALUES ('admin_atomic_case', '1.0.0', 'target@example.com', 'playable', 'technical', 4, 'Atomic moderation feedback')
  `).run().lastInsertRowid);
  const at = "2026-08-23T13:00:00.000Z";

  function guarded(update: () => void, audit: () => void) {
    db.exec("BEGIN");
    try {
      update();
      audit();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  guarded(
    () => { db.prepare("UPDATE case_drafts SET status = 'accepted', reviewer_email = 'admin@example.com', reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'submitted' RETURNING id, status").all(at, at, draftId); },
    () => { db.prepare("INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail) VALUES ('admin@example.com', 'case_submission_reviewed', 'case_draft', (SELECT CAST(id AS TEXT) FROM case_drafts WHERE changes() = 1 AND id = ? AND status = 'accepted' AND reviewed_at = ?), '{}')").run(draftId, at); },
  );
  guarded(
    () => { db.prepare("UPDATE case_feedback SET status = 'resolved', moderator_note = 'Resolved atomically', resolved_at = ? WHERE id = ? RETURNING id, status").all(at, feedbackId); },
    () => { db.prepare("INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail) VALUES ('admin@example.com', 'feedback_moderated', 'case_feedback', (SELECT CAST(id AS TEXT) FROM case_feedback WHERE changes() = 1 AND id = ? AND status = 'resolved'), '{}')").run(feedbackId); },
  );
  guarded(
    () => { db.prepare("UPDATE users SET license_tier = 'professional', updated_at = ? WHERE email = 'target@example.com' RETURNING email, license_tier").all(at); },
    () => { db.prepare("INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail) VALUES ('admin@example.com', 'user_license_changed', 'user', (SELECT email FROM users WHERE changes() = 1 AND email = 'target@example.com' AND license_tier = 'professional' AND updated_at = ?), '{}')").run(at); },
  );

  assert.equal(db.prepare("SELECT count(*) AS count FROM audit_events WHERE actor_email = 'admin@example.com'").get()?.count, 3);
  assert.equal(db.prepare("SELECT status FROM case_drafts WHERE id = ?").get(draftId)?.status, "accepted");
  assert.equal(db.prepare("SELECT status FROM case_feedback WHERE id = ?").get(feedbackId)?.status, "resolved");
  assert.equal(db.prepare("SELECT license_tier FROM users WHERE email = 'target@example.com'").get()?.license_tier, "professional");

  assert.throws(() => guarded(
    () => { db.prepare("UPDATE case_drafts SET status = 'rejected' WHERE id = ? AND status = 'submitted'").run(draftId); },
    () => { db.prepare("INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail) VALUES ('admin@example.com', 'case_submission_reviewed', 'case_draft', (SELECT CAST(id AS TEXT) FROM case_drafts WHERE changes() = 1 AND id = ? AND status = 'rejected'), '{}')").run(draftId); },
  ), /NOT NULL/);
  assert.equal(db.prepare("SELECT status FROM case_drafts WHERE id = ?").get(draftId)?.status, "accepted");
  assert.equal(db.prepare("SELECT count(*) AS count FROM audit_events WHERE actor_email = 'admin@example.com'").get()?.count, 3);
});

test("admin mutation routes use a changed-row audit guard inside one D1 batch", () => {
  for (const path of [
    "../app/api/admin/submissions/route.ts",
    "../app/api/admin/feedback/route.ts",
    "../app/api/admin/users/route.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /await db\.batch\(\[/);
    assert.match(source, /WHERE changes\(\) = 1/);
    assert.match(source, /objectId: auditedObjectId/);
    assert.doesNotMatch(source, /await db\.insert\(auditEvents\)/);
  }

  for (const path of [
    "../app/api/admin/submissions/route.ts",
    "../app/api/admin/feedback/route.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /const remainsCentrallyVisible =/);
    assert.match(source, /EXISTS \(/);
    assert.match(source, /customCases\.isPrivate} = false/);
    assert.match(source, /\.where\(and\([^;]+remainsCentrallyVisible\)\)/);
  }
});

test("admin update guards reject a custom case that turns private after the visibility read", () => {
  const db = migratedDatabase();
  db.prepare("INSERT INTO users (email, display_name) VALUES ('owner@example.com', 'Owner')").run();
  const customCaseId = Number(db.prepare(`
    INSERT INTO custom_cases (owner_email, case_id, title, current_version, fingerprint)
    VALUES ('owner@example.com', 'privacy_race_case', 'Privacy race case', '1.0.0', 'sha256-private-race')
  `).run().lastInsertRowid);
  const draftId = Number(db.prepare(`
    INSERT INTO case_drafts (custom_case_id, user_email, case_id, version, fingerprint, title, payload, status)
    VALUES (?, 'owner@example.com', 'privacy_race_case', '1.0.0', 'sha256-private-race', 'Privacy race case', '{}', 'submitted')
  `).run(customCaseId).lastInsertRowid);
  const feedbackId = Number(db.prepare(`
    INSERT INTO case_feedback (custom_case_id, case_id, case_version, user_email, source, category, rating, comment, audience)
    VALUES (?, 'privacy_race_case', '1.0.0', 'owner@example.com', 'studio', 'technical', 4, 'Central review before privacy flip', 'central')
  `).run(customCaseId).lastInsertRowid);

  assert.equal(db.prepare("SELECT count(*) AS count FROM case_drafts JOIN custom_cases ON custom_cases.id = case_drafts.custom_case_id WHERE case_drafts.id = ? AND custom_cases.is_private = false").get(draftId)?.count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM case_feedback JOIN custom_cases ON custom_cases.id = case_feedback.custom_case_id WHERE case_feedback.id = ? AND custom_cases.is_private = false AND case_feedback.audience != 'owner_private'").get(feedbackId)?.count, 1);

  // This occurs after the route's visibility precheck but before its batch.
  db.prepare("UPDATE custom_cases SET is_private = true WHERE id = ?").run(customCaseId);

  function guarded(update: () => void, audit: () => void) {
    db.exec("BEGIN");
    try {
      update();
      audit();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  assert.throws(() => guarded(
    () => { db.prepare(`
      UPDATE case_drafts
      SET status = 'accepted', reviewer_email = 'admin@example.com', reviewed_at = '2026-08-23T14:00:00.000Z'
      WHERE id = ? AND status = 'submitted'
        AND (custom_case_id IS NULL OR EXISTS (
          SELECT 1 FROM custom_cases
          WHERE custom_cases.id = case_drafts.custom_case_id AND custom_cases.is_private = false
        ))
      RETURNING id, status
    `).all(draftId); },
    () => { db.prepare("INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail) VALUES ('admin@example.com', 'case_submission_reviewed', 'case_draft', (SELECT CAST(id AS TEXT) FROM case_drafts WHERE changes() = 1 AND id = ? AND status = 'accepted'), '{}')").run(draftId); },
  ), /NOT NULL/);

  assert.throws(() => guarded(
    () => { db.prepare(`
      UPDATE case_feedback
      SET status = 'resolved', moderator_note = 'Should not persist'
      WHERE id = ?
        AND (custom_case_id IS NULL OR (
          audience != 'owner_private' AND EXISTS (
            SELECT 1 FROM custom_cases
            WHERE custom_cases.id = case_feedback.custom_case_id AND custom_cases.is_private = false
          )
        ))
      RETURNING id, status
    `).all(feedbackId); },
    () => { db.prepare("INSERT INTO audit_events (actor_email, event_type, object_type, object_id, detail) VALUES ('admin@example.com', 'feedback_moderated', 'case_feedback', (SELECT CAST(id AS TEXT) FROM case_feedback WHERE changes() = 1 AND id = ? AND status = 'resolved'), '{}')").run(feedbackId); },
  ), /NOT NULL/);

  assert.equal(db.prepare("SELECT status FROM case_drafts WHERE id = ?").get(draftId)?.status, "submitted");
  assert.equal(db.prepare("SELECT status FROM case_feedback WHERE id = ?").get(feedbackId)?.status, "new");
  assert.equal(db.prepare("SELECT count(*) AS count FROM audit_events WHERE actor_email = 'admin@example.com'").get()?.count, 0);
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
