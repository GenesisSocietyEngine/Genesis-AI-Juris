import assert from "node:assert/strict";
import test from "node:test";
import {
  DOSSIER_ACTIONS,
  DOSSIER_AUTHORIZATION_MATRIX,
  DOSSIER_MEDIA_POLICIES,
  DOSSIER_TRUSTED_IDENTITY_SOURCE,
  DOSSIER_UPLOAD_LIMITS,
  DossierSecurityError,
  assertDossierObjectKeyScope,
  assertSameDossierReferences,
  authorizeDossierAction,
  decideDossierExtraction,
  decideDossierUploadPolicy,
  decideObservedDossierUpload,
  dossierObjectKey,
  dossierReferenceScopeDecision,
  extractDeterministicDossierText,
  parseDossierMediaType,
  parseDossierObjectKey,
  parseDossierOpaqueId,
  parseDossierSha256,
  type DossierAuthorizationInput,
} from "../app/dossier-security";
import { decideDossierDownload } from "../app/dossier-download-security";
import {
  decideDossierUploadIntentTransition,
  type DossierUploadCommitBinding,
  type DossierUploadIntentDecisionInput,
  type DossierUploadIntentSnapshot,
} from "../app/dossier-upload-intents";
import { DOSSIER_ROLES, type DossierRole } from "../app/dossier-contract";

const DOSSIER_A = "dossier_alpha_0001";
const DOSSIER_B = "dossier_bravo_0002";
const OWNER = "actor_owner_0001";
const CONTRIBUTOR = "actor_contributor_0001";
const REVIEWER = "actor_reviewer_0001";
const VIEWER = "actor_viewer_0001";
const INTRUDER = "actor_intruder_0001";
const ADMIN = "actor_platform_admin_0001";
const INTENT = "upload_intent_0001";
const DOCUMENT = "document_alpha_0001";
const VERSION = "document_version_0001";
const HASH_A = `sha256-${"a".repeat(64)}`;
const HASH_B = `sha256-${"b".repeat(64)}`;
const NONCE = "c".repeat(64);
const OBJECT_KEY = dossierObjectKey(DOSSIER_A, INTENT, NONCE);

const ROLE_ACTORS: Record<DossierRole, string> = {
  owner: OWNER,
  contributor: CONTRIBUTOR,
  reviewer: REVIEWER,
  viewer: VIEWER,
};

function authorizationInput(action: unknown, role: DossierRole): DossierAuthorizationInput {
  const actorId = ROLE_ACTORS[role];
  return {
    action,
    identity: {
      authenticated: true,
      source: DOSSIER_TRUSTED_IDENTITY_SOURCE,
      actorId,
    },
    dossier: { dossierId: DOSSIER_A, ownerActorId: OWNER },
    participant: {
      dossierId: DOSSIER_A,
      actorId,
      role,
      status: "active",
    },
    platformAdmin: false,
    adminArchive: null,
  };
}

test("the authorization matrix names every dossier action exactly once", () => {
  assert.deepEqual(Object.keys(DOSSIER_AUTHORIZATION_MATRIX), [...DOSSIER_ACTIONS]);
  assert.deepEqual(DOSSIER_AUTHORIZATION_MATRIX, {
    list: { mode: "participant", roles: ["owner", "contributor", "reviewer", "viewer"] },
    read: { mode: "participant", roles: ["owner", "contributor", "reviewer", "viewer"] },
    create: { mode: "trusted_identity", roles: [] },
    update: { mode: "participant", roles: ["owner", "contributor"] },
    transition: { mode: "participant", roles: ["owner", "contributor", "reviewer"] },
    participants: { mode: "participant", roles: ["owner"] },
    upload: { mode: "participant", roles: ["owner", "contributor"] },
    download: { mode: "participant", roles: ["owner", "contributor", "reviewer", "viewer"] },
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
    audit: { mode: "participant", roles: ["owner", "contributor", "reviewer", "viewer"] },
    admin_archive: { mode: "platform_admin_override", roles: [] },
  });
});

