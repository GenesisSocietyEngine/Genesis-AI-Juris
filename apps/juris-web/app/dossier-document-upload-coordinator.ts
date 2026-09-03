import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierDocumentCurrentVersions,
  dossierDocumentVersions,
  dossierDocuments,
  dossierExtractionJobs,
  dossierExtractionResults,
  dossierOutputStateEvents,
  dossierRevisionReceipts,
  dossierUploadIntents,
  dossiers,
} from "../db/schema";
import { DOSSIER_WIRE_ENUMS, canonicalDossierJson } from "./dossier-contract";
import {
  canonicalR2Sha256,
  prepareDossierUpload,
  sha256Bytes,
  type PreparedDossierUpload,
} from "./dossier-private-upload";
import {
  assertDossierObjectKeyScope,
  decideDossierUploadPolicy,
  dossierObjectKey,
} from "./dossier-security";
import { decideDossierUploadIntentTransition } from "./dossier-upload-intents";
import type {
  DossierAuditEventInput,
  DossierRevisionAuditBatch,
  DossierServerContext,
} from "./dossier-server";

const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1_000;
const MAX_CLEANUPS_PER_REQUEST = 5;
const MAX_EXTRACTION_RECOVERIES_PER_REQUEST = 3;

export type DossierDocumentUploadForm = {
  file: File;
  title: string;
  documentType: string;
  classification: (typeof DOSSIER_WIRE_ENUMS.classification)[number];
  expectedRevision: number;
  documentId: string | null;
  sourceNote: string | null;
  idempotencyKey: string | null;
  declaredMediaType: string;
};

type UploadForm = DossierDocumentUploadForm;

export type DossierUploadCoordinatorContext = Pick<DossierServerContext, "db" | "actor">;

export type DossierUploadCoordinatorDependencies = {
  requireUploadRole: (dossierId: string) => Promise<"owner" | "contributor">;
  prepareRevisionAuditBatch: (
    dossierId: string,
    resultingRevision: number,
    inputs: readonly DossierAuditEventInput[],
  ) => Promise<DossierRevisionAuditBatch>;
};

export type UploadIntentRecord = {
  id: string;
  dossierId: string;
  documentId: string;
  actorRef: string;
  requestBindingDigest: string;
  expectedDossierRevision: number;
  temporaryObjectReference: string;
  committedObjectReference: string | null;
  expectedMediaType: string;
  expectedByteLength: number;
  expectedContentSha256: string | null;
  measuredMediaType: string | null;
  measuredByteLength: number | null;
  measuredContentSha256: string | null;
  state: string;
  expiresAt: string;
};

export async function executeDossierDocumentUpload(input: {
  context: DossierUploadCoordinatorContext;
  dependencies: DossierUploadCoordinatorDependencies;
  bucket: R2Bucket;
  dossierId: string;
  dossierRevision: number;
  form: DossierDocumentUploadForm;
  prepared: PreparedDossierUpload;
}): Promise<Response> {
  const {
    context,
    dependencies,
    bucket,
    dossierId,
    dossierRevision,
    form,
    prepared,
  } = input;
  const { idempotencyKeyHash, requestBindingDigest } = await uploadIntentDigests(
    context,
    dossierId,
    form,
    prepared,
  );
  await cleanupExpiredUploadIntents(context, bucket, dossierId);
  await recoverDossierExtractionJobs(context, bucket, dossierId);
  let existingIntent = await uploadIntentByIdempotency(
    context,
    dossierId,
    idempotencyKeyHash,
  );
  if (existingIntent && existingIntent.state !== "pending" && existingIntent.state !== "committed") {
    await cleanupUploadIntent(context, bucket, existingIntent, form.documentId === null);
    existingIntent = await uploadIntentByIdempotency(context, dossierId, idempotencyKeyHash);
  }

  let intent: UploadIntentRecord;
  if (existingIntent) {
    try {
      await assertResumableIntent({
        context,
        dossierId,
        form,
        prepared,
        requestBindingDigest,
      }, existingIntent);
    } catch (error) {
      return dossierJson({
        error: error instanceof Error ? error.message : "The idempotency key is already bound.",
        code: "upload_intent_conflict",
      }, 409);
    }
    const committedReplay = await committedUpload(context, existingIntent);
    if (committedReplay) return uploadResponse(committedReplay, true);
    if (Date.now() >= Date.parse(existingIntent.expiresAt)) {
      await cleanupUploadIntent(context, bucket, existingIntent, form.documentId === null);
      return dossierJson({
        error: "The upload reservation expired before commit.",
        code: "upload_intent_expired",
      }, 409);
    }
    if (form.expectedRevision !== dossierRevision) {
      return dossierJson({
        error: "The Matter changed before this upload.",
        code: "revision_conflict",
        currentRevision: dossierRevision,
      }, 409);
    }
    intent = existingIntent;
  } else {
    if (form.expectedRevision !== dossierRevision) {
      return dossierJson({
        error: "The Matter changed before this upload.",
        code: "revision_conflict",
        currentRevision: dossierRevision,
      }, 409);
    }
    const usage = await dossierUploadUsage(context, dossierId, form.documentId);
    const policy = decideDossierUploadPolicy({
      mediaType: prepared.mediaType,
      byteLength: prepared.byteLength,
      newDocument: form.documentId === null,
      currentDocumentCount: usage.documentCount,
      currentDocumentVersionCount: usage.documentVersionCount,
      currentDossierVersionCount: usage.dossierVersionCount,
      currentStoredBytes: usage.storedBytes,
      currentPendingIntentCount: usage.pendingIntentCount,
    });
    if (!policy.allowed) {
      return dossierJson({
        error: "The document upload exceeds the Matter upload policy.",
        code: policy.reason.toLowerCase(),
      }, policy.reason.includes("TOO_LARGE") ? 413 : 409);
    }
    try {
      intent = await stageOrResumeUploadIntent({
        context,
        dossierId,
        form,
        prepared,
        idempotencyKeyHash,
        requestBindingDigest,
      });
    } catch (error) {
      return dossierJson({
        error: error instanceof Error ? error.message : "The upload intent could not be created.",
        code: "upload_intent_conflict",
      }, 409);
    }
  }

  const committedBeforeWrite = await committedUpload(context, intent);
  if (committedBeforeWrite) return uploadResponse(committedBeforeWrite, true);
  try {
    await putVerifiedPrivateObject(bucket, intent, prepared);
  } catch {
    await failAndCleanupUploadIntent(
      context,
      bucket,
      intent,
      form.documentId === null,
      "OBJECT_WRITE_FAILED",
    );
    return dossierJson({
      error: "Private document storage did not accept the upload.",
      code: "document_storage_unavailable",
    }, 503);
  }

  let committed: CommittedUpload | null;
  try {
    committed = await commitUploadIntent({
      context,
      dependencies,
      intent,
      form,
      prepared,
      newDocument: form.documentId === null,
    });
  } catch {
    committed = await committedUpload(context, intent);
    if (!committed) {
      await failAndCleanupUploadIntent(
        context,
        bucket,
        intent,
        form.documentId === null,
        "COMMIT_FAILED",
      );
      const [current] = await context.db.select({ revision: dossiers.revision })
        .from(dossiers).where(eq(dossiers.id, dossierId)).limit(1);
      return dossierJson({
        error: current?.revision === form.expectedRevision
          ? "The document upload could not be committed."
          : "The Matter changed before this upload.",
        code: current?.revision === form.expectedRevision ? "document_commit_failed" : "revision_conflict",
        currentRevision: current?.revision,
      }, current?.revision === form.expectedRevision ? 503 : 409);
    }
  }
  const extractionStatus = prepared.extraction.state === "ready_to_extract"
    ? await runDeterministicExtraction(context, bucket, intent.id, committed, prepared)
    : "not_extractable";
  return uploadResponse({ ...committed, extractionStatus }, false);
}

