import { DOSSIER_ROLES, type DossierRole } from "./dossier-contract";

export const DOSSIER_ACTIONS = [
  "list",
  "read",
  "create",
  "update",
  "transition",
  "participants",
  "upload",
  "download",
  "version",
  "documents",
  "anchors",
  "assertions",
  "evidence",
  "requests",
  "proposals",
  "snapshot",
  "output",
  "approve",
  "audit",
  "admin_archive",
] as const;

export type DossierAction = (typeof DOSSIER_ACTIONS)[number];
export type DossierParticipantStatus = "active" | "removed";

type AuthorizationMode = "participant" | "trusted_identity" | "platform_admin_override";

export const DOSSIER_AUTHORIZATION_MATRIX = {
  list: { mode: "participant", roles: [...DOSSIER_ROLES] },
  read: { mode: "participant", roles: [...DOSSIER_ROLES] },
  create: { mode: "trusted_identity", roles: [] },
  update: { mode: "participant", roles: ["owner", "contributor"] },
  transition: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  participants: { mode: "participant", roles: ["owner"] },
  upload: { mode: "participant", roles: ["owner", "contributor"] },
  download: { mode: "participant", roles: [...DOSSIER_ROLES] },
  version: { mode: "participant", roles: ["owner", "contributor"] },
  documents: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  anchors: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  assertions: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  evidence: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  requests: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  proposals: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  snapshot: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  output: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
  approve: { mode: "participant", roles: ["reviewer"] },
  // `audit` is retrieval of the dossier activity timeline. Audit appends are
  // never client-authorized actions; accepted mutations append them atomically.
  audit: { mode: "participant", roles: ["owner", "contributor", "reviewer", "viewer"] },
  admin_archive: { mode: "platform_admin_override", roles: [] },
} as const satisfies Record<
  DossierAction,
  { mode: AuthorizationMode; roles: readonly DossierRole[] }
>;

export const DOSSIER_TRUSTED_IDENTITY_SOURCE = "trusted_server_identity" as const;

export interface DossierAuthorizationInput {
  action: unknown;
  identity: {
    authenticated: unknown;
    source: unknown;
    actorId: unknown;
  } | null;
  dossier?: {
    dossierId: unknown;
    ownerActorId: unknown;
  } | null;
  participant?: {
    dossierId: unknown;
    actorId: unknown;
    role: unknown;
    status: unknown;
  } | null;
  platformAdmin?: unknown;
  adminArchive?: {
    reason: unknown;
    separateAudit: unknown;
    expectedDossierRevision: unknown;
  } | null;
}

export type DossierAuthorizationDenial =
  | "AUTHENTICATION_REQUIRED"
  | "UNTRUSTED_IDENTITY"
  | "UNKNOWN_ACTION"
  | "INVALID_IDENTIFIER"
  | "PARTICIPANT_REQUIRED"
  | "PARTICIPANT_REMOVED"
  | "PARTICIPANT_MISMATCH"
  | "CROSS_DOSSIER_REFERENCE"
  | "ROLE_FORBIDDEN"
  | "ADMIN_OVERRIDE_REQUIRED"
  | "ADMIN_OVERRIDE_REASON_REQUIRED"
  | "SEPARATE_ADMIN_AUDIT_REQUIRED"
  | "REVISION_REQUIRED";

export type DossierAuthorizationDecision =
  | {
      allowed: true;
      action: DossierAction;
      actorId: string;
      effectiveRole: DossierRole | "creator" | "platform_admin";
      auditEvent: "admin_archive_override" | null;
      expectedDossierRevision: number | null;
    }
  | {
      allowed: false;
      reason: DossierAuthorizationDenial;
    };

/**
 * Authorizes only a trusted, server-resolved identity and an exact active
 * participant row. Organisation labels, email domains, client-supplied owner
 * claims, and the platform-admin flag never confer ordinary dossier access.
 */
