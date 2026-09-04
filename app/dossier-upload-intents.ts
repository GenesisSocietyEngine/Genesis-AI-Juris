import {
  DOSSIER_MEDIA_POLICIES,
  DossierSecurityError,
  assertDossierObjectKeyScope,
  parseDossierMediaType,
  parseDossierOpaqueId,
  parseDossierSha256,
  type DossierMediaType,
} from "./dossier-security";

export const DOSSIER_UPLOAD_INTENT_STATES = [
  "pending",
  "expired",
  "committed",
  "deleting",
  "deleted",
] as const;

export type DossierUploadIntentState = (typeof DOSSIER_UPLOAD_INTENT_STATES)[number];

export const DOSSIER_UPLOAD_INTENT_OPERATIONS = [
  "commit",
  "abort",
  "expire",
  "claim_cleanup",
  "finish_cleanup",
] as const;

export type DossierUploadIntentOperation = (typeof DOSSIER_UPLOAD_INTENT_OPERATIONS)[number];

export interface DossierUploadCommitBinding {
  documentId: unknown;
  documentVersionId: unknown;
  objectKey: unknown;
  mediaType: unknown;
  byteLength: unknown;
  contentSha256: unknown;
}

export interface DossierUploadIntentSnapshot {
  uploadIntentId: unknown;
  dossierId: unknown;
  actorId: unknown;
  objectKey: unknown;
  state: unknown;
  expectedDossierRevision: unknown;
  expiresAtEpochMs: unknown;
  committedBinding: DossierUploadCommitBinding | null;
}

export interface DossierUploadIntentDecisionInput {
  operation: unknown;
  intent: DossierUploadIntentSnapshot;
  requestDossierId: unknown;
  requestActorId?: unknown;
  nowEpochMs: unknown;
  currentDossierRevision: unknown;
  objectReferenced: unknown;
  commitBinding?: DossierUploadCommitBinding | null;
  failureCode?: unknown;
  objectDeleteConfirmed?: unknown;
}

export type DossierUploadIntentDenial =
  | "UNKNOWN_OPERATION"
  | "INVALID_INTENT"
  | "CROSS_DOSSIER_REFERENCE"
  | "ACTOR_MISMATCH"
  | "STATE_CONFLICT"
  | "REVISION_CONFLICT"
  | "INTENT_EXPIRED"
  | "INTENT_NOT_EXPIRED"
  | "OBJECT_ALREADY_REFERENCED"
  | "OBJECT_DELETE_NOT_CONFIRMED"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_FAILURE_CODE"
  | "CLEANUP_ALREADY_CLAIMED";

export type DossierUploadIntentDecision =
  | {
      allowed: true;
      result: "transition";
      operation: DossierUploadIntentOperation;
      expectedState: DossierUploadIntentState;
      nextState: DossierUploadIntentState;
      mustCompareAndSet: true;
      deleteObjectAfterCas: boolean;
      committedBinding: CanonicalDossierUploadCommitBinding | null;
      failureCode?: string;
    }
  | {
      allowed: true;
      result: "idempotent";
      operation: DossierUploadIntentOperation;
      state: DossierUploadIntentState;
      mustCompareAndSet: false;
      deleteObjectAfterCas: false;
      committedBinding: CanonicalDossierUploadCommitBinding | null;
    }
  | {
      allowed: false;
      reason: DossierUploadIntentDenial;
    };

export interface CanonicalDossierUploadCommitBinding {
  documentId: string;
  documentVersionId: string;
  objectKey: string;
  mediaType: DossierMediaType;
  byteLength: number;
  contentSha256: string;
}

interface CanonicalUploadIntentSnapshot {
  uploadIntentId: string;
  dossierId: string;
  actorId: string;
  objectKey: string;
  state: DossierUploadIntentState;
  expectedDossierRevision: number;
  expiresAtEpochMs: number;
  committedBinding: CanonicalDossierUploadCommitBinding | null;
}

/**
 * Pure compare-and-set protocol for upload intents. A caller must persist the
 * returned state change with `WHERE state = expectedState` before performing
 * any indicated R2 deletion. This makes commit-vs-cleanup races safe: commit
 * only wins from `pending`, while cleanup first claims `pending|expired` as
 * `deleting`; a loser must re-read and must not touch the object.
 */