function documentDownloadUrl(dossierId: string, documentId: string, versionId: string) {
  return [
    "/api/dossiers/",
    encodeURIComponent(dossierId),
    "/documents/",
    encodeURIComponent(documentId),
    "/versions/",
    encodeURIComponent(versionId),
    "/download",
  ].join("");
}

function dossierJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function canonicalDossierTimestamp(date = new Date()): string {
  return date.toISOString();
}

function newDossierOpaqueId(prefix: string): string {
  if (!/^[a-z][a-z0-9_]{1,24}$/u.test(prefix)) throw new Error("Invalid dossier ID prefix.");
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function uploadIntentDigests(
  context: DossierUploadCoordinatorContext,
  dossierId: string,
  form: UploadForm,
  prepared: PreparedDossierUpload,
) {
  const requestBindingDigest = (await sha256Bytes(canonicalDossierJson({
    schema_version: 1,
    kind: "dossier_upload_request_binding",
    dossier_id: dossierId,
    actor_id: context.actor.actorId,
    expected_revision: form.expectedRevision,
    upload_kind: form.documentId === null ? "new_document" : "new_version",
    target_document_id: form.documentId,
    title: form.title,
    document_type: form.documentType,
    classification: form.classification,
    source_note: form.sourceNote,
    original_filename: prepared.originalFilename,
    media_type: prepared.mediaType,
    byte_length: prepared.byteLength,
    content_sha256: prepared.contentSha256,
  }))).contentSha256;
  const idempotencyKeyHash = form.idempotencyKey === null
    ? requestBindingDigest
    : (await sha256Bytes(canonicalDossierJson({
        schema_version: 1,
        mode: "client_key",
        dossier_id: dossierId,
        actor_id: context.actor.actorId,
        key: form.idempotencyKey,
      }))).contentSha256;
  return { idempotencyKeyHash, requestBindingDigest };
}

export async function dossierUploadUsage(
  context: DossierUploadCoordinatorContext,
  dossierId: string,
  documentId: string | null,
) {
  const [documentRows, versionRows, documentVersionRows, pendingRows] = await Promise.all([
    context.db.select({
      count: sql<number>`cast(count(*) as integer)`,
    }).from(dossierDocuments).where(and(
      eq(dossierDocuments.dossierId, dossierId),
      eq(dossierDocuments.isProvisional, false),
    )),
    context.db.select({
      count: sql<number>`cast(count(*) as integer)`,
      bytes: sql<number>`cast(coalesce(sum(${dossierDocumentVersions.byteLength}), 0) as integer)`,
    }).from(dossierDocumentVersions).where(eq(dossierDocumentVersions.dossierId, dossierId)),
    documentId === null
      ? Promise.resolve([{ count: 0 }])
      : context.db.select({
          count: sql<number>`cast(count(*) as integer)`,
        }).from(dossierDocumentVersions).where(and(
          eq(dossierDocumentVersions.dossierId, dossierId),
          eq(dossierDocumentVersions.documentId, documentId),
        )),
    context.db.select({
      count: sql<number>`cast(count(*) as integer)`,
    }).from(dossierUploadIntents).where(and(
      eq(dossierUploadIntents.dossierId, dossierId),
      eq(dossierUploadIntents.state, "pending"),
    )),
  ]);
  return {
    documentCount: Number(documentRows[0]?.count ?? 0),
    documentVersionCount: Number(documentVersionRows[0]?.count ?? 0),
    dossierVersionCount: Number(versionRows[0]?.count ?? 0),
    storedBytes: Number(versionRows[0]?.bytes ?? 0),
    pendingIntentCount: Number(pendingRows[0]?.count ?? 0),
  };
}

export async function stageOrResumeUploadIntent(input: {
  context: DossierUploadCoordinatorContext;
  dossierId: string;
  form: UploadForm;
  prepared: PreparedDossierUpload;
  idempotencyKeyHash: string;
  requestBindingDigest: string;
}): Promise<UploadIntentRecord> {
  const existing = await uploadIntentByIdempotency(
    input.context,
    input.dossierId,
    input.idempotencyKeyHash,
  );
  if (existing) {
    await assertResumableIntent(input, existing);
    return existing;
  }

  const now = canonicalDossierTimestamp();
  const intentId = newDossierOpaqueId("upload");
  const documentId = input.form.documentId ?? newDossierOpaqueId("document");
  const objectKey = dossierObjectKey(input.dossierId, intentId, randomHex(32));
  const expiresAt = new Date(Date.now() + UPLOAD_INTENT_TTL_MS).toISOString();
  const intent: UploadIntentRecord = {
    id: intentId,
    dossierId: input.dossierId,
    documentId,
    actorRef: input.context.actor.actorId,
    requestBindingDigest: input.requestBindingDigest,
    expectedDossierRevision: input.form.expectedRevision,
    temporaryObjectReference: objectKey,
    committedObjectReference: null,
    expectedMediaType: input.prepared.mediaType,
    expectedByteLength: input.prepared.byteLength,
    expectedContentSha256: input.prepared.contentSha256,
    measuredMediaType: null,
    measuredByteLength: null,
    measuredContentSha256: null,
    state: "pending",
    expiresAt,
  };
  const statements = [
    ...(input.form.documentId === null ? [input.context.db.insert(dossierDocuments).values({
      id: documentId,
      dossierId: input.dossierId,
      title: input.form.title,
      documentType: input.form.documentType,
      sourceOrigin: "internal_upload",
      isProvisional: true,
      classification: input.form.classification,
      status: "received",
      tags: [],
      externalSystemReference: null,
      createdByActorRef: input.context.actor.actorId,
      updatedByActorRef: input.context.actor.actorId,
      createdAt: now,
      updatedAt: now,
    })] : []),
    input.context.db.insert(dossierUploadIntents).values({
      id: intent.id,
      dossierId: intent.dossierId,
      documentId: intent.documentId,
      actorUserId: input.context.actor.userId,
      actorRef: intent.actorRef,
      idempotencyKeyHash: input.idempotencyKeyHash,
      requestBindingDigest: intent.requestBindingDigest,
      expectedDossierRevision: intent.expectedDossierRevision,
      temporaryObjectReference: intent.temporaryObjectReference,
      committedObjectReference: null,
      expectedMediaType: intent.expectedMediaType,
      expectedByteLength: intent.expectedByteLength,
      expectedContentSha256: intent.expectedContentSha256,
      state: "pending",
      failureCode: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }),
  ];
  try {
    await input.context.db.batch([statements[0]!, ...statements.slice(1)]);
    return intent;
  } catch {
    const raced = await uploadIntentByIdempotency(
      input.context,
      input.dossierId,
      input.idempotencyKeyHash,
    );
    if (!raced) throw new Error("The upload intent could not be staged.");
    await assertResumableIntent(input, raced);
    return raced;
  }
}

export async function uploadIntentByIdempotency(
  context: DossierUploadCoordinatorContext,
  dossierId: string,
  idempotencyKeyHash: string,
): Promise<UploadIntentRecord | null> {
  const [intent] = await context.db.select({
    id: dossierUploadIntents.id,
    dossierId: dossierUploadIntents.dossierId,
    documentId: dossierUploadIntents.documentId,
    actorRef: dossierUploadIntents.actorRef,
    requestBindingDigest: dossierUploadIntents.requestBindingDigest,
    expectedDossierRevision: dossierUploadIntents.expectedDossierRevision,
    temporaryObjectReference: dossierUploadIntents.temporaryObjectReference,
    committedObjectReference: dossierUploadIntents.committedObjectReference,
    expectedMediaType: dossierUploadIntents.expectedMediaType,
    expectedByteLength: dossierUploadIntents.expectedByteLength,
    expectedContentSha256: dossierUploadIntents.expectedContentSha256,
    measuredMediaType: dossierUploadIntents.measuredMediaType,
    measuredByteLength: dossierUploadIntents.measuredByteLength,
    measuredContentSha256: dossierUploadIntents.measuredContentSha256,
    state: dossierUploadIntents.state,
    expiresAt: dossierUploadIntents.expiresAt,
  }).from(dossierUploadIntents).where(and(
    eq(dossierUploadIntents.dossierId, dossierId),
    eq(dossierUploadIntents.actorRef, context.actor.actorId),
    eq(dossierUploadIntents.idempotencyKeyHash, idempotencyKeyHash),
  )).limit(1);
  return intent ?? null;
}

export async function assertResumableIntent(
  input: {
    context: DossierUploadCoordinatorContext;
    dossierId: string;
    form: UploadForm;
    prepared: PreparedDossierUpload;
    requestBindingDigest: string;
  },
  intent: UploadIntentRecord,
) {
  if (
    intent.actorRef !== input.context.actor.actorId
    || intent.requestBindingDigest !== input.requestBindingDigest
    || intent.expectedDossierRevision !== input.form.expectedRevision
    || intent.expectedMediaType !== input.prepared.mediaType
    || intent.expectedByteLength !== input.prepared.byteLength
    || intent.expectedContentSha256 !== input.prepared.contentSha256
    || (input.form.documentId !== null && intent.documentId !== input.form.documentId)
    || (intent.state !== "pending" && intent.state !== "committed")
  ) {
    throw new Error("The idempotency key is already bound to another upload.");
  }
  assertDossierObjectKeyScope(intent.temporaryObjectReference, input.dossierId, intent.id);
  const [document] = await input.context.db.select({
    title: dossierDocuments.title,
    documentType: dossierDocuments.documentType,
    classification: dossierDocuments.classification,
    isProvisional: dossierDocuments.isProvisional,
  }).from(dossierDocuments).where(and(
    eq(dossierDocuments.dossierId, input.dossierId),
    eq(dossierDocuments.id, intent.documentId),
  )).limit(1);
  if (
    !document
    || document.title !== input.form.title
    || document.documentType !== input.form.documentType
    || document.classification !== input.form.classification
    || (input.form.documentId === null && intent.state === "pending" && !document.isProvisional)
  ) {
    throw new Error("The idempotent upload metadata no longer matches.");
  }
}

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function putVerifiedPrivateObject(
  bucket: R2Bucket,
  intent: UploadIntentRecord,
  prepared: PreparedDossierUpload,
) {
  assertDossierObjectKeyScope(
    intent.temporaryObjectReference,
    intent.dossierId,
    intent.id,
  );
  const stored = await bucket.put(intent.temporaryObjectReference, prepared.bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: prepared.mediaType },
    customMetadata: { contentSha256: prepared.contentSha256 },
    sha256: prepared.checksum,
  });
  const object = stored ?? await bucket.head(intent.temporaryObjectReference);
  if (
    !object
    || object.size !== prepared.byteLength
    || object.httpMetadata?.contentType !== prepared.mediaType
    || object.customMetadata?.contentSha256 !== prepared.contentSha256
    || canonicalR2Sha256(object.checksums.sha256) !== prepared.contentSha256
  ) {
    throw new Error("Private storage verification failed.");
  }
}

