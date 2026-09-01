import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import * as schema from "../db/schema";
import {
  enrollDossierParticipant,
  type DossierParticipantEnrollmentDependencies,
} from "../app/dossier-participant-enrollment";
import {
  authorizeDossierAction,
  DOSSIER_TRUSTED_IDENTITY_SOURCE,
} from "../app/dossier-security";
import type { DossierServerContext } from "../app/dossier-server";

const migrations = [
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
  "0012_sleepy_magma_core.sql",
  "0013_sleepy_magma_guards_a.sql",
  "0014_sleepy_magma_guards_b.sql",
  "0015_sleepy_magma_guards_c.sql",
  "0016_polite_sentinels.sql",
  "0017_perfect_marvex.sql",
  "0018_low_calypso.sql",
] as const;

let miniflare: Miniflare | undefined;
let d1: D1Database;
let serial = 0;

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

function opaque(prefix: string) {
  serial += 1;
  return `${prefix}_${serial.toString(16).padStart(32, "0")}`;
}

async function sha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256-${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function createUser(label: string) {
  const email = `participant-${label}-${++serial}@example.test`;
  const displayName = `Participant ${label}`;
  await d1.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)")
    .bind(email, displayName).run();
  const user = await d1.prepare(
    "SELECT id, actor_id, display_name FROM users WHERE email = ?",
  ).bind(email).first<{ id: number; actor_id: string; display_name: string }>();
  assert.ok(user);
  return { ...user, email };
}

async function seedDossier() {
  const owner = await createUser("Owner");
  const reviewer = await createUser("Reviewer");
  const alternate = await createUser("Alternate");
  const dossierId = opaque("dossier");
  const auditId = opaque("audit");
  const createdAt = "2026-09-01T09:00:00.000Z";
  await d1.batch([
    d1.prepare(`
      INSERT INTO dossiers (
        id, reference, title, dossier_type_registry, dossier_type_id,
        dossier_type_version, owner_user_id, owner_actor_id, jurisdictions,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES (?, ?, 'Participant enrollment integration',
        'genesis-juris-dossier-types', 'general-matter', '1.0.0', ?, ?,
        '["Test"]', ?, ?, ?, ?)
    `).bind(
      dossierId,
      `REF-PARTICIPANT-${serial}`,
      owner.id,
      owner.actor_id,
      owner.actor_id,
      owner.actor_id,
      createdAt,
      createdAt,
    ),
    d1.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, detail, previous_event_id, event_digest
      ) VALUES (?, ?, 1, 1, 'dossier_created', 'dossier', ?, ?, ?, 'owner', ?,
        'DOSSIER_CREATED', '{}', null, ?)
    `).bind(
      auditId,
      dossierId,
      dossierId,
      owner.id,
      owner.actor_id,
      createdAt,
      await sha256(`${dossierId}:1:1:${auditId}`),
    ),
    d1.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 1, ?, ?)
    `).bind(dossierId, owner.actor_id, createdAt),
  ]);
  const ownerContext: DossierServerContext = {
    db: drizzle(d1, { schema }),
    actor: {
      userId: owner.id,
      actorId: owner.actor_id,
      displayName: owner.display_name,
      email: owner.email,
      platformAdmin: false,
    },
  };
  return { dossierId, owner, reviewer, alternate, ownerContext, auditId };
}

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