test("every participant role and ordinary action follows the exact matrix", () => {
  const ordinaryActions = DOSSIER_ACTIONS.filter((action) => action !== "create" && action !== "admin_archive");
  for (const action of ordinaryActions) {
    for (const role of DOSSIER_ROLES) {
      const decision = authorizeDossierAction(authorizationInput(action, role));
      const expected = (DOSSIER_AUTHORIZATION_MATRIX[action].roles as readonly DossierRole[]).includes(role);
      assert.equal(decision.allowed, expected, `${action}/${role}`);
      if (!expected) assert.deepEqual(decision, { allowed: false, reason: "ROLE_FORBIDDEN" });
    }
  }
});

test("create requires a trusted authenticated actor but no participant or organisation claim", () => {
  for (const actorId of Object.values(ROLE_ACTORS)) {
    const decision = authorizeDossierAction({
      action: "create",
      identity: { authenticated: true, source: DOSSIER_TRUSTED_IDENTITY_SOURCE, actorId },
      dossier: null,
      participant: null,
    });
    assert.equal(decision.allowed, true, actorId);
    if (decision.allowed) assert.equal(decision.effectiveRole, "creator");
  }

  assert.deepEqual(authorizeDossierAction({
    action: "create",
    identity: { authenticated: true, source: "client_body", actorId: OWNER },
  }), { allowed: false, reason: "UNTRUSTED_IDENTITY" });
  assert.deepEqual(authorizeDossierAction({ action: "create", identity: null }), {
    allowed: false,
    reason: "AUTHENTICATION_REQUIRED",
  });
});

test("removed, mismatched, cross-dossier and unknown participants fail closed", () => {
  for (const action of DOSSIER_ACTIONS.filter((value) => value !== "create" && value !== "admin_archive")) {
    const removed = authorizationInput(action, "owner");
    removed.participant = { ...removed.participant!, status: "removed" };
    assert.deepEqual(authorizeDossierAction(removed), { allowed: false, reason: "PARTICIPANT_REMOVED" }, action);
  }

  const crossDossier = authorizationInput("read", "viewer");
  crossDossier.participant = { ...crossDossier.participant!, dossierId: DOSSIER_B };
  assert.deepEqual(authorizeDossierAction(crossDossier), {
    allowed: false,
    reason: "CROSS_DOSSIER_REFERENCE",
  });

  const mismatchedActor = authorizationInput("read", "viewer");
  mismatchedActor.participant = { ...mismatchedActor.participant!, actorId: INTRUDER };
  assert.deepEqual(authorizeDossierAction(mismatchedActor), {
    allowed: false,
    reason: "PARTICIPANT_MISMATCH",
  });

  const falseOwner = authorizationInput("read", "owner");
  falseOwner.identity = { ...falseOwner.identity!, actorId: INTRUDER };
  falseOwner.participant = { ...falseOwner.participant!, actorId: INTRUDER };
  assert.deepEqual(authorizeDossierAction(falseOwner), {
    allowed: false,
    reason: "PARTICIPANT_MISMATCH",
  });

  const unknownRole = authorizationInput("read", "viewer");
  unknownRole.participant = { ...unknownRole.participant!, role: "organisation_admin" };
  assert.deepEqual(authorizeDossierAction(unknownRole), {
    allowed: false,
    reason: "PARTICIPANT_MISMATCH",
  });
  assert.deepEqual(authorizeDossierAction(authorizationInput("future_action", "owner")), {
    allowed: false,
    reason: "UNKNOWN_ACTION",
  });
});