export type CommittedUpload = {
  dossierId: string;
  documentId: string;
  documentVersionId: string;
  ordinal: number;
  originalFilename: string;
  mediaType: string;
  byteLength: number;
  contentSha256: string;
  uploadedAt: string;
  predecessorVersionId: string | null;
  sourceNote: string | null;
  extractionJobId: string;
  extractionStatus: string;
  dossierRevision: number;
};

export async function committedUpload(
  context: DossierUploadCoordinatorContext,
  intent: UploadIntentRecord,
): Promise<CommittedUpload | null> {
  const [row] = await context.db.select({
    dossierId: dossierDocumentVersions.dossierId,
    documentId: dossierDocumentVersions.documentId,
    documentVersionId: dossierDocumentVersions.id,
    ordinal: dossierDocumentVersions.ordinal,
    originalFilename: dossierDocumentVersions.originalFilename,
    mediaType: dossierDocumentVersions.mediaType,
    byteLength: dossierDocumentVersions.byteLength,
    contentSha256: dossierDocumentVersions.contentSha256,
    uploadedAt: dossierDocumentVersions.uploadedAt,
    predecessorVersionId: dossierDocumentVersions.predecessorVersionId,
    sourceNote: dossierDocumentVersions.sourceNote,
    extractionJobId: dossierExtractionJobs.id,
    extractionStatus: dossierExtractionJobs.status,
    dossierRevision: dossiers.revision,
  }).from(dossierDocumentVersions)
    .innerJoin(dossierUploadIntents, and(
      eq(dossierUploadIntents.dossierId, dossierDocumentVersions.dossierId),
      eq(dossierUploadIntents.id, dossierDocumentVersions.uploadIntentId),
      eq(dossierUploadIntents.state, "committed"),
    ))
    .innerJoin(dossierExtractionJobs, and(
      eq(dossierExtractionJobs.dossierId, dossierDocumentVersions.dossierId),
      eq(dossierExtractionJobs.documentVersionId, dossierDocumentVersions.id),
      eq(dossierExtractionJobs.attempt, 1),
    ))
    .innerJoin(dossiers, eq(dossiers.id, dossierDocumentVersions.dossierId))
    .where(and(
      eq(dossierDocumentVersions.dossierId, intent.dossierId),
      eq(dossierDocumentVersions.uploadIntentId, intent.id),
      eq(dossierDocumentVersions.documentId, intent.documentId),
    )).limit(1);
  if (!row) return null;
  if (
    row.mediaType !== intent.expectedMediaType
    || row.byteLength !== intent.expectedByteLength
    || row.contentSha256 !== intent.expectedContentSha256
  ) {
    throw new Error("Committed upload metadata does not match its intent.");
  }
  return row;
}

