import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localMigrationRoot = join(webRoot, "drizzle");
const phaseBMigration = "0016_tenant_control_plane.sql";

const baseChain = [
  "0000_worthless_supreme_intelligence.sql",
  "0001_right_talon.sql",
  "0002_greedy_darkstar.sql",
  "0003_unusual_zarda.sql",
  "0004_petite_komodo.sql",
  "0005_dapper_nightcrawler.sql",
  "0006_concerned_korath.sql",
  "0007_ambitious_phoenix.sql",
  "0008_first_hitman.sql",
  "0009_medical_princess_powerful.sql",
  "0010_square_scalphunter.sql",
] as const;

const v61Chain = [...baseChain, "0011_operational_events.sql"] as const;
const v62Chain = [
  ...v61Chain,
  "0012_sleepy_magma.sql",
  "0013_polite_sentinels.sql",
  "0014_perfect_marvex.sql",
  "0015_low_calypso.sql",
] as const;

const b1Tables = [
  "organizations",
  "organization_lifecycle_transitions",
  "organization_identity_connections",
  "organization_memberships",
  "organization_invitations",
  "organization_policy_versions",
  "organization_policy_current",
  "tenant_resource_manifests",
  "tenant_resource_manifest_components",
  "tenant_resource_manifest_current",
  "organization_action_grant_revisions",
  "organization_action_grant_current",
  "compliance_export_grant_revisions",
  "compliance_export_grant_current",
  "tenant_export_requests",
  "tenant_export_request_dossiers",
  "tenant_export_approval_records",
  "tenant_export_request_state",
  "tenant_sessions",
  "organization_key_rotation_state",
  "organization_security_receipts",
] as const;

const expected = {
  localBaseChainSha256: "cd93cd3e186945bc37b972d70e7e3ab6f5046fdab5686f0dc2ce0e43a2c4ecdb",
  externalV61ChainSha256: "9ef229da8013ce5d44bd617dcf2c434ed3d6016dca63e95e1db60929f7f74710",
  externalV62ChainSha256: "94225c669fb0594918dca5cfec0d1279e12d0eb16a419a3c3c3fad0b263348bc",
  b1MigrationSha256: "eac3f234ec19e96e8b2966e174e034757160ee60731373404c49963629e07f53",
  b1SchemaSha256: "0ac5fc3ce151f2d46b838cb603deca8dc7a2aa47e3ee9588d11174f790d6fbbe",
  b1Counts: { table: 21, index: 32, trigger: 66 },
  b1ForeignKeys: 32,
} as const;

function readMigration(root: string, name: string) {
  return readFileSync(join(root, name), "utf8");
}

