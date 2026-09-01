import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import * as schema from "../db/schema";
import {
  cleanupExpiredUploadIntents,
  cleanupUploadIntent,
  commitUploadIntent,
  executeDossierDocumentUpload,
  failAndCleanupUploadIntent,
  putVerifiedPrivateObject,
  recoverDossierExtractionJobs,
  stageOrResumeUploadIntent,
  uploadIntentByIdempotency,
  uploadIntentDigests,
  type DossierDocumentUploadForm,
  type DossierUploadCoordinatorContext,
  type DossierUploadCoordinatorDependencies,
} from "../app/dossier-document-upload-coordinator";
import {
  prepareDossierUpload,
  type PreparedDossierUpload,
} from "../app/dossier-private-upload";

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
  "0012_sleepy_magma.sql",
  "0013_polite_sentinels.sql",
  "0014_perfect_marvex.sql",
  "0015_low_calypso.sql",
] as const;

let miniflare: Miniflare | undefined;
let d1: D1Database;
let bucket: R2Bucket;
let serial = 0;

type Harness = {
  context: DossierUploadCoordinatorContext;
  dependencies: DossierUploadCoordinatorDependencies;
  dossierId: string;
};

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

async function seedHarness(label: string): Promise<Harness> {
  const normalized = label.replaceAll(/[^a-z0-9]/gu, "-").slice(0, 30);
  const email = `${normalized}-${serial + 1}@example.test`;
  await d1.prepare(
    "INSERT INTO users (email, display_name) VALUES (?, ?)",
  ).bind(email, `Upload ${label}`).run();
  const user = await d1.prepare(
    "SELECT id, actor_id, display_name FROM users WHERE email = ?",
  ).bind(email).first<{ id: number; actor_id: string; display_name: string }>();
  assert.ok(user);
  const dossierId = opaque("dossier");
  const reference = `REF-${normalized}-${serial}`;
  const createdAt = new Date().toISOString();
  const createdAuditId = opaque("audit_event");
  await d1.batch([
    d1.prepare(`
      INSERT INTO dossiers (
        id, reference, title, dossier_type_registry, dossier_type_id,
        dossier_type_version, owner_user_id, owner_actor_id, jurisdictions,
        created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
      ) VALUES (?, ?, ?, 'genesis-juris-dossier-types', 'general-matter',
        '1.0.0', ?, ?, '["Test"]', ?, ?, ?, ?)
    `).bind(
      dossierId,
      reference,
      `Matter ${label}`,
      user.id,
      user.actor_id,
      user.actor_id,
      user.actor_id,
      createdAt,
      createdAt,
    ),
    d1.prepare(`
      INSERT INTO dossier_audit_events (
        id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
        object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
        summary_code, event_digest
      ) VALUES (?, ?, 1, 1, 'dossier_created', 'dossier', ?, ?, ?, 'owner', ?,
        'DOSSIER_CREATED', ?)
    `).bind(
      createdAuditId,
      dossierId,
      dossierId,
      user.id,
      user.actor_id,
      createdAt,
      await sha256(`${dossierId}:1:1:${createdAuditId}`),
    ),
    d1.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 1, ?, ?)
    `).bind(dossierId, user.actor_id, createdAt),
  ]);
  const context: DossierUploadCoordinatorContext = {
    db: drizzle(d1, { schema }),
    actor: {
      userId: user.id,
      actorId: user.actor_id,
      displayName: user.display_name,
      email,
      platformAdmin: false,
    },
  };
  const dependencies: DossierUploadCoordinatorDependencies = {
    requireUploadRole: async (currentDossierId) => {
      const participant = await d1.prepare(`
        SELECT role FROM dossier_participants
        WHERE dossier_id = ? AND user_id = ? AND actor_id = ? AND status = 'active'
      `).bind(currentDossierId, user.id, user.actor_id)
        .first<{ role: string }>();
      if (participant?.role !== "owner" && participant?.role !== "contributor") {
        throw new Error("Upload authorization changed.");
      }
      return participant.role;
    },
    prepareRevisionAuditBatch: async (currentDossierId, resultingRevision, inputs) => {
      const previous = await d1.prepare(`
        SELECT id, sequence, event_digest
        FROM dossier_audit_events
        WHERE dossier_id = ?
        ORDER BY sequence DESC
        LIMIT 1
      `).bind(currentDossierId)
        .first<{ id: string; sequence: number; event_digest: string }>();
      let previousId = previous?.id ?? null;
      let sequence = previous?.sequence ?? 0;
      const auditEvents = [];
      for (const input of inputs) {
        sequence += 1;
        const id = opaque("audit");
        const occurredAt = input.occurredAt ?? new Date().toISOString();
        auditEvents.push({
          id,
          dossierId: currentDossierId,
          dossierRevision: resultingRevision,
          sequence,
          eventType: input.eventType,
          objectRefType: input.objectRefType,
          objectRefId: input.objectRefId,
          actorUserId: user.id,
          actorRef: user.actor_id,
          actorRole: input.actorRole,
          occurredAt,
          summaryCode: input.summaryCode,
          detail: input.detail ?? {},
          previousEventId: previousId,
          eventDigest: await sha256(`${currentDossierId}:${resultingRevision}:${sequence}:${id}`),
        });
        previousId = id;
      }
      return {
        revisionReceipt: {
          dossierId: currentDossierId,
          resultingRevision,
          createdByActorRef: user.actor_id,
          createdAt: new Date().toISOString(),
        },
        auditEvents,
      };
    },
  };
  return { context, dependencies, dossierId };
}

async function uploadFixture(input: {
  revision: number;
  text: string;
  idempotencyKey: string;
  documentId?: string | null;
  title?: string;
  filename?: string;
}) {
  const filename = input.filename ?? "evidence.txt";
  const bytes = new TextEncoder().encode(input.text);
  const file = new File([bytes], filename, { type: "text/plain" });
  const form: DossierDocumentUploadForm = {
    file,
    title: input.title ?? "Evidence",
    documentType: "evidence",
    classification: "confidential",
    expectedRevision: input.revision,
    documentId: input.documentId ?? null,
    sourceNote: "integration-test",
    idempotencyKey: input.idempotencyKey,
    declaredMediaType: "text/plain",
  };
  const prepared = await prepareDossierUpload({
    originalFilename: filename,
    browserMediaType: "text/plain",
    declaredMediaType: "text/plain",
    bytes,
  });
  return { form, prepared };
}

async function executeUpload(
  harness: Harness,
  fixture: Awaited<ReturnType<typeof uploadFixture>>,
  dossierRevision = fixture.form.expectedRevision,
  privateBucket = bucket,
) {
  return executeDossierDocumentUpload({
    context: harness.context,
    dependencies: harness.dependencies,
    bucket: privateBucket,
    dossierId: harness.dossierId,
    dossierRevision,
    form: fixture.form,
    prepared: fixture.prepared,
  });
}

async function stageFixture(
  harness: Harness,
  fixture: Awaited<ReturnType<typeof uploadFixture>>,
) {
  const digests = await uploadIntentDigests(
    harness.context,
    harness.dossierId,
    fixture.form,
    fixture.prepared,
  );
  const intent = await stageOrResumeUploadIntent({
    context: harness.context,
    dossierId: harness.dossierId,
    form: fixture.form,
    prepared: fixture.prepared,
    ...digests,
  });
  return { intent, ...digests };
}

async function stageShortLivedFixture(
  harness: Harness,
  fixture: Awaited<ReturnType<typeof uploadFixture>>,
  lifetimeMs = 1_250,
) {
  const { idempotencyKeyHash, requestBindingDigest } = await uploadIntentDigests(
    harness.context,
    harness.dossierId,
    fixture.form,
    fixture.prepared,
  );
  const now = new Date().toISOString();
  const intentId = opaque("upload");
  const documentId = fixture.form.documentId ?? opaque("document");
  const objectKey = `dossier-v1/${harness.dossierId}/${intentId}/${"a".repeat(64)}`;
  const expiresAt = new Date(Date.now() + lifetimeMs).toISOString();
  const statements = [
    ...(fixture.form.documentId === null ? [harness.context.db.insert(schema.dossierDocuments).values({
      id: documentId,
      dossierId: harness.dossierId,
      title: fixture.form.title,
      documentType: fixture.form.documentType,
      sourceOrigin: "internal_upload",
      isProvisional: true,
      classification: fixture.form.classification,
      status: "received",
      tags: [],
      externalSystemReference: null,
      createdByActorRef: harness.context.actor.actorId,
      updatedByActorRef: harness.context.actor.actorId,
      createdAt: now,
      updatedAt: now,
    })] : []),
    harness.context.db.insert(schema.dossierUploadIntents).values({
      id: intentId,
      dossierId: harness.dossierId,
      documentId,
      actorUserId: harness.context.actor.userId,
      actorRef: harness.context.actor.actorId,
      idempotencyKeyHash,
      requestBindingDigest,
      expectedDossierRevision: fixture.form.expectedRevision,
      temporaryObjectReference: objectKey,
      committedObjectReference: null,
      expectedMediaType: fixture.prepared.mediaType,
      expectedByteLength: fixture.prepared.byteLength,
      expectedContentSha256: fixture.prepared.contentSha256,
      state: "pending",
      failureCode: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }),
  ];
  await harness.context.db.batch([statements[0]!, ...statements.slice(1)]);
  const intent = await uploadIntentByIdempotency(
    harness.context,
    harness.dossierId,
    idempotencyKeyHash,
  );
  assert.ok(intent);
  return { intent, idempotencyKeyHash, requestBindingDigest };
}

function rejectingPutBucket(privateBucket: R2Bucket, rejectDelete = false): R2Bucket {
  return new Proxy(privateBucket, {
    get(target, property) {
      if (property === "put") {
        return async () => {
          throw new Error("injected private object write failure");
        };
      }
      if (property === "delete" && rejectDelete) {
        return async () => {
          throw new Error("injected private object delete failure");
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function row<T>(sql: string, ...values: unknown[]) {
  return d1.prepare(sql).bind(...values).first<T>();
}

async function rows<T>(sql: string, ...values: unknown[]) {
  return (await d1.prepare(sql).bind(...values).all<T>()).results;
}

before(async () => {
  miniflare = new Miniflare({
    workers: [{
      config: {
        name: "dossier-upload-integration",
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
          DB: { type: "d1", name: "dossier-upload-integration" },
          DOSSIER_DOCUMENTS: { type: "r2", name: "dossier-upload-integration" },
        },
      },
      dev: {},
    }],
  });
  d1 = await miniflare.getD1Database("DB", "dossier-upload-integration") as unknown as D1Database;
  bucket = await miniflare.getR2Bucket(
    "DOSSIER_DOCUMENTS",
    "dossier-upload-integration",
  ) as unknown as R2Bucket;
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

test("migration 0015 and private R2 are executable through Miniflare", async () => {
  const db = drizzle(d1, { schema });
  const result = await db.select().from(schema.dossierUploadIntents);
  assert.deepEqual(result, []);
  await bucket.put("private/test", "ok");
  assert.equal(await (await bucket.get("private/test"))?.text(), "ok");
  await bucket.delete("private/test");
});

test("upload commit batch follows domain, stale, audit, receipt, then committed-intent guard order", () => {
  const source = readFileSync(
    new URL("../app/dossier-document-upload-coordinator.ts", import.meta.url),
    "utf8",
  );
  const commitSource = source.slice(
    source.indexOf("export async function commitUploadIntent"),
    source.indexOf("async function currentOutputStates"),
  );
  const markers = [
    "input.context.db.update(dossiers).set",
    "input.context.db.insert(dossierOutputStateEvents).values",
    "input.context.db.insert(dossierAuditEvents).values(event)",
    "input.context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
    'state: "committed"',
  ];
  let previous = -1;
  for (const marker of markers) {
    const current = commitSource.indexOf(marker);
    assert.ok(current > previous, `${marker} must follow the prior guarded commit step`);
    previous = current;
  }
});

test("real upload commits verified private bytes, revision receipt, version, and deterministic extraction atomically", async () => {
  const harness = await seedHarness("success");
  const fixture = await uploadFixture({
    revision: 1,
    text: "Alpha evidence\r\nSecond line\r\n",
    idempotencyKey: "success-key-0001",
  });
  const response = await executeUpload(harness, fixture);
  assert.equal(response.status, 201);
  const body = await response.json() as {
    document_id: string;
    dossier_revision: number;
    idempotent: boolean;
    version: {
      document_version_id: string;
      extraction_status: string;
      content_sha256: string;
      download_url: string;
    };
  };
  assert.equal(body.dossier_revision, 2);
  assert.equal(body.idempotent, false);
  assert.equal(body.version.extraction_status, "ready");
  assert.equal(body.version.content_sha256, fixture.prepared.contentSha256);
  assert.match(body.version.download_url, /^\/api\/dossiers\//u);
  assert.doesNotMatch(JSON.stringify(body), /dossier-v1|temporary_object|committed_object/iu);

  const intent = await row<{
    id: string;
    state: string;
    actor_ref: string;
    idempotency_key_hash: string;
    request_binding_digest: string;
    temporary_object_reference: string;
    measured_content_sha256: string;
  }>(`
    SELECT id, state, actor_ref, idempotency_key_hash, request_binding_digest,
      temporary_object_reference, measured_content_sha256
    FROM dossier_upload_intents
    WHERE dossier_id = ?
  `, harness.dossierId);
  assert.ok(intent);
  assert.equal(intent.state, "committed");
  assert.equal(intent.actor_ref, harness.context.actor.actorId);
  assert.notEqual(intent.idempotency_key_hash, intent.request_binding_digest);
  assert.equal(intent.measured_content_sha256, fixture.prepared.contentSha256);
  const sourceObject = await bucket.get(intent.temporary_object_reference);
  assert.ok(sourceObject);
  assert.equal(await sourceObject.text(), "Alpha evidence\r\nSecond line\r\n");

  const persisted = await row<{
    revision: number;
    is_provisional: number;
    document_version_id: string;
    extraction_status: string;
    extracted_text_sha256: string;
    receipt_count: number;
    audit_count: number;
  }>(`
    SELECT dossier.revision, document.is_provisional,
      current_version.document_version_id,
      job.status AS extraction_status,
      result.extracted_text_sha256,
      (SELECT count(*) FROM dossier_revision_receipts receipt
        WHERE receipt.dossier_id = dossier.id AND receipt.resulting_revision = 2) AS receipt_count,
      (SELECT count(*) FROM dossier_audit_events audit
        WHERE audit.dossier_id = dossier.id AND audit.dossier_revision = 2
          AND audit.event_type = 'document_version_created') AS audit_count
    FROM dossiers dossier
    JOIN dossier_documents document ON document.dossier_id = dossier.id
    JOIN dossier_document_current_versions current_version
      ON current_version.dossier_id = document.dossier_id
      AND current_version.document_id = document.id
    JOIN dossier_extraction_jobs job
      ON job.dossier_id = current_version.dossier_id
      AND job.document_version_id = current_version.document_version_id
    JOIN dossier_extraction_results result
      ON result.dossier_id = job.dossier_id AND result.extraction_job_id = job.id
    WHERE dossier.id = ?
  `, harness.dossierId);
  assert.deepEqual(persisted, {
    revision: 2,
    is_provisional: 0,
    document_version_id: body.version.document_version_id,
    extraction_status: "ready",
    extracted_text_sha256: await sha256("Alpha evidence\nSecond line\n"),
    receipt_count: 1,
    audit_count: 1,
  });

  const otherActorContext: DossierUploadCoordinatorContext = {
    ...harness.context,
    actor: {
      ...harness.context.actor,
      userId: harness.context.actor.userId + 10_000,
      actorId: opaque("actor"),
    },
  };
  const originalDigests = await uploadIntentDigests(
    harness.context,
    harness.dossierId,
    fixture.form,
    fixture.prepared,
  );
  const otherActorDigests = await uploadIntentDigests(
    otherActorContext,
    harness.dossierId,
    fixture.form,
    fixture.prepared,
  );
  assert.notEqual(otherActorDigests.idempotencyKeyHash, originalDigests.idempotencyKeyHash);
  assert.notEqual(otherActorDigests.requestBindingDigest, originalDigests.requestBindingDigest);

  const substituted = await uploadFixture({
    revision: 1,
    text: "Substituted provenance",
    idempotencyKey: "success-key-0001",
  });
  const rejected = await executeUpload(harness, substituted, 2);
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json() as { code: string }).code, "upload_intent_conflict");
});

test("PDF commits honestly as not_extractable with a migration-valid incomplete-time receipt", async () => {
  const harness = await seedHarness("pdf-not-extractable");
  const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
  const file = new File([bytes], "attachment.pdf", { type: "application/pdf" });
  const form: DossierDocumentUploadForm = {
    file,
    title: "PDF attachment",
    documentType: "evidence",
    classification: "confidential",
    expectedRevision: 1,
    documentId: null,
    sourceNote: "integration-test",
    idempotencyKey: "pdf-not-extractable-key",
    declaredMediaType: "application/pdf",
  };
  const prepared = await prepareDossierUpload({
    originalFilename: file.name,
    browserMediaType: file.type,
    declaredMediaType: "application/pdf",
    bytes,
  });
  const response = await executeUpload(harness, { form, prepared });
  assert.equal(response.status, 201);
  assert.equal(
    (await response.json() as { version: { extraction_status: string } })
      .version.extraction_status,
    "not_extractable",
  );
  assert.deepEqual(await row<{
    status: string;
    error_code: string;
    error_detail_code: string;
    completed_at: string | null;
    result_count: number;
  }>(`
    SELECT job.status, job.error_code, job.error_detail_code, job.completed_at,
      count(result.id) AS result_count
    FROM dossier_extraction_jobs job
    LEFT JOIN dossier_extraction_results result
      ON result.dossier_id = job.dossier_id AND result.extraction_job_id = job.id
    WHERE job.dossier_id = ?
    GROUP BY job.id
  `, harness.dossierId), {
    status: "not_extractable",
    error_code: "unsupported_type",
    error_detail_code: "PARSER_NOT_APPROVED",
    completed_at: null,
    result_count: 0,
  });
});

test("lost-201 exact replay is returned before stale-revision and full pending-quota checks", async () => {
  const harness = await seedHarness("lost-201");
  const original = await uploadFixture({
    revision: 1,
    text: "Original committed upload",
    idempotencyKey: "lost-response-key",
  });
  const first = await executeUpload(harness, original);
  assert.equal(first.status, 201);
  const firstBody = await first.json() as {
    document_id: string;
    version: { document_version_id: string };
  };

  for (let index = 0; index < 20; index += 1) {
    const reservation = await uploadFixture({
      revision: 2,
      text: `pending-${index}`,
      idempotencyKey: `pending-quota-key-${index.toString().padStart(2, "0")}`,
      title: `Pending ${index}`,
    });
    await stageFixture(harness, reservation);
  }
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count
    FROM dossier_upload_intents
    WHERE dossier_id = ? AND state = 'pending'
  `, harness.dossierId))?.count, 20);

  const overflow = await uploadFixture({
    revision: 2,
    text: "pending-overflow",
    idempotencyKey: "pending-quota-overflow",
  });
  await assert.rejects(stageFixture(harness, overflow), /could not be staged/iu);

  const replay = await executeUpload(harness, original, 2);
  assert.equal(replay.status, 200);
  const replayBody = await replay.json() as {
    document_id: string;
    idempotent: boolean;
    version: { document_version_id: string };
  };
  assert.equal(replayBody.idempotent, true);
  assert.equal(replayBody.document_id, firstBody.document_id);
  assert.equal(
    replayBody.version.document_version_id,
    firstBody.version.document_version_id,
  );
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count
    FROM dossier_upload_intents
    WHERE dossier_id = ? AND state = 'pending'
  `, harness.dossierId))?.count, 20);
});

test("migration 0014 atomically reserves pending count and stored-plus-pending bytes", async () => {
  const harness = await seedHarness("byte-reservation");
  const base = await uploadFixture({
    revision: 1,
    text: "reservation",
    idempotencyKey: "byte-reservation-base",
  });
  for (let index = 0; index < 10; index += 1) {
    const fixture = await uploadFixture({
      revision: 1,
      text: `reservation-${index}`,
      idempotencyKey: `byte-reservation-${index.toString().padStart(2, "0")}`,
      title: `Byte reservation ${index}`,
    });
    await stageFixture(harness, {
      form: fixture.form,
      prepared: {
        ...base.prepared,
        byteLength: 100_000_000,
      } satisfies PreparedDossierUpload,
    });
  }
  const reserved = await row<{ count: number; bytes: number }>(`
    SELECT count(*) AS count, sum(expected_byte_length) AS bytes
    FROM dossier_upload_intents
    WHERE dossier_id = ? AND state = 'pending'
  `, harness.dossierId);
  assert.deepEqual(reserved, { count: 10, bytes: 1_000_000_000 });

  const overflow = await uploadFixture({
    revision: 1,
    text: "reservation-overflow",
    idempotencyKey: "byte-reservation-overflow",
    title: "Byte reservation overflow",
  });
  await assert.rejects(stageFixture(harness, {
    form: overflow.form,
    prepared: {
      ...base.prepared,
      byteLength: 100_000_000,
    } satisfies PreparedDossierUpload,
  }), /could not be staged/iu);
  assert.deepEqual(await row<{ count: number; bytes: number }>(`
    SELECT count(*) AS count, sum(expected_byte_length) AS bytes
    FROM dossier_upload_intents
    WHERE dossier_id = ? AND state = 'pending'
  `, harness.dossierId), { count: 10, bytes: 1_000_000_000 });
});

test("immediate object failure wins an abort CAS, rolls back a provisional document, and permits exact key reuse", async () => {
  const harness = await seedHarness("abort-cas");
  const fixture = await uploadFixture({
    revision: 1,
    text: "Abort this upload",
    idempotencyKey: "abort-cas-key",
  });
  const failed = await executeUpload(
    harness,
    fixture,
    1,
    rejectingPutBucket(bucket, true),
  );
  assert.equal(failed.status, 503);
  assert.equal((await failed.json() as { code: string }).code, "document_storage_unavailable");
  const claimed = await row<{
    id: string;
    document_id: string;
    state: string;
    failure_code: string;
    temporary_object_reference: string;
  }>(`
    SELECT id, document_id, state, failure_code, temporary_object_reference
    FROM dossier_upload_intents
    WHERE dossier_id = ?
  `, harness.dossierId);
  assert.ok(claimed);
  assert.equal(claimed.state, "deleting");
  assert.equal(claimed.failure_code, "OBJECT_WRITE_FAILED");
  assert.equal(await bucket.head(claimed.temporary_object_reference), null);
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count FROM dossier_documents
    WHERE dossier_id = ? AND is_provisional = true
  `, harness.dossierId))?.count, 1);

  const digests = await uploadIntentDigests(
    harness.context,
    harness.dossierId,
    fixture.form,
    fixture.prepared,
  );
  const liveIntent = await uploadIntentByIdempotency(
    harness.context,
    harness.dossierId,
    digests.idempotencyKeyHash,
  );
  assert.ok(liveIntent);
  await cleanupUploadIntent(
    harness.context,
    bucket,
    liveIntent,
    true,
  );
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count FROM dossier_upload_intents WHERE dossier_id = ?
  `, harness.dossierId))?.count, 0);
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = ?
  `, harness.dossierId))?.count, 0);

  const retry = await executeUpload(harness, fixture);
  assert.equal(retry.status, 201);
  assert.equal((await retry.json() as { idempotent: boolean }).idempotent, false);
});