export async function commitUploadIntent(input: {
  context: DossierUploadCoordinatorContext;
  intent: UploadIntentRecord;
  form: UploadForm;
  prepared: PreparedDossierUpload;
  newDocument: boolean;
  dependencies: DossierUploadCoordinatorDependencies;
}): Promise<CommittedUpload> {
  if (input.intent.state !== "pending") {
    const committed = await committedUpload(input.context, input.intent);
    if (committed) return committed;
    throw new Error("The upload intent is not pending.");
  }
  const [liveDossier] = await input.context.db.select({
    revision: dossiers.revision,
  }).from(dossiers).where(eq(dossiers.id, input.intent.dossierId)).limit(1);
  if (!liveDossier || liveDossier.revision !== input.form.expectedRevision) {
    throw new Error("The Matter revision changed.");
  }
  const [current] = await input.context.db.select({
    documentVersionId: dossierDocumentCurrentVersions.documentVersionId,
    ordinal: dossierDocumentVersions.ordinal,
  }).from(dossierDocumentCurrentVersions).innerJoin(dossierDocumentVersions, and(
    eq(dossierDocumentVersions.dossierId, dossierDocumentCurrentVersions.dossierId),
    eq(dossierDocumentVersions.documentId, dossierDocumentCurrentVersions.documentId),
    eq(dossierDocumentVersions.id, dossierDocumentCurrentVersions.documentVersionId),
  )).where(and(
    eq(dossierDocumentCurrentVersions.dossierId, input.intent.dossierId),
    eq(dossierDocumentCurrentVersions.documentId, input.intent.documentId),
  )).limit(1);
  if ((input.newDocument && current) || (!input.newDocument && !current)) {
    throw new Error("The document current-version pointer changed.");
  }

  const now = canonicalDossierTimestamp();
  const nextRevision = input.form.expectedRevision + 1;
  const documentVersionId = newDossierOpaqueId("document_version");
  const extractionJobId = newDossierOpaqueId("extraction_job");
  const ordinal = (current?.ordinal ?? 0) + 1;
  const predecessorVersionId = current?.documentVersionId ?? null;
  const [referenced] = await input.context.db.select({
    id: dossierDocumentVersions.id,
  }).from(dossierDocumentVersions).where(or(
    eq(dossierDocumentVersions.uploadIntentId, input.intent.id),
    eq(dossierDocumentVersions.binaryObjectReference, input.intent.temporaryObjectReference),
  )).limit(1);
  const commitDecision = decideDossierUploadIntentTransition({
    operation: "commit",
    intent: {
      uploadIntentId: input.intent.id,
      dossierId: input.intent.dossierId,
      actorId: input.intent.actorRef,
      objectKey: input.intent.temporaryObjectReference,
      state: input.intent.state,
      expectedDossierRevision: input.intent.expectedDossierRevision,
      expiresAtEpochMs: Date.parse(input.intent.expiresAt),
      committedBinding: null,
    },
    requestDossierId: input.intent.dossierId,
    requestActorId: input.context.actor.actorId,
    nowEpochMs: Date.now(),
    currentDossierRevision: liveDossier.revision,
    objectReferenced: Boolean(referenced),
    commitBinding: {
      documentId: input.intent.documentId,
      documentVersionId,
      objectKey: input.intent.temporaryObjectReference,
      mediaType: input.prepared.mediaType,
      byteLength: input.prepared.byteLength,
      contentSha256: input.prepared.contentSha256,
    },
  });
  if (!commitDecision.allowed || commitDecision.result !== "transition") {
    throw new Error("The upload intent cannot be committed.");
  }
  const staleOutputs = await currentOutputStates(input.context, input.intent.dossierId);
  const role = await input.dependencies.requireUploadRole(input.intent.dossierId);
  const { revisionReceipt, auditEvents } = await input.dependencies.prepareRevisionAuditBatch(
    input.intent.dossierId,
    nextRevision,
    [
      ...(input.newDocument ? [{
        actorRole: role,
        eventType: "document_created" as const,
        objectRefType: "document" as const,
        objectRefId: input.intent.documentId,
        summaryCode: "DOCUMENT_CREATED",
        detail: {
          source_origin: "internal_upload",
          initial_version_id: documentVersionId,
          revision_before: input.form.expectedRevision,
          revision_after: nextRevision,
        },
        occurredAt: now,
      }] : []),
      {
        actorRole: role,
        eventType: "document_version_created",
        objectRefType: "document_version",
        objectRefId: documentVersionId,
        summaryCode: "DOCUMENT_VERSION_CREATED",
        detail: {
          document_id: input.intent.documentId,
          ordinal,
          new_document: input.newDocument,
          media_type: input.prepared.mediaType,
          byte_length: input.prepared.byteLength,
          content_sha256: input.prepared.contentSha256,
          revision_before: input.form.expectedRevision,
          revision_after: nextRevision,
        },
        occurredAt: now,
      },
      ...staleOutputs.map((output) => ({
        actorRole: role,
        eventType: "output_marked_stale" as const,
        objectRefType: "governed_output" as const,
        objectRefId: output.outputId,
        summaryCode: "OUTPUT_MARKED_STALE",
        detail: {
          reason_code: "DOCUMENT_VERSION_CHANGED",
          document_id: input.intent.documentId,
          dossier_revision: nextRevision,
        },
        occurredAt: now,
      })),
    ],
  );
  const statements = [
    input.context.db.update(dossierUploadIntents).set({
      committedObjectReference: input.intent.temporaryObjectReference,
      measuredMediaType: input.prepared.mediaType,
      measuredByteLength: input.prepared.byteLength,
      measuredContentSha256: input.prepared.contentSha256,
      updatedAt: now,
    }).where(and(
      eq(dossierUploadIntents.dossierId, input.intent.dossierId),
      eq(dossierUploadIntents.id, input.intent.id),
      eq(dossierUploadIntents.state, "pending"),
      eq(dossierUploadIntents.expectedDossierRevision, input.form.expectedRevision),
    )),
    input.context.db.insert(dossierDocumentVersions).values({
      id: documentVersionId,
      dossierId: input.intent.dossierId,
      documentId: input.intent.documentId,
      ordinal,
      binaryObjectReference: input.intent.temporaryObjectReference,
      originalFilename: input.prepared.originalFilename,
      mediaType: input.prepared.mediaType,
      byteLength: input.prepared.byteLength,
      contentSha256: input.prepared.contentSha256,
      uploaderUserId: input.context.actor.userId,
      uploaderActorRef: input.context.actor.actorId,
      uploadIntentId: input.intent.id,
      uploadedAt: now,
      predecessorVersionId,
      sourceNote: input.form.sourceNote,
      createdByActorRef: input.context.actor.actorId,
      createdAt: now,
    }),
    ...(input.newDocument
      ? [input.context.db.insert(dossierDocumentCurrentVersions).values({
          dossierId: input.intent.dossierId,
          documentId: input.intent.documentId,
          documentVersionId,
          updatedAt: now,
          updatedByActorRef: input.context.actor.actorId,
        })]
      : [input.context.db.update(dossierDocumentCurrentVersions).set({
          documentVersionId,
          updatedAt: now,
          updatedByActorRef: input.context.actor.actorId,
        }).where(and(
          eq(dossierDocumentCurrentVersions.dossierId, input.intent.dossierId),
          eq(dossierDocumentCurrentVersions.documentId, input.intent.documentId),
          eq(dossierDocumentCurrentVersions.documentVersionId, predecessorVersionId!),
        ))]),
    ...(input.newDocument ? [input.context.db.update(dossierDocuments).set({
      isProvisional: false,
      updatedAt: now,
      updatedByActorRef: input.context.actor.actorId,
    }).where(and(
      eq(dossierDocuments.dossierId, input.intent.dossierId),
      eq(dossierDocuments.id, input.intent.documentId),
      eq(dossierDocuments.isProvisional, true),
    ))] : []),
    input.context.db.insert(dossierExtractionJobs).values({
      id: extractionJobId,
      dossierId: input.intent.dossierId,
      documentId: input.intent.documentId,
      documentVersionId,
      status: input.prepared.extraction.state === "not_extractable" ? "not_extractable" : "queued",
      extractorVersion: input.prepared.extraction.extractorVersion,
      attempt: 1,
      errorCode: input.prepared.extraction.state === "not_extractable"
        ? input.prepared.extraction.errorCode
        : null,
      errorDetailCode: input.prepared.extraction.state === "not_extractable"
        ? input.prepared.extraction.errorDetailCode
        : null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }),
    input.context.db.update(dossiers).set({
      revision: nextRevision,
      updatedAt: now,
      updatedByActorRef: input.context.actor.actorId,
    }).where(and(
      eq(dossiers.id, input.intent.dossierId),
      eq(dossiers.revision, input.form.expectedRevision),
    )),
    ...staleOutputs.map((output) => input.context.db.insert(dossierOutputStateEvents).values({
      id: newDossierOpaqueId("output_state"),
      dossierId: input.intent.dossierId,
      outputId: output.outputId,
      sequence: output.sequence + 1,
      state: "stale",
      reason: "DOCUMENT_VERSION_CHANGED",
      occurredAt: now,
      actorRef: input.context.actor.actorId,
    })),
    ...auditEvents.map((event) => input.context.db.insert(dossierAuditEvents).values(event)),
    input.context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    input.context.db.update(dossierUploadIntents).set({
      state: "committed",
      updatedAt: now,
      committedAt: now,
    }).where(and(
      eq(dossierUploadIntents.dossierId, input.intent.dossierId),
      eq(dossierUploadIntents.id, input.intent.id),
      eq(dossierUploadIntents.state, "pending"),
      eq(dossierUploadIntents.expectedDossierRevision, input.form.expectedRevision),
    )),
  ];
  await input.context.db.batch([statements[0]!, ...statements.slice(1)]);
  const committed = await committedUpload(input.context, {
    ...input.intent,
    state: "committed",
    committedObjectReference: input.intent.temporaryObjectReference,
    measuredMediaType: input.prepared.mediaType,
    measuredByteLength: input.prepared.byteLength,
    measuredContentSha256: input.prepared.contentSha256,
  });
  if (!committed) throw new Error("Committed upload receipt is missing.");
  return committed;
}