export function decideDossierUploadIntentTransition(
  input: DossierUploadIntentDecisionInput,
): DossierUploadIntentDecision {
  if (!isOneOf(input.operation, DOSSIER_UPLOAD_INTENT_OPERATIONS)) {
    return denied("UNKNOWN_OPERATION");
  }

  let intent: CanonicalUploadIntentSnapshot;
  let requestDossierId: string;
  try {
    intent = canonicalUploadIntent(input.intent);
    requestDossierId = parseDossierOpaqueId(input.requestDossierId, "request dossier ID");
  } catch (error) {
    if (error instanceof DossierSecurityError && error.code === "CROSS_DOSSIER_REFERENCE") {
      return denied("CROSS_DOSSIER_REFERENCE");
    }
    return denied("INVALID_INTENT");
  }

  if (requestDossierId !== intent.dossierId) return denied("CROSS_DOSSIER_REFERENCE");

  const nowEpochMs = nonNegativeInteger(input.nowEpochMs);
  const currentRevision = nonNegativeInteger(input.currentDossierRevision);
  if (nowEpochMs === null || currentRevision === null || typeof input.objectReferenced !== "boolean") {
    return denied("INVALID_INTENT");
  }

  if (input.operation === "commit") {
    const actorId = opaqueIdOrNull(input.requestActorId);
    if (!actorId || actorId !== intent.actorId) return denied("ACTOR_MISMATCH");
    let binding: CanonicalDossierUploadCommitBinding;
    try {
      binding = canonicalUploadCommitBinding(input.commitBinding, intent);
    } catch (error) {
      if (error instanceof DossierSecurityError && error.code === "CROSS_DOSSIER_REFERENCE") {
        return denied("CROSS_DOSSIER_REFERENCE");
      }
      return denied("INVALID_INTENT");
    }

    if (intent.state === "committed") {
      if (intent.committedBinding && sameCommitBinding(intent.committedBinding, binding)) {
        return {
          allowed: true,
          result: "idempotent",
          operation: "commit",
          state: "committed",
          mustCompareAndSet: false,
          deleteObjectAfterCas: false,
          committedBinding: intent.committedBinding,
        };
      }
      return denied("IDEMPOTENCY_CONFLICT");
    }
    // Commit is intentionally allowed only from pending, never expired or
    // deleting. The D1 batch which consumes this decision also inserts the
    // immutable version/current pointer/audit and advances dossier revision.
    if (intent.state !== "pending") return denied("STATE_CONFLICT");
    if (nowEpochMs >= intent.expiresAtEpochMs) return denied("INTENT_EXPIRED");
    if (input.objectReferenced) return denied("OBJECT_ALREADY_REFERENCED");
    if (currentRevision !== intent.expectedDossierRevision) return denied("REVISION_CONFLICT");
    return {
      allowed: true,
      result: "transition",
      operation: "commit",
      expectedState: "pending",
      nextState: "committed",
      mustCompareAndSet: true,
      deleteObjectAfterCas: false,
      committedBinding: binding,
    };
  }

  if (input.operation === "abort") {
    const actorId = opaqueIdOrNull(input.requestActorId);
    if (!actorId || actorId !== intent.actorId) return denied("ACTOR_MISMATCH");
    const failureCode = canonicalFailureCode(input.failureCode);
    if (failureCode === null) return denied("INVALID_FAILURE_CODE");
    if (intent.state === "deleting") return denied("CLEANUP_ALREADY_CLAIMED");
    if (intent.state !== "pending") return denied("STATE_CONFLICT");
    if (input.objectReferenced) return denied("OBJECT_ALREADY_REFERENCED");
    return {
      allowed: true,
      result: "transition",
      operation: "abort",
      expectedState: "pending",
      nextState: "deleting",
      mustCompareAndSet: true,
      deleteObjectAfterCas: true,
      committedBinding: null,
      failureCode,
    };
  }

  if (input.operation === "expire") {
    if (intent.state === "expired") {
      return {
        allowed: true,
        result: "idempotent",
        operation: "expire",
        state: "expired",
        mustCompareAndSet: false,
        deleteObjectAfterCas: false,
        committedBinding: null,
      };
    }
    if (intent.state !== "pending") return denied("STATE_CONFLICT");
    if (input.objectReferenced) return denied("OBJECT_ALREADY_REFERENCED");
    if (nowEpochMs < intent.expiresAtEpochMs) return denied("INTENT_NOT_EXPIRED");
    return {
      allowed: true,
      result: "transition",
      operation: "expire",
      expectedState: "pending",
      nextState: "expired",
      mustCompareAndSet: true,
      deleteObjectAfterCas: false,
      committedBinding: null,
    };
  }

  if (input.operation === "claim_cleanup") {
    if (intent.state === "deleting") return denied("CLEANUP_ALREADY_CLAIMED");
    if (intent.state !== "pending" && intent.state !== "expired") return denied("STATE_CONFLICT");
    if (input.objectReferenced) return denied("OBJECT_ALREADY_REFERENCED");
    if (nowEpochMs < intent.expiresAtEpochMs) return denied("INTENT_NOT_EXPIRED");
    return {
      allowed: true,
      result: "transition",
      operation: "claim_cleanup",
      expectedState: intent.state,
      nextState: "deleting",
      mustCompareAndSet: true,
      // Delete only after the pending|expired -> deleting CAS wins.
      deleteObjectAfterCas: true,
      committedBinding: null,
    };
  }

  if (intent.state === "deleted") {
    return {
      allowed: true,
      result: "idempotent",
      operation: "finish_cleanup",
      state: "deleted",
      mustCompareAndSet: false,
      deleteObjectAfterCas: false,
      committedBinding: null,
    };
  }
  if (intent.state !== "deleting") return denied("STATE_CONFLICT");
  if (input.objectReferenced) return denied("OBJECT_ALREADY_REFERENCED");
  if (input.objectDeleteConfirmed !== true) return denied("OBJECT_DELETE_NOT_CONFIRMED");
  return {
    allowed: true,
    result: "transition",
    operation: "finish_cleanup",
    expectedState: "deleting",
    nextState: "deleted",
    mustCompareAndSet: true,
    deleteObjectAfterCas: false,
    committedBinding: null,
  };
}

