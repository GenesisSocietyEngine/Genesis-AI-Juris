import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import * as schema from "../db/schema";
import { DossierProposalAIError, type DossierProposalAICandidate } from "../app/dossier-proposal-ai-server";
import {
  executeDossierProposalGeneration,
  parseDossierProposalGenerationRequest,
  replayReadyDossierProposalGeneration,
  type DossierProposalGenerationDependencies,
} from "../app/dossier-proposal-generation";
import { sha256Bytes } from "../app/dossier-private-upload";
import type { DossierAuditEventInput } from "../app/dossier-server";

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

function opaque(prefix: string) {
  serial += 1;
  return `${prefix}_${serial.toString(16).padStart(32, "0")}`;
}

async function digest(value: string) {
  return (await sha256Bytes(value)).contentSha256;
}

type GenerationHarness = Awaited<ReturnType<typeof seedHarness>>;

async function seedHarness(label: string) {
  const email = `proposal-${label}-${serial + 1}@example.test`;
  await d1.prepare("INSERT INTO users (email, display_name) VALUES (?, ?)")
    .bind(email, `Proposal ${label}`).run();
  const user = await d1.prepare("SELECT id, actor_id, display_name FROM users WHERE email = ?")
    .bind(email).first<{ id: number; actor_id: string; display_name: string }>();
  if (!user) throw new Error("fixture user was not created");
  const dossierId = opaque("dossier");
  const documentId = opaque("document");
  const documentVersionId = opaque("document_version");
  const extractionJobId = opaque("extraction_job");
  const extractionResultId = opaque("extraction_result");
  const createdAuditId = opaque("audit");
  const createdAt = "2020-01-01 00:00:00";
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
      `REF-${label}-${serial}`,
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
      await digest(`${dossierId}:created`),
    ),
    d1.prepare(`
      INSERT INTO dossier_revision_receipts
        (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 1, ?, ?)
    `).bind(dossierId, user.actor_id, createdAt),
  ]);

  const text = "Notice issued 1 September 2026.";
  const textDigest = await sha256Bytes(text);
  const objectKey = `dossier-v1/${dossierId}/${opaque("upload_intent")}/${"a".repeat(64)}`;
  await d1.prepare(`
    INSERT INTO dossier_documents (
      id, dossier_id, title, document_type, source_origin, classification,
      created_by_actor_ref, updated_by_actor_ref, created_at, updated_at
    ) VALUES (?, ?, 'Source notice', 'evidence', 'external_reference', 'confidential', ?, ?, ?, ?)
  `).bind(documentId, dossierId, user.actor_id, user.actor_id, createdAt, createdAt).run();
  const documentAuditId = opaque("audit");
  const versionAuditId = opaque("audit");
  const documentAuditDigest = await digest(`${dossierId}:2:2:${documentAuditId}`);
  const versionAuditDigest = await digest(`${dossierId}:2:3:${versionAuditId}`);
  await d1.batch([
    d1.prepare("UPDATE dossiers SET revision = 2, updated_by_actor_ref = ?, updated_at = ? WHERE id = ? AND revision = 1")
      .bind(user.actor_id, createdAt, dossierId),
    d1.prepare(`
    INSERT INTO dossier_document_versions (
      id, dossier_id, document_id, ordinal, binary_object_reference,
      original_filename, media_type, byte_length, content_sha256,
      uploader_user_id, uploader_actor_ref, uploaded_at, predecessor_version_id,
      created_by_actor_ref, created_at
    ) VALUES (?, ?, ?, 1, ?, 'notice.txt', 'text/plain', ?, ?, ?, ?, ?, null, ?, ?)
  `).bind(
    documentVersionId,
    dossierId,
    documentId,
    `private-fixture/${dossierId}/${documentVersionId}`,
    textDigest.checksum.byteLength,
    await digest(`${text}:document-content`),
    user.id,
    user.actor_id,
    createdAt,
    user.actor_id,
    createdAt,
    ),
    d1.prepare(`INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) VALUES (?, ?, 2, 2, 'document_created', 'document', ?, ?, ?, 'owner', ?,
      'DOCUMENT_CREATED', '{}', ?, ?)`)
      .bind(documentAuditId, dossierId, documentId, user.id, user.actor_id, createdAt, createdAuditId, documentAuditDigest),
    d1.prepare(`INSERT INTO dossier_audit_events (
      id, dossier_id, dossier_revision, sequence, event_type, object_ref_type,
      object_ref_id, actor_user_id, actor_ref, actor_role, occurred_at,
      summary_code, detail, previous_event_id, event_digest
    ) SELECT ?, ?, 2, 3, 'document_version_created', 'document_version', ?, ?, ?,
      'owner', pointer.updated_at, 'DOCUMENT_VERSION_CREATED', '{}', ?, ?
      FROM dossier_document_current_versions pointer
      WHERE pointer.dossier_id = ? AND pointer.document_id = ? AND pointer.document_version_id = ?`)
      .bind(versionAuditId, dossierId, documentVersionId, user.id, user.actor_id, documentAuditId, versionAuditDigest, dossierId, documentId, documentVersionId),
    d1.prepare(`INSERT INTO dossier_revision_receipts
      (dossier_id, resulting_revision, created_by_actor_ref, created_at)
      VALUES (?, 2, ?, ?)`)
      .bind(dossierId, user.actor_id, createdAt),
  ]);
  await d1.prepare(`
    INSERT INTO dossier_extraction_jobs (
      id, dossier_id, document_id, document_version_id, status, extractor_version
    ) VALUES (?, ?, ?, ?, 'queued', 'genesis-dossier-strict-utf8-v1')
  `).bind(extractionJobId, dossierId, documentId, documentVersionId).run();
  const startedAt = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await d1.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'processing', lease_owner = ?, lease_expires_at = ?,
      started_at = ?, updated_at = ?
    WHERE dossier_id = ? AND id = ? AND status = 'queued'
  `).bind(opaque("extraction_worker"), leaseExpiresAt, startedAt, startedAt, dossierId, extractionJobId).run();
  const completedAt = new Date().toISOString();
  await d1.prepare(`
    UPDATE dossier_extraction_jobs
    SET status = 'ready', lease_owner = null, lease_expires_at = null,
      completed_at = ?, updated_at = ?
    WHERE dossier_id = ? AND id = ? AND status = 'processing'
  `).bind(completedAt, completedAt, dossierId, extractionJobId).run();
  await d1.prepare(`
    INSERT INTO dossier_extraction_results (
      id, dossier_id, document_id, document_version_id, extraction_job_id,
      extractor_version, extracted_text_object_reference, extracted_text_sha256,
      extracted_text_byte_length, character_count, created_at
    ) VALUES (?, ?, ?, ?, ?, 'genesis-dossier-strict-utf8-v1', ?, ?, ?, ?, ?)
  `).bind(
    extractionResultId,
    dossierId,
    documentId,
    documentVersionId,
    extractionJobId,
    objectKey,
    textDigest.contentSha256,
    new TextEncoder().encode(text).byteLength,
    text.length,
    completedAt,
  ).run();
  await bucket.put(objectKey, text, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { contentSha256: textDigest.contentSha256 },
    sha256: textDigest.checksum,
  });

  const context = {
    db: drizzle(d1, { schema }),
    actor: {
      userId: user.id,
      actorId: user.actor_id,
      displayName: user.display_name,
      email,
      platformAdmin: false,
    },
  };

  async function prepareAuditEvents(
    currentDossierId: string,
    resultingRevision: number,
    inputs: readonly DossierAuditEventInput[],
  ) {
    const previous = await d1.prepare(`
      SELECT id, sequence, event_digest
      FROM dossier_audit_events WHERE dossier_id = ?
      ORDER BY sequence DESC LIMIT 1
    `).bind(currentDossierId).first<{ id: string; sequence: number; event_digest: string }>();
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
        actorUserId: user!.id,
        actorRef: user!.actor_id,
        actorRole: input.actorRole,
        occurredAt,
        summaryCode: input.summaryCode,
        detail: input.detail ?? {},
        previousEventId: previousId,
        eventDigest: await digest(`${currentDossierId}:${resultingRevision}:${sequence}:${id}`),
      });
      previousId = id;
    }
    return auditEvents;
  }

  return {
    context,
    dossierId,
    documentId,
    documentVersionId,
    text,
    prepareAuditEvents,
  };
}

function request(harness: GenerationHarness, idempotencyKey: string, retryFailed = false) {
  return parseDossierProposalGenerationRequest({
    expected_revision: 2,
    document_version_ids: [harness.documentVersionId],
    idempotency_key: idempotencyKey,
    data_classification: "synthetic_or_deidentified",
    privacy_disclosure_acknowledged: true,
    retry_failed: retryFailed,
  });
}

function factCandidate(harness: GenerationHarness, type: "fact" | "dated_event"): DossierProposalAICandidate {
  return {
    proposal_type: type,
    statement: type === "fact" ? "A notice was issued." : "The notice states a date.",
    document_version_id: harness.documentVersionId,
    character_start: 0,
    character_end: harness.text.length,
    exact_excerpt: harness.text,
    decision_package_reference_id: null,
    target_type: null,
    target_id: null,
    relation: null,
    professional_meaning: null,
  };
}

function dependencies(
  harness: GenerationHarness,
  generateCandidates: DossierProposalGenerationDependencies["generateCandidates"],
  counters: { permissions: number; providers: number },
  now: DossierProposalGenerationDependencies["now"] = () => new Date().toISOString(),
): DossierProposalGenerationDependencies {
  return {
    modelProvider: "openai",
    modelName: "gpt-test-proposals",
    modelConfigurationDigest: `sha256-${"b".repeat(64)}`,
    now,
    newId: (prefix) => opaque(prefix),
    acquireProviderPermission: async () => {
      counters.permissions += 1;
      return {
        ok: true,
        safetyIdentifier: `sha256-${"c".repeat(64)}`,
        release: async () => undefined,
      };
    },
    generateCandidates: async (input) => {
      counters.providers += 1;
      return generateCandidates(input);
    },
    prepareAuditEvents: harness.prepareAuditEvents,
    prepareRevisionAuditBatch: async (currentDossierId, resultingRevision, inputs) => ({
      auditEvents: await harness.prepareAuditEvents(currentDossierId, resultingRevision, inputs),
      revisionReceipt: {
        dossierId: currentDossierId,
        resultingRevision,
        createdByActorRef: harness.context.actor.actorId,
        createdAt: new Date().toISOString(),
      },
    }),
  };
}

async function runGeneration(
  harness: GenerationHarness,
  currentDependencies: DossierProposalGenerationDependencies,
  idempotencyKey: string,
  retryFailed = false,
  privateBucket = bucket,
) {
  return executeDossierProposalGeneration({
    context: harness.context,
    bucket: privateBucket,
    dossierId: harness.dossierId,
    role: "owner",
    request: request(harness, idempotencyKey, retryFailed),
    dependencies: currentDependencies,
  });
}

before(async () => {
  miniflare = new Miniflare({
    workers: [{
      config: {
        name: "dossier-proposal-generation-integration",
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
          DB: { type: "d1", name: "dossier-proposal-generation-integration" },
          DOSSIER_DOCUMENTS: { type: "r2", name: "dossier-proposal-generation-integration" },
        },
      },
      dev: {},
    }],
  });
  d1 = await miniflare.getD1Database("DB", "dossier-proposal-generation-integration") as unknown as D1Database;
  bucket = await miniflare.getR2Bucket(
    "DOSSIER_DOCUMENTS",
    "dossier-proposal-generation-integration",
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

test("real D1/private-R2 positive commit reuses one span and committed replay survives provider config/key rotation", async () => {
  const harness = await seedHarness("positive");
  const counters = { permissions: 0, providers: 0 };
  let clockTick = Date.now();
  const monotonicNow = () => new Date(clockTick++).toISOString();
  const currentDependencies = dependencies(harness, async () => ({
    candidates: [factCandidate(harness, "fact"), factCandidate(harness, "dated_event")],
    providerReceiptDigest: `sha256-${"d".repeat(64)}`,
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
  }), counters, monotonicNow);
  const first = await runGeneration(harness, currentDependencies, "positive-request-0001");
  assert.equal(first.result, "ready");
  assert.equal(first.outcome, "candidates_ready");
  assert.equal(first.dossierRevision, 3);
  assert.equal(first.proposalIds.length, 2);
  assert.equal(first.sourceAnchorIds.length, 1);
  assert.equal(first.analyzedSources.length, 1);
  assert.equal(counters.providers, 1);
  assert.equal(counters.permissions, 1);

  const stored = await d1.prepare(`
    SELECT
      (SELECT revision FROM dossiers WHERE id = ?) AS revision,
      (SELECT count(*) FROM dossier_ai_proposals WHERE dossier_id = ?) AS proposals,
      (SELECT count(*) FROM dossier_source_anchors WHERE dossier_id = ? AND creator = 'ai_proposal' AND review_state = 'pending') AS anchors,
      (SELECT count(*) FROM dossier_ai_proposal_job_sources WHERE dossier_id = ?) AS analyzed_sources,
      (SELECT count(*) FROM dossier_audit_events WHERE dossier_id = ? AND event_type = 'proposal_generation_completed') AS completions,
      (SELECT count(*) FROM dossier_revision_receipts WHERE dossier_id = ? AND resulting_revision = 3) AS receipt
  `).bind(...Array(6).fill(harness.dossierId)).first<Record<string, number>>();
  assert.deepEqual(stored, {
    revision: 3,
    proposals: 2,
    anchors: 1,
    analyzed_sources: 1,
    completions: 1,
    receipt: 1,
  });
  const materializationAuditBindings = await d1.prepare(`
    SELECT 'anchor' AS kind, anchor.id AS object_id,
      anchor.created_at, audit.occurred_at
    FROM dossier_source_anchors AS anchor
    JOIN dossier_audit_events AS audit
      ON audit.dossier_id = anchor.dossier_id
      AND audit.dossier_revision = 3
      AND audit.event_type = 'source_anchor_reviewed'
      AND audit.object_ref_type = 'source_anchor'
      AND audit.object_ref_id = anchor.id
      AND audit.actor_ref = anchor.created_by_actor_ref
    WHERE anchor.dossier_id = ? AND anchor.creator = 'ai_proposal'
    UNION ALL
    SELECT 'proposal' AS kind, proposal.id AS object_id,
      proposal.created_at, audit.occurred_at
    FROM dossier_ai_proposals AS proposal
    JOIN dossier_audit_events AS audit
      ON audit.dossier_id = proposal.dossier_id
      AND audit.dossier_revision = 3
      AND audit.event_type = 'proposal_reviewed'
      AND audit.object_ref_type = 'ai_proposal'
      AND audit.object_ref_id = proposal.id
      AND audit.actor_ref = proposal.created_by_actor_ref
    WHERE proposal.dossier_id = ?
    ORDER BY kind, object_id
  `).bind(harness.dossierId, harness.dossierId).all<{
    kind: string;
    object_id: string;
    created_at: string;
    occurred_at: string;
  }>();
  assert.equal(materializationAuditBindings.results.length, 3);
  for (const binding of materializationAuditBindings.results) {
    assert.equal(
      binding.created_at,
      binding.occurred_at,
      `${binding.kind} ${binding.object_id} must share the exact commit/audit timestamp`,
    );
  }

  const configurationIndependentReplay = await replayReadyDossierProposalGeneration({
    context: harness.context,
    dossierId: harness.dossierId,
    request: request(harness, "positive-request-0001"),
  });
  assert.equal(configurationIndependentReplay?.result, "ready");
  assert.equal(configurationIndependentReplay?.idempotent, true);
  assert.deepEqual(configurationIndependentReplay?.proposalIds, first.proposalIds);
  await assert.rejects(() => replayReadyDossierProposalGeneration({
    context: harness.context,
    dossierId: harness.dossierId,
    request: {
      ...request(harness, "positive-request-0001"),
      documentVersionIds: ["document_version_conflicting_0001"],
    },
  }), (error: unknown) => error instanceof Error
    && "code" in error
    && error.code === "idempotency_conflict");

  const noReadBucket = new Proxy(bucket, {
    get(target, property) {
      if (property === "get") return async () => { throw new Error("R2 must not be read on committed replay"); };
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const replay = await runGeneration(
    harness,
    currentDependencies,
    "same-request-different-client-key-0002",
    false,
    noReadBucket,
  );
  assert.equal(replay.result, "ready");
  assert.equal(replay.idempotent, true);
  assert.deepEqual(replay.proposalIds, first.proposalIds);
  assert.equal(counters.providers, 1);
  assert.equal(counters.permissions, 1);
});

test("migration 0014 rejects an orphan AI-created source anchor without its exact audit", async () => {
  const harness = await seedHarness("orphan-ai-anchor");
  const anchorId = opaque("source_anchor");
  await assert.rejects(
    d1.prepare(`INSERT INTO dossier_source_anchors (
      id, dossier_id, document_id, document_version_id, character_start,
      character_end, excerpt, anchor_checksum, creator, review_state,
      created_by_actor_ref, created_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'ai_proposal', 'pending', ?, ?)`)
      .bind(
        anchorId,
        harness.dossierId,
        harness.documentId,
        harness.documentVersionId,
        harness.text.length,
        harness.text,
        await digest("orphan-ai-anchor"),
        harness.context.actor.actorId,
        "2026-09-01T12:30:00.000Z",
      )
      .run(),
    /FOREIGN KEY constraint failed/u,
  );
  assert.equal(
    (await d1.prepare(`
      SELECT count(*) AS count FROM dossier_source_anchors
      WHERE dossier_id = ? AND id = ?
    `).bind(harness.dossierId, anchorId).first<{ count: number }>())?.count,
    0,
  );
});

test("real D1 zero-candidate completion is terminal ready at the unchanged revision with durable analyzed ranges", async () => {
  const harness = await seedHarness("zero");
  const counters = { permissions: 0, providers: 0 };
  const currentDependencies = dependencies(harness, async () => ({
    candidates: [],
    providerReceiptDigest: `sha256-${"e".repeat(64)}`,
    usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 },
  }), counters);
  const result = await runGeneration(harness, currentDependencies, "zero-request-0001");
  assert.equal(result.result, "ready");
  assert.equal(result.outcome, "no_candidates");
  assert.equal(result.dossierRevision, 2);
  assert.deepEqual(result.proposalIds, []);
  assert.deepEqual(result.sourceAnchorIds, []);
  assert.equal(result.analyzedSources[0]?.contextStart, 0);
  assert.equal(result.analyzedSources[0]?.contextEnd, harness.text.length);
  const job = await d1.prepare(`
    SELECT status, provider_receipt_digest FROM dossier_ai_proposal_jobs
    WHERE dossier_id = ?
  `).bind(harness.dossierId).first<{ status: string; provider_receipt_digest: string }>();
  assert.equal(job?.status, "ready");
  assert.equal(job?.provider_receipt_digest, `sha256-${"e".repeat(64)}`);
  assert.equal((await d1.prepare("SELECT revision FROM dossiers WHERE id = ?").bind(harness.dossierId).first<{ revision: number }>())?.revision, 2);
  assert.equal((await d1.prepare("SELECT count(*) AS count FROM dossier_revision_receipts WHERE dossier_id = ?").bind(harness.dossierId).first<{ count: number }>())?.count, 2);
  const completion = await d1.prepare(`
    SELECT summary_code, detail FROM dossier_audit_events
    WHERE dossier_id = ? AND event_type = 'proposal_generation_completed'
  `).bind(harness.dossierId).first<{ summary_code: string; detail: string }>();
  assert.equal(completion?.summary_code, "AI_PROPOSAL_GENERATION_NO_CANDIDATES");
  const detail = JSON.parse(completion?.detail ?? "null") as Record<string, unknown>;
  assert.equal(detail.result_code, "ready_no_candidates");
  assert.equal(detail.candidate_count, 0);
  assert.equal(detail.analyzed_character_count, harness.text.length);
});

test("provider failure records only a generic failed job and explicit retry uses a new bounded attempt", async () => {
  const harness = await seedHarness("retry");
  const counters = { permissions: 0, providers: 0 };
  let fail = true;
  const currentDependencies = dependencies(harness, async () => {
    if (fail) throw new DossierProposalAIError("provider_unavailable", "PROVIDER_SECRET_BODY_MUST_NOT_PERSIST");
    return {
      candidates: [],
      providerReceiptDigest: `sha256-${"f".repeat(64)}`,
      usage: null,
    };
  }, counters);
  const failed = await runGeneration(harness, currentDependencies, "retry-request-0001");
  assert.equal(failed.result, "failed");
  assert.equal(failed.errorCode, "provider_unavailable");
  const failedRow = await d1.prepare(`
    SELECT status, attempt, error_code, error_detail_code, provider_receipt_digest
    FROM dossier_ai_proposal_jobs WHERE dossier_id = ?
  `).bind(harness.dossierId).first<Record<string, unknown>>();
  assert.deepEqual(failedRow, {
    status: "failed",
    attempt: 1,
    error_code: "provider_unavailable",
    error_detail_code: "provider_secret_body_must_not_persist",
    provider_receipt_digest: null,
  });
  assert.equal((await d1.prepare("SELECT count(*) AS count FROM dossier_ai_proposals WHERE dossier_id = ?").bind(harness.dossierId).first<{ count: number }>())?.count, 0);

  fail = false;
  const retried = await runGeneration(harness, currentDependencies, "retry-request-0001", true);
  assert.equal(retried.result, "ready");
  assert.equal(retried.outcome, "no_candidates");
  const readyRow = await d1.prepare(`
    SELECT status, attempt, error_code, error_detail_code
    FROM dossier_ai_proposal_jobs WHERE dossier_id = ?
  `).bind(harness.dossierId).first<Record<string, unknown>>();
  assert.deepEqual(readyRow, {
    status: "ready",
    attempt: 2,
    error_code: null,
    error_detail_code: null,
  });
  assert.equal(counters.providers, 2);
});

test("real D1 retry recovery stops at the frozen five-attempt bound without a sixth provider call", async () => {
  const harness = await seedHarness("attempt-bound");
  const counters = { permissions: 0, providers: 0 };
  const currentDependencies = dependencies(harness, async () => {
    throw new DossierProposalAIError("timeout", "PROVIDER_TIMEOUT");
  }, counters);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await runGeneration(
      harness,
      currentDependencies,
      "attempt-bound-request-0001",
      attempt > 1,
    );
    assert.equal(result.result, "failed");
    assert.equal(result.attempt, attempt);
    assert.equal(result.retryable, attempt < 5);
  }
  const bounded = await runGeneration(
    harness,
    currentDependencies,
    "attempt-bound-request-0001",
    true,
  );
  assert.equal(bounded.result, "failed");
  assert.equal(bounded.attempt, 5);
  assert.equal(bounded.retryable, false);
  assert.equal(counters.providers, 5);
  assert.equal(counters.permissions, 5);
});

test("concurrent identical requests converge on one leased provider execution", async () => {
  const harness = await seedHarness("concurrent");
  const counters = { permissions: 0, providers: 0 };
  let releaseProvider: (() => void) | undefined;
  let announceProvider: (() => void) | undefined;
  const providerStarted = new Promise<void>((resolve) => { announceProvider = resolve; });
  const providerRelease = new Promise<void>((resolve) => { releaseProvider = resolve; });
  const currentDependencies = dependencies(harness, async () => {
    announceProvider?.();
    await providerRelease;
    return {
      candidates: [],
      providerReceiptDigest: `sha256-${"1".repeat(64)}`,
      usage: null,
    };
  }, counters);
  const firstPromise = runGeneration(harness, currentDependencies, "concurrent-request-0001");
  await providerStarted;
  const concurrent = await runGeneration(
    harness,
    currentDependencies,
    "concurrent-request-different-key-0002",
  );
  assert.equal(concurrent.result, "processing");
  assert.equal(concurrent.idempotent, true);
  assert.equal(counters.providers, 1);
  assert.equal(counters.permissions, 1);
  releaseProvider?.();
  const first = await firstPromise;
  assert.equal(first.result, "ready");
  assert.equal(first.outcome, "no_candidates");
  assert.equal(counters.providers, 1);
});