async function currentOutputStates(context: DossierUploadCoordinatorContext, dossierId: string) {
  const states = await context.db.select({
    outputId: dossierOutputStateEvents.outputId,
    sequence: dossierOutputStateEvents.sequence,
    state: dossierOutputStateEvents.state,
  }).from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, dossierId))
    .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence));
  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  return [...latest.values()].filter(({ state }) => state === "current");
}

export function uploadResponse(upload: CommittedUpload, idempotent: boolean) {
  return dossierJson({
    document_id: upload.documentId,
    dossier_revision: upload.dossierRevision,
    idempotent,
    version: {
      schema_version: 1,
      document_version_id: upload.documentVersionId,
      document_id: upload.documentId,
      ordinal: upload.ordinal,
      original_filename: upload.originalFilename,
      media_type: upload.mediaType,
      byte_length: upload.byteLength,
      content_sha256: upload.contentSha256,
      uploaded_at: upload.uploadedAt,
      predecessor_version_id: upload.predecessorVersionId,
      source_note: upload.sourceNote,
      extraction_status: upload.extractionStatus,
      download_url: documentDownloadUrl(
        upload.dossierId,
        upload.documentId,
        upload.documentVersionId,
      ),
    },
  }, idempotent ? 200 : 201);
}

export async function cleanupExpiredUploadIntents(
  context: DossierUploadCoordinatorContext,
  bucket: R2Bucket,
  dossierId: string,
) {
  const now = canonicalDossierTimestamp();
  const candidates = await context.db.select({
    id: dossierUploadIntents.id,
    dossierId: dossierUploadIntents.dossierId,
    documentId: dossierUploadIntents.documentId,
    actorRef: dossierUploadIntents.actorRef,
    requestBindingDigest: dossierUploadIntents.requestBindingDigest,
    expectedDossierRevision: dossierUploadIntents.expectedDossierRevision,
    temporaryObjectReference: dossierUploadIntents.temporaryObjectReference,
    committedObjectReference: dossierUploadIntents.committedObjectReference,
    expectedMediaType: dossierUploadIntents.expectedMediaType,
    expectedByteLength: dossierUploadIntents.expectedByteLength,
    expectedContentSha256: dossierUploadIntents.expectedContentSha256,
    measuredMediaType: dossierUploadIntents.measuredMediaType,
    measuredByteLength: dossierUploadIntents.measuredByteLength,
    measuredContentSha256: dossierUploadIntents.measuredContentSha256,
    state: dossierUploadIntents.state,
    expiresAt: dossierUploadIntents.expiresAt,
  }).from(dossierUploadIntents).where(and(
    eq(dossierUploadIntents.dossierId, dossierId),
    or(
      and(
        inArray(dossierUploadIntents.state, ["pending", "expired"]),
        lt(dossierUploadIntents.expiresAt, now),
      ),
      eq(dossierUploadIntents.state, "deleting"),
      eq(dossierUploadIntents.state, "deleted"),
    ),
  )).orderBy(asc(dossierUploadIntents.expiresAt), asc(dossierUploadIntents.id))
    .limit(MAX_CLEANUPS_PER_REQUEST);
  for (const candidate of candidates) {
    try {
      await cleanupUploadIntent(context, bucket, candidate);
    } catch {
      // Cleanup remains in a retryable D1 state. Upload availability must not
      // depend on one stale object's R2 deletion succeeding in this request.
    }
  }
}