test("platform administration is not ambient authority and archive override is separately audited", () => {
  const readAsAdmin: DossierAuthorizationInput = {
    action: "read",
    identity: { authenticated: true, source: DOSSIER_TRUSTED_IDENTITY_SOURCE, actorId: ADMIN },
    dossier: { dossierId: DOSSIER_A, ownerActorId: OWNER },
    participant: null,
    platformAdmin: true,
  };
  assert.deepEqual(authorizeDossierAction(readAsAdmin), {
    allowed: false,
    reason: "PARTICIPANT_REQUIRED",
  });

  const override: DossierAuthorizationInput = {
    ...readAsAdmin,
    action: "admin_archive",
    adminArchive: {
      reason: "Governed administrative archive after documented escalation.",
      separateAudit: true,
      expectedDossierRevision: 7,
    },
  };
  assert.deepEqual(authorizeDossierAction(override), {
    allowed: true,
    action: "admin_archive",
    actorId: ADMIN,
    effectiveRole: "platform_admin",
    auditEvent: "admin_archive_override",
    expectedDossierRevision: 7,
  });
  assert.deepEqual(authorizeDossierAction({ ...override, platformAdmin: false }), {
    allowed: false,
    reason: "ADMIN_OVERRIDE_REQUIRED",
  });
  assert.deepEqual(authorizeDossierAction({
    ...override,
    adminArchive: { ...override.adminArchive!, reason: "   " },
  }), { allowed: false, reason: "ADMIN_OVERRIDE_REASON_REQUIRED" });
  assert.deepEqual(authorizeDossierAction({
    ...override,
    adminArchive: { ...override.adminArchive!, separateAudit: false },
  }), { allowed: false, reason: "SEPARATE_ADMIN_AUDIT_REQUIRED" });
  assert.deepEqual(authorizeDossierAction({
    ...override,
    adminArchive: { ...override.adminArchive!, expectedDossierRevision: -1 },
  }), { allowed: false, reason: "REVISION_REQUIRED" });
  assert.deepEqual(authorizeDossierAction({
    ...override,
    adminArchive: { ...override.adminArchive!, expectedDossierRevision: 0 },
  }), { allowed: false, reason: "REVISION_REQUIRED" });
});

test("organisation and client owner claims have no authorization effect", () => {
  const injected = {
    action: "participants",
    identity: { authenticated: true, source: DOSSIER_TRUSTED_IDENTITY_SOURCE, actorId: INTRUDER },
    dossier: { dossierId: DOSSIER_A, ownerActorId: OWNER },
    participant: null,
    platformAdmin: false,
    organisationId: "organisation_matching_profile_text",
    claimedOwnerActorId: INTRUDER,
    clientRole: "owner",
  } as DossierAuthorizationInput & Record<string, unknown>;
  assert.deepEqual(authorizeDossierAction(injected), {
    allowed: false,
    reason: "PARTICIPANT_REQUIRED",
  });
});

test("opaque IDs, hashes and object keys accept only their canonical forms", () => {
  assert.equal(parseDossierOpaqueId("opaque_01"), "opaque_01");
  for (const value of ["short", " leading_0001", "bad/slash_0001", "bad.dot_0001", "a".repeat(129)]) {
    assert.throws(() => parseDossierOpaqueId(value), (error) => (
      error instanceof DossierSecurityError && error.code === "INVALID_OPAQUE_ID"
    ));
  }

  assert.equal(parseDossierSha256(HASH_A), HASH_A);
  for (const value of [HASH_A.toUpperCase(), "a".repeat(64), `sha256-${"g".repeat(64)}`]) {
    assert.throws(() => parseDossierSha256(value), (error) => (
      error instanceof DossierSecurityError && error.code === "INVALID_SHA256"
    ));
  }

  assert.deepEqual(parseDossierObjectKey(OBJECT_KEY), {
    dossierId: DOSSIER_A,
    uploadIntentId: INTENT,
    nonce: NONCE,
  });
  assert.equal(assertDossierObjectKeyScope(OBJECT_KEY, DOSSIER_A, INTENT).nonce, NONCE);
  for (const value of [
    `dossier-v1/${DOSSIER_A}/../${NONCE}`,
    `dossier-v1/${DOSSIER_A}/${INTENT}/filename.pdf`,
    `dossier-v1/${DOSSIER_A}/${INTENT}/${NONCE.toUpperCase()}`,
    `${OBJECT_KEY}/extra`,
  ]) {
    assert.throws(() => parseDossierObjectKey(value), (error) => (
      error instanceof DossierSecurityError && error.code === "INVALID_OBJECT_KEY"
    ));
  }
  assert.throws(() => assertDossierObjectKeyScope(OBJECT_KEY, DOSSIER_B, INTENT), (error) => (
    error instanceof DossierSecurityError && error.code === "CROSS_DOSSIER_REFERENCE"
  ));
});