export function authorizeDossierAction(input: DossierAuthorizationInput): DossierAuthorizationDecision {
  const action = isOneOf(input.action, DOSSIER_ACTIONS) ? input.action : null;
  if (!action) return authorizationDenied("UNKNOWN_ACTION");

  const identity = input.identity;
  if (!identity || identity.authenticated !== true) return authorizationDenied("AUTHENTICATION_REQUIRED");
  if (identity.source !== DOSSIER_TRUSTED_IDENTITY_SOURCE) return authorizationDenied("UNTRUSTED_IDENTITY");

  const actorId = tryDossierOpaqueId(identity.actorId);
  if (!actorId) return authorizationDenied("INVALID_IDENTIFIER");

  const rule = DOSSIER_AUTHORIZATION_MATRIX[action];
  if (rule.mode === "trusted_identity") {
    return {
      allowed: true,
      action,
      actorId,
      effectiveRole: "creator",
      auditEvent: null,
      expectedDossierRevision: null,
    };
  }

  const dossier = input.dossier;
  const dossierId = tryDossierOpaqueId(dossier?.dossierId);
  const ownerActorId = tryDossierOpaqueId(dossier?.ownerActorId);
  if (!dossierId || !ownerActorId) return authorizationDenied("INVALID_IDENTIFIER");

  if (rule.mode === "platform_admin_override") {
    if (input.platformAdmin !== true) return authorizationDenied("ADMIN_OVERRIDE_REQUIRED");
    const reason = tryBoundedReason(input.adminArchive?.reason);
    if (!reason) return authorizationDenied("ADMIN_OVERRIDE_REASON_REQUIRED");
    if (input.adminArchive?.separateAudit !== true) {
      return authorizationDenied("SEPARATE_ADMIN_AUDIT_REQUIRED");
    }
    const expectedRevision = tryPositiveSafeInteger(input.adminArchive?.expectedDossierRevision);
    if (expectedRevision === null) return authorizationDenied("REVISION_REQUIRED");
    return {
      allowed: true,
      action,
      actorId,
      effectiveRole: "platform_admin",
      auditEvent: "admin_archive_override",
      expectedDossierRevision: expectedRevision,
    };
  }

  const participant = input.participant;
  if (!participant) return authorizationDenied("PARTICIPANT_REQUIRED");

  const participantDossierId = tryDossierOpaqueId(participant.dossierId);
  const participantActorId = tryDossierOpaqueId(participant.actorId);
  if (!participantDossierId || !participantActorId) return authorizationDenied("INVALID_IDENTIFIER");
  if (participantDossierId !== dossierId) return authorizationDenied("CROSS_DOSSIER_REFERENCE");
  if (participantActorId !== actorId) return authorizationDenied("PARTICIPANT_MISMATCH");
  if (!isOneOf(participant.status, ["active", "removed"] as const)) {
    return authorizationDenied("PARTICIPANT_MISMATCH");
  }
  if (participant.status === "removed") return authorizationDenied("PARTICIPANT_REMOVED");
  if (!isOneOf(participant.role, DOSSIER_ROLES)) return authorizationDenied("PARTICIPANT_MISMATCH");

  // An owner role is valid only for the authoritative owner actor, and the
  // authoritative owner must use its required active owner participant row.
  if ((participant.role === "owner") !== (actorId === ownerActorId)) {
    return authorizationDenied("PARTICIPANT_MISMATCH");
  }
  if (!(rule.roles as readonly DossierRole[]).includes(participant.role)) {
    return authorizationDenied("ROLE_FORBIDDEN");
  }

  return {
    allowed: true,
    action,
    actorId,
    effectiveRole: participant.role,
    auditEvent: null,
    expectedDossierRevision: null,
  };
}

function authorizationDenied(reason: DossierAuthorizationDenial): DossierAuthorizationDecision {
  return { allowed: false, reason };
}

export type DossierSecurityErrorCode =
  | "INVALID_OPAQUE_ID"
  | "INVALID_SHA256"
  | "INVALID_OBJECT_KEY"
  | "CROSS_DOSSIER_REFERENCE"
  | "DUPLICATE_REFERENCE"
  | "REFERENCE_LIMIT_EXCEEDED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_UTF8"
  | "TEXT_LIMIT_EXCEEDED";