function canonicalUploadIntent(value: DossierUploadIntentSnapshot): CanonicalUploadIntentSnapshot {
  if (!value || typeof value !== "object") {
    throw new DossierSecurityError("INVALID_OPAQUE_ID", "The upload intent is invalid.");
  }
  const uploadIntentId = parseDossierOpaqueId(value.uploadIntentId, "upload-intent ID");
  const dossierId = parseDossierOpaqueId(value.dossierId, "dossier ID");
  const actorId = parseDossierOpaqueId(value.actorId, "actor ID");
  if (!isOneOf(value.state, DOSSIER_UPLOAD_INTENT_STATES)) {
    throw new DossierSecurityError("INVALID_OPAQUE_ID", "The upload-intent state is invalid.");
  }
  const objectKey = typeof value.objectKey === "string" ? value.objectKey : "";
  assertDossierObjectKeyScope(objectKey, dossierId, uploadIntentId);
  const expectedDossierRevision = nonNegativeInteger(value.expectedDossierRevision);
  const expiresAtEpochMs = nonNegativeInteger(value.expiresAtEpochMs);
  if (expectedDossierRevision === null || expiresAtEpochMs === null) {
    throw new DossierSecurityError("INVALID_OPAQUE_ID", "The upload-intent counters are invalid.");
  }

  let committedBinding: CanonicalDossierUploadCommitBinding | null = null;
  if (value.state === "committed") {
    committedBinding = canonicalUploadCommitBinding(value.committedBinding, {
      uploadIntentId,
      dossierId,
      objectKey,
    });
  } else if (value.committedBinding !== null) {
    throw new DossierSecurityError("INVALID_OBJECT_KEY", "Only committed intents may carry committed metadata.");
  }
  return {
    uploadIntentId,
    dossierId,
    actorId,
    objectKey,
    state: value.state,
    expectedDossierRevision,
    expiresAtEpochMs,
    committedBinding,
  };
}

function canonicalUploadCommitBinding(
  value: DossierUploadCommitBinding | null | undefined,
  intent: Pick<CanonicalUploadIntentSnapshot, "uploadIntentId" | "dossierId" | "objectKey">,
): CanonicalDossierUploadCommitBinding {
  if (!value || typeof value !== "object") {
    throw new DossierSecurityError("INVALID_OBJECT_KEY", "Committed upload metadata is required.");
  }
  const documentId = parseDossierOpaqueId(value.documentId, "document ID");
  const documentVersionId = parseDossierOpaqueId(value.documentVersionId, "document-version ID");
  const objectKey = typeof value.objectKey === "string" ? value.objectKey : "";
  assertDossierObjectKeyScope(objectKey, intent.dossierId, intent.uploadIntentId);
  if (objectKey !== intent.objectKey) {
    throw new DossierSecurityError("CROSS_DOSSIER_REFERENCE", "Committed metadata cannot substitute another object key.");
  }
  const mediaType = parseDossierMediaType(value.mediaType);
  const byteLength = positiveInteger(value.byteLength);
  if (byteLength === null || byteLength > DOSSIER_MEDIA_POLICIES[mediaType].maximumBytes) {
    throw new DossierSecurityError("INVALID_OBJECT_KEY", "Committed byte length is invalid.");
  }
  return {
    documentId,
    documentVersionId,
    objectKey,
    mediaType,
    byteLength,
    contentSha256: parseDossierSha256(value.contentSha256),
  };
}

function sameCommitBinding(
  left: CanonicalDossierUploadCommitBinding,
  right: CanonicalDossierUploadCommitBinding,
): boolean {
  return left.documentId === right.documentId
    && left.documentVersionId === right.documentVersionId
    && left.objectKey === right.objectKey
    && left.mediaType === right.mediaType
    && left.byteLength === right.byteLength
    && left.contentSha256 === right.contentSha256;
}

function denied(reason: DossierUploadIntentDenial): DossierUploadIntentDecision {
  return { allowed: false, reason };
}

function opaqueIdOrNull(value: unknown): string | null {
  try {
    return parseDossierOpaqueId(value);
  } catch {
    return null;
  }
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function canonicalFailureCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,99}$/u.test(value) ? value : null;
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
