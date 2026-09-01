import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const legacyMigrations = [
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
  "0011_operational_events.sql",
] as const;
const dossierMigration = "0012_sleepy_magma.sql";
const auditClaimsMigration = "0013_polite_sentinels.sql";
const uploadCommitmentMigration = "0014_perfect_marvex.sql";
const statusHistoryMigration = "0015_low_calypso.sql";
const allMigrations = [
  ...legacyMigrations,
  dossierMigration,
  auditClaimsMigration,
  uploadCommitmentMigration,
  statusHistoryMigration,
] as const;

function migration(name: string) {
  return readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

function migrationSha256(name: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(`../drizzle/${name}`, import.meta.url)))
    .digest("hex")
    .toUpperCase();
}

function database(names: readonly string[] = [
  ...legacyMigrations,
  dossierMigration,
  auditClaimsMigration,
  uploadCommitmentMigration,
  statusHistoryMigration,
]) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of names) db.exec(migration(name));
  return db;
}

function legacyDossierDatabase() {
  // Historical direct-SQL invariants exercise the frozen 0012 contract. New
  // production-workflow coverage and the exact-claim probes below apply 0013.
  return database([...legacyMigrations, dossierMigration]);
}

test("every D1 migration breakpoint resolves to a non-empty platform statement", () => {
  for (const name of allMigrations) {
    const statements = migration(name).split("--> statement-breakpoint");
    assert.ok(
      statements.every((statement) => statement.trim().length > 0),
      `${name} must not create an empty D1 prepared statement`,
    );
    assert.ok(
      statements.every((statement) => Buffer.byteLength(statement, "utf8") <= 100_000),
      `${name} must respect Cloudflare D1's per-statement 100 KB limit`,
    );
  }
});

function user(db: DatabaseSync, email: string, displayName = email) {
  const result = db.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)").run(email, displayName);
  return Number(result.lastInsertRowid);
}

function actor(db: DatabaseSync, userId: number) {
  const row = db.prepare("SELECT actor_id FROM users WHERE id = ?").get(userId) as { actor_id: string };
  assert.match(row.actor_id, /^actor_[0-9a-f]{32}$/u);
  return row.actor_id;
}

function dossier(db: DatabaseSync, id: string, ownerUserId: number, status = "draft") {
  const ownerActorId = actor(db, ownerUserId);
  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO dossiers (
        id, reference, title, dossier_type_registry, dossier_type_id,
        dossier_type_version, owner_user_id, owner_actor_id, jurisdictions, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES (?, ?, ?, 'genesis-juris-dossier-types', 'general-matter', '1.0.0', ?, ?, '["Test"]', ?, ?, ?,
        '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
    `).run(id, `REF-${id}`, `Matter ${id}`, ownerUserId, ownerActorId, status, ownerActorId, ownerActorId);
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, event_digest
      ) VALUES (?, ?, 1, 1, 'dossier_created', 'dossier', ?, ?, ?, 'owner',
        '2026-09-01T00:00:00.000Z', 'DOSSIER_CREATED', ?)
    `).run(`${id}-audit-created`, id, id, ownerUserId, ownerActorId, digest(1));
    db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 1, ?, '2026-09-01T00:00:00.000Z')
    `).run(id, ownerActorId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const owner = db.prepare("SELECT id, role, status, user_id, actor_id FROM dossier_participants WHERE dossier_id = ?").get(id) as Record<string, unknown>;
  assert.equal(owner.role, "owner");
  assert.equal(owner.status, "active");
  assert.equal(owner.user_id, ownerUserId);
  assert.equal(owner.actor_id, ownerActorId);
  return String(owner.id);
}

function digest(value: number) {
  return `sha256-${value.toString(16).padStart(64, "0")}`;
}

function advanceDossierRevision(
  db: DatabaseSync,
  dossierId: string,
  expectedRevision: number,
  actorRef: string,
  occurredAt: string,
) {
  const result = db.prepare(`
    UPDATE dossiers
    SET revision = ?, updated_by_actor_ref = ?, updated_at = ?
    WHERE id = ? AND revision = ?
  `).run(expectedRevision + 1, actorRef, occurredAt, dossierId, expectedRevision);
  assert.equal(result.changes, 1, "the exact expected dossier revision must win its CAS");
}

function appendAudit(
  db: DatabaseSync,
  input: {
    id: string;
    dossierId: string;
    dossierRevision: number;
    sequence: number;
    eventType: string;
    objectRefType: string;
    objectRefId: string;
    actorUserId: number;
    actorRef: string;
    actorRole: "owner" | "contributor" | "reviewer" | "viewer";
    occurredAt: string;
    previousEventId: string;
    digestSeed: number;
  },
) {
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TEST_EXACT_MUTATION_AUDIT', ?, ?)
  `).run(
    input.id,
    input.dossierId,
    input.dossierRevision,
    input.sequence,
    input.eventType,
    input.objectRefType,
    input.objectRefId,
    input.actorUserId,
    input.actorRef,
    input.actorRole,
    input.occurredAt,
    input.previousEventId,
    digest(input.digestSeed),
  );
}

function appendRevisionReceipt(
  db: DatabaseSync,
  dossierId: string,
  resultingRevision: number,
  actorRef: string,
  createdAt: string,
) {
  db.prepare(`
    INSERT INTO dossier_revision_receipts (
      dossier_id, resulting_revision, created_by_actor_ref, created_at
    ) VALUES (?, ?, ?, ?)
  `).run(dossierId, resultingRevision, actorRef, createdAt);
}

function expectDeferredCommitFailure(db: DatabaseSync, work: () => void) {
  db.exec("BEGIN IMMEDIATE");
  try {
    work();
    assert.throws(() => db.exec("COMMIT"), /FOREIGN KEY constraint failed/iu);
  } finally {
    try {
      db.exec("ROLLBACK");
    } catch (error) {
      assert.match(String(error), /cannot rollback.*no transaction/iu);
    }
  }
}

const readinessDimensionIds = [
  "document_completeness",
  "information_requests",
  "ai_proposals",
  "contradictions",
  "critical_deadlines",
  "source_provenance",
  "decision_graph",
  "simulation_tests",
  "report_freshness",
  "reviewer_approval",
] as const;

function strictReadiness(dossierId: string, revision: number, evaluatedAt: string) {
  return JSON.stringify({
    schema_version: 1,
    dossier_id: dossierId,
    computed_from_revision: revision,
    evaluated_at: evaluatedAt,
    ready: true,
    dimensions: readinessDimensionIds.map((dimension) => ({
      dimension,
      state: "ready",
      reasons: [],
    })),
  });
}

function addDocument(
  db: DatabaseSync,
  input: {
    dossierId: string;
    documentId: string;
    versionId: string;
    mediaType?: "text/plain" | "text/markdown" | "application/pdf";
    ordinal?: number;
    predecessorVersionId?: string | null;
    sourceOrigin?: "external_reference" | "import";
    hashSeed?: number;
    binaryObjectReference?: string;
  },
) {
  const ordinal = input.ordinal ?? 1;
  const mediaType = input.mediaType ?? "text/plain";
  if (ordinal === 1) {
    db.prepare(`
      INSERT INTO dossier_documents (
        id, dossier_id, title, document_type, source_origin, classification,
        created_by_actor_ref, updated_by_actor_ref
      ) VALUES (?, ?, ?, 'source', ?, 'confidential', 'actor:test', 'actor:test')
    `).run(input.documentId, input.dossierId, input.documentId, input.sourceOrigin ?? "external_reference");
  }
  const hash = digest(input.hashSeed ?? ordinal);
  db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference,
      original_filename, media_type, byte_length, content_sha256,
      uploader_actor_ref, uploaded_at, predecessor_version_id, created_by_actor_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 128, ?, 'actor:test', '2026-09-01T00:00:00.000Z', ?, 'actor:test')
  `).run(
    input.versionId,
    input.dossierId,
    input.documentId,
    ordinal,
    input.binaryObjectReference ?? `private/dossier/${input.dossierId}/${input.versionId}/${"x".repeat(32)}`,
    `${input.documentId}.${mediaType === "application/pdf" ? "pdf" : "txt"}`,
    mediaType,
    hash,
    input.predecessorVersionId ?? null,
  );
  return hash;
}

test("0012 through additive 0015 are fresh-schema and v61-upgrade-safe metadata-only migrations", () => {
  assert.equal(
    migrationSha256(dossierMigration),
    "AE2A2816B316869D2B4607EE4294FDCF1B1F8DA548BD921DD34C6B69D263C68B",
    "the accepted hardened 0012 migration is frozen byte-for-byte",
  );
  const fresh = database();
  assert.equal(fresh.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(fresh.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(fresh.prepare("SELECT count(*) AS count FROM cases").get()?.count, 5);
  assert.equal(fresh.prepare("SELECT count(*) AS count FROM dossiers").get()?.count, 0, "legacy cases are never auto-converted");

  const dossierTables = fresh.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'dossier_%' ORDER BY name
  `).all() as Array<{ name: string }>;
  assert.equal(dossierTables.length, 40);
  assert.ok(dossierTables.some(({ name }) => name === "dossier_required_audits"));
  assert.ok(dossierTables.some(({ name }) => name === "dossier_revision_commitments"));
  assert.ok(dossierTables.some(({ name }) => name === "dossier_audit_certifications"));
  assert.ok(dossierTables.some(({ name }) => name === "dossier_upload_version_commitments"));
  assert.ok(dossierTables.some(({ name }) => name === "dossier_status_application_certifications"));
  assert.ok(dossierTables.some(({ name }) => name === "dossier_status_application_commitments"));
  assert.ok(dossierTables.some(({ name }) => name === "dossier_proposal_materialization_commitments"));
  for (const { name } of dossierTables) {
    const columns = fresh.prepare(`PRAGMA table_xinfo(${name})`).all() as Array<{ type: string }>;
    assert.ok(columns.every((column) => !/BLOB/iu.test(column.type)), `${name} must store metadata only`);
  }
  assert.doesNotMatch(migration(dossierMigration), /\bBLOB\b/iu);
  assert.doesNotMatch(migration(auditClaimsMigration), /\bBLOB\b/iu);
  assert.doesNotMatch(migration(uploadCommitmentMigration), /\bBLOB\b/iu);
  assert.doesNotMatch(migration(statusHistoryMigration), /\bBLOB\b/iu);
  assert.match(migration(dossierMigration), /binary_object_reference/);
  assert.match(migration(dossierMigration), /dossiers_no_fake_organisation_check/);
  assert.match(migration(auditClaimsMigration), /dossier_required_audits/);
  assert.match(migration(auditClaimsMigration), /dossier_revision_commitments/);
  assert.match(migration(uploadCommitmentMigration), /dossier_upload_version_commitments/);
  assert.match(migration(statusHistoryMigration), /__new_dossier_status_transitions/);
  assert.ok((fresh.prepare("PRAGMA table_xinfo(dossier_evidence_links)").all() as Array<{ name: string }>).some(({ name }) => name === "originating_proposal_id"));

  const upgraded = database(legacyMigrations);
  const ownerId = user(upgraded, "upgrade-owner@example.com", "Upgrade Owner");
  upgraded.prepare(`
    INSERT INTO custom_cases (owner_email, case_id, title, current_version, fingerprint)
    VALUES ('upgrade-owner@example.com', 'upgrade_case', 'Upgrade case', '1.0.0', 'upgrade-fingerprint')
  `).run();
  const caseCount = upgraded.prepare("SELECT count(*) AS count FROM cases").get()?.count;
  upgraded.exec(migration(dossierMigration));
  upgraded.exec(migration(auditClaimsMigration));
  upgraded.exec(migration(uploadCommitmentMigration));
  upgraded.exec(migration(statusHistoryMigration));
  assert.equal(upgraded.prepare("SELECT count(*) AS count FROM cases").get()?.count, caseCount);
  assert.equal(upgraded.prepare("SELECT count(*) AS count FROM custom_cases WHERE owner_email = 'upgrade-owner@example.com'").get()?.count, 1);
  assert.equal(upgraded.prepare("SELECT count(*) AS count FROM dossiers").get()?.count, 0);
  dossier(upgraded, "upgrade-dossier", ownerId);
  assert.equal(upgraded.prepare("SELECT count(*) AS count FROM dossier_required_audits").get()?.count, 1);
  assert.equal(upgraded.prepare("SELECT count(*) AS count FROM dossier_revision_commitments").get()?.count, 1);
  assert.equal(upgraded.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(upgraded.prepare("PRAGMA foreign_key_check").all(), []);
});

test("canonical root and governed child inserts bind immutable creation provenance", () => {
  const db = database();
  const ownerId = user(db, "canonical-insert-owner@example.com", "Canonical Insert Owner");
  const ownerActor = actor(db, ownerId);
  const otherId = user(db, "canonical-insert-other@example.com", "Canonical Insert Other");
  const otherActor = actor(db, otherId);
  const createdAt = "2026-09-01T00:20:00.000Z";
  const insertRoot = db.prepare(`
    INSERT INTO dossiers (
      id, reference, title, dossier_type_registry, dossier_type_id,
      dossier_type_version, owner_user_id, owner_actor_id, jurisdictions,
      status, status_reason, revision,
      closed_at, closed_by_actor_ref, closure_reason,
      archived_at, archived_by_actor_ref, archive_reason, archive_admin_override,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, ?, 'Canonical probe', 'genesis-juris-dossier-types',
      'general-matter', '1.0.0', ?, ?, '["Test"]', ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const rootCases = [
    { label: "non-draft", status: "active", statusReason: null, revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor, updatedAt: createdAt },
    { label: "latent-reason", status: "draft", statusReason: "Latent", revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor, updatedAt: createdAt },
    { label: "latent-closure", status: "draft", statusReason: null, revision: 1,
      closedAt: createdAt, closedBy: ownerActor, closureReason: "Latent closure",
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor, updatedAt: createdAt },
    { label: "latent-archive", status: "draft", statusReason: null, revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: createdAt, archivedBy: ownerActor, archiveReason: "Latent archive", override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor, updatedAt: createdAt },
    { label: "latent-override", status: "draft", statusReason: null, revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 1,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor, updatedAt: createdAt },
    { label: "revision-two", status: "draft", statusReason: null, revision: 2,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor, updatedAt: createdAt },
    { label: "owner-creator-mismatch", status: "draft", statusReason: null, revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: otherActor, updatedBy: otherActor, updatedAt: createdAt },
    { label: "updated-actor-mismatch", status: "draft", statusReason: null, revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: otherActor, updatedAt: createdAt },
    { label: "updated-time-mismatch", status: "draft", statusReason: null, revision: 1,
      closedAt: null, closedBy: null, closureReason: null,
      archivedAt: null, archivedBy: null, archiveReason: null, override: 0,
      ownerActor, createdBy: ownerActor, updatedBy: ownerActor,
      updatedAt: "2026-09-01T00:20:01.000Z" },
  ] as const;
  for (const input of rootCases) {
    assert.throws(() => insertRoot.run(
      `canonical-invalid-${input.label}`,
      `REF-canonical-invalid-${input.label}`,
      ownerId,
      input.ownerActor,
      input.status,
      input.statusReason,
      input.revision,
      input.closedAt,
      input.closedBy,
      input.closureReason,
      input.archivedAt,
      input.archivedBy,
      input.archiveReason,
      input.override,
      input.createdBy,
      input.updatedBy,
      createdAt,
      input.updatedAt,
    ), /dossiers must begin as a canonical revision-one draft owned by their creator/iu,
    `root insert must reject ${input.label}`);
  }
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossiers WHERE id LIKE 'canonical-invalid-%'
  `).get()?.count, 0);

  const ownerParticipantId = dossier(db, "canonical-insert-dossier", ownerId);
  assert.equal(db.prepare(`
    SELECT created_by_actor_ref = updated_by_actor_ref AND created_at = updated_at AS canonical
    FROM dossier_participants WHERE id = ?
  `).get(ownerParticipantId)?.canonical, 1);
  assert.throws(
    () => db.prepare(`
      INSERT INTO dossier_documents (
        id, dossier_id, title, document_type, source_origin, is_provisional,
        classification, status, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (
        'canonical-document-preaccepted', 'canonical-insert-dossier',
        'Pre-accepted source', 'source', 'internal_upload', true,
        'confidential', 'accepted_source', ?, ?, ?, ?
      )
    `).run(ownerActor, ownerActor, createdAt, createdAt),
    /logical document creation must begin in received status/iu,
  );

  const insertParticipant = (id: string, updatedBy: string, updatedAt: string) => db.prepare(`
    INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, 'canonical-insert-dossier', ?, ?, 'Canonical Viewer',
      'viewer', 'active', ?, ?, ?, ?)
  `).run(id, otherId, otherActor, ownerActor, updatedBy, createdAt, updatedAt);
  const insertAssertion = (id: string, updatedBy: string, updatedAt: string) => db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, 'canonical-insert-dossier', 'fact', 'Canonical assertion.',
      'needs_review', ?, ?, ?, ?)
  `).run(id, ownerActor, updatedBy, createdAt, updatedAt);
  const insertRequest = (id: string, updatedBy: string, updatedAt: string) => db.prepare(`
    INSERT INTO dossier_information_requests (
      id, dossier_id, question, owner_user_id, owner_actor_ref, reason,
      readiness_reason_code, created_by_actor_ref, updated_by_actor_ref,
      created_at, updated_at
    ) VALUES (?, 'canonical-insert-dossier', 'Canonical request?', ?, ?,
      'Canonical reason', 'INFORMATION_REQUEST_OPEN', ?, ?, ?, ?)
  `).run(id, ownerId, ownerActor, ownerActor, updatedBy, createdAt, updatedAt);
  const insertPackage = (
    id: string,
    updatedBy: string,
    updatedAt: string,
    sourceRevision = 1,
  ) => db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, graph_digest, package_type_registry,
      package_type_id, package_type_version, created_by_actor_ref,
      updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, 'canonical-insert-dossier', ?, '1.0.0', ?, ?, ?,
      'genesis-juris-package-types', 'general-decision', '1.0.0', ?, ?, ?, ?)
  `).run(
    id,
    id,
    digest(21_970),
    sourceRevision,
    digest(21_971),
    ownerActor,
    updatedBy,
    createdAt,
    updatedAt,
  );
  const childFamilies = [
    {
      family: "participant",
      insert: insertParticipant,
      diagnostic: /participant creation and update provenance must match/iu,
    },
    {
      family: "assertion",
      insert: insertAssertion,
      diagnostic: /assertion creation and update provenance must match/iu,
    },
    {
      family: "request",
      insert: insertRequest,
      diagnostic: /information-request creation and update provenance must match/iu,
    },
    {
      family: "package",
      insert: insertPackage,
      diagnostic: /decision-package creation and update provenance must match/iu,
    },
  ];
  for (const child of childFamilies) {
    assert.throws(
      () => child.insert(`canonical-${child.family}-actor-mismatch`, otherActor, createdAt),
      child.diagnostic,
      `${child.family} insert must reject an updated actor distinct from its creator`,
    );
    assert.throws(
      () => child.insert(
        `canonical-${child.family}-time-mismatch`,
        ownerActor,
        "2026-09-01T00:20:01.000Z",
      ),
      child.diagnostic,
      `${child.family} insert must reject an updated time distinct from its creation time`,
    );
  }

  assert.throws(
    () => insertPackage(
      "canonical-package-receipted-phase",
      ownerActor,
      createdAt,
      1,
    ),
    /requires an unreceipted live dossier revision/iu,
    "a package cannot be inserted against an already receipted live revision and carried into a later receipt",
  );

  const governedAt = createdAt;
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "canonical-insert-dossier", 1, ownerActor, governedAt);
    insertParticipant("canonical-participant-exact", ownerActor, createdAt);
    insertAssertion("canonical-assertion-exact", ownerActor, createdAt);
    insertRequest("canonical-request-exact", ownerActor, createdAt);
    insertPackage("canonical-package-exact", ownerActor, createdAt, 2);
    const audits = [
      ["canonical-participant-exact", "participant_changed", "participant"],
      ["canonical-assertion-exact", "assertion_reviewed", "professional_assertion"],
      ["canonical-request-exact", "information_request_changed", "information_request"],
      ["canonical-package-exact", "decision_package_linked", "decision_package_reference"],
    ] as const;
    let previousEventId = "canonical-insert-dossier-audit-created";
    for (const [index, [objectId, eventType, objectRefType]] of audits.entries()) {
      const auditId = `${objectId}-audit`;
      appendAudit(db, {
        id: auditId,
        dossierId: "canonical-insert-dossier",
        dossierRevision: 2,
        sequence: index + 2,
        eventType,
        objectRefType,
        objectRefId: objectId,
        actorUserId: ownerId,
        actorRef: ownerActor,
        actorRole: "owner",
        occurredAt: createdAt,
        previousEventId,
        digestSeed: 21_972 + index,
      });
      previousEventId = auditId;
    }
    appendRevisionReceipt(db, "canonical-insert-dossier", 2, ownerActor, governedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_required_audits
    WHERE dossier_id = 'canonical-insert-dossier' AND dossier_revision = 2
  `).get()?.count, 4);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0015 preserves populated status history and permits the next exact transition", () => {
  const db = database([
    ...legacyMigrations,
    dossierMigration,
    auditClaimsMigration,
    uploadCommitmentMigration,
  ]);
  const ownerId = user(db, "status-upgrade-owner@example.com", "Status Upgrade Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "status-upgrade-dossier", ownerId);

  const commitTransition = (input: {
    id: string;
    revisionBefore: number;
    sequence: number;
    previousStatus: "draft" | "intake_review";
    newStatus: "intake_review" | "active";
    reason: string;
    occurredAt: string;
    previousEventId: string;
    digestSeed: number;
  }) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO dossier_status_transitions (
          id, dossier_id, revision_before, revision_after, previous_status,
          new_status, actor_user_id, actor_ref, actor_role, reason,
          consequences, occurred_at, had_current_output, had_reviewer_approval
        ) VALUES (?, 'status-upgrade-dossier', ?, ?, ?, ?, ?, ?, 'owner', ?,
          '["recompute_readiness","mark_outputs_stale"]', ?, false, false)
      `).run(
        input.id,
        input.revisionBefore,
        input.revisionBefore + 1,
        input.previousStatus,
        input.newStatus,
        ownerId,
        ownerActor,
        input.reason,
        input.occurredAt,
      );
      const update = db.prepare(`
        UPDATE dossiers
        SET status = ?, status_reason = ?, revision = ?,
          updated_by_actor_ref = ?, updated_at = ?
        WHERE id = 'status-upgrade-dossier' AND revision = ? AND status = ?
      `).run(
        input.newStatus,
        input.reason,
        input.revisionBefore + 1,
        ownerActor,
        input.occurredAt,
        input.revisionBefore,
        input.previousStatus,
      );
      assert.equal(update.changes, 1);
      appendAudit(db, {
        id: `${input.id}-audit`,
        dossierId: "status-upgrade-dossier",
        dossierRevision: input.revisionBefore + 1,
        sequence: input.sequence,
        eventType: "dossier_status_transitioned",
        objectRefType: "status_transition",
        objectRefId: input.id,
        actorUserId: ownerId,
        actorRef: ownerActor,
        actorRole: "owner",
        occurredAt: input.occurredAt,
        previousEventId: input.previousEventId,
        digestSeed: input.digestSeed,
      });
      appendRevisionReceipt(
        db,
        "status-upgrade-dossier",
        input.revisionBefore + 1,
        ownerActor,
        input.occurredAt,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  commitTransition({
    id: "status-upgrade-intake",
    revisionBefore: 1,
    sequence: 2,
    previousStatus: "draft",
    newStatus: "intake_review",
    reason: "Intake accepted before 0015",
    occurredAt: "2026-09-01T12:00:00.000Z",
    previousEventId: "status-upgrade-dossier-audit-created",
    digestSeed: 21_610,
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  db.exec(migration(statusHistoryMigration));
  assert.deepEqual({ ...db.prepare(`
    SELECT revision_before, revision_after, previous_status, new_status,
      actor_ref, reason, occurred_at
    FROM dossier_status_transitions
    WHERE dossier_id = 'status-upgrade-dossier' AND id = 'status-upgrade-intake'
  `).get() }, {
    revision_before: 1,
    revision_after: 2,
    previous_status: "draft",
    new_status: "intake_review",
    actor_ref: ownerActor,
    reason: "Intake accepted before 0015",
    occurred_at: "2026-09-01T12:00:00.000Z",
  }, "the rebuild must preserve the pre-0015 immutable transition tuple");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status,
        new_status, actor_user_id, actor_ref, actor_role, reason,
        consequences, occurred_at, had_current_output, had_reviewer_approval
      ) VALUES ('status-upgrade-forged-certification', 'status-upgrade-dossier',
        2, 3, 'intake_review', 'active', ?, ?, 'owner', 'Forged application',
        '["recompute_readiness","mark_outputs_stale"]',
        '2026-09-01T12:00:30.000Z', false, false)
    `).run(ownerId, ownerActor);
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_status_application_certifications (
        id, dossier_id, transition_id, created_at
      ) VALUES ('forged-status-application', 'status-upgrade-dossier',
        'status-upgrade-forged-certification', '2026-09-01T12:00:30.000Z')
    `).run(), /status application certification must bind the exact applied transition/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  expectDeferredCommitFailure(db, () => {
    const occurredAt = "2026-09-01T12:00:40.000Z";
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status,
        new_status, actor_user_id, actor_ref, actor_role, reason,
        consequences, occurred_at, had_current_output, had_reviewer_approval
      ) VALUES ('status-upgrade-omitted-application', 'status-upgrade-dossier',
        2, 3, 'intake_review', 'active', ?, ?, 'owner', 'Application omitted',
        '["recompute_readiness","mark_outputs_stale"]', ?, false, false)
    `).run(ownerId, ownerActor, occurredAt);
    advanceDossierRevision(db, "status-upgrade-dossier", 2, ownerActor, occurredAt);
    appendAudit(db, {
      id: "status-upgrade-omitted-application-audit",
      dossierId: "status-upgrade-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "dossier_status_transitioned",
      objectRefType: "status_transition",
      objectRefId: "status-upgrade-omitted-application",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "status-upgrade-intake-audit",
      digestSeed: 21_612,
    });
    appendRevisionReceipt(db, "status-upgrade-dossier", 3, ownerActor, occurredAt);
    const violations = db.prepare("PRAGMA foreign_key_check").all() as Array<{ table: string }>;
    assert.ok(
      violations.some(({ table }) => table === "dossier_status_application_commitments"),
      "omitting new_status application must leave the deferred certification commitment unresolved",
    );
  });
  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, status_reason
    FROM dossiers WHERE id = 'status-upgrade-dossier'
  `).get() }, {
    revision: 2,
    status: "intake_review",
    status_reason: "Intake accepted before 0015",
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_status_transitions
    WHERE dossier_id = 'status-upgrade-dossier'
      AND id IN ('status-upgrade-forged-certification', 'status-upgrade-omitted-application')
  `).get()?.count, 0);

  commitTransition({
    id: "status-upgrade-active",
    revisionBefore: 2,
    sequence: 3,
    previousStatus: "intake_review",
    newStatus: "active",
    reason: "Work commenced after 0015",
    occurredAt: "2026-09-01T12:01:00.000Z",
    previousEventId: "status-upgrade-intake-audit",
    digestSeed: 21_611,
  });
  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, status_reason
    FROM dossiers WHERE id = 'status-upgrade-dossier'
  `).get() }, {
    revision: 3,
    status: "active",
    status_reason: "Work commenced after 0015",
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_status_transitions
    WHERE dossier_id = 'status-upgrade-dossier'
  `).get()?.count, 2);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0015 proposal materialization backfill accepts only exact supported preexisting rows", () => {
  const fixture = () => {
    const db = legacyDossierDatabase();
    const ownerId = user(db, `proposal-upgrade-${Math.random()}@example.com`, "Proposal Upgrade Owner");
    const ownerActor = actor(db, ownerId);
    const ownerParticipantId = dossier(db, `proposal-upgrade-${ownerId}`, ownerId);
    const dossierId = `proposal-upgrade-${ownerId}`;
    const documentId = `proposal-upgrade-document-${ownerId}`;
    const versionId = `proposal-upgrade-version-${ownerId}`;
    const anchorId = `proposal-upgrade-anchor-${ownerId}`;
    const documentHash = addDocument(db, {
      dossierId,
      documentId,
      versionId,
      sourceOrigin: "external_reference",
      hashSeed: 22_000 + ownerId,
    });
    db.prepare(`
      INSERT INTO dossier_source_anchors (
        id, dossier_id, document_id, document_version_id, character_start,
        character_end, excerpt, anchor_checksum, creator, review_state,
        created_by_actor_ref, created_at
      ) VALUES (?, ?, ?, ?, 0, 20, 'Upgrade source', ?, 'human',
        'pending', ?, '2026-09-01T14:00:00.000Z')
    `).run(anchorId, dossierId, documentId, versionId, documentHash, ownerActor);
    db.prepare(`
      UPDATE dossier_source_anchors
      SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
        reviewed_at = '2026-09-01T14:00:30.000Z'
      WHERE id = ?
    `).run(ownerId, ownerActor, anchorId);

    const assertionId = `proposal-upgrade-base-assertion-${ownerId}`;
    db.prepare(`
      INSERT INTO dossier_professional_assertions (
        id, dossier_id, assertion_type, statement, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES (?, ?, 'fact', 'Existing accepted assertion.', 'needs_review',
        ?, ?, '2026-09-01T14:01:00.000Z', '2026-09-01T14:01:00.000Z')
    `).run(assertionId, dossierId, ownerActor, ownerActor);
    db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES (?, ?, ?, '2026-09-01T14:01:00.000Z')
    `).run(dossierId, assertionId, anchorId);
    db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
        reviewed_at = '2026-09-01T14:01:30.000Z',
        updated_by_actor_ref = ?, updated_at = '2026-09-01T14:01:30.000Z'
      WHERE id = ?
    `).run(ownerId, ownerActor, ownerActor, assertionId);

    const requestId = `proposal-upgrade-request-${ownerId}`;
    db.prepare(`
      INSERT INTO dossier_information_requests (
        id, dossier_id, question, owner_user_id, owner_actor_ref, reason,
        readiness_reason_code, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, ?, 'Upgrade request?', ?, ?, 'Upgrade request reason',
        'INFORMATION_REQUEST_OPEN', ?, ?,
        '2026-09-01T14:02:00.000Z', '2026-09-01T14:02:00.000Z')
    `).run(requestId, dossierId, ownerId, ownerActor, ownerActor, ownerActor);
    const deadlineId = `proposal-upgrade-deadline-${ownerId}`;
    db.prepare(`
      INSERT INTO dossier_deadline_references (
        id, dossier_id, deadline_kind, title, due_at, timezone, critical,
        status, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, ?, 'workspace', 'Upgrade deadline',
        '2026-10-01T12:00:00.000Z', 'UTC', true, 'open', ?, ?,
        '2026-09-01T14:02:30.000Z', '2026-09-01T14:02:30.000Z')
    `).run(deadlineId, dossierId, ownerActor, ownerActor);

    const packages = [
      {
        id: `proposal-upgrade-package-a-${ownerId}`,
        packageId: `package-a-${ownerId}`,
        version: "1.0.0",
        fingerprint: digest(22_100 + ownerId),
        graphDigest: digest(22_200 + ownerId),
      },
      {
        id: `proposal-upgrade-package-b-${ownerId}`,
        packageId: `package-b-${ownerId}`,
        version: "2.0.0",
        fingerprint: digest(22_300 + ownerId),
        graphDigest: digest(22_400 + ownerId),
      },
    ] as const;
    for (const packageReference of packages) {
      db.prepare(`
        INSERT INTO dossier_decision_package_references (
          id, dossier_id, package_id, package_version, package_fingerprint,
          source_dossier_revision, state, graph_validation_status, graph_digest,
          approval_state, package_type_registry, package_type_id,
          package_type_version, created_by_actor_ref, updated_by_actor_ref,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, 'current', 'valid', ?, 'published',
          'genesis-juris-package-types', 'general-decision', '1.0.0', ?, ?,
          '2026-09-01T14:03:00.000Z', '2026-09-01T14:03:00.000Z')
      `).run(
        packageReference.id,
        dossierId,
        packageReference.packageId,
        packageReference.version,
        packageReference.fingerprint,
        packageReference.graphDigest,
        ownerActor,
        ownerActor,
      );
    }

    const seedProposal = (id: string, proposalType: string, proposedValue = "{}") => {
      db.prepare(`
        INSERT INTO dossier_ai_proposals (
          id, dossier_id, proposal_type, proposed_value, confidence_category,
          confidence_score, created_by_actor_ref, created_at
        ) VALUES (?, ?, ?, ?, 'high', 0.9, ?, '2026-09-01T14:04:00.000Z')
      `).run(id, dossierId, proposalType, proposedValue, ownerActor);
      db.prepare(`
        INSERT INTO dossier_ai_proposal_versions (
          dossier_id, proposal_id, document_id, document_version_id
        ) VALUES (?, ?, ?, ?)
      `).run(dossierId, id, documentId, versionId);
      db.prepare(`
        INSERT INTO dossier_ai_proposal_anchors (
          dossier_id, proposal_id, source_anchor_id
        ) VALUES (?, ?, ?)
      `).run(dossierId, id, anchorId);
    };
    const acceptProposal = (
      id: string,
      acceptedObjectType: string,
      acceptedObjectId: string,
      reviewedAt: string,
    ) => db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = ?, accepted_object_id = ?
      WHERE id = ? AND review_state = 'pending'
    `).run(ownerId, ownerActor, reviewedAt, acceptedObjectType, acceptedObjectId, id);
    const graphValue = (packageReference: typeof packages[number] | null) => JSON.stringify({
      kind: "genesis-juris-decision-package-graph-diff-v1",
      schema_version: 1,
      target: packageReference === null ? null : {
        package_id: packageReference.packageId,
        package_version: packageReference.version,
        package_fingerprint: packageReference.fingerprint,
        graph_digest: packageReference.graphDigest,
        parent_package_id: null,
        parent_package_version: null,
        parent_package_fingerprint: null,
      },
    });
    return {
      db,
      ownerId,
      ownerActor,
      ownerParticipantId,
      dossierId,
      documentId,
      versionId,
      anchorId,
      assertionId,
      requestId,
      deadlineId,
      packages,
      seedProposal,
      acceptProposal,
      graphValue,
    };
  };
  const applyThrough0014 = (db: DatabaseSync) => {
    db.exec(migration(auditClaimsMigration));
    db.exec(migration(uploadCommitmentMigration));
  };
  const expectRejectedUpgrade = (db: DatabaseSync, message: string) => {
    assert.throws(
      () => db.exec(migration(statusHistoryMigration)),
      /dossier_proposal_materialization_backfill_guard_check|CHECK constraint failed/iu,
      message,
    );
    db.close();
  };
  const addUnrelatedAnchor = (input: {
    db: DatabaseSync;
    dossierId: string;
    documentId: string;
    versionId: string;
    ownerId: number;
    ownerActor: string;
    label: string;
  }) => {
    const anchorId = `${input.dossierId}-${input.label}-anchor`;
    const checksumRow = input.db.prepare(`
      SELECT content_sha256 FROM dossier_document_versions WHERE id = ?
    `).get(input.versionId) as { content_sha256: string };
    assert.match(checksumRow.content_sha256, /^sha256-[0-9a-f]{64}$/u);
    input.db.prepare(`
      INSERT INTO dossier_source_anchors (
        id, dossier_id, document_id, document_version_id, character_start,
        character_end, excerpt, anchor_checksum, creator, review_state,
        created_by_actor_ref, created_at
      ) VALUES (?, ?, ?, ?, 21, 40, 'Unrelated upgrade anchor', ?, 'human',
        'pending', ?, '2026-09-01T14:05:00.000Z')
    `).run(
      anchorId,
      input.dossierId,
      input.documentId,
      input.versionId,
      checksumRow.content_sha256,
      input.ownerActor,
    );
    input.db.prepare(`
      UPDATE dossier_source_anchors
      SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
        reviewed_at = '2026-09-01T14:05:30.000Z'
      WHERE id = ?
    `).run(input.ownerId, input.ownerActor, anchorId);
    return anchorId;
  };

  {
    const exact = fixture();
    const assertionProposalId = `${exact.dossierId}-exact-assertion-proposal`;
    const assertionChildId = `${exact.dossierId}-exact-assertion-child`;
    const assertionReviewAt = "2026-09-01T14:10:00.000Z";
    exact.seedProposal(assertionProposalId, "fact");
    exact.db.prepare(`
      INSERT INTO dossier_professional_assertions (
        id, dossier_id, assertion_type, statement, status,
        originating_proposal_id, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, ?, 'fact', 'Exact upgraded assertion.', 'needs_review',
        ?, ?, ?, ?, ?)
    `).run(
      assertionChildId,
      exact.dossierId,
      assertionProposalId,
      exact.ownerActor,
      exact.ownerActor,
      assertionReviewAt,
      assertionReviewAt,
    );
    exact.db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES (?, ?, ?, ?)
    `).run(exact.dossierId, assertionChildId, exact.anchorId, assertionReviewAt);
    exact.db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
        reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = ?
    `).run(
      exact.ownerId,
      exact.ownerActor,
      assertionReviewAt,
      exact.ownerActor,
      assertionReviewAt,
      assertionChildId,
    );
    exact.acceptProposal(
      assertionProposalId,
      "professional_assertion",
      assertionChildId,
      assertionReviewAt,
    );

    const graphProposalId = `${exact.dossierId}-exact-graph-proposal`;
    exact.seedProposal(graphProposalId, "graph_change", exact.graphValue(exact.packages[0]));
    exact.acceptProposal(
      graphProposalId,
      "decision_package_reference",
      exact.packages[0].id,
      "2026-09-01T14:11:00.000Z",
    );

    const evidenceProposalId = `${exact.dossierId}-exact-evidence-proposal`;
    const evidenceId = `${exact.dossierId}-exact-evidence-child`;
    exact.seedProposal(evidenceProposalId, "evidence_link");
    exact.db.exec(migration(auditClaimsMigration));
    const evidenceReviewAt = "2026-09-01T14:12:00.000Z";
    exact.db.exec("BEGIN IMMEDIATE");
    try {
      advanceDossierRevision(exact.db, exact.dossierId, 1, exact.ownerActor, evidenceReviewAt);
      exact.db.prepare(`
        INSERT INTO dossier_evidence_links (
          id, dossier_id, source_anchor_id, assertion_id, target_type, target_id,
          relation, professional_meaning, created_by_actor_ref,
          reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at, created_at,
          originating_proposal_id
        ) VALUES (?, ?, ?, ?, 'professional_assertion', ?, 'supports',
          'Exact upgraded evidence.', ?, ?, ?, ?, ?, ?)
      `).run(
        evidenceId,
        exact.dossierId,
        exact.anchorId,
        exact.assertionId,
        exact.assertionId,
        exact.ownerActor,
        exact.ownerId,
        exact.ownerActor,
        evidenceReviewAt,
        evidenceReviewAt,
        evidenceProposalId,
      );
      exact.acceptProposal(evidenceProposalId, "evidence_link", evidenceId, evidenceReviewAt);
      appendAudit(exact.db, {
        id: `${evidenceProposalId}-audit`,
        dossierId: exact.dossierId,
        dossierRevision: 2,
        sequence: 2,
        eventType: "proposal_reviewed",
        objectRefType: "ai_proposal",
        objectRefId: evidenceProposalId,
        actorUserId: exact.ownerId,
        actorRef: exact.ownerActor,
        actorRole: "owner",
        occurredAt: evidenceReviewAt,
        previousEventId: `${exact.dossierId}-audit-created`,
        digestSeed: 22_500,
      });
      appendRevisionReceipt(exact.db, exact.dossierId, 2, exact.ownerActor, evidenceReviewAt);
      exact.db.exec("COMMIT");
    } catch (error) {
      exact.db.exec("ROLLBACK");
      throw error;
    }
    exact.db.exec(migration(uploadCommitmentMigration));
    exact.db.exec(migration(statusHistoryMigration));
    assert.equal(exact.db.prepare(`
      SELECT count(*) AS count FROM dossier_ai_proposals
      WHERE dossier_id = ? AND review_state = 'accepted'
    `).get(exact.dossierId)?.count, 3);
    assert.equal(exact.db.prepare(`
      SELECT count(*) AS count FROM dossier_proposal_materialization_commitments
      WHERE dossier_id = ?
    `).get(exact.dossierId)?.count, 2,
    "only exact assertion and evidence children need deferred materialization commitments");
    assert.deepEqual(exact.db.prepare("PRAGMA foreign_key_check").all(), []);
    exact.db.close();
  }

  for (const input of [
    { proposalType: "participant", objectType: "participant", object: "ownerParticipantId" },
    { proposalType: "document_metadata", objectType: "document", object: "documentId" },
    { proposalType: "information_request", objectType: "information_request", object: "requestId" },
    { proposalType: "deadline", objectType: "deadline_reference", object: "deadlineId" },
  ] as const) {
    const unsupported = fixture();
    const proposalId = `${unsupported.dossierId}-unsupported-${input.objectType}`;
    unsupported.seedProposal(proposalId, input.proposalType);
    unsupported.acceptProposal(
      proposalId,
      input.objectType,
      String(unsupported[input.object]),
      "2026-09-01T14:20:00.000Z",
    );
    applyThrough0014(unsupported.db);
    expectRejectedUpgrade(
      unsupported.db,
      `0015 must reject the unsupported accepted ${input.objectType} branch`,
    );
  }

  {
    const missingOrigin = fixture();
    const proposalId = `${missingOrigin.dossierId}-missing-origin`;
    missingOrigin.seedProposal(proposalId, "fact");
    missingOrigin.acceptProposal(
      proposalId,
      "professional_assertion",
      missingOrigin.assertionId,
      "2026-09-01T14:21:00.000Z",
    );
    applyThrough0014(missingOrigin.db);
    expectRejectedUpgrade(
      missingOrigin.db,
      "an accepted assertion proposal cannot backfill against a child with null origin",
    );
  }

  {
    const wrongOrigin = fixture();
    const originProposalId = `${wrongOrigin.dossierId}-actual-origin`;
    const acceptingProposalId = `${wrongOrigin.dossierId}-wrong-origin-review`;
    const childId = `${wrongOrigin.dossierId}-wrong-origin-child`;
    const reviewedAt = "2026-09-01T14:22:00.000Z";
    wrongOrigin.seedProposal(originProposalId, "fact");
    wrongOrigin.seedProposal(acceptingProposalId, "fact");
    wrongOrigin.db.prepare(`
      INSERT INTO dossier_professional_assertions (
        id, dossier_id, assertion_type, statement, status,
        originating_proposal_id, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, ?, 'fact', 'Wrong origin child.', 'needs_review', ?, ?, ?, ?, ?)
    `).run(
      childId,
      wrongOrigin.dossierId,
      originProposalId,
      wrongOrigin.ownerActor,
      wrongOrigin.ownerActor,
      reviewedAt,
      reviewedAt,
    );
    wrongOrigin.db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES (?, ?, ?, ?)
    `).run(wrongOrigin.dossierId, childId, wrongOrigin.anchorId, reviewedAt);
    wrongOrigin.db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
        reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = ? AND status = 'needs_review'
    `).run(
      wrongOrigin.ownerId,
      wrongOrigin.ownerActor,
      reviewedAt,
      wrongOrigin.ownerActor,
      reviewedAt,
      childId,
    );
    wrongOrigin.acceptProposal(
      acceptingProposalId,
      "professional_assertion",
      childId,
      reviewedAt,
    );
    applyThrough0014(wrongOrigin.db);
    expectRejectedUpgrade(
      wrongOrigin.db,
      "an accepted proposal cannot adopt another proposal's origin child",
    );
  }

  {
    const wrongAssertionAnchor = fixture();
    const unrelatedAnchorId = addUnrelatedAnchor({
      ...wrongAssertionAnchor,
      label: "wrong-assertion-source",
    });
    const proposalId = `${wrongAssertionAnchor.dossierId}-wrong-assertion-source`;
    const childId = `${proposalId}-child`;
    const reviewedAt = "2026-09-01T14:22:10.000Z";
    wrongAssertionAnchor.seedProposal(proposalId, "fact");
    wrongAssertionAnchor.db.prepare(`
      INSERT INTO dossier_professional_assertions (
        id, dossier_id, assertion_type, statement, status,
        originating_proposal_id, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, ?, 'fact', 'Wrong assertion source.', 'needs_review',
        ?, ?, ?, ?, ?)
    `).run(
      childId,
      wrongAssertionAnchor.dossierId,
      proposalId,
      wrongAssertionAnchor.ownerActor,
      wrongAssertionAnchor.ownerActor,
      reviewedAt,
      reviewedAt,
    );
    wrongAssertionAnchor.db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES (?, ?, ?, ?)
    `).run(wrongAssertionAnchor.dossierId, childId, unrelatedAnchorId, reviewedAt);
    wrongAssertionAnchor.db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
        reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = ?
    `).run(
      wrongAssertionAnchor.ownerId,
      wrongAssertionAnchor.ownerActor,
      reviewedAt,
      wrongAssertionAnchor.ownerActor,
      reviewedAt,
      childId,
    );
    wrongAssertionAnchor.acceptProposal(
      proposalId,
      "professional_assertion",
      childId,
      reviewedAt,
    );
    applyThrough0014(wrongAssertionAnchor.db);
    expectRejectedUpgrade(
      wrongAssertionAnchor.db,
      "0015 must reject an exact-origin assertion whose sources differ from its proposal anchors",
    );
  }

  {
    const wrongEvidenceAnchor = fixture();
    const unrelatedAnchorId = addUnrelatedAnchor({
      ...wrongEvidenceAnchor,
      label: "wrong-evidence-source",
    });
    const proposalId = `${wrongEvidenceAnchor.dossierId}-wrong-evidence-source`;
    const evidenceId = `${proposalId}-child`;
    const reviewedAt = "2026-09-01T14:22:20.000Z";
    wrongEvidenceAnchor.seedProposal(proposalId, "evidence_link");
    wrongEvidenceAnchor.db.exec(migration(auditClaimsMigration));
    wrongEvidenceAnchor.db.exec("BEGIN IMMEDIATE");
    try {
      advanceDossierRevision(
        wrongEvidenceAnchor.db,
        wrongEvidenceAnchor.dossierId,
        1,
        wrongEvidenceAnchor.ownerActor,
        reviewedAt,
      );
      wrongEvidenceAnchor.db.prepare(`
        INSERT INTO dossier_evidence_links (
          id, dossier_id, source_anchor_id, assertion_id, target_type, target_id,
          relation, professional_meaning, created_by_actor_ref,
          reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at, created_at,
          originating_proposal_id
        ) VALUES (?, ?, ?, ?, 'professional_assertion', ?, 'supports',
          'Wrong evidence source.', ?, ?, ?, ?, ?, ?)
      `).run(
        evidenceId,
        wrongEvidenceAnchor.dossierId,
        unrelatedAnchorId,
        wrongEvidenceAnchor.assertionId,
        wrongEvidenceAnchor.assertionId,
        wrongEvidenceAnchor.ownerActor,
        wrongEvidenceAnchor.ownerId,
        wrongEvidenceAnchor.ownerActor,
        reviewedAt,
        reviewedAt,
        proposalId,
      );
      wrongEvidenceAnchor.acceptProposal(proposalId, "evidence_link", evidenceId, reviewedAt);
      appendAudit(wrongEvidenceAnchor.db, {
        id: `${proposalId}-audit`,
        dossierId: wrongEvidenceAnchor.dossierId,
        dossierRevision: 2,
        sequence: 2,
        eventType: "proposal_reviewed",
        objectRefType: "ai_proposal",
        objectRefId: proposalId,
        actorUserId: wrongEvidenceAnchor.ownerId,
        actorRef: wrongEvidenceAnchor.ownerActor,
        actorRole: "owner",
        occurredAt: reviewedAt,
        previousEventId: `${wrongEvidenceAnchor.dossierId}-audit-created`,
        digestSeed: 22_501,
      });
      appendRevisionReceipt(
        wrongEvidenceAnchor.db,
        wrongEvidenceAnchor.dossierId,
        2,
        wrongEvidenceAnchor.ownerActor,
        reviewedAt,
      );
      wrongEvidenceAnchor.db.exec("COMMIT");
    } catch (error) {
      wrongEvidenceAnchor.db.exec("ROLLBACK");
      throw error;
    }
    wrongEvidenceAnchor.db.exec(migration(uploadCommitmentMigration));
    expectRejectedUpgrade(
      wrongEvidenceAnchor.db,
      "0015 must reject an exact-origin evidence child outside its proposal anchor set",
    );
  }

  for (const [label, target, acceptedIndex] of [
    ["wrong-target", "package-a", 1],
    ["null-target", null, 0],
  ] as const) {
    const graph = fixture();
    const proposalId = `${graph.dossierId}-graph-${label}`;
    graph.seedProposal(
      proposalId,
      "graph_change",
      graph.graphValue(target === null ? null : graph.packages[0]),
    );
    graph.acceptProposal(
      proposalId,
      "decision_package_reference",
      graph.packages[acceptedIndex].id,
      "2026-09-01T14:23:00.000Z",
    );
    applyThrough0014(graph.db);
    expectRejectedUpgrade(
      graph.db,
      `0015 must reject ${label} graph materialization during backfill`,
    );
  }
});