export class DossierSecurityError extends Error {
  constructor(
    readonly code: DossierSecurityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DossierSecurityError";
  }
}

export function parseDossierOpaqueId(value: unknown, label = "identifier"): string {
  if (
    typeof value !== "string"
    || value.length < 8
    || value.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new DossierSecurityError("INVALID_OPAQUE_ID", `${label} is not a canonical opaque identifier.`);
  }
  return value;
}

export function parseDossierSha256(value: unknown, label = "content hash"): string {
  if (typeof value !== "string" || !/^sha256-[a-f0-9]{64}$/u.test(value)) {
    throw new DossierSecurityError("INVALID_SHA256", `${label} is not a canonical SHA-256 digest.`);
  }
  return value;
}

export interface DossierObjectKeyParts {
  dossierId: string;
  uploadIntentId: string;
  nonce: string;
}

/**
 * Object keys contain no filename or user text and end in 256 bits of
 * server-generated entropy. R2 remains private; knowledge of a key is never
 * treated as download authority.
 */
export function parseDossierObjectKey(value: unknown): DossierObjectKeyParts {
  if (typeof value !== "string" || value.length > 360) {
    throw new DossierSecurityError("INVALID_OBJECT_KEY", "The document object key is invalid.");
  }
  const match = /^dossier-v1\/([A-Za-z0-9][A-Za-z0-9_-]{7,127})\/([A-Za-z0-9][A-Za-z0-9_-]{7,127})\/([a-f0-9]{64})$/u.exec(value);
  if (!match) throw new DossierSecurityError("INVALID_OBJECT_KEY", "The document object key is invalid.");
  return {
    dossierId: parseDossierOpaqueId(match[1], "object-key dossier ID"),
    uploadIntentId: parseDossierOpaqueId(match[2], "object-key upload-intent ID"),
    nonce: match[3],
  };
}

export function dossierObjectKey(dossierId: unknown, uploadIntentId: unknown, nonce: unknown): string {
  const parsedDossierId = parseDossierOpaqueId(dossierId, "dossier ID");
  const parsedIntentId = parseDossierOpaqueId(uploadIntentId, "upload-intent ID");
  if (typeof nonce !== "string" || !/^[a-f0-9]{64}$/u.test(nonce)) {
    throw new DossierSecurityError("INVALID_OBJECT_KEY", "The object nonce must contain 256 bits of lowercase hexadecimal entropy.");
  }
  return `dossier-v1/${parsedDossierId}/${parsedIntentId}/${nonce}`;
}

export function assertDossierObjectKeyScope(
  value: unknown,
  expectedDossierId: unknown,
  expectedUploadIntentId: unknown,
): DossierObjectKeyParts {
  const parts = parseDossierObjectKey(value);
  const dossierId = parseDossierOpaqueId(expectedDossierId, "expected dossier ID");
  const intentId = parseDossierOpaqueId(expectedUploadIntentId, "expected upload-intent ID");
  if (parts.dossierId !== dossierId || parts.uploadIntentId !== intentId) {
    throw new DossierSecurityError("CROSS_DOSSIER_REFERENCE", "The object key is outside the expected dossier or upload intent.");
  }
  return parts;
}

export interface DossierScopedReference {
  dossierId: unknown;
  objectId: unknown;
}

export function assertSameDossierReferences(
  expectedDossierId: unknown,
  references: readonly DossierScopedReference[],
): ReadonlyArray<{ dossierId: string; objectId: string }> {
  const dossierId = parseDossierOpaqueId(expectedDossierId, "expected dossier ID");
  if (!Array.isArray(references) || references.length > DOSSIER_REFERENCE_LIMIT) {
    throw new DossierSecurityError("REFERENCE_LIMIT_EXCEEDED", "Too many dossier-scoped references were supplied.");
  }
  const seen = new Set<string>();
  return references.map((reference, index) => {
    const referenceDossierId = parseDossierOpaqueId(reference?.dossierId, `reference ${index} dossier ID`);
    const objectId = parseDossierOpaqueId(reference?.objectId, `reference ${index} object ID`);
    if (referenceDossierId !== dossierId) {
      throw new DossierSecurityError("CROSS_DOSSIER_REFERENCE", `Reference ${index} belongs to another dossier.`);
    }
    const key = `${referenceDossierId}\u0000${objectId}`;
    if (seen.has(key)) {
      throw new DossierSecurityError("DUPLICATE_REFERENCE", `Reference ${index} is duplicated.`);
    }
    seen.add(key);
    return { dossierId: referenceDossierId, objectId };
  });
}