test("first-document and later-version object interruptions leave no poisoned key or pointer", async () => {
  const harness = await seedHarness("interruption-rollback");
  const first = await uploadFixture({
    revision: 1,
    text: "Current version",
    idempotencyKey: "initial-version-key",
  });
  const firstResponse = await executeUpload(harness, first);
  assert.equal(firstResponse.status, 201);
  const firstBody = await firstResponse.json() as {
    document_id: string;
    version: { document_version_id: string };
  };

  const later = await uploadFixture({
    revision: 2,
    text: "Interrupted later version",
    idempotencyKey: "later-version-key",
    documentId: firstBody.document_id,
    filename: "evidence-v2.txt",
  });
  const interrupted = await executeUpload(
    harness,
    later,
    2,
    rejectingPutBucket(bucket),
  );
  assert.equal(interrupted.status, 503);
  const afterFailure = await row<{
    revision: number;
    document_version_id: string;
    version_count: number;
    intent_count: number;
  }>(`
    SELECT dossier.revision, current_version.document_version_id,
      (SELECT count(*) FROM dossier_document_versions version
        WHERE version.dossier_id = dossier.id) AS version_count,
      (SELECT count(*) FROM dossier_upload_intents intent
        WHERE intent.dossier_id = dossier.id AND intent.state <> 'committed') AS intent_count
    FROM dossiers dossier
    JOIN dossier_document_current_versions current_version
      ON current_version.dossier_id = dossier.id
    WHERE dossier.id = ?
  `, harness.dossierId);
  assert.deepEqual(afterFailure, {
    revision: 2,
    document_version_id: firstBody.version.document_version_id,
    version_count: 1,
    intent_count: 0,
  });

  const retry = await executeUpload(harness, later);
  assert.equal(retry.status, 201);
  const retryBody = await retry.json() as {
    dossier_revision: number;
    version: { ordinal: number; predecessor_version_id: string };
  };
  assert.equal(retryBody.dossier_revision, 3);
  assert.equal(retryBody.version.ordinal, 2);
  assert.equal(
    retryBody.version.predecessor_version_id,
    firstBody.version.document_version_id,
  );
});