test("same-dossier helpers reject cross-dossier IDs and duplicate substitutions", () => {
  assert.deepEqual(assertSameDossierReferences(DOSSIER_A, [
    { dossierId: DOSSIER_A, objectId: DOCUMENT },
    { dossierId: DOSSIER_A, objectId: VERSION },
  ]), [
    { dossierId: DOSSIER_A, objectId: DOCUMENT },
    { dossierId: DOSSIER_A, objectId: VERSION },
  ]);
  assert.deepEqual(dossierReferenceScopeDecision(DOSSIER_A, [
    { dossierId: DOSSIER_B, objectId: DOCUMENT },
  ]), { allowed: false, reason: "CROSS_DOSSIER_REFERENCE" });
  assert.throws(() => assertSameDossierReferences(DOSSIER_A, [
    { dossierId: DOSSIER_A, objectId: DOCUMENT },
    { dossierId: DOSSIER_A, objectId: DOCUMENT },
  ]), (error) => error instanceof DossierSecurityError && error.code === "DUPLICATE_REFERENCE");
});

function allowedUpload(overrides: Partial<Parameters<typeof decideDossierUploadPolicy>[0]> = {}) {
  return decideDossierUploadPolicy({
    mediaType: "text/plain",
    byteLength: 100,
    newDocument: true,
    currentDocumentCount: 0,
    currentDocumentVersionCount: 0,
    currentDossierVersionCount: 0,
    currentStoredBytes: 0,
    currentPendingIntentCount: 0,
    ...overrides,
  });
}

test("the exact media allowlist has bounded per-file and dossier quotas", () => {
  assert.deepEqual(Object.keys(DOSSIER_MEDIA_POLICIES), [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
  ]);
  for (const mediaType of Object.keys(DOSSIER_MEDIA_POLICIES)) {
    assert.equal(parseDossierMediaType(mediaType), mediaType);
    const atLimit = allowedUpload({
      mediaType,
      byteLength: DOSSIER_MEDIA_POLICIES[mediaType as keyof typeof DOSSIER_MEDIA_POLICIES].maximumBytes,
    });
    assert.equal(atLimit.allowed, true, mediaType);
    assert.deepEqual(allowedUpload({
      mediaType,
      byteLength: DOSSIER_MEDIA_POLICIES[mediaType as keyof typeof DOSSIER_MEDIA_POLICIES].maximumBytes + 1,
    }), { allowed: false, reason: "FILE_TOO_LARGE" });
  }
  assert.deepEqual(allowedUpload({ mediaType: "text/plain; charset=utf-8" }), {
    allowed: false,
    reason: "UNSUPPORTED_MEDIA_TYPE",
  });
  assert.deepEqual(allowedUpload({ byteLength: 0 }), { allowed: false, reason: "INVALID_CONTENT_LENGTH" });
  assert.deepEqual(allowedUpload({ currentDocumentCount: DOSSIER_UPLOAD_LIMITS.maximumDocumentCount }), {
    allowed: false,
    reason: "DOCUMENT_QUOTA_EXCEEDED",
  });
  assert.deepEqual(allowedUpload({
    newDocument: false,
    currentDocumentVersionCount: DOSSIER_UPLOAD_LIMITS.maximumVersionsPerDocument,
  }), { allowed: false, reason: "DOCUMENT_VERSION_QUOTA_EXCEEDED" });
  assert.deepEqual(allowedUpload({ currentDossierVersionCount: DOSSIER_UPLOAD_LIMITS.maximumVersionCount }), {
    allowed: false,
    reason: "DOSSIER_VERSION_QUOTA_EXCEEDED",
  });
  assert.equal(allowedUpload({
    byteLength: 100,
    currentStoredBytes: DOSSIER_UPLOAD_LIMITS.maximumStoredBytes - 100,
  }).allowed, true);
  assert.deepEqual(allowedUpload({
    byteLength: 100,
    currentStoredBytes: DOSSIER_UPLOAD_LIMITS.maximumStoredBytes - 99,
  }), { allowed: false, reason: "STORAGE_QUOTA_EXCEEDED" });
  assert.deepEqual(allowedUpload({ currentPendingIntentCount: DOSSIER_UPLOAD_LIMITS.maximumPendingIntents }), {
    allowed: false,
    reason: "PENDING_UPLOAD_QUOTA_EXCEEDED",
  });
  assert.deepEqual(allowedUpload({ currentDocumentCount: 0.5 }), {
    allowed: false,
    reason: "INVALID_USAGE_COUNTER",
  });
});