export type DossierReferenceScopeDecision =
  | { allowed: true }
  | { allowed: false; reason: DossierSecurityErrorCode };

export function dossierReferenceScopeDecision(
  expectedDossierId: unknown,
  references: readonly DossierScopedReference[],
): DossierReferenceScopeDecision {
  try {
    assertSameDossierReferences(expectedDossierId, references);
    return { allowed: true };
  } catch (error) {
    if (error instanceof DossierSecurityError) return { allowed: false, reason: error.code };
    return { allowed: false, reason: "INVALID_OPAQUE_ID" };
  }
}

export const DOSSIER_REFERENCE_LIMIT = 10_000;

const MiB = 1024 * 1024;

export const DOSSIER_UPLOAD_LIMITS = Object.freeze({
  maximumDocumentCount: 100,
  maximumVersionsPerDocument: 50,
  maximumVersionCount: 1_000,
  maximumStoredBytes: 1024 * MiB,
  maximumPendingIntents: 20,
});

export const DOSSIER_MEDIA_POLICIES = Object.freeze({
  "application/pdf": {
    extension: "pdf",
    maximumBytes: 25 * MiB,
    extraction: "not_extractable",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    maximumBytes: 25 * MiB,
    extraction: "not_extractable",
  },
  "text/plain": {
    extension: "txt",
    maximumBytes: 5 * MiB,
    extraction: "deterministic_utf8_v1",
  },
  "text/markdown": {
    extension: "md",
    maximumBytes: 5 * MiB,
    extraction: "deterministic_utf8_v1",
  },
} as const);

export type DossierMediaType = keyof typeof DOSSIER_MEDIA_POLICIES;
export type DossierExtractionPolicy = (typeof DOSSIER_MEDIA_POLICIES)[DossierMediaType]["extraction"];

export function parseDossierMediaType(value: unknown): DossierMediaType {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(DOSSIER_MEDIA_POLICIES, value)) {
    throw new DossierSecurityError("UNSUPPORTED_MEDIA_TYPE", "The document media type is not allowed.");
  }
  return value as DossierMediaType;
}

export interface DossierUploadPolicyInput {
  mediaType: unknown;
  byteLength: unknown;
  newDocument: unknown;
  currentDocumentCount: unknown;
  currentDocumentVersionCount: unknown;
  currentDossierVersionCount: unknown;
  currentStoredBytes: unknown;
  currentPendingIntentCount: unknown;
}

export type DossierUploadPolicyDenial =
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_CONTENT_LENGTH"
  | "FILE_TOO_LARGE"
  | "INVALID_USAGE_COUNTER"
  | "DOCUMENT_QUOTA_EXCEEDED"
  | "DOCUMENT_VERSION_QUOTA_EXCEEDED"
  | "DOSSIER_VERSION_QUOTA_EXCEEDED"
  | "STORAGE_QUOTA_EXCEEDED"
  | "PENDING_UPLOAD_QUOTA_EXCEEDED";

export type DossierUploadPolicyDecision =
  | {
      allowed: true;
      mediaType: DossierMediaType;
      byteLength: number;
      extraction: DossierExtractionPolicy;
    }
  | { allowed: false; reason: DossierUploadPolicyDenial };

