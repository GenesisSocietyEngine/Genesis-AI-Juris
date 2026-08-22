import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  canShareCustomCase,
  canViewCustomCase,
  customFeedbackAudience,
  normalizeEmail,
  normalizeLicenseTier,
} from "../app/custom-case-access";

const migrationNames = [
  "0000_worthless_supreme_intelligence.sql",
  "0001_right_talon.sql",
  "0002_greedy_darkstar.sql",
  "0003_unusual_zarda.sql",
  "0004_petite_komodo.sql",
] as const;

function migration(name: (typeof migrationNames)[number]) {
  return readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

function applyMigrations(db: DatabaseSync, names: readonly (typeof migrationNames)[number][] = migrationNames) {
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of names) db.exec(migration(name));
}

test("fresh schema applies custom-case migration with safe defaults and indexes", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);

  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  const tables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name),
  );
  assert.ok(tables.has("custom_cases"));
  assert.ok(tables.has("custom_case_grants"));

  const customColumns = db.prepare("PRAGMA table_info(custom_cases)").all() as Array<{ name: string; dflt_value: string | null }>;
  assert.equal(customColumns.find((column) => column.name === "is_private")?.dflt_value, "false");
  assert.equal(customColumns.find((column) => column.name === "status")?.dflt_value, "'custom'");

  const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string; dflt_value: string | null }>;
  assert.equal(userColumns.find((column) => column.name === "license_tier")?.dflt_value, "'community'");

  const draftColumns = new Set((db.prepare("PRAGMA table_info(case_drafts)").all() as Array<{ name: string }>).map((column) => column.name));
  assert.ok(draftColumns.has("custom_case_id"));
  const feedbackColumns = new Set((db.prepare("PRAGMA table_info(case_feedback)").all() as Array<{ name: string }>).map((column) => column.name));
  assert.ok(feedbackColumns.has("custom_case_id"));
  assert.ok(feedbackColumns.has("audience"));
  const versionColumns = new Set((db.prepare("PRAGMA table_info(case_versions)").all() as Array<{ name: string }>).map((column) => column.name));
  assert.ok(versionColumns.has("source_custom_case_id"));

  const indexes = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>).map((row) => row.name),
  );
  assert.ok(indexes.has("custom_cases_owner_case_uidx"));
  assert.ok(indexes.has("custom_cases_visibility_idx"));
  assert.ok(indexes.has("custom_case_grants_case_recipient_uidx"));
  assert.ok(indexes.has("custom_case_grants_recipient_idx"));
  assert.ok(indexes.has("case_drafts_custom_case_idx"));
  assert.ok(indexes.has("case_feedback_custom_case_idx"));
  assert.ok(indexes.has("case_versions_source_custom_case_idx"));

  const triggers = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as Array<{ name: string }>).map((row) => row.name),
  );
  assert.ok(triggers.has("custom_case_grants_block_private_insert"));
  assert.ok(triggers.has("custom_case_grants_block_private_update"));
  assert.ok(triggers.has("case_versions_block_private_custom_source"));
  assert.ok(triggers.has("case_versions_require_current_custom_source"));
  assert.ok(triggers.has("case_drafts_block_private_moderation"));
  assert.ok(triggers.has("case_drafts_block_private_submission_insert"));
  assert.ok(triggers.has("case_feedback_block_private_insert"));
  assert.ok(triggers.has("case_feedback_block_private_moderation"));

  const insertCase = db.prepare("INSERT INTO custom_cases (owner_email, case_id, title, current_version, fingerprint) VALUES (?, ?, ?, ?, ?)");
  const inserted = insertCase.run("owner@example.com", "case_one", "Case one", "1.0.0", "fingerprint-one");
  assert.throws(
    () => insertCase.run("owner@example.com", "case_one", "Duplicate", "1.0.1", "fingerprint-two"),
    /UNIQUE/,
  );
  const insertGrant = db.prepare("INSERT INTO custom_case_grants (custom_case_id, recipient_email, granted_by_email) VALUES (?, ?, ?)");
  insertGrant.run(Number(inserted.lastInsertRowid), "recipient@example.com", "owner@example.com");
  assert.throws(
    () => insertGrant.run(Number(inserted.lastInsertRowid), "recipient@example.com", "owner@example.com"),
    /UNIQUE/,
  );
  assert.throws(
    () => insertGrant.run(999_999, "nobody@example.com", "owner@example.com"),
    /FOREIGN KEY/,
  );
  db.prepare("UPDATE custom_cases SET is_private = true WHERE id = ?").run(Number(inserted.lastInsertRowid));
  assert.throws(
    () => insertGrant.run(Number(inserted.lastInsertRowid), "late-recipient@example.com", "owner@example.com"),
    /private custom case cannot be shared/,
  );
  assert.throws(
    () => db.prepare("UPDATE custom_case_grants SET can_reshare = true WHERE custom_case_id = ?").run(Number(inserted.lastInsertRowid)),
    /private custom case cannot be shared/,
  );
  assert.throws(
    () => db.prepare(`
      INSERT INTO case_versions
        (case_id, source_custom_case_id, version, fingerprint, parent_case_id, parent_version, parent_fingerprint, change_summary, payload)
      VALUES (?, ?, '98.0.0', 'private-source', ?, 'private-parent', 'private-parent-fingerprint', 'test', '{}')
    `).run("be_commercial_failed_erp_001", Number(inserted.lastInsertRowid), "be_commercial_failed_erp_001"),
    /private custom case cannot be published/,
  );
  db.prepare("UPDATE custom_cases SET is_private = false WHERE id = ?").run(Number(inserted.lastInsertRowid));
  const privateDraft = db.prepare(`
    INSERT INTO case_drafts
      (custom_case_id, user_email, case_id, version, fingerprint, title, payload, status)
    VALUES (?, 'owner@example.com', 'case_one', '1.0.0', 'fingerprint-one', 'Case one', '{}', 'submitted')
  `).run(Number(inserted.lastInsertRowid));
  db.prepare("UPDATE custom_cases SET is_private = true WHERE id = ?").run(Number(inserted.lastInsertRowid));
  assert.throws(
    () => db.prepare("UPDATE case_drafts SET status = 'accepted', reviewer_email = 'maxim@example.com' WHERE id = ?").run(Number(privateDraft.lastInsertRowid)),
    /private custom case cannot enter the review workflow/,
  );
  assert.throws(
    () => db.prepare(`
      INSERT INTO case_drafts
        (custom_case_id, user_email, case_id, version, fingerprint, title, payload, status)
      VALUES (?, 'owner@example.com', 'case_one', '1.1.0', 'fingerprint-two', 'Case one', '{}', 'submitted')
    `).run(Number(inserted.lastInsertRowid)),
    /private custom case cannot enter the review workflow/,
  );
  assert.throws(
    () => db.prepare(`
      INSERT INTO case_feedback
        (case_id, case_version, user_email, source, category, rating, comment, custom_case_id, audience)
      VALUES ('case_one', '1.0.0', 'owner@example.com', 'studio', 'realism', 5, 'Restricted queue feedback', ?, 'custom_case')
    `).run(Number(inserted.lastInsertRowid)),
    /private custom case feedback must remain owner-only/,
  );
  const privateFeedback = db.prepare(`
    INSERT INTO case_feedback
      (case_id, case_version, user_email, source, category, rating, comment, custom_case_id, audience, status)
    VALUES ('case_one', '1.0.0', 'owner@example.com', 'studio', 'realism', 5, 'Owner only private note', ?, 'owner_private', 'private_note')
  `).run(Number(inserted.lastInsertRowid));
  assert.throws(
    () => db.prepare("UPDATE case_feedback SET status = 'resolved', moderator_note = 'central review' WHERE id = ?").run(Number(privateFeedback.lastInsertRowid)),
    /private custom case feedback cannot be moderated centrally/,
  );
  db.prepare("UPDATE custom_cases SET is_private = false WHERE id = ?").run(Number(inserted.lastInsertRowid));
  assert.throws(
    () => db.prepare(`
      INSERT INTO case_versions
        (case_id, source_custom_case_id, version, fingerprint, studio_fingerprint, parent_case_id, parent_version, parent_fingerprint, change_summary, payload)
      VALUES (?, ?, '96.0.0', 'stale-public-snapshot', 'wrong-studio-source', ?, 'stale-parent', 'stale-parent-fingerprint', 'test', '{}')
    `).run("be_commercial_failed_erp_001", Number(inserted.lastInsertRowid), "be_commercial_failed_erp_001"),
    /custom case publication source changed/,
  );
  db.prepare(`
    INSERT INTO cases
      (id, current_version, fingerprint, title, jurisdiction, practice_area, sector, difficulty, duration_minutes)
    VALUES ('case_one', '97.0.0', 'public-snapshot', 'Case one', 'Test', 'General legal', 'General legal', 'Intermediate', 45)
  `).run();
  db.prepare("UPDATE custom_cases SET current_version = '97.0.0', fingerprint = 'studio-source' WHERE id = ?").run(Number(inserted.lastInsertRowid));
  db.prepare(`
    INSERT INTO case_versions
      (case_id, source_custom_case_id, version, fingerprint, studio_fingerprint, change_summary, payload)
    VALUES ('case_one', ?, '97.0.0', 'public-snapshot', 'studio-source', 'test', '{}')
  `).run(Number(inserted.lastInsertRowid));
  db.prepare("DELETE FROM case_feedback WHERE custom_case_id = ?").run(Number(inserted.lastInsertRowid));
  db.prepare("DELETE FROM custom_case_grants WHERE custom_case_id = ?").run(Number(inserted.lastInsertRowid));
  db.prepare("DELETE FROM case_drafts WHERE custom_case_id = ?").run(Number(inserted.lastInsertRowid));
  db.prepare("DELETE FROM custom_cases WHERE id = ?").run(Number(inserted.lastInsertRowid));
  assert.equal(db.prepare("SELECT source_custom_case_id FROM case_versions WHERE version = '97.0.0'").get()?.source_custom_case_id, null);
});