test("owner/participant retention and composite references fail closed across dossiers", () => {
  const db = legacyDossierDatabase();
  const ownerA = user(db, "owner-a@example.com", "Owner A");
  const ownerB = user(db, "owner-b@example.com", "Owner B");
  const viewer = user(db, "viewer@example.com", "Viewer");
  const viewerActor = actor(db, viewer);
  const ownerActorA = actor(db, ownerA);
  const ownerParticipantA = dossier(db, "dossier-a", ownerA);
  const ownerParticipantB = dossier(db, "dossier-b", ownerB);
  db.prepare(`
    INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('participant-a-viewer', 'dossier-a', ?, ?, 'Viewer', 'viewer', 'active', ?, ?)
  `).run(viewer, viewerActor, ownerActorA, ownerActorA);

  assert.throws(() => db.prepare("DELETE FROM users WHERE id = ?").run(ownerA), /FOREIGN KEY|append-only/iu);
  assert.throws(() => db.prepare("DELETE FROM users WHERE id = ?").run(viewer), /FOREIGN KEY|append-only/iu);
  assert.throws(
    () => db.prepare("UPDATE dossier_participants SET status = 'removed' WHERE id = ?").run(ownerParticipantA),
    /owner participant/iu,
  );
  assert.throws(() => db.prepare("DELETE FROM dossier_participants WHERE id = ?").run(ownerParticipantA), /owner|hard-deleted/iu);
  assert.throws(() => db.prepare("DELETE FROM dossiers WHERE id = 'dossier-a'").run(), /hard-deleted/iu);
  assert.notEqual(ownerParticipantA, ownerParticipantB);

  const hashA = addDocument(db, { dossierId: "dossier-a", documentId: "document-a", versionId: "version-a", hashSeed: 10 });
  addDocument(db, { dossierId: "dossier-b", documentId: "document-b", versionId: "version-b", hashSeed: 20 });
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum,
      creator, review_state, created_by_actor_ref
    ) VALUES ('cross-anchor', 'dossier-a', 'document-a', 'version-b', ?, 'human', 'pending', 'actor:test')
  `).run(digest(30)), /FOREIGN KEY/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_information_requests (
      id, dossier_id, question, owner_user_id, owner_actor_ref, requested_from_participant_id,
      reason, readiness_reason_code, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('request-a', 'dossier-a', 'Question?', ?, ?, ?, 'Need source',
      'INFORMATION_REQUEST_OPEN', ?, ?)
  `).run(ownerA, ownerActorA, ownerParticipantB, ownerActorA, ownerActorA), /FOREIGN KEY/iu);

  db.prepare(`
    INSERT INTO dossier_snapshots (
      id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
      status, readiness, locale, audience, classification, redaction_profile_id,
      contract_version, report_model_schema_version, renderer_version, build_version,
      manifest_object_reference, manifest_byte_length, manifest_digest, created_by_actor_ref
    ) VALUES ('snapshot-a', 'dossier-a', 1, '{}', '{}', 'draft', '{}', 'en', 'internal',
      'confidential', 'pilot-default', '1.0.0', 1, '1.0.0', 'test', ?, 512, ?, ?)
  `).run(`private/manifests/${"m".repeat(40)}`, digest(40), ownerActorA);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_snapshot_document_versions
      (dossier_id, snapshot_id, document_id, document_version_id, content_sha256)
    VALUES ('dossier-a', 'snapshot-a', 'document-a', 'version-b', ?)
  `).run(hashA), /FOREIGN KEY/iu);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposals
      (id, dossier_id, proposal_type, proposed_value, review_state, reviewing_user_id,
       reviewing_actor_ref, reviewed_at, accepted_object_type, accepted_object_id, created_by_actor_ref)
    VALUES ('proposal-a', 'dossier-a', 'document_metadata', '{}', 'accepted', ?, ?,
      '2026-09-01T01:00:00.000Z', 'document', 'document-b', ?)
  `).run(ownerA, ownerActorA, ownerActorA), /pending and unreviewed/iu);
});

test("document versions are monotonic and upload commit/cleanup is idempotent and byte-bound", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "version-owner@example.com", "Version Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "version-dossier", ownerId);

  addDocument(db, { dossierId: "version-dossier", documentId: "history-doc", versionId: "history-v1", hashSeed: 101 });
  assert.equal(db.prepare(`
    SELECT document_version_id FROM dossier_document_current_versions
    WHERE dossier_id = 'version-dossier' AND document_id = 'history-doc'
  `).get()?.document_version_id, "history-v1");
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'history-doc'").get()?.is_provisional, 0);
  assert.throws(() => addDocument(db, {
    dossierId: "version-dossier", documentId: "history-doc", versionId: "history-v3",
    ordinal: 3, predecessorVersionId: "history-v1", hashSeed: 103,
  }), /prior ordinal/iu);
  addDocument(db, {
    dossierId: "version-dossier", documentId: "history-doc", versionId: "history-v2",
    ordinal: 2, predecessorVersionId: "history-v1", hashSeed: 102,
  });
  db.prepare(`
    UPDATE dossier_document_current_versions
    SET document_version_id = 'history-v2', updated_at = '2026-09-01T01:00:00.000Z', updated_by_actor_ref = 'actor:test'
    WHERE dossier_id = 'version-dossier' AND document_id = 'history-doc'
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_document_current_versions SET document_version_id = 'history-v1'
    WHERE dossier_id = 'version-dossier' AND document_id = 'history-doc'
  `).run(), /latest immutable ordinal/iu);
  assert.throws(() => db.prepare("UPDATE dossier_document_versions SET source_note = 'rewrite' WHERE id = 'history-v1'").run(), /immutable/iu);
  assert.throws(() => db.prepare("DELETE FROM dossier_document_versions WHERE id = 'history-v1'").run(), /immutable/iu);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_document_current_versions
    WHERE dossier_id = 'version-dossier' AND document_id = 'history-doc'
  `).run(), /pointer cannot be deleted/iu);

  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, is_provisional, classification,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('upload-doc', 'version-dossier', 'Upload', 'source', 'internal_upload',
      true, 'confidential', 'actor:test', 'actor:test')
  `).run();
  assert.throws(
    () => db.prepare("UPDATE dossier_documents SET is_provisional = false WHERE id = 'upload-doc'").run(),
    /contract-complete current version receipt/iu,
  );
  const uploadHash = digest(110);
  const objectRef = `private/dossier/version-dossier/upload-v1/${"u".repeat(32)}`;
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference, original_filename,
      media_type, byte_length, content_sha256, uploader_actor_ref, uploaded_at, created_by_actor_ref
    ) VALUES ('unbound-v1', 'version-dossier', 'upload-doc', 1, ?, 'upload.txt',
      'text/plain', 256, ?, 'actor:test', '2026-09-01T00:00:00.000Z', 'actor:test')
  `).run(objectRef, uploadHash), /require an upload intent/iu);
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expected_content_sha256, expires_at
    ) VALUES ('intent-commit', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 1, ?,
      'text/plain', 256, ?, '2099-01-01T02:00:00.000Z')
  `).run(ownerId, ownerActor, digest(111), digest(1_111), `temporary/${"t".repeat(40)}`, uploadHash);
  assert.throws(() => db.prepare(`
    UPDATE dossier_upload_intents SET request_binding_digest = ? WHERE id = 'intent-commit'
  `).run(digest(1_112)), /identity is immutable/iu);
  db.prepare(`
    UPDATE dossier_upload_intents
    SET committed_object_reference = ?, measured_media_type = 'text/plain',
      measured_byte_length = 256, measured_content_sha256 = ?
    WHERE id = 'intent-commit'
  `).run(objectRef, uploadHash);
  db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference, original_filename,
      media_type, byte_length, content_sha256, uploader_user_id, uploader_actor_ref,
      upload_intent_id, uploaded_at, created_by_actor_ref
    ) VALUES ('upload-v1', 'version-dossier', 'upload-doc', 1, ?, 'upload.txt',
      'text/plain', 256, ?, ?, ?, 'intent-commit',
      '2026-09-01T00:30:00.000Z', ?)
  `).run(objectRef, uploadHash, ownerId, ownerActor, ownerActor);
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'upload-doc'").get()?.is_provisional, 1);
  db.prepare(`
    INSERT INTO dossier_document_current_versions
      (dossier_id, document_id, document_version_id, updated_by_actor_ref)
    VALUES ('version-dossier', 'upload-doc', 'upload-v1', ?)
  `).run(ownerActor);
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'upload-doc'").get()?.is_provisional, 1);
  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    UPDATE dossiers SET revision = revision + 1, updated_at = '2026-09-01T00:31:00.000Z',
      updated_by_actor_ref = ? WHERE id = 'version-dossier'
  `).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('version-dossier-audit-2', 'version-dossier', 2, 2,
      'document_version_created', 'document_version', 'upload-v1', ?, ?, 'owner',
      '2026-09-01T00:31:00.000Z', 'DOCUMENT_VERSION_CREATED',
      'version-dossier-audit-created', ?)
  `).run(ownerId, ownerActor, digest(1_201));
  db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
    VALUES ('version-dossier', 2, ?, '2026-09-01T00:31:00.000Z')
  `).run(ownerActor);
  db.prepare(`
    UPDATE dossier_upload_intents SET state = 'committed', committed_at = '2026-09-01T00:31:00.000Z',
      updated_at = '2026-09-01T00:31:00.000Z' WHERE id = 'intent-commit'
  `).run();
  db.exec("COMMIT");
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'upload-doc'").get()?.is_provisional, 0);
  assert.throws(() => db.prepare("UPDATE dossier_documents SET is_provisional = true WHERE id = 'upload-doc'").run(), /cannot reverse/iu);
  assert.throws(() => db.prepare("UPDATE dossier_upload_intents SET state = 'deleting' WHERE id = 'intent-commit'").run(), /terminal|invalid upload|unreferenced/iu);

  const laterHash = digest(118);
  const laterObjectRef = `private/dossier/version-dossier/upload-v2/${"v".repeat(32)}`;
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expected_content_sha256, expires_at
    ) VALUES ('intent-later-version', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 2, ?,
      'text/plain', 300, ?, '2099-01-01T00:00:00.000Z')
  `).run(ownerId, ownerActor, digest(119), digest(1_119), `temporary/${"l".repeat(40)}`, laterHash);
  db.prepare(`
    UPDATE dossier_upload_intents
    SET committed_object_reference = ?, measured_media_type = 'text/plain',
      measured_byte_length = 300, measured_content_sha256 = ?
    WHERE id = 'intent-later-version'
  `).run(laterObjectRef, laterHash);
  db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference, original_filename,
      media_type, byte_length, content_sha256, uploader_user_id, uploader_actor_ref,
      upload_intent_id, uploaded_at, predecessor_version_id, created_by_actor_ref
    ) VALUES ('upload-v2', 'version-dossier', 'upload-doc', 2, ?, 'upload-2.txt',
      'text/plain', 300, ?, ?, ?, 'intent-later-version',
      '2026-09-01T00:32:00.000Z', 'upload-v1', ?)
  `).run(laterObjectRef, laterHash, ownerId, ownerActor, ownerActor);
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'upload-doc'").get()?.is_provisional, 0);
  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    UPDATE dossier_document_current_versions SET document_version_id = 'upload-v2',
      updated_at = '2026-09-01T00:33:00.000Z', updated_by_actor_ref = ?
    WHERE dossier_id = 'version-dossier' AND document_id = 'upload-doc'
  `).run(ownerActor);
  db.prepare(`UPDATE dossiers SET revision = 3, updated_at = '2026-09-01T00:33:00.000Z', updated_by_actor_ref = ? WHERE id = 'version-dossier'`).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('version-dossier-audit-3', 'version-dossier', 3, 3,
      'document_version_created', 'document_version', 'upload-v2', ?, ?, 'owner',
      '2026-09-01T00:33:00.000Z', 'DOCUMENT_VERSION_CREATED',
      'version-dossier-audit-2', ?)
  `).run(ownerId, ownerActor, digest(1_202));
  db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
    VALUES ('version-dossier', 3, ?, '2026-09-01T00:33:00.000Z')
  `).run(ownerActor);
  db.prepare(`
    UPDATE dossier_upload_intents SET state = 'committed', committed_at = '2026-09-01T00:33:00.000Z',
      updated_at = '2026-09-01T00:33:00.000Z' WHERE id = 'intent-later-version'
  `).run();
  db.exec("COMMIT");
  assert.throws(() => db.prepare("DELETE FROM dossier_documents WHERE id = 'upload-doc'").run(), /zero-version provisional/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('intent-duplicate', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 1, '2099-01-01T02:00:00.000Z')
  `).run(ownerId, ownerActor, digest(111), digest(1_113), `temporary/${"d".repeat(40)}`), /UNIQUE/iu);

  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('intent-clean', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 1, '2099-01-01T00:00:00.000Z')
  `).run(ownerId, ownerActor, digest(112), digest(1_112), `temporary/${"c".repeat(40)}`);
  db.prepare(`
    UPDATE dossier_upload_intents SET state = 'deleting', failure_code = 'R2_WRITE_FAILED'
    WHERE id = 'intent-clean'
  `).run();
  db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = 'intent-clean'").run();
  assert.equal(db.prepare("SELECT state FROM dossier_upload_intents WHERE id = 'intent-clean'").get()?.state, "deleted");
  db.prepare("DELETE FROM dossier_upload_intents WHERE id = 'intent-clean'").run();
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('intent-clean-retry', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 1, '2099-01-01T00:00:00.000Z')
  `).run(ownerId, ownerActor, digest(112), digest(1_112), `temporary/${"n".repeat(40)}`);
  assert.throws(
    () => db.prepare("UPDATE dossier_upload_intents SET state = 'deleting' WHERE id = 'intent-clean-retry'").run(),
    /expired unreferenced/iu,
  );
  db.prepare(`
    UPDATE dossier_upload_intents
    SET state = 'deleting', failure_code = 'COMMIT_FAILED', updated_at = '2026-09-01T00:39:00.000Z'
    WHERE id = 'intent-clean-retry'
  `).run();
  db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = 'intent-clean-retry'").run();
  db.prepare("DELETE FROM dossier_upload_intents WHERE id = 'intent-clean-retry'").run();

  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('intent-mismatch', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 100, '2099-01-01T00:00:00.000Z')
  `).run(ownerId, ownerActor, digest(113), digest(1_113), `temporary/${"q".repeat(40)}`);
  db.prepare(`
    UPDATE dossier_upload_intents
    SET committed_object_reference = ?, measured_media_type = 'text/markdown',
      measured_byte_length = 200, measured_content_sha256 = ?
    WHERE id = 'intent-mismatch'
  `).run(`private/dossier/${"q".repeat(40)}`, digest(114));
  assert.throws(() => db.prepare(`
    UPDATE dossier_upload_intents SET committed_object_reference = null
    WHERE id = 'intent-mismatch'
  `).run(), /written exactly once/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_upload_intents
    SET state = 'committed', committed_at = '2026-09-01T00:40:00.000Z'
    WHERE id = 'intent-mismatch'
  `).run(), /measured pending upload intent/iu);
  assert.throws(() => db.prepare("UPDATE dossier_upload_intents SET state = 'deleting' WHERE id = 'intent-mismatch'").run(), /expired unreferenced/iu);
  db.prepare(`
    UPDATE dossier_upload_intents SET state = 'deleting', failure_code = 'MEASUREMENT_MISMATCH'
    WHERE id = 'intent-mismatch'
  `).run();
  db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = 'intent-mismatch'").run();
  db.prepare("DELETE FROM dossier_upload_intents WHERE id = 'intent-mismatch'").run();

  const referencedTemporary = `private/dossier/${"r".repeat(40)}`;
  addDocument(db, {
    dossierId: "version-dossier", documentId: "cleanup-ref-doc", versionId: "cleanup-ref-v1",
    hashSeed: 115, binaryObjectReference: referencedTemporary,
  });
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('intent-referenced-key', 'version-dossier', 'cleanup-ref-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 128, '2099-01-01T00:00:00.000Z')
  `).run(ownerId, ownerActor, digest(116), digest(1_116), referencedTemporary);
  assert.throws(() => db.prepare(`
    UPDATE dossier_upload_intents
    SET state = 'deleting', failure_code = 'COMMIT_FAILED'
    WHERE id = 'intent-referenced-key'
  `).run(), /unreferenced upload/iu);

  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('intent-cleanup-retry', 'version-dossier', 'upload-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 1, '2099-01-01T00:00:00.000Z')
  `).run(ownerId, ownerActor, digest(117), digest(1_117), `temporary/${"f".repeat(40)}`);
  db.prepare(`
    UPDATE dossier_upload_intents SET state = 'deleting', failure_code = 'R2_DELETE_FAILED'
    WHERE id = 'intent-cleanup-retry'
  `).run();
  assert.equal(db.prepare("SELECT state FROM dossier_upload_intents WHERE id = 'intent-cleanup-retry'").get()?.state, "deleting",
    "an R2 cleanup failure leaves the intent claimed for a safe retry");
  db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = 'intent-cleanup-retry'").run();
  assert.throws(() => db.prepare("UPDATE dossier_upload_intents SET state = 'deleting' WHERE id = 'intent-cleanup-retry'").run(), /terminal|invalid upload|expired unreferenced/iu);
  db.prepare("DELETE FROM dossier_upload_intents WHERE id = 'intent-cleanup-retry'").run();

  const rollbackHash = digest(120);
  const rollbackObjectRef = `private/dossier/version-dossier/rollback-v1/${"b".repeat(32)}`;
  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, classification,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('rollback-upload-doc', 'version-dossier', 'Rollback upload', 'source',
      'internal_upload', 'confidential', ?, ?)
  `).run(ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expected_content_sha256, expires_at
    ) VALUES ('rollback-intent', 'version-dossier', 'rollback-upload-doc', ?, ?, ?, ?, 3, ?,
      'text/plain', 512, ?, '2099-01-01T00:00:00.000Z')
  `).run(
    ownerId,
    ownerActor,
    digest(121),
    digest(1_121),
    `temporary/rollback/${"a".repeat(40)}`,
    rollbackHash,
  );
  db.prepare(`
    UPDATE dossier_upload_intents
    SET committed_object_reference = ?, measured_media_type = 'text/plain',
      measured_byte_length = 512, measured_content_sha256 = ?
    WHERE id = 'rollback-intent'
  `).run(rollbackObjectRef, rollbackHash);
  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference, original_filename,
      media_type, byte_length, content_sha256, uploader_user_id, uploader_actor_ref,
      upload_intent_id, uploaded_at, created_by_actor_ref
    ) VALUES ('rollback-v1', 'version-dossier', 'rollback-upload-doc', 1, ?, 'rollback.txt',
      'text/plain', 512, ?, ?, ?, 'rollback-intent', '2026-09-01T00:50:00.000Z', ?)
  `).run(rollbackObjectRef, rollbackHash, ownerId, ownerActor, ownerActor);
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'rollback-upload-doc'").get()?.is_provisional, 1);
  db.prepare(`
    INSERT INTO dossier_document_current_versions
      (dossier_id, document_id, document_version_id, updated_by_actor_ref)
    VALUES ('version-dossier', 'rollback-upload-doc', 'rollback-v1', ?)
  `).run(ownerActor);
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'rollback-upload-doc'").get()?.is_provisional, 1);
  db.exec("ROLLBACK");
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_versions WHERE id = 'rollback-v1'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_current_versions WHERE document_id = 'rollback-upload-doc'").get()?.count, 0);
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'rollback-upload-doc'").get()?.is_provisional, 1);
  db.prepare(`
    UPDATE dossier_upload_intents SET state = 'deleting', failure_code = 'D1_COMMIT_FAILED'
    WHERE id = 'rollback-intent'
  `).run();
  db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = 'rollback-intent'").run();
  db.prepare("DELETE FROM dossier_documents WHERE id = 'rollback-upload-doc'").run();
});

test("expired pending uploads cannot commit and remain recoverable through cleanup", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "expiry-owner@example.com", "Expiry Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "expiry-dossier", ownerId);
  addDocument(db, {
    dossierId: "expiry-dossier",
    documentId: "expiry-cleanup-target",
    versionId: "expiry-cleanup-v1",
    hashSeed: 130,
  });
  const expiresAt = (db.prepare(`
    SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+2 seconds') AS value
  `).get() as { value: string }).value;
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES ('expiry-cleanup-intent', 'expiry-dossier', 'expiry-cleanup-target',
      ?, ?, ?, ?, 1, ?, 'text/plain', 64, ?)
  `).run(
    ownerId,
    ownerActor,
    digest(131),
    digest(1_131),
    `temporary/expiry-cleanup/${"c".repeat(40)}`,
    expiresAt,
  );

  const expiryHash = digest(132);
  const expiryObjectRef = `private/dossier/expiry-dossier/expiry-v1/${"e".repeat(32)}`;
  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, classification,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('expiry-upload-doc', 'expiry-dossier', 'Expiring upload', 'source',
      'internal_upload', 'confidential', ?, ?)
  `).run(ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expected_content_sha256, expires_at
    ) VALUES ('expiry-commit-intent', 'expiry-dossier', 'expiry-upload-doc',
      ?, ?, ?, ?, 1, ?, 'text/plain', 64, ?, ?)
  `).run(
    ownerId,
    ownerActor,
    digest(133),
    digest(1_133),
    `temporary/expiry-commit/${"t".repeat(40)}`,
    expiryHash,
    expiresAt,
  );
  db.prepare(`
    UPDATE dossier_upload_intents
    SET committed_object_reference = ?, measured_media_type = 'text/plain',
      measured_byte_length = 64, measured_content_sha256 = ?
    WHERE id = 'expiry-commit-intent'
  `).run(expiryObjectRef, expiryHash);

  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference, original_filename,
      media_type, byte_length, content_sha256, uploader_user_id, uploader_actor_ref,
      upload_intent_id, uploaded_at, created_by_actor_ref
    ) VALUES ('expiry-v1', 'expiry-dossier', 'expiry-upload-doc', 1, ?, 'expiry.txt',
      'text/plain', 64, ?, ?, ?, 'expiry-commit-intent', '2026-09-01T00:00:00.000Z', ?)
  `).run(expiryObjectRef, expiryHash, ownerId, ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_document_current_versions
      (dossier_id, document_id, document_version_id, updated_by_actor_ref)
    VALUES ('expiry-dossier', 'expiry-upload-doc', 'expiry-v1', ?)
  `).run(ownerActor);
  db.prepare(`
    UPDATE dossiers SET revision = 2, updated_by_actor_ref = ?
    WHERE id = 'expiry-dossier' AND revision = 1
  `).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('expiry-dossier-audit-2', 'expiry-dossier', 2, 2,
      'document_version_created', 'document_version', 'expiry-v1', ?, ?, 'owner',
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'DOCUMENT_VERSION_CREATED',
      'expiry-dossier-audit-created', ?)
  `).run(ownerId, ownerActor, digest(1_203));
  db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref)
    VALUES ('expiry-dossier', 2, ?)
  `).run(ownerActor);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_200);
  assert.throws(() => db.prepare(`
    UPDATE dossier_upload_intents
    SET state = 'committed', committed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = 'expiry-commit-intent'
  `).run(), /expired upload intent cannot commit/iu);
  db.exec("ROLLBACK");

  assert.equal(db.prepare("SELECT revision FROM dossiers WHERE id = 'expiry-dossier'").get()?.revision, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_versions WHERE id = 'expiry-v1'").get()?.count, 0);
  for (const intentId of ["expiry-cleanup-intent", "expiry-commit-intent"]) {
    db.prepare("UPDATE dossier_upload_intents SET state = 'expired' WHERE id = ?").run(intentId);
    db.prepare("UPDATE dossier_upload_intents SET state = 'deleting' WHERE id = ?").run(intentId);
    db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = ?").run(intentId);
    db.prepare("DELETE FROM dossier_upload_intents WHERE id = ?").run(intentId);
  }
  db.prepare("DELETE FROM dossier_documents WHERE id = 'expiry-upload-doc'").run();
});