export function decideDossierUploadPolicy(input: DossierUploadPolicyInput): DossierUploadPolicyDecision {
  let mediaType: DossierMediaType;
  try {
    mediaType = parseDossierMediaType(input.mediaType);
  } catch {
    return { allowed: false, reason: "UNSUPPORTED_MEDIA_TYPE" };
  }

  const byteLength = tryPositiveSafeInteger(input.byteLength);
  if (byteLength === null) return { allowed: false, reason: "INVALID_CONTENT_LENGTH" };
  if (byteLength > DOSSIER_MEDIA_POLICIES[mediaType].maximumBytes) {
    return { allowed: false, reason: "FILE_TOO_LARGE" };
  }
  if (typeof input.newDocument !== "boolean") return { allowed: false, reason: "INVALID_USAGE_COUNTER" };

  const documentCount = tryNonNegativeSafeInteger(input.currentDocumentCount);
  const documentVersionCount = tryNonNegativeSafeInteger(input.currentDocumentVersionCount);
  const dossierVersionCount = tryNonNegativeSafeInteger(input.currentDossierVersionCount);
  const storedBytes = tryNonNegativeSafeInteger(input.currentStoredBytes);
  const pendingIntentCount = tryNonNegativeSafeInteger(input.currentPendingIntentCount);
  if (
    documentCount === null
    || documentVersionCount === null
    || dossierVersionCount === null
    || storedBytes === null
    || pendingIntentCount === null
  ) {
    return { allowed: false, reason: "INVALID_USAGE_COUNTER" };
  }

  if (input.newDocument && documentCount >= DOSSIER_UPLOAD_LIMITS.maximumDocumentCount) {
    return { allowed: false, reason: "DOCUMENT_QUOTA_EXCEEDED" };
  }
  if (!input.newDocument && documentVersionCount >= DOSSIER_UPLOAD_LIMITS.maximumVersionsPerDocument) {
    return { allowed: false, reason: "DOCUMENT_VERSION_QUOTA_EXCEEDED" };
  }
  if (dossierVersionCount >= DOSSIER_UPLOAD_LIMITS.maximumVersionCount) {
    return { allowed: false, reason: "DOSSIER_VERSION_QUOTA_EXCEEDED" };
  }
  if (storedBytes > DOSSIER_UPLOAD_LIMITS.maximumStoredBytes - byteLength) {
    return { allowed: false, reason: "STORAGE_QUOTA_EXCEEDED" };
  }
  if (pendingIntentCount >= DOSSIER_UPLOAD_LIMITS.maximumPendingIntents) {
    return { allowed: false, reason: "PENDING_UPLOAD_QUOTA_EXCEEDED" };
  }

  return {
    allowed: true,
    mediaType,
    byteLength,
    extraction: DOSSIER_MEDIA_POLICIES[mediaType].extraction,
  };
}

export interface DossierObservedUploadInput {
  declaredMediaType: unknown;
  observedMediaType: unknown;
  declaredByteLength: unknown;
  observedByteLength: unknown;
  declaredSha256: unknown;
  observedSha256: unknown;
}

export type DossierObservedUploadDecision =
  | {
      accepted: true;
      mediaType: DossierMediaType;
      byteLength: number;
      contentSha256: string;
    }
  | {
      accepted: false;
      reason: "INVALID_OBSERVATION" | "MEDIA_TYPE_MISMATCH" | "LENGTH_MISMATCH" | "HASH_MISMATCH";
    };

export function decideObservedDossierUpload(input: DossierObservedUploadInput): DossierObservedUploadDecision {
  let declaredMediaType: DossierMediaType;
  let observedMediaType: DossierMediaType;
  let declaredSha256: string;
  let observedSha256: string;
  try {
    declaredMediaType = parseDossierMediaType(input.declaredMediaType);
    observedMediaType = parseDossierMediaType(input.observedMediaType);
    declaredSha256 = parseDossierSha256(input.declaredSha256);
    observedSha256 = parseDossierSha256(input.observedSha256);
  } catch {
    return { accepted: false, reason: "INVALID_OBSERVATION" };
  }
  const declaredLength = tryPositiveSafeInteger(input.declaredByteLength);
  const observedLength = tryPositiveSafeInteger(input.observedByteLength);
  if (declaredLength === null || observedLength === null) {
    return { accepted: false, reason: "INVALID_OBSERVATION" };
  }
  if (declaredMediaType !== observedMediaType) return { accepted: false, reason: "MEDIA_TYPE_MISMATCH" };
  if (declaredLength !== observedLength) return { accepted: false, reason: "LENGTH_MISMATCH" };
  if (declaredSha256 !== observedSha256) return { accepted: false, reason: "HASH_MISMATCH" };
  return {
    accepted: true,
    mediaType: observedMediaType,
    byteLength: observedLength,
    contentSha256: observedSha256,
  };
}