test("0003 backfills one custom-case envelope per owner and case using the newest draft", () => {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db, migrationNames.slice(0, 3));

  const insertUser = db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)");
  insertUser.run("owner@example.com", "Owner");
  insertUser.run("other@example.com", "Other");

  const insertDraft = db.prepare(`
    INSERT INTO case_drafts
      (user_email, case_id, version, fingerprint, title, payload, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDraft.run("owner@example.com", "alpha_case", "1.0.0", "alpha-v1", "Alpha old", "{}", "draft", "2026-08-01T00:00:00.000Z", "2026-08-10T00:00:00.000Z");
  insertDraft.run("owner@example.com", "alpha_case", "1.1.0", "alpha-v11", "Alpha current", "{}", "submitted", "2026-08-11T00:00:00.000Z", "2026-08-20T00:00:00.000Z");
  // Same updated_at: the greater row id must win deterministically.
  insertDraft.run("owner@example.com", "alpha_case", "1.2.0", "alpha-v12", "Alpha tie winner", "{}", "accepted", "2026-08-12T00:00:00.000Z", "2026-08-20T00:00:00.000Z");
  insertDraft.run("owner@example.com", "promoted_case", "2.0.0", "promoted-v2", "Promoted", "{}", "published", "2026-08-01T00:00:00.000Z", "2026-08-21T00:00:00.000Z");
  insertDraft.run("other@example.com", "alpha_case", "1.0.0", "other-alpha", "Other Alpha", "{}", "draft", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");

  db.prepare(`
    INSERT INTO case_feedback
      (case_id, case_version, user_email, source, category, rating, comment)
    VALUES ('be_commercial_failed_erp_001', '1.1.0', 'owner@example.com', 'playable', 'realism', 5, 'Existing central feedback')
  `).run();

  db.exec(migration("0003_unusual_zarda.sql"));

  assert.equal(db.prepare("SELECT count(*) AS count FROM custom_cases").get()?.count, 3);
  assert.deepEqual(
    { ...db.prepare("SELECT title, current_version, fingerprint, is_private, status FROM custom_cases WHERE owner_email = ? AND case_id = ?")
      .get("owner@example.com", "alpha_case") },
    { title: "Alpha tie winner", current_version: "1.2.0", fingerprint: "alpha-v12", is_private: 0, status: "custom" },
  );
  assert.deepEqual(
    { ...db.prepare("SELECT current_version, status FROM custom_cases WHERE owner_email = ? AND case_id = ?")
      .get("owner@example.com", "promoted_case") },
    { current_version: "2.0.0", status: "promoted" },
  );
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM case_drafts WHERE custom_case_id IS NULL").get()?.count,
    0,
  );
  assert.equal(
    db.prepare(`
      SELECT count(*) AS count
      FROM case_drafts AS draft
      JOIN custom_cases AS custom_case ON custom_case.id = draft.custom_case_id
      WHERE custom_case.owner_email != draft.user_email OR custom_case.case_id != draft.case_id
    `).get()?.count,
    0,
  );
  assert.equal(db.prepare("SELECT audience FROM case_feedback LIMIT 1").get()?.audience, "central");
  assert.equal(db.prepare("SELECT license_tier FROM users WHERE email = 'owner@example.com'").get()?.license_tier, "community");
  db.exec(migration("0004_petite_komodo.sql"));
  assert.ok((db.prepare("PRAGMA table_info(case_versions)").all() as Array<{ name: string }>).some((column) => column.name === "source_custom_case_id"));
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("custom-case view policy is fail-closed around Private", () => {
  const base = { ownerEmail: "owner@example.com", viewerEmail: "viewer@example.com", isAdmin: false, hasGrant: false };
  assert.equal(canViewCustomCase({ ...base, viewerEmail: " OWNER@EXAMPLE.COM ", isPrivate: true }), true);
  assert.equal(canViewCustomCase({ ...base, isPrivate: false }), false);
  assert.equal(canViewCustomCase({ ...base, isPrivate: false, isAdmin: true }), true);
  assert.equal(canViewCustomCase({ ...base, isPrivate: true, isAdmin: true }), false);
  assert.equal(canViewCustomCase({ ...base, isPrivate: false, hasGrant: true }), true);
  assert.equal(canViewCustomCase({ ...base, isPrivate: true, hasGrant: true }), false);
  assert.equal(normalizeEmail(" Viewer@Example.COM "), "viewer@example.com");
});

test("sharing requires licence plus ownership or explicit reshare permission", () => {
  const base = {
    ownerEmail: "owner@example.com",
    viewerEmail: "owner@example.com",
    isPrivate: false,
    isAdmin: false,
    hasGrant: false,
    grantCanReshare: false,
    licenseTier: "community",
  };
  assert.equal(canShareCustomCase(base), false);
  assert.equal(canShareCustomCase({ ...base, licenseTier: "professional" }), true);
  assert.equal(canShareCustomCase({ ...base, licenseTier: "enterprise" }), true);
  assert.equal(canShareCustomCase({ ...base, licenseTier: "invented" }), false);
  assert.equal(canShareCustomCase({ ...base, isPrivate: true, licenseTier: "professional" }), false);
  assert.equal(canShareCustomCase({ ...base, viewerEmail: "admin@example.com", isAdmin: true }), true);
  assert.equal(canShareCustomCase({ ...base, viewerEmail: "admin@example.com", isAdmin: true, isPrivate: true }), false);
  assert.equal(canShareCustomCase({ ...base, viewerEmail: "recipient@example.com", hasGrant: true, grantCanReshare: false, licenseTier: "professional" }), false);
  assert.equal(canShareCustomCase({ ...base, viewerEmail: "recipient@example.com", hasGrant: true, grantCanReshare: true, licenseTier: "professional" }), true);
  assert.equal(canShareCustomCase({ ...base, viewerEmail: "recipient@example.com", hasGrant: true, grantCanReshare: true, licenseTier: "community" }), false);
  assert.equal(normalizeLicenseTier("professional"), "professional");
  assert.equal(normalizeLicenseTier("enterprise"), "enterprise");
  assert.equal(normalizeLicenseTier("Professional"), "community");
  assert.equal(normalizeLicenseTier(undefined), "community");
});

test("private-case feedback remains an owner-only note", () => {
  const base = { viewerEmail: "owner@example.com", ownerEmail: "owner@example.com", isAdmin: false, hasGrant: false };
  assert.equal(customFeedbackAudience({ ...base, isPrivate: true }), "owner_private");
  assert.equal(customFeedbackAudience({ ...base, isPrivate: false }), "custom_case");
  assert.equal(customFeedbackAudience({ ...base, viewerEmail: "recipient@example.com", isPrivate: false, hasGrant: true }), "custom_case");
  assert.equal(customFeedbackAudience({ ...base, viewerEmail: "admin@example.com", isPrivate: true, isAdmin: true }), null);
  assert.equal(customFeedbackAudience({ ...base, viewerEmail: "stranger@example.com", isPrivate: false }), null);
});

test("API sources retain server-side privacy, licence, feedback and promotion gates", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const submissions = source("app/api/submissions/route.ts");
  const customCases = source("app/api/custom-cases/route.ts");
  const adminSubmissions = source("app/api/admin/submissions/route.ts");
  const feedback = source("app/api/feedback/route.ts");
  const adminFeedback = source("app/api/admin/feedback/route.ts");
  const publication = source("app/api/admin/cases/route.ts");
  const profile = source("app/api/me/route.ts");
  const adminUsers = source("app/api/admin/users/route.ts");

  assert.match(submissions, /payload\.action === "submit" && requestedPrivate/);
  assert.match(submissions, /Turn off Private before submitting/);
  assert.match(submissions, /existingCustom \? existingCustom\.isPrivate/);

  assert.match(customCases, /canViewCustomCase/);
  assert.match(customCases, /canShareCustomCase/);
  assert.match(customCases, /action === "set_privacy"/);
  assert.match(customCases, /db\.delete\(customCaseGrants\)/);
  assert.match(customCases, /users\.licenseTier/);
  assert.match(customCases, /Cache-Control": "private, no-store"/);
  assert.match(customCases, /const visibleWhere = admin/);
  assert.match(customCases, /eq\(customCases\.isPrivate, false\)/);
  assert.match(customCases, /viewerGrantExists/);
  assert.match(customCases, /from\(customCases\)\.where\(visibleWhere\)/);
  assert.match(customCases, /innerJoin\(customCases, eq\(customCaseGrants\.customCaseId, customCases\.id\)\)/);
  assert.match(customCases, /selectDistinct\(\{ email: users\.email, displayName: users\.displayName \}\)/);
  assert.doesNotMatch(customCases, /db\.select\(\)\.from\(customCases\)\.orderBy/);
  assert.doesNotMatch(customCases, /admin \? await db\.select\(\)\.from\(customCaseGrants\)/);
  assert.doesNotMatch(customCases, /from\(users\);/);

  assert.ok((adminSubmissions.match(/eq\(customCases\.isPrivate, false\)/g) ?? []).length >= 2);
  assert.ok((adminFeedback.match(/eq\(customCases\.isPrivate, false\)/g) ?? []).length >= 2);
  assert.ok((adminFeedback.match(/ne\(caseFeedback\.audience, "owner_private"\)/g) ?? []).length >= 2);

  assert.match(feedback, /caseDrafts\.fingerprint, studioFingerprint/);
  assert.match(feedback, /customFeedbackAudience/);
  assert.match(feedback, /feedbackStatus = resolvedAudience === "owner_private" \? "private_note" : "new"/);

  assert.match(publication, /source\.isPrivate/);
  assert.match(publication, /source\.fingerprint !== studioFingerprint/);
  assert.match(publication, /sourceCustomCaseId: customSource\?\.id/);
  assert.match(publication, /eq\(customCases\.isPrivate, false\)/);
  assert.match(publication, /General Library case ID already belongs to another lineage/);

  const selfServiceValues = profile.match(/const values = \{([\s\S]*?)\n  \};/)?.[1] ?? "";
  assert.doesNotMatch(selfServiceValues, /licenseTier/);
  assert.match(adminUsers, /isPlatformAdmin/);
  assert.match(adminUsers, /normalizeLicenseTier/);
  assert.match(adminUsers, /update\(users\)\.set\(\{ licenseTier/);
});
