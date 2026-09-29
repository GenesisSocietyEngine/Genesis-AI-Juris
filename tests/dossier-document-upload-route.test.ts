import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/documents/route.ts", import.meta.url),
  "utf8",
);
const coordinator = readFileSync(
  new URL("../app/dossier-document-upload-coordinator.ts", import.meta.url),
  "utf8",
);

test("upload is same-origin, participant-scoped, bounded, and rejects ambiguous authority", () => {
  assert.match(route, /isSameOriginMutation\(request\)/u);
  assert.match(route, /requireDossierAccess\(context, dossierId, "upload"\)/u);
  assert.match(route, /requireDossierAccess\(context, dossierId, "version"\)/u);
  assert.match(route, /readBoundedDossierFormData/u);
  assert.match(route, /formData\.getAll\(key\)\.length !== 1/u);
  assert.match(route, /ALLOWED_UPLOAD_FIELDS/u);
  assert.match(route, /privacyAcknowledged/u);
  assert.match(route, /expectedDossierRevision/u);
  assert.doesNotMatch(
    route.slice(
      route.indexOf("const ALLOWED_UPLOAD_FIELDS"),
      route.indexOf("type UploadForm"),
    ),
    /actor|owner|role|tenant|organisation|objectReference/u,
  );
});

test("intent is staged before R2 and immutable commit follows exact verification", () => {
  const post = coordinator.slice(
    coordinator.indexOf("export async function executeDossierDocumentUpload"),
    coordinator.indexOf("function documentDownloadUrl"),
  );
  const stage = post.indexOf("stageOrResumeUploadIntent");
  const put = post.indexOf("putVerifiedPrivateObject");
  const commit = post.indexOf("commitUploadIntent");
  const extraction = post.indexOf("runDeterministicExtraction");
  assert.ok(stage >= 0 && stage < put && put < commit && commit < extraction);
  assert.match(coordinator, /isProvisional: true/u);
  assert.match(route, /eq\(dossierDocuments\.isProvisional, false\)/u);
  assert.match(coordinator, /onlyIf: \{ etagDoesNotMatch: "\*" \}/u);
  assert.match(coordinator, /object\.checksums\.sha256/u);
  assert.match(coordinator, /object\.customMetadata\?\.contentSha256/u);
  assert.match(coordinator, /decideDossierUploadIntentTransition/u);
  assert.match(coordinator, /operation: "abort"/u);
  assert.match(coordinator, /state: "deleting",[\s\S]*failureCode: decision\.failureCode/u);
  assert.match(coordinator, /db\.delete\(dossierUploadIntents\)/u);
  assert.match(coordinator, /eq\(dossierUploadIntents\.state, "deleted"\)/u);
  assert.match(coordinator, /finalizeDeletedUploadIntentMetadata/u);
});

test("D1 commit binds version, current pointer, extraction, revision, intent, stale outputs, and audit", () => {
  const commit = coordinator.slice(
    coordinator.indexOf("export async function commitUploadIntent"),
    coordinator.indexOf("async function currentOutputStates"),
  );
  for (const marker of [
    "dossierDocumentVersions",
    "dossierDocumentCurrentVersions",
    "dossierExtractionJobs",
    "dossiers",
    "dossierUploadIntents",
    "dossierOutputStateEvents",
    "dossierRevisionReceipts",
    "dossierAuditEvents",
  ]) {
    assert.match(commit, new RegExp(marker, "u"));
  }
  assert.match(commit, /eq\(dossiers\.revision, input\.form\.expectedRevision\)/u);
  assert.match(commit, /eventType: "document_version_created"/u);
  assert.match(commit, /eventType: "output_marked_stale"/u);
  assert.match(commit, /state: "committed"/u);
  assert.match(commit, /measuredContentSha256: input\.prepared\.contentSha256/u);
});

test("cleanup claims D1 before R2 deletion and extraction publishes result only after ready state", () => {
  const cleanup = coordinator.slice(
    coordinator.indexOf("export async function cleanupUploadIntent"),
    coordinator.indexOf("export async function runDeterministicExtraction"),
  );
  assert.ok(cleanup.indexOf('state: "deleting"') < cleanup.indexOf("bucket.delete"));
  assert.ok(cleanup.indexOf("bucket.delete") < cleanup.indexOf('state: "deleted"'));
  assert.match(cleanup, /objectDeleteConfirmed: true/u);
  assert.match(cleanup, /dossierDocumentVersions\.uploadIntentId/u);

  const extraction = coordinator.slice(
    coordinator.indexOf("export async function runDeterministicExtraction"),
  );
  assert.ok(extraction.indexOf('status: "processing"') < extraction.indexOf("bucket.put"));
  assert.ok(extraction.indexOf('status: "ready"') < extraction.indexOf("dossierExtractionResults"));
  assert.match(extraction, /genesis-dossier-strict-utf8-v1|prepared\.extraction\.extractorVersion/u);
  assert.match(extraction, /bucket\.delete\(derivedObjectKey\)/u);
  assert.match(coordinator, /recoverDossierExtractionJobs/u);
  assert.match(coordinator, /lt\(dossierExtractionJobs\.leaseExpiresAt, now\)/u);
  assert.match(coordinator, /MAX_EXTRACTION_RECOVERIES_PER_REQUEST/u);
  assert.match(coordinator, /await bucket\.get\(candidate\.objectKey\)/u);
});

test("successful response exposes no object references or extracted bodies", () => {
  const response = coordinator.slice(
    coordinator.indexOf("export function uploadResponse"),
    coordinator.indexOf("export async function cleanupExpiredUploadIntents"),
  );
  assert.match(response, /download_url/u);
  assert.match(response, /content_sha256/u);
  assert.doesNotMatch(
    response,
    /temporaryObjectReference|committedObjectReference|binaryObjectReference|extractedText|DOSSIER_DOCUMENTS/u,
  );
});