test("commit metadata must exactly match observed media, length and hash", () => {
  const base = {
    declaredMediaType: "text/markdown",
    observedMediaType: "text/markdown",
    declaredByteLength: 42,
    observedByteLength: 42,
    declaredSha256: HASH_A,
    observedSha256: HASH_A,
  };
  assert.deepEqual(decideObservedDossierUpload(base), {
    accepted: true,
    mediaType: "text/markdown",
    byteLength: 42,
    contentSha256: HASH_A,
  });
  assert.deepEqual(decideObservedDossierUpload({ ...base, observedMediaType: "text/plain" }), {
    accepted: false,
    reason: "MEDIA_TYPE_MISMATCH",
  });
  assert.deepEqual(decideObservedDossierUpload({ ...base, observedByteLength: 41 }), {
    accepted: false,
    reason: "LENGTH_MISMATCH",
  });
  assert.deepEqual(decideObservedDossierUpload({ ...base, observedSha256: HASH_B }), {
    accepted: false,
    reason: "HASH_MISMATCH",
  });
  assert.deepEqual(decideObservedDossierUpload({ ...base, observedSha256: "future-hash" }), {
    accepted: false,
    reason: "INVALID_OBSERVATION",
  });
});

test("PDF and DOCX are retained but not extracted; OCR remains deferred", () => {
  for (const mediaType of [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]) {
    assert.deepEqual(decideDossierExtraction(mediaType), {
      accepted: true,
      state: "not_extractable",
      reason: "PARSER_NOT_APPROVED",
      ocr: false,
    });
  }
  assert.deepEqual(decideDossierExtraction("image/png"), {
    accepted: false,
    reason: "UNSUPPORTED_MEDIA_TYPE",
    ocr: false,
  });
  assert.deepEqual(decideDossierExtraction("text/plain", true), {
    accepted: false,
    reason: "OCR_DEFERRED",
    ocr: false,
  });
  assert.throws(() => extractDeterministicDossierText("application/pdf", new Uint8Array()), (error) => (
    error instanceof DossierSecurityError && error.code === "UNSUPPORTED_MEDIA_TYPE"
  ));
});