function chainFingerprint(root: string, names: readonly string[]) {
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(name);
    hash.update("\0");
    hash.update(readMigration(root, name).replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function migrationFingerprint(root: string, name: string) {
  return createHash("sha256").update(readMigration(root, name).replace(/\r\n/g, "\n")).digest("hex");
}

function applyChain(db: DatabaseSync, root: string, names: readonly string[]) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const name of names) db.exec(readMigration(root, name));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function legacyStateFingerprint(db: DatabaseSync) {
  const tables = (db.prepare(`
    SELECT name, sql FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string; sql: string }>).filter(({ name }) => !b1Tables.includes(name as (typeof b1Tables)[number]));
  const hash = createHash("sha256");
  for (const { name, sql } of tables) {
    const identifier = `"${name.replaceAll('"', '""')}"`;
    const columns = (db.prepare(`PRAGMA table_info(${identifier})`).all() as Array<{ name: string }>).map(({ name: column }) => `"${column.replaceAll('"', '""')}"`);
    const rows = db.prepare(`SELECT * FROM ${identifier}${columns.length > 0 ? ` ORDER BY ${columns.join(", ")}` : ""}`).all();
    hash.update(name);
    hash.update("\0");
    hash.update(sql);
    hash.update("\0");
    hash.update(JSON.stringify(rows));
    hash.update("\0");
  }
  return { tableCount: tables.length, sha256: hash.digest("hex") };
}

function b1SchemaRows(db: DatabaseSync) {
  const placeholders = b1Tables.map(() => "?").join(",");
  return db.prepare(`
    SELECT type, name, tbl_name, coalesce(sql, char(0)) AS sql
    FROM sqlite_schema
    WHERE tbl_name IN (${placeholders}) AND name NOT LIKE ?
    ORDER BY type, name
  `).all(...b1Tables, "sqlite_%") as Array<{ type: string; name: string; tbl_name: string; sql: string }>;
}

function b1Receipt(db: DatabaseSync) {
  const rows = b1SchemaRows(db);
  const counts = Object.fromEntries(["table", "index", "trigger"].map((type) => [type, rows.filter((row) => row.type === type).length]));
  let foreignKeys = 0;
  for (const table of b1Tables) {
    const clauses = new Set((db.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{ id: number }>).map((row) => row.id));
    foreignKeys += clauses.size;
  }
  const rowCount = b1Tables.reduce((sum, table) => sum + Number(db.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count), 0);
  return {
    counts,
    foreignKeys,
    rowCount,
    integrity: db.prepare("PRAGMA integrity_check").get()?.integrity_check,
    foreignKeyCheck: db.prepare("PRAGMA foreign_key_check").all(),
    schemaSha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
  };
}

function assertReceipt(receipt: ReturnType<typeof b1Receipt>, expectEmpty: boolean) {
  assert.deepEqual(receipt.counts, expected.b1Counts);
  assert.equal(receipt.foreignKeys, expected.b1ForeignKeys);
  assert.equal(receipt.schemaSha256, expected.b1SchemaSha256);
  assert.equal(receipt.integrity, "ok");
  assert.deepEqual(receipt.foreignKeyCheck, []);
  if (expectEmpty) assert.equal(receipt.rowCount, 0, "the additive migration must not seed or tenant-bind any row");
}

function fixtureMigrationRoot() {
  const configured = process.env.PHASE_B_MIGRATION_FIXTURE_ROOT;
  const candidates = [configured, resolve(webRoot, "../../../v62-web")].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    for (const root of [candidate, join(candidate, "drizzle"), join(candidate, "apps/juris-web/drizzle")]) {
      if (existsSync(join(root, "0011_operational_events.sql")) && existsSync(join(root, "0015_low_calypso.sql"))) return root;
    }
  }
  return undefined;
}

test("0016 is a deterministic additive B1 migration on the exact PR base", (t) => {
  assert.equal(chainFingerprint(localMigrationRoot, baseChain), expected.localBaseChainSha256);
  const sql = readMigration(localMigrationRoot, phaseBMigration);
  assert.equal(migrationFingerprint(localMigrationRoot, phaseBMigration), expected.b1MigrationSha256);
  assert.match(sql, /Phase B1 control-plane foundation only/);
  assert.match(sql, /B2 and final acceptance remain blocked|Phase B2\/Phase C aggregates/);
  assert.doesNotMatch(sql, /ALTER TABLE/i, "B1 must not tenant-bind or rewrite legacy rows");
  assert.doesNotMatch(sql, /CREATE TABLE `?(?:document_upload|upload_intent|ocr_|extraction_|processing_job)/i);

  const upgrade = database();
  applyChain(upgrade, localMigrationRoot, baseChain);
  upgrade.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run("migration-sentinel@example.invalid", "Migration sentinel");
  const legacyBefore = legacyStateFingerprint(upgrade);
  applyChain(upgrade, localMigrationRoot, [phaseBMigration]);
  const upgradeReceipt = b1Receipt(upgrade);
  assertReceipt(upgradeReceipt, true);
  assert.deepEqual(legacyStateFingerprint(upgrade), legacyBefore, "all legacy table definitions and seeded rows must remain byte-stable");

  assert.throws(() => applyChain(upgrade, localMigrationRoot, [phaseBMigration]), /already exists/i);
  assertReceipt(b1Receipt(upgrade), true);

  const fresh = database();
  applyChain(fresh, localMigrationRoot, [...baseChain, phaseBMigration]);
  const freshReceipt = b1Receipt(fresh);
  assertReceipt(freshReceipt, true);
  assert.deepEqual(freshReceipt, upgradeReceipt);
  const journal = JSON.parse(readFileSync(join(localMigrationRoot, "meta", "_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
  assert.equal(journal.entries.some(({ tag }) => tag === "0016_tenant_control_plane"), false, "0016 must remain explicitly unregistered until migration-history reconciliation is approved");
  t.diagnostic(JSON.stringify({ candidate: "exact-pr-base-0000-0010", migrationSha256: expected.b1MigrationSha256, migrationRegistration: "blocked_unregistered_branch_artifact", ...freshReceipt }));
});

test("0016 rolls back a late migration failure without changing legacy state", () => {
  const db = database();
  applyChain(db, localMigrationRoot, baseChain);
  db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run("rollback-sentinel@example.invalid", "Rollback sentinel");
  db.exec("CREATE TABLE tenant_export_requests (sentinel text NOT NULL)");
  db.prepare("INSERT INTO tenant_export_requests (sentinel) VALUES ('preserve-me')").run();
  const legacyBefore = legacyStateFingerprint(db);

  assert.throws(() => applyChain(db, localMigrationRoot, [phaseBMigration]), /tenant_export_requests.*already exists|already exists.*tenant_export_requests/i);
  assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = 'organizations'").get()?.count, 0);
  assert.equal(db.prepare("SELECT sentinel FROM tenant_export_requests").get()?.sentinel, "preserve-me");
  assert.deepEqual(legacyStateFingerprint(db), legacyBefore);

  db.exec("DROP TABLE tenant_export_requests");
  applyChain(db, localMigrationRoot, [phaseBMigration]);
  assertReceipt(b1Receipt(db), true);
});

test("B1 enforces actor, lifecycle, version, digest, session, grant, and append-only receipt boundaries", () => {
  const db = database();
  applyChain(db, localMigrationRoot, [...baseChain, phaseBMigration]);
  const digest = (character: string) => character.repeat(64);
  const organizationId = "org_00000000000000000001";
  const membershipId = "membership_00000000000001";
  const actorId = "actor_000000000000000001";

  db.prepare("INSERT INTO organizations (id, display_name, slug, controller_processor_mode) VALUES (?, ?, ?, ?)")
    .run(organizationId, "Synthetic test organization", "synthetic-test", "controller");
  assert.throws(() => db.prepare("UPDATE organizations SET status = 'active', authorization_version = 2 WHERE id = ?").run(organizationId), /exact immutable transition/);
  assert.throws(() => db.prepare("UPDATE organizations SET confidential_document_mode = 'approved', confidential_document_mode_version = 2 WHERE id = ?").run(organizationId), /server-owned version|CHECK/);

  const userId = Number(db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run("synthetic@example.invalid", "Synthetic actor").lastInsertRowid);
  db.prepare("INSERT INTO organization_memberships (id, organization_id, user_id, actor_id, role) VALUES (?, ?, ?, ?, ?)")
    .run(membershipId, organizationId, userId, actorId, "org_owner");
  db.prepare(`
    INSERT INTO organization_policy_versions (
      organization_id, policy_revision, retention_version, deletion_version, export_version,
      legal_hold_version, offline_mobile_version, ai_disclosure_version, session_version,
      data_classification_version, created_by_actor_hmac_sha256, receipt_sha256
    ) VALUES (?, 1, 'retention.v1', 'deletion.v1', 'export.v1', 'hold.v1', 'offline.v1', 'ai.v1', 'session.v1', 'classification.v1', ?, ?)
  `).run(organizationId, digest("a"), digest("b"));
  db.prepare("INSERT INTO organization_policy_current (organization_id, policy_revision) VALUES (?, 1)").run(organizationId);
  db.prepare(`
    INSERT INTO organization_lifecycle_transitions (
      organization_id, transition_version, from_status, to_status, reason_code,
      actor_subject_hmac_sha256, receipt_sha256, occurred_at
    ) VALUES (?, 2, 'provisioning', 'active', 'provisioning_complete', ?, ?, '2026-09-02T10:00:00.000Z')
  `).run(organizationId, digest("c"), digest("d"));
  assert.deepEqual({ ...db.prepare("SELECT status, authorization_version FROM organizations WHERE id = ?").get(organizationId) }, { status: "active", authorization_version: 2 });

  db.prepare(`
    INSERT INTO tenant_sessions (
      id, organization_id, membership_id, actor_id, authentication_method, session_token_sha256,
      organization_authorization_version, membership_authorization_version, policy_revision,
      issued_at, expires_at, last_seen_at
    ) VALUES ('session_00000000000000001', ?, ?, ?, 'local', ?, 2, 1, 1,
      '2000-01-01T10:00:00.000Z', '2099-01-01T11:00:00.000Z', '2000-01-01T10:00:00.000Z')
  `).run(organizationId, membershipId, actorId, digest("e"));
  assert.throws(() => db.prepare(`
    INSERT INTO tenant_sessions (
      id, organization_id, membership_id, actor_id, authentication_method, session_token_sha256,
      organization_authorization_version, membership_authorization_version, policy_revision,
      issued_at, expires_at, last_seen_at
    ) VALUES ('session_00000000000000002', ?, ?, ?, 'local', ?, 1, 1, 1,
      '2000-01-01T10:00:00.000Z', '2099-01-01T11:00:00.000Z', '2000-01-01T10:00:00.000Z')
  `).run(organizationId, membershipId, actorId, digest("f")), /exact current active authority versions/);

  db.prepare(`
    INSERT INTO organization_action_grant_revisions (
      organization_id, grant_id, grant_revision, actor_membership_id, actor_id,
      issued_by_membership_id, action, status, valid_from, receipt_sha256
    ) VALUES (?, 'grant_000000000000000001', 1, ?, ?, ?, 'member_invite', 'active', '2000-01-01T10:00:00.000Z', ?)
  `).run(organizationId, membershipId, actorId, membershipId, digest("1"));
  db.prepare(`
    INSERT INTO organization_action_grant_current (
      organization_id, actor_membership_id, actor_id, action, grant_id, grant_revision
    ) VALUES (?, ?, ?, 'member_invite', 'grant_000000000000000001', 1)
  `).run(organizationId, membershipId, actorId);
  db.prepare(`
    INSERT INTO organization_action_grant_revisions (
      organization_id, grant_id, grant_revision, actor_membership_id, actor_id,
      issued_by_membership_id, action, status, valid_from, receipt_sha256
    ) VALUES (?, 'grant_000000000000000001', 2, ?, ?, ?, 'member_invite', 'revoked', '2000-01-01T10:10:00.000Z', ?)
  `).run(organizationId, membershipId, actorId, membershipId, digest("2"));
  db.prepare("UPDATE organization_action_grant_current SET grant_revision = 2, pointer_version = 2, updated_at = '2000-01-01T10:10:00.000Z' WHERE organization_id = ? AND actor_id = ? AND action = 'member_invite'")
    .run(organizationId, actorId);
  assert.equal(db.prepare(`
    SELECT revisions.status FROM organization_action_grant_current AS current
    JOIN organization_action_grant_revisions AS revisions
      ON revisions.organization_id = current.organization_id AND revisions.grant_id = current.grant_id AND revisions.grant_revision = current.grant_revision
    WHERE current.organization_id = ? AND current.actor_id = ? AND current.action = 'member_invite'
  `).get(organizationId, actorId)?.status, "revoked");
  assert.throws(() => db.prepare("UPDATE organization_action_grant_revisions SET status = 'active' WHERE organization_id = ? AND grant_revision = 2").run(organizationId), /immutable/);

  db.prepare(`
    INSERT INTO organization_security_receipts (
      organization_id, sequence, receipt_id, event_type, outcome, actor_id, session_id,
      authentication_method, request_class, scope, action, policy_version,
      organization_authorization_version, membership_authorization_version,
      policy_revision, resource_revision, request_correlation_sha256, reason_code,
      deployment_sha, environment, previous_receipt_sha256, receipt_sha256, occurred_at
    ) VALUES (?, 1, 'receipt_0000000000000001', 'authorization_decision', 'allowed', ?,
      'session_00000000000000001', 'session_cookie', 'organization', 'organization',
      'organization_read', 'phase-b-role-action-policy.v1', 2, 1, 1, 1, ?,
      'authorized', ?, 'validation', ?, ?, '2026-09-02T10:00:01.000Z')
  `).run(organizationId, actorId, digest("3"), "1".repeat(40), digest("0"), digest("4"));
  assert.throws(() => db.prepare("UPDATE organization_security_receipts SET reason_code = 'changed' WHERE organization_id = ? AND sequence = 1").run(organizationId), /immutable/);
  assert.throws(() => db.prepare(`
    INSERT INTO organization_security_receipts (
      organization_id, sequence, receipt_id, event_type, outcome, actor_id, session_id,
      authentication_method, request_class, scope, action, policy_version,
      organization_authorization_version, membership_authorization_version,
      policy_revision, resource_revision, request_correlation_sha256, reason_code,
      deployment_sha, environment, previous_receipt_sha256, receipt_sha256, occurred_at
    ) VALUES (?, 3, 'receipt_0000000000000002', 'authorization_decision', 'denied', ?,
      'session_00000000000000001', 'session_cookie', 'organization', 'organization',
      'organization_read', 'phase-b-role-action-policy.v1', 2, 1, 1, 1, ?,
      'tenant_boundary_denied', ?, 'validation', ?, ?, '2026-09-02T10:00:02.000Z')
  `).run(organizationId, actorId, digest("5"), "1".repeat(40), digest("4"), digest("6")), /missing or divergent/);

  const invitationColumns = (db.prepare("PRAGMA table_info(organization_invitations)").all() as Array<{ name: string }>).map((row) => row.name);
  assert.ok(invitationColumns.includes("token_sha256"));
  assert.ok(invitationColumns.includes("delivery_address_hmac_sha256"));
  assert.ok(invitationColumns.includes("delivery_address_ciphertext"));
  assert.ok(invitationColumns.includes("intended_identity_issuer"));
  assert.ok(invitationColumns.includes("exact_origin"));
  assert.ok(!invitationColumns.some((name) => ["token", "email", "delivery_address", "key_material", "plaintext"].includes(name)));

  const receiptColumns = (db.prepare("PRAGMA table_info(organization_security_receipts)").all() as Array<{ name: string }>).map((row) => row.name);
  for (const required of ["authentication_method", "action", "policy_version", "organization_authorization_version", "membership_authorization_version", "participant_authorization_version", "policy_revision", "identity_configuration_version", "resource_revision", "tenant_manifest_revision", "request_correlation_sha256", "idempotency_correlation_sha256", "dossier_id", "deployment_sha", "environment", "reviewer_actor_id"]) {
    assert.ok(receiptColumns.includes(required), `missing B7 receipt field ${required}`);
  }
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("B1 rejects invalid time, active-state, alias, and cross-tenant substitutions", () => {
  const db = database();
  applyChain(db, localMigrationRoot, [...baseChain, phaseBMigration]);
  const digest = (character: string) => character.repeat(64);
  const opaque = (prefix: string, character: string) => `${prefix}_${character.repeat(19 - prefix.length)}`;

  function activeTenant(marker: "a" | "b", lifecycleDigest: string, policyDigest: string) {
    const organizationId = opaque(`org${marker}`, marker);
    const membershipId = opaque(`membership${marker}`, marker);
    const actorId = opaque(`actor${marker}`, marker);
    db.prepare("INSERT INTO organizations (id, display_name, slug, controller_processor_mode) VALUES (?, ?, ?, ?)")
      .run(organizationId, `Synthetic ${marker}`, `synthetic-${marker}`, "controller");
    db.prepare(`
      INSERT INTO organization_lifecycle_transitions (
        organization_id, transition_version, from_status, to_status, reason_code,
        actor_subject_hmac_sha256, receipt_sha256, occurred_at
      ) VALUES (?, 2, 'provisioning', 'active', 'synthetic_ready', ?, ?, '2000-01-01T00:00:00.000Z')
    `).run(organizationId, digest(lifecycleDigest), digest(policyDigest));
    const userId = Number(db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run(`synthetic-${marker}@example.invalid`, `Synthetic ${marker}`).lastInsertRowid);
    db.prepare("INSERT INTO organization_memberships (id, organization_id, user_id, actor_id, role) VALUES (?, ?, ?, ?, 'org_owner')")
      .run(membershipId, organizationId, userId, actorId);
    db.prepare(`
      INSERT INTO organization_policy_versions (
        organization_id, policy_revision, retention_version, deletion_version, export_version,
        legal_hold_version, offline_mobile_version, ai_disclosure_version, session_version,
        data_classification_version, created_by_actor_hmac_sha256, receipt_sha256
      ) VALUES (?, 1, 'retention.v1', 'deletion.v1', 'export.v1', 'hold.v1', 'offline.v1', 'ai.v1', 'session.v1', 'classification.v1', ?, ?)
    `).run(organizationId, digest(marker), digest(marker === "a" ? "1" : "2"));
    db.prepare("INSERT INTO organization_policy_current (organization_id, policy_revision) VALUES (?, 1)").run(organizationId);
    return { organizationId, membershipId, actorId };
  }

  const tenantA = activeTenant("a", "3", "4");
  const tenantB = activeTenant("b", "5", "6");

  assert.throws(() => db.prepare(`
    INSERT INTO organization_identity_connections (
      id, organization_id, issuer, verified_tenant_id, client_id,
      discovery_document_sha256, jwks_document_sha256, status
    ) VALUES (?, ?, 'https://login.example.invalid/tenant-a', 'tenant-a', 'client-a', ?, ?, 'active')
  `).run(opaque("identitya", "a"), tenantA.organizationId, digest("7"), digest("8")), /pending consent/);
  assert.throws(() => db.prepare(`
    INSERT INTO organization_identity_connections (
      id, organization_id, issuer, verified_tenant_id, client_id,
      discovery_document_sha256, jwks_document_sha256, configuration_version
    ) VALUES (?, ?, 'https://login.example.invalid/tenant-a', 'tenant-a', 'client-a', ?, ?, 99)
  `).run(opaque("identitya", "a"), tenantA.organizationId, digest("7"), digest("8")), /configuration version one/);
  assert.throws(() => db.prepare(`
    INSERT INTO organization_identity_connections (
      id, organization_id, issuer, verified_tenant_id, client_id,
      discovery_document_sha256, jwks_document_sha256
    ) VALUES (?, ?, 'http://login.example.invalid/tenant-a', 'tenant-a', 'client-a', ?, ?)
  `).run(opaque("identitya", "a"), tenantA.organizationId, digest("7"), digest("8")), /CHECK constraint/);

  assert.throws(() => db.prepare(`
    INSERT INTO organization_invitations (
      id, organization_id, invited_by_membership_id, intended_role,
      intended_identity_issuer, intended_identity_tenant_id, intended_identity_subject,
      exact_origin, token_sha256, delivery_address_hmac_sha256,
      expires_at, created_at
    ) VALUES (?, ?, ?, 'member', 'https://login.example.invalid/tenant-a', 'tenant-a',
      'subject-a', 'https://app.example.invalid', ?, ?,
      '2000-01-01T01:00:00.000Z', '2000-01-01T00:00:00.000Z')
  `).run(opaque("invitationnull", "a"), tenantA.organizationId, tenantA.membershipId, digest("f"), digest("0")), /CHECK constraint/);
  assert.throws(() => db.prepare(`
    INSERT INTO organization_invitations (
      id, organization_id, invited_by_membership_id, intended_role,
      intended_identity_issuer, intended_identity_tenant_id, intended_identity_subject,
      exact_origin, token_sha256, delivery_address_hmac_sha256,
      delivery_address_algorithm, delivery_address_key_alias, delivery_address_key_version,
      delivery_address_iv, delivery_address_ciphertext, delivery_address_aad_sha256,
      expires_at, created_at
    ) VALUES (?, ?, ?, 'member', 'https://login.example.invalid/tenant-a', 'tenant-a',
      'subject-a', 'https://app.example.invalid', ?, ?, 'A256GCM', 'live/invitations-a', 1,
      'AAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBBBBBB', ?,
      '2000-01-09T00:00:00.000Z', '2000-01-01T00:00:00.000Z')
  `).run(opaque("invitationa", "a"), tenantA.organizationId, tenantA.membershipId, digest("9"), digest("a"), digest("b")), /CHECK constraint/);
  assert.throws(() => db.prepare(`
    INSERT INTO organization_invitations (
      id, organization_id, invited_by_membership_id, intended_role,
      intended_identity_issuer, intended_identity_tenant_id, intended_identity_subject,
      exact_origin, token_sha256, delivery_address_hmac_sha256,
      delivery_address_algorithm, delivery_address_key_alias, delivery_address_key_version,
      delivery_address_iv, delivery_address_ciphertext, delivery_address_aad_sha256,
      expires_at, created_at
    ) VALUES (?, ?, ?, 'member', 'https://login.example.invalid/tenant-b', 'tenant-b',
      'subject-b', 'https://app.example.invalid', ?, ?, 'A256GCM', 'live/invitations-b', 1,
      'CCCCCCCCCCCCCCCC', 'DDDDDDDDDDDDDDDDDDDDDDDD', ?,
      '2000-01-02T00:00:00.000Z', '2000-01-01T00:00:00.000Z')
  `).run(opaque("invitationb", "b"), tenantB.organizationId, tenantA.membershipId, digest("c"), digest("d"), digest("e")), /active organization authority|FOREIGN KEY/);

  const durableInvitationId = opaque("invitationok", "a");
  db.prepare(`
    INSERT INTO organization_invitations (
      id, organization_id, invited_by_membership_id, intended_role,
      intended_identity_issuer, intended_identity_tenant_id, intended_identity_subject,
      exact_origin, token_sha256, delivery_address_hmac_sha256,
      delivery_address_algorithm, delivery_address_key_alias, delivery_address_key_version,
      delivery_address_iv, delivery_address_ciphertext, delivery_address_aad_sha256,
      expires_at, created_at
    ) VALUES (?, ?, ?, 'member', 'https://login.example.invalid/tenant-a', 'tenant-a',
      'subject-a', 'https://app.example.invalid', ?, ?, 'A256GCM', 'live/invitations-a', 1,
      'EEEEEEEEEEEEEEEE', 'FFFFFFFFFFFFFFFFFFFFFFFF', ?,
      '2000-01-01T01:00:00.000Z', '2000-01-01T00:00:00.000Z')
  `).run(durableInvitationId, tenantA.organizationId, tenantA.membershipId, digest("6"), digest("7"), digest("8"));
  assert.deepEqual({ ...db.prepare("SELECT intended_identity_issuer, intended_identity_tenant_id, intended_identity_subject, exact_origin FROM organization_invitations WHERE id = ?").get(durableInvitationId) }, {
    intended_identity_issuer: "https://login.example.invalid/tenant-a",
    intended_identity_tenant_id: "tenant-a",
    intended_identity_subject: "subject-a",
    exact_origin: "https://app.example.invalid",
  });
  db.prepare(`
    UPDATE organization_invitations SET status = 'accepted', accepted_by_membership_id = ?,
      accepted_at = '2000-01-01T00:30:00.000Z', authorization_version = 2,
      delivery_address_algorithm = NULL, delivery_address_key_alias = NULL,
      delivery_address_key_version = NULL, delivery_address_iv = NULL,
      delivery_address_ciphertext = NULL, delivery_address_aad_sha256 = NULL,
      updated_at = '2000-01-01T00:30:00.000Z'
    WHERE id = ?
  `).run(tenantA.membershipId, durableInvitationId);
  assert.equal(db.prepare("SELECT delivery_address_ciphertext FROM organization_invitations WHERE id = ?").get(durableInvitationId)?.delivery_address_ciphertext, null);

  assert.throws(() => db.prepare(`
    INSERT INTO tenant_sessions (
      id, organization_id, membership_id, actor_id, authentication_method, session_token_sha256,
      organization_authorization_version, membership_authorization_version, policy_revision,
      issued_at, expires_at, last_seen_at
    ) VALUES (?, ?, ?, ?, 'local', ?, 2, 1, 1,
      '2030-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', 'not-a-date')
  `).run(opaque("sessiona", "a"), tenantA.organizationId, tenantA.membershipId, tenantA.actorId, digest("d")), /CHECK constraint|exact current active authority/);
  assert.throws(() => db.prepare(`
    INSERT INTO tenant_sessions (
      id, organization_id, membership_id, actor_id, authentication_method, session_token_sha256,
      organization_authorization_version, membership_authorization_version, policy_revision,
      issued_at, expires_at, last_seen_at
    ) VALUES (?, ?, ?, ?, 'local', ?, 2, 1, 1,
      '2000-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z')
  `).run(opaque("sessionb", "b"), tenantB.organizationId, tenantA.membershipId, tenantA.actorId, digest("e")), /exact current active authority|FOREIGN KEY/);

  assert.throws(() => db.prepare(`
    INSERT INTO organization_key_rotation_state (
      organization_id, purpose, key_alias, current_version, write_version,
      read_version_primary, rotation_version, state_receipt_sha256, activated_at, rotate_by
    ) VALUES (?, 'live_data', 'live/synthetic-a', 99, 99, 99, 99, ?,
      '2000-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')
  `).run(tenantA.organizationId, digest("f")), /version one/);
  assert.throws(() => db.prepare(`
    INSERT INTO organization_key_rotation_state (
      organization_id, purpose, key_alias, current_version, write_version,
      read_version_primary, read_version_secondary, state_receipt_sha256,
      activated_at, rotate_by
    ) VALUES (?, 'live_data', 'live/synthetic-b', 1, 1, 1, 2, ?,
      '2000-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')
  `).run(tenantB.organizationId, digest("f")), /CHECK constraint/);

  db.prepare(`
    INSERT INTO organization_key_rotation_state (
      organization_id, purpose, key_alias, current_version, write_version,
      read_version_primary, state_receipt_sha256, activated_at, rotate_by
    ) VALUES (?, 'live_data', 'live/synthetic-a', 1, 1, 1, ?,
      '2000-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')
  `).run(tenantA.organizationId, digest("a"));
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'preparing', from_version = 1, to_version = 2, rewrap_total_count = 2, rotation_version = 2, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'live_data'")
    .run(digest("b"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'rewrapping', write_version = 2, read_version_secondary = 2, rotation_version = 3, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'live_data'")
    .run(digest("c"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET rewrapped_count = 2, new_version_write_count = 1, rewrap_checkpoint_sha256 = ?, rotation_version = 4, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'live_data'")
    .run(digest("d"), digest("e"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'verifying', rotation_version = 5, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'live_data'")
    .run(digest("f"), tenantA.organizationId);
  db.prepare(`
    UPDATE organization_key_rotation_state SET phase = 'completed', current_version = 2,
      from_version = NULL, to_version = NULL, write_version = 2,
      read_version_primary = 2, read_version_secondary = NULL,
      verification_receipt_sha256 = ?, rotation_version = 6, state_receipt_sha256 = ?,
      activated_at = '2026-01-01T00:00:00.000Z', rotate_by = '2099-01-01T00:00:00.000Z'
    WHERE organization_id = ? AND purpose = 'live_data'
  `).run(digest("1"), digest("2"), tenantA.organizationId);
  assert.deepEqual({ ...db.prepare("SELECT phase, current_version, write_version, read_version_primary, read_version_secondary FROM organization_key_rotation_state WHERE organization_id = ? AND purpose = 'live_data'").get(tenantA.organizationId) }, {
    phase: "completed", current_version: 2, write_version: 2, read_version_primary: 2, read_version_secondary: null,
  });

  db.prepare(`
    INSERT INTO organization_key_rotation_state (
      organization_id, purpose, key_alias, current_version, write_version,
      read_version_primary, state_receipt_sha256, activated_at, rotate_by
    ) VALUES (?, 'backups', 'backup/synthetic-a', 1, 1, 1, ?,
      '2000-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')
  `).run(tenantA.organizationId, digest("3"));
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'preparing', from_version = 1, to_version = 2, rewrap_total_count = 1, rotation_version = 2, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'backups'").run(digest("4"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'rewrapping', write_version = 2, read_version_secondary = 2, rotation_version = 3, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'backups'").run(digest("5"), tenantA.organizationId);
  db.prepare(`
    UPDATE organization_key_rotation_state SET phase = 'rollback_rewrapping', write_version = 1,
      new_version_write_count = 2, rollback_total_new_version_writes = 2,
      rollback_rewrapped_new_version_writes = 0, rollback_pending_new_version_writes = 2,
      rotation_version = 4, state_receipt_sha256 = ?
    WHERE organization_id = ? AND purpose = 'backups'
  `).run(digest("6"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET rollback_rewrapped_new_version_writes = 2, rollback_pending_new_version_writes = 0, rotation_version = 5, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'backups'").run(digest("7"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'rollback_verifying', rollback_verification_receipt_sha256 = ?, rotation_version = 6, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'backups'").run(digest("8"), digest("9"), tenantA.organizationId);
  db.prepare("UPDATE organization_key_rotation_state SET phase = 'rolled_back', read_version_secondary = NULL, rotation_version = 7, state_receipt_sha256 = ? WHERE organization_id = ? AND purpose = 'backups'").run(digest("a"), tenantA.organizationId);
  assert.equal(db.prepare("SELECT phase FROM organization_key_rotation_state WHERE organization_id = ? AND purpose = 'backups'").get(tenantA.organizationId)?.phase, "rolled_back");

  const keyRotationColumns = (db.prepare("PRAGMA table_info(organization_key_rotation_state)").all() as Array<{ name: string }>).map((row) => row.name);
  for (const required of ["phase", "write_version", "read_version_primary", "read_version_secondary", "rewrap_total_count", "rewrapped_count", "new_version_write_count", "rollback_pending_new_version_writes", "verification_receipt_sha256", "rollback_verification_receipt_sha256"]) assert.ok(keyRotationColumns.includes(required));
  assert.ok(!keyRotationColumns.some((name) => /material|plaintext|secret|ciphertext/u.test(name)));

  db.prepare(`
    INSERT INTO organization_action_grant_revisions (
      organization_id, grant_id, grant_revision, actor_membership_id, actor_id,
      issued_by_membership_id, action, status, valid_from, valid_until, receipt_sha256
    ) VALUES (?, ?, 1, ?, ?, ?, 'member_invite', 'active',
      '2000-01-01T00:00:00.000Z', '2001-01-01T00:00:00.000Z', ?)
  `).run(tenantA.organizationId, opaque("granta", "a"), tenantA.membershipId, tenantA.actorId, tenantA.membershipId, digest("1"));
  assert.throws(() => db.prepare(`
    INSERT INTO organization_action_grant_current (
      organization_id, actor_membership_id, actor_id, action, grant_id, grant_revision
    ) VALUES (?, ?, ?, 'member_invite', ?, 1)
  `).run(tenantA.organizationId, tenantA.membershipId, tenantA.actorId, opaque("granta", "a")), /exact active authority/);

  const manifestInsert = db.prepare(`
    INSERT INTO tenant_resource_manifests (
      id, organization_id, manifest_revision, environment, hostname,
      d1_database_id, r2_quarantine_id, r2_quarantine_binding_alias,
      r2_clean_id, r2_clean_binding_alias, r2_extracted_text_id,
      r2_extracted_text_binding_alias, r2_exports_id, r2_exports_binding_alias,
      r2_backups_id, r2_backups_binding_alias, live_data_key_alias,
      export_key_alias, backup_key_alias, restore_key_alias,
      processing_evidence_set_sha256, schema_version, deployment_sha,
      verification_receipt_sha256, verified_at, verification_expires_at,
      canonical_manifest_sha256
    ) VALUES (${Array.from({ length: 27 }, () => "?").join(", ")})
  `);
  const manifestA = [
    opaque("manifesta", "a"), tenantA.organizationId, 1, "validation", "a.example.invalid",
    opaque("d1a", "a"), opaque("r2qa", "a"), "quarantine/a00",
    opaque("r2ca", "a"), "clean/a00", opaque("r2ta", "a"),
    "extracted-text/a00", opaque("r2ea", "a"), "exports/a00",
    opaque("r2ba", "a"), "backups/a00", "live/a00",
    "export/a00", "backup/a00", "restore/a00",
    digest("2"), "v64", "3".repeat(40), digest("4"),
    "2000-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", digest("5"),
  ];
  const invalidAlias = [...manifestA];
  invalidAlias[0] = opaque("manifestx", "a");
  invalidAlias[16] = "live/bad value";
  assert.throws(() => manifestInsert.run(...invalidAlias), /CHECK constraint/);
  manifestInsert.run(...manifestA);
  const reusedAcrossTenant = [...manifestA];
  reusedAcrossTenant[0] = opaque("manifestb", "b");
  reusedAcrossTenant[1] = tenantB.organizationId;
  reusedAcrossTenant[4] = "b.example.invalid";
  reusedAcrossTenant[26] = digest("6");
  assert.throws(() => manifestInsert.run(...reusedAcrossTenant), /tenant-exclusive/);

  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

const externalRoot = fixtureMigrationRoot();
test("0016 upgrades read-only unverified v61 and v62 source candidates", { skip: externalRoot ? false : "acceptance blocked: set PHASE_B_MIGRATION_FIXTURE_ROOT to an authoritative v61/v62 fixture root" }, (t) => {
  assert.ok(externalRoot);
  assert.equal(chainFingerprint(externalRoot, v61Chain), expected.externalV61ChainSha256);
  assert.equal(chainFingerprint(externalRoot, v62Chain), expected.externalV62ChainSha256);

  for (const [candidate, chain, chainSha256] of [
    ["unverified-v61-source-candidate", v61Chain, expected.externalV61ChainSha256],
    ["unverified-v62-source-candidate", v62Chain, expected.externalV62ChainSha256],
  ] as const) {
    const db = database();
    applyChain(db, externalRoot, chain);
    const legacyBefore = legacyStateFingerprint(db);
    applyChain(db, localMigrationRoot, [phaseBMigration]);
    const receipt = b1Receipt(db);
    assertReceipt(receipt, true);
    assert.deepEqual(legacyStateFingerprint(db), legacyBefore);
    t.diagnostic(JSON.stringify({ candidate, externalDependency: "unverified_external_dependency", chainSha256, ...receipt }));
  }
});