async function seedCurrentOutput(harness: Awaited<ReturnType<typeof seedDossier>>) {
  const snapshotId = opaque("snapshot");
  const snapshotAuditId = opaque("audit");
  const outputId = opaque("output");
  const outputAuditId = opaque("audit");
  const snapshotAt = "2026-09-01T09:10:00.000Z";
  const outputAt = "2026-09-01T09:20:00.000Z";
  const snapshotDigest = await sha256(`${harness.dossierId}:snapshot`);
  await d1.batch([
    d1.prepare(`
      INSERT INTO dossier_snapshots (
        id, dossier_id, dossier_revision, simulation_inputs, deterministic_receipts,
        status, readiness, approver_records, locale, audience, classification,
        redaction_profile_id, contract_version, report_model_schema_version,
        renderer_version, build_version, manifest_object_reference,
        manifest_byte_length, manifest_digest, sealed, sealed_at,
        sealed_by_actor_ref, created_by_actor_ref, created_at
      ) VALUES (?, ?, 1, '{}', '{}', 'draft', ?, '[]', 'en', 'internal',
        'confidential', 'pilot-default', '1.0.0', 1, '1.0.0', 'test',
        ?, 1024, ?, false, null, null, ?, ?)
    `).bind(
      snapshotId,
      harness.dossierId,
      strictReadiness(harness.dossierId, 1, snapshotAt),
      `private/participant-snapshots/${snapshotId}/${"m".repeat(32)}`,
      snapshotDigest,
      harness.owner.actor_id,
      snapshotAt,
    ),
    d1.prepare(`
      UPDATE dossier_snapshots
      SET sealed = true, sealed_at = ?, sealed_by_actor_ref = ?
      WHERE dossier_id = ? AND id = ?
    `).bind(snapshotAt, harness.owner.actor_id, harness.dossierId, snapshotId),
    d1.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, detail, previous_event_id, event_digest
      ) VALUES (?, ?, 1, 2, 'snapshot_created', 'dossier_snapshot', ?, ?, ?,
        'owner', ?, 'SNAPSHOT_CREATED', '{}', ?, ?)
    `).bind(
      snapshotAuditId,
      harness.dossierId,
      snapshotId,
      harness.owner.id,
      harness.owner.actor_id,
      snapshotAt,
      harness.auditId,
      await sha256(`${harness.dossierId}:1:2:${snapshotAuditId}`),
    ),
    d1.prepare(`
      INSERT INTO dossier_governed_outputs (
        id, dossier_id, snapshot_id, snapshot_digest, format, content_reference,
        content_sha256, filename, generator_schema_version,
        generator_build_version, created_by_actor_ref, created_at
      ) VALUES (?, ?, ?, ?, 'pdf', ?, ?, 'participant-enrollment.pdf', 1,
        'test', ?, ?)
    `).bind(
      outputId,
      harness.dossierId,
      snapshotId,
      snapshotDigest,
      `private/participant-outputs/${outputId}/${"o".repeat(32)}`,
      await sha256(`${harness.dossierId}:output-content`),
      harness.owner.actor_id,
      outputAt,
    ),
    d1.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, detail, previous_event_id, event_digest
      ) VALUES (?, ?, 1, 3, 'output_generated', 'governed_output', ?, ?, ?,
        'owner', ?, 'OUTPUT_GENERATED', '{}', ?, ?)
    `).bind(
      outputAuditId,
      harness.dossierId,
      outputId,
      harness.owner.id,
      harness.owner.actor_id,
      outputAt,
      snapshotAuditId,
      await sha256(`${harness.dossierId}:1:3:${outputAuditId}`),
    ),
  ]);
  return outputId;
}