test("TXT and Markdown use one deterministic strict UTF-8 extraction algorithm", () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("alpha\r\nbeta\rgamma\n")]);
  assert.deepEqual(extractDeterministicDossierText("text/markdown", bytes), {
    state: "ready",
    extractorVersion: "genesis-dossier-strict-utf8-v1",
    text: "alpha\nbeta\ngamma\n",
    characterCount: 17,
    lineEnding: "LF",
    ocr: false,
  });
  assert.throws(() => extractDeterministicDossierText("text/plain", new Uint8Array([0xc3, 0x28])), (error) => (
    error instanceof DossierSecurityError && error.code === "INVALID_UTF8"
  ));
  assert.throws(() => extractDeterministicDossierText("text/plain", new TextEncoder().encode("a\u0000b")), (error) => (
    error instanceof DossierSecurityError && error.code === "INVALID_UTF8"
  ));
});

function commitBinding(overrides: Partial<DossierUploadCommitBinding> = {}): DossierUploadCommitBinding {
  return {
    documentId: DOCUMENT,
    documentVersionId: VERSION,
    objectKey: OBJECT_KEY,
    mediaType: "text/plain",
    byteLength: 100,
    contentSha256: HASH_A,
    ...overrides,
  };
}

function intent(
  overrides: Partial<DossierUploadIntentSnapshot> = {},
): DossierUploadIntentSnapshot {
  return {
    uploadIntentId: INTENT,
    dossierId: DOSSIER_A,
    actorId: CONTRIBUTOR,
    objectKey: OBJECT_KEY,
    state: "pending",
    expectedDossierRevision: 7,
    expiresAtEpochMs: 2_000,
    committedBinding: null,
    ...overrides,
  };
}

function intentDecision(
  operation: DossierUploadIntentDecisionInput["operation"],
  overrides: Partial<DossierUploadIntentDecisionInput> = {},
) {
  return decideDossierUploadIntentTransition({
    operation,
    intent: intent(),
    requestDossierId: DOSSIER_A,
    requestActorId: CONTRIBUTOR,
    nowEpochMs: 1_000,
    currentDossierRevision: 7,
    objectReferenced: false,
    commitBinding: commitBinding(),
    objectDeleteConfirmed: false,
    ...overrides,
  });
}

test("upload commit is an exact pending-state CAS with revision and actor binding", () => {
  assert.deepEqual(intentDecision("commit"), {
    allowed: true,
    result: "transition",
    operation: "commit",
    expectedState: "pending",
    nextState: "committed",
    mustCompareAndSet: true,
    deleteObjectAfterCas: false,
    committedBinding: commitBinding(),
  });
  assert.deepEqual(intentDecision("commit", { currentDossierRevision: 8 }), {
    allowed: false,
    reason: "REVISION_CONFLICT",
  });
  assert.deepEqual(intentDecision("commit", { requestActorId: INTRUDER }), {
    allowed: false,
    reason: "ACTOR_MISMATCH",
  });
  assert.deepEqual(intentDecision("commit", { objectReferenced: true }), {
    allowed: false,
    reason: "OBJECT_ALREADY_REFERENCED",
  });
  assert.deepEqual(intentDecision("commit", { nowEpochMs: 2_000 }), {
    allowed: false,
    reason: "INTENT_EXPIRED",
  });
  assert.deepEqual(intentDecision("commit", { requestDossierId: DOSSIER_B }), {
    allowed: false,
    reason: "CROSS_DOSSIER_REFERENCE",
  });
  assert.deepEqual(intentDecision("commit", {
    commitBinding: commitBinding({ objectKey: dossierObjectKey(DOSSIER_B, INTENT, NONCE) }),
  }), { allowed: false, reason: "CROSS_DOSSIER_REFERENCE" });
});

test("a committed upload retries idempotently only for the exact immutable binding", () => {
  const committedIntent = intent({ state: "committed", committedBinding: commitBinding() });
  assert.deepEqual(intentDecision("commit", {
    intent: committedIntent,
    currentDossierRevision: 99,
  }), {
    allowed: true,
    result: "idempotent",
    operation: "commit",
    state: "committed",
    mustCompareAndSet: false,
    deleteObjectAfterCas: false,
    committedBinding: commitBinding(),
  });
  assert.deepEqual(intentDecision("commit", {
    intent: committedIntent,
    commitBinding: commitBinding({ contentSha256: HASH_B }),
  }), { allowed: false, reason: "IDEMPOTENCY_CONFLICT" });
});