export type DossierExtractionDecision =
  | {
      accepted: true;
      state: "ready_to_extract";
      extractorVersion: "genesis-dossier-strict-utf8-v1";
      ocr: false;
    }
  | {
      accepted: true;
      state: "not_extractable";
      reason: "PARSER_NOT_APPROVED";
      ocr: false;
    }
  | {
      accepted: false;
      reason: "UNSUPPORTED_MEDIA_TYPE" | "OCR_DEFERRED";
      ocr: false;
    };

export function decideDossierExtraction(mediaTypeValue: unknown, ocrRequested: unknown = false): DossierExtractionDecision {
  if (ocrRequested !== false) return { accepted: false, reason: "OCR_DEFERRED", ocr: false };
  let mediaType: DossierMediaType;
  try {
    mediaType = parseDossierMediaType(mediaTypeValue);
  } catch {
    return { accepted: false, reason: "UNSUPPORTED_MEDIA_TYPE", ocr: false };
  }
  if (DOSSIER_MEDIA_POLICIES[mediaType].extraction === "not_extractable") {
    return { accepted: true, state: "not_extractable", reason: "PARSER_NOT_APPROVED", ocr: false };
  }
  return {
    accepted: true,
    state: "ready_to_extract",
    extractorVersion: "genesis-dossier-strict-utf8-v1",
    ocr: false,
  };
}

export interface DossierTextExtractionResult {
  state: "ready";
  extractorVersion: "genesis-dossier-strict-utf8-v1";
  text: string;
  characterCount: number;
  lineEnding: "LF";
  ocr: false;
}

/**
 * The only MVP extractor. It rejects malformed UTF-8 and NUL, removes one
 * leading UTF-8 BOM, and canonicalizes CRLF/lone CR to LF without trimming.
 */
export function extractDeterministicDossierText(
  mediaTypeValue: unknown,
  bytes: Uint8Array,
): DossierTextExtractionResult {
  const mediaType = parseDossierMediaType(mediaTypeValue);
  if (DOSSIER_MEDIA_POLICIES[mediaType].extraction !== "deterministic_utf8_v1") {
    throw new DossierSecurityError("UNSUPPORTED_MEDIA_TYPE", "This media type has no approved extractor.");
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > DOSSIER_MEDIA_POLICIES[mediaType].maximumBytes) {
    throw new DossierSecurityError("TEXT_LIMIT_EXCEEDED", "The text source exceeds the deterministic extraction limit.");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new DossierSecurityError("INVALID_UTF8", "The text source is not strict UTF-8.");
  }
  if (text.includes("\u0000")) {
    throw new DossierSecurityError("INVALID_UTF8", "The text source contains a NUL character.");
  }
  // TextDecoder consumes a leading UTF-8 BOM when ignoreBOM is false.
  const canonicalText = text.replace(/\r\n?/gu, "\n");
  if (canonicalText.length > DOSSIER_MAX_EXTRACTED_CHARACTERS) {
    throw new DossierSecurityError("TEXT_LIMIT_EXCEEDED", "The extracted text exceeds the character limit.");
  }
  return {
    state: "ready",
    extractorVersion: "genesis-dossier-strict-utf8-v1",
    text: canonicalText,
    characterCount: canonicalText.length,
    lineEnding: "LF",
    ocr: false,
  };
}

export const DOSSIER_MAX_EXTRACTED_CHARACTERS = 5_000_000;

function tryDossierOpaqueId(value: unknown): string | null {
  try {
    return parseDossierOpaqueId(value);
  } catch {
    return null;
  }
}

function tryBoundedReason(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1_000 || value.includes("\u0000") || value.trim().length === 0) {
    return null;
  }
  return value;
}

function tryPositiveSafeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function tryNonNegativeSafeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