test("deleting and deleted crash states recover idempotently when the private object is already missing", async () => {
  for (const crashState of ["deleting", "deleted"] as const) {
    const harness = await seedHarness(`cleanup-${crashState}`);
    const fixture = await uploadFixture({
      revision: 1,
      text: `cleanup ${crashState}`,
      idempotencyKey: `cleanup-${crashState}-key`,
    });
    const { intent } = await stageFixture(harness, fixture);
    await putVerifiedPrivateObject(bucket, intent, fixture.prepared);
    const now = new Date().toISOString();
    await harness.context.db.update(schema.dossierUploadIntents).set({
      state: "deleting",
      failureCode: "INJECTED_CLEANUP_CRASH",
      updatedAt: now,
    }).where(and(
      eq(schema.dossierUploadIntents.dossierId, harness.dossierId),
      eq(schema.dossierUploadIntents.id, intent.id),
      eq(schema.dossierUploadIntents.state, "pending"),
    ));
    await bucket.delete(intent.temporaryObjectReference);
    if (crashState === "deleted") {
      await harness.context.db.update(schema.dossierUploadIntents).set({
        state: "deleted",
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(schema.dossierUploadIntents.dossierId, harness.dossierId),
        eq(schema.dossierUploadIntents.id, intent.id),
        eq(schema.dossierUploadIntents.state, "deleting"),
      ));
    }
    assert.equal(await bucket.head(intent.temporaryObjectReference), null);
    await cleanupUploadIntent(harness.context, bucket, intent, true);
    assert.equal((await row<{ count: number }>(`
      SELECT count(*) AS count FROM dossier_upload_intents WHERE dossier_id = ?
    `, harness.dossierId))?.count, 0);
    assert.equal((await row<{ count: number }>(`
      SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = ?
    `, harness.dossierId))?.count, 0);

    const reused = await executeUpload(harness, fixture);
    assert.equal(reused.status, 201);
  }
});