test("cleanup claims expired unreferenced objects before deletion and loses safely to commit", () => {
  assert.deepEqual(intentDecision("claim_cleanup", { nowEpochMs: 1_999 }), {
    allowed: false,
    reason: "INTENT_NOT_EXPIRED",
  });
  assert.deepEqual(intentDecision("claim_cleanup", { nowEpochMs: 2_000, objectReferenced: true }), {
    allowed: false,
    reason: "OBJECT_ALREADY_REFERENCED",
  });
  assert.deepEqual(intentDecision("claim_cleanup", { nowEpochMs: 2_000 }), {
    allowed: true,
    result: "transition",
    operation: "claim_cleanup",
    expectedState: "pending",
    nextState: "deleting",
    mustCompareAndSet: true,
    deleteObjectAfterCas: true,
    committedBinding: null,
  });

  const deletingIntent = intent({ state: "deleting" });
  assert.deepEqual(intentDecision("commit", { intent: deletingIntent }), {
    allowed: false,
    reason: "STATE_CONFLICT",
  });
  assert.deepEqual(intentDecision("claim_cleanup", { intent: deletingIntent, nowEpochMs: 2_000 }), {
    allowed: false,
    reason: "CLEANUP_ALREADY_CLAIMED",
  });

  const committedIntent = intent({ state: "committed", committedBinding: commitBinding() });
  assert.deepEqual(intentDecision("claim_cleanup", { intent: committedIntent, nowEpochMs: 2_000 }), {
    allowed: false,
    reason: "STATE_CONFLICT",
  });
});

test("an explicit upload abort claims an unreferenced pending object before expiry", () => {
  assert.deepEqual(intentDecision("abort", { failureCode: "R2_VERIFICATION_FAILED" }), {
    allowed: true,
    result: "transition",
    operation: "abort",
    expectedState: "pending",
    nextState: "deleting",
    mustCompareAndSet: true,
    deleteObjectAfterCas: true,
    committedBinding: null,
    failureCode: "R2_VERIFICATION_FAILED",
  });
  assert.deepEqual(intentDecision("abort", {
    failureCode: "R2_VERIFICATION_FAILED",
    requestActorId: INTRUDER,
  }), { allowed: false, reason: "ACTOR_MISMATCH" });
  assert.deepEqual(intentDecision("abort", {
    failureCode: "R2_VERIFICATION_FAILED",
    objectReferenced: true,
  }), { allowed: false, reason: "OBJECT_ALREADY_REFERENCED" });
  assert.deepEqual(intentDecision("abort", { failureCode: "r2-failure" }), {
    allowed: false,
    reason: "INVALID_FAILURE_CODE",
  });
  assert.deepEqual(intentDecision("abort", {
    failureCode: "R2_VERIFICATION_FAILED",
    intent: intent({ state: "deleting" }),
  }), { allowed: false, reason: "CLEANUP_ALREADY_CLAIMED" });
  assert.deepEqual(intentDecision("abort", {
    failureCode: "R2_VERIFICATION_FAILED",
    intent: intent({ state: "committed", committedBinding: commitBinding() }),
  }), { allowed: false, reason: "STATE_CONFLICT" });
});