async function seedCapacityHarness() {
  const owner = await createUser("Capacity owner");
  const target = await createUser("Capacity target");
  const userPrefix = `capacity-history-${++serial}-`;
  const historicalActors = Array.from({ length: 99 }, (_, index) => ({
    actorId: opaque("actor"),
    email: `${userPrefix}${index}@example.test`,
    displayName: `Capacity history ${index}`,
  }));
  await d1.batch(historicalActors.map((user) => d1.prepare(`
    INSERT INTO users (actor_id, email, display_name) VALUES (?, ?, ?)
  `).bind(user.actorId, user.email, user.displayName)));

  const dossierId = opaque("dossier");
  const auditId = opaque("audit");
  const createdAt = "2026-09-01T11:00:00.000Z";
  await d1.batch([
    d1.prepare(`
      INSERT INTO dossiers (
        id, reference, title, dossier_type_registry, dossier_type_id,
        dossier_type_version, owner_user_id, owner_actor_id, jurisdictions,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES (?, ?, 'Participant capacity integration',
        'genesis-juris-dossier-types', 'general-matter', '1.0.0', ?, ?,
        '["Test"]', ?, ?, ?, ?)
    `).bind(
      dossierId,
      `REF-CAPACITY-${serial}`,
      owner.id,
      owner.actor_id,
      owner.actor_id,
      owner.actor_id,
      createdAt,
      createdAt,
    ),
    d1.prepare(`
      INSERT INTO dossier_participants (
        id, dossier_id, user_id, actor_id, display_name, role, status,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      )
      SELECT 'participant_' || substr(actor_id, 7), ?, id, actor_id,
        display_name, 'viewer',
        CASE WHEN id = (
          SELECT max(last_user.id) FROM users AS last_user
          WHERE last_user.email LIKE ?
        ) THEN 'removed' ELSE 'active' END,
        ?, ?, ?, ?
      FROM users
      WHERE email LIKE ?
      ORDER BY id
    `).bind(
      dossierId,
      `${userPrefix}%`,
      owner.actor_id,
      owner.actor_id,
      createdAt,
      createdAt,
      `${userPrefix}%`,
    ),
    d1.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, detail, previous_event_id, event_digest
      ) VALUES (?, ?, 1, 1, 'dossier_created', 'dossier', ?, ?, ?, 'owner', ?,
        'DOSSIER_CREATED', '{}', null, ?)
    `).bind(
      auditId,
      dossierId,
      dossierId,
      owner.id,
      owner.actor_id,
      createdAt,
      await sha256(`${dossierId}:1:1:${auditId}`),
    ),
    d1.prepare(`
      WITH ordered AS (
        SELECT id AS user_id, actor_id,
          row_number() OVER (ORDER BY id) AS ordinal
        FROM users
        WHERE email LIKE ?
      )
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, detail, previous_event_id, event_digest
      )
      SELECT
        'audit_capacity_' || printf('%032x', ordinal),
        ?, 1, ordinal + 1, 'participant_changed', 'participant',
        'participant_' || substr(actor_id, 7), ?, ?, 'owner', ?,
        'PARTICIPANT_ENROLLED', '{}',
        CASE WHEN ordinal = 1 THEN ?
          ELSE 'audit_capacity_' || printf('%032x', ordinal - 1) END,
        'sha256-' || printf('%064x', ordinal + 100000)
      FROM ordered
      ORDER BY ordinal
    `).bind(
      `${userPrefix}%`,
      dossierId,
      owner.id,
      owner.actor_id,
      createdAt,
      auditId,
    ),
    d1.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 1, ?, ?)
    `).bind(dossierId, owner.actor_id, createdAt),
  ]);
  const ownerContext: DossierServerContext = {
    db: drizzle(d1, { schema }),
    actor: {
      userId: owner.id,
      actorId: owner.actor_id,
      displayName: owner.display_name,
      email: owner.email,
      platformAdmin: false,
    },
  };
  return { dossierId, owner, target, ownerContext };
}

function enrollmentDependencies(): DossierParticipantEnrollmentDependencies {
  const now = () => "2026-09-01T10:00:00.000Z";
  return {
    now,
    newId: opaque,
    prepareRevisionAuditBatch: async (context, dossierId, resultingRevision, inputs) => {
      const previous = await d1.prepare(`
        SELECT id, sequence, event_digest
        FROM dossier_audit_events
        WHERE dossier_id = ?
        ORDER BY sequence DESC
        LIMIT 1
      `).bind(dossierId).first<{ id: string; sequence: number; event_digest: string }>();
      let previousId = previous?.id ?? null;
      let sequence = previous?.sequence ?? 0;
      const auditEvents = [];
      for (const input of inputs) {
        sequence += 1;
        const id = opaque("audit");
        const occurredAt = input.occurredAt ?? now();
        auditEvents.push({
          id,
          dossierId,
          dossierRevision: resultingRevision,
          sequence,
          eventType: input.eventType,
          objectRefType: input.objectRefType,
          objectRefId: input.objectRefId,
          actorUserId: context.actor.userId,
          actorRef: context.actor.actorId,
          actorRole: input.actorRole,
          occurredAt,
          summaryCode: input.summaryCode,
          detail: input.detail ?? {},
          previousEventId: previousId,
          eventDigest: await sha256(`${dossierId}:${resultingRevision}:${sequence}:${id}`),
        });
        previousId = id;
      }
      return {
        auditEvents,
        revisionReceipt: {
          dossierId,
          resultingRevision,
          createdByActorRef: context.actor.actorId,
          createdAt: now(),
        },
      };
    },
  };
}