test("D1 upload reservations atomically cap pending count and reserved storage", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "reservation-owner@example.com", "Reservation Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "reservation-dossier", ownerId);
  addDocument(db, {
    dossierId: "reservation-dossier",
    documentId: "reservation-target",
    versionId: "reservation-v1",
    hashSeed: 140,
  });
  const insertReservation = db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES (?, 'reservation-dossier', 'reservation-target', ?, ?, ?, ?, 1, ?,
      'text/plain', ?, '2099-01-01T00:00:00.000Z')
  `);
  assert.throws(() => insertReservation.run(
    "reservation-bare-binding",
    ownerId,
    ownerActor,
    digest(141),
    "0".repeat(64),
    `temporary/reservation/bare/${"x".repeat(40)}`,
    1,
  ), /CHECK constraint/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      committed_object_reference, expected_media_type, expected_byte_length,
      measured_media_type, measured_byte_length, measured_content_sha256, expires_at
    ) VALUES ('reservation-forged-measured', 'reservation-dossier', 'reservation-target',
      ?, ?, ?, ?, 1, ?, ?, 'text/plain', 1, 'text/plain', 1, ?,
      '2099-01-01T00:00:00.000Z')
  `).run(
    ownerId,
    ownerActor,
    digest(142),
    digest(1_142),
    `temporary/reservation/forged/${"y".repeat(40)}`,
    `private/reservation/forged/${"y".repeat(40)}`,
    digest(143),
  ), /unmeasured pending reservation/iu);
  for (let index = 1; index <= 20; index += 1) {
    insertReservation.run(
      `reservation-${index}`,
      ownerId,
      ownerActor,
      digest(200 + index),
      digest(1_200 + index),
      `temporary/reservation/${index}/${"p".repeat(40)}`,
      1,
    );
  }
  assert.throws(() => insertReservation.run(
    "reservation-21",
    ownerId,
    ownerActor,
    digest(221),
    digest(1_221),
    `temporary/reservation/21/${"p".repeat(40)}`,
    1,
  ), /pending upload reservation quota/iu);
  db.prepare(`
    UPDATE dossier_upload_intents
    SET state = 'deleting', failure_code = 'CLIENT_ABORTED'
    WHERE id = 'reservation-1'
  `).run();
  db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = 'reservation-1'").run();
  db.prepare("DELETE FROM dossier_upload_intents WHERE id = 'reservation-1'").run();
  insertReservation.run(
    "reservation-21",
    ownerId,
    ownerActor,
    digest(221),
    digest(1_221),
    `temporary/reservation/21/${"p".repeat(40)}`,
    1,
  );

  const storageDb = legacyDossierDatabase();
  const storageOwnerId = user(storageDb, "storage-owner@example.com", "Storage Owner");
  const storageOwnerActor = actor(storageDb, storageOwnerId);
  dossier(storageDb, "storage-dossier", storageOwnerId);
  addDocument(storageDb, {
    dossierId: "storage-dossier",
    documentId: "storage-target",
    versionId: "storage-v1",
    hashSeed: 150,
  });
  const insertStorageReservation = storageDb.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
      request_binding_digest, expected_dossier_revision, temporary_object_reference,
      expected_media_type, expected_byte_length, expires_at
    ) VALUES (?, 'storage-dossier', 'storage-target', ?, ?, ?, ?, 1, ?,
      'application/pdf', ?, '2099-01-01T00:00:00.000Z')
  `);
  for (let index = 1; index <= 10; index += 1) {
    insertStorageReservation.run(
      `storage-${index}`,
      storageOwnerId,
      storageOwnerActor,
      digest(300 + index),
      digest(1_300 + index),
      `temporary/storage/${index}/${"s".repeat(40)}`,
      100_000_000,
    );
  }
  insertStorageReservation.run(
    "storage-boundary",
    storageOwnerId,
    storageOwnerActor,
    digest(311),
    digest(1_311),
    `temporary/storage/boundary/${"s".repeat(40)}`,
    73_741_696,
  );
  assert.equal(storageDb.prepare(`
    SELECT
      (SELECT coalesce(sum(byte_length), 0) FROM dossier_document_versions WHERE dossier_id = 'storage-dossier')
      + (SELECT coalesce(sum(expected_byte_length), 0) FROM dossier_upload_intents
          WHERE dossier_id = 'storage-dossier' AND state = 'pending') AS reserved
  `).get()?.reserved, 1_073_741_824);
  assert.throws(() => insertStorageReservation.run(
    "storage-overflow",
    storageOwnerId,
    storageOwnerActor,
    digest(312),
    digest(1_312),
    `temporary/storage/overflow/${"s".repeat(40)}`,
    1,
  ), /storage reservation quota/iu);
});

test("interrupted new-upload cycles clean provisional documents without poisoning quota", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "provisional-owner@example.com", "Provisional Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "provisional-dossier", ownerId);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, is_provisional, classification,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('forged-final-upload', 'provisional-dossier', 'Forged', 'source',
      'internal_upload', false, 'confidential', ?, ?)
  `).run(ownerActor, ownerActor), /must begin provisional/iu);

  for (const [index, sourceOrigin] of ["external_reference", "import"].entries()) {
    const documentId = `interrupted-${sourceOrigin}`;
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_documents (
        id, dossier_id, title, document_type, source_origin, is_provisional,
        classification, created_by_actor_ref, updated_by_actor_ref
      ) VALUES (?, 'provisional-dossier', ?, 'source', ?, false, 'confidential', ?, ?)
    `).run(`${documentId}-forged`, documentId, sourceOrigin, ownerActor, ownerActor), /must begin provisional/iu);
    db.prepare(`
      INSERT INTO dossier_documents (
        id, dossier_id, title, document_type, source_origin, classification,
        created_by_actor_ref, updated_by_actor_ref
      ) VALUES (?, 'provisional-dossier', ?, 'source', ?, 'confidential', ?, ?)
    `).run(documentId, documentId, sourceOrigin, ownerActor, ownerActor);
    assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = ?").get(documentId)?.is_provisional, 1);
    db.exec("BEGIN IMMEDIATE");
    db.prepare(`
      INSERT INTO dossier_document_versions (
        id, dossier_id, document_id, ordinal, binary_object_reference,
        original_filename, media_type, byte_length, content_sha256,
        uploader_actor_ref, uploaded_at, created_by_actor_ref
      ) VALUES (?, 'provisional-dossier', ?, 1, ?, ?, 'text/plain', 64, ?,
        ?, '2026-09-01T03:00:00.000Z', ?)
    `).run(
      `${documentId}-v1`,
      documentId,
      `private/provisional/${sourceOrigin}/${"e".repeat(40)}`,
      `${sourceOrigin}.txt`,
      digest(430 + index),
      ownerActor,
      ownerActor,
    );
    assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = ?").get(documentId)?.is_provisional, 0);
    assert.equal(db.prepare(`
      SELECT count(*) AS count FROM dossier_document_current_versions
      WHERE dossier_id = 'provisional-dossier' AND document_id = ?
    `).get(documentId)?.count, 1);
    db.exec("ROLLBACK");
    assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = ?").get(documentId)?.is_provisional, 1);
    assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_versions WHERE document_id = ?").get(documentId)?.count, 0);
    assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_current_versions WHERE document_id = ?").get(documentId)?.count, 0);
    db.prepare("DELETE FROM dossier_documents WHERE id = ?").run(documentId);
  }

  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, is_provisional,
      classification, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('before-r2', 'provisional-dossier', 'Before R2', 'source',
      'internal_upload', true, 'confidential', ?, ?)
  `).run(ownerActor, ownerActor);
  db.prepare("DELETE FROM dossier_documents WHERE id = 'before-r2'").run();

  for (const index of [1, 2, 3] as const) {
    const documentId = `interrupted-${index}`;
    const intentId = `interrupted-intent-${index}`;
    const failureCode = index === 1 ? "BEFORE_R2_FAILED" : index === 2 ? "R2_WRITE_FAILED" : "D1_COMMIT_FAILED";
    db.prepare(`
      INSERT INTO dossier_documents (
        id, dossier_id, title, document_type, source_origin, is_provisional,
        classification, created_by_actor_ref, updated_by_actor_ref
      ) VALUES (?, 'provisional-dossier', ?, 'source', 'internal_upload', true,
        'confidential', ?, ?)
    `).run(documentId, documentId, ownerActor, ownerActor);
    db.prepare(`
      INSERT INTO dossier_upload_intents (
        id, dossier_id, document_id, actor_user_id, actor_ref, idempotency_key_hash,
        request_binding_digest, expected_dossier_revision, temporary_object_reference, expected_media_type,
        expected_byte_length, measured_media_type, measured_byte_length,
        measured_content_sha256, expires_at
      ) VALUES (?, 'provisional-dossier', ?, ?, ?, ?, ?, 1, ?, 'text/plain', 64,
        null, null, null, '2099-01-01T00:00:00.000Z')
    `).run(intentId, documentId, ownerId, ownerActor, digest(450 + index), digest(550 + index),
      `temporary/provisional/${index}/${"z".repeat(40)}`);
    assert.throws(() => db.prepare("DELETE FROM dossier_documents WHERE id = ?").run(documentId), /zero-version provisional/iu);
    assert.throws(() => db.prepare("DELETE FROM dossier_documents WHERE id = ?").run(documentId), /zero-version provisional/iu);
    assert.throws(
      () => db.prepare("UPDATE dossier_upload_intents SET state = 'deleting' WHERE id = ?").run(intentId),
      /expired unreferenced/iu,
    );
    db.prepare(`
      UPDATE dossier_upload_intents SET state = 'deleting', failure_code = ?
      WHERE id = ?
    `).run(failureCode, intentId);
    assert.throws(() => db.prepare("DELETE FROM dossier_documents WHERE id = ?").run(documentId), /zero-version provisional/iu);
    if (index === 2) {
      assert.equal(db.prepare("SELECT state FROM dossier_upload_intents WHERE id = ?").get(intentId)?.state, "deleting",
        "after-R2 deletion failure retains the cleanup claim");
    }
    db.prepare("UPDATE dossier_upload_intents SET state = 'deleted' WHERE id = ?").run(intentId);
    db.prepare("DELETE FROM dossier_documents WHERE id = ?").run(documentId);
    assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_upload_intents WHERE id = ?").get(intentId)?.count, 0,
      "provisional document removal cascades only completed cleanup metadata");
  }

  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, is_provisional,
      classification, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('provisional-audit-target', 'provisional-dossier', 'Assembly', 'source',
      'internal_upload', true, 'confidential', ?, ?)
  `).run(ownerActor, ownerActor);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type,
      object_ref_type, object_ref_id, actor_user_id, actor_ref, actor_role,
      occurred_at, summary_code, previous_event_id, event_digest
    ) VALUES ('provisional-audit', 'provisional-dossier', 1, 2, 'document_created',
      'document', 'provisional-audit-target', ?, ?, 'owner',
      '2026-09-01T04:00:00.000Z', 'DOCUMENT_CREATED', 'provisional-dossier-audit-created', ?)
  `).run(ownerId, ownerActor, digest(470)), /audit document reference/iu);
  db.prepare("DELETE FROM dossier_documents WHERE id = 'provisional-audit-target'").run();

  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_documents
    WHERE dossier_id = 'provisional-dossier' AND is_provisional = false
  `).get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = 'provisional-dossier'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_upload_intents WHERE dossier_id = 'provisional-dossier'").get()?.count, 0);
});

test("document and immutable version reservations enforce catalogue limits without race windows", () => {
  const documentDb = legacyDossierDatabase();
  const documentOwnerId = user(documentDb, "document-quota-owner@example.com", "Document Quota Owner");
  const documentOwnerActor = actor(documentDb, documentOwnerId);
  dossier(documentDb, "document-quota-dossier", documentOwnerId);
  const insertDocument = documentDb.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, classification,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES (?, 'document-quota-dossier', ?, 'source', 'external_reference',
      'confidential', ?, ?)
  `);
  for (let index = 1; index <= 100; index += 1) {
    insertDocument.run(`document-reservation-${index}`, `Reservation ${index}`, documentOwnerActor, documentOwnerActor);
  }
  assert.throws(
    () => insertDocument.run("document-reservation-101", "Reservation 101", documentOwnerActor, documentOwnerActor),
    /document reservation quota/iu,
  );
  assert.equal(documentDb.prepare(`
    SELECT count(*) AS count FROM dossier_documents
    WHERE dossier_id = 'document-quota-dossier' AND is_provisional = false
  `).get()?.count, 0, "provisional rows reserve catalogue capacity but never appear as finalized documents");
  documentDb.prepare("DELETE FROM dossier_documents WHERE id = 'document-reservation-1'").run();
  insertDocument.run("document-reservation-101", "Reservation 101", documentOwnerActor, documentOwnerActor);
  assert.equal(documentDb.prepare(`
    SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = 'document-quota-dossier'
  `).get()?.count, 100);

  const versionDb = legacyDossierDatabase();
  const versionOwnerId = user(versionDb, "version-quota-owner@example.com", "Version Quota Owner");
  const versionOwnerActor = actor(versionDb, versionOwnerId);
  dossier(versionDb, "version-quota-dossier", versionOwnerId);
  function appendVersions(documentIndex: number, count: number) {
    const documentId = `version-quota-doc-${documentIndex}`;
    for (let ordinal = 1; ordinal <= count; ordinal += 1) {
      const versionId = `${documentId}-v${ordinal}`;
      addDocument(versionDb, {
        dossierId: "version-quota-dossier",
        documentId,
        versionId,
        ordinal,
        predecessorVersionId: ordinal === 1 ? null : `${documentId}-v${ordinal - 1}`,
        hashSeed: 10_000 + (documentIndex * 100) + ordinal,
      });
      if (ordinal > 1) {
        versionDb.prepare(`
          UPDATE dossier_document_current_versions
          SET document_version_id = ?, updated_by_actor_ref = ?
          WHERE dossier_id = 'version-quota-dossier' AND document_id = ?
        `).run(versionId, versionOwnerActor, documentId);
      }
    }
  }
  appendVersions(1, 50);
  assert.throws(() => addDocument(versionDb, {
    dossierId: "version-quota-dossier",
    documentId: "version-quota-doc-1",
    versionId: "version-quota-doc-1-v51",
    ordinal: 51,
    predecessorVersionId: "version-quota-doc-1-v50",
    hashSeed: 10_151,
  }), /document version quota/iu);
  for (let documentIndex = 2; documentIndex <= 20; documentIndex += 1) {
    appendVersions(documentIndex, 50);
  }
  assert.equal(versionDb.prepare(`
    SELECT count(*) AS count FROM dossier_document_versions
    WHERE dossier_id = 'version-quota-dossier'
  `).get()?.count, 1_000);
  versionDb.exec("BEGIN IMMEDIATE");
  try {
    assert.throws(() => addDocument(versionDb, {
      dossierId: "version-quota-dossier",
      documentId: "version-quota-doc-21",
      versionId: "version-quota-doc-21-v1",
      hashSeed: 12_101,
    }), /dossier version quota/iu);
  } finally {
    versionDb.exec("ROLLBACK");
  }
  assert.equal(versionDb.prepare(`
    SELECT count(*) AS count FROM dossier_documents WHERE id = 'version-quota-doc-21'
  `).get()?.count, 0);
});

test("reviewed provenance, AI proposals, requests and package lineage fail closed", () => {
  const db = legacyDossierDatabase();
  const ownerA = user(db, "provenance-owner-a@example.com", "Provenance Owner A");
  const ownerB = user(db, "provenance-owner-b@example.com", "Provenance Owner B");
  const reviewer = user(db, "provenance-reviewer@example.com", "Provenance Reviewer");
  const ownerActorA = actor(db, ownerA);
  const reviewerActor = actor(db, reviewer);
  dossier(db, "provenance-a", ownerA);
  dossier(db, "provenance-b", ownerB);
  db.prepare(`
    INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('provenance-reviewer', 'provenance-a', ?, ?, 'Reviewer', 'reviewer', 'active', ?, ?)
  `).run(reviewer, reviewerActor, ownerActorA, ownerActorA);
  const versionHashA = addDocument(db, {
    dossierId: "provenance-a", documentId: "provenance-doc-a", versionId: "provenance-v-a", hashSeed: 301,
  });
  addDocument(db, {
    dossierId: "provenance-b", documentId: "provenance-doc-b", versionId: "provenance-v-b", hashSeed: 302,
  });
  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, classification,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('provisional-governed-target', 'provenance-a', 'Assembly target', 'source',
      'internal_upload', 'confidential', ?, ?)
  `).run(ownerActorA, ownerActorA);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum, creator,
      review_state, reviewer_user_id, reviewer_actor_ref, reviewed_at, created_by_actor_ref
    ) VALUES ('forged-accepted-anchor', 'provenance-a', 'provenance-doc-a', 'provenance-v-a', ?,
      'human', 'accepted', ?, ?, '2026-09-01T05:00:00.000Z', ?)
  `).run(digest(303), reviewer, reviewerActor, ownerActorA), /must enter review as pending/iu);
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('reviewed-anchor', 'provenance-a', 'provenance-doc-a', 'provenance-v-a', ?, 'human', ?)
  `).run(digest(304), ownerActorA);
  assert.throws(() => db.prepare(`
    UPDATE dossier_source_anchors SET review_state = 'accepted', reviewer_user_id = ?,
      reviewer_actor_ref = ?, reviewed_at = '2026-09-01T05:01:00.000Z' WHERE id = 'reviewed-anchor'
  `).run(reviewer, ownerActorA), /active bound participant/iu);
  db.prepare(`
    UPDATE dossier_source_anchors SET review_state = 'accepted', reviewer_user_id = ?,
      reviewer_actor_ref = ?, reviewed_at = '2026-09-01T05:01:00.000Z' WHERE id = 'reviewed-anchor'
  `).run(reviewer, reviewerActor);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('bare-hash-anchor', 'provenance-a', 'provenance-doc-a', 'provenance-v-a', ?, 'human', ?)
  `).run("0".repeat(64), ownerActorA), /CHECK constraint/iu);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, status, reviewed_by_user_id,
      reviewed_by_actor_ref, reviewed_at, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('forged-accepted-assertion', 'provenance-a', 'fact', 'Forged', 'accepted', ?, ?,
      '2026-09-01T05:02:00.000Z', ?, ?)
  `).run(reviewer, reviewerActor, ownerActorA, ownerActorA), /must enter review as needs_review/iu);
  db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('reviewed-assertion', 'provenance-a', 'fact', 'Supported fact', ?, ?)
  `).run(ownerActorA, ownerActorA);
  assert.throws(() => db.prepare(`
    UPDATE dossier_professional_assertions SET status = 'accepted', reviewed_by_user_id = ?,
      reviewed_by_actor_ref = ?, reviewed_at = '2026-09-01T05:03:00.000Z'
    WHERE id = 'reviewed-assertion'
  `).run(reviewer, reviewerActor), /accepted source anchor/iu);
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('mixed-pending-anchor', 'provenance-a', 'provenance-doc-a', 'provenance-v-a', ?, 'human', ?)
  `).run(digest(306), ownerActorA);
  db.prepare(`
    INSERT INTO dossier_assertion_sources (dossier_id, assertion_id, source_anchor_id)
    VALUES ('provenance-a', 'reviewed-assertion', 'reviewed-anchor')
  `).run();
  db.prepare(`
    INSERT INTO dossier_assertion_sources (dossier_id, assertion_id, source_anchor_id)
    VALUES ('provenance-a', 'reviewed-assertion', 'mixed-pending-anchor')
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_professional_assertions SET status = 'accepted', reviewed_by_user_id = ?,
      reviewed_by_actor_ref = ?, reviewed_at = '2026-09-01T05:03:00.000Z',
      updated_by_actor_ref = ? WHERE id = 'reviewed-assertion'
  `).run(reviewer, reviewerActor, reviewerActor), /only accepted source anchors/iu);
  db.prepare(`
    UPDATE dossier_source_anchors SET review_state = 'accepted', reviewer_user_id = ?,
      reviewer_actor_ref = ?, reviewed_at = '2026-09-01T05:02:30.000Z'
    WHERE id = 'mixed-pending-anchor'
  `).run(reviewer, reviewerActor);
  db.prepare(`
    UPDATE dossier_professional_assertions SET status = 'accepted', reviewed_by_user_id = ?,
      reviewed_by_actor_ref = ?, reviewed_at = '2026-09-01T05:03:00.000Z', updated_by_actor_ref = ?
    WHERE id = 'reviewed-assertion'
  `).run(reviewer, reviewerActor, reviewerActor);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_assertion_sources
    WHERE dossier_id = 'provenance-a' AND assertion_id = 'reviewed-assertion'
  `).run(), /reviewed assertion provenance/iu);

  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('pending-anchor', 'provenance-a', 'provenance-doc-a', 'provenance-v-a', ?, 'human', ?)
  `).run(digest(305), ownerActorA);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_evidence_links (
      id, dossier_id, source_anchor_id, assertion_id, target_type, target_id, relation,
      professional_meaning, created_by_actor_ref, reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
    ) VALUES ('bad-evidence', 'provenance-a', 'pending-anchor', 'reviewed-assertion',
      'professional_assertion', 'reviewed-assertion', 'supports', 'Pending source', ?, ?, ?,
      '2026-09-01T05:04:00.000Z')
  `).run(ownerActorA, reviewer, reviewerActor), /accepted provenance/iu);
  db.prepare(`
    INSERT INTO dossier_evidence_links (
      id, dossier_id, source_anchor_id, assertion_id, target_type, target_id, relation,
      professional_meaning, created_by_actor_ref, reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
    ) VALUES ('reviewed-evidence', 'provenance-a', 'reviewed-anchor', 'reviewed-assertion',
      'professional_assertion', 'reviewed-assertion', 'supports', 'Reviewed support', ?, ?, ?,
      '2026-09-01T05:04:00.000Z')
  `).run(ownerActorA, reviewer, reviewerActor);

  db.prepare(`
    INSERT INTO dossier_ai_proposals
      (id, dossier_id, proposal_type, proposed_value, confidence_score, created_by_actor_ref)
    VALUES ('sourced-proposal', 'provenance-a', 'document_metadata', '{}', 0.75, ?)
  `).run(ownerActorA);
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposals SET review_state = 'accepted', reviewing_user_id = ?,
      reviewing_actor_ref = ?, reviewed_at = '2026-09-01T05:05:00.000Z',
      accepted_object_type = 'document', accepted_object_id = 'provenance-doc-a'
    WHERE id = 'sourced-proposal'
  `).run(reviewer, reviewerActor), /exact version and source anchor/iu);
  db.prepare(`
    INSERT INTO dossier_ai_proposal_versions
      (dossier_id, proposal_id, document_id, document_version_id)
    VALUES ('provenance-a', 'sourced-proposal', 'provenance-doc-a', 'provenance-v-a')
  `).run();
  db.prepare(`
    INSERT INTO dossier_ai_proposal_anchors (dossier_id, proposal_id, source_anchor_id)
    VALUES ('provenance-a', 'sourced-proposal', 'reviewed-anchor')
  `).run();
  addDocument(db, {
    dossierId: "provenance-a",
    documentId: "provenance-doc-extra",
    versionId: "provenance-v-extra",
    hashSeed: 307,
  });
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum, creator,
      created_by_actor_ref
    ) VALUES ('mismatched-version-anchor', 'provenance-a', 'provenance-doc-extra',
      'provenance-v-extra', ?, 'human', ?)
  `).run(digest(308), ownerActorA);
  db.prepare(`
    UPDATE dossier_source_anchors SET review_state = 'accepted', reviewer_user_id = ?,
      reviewer_actor_ref = ?, reviewed_at = '2026-09-01T05:04:30.000Z'
    WHERE id = 'mismatched-version-anchor'
  `).run(reviewer, reviewerActor);
  db.prepare(`
    INSERT INTO dossier_ai_proposal_anchors (dossier_id, proposal_id, source_anchor_id)
    VALUES ('provenance-a', 'sourced-proposal', 'mismatched-version-anchor')
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposals SET review_state = 'accepted', reviewing_user_id = ?,
      reviewing_actor_ref = ?, reviewed_at = '2026-09-01T05:05:00.000Z',
      accepted_object_type = 'document', accepted_object_id = 'provenance-doc-a'
    WHERE id = 'sourced-proposal'
  `).run(reviewer, reviewerActor), /map to declared source versions/iu);
  db.prepare(`
    INSERT INTO dossier_ai_proposal_versions
      (dossier_id, proposal_id, document_id, document_version_id)
    VALUES ('provenance-a', 'sourced-proposal', 'provenance-doc-extra', 'provenance-v-extra')
  `).run();
  db.prepare(`
    INSERT INTO dossier_ai_proposal_anchors (dossier_id, proposal_id, source_anchor_id)
    VALUES ('provenance-a', 'sourced-proposal', 'pending-anchor')
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposals SET review_state = 'accepted', reviewing_user_id = ?,
      reviewing_actor_ref = ?, reviewed_at = '2026-09-01T05:05:00.000Z',
      accepted_object_type = 'document', accepted_object_id = 'provenance-doc-a'
    WHERE id = 'sourced-proposal'
  `).run(reviewer, reviewerActor), /only accepted source anchors/iu);
  db.prepare(`
    UPDATE dossier_source_anchors SET review_state = 'accepted', reviewer_user_id = ?,
      reviewer_actor_ref = ?, reviewed_at = '2026-09-01T05:04:45.000Z'
    WHERE id = 'pending-anchor'
  `).run(reviewer, reviewerActor);
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposals SET review_state = 'accepted', reviewing_user_id = ?,
      reviewing_actor_ref = ?, reviewed_at = '2026-09-01T05:05:00.000Z',
      accepted_object_type = 'document', accepted_object_id = 'provisional-governed-target'
    WHERE id = 'sourced-proposal'
  `).run(reviewer, reviewerActor), /not finalized/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposals SET review_state = 'accepted', reviewing_user_id = ?,
      reviewing_actor_ref = ?, reviewed_at = '2026-09-01T05:05:00.000Z',
      accepted_object_type = 'document', accepted_object_id = 'provenance-doc-b'
    WHERE id = 'sourced-proposal'
  `).run(reviewer, reviewerActor), /outside the dossier/iu);
  db.prepare(`
    UPDATE dossier_ai_proposals SET review_state = 'accepted', reviewing_user_id = ?,
      reviewing_actor_ref = ?, reviewed_at = '2026-09-01T05:05:00.000Z',
      accepted_object_type = 'document', accepted_object_id = 'provenance-doc-a'
    WHERE id = 'sourced-proposal'
  `).run(reviewer, reviewerActor);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_ai_proposal_versions
    WHERE dossier_id = 'provenance-a' AND proposal_id = 'sourced-proposal'
  `).run(), /reviewed or completed proposal source versions/iu);
  assert.throws(() => db.prepare("UPDATE dossier_ai_proposals SET proposed_value = '{\"forged\":true}' WHERE id = 'sourced-proposal'").run(), /content and model provenance|bound active reviewer/iu);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_information_requests (
      id, dossier_id, question, owner_user_id, owner_actor_ref, reason,
      readiness_reason_code, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('bad-request-code', 'provenance-a', 'Question?', ?, ?, 'Need source',
      'MISSING_FACT', ?, ?)
  `).run(ownerA, ownerActorA, ownerActorA, ownerActorA), /CHECK constraint/iu);
  db.prepare(`
    INSERT INTO dossier_information_requests (
      id, dossier_id, question, owner_user_id, owner_actor_ref, reason,
      readiness_reason_code, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('open-request', 'provenance-a', 'Question?', ?, ?, 'Need source',
      'INFORMATION_REQUEST_OPEN', ?, ?)
  `).run(ownerA, ownerActorA, ownerActorA, ownerActorA);
  assert.throws(() => db.prepare("UPDATE dossier_information_requests SET status = 'received' WHERE id = 'open-request'").run(), /CHECK constraint/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_information_requests
    SET status = 'received', satisfying_document_id = 'provisional-governed-target'
    WHERE id = 'open-request'
  `).run(), /finalized document/iu);
  db.prepare(`UPDATE dossier_information_requests SET status = 'received', satisfying_document_id = 'provenance-doc-a' WHERE id = 'open-request'`).run();
  db.prepare("DELETE FROM dossier_documents WHERE id = 'provisional-governed-target'").run();
  assert.equal(
    db.prepare("SELECT accepted_object_id FROM dossier_ai_proposals WHERE id = 'sourced-proposal'").get()?.accepted_object_id,
    "provenance-doc-a",
  );

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      parent_package_id, parent_package_version, parent_package_fingerprint,
      source_dossier_revision, graph_digest, package_type_registry, package_type_id,
      package_type_version, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('orphan-package', 'provenance-a', 'child', '1.0.0', ?, 'missing', '1.0.0', ?,
      1, ?, 'registry', 'type', '1.0.0', ?, ?)
  `).run(digest(306), digest(307), digest(308), ownerActorA, ownerActorA), /exact governed lineage/iu);
  assert.equal(versionHashA, digest(301));
  assert.throws(() => db.prepare("UPDATE users SET actor_id = ? WHERE id = ?").run(`actor_${"f".repeat(32)}`, ownerA), /immutable and server-resolved/iu);
});