export async function failAndCleanupUploadIntent(
  context: DossierUploadCoordinatorContext,
  bucket: R2Bucket,
  intent: UploadIntentRecord,
  provisionalDocument: boolean,
  failureCode: string,
) {
  try {
    const decision = decideDossierUploadIntentTransition({
      operation: "abort",
      intent: {
        uploadIntentId: intent.id,
        dossierId: intent.dossierId,
        actorId: intent.actorRef,
        objectKey: intent.temporaryObjectReference,
        state: intent.state,
        expectedDossierRevision: intent.expectedDossierRevision,
        expiresAtEpochMs: Date.parse(intent.expiresAt),
        committedBinding: null,
      },
      requestDossierId: intent.dossierId,
      requestActorId: context.actor.actorId,
      nowEpochMs: Date.now(),
      currentDossierRevision: intent.expectedDossierRevision,
      objectReferenced: false,
      failureCode,
    });
    if (!decision.allowed || decision.result !== "transition" || decision.operation !== "abort") return;
    await context.db.update(dossierUploadIntents).set({
      state: "deleting",
      failureCode: decision.failureCode,
      updatedAt: canonicalDossierTimestamp(),
    }).where(and(
      eq(dossierUploadIntents.dossierId, intent.dossierId),
      eq(dossierUploadIntents.id, intent.id),
      eq(dossierUploadIntents.state, decision.expectedState),
    ));
    await cleanupUploadIntent(context, bucket, intent, provisionalDocument);
  } catch {
    // The intent remains in a tracked retry-safe state if this request cannot
    // finish an already-claimed D1/R2 cleanup cycle.
  }
}

export async function cleanupUploadIntent(
  context: DossierUploadCoordinatorContext,
  bucket: R2Bucket,
  candidate: UploadIntentRecord,
  knownProvisional?: boolean,
) {
  const [live] = await context.db.select({
    id: dossierUploadIntents.id,
    dossierId: dossierUploadIntents.dossierId,
    documentId: dossierUploadIntents.documentId,
    actorRef: dossierUploadIntents.actorRef,
    requestBindingDigest: dossierUploadIntents.requestBindingDigest,
    expectedDossierRevision: dossierUploadIntents.expectedDossierRevision,
    temporaryObjectReference: dossierUploadIntents.temporaryObjectReference,
    committedObjectReference: dossierUploadIntents.committedObjectReference,
    expectedMediaType: dossierUploadIntents.expectedMediaType,
    expectedByteLength: dossierUploadIntents.expectedByteLength,
    expectedContentSha256: dossierUploadIntents.expectedContentSha256,
    measuredMediaType: dossierUploadIntents.measuredMediaType,
    measuredByteLength: dossierUploadIntents.measuredByteLength,
    measuredContentSha256: dossierUploadIntents.measuredContentSha256,
    state: dossierUploadIntents.state,
    expiresAt: dossierUploadIntents.expiresAt,
  }).from(dossierUploadIntents).where(and(
    eq(dossierUploadIntents.dossierId, candidate.dossierId),
    eq(dossierUploadIntents.id, candidate.id),
  )).limit(1);
  if (!live || live.state === "committed") return;
  if (live.state === "deleted") {
    await finalizeDeletedUploadIntentMetadata(context, live, knownProvisional);
    return;
  }
  const [reference] = await context.db.select({ id: dossierDocumentVersions.id })
    .from(dossierDocumentVersions).where(or(
      eq(dossierDocumentVersions.uploadIntentId, live.id),
      eq(dossierDocumentVersions.binaryObjectReference, live.temporaryObjectReference),
    )).limit(1);
  if (reference) return;

  if (live.state !== "deleting") {
    const decision = decideDossierUploadIntentTransition({
      operation: "claim_cleanup",
      intent: {
        uploadIntentId: live.id,
        dossierId: live.dossierId,
        actorId: live.actorRef,
        objectKey: live.temporaryObjectReference,
        state: live.state,
        expectedDossierRevision: live.expectedDossierRevision,
        expiresAtEpochMs: Date.parse(live.expiresAt),
        committedBinding: null,
      },
      requestDossierId: live.dossierId,
      nowEpochMs: Date.now(),
      currentDossierRevision: live.expectedDossierRevision,
      objectReferenced: false,
    });
    if (!decision.allowed || decision.result !== "transition") return;
    await context.db.update(dossierUploadIntents).set({
      state: "deleting",
      updatedAt: canonicalDossierTimestamp(),
    }).where(and(
      eq(dossierUploadIntents.dossierId, live.dossierId),
      eq(dossierUploadIntents.id, live.id),
      eq(dossierUploadIntents.state, decision.expectedState),
    ));
  }
  const [claimed] = await context.db.select({
    state: dossierUploadIntents.state,
    temporaryObjectReference: dossierUploadIntents.temporaryObjectReference,
    committedObjectReference: dossierUploadIntents.committedObjectReference,
  }).from(dossierUploadIntents).where(and(
    eq(dossierUploadIntents.dossierId, live.dossierId),
    eq(dossierUploadIntents.id, live.id),
  )).limit(1);
  if (!claimed || claimed.state !== "deleting") return;

  const objectKeys = [...new Set([
    claimed.temporaryObjectReference,
    claimed.committedObjectReference,
  ].filter((key): key is string => Boolean(key)))];
  for (const objectKey of objectKeys) {
    assertDossierObjectKeyScope(objectKey, live.dossierId, live.id);
    await bucket.delete(objectKey);
  }
  const finishDecision = decideDossierUploadIntentTransition({
    operation: "finish_cleanup",
    intent: {
      uploadIntentId: live.id,
      dossierId: live.dossierId,
      actorId: live.actorRef,
      objectKey: live.temporaryObjectReference,
      state: "deleting",
      expectedDossierRevision: live.expectedDossierRevision,
      expiresAtEpochMs: Date.parse(live.expiresAt),
      committedBinding: null,
    },
    requestDossierId: live.dossierId,
    nowEpochMs: Date.now(),
    currentDossierRevision: live.expectedDossierRevision,
    objectReferenced: false,
    objectDeleteConfirmed: true,
  });
  if (!finishDecision.allowed || finishDecision.result !== "transition") return;
  await context.db.update(dossierUploadIntents).set({
    state: "deleted",
    updatedAt: canonicalDossierTimestamp(),
  }).where(and(
    eq(dossierUploadIntents.dossierId, live.dossierId),
    eq(dossierUploadIntents.id, live.id),
    eq(dossierUploadIntents.state, "deleting"),
  ));
  await finalizeDeletedUploadIntentMetadata(context, live, knownProvisional);
}