before(async () => {
  miniflare = new Miniflare({
    workers: [{
      config: {
        name: "dossier-participant-enrollment-integration",
        type: "worker",
        compatibilityDate: "2026-09-01",
        manifest: {
          mainModule: "index.mjs",
          modules: {
            "index.mjs": {
              type: "esm",
              contents: "export default { fetch() { return new Response('ok'); } };",
            },
          },
        },
        env: {
          DB: { type: "d1", name: "dossier-participant-enrollment-integration" },
        },
      },
      dev: {},
    }],
  });
  d1 = await miniflare.getD1Database(
    "DB",
    "dossier-participant-enrollment-integration",
  ) as unknown as D1Database;
  for (const name of migrations) {
    const sql = readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim())) {
      if (statement) await d1.prepare(statement).run();
    }
  }
});

after(async () => {
  await miniflare?.dispose();
});

test("owner enrolls an exact profiled reviewer in one canonical revision and failures do not enumerate accounts", async () => {
  const harness = await seedDossier();
  const currentOutputId = await seedCurrentOutput(harness);
  const result = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.reviewer.actor_id,
    role: "reviewer",
    expectedRevision: 1,
    dependencies: enrollmentDependencies(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.dossier_revision, 2);
  assert.equal(result.participant.actor_id, harness.reviewer.actor_id);
  assert.equal(result.participant.display_name, harness.reviewer.display_name);
  assert.equal(result.participant.role, "reviewer");
  assert.deepEqual(result.stale_output_ids, [currentOutputId]);

  const enrolledReviewer = await d1.prepare(`
    SELECT dossier_id, actor_id, role, status
    FROM dossier_participants
    WHERE dossier_id = ? AND actor_id = ?
  `).bind(harness.dossierId, harness.reviewer.actor_id).first<{
    dossier_id: string;
    actor_id: string;
    role: string;
    status: string;
  }>();
  assert.ok(enrolledReviewer);
  const approve = authorizeDossierAction({
    action: "approve",
    identity: {
      authenticated: true,
      source: DOSSIER_TRUSTED_IDENTITY_SOURCE,
      actorId: enrolledReviewer.actor_id,
    },
    dossier: {
      dossierId: harness.dossierId,
      ownerActorId: harness.owner.actor_id,
    },
    participant: {
      dossierId: enrolledReviewer.dossier_id,
      actorId: enrolledReviewer.actor_id,
      role: enrolledReviewer.role,
      status: enrolledReviewer.status,
    },
  });
  assert.equal(approve.allowed, true);
  if (approve.allowed) assert.equal(approve.effectiveRole, "reviewer");

  const stored = await d1.prepare(`
    SELECT
      dossier.revision,
      dossier.updated_by_actor_ref,
      dossier.updated_at AS dossier_updated_at,
      participant.user_id,
      participant.actor_id,
      participant.display_name,
      participant.role,
      participant.status,
      participant.created_by_actor_ref,
      participant.updated_by_actor_ref,
      participant.created_at AS participant_created_at,
      participant.updated_at AS participant_updated_at,
      (SELECT count(*) FROM dossier_revision_receipts
        WHERE dossier_id = dossier.id AND resulting_revision = 2) AS receipts,
      (SELECT count(*) FROM dossier_audit_events
        WHERE dossier_id = dossier.id AND dossier_revision = 2
          AND event_type = 'participant_changed'
          AND object_ref_type = 'participant'
          AND object_ref_id = participant.id
          AND actor_ref = ?) AS participant_audits
    FROM dossiers AS dossier
    JOIN dossier_participants AS participant ON participant.dossier_id = dossier.id
    WHERE dossier.id = ? AND participant.actor_id = ?
  `).bind(
    harness.owner.actor_id,
    harness.dossierId,
    harness.reviewer.actor_id,
  ).first<Record<string, string | number>>();
  assert.ok(stored);
  assert.equal(stored.revision, 2);
  assert.equal(stored.updated_by_actor_ref, harness.owner.actor_id);
  assert.equal(stored.user_id, harness.reviewer.id);
  assert.equal(stored.display_name, harness.reviewer.display_name);
  assert.equal(stored.role, "reviewer");
  assert.equal(stored.status, "active");
  assert.equal(stored.created_by_actor_ref, harness.owner.actor_id);
  assert.equal(stored.updated_by_actor_ref, harness.owner.actor_id);
  assert.equal(stored.participant_created_at, stored.participant_updated_at);
  assert.equal(stored.participant_created_at, stored.dossier_updated_at);
  assert.equal(stored.receipts, 1);
  assert.equal(stored.participant_audits, 1);

  const outputStates = await d1.prepare(`
    SELECT sequence, state, reason, occurred_at, actor_ref
    FROM dossier_output_state_events
    WHERE dossier_id = ? AND output_id = ?
    ORDER BY sequence
  `).bind(harness.dossierId, currentOutputId).all<{
    sequence: number;
    state: string;
    reason: string | null;
    occurred_at: string;
    actor_ref: string;
  }>();
  assert.deepEqual(outputStates.results, [
    {
      sequence: 1,
      state: "current",
      reason: null,
      occurred_at: "2026-09-01T09:20:00.000Z",
      actor_ref: harness.owner.actor_id,
    },
    {
      sequence: 2,
      state: "stale",
      reason: "DOSSIER_PARTICIPANT_CHANGED",
      occurred_at: "2026-09-01T10:00:00.000Z",
      actor_ref: harness.owner.actor_id,
    },
  ]);

  const revisionAudits = await d1.prepare(`
    SELECT sequence, event_type, object_ref_type, object_ref_id, actor_ref,
      actor_role, occurred_at, summary_code, detail
    FROM dossier_audit_events
    WHERE dossier_id = ? AND dossier_revision = 2
    ORDER BY sequence
  `).bind(harness.dossierId).all<Record<string, string | number>>();
  assert.equal(revisionAudits.results.length, 2);
  assert.deepEqual(
    revisionAudits.results.map((event) => ({
      sequence: event.sequence,
      event_type: event.event_type,
      object_ref_type: event.object_ref_type,
      object_ref_id: event.object_ref_id,
      actor_ref: event.actor_ref,
      actor_role: event.actor_role,
      occurred_at: event.occurred_at,
      summary_code: event.summary_code,
    })),
    [
      {
        sequence: 4,
        event_type: "participant_changed",
        object_ref_type: "participant",
        object_ref_id: result.participant.participant_id,
        actor_ref: harness.owner.actor_id,
        actor_role: "owner",
        occurred_at: "2026-09-01T10:00:00.000Z",
        summary_code: "PARTICIPANT_ENROLLED",
      },
      {
        sequence: 5,
        event_type: "output_marked_stale",
        object_ref_type: "governed_output",
        object_ref_id: currentOutputId,
        actor_ref: harness.owner.actor_id,
        actor_role: "owner",
        occurred_at: "2026-09-01T10:00:00.000Z",
        summary_code: "OUTPUT_MARKED_STALE",
      },
    ],
  );
  assert.deepEqual(JSON.parse(String(revisionAudits.results[0]?.detail)), {
    action: "enrolled",
    participant_actor_id: harness.reviewer.actor_id,
    participant_role: "reviewer",
    participant_status: "active",
    revision_after: 2,
    revision_before: 1,
  });
  assert.deepEqual(JSON.parse(String(revisionAudits.results[1]?.detail)), {
    dossier_revision: 2,
    participant_id: result.participant.participant_id,
    reason_code: "DOSSIER_PARTICIPANT_CHANGED",
  });

  const duplicate = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.reviewer.actor_id,
    role: "contributor",
    expectedRevision: 2,
    dependencies: enrollmentDependencies(),
  });
  const missing = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: opaque("actor_missing"),
    role: "contributor",
    expectedRevision: 2,
    dependencies: enrollmentDependencies(),
  });
  assert.deepEqual(duplicate, { ok: false, code: "participant_enrollment_unavailable" });
  assert.deepEqual(missing, duplicate);
  const ownerRole = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.alternate.actor_id,
    role: "owner" as never,
    expectedRevision: 2,
    dependencies: enrollmentDependencies(),
  });
  assert.deepEqual(ownerRole, duplicate);

  const reviewerContext: DossierServerContext = {
    db: harness.ownerContext.db,
    actor: {
      userId: harness.reviewer.id,
      actorId: harness.reviewer.actor_id,
      displayName: harness.reviewer.display_name,
      email: harness.reviewer.email,
      platformAdmin: false,
    },
  };
  const nonOwner = await enrollDossierParticipant({
    context: reviewerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.alternate.actor_id,
    role: "viewer",
    expectedRevision: 2,
    dependencies: enrollmentDependencies(),
  });
  assert.deepEqual(nonOwner, duplicate);

  const staleOwner = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.alternate.actor_id,
    role: "viewer",
    expectedRevision: 1,
    dependencies: enrollmentDependencies(),
  });
  assert.deepEqual(staleOwner, { ok: false, code: "revision_conflict", currentRevision: 2 });
  const unchanged = await d1.prepare(
    "SELECT revision FROM dossiers WHERE id = ?",
  ).bind(harness.dossierId).first<{ revision: number }>();
  assert.equal(unchanged?.revision, 2);
});