test("durable AI proposal jobs deduplicate, lease, retry, and complete as one grounded revision", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "ai-job-owner@example.com", "AI Job Owner");
  const outsiderId = user(db, "ai-job-outsider@example.com", "AI Job Outsider");
  const ownerActor = actor(db, ownerId);
  const outsiderActor = actor(db, outsiderId);
  dossier(db, "ai-job-dossier", ownerId);
  addDocument(db, {
    dossierId: "ai-job-dossier",
    documentId: "ai-job-document",
    versionId: "ai-job-version",
    hashSeed: 501,
  });
  db.prepare(`
    INSERT INTO dossier_extraction_jobs (
      id, dossier_id, document_id, document_version_id, status, extractor_version
    ) VALUES (
      'ai-job-extraction', 'ai-job-dossier', 'ai-job-document', 'ai-job-version',
      'queued', 'ai-job-extractor-v1'
    )
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'processing', lease_owner = 'ai-job-extractor',
      lease_expires_at = '2099-01-01T00:00:00.000Z',
      started_at = '2026-09-01T00:01:00.000Z'
    WHERE id = 'ai-job-extraction'
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      completed_at = '2026-09-01T00:02:00.000Z'
    WHERE id = 'ai-job-extraction'
  `).run();
  db.prepare(`
    INSERT INTO dossier_extraction_results (
      id, dossier_id, document_id, document_version_id, extraction_job_id,
      extractor_version, extracted_text_object_reference, extracted_text_sha256,
      extracted_text_byte_length, character_count
    ) VALUES (
      'ai-job-extraction-result', 'ai-job-dossier', 'ai-job-document',
      'ai-job-version', 'ai-job-extraction', 'ai-job-extractor-v1', ?, ?, 100, 100
    )
  `).run(`private/ai-job-extraction/${"x".repeat(40)}`, digest(502));
  db.prepare(`
    INSERT INTO dossier_extraction_jobs (
      id, dossier_id, document_id, document_version_id, status, extractor_version
    ) VALUES (
      'ai-job-extraction-alternate', 'ai-job-dossier', 'ai-job-document',
      'ai-job-version', 'queued', 'ai-job-extractor-v2'
    )
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'processing', lease_owner = 'ai-job-extractor-alternate',
      lease_expires_at = '2099-01-01T00:00:00.000Z',
      started_at = '2026-09-01T00:03:00.000Z'
    WHERE id = 'ai-job-extraction-alternate'
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      completed_at = '2026-09-01T00:04:00.000Z'
    WHERE id = 'ai-job-extraction-alternate'
  `).run();
  db.prepare(`
    INSERT INTO dossier_extraction_results (
      id, dossier_id, document_id, document_version_id, extraction_job_id,
      extractor_version, extracted_text_object_reference, extracted_text_sha256,
      extracted_text_byte_length, character_count
    ) VALUES (
      'ai-job-extraction-result-alternate', 'ai-job-dossier', 'ai-job-document',
      'ai-job-version', 'ai-job-extraction-alternate', 'ai-job-extractor-v2', ?, ?, 100, 100
    )
  `).run(`private/ai-job-extraction-alternate/${"y".repeat(40)}`, digest(538));

  const jobColumns = db.prepare("PRAGMA table_info(dossier_ai_proposal_jobs)").all() as Array<{ name: string }>;
  assert.ok(jobColumns.every(({ name }) => !/(prompt|body|response|document_content)/iu.test(name)));
  const insertJob = db.prepare(`
    INSERT INTO dossier_ai_proposal_jobs (
      id, dossier_id, expected_dossier_revision, requested_by_user_id,
      requested_by_actor_ref, idempotency_key_hash, request_digest,
      model_provider, model_name, model_configuration_digest
    ) VALUES (?, 'ai-job-dossier', 1, ?, ?, ?, ?, 'openai', 'test-model', ?)
  `);
  const queueJob = (id: string, idempotencySeed: number, requestSeed: number) =>
    insertJob.run(id, ownerId, ownerActor, digest(idempotencySeed), digest(requestSeed), digest(503));

  queueJob("ai-job-main", 504, 505);
  assert.throws(
    () => insertJob.run("ai-job-idempotency-replay", ownerId, ownerActor, digest(504), digest(506), digest(503)),
    /UNIQUE/iu,
  );
  assert.throws(
    () => insertJob.run("ai-job-request-replay", ownerId, ownerActor, digest(507), digest(505), digest(503)),
    /UNIQUE/iu,
  );
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposal_jobs (
      id, dossier_id, expected_dossier_revision, requested_by_user_id,
      requested_by_actor_ref, idempotency_key_hash, request_digest, status,
      model_provider, model_name, model_configuration_digest, lease_owner,
      lease_expires_at, started_at
    ) VALUES (
      'ai-job-forged-start', 'ai-job-dossier', 1, ?, ?, ?, ?, 'processing',
      'openai', 'test-model', ?, 'forged-worker', datetime('now', '+5 minutes'), datetime('now')
    )
  `).run(ownerId, ownerActor, digest(508), digest(509), digest(503)), /must begin as an unleased queued request/iu);
  assert.throws(
    () => insertJob.run("ai-job-outsider", outsiderId, outsiderActor, digest(510), digest(511), digest(503)),
    /active professional participant/iu,
  );
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposal_jobs (
      id, dossier_id, expected_dossier_revision, requested_by_user_id,
      requested_by_actor_ref, idempotency_key_hash, request_digest,
      model_provider, model_name, model_configuration_digest
    ) VALUES ('ai-job-stale', 'ai-job-dossier', 2, ?, ?, ?, ?, 'openai', 'test-model', ?)
  `).run(ownerId, ownerActor, digest(512), digest(513), digest(503)), /current dossier revision/iu);

  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'processing', lease_owner = 'worker-main',
      lease_expires_at = datetime('now', '+5 minutes'),
      started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-main'
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_jobs SET request_digest = ?
    WHERE id = 'ai-job-main'
  `).run(digest(514)), /identity and model provenance are immutable/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposals (
      id, dossier_id, generation_job_id, proposal_type, proposed_value,
      model_provider, model_name, model_configuration_digest, created_by_actor_ref
    ) VALUES (
      'ai-job-too-early-proposal', 'ai-job-dossier', 'ai-job-main',
      'dossier_summary', '{}', 'openai', 'test-model', ?, ?
    )
  `).run(digest(503), ownerActor), /exact processing job and revision batch/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      provider_receipt_digest = ?, completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-main'
  `).run(digest(515)), /bounded analyzed source ranges/iu);

  queueJob("ai-job-retry", 516, 517);
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'failed', error_code = 'timeout',
      error_detail_code = 'Provider returned secret text',
      completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-retry'
  `).run(), /CHECK constraint/iu);
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'failed', error_code = 'timeout', error_detail_code = 'request_timeout',
      completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-retry'
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'processing', lease_owner = 'worker-retry',
      lease_expires_at = datetime('now', '+5 minutes'), started_at = datetime('now'),
      completed_at = null, error_code = null, error_detail_code = null, updated_at = datetime('now')
    WHERE id = 'ai-job-retry'
  `).run(), /invalid AI proposal job state transition or retry/iu);
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'queued', attempt = 2, lease_owner = null, lease_expires_at = null,
      provider_receipt_digest = null, error_code = null, error_detail_code = null,
      started_at = null, completed_at = null, updated_at = datetime('now')
    WHERE id = 'ai-job-retry'
  `).run();
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'processing', lease_owner = 'worker-retry',
      lease_expires_at = datetime('now', '+5 minutes'),
      started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-retry'
  `).run();
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'failed', lease_owner = null, lease_expires_at = null,
      error_code = 'provider_unavailable', error_detail_code = 'provider_unavailable',
      completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-retry'
  `).run();
  assert.equal(
    db.prepare("SELECT attempt FROM dossier_ai_proposal_jobs WHERE id = 'ai-job-retry'").get()?.attempt,
    2,
  );

  queueJob("ai-job-expired", 518, 519);
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'processing', lease_owner = 'worker-expired',
      lease_expires_at = datetime('now', '+1 second'),
      started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-expired'
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'queued', attempt = 2, lease_owner = null, lease_expires_at = null,
      started_at = null, updated_at = datetime('now')
    WHERE id = 'ai-job-expired'
  `).run(), /invalid AI proposal job state transition or retry/iu);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_200);
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'queued', attempt = 2, lease_owner = null, lease_expires_at = null,
      provider_receipt_digest = null, error_code = null, error_detail_code = null,
      started_at = null, completed_at = null, updated_at = datetime('now')
    WHERE id = 'ai-job-expired'
  `).run();
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'processing', lease_owner = 'worker-current',
      lease_expires_at = datetime('now', '+5 minutes'),
      started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-expired'
  `).run();
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposal_job_sources (
      dossier_id, job_id, job_attempt, lease_owner, source_ordinal,
      document_id, document_version_id, extraction_result_id, context_start, context_end
    ) VALUES (
      'ai-job-dossier', 'ai-job-expired', 1, 'worker-expired', 1,
      'ai-job-document', 'ai-job-version', 'ai-job-extraction-result', 0, 50
    )
  `).run(), /exact active job lease and revision/iu);

  queueJob("ai-job-zero", 530, 531);
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'processing', lease_owner = 'worker-zero',
      lease_expires_at = datetime('now', '+5 minutes'),
      started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 'ai-job-zero'
  `).run();
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposal_job_sources (
      dossier_id, job_id, job_attempt, lease_owner, source_ordinal,
      document_id, document_version_id, extraction_result_id, context_start, context_end
    ) VALUES (
      'ai-job-dossier', 'ai-job-zero', 1, 'worker-zero', 1, 'ai-job-document', 'ai-job-version',
      'ai-job-extraction-result', 0, 101
    )
  `).run(), /exact ready extraction range/iu);
  db.prepare(`
    INSERT INTO dossier_ai_proposal_job_sources (
      dossier_id, job_id, job_attempt, lease_owner, source_ordinal,
      document_id, document_version_id, extraction_result_id, context_start, context_end
    ) VALUES (
      'ai-job-dossier', 'ai-job-zero', 1, 'worker-zero', 1, 'ai-job-document', 'ai-job-version',
      'ai-job-extraction-result', 0, 50
    )
  `).run();
  const zeroCompletedAt = new Date().toISOString();
  const zeroReceiptDigest = digest(532);
  const zeroDetail = JSON.stringify({
    job_id: "ai-job-zero",
    result_code: "ready_no_candidates",
    candidate_count: 0,
    analyzed_source_count: 1,
    analyzed_character_count: 50,
    model_receipt_digest: zeroReceiptDigest,
  });
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) VALUES (
      'ai-job-zero-forged-audit', 'ai-job-dossier', 1, 2,
      'proposal_generation_completed', 'dossier', 'ai-job-dossier', ?, ?, 'owner', ?,
      'AI_PROPOSAL_GENERATION_NO_CANDIDATES', ?, 'ai-job-dossier-audit-created', ?
    )
  `).run(
    ownerId,
    ownerActor,
    zeroCompletedAt,
    JSON.stringify({ ...JSON.parse(zeroDetail), analyzed_character_count: 49 }),
    digest(533),
  ), /exact in-flight result and analyzed ranges/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) VALUES (
      'ai-job-zero-content-audit', 'ai-job-dossier', 1, 2,
      'proposal_generation_completed', 'dossier', 'ai-job-dossier', ?, ?, 'owner', ?,
      'AI_PROPOSAL_GENERATION_NO_CANDIDATES', ?, 'ai-job-dossier-audit-created', ?
    )
  `).run(
    ownerId,
    ownerActor,
    zeroCompletedAt,
    JSON.stringify({ ...JSON.parse(zeroDetail), source_text: "must not persist" }),
    digest(536),
  ), /exact six-key receipt/iu);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) VALUES (
      'ai-job-zero-audit', 'ai-job-dossier', 1, 2,
      'proposal_generation_completed', 'dossier', 'ai-job-dossier', ?, ?, 'owner', ?,
      'AI_PROPOSAL_GENERATION_NO_CANDIDATES', ?, 'ai-job-dossier-audit-created', ?
    )
  `).run(ownerId, ownerActor, zeroCompletedAt, zeroDetail, digest(534));
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      provider_receipt_digest = ?, completed_at = ?, updated_at = ?
    WHERE id = 'ai-job-zero'
  `).run(digest(537), zeroCompletedAt, zeroCompletedAt), /exact bounded completion audit/iu);
  db.prepare(`
    UPDATE dossier_ai_proposal_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      provider_receipt_digest = ?, completed_at = ?, updated_at = ?
    WHERE id = 'ai-job-zero'
  `).run(zeroReceiptDigest, zeroCompletedAt, zeroCompletedAt);
  assert.equal(
    db.prepare("SELECT status FROM dossier_ai_proposal_jobs WHERE id = 'ai-job-zero'").get()?.status,
    "ready",
  );
  assert.equal(db.prepare("SELECT revision FROM dossiers WHERE id = 'ai-job-dossier'").get()?.revision, 1);
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM dossier_revision_receipts WHERE dossier_id = 'ai-job-dossier'").get()?.count,
    1,
  );

  const positiveCompletedAt = new Date().toISOString();
  const positiveReceiptDigest = digest(542);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      UPDATE dossiers
      SET title = 'Matter ai-job-dossier with AI proposals', revision = 2,
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'ai-job-dossier' AND revision = 1
    `).run(ownerActor, positiveCompletedAt);
    db.prepare(`
      INSERT INTO dossier_ai_proposal_job_sources (
        dossier_id, job_id, job_attempt, lease_owner, source_ordinal,
        document_id, document_version_id, extraction_result_id, context_start, context_end, created_at
      ) VALUES (
        'ai-job-dossier', 'ai-job-main', 1, 'worker-main', 1, 'ai-job-document', 'ai-job-version',
        'ai-job-extraction-result', 0, 80, ?
      )
    `).run(positiveCompletedAt);
    db.prepare(`
      INSERT INTO dossier_source_anchors (
        id, dossier_id, document_id, document_version_id, character_start,
        character_end, anchor_checksum, extraction_version, creator, review_state,
        created_by_actor_ref, created_at
      ) VALUES (
        'ai-job-source', 'ai-job-dossier', 'ai-job-document', 'ai-job-version',
        5, 25, ?, 'ai-job-extractor-v1', 'ai_proposal', 'pending', ?, ?
      )
    `).run(digest(535), ownerActor, positiveCompletedAt);
    db.prepare(`
      INSERT INTO dossier_source_anchors (
        id, dossier_id, document_id, document_version_id, character_start,
        character_end, anchor_checksum, extraction_version, creator, review_state,
        created_by_actor_ref, created_at
      ) VALUES (
        'ai-job-source-alternate', 'ai-job-dossier', 'ai-job-document', 'ai-job-version',
        5, 25, ?, 'ai-job-extractor-v2', 'ai_proposal', 'pending', ?, ?
      )
    `).run(digest(539), ownerActor, positiveCompletedAt);
    db.prepare(`
      INSERT INTO dossier_ai_proposals (
        id, dossier_id, generation_job_id, proposal_type, proposed_value,
        confidence_category, confidence_score, model_provider, model_name,
        model_configuration_digest, created_by_actor_ref
      ) VALUES (
        'ai-job-proposal', 'ai-job-dossier', 'ai-job-main', 'dossier_summary',
        '{"summary":"bounded proposal"}', 'medium', 0.75,
        'openai', 'test-model', ?, ?
      )
    `).run(digest(503), ownerActor);
    db.prepare(`
      INSERT INTO dossier_ai_proposal_versions
        (dossier_id, proposal_id, document_id, document_version_id)
      VALUES ('ai-job-dossier', 'ai-job-proposal', 'ai-job-document', 'ai-job-version')
    `).run();
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_ai_proposal_anchors (dossier_id, proposal_id, source_anchor_id)
      VALUES ('ai-job-dossier', 'ai-job-proposal', 'ai-job-source-alternate')
    `).run(), /exact analyzed extraction result and range/iu);
    db.prepare(`
      INSERT INTO dossier_ai_proposal_anchors (dossier_id, proposal_id, source_anchor_id)
      VALUES ('ai-job-dossier', 'ai-job-proposal', 'ai-job-source')
    `).run();
    assert.throws(() => db.prepare(`
      UPDATE dossier_ai_proposal_jobs
      SET status = 'failed', lease_owner = null, lease_expires_at = null,
        error_code = 'internal_error', error_detail_code = 'partial_generation',
        completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = 'ai-job-main'
    `).run(), /analyzed sources or generated proposals cannot fail or retry/iu);
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, previous_event_id, event_digest
      ) VALUES (
        'ai-job-proposal-audit', 'ai-job-dossier', 2, 3, 'proposal_reviewed', 'ai_proposal',
        'ai-job-proposal', ?, ?, 'owner', ?,
        'AI_PROPOSAL_CREATED', 'ai-job-zero-audit', ?
      )
    `).run(ownerId, ownerActor, positiveCompletedAt, digest(540));
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, detail, previous_event_id, event_digest
      ) VALUES (
        'ai-job-completion-audit', 'ai-job-dossier', 2, 4,
        'proposal_generation_completed', 'dossier', 'ai-job-dossier', ?, ?, 'owner', ?,
        'AI_PROPOSAL_GENERATION_READY', ?, 'ai-job-proposal-audit', ?
      )
    `).run(
      ownerId,
      ownerActor,
      positiveCompletedAt,
      JSON.stringify({
        job_id: "ai-job-main",
        result_code: "ready_with_candidates",
        candidate_count: 1,
        analyzed_source_count: 1,
        analyzed_character_count: 80,
        model_receipt_digest: positiveReceiptDigest,
      }),
      digest(541),
    );
    db.prepare(`
      INSERT INTO dossier_revision_receipts (
        dossier_id, resulting_revision, created_by_actor_ref, created_at
      ) VALUES ('ai-job-dossier', 2, ?, ?)
    `).run(ownerActor, positiveCompletedAt);
    db.prepare(`
      UPDATE dossier_ai_proposal_jobs
      SET status = 'ready', lease_owner = null, lease_expires_at = null,
        provider_receipt_digest = ?, completed_at = ?, updated_at = ?
      WHERE id = 'ai-job-main'
    `).run(positiveReceiptDigest, positiveCompletedAt, positiveCompletedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const ready = db.prepare(`
    SELECT status, attempt, provider_receipt_digest
    FROM dossier_ai_proposal_jobs WHERE id = 'ai-job-main'
  `).get() as { status: string; attempt: number; provider_receipt_digest: string };
  assert.equal(ready.status, "ready");
  assert.equal(ready.attempt, 1);
  assert.equal(ready.provider_receipt_digest, positiveReceiptDigest);
  assert.equal(
    db.prepare("SELECT generation_job_id FROM dossier_ai_proposals WHERE id = 'ai-job-proposal'").get()?.generation_job_id,
    "ai-job-main",
  );
  const analyzed = db.prepare(`
    SELECT source_ordinal, context_start, context_end
    FROM dossier_ai_proposal_job_sources
    WHERE dossier_id = 'ai-job-dossier' AND job_id = 'ai-job-main'
  `).get();
  assert.deepEqual({ ...analyzed }, { source_ordinal: 1, context_start: 0, context_end: 80 });
  assert.throws(() => db.prepare(`
    UPDATE dossier_ai_proposal_job_sources SET context_end = 79
    WHERE dossier_id = 'ai-job-dossier' AND job_id = 'ai-job-main'
  `).run(), /immutable/iu);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_ai_proposal_job_sources
    WHERE dossier_id = 'ai-job-dossier' AND job_id = 'ai-job-main'
  `).run(), /durable provenance/iu);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_ai_proposal_versions
    WHERE dossier_id = 'ai-job-dossier' AND proposal_id = 'ai-job-proposal'
  `).run(), /reviewed or completed proposal source versions/iu);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_ai_proposal_anchors
    WHERE dossier_id = 'ai-job-dossier' AND proposal_id = 'ai-job-proposal'
  `).run(), /reviewed or completed proposal source anchors/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_ai_proposal_anchors (dossier_id, proposal_id, source_anchor_id)
    VALUES ('ai-job-dossier', 'ai-job-proposal', 'ai-job-source')
  `).run(), /sources can only be assembled while pending/iu);
  assert.throws(
    () => db.prepare("UPDATE dossier_ai_proposal_jobs SET status = 'failed' WHERE id = 'ai-job-main'").run(),
    /analyzed sources or generated proposals cannot fail or retry|invalid AI proposal job state transition or retry|state receipt is incomplete/iu,
  );
  assert.throws(
    () => db.prepare("DELETE FROM dossier_ai_proposal_jobs WHERE id = 'ai-job-main'").run(),
    /durable idempotency and recovery records/iu,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  const plan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT id FROM dossier_ai_proposal_jobs
    WHERE status = 'queued' AND lease_expires_at IS NULL
  `).all() as Array<{ detail: string }>;
  assert.ok(plan.some(({ detail }) => /dossier_ai_proposal_jobs_status_lease_idx/iu.test(detail)), JSON.stringify(plan));

  const quotaDb = legacyDossierDatabase();
  const quotaOwnerId = user(quotaDb, "ai-job-quota@example.com", "AI Job Quota");
  const quotaActor = actor(quotaDb, quotaOwnerId);
  dossier(quotaDb, "ai-job-quota-dossier", quotaOwnerId);
  const quotaInsert = quotaDb.prepare(`
    INSERT INTO dossier_ai_proposal_jobs (
      id, dossier_id, expected_dossier_revision, requested_by_user_id,
      requested_by_actor_ref, idempotency_key_hash, request_digest,
      model_provider, model_name, model_configuration_digest
    ) VALUES (?, 'ai-job-quota-dossier', 1, ?, ?, ?, ?, 'openai', 'test-model', ?)
  `);
  for (let index = 0; index < 10; index += 1) {
    quotaInsert.run(
      `ai-job-quota-${index}`,
      quotaOwnerId,
      quotaActor,
      digest(600 + index),
      digest(700 + index),
      digest(800),
    );
  }
  assert.throws(() => quotaInsert.run(
    "ai-job-quota-overflow",
    quotaOwnerId,
    quotaActor,
    digest(610),
    digest(710),
    digest(800),
  ), /active quota exceeded/iu);
});

test("append-only revision receipts abort stale CAS and allow multiple current-revision audits", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "cas-owner@example.com", "CAS Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "cas-dossier", ownerId);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref)
    VALUES ('cas-dossier', 2, ?)
  `).run(ownerActor), /resulting live revision/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-future', 'cas-dossier', 2, 2, 'dossier_updated', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:00:30.000Z',
      'DOSSIER_UPDATED', 'cas-dossier-audit-created', ?)
  `).run(ownerId, ownerActor, digest(409)), /current live revision|FOREIGN KEY/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_revision_receipts SET created_by_actor_ref = 'forged'
    WHERE dossier_id = 'cas-dossier' AND resulting_revision = 1
  `).run(), /append-only/iu);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_revision_receipts
    WHERE dossier_id = 'cas-dossier' AND resulting_revision = 1
  `).run(), /append-only/iu);

  db.exec("BEGIN IMMEDIATE");
  const winner = db.prepare(`
    UPDATE dossiers SET title = 'Winner', revision = 2, updated_by_actor_ref = ?,
      updated_at = '2026-09-01T06:01:00.000Z'
    WHERE id = 'cas-dossier' AND revision = 1
  `).run(ownerActor);
  assert.equal(winner.changes, 1);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-2', 'cas-dossier', 2, 2, 'dossier_updated', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:01:00.000Z',
      'DOSSIER_UPDATED', 'cas-dossier-audit-created', ?)
  `).run(ownerId, ownerActor, digest(402));
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-2-secondary', 'cas-dossier', 2, 3, 'dossier_updated', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:01:01.000Z',
      'DOSSIER_UPDATED_SECONDARY', 'cas-audit-2', ?)
  `).run(ownerId, ownerActor, digest(403));
  db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
    VALUES ('cas-dossier', 2, ?, '2026-09-01T06:01:00.000Z')
  `).run(ownerActor);
  db.exec("COMMIT");
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_audit_events
    WHERE dossier_id = 'cas-dossier' AND dossier_revision = 2
  `).get()?.count, 2);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref)
    VALUES ('cas-dossier', 2, ?)
  `).run(ownerActor), /UNIQUE/iu);

  db.exec("BEGIN IMMEDIATE");
  try {
    const stale = db.prepare(`
      UPDATE dossiers SET title = 'Stale writer', revision = 2, updated_by_actor_ref = ?,
        updated_at = '2026-09-01T06:02:00.000Z'
      WHERE id = 'cas-dossier' AND revision = 1
    `).run(ownerActor);
    assert.equal(stale.changes, 0);
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref)
      VALUES ('cas-dossier', 2, ?)
    `).run(ownerActor), /UNIQUE/iu);
  } finally {
    db.exec("ROLLBACK");
  }
  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    UPDATE dossiers SET title = 'Advanced', revision = 3, updated_by_actor_ref = ?,
      updated_at = '2026-09-01T06:03:00.000Z'
    WHERE id = 'cas-dossier' AND revision = 2
  `).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-3', 'cas-dossier', 3, 4, 'dossier_updated', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:03:00.000Z',
      'DOSSIER_UPDATED', 'cas-audit-2-secondary', ?)
  `).run(ownerId, ownerActor, digest(404));
  db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
    VALUES ('cas-dossier', 3, ?, '2026-09-01T06:03:00.000Z')
  `).run(ownerActor);
  db.exec("COMMIT");

  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    UPDATE dossiers SET title = 'Missing receipt', revision = 4, updated_by_actor_ref = ?,
      updated_at = '2026-09-01T06:03:30.000Z'
    WHERE id = 'cas-dossier' AND revision = 3
  `).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-missing-receipt', 'cas-dossier', 4, 5, 'dossier_updated', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:03:30.000Z',
      'DOSSIER_UPDATED', 'cas-audit-3', ?)
  `).run(ownerId, ownerActor, digest(406));
  assert.throws(() => db.exec("COMMIT"), /FOREIGN KEY/iu);
  db.exec("ROLLBACK");

  db.exec("BEGIN IMMEDIATE");
  db.prepare(`
    UPDATE dossiers SET title = 'Missing audit', revision = 4, updated_by_actor_ref = ?,
      updated_at = '2026-09-01T06:03:40.000Z'
    WHERE id = 'cas-dossier' AND revision = 3
  `).run(ownerActor);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
    VALUES ('cas-dossier', 4, ?, '2026-09-01T06:03:40.000Z')
  `).run(ownerActor), /requires at least one exact-revision audit/iu);
  db.exec("ROLLBACK");

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-time-regression', 'cas-dossier', 3, 5, 'dossier_updated', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:02:59.000Z',
      'DOSSIER_UPDATED', 'cas-audit-3', ?)
  `).run(ownerId, ownerActor, digest(407)), /nondecreasing/iu);
  db.exec("BEGIN IMMEDIATE");
  try {
    const stale = db.prepare(`
      UPDATE dossiers SET title = 'Very stale writer', revision = 2, updated_by_actor_ref = ?
      WHERE id = 'cas-dossier' AND revision = 1
    `).run(ownerActor);
    assert.equal(stale.changes, 0);
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref)
      VALUES ('cas-dossier', 2, ?)
    `).run(ownerActor), /resulting live revision/iu);
  } finally {
    db.exec("ROLLBACK");
  }
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, previous_event_id, event_digest
    ) VALUES ('cas-audit-stale-artifact', 'cas-dossier', 2, 5, 'snapshot_created', 'dossier',
      'cas-dossier', ?, ?, 'owner', '2026-09-01T06:04:00.000Z',
      'SNAPSHOT_CREATED', 'cas-audit-3', ?)
  `).run(ownerId, ownerActor, digest(405)), /current live revision/iu);
  const finalDossier = db.prepare("SELECT title, revision FROM dossiers WHERE id = 'cas-dossier'").get() as { title: string; revision: number };
  assert.equal(finalDossier.title, "Advanced");
  assert.equal(finalDossier.revision, 3);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_revision_receipts WHERE dossier_id = 'cas-dossier'").get()?.count, 3);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id LIKE 'cas-audit-stale%'").get()?.count, 0);
});