test("a pending intent cannot commit at or after expiry and expired cleanup deletes private bytes before metadata", async () => {
  const harness = await seedHarness("expired-intent");
  const fixture = await uploadFixture({
    revision: 1,
    text: "Short-lived upload",
    idempotencyKey: "short-lived-key",
  });
  const { intent } = await stageShortLivedFixture(harness, fixture);
  await putVerifiedPrivateObject(bucket, intent, fixture.prepared);
  assert.ok(await bucket.head(intent.temporaryObjectReference));
  await new Promise((resolve) => setTimeout(resolve, 1_500));

  await assert.rejects(commitUploadIntent({
    context: harness.context,
    dependencies: harness.dependencies,
    intent,
    form: fixture.form,
    prepared: fixture.prepared,
    newDocument: true,
  }), /cannot be committed/iu);
  assert.equal((await row<{ state: string }>(`
    SELECT state FROM dossier_upload_intents WHERE id = ?
  `, intent.id))?.state, "pending");
  assert.equal((await row<{ revision: number }>(`
    SELECT revision FROM dossiers WHERE id = ?
  `, harness.dossierId))?.revision, 1);

  await cleanupExpiredUploadIntents(harness.context, bucket, harness.dossierId);
  assert.equal(await bucket.head(intent.temporaryObjectReference), null);
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count FROM dossier_upload_intents WHERE dossier_id = ?
  `, harness.dossierId))?.count, 0);
  assert.equal((await row<{ count: number }>(`
    SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = ?
  `, harness.dossierId))?.count, 0);
});

test("commit versus abort-cleanup race has one winner and never deletes committed private bytes", async () => {
  const harness = await seedHarness("commit-cleanup-race");
  const fixture = await uploadFixture({
    revision: 1,
    text: "Race-safe upload",
    idempotencyKey: "race-safe-key",
  });
  const { intent } = await stageFixture(harness, fixture);
  await putVerifiedPrivateObject(bucket, intent, fixture.prepared);
  const [commitResult] = await Promise.allSettled([
    commitUploadIntent({
      context: harness.context,
      dependencies: harness.dependencies,
      intent,
      form: fixture.form,
      prepared: fixture.prepared,
      newDocument: true,
    }),
    failAndCleanupUploadIntent(
      harness.context,
      bucket,
      intent,
      true,
      "INJECTED_RACE_ABORT",
    ),
  ]);
  const versionCount = (await row<{ count: number }>(`
    SELECT count(*) AS count FROM dossier_document_versions WHERE dossier_id = ?
  `, harness.dossierId))?.count ?? -1;
  const revision = (await row<{ revision: number }>(`
    SELECT revision FROM dossiers WHERE id = ?
  `, harness.dossierId))?.revision;
  const liveIntent = await row<{ state: string; failure_code: string | null }>(`
    SELECT state, failure_code FROM dossier_upload_intents
    WHERE dossier_id = ?
  `, harness.dossierId);
  const source = await bucket.head(intent.temporaryObjectReference);
  if (versionCount === 1) {
    assert.equal(commitResult.status, "fulfilled");
    assert.equal(revision, 2);
    assert.deepEqual(liveIntent, { state: "committed", failure_code: null });
    assert.ok(source);
    assert.equal((await row<{ count: number }>(`
      SELECT count(*) AS count FROM dossier_revision_receipts
      WHERE dossier_id = ? AND resulting_revision = 2
    `, harness.dossierId))?.count, 1);
  } else {
    assert.equal(versionCount, 0);
    assert.equal(commitResult.status, "rejected");
    assert.equal(revision, 1);
    assert.equal(liveIntent, null);
    assert.equal(source, null);
    assert.equal((await row<{ count: number }>(`
      SELECT count(*) AS count FROM dossier_documents WHERE dossier_id = ?
    `, harness.dossierId))?.count, 0);
  }
});

test("queued and expired-processing deterministic extraction jobs recover from the committed private source", async () => {
  const harness = await seedHarness("extraction-recovery");
  const queuedFixture = await uploadFixture({
    revision: 1,
    text: "Queued extraction\r\n",
    idempotencyKey: "queued-extraction-key",
  });
  const queuedStage = await stageFixture(harness, queuedFixture);
  await putVerifiedPrivateObject(bucket, queuedStage.intent, queuedFixture.prepared);
  const queuedCommit = await commitUploadIntent({
    context: harness.context,
    dependencies: harness.dependencies,
    intent: queuedStage.intent,
    form: queuedFixture.form,
    prepared: queuedFixture.prepared,
    newDocument: true,
  });
  assert.equal(queuedCommit.extractionStatus, "queued");
  await recoverDossierExtractionJobs(harness.context, bucket, harness.dossierId);
  assert.equal((await row<{ status: string }>(`
    SELECT status FROM dossier_extraction_jobs WHERE id = ?
  `, queuedCommit.extractionJobId))?.status, "ready");

  const processingFixture = await uploadFixture({
    revision: 2,
    text: "Expired processing extraction\r\n",
    idempotencyKey: "processing-extraction-key",
    documentId: queuedCommit.documentId,
    filename: "evidence-v2.txt",
  });
  const processingStage = await stageFixture(harness, processingFixture);
  await putVerifiedPrivateObject(bucket, processingStage.intent, processingFixture.prepared);
  const processingCommit = await commitUploadIntent({
    context: harness.context,
    dependencies: harness.dependencies,
    intent: processingStage.intent,
    form: processingFixture.form,
    prepared: processingFixture.prepared,
    newDocument: false,
  });
  assert.equal(processingCommit.extractionStatus, "queued");
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  await harness.context.db.update(schema.dossierExtractionJobs).set({
    status: "processing",
    leaseOwner: opaque("extractor"),
    leaseExpiresAt: expiredAt,
    startedAt: expiredAt,
    updatedAt: expiredAt,
  }).where(and(
    eq(schema.dossierExtractionJobs.dossierId, harness.dossierId),
    eq(schema.dossierExtractionJobs.id, processingCommit.extractionJobId),
    eq(schema.dossierExtractionJobs.status, "queued"),
  ));
  await recoverDossierExtractionJobs(harness.context, bucket, harness.dossierId);

  const jobs = await rows<{
    ordinal: number;
    status: string;
    result_count: number;
    extracted_text_sha256: string;
    extracted_text_object_reference: string;
  }>(`
    SELECT version.ordinal, job.status,
      count(result.id) AS result_count,
      result.extracted_text_sha256,
      result.extracted_text_object_reference
    FROM dossier_extraction_jobs job
    JOIN dossier_document_versions version
      ON version.dossier_id = job.dossier_id
      AND version.document_id = job.document_id
      AND version.id = job.document_version_id
    LEFT JOIN dossier_extraction_results result
      ON result.dossier_id = job.dossier_id
      AND result.extraction_job_id = job.id
    WHERE job.dossier_id = ?
    GROUP BY version.ordinal, job.id
    ORDER BY version.ordinal
  `, harness.dossierId);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map(({ ordinal, status, result_count }) => ({
    ordinal,
    status,
    result_count,
  })), [
    { ordinal: 1, status: "ready", result_count: 1 },
    { ordinal: 2, status: "ready", result_count: 1 },
  ]);
  assert.equal(jobs[0]?.extracted_text_sha256, await sha256("Queued extraction\n"));
  assert.equal(
    jobs[1]?.extracted_text_sha256,
    await sha256("Expired processing extraction\n"),
  );
  for (const job of jobs) {
    assert.ok(await bucket.head(job.extracted_text_object_reference));
  }
});