test("participant capacity counts removed history and fails closed at exactly 100 rows", async () => {
  const harness = await seedCapacityHarness();
  const before = await d1.prepare(`
    SELECT count(*) AS total,
      sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
      sum(CASE WHEN status = 'removed' THEN 1 ELSE 0 END) AS removed
    FROM dossier_participants
    WHERE dossier_id = ?
  `).bind(harness.dossierId).first<{
    total: number;
    active: number;
    removed: number;
  }>();
  assert.deepEqual(before, { total: 100, active: 99, removed: 1 });

  const atCapacity = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.target.actor_id,
    role: "reviewer",
    expectedRevision: 1,
    dependencies: enrollmentDependencies(),
  });
  const duplicate = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: harness.owner.actor_id,
    role: "viewer",
    expectedRevision: 1,
    dependencies: enrollmentDependencies(),
  });
  const missing = await enrollDossierParticipant({
    context: harness.ownerContext,
    dossierId: harness.dossierId,
    targetActorId: opaque("actor_missing"),
    role: "contributor",
    expectedRevision: 1,
    dependencies: enrollmentDependencies(),
  });
  const unavailable = { ok: false, code: "participant_enrollment_unavailable" };
  assert.deepEqual(atCapacity, unavailable);
  assert.deepEqual(duplicate, unavailable);
  assert.deepEqual(missing, unavailable);

  const unchanged = await d1.prepare(`
    SELECT
      dossier.revision,
      (SELECT count(*) FROM dossier_participants
        WHERE dossier_id = dossier.id) AS participants,
      (SELECT count(*) FROM dossier_revision_receipts
        WHERE dossier_id = dossier.id) AS receipts,
      (SELECT count(*) FROM dossier_audit_events
        WHERE dossier_id = dossier.id AND dossier_revision = 2) AS revision_two_audits
    FROM dossiers AS dossier
    WHERE dossier.id = ?
  `).bind(harness.dossierId).first<Record<string, number>>();
  assert.deepEqual(unchanged, {
    revision: 1,
    participants: 100,
    receipts: 1,
    revision_two_audits: 0,
  });
});