test("expiry and cleanup completion are bounded state transitions with reference rechecks", () => {
  assert.deepEqual(intentDecision("expire", { nowEpochMs: 2_000 }), {
    allowed: true,
    result: "transition",
    operation: "expire",
    expectedState: "pending",
    nextState: "expired",
    mustCompareAndSet: true,
    deleteObjectAfterCas: false,
    committedBinding: null,
  });
  assert.deepEqual(intentDecision("expire", { intent: intent({ state: "expired" }) }), {
    allowed: true,
    result: "idempotent",
    operation: "expire",
    state: "expired",
    mustCompareAndSet: false,
    deleteObjectAfterCas: false,
    committedBinding: null,
  });
  const deletingIntent = intent({ state: "deleting" });
  assert.deepEqual(intentDecision("finish_cleanup", { intent: deletingIntent }), {
    allowed: false,
    reason: "OBJECT_DELETE_NOT_CONFIRMED",
  });
  assert.deepEqual(intentDecision("finish_cleanup", {
    intent: deletingIntent,
    objectDeleteConfirmed: true,
    objectReferenced: true,
  }), { allowed: false, reason: "OBJECT_ALREADY_REFERENCED" });
  assert.deepEqual(intentDecision("finish_cleanup", {
    intent: deletingIntent,
    objectDeleteConfirmed: true,
  }), {
    allowed: true,
    result: "transition",
    operation: "finish_cleanup",
    expectedState: "deleting",
    nextState: "deleted",
    mustCompareAndSet: true,
    deleteObjectAfterCas: false,
    committedBinding: null,
  });
  assert.deepEqual(intentDecision("finish_cleanup", { intent: intent({ state: "deleted" }) }), {
    allowed: true,
    result: "idempotent",
    operation: "finish_cleanup",
    state: "deleted",
    mustCompareAndSet: false,
    deleteObjectAfterCas: false,
    committedBinding: null,
  });
});

test("unknown upload states and operations fail closed", () => {
  assert.deepEqual(intentDecision("future_operation"), {
    allowed: false,
    reason: "UNKNOWN_OPERATION",
  });
  assert.deepEqual(intentDecision("commit", { intent: intent({ state: "uploaded" }) }), {
    allowed: false,
    reason: "INVALID_INTENT",
  });
  assert.deepEqual(intentDecision("commit", { intent: intent({ committedBinding: commitBinding() }) }), {
    allowed: false,
    reason: "INVALID_INTENT",
  });
});

test("download errors are private and missing/unauthorized resources are indistinguishable", () => {
  const missing = decideDossierDownload({ authenticated: true, resourceExists: false, authorized: true });
  const unauthorized = decideDossierDownload({ authenticated: true, resourceExists: true, authorized: false });
  assert.deepEqual(missing, unauthorized);
  assert.deepEqual(missing, {
    allowed: false,
    status: 404,
    code: "NOT_FOUND",
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
  assert.equal(decideDossierDownload({ authenticated: false, resourceExists: true, authorized: true }).status, 401);
  assert.equal(decideDossierDownload({ authenticated: "true", resourceExists: true, authorized: true }).status, 401);
});

test("successful downloads are attachments with exact safe metadata and no object key", () => {
  const decision = decideDossierDownload({
    authenticated: true,
    resourceExists: true,
    authorized: true,
    documentVersionId: VERSION,
    mediaType: "application/pdf",
    byteLength: 12_345,
    contentSha256: HASH_A,
  });
  assert.deepEqual(decision, {
    allowed: true,
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="dossier-document-${VERSION}.pdf"`,
      "Content-Length": "12345",
      "Content-Type": "application/pdf",
      "X-Content-SHA256": HASH_A,
    },
  });
  assert.equal(JSON.stringify(decision).includes(OBJECT_KEY), false);

  assert.deepEqual(decideDossierDownload({
    authenticated: true,
    resourceExists: true,
    authorized: true,
    documentVersionId: VERSION,
    mediaType: "application/pdf",
    byteLength: DOSSIER_MEDIA_POLICIES["application/pdf"].maximumBytes + 1,
    contentSha256: HASH_A,
  }), {
    allowed: false,
    status: 503,
    code: "DOCUMENT_INTEGRITY_UNAVAILABLE",
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