test("0013 exact revision claims roll back unaudited or mismatched participant and information-request mutations", () => {
  const participantDb = database();
  const participantOwnerId = user(participantDb, "claims-participant-owner@example.com", "Claims Participant Owner");
  const participantOwnerActor = actor(participantDb, participantOwnerId);
  const contributorId = user(participantDb, "claims-contributor@example.com", "Claims Contributor");
  const contributorActor = actor(participantDb, contributorId);
  dossier(participantDb, "claims-participant-dossier", participantOwnerId);

  const insertParticipant = (id: string, occurredAt: string) => participantDb.prepare(`
    INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, 'claims-participant-dossier', ?, ?, 'Claims Contributor',
      'contributor', 'active', ?, ?, ?, ?)
  `).run(
    id,
    contributorId,
    contributorActor,
    participantOwnerActor,
    participantOwnerActor,
    occurredAt,
    occurredAt,
  );

  expectDeferredCommitFailure(participantDb, () => {
    const occurredAt = "2026-09-01T07:00:00.000Z";
    advanceDossierRevision(participantDb, "claims-participant-dossier", 1, participantOwnerActor, occurredAt);
    insertParticipant("participant-omitted-audit", occurredAt);
  });
  assert.equal(participantDb.prepare("SELECT revision FROM dossiers WHERE id = 'claims-participant-dossier'").get()?.revision, 1);
  assert.equal(participantDb.prepare("SELECT count(*) AS count FROM dossier_participants WHERE id = 'participant-omitted-audit'").get()?.count, 0);
  assert.equal(participantDb.prepare("SELECT count(*) AS count FROM dossier_revision_commitments WHERE resulting_revision = 2").get()?.count, 0);

  expectDeferredCommitFailure(participantDb, () => {
    const occurredAt = "2026-09-01T07:01:00.000Z";
    advanceDossierRevision(participantDb, "claims-participant-dossier", 1, participantOwnerActor, occurredAt);
    insertParticipant("participant-mismatched-audit", occurredAt);
    appendAudit(participantDb, {
      id: "participant-wrong-family-audit",
      dossierId: "claims-participant-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "dossier_updated",
      objectRefType: "dossier",
      objectRefId: "claims-participant-dossier",
      actorUserId: participantOwnerId,
      actorRef: participantOwnerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "claims-participant-dossier-audit-created",
      digestSeed: 20_001,
    });
    appendRevisionReceipt(participantDb, "claims-participant-dossier", 2, participantOwnerActor, occurredAt);
  });
  assert.equal(participantDb.prepare("SELECT revision FROM dossiers WHERE id = 'claims-participant-dossier'").get()?.revision, 1);
  assert.equal(participantDb.prepare("SELECT count(*) AS count FROM dossier_participants WHERE id = 'participant-mismatched-audit'").get()?.count, 0);
  assert.equal(participantDb.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'participant-wrong-family-audit'").get()?.count, 0);
  assert.equal(participantDb.prepare("SELECT count(*) AS count FROM dossier_revision_receipts WHERE resulting_revision = 2").get()?.count, 0);

  participantDb.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T07:02:00.000Z";
    advanceDossierRevision(participantDb, "claims-participant-dossier", 1, participantOwnerActor, occurredAt);
    insertParticipant("participant-exact-audit", occurredAt);
    appendAudit(participantDb, {
      id: "participant-exact-create-audit",
      dossierId: "claims-participant-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "participant_changed",
      objectRefType: "participant",
      objectRefId: "participant-exact-audit",
      actorUserId: participantOwnerId,
      actorRef: participantOwnerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "claims-participant-dossier-audit-created",
      digestSeed: 20_002,
    });
    appendRevisionReceipt(participantDb, "claims-participant-dossier", 2, participantOwnerActor, occurredAt);
    participantDb.exec("COMMIT");
  } catch (error) {
    participantDb.exec("ROLLBACK");
    throw error;
  }
  const participantClaims = participantDb.prepare(`
    SELECT dossier_revision, claim_phase, event_type, object_ref_type,
      object_ref_id, actor_ref, occurred_at
    FROM dossier_required_audits
    WHERE dossier_id = 'claims-participant-dossier'
      AND object_ref_id = 'participant-exact-audit'
    ORDER BY dossier_revision
  `).all() as Array<Record<string, unknown>>;
  assert.deepEqual(participantClaims.map((row) => ({ ...row })), [{
    dossier_revision: 2,
    claim_phase: "revision",
    event_type: "participant_changed",
    object_ref_type: "participant",
    object_ref_id: "participant-exact-audit",
    actor_ref: participantOwnerActor,
    occurred_at: "2026-09-01T07:02:00.000Z",
  }]);

  participantDb.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T07:03:00.000Z";
    advanceDossierRevision(participantDb, "claims-participant-dossier", 2, participantOwnerActor, occurredAt);
    participantDb.prepare(`
      UPDATE dossier_participants
      SET display_name = 'Claims Contributor Updated', updated_by_actor_ref = ?, updated_at = ?
      WHERE dossier_id = 'claims-participant-dossier' AND id = 'participant-exact-audit'
    `).run(participantOwnerActor, occurredAt);
    appendAudit(participantDb, {
      id: "participant-exact-update-audit",
      dossierId: "claims-participant-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "participant_changed",
      objectRefType: "participant",
      objectRefId: "participant-exact-audit",
      actorUserId: participantOwnerId,
      actorRef: participantOwnerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "participant-exact-create-audit",
      digestSeed: 20_003,
    });
    appendRevisionReceipt(participantDb, "claims-participant-dossier", 3, participantOwnerActor, occurredAt);
    participantDb.exec("COMMIT");
  } catch (error) {
    participantDb.exec("ROLLBACK");
    throw error;
  }
  assert.equal(participantDb.prepare(`
    SELECT count(*) AS count FROM dossier_required_audits
    WHERE dossier_id = 'claims-participant-dossier'
      AND object_ref_id = 'participant-exact-audit'
  `).get()?.count, 2, "participant creation and update each require their exact revision audit");
  assert.deepEqual(participantDb.prepare("PRAGMA foreign_key_check").all(), []);

  const requestDb = database();
  const requestOwnerId = user(requestDb, "claims-request-owner@example.com", "Claims Request Owner");
  const requestOwnerActor = actor(requestDb, requestOwnerId);
  dossier(requestDb, "claims-request-dossier", requestOwnerId);

  const insertRequest = (id: string, occurredAt: string) => requestDb.prepare(`
    INSERT INTO dossier_information_requests (
      id, dossier_id, question, owner_user_id, owner_actor_ref, priority,
      status, reason, readiness_reason_code, created_by_actor_ref,
      updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, 'claims-request-dossier', 'Which source is authoritative?', ?, ?,
      'high', 'open', 'Source confirmation is required.', 'INFORMATION_REQUEST_OPEN',
      ?, ?, ?, ?)
  `).run(
    id,
    requestOwnerId,
    requestOwnerActor,
    requestOwnerActor,
    requestOwnerActor,
    occurredAt,
    occurredAt,
  );

  expectDeferredCommitFailure(requestDb, () => {
    const occurredAt = "2026-09-01T08:00:00.000Z";
    advanceDossierRevision(requestDb, "claims-request-dossier", 1, requestOwnerActor, occurredAt);
    insertRequest("request-omitted-audit", occurredAt);
  });
  assert.equal(requestDb.prepare("SELECT revision FROM dossiers WHERE id = 'claims-request-dossier'").get()?.revision, 1);
  assert.equal(requestDb.prepare("SELECT count(*) AS count FROM dossier_information_requests WHERE id = 'request-omitted-audit'").get()?.count, 0);

  expectDeferredCommitFailure(requestDb, () => {
    const occurredAt = "2026-09-01T08:01:00.000Z";
    advanceDossierRevision(requestDb, "claims-request-dossier", 1, requestOwnerActor, occurredAt);
    insertRequest("request-mismatched-audit", occurredAt);
    appendAudit(requestDb, {
      id: "request-wrong-time-audit",
      dossierId: "claims-request-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: "request-mismatched-audit",
      actorUserId: requestOwnerId,
      actorRef: requestOwnerActor,
      actorRole: "owner",
      occurredAt: "2026-09-01T08:01:01.000Z",
      previousEventId: "claims-request-dossier-audit-created",
      digestSeed: 21_001,
    });
    appendRevisionReceipt(requestDb, "claims-request-dossier", 2, requestOwnerActor, occurredAt);
  });
  assert.equal(requestDb.prepare("SELECT revision FROM dossiers WHERE id = 'claims-request-dossier'").get()?.revision, 1);
  assert.equal(requestDb.prepare("SELECT count(*) AS count FROM dossier_information_requests WHERE id = 'request-mismatched-audit'").get()?.count, 0);
  assert.equal(requestDb.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'request-wrong-time-audit'").get()?.count, 0);

  requestDb.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T08:02:00.000Z";
    advanceDossierRevision(requestDb, "claims-request-dossier", 1, requestOwnerActor, occurredAt);
    insertRequest("request-exact-audit", occurredAt);
    appendAudit(requestDb, {
      id: "request-exact-create-audit",
      dossierId: "claims-request-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: "request-exact-audit",
      actorUserId: requestOwnerId,
      actorRef: requestOwnerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "claims-request-dossier-audit-created",
      digestSeed: 21_002,
    });
    appendRevisionReceipt(requestDb, "claims-request-dossier", 2, requestOwnerActor, occurredAt);
    requestDb.exec("COMMIT");
  } catch (error) {
    requestDb.exec("ROLLBACK");
    throw error;
  }

  requestDb.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T08:03:00.000Z";
    advanceDossierRevision(requestDb, "claims-request-dossier", 2, requestOwnerActor, occurredAt);
    requestDb.prepare(`
      UPDATE dossier_information_requests
      SET status = 'waived', updated_by_actor_ref = ?, updated_at = ?
      WHERE dossier_id = 'claims-request-dossier' AND id = 'request-exact-audit'
    `).run(requestOwnerActor, occurredAt);
    appendAudit(requestDb, {
      id: "request-exact-update-audit",
      dossierId: "claims-request-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: "request-exact-audit",
      actorUserId: requestOwnerId,
      actorRef: requestOwnerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "request-exact-create-audit",
      digestSeed: 21_003,
    });
    appendRevisionReceipt(requestDb, "claims-request-dossier", 3, requestOwnerActor, occurredAt);
    requestDb.exec("COMMIT");
  } catch (error) {
    requestDb.exec("ROLLBACK");
    throw error;
  }
  const requestClaims = requestDb.prepare(`
    SELECT dossier_revision, event_type, object_ref_type, object_ref_id,
      actor_ref, occurred_at
    FROM dossier_required_audits
    WHERE dossier_id = 'claims-request-dossier'
      AND object_ref_id = 'request-exact-audit'
    ORDER BY dossier_revision
  `).all() as Array<Record<string, unknown>>;
  assert.deepEqual(requestClaims.map((row) => ({ ...row })), [
    {
      dossier_revision: 2,
      event_type: "information_request_changed",
      object_ref_type: "information_request",
      object_ref_id: "request-exact-audit",
      actor_ref: requestOwnerActor,
      occurred_at: "2026-09-01T08:02:00.000Z",
    },
    {
      dossier_revision: 3,
      event_type: "information_request_changed",
      object_ref_type: "information_request",
      object_ref_id: "request-exact-audit",
      actor_ref: requestOwnerActor,
      occurred_at: "2026-09-01T08:03:00.000Z",
    },
  ]);
  assert.equal(requestDb.prepare("SELECT status FROM dossier_information_requests WHERE id = 'request-exact-audit'").get()?.status, "waived");
  assert.deepEqual(requestDb.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0013 lifecycle status and status_reason update commits with only the exact transition audit claim", () => {
  const db = database();
  const ownerId = user(db, "claims-transition-owner@example.com", "Claims Transition Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "claims-transition-dossier", ownerId);
  const occurredAt = "2026-09-01T08:30:00.000Z";

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status, new_status,
        actor_user_id, actor_ref, actor_role, reason, consequences, occurred_at,
        had_current_output, had_reviewer_approval
      ) VALUES ('claims-transition-draft-intake', 'claims-transition-dossier', 1, 2,
        'draft', 'intake_review', ?, ?, 'owner', 'Evidence intake opened.',
        '["recompute_readiness","mark_outputs_stale"]', ?, false, false)
    `).run(ownerId, ownerActor, occurredAt);
    const update = db.prepare(`
      UPDATE dossiers
      SET status = 'intake_review', status_reason = 'Evidence intake opened.',
        revision = 2, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'claims-transition-dossier' AND revision = 1 AND status = 'draft'
    `).run(ownerActor, occurredAt);
    assert.equal(update.changes, 1);
    appendAudit(db, {
      id: "claims-transition-exact-audit",
      dossierId: "claims-transition-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "dossier_status_transitioned",
      objectRefType: "status_transition",
      objectRefId: "claims-transition-draft-intake",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "claims-transition-dossier-audit-created",
      digestSeed: 21_500,
    });
    appendRevisionReceipt(db, "claims-transition-dossier", 2, ownerActor, occurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, status_reason
    FROM dossiers WHERE id = 'claims-transition-dossier'
  `).get() }, {
    revision: 2,
    status: "intake_review",
    status_reason: "Evidence intake opened.",
  });
  const transitionClaims = db.prepare(`
    SELECT event_type, object_ref_type, object_ref_id, actor_ref, occurred_at
    FROM dossier_required_audits
    WHERE dossier_id = 'claims-transition-dossier' AND dossier_revision = 2
    ORDER BY event_type, object_ref_id
  `).all() as Array<Record<string, unknown>>;
  assert.deepEqual(transitionClaims.map((row) => ({ ...row })), [{
    event_type: "dossier_status_transitioned",
    object_ref_type: "status_transition",
    object_ref_id: "claims-transition-draft-intake",
    actor_ref: ownerActor,
    occurred_at: occurredAt,
  }], "changing status_reason as part of a lifecycle transition must not demand a second dossier_updated audit");
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_audit_events
    WHERE dossier_id = 'claims-transition-dossier' AND dossier_revision = 2
      AND event_type = 'dossier_updated'
  `).get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 status hardening binds metadata, reason, time, and closure/archive fields to exact transitions", () => {
  const db = database();
  const ownerId = user(db, "status-hardening-owner@example.com", "Status Hardening Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "status-hardening-dossier", ownerId);

  const insertTransition = (input: {
    id: string;
    revisionBefore: number;
    previousStatus: string;
    newStatus: string;
    reason: string;
    occurredAt: string;
  }) => db.prepare(`
    INSERT INTO dossier_status_transitions (
      id, dossier_id, revision_before, revision_after, previous_status, new_status,
      actor_user_id, actor_ref, actor_role, reason, consequences, occurred_at,
      had_current_output, had_reviewer_approval
    ) VALUES (?, 'status-hardening-dossier', ?, ?, ?, ?, ?, ?, 'owner', ?,
      '["recompute_readiness","mark_outputs_stale"]', ?, false, false)
  `).run(
    input.id,
    input.revisionBefore,
    input.revisionBefore + 1,
    input.previousStatus,
    input.newStatus,
    ownerId,
    ownerActor,
    input.reason,
    input.occurredAt,
  );

  assert.throws(() => db.prepare(`
    UPDATE dossiers
    SET closed_at = '2026-09-01T10:40:00.000Z', closed_by_actor_ref = ?,
      closure_reason = 'Forged same-status closure', revision = 2,
      updated_by_actor_ref = ?, updated_at = '2026-09-01T10:40:00.000Z'
    WHERE id = 'status-hardening-dossier' AND revision = 1 AND status = 'draft'
  `).run(ownerActor, ownerActor), /closure and archive fields/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossiers
    SET archived_at = '2026-09-01T10:40:01.000Z', archived_by_actor_ref = ?,
      archive_reason = 'Forged same-status archive', revision = 2,
      updated_by_actor_ref = ?, updated_at = '2026-09-01T10:40:01.000Z'
    WHERE id = 'status-hardening-dossier' AND revision = 1 AND status = 'draft'
  `).run(ownerActor, ownerActor), /closure and archive fields/iu);

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T10:41:00.000Z";
    insertTransition({
      id: "status-reason-mismatch",
      revisionBefore: 1,
      previousStatus: "draft",
      newStatus: "intake_review",
      reason: "Exact intake reason",
      occurredAt,
    });
    assert.throws(() => db.prepare(`
      UPDATE dossiers
      SET status = 'intake_review', status_reason = 'Different intake reason',
        revision = 2, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'status-hardening-dossier' AND revision = 1 AND status = 'draft'
    `).run(ownerActor, occurredAt), /exact reason, time, actor/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T10:42:00.000Z";
    insertTransition({
      id: "status-time-mismatch",
      revisionBefore: 1,
      previousStatus: "draft",
      newStatus: "intake_review",
      reason: "Exact intake reason",
      occurredAt,
    });
    assert.throws(() => db.prepare(`
      UPDATE dossiers
      SET status = 'intake_review', status_reason = 'Exact intake reason',
        revision = 2, updated_by_actor_ref = ?,
        updated_at = '2026-09-01T10:42:01.000Z'
      WHERE id = 'status-hardening-dossier' AND revision = 1 AND status = 'draft'
    `).run(ownerActor), /exact reason, time, actor/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  for (const input of [
    {
      id: "status-title-piggyback",
      assignment: "title = 'Title changed during transition'",
      occurredAt: "2026-09-01T10:43:00.000Z",
    },
    {
      id: "status-priority-piggyback",
      assignment: "priority = 'urgent'",
      occurredAt: "2026-09-01T10:43:01.000Z",
    },
  ]) {
    db.exec("BEGIN IMMEDIATE");
    try {
      insertTransition({
        id: input.id,
        revisionBefore: 1,
        previousStatus: "draft",
        newStatus: "intake_review",
        reason: "Exact intake reason",
        occurredAt: input.occurredAt,
      });
      assert.throws(() => db.prepare(`
        UPDATE dossiers
        SET status = 'intake_review', status_reason = 'Exact intake reason',
          ${input.assignment}, revision = 2,
          updated_by_actor_ref = ?, updated_at = ?
        WHERE id = 'status-hardening-dossier' AND revision = 1 AND status = 'draft'
      `).run(ownerActor, input.occurredAt), /status transitions cannot piggyback dossier metadata changes/iu,
      "the separation guard runs before transition and metadata audits could authorize a mixed root mutation");
    } finally {
      db.exec("ROLLBACK");
    }
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, status_reason, title
    FROM dossiers WHERE id = 'status-hardening-dossier'
  `).get() }, {
    revision: 1,
    status: "draft",
    status_reason: null,
    title: "Matter status-hardening-dossier",
  });

  dossier(db, "metadata-only-dossier", ownerId);
  const metadataOccurredAt = "2026-09-01T10:44:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    const update = db.prepare(`
      UPDATE dossiers
      SET title = 'Exact metadata-only title', priority = 'high', revision = 2,
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'metadata-only-dossier' AND revision = 1 AND status = 'draft'
    `).run(ownerActor, metadataOccurredAt);
    assert.equal(update.changes, 1);
    appendAudit(db, {
      id: "metadata-only-dossier-audit",
      dossierId: "metadata-only-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "dossier_updated",
      objectRefType: "dossier",
      objectRefId: "metadata-only-dossier",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: metadataOccurredAt,
      previousEventId: "metadata-only-dossier-audit-created",
      digestSeed: 21_600,
    });
    appendRevisionReceipt(db, "metadata-only-dossier", 2, ownerActor, metadataOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, title, priority
    FROM dossiers WHERE id = 'metadata-only-dossier'
  `).get() }, {
    revision: 2,
    status: "draft",
    title: "Exact metadata-only title",
    priority: "high",
  });

  const commitExactTransition = (input: {
    id: string;
    revisionBefore: number;
    sequence: number;
    previousEventId: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
    occurredAt: string;
    digestSeed: number;
  }) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      insertTransition(input);
      let update;
      if (input.newStatus === "closed") {
        update = db.prepare(`
          UPDATE dossiers
          SET status = 'closed', status_reason = ?, closed_at = ?,
            closed_by_actor_ref = ?, closure_reason = ?, revision = ?,
            updated_by_actor_ref = ?, updated_at = ?
          WHERE id = 'status-hardening-dossier' AND revision = ? AND status = ?
        `).run(
          input.reason,
          input.occurredAt,
          ownerActor,
          input.reason,
          input.revisionBefore + 1,
          ownerActor,
          input.occurredAt,
          input.revisionBefore,
          input.previousStatus,
        );
      } else if (input.newStatus === "archived") {
        update = db.prepare(`
          UPDATE dossiers
          SET status = 'archived', status_reason = ?, archived_at = ?,
            archived_by_actor_ref = ?, archive_reason = ?, archive_admin_override = false,
            revision = ?, updated_by_actor_ref = ?, updated_at = ?
          WHERE id = 'status-hardening-dossier' AND revision = ? AND status = ?
        `).run(
          input.reason,
          input.occurredAt,
          ownerActor,
          input.reason,
          input.revisionBefore + 1,
          ownerActor,
          input.occurredAt,
          input.revisionBefore,
          input.previousStatus,
        );
      } else {
        update = db.prepare(`
          UPDATE dossiers
          SET status = ?, status_reason = ?, revision = ?,
            updated_by_actor_ref = ?, updated_at = ?
          WHERE id = 'status-hardening-dossier' AND revision = ? AND status = ?
        `).run(
          input.newStatus,
          input.reason,
          input.revisionBefore + 1,
          ownerActor,
          input.occurredAt,
          input.revisionBefore,
          input.previousStatus,
        );
      }
      assert.equal(update.changes, 1);
      appendAudit(db, {
        id: `${input.id}-audit`,
        dossierId: "status-hardening-dossier",
        dossierRevision: input.revisionBefore + 1,
        sequence: input.sequence,
        eventType: "dossier_status_transitioned",
        objectRefType: "status_transition",
        objectRefId: input.id,
        actorUserId: ownerId,
        actorRef: ownerActor,
        actorRole: "owner",
        occurredAt: input.occurredAt,
        previousEventId: input.previousEventId,
        digestSeed: input.digestSeed,
      });
      appendRevisionReceipt(
        db,
        "status-hardening-dossier",
        input.revisionBefore + 1,
        ownerActor,
        input.occurredAt,
      );
      assert.deepEqual(
        db.prepare("PRAGMA foreign_key_check").all(),
        [],
        `exact status transition ${input.id} must satisfy every deferred binding`,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  commitExactTransition({
    id: "status-exact-intake",
    revisionBefore: 1,
    sequence: 2,
    previousEventId: "status-hardening-dossier-audit-created",
    previousStatus: "draft",
    newStatus: "intake_review",
    reason: "Intake accepted",
    occurredAt: "2026-09-01T11:00:00.000Z",
    digestSeed: 21_601,
  });
  commitExactTransition({
    id: "status-exact-active",
    revisionBefore: 2,
    sequence: 3,
    previousEventId: "status-exact-intake-audit",
    previousStatus: "intake_review",
    newStatus: "active",
    reason: "Work commenced",
    occurredAt: "2026-09-01T11:01:00.000Z",
    digestSeed: 21_602,
  });

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T11:02:00.000Z";
    insertTransition({
      id: "status-closed-field-mismatch",
      revisionBefore: 3,
      previousStatus: "active",
      newStatus: "closed",
      reason: "Matter completed",
      occurredAt,
    });
    assert.throws(() => db.prepare(`
      UPDATE dossiers
      SET status = 'closed', status_reason = 'Matter completed', closed_at = ?,
        closed_by_actor_ref = ?, closure_reason = 'Different closure reason',
        revision = 4, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'status-hardening-dossier' AND revision = 3 AND status = 'active'
    `).run(occurredAt, ownerActor, ownerActor, occurredAt), /exact reason, time, actor/iu);
  } finally {
    db.exec("ROLLBACK");
  }
  commitExactTransition({
    id: "status-exact-closed",
    revisionBefore: 3,
    sequence: 4,
    previousEventId: "status-exact-active-audit",
    previousStatus: "active",
    newStatus: "closed",
    reason: "Matter completed",
    occurredAt: "2026-09-01T11:03:00.000Z",
    digestSeed: 21_603,
  });

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T11:04:00.000Z";
    insertTransition({
      id: "status-archive-field-mismatch",
      revisionBefore: 4,
      previousStatus: "closed",
      newStatus: "archived",
      reason: "Retention archive",
      occurredAt,
    });
    assert.throws(() => db.prepare(`
      UPDATE dossiers
      SET status = 'archived', status_reason = 'Retention archive',
        archived_at = '2026-09-01T11:04:01.000Z', archived_by_actor_ref = ?,
        archive_reason = 'Retention archive', archive_admin_override = false,
        revision = 5, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'status-hardening-dossier' AND revision = 4 AND status = 'closed'
    `).run(ownerActor, ownerActor, occurredAt), /exact reason, time, actor/iu);
  } finally {
    db.exec("ROLLBACK");
  }
  commitExactTransition({
    id: "status-exact-archived",
    revisionBefore: 4,
    sequence: 5,
    previousEventId: "status-exact-closed-audit",
    previousStatus: "closed",
    newStatus: "archived",
    reason: "Retention archive",
    occurredAt: "2026-09-01T11:05:00.000Z",
    digestSeed: 21_604,
  });

  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, status_reason, closed_at, closed_by_actor_ref,
      closure_reason, archived_at, archived_by_actor_ref, archive_reason,
      archive_admin_override
    FROM dossiers WHERE id = 'status-hardening-dossier'
  `).get() }, {
    revision: 5,
    status: "archived",
    status_reason: "Retention archive",
    closed_at: "2026-09-01T11:03:00.000Z",
    closed_by_actor_ref: ownerActor,
    closure_reason: "Matter completed",
    archived_at: "2026-09-01T11:05:00.000Z",
    archived_by_actor_ref: ownerActor,
    archive_reason: "Retention archive",
    archive_admin_override: 0,
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_required_audits
    WHERE dossier_id = 'status-hardening-dossier'
      AND dossier_revision > 1 AND event_type = 'dossier_status_transitioned'
  `).get()?.count, 4);
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_required_audits
    WHERE dossier_id = 'status-hardening-dossier'
      AND dossier_revision > 1 AND event_type = 'dossier_updated'
  `).get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 pure dossier revision bumps cannot commit or mint a bare revision receipt", () => {
  const db = database();
  const ownerId = user(db, "pure-revision-owner@example.com", "Pure Revision Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "pure-revision-dossier", ownerId);
  const occurredAt = "2026-09-01T11:10:00.000Z";

  expectDeferredCommitFailure(db, () => {
    advanceDossierRevision(db, "pure-revision-dossier", 1, ownerActor, occurredAt);
    const violations = db.prepare("PRAGMA foreign_key_check").all() as Array<{ table: string }>;
    assert.deepEqual(
      violations.map(({ table }) => table).sort(),
      ["dossier_revision_commitments", "dossiers"],
      "the revision bump and its generated commitment must both remain unresolved without a receipt",
    );
  });

  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "pure-revision-dossier", 1, ownerActor, occurredAt);
    assert.throws(
      () => appendRevisionReceipt(db, "pure-revision-dossier", 2, ownerActor, occurredAt),
      /exact-revision audit event|exact mutation audit claim|primary mutation audit claim/iu,
      "a revision commitment alone must not authorize a receipt without a governed mutation claim",
    );
  } finally {
    db.exec("ROLLBACK");
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT revision, updated_by_actor_ref, updated_at
    FROM dossiers WHERE id = 'pure-revision-dossier'
  `).get() }, {
    revision: 1,
    updated_by_actor_ref: ownerActor,
    updated_at: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_revision_receipts
    WHERE dossier_id = 'pure-revision-dossier' AND resulting_revision = 2
  `).get()?.count, 0);
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_revision_commitments
    WHERE dossier_id = 'pure-revision-dossier' AND resulting_revision = 2
  `).get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 revision commitments bind root and child actor/time in either trigger order", () => {
  const db = database();
  const ownerId = user(db, "commitment-order-owner@example.com", "Commitment Order Owner");
  const ownerActor = actor(db, ownerId);
  const contributorId = user(db, "commitment-order-contributor@example.com", "Commitment Order Contributor");
  const contributorActor = actor(db, contributorId);
  dossier(db, "commitment-order-dossier", ownerId);

  const appendParticipantAudit = (input: {
    id: string;
    revision: number;
    sequence: number;
    previousEventId: string;
    actorUserId: number;
    actorRef: string;
    actorRole: "owner" | "contributor";
    occurredAt: string;
    digestSeed: number;
  }) => appendAudit(db, {
    id: input.id,
    dossierId: "commitment-order-dossier",
    dossierRevision: input.revision,
    sequence: input.sequence,
    eventType: "participant_changed",
    objectRefType: "participant",
    objectRefId: "commitment-order-contributor",
    actorUserId: input.actorUserId,
    actorRef: input.actorRef,
    actorRole: input.actorRole,
    occurredAt: input.occurredAt,
    previousEventId: input.previousEventId,
    digestSeed: input.digestSeed,
  });

  const rootFirstAt = "2026-09-01T11:30:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "commitment-order-dossier", 1, ownerActor, rootFirstAt);
    db.prepare(`
      INSERT INTO dossier_participants (
        id, dossier_id, user_id, actor_id, display_name, role, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES ('commitment-order-contributor', 'commitment-order-dossier',
        ?, ?, 'Commitment Order Contributor', 'contributor', 'active', ?, ?, ?, ?)
    `).run(contributorId, contributorActor, ownerActor, ownerActor, rootFirstAt, rootFirstAt);
    appendParticipantAudit({
      id: "commitment-order-root-first-audit",
      revision: 2,
      sequence: 2,
      previousEventId: "commitment-order-dossier-audit-created",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: rootFirstAt,
      digestSeed: 21_620,
    });
    appendRevisionReceipt(db, "commitment-order-dossier", 2, ownerActor, rootFirstAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const childFirstAt = "2026-09-01T11:31:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      UPDATE dossier_participants
      SET display_name = 'Commitment Order Contributor Updated',
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'commitment-order-contributor'
    `).run(ownerActor, childFirstAt);
    advanceDossierRevision(db, "commitment-order-dossier", 2, ownerActor, childFirstAt);
    appendParticipantAudit({
      id: "commitment-order-child-first-audit",
      revision: 3,
      sequence: 3,
      previousEventId: "commitment-order-root-first-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: childFirstAt,
      digestSeed: 21_621,
    });
    appendRevisionReceipt(db, "commitment-order-dossier", 3, ownerActor, childFirstAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual(db.prepare(`
    SELECT resulting_revision, actor_ref, occurred_at
    FROM dossier_revision_commitments
    WHERE dossier_id = 'commitment-order-dossier' AND resulting_revision IN (2, 3)
    ORDER BY resulting_revision
  `).all().map((row) => ({ ...row })), [
    { resulting_revision: 2, actor_ref: ownerActor, occurred_at: rootFirstAt },
    { resulting_revision: 3, actor_ref: ownerActor, occurred_at: childFirstAt },
  ], "root-first and child-first exact duplicate commitments must converge to one immutable tuple");

  db.exec("BEGIN IMMEDIATE");
  try {
    const rootOccurredAt = "2026-09-01T11:32:00.000Z";
    advanceDossierRevision(db, "commitment-order-dossier", 3, ownerActor, rootOccurredAt);
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_required_audits (
        id, dossier_id, dossier_revision, claim_phase, event_type,
        object_ref_type, object_ref_id, actor_ref, occurred_at
      ) VALUES ('commitment-order-root-first-mismatch-claim',
        'commitment-order-dossier', 4, 'revision', 'assertion_reviewed',
        'professional_assertion', 'synthetic-root-first-child', ?,
        '2026-09-01T11:32:01.000Z')
    `).run(contributorActor), /revision commitment.*actor|revision commitment.*time|exact revision commitment/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO dossier_required_audits (
        id, dossier_id, dossier_revision, claim_phase, event_type,
        object_ref_type, object_ref_id, actor_ref, occurred_at
      ) VALUES ('commitment-order-child-first-mismatch-claim',
        'commitment-order-dossier', 4, 'revision', 'assertion_reviewed',
        'professional_assertion', 'synthetic-child-first-child', ?,
        '2026-09-01T11:33:00.000Z')
    `).run(contributorActor);
    assert.throws(
      () => advanceDossierRevision(
        db,
        "commitment-order-dossier",
        3,
        ownerActor,
        "2026-09-01T11:33:01.000Z",
      ),
      /revision commitment.*actor|revision commitment.*time|exact revision commitment/iu,
    );
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T11:34:00.000Z";
    advanceDossierRevision(db, "commitment-order-dossier", 3, ownerActor, occurredAt);
    db.prepare(`
      UPDATE dossier_participants
      SET display_name = 'Receipt actor mismatch', updated_by_actor_ref = ?,
        updated_at = ?
      WHERE id = 'commitment-order-contributor'
    `).run(ownerActor, occurredAt);
    appendAudit(db, {
      id: "commitment-order-primary-other-actor",
      dossierId: "commitment-order-dossier",
      dossierRevision: 4,
      sequence: 4,
      eventType: "dossier_updated",
      objectRefType: "dossier",
      objectRefId: "commitment-order-dossier",
      actorUserId: contributorId,
      actorRef: contributorActor,
      actorRole: "contributor",
      occurredAt,
      previousEventId: "commitment-order-child-first-audit",
      digestSeed: 21_622,
    });
    appendParticipantAudit({
      id: "commitment-order-exact-participant-audit",
      revision: 4,
      sequence: 5,
      previousEventId: "commitment-order-primary-other-actor",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      digestSeed: 21_623,
    });
    assert.throws(
      () => appendRevisionReceipt(db, "commitment-order-dossier", 4, contributorActor, occurredAt),
      /dossier revision receipt requires an exact mutation commitment/iu,
    );
  } finally {
    db.exec("ROLLBACK");
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status FROM dossiers WHERE id = 'commitment-order-dossier'
  `).get() }, { revision: 3, status: "draft" });
  assert.equal(
    db.prepare("SELECT display_name FROM dossier_participants WHERE id = 'commitment-order-contributor'").get()?.display_name,
    "Commitment Order Contributor Updated",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 assertion-source mutations use the live dossier actor/time instead of stale parent provenance", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "assertion-source-owner@example.com", "Assertion Source Owner");
  const ownerActor = actor(db, ownerId);
  const contributorId = user(db, "assertion-source-contributor@example.com", "Assertion Source Contributor");
  const contributorActor = actor(db, contributorId);
  dossier(db, "assertion-source-dossier", ownerId);
  db.prepare(`
    INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('assertion-source-contributor', 'assertion-source-dossier', ?, ?,
      'Assertion Source Contributor', 'contributor', 'active', ?, ?)
  `).run(contributorId, contributorActor, ownerActor, ownerActor);
  const documentHash = addDocument(db, {
    dossierId: "assertion-source-dossier",
    documentId: "assertion-source-document",
    versionId: "assertion-source-v1",
    sourceOrigin: "external_reference",
    hashSeed: 21_650,
  });
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id,
      character_start, character_end, excerpt, anchor_checksum,
      creator, review_state, created_by_actor_ref, created_at
    ) VALUES ('assertion-source-anchor', 'assertion-source-dossier',
      'assertion-source-document', 'assertion-source-v1', 0, 12,
      'Exact source', ?, 'human', 'pending', ?, '2026-09-01T11:39:00.000Z')
  `).run(documentHash, ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = '2026-09-01T11:39:30.000Z'
    WHERE id = 'assertion-source-anchor'
  `).run(ownerId, ownerActor);
  const parentCreatedAt = "2026-09-01T11:40:00.000Z";
  db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES ('assertion-source-parent', 'assertion-source-dossier', 'fact',
      'Owner-created pending assertion.', 'needs_review', ?, ?, ?, ?)
  `).run(ownerActor, ownerActor, parentCreatedAt, parentCreatedAt);
  db.exec(migration(auditClaimsMigration));
  db.exec(migration(uploadCommitmentMigration));
  db.exec(migration(statusHistoryMigration));

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T11:41:00.000Z";
    advanceDossierRevision(db, "assertion-source-dossier", 1, contributorActor, occurredAt);
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES ('assertion-source-dossier', 'assertion-source-parent',
        'assertion-source-anchor', '2026-09-01T11:41:01.000Z')
    `).run(), /assertion-source creation time must match the live dossier mutation/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  const insertedAt = "2026-09-01T11:42:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "assertion-source-dossier", 1, contributorActor, insertedAt);
    db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES ('assertion-source-dossier', 'assertion-source-parent',
        'assertion-source-anchor', ?)
    `).run(insertedAt);
    assert.deepEqual({ ...db.prepare(`
      SELECT dossier_revision, event_type, object_ref_type, object_ref_id,
        actor_ref, occurred_at
      FROM dossier_required_audits
      WHERE dossier_id = 'assertion-source-dossier' AND dossier_revision = 2
        AND object_ref_id = 'assertion-source-parent'
    `).get() }, {
      dossier_revision: 2,
      event_type: "assertion_reviewed",
      object_ref_type: "professional_assertion",
      object_ref_id: "assertion-source-parent",
      actor_ref: contributorActor,
      occurred_at: insertedAt,
    });
    appendAudit(db, {
      id: "assertion-source-insert-audit",
      dossierId: "assertion-source-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: "assertion-source-parent",
      actorUserId: contributorId,
      actorRef: contributorActor,
      actorRole: "contributor",
      occurredAt: insertedAt,
      previousEventId: "assertion-source-dossier-audit-created",
      digestSeed: 21_651,
    });
    appendRevisionReceipt(db, "assertion-source-dossier", 2, contributorActor, insertedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const deletedAt = "2026-09-01T11:43:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "assertion-source-dossier", 2, contributorActor, deletedAt);
    db.prepare(`
      DELETE FROM dossier_assertion_sources
      WHERE dossier_id = 'assertion-source-dossier'
        AND assertion_id = 'assertion-source-parent'
        AND source_anchor_id = 'assertion-source-anchor'
    `).run();
    assert.deepEqual({ ...db.prepare(`
      SELECT dossier_revision, event_type, object_ref_type, object_ref_id,
        actor_ref, occurred_at
      FROM dossier_required_audits
      WHERE dossier_id = 'assertion-source-dossier' AND dossier_revision = 3
        AND object_ref_id = 'assertion-source-parent'
    `).get() }, {
      dossier_revision: 3,
      event_type: "assertion_reviewed",
      object_ref_type: "professional_assertion",
      object_ref_id: "assertion-source-parent",
      actor_ref: contributorActor,
      occurred_at: deletedAt,
    });
    appendAudit(db, {
      id: "assertion-source-delete-audit",
      dossierId: "assertion-source-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: "assertion-source-parent",
      actorUserId: contributorId,
      actorRef: contributorActor,
      actorRole: "contributor",
      occurredAt: deletedAt,
      previousEventId: "assertion-source-insert-audit",
      digestSeed: 21_652,
    });
    appendRevisionReceipt(db, "assertion-source-dossier", 3, contributorActor, deletedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT updated_by_actor_ref, updated_at
    FROM dossier_professional_assertions
    WHERE id = 'assertion-source-parent'
  `).get() }, {
    updated_by_actor_ref: ownerActor,
    updated_at: parentCreatedAt,
  }, "the parent intentionally retains its older owner provenance");
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_assertion_sources
    WHERE dossier_id = 'assertion-source-dossier'
      AND assertion_id = 'assertion-source-parent'
  `).get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 dossier creation provenance is immutable alone and during title or status mutations", () => {
  const db = database();
  const ownerId = user(db, "root-provenance-owner@example.com", "Root Provenance Owner");
  const ownerActor = actor(db, ownerId);
  const outsiderId = user(db, "root-provenance-outsider@example.com", "Root Provenance Outsider");
  const outsiderActor = actor(db, outsiderId);
  dossier(db, "root-provenance-dossier", ownerId);

  const expectImmediateProvenanceFailure = (work: () => void) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      assert.throws(
        work,
        /dossier identity and creation provenance are immutable/iu,
        "creation provenance must reject synchronously before any deferred receipt can mask it",
      );
    } finally {
      db.exec("ROLLBACK");
    }
  };

  expectImmediateProvenanceFailure(() => db.prepare(`
    UPDATE dossiers
    SET created_by_actor_ref = ?, created_at = '2026-09-01T11:20:00.000Z',
      revision = 2, updated_by_actor_ref = ?, updated_at = '2026-09-01T11:20:00.000Z'
    WHERE id = 'root-provenance-dossier' AND revision = 1
  `).run(outsiderActor, ownerActor));

  expectImmediateProvenanceFailure(() => db.prepare(`
    UPDATE dossiers
    SET title = 'Piggybacked forged title', created_by_actor_ref = ?,
      created_at = '2026-09-01T11:21:00.000Z', revision = 2,
      updated_by_actor_ref = ?, updated_at = '2026-09-01T11:21:00.000Z'
    WHERE id = 'root-provenance-dossier' AND revision = 1
  `).run(outsiderActor, ownerActor));

  expectImmediateProvenanceFailure(() => {
    const occurredAt = "2026-09-01T11:22:00.000Z";
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status,
        new_status, actor_user_id, actor_ref, actor_role, reason,
        consequences, occurred_at, had_current_output, had_reviewer_approval
      ) VALUES ('root-provenance-transition', 'root-provenance-dossier',
        1, 2, 'draft', 'intake_review', ?, ?, 'owner', 'Intake accepted',
        '["recompute_readiness","mark_outputs_stale"]', ?, false, false)
    `).run(ownerId, ownerActor, occurredAt);
    db.prepare(`
      UPDATE dossiers
      SET status = 'intake_review', status_reason = 'Intake accepted',
        created_by_actor_ref = ?, created_at = ?, revision = 2,
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'root-provenance-dossier' AND revision = 1 AND status = 'draft'
    `).run(outsiderActor, occurredAt, ownerActor, occurredAt);
  });

  assert.deepEqual({ ...db.prepare(`
    SELECT title, status, revision, created_by_actor_ref, created_at
    FROM dossiers WHERE id = 'root-provenance-dossier'
  `).get() }, {
    title: "Matter root-provenance-dossier",
    status: "draft",
    revision: 1,
    created_by_actor_ref: ownerActor,
    created_at: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_status_transitions
    WHERE dossier_id = 'root-provenance-dossier'
  `).get()?.count, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 internal upload version commitment rolls back without the final committed intent state", () => {
  const db = database();
  const ownerId = user(db, "upload-commitment-owner@example.com", "Upload Commitment Owner");
  const ownerActor = actor(db, ownerId);
  const otherId = user(db, "upload-commitment-other@example.com", "Upload Commitment Other");
  const otherActor = actor(db, otherId);
  dossier(db, "upload-commitment-dossier", ownerId);
  const objectReference = `private/uploads/commitment/${"u".repeat(40)}`;
  const contentHash = digest(21_700);
  const occurredAt = "2026-09-01T08:40:00.000Z";

  db.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, is_provisional,
      classification, created_by_actor_ref, updated_by_actor_ref,
      created_at, updated_at
    ) VALUES ('upload-commitment-document', 'upload-commitment-dossier',
      'Upload commitment document', 'source', 'internal_upload', true,
      'confidential', ?, ?, ?, ?)
  `).run(ownerActor, ownerActor, occurredAt, occurredAt);
  db.prepare(`
    INSERT INTO dossier_upload_intents (
      id, dossier_id, document_id, actor_user_id, actor_ref,
      idempotency_key_hash, request_binding_digest, expected_dossier_revision,
      temporary_object_reference, expected_media_type, expected_byte_length,
      expected_content_sha256, expires_at, created_at, updated_at
    ) VALUES ('upload-commitment-intent', 'upload-commitment-dossier',
      'upload-commitment-document', ?, ?, ?, ?, 1, ?, 'text/plain', 256, ?,
      '2099-01-01T00:00:00.000Z', ?, ?)
  `).run(
    ownerId,
    ownerActor,
    digest(21_701),
    digest(21_702),
    objectReference,
    contentHash,
    occurredAt,
    occurredAt,
  );

  const insertVersionWithProvenance = (input: {
    id: string;
    uploaderUserId: number;
    uploaderActor: string;
    uploadedAt: string;
    createdByActor: string;
    createdAt: string;
  }) => db.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference,
      original_filename, media_type, byte_length, content_sha256,
      uploader_user_id, uploader_actor_ref, upload_intent_id, uploaded_at,
      predecessor_version_id, source_note, created_by_actor_ref, created_at
    ) VALUES (?, 'upload-commitment-dossier', 'upload-commitment-document',
      1, ?, 'forged.txt', 'text/plain', 256, ?, ?, ?,
      'upload-commitment-intent', ?, null, 'Provenance rejection probe', ?, ?)
  `).run(
    input.id,
    `${objectReference}/${input.id}`,
    contentHash,
    input.uploaderUserId,
    input.uploaderActor,
    input.uploadedAt,
    input.createdByActor,
    input.createdAt,
  );
  const versionProvenanceCases = [
    {
      id: "upload-version-created-actor-mismatch",
      uploaderUserId: ownerId,
      uploaderActor: ownerActor,
      uploadedAt: occurredAt,
      createdByActor: otherActor,
      createdAt: occurredAt,
    },
    {
      id: "upload-version-created-time-mismatch",
      uploaderUserId: ownerId,
      uploaderActor: ownerActor,
      uploadedAt: occurredAt,
      createdByActor: ownerActor,
      createdAt: "2026-09-01T08:40:01.000Z",
    },
    {
      id: "upload-version-user-actor-mismatch",
      uploaderUserId: ownerId,
      uploaderActor: otherActor,
      uploadedAt: occurredAt,
      createdByActor: otherActor,
      createdAt: occurredAt,
    },
    {
      id: "upload-version-intent-actor-mismatch",
      uploaderUserId: otherId,
      uploaderActor: otherActor,
      uploadedAt: occurredAt,
      createdByActor: otherActor,
      createdAt: occurredAt,
    },
  ] as const;
  for (const input of versionProvenanceCases) {
    assert.throws(
      () => insertVersionWithProvenance(input),
      /document-version provenance must match its exact uploader and upload intent/iu,
      `${input.id} must reject before it can create upload commitments or current pointers`,
    );
  }
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_document_versions
    WHERE id LIKE 'upload-version-%-mismatch'
  `).get()?.count, 0);

  const writeUploadRevision = (commitIntent: boolean) => {
    db.prepare(`
      UPDATE dossier_upload_intents
      SET committed_object_reference = ?, measured_media_type = 'text/plain',
        measured_byte_length = 256, measured_content_sha256 = ?, updated_at = ?
      WHERE dossier_id = 'upload-commitment-dossier'
        AND id = 'upload-commitment-intent' AND state = 'pending'
        AND expected_dossier_revision = 1
    `).run(objectReference, contentHash, occurredAt);
    db.prepare(`
      INSERT INTO dossier_document_versions (
        id, dossier_id, document_id, ordinal, binary_object_reference,
        original_filename, media_type, byte_length, content_sha256,
        uploader_user_id, uploader_actor_ref, upload_intent_id, uploaded_at,
        predecessor_version_id, source_note, created_by_actor_ref, created_at
      ) VALUES ('upload-commitment-v1', 'upload-commitment-dossier',
        'upload-commitment-document', 1, ?, 'commitment.txt', 'text/plain',
        256, ?, ?, ?, 'upload-commitment-intent', ?, null,
        'Production-order commitment probe', ?, ?)
    `).run(objectReference, contentHash, ownerId, ownerActor, occurredAt, ownerActor, occurredAt);
    db.prepare(`
      INSERT INTO dossier_document_current_versions (
        dossier_id, document_id, document_version_id, updated_at, updated_by_actor_ref
      ) VALUES ('upload-commitment-dossier', 'upload-commitment-document',
        'upload-commitment-v1', ?, ?)
    `).run(occurredAt, ownerActor);
    db.prepare(`
      UPDATE dossier_documents
      SET is_provisional = false, updated_at = ?, updated_by_actor_ref = ?
      WHERE dossier_id = 'upload-commitment-dossier'
        AND id = 'upload-commitment-document' AND is_provisional = true
    `).run(occurredAt, ownerActor);
    db.prepare(`
      INSERT INTO dossier_extraction_jobs (
        id, dossier_id, document_id, document_version_id, status,
        extractor_version, attempt, created_at, updated_at
      ) VALUES ('upload-commitment-extraction', 'upload-commitment-dossier',
        'upload-commitment-document', 'upload-commitment-v1', 'queued',
        'plain-text-v1', 1, ?, ?)
    `).run(occurredAt, occurredAt);
    advanceDossierRevision(db, "upload-commitment-dossier", 1, ownerActor, occurredAt);
    appendAudit(db, {
      id: "upload-commitment-document-audit",
      dossierId: "upload-commitment-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "document_created",
      objectRefType: "document",
      objectRefId: "upload-commitment-document",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "upload-commitment-dossier-audit-created",
      digestSeed: 21_703,
    });
    appendAudit(db, {
      id: "upload-commitment-version-audit",
      dossierId: "upload-commitment-dossier",
      dossierRevision: 2,
      sequence: 3,
      eventType: "document_version_created",
      objectRefType: "document_version",
      objectRefId: "upload-commitment-v1",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "upload-commitment-document-audit",
      digestSeed: 21_704,
    });
    appendRevisionReceipt(db, "upload-commitment-dossier", 2, ownerActor, occurredAt);
    if (commitIntent) {
      const committed = db.prepare(`
        UPDATE dossier_upload_intents
        SET state = 'committed', updated_at = ?, committed_at = ?
        WHERE dossier_id = 'upload-commitment-dossier'
          AND id = 'upload-commitment-intent' AND state = 'pending'
          AND expected_dossier_revision = 1
      `).run(occurredAt, occurredAt);
      assert.equal(committed.changes, 1, "the final production-order intent transition must win exactly once");
    }
  };

  expectDeferredCommitFailure(db, () => {
    writeUploadRevision(false);
    const violations = db.prepare("PRAGMA foreign_key_check").all() as Array<{ table: string }>;
    assert.deepEqual(violations.map(({ table }) => table), ["dossier_upload_version_commitments"],
      "all earlier audit and receipt obligations are satisfied before only the pending-intent commitment fails");
  });
  assert.deepEqual({ ...db.prepare(`
    SELECT revision FROM dossiers WHERE id = 'upload-commitment-dossier'
  `).get(), ...db.prepare(`
    SELECT state, committed_object_reference, measured_media_type,
      measured_byte_length, measured_content_sha256, committed_at
    FROM dossier_upload_intents WHERE id = 'upload-commitment-intent'
  `).get() }, {
    revision: 1,
    state: "pending",
    committed_object_reference: null,
    measured_media_type: null,
    measured_byte_length: null,
    measured_content_sha256: null,
    committed_at: null,
  });
  assert.equal(db.prepare("SELECT is_provisional FROM dossier_documents WHERE id = 'upload-commitment-document'").get()?.is_provisional, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_versions WHERE id = 'upload-commitment-v1'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_current_versions WHERE document_id = 'upload-commitment-document'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_extraction_jobs WHERE id = 'upload-commitment-extraction'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_upload_version_commitments WHERE document_version_id = 'upload-commitment-v1'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_revision_receipts WHERE dossier_id = 'upload-commitment-dossier'").get()?.count, 1);

  db.exec("BEGIN IMMEDIATE");
  try {
    writeUploadRevision(true);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT intent.state, intent.committed_at, document.is_provisional,
      current_version.document_version_id, commitment.upload_intent_id,
      commitment.required_state
    FROM dossier_upload_intents AS intent
    JOIN dossier_documents AS document
      ON document.dossier_id = intent.dossier_id AND document.id = intent.document_id
    JOIN dossier_document_current_versions AS current_version
      ON current_version.dossier_id = document.dossier_id
      AND current_version.document_id = document.id
    JOIN dossier_upload_version_commitments AS commitment
      ON commitment.dossier_id = intent.dossier_id
      AND commitment.upload_intent_id = intent.id
    WHERE intent.id = 'upload-commitment-intent'
  `).get() }, {
    state: "committed",
    committed_at: occurredAt,
    is_provisional: 0,
    document_version_id: "upload-commitment-v1",
    upload_intent_id: "upload-commitment-intent",
    required_state: "committed",
  });
  assert.throws(() => db.prepare(`
    UPDATE dossier_upload_version_commitments
    SET created_at = '2099-01-01T00:00:00.000Z'
    WHERE document_version_id = 'upload-commitment-v1'
  `).run(), /immutable/iu);
  assert.throws(() => db.prepare(`
    DELETE FROM dossier_upload_version_commitments
    WHERE document_version_id = 'upload-commitment-v1'
  `).run(), /immutable/iu);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 orphan AI-created source anchors require their own exact revision audit", () => {
  const db = database();
  const ownerId = user(db, "ai-anchor-claim-owner@example.com", "AI Anchor Claim Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "ai-anchor-claim-dossier", ownerId);
  const documentHash = digest(21_800);
  const documentOccurredAt = "2026-09-01T08:50:00.000Z";

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO dossier_documents (
        id, dossier_id, title, document_type, source_origin, is_provisional,
        classification, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES ('ai-anchor-claim-document', 'ai-anchor-claim-dossier',
        'AI anchor source', 'source', 'external_reference', true,
        'confidential', ?, ?, ?, ?)
    `).run(ownerActor, ownerActor, documentOccurredAt, documentOccurredAt);
    db.prepare(`
      INSERT INTO dossier_document_versions (
        id, dossier_id, document_id, ordinal, binary_object_reference,
        original_filename, media_type, byte_length, content_sha256,
        uploader_user_id, uploader_actor_ref, uploaded_at,
        predecessor_version_id, created_by_actor_ref, created_at
      ) VALUES ('ai-anchor-claim-v1', 'ai-anchor-claim-dossier',
        'ai-anchor-claim-document', 1, ?, 'anchor-source.txt', 'text/plain',
        128, ?, ?, ?, ?, null, ?, ?)
    `).run(
      `private/ai-anchor/source/${"a".repeat(40)}`,
      documentHash,
      ownerId,
      ownerActor,
      documentOccurredAt,
      ownerActor,
      documentOccurredAt,
    );
    advanceDossierRevision(db, "ai-anchor-claim-dossier", 1, ownerActor, documentOccurredAt);
    appendAudit(db, {
      id: "ai-anchor-document-audit",
      dossierId: "ai-anchor-claim-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "document_created",
      objectRefType: "document",
      objectRefId: "ai-anchor-claim-document",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: documentOccurredAt,
      previousEventId: "ai-anchor-claim-dossier-audit-created",
      digestSeed: 21_801,
    });
    appendAudit(db, {
      id: "ai-anchor-version-audit",
      dossierId: "ai-anchor-claim-dossier",
      dossierRevision: 2,
      sequence: 3,
      eventType: "document_version_created",
      objectRefType: "document_version",
      objectRefId: "ai-anchor-claim-v1",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: documentOccurredAt,
      previousEventId: "ai-anchor-document-audit",
      digestSeed: 21_802,
    });
    appendRevisionReceipt(db, "ai-anchor-claim-dossier", 2, ownerActor, documentOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const anchorOccurredAt = "2026-09-01T08:51:00.000Z";
  const insertOrphanAiAnchor = () => db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id,
      character_start, character_end, excerpt, anchor_checksum,
      extraction_version, creator, review_state, created_by_actor_ref, created_at
    ) VALUES ('orphan-ai-anchor', 'ai-anchor-claim-dossier',
      'ai-anchor-claim-document', 'ai-anchor-claim-v1', 0, 10,
      'AI excerpt', ?, null, 'ai_proposal', 'pending', ?, ?)
  `).run(digest(21_803), ownerActor, anchorOccurredAt);

  expectDeferredCommitFailure(db, () => {
    advanceDossierRevision(db, "ai-anchor-claim-dossier", 2, ownerActor, anchorOccurredAt);
    insertOrphanAiAnchor();
    appendAudit(db, {
      id: "orphan-ai-anchor-unrelated-audit",
      dossierId: "ai-anchor-claim-dossier",
      dossierRevision: 3,
      sequence: 4,
      eventType: "dossier_updated",
      objectRefType: "dossier",
      objectRefId: "ai-anchor-claim-dossier",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: anchorOccurredAt,
      previousEventId: "ai-anchor-version-audit",
      digestSeed: 21_804,
    });
    appendRevisionReceipt(db, "ai-anchor-claim-dossier", 3, ownerActor, anchorOccurredAt);
    const violations = db.prepare("PRAGMA foreign_key_check").all() as Array<{ table: string }>;
    assert.deepEqual(violations.map(({ table }) => table), ["dossier_required_audits"],
      "an unrelated revision audit and receipt cannot certify an orphan AI-created source anchor");
  });
  assert.equal(db.prepare("SELECT revision FROM dossiers WHERE id = 'ai-anchor-claim-dossier'").get()?.revision, 2);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_source_anchors WHERE id = 'orphan-ai-anchor'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'orphan-ai-anchor-unrelated-audit'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_revision_receipts WHERE resulting_revision = 3").get()?.count, 0);

  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "ai-anchor-claim-dossier", 2, ownerActor, anchorOccurredAt);
    insertOrphanAiAnchor();
    appendAudit(db, {
      id: "orphan-ai-anchor-exact-audit",
      dossierId: "ai-anchor-claim-dossier",
      dossierRevision: 3,
      sequence: 4,
      eventType: "source_anchor_reviewed",
      objectRefType: "source_anchor",
      objectRefId: "orphan-ai-anchor",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: anchorOccurredAt,
      previousEventId: "ai-anchor-version-audit",
      digestSeed: 21_805,
    });
    appendRevisionReceipt(db, "ai-anchor-claim-dossier", 3, ownerActor, anchorOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT creator, review_state, created_by_actor_ref, created_at
    FROM dossier_source_anchors WHERE id = 'orphan-ai-anchor'
  `).get() }, {
    creator: "ai_proposal",
    review_state: "pending",
    created_by_actor_ref: ownerActor,
    created_at: anchorOccurredAt,
  });
  assert.deepEqual({ ...db.prepare(`
    SELECT dossier_revision, claim_phase, event_type, object_ref_type,
      object_ref_id, actor_ref, occurred_at
    FROM dossier_required_audits
    WHERE dossier_id = 'ai-anchor-claim-dossier'
      AND object_ref_id = 'orphan-ai-anchor'
  `).get() }, {
    dossier_revision: 3,
    claim_phase: "revision",
    event_type: "source_anchor_reviewed",
    object_ref_type: "source_anchor",
    object_ref_id: "orphan-ai-anchor",
    actor_ref: ownerActor,
    occurred_at: anchorOccurredAt,
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_ai_proposal_anchors
    WHERE dossier_id = 'ai-anchor-claim-dossier' AND source_anchor_id = 'orphan-ai-anchor'
  `).get()?.count, 0, "the audit requirement applies even before any proposal-source link can claim the AI anchor");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0014 assertion_type and accepted-assertion supersession require the current exact mutation tuple", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "assertion-claim-owner@example.com", "Assertion Claim Owner");
  const ownerActor = actor(db, ownerId);
  const contributorId = user(db, "assertion-claim-contributor@example.com", "Assertion Claim Contributor");
  const contributorActor = actor(db, contributorId);
  dossier(db, "assertion-claim-dossier", ownerId);
  db.prepare(`
    INSERT INTO dossier_participants (
      id, dossier_id, user_id, actor_id, display_name, role, status,
      created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('assertion-claim-contributor', 'assertion-claim-dossier', ?, ?,
      'Assertion Claim Contributor', 'contributor', 'active', ?, ?)
  `).run(contributorId, contributorActor, ownerActor, ownerActor);
  const documentHash = addDocument(db, {
    dossierId: "assertion-claim-dossier",
    documentId: "assertion-claim-document",
    versionId: "assertion-claim-v1",
    sourceOrigin: "external_reference",
    hashSeed: 21_900,
  });
  const originalReviewedAt = "2026-09-01T10:10:00.000Z";
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id,
      character_start, character_end, excerpt, anchor_checksum,
      creator, review_state, created_by_actor_ref, created_at
    ) VALUES ('assertion-claim-anchor', 'assertion-claim-dossier',
      'assertion-claim-document', 'assertion-claim-v1', 0, 12,
      'Exact source', ?, 'human', 'pending', ?, '2026-09-01T09:50:00.000Z')
  `).run(documentHash, ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = ?
    WHERE id = 'assertion-claim-anchor'
  `).run(ownerId, ownerActor, originalReviewedAt);
  db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES
      ('assertion-type-target', 'assertion-claim-dossier', 'fact',
        'Classification requires review.', 'needs_review', ?, ?,
        '2026-09-01T09:51:00.000Z', '2026-09-01T09:51:00.000Z'),
      ('assertion-supersede-target', 'assertion-claim-dossier', 'fact',
        'Accepted statement.', 'needs_review', ?, ?,
        '2026-09-01T09:52:00.000Z', '2026-09-01T09:52:00.000Z'),
      ('assertion-accept-target', 'assertion-claim-dossier', 'fact',
        'Pending statement to accept.', 'needs_review', ?, ?,
        '2026-09-01T09:54:00.000Z', '2026-09-01T09:54:00.000Z'),
      ('assertion-reject-target', 'assertion-claim-dossier', 'fact',
        'Pending statement to reject.', 'needs_review', ?, ?,
        '2026-09-01T09:55:00.000Z', '2026-09-01T09:55:00.000Z')
  `).run(
    ownerActor,
    ownerActor,
    ownerActor,
    ownerActor,
    ownerActor,
    ownerActor,
    ownerActor,
    ownerActor,
  );
  db.prepare(`
    INSERT INTO dossier_assertion_sources (
      dossier_id, assertion_id, source_anchor_id, created_at
    ) VALUES
      ('assertion-claim-dossier', 'assertion-supersede-target',
        'assertion-claim-anchor', '2026-09-01T09:53:00.000Z'),
      ('assertion-claim-dossier', 'assertion-accept-target',
        'assertion-claim-anchor', '2026-09-01T09:54:30.000Z')
  `).run();
  db.prepare(`
    UPDATE dossier_professional_assertions
    SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
      reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
    WHERE id = 'assertion-supersede-target'
  `).run(ownerId, ownerActor, originalReviewedAt, ownerActor, originalReviewedAt);
  db.exec(migration(auditClaimsMigration));
  db.exec(migration(uploadCommitmentMigration));
  db.exec(migration(statusHistoryMigration));

  db.exec("BEGIN IMMEDIATE");
  try {
    assert.throws(() => db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'superseded', updated_by_actor_ref = ?,
        updated_at = '2026-09-01T09:59:00.000Z'
      WHERE id = 'assertion-type-target' AND status = 'needs_review'
    `).run(ownerActor), /pending|needs_review.*accepted or rejected|assertion review transition/iu);
  } finally {
    db.exec("ROLLBACK");
  }
  assert.equal(
    db.prepare("SELECT status FROM dossier_professional_assertions WHERE id = 'assertion-type-target'").get()?.status,
    "needs_review",
  );

  for (const input of [
    {
      statement: "Classification requires review.",
      message: "review provenance alone cannot be staged on a pending assertion",
    },
    {
      statement: "Rewritten while still pending.",
      message: "a statement edit cannot piggyback premature review provenance",
    },
  ]) {
    db.exec("BEGIN IMMEDIATE");
    try {
      assert.throws(() => db.prepare(`
        UPDATE dossier_professional_assertions
        SET statement = ?, reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
          reviewed_at = '2026-09-01T09:59:30.000Z'
        WHERE id = 'assertion-type-target' AND status = 'needs_review'
      `).run(input.statement, ownerId, ownerActor),
      /dossier_professional_assertions_reviewer_pair_check|CHECK constraint failed/iu,
      input.message);
    } finally {
      db.exec("ROLLBACK");
    }
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT statement, status, reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
    FROM dossier_professional_assertions WHERE id = 'assertion-type-target'
  `).get() }, {
    statement: "Classification requires review.",
    status: "needs_review",
    reviewed_by_user_id: null,
    reviewed_by_actor_ref: null,
    reviewed_at: null,
  });

  const typeOccurredAt = "2026-09-01T10:00:00.000Z";
  expectDeferredCommitFailure(db, () => {
    advanceDossierRevision(db, "assertion-claim-dossier", 1, ownerActor, typeOccurredAt);
    db.prepare(`
      UPDATE dossier_professional_assertions
      SET assertion_type = 'rule', updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'assertion-type-target'
    `).run(ownerActor, typeOccurredAt);
    appendAudit(db, {
      id: "assertion-type-unrelated-audit",
      dossierId: "assertion-claim-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "dossier_updated",
      objectRefType: "dossier",
      objectRefId: "assertion-claim-dossier",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: typeOccurredAt,
      previousEventId: "assertion-claim-dossier-audit-created",
      digestSeed: 21_901,
    });
    appendRevisionReceipt(db, "assertion-claim-dossier", 2, ownerActor, typeOccurredAt);
    const violations = db.prepare("PRAGMA foreign_key_check").all() as Array<{ table: string }>;
    assert.deepEqual(violations.map(({ table }) => table), ["dossier_required_audits"]);
  });
  assert.equal(db.prepare("SELECT assertion_type FROM dossier_professional_assertions WHERE id = 'assertion-type-target'").get()?.assertion_type, "fact");

  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "assertion-claim-dossier", 1, ownerActor, typeOccurredAt);
    db.prepare(`
      UPDATE dossier_professional_assertions
      SET assertion_type = 'rule', updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'assertion-type-target'
    `).run(ownerActor, typeOccurredAt);
    appendAudit(db, {
      id: "assertion-type-exact-audit",
      dossierId: "assertion-claim-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: "assertion-type-target",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: typeOccurredAt,
      previousEventId: "assertion-claim-dossier-audit-created",
      digestSeed: 21_902,
    });
    appendRevisionReceipt(db, "assertion-claim-dossier", 2, ownerActor, typeOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.equal(db.prepare("SELECT assertion_type FROM dossier_professional_assertions WHERE id = 'assertion-type-target'").get()?.assertion_type, "rule");

  for (const input of [
    {
      assertionId: "assertion-accept-target",
      status: "accepted",
      reviewedAt: "2026-09-01T10:02:00.000Z",
      updatedByActor: contributorActor,
      updatedAt: "2026-09-01T10:02:00.000Z",
      message: "acceptance cannot attribute its mutation to a different actor",
    },
    {
      assertionId: "assertion-reject-target",
      status: "rejected",
      reviewedAt: "2026-09-01T10:03:00.000Z",
      updatedByActor: ownerActor,
      updatedAt: "2026-09-01T10:03:01.000Z",
      message: "rejection cannot attribute its mutation to a different time",
    },
  ]) {
    db.exec("BEGIN IMMEDIATE");
    try {
      assert.throws(() => db.prepare(`
        UPDATE dossier_professional_assertions
        SET status = ?, reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
          reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
        WHERE id = ? AND status = 'needs_review'
      `).run(
        input.status,
        ownerId,
        ownerActor,
        input.reviewedAt,
        input.updatedByActor,
        input.updatedAt,
        input.assertionId,
      ), /assertion review.*exact|review.*provenance|reviewer.*updated/iu, input.message);
    } finally {
      db.exec("ROLLBACK");
    }
  }
  assert.deepEqual(db.prepare(`
    SELECT id, status FROM dossier_professional_assertions
    WHERE id IN ('assertion-accept-target', 'assertion-reject-target')
    ORDER BY id
  `).all().map((row) => ({ ...row })), [
    { id: "assertion-accept-target", status: "needs_review" },
    { id: "assertion-reject-target", status: "needs_review" },
  ]);

  const commitPendingReview = (input: {
    assertionId: string;
    status: "accepted" | "rejected";
    revisionBefore: number;
    sequence: number;
    previousEventId: string;
    occurredAt: string;
    digestSeed: number;
  }) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      advanceDossierRevision(
        db,
        "assertion-claim-dossier",
        input.revisionBefore,
        ownerActor,
        input.occurredAt,
      );
      const update = db.prepare(`
        UPDATE dossier_professional_assertions
        SET status = ?, reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
          reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
        WHERE id = ? AND status = 'needs_review'
      `).run(
        input.status,
        ownerId,
        ownerActor,
        input.occurredAt,
        ownerActor,
        input.occurredAt,
        input.assertionId,
      );
      assert.equal(update.changes, 1);
      appendAudit(db, {
        id: `${input.assertionId}-review-audit`,
        dossierId: "assertion-claim-dossier",
        dossierRevision: input.revisionBefore + 1,
        sequence: input.sequence,
        eventType: "assertion_reviewed",
        objectRefType: "professional_assertion",
        objectRefId: input.assertionId,
        actorUserId: ownerId,
        actorRef: ownerActor,
        actorRole: "owner",
        occurredAt: input.occurredAt,
        previousEventId: input.previousEventId,
        digestSeed: input.digestSeed,
      });
      appendRevisionReceipt(
        db,
        "assertion-claim-dossier",
        input.revisionBefore + 1,
        ownerActor,
        input.occurredAt,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  commitPendingReview({
    assertionId: "assertion-accept-target",
    status: "accepted",
    revisionBefore: 2,
    sequence: 3,
    previousEventId: "assertion-type-exact-audit",
    occurredAt: "2026-09-01T10:05:00.000Z",
    digestSeed: 21_905,
  });
  commitPendingReview({
    assertionId: "assertion-reject-target",
    status: "rejected",
    revisionBefore: 3,
    sequence: 4,
    previousEventId: "assertion-accept-target-review-audit",
    occurredAt: "2026-09-01T10:06:00.000Z",
    digestSeed: 21_906,
  });
  assert.deepEqual(db.prepare(`
    SELECT id, status FROM dossier_professional_assertions
    WHERE id IN ('assertion-accept-target', 'assertion-reject-target')
    ORDER BY id
  `).all().map((row) => ({ ...row })), [
    { id: "assertion-accept-target", status: "accepted" },
    { id: "assertion-reject-target", status: "rejected" },
  ]);

  const supersededAt = "2026-09-01T10:20:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "assertion-claim-dossier", 4, contributorActor, supersededAt);
    db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'superseded', updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'assertion-supersede-target' AND status = 'accepted'
    `).run(contributorActor, supersededAt);
    appendAudit(db, {
      id: "assertion-supersede-stale-review-audit",
      dossierId: "assertion-claim-dossier",
      dossierRevision: 5,
      sequence: 5,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: "assertion-supersede-target",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: originalReviewedAt,
      previousEventId: "assertion-reject-target-review-audit",
      digestSeed: 21_903,
    });
    assert.throws(
      () => appendRevisionReceipt(db, "assertion-claim-dossier", 5, ownerActor, originalReviewedAt),
      /dossier revision receipt requires an exact mutation commitment/iu,
      "the stale original reviewer cannot mint a receipt for the contributor's later supersession",
    );
  } finally {
    db.exec("ROLLBACK");
  }
  assert.equal(db.prepare("SELECT status FROM dossier_professional_assertions WHERE id = 'assertion-supersede-target'").get()?.status, "accepted");
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_audit_events
    WHERE dossier_id = 'assertion-claim-dossier' AND dossier_revision = 5
  `).get()?.count, 0, "the stronger immediate receipt rejection must still roll back the stale audit");
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_revision_receipts
    WHERE dossier_id = 'assertion-claim-dossier' AND resulting_revision = 5
  `).get()?.count, 0);

  db.exec("BEGIN IMMEDIATE");
  try {
    const exactSupersededAt = "2026-09-01T10:21:00.000Z";
    advanceDossierRevision(db, "assertion-claim-dossier", 4, contributorActor, exactSupersededAt);
    db.prepare(`
      UPDATE dossier_professional_assertions
      SET status = 'superseded', updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'assertion-supersede-target' AND status = 'accepted'
    `).run(contributorActor, exactSupersededAt);
    appendAudit(db, {
      id: "assertion-supersede-exact-audit",
      dossierId: "assertion-claim-dossier",
      dossierRevision: 5,
      sequence: 5,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: "assertion-supersede-target",
      actorUserId: contributorId,
      actorRef: contributorActor,
      actorRole: "contributor",
      occurredAt: exactSupersededAt,
      previousEventId: "assertion-reject-target-review-audit",
      digestSeed: 21_904,
    });
    appendRevisionReceipt(db, "assertion-claim-dossier", 5, contributorActor, exactSupersededAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT status, reviewed_by_actor_ref, reviewed_at, updated_by_actor_ref, updated_at
    FROM dossier_professional_assertions WHERE id = 'assertion-supersede-target'
  `).get() }, {
    status: "superseded",
    reviewed_by_actor_ref: ownerActor,
    reviewed_at: originalReviewedAt,
    updated_by_actor_ref: contributorActor,
    updated_at: "2026-09-01T10:21:00.000Z",
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("proposal materialization requires its exact accepted assertion or evidence child", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "materialization-owner@example.com", "Materialization Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "materialization-dossier", ownerId);
  const documentHash = addDocument(db, {
    dossierId: "materialization-dossier",
    documentId: "materialization-document",
    versionId: "materialization-version",
    sourceOrigin: "external_reference",
    hashSeed: 21_930,
  });
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, character_start,
      character_end, excerpt, anchor_checksum, creator, review_state,
      created_by_actor_ref, created_at
    ) VALUES ('materialization-anchor', 'materialization-dossier',
      'materialization-document', 'materialization-version', 0, 24,
      'Exact proposal source', ?, 'human', 'pending', ?,
      '2026-09-01T09:40:00.000Z')
  `).run(documentHash, ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = '2026-09-01T09:41:00.000Z'
    WHERE id = 'materialization-anchor'
  `).run(ownerId, ownerActor);
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, character_start,
      character_end, excerpt, anchor_checksum, creator, review_state,
      created_by_actor_ref, created_at
    ) VALUES ('materialization-unrelated-anchor', 'materialization-dossier',
      'materialization-document', 'materialization-version', 25, 49,
      'Unrelated accepted source', ?, 'human', 'pending', ?,
      '2026-09-01T09:41:15.000Z')
  `).run(documentHash, ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = '2026-09-01T09:41:30.000Z'
    WHERE id = 'materialization-unrelated-anchor'
  `).run(ownerId, ownerActor);
  db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, status,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES ('materialization-base-assertion', 'materialization-dossier',
      'fact', 'Existing accepted target.', 'needs_review', ?, ?,
      '2026-09-01T09:42:00.000Z', '2026-09-01T09:42:00.000Z')
  `).run(ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_assertion_sources (
      dossier_id, assertion_id, source_anchor_id, created_at
    ) VALUES ('materialization-dossier', 'materialization-base-assertion',
      'materialization-anchor', '2026-09-01T09:42:30.000Z')
  `).run();
  db.prepare(`
    UPDATE dossier_professional_assertions
    SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
      reviewed_at = '2026-09-01T09:43:00.000Z',
      updated_by_actor_ref = ?, updated_at = '2026-09-01T09:43:00.000Z'
    WHERE id = 'materialization-base-assertion'
  `).run(ownerId, ownerActor, ownerActor);

  const seedProposal = (
    id: string,
    proposalType: "fact" | "evidence_link",
    reviewState: "pending" | "rejected" = "pending",
  ) => {
    db.prepare(`
      INSERT INTO dossier_ai_proposals (
        id, dossier_id, proposal_type, proposed_value, confidence_category,
        confidence_score, created_by_actor_ref, created_at
      ) VALUES (?, 'materialization-dossier', ?, '{}', 'medium', 0.75, ?,
        '2026-09-01T09:44:00.000Z')
    `).run(id, proposalType, ownerActor);
    db.prepare(`
      INSERT INTO dossier_ai_proposal_versions (
        dossier_id, proposal_id, document_id, document_version_id
      ) VALUES ('materialization-dossier', ?, 'materialization-document',
        'materialization-version')
    `).run(id);
    db.prepare(`
      INSERT INTO dossier_ai_proposal_anchors (
        dossier_id, proposal_id, source_anchor_id
      ) VALUES ('materialization-dossier', ?, 'materialization-anchor')
    `).run(id);
    if (reviewState === "rejected") {
      db.prepare(`
        UPDATE dossier_ai_proposals
        SET review_state = 'rejected', reviewing_user_id = ?,
          reviewing_actor_ref = ?, reviewed_at = '2026-09-01T09:45:00.000Z',
          review_note = 'Rejected before materialization'
        WHERE id = ?
      `).run(ownerId, ownerActor, id);
    }
  };
  seedProposal("materialization-pending-assertion", "fact");
  seedProposal("materialization-rejected-assertion", "fact", "rejected");
  seedProposal("materialization-pending-evidence", "evidence_link");
  seedProposal("materialization-rejected-evidence", "evidence_link", "rejected");
  seedProposal("materialization-other-origin", "fact");
  seedProposal("materialization-wrong-child", "fact");
  seedProposal("materialization-needs-review", "fact");
  seedProposal("materialization-exact", "fact");
  seedProposal("materialization-exact-evidence", "evidence_link");
  seedProposal("materialization-unrelated-assertion", "fact");
  seedProposal("materialization-unrelated-evidence", "evidence_link");

  db.exec(migration(auditClaimsMigration));
  db.exec(migration(uploadCommitmentMigration));
  db.exec(migration(statusHistoryMigration));

  const insertOriginAssertion = (
    proposalId: string,
    assertionId: string,
    occurredAt: string,
    accepted: boolean,
    sourceAnchorId = "materialization-anchor",
  ) => {
    db.prepare(`
      INSERT INTO dossier_professional_assertions (
        id, dossier_id, assertion_type, statement, status,
        originating_proposal_id, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, 'materialization-dossier', 'fact',
        'Materialized proposal assertion.', 'needs_review', ?, ?, ?, ?, ?)
    `).run(assertionId, proposalId, ownerActor, ownerActor, occurredAt, occurredAt);
    db.prepare(`
      INSERT INTO dossier_assertion_sources (
        dossier_id, assertion_id, source_anchor_id, created_at
      ) VALUES ('materialization-dossier', ?, ?, ?)
    `).run(assertionId, sourceAnchorId, occurredAt);
    if (accepted) {
      db.prepare(`
        UPDATE dossier_professional_assertions
        SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
          reviewed_at = ?, updated_by_actor_ref = ?, updated_at = ?
        WHERE id = ? AND status = 'needs_review'
      `).run(ownerId, ownerActor, occurredAt, ownerActor, occurredAt, assertionId);
    }
  };
  const insertOriginEvidence = (
    proposalId: string,
    evidenceId: string,
    occurredAt: string,
    sourceAnchorId = "materialization-anchor",
  ) => db.prepare(`
    INSERT INTO dossier_evidence_links (
      id, dossier_id, source_anchor_id, assertion_id, target_type, target_id,
      relation, professional_meaning, created_by_actor_ref, reviewed_by_user_id,
      reviewed_by_actor_ref, reviewed_at, created_at, originating_proposal_id
    ) VALUES (?, 'materialization-dossier', ?,
      'materialization-base-assertion', 'professional_assertion',
      'materialization-base-assertion', 'supports',
      'Materialized proposal evidence.', ?, ?, ?, ?, ?, ?)
  `).run(
    evidenceId,
    sourceAnchorId,
    ownerActor,
    ownerId,
    ownerActor,
    occurredAt,
    occurredAt,
    proposalId,
  );
  const appendProposalAuditAndReceipt = (
    proposalId: string,
    occurredAt: string,
    digestSeed: number,
  ) => {
    appendAudit(db, {
      id: `${proposalId}-materialization-audit`,
      dossierId: "materialization-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "proposal_reviewed",
      objectRefType: "ai_proposal",
      objectRefId: proposalId,
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "materialization-dossier-audit-created",
      digestSeed,
    });
    appendRevisionReceipt(db, "materialization-dossier", 2, ownerActor, occurredAt);
  };

  for (const input of [
    {
      id: "materialization-evidence-created-actor-mismatch",
      createdByActor: "actor:forged-evidence-creator",
      reviewedAt: "2026-09-01T12:19:00.000Z",
      createdAt: "2026-09-01T12:19:00.000Z",
    },
    {
      id: "materialization-evidence-created-time-mismatch",
      createdByActor: ownerActor,
      reviewedAt: "2026-09-01T12:19:00.000Z",
      createdAt: "2026-09-01T12:19:01.000Z",
    },
  ]) {
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_evidence_links (
        id, dossier_id, source_anchor_id, assertion_id, target_type, target_id,
        relation, professional_meaning, created_by_actor_ref, reviewed_by_user_id,
        reviewed_by_actor_ref, reviewed_at, created_at
      ) VALUES (?, 'materialization-dossier', 'materialization-anchor',
        'materialization-base-assertion', 'professional_assertion',
        'materialization-base-assertion', 'supports',
        'Forged evidence provenance.', ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.createdByActor,
      ownerId,
      ownerActor,
      input.reviewedAt,
      input.createdAt,
    ), /evidence-link creation provenance must match its exact review decision/iu);
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T12:19:10.000Z";
    advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, occurredAt);
    insertOriginAssertion(
      "materialization-unrelated-assertion",
      "materialization-unrelated-assertion-child",
      occurredAt,
      true,
      "materialization-unrelated-anchor",
    );
    assert.throws(() => db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'professional_assertion',
        accepted_object_id = 'materialization-unrelated-assertion-child'
      WHERE id = 'materialization-unrelated-assertion' AND review_state = 'pending'
    `).run(ownerId, ownerActor, occurredAt),
    /exact registered authoritative materialization/iu,
    "an exact-origin assertion cannot substitute an unrelated accepted source anchor");
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T12:19:20.000Z";
    advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, occurredAt);
    insertOriginEvidence(
      "materialization-unrelated-evidence",
      "materialization-unrelated-evidence-child",
      occurredAt,
      "materialization-unrelated-anchor",
    );
    assert.throws(() => db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'evidence_link',
        accepted_object_id = 'materialization-unrelated-evidence-child'
      WHERE id = 'materialization-unrelated-evidence' AND review_state = 'pending'
    `).run(ownerId, ownerActor, occurredAt),
    /exact registered authoritative materialization/iu,
    "an exact-origin evidence child must use one of its proposal's declared anchors");
  } finally {
    db.exec("ROLLBACK");
  }

  const orphanAssertionCases = [
    {
      proposalId: "materialization-pending-assertion",
      assertionId: "materialization-pending-assertion-child",
      occurredAt: "2026-09-01T12:20:00.000Z",
      digestSeed: 21_931,
    },
    {
      proposalId: "materialization-rejected-assertion",
      assertionId: "materialization-rejected-assertion-child",
      occurredAt: "2026-09-01T12:21:00.000Z",
      digestSeed: 21_932,
    },
  ] as const;
  for (const input of orphanAssertionCases) {
    expectDeferredCommitFailure(db, () => {
      advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, input.occurredAt);
      insertOriginAssertion(input.proposalId, input.assertionId, input.occurredAt, true);
      appendProposalAuditAndReceipt(input.proposalId, input.occurredAt, input.digestSeed);
    });
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM dossier_professional_assertions WHERE id = ?").get(input.assertionId)?.count,
      0,
      "an accepted assertion child cannot survive while its origin proposal is pending or rejected",
    );
  }

  const orphanEvidenceCases = [
    {
      proposalId: "materialization-pending-evidence",
      evidenceId: "materialization-pending-evidence-child",
      occurredAt: "2026-09-01T12:22:00.000Z",
      digestSeed: 21_933,
    },
    {
      proposalId: "materialization-rejected-evidence",
      evidenceId: "materialization-rejected-evidence-child",
      occurredAt: "2026-09-01T12:23:00.000Z",
      digestSeed: 21_934,
    },
  ] as const;
  for (const input of orphanEvidenceCases) {
    expectDeferredCommitFailure(db, () => {
      advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, input.occurredAt);
      insertOriginEvidence(input.proposalId, input.evidenceId, input.occurredAt);
      appendProposalAuditAndReceipt(input.proposalId, input.occurredAt, input.digestSeed);
    });
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM dossier_evidence_links WHERE id = ?").get(input.evidenceId)?.count,
      0,
      "a reviewed evidence child cannot survive while its origin proposal is pending or rejected",
    );
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T12:24:00.000Z";
    advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, occurredAt);
    insertOriginAssertion(
      "materialization-other-origin",
      "materialization-other-origin-child",
      occurredAt,
      true,
    );
    assert.throws(() => db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'professional_assertion',
        accepted_object_id = 'materialization-other-origin-child'
      WHERE id = 'materialization-wrong-child' AND review_state = 'pending'
    `).run(ownerId, ownerActor, occurredAt), /exact registered authoritative materialization|exact materialized child|originating proposal|accepted object.*proposal/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T12:25:00.000Z";
    advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, occurredAt);
    insertOriginAssertion(
      "materialization-needs-review",
      "materialization-needs-review-child",
      occurredAt,
      false,
    );
    assert.throws(() => db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'professional_assertion',
        accepted_object_id = 'materialization-needs-review-child'
      WHERE id = 'materialization-needs-review' AND review_state = 'pending'
    `).run(ownerId, ownerActor, occurredAt), /exact registered authoritative materialization|accepted professional assertion|assertion.*accepted|exact materialized child/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  const exactOccurredAt = "2026-09-01T12:26:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "materialization-dossier", 1, ownerActor, exactOccurredAt);
    insertOriginAssertion(
      "materialization-exact",
      "materialization-exact-child",
      exactOccurredAt,
      true,
    );
    const accepted = db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'professional_assertion',
        accepted_object_id = 'materialization-exact-child'
      WHERE id = 'materialization-exact' AND review_state = 'pending'
    `).run(ownerId, ownerActor, exactOccurredAt);
    assert.equal(accepted.changes, 1);
    appendProposalAuditAndReceipt("materialization-exact", exactOccurredAt, 21_935);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT review_state, accepted_object_type, accepted_object_id,
      reviewing_actor_ref, reviewed_at
    FROM dossier_ai_proposals WHERE id = 'materialization-exact'
  `).get() }, {
    review_state: "accepted",
    accepted_object_type: "professional_assertion",
    accepted_object_id: "materialization-exact-child",
    reviewing_actor_ref: ownerActor,
    reviewed_at: exactOccurredAt,
  });
  assert.deepEqual({ ...db.prepare(`
    SELECT status, originating_proposal_id, reviewed_by_actor_ref, reviewed_at
    FROM dossier_professional_assertions WHERE id = 'materialization-exact-child'
  `).get() }, {
    status: "accepted",
    originating_proposal_id: "materialization-exact",
    reviewed_by_actor_ref: ownerActor,
    reviewed_at: exactOccurredAt,
  });

  const exactEvidenceAt = "2026-09-01T12:27:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "materialization-dossier", 2, ownerActor, exactEvidenceAt);
    insertOriginEvidence(
      "materialization-exact-evidence",
      "materialization-exact-evidence-child",
      exactEvidenceAt,
    );
    const accepted = db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'evidence_link',
        accepted_object_id = 'materialization-exact-evidence-child'
      WHERE id = 'materialization-exact-evidence' AND review_state = 'pending'
    `).run(ownerId, ownerActor, exactEvidenceAt);
    assert.equal(accepted.changes, 1);
    appendAudit(db, {
      id: "materialization-exact-evidence-audit",
      dossierId: "materialization-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "proposal_reviewed",
      objectRefType: "ai_proposal",
      objectRefId: "materialization-exact-evidence",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: exactEvidenceAt,
      previousEventId: "materialization-exact-materialization-audit",
      digestSeed: 21_936,
    });
    appendRevisionReceipt(db, "materialization-dossier", 3, ownerActor, exactEvidenceAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT proposal.review_state, proposal.accepted_object_id,
      evidence.created_by_actor_ref, evidence.reviewed_by_actor_ref,
      evidence.created_at, evidence.reviewed_at
    FROM dossier_ai_proposals AS proposal
    JOIN dossier_evidence_links AS evidence
      ON evidence.dossier_id = proposal.dossier_id
      AND evidence.id = proposal.accepted_object_id
    WHERE proposal.id = 'materialization-exact-evidence'
  `).get() }, {
    review_state: "accepted",
    accepted_object_id: "materialization-exact-evidence-child",
    created_by_actor_ref: ownerActor,
    reviewed_by_actor_ref: ownerActor,
    created_at: exactEvidenceAt,
    reviewed_at: exactEvidenceAt,
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("graph proposal acceptance binds the exact proposed package target", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "graph-proposal-owner@example.com", "Graph Proposal Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "graph-proposal-dossier", ownerId);
  const documentHash = addDocument(db, {
    dossierId: "graph-proposal-dossier",
    documentId: "graph-proposal-document",
    versionId: "graph-proposal-version",
    sourceOrigin: "external_reference",
    hashSeed: 21_940,
  });
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum,
      creator, review_state, created_by_actor_ref, created_at
    ) VALUES ('graph-proposal-anchor', 'graph-proposal-dossier',
      'graph-proposal-document', 'graph-proposal-version', ?, 'human',
      'pending', ?, '2026-09-01T09:30:00.000Z')
  `).run(documentHash, ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = '2026-09-01T09:31:00.000Z'
    WHERE id = 'graph-proposal-anchor'
  `).run(ownerId, ownerActor);

  const packageA = {
    id: "graph-package-a",
    packageId: "package-a",
    packageVersion: "1.0.0",
    packageFingerprint: digest(21_941),
    graphDigest: digest(21_942),
  };
  const packageB = {
    id: "graph-package-b",
    packageId: "package-b",
    packageVersion: "2.0.0",
    packageFingerprint: digest(21_943),
    graphDigest: digest(21_944),
  };
  for (const packageReference of [packageA, packageB]) {
    db.prepare(`
      INSERT INTO dossier_decision_package_references (
        id, dossier_id, package_id, package_version, package_fingerprint,
        source_dossier_revision, state, graph_validation_status, graph_digest,
        approval_state, package_type_registry, package_type_id,
        package_type_version, created_by_actor_ref, updated_by_actor_ref,
        created_at, updated_at
      ) VALUES (?, 'graph-proposal-dossier', ?, ?, ?, 1, 'current', 'valid',
        ?, 'published', 'genesis-juris-package-types', 'general-decision',
        '1.0.0', ?, ?, '2026-09-01T09:32:00.000Z',
        '2026-09-01T09:32:00.000Z')
    `).run(
      packageReference.id,
      packageReference.packageId,
      packageReference.packageVersion,
      packageReference.packageFingerprint,
      packageReference.graphDigest,
      ownerActor,
      ownerActor,
    );
  }
  const proposedValue = JSON.stringify({
    kind: "genesis-juris-decision-package-graph-diff-v1",
    schema_version: 1,
    target: {
      package_id: packageA.packageId,
      package_version: packageA.packageVersion,
      package_fingerprint: packageA.packageFingerprint,
      graph_digest: packageA.graphDigest,
      parent_package_id: null,
      parent_package_version: null,
      parent_package_fingerprint: null,
    },
  });
  db.prepare(`
    INSERT INTO dossier_ai_proposals (
      id, dossier_id, proposal_type, proposed_value, confidence_category,
      confidence_score, created_by_actor_ref, created_at
    ) VALUES ('graph-package-proposal', 'graph-proposal-dossier',
      'graph_change', ?, 'high', 0.9, ?, '2026-09-01T09:33:00.000Z')
  `).run(proposedValue, ownerActor);
  db.prepare(`
    INSERT INTO dossier_ai_proposal_versions (
      dossier_id, proposal_id, document_id, document_version_id
    ) VALUES ('graph-proposal-dossier', 'graph-package-proposal',
      'graph-proposal-document', 'graph-proposal-version')
  `).run();
  db.prepare(`
    INSERT INTO dossier_ai_proposal_anchors (
      dossier_id, proposal_id, source_anchor_id
    ) VALUES ('graph-proposal-dossier', 'graph-package-proposal',
      'graph-proposal-anchor')
  `).run();
  db.exec(migration(auditClaimsMigration));
  db.exec(migration(uploadCommitmentMigration));
  db.exec(migration(statusHistoryMigration));

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T12:30:00.000Z";
    advanceDossierRevision(db, "graph-proposal-dossier", 1, ownerActor, occurredAt);
    assert.throws(() => db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'decision_package_reference',
        accepted_object_id = 'graph-package-b'
      WHERE id = 'graph-package-proposal' AND review_state = 'pending'
    `).run(ownerId, ownerActor, occurredAt), /exact registered authoritative materialization/iu,
    "a valid published package B cannot satisfy proposed_value that names package A");
  } finally {
    db.exec("ROLLBACK");
  }
  assert.equal(
    db.prepare("SELECT review_state FROM dossier_ai_proposals WHERE id = 'graph-package-proposal'").get()?.review_state,
    "pending",
  );

  const exactOccurredAt = "2026-09-01T12:31:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "graph-proposal-dossier", 1, ownerActor, exactOccurredAt);
    const accepted = db.prepare(`
      UPDATE dossier_ai_proposals
      SET review_state = 'accepted', reviewing_user_id = ?,
        reviewing_actor_ref = ?, reviewed_at = ?,
        accepted_object_type = 'decision_package_reference',
        accepted_object_id = 'graph-package-a'
      WHERE id = 'graph-package-proposal' AND review_state = 'pending'
    `).run(ownerId, ownerActor, exactOccurredAt);
    assert.equal(accepted.changes, 1);
    appendAudit(db, {
      id: "graph-package-proposal-audit",
      dossierId: "graph-proposal-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "proposal_reviewed",
      objectRefType: "ai_proposal",
      objectRefId: "graph-package-proposal",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: exactOccurredAt,
      previousEventId: "graph-proposal-dossier-audit-created",
      digestSeed: 21_945,
    });
    appendRevisionReceipt(db, "graph-proposal-dossier", 2, ownerActor, exactOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT review_state, accepted_object_type, accepted_object_id
    FROM dossier_ai_proposals WHERE id = 'graph-package-proposal'
  `).get() }, {
    review_state: "accepted",
    accepted_object_type: "decision_package_reference",
    accepted_object_id: "graph-package-a",
  });
  assert.equal(
    db.prepare("SELECT updated_at FROM dossier_decision_package_references WHERE id = 'graph-package-a'").get()?.updated_at,
    "2026-09-01T09:32:00.000Z",
    "accepting an unchanged valid package must not forge its update provenance",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("request and package no-ops or provenance-only updates cannot mint revision receipts", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "no-op-owner@example.com", "No-op Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "no-op-dossier", ownerId);
  db.prepare(`
    INSERT INTO dossier_information_requests (
      id, dossier_id, question, owner_user_id, owner_actor_ref,
      priority, status, reason, readiness_reason_code,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES ('no-op-request', 'no-op-dossier', 'Provide the signed schedule.',
      ?, ?, 'normal', 'open', 'Required for review', 'INFORMATION_REQUEST_OPEN',
      ?, ?, '2026-09-01T12:40:00.000Z', '2026-09-01T12:40:00.000Z')
  `).run(ownerId, ownerActor, ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, state, graph_validation_status, graph_digest,
      approval_state, package_type_registry, package_type_id,
      package_type_version, created_by_actor_ref, updated_by_actor_ref,
      created_at, updated_at
    ) VALUES ('no-op-package', 'no-op-dossier', 'no-op-package', '1.0.0', ?,
      1, 'current', 'not_run', ?, 'draft', 'genesis-juris-package-types',
      'general-decision', '1.0.0', ?, ?,
      '2026-09-01T12:41:00.000Z', '2026-09-01T12:41:00.000Z')
  `).run(digest(21_950), digest(21_951), ownerActor, ownerActor);
  db.exec(migration(auditClaimsMigration));
  db.exec(migration(uploadCommitmentMigration));
  db.exec(migration(statusHistoryMigration));

  const expectNoOpReceiptRejection = (input: {
    object: "request" | "package";
    eventType: "information_request_changed" | "decision_package_linked";
    objectType: "information_request" | "decision_package_reference";
    objectId: string;
  }) => {
    const occurredAt = input.object === "request"
      ? "2026-09-01T12:42:00.000Z"
      : "2026-09-01T12:43:00.000Z";
    db.exec("BEGIN IMMEDIATE");
    try {
      advanceDossierRevision(db, "no-op-dossier", 1, ownerActor, occurredAt);
      if (input.object === "request") {
        db.prepare(`
          UPDATE dossier_information_requests SET question = question
          WHERE id = 'no-op-request'
        `).run();
      } else {
        db.prepare(`
          UPDATE dossier_decision_package_references SET state = state
          WHERE id = 'no-op-package'
        `).run();
      }
      appendAudit(db, {
        id: `no-op-${input.object}-forged-audit`,
        dossierId: "no-op-dossier",
        dossierRevision: 2,
        sequence: 2,
        eventType: input.eventType,
        objectRefType: input.objectType,
        objectRefId: input.objectId,
        actorUserId: ownerId,
        actorRef: ownerActor,
        actorRole: "owner",
        occurredAt,
        previousEventId: "no-op-dossier-audit-created",
        digestSeed: input.object === "request" ? 21_952 : 21_953,
      });
      assert.throws(
        () => appendRevisionReceipt(db, "no-op-dossier", 2, ownerActor, occurredAt),
        /requires at least one primary exact mutation audit claim/iu,
        "a literal no-op plus a free-standing audit cannot furnish a revision receipt",
      );
    } finally {
      db.exec("ROLLBACK");
    }
  };

  expectNoOpReceiptRejection({
    object: "request",
    eventType: "information_request_changed",
    objectType: "information_request",
    objectId: "no-op-request",
  });
  expectNoOpReceiptRejection({
    object: "package",
    eventType: "decision_package_linked",
    objectType: "decision_package_reference",
    objectId: "no-op-package",
  });

  for (const input of [
    {
      table: "dossier_information_requests",
      id: "no-op-request",
      diagnostic: /information-request provenance cannot change without a governed mutation/iu,
    },
    {
      table: "dossier_decision_package_references",
      id: "no-op-package",
      diagnostic: /decision-package provenance cannot change without a governed mutation/iu,
    },
  ]) {
    db.exec("BEGIN IMMEDIATE");
    try {
      advanceDossierRevision(db, "no-op-dossier", 1, ownerActor, "2026-09-01T12:44:00.000Z");
      assert.throws(() => db.prepare(`
        UPDATE ${input.table}
        SET updated_at = '2026-09-01T12:44:00.000Z'
        WHERE id = ?
      `).run(input.id), input.diagnostic,
      "provenance alone cannot turn a root revision commitment into a governed child mutation");
    } finally {
      db.exec("ROLLBACK");
    }
  }

  const requestOccurredAt = "2026-09-01T12:45:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "no-op-dossier", 1, ownerActor, requestOccurredAt);
    db.prepare(`
      UPDATE dossier_information_requests
      SET question = 'Provide the signed schedule and annex.',
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'no-op-request'
    `).run(ownerActor, requestOccurredAt);
    appendAudit(db, {
      id: "no-op-request-exact-audit",
      dossierId: "no-op-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: "no-op-request",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: requestOccurredAt,
      previousEventId: "no-op-dossier-audit-created",
      digestSeed: 21_954,
    });
    appendRevisionReceipt(db, "no-op-dossier", 2, ownerActor, requestOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const packageOccurredAt = "2026-09-01T12:46:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "no-op-dossier", 2, ownerActor, packageOccurredAt);
    db.prepare(`
      UPDATE dossier_decision_package_references
      SET graph_validation_status = 'valid',
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'no-op-package'
    `).run(ownerActor, packageOccurredAt);
    appendAudit(db, {
      id: "no-op-package-exact-audit",
      dossierId: "no-op-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "decision_package_linked",
      objectRefType: "decision_package_reference",
      objectRefId: "no-op-package",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: packageOccurredAt,
      previousEventId: "no-op-request-exact-audit",
      digestSeed: 21_955,
    });
    appendRevisionReceipt(db, "no-op-dossier", 3, ownerActor, packageOccurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT dossier.revision, request.question, package.graph_validation_status
    FROM dossiers AS dossier
    JOIN dossier_information_requests AS request ON request.dossier_id = dossier.id
    JOIN dossier_decision_package_references AS package ON package.dossier_id = dossier.id
    WHERE dossier.id = 'no-op-dossier'
  `).get() }, {
    revision: 3,
    question: "Provide the signed schedule and annex.",
    graph_validation_status: "valid",
  });
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_audit_events
    WHERE id LIKE 'no-op-%-forged-audit'
  `).get()?.count, 0, "each rejected no-op transaction must roll back its free-standing audit");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("participant mutations require owner authority and nonparticipant audit roles stay fail-closed", () => {
  const db = database();
  const ownerId = user(db, "participant-boundary-owner@example.com", "Participant Boundary Owner");
  const ownerActor = actor(db, ownerId);
  const viewerId = user(db, "participant-boundary-viewer@example.com", "Participant Boundary Viewer");
  const viewerActor = actor(db, viewerId);
  const adminId = user(db, "participant-boundary-admin@example.com", "Participant Boundary Admin");
  const adminActor = actor(db, adminId);
  const ownerParticipantId = dossier(db, "participant-boundary-dossier", ownerId);
  assert.deepEqual({ ...db.prepare(`
    SELECT user_id, actor_id, role, status, created_by_actor_ref, updated_by_actor_ref
    FROM dossier_participants WHERE id = ?
  `).get(ownerParticipantId) }, {
    user_id: ownerId,
    actor_id: ownerActor,
    role: "owner",
    status: "active",
    created_by_actor_ref: ownerActor,
    updated_by_actor_ref: ownerActor,
  }, "dossier creation must still auto-create its exact canonical owner participant");

  db.exec("BEGIN IMMEDIATE");
  try {
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_participants (
        id, dossier_id, user_id, actor_id, display_name, role, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES ('participant-self-insert', 'participant-boundary-dossier', ?, ?,
        'Self-inserted viewer', 'viewer', 'active', ?, ?,
        '2026-09-01T13:00:00.000Z', '2026-09-01T13:00:00.000Z')
    `).run(viewerId, viewerActor, viewerActor, viewerActor),
    /participant creation requires pre-existing active owner authority/iu,
    "a nonparticipant cannot make itself authoritative before an owner authorizes the row");
  } finally {
    db.exec("ROLLBACK");
  }

  const insertedAt = "2026-09-01T13:01:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "participant-boundary-dossier", 1, ownerActor, insertedAt);
    db.prepare(`
      INSERT INTO dossier_participants (
        id, dossier_id, user_id, actor_id, display_name, role, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES ('participant-boundary-viewer', 'participant-boundary-dossier', ?, ?,
        'Participant Boundary Viewer', 'viewer', 'active', ?, ?, ?, ?)
    `).run(viewerId, viewerActor, ownerActor, ownerActor, insertedAt, insertedAt);
    appendAudit(db, {
      id: "participant-boundary-insert-audit",
      dossierId: "participant-boundary-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "participant_changed",
      objectRefType: "participant",
      objectRefId: "participant-boundary-viewer",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: insertedAt,
      previousEventId: "participant-boundary-dossier-audit-created",
      digestSeed: 21_960,
    });
    appendRevisionReceipt(db, "participant-boundary-dossier", 2, ownerActor, insertedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T13:02:00.000Z";
    advanceDossierRevision(db, "participant-boundary-dossier", 2, viewerActor, occurredAt);
    appendAudit(db, {
      id: "participant-self-promotion-audit",
      dossierId: "participant-boundary-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "participant_changed",
      objectRefType: "participant",
      objectRefId: "participant-boundary-viewer",
      actorUserId: viewerId,
      actorRef: viewerActor,
      actorRole: "viewer",
      occurredAt,
      previousEventId: "participant-boundary-insert-audit",
      digestSeed: 21_961,
    });
    assert.throws(() => db.prepare(`
      UPDATE dossier_participants
      SET role = 'contributor', updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'participant-boundary-viewer' AND role = 'viewer'
    `).run(viewerActor, occurredAt),
    /participant changes require pre-existing active owner authority/iu,
    "even a preinserted exact audit cannot let a viewer promote itself");
  } finally {
    db.exec("ROLLBACK");
  }
  assert.equal(db.prepare(`
    SELECT role FROM dossier_participants WHERE id = 'participant-boundary-viewer'
  `).get()?.role, "viewer");
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'participant-self-promotion-audit'
  `).get()?.count, 0, "the rejected self-promotion transaction must roll back its preinserted audit");

  for (const [index, role] of ["platform_admin", "system", "import"].entries()) {
    const occurredAt = `2026-09-01T13:0${index + 3}:00.000Z`;
    db.exec("BEGIN IMMEDIATE");
    try {
      advanceDossierRevision(db, "participant-boundary-dossier", 2, ownerActor, occurredAt);
      db.prepare(`
        UPDATE dossier_participants
        SET display_name = ?, updated_by_actor_ref = ?, updated_at = ?
        WHERE id = 'participant-boundary-viewer'
      `).run(`Relabeled ${role}`, ownerActor, occurredAt);
      assert.throws(() => db.prepare(`
        INSERT INTO dossier_audit_events (
          id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
          object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
          summary_code, previous_event_id, event_digest
        ) VALUES (?, 'participant-boundary-dossier', 3, 3, 'participant_changed',
          'participant', 'participant-boundary-viewer', ?, ?, ?, ?,
          'RELABEL_REJECTED', 'participant-boundary-insert-audit', ?)
      `).run(
        `participant-relabeled-${role}-audit`,
        ownerId,
        ownerActor,
        role,
        occurredAt,
        digest(21_962 + index),
      ), /non-participant audit roles are limited to exact platform-admin archive overrides/iu,
      `${role} cannot relabel an ordinary participant mutation audit`);
    } finally {
      db.exec("ROLLBACK");
    }
  }

  const updatedAt = "2026-09-01T13:06:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    advanceDossierRevision(db, "participant-boundary-dossier", 2, ownerActor, updatedAt);
    db.prepare(`
      UPDATE dossier_participants
      SET display_name = 'Owner-authorized reviewer', role = 'reviewer',
        updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'participant-boundary-viewer'
    `).run(ownerActor, updatedAt);
    appendAudit(db, {
      id: "participant-boundary-update-audit",
      dossierId: "participant-boundary-dossier",
      dossierRevision: 3,
      sequence: 3,
      eventType: "participant_changed",
      objectRefType: "participant",
      objectRefId: "participant-boundary-viewer",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: updatedAt,
      previousEventId: "participant-boundary-insert-audit",
      digestSeed: 21_965,
    });
    appendRevisionReceipt(db, "participant-boundary-dossier", 3, ownerActor, updatedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const archivedAt = "2026-09-01T13:07:00.000Z";
  const archiveReason = "Platform retention override";
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status,
        new_status, actor_user_id, actor_ref, actor_role, reason,
        consequences, occurred_at, had_current_output, had_reviewer_approval,
        platform_admin_override
      ) VALUES ('participant-boundary-admin-archive', 'participant-boundary-dossier',
        3, 4, 'draft', 'archived', ?, ?, 'platform_admin', ?,
        '["recompute_readiness","mark_outputs_stale"]', ?, false, false, true)
    `).run(adminId, adminActor, archiveReason, archivedAt);
    const applied = db.prepare(`
      UPDATE dossiers
      SET status = 'archived', status_reason = ?, revision = 4,
        archived_at = ?, archived_by_actor_ref = ?, archive_reason = ?,
        archive_admin_override = true, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'participant-boundary-dossier' AND revision = 3 AND status = 'draft'
    `).run(archiveReason, archivedAt, adminActor, archiveReason, adminActor, archivedAt);
    assert.equal(applied.changes, 1);
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, previous_event_id, event_digest
      ) VALUES ('participant-boundary-admin-archive-audit',
        'participant-boundary-dossier', 4, 4, 'admin_archive_override',
        'status_transition', 'participant-boundary-admin-archive', ?, ?,
        'platform_admin', ?, 'ADMIN_ARCHIVE_OVERRIDE',
        'participant-boundary-update-audit', ?)
    `).run(adminId, adminActor, archivedAt, digest(21_966));
    appendRevisionReceipt(db, "participant-boundary-dossier", 4, adminActor, archivedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  assert.deepEqual({ ...db.prepare(`
    SELECT revision, status, archived_at, archived_by_actor_ref,
      archive_reason, archive_admin_override
    FROM dossiers WHERE id = 'participant-boundary-dossier'
  `).get() }, {
    revision: 4,
    status: "archived",
    archived_at: archivedAt,
    archived_by_actor_ref: adminActor,
    archive_reason: archiveReason,
    archive_admin_override: 1,
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0013 same-revision snapshot, output, approval, and stale-state claims fail closed and commit only exact audits", () => {
  const db = database();
  const ownerId = user(db, "claims-artifact-owner@example.com", "Claims Artifact Owner");
  const ownerActor = actor(db, ownerId);
  const reviewerId = user(db, "claims-artifact-reviewer@example.com", "Claims Artifact Reviewer");
  const reviewerActor = actor(db, reviewerId);
  dossier(db, "claims-artifact-dossier", ownerId);

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T09:00:00.000Z";
    advanceDossierRevision(db, "claims-artifact-dossier", 1, ownerActor, occurredAt);
    db.prepare(`
      INSERT INTO dossier_participants (
        id, dossier_id, user_id, actor_id, display_name, role, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES ('claims-artifact-reviewer', 'claims-artifact-dossier', ?, ?,
        'Claims Artifact Reviewer', 'reviewer', 'active', ?, ?, ?, ?)
    `).run(reviewerId, reviewerActor, ownerActor, ownerActor, occurredAt, occurredAt);
    appendAudit(db, {
      id: "claims-artifact-reviewer-audit",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 2,
      eventType: "participant_changed",
      objectRefType: "participant",
      objectRefId: "claims-artifact-reviewer",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "claims-artifact-dossier-audit-created",
      digestSeed: 22_000,
    });
    appendRevisionReceipt(db, "claims-artifact-dossier", 2, ownerActor, occurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const insertSnapshot = (
    id: string,
    createdAt: string,
    digestSeed: number,
    audience = "internal",
    redactionProfileId = "pilot-default",
    sealed = false,
  ) => {
    const snapshotDigest = digest(digestSeed);
    db.prepare(`
      INSERT INTO dossier_snapshots (
        id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
        status, readiness, approver_records, locale, audience, classification,
        redaction_profile_id, contract_version, report_model_schema_version,
        renderer_version, build_version, manifest_object_reference, manifest_byte_length,
        manifest_digest, sealed, sealed_at, sealed_by_actor_ref,
        created_by_actor_ref, created_at
      ) VALUES (?, 'claims-artifact-dossier', 2, '{}', '{}', 'draft', ?, '[]',
        'en', ?, 'confidential', ?, '1.0.0', 1, '1.0.0', 'test',
        ?, 1024, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      strictReadiness("claims-artifact-dossier", 2, createdAt),
      audience,
      redactionProfileId,
      `private/claims/snapshots/${id}/${"m".repeat(32)}`,
      snapshotDigest,
      sealed ? 1 : 0,
      sealed ? createdAt : null,
      sealed ? ownerActor : null,
      ownerActor,
      createdAt,
    );
    return snapshotDigest;
  };
  assert.throws(
    () => insertSnapshot(
      "snapshot-client-audience",
      "2026-09-01T09:00:30.000Z",
      21_998,
      "client",
    ),
    /pilot snapshots require internal audience and pilot-default redaction profile/iu,
  );
  assert.throws(
    () => insertSnapshot(
      "snapshot-presealed",
      "2026-09-01T09:00:32.000Z",
      22_000,
      "internal",
      "pilot-default",
      true,
    ),
    /snapshot creation must begin unsealed/iu,
  );
  assert.throws(
    () => insertSnapshot(
      "snapshot-custom-redaction",
      "2026-09-01T09:00:31.000Z",
      21_999,
      "internal",
      "custom-profile",
    ),
    /pilot snapshots require internal audience and pilot-default redaction profile/iu,
  );
  const sealSnapshot = (id: string, occurredAt: string) => db.prepare(`
    UPDATE dossier_snapshots
    SET sealed = true, sealed_at = ?, sealed_by_actor_ref = ?
    WHERE dossier_id = 'claims-artifact-dossier' AND id = ?
  `).run(occurredAt, ownerActor, id);

  expectDeferredCommitFailure(db, () => {
    const occurredAt = "2026-09-01T09:01:00.000Z";
    insertSnapshot("snapshot-omitted-audit", occurredAt, 22_001);
    sealSnapshot("snapshot-omitted-audit", occurredAt);
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_snapshots WHERE id = 'snapshot-omitted-audit'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_required_audits WHERE object_ref_id = 'snapshot-omitted-audit'").get()?.count, 0);

  expectDeferredCommitFailure(db, () => {
    const occurredAt = "2026-09-01T09:02:00.000Z";
    insertSnapshot("snapshot-mismatched-audit", occurredAt, 22_002);
    sealSnapshot("snapshot-mismatched-audit", occurredAt);
    appendAudit(db, {
      id: "snapshot-wrong-time-audit",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 3,
      eventType: "snapshot_created",
      objectRefType: "dossier_snapshot",
      objectRefId: "snapshot-mismatched-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: "2026-09-01T09:02:01.000Z",
      previousEventId: "claims-artifact-reviewer-audit",
      digestSeed: 22_003,
    });
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_snapshots WHERE id = 'snapshot-mismatched-audit'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'snapshot-wrong-time-audit'").get()?.count, 0);

  const snapshotCreatedAt = "2026-09-01T09:03:00.000Z";
  const snapshotDigest = digest(22_004);
  db.exec("BEGIN IMMEDIATE");
  try {
    assert.equal(insertSnapshot("snapshot-exact-audit", snapshotCreatedAt, 22_004), snapshotDigest);
    sealSnapshot("snapshot-exact-audit", snapshotCreatedAt);
    appendAudit(db, {
      id: "snapshot-exact-audit-event",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 3,
      eventType: "snapshot_created",
      objectRefType: "dossier_snapshot",
      objectRefId: "snapshot-exact-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: snapshotCreatedAt,
      previousEventId: "claims-artifact-reviewer-audit",
      digestSeed: 22_005,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.equal(db.prepare(`
    SELECT claim_phase FROM dossier_required_audits
    WHERE dossier_id = 'claims-artifact-dossier'
      AND object_ref_id = 'snapshot-exact-audit'
  `).get()?.claim_phase, "same_revision");

  const insertOutput = (id: string, createdAt: string, contentSeed: number) => db.prepare(`
    INSERT INTO dossier_governed_outputs (
      id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
      content_sha256, filename, generator_schema_version, generator_build_version,
      created_by_actor_ref, created_at
    ) VALUES (?, 'claims-artifact-dossier', 'snapshot-exact-audit', ?, 'pdf', ?, ?,
      ?, 1, 'test', ?, ?)
  `).run(
    id,
    snapshotDigest,
    `private/claims/outputs/${id}/${"o".repeat(32)}`,
    digest(contentSeed),
    `${id}.pdf`,
    ownerActor,
    createdAt,
  );

  expectDeferredCommitFailure(db, () => {
    insertOutput("output-omitted-audit", "2026-09-01T09:04:00.000Z", 22_006);
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_governed_outputs WHERE id = 'output-omitted-audit'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_output_state_events WHERE output_id = 'output-omitted-audit'").get()?.count, 0);

  expectDeferredCommitFailure(db, () => {
    const occurredAt = "2026-09-01T09:05:00.000Z";
    insertOutput("output-mismatched-audit", occurredAt, 22_007);
    appendAudit(db, {
      id: "output-wrong-time-audit",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 4,
      eventType: "output_generated",
      objectRefType: "governed_output",
      objectRefId: "output-mismatched-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: "2026-09-01T09:05:01.000Z",
      previousEventId: "snapshot-exact-audit-event",
      digestSeed: 22_008,
    });
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_governed_outputs WHERE id = 'output-mismatched-audit'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'output-wrong-time-audit'").get()?.count, 0);

  const outputCreatedAt = "2026-09-01T09:06:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    insertOutput("output-exact-audit", outputCreatedAt, 22_009);
    appendAudit(db, {
      id: "output-exact-audit-event",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 4,
      eventType: "output_generated",
      objectRefType: "governed_output",
      objectRefId: "output-exact-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: outputCreatedAt,
      previousEventId: "snapshot-exact-audit-event",
      digestSeed: 22_010,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  assert.deepEqual({ ...db.prepare(`
    SELECT sequence, state, reason, actor_ref
    FROM dossier_output_state_events
    WHERE dossier_id = 'claims-artifact-dossier' AND output_id = 'output-exact-audit'
  `).get() }, {
    sequence: 1,
    state: "current",
    reason: null,
    actor_ref: ownerActor,
  }, "output insertion and its trigger-generated initial current state commit atomically");

  const insertApproval = (id: string, approvedAt: string, digestSeed: number) => db.prepare(`
    INSERT INTO dossier_output_approvals (
      id, dossier_id, output_id, reviewer_participant_id, reviewer_user_id,
      reviewer_actor_ref, approved_at, approval_digest
    ) VALUES (?, 'claims-artifact-dossier', 'output-exact-audit',
      'claims-artifact-reviewer', ?, ?, ?, ?)
  `).run(id, reviewerId, reviewerActor, approvedAt, digest(digestSeed));

  expectDeferredCommitFailure(db, () => {
    insertApproval("approval-omitted-audit", "2026-09-01T09:07:00.000Z", 22_011);
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_output_approvals WHERE id = 'approval-omitted-audit'").get()?.count, 0);

  expectDeferredCommitFailure(db, () => {
    const approvedAt = "2026-09-01T09:08:00.000Z";
    insertApproval("approval-mismatched-audit", approvedAt, 22_012);
    appendAudit(db, {
      id: "approval-wrong-actor-audit",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 5,
      eventType: "output_approved",
      objectRefType: "governed_output",
      objectRefId: "output-exact-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt: approvedAt,
      previousEventId: "output-exact-audit-event",
      digestSeed: 22_013,
    });
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_output_approvals WHERE id = 'approval-mismatched-audit'").get()?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE id = 'approval-wrong-actor-audit'").get()?.count, 0);

  const approvedAt = "2026-09-01T09:09:00.000Z";
  db.exec("BEGIN IMMEDIATE");
  try {
    insertApproval("approval-exact-audit", approvedAt, 22_014);
    appendAudit(db, {
      id: "approval-exact-audit-event",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 5,
      eventType: "output_approved",
      objectRefType: "governed_output",
      objectRefId: "output-exact-audit",
      actorUserId: reviewerId,
      actorRef: reviewerActor,
      actorRole: "reviewer",
      occurredAt: approvedAt,
      previousEventId: "output-exact-audit-event",
      digestSeed: 22_015,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  expectDeferredCommitFailure(db, () => {
    db.prepare(`
      INSERT INTO dossier_output_state_events (
        id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref
      ) VALUES ('output-stale-omitted-audit', 'claims-artifact-dossier',
        'output-exact-audit', 2, 'stale', 'replacement_generated',
        '2026-09-01T09:10:00.000Z', ?)
    `).run(ownerActor);
  });
  assert.equal(db.prepare(`
    SELECT state FROM dossier_output_state_events
    WHERE dossier_id = 'claims-artifact-dossier' AND output_id = 'output-exact-audit'
    ORDER BY sequence DESC LIMIT 1
  `).get()?.state, "current");

  db.exec("BEGIN IMMEDIATE");
  try {
    const occurredAt = "2026-09-01T09:11:00.000Z";
    db.prepare(`
      INSERT INTO dossier_output_state_events (
        id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref
      ) VALUES ('output-stale-exact-audit', 'claims-artifact-dossier',
        'output-exact-audit', 2, 'stale', 'replacement_generated', ?, ?)
    `).run(occurredAt, ownerActor);
    appendAudit(db, {
      id: "output-stale-exact-audit-event",
      dossierId: "claims-artifact-dossier",
      dossierRevision: 2,
      sequence: 6,
      eventType: "output_marked_stale",
      objectRefType: "governed_output",
      objectRefId: "output-exact-audit",
      actorUserId: ownerId,
      actorRef: ownerActor,
      actorRole: "owner",
      occurredAt,
      previousEventId: "approval-exact-audit-event",
      digestSeed: 22_016,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const sameRevisionClaims = db.prepare(`
    SELECT event_type, object_ref_id, actor_ref, occurred_at
    FROM dossier_required_audits
    WHERE dossier_id = 'claims-artifact-dossier' AND dossier_revision = 2
      AND claim_phase = 'same_revision'
    ORDER BY occurred_at
  `).all() as Array<Record<string, unknown>>;
  assert.deepEqual(sameRevisionClaims.map((row) => ({ ...row })), [
    {
      event_type: "snapshot_created",
      object_ref_id: "snapshot-exact-audit",
      actor_ref: ownerActor,
      occurred_at: snapshotCreatedAt,
    },
    {
      event_type: "output_generated",
      object_ref_id: "output-exact-audit",
      actor_ref: ownerActor,
      occurred_at: outputCreatedAt,
    },
    {
      event_type: "output_approved",
      object_ref_id: "output-exact-audit",
      actor_ref: reviewerActor,
      occurred_at: approvedAt,
    },
    {
      event_type: "output_marked_stale",
      object_ref_id: "output-exact-audit",
      actor_ref: ownerActor,
      occurred_at: "2026-09-01T09:11:00.000Z",
    },
  ]);
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_revision_receipts
    WHERE dossier_id = 'claims-artifact-dossier'
  `).get()?.count, 2, "same-revision artifacts do not fabricate a new revision receipt");
  assert.equal(db.prepare(`
    SELECT state FROM dossier_output_state_events
    WHERE dossier_id = 'claims-artifact-dossier' AND output_id = 'output-exact-audit'
    ORDER BY sequence DESC LIMIT 1
  `).get()?.state, "stale");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("queued extraction and expired processing leases recover without rewriting provenance", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "extraction-recovery-owner@example.com", "Extraction Recovery Owner");
  dossier(db, "extraction-recovery-dossier", ownerId);
  addDocument(db, {
    dossierId: "extraction-recovery-dossier",
    documentId: "extraction-recovery-doc",
    versionId: "extraction-recovery-v1",
    mediaType: "text/plain",
    hashSeed: 410,
  });
  db.prepare(`
    INSERT INTO dossier_extraction_jobs (
      id, dossier_id, document_id, document_version_id, status, extractor_version
    ) VALUES ('recovery-job', 'extraction-recovery-dossier', 'extraction-recovery-doc',
      'extraction-recovery-v1', 'queued', 'pilot-text-v1')
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'processing', lease_owner = 'worker-a',
      lease_expires_at = '2099-01-01T00:00:00.000Z',
      started_at = '2026-09-01T00:00:00.000Z'
    WHERE id = 'recovery-job'
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'queued', lease_owner = null, lease_expires_at = null, started_at = null
    WHERE id = 'recovery-job'
  `).run(), /expired result-free extraction lease/iu);
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'processing', lease_expires_at = '2000-01-01T00:00:00.000Z'
    WHERE id = 'recovery-job'
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'queued', lease_owner = null, lease_expires_at = null,
      started_at = null, completed_at = null, error_code = null, error_detail_code = null
    WHERE id = 'recovery-job'
  `).run();
  const recoveredJob = db.prepare(`
    SELECT status, attempt, extractor_version, lease_owner, lease_expires_at
    FROM dossier_extraction_jobs WHERE id = 'recovery-job'
  `).get();
  assert.deepEqual({ ...recoveredJob }, {
    status: "queued",
    attempt: 1,
    extractor_version: "pilot-text-v1",
    lease_owner: null,
    lease_expires_at: null,
  });
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'processing', lease_owner = 'worker-b',
      lease_expires_at = '2099-01-01T00:00:00.000Z',
      started_at = '2026-09-01T00:01:00.000Z'
    WHERE id = 'recovery-job'
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      completed_at = '2026-09-01T00:02:00.000Z'
    WHERE id = 'recovery-job'
  `).run();
  db.prepare(`
    INSERT INTO dossier_extraction_results (
      id, dossier_id, document_id, document_version_id, extraction_job_id,
      extractor_version, extracted_text_object_reference, extracted_text_sha256,
      extracted_text_byte_length, character_count
    ) VALUES ('recovery-result', 'extraction-recovery-dossier', 'extraction-recovery-doc',
      'extraction-recovery-v1', 'recovery-job', 'pilot-text-v1', ?, ?, 64, 64)
  `).run(`private/extraction-recovery/${"r".repeat(40)}`, digest(411));
  assert.throws(() => db.prepare(`
    UPDATE dossier_extraction_jobs SET status = 'processing' WHERE id = 'recovery-job'
  `).run(), /immutable result cannot change|invalid extraction job/iu);
});

test("extraction, snapshots, outputs, approvals and dossier audit remain governed and immutable", () => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "governed-owner@example.com", "Governed Owner");
  const reviewerOne = user(db, "reviewer-one@example.com", "Reviewer One");
  const reviewerTwo = user(db, "reviewer-two@example.com", "Reviewer Two");
  const ownerActor = actor(db, ownerId);
  const reviewerOneActor = actor(db, reviewerOne);
  const reviewerTwoActor = actor(db, reviewerTwo);
  dossier(db, "governed-dossier", ownerId, "internal_review");
  for (const [id, userId, reviewerActor] of [
    ["reviewer-one", reviewerOne, reviewerOneActor],
    ["reviewer-two", reviewerTwo, reviewerTwoActor],
  ] as const) {
    db.prepare(`
      INSERT INTO dossier_participants (
        id, dossier_id, user_id, actor_id, display_name, role, status,
        created_by_actor_ref, updated_by_actor_ref
      ) VALUES (?, 'governed-dossier', ?, ?, ?, 'reviewer', 'active', ?, ?)
    `).run(id, userId, reviewerActor, id, ownerActor, ownerActor);
  }

  const pdfHash = addDocument(db, { dossierId: "governed-dossier", documentId: "pdf-doc", versionId: "pdf-v1", mediaType: "application/pdf", hashSeed: 201 });
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_extraction_jobs
      (id, dossier_id, document_id, document_version_id, status, extractor_version)
    VALUES ('pdf-job', 'governed-dossier', 'pdf-doc', 'pdf-v1', 'queued', 'pilot-text-v1')
  `).run(), /PDF and DOCX extraction is disabled/iu);
  db.prepare(`
    INSERT INTO dossier_extraction_jobs
      (id, dossier_id, document_id, document_version_id, status, extractor_version,
       error_code, error_detail_code)
    VALUES ('pdf-job', 'governed-dossier', 'pdf-doc', 'pdf-v1', 'not_extractable',
      'pilot-text-v1', 'unsupported_type', 'PARSER_NOT_APPROVED')
  `).run();

  const textHash = addDocument(db, { dossierId: "governed-dossier", documentId: "text-doc", versionId: "text-v1", mediaType: "text/markdown", hashSeed: 202 });
  db.prepare(`
    INSERT INTO dossier_extraction_jobs
      (id, dossier_id, document_id, document_version_id, status, extractor_version)
    VALUES ('text-job', 'governed-dossier', 'text-doc', 'text-v1', 'queued', 'pilot-text-v1')
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs SET status = 'ready', completed_at = '2026-09-01T01:00:00.000Z'
    WHERE id = 'text-job'
  `);
  db.prepare(`
    UPDATE dossier_extraction_jobs SET status = 'processing', lease_owner = 'worker:text',
      lease_expires_at = '2099-01-01T00:00:00.000Z', started_at = '2026-09-01T00:59:00.000Z'
    WHERE id = 'text-job'
  `).run();
  db.prepare(`
    UPDATE dossier_extraction_jobs SET status = 'ready', lease_owner = null,
      lease_expires_at = null, completed_at = '2026-09-01T01:00:00.000Z'
    WHERE id = 'text-job'
  `).run();
  db.prepare(`
    INSERT INTO dossier_extraction_results (
      id, dossier_id, document_id, document_version_id, extraction_job_id, extractor_version,
      extracted_text_object_reference, extracted_text_sha256, extracted_text_byte_length, character_count
    ) VALUES ('text-result', 'governed-dossier', 'text-doc', 'text-v1', 'text-job',
      'pilot-text-v1', ?, ?, 100, 98)
  `).run(`private/extracted/${"e".repeat(40)}`, digest(203));
  db.prepare(`
    INSERT INTO dossier_extraction_page_maps (
      id, dossier_id, document_id, document_version_id, extraction_result_id,
      page_number, start_offset, end_offset, checksum
    ) VALUES ('page-map', 'governed-dossier', 'text-doc', 'text-v1', 'text-result', 1, 0, 98, ?)
  `).run(digest(204));
  assert.throws(() => db.prepare("UPDATE dossier_extraction_results SET character_count = 99 WHERE id = 'text-result'").run(), /immutable/iu);
  assert.throws(() => db.prepare("UPDATE dossier_extraction_jobs SET extractor_version = 'forged-v2' WHERE id = 'text-job'").run(), /identity|result/iu);
  assert.throws(() => db.prepare("DELETE FROM dossier_extraction_page_maps WHERE id = 'page-map'").run(), /immutable/iu);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, extraction_version,
      page_number, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('forged-extractor-anchor', 'governed-dossier', 'text-doc', 'text-v1',
      'forged-extractor-v999', 1, ?, 'human', ?)
  `).run(digest(240), ownerActor), /FOREIGN KEY/iu);

  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, extraction_version,
      page_number, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('accepted-anchor', 'governed-dossier', 'text-doc', 'text-v1',
      'pilot-text-v1', 1, ?,
      'human', ?)
  `).run(digest(205), ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = '2026-09-01T01:10:00.000Z'
    WHERE id = 'accepted-anchor'
  `).run(reviewerOne, reviewerOneActor);
  db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, extraction_version,
      page_number, anchor_checksum, creator, created_by_actor_ref
    ) VALUES ('second-accepted-anchor', 'governed-dossier', 'text-doc', 'text-v1',
      'pilot-text-v1', 1, ?,
      'human', ?)
  `).run(digest(221), ownerActor);
  db.prepare(`
    UPDATE dossier_source_anchors
    SET review_state = 'accepted', reviewer_user_id = ?, reviewer_actor_ref = ?,
      reviewed_at = '2026-09-01T01:10:30.000Z'
    WHERE id = 'second-accepted-anchor'
  `).run(reviewerOne, reviewerOneActor);
  db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('accepted-assertion', 'governed-dossier', 'fact', 'Reviewed fact', ?, ?)
  `).run(ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_assertion_sources (dossier_id, assertion_id, source_anchor_id)
    VALUES ('governed-dossier', 'accepted-assertion', 'accepted-anchor')
  `).run();
  db.prepare(`
    UPDATE dossier_professional_assertions
    SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
      reviewed_at = '2026-09-01T01:11:00.000Z', updated_by_actor_ref = ?
    WHERE id = 'accepted-assertion'
  `).run(reviewerOne, reviewerOneActor, reviewerOneActor);
  db.prepare(`
    INSERT INTO dossier_professional_assertions (
      id, dossier_id, assertion_type, statement, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('second-accepted-assertion', 'governed-dossier', 'fact', 'Second reviewed fact', ?, ?)
  `).run(ownerActor, ownerActor);
  db.prepare(`
    INSERT INTO dossier_assertion_sources (dossier_id, assertion_id, source_anchor_id)
    VALUES ('governed-dossier', 'second-accepted-assertion', 'accepted-anchor')
  `).run();
  db.prepare(`
    UPDATE dossier_professional_assertions
    SET status = 'accepted', reviewed_by_user_id = ?, reviewed_by_actor_ref = ?,
      reviewed_at = '2026-09-01T01:11:30.000Z', updated_by_actor_ref = ?
    WHERE id = 'second-accepted-assertion'
  `).run(reviewerOne, reviewerOneActor, reviewerOneActor);

  const manifestDigest = digest(206);
  const manifestObjectReference = `private/manifests/${"s".repeat(40)}`;
  const packageFingerprint = digest(214);
  const packageGraphDigest = digest(215);
  const malformedReadiness = JSON.stringify({
    schema_version: 1,
    dossier_id: "governed-dossier",
    computed_from_revision: 1,
    evaluated_at: "2026-09-01T01:11:45.000Z",
    ready: true,
    dimensions: [],
  });
  const readiness = strictReadiness("governed-dossier", 1, "2026-09-01T01:11:45.000Z");
  db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, graph_digest, package_type_registry, package_type_id,
      package_type_version, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('package-ref-v1', 'governed-dossier', 'package-v1', '1.0.0', ?,
      1, ?, 'genesis-juris-package-types', 'general-decision', '1.0.0', ?, ?)
  `).run(packageFingerprint, packageGraphDigest, ownerActor, ownerActor);
  const secondPackageFingerprint = digest(222);
  const secondPackageGraphDigest = digest(223);
  db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, graph_digest, package_type_registry, package_type_id,
      package_type_version, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('package-ref-v2', 'governed-dossier', 'package-v2', '2.0.0', ?,
      1, ?, 'genesis-juris-package-types', 'general-decision', '1.0.0', ?, ?)
  `).run(secondPackageFingerprint, secondPackageGraphDigest, ownerActor, ownerActor);
  const stalePackageGraphDigest = digest(225);
  db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, state, graph_digest, package_type_registry, package_type_id,
      package_type_version, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('package-ref-stale', 'governed-dossier', 'package-stale', '1.0.0', ?,
      1, 'stale', ?, 'genesis-juris-package-types', 'general-decision', '1.0.0', ?, ?)
  `).run(digest(224), stalePackageGraphDigest, ownerActor, ownerActor);
  dossier(db, "governed-other", ownerId);
  const otherPackageGraphDigest = digest(227);
  db.prepare(`
    INSERT INTO dossier_decision_package_references (
      id, dossier_id, package_id, package_version, package_fingerprint,
      source_dossier_revision, graph_digest, package_type_registry, package_type_id,
      package_type_version, created_by_actor_ref, updated_by_actor_ref
    ) VALUES ('package-ref-other', 'governed-other', 'package-other', '1.0.0', ?,
      1, ?, 'genesis-juris-package-types', 'general-decision', '1.0.0', ?, ?)
  `).run(digest(226), otherPackageGraphDigest, ownerActor, ownerActor);

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_evidence_links (
      id, dossier_id, source_anchor_id, assertion_id, target_type, target_id, relation,
      professional_meaning, created_by_actor_ref, reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
    ) VALUES ('graph-evidence-missing-package', 'governed-dossier', 'accepted-anchor',
      'accepted-assertion', 'graph_node', 'shared-node', 'supports', 'Missing package scope',
      ?, ?, ?, '2026-09-01T01:11:40.000Z')
  `).run(ownerActor, reviewerOne, reviewerOneActor), /graph_package|CHECK constraint/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_evidence_links (
      id, dossier_id, source_anchor_id, assertion_id, decision_package_reference_id,
      target_type, target_id, relation, professional_meaning, created_by_actor_ref,
      reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
    ) VALUES ('nongraph-evidence-with-package', 'governed-dossier', 'accepted-anchor',
      'accepted-assertion', 'package-ref-v1', 'professional_assertion', 'accepted-assertion',
      'supports', 'Non-graph package substitution', ?, ?, ?, '2026-09-01T01:11:41.000Z')
  `).run(ownerActor, reviewerOne, reviewerOneActor), /graph_package|CHECK constraint/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_evidence_links (
      id, dossier_id, source_anchor_id, assertion_id, decision_package_reference_id,
      target_type, target_id, relation, professional_meaning, created_by_actor_ref,
      reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
    ) VALUES ('graph-evidence-cross-package', 'governed-dossier', 'accepted-anchor',
      'accepted-assertion', 'package-ref-other', 'graph_node', 'shared-node', 'supports',
      'Cross-dossier package substitution', ?, ?, ?, '2026-09-01T01:11:42.000Z')
  `).run(ownerActor, reviewerOne, reviewerOneActor), /FOREIGN KEY/iu);
  for (const [id, packageReferenceId] of [
    ["graph-evidence-v1", "package-ref-v1"],
    ["graph-evidence-v2", "package-ref-v2"],
  ] as const) {
    db.prepare(`
      INSERT INTO dossier_evidence_links (
        id, dossier_id, source_anchor_id, assertion_id, decision_package_reference_id,
        target_type, target_id, relation, professional_meaning, created_by_actor_ref,
        reviewed_by_user_id, reviewed_by_actor_ref, reviewed_at
      ) VALUES (?, 'governed-dossier', 'accepted-anchor', 'accepted-assertion', ?,
        'graph_node', 'shared-node', 'supports', 'Exact package-scoped node', ?, ?, ?,
        '2026-09-01T01:11:43.000Z')
    `).run(id, packageReferenceId, ownerActor, reviewerOne, reviewerOneActor);
  }
  const graphEvidencePackages = db.prepare(`
    SELECT decision_package_reference_id FROM dossier_evidence_links
    WHERE dossier_id = 'governed-dossier' AND target_type = 'graph_node' AND target_id = 'shared-node'
    ORDER BY decision_package_reference_id
  `).all() as Array<{ decision_package_reference_id: string }>;
  assert.deepEqual(graphEvidencePackages.map((row) => row.decision_package_reference_id), [
    "package-ref-v1",
    "package-ref-v2",
  ]);
  assert.throws(() => db.prepare(`
    UPDATE dossier_evidence_links SET decision_package_reference_id = 'package-ref-v2'
    WHERE id = 'graph-evidence-v1'
  `).run(), /immutable/iu);
  const graphEvidencePlan = db.prepare(`
    EXPLAIN QUERY PLAN SELECT id FROM dossier_evidence_links
    WHERE dossier_id = ? AND decision_package_reference_id = ?
      AND target_type = ? AND target_id = ?
  `).all("governed-dossier", "package-ref-v1", "graph_node", "shared-node") as Array<{ detail: string }>;
  assert.match(graphEvidencePlan.map((row) => row.detail).join("\n"), /dossier_evidence_links_package_target_idx/);
  const approverRecords = JSON.stringify([{
    reviewer_actor_id: reviewerOneActor,
    approved_at: "2026-09-01T01:11:00.000Z",
    output_id: null,
  }]);
  db.prepare(`
    INSERT INTO dossier_snapshots (
      id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
      status, readiness, approver_records, locale, audience, classification,
      redaction_profile_id, contract_version, report_model_schema_version,
      renderer_version, build_version, manifest_object_reference, manifest_byte_length,
      manifest_digest, created_by_actor_ref
    ) VALUES ('snapshot-v1', 'governed-dossier', 1, '{}', '{}', 'internal_review', ?, ?,
      'en', 'internal', 'confidential', 'pilot-default', '1.0.0', 1, '1.0.0', 'test', ?, 4096, ?, ?)
  `).run(readiness, approverRecords, manifestObjectReference, manifestDigest, ownerActor);
  db.prepare(`
    INSERT INTO dossier_snapshots (
      id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
      status, readiness, approver_records, locale, audience, classification,
      redaction_profile_id, contract_version, report_model_schema_version,
      renderer_version, build_version, manifest_object_reference, manifest_byte_length,
      manifest_digest, created_by_actor_ref
    ) VALUES ('snapshot-malformed-readiness', 'governed-dossier', 1, '{}', '{}',
      'internal_review', ?, ?, 'en', 'internal', 'confidential', 'pilot-default', '1.0.0', 1,
      '1.0.0', 'test', ?, 4096, ?, ?)
  `).run(
    malformedReadiness,
    approverRecords,
    `private/manifests/${"m".repeat(40)}`,
    digest(245),
    ownerActor,
  );
  assert.throws(() => db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:11:46.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-malformed-readiness'
  `).run(ownerActor), /readiness requires evaluated_at, ready, and all ten dimensions/iu);
  db.prepare("DELETE FROM dossier_snapshots WHERE id = 'snapshot-malformed-readiness'").run();
  db.prepare(`
    INSERT INTO dossier_snapshot_document_versions
      (dossier_id, snapshot_id, document_id, document_version_id, content_sha256)
    VALUES ('governed-dossier', 'snapshot-v1', 'text-doc', 'text-v1', ?)
  `).run(textHash);
  db.prepare(`
    INSERT INTO dossier_snapshot_document_versions
      (dossier_id, snapshot_id, document_id, document_version_id, content_sha256)
    VALUES ('governed-dossier', 'snapshot-v1', 'pdf-doc', 'pdf-v1', ?)
  `).run(pdfHash);
  db.prepare(`INSERT INTO dossier_snapshot_assertions VALUES ('governed-dossier', 'snapshot-v1', 'accepted-assertion')`).run();
  db.prepare(`INSERT INTO dossier_snapshot_anchors VALUES ('governed-dossier', 'snapshot-v1', 'accepted-anchor')`).run();
  db.prepare(`
    INSERT INTO dossier_snapshot_decision_packages (
      dossier_id, snapshot_id, decision_package_reference_id, package_id,
      package_version, graph_digest
    ) VALUES ('governed-dossier', 'snapshot-v1', 'package-ref-v1', 'package-v1', '1.0.0', ?)
  `).run(packageGraphDigest);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_snapshot_decision_packages (
      dossier_id, snapshot_id, decision_package_reference_id, package_id,
      package_version, graph_digest
    ) VALUES ('governed-dossier', 'snapshot-v1', 'package-ref-stale', 'package-stale', '1.0.0', ?)
  `).run(stalePackageGraphDigest), /exact current package|sealed snapshot manifest/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_snapshot_decision_packages (
      dossier_id, snapshot_id, decision_package_reference_id, package_id,
      package_version, graph_digest
    ) VALUES ('governed-dossier', 'snapshot-v1', 'package-ref-other', 'package-other', '1.0.0', ?)
  `).run(otherPackageGraphDigest), /exact current package|sealed snapshot manifest|FOREIGN KEY/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:12:00.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-v1'
  `).run(ownerActor), /snapshot assertion manifest/iu);
  db.prepare(`INSERT INTO dossier_snapshot_assertions VALUES ('governed-dossier', 'snapshot-v1', 'second-accepted-assertion')`).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:12:00.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-v1'
  `).run(ownerActor), /snapshot anchor manifest/iu);
  db.prepare(`INSERT INTO dossier_snapshot_anchors VALUES ('governed-dossier', 'snapshot-v1', 'second-accepted-anchor')`).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:12:00.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-v1'
  `).run(ownerActor), /snapshot package manifest/iu);
  db.prepare(`
    INSERT INTO dossier_snapshot_decision_packages (
      dossier_id, snapshot_id, decision_package_reference_id, package_id,
      package_version, graph_digest
    ) VALUES ('governed-dossier', 'snapshot-v1', 'package-ref-v2', 'package-v2', '2.0.0', ?)
  `).run(secondPackageGraphDigest);
  const ghostApproverRecords = JSON.stringify([{
    reviewer_actor_id: reviewerOneActor,
    approved_at: "2026-09-01T01:11:00.000Z",
    output_id: "ghost-output",
  }]);
  db.prepare(`
    INSERT INTO dossier_snapshots (
      id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
      status, readiness, approver_records, locale, audience, classification,
      redaction_profile_id, contract_version, report_model_schema_version,
      renderer_version, build_version, manifest_object_reference, manifest_byte_length,
      manifest_digest, created_by_actor_ref
    ) VALUES ('snapshot-ghost-approver', 'governed-dossier', 1, '{}', '{}',
      'internal_review', ?, ?, 'en', 'internal', 'confidential', 'pilot-default', '1.0.0', 1,
      '1.0.0', 'test', ?, 4096, ?, ?)
  `).run(
    readiness,
    ghostApproverRecords,
    `private/manifests/${"g".repeat(40)}`,
    digest(246),
    ownerActor,
  );
  db.prepare(`
    INSERT INTO dossier_snapshot_document_versions
    SELECT dossier_id, 'snapshot-ghost-approver', document_id, document_version_id, content_sha256
    FROM dossier_snapshot_document_versions WHERE snapshot_id = 'snapshot-v1'
  `).run();
  db.prepare(`
    INSERT INTO dossier_snapshot_assertions
    SELECT dossier_id, 'snapshot-ghost-approver', assertion_id
    FROM dossier_snapshot_assertions WHERE snapshot_id = 'snapshot-v1'
  `).run();
  db.prepare(`
    INSERT INTO dossier_snapshot_anchors
    SELECT dossier_id, 'snapshot-ghost-approver', source_anchor_id
    FROM dossier_snapshot_anchors WHERE snapshot_id = 'snapshot-v1'
  `).run();
  db.prepare(`
    INSERT INTO dossier_snapshot_decision_packages
    SELECT dossier_id, 'snapshot-ghost-approver', decision_package_reference_id,
      package_id, package_version, graph_digest, simulation_receipt_ids
    FROM dossier_snapshot_decision_packages WHERE snapshot_id = 'snapshot-v1'
  `).run();
  assert.throws(() => db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:12:00.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-ghost-approver'
  `).run(ownerActor), /approver records|approver output/iu);
  db.prepare("DELETE FROM dossier_snapshot_document_versions WHERE snapshot_id = 'snapshot-ghost-approver'").run();
  db.prepare("DELETE FROM dossier_snapshot_assertions WHERE snapshot_id = 'snapshot-ghost-approver'").run();
  db.prepare("DELETE FROM dossier_snapshot_anchors WHERE snapshot_id = 'snapshot-ghost-approver'").run();
  db.prepare("DELETE FROM dossier_snapshot_decision_packages WHERE snapshot_id = 'snapshot-ghost-approver'").run();
  db.prepare("DELETE FROM dossier_snapshots WHERE id = 'snapshot-ghost-approver'").run();
  db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:12:00.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-v1'
  `).run(ownerActor);
  assert.throws(() => db.prepare("UPDATE dossier_snapshots SET status = 'active' WHERE id = 'snapshot-v1'").run(), /immutable/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_snapshot_document_versions
      (dossier_id, snapshot_id, document_id, document_version_id, content_sha256)
    VALUES ('governed-dossier', 'snapshot-v1', 'pdf-doc', 'pdf-v1', ?)
  `).run(digest(201)), /sealed snapshot|UNIQUE/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossier_decision_package_references SET graph_digest = ? WHERE id = 'package-ref-v1'
  `).run(digest(216)), /identity|provenance/iu);
  const sealedManifestReceipt = db.prepare(`
    SELECT manifest_object_reference, manifest_byte_length, manifest_digest
    FROM dossier_snapshots WHERE id = 'snapshot-v1'
  `).get();
  db.prepare(`
    UPDATE dossier_professional_assertions
    SET status = 'superseded', updated_by_actor_ref = ? WHERE id = 'accepted-assertion'
  `).run(ownerActor);
  assert.deepEqual(db.prepare(`
    SELECT manifest_object_reference, manifest_byte_length, manifest_digest
    FROM dossier_snapshots WHERE id = 'snapshot-v1'
  `).get(), sealedManifestReceipt, "sealed canonical manifest receipt must reproduce independently of live source rows");

  const secondManifestDigest = digest(238);
  db.prepare(`
    INSERT INTO dossier_snapshots (
      id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
      status, readiness, approver_records, locale, audience, classification,
      redaction_profile_id, contract_version, report_model_schema_version,
      renderer_version, build_version, manifest_object_reference, manifest_byte_length,
      manifest_digest, created_by_actor_ref
    ) VALUES ('snapshot-v2', 'governed-dossier', 1, '{}', '{}', 'internal_review', ?, ?,
      'en', 'internal', 'confidential', 'pilot-default', '1.0.0', 1, '1.0.0', 'test', ?, 4096, ?, ?)
  `).run(
    readiness,
    approverRecords,
    `private/manifests/${"t".repeat(40)}`,
    secondManifestDigest,
    ownerActor,
  );
  for (const [documentId, versionId, contentHash] of [
    ["text-doc", "text-v1", textHash],
    ["pdf-doc", "pdf-v1", pdfHash],
  ] as const) {
    db.prepare(`
      INSERT INTO dossier_snapshot_document_versions
        (dossier_id, snapshot_id, document_id, document_version_id, content_sha256)
      VALUES ('governed-dossier', 'snapshot-v2', ?, ?, ?)
    `).run(documentId, versionId, contentHash);
  }
  db.prepare(`
    INSERT INTO dossier_snapshot_assertions VALUES
      ('governed-dossier', 'snapshot-v2', 'second-accepted-assertion')
  `).run();
  for (const anchorId of ["accepted-anchor", "second-accepted-anchor"] as const) {
    db.prepare(`
      INSERT INTO dossier_snapshot_anchors VALUES ('governed-dossier', 'snapshot-v2', ?)
    `).run(anchorId);
  }
  for (const [packageReferenceId, packageId, packageVersion, graphDigest] of [
    ["package-ref-v1", "package-v1", "1.0.0", packageGraphDigest],
    ["package-ref-v2", "package-v2", "2.0.0", secondPackageGraphDigest],
  ] as const) {
    db.prepare(`
      INSERT INTO dossier_snapshot_decision_packages (
        dossier_id, snapshot_id, decision_package_reference_id, package_id,
        package_version, graph_digest
      ) VALUES ('governed-dossier', 'snapshot-v2', ?, ?, ?, ?)
    `).run(packageReferenceId, packageId, packageVersion, graphDigest);
  }
  db.prepare(`
    UPDATE dossier_snapshots SET sealed = true, sealed_at = '2026-09-01T01:13:00.000Z',
      sealed_by_actor_ref = ? WHERE id = 'snapshot-v2'
  `).run(ownerActor);

  for (const [index, unsafeReference] of [
    "short",
    `https://storage.invalid/${"u".repeat(40)}`,
    `private/../escape/${"d".repeat(40)}`,
    `private\\escape\\${"b".repeat(40)}`,
  ].entries()) {
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_governed_outputs (
        id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
        content_sha256, filename, generator_schema_version, generator_build_version,
        created_by_actor_ref
      ) VALUES (?, 'governed-dossier', 'snapshot-v1', ?, 'pdf', ?, ?, ?, 1, 'test', ?)
    `).run(
      `unsafe-output-${index}`,
      manifestDigest,
      unsafeReference,
      digest(230 + index),
      `unsafe-${index}.pdf`,
      ownerActor,
    ), /content_reference_check|CHECK constraint/iu);
  }

  assert.throws(() => db.prepare(`
    INSERT INTO dossier_governed_outputs (
      id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
      content_sha256, filename, generator_schema_version, generator_build_version, created_by_actor_ref
    ) VALUES ('output-wrong', 'governed-dossier', 'snapshot-v1', ?, 'pdf', ?, ?, 'wrong.pdf', 1, 'test', ?)
  `).run(digest(999), `private/output/${"w".repeat(40)}`, digest(207), ownerActor), /current-revision sealed snapshot digest/iu);
  db.prepare(`
    INSERT INTO dossier_governed_outputs (
      id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
      content_sha256, filename, generator_schema_version, generator_build_version, created_by_actor_ref
    ) VALUES ('output-v1', 'governed-dossier', 'snapshot-v1', ?, 'pdf', ?, ?, 'matter.pdf', 1, 'test', ?)
  `).run(manifestDigest, `private/output/${"o".repeat(40)}`, digest(208), ownerActor);
  assert.deepEqual({ ...db.prepare(`
    SELECT sequence, state FROM dossier_output_state_events
    WHERE dossier_id = 'governed-dossier' AND output_id = 'output-v1'
  `).get() }, { sequence: 1, state: "current" }, "output insertion atomically creates its initial current state");
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_governed_outputs (
      id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
      content_sha256, filename, generator_schema_version, generator_build_version, created_by_actor_ref
    ) VALUES ('output-duplicate-locator', 'governed-dossier', 'snapshot-v1', ?, 'pdf', ?, ?,
      'duplicate.pdf', 1, 'test', ?)
  `).run(manifestDigest, `private/output/${"o".repeat(40)}`, digest(234), ownerActor), /UNIQUE/iu);
  for (const [id, format, referenceSeed, hashSeed] of [
    ["output-v2", "json_manifest", "j", 235],
    ["output-v3", "markdown", "k", 236],
  ] as const) {
    db.prepare(`
      INSERT INTO dossier_governed_outputs (
        id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
        content_sha256, filename, generator_schema_version, generator_build_version, created_by_actor_ref
      ) VALUES (?, 'governed-dossier', 'snapshot-v1', ?, ?, ?, ?, ?, 1, 'test', ?)
    `).run(
      id,
      manifestDigest,
      format,
      `private/output/${referenceSeed.repeat(40)}`,
      digest(hashSeed),
      `${id}.${format === "markdown" ? "md" : "json"}`,
      ownerActor,
    );
  }
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_output_approvals (
      id, dossier_id, output_id, reviewer_participant_id, reviewer_user_id,
      reviewer_actor_ref, approved_at, approval_digest
    ) VALUES ('approval-forged', 'governed-dossier', 'output-v1', 'reviewer-one', ?, ?,
      '2026-09-01T01:20:30.000Z', ?)
  `).run(reviewerOne, reviewerTwoActor, digest(217)), /FOREIGN KEY|bound reviewer|active reviewer/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_output_approvals (
      id, dossier_id, output_id, reviewer_participant_id, reviewer_actor_ref,
      approved_at, approval_digest
    ) VALUES ('approval-null-user', 'governed-dossier', 'output-v1', 'reviewer-one', ?,
      '2026-09-01T01:20:30.000Z', ?)
  `).run(reviewerOneActor, digest(218)), /NOT NULL|active reviewer/iu);
  db.prepare(`
    INSERT INTO dossier_output_approvals (
      id, dossier_id, output_id, reviewer_participant_id, reviewer_user_id,
      reviewer_actor_ref, approved_at, approval_digest
    ) VALUES ('approval-one', 'governed-dossier', 'output-v1', 'reviewer-one', ?,
      ?, '2026-09-01T01:21:00.000Z', ?)
  `).run(reviewerOne, reviewerOneActor, digest(209));

  db.prepare(`
    INSERT INTO dossier_governed_outputs (
      id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
      content_sha256, filename, generator_schema_version, generator_build_version, created_by_actor_ref
    ) VALUES ('output-v4', 'governed-dossier', 'snapshot-v2', ?, 'pdf', ?, ?,
      'alternate.pdf', 1, 'test', ?)
  `).run(secondManifestDigest, `private/output/${"q".repeat(40)}`, digest(239), ownerActor);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_status_transitions (
      id, dossier_id, revision_before, revision_after, previous_status, new_status,
      actor_user_id, actor_ref, actor_role, reason, consequences, occurred_at,
      had_current_output, had_reviewer_approval
    ) VALUES ('forbidden-direct-active', 'governed-other', 1, 2, 'draft', 'active',
      ?, ?, 'owner', 'Skip intake', '["recompute_readiness","mark_outputs_stale"]',
      '2026-09-01T01:21:05.000Z', false, false)
  `).run(ownerId, ownerActor), /edge or role is forbidden/iu);
  assert.throws(() => db.prepare(`
    UPDATE dossiers SET status = 'intake_review', revision = 2, updated_by_actor_ref = ?
    WHERE id = 'governed-other' AND revision = 1 AND status = 'draft'
  `).run(ownerActor), /exact pre-recorded governed transition/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_status_transitions (
      id, dossier_id, revision_before, revision_after, previous_status, new_status,
      actor_user_id, actor_ref, actor_role, platform_admin_override, reason,
      consequences, occurred_at, had_current_output, had_reviewer_approval
    ) VALUES ('forbidden-platform-admin', 'governed-other', 1, 2, 'draft', 'intake_review',
      ?, ?, 'platform_admin', true, 'Generic bypass',
      '["recompute_readiness","mark_outputs_stale"]', '2026-09-01T01:21:05.000Z', false, false)
  `).run(ownerId, ownerActor), /limited to the governed archive override/iu);
  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status, new_status,
        approved_output_id, actor_user_id, actor_ref, actor_role, occurred_at,
        consequences, had_current_output, had_reviewer_approval
      ) VALUES ('cross-workflow-transition', 'governed-dossier', 1, 2, 'internal_review',
        'output_approved', 'output-v1', ?, ?, 'reviewer', '2026-09-01T01:21:06.000Z',
        '["recompute_readiness","preserve_current_output"]', true, true)
    `).run(reviewerOne, reviewerOneActor);
    db.prepare(`
      UPDATE dossiers SET status = 'output_approved', revision = 2, updated_by_actor_ref = ?
      WHERE id = 'governed-dossier' AND revision = 1 AND status = 'internal_review'
    `).run(reviewerOneActor);
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, previous_event_id, event_digest
      ) VALUES ('cross-workflow-audit', 'governed-dossier', 2, 2,
        'dossier_status_transitioned', 'status_transition', 'cross-workflow-transition',
        ?, ?, 'reviewer', '2026-09-01T01:21:06.000Z', 'DOSSIER_STATUS_TRANSITIONED',
        'governed-dossier-audit-created', ?)
    `).run(reviewerOne, reviewerOneActor, digest(241));
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref)
      VALUES ('governed-dossier', 2, ?)
    `).run(reviewerOneActor), /all current outputs stale|approved snapshot workflow/iu);
  } finally {
    db.exec("ROLLBACK");
  }
  db.prepare(`
    INSERT INTO dossier_output_state_events
      (id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref)
    VALUES ('output-v4-state-stale', 'governed-dossier', 'output-v4', 2, 'stale',
      'Alternate workflow not approved', '2026-09-01T01:21:07.000Z', ?)
  `).run(ownerActor);

  db.exec("BEGIN");
  try {
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status, new_status,
        approved_output_id, actor_user_id, actor_ref, actor_role, occurred_at,
        consequences, had_current_output, had_reviewer_approval
      ) VALUES ('wrong-output-transition', 'governed-dossier', 1, 2, 'internal_review',
        'output_approved', 'output-v2', ?, ?, 'reviewer', '2026-09-01T01:21:10.000Z',
        '["recompute_readiness","preserve_current_output"]', true, true)
    `).run(reviewerOne, reviewerOneActor), /exact current output and its reviewer/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  db.prepare(`
    INSERT INTO dossier_output_approvals (
      id, dossier_id, output_id, reviewer_participant_id, reviewer_user_id,
      reviewer_actor_ref, approved_at, approval_digest
    ) VALUES ('approval-output-v2', 'governed-dossier', 'output-v2', 'reviewer-two', ?,
      ?, '2026-09-01T01:21:20.000Z', ?)
  `).run(reviewerTwo, reviewerTwoActor, digest(237));
  db.prepare(`
    INSERT INTO dossier_output_state_events
      (id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref)
    VALUES ('output-v2-state-stale', 'governed-dossier', 'output-v2', 2, 'stale',
      'Superseded format', '2026-09-01T01:21:30.000Z', ?)
  `).run(ownerActor);

  db.exec("BEGIN");
  try {
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status, new_status,
        approved_output_id, actor_user_id, actor_ref, actor_role, occurred_at,
        consequences, had_current_output, had_reviewer_approval
      ) VALUES ('stale-output-transition', 'governed-dossier', 1, 2, 'internal_review',
        'output_approved', 'output-v2', ?, ?, 'reviewer', '2026-09-01T01:21:40.000Z',
        '["recompute_readiness","preserve_current_output"]', true, true)
    `).run(reviewerTwo, reviewerTwoActor), /exact current output and its reviewer/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN");
  try {
    db.prepare(`
      UPDATE dossiers SET title = 'Unreceipted mutation', revision = 2, updated_by_actor_ref = ?
      WHERE id = 'governed-dossier' AND revision = 1
    `).run(ownerActor);
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, previous_event_id, event_digest
      ) VALUES ('governed-unstaled-audit', 'governed-dossier', 2, 2, 'dossier_updated',
        'dossier', 'governed-dossier', ?, ?, 'owner', '2026-09-01T01:21:45.000Z',
        'DOSSIER_UPDATED', 'governed-dossier-audit-created', ?)
    `).run(ownerId, ownerActor, digest(242));
    assert.throws(() => db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref)
      VALUES ('governed-dossier', 2, ?)
    `).run(ownerActor), /all current outputs stale|approved snapshot workflow/iu);
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN");
  try {
    db.prepare(`
      UPDATE dossiers SET title = 'Fully staled mutation', revision = 2, updated_by_actor_ref = ?
      WHERE id = 'governed-dossier' AND revision = 1
    `).run(ownerActor);
    for (const outputId of ["output-v1", "output-v3"] as const) {
      db.prepare(`
        INSERT INTO dossier_output_state_events
          (id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref)
        VALUES (?, 'governed-dossier', ?, 2, 'stale', 'Dossier changed',
          '2026-09-01T01:21:50.000Z', ?)
      `).run(`test-stale-${outputId}`, outputId, ownerActor);
    }
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, previous_event_id, event_digest
      ) VALUES ('governed-fully-staled-audit', 'governed-dossier', 2, 2,
        'dossier_updated', 'dossier', 'governed-dossier', ?, ?, 'owner',
        '2026-09-01T01:21:50.000Z', 'DOSSIER_UPDATED',
        'governed-dossier-audit-created', ?)
    `).run(ownerId, ownerActor, digest(243));
    db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref)
      VALUES ('governed-dossier', 2, ?)
    `).run(ownerActor);
    assert.equal(db.prepare(`
      SELECT count(*) AS count FROM dossier_revision_receipts
      WHERE dossier_id = 'governed-dossier' AND resulting_revision = 2
    `).get()?.count, 1);
  } finally {
    db.exec("ROLLBACK");
  }

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO dossier_status_transitions (
        id, dossier_id, revision_before, revision_after, previous_status, new_status,
        approved_output_id, actor_user_id, actor_ref, actor_role, occurred_at,
        consequences, had_current_output, had_reviewer_approval
      ) VALUES ('approved-output-transition', 'governed-dossier', 1, 2, 'internal_review',
        'output_approved', 'output-v1', ?, ?, 'reviewer', '2026-09-01T01:22:00.000Z',
        '["recompute_readiness","preserve_current_output"]', true, true)
    `).run(reviewerOne, reviewerOneActor);
    db.prepare(`
      UPDATE dossiers SET status = 'output_approved', revision = 2, updated_by_actor_ref = ?
      WHERE id = 'governed-dossier' AND revision = 1 AND status = 'internal_review'
    `).run(reviewerOneActor);
    db.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, previous_event_id, event_digest
      ) VALUES ('approved-output-transition-audit', 'governed-dossier', 2, 2,
        'dossier_status_transitioned', 'status_transition', 'approved-output-transition',
        ?, ?, 'reviewer', '2026-09-01T01:22:00.000Z', 'DOSSIER_STATUS_TRANSITIONED',
        'governed-dossier-audit-created', ?)
    `).run(reviewerOne, reviewerOneActor, digest(244));
    db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref)
      VALUES ('governed-dossier', 2, ?)
    `).run(reviewerOneActor);
    assert.equal(db.prepare(`
      SELECT approved_output_id FROM dossier_status_transitions
      WHERE id = 'approved-output-transition'
    `).get()?.approved_output_id, "output-v1");
    assert.equal(db.prepare(`
      SELECT count(*) AS count FROM dossier_output_state_events
      WHERE dossier_id = 'governed-dossier' AND output_id IN ('output-v1','output-v3')
        AND state = 'stale'
    `).get()?.count, 0, "the approved snapshot workflow remains current at its approval revision");
  } finally {
    db.exec("ROLLBACK");
  }

  db.prepare(`
    INSERT INTO dossier_output_state_events (id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref)
    VALUES ('output-state-stale', 'governed-dossier', 'output-v1', 2, 'stale', 'Dossier changed',
      '2026-09-01T01:22:00.000Z', ?)
  `).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_output_state_events (id, dossier_id, output_id, sequence, state, reason, occurred_at, actor_ref)
    VALUES ('output-v3-state-stale', 'governed-dossier', 'output-v3', 2, 'stale', 'Dossier changed',
      '2026-09-01T01:22:00.000Z', ?)
  `).run(ownerActor);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_output_approvals (
      id, dossier_id, output_id, reviewer_participant_id, reviewer_user_id,
      reviewer_actor_ref, approved_at, approval_digest
    ) VALUES ('approval-two', 'governed-dossier', 'output-v1', 'reviewer-two', ?,
      ?, '2026-09-01T01:23:00.000Z', ?)
  `).run(reviewerTwo, reviewerTwoActor, digest(210)), /current output/iu);
  assert.throws(() => db.prepare("DELETE FROM dossier_governed_outputs WHERE id = 'output-v1'").run(), /immutable/iu);

  db.exec("BEGIN");
  db.prepare(`
    UPDATE dossiers SET revision = 2, updated_by_actor_ref = ?,
      updated_at = '2026-09-01T01:12:00.000Z' WHERE id = 'governed-dossier' AND revision = 1
  `).run(ownerActor);
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type, object_ref_id,
      actor_user_id, actor_ref, actor_role, occurred_at, summary_code, previous_event_id, event_digest
    ) VALUES ('audit-two', 'governed-dossier', 2, 2, 'snapshot_created', 'dossier_snapshot', 'snapshot-v1',
      ?, ?, 'owner', '2026-09-01T01:12:00.000Z', 'SNAPSHOT_CREATED',
      'governed-dossier-audit-created', ?)
  `).run(ownerId, ownerActor, digest(212));
  db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type,
      object_ref_type, object_ref_id, actor_user_id, actor_ref, actor_role,
      occurred_at, summary_code, previous_event_id, event_digest
    ) VALUES ('audit-two-stale-output', 'governed-dossier', 2, 3,
      'output_marked_stale', 'governed_output', 'output-v1', ?, ?, 'owner',
      '2026-09-01T01:12:00.000Z', 'OUTPUT_MARKED_STALE', 'audit-two', ?)
  `).run(ownerId, ownerActor, digest(219));
  db.prepare(`
    INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
    VALUES ('governed-dossier', 2, ?, '2026-09-01T01:12:00.000Z')
  `).run(ownerActor);
  db.exec("COMMIT");
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_governed_outputs (
      id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
      content_sha256, filename, generator_schema_version, generator_build_version,
      created_by_actor_ref
    ) VALUES ('output-from-stale-snapshot', 'governed-dossier', 'snapshot-v1', ?,
      'pdf', ?, ?, 'stale.pdf', 1, 'test', ?)
  `).run(
    manifestDigest,
    `private/output-stale/${"z".repeat(40)}`,
    digest(220),
    ownerActor,
  ), /current-revision sealed snapshot/iu);
  assert.equal(db.prepare(`
    SELECT count(*) AS count FROM dossier_audit_events
    WHERE dossier_id = 'governed-dossier' AND dossier_revision = 2
  `).get()?.count, 2, "one revision receipt supports multiple same-revision artifact and consequence events");
  assert.throws(() => db.prepare(`
    UPDATE dossier_audit_events SET summary_code = 'REWRITE'
    WHERE id = 'governed-dossier-audit-created'
  `).run(), /append-only/iu);
  assert.throws(() => db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type, object_ref_id,
      actor_user_id, actor_ref, actor_role, occurred_at, summary_code, previous_event_id, event_digest
    ) VALUES ('audit-gap', 'governed-dossier', 2, 5, 'dossier_updated', 'dossier', 'governed-dossier',
      ?, ?, 'owner', '2026-09-01T01:30:00.000Z', 'DOSSIER_UPDATED', 'audit-two-stale-output', ?)
  `).run(ownerId, ownerActor, digest(213)), /UNIQUE|exact predecessor/iu);
});