export async function finalizeDeletedUploadIntentMetadata(
  context: DossierUploadCoordinatorContext,
  intent: UploadIntentRecord,
  knownProvisional?: boolean,
) {
  const provisional = knownProvisional ?? Boolean((await context.db.select({
    isProvisional: dossierDocuments.isProvisional,
  }).from(dossierDocuments).where(and(
    eq(dossierDocuments.dossierId, intent.dossierId),
    eq(dossierDocuments.id, intent.documentId),
  )).limit(1))[0]?.isProvisional);
  if (provisional) {
    await context.db.delete(dossierDocuments).where(and(
      eq(dossierDocuments.dossierId, intent.dossierId),
      eq(dossierDocuments.id, intent.documentId),
      eq(dossierDocuments.isProvisional, true),
    ));
  }
  await context.db.delete(dossierUploadIntents).where(and(
    eq(dossierUploadIntents.dossierId, intent.dossierId),
    eq(dossierUploadIntents.id, intent.id),
    eq(dossierUploadIntents.state, "deleted"),
  ));
}

export async function runDeterministicExtraction(
  context: DossierUploadCoordinatorContext,
  bucket: R2Bucket,
  uploadIntentId: string,
  committed: CommittedUpload,
  prepared: PreparedDossierUpload,
): Promise<string> {
  if (prepared.extraction.state !== "ready_to_extract") return "not_extractable";
  const leaseOwner = newDossierOpaqueId("extractor");
  const now = canonicalDossierTimestamp();
  const leaseExpiresAt = new Date(Date.now() + 2 * 60 * 1_000).toISOString();
  await context.db.update(dossierExtractionJobs).set({
    status: "processing",
    leaseOwner,
    leaseExpiresAt,
    startedAt: now,
    updatedAt: now,
  }).where(and(
    eq(dossierExtractionJobs.dossierId, committed.dossierId),
    eq(dossierExtractionJobs.id, committed.extractionJobId),
    or(
      eq(dossierExtractionJobs.status, "queued"),
      and(
        eq(dossierExtractionJobs.status, "processing"),
        lt(dossierExtractionJobs.leaseExpiresAt, now),
      ),
    ),
  ));
  const [lease] = await context.db.select({
    status: dossierExtractionJobs.status,
    leaseOwner: dossierExtractionJobs.leaseOwner,
  }).from(dossierExtractionJobs).where(and(
    eq(dossierExtractionJobs.dossierId, committed.dossierId),
    eq(dossierExtractionJobs.id, committed.extractionJobId),
  )).limit(1);
  if (!lease || lease.leaseOwner !== leaseOwner || lease.status !== "processing") {
    return lease?.status ?? "failed";
  }

  const extractedBytes = new TextEncoder().encode(prepared.extraction.result.text);
  const extractedDigest = await sha256Bytes(extractedBytes);
  const nonceDigest = await sha256Bytes(canonicalDossierJson({
    schema_version: 1,
    kind: "derived_text",
    source_sha256: prepared.contentSha256,
    extractor_version: prepared.extraction.extractorVersion,
  }));
  const derivedObjectKey = dossierObjectKey(
    committed.dossierId,
    uploadIntentId,
    nonceDigest.contentSha256.slice("sha256-".length),
  );
  let storedDerived = false;
  try {
    const stored = await bucket.put(derivedObjectKey, extractedBytes, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
      customMetadata: { contentSha256: extractedDigest.contentSha256 },
      sha256: extractedDigest.checksum,
    });
    const object = stored ?? await bucket.head(derivedObjectKey);
    if (
      !object
      || object.size !== extractedBytes.byteLength
      || object.httpMetadata?.contentType !== "text/plain; charset=utf-8"
      || object.customMetadata?.contentSha256 !== extractedDigest.contentSha256
      || canonicalR2Sha256(object.checksums.sha256) !== extractedDigest.contentSha256
    ) {
      throw new Error("Derived text storage verification failed.");
    }
    storedDerived = true;
    const completedAt = canonicalDossierTimestamp();
    const resultId = newDossierOpaqueId("extraction_result");
    const ready = context.db.update(dossierExtractionJobs).set({
      status: "ready",
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: null,
      errorDetailCode: null,
      completedAt,
      updatedAt: completedAt,
    }).where(and(
      eq(dossierExtractionJobs.dossierId, committed.dossierId),
      eq(dossierExtractionJobs.id, committed.extractionJobId),
      eq(dossierExtractionJobs.status, "processing"),
      eq(dossierExtractionJobs.leaseOwner, leaseOwner),
    ));
    const result = context.db.insert(dossierExtractionResults).values({
      id: resultId,
      dossierId: committed.dossierId,
      documentId: committed.documentId,
      documentVersionId: committed.documentVersionId,
      extractionJobId: committed.extractionJobId,
      extractorVersion: prepared.extraction.extractorVersion,
      extractedTextObjectReference: derivedObjectKey,
      extractedTextSha256: extractedDigest.contentSha256,
      extractedTextByteLength: extractedBytes.byteLength,
      characterCount: prepared.extraction.result.characterCount,
      createdAt: completedAt,
    });
    await context.db.batch([ready, result]);
    return "ready";
  } catch {
    const [result] = await context.db.select({ id: dossierExtractionResults.id })
      .from(dossierExtractionResults).where(and(
        eq(dossierExtractionResults.dossierId, committed.dossierId),
        eq(dossierExtractionResults.extractionJobId, committed.extractionJobId),
      )).limit(1);
    if (result) return "ready";
    if (storedDerived) {
      try {
        await bucket.delete(derivedObjectKey);
      } catch {
        return "processing";
      }
    }
    const failedAt = canonicalDossierTimestamp();
    await context.db.update(dossierExtractionJobs).set({
      status: "failed",
      leaseOwner: null,
      leaseExpiresAt: null,
      errorCode: "internal_error",
      errorDetailCode: "DETERMINISTIC_EXTRACTION_FAILED",
      completedAt: failedAt,
      updatedAt: failedAt,
    }).where(and(
      eq(dossierExtractionJobs.dossierId, committed.dossierId),
      eq(dossierExtractionJobs.id, committed.extractionJobId),
      eq(dossierExtractionJobs.status, "processing"),
      eq(dossierExtractionJobs.leaseOwner, leaseOwner),
    ));
    return "failed";
  }
}

export async function recoverDossierExtractionJobs(
  context: DossierUploadCoordinatorContext,
  bucket: R2Bucket,
  dossierId: string,
) {
  const now = canonicalDossierTimestamp();
  const candidates = await context.db.select({
    extractionJobId: dossierExtractionJobs.id,
    extractionStatus: dossierExtractionJobs.status,
    dossierId: dossierDocumentVersions.dossierId,
    documentId: dossierDocumentVersions.documentId,
    documentVersionId: dossierDocumentVersions.id,
    ordinal: dossierDocumentVersions.ordinal,
    objectKey: dossierDocumentVersions.binaryObjectReference,
    originalFilename: dossierDocumentVersions.originalFilename,
    mediaType: dossierDocumentVersions.mediaType,
    byteLength: dossierDocumentVersions.byteLength,
    contentSha256: dossierDocumentVersions.contentSha256,
    uploadedAt: dossierDocumentVersions.uploadedAt,
    predecessorVersionId: dossierDocumentVersions.predecessorVersionId,
    sourceNote: dossierDocumentVersions.sourceNote,
    uploadIntentId: dossierDocumentVersions.uploadIntentId,
    uploaderActorRef: dossierDocumentVersions.uploaderActorRef,
    dossierRevision: dossiers.revision,
  }).from(dossierExtractionJobs).innerJoin(dossierDocumentVersions, and(
    eq(dossierDocumentVersions.dossierId, dossierExtractionJobs.dossierId),
    eq(dossierDocumentVersions.documentId, dossierExtractionJobs.documentId),
    eq(dossierDocumentVersions.id, dossierExtractionJobs.documentVersionId),
  )).innerJoin(dossiers, eq(dossiers.id, dossierExtractionJobs.dossierId)).where(and(
    eq(dossierExtractionJobs.dossierId, dossierId),
    or(
      eq(dossierExtractionJobs.status, "queued"),
      and(
        eq(dossierExtractionJobs.status, "processing"),
        lt(dossierExtractionJobs.leaseExpiresAt, now),
      ),
    ),
  )).orderBy(asc(dossierExtractionJobs.updatedAt), asc(dossierExtractionJobs.id))
    .limit(MAX_EXTRACTION_RECOVERIES_PER_REQUEST);

  for (const candidate of candidates) {
    try {
      if (!candidate.uploadIntentId) throw new Error("Extraction source has no upload intent.");
      assertDossierObjectKeyScope(candidate.objectKey, dossierId, candidate.uploadIntentId);
      const object = await bucket.get(candidate.objectKey);
      if (
        !object
        || object.size !== candidate.byteLength
        || object.httpMetadata?.contentType !== candidate.mediaType
        || object.customMetadata?.contentSha256 !== candidate.contentSha256
        || canonicalR2Sha256(object.checksums.sha256) !== candidate.contentSha256
      ) throw new Error("Extraction source object is unavailable.");
      const prepared = await prepareDossierUpload({
        originalFilename: candidate.originalFilename,
        browserMediaType: candidate.mediaType,
        declaredMediaType: candidate.mediaType,
        bytes: new Uint8Array(await object.arrayBuffer()),
      });
      if (
        prepared.byteLength !== candidate.byteLength
        || prepared.contentSha256 !== candidate.contentSha256
        || prepared.mediaType !== candidate.mediaType
        || prepared.extraction.state !== "ready_to_extract"
      ) throw new Error("Extraction source verification failed.");
      await runDeterministicExtraction(context, bucket, candidate.uploadIntentId, {
        dossierId: candidate.dossierId,
        documentId: candidate.documentId,
        documentVersionId: candidate.documentVersionId,
        ordinal: candidate.ordinal,
        originalFilename: candidate.originalFilename,
        mediaType: candidate.mediaType,
        byteLength: candidate.byteLength,
        contentSha256: candidate.contentSha256,
        uploadedAt: candidate.uploadedAt,
        predecessorVersionId: candidate.predecessorVersionId,
        sourceNote: candidate.sourceNote,
        extractionJobId: candidate.extractionJobId,
        extractionStatus: candidate.extractionStatus,
        dossierRevision: candidate.dossierRevision,
      }, prepared);
    } catch {
      const failedAt = canonicalDossierTimestamp();
      await context.db.update(dossierExtractionJobs).set({
        status: "failed",
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: "internal_error",
        errorDetailCode: "EXTRACTION_SOURCE_RECOVERY_FAILED",
        completedAt: failedAt,
        updatedAt: failedAt,
      }).where(and(
        eq(dossierExtractionJobs.dossierId, dossierId),
        eq(dossierExtractionJobs.id, candidate.extractionJobId),
        or(
          eq(dossierExtractionJobs.status, "queued"),
          and(
            eq(dossierExtractionJobs.status, "processing"),
            lt(dossierExtractionJobs.leaseExpiresAt, failedAt),
          ),
        ),
      ));
    }
  }
}