test("pilot-scale dossier queries use bounded indexes for 10 documents, versions, 100 anchors and 100 audits", (t) => {
  const db = legacyDossierDatabase();
  const ownerId = user(db, "scale-owner@example.com", "Scale Owner");
  const ownerActor = actor(db, ownerId);
  dossier(db, "scale-dossier", ownerId);
  const currentVersions: string[] = [];

  for (let documentIndex = 1; documentIndex <= 10; documentIndex += 1) {
    const documentId = `scale-doc-${documentIndex}`;
    const firstVersion = `${documentId}-v1`;
    const secondVersion = `${documentId}-v2`;
    addDocument(db, {
      dossierId: "scale-dossier", documentId, versionId: firstVersion,
      hashSeed: 1_000 + (documentIndex * 10),
    });
    addDocument(db, {
      dossierId: "scale-dossier", documentId, versionId: secondVersion,
      ordinal: 2, predecessorVersionId: firstVersion, hashSeed: 1_001 + (documentIndex * 10),
    });
    db.prepare(`
      UPDATE dossier_document_current_versions
      SET document_version_id = ?, updated_by_actor_ref = ?
      WHERE dossier_id = 'scale-dossier' AND document_id = ?
    `).run(secondVersion, ownerActor, documentId);
    currentVersions.push(secondVersion);
  }

  const insertAnchor = db.prepare(`
    INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, anchor_checksum,
      creator, review_state, created_by_actor_ref, created_at
    ) VALUES (?, 'scale-dossier', ?, ?, ?, 'human', 'pending', 'actor:scale', ?)
  `);
  for (let anchorIndex = 1; anchorIndex <= 100; anchorIndex += 1) {
    const documentIndex = (anchorIndex - 1) % 10;
    insertAnchor.run(
      `scale-anchor-${anchorIndex}`,
      `scale-doc-${documentIndex + 1}`,
      currentVersions[documentIndex],
      digest(2_000 + anchorIndex),
      `2026-09-01T02:${String(Math.floor((anchorIndex - 1) / 60)).padStart(2, "0")}:${String((anchorIndex - 1) % 60).padStart(2, "0")}.000Z`,
    );
  }

  const insertAudit = db.prepare(`
    INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type, object_ref_id,
      actor_user_id, actor_ref, actor_role, occurred_at, summary_code, previous_event_id, event_digest
    ) VALUES (?, 'scale-dossier', ?, ?, ?, 'dossier', 'scale-dossier',
      ?, ?, 'owner', ?, ?, ?, ?)
  `);
  for (let sequence = 2; sequence <= 100; sequence += 1) {
    db.exec("BEGIN");
    db.prepare(`
      UPDATE dossiers SET revision = ?, updated_by_actor_ref = ?, updated_at = ?
      WHERE id = 'scale-dossier' AND revision = ?
    `).run(sequence, ownerActor, `2026-09-01T03:00:${String(sequence).padStart(3, "0")}Z`, sequence - 1);
    insertAudit.run(
      `scale-audit-${sequence}`,
      sequence,
      sequence,
      "dossier_updated",
      ownerId,
      ownerActor,
      `2026-09-01T03:${String(Math.floor((sequence - 1) / 60)).padStart(2, "0")}:${String((sequence - 1) % 60).padStart(2, "0")}.000Z`,
      "DOSSIER_UPDATED",
      sequence === 2 ? "scale-dossier-audit-created" : `scale-audit-${sequence - 1}`,
      digest(3_000 + sequence),
    );
    db.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES ('scale-dossier', ?, ?, ?)
    `).run(sequence, ownerActor, `2026-09-01T03:00:${String(sequence).padStart(3, "0")}Z`);
    db.exec("COMMIT");
  }

  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = 'scale-dossier'").get()?.count, 10);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_document_versions WHERE dossier_id = 'scale-dossier'").get()?.count, 20);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_source_anchors WHERE dossier_id = 'scale-dossier'").get()?.count, 100);
  assert.equal(db.prepare("SELECT count(*) AS count FROM dossier_audit_events WHERE dossier_id = 'scale-dossier'").get()?.count, 100);

  const documentPlan = db.prepare(`
    EXPLAIN QUERY PLAN SELECT id FROM dossier_documents
    WHERE dossier_id = ? AND status = ? ORDER BY updated_at DESC
  `).all("scale-dossier", "received") as Array<{ detail: string }>;
  assert.match(documentPlan.map((row) => row.detail).join("\n"), /dossier_documents_dossier_status_updated_idx/);

  const anchorPlan = db.prepare(`
    EXPLAIN QUERY PLAN SELECT id FROM dossier_source_anchors
    WHERE dossier_id = ? AND document_version_id = ? AND review_state = ?
  `).all("scale-dossier", currentVersions[0], "pending") as Array<{ detail: string }>;
  assert.match(anchorPlan.map((row) => row.detail).join("\n"), /dossier_source_anchors_version_review_idx/);

  const auditPlan = db.prepare(`
    EXPLAIN QUERY PLAN SELECT id FROM dossier_audit_events
    WHERE dossier_id = ? AND object_ref_type = ? AND object_ref_id = ? ORDER BY occurred_at
  `).all("scale-dossier", "dossier", "scale-dossier") as Array<{ detail: string }>;
  assert.match(auditPlan.map((row) => row.detail).join("\n"), /dossier_audit_events_object_occurred_idx/);

  const listQuery = db.prepare(`
    SELECT document.id, document.title, document.status, document.updated_at,
      current.document_version_id
    FROM dossier_documents AS document
    JOIN dossier_document_current_versions AS current
      ON current.dossier_id = document.dossier_id
      AND current.document_id = document.id
    WHERE document.dossier_id = ? AND document.status = ?
    ORDER BY document.updated_at DESC
    LIMIT 100
  `);
  const openQuery = db.prepare(`
    SELECT dossier.id, dossier.reference, dossier.title, dossier.status, dossier.revision,
      participant.role
    FROM dossiers AS dossier
    JOIN dossier_participants AS participant
      ON participant.dossier_id = dossier.id
      AND participant.user_id = ?
      AND participant.status = 'active'
    WHERE dossier.id = ?
    LIMIT 1
  `);
  const warmupIterations = 20;
  const measuredIterations = 200;
  for (let index = 0; index < warmupIterations; index += 1) {
    assert.equal(listQuery.all("scale-dossier", "received").length, 10);
    assert.ok(openQuery.get(ownerId, "scale-dossier"));
  }
  const listSamples: number[] = [];
  const openSamples: number[] = [];
  for (let index = 0; index < measuredIterations; index += 1) {
    const listStartedAt = performance.now();
    const listed = listQuery.all("scale-dossier", "received");
    listSamples.push(performance.now() - listStartedAt);
    assert.ok(listed.length <= 100);

    const openStartedAt = performance.now();
    const opened = openQuery.get(ownerId, "scale-dossier");
    openSamples.push(performance.now() - openStartedAt);
    assert.ok(opened);
  }
  const measurements = {
    schema: "dossier-pilot-query-timing-v1",
    fixture: {
      dossiers: 1,
      documents: 10,
      document_versions: 20,
      source_anchors: 100,
      audit_events: 100,
    },
    warmup_iterations: warmupIterations,
    measured_iterations: measuredIterations,
    units: "milliseconds",
    list_documents: timingReceipt(listSamples, 100),
    open_dossier: timingReceipt(openSamples, 1),
  };
  t.diagnostic(`DOSSIER_PILOT_PERF ${JSON.stringify(measurements)}`);
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

function timingReceipt(samples: number[], boundedRowLimit: number) {
  const ordered = [...samples].sort((left, right) => left - right);
  const round = (value: number) => Number(value.toFixed(6));
  return {
    bounded_row_limit: boundedRowLimit,
    total_ms: round(samples.reduce((total, value) => total + value, 0)),
    median_ms: round(ordered[Math.floor(ordered.length / 2)] ?? 0),
    p95_ms: round(ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0),
    max_ms: round(ordered.at(-1) ?? 0),
  };
}
