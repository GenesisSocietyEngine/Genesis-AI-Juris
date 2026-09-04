import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  caseVersions,
  dossierAssertionSources,
  dossierAuditEvents,
  dossierDecisionPackageReferences,
  dossierDocumentCurrentVersions,
  dossierDocuments,
  dossierDocumentVersions,
  dossierGovernedOutputs,
  dossierOutputApprovals,
  dossierOutputStateEvents,
  dossierParticipants,
  dossierProfessionalAssertions,
  dossierSnapshotAnchors,
  dossierSnapshotAssertions,
  dossierSnapshotDecisionPackages,
  dossierSnapshotDocumentVersions,
  dossierSnapshots,
  dossierSourceAnchors,
  dossiers,
  playEvents,
  playSessions,
} from "../db/schema";
import {
  buildCaseReportArtifacts,
  type CaseReportOptions,
} from "./case-report";
import { casePublicationFingerprint } from "./case-integrity";
import { primaryCaseOutput } from "./case-type-playbooks";
import { reportGraphGovernedTextIssue } from "./report-graph-layout";
import {
  DOSSIER_CONTRACT_SCHEMA_VERSION,
  DOSSIER_CONTRACT_VERSION,
  canonicalDossierJson,
  type DossierGovernedOutputV1,
  type DossierSnapshotV1,
  type JsonValue,
} from "./dossier-contract";
import { computeStoredDossierReadiness } from "./dossier-readiness-server";
import {
  parseSimulationReceiptReferences,
  proveV61SimulationReceipt,
  validatePublishedDecisionPackage,
} from "./dossier-decision-package-integration";
import {
  assertDossierObjectKeyScope,
  dossierObjectKey,
  parseDossierOpaqueId,
} from "./dossier-security";
import {
  canonicalR2Sha256,
  sha256Bytes,
} from "./dossier-private-upload";
import type {
  DossierAuditEventInput,
  DossierServerContext,
} from "./dossier-server";
import type { StudioDraft } from "./types";
import type { Content, ContentTable, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";

export const DOSSIER_SNAPSHOT_MANIFEST_FORMAT =
  "genesis-juris-dossier-snapshot-manifest" as const;
export const DOSSIER_OUTPUT_MANIFEST_FORMAT =
  "genesis-juris-dossier-governed-output-manifest" as const;
export const DOSSIER_REPORT_PROFILE_ID = "dossier-governed-report" as const;
export const DOSSIER_REPORT_MODEL_SCHEMA_VERSION = 1 as const;
export const DOSSIER_REPORT_RENDERER_VERSION = "1.0.0" as const;
export const DOSSIER_REPORT_BUILD_VERSION = "v62-dossier-workspace" as const;
export const DOSSIER_PILOT_SNAPSHOT_AUDIENCE = "internal" as const;
export const DOSSIER_PILOT_REDACTION_PROFILE_ID = "pilot-default" as const;

const MAX_PRIVATE_OBJECT_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_STATE_ROWS = 5_000;
const MAX_SNAPSHOT_AUDIT_RECEIPTS = 10_000;
const MAX_SNAPSHOT_APPROVER_RECORDS = 5_000;
const REPORT_GENERATION_BLOCKERS = new Set([
  "OUTPUT_REQUIRED",
  "OUTPUT_STALE",
  "REVIEWER_APPROVAL_MISSING",
]);

export type DossierGovernedContext = Pick<DossierServerContext, "db" | "actor">;

export type DossierGovernedDependencies = {
  prepareAuditEvents: (
    dossierId: string,
    dossierRevision: number,
    inputs: readonly DossierAuditEventInput[],
  ) => Promise<Array<typeof dossierAuditEvents.$inferInsert>>;
};

export class DossierGovernedError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 503,
    message: string,
  ) {
    super(message);
    this.name = "DossierGovernedError";
  }
}

function assertPilotSnapshotPolicy(audience: string, redactionProfileId: string) {
  if (
    audience !== DOSSIER_PILOT_SNAPSHOT_AUDIENCE
    || redactionProfileId !== DOSSIER_PILOT_REDACTION_PROFILE_ID
  ) {
    throw new DossierGovernedError(
      "snapshot_redaction_unavailable",
      409,
      "The pilot supports only internal snapshots with the pilot-default profile until deterministic, versioned redaction is available.",
    );
  }
}

export type CreateDossierSnapshotInput = {
  context: DossierGovernedContext;
  dependencies: DossierGovernedDependencies;
  bucket: R2Bucket;
  dossierId: string;
  expectedRevision: number;
  locale: string;
  audience: "internal" | "client";
  redactionProfileId: string;
};

export type GenerateDossierOutputInput = {
  context: DossierGovernedContext;
  dependencies: DossierGovernedDependencies;
  bucket: R2Bucket;
  dossierId: string;
  expectedRevision: number;
  snapshotId: string;
  format: "pdf" | "json_manifest" | "markdown";
};

export type ApproveDossierOutputInput = {
  context: DossierGovernedContext;
  dependencies: DossierGovernedDependencies;
  dossierId: string;
  expectedRevision: number;
  outputId: string;
  reviewerParticipantId: string;
};

type StoredSnapshot = typeof dossierSnapshots.$inferSelect;
type StoredOutput = typeof dossierGovernedOutputs.$inferSelect;

type SnapshotStorageManifest = {
  format: typeof DOSSIER_SNAPSHOT_MANIFEST_FORMAT;
  schema_version: 1;
  snapshot: Omit<DossierSnapshotV1, "manifest_digest">;
};

type DossierReportModelV1 = {
  format: typeof DOSSIER_OUTPUT_MANIFEST_FORMAT;
  schema_version: 1;
  profile_id: typeof DOSSIER_REPORT_PROFILE_ID;
  source_manifest_sha256: string;
  dossier: {
    dossier_id: string;
    reference: string;
    title: string;
    status: string;
    revision: number;
    classification: string;
  };
  snapshot: DossierSnapshotV1;
  source_register: Array<{
    document_id: string;
    document_version_id: string;
    title: string;
    document_type: string;
    classification: string;
    media_type: string;
    original_filename: string;
    content_sha256: string;
  }>;
  assertion_register: Array<{
    assertion_id: string;
    assertion_type: string;
    statement: string;
    source_anchor_ids: string[];
  }>;
  anchor_register: Array<{
    source_anchor_id: string;
    document_id: string;
    document_version_id: string;
    page_number: number | null;
    section: string | null;
    heading: string | null;
    paragraph: string | null;
    character_start: number | null;
    character_end: number | null;
    anchor_checksum: string;
  }>;
  decision_package_graphs: Array<{
    decision_package_reference_id: string;
    package_id: string;
    package_version: string;
    package_fingerprint: string;
    studio_fingerprint: string;
    graph_digest: string;
    graph_validation_reference: string;
    draft: StudioDraft;
  }>;
  audit_receipts: Array<{
    audit_event_id: string;
    dossier_revision: number;
    sequence: number;
    event_type: string;
    occurred_at: string;
    previous_event_id: string | null;
    event_digest: string;
  }>;
  generator: {
    report_model_schema_version: 1;
    renderer_version: typeof DOSSIER_REPORT_RENDERER_VERSION;
    build_version: typeof DOSSIER_REPORT_BUILD_VERSION;
  };
};

export function dossierGovernedErrorResponse(error: unknown): Response {
  if (error instanceof DossierGovernedError) {
    return privateJson({ error: error.message, code: error.code }, error.status);
  }
  return privateJson({
    error: "The governed Matter operation could not be completed.",
    code: "governed_operation_failed",
  }, 503);
}

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: privateHeaders(),
  });
}

export function privateHeaders(extra: Record<string, string> = {}) {
  return {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function newOpaqueId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeReceiptIds(value: unknown, label: string): string[] {
  try {
    return parseSimulationReceiptReferences(value);
  } catch {
    throw new DossierGovernedError("invalid_simulation_receipts", 409, `${label} is invalid.`);
  }
}

type SnapshotSimulationReceiptProof = {
  reference: string;
  runtime_state_digest: string;
  parameter_binding_digest: string;
  receipt_digest: string;
};

type SnapshotPackageReceiptProofs = {
  decision_package_reference_id: string;
  package_id: string;
  package_version: string;
  package_fingerprint: string;
  graph_digest: string;
  simulation_receipts: SnapshotSimulationReceiptProof[];
};

type SnapshotPackageGraph = {
  decisionPackageReferenceId: string;
  packageId: string;
  packageVersion: string;
  packageFingerprint: string;
  graphDigest: string;
  studioFingerprint: string;
  graphValidationReference: string;
  draft: StudioDraft;
};

async function validateSnapshotPackageGraphs(
  context: DossierGovernedContext,
  packages: Array<{
    decisionPackageReferenceId: string;
    packageId: string;
    packageVersion: string;
    packageFingerprint: string;
    graphDigest: string;
  }>,
): Promise<SnapshotPackageGraph[]> {
  const validated: SnapshotPackageGraph[] = [];
  for (const item of packages) {
    const [published] = await context.db.select({
      packageId: caseVersions.caseId,
      packageVersion: caseVersions.version,
      packageFingerprint: caseVersions.fingerprint,
      studioFingerprint: caseVersions.studioFingerprint,
      parentPackageId: caseVersions.parentCaseId,
      parentPackageVersion: caseVersions.parentVersion,
      parentPackageFingerprint: caseVersions.parentFingerprint,
      payload: caseVersions.payload,
    }).from(caseVersions).where(and(
      eq(caseVersions.caseId, item.packageId),
      eq(caseVersions.version, item.packageVersion),
      eq(caseVersions.fingerprint, item.packageFingerprint),
      isNotNull(caseVersions.publishedAt),
    )).limit(1);
    if (!published) {
      throw new DossierGovernedError(
        "decision_package_graph_unverified",
        409,
        "Every current decision package must resolve to its exact immutable published case version.",
      );
    }
    const proof = await validatePublishedDecisionPackage(published);
    if (
      !proof.ok
      || proof.value.graphDigest !== item.graphDigest
      || published.studioFingerprint === null
    ) {
      throw new DossierGovernedError(
        "decision_package_graph_unverified",
        409,
        "A current decision package no longer matches its exact published Studio graph and sealed graph digest.",
      );
    }
    validated.push({
      ...item,
      studioFingerprint: published.studioFingerprint,
      graphValidationReference: proof.value.validationReference,
      draft: JSON.parse(JSON.stringify(proof.value.draft)) as StudioDraft,
    });
  }
  return validated;
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function packageBindingsFromSnapshot(snapshot: DossierSnapshotV1) {
  const simulationInputs = jsonObject(snapshot.simulation_inputs);
  const rawPackages = simulationInputs?.decision_packages;
  if (simulationInputs?.schema_version !== 1 || !Array.isArray(rawPackages)) {
    throw new DossierGovernedError(
      "snapshot_package_binding_invalid",
      503,
      "The sealed snapshot package bindings are unavailable.",
    );
  }
  const byReference = new Map<string, Record<string, unknown>>();
  for (const value of rawPackages) {
    const item = jsonObject(value);
    if (
      !item
      || typeof item.decision_package_reference_id !== "string"
      || byReference.has(item.decision_package_reference_id)
    ) {
      throw new DossierGovernedError(
        "snapshot_package_binding_invalid",
        503,
        "The sealed snapshot package bindings are ambiguous.",
      );
    }
    byReference.set(item.decision_package_reference_id, item);
  }
  if (byReference.size !== snapshot.decision_packages.length) {
    throw new DossierGovernedError(
      "snapshot_package_binding_invalid",
      503,
      "The sealed snapshot package set does not match its exact graph bindings.",
    );
  }
  return snapshot.decision_packages.map((item) => {
    const binding = byReference.get(item.decision_package_reference_id);
    if (
      !binding
      || binding.package_id !== item.package_id
      || binding.package_version !== item.package_version
      || binding.graph_digest !== item.graph_digest
      || typeof binding.package_fingerprint !== "string"
      || !/^sha256-[a-f0-9]{64}$/u.test(binding.package_fingerprint)
      || typeof binding.graph_validation_reference !== "string"
      || !/^graph_validation_v1_[a-f0-9]{64}$/u.test(binding.graph_validation_reference)
    ) {
      throw new DossierGovernedError(
        "snapshot_package_binding_invalid",
        503,
        "A sealed snapshot package graph binding is invalid.",
      );
    }
    return {
      decisionPackageReferenceId: item.decision_package_reference_id,
      packageId: item.package_id,
      packageVersion: item.package_version,
      packageFingerprint: binding.package_fingerprint,
      graphDigest: item.graph_digest,
    };
  });
}

function validateSealedAuditReceipts(
  rawEvents: readonly unknown[],
  snapshotRevision: number,
): DossierReportModelV1["audit_receipts"] {
  if (rawEvents.length < 1 || rawEvents.length > MAX_SNAPSHOT_AUDIT_RECEIPTS) {
    throw new DossierGovernedError(
      "snapshot_audit_boundary_invalid",
      503,
      "The sealed snapshot audit boundary is unavailable.",
    );
  }
  const events: DossierReportModelV1["audit_receipts"] = [];
  for (const [index, value] of rawEvents.entries()) {
    const event = jsonObject(value);
    const prior = events[index - 1];
    if (
      !event
      || typeof event.audit_event_id !== "string"
      || typeof event.dossier_revision !== "number"
      || !Number.isSafeInteger(event.dossier_revision)
      || event.dossier_revision < 1
      || event.dossier_revision > snapshotRevision
      || event.sequence !== index + 1
      || typeof event.event_type !== "string"
      || typeof event.occurred_at !== "string"
      || new Date(event.occurred_at).toISOString() !== event.occurred_at
      || (event.previous_event_id !== null && typeof event.previous_event_id !== "string")
      || event.previous_event_id !== (prior?.audit_event_id ?? null)
      || typeof event.event_digest !== "string"
      || !/^sha256-[a-f0-9]{64}$/u.test(event.event_digest)
    ) {
      throw new DossierGovernedError(
        "snapshot_audit_boundary_invalid",
        503,
        "The sealed snapshot audit receipt chain is invalid.",
      );
    }
    events.push({
      audit_event_id: event.audit_event_id,
      dossier_revision: event.dossier_revision,
      sequence: event.sequence,
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      previous_event_id: event.previous_event_id,
      event_digest: event.event_digest,
    });
  }
  return events;
}

function sealedAuditReceiptsFromSnapshot(
  snapshot: DossierSnapshotV1,
): DossierReportModelV1["audit_receipts"] {
  const deterministic = jsonObject(snapshot.deterministic_receipts);
  const auditChain = jsonObject(deterministic?.audit_chain);
  const rawEvents = auditChain?.events;
  if (deterministic?.schema_version !== 1 || !Array.isArray(rawEvents)) {
    throw new DossierGovernedError(
      "snapshot_audit_boundary_invalid",
      503,
      "The sealed snapshot audit boundary is unavailable.",
    );
  }
  const events = validateSealedAuditReceipts(rawEvents, snapshot.dossier_revision);
  const head = jsonObject(auditChain?.head);
  const last = events.at(-1)!;
  if (
    auditChain?.through_sequence !== last.sequence
    || head?.audit_event_id !== last.audit_event_id
    || head.event_digest !== last.event_digest
    || head.dossier_revision !== last.dossier_revision
  ) {
    throw new DossierGovernedError(
      "snapshot_audit_boundary_invalid",
      503,
      "The sealed snapshot audit head does not match its bounded receipt chain.",
    );
  }
  return events;
}

async function proveSnapshotSimulationReceipts(
  context: DossierGovernedContext,
  packages: Array<{
    decisionPackageReferenceId: string;
    packageId: string;
    packageVersion: string;
    packageFingerprint: string;
    graphDigest: string;
    simulationReceiptIds: string[];
  }>,
): Promise<SnapshotPackageReceiptProofs[]> {
  const references = packages.flatMap(({ simulationReceiptIds }) => simulationReceiptIds);
  if (new Set(references).size !== references.length) {
    throw new DossierGovernedError(
      "simulation_receipt_replay",
      409,
      "A v61 simulation receipt may bind only one current decision package in a sealed snapshot.",
    );
  }
  const sessions = await context.db.select({
    id: playSessions.id,
    sessionKey: playSessions.sessionKey,
    userEmail: playSessions.userEmail,
    caseId: playSessions.caseId,
    caseVersion: playSessions.caseVersion,
    caseFingerprint: playSessions.caseFingerprint,
    state: playSessions.state,
    status: playSessions.status,
    revision: playSessions.revision,
    startedAt: playSessions.startedAt,
    completedAt: playSessions.completedAt,
  }).from(playSessions)
    .where(inArray(playSessions.sessionKey, references))
    .limit(references.length + 1);
  if (sessions.length !== references.length) {
    throw new DossierGovernedError(
      "simulation_receipt_unverified",
      409,
      "Every referenced v61 simulation receipt must exist and independently re-prove before snapshot sealing.",
    );
  }
  const sessionIds = sessions.map(({ id }) => id);
  const eventSummaries = await context.db.select({
    playSessionId: playEvents.playSessionId,
    eventCount: sql<number>`count(*)`,
    minimumEventSequence: sql<number | null>`min(${playEvents.sequence})`,
    maximumEventSequence: sql<number | null>`max(${playEvents.sequence})`,
    startEventCount: sql<number>`sum(case when ${playEvents.sequence} = 0 and ${playEvents.eventType} = 'session_started' then 1 else 0 end)`,
  }).from(playEvents).where(inArray(playEvents.playSessionId, sessionIds))
    .groupBy(playEvents.playSessionId)
    .limit(references.length + 1);
  const summaryBySession = new Map(eventSummaries.map((summary) => [
    summary.playSessionId,
    summary,
  ]));
  const sessionByReference = new Map(sessions.map((session) => [
    session.sessionKey,
    session,
  ]));
  const result: SnapshotPackageReceiptProofs[] = [];
  for (const item of packages) {
    const proofs: SnapshotSimulationReceiptProof[] = [];
    for (const reference of item.simulationReceiptIds) {
      const session = sessionByReference.get(reference);
      const summary = session ? summaryBySession.get(session.id) : undefined;
      if (!session || !summary) {
        throw new DossierGovernedError(
          "simulation_receipt_unverified",
          409,
          "Every referenced v61 simulation receipt must have one complete persisted event sequence.",
        );
      }
      const proof = await proveV61SimulationReceipt({
        sessionKey: session.sessionKey,
        userEmail: session.userEmail,
        caseId: session.caseId,
        caseVersion: session.caseVersion,
        caseFingerprint: session.caseFingerprint,
        state: session.state,
        status: session.status,
        revision: session.revision,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        eventCount: Number(summary.eventCount),
        minimumEventSequence: summary.minimumEventSequence === null
          ? null
          : Number(summary.minimumEventSequence),
        maximumEventSequence: summary.maximumEventSequence === null
          ? null
          : Number(summary.maximumEventSequence),
        startEventCount: Number(summary.startEventCount),
      }, {
        userEmail: session.userEmail,
        packageId: item.packageId,
        packageVersion: item.packageVersion,
        packageFingerprint: item.packageFingerprint,
      });
      if (!proof.ok || proof.reference !== reference) {
        throw new DossierGovernedError(
          "simulation_receipt_unverified",
          409,
          "A referenced v61 simulation receipt does not match the exact current decision package and completed runtime state.",
        );
      }
      proofs.push({
        reference: proof.reference,
        runtime_state_digest: proof.runtimeStateDigest,
        parameter_binding_digest: proof.parameterBindingDigest,
        receipt_digest: proof.receiptDigest,
      });
    }
    result.push({
      decision_package_reference_id: item.decisionPackageReferenceId,
      package_id: item.packageId,
      package_version: item.packageVersion,
      package_fingerprint: item.packageFingerprint,
      graph_digest: item.graphDigest,
      simulation_receipts: proofs,
    });
  }
  return result;
}

function snapshotStorageManifest(snapshot: DossierSnapshotV1): SnapshotStorageManifest {
  const content = { ...snapshot };
  Reflect.deleteProperty(content, "manifest_digest");
  return {
    format: DOSSIER_SNAPSHOT_MANIFEST_FORMAT,
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    snapshot: content,
  };
}

async function putVerifiedPrivateObject(input: {
  bucket: R2Bucket;
  key: string;
  dossierId: string;
  objectId: string;
  bytes: Uint8Array;
  mediaType: string;
  contentSha256: string;
  customMetadata: Record<string, string>;
}) {
  assertDossierObjectKeyScope(input.key, input.dossierId, input.objectId);
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_PRIVATE_OBJECT_BYTES) {
    throw new DossierGovernedError("private_object_size", 413, "The governed output exceeds the private object limit.");
  }
  const checksum = await crypto.subtle.digest("SHA-256", input.bytes.slice().buffer);
  const stored = await input.bucket.put(input.key, input.bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: input.mediaType },
    customMetadata: {
      ...input.customMetadata,
      contentSha256: input.contentSha256,
    },
    sha256: checksum,
  });
  if (!stored) {
    throw new DossierGovernedError("private_object_collision", 503, "Private object storage rejected a non-guessable object key.");
  }
  if (
    stored.size !== input.bytes.byteLength
    || stored.httpMetadata?.contentType !== input.mediaType
    || stored.customMetadata?.contentSha256 !== input.contentSha256
    || canonicalR2Sha256(stored.checksums.sha256) !== input.contentSha256
  ) {
    await input.bucket.delete(input.key);
    throw new DossierGovernedError("private_object_integrity", 503, "Private object storage failed integrity verification.");
  }
}

async function deleteVerifiedPrivateObject(bucket: R2Bucket, key: string) {
  await bucket.delete(key);
  if (await bucket.head(key)) {
    await bucket.delete(key);
    if (await bucket.head(key)) {
      throw new DossierGovernedError(
        "private_object_cleanup_failed",
        503,
        "Private object cleanup could not be verified after the metadata transaction failed.",
      );
    }
  }
}

async function readVerifiedPrivateObject(input: {
  bucket: R2Bucket;
  key: string;
  dossierId: string;
  objectId: string;
  contentSha256: string;
  mediaType: string;
  byteLength?: number;
  customMetadata: Record<string, string>;
}) {
  assertDossierObjectKeyScope(input.key, input.dossierId, input.objectId);
  const object = await input.bucket.get(input.key);
  if (!object) {
    throw new DossierGovernedError("private_object_unavailable", 503, "The governed private object is unavailable.");
  }
  if (
    object.size < 1
    || object.size > MAX_PRIVATE_OBJECT_BYTES
    || (input.byteLength !== undefined && object.size !== input.byteLength)
    || object.httpMetadata?.contentType !== input.mediaType
    || object.customMetadata?.contentSha256 !== input.contentSha256
    || canonicalR2Sha256(object.checksums.sha256) !== input.contentSha256
    || Object.entries(input.customMetadata).some(([key, value]) =>
      object.customMetadata?.[key] !== value
    )
  ) {
    throw new DossierGovernedError("private_object_integrity", 503, "The governed private object failed metadata verification.");
  }
  const bytes = new Uint8Array(await object.arrayBuffer());
  const measured = (await sha256Bytes(bytes)).contentSha256;
  if (bytes.byteLength !== object.size || measured !== input.contentSha256) {
    throw new DossierGovernedError("private_object_integrity", 503, "The governed private object failed content verification.");
  }
  return bytes;
}

function outputMediaType(format: GenerateDossierOutputInput["format"]) {
  switch (format) {
    case "pdf": return "application/pdf";
    case "markdown": return "text/markdown; charset=utf-8";
    case "json_manifest": return "application/json; charset=utf-8";
  }
}

function safeFilenamePart(value: string) {
  const ascii = value.normalize("NFKD").replaceAll(/[^A-Za-z0-9_-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "").slice(0, 80);
  return ascii || "matter";
}

function outputFilename(reference: string, snapshotId: string, format: GenerateDossierOutputInput["format"]) {
  const extension = format === "json_manifest" ? "json" : format === "markdown" ? "md" : "pdf";
  return `${safeFilenamePart(reference)}-${safeFilenamePart(snapshotId).slice(-24)}.${extension}`;
}

function outputDownloadUrl(dossierId: string, outputId: string) {
  return `/api/dossiers/${encodeURIComponent(dossierId)}/outputs/${encodeURIComponent(outputId)}/download`;
}

function manifestDownloadUrl(dossierId: string, snapshotId: string) {
  return `/api/dossiers/${encodeURIComponent(dossierId)}/snapshots/${encodeURIComponent(snapshotId)}/manifest`;
}

function contentDisposition(filename: string) {
  const safe = filename.replaceAll(/[^A-Za-z0-9._-]/gu, "-").slice(0, 255) || "dossier-output.bin";
  return `attachment; filename="${safe}"`;
}

export async function createDossierSnapshot(input: CreateDossierSnapshotInput) {
  const dossierId = parseDossierOpaqueId(input.dossierId, "snapshot dossier ID");
  assertPilotSnapshotPolicy(input.audience, input.redactionProfileId);
  const [dossier] = await input.context.db.select().from(dossiers).where(eq(dossiers.id, dossierId)).limit(1);
  if (!dossier) throw new DossierGovernedError("matter_not_found", 404, "Matter not found.");
  if (dossier.revision !== input.expectedRevision) {
    throw new DossierGovernedError("revision_conflict", 409, "The Matter changed before this snapshot was created.");
  }

  const createdAt = nowIso();
  const readiness = await computeStoredDossierReadiness({
    db: input.context.db,
    dossierId,
    dossierRevision: dossier.revision,
    keyDeadlineAt: dossier.keyDeadlineAt,
    evaluatedAt: createdAt,
  });
  const blockers = readiness.dimensions.flatMap(({ reasons }) => reasons)
    .filter(({ code }) => !REPORT_GENERATION_BLOCKERS.has(code));
  if (blockers.length > 0) {
    throw new DossierGovernedError(
      "snapshot_not_ready",
      409,
      `The Matter is not ready to seal for reporting (${blockers.map(({ code }) => code).join(", ")}).`,
    );
  }

  const [documentVersions, assertions, anchors, packageRows, approvalRows, auditRows] = await Promise.all([
    input.context.db.select({
      documentId: dossierDocumentCurrentVersions.documentId,
      documentVersionId: dossierDocumentCurrentVersions.documentVersionId,
      contentSha256: dossierDocumentVersions.contentSha256,
    }).from(dossierDocumentCurrentVersions).innerJoin(dossierDocumentVersions, and(
      eq(dossierDocumentVersions.dossierId, dossierDocumentCurrentVersions.dossierId),
      eq(dossierDocumentVersions.documentId, dossierDocumentCurrentVersions.documentId),
      eq(dossierDocumentVersions.id, dossierDocumentCurrentVersions.documentVersionId),
    )).where(eq(dossierDocumentCurrentVersions.dossierId, dossierId))
      .orderBy(asc(dossierDocumentCurrentVersions.documentId)),
    input.context.db.select({ id: dossierProfessionalAssertions.id })
      .from(dossierProfessionalAssertions).where(and(
        eq(dossierProfessionalAssertions.dossierId, dossierId),
        eq(dossierProfessionalAssertions.status, "accepted"),
      )).orderBy(asc(dossierProfessionalAssertions.id)),
    input.context.db.select({ id: dossierSourceAnchors.id })
      .from(dossierSourceAnchors).where(and(
        eq(dossierSourceAnchors.dossierId, dossierId),
        eq(dossierSourceAnchors.reviewState, "accepted"),
      )).orderBy(asc(dossierSourceAnchors.id)),
    input.context.db.select({
      decisionPackageReferenceId: dossierDecisionPackageReferences.id,
      packageId: dossierDecisionPackageReferences.packageId,
      packageVersion: dossierDecisionPackageReferences.packageVersion,
      packageFingerprint: dossierDecisionPackageReferences.packageFingerprint,
      graphValidationStatus: dossierDecisionPackageReferences.graphValidationStatus,
      graphDigest: dossierDecisionPackageReferences.graphDigest,
      simulationRunReferences: dossierDecisionPackageReferences.simulationRunReferences,
      approvalState: dossierDecisionPackageReferences.approvalState,
    }).from(dossierDecisionPackageReferences).where(and(
      eq(dossierDecisionPackageReferences.dossierId, dossierId),
      eq(dossierDecisionPackageReferences.state, "current"),
    )).orderBy(asc(dossierDecisionPackageReferences.id)),
    input.context.db.select({
      reviewerActorId: dossierOutputApprovals.reviewerActorRef,
      approvedAt: dossierOutputApprovals.approvedAt,
      outputId: dossierOutputApprovals.outputId,
    }).from(dossierOutputApprovals)
      .innerJoin(dossierGovernedOutputs, and(
        eq(dossierGovernedOutputs.dossierId, dossierOutputApprovals.dossierId),
        eq(dossierGovernedOutputs.id, dossierOutputApprovals.outputId),
      ))
      .innerJoin(dossierSnapshots, and(
        eq(dossierSnapshots.dossierId, dossierGovernedOutputs.dossierId),
        eq(dossierSnapshots.id, dossierGovernedOutputs.snapshotId),
      ))
      .where(and(
        eq(dossierOutputApprovals.dossierId, dossierId),
        eq(dossierSnapshots.dossierRevision, dossier.revision),
      )).orderBy(
        asc(dossierOutputApprovals.approvedAt),
        asc(dossierOutputApprovals.outputId),
        asc(dossierOutputApprovals.id),
      ).limit(MAX_SNAPSHOT_APPROVER_RECORDS + 1),
    input.context.db.select({
      auditEventId: dossierAuditEvents.id,
      dossierRevision: dossierAuditEvents.dossierRevision,
      sequence: dossierAuditEvents.sequence,
      eventType: dossierAuditEvents.eventType,
      occurredAt: dossierAuditEvents.occurredAt,
      previousEventId: dossierAuditEvents.previousEventId,
      eventDigest: dossierAuditEvents.eventDigest,
    }).from(dossierAuditEvents)
      .where(eq(dossierAuditEvents.dossierId, dossierId))
      .orderBy(asc(dossierAuditEvents.sequence))
      .limit(MAX_SNAPSHOT_AUDIT_RECEIPTS + 1),
  ]);

  if (approvalRows.length > MAX_SNAPSHOT_APPROVER_RECORDS) {
    throw new DossierGovernedError(
      "snapshot_approver_boundary_too_large",
      413,
      "The exact approver-record boundary is too large to seal in one governed snapshot.",
    );
  }

  const decisionPackages = packageRows.map((item) => ({
    decision_package_reference_id: item.decisionPackageReferenceId,
    package_id: item.packageId,
    package_version: item.packageVersion,
    graph_digest: item.graphDigest,
    simulation_receipt_ids: normalizeReceiptIds(
      item.simulationRunReferences,
      `Simulation receipts for ${item.decisionPackageReferenceId}`,
    ),
  }));
  const invalidPackage = packageRows.find((item, index) =>
    item.graphValidationStatus !== "valid"
    || item.approvalState !== "published"
    || decisionPackages[index]!.simulation_receipt_ids.length === 0
  );
  if (invalidPackage) {
    throw new DossierGovernedError(
      "decision_package_not_ready",
      409,
      "Every current decision package must be published, deterministically valid, and simulation-receipt bound before snapshot sealing.",
    );
  }
  const simulationProofs = await proveSnapshotSimulationReceipts(
    input.context,
    packageRows.map((item, index) => ({
      decisionPackageReferenceId: item.decisionPackageReferenceId,
      packageId: item.packageId,
      packageVersion: item.packageVersion,
      packageFingerprint: item.packageFingerprint,
      graphDigest: item.graphDigest,
      simulationReceiptIds: decisionPackages[index]!.simulation_receipt_ids,
    })),
  );
  const packageGraphs = await validateSnapshotPackageGraphs(
    input.context,
    packageRows.map((item) => ({
      decisionPackageReferenceId: item.decisionPackageReferenceId,
      packageId: item.packageId,
      packageVersion: item.packageVersion,
      packageFingerprint: item.packageFingerprint,
      graphDigest: item.graphDigest,
    })),
  );
  const simulationProofByReference = new Map(simulationProofs.map((item) => [
    item.decision_package_reference_id,
    item,
  ]));
  const sealedPackageBindings = packageGraphs.map((graph) => {
    const receiptProof = simulationProofByReference.get(graph.decisionPackageReferenceId);
    if (!receiptProof) {
      throw new DossierGovernedError(
        "simulation_receipt_unverified",
        503,
        "The exact simulation receipt proof is unavailable for a validated package graph.",
      );
    }
    return {
      decision_package_reference_id: graph.decisionPackageReferenceId,
      package_id: graph.packageId,
      package_version: graph.packageVersion,
      package_fingerprint: graph.packageFingerprint,
      studio_fingerprint: graph.studioFingerprint,
      graph_digest: graph.graphDigest,
      graph_validation_reference: graph.graphValidationReference,
      simulation_runs: receiptProof.simulation_receipts.map((proof) => ({
        reference: proof.reference,
        parameter_binding_digest: proof.parameter_binding_digest,
      })),
    };
  });
  const sealedAuditReceipts = validateSealedAuditReceipts(auditRows.map((item) => ({
    audit_event_id: item.auditEventId,
    dossier_revision: item.dossierRevision,
    sequence: item.sequence,
    event_type: item.eventType,
    occurred_at: item.occurredAt,
    previous_event_id: item.previousEventId,
    event_digest: item.eventDigest,
  })), dossier.revision);
  const auditHead = sealedAuditReceipts.at(-1)!;

  const snapshotId = newOpaqueId("snapshot");
  const manifestObjectReference = dossierObjectKey(dossierId, snapshotId, randomHex(32));
  const commonSnapshot = {
    object_type: "dossier_snapshot" as const,
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    snapshot_id: snapshotId,
    dossier_id: dossierId,
    dossier_revision: dossier.revision,
    document_versions: documentVersions.map((item) => ({
      document_id: item.documentId,
      document_version_id: item.documentVersionId,
      content_sha256: item.contentSha256,
    })),
    accepted_assertion_ids: assertions.map(({ id }) => id),
    source_anchor_ids: anchors.map(({ id }) => id),
    decision_packages: decisionPackages,
    simulation_inputs: {
      schema_version: 1,
      decision_packages: sealedPackageBindings,
    } satisfies JsonValue,
    deterministic_receipts: {
      schema_version: 1,
      decision_packages: simulationProofs.map((item) => ({
        decision_package_reference_id: item.decision_package_reference_id,
        package_id: item.package_id,
        package_version: item.package_version,
        package_fingerprint: item.package_fingerprint,
        graph_validation_status: "valid",
        graph_digest: item.graph_digest,
        graph_validation_reference: sealedPackageBindings.find((binding) =>
          binding.decision_package_reference_id === item.decision_package_reference_id
        )!.graph_validation_reference,
        simulation_receipts: item.simulation_receipts,
      })),
      audit_chain: {
        through_sequence: auditHead.sequence,
        head: {
          audit_event_id: auditHead.audit_event_id,
          dossier_revision: auditHead.dossier_revision,
          event_digest: auditHead.event_digest,
        },
        events: sealedAuditReceipts,
      },
    } satisfies JsonValue,
    status: dossier.status as DossierSnapshotV1["status"],
    readiness,
    approver_records: approvalRows.map((item) => ({
      reviewer_actor_id: item.reviewerActorId,
      approved_at: item.approvedAt,
      output_id: item.outputId,
    })),
    locale: input.locale,
    audience: input.audience,
    classification: dossier.classification as DossierSnapshotV1["classification"],
    redaction_profile_id: input.redactionProfileId,
    generator: {
      contract_version: DOSSIER_CONTRACT_VERSION,
      report_model_schema_version: DOSSIER_REPORT_MODEL_SCHEMA_VERSION,
      renderer_version: DOSSIER_REPORT_RENDERER_VERSION,
      build_version: DOSSIER_REPORT_BUILD_VERSION,
    },
    created_at: createdAt,
    created_by: input.context.actor.actorId,
  } satisfies Omit<DossierSnapshotV1, "manifest_digest">;
  const storageManifest = {
    format: DOSSIER_SNAPSHOT_MANIFEST_FORMAT,
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    snapshot: commonSnapshot,
  } satisfies SnapshotStorageManifest;
  const manifestBytes = new TextEncoder().encode(canonicalDossierJson(storageManifest));
  const manifestDigest = (await sha256Bytes(manifestBytes)).contentSha256;
  const snapshot: DossierSnapshotV1 = { ...commonSnapshot, manifest_digest: manifestDigest };
  const auditEvents = await input.dependencies.prepareAuditEvents(dossierId, dossier.revision, [{
    actorRole: await currentActorRole(input.context, dossierId),
    eventType: "snapshot_created",
    objectRefType: "dossier_snapshot",
    objectRefId: snapshotId,
    summaryCode: "DOSSIER_SNAPSHOT_CREATED",
    detail: {
      dossier_revision: dossier.revision,
      manifest_digest: manifestDigest,
      document_version_count: documentVersions.length,
      accepted_assertion_count: assertions.length,
      accepted_anchor_count: anchors.length,
      decision_package_count: decisionPackages.length,
      simulation_receipt_count: simulationProofs.reduce(
        (count, item) => count + item.simulation_receipts.length,
        0,
      ),
      simulation_receipt_digests: simulationProofs.flatMap((item) =>
        item.simulation_receipts.map(({ receipt_digest }) => receipt_digest)
      ),
      graph_validation_references: sealedPackageBindings.map((item) =>
        item.graph_validation_reference
      ),
      audit_chain_through_sequence: auditHead.sequence,
      audit_chain_head_digest: auditHead.event_digest,
      audience: input.audience,
      classification: dossier.classification,
      redaction_profile_id: input.redactionProfileId,
    },
    occurredAt: createdAt,
  }]);

  await putVerifiedPrivateObject({
    bucket: input.bucket,
    key: manifestObjectReference,
    dossierId,
    objectId: snapshotId,
    bytes: manifestBytes,
    mediaType: "application/json; charset=utf-8",
    contentSha256: manifestDigest,
    customMetadata: {
      kind: "dossier_snapshot_manifest",
      snapshotId,
      dossierRevision: String(dossier.revision),
      contractVersion: DOSSIER_CONTRACT_VERSION,
    },
  });

  const snapshotRow = {
    id: snapshotId,
    dossierId,
    dossierRevision: dossier.revision,
    simulationInputs: commonSnapshot.simulation_inputs,
    deterministicReceipts: commonSnapshot.deterministic_receipts,
    status: dossier.status,
    readiness,
    approverRecords: commonSnapshot.approver_records,
    locale: input.locale,
    audience: input.audience,
    classification: dossier.classification,
    redactionProfileId: input.redactionProfileId,
    contractVersion: DOSSIER_CONTRACT_VERSION,
    reportModelSchemaVersion: DOSSIER_REPORT_MODEL_SCHEMA_VERSION,
    rendererVersion: DOSSIER_REPORT_RENDERER_VERSION,
    buildVersion: DOSSIER_REPORT_BUILD_VERSION,
    manifestObjectReference,
    manifestByteLength: manifestBytes.byteLength,
    manifestDigest,
    sealed: false,
    sealedAt: null,
    sealedByActorRef: null,
    createdByActorRef: input.context.actor.actorId,
    createdAt,
  } satisfies typeof dossierSnapshots.$inferInsert;
  const statements = [
    input.context.db.insert(dossierSnapshots).values(snapshotRow),
    ...documentVersions.map((item) => input.context.db.insert(dossierSnapshotDocumentVersions).values({
      dossierId,
      snapshotId,
      documentId: item.documentId,
      documentVersionId: item.documentVersionId,
      contentSha256: item.contentSha256,
    })),
    ...assertions.map(({ id }) => input.context.db.insert(dossierSnapshotAssertions).values({
      dossierId,
      snapshotId,
      assertionId: id,
    })),
    ...anchors.map(({ id }) => input.context.db.insert(dossierSnapshotAnchors).values({
      dossierId,
      snapshotId,
      sourceAnchorId: id,
    })),
    ...decisionPackages.map((item) => input.context.db.insert(dossierSnapshotDecisionPackages).values({
      dossierId,
      snapshotId,
      decisionPackageReferenceId: item.decision_package_reference_id,
      packageId: item.package_id,
      packageVersion: item.package_version,
      graphDigest: item.graph_digest,
      simulationReceiptIds: item.simulation_receipt_ids,
    })),
    input.context.db.update(dossierSnapshots).set({
      sealed: true,
      sealedAt: createdAt,
      sealedByActorRef: input.context.actor.actorId,
    }).where(and(
      eq(dossierSnapshots.dossierId, dossierId),
      eq(dossierSnapshots.id, snapshotId),
      eq(dossierSnapshots.sealed, false),
    )),
    ...auditEvents.map((event) => input.context.db.insert(dossierAuditEvents).values(event)),
  ];
  try {
    await input.context.db.batch([statements[0]!, ...statements.slice(1)]);
  } catch {
    await deleteVerifiedPrivateObject(input.bucket, manifestObjectReference);
    throw new DossierGovernedError(
      "snapshot_conflict",
      409,
      "The Matter changed before the exact snapshot manifest could be sealed.",
    );
  }

  return {
    snapshot,
    manifest_download_url: manifestDownloadUrl(dossierId, snapshotId),
  };
}

export async function listDossierSnapshots(context: DossierGovernedContext, dossierIdValue: string) {
  const dossierId = parseDossierOpaqueId(dossierIdValue, "snapshot dossier ID");
  const rows = await context.db.select().from(dossierSnapshots)
    .where(eq(dossierSnapshots.dossierId, dossierId))
    .orderBy(desc(dossierSnapshots.createdAt), desc(dossierSnapshots.id))
    .limit(100);
  const snapshots = [];
  for (const row of rows) {
    const snapshot = await loadSnapshotProjection(context, row);
    snapshots.push({
      ...snapshot,
      manifest_download_url: manifestDownloadUrl(dossierId, row.id),
    });
  }
  return snapshots;
}

export async function downloadDossierSnapshotManifest(input: {
  context: DossierGovernedContext;
  bucket: R2Bucket;
  dossierId: string;
  snapshotId: string;
}) {
  const dossierId = parseDossierOpaqueId(input.dossierId, "snapshot dossier ID");
  const snapshotId = parseDossierOpaqueId(input.snapshotId, "snapshot ID");
  const [record] = await input.context.db.select().from(dossierSnapshots).where(and(
    eq(dossierSnapshots.dossierId, dossierId),
    eq(dossierSnapshots.id, snapshotId),
    eq(dossierSnapshots.sealed, true),
  )).limit(1);
  if (!record) throw new DossierGovernedError("snapshot_not_found", 404, "Snapshot not found.");
  assertPilotSnapshotPolicy(record.audience, record.redactionProfileId);
  const snapshot = await loadSnapshotProjection(input.context, record);
  const bytes = await readAndVerifySnapshotManifest(input.bucket, record, snapshot);
  return new Response(bytes, {
    status: 200,
    headers: privateHeaders({
      "Content-Disposition": contentDisposition(`dossier-snapshot-${snapshotId}.json`),
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-SHA256": record.manifestDigest,
      "X-Dossier-Snapshot-ID": snapshotId,
    }),
  });
}

async function currentActorRole(context: DossierGovernedContext, dossierId: string) {
  const [participant] = await context.db.select({ role: dossierParticipants.role })
    .from(dossierParticipants).where(and(
      eq(dossierParticipants.dossierId, dossierId),
      eq(dossierParticipants.userId, context.actor.userId),
      eq(dossierParticipants.actorId, context.actor.actorId),
      eq(dossierParticipants.status, "active"),
    )).limit(1);
  if (
    !participant
    || !["owner", "contributor", "reviewer", "viewer"].includes(participant.role)
  ) {
    throw new DossierGovernedError("matter_not_found", 404, "Matter not found.");
  }
  return participant.role as "owner" | "contributor" | "reviewer" | "viewer";
}

async function loadSnapshotProjection(context: DossierGovernedContext, record: StoredSnapshot) {
  const [documents, assertions, anchors, packages] = await Promise.all([
    context.db.select().from(dossierSnapshotDocumentVersions).where(and(
      eq(dossierSnapshotDocumentVersions.dossierId, record.dossierId),
      eq(dossierSnapshotDocumentVersions.snapshotId, record.id),
    )).orderBy(asc(dossierSnapshotDocumentVersions.documentId)),
    context.db.select().from(dossierSnapshotAssertions).where(and(
      eq(dossierSnapshotAssertions.dossierId, record.dossierId),
      eq(dossierSnapshotAssertions.snapshotId, record.id),
    )).orderBy(asc(dossierSnapshotAssertions.assertionId)),
    context.db.select().from(dossierSnapshotAnchors).where(and(
      eq(dossierSnapshotAnchors.dossierId, record.dossierId),
      eq(dossierSnapshotAnchors.snapshotId, record.id),
    )).orderBy(asc(dossierSnapshotAnchors.sourceAnchorId)),
    context.db.select().from(dossierSnapshotDecisionPackages).where(and(
      eq(dossierSnapshotDecisionPackages.dossierId, record.dossierId),
      eq(dossierSnapshotDecisionPackages.snapshotId, record.id),
    )).orderBy(asc(dossierSnapshotDecisionPackages.decisionPackageReferenceId)),
  ]);
  return {
    object_type: "dossier_snapshot",
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    snapshot_id: record.id,
    dossier_id: record.dossierId,
    dossier_revision: record.dossierRevision,
    document_versions: documents.map((item) => ({
      document_id: item.documentId,
      document_version_id: item.documentVersionId,
      content_sha256: item.contentSha256,
    })),
    accepted_assertion_ids: assertions.map(({ assertionId }) => assertionId),
    source_anchor_ids: anchors.map(({ sourceAnchorId }) => sourceAnchorId),
    decision_packages: packages.map((item) => ({
      decision_package_reference_id: item.decisionPackageReferenceId,
      package_id: item.packageId,
      package_version: item.packageVersion,
      graph_digest: item.graphDigest,
      simulation_receipt_ids: [...item.simulationReceiptIds],
    })),
    simulation_inputs: record.simulationInputs as JsonValue,
    deterministic_receipts: record.deterministicReceipts as JsonValue,
    status: record.status as DossierSnapshotV1["status"],
    readiness: record.readiness as DossierSnapshotV1["readiness"],
    approver_records: record.approverRecords,
    locale: record.locale,
    audience: record.audience as DossierSnapshotV1["audience"],
    classification: record.classification as DossierSnapshotV1["classification"],
    redaction_profile_id: record.redactionProfileId,
    generator: {
      contract_version: record.contractVersion,
      report_model_schema_version: record.reportModelSchemaVersion,
      renderer_version: record.rendererVersion,
      build_version: record.buildVersion,
    },
    manifest_digest: record.manifestDigest,
    created_at: record.createdAt,
    created_by: record.createdByActorRef,
  } as DossierSnapshotV1;
}

async function readAndVerifySnapshotManifest(
  bucket: R2Bucket,
  record: StoredSnapshot,
  snapshot: DossierSnapshotV1,
) {
  const bytes = await readVerifiedPrivateObject({
    bucket,
    key: record.manifestObjectReference,
    dossierId: record.dossierId,
    objectId: record.id,
    contentSha256: record.manifestDigest,
    mediaType: "application/json; charset=utf-8",
    byteLength: record.manifestByteLength,
    customMetadata: {
      kind: "dossier_snapshot_manifest",
      snapshotId: record.id,
      dossierRevision: String(record.dossierRevision),
      contractVersion: record.contractVersion,
    },
  });
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new DossierGovernedError("snapshot_manifest_invalid", 503, "The snapshot manifest is not valid canonical UTF-8 JSON.");
  }
  const expected = snapshotStorageManifest(snapshot);
  if (canonicalDossierJson(parsed) !== text || canonicalDossierJson(parsed) !== canonicalDossierJson(expected)) {
    throw new DossierGovernedError("snapshot_manifest_invalid", 503, "The snapshot manifest does not match its sealed metadata rows.");
  }
  return bytes;
}

export async function generateDossierGovernedOutput(input: GenerateDossierOutputInput) {
  const dossierId = parseDossierOpaqueId(input.dossierId, "output dossier ID");
  const snapshotId = parseDossierOpaqueId(input.snapshotId, "snapshot ID");
  const [dossier] = await input.context.db.select().from(dossiers)
    .where(eq(dossiers.id, dossierId)).limit(1);
  if (!dossier) throw new DossierGovernedError("matter_not_found", 404, "Matter not found.");
  if (dossier.revision !== input.expectedRevision) {
    throw new DossierGovernedError("revision_conflict", 409, "The Matter changed before output generation.");
  }
  const [snapshotRecord] = await input.context.db.select().from(dossierSnapshots).where(and(
    eq(dossierSnapshots.dossierId, dossierId),
    eq(dossierSnapshots.id, snapshotId),
    eq(dossierSnapshots.dossierRevision, dossier.revision),
    eq(dossierSnapshots.sealed, true),
  )).limit(1);
  if (!snapshotRecord) {
    throw new DossierGovernedError("snapshot_not_current", 409, "Output generation requires an exact current-revision sealed snapshot.");
  }
  assertPilotSnapshotPolicy(snapshotRecord.audience, snapshotRecord.redactionProfileId);

  const outputFacts = await loadOutputFacts(input.context, dossierId);
  const existing = outputFacts.outputs.find((item) =>
    item.snapshotId === snapshotId
    && item.format === input.format
    && outputFacts.latestState.get(item.id)?.state === "current"
  );
  if (existing) {
    return {
      output: publicOutput(existing, outputFacts.latestState, outputFacts.latestApproval),
      download_url: outputDownloadUrl(dossierId, existing.id),
      unchanged: true,
    };
  }

  const snapshot = await loadSnapshotProjection(input.context, snapshotRecord);
  await readAndVerifySnapshotManifest(input.bucket, snapshotRecord, snapshot);
  const model = await buildDossierReportModel(input.context, dossier, snapshot);
  const outputBytes = await renderDossierOutput(model, input.format);
  const outputDigest = (await sha256Bytes(outputBytes)).contentSha256;
  const outputId = newOpaqueId("output");
  const contentReference = dossierObjectKey(dossierId, outputId, randomHex(32));
  const createdAt = nowIso();
  const filename = outputFilename(dossier.reference, snapshotId, input.format);
  const staleOutputs = outputFacts.outputs.filter((item) =>
    item.snapshotId !== snapshotId
    && outputFacts.latestState.get(item.id)?.state === "current"
  );
  const actorRole = await currentActorRole(input.context, dossierId);
  const auditEvents = await input.dependencies.prepareAuditEvents(
    dossierId,
    dossier.revision,
    [
      ...staleOutputs.map((item) => ({
        actorRole,
        eventType: "output_marked_stale" as const,
        objectRefType: "governed_output" as const,
        objectRefId: item.id,
        summaryCode: "OUTPUT_MARKED_STALE",
        detail: {
          reason_code: "NEW_SNAPSHOT_OUTPUT_GENERATED",
          replacement_snapshot_id: snapshotId,
          dossier_revision: dossier.revision,
        },
        occurredAt: createdAt,
      })),
      {
        actorRole,
        eventType: "output_generated",
        objectRefType: "governed_output",
        objectRefId: outputId,
        summaryCode: "DOSSIER_OUTPUT_GENERATED",
        detail: {
          snapshot_id: snapshotId,
          snapshot_digest: snapshotRecord.manifestDigest,
          format: input.format,
          content_sha256: outputDigest,
          generator_schema_version: DOSSIER_REPORT_MODEL_SCHEMA_VERSION,
          generator_build_version: DOSSIER_REPORT_BUILD_VERSION,
          renderer_version: DOSSIER_REPORT_RENDERER_VERSION,
          stale_output_ids: staleOutputs.map(({ id }) => id),
        },
        occurredAt: createdAt,
      },
    ],
  );

  await putVerifiedPrivateObject({
    bucket: input.bucket,
    key: contentReference,
    dossierId,
    objectId: outputId,
    bytes: outputBytes,
    mediaType: outputMediaType(input.format),
    contentSha256: outputDigest,
    customMetadata: {
      kind: "dossier_governed_output",
      outputId,
      snapshotId,
      snapshotDigest: snapshotRecord.manifestDigest,
      format: input.format,
      generatorSchemaVersion: String(DOSSIER_REPORT_MODEL_SCHEMA_VERSION),
      generatorBuildVersion: DOSSIER_REPORT_BUILD_VERSION,
      rendererVersion: DOSSIER_REPORT_RENDERER_VERSION,
      sourceManifestSha256: snapshotRecord.manifestDigest,
    },
  });

  const outputRow = {
    id: outputId,
    dossierId,
    snapshotId,
    snapshotDigest: snapshotRecord.manifestDigest,
    format: input.format,
    contentReference,
    contentSha256: outputDigest,
    filename,
    generatorSchemaVersion: DOSSIER_REPORT_MODEL_SCHEMA_VERSION,
    generatorBuildVersion: DOSSIER_REPORT_BUILD_VERSION,
    createdByActorRef: input.context.actor.actorId,
    createdAt,
  } satisfies typeof dossierGovernedOutputs.$inferInsert;
  const statements = [
    input.context.db.insert(dossierGovernedOutputs).values(outputRow),
    ...staleOutputs.map((item) => input.context.db.insert(dossierOutputStateEvents).values({
      id: newOpaqueId("output_state"),
      dossierId,
      outputId: item.id,
      sequence: 2,
      state: "stale",
      reason: "NEW_SNAPSHOT_OUTPUT_GENERATED",
      occurredAt: createdAt,
      actorRef: input.context.actor.actorId,
    })),
    ...auditEvents.map((event) => input.context.db.insert(dossierAuditEvents).values(event)),
  ];
  try {
    await input.context.db.batch([statements[0]!, ...statements.slice(1)]);
  } catch {
    await deleteVerifiedPrivateObject(input.bucket, contentReference);
    throw new DossierGovernedError(
      "output_conflict",
      409,
      "The Matter or output register changed before generation could be committed.",
    );
  }

  return {
    output: publicOutput(outputRow as StoredOutput, new Map([[outputId, {
      sequence: 1,
      state: "current",
      reason: null,
      occurredAt: createdAt,
    }]]), new Map()),
    download_url: outputDownloadUrl(dossierId, outputId),
    byte_length: outputBytes.byteLength,
    unchanged: false,
  };
}

export async function listDossierGovernedOutputs(context: DossierGovernedContext, dossierIdValue: string) {
  const dossierId = parseDossierOpaqueId(dossierIdValue, "output dossier ID");
  const facts = await loadOutputFacts(context, dossierId);
  return facts.outputs.map((item) => ({
    ...publicOutput(item, facts.latestState, facts.latestApproval),
    download_url: outputDownloadUrl(dossierId, item.id),
  }));
}

export async function downloadDossierGovernedOutput(input: {
  context: DossierGovernedContext;
  bucket: R2Bucket;
  dossierId: string;
  outputId: string;
}) {
  const dossierId = parseDossierOpaqueId(input.dossierId, "output dossier ID");
  const outputId = parseDossierOpaqueId(input.outputId, "output ID");
  const [bound] = await input.context.db.select({
    output: dossierGovernedOutputs,
    rendererVersion: dossierSnapshots.rendererVersion,
    snapshotAudience: dossierSnapshots.audience,
    snapshotRedactionProfileId: dossierSnapshots.redactionProfileId,
  }).from(dossierGovernedOutputs).innerJoin(dossierSnapshots, and(
    eq(dossierSnapshots.dossierId, dossierGovernedOutputs.dossierId),
    eq(dossierSnapshots.id, dossierGovernedOutputs.snapshotId),
    eq(dossierSnapshots.manifestDigest, dossierGovernedOutputs.snapshotDigest),
  )).where(and(
    eq(dossierGovernedOutputs.dossierId, dossierId),
    eq(dossierGovernedOutputs.id, outputId),
  )).limit(1);
  if (!bound) throw new DossierGovernedError("output_not_found", 404, "Output not found.");
  assertPilotSnapshotPolicy(bound.snapshotAudience, bound.snapshotRedactionProfileId);
  const record = bound.output;
  const mediaType = outputMediaType(record.format as GenerateDossierOutputInput["format"]);
  const bytes = await readVerifiedPrivateObject({
    bucket: input.bucket,
    key: record.contentReference,
    dossierId,
    objectId: outputId,
    contentSha256: record.contentSha256,
    mediaType,
    customMetadata: {
      kind: "dossier_governed_output",
      outputId: record.id,
      snapshotId: record.snapshotId,
      snapshotDigest: record.snapshotDigest,
      format: record.format,
      generatorSchemaVersion: String(record.generatorSchemaVersion),
      generatorBuildVersion: record.generatorBuildVersion,
      rendererVersion: bound.rendererVersion,
      sourceManifestSha256: record.snapshotDigest,
    },
  });
  return new Response(bytes, {
    status: 200,
    headers: privateHeaders({
      "Content-Disposition": contentDisposition(record.filename),
      "Content-Length": String(bytes.byteLength),
      "Content-Type": mediaType,
      "X-Content-SHA256": record.contentSha256,
      "X-Dossier-Snapshot-ID": record.snapshotId,
      "X-Dossier-Snapshot-SHA256": record.snapshotDigest,
    }),
  });
}

export async function approveDossierGovernedOutput(input: ApproveDossierOutputInput) {
  const dossierId = parseDossierOpaqueId(input.dossierId, "approval dossier ID");
  const outputId = parseDossierOpaqueId(input.outputId, "approval output ID");
  const reviewerParticipantId = parseDossierOpaqueId(
    input.reviewerParticipantId,
    "reviewer participant ID",
  );
  const [dossier] = await input.context.db.select().from(dossiers)
    .where(eq(dossiers.id, dossierId)).limit(1);
  if (!dossier) throw new DossierGovernedError("matter_not_found", 404, "Matter not found.");
  if (dossier.revision !== input.expectedRevision) {
    throw new DossierGovernedError("revision_conflict", 409, "The Matter changed before output approval.");
  }
  const [reviewer, output] = await Promise.all([
    input.context.db.select().from(dossierParticipants).where(and(
      eq(dossierParticipants.dossierId, dossierId),
      eq(dossierParticipants.id, reviewerParticipantId),
      eq(dossierParticipants.userId, input.context.actor.userId),
      eq(dossierParticipants.actorId, input.context.actor.actorId),
      eq(dossierParticipants.role, "reviewer"),
      eq(dossierParticipants.status, "active"),
    )).limit(1),
    input.context.db.select({
      output: dossierGovernedOutputs,
      snapshotRevision: dossierSnapshots.dossierRevision,
      snapshotSealed: dossierSnapshots.sealed,
      snapshotAudience: dossierSnapshots.audience,
      snapshotRedactionProfileId: dossierSnapshots.redactionProfileId,
    }).from(dossierGovernedOutputs).innerJoin(dossierSnapshots, and(
      eq(dossierSnapshots.dossierId, dossierGovernedOutputs.dossierId),
      eq(dossierSnapshots.id, dossierGovernedOutputs.snapshotId),
    )).where(and(
      eq(dossierGovernedOutputs.dossierId, dossierId),
      eq(dossierGovernedOutputs.id, outputId),
    )).limit(1),
  ]);
  const reviewerRow = reviewer[0];
  const outputRow = output[0];
  if (!reviewerRow) {
    throw new DossierGovernedError("approval_role_forbidden", 403, "Only an exact active reviewer participant may approve an output.");
  }
  if (
    !outputRow
    || !outputRow.snapshotSealed
    || outputRow.snapshotRevision !== dossier.revision
  ) {
    throw new DossierGovernedError("output_not_current", 409, "Approval requires an exact current-revision sealed-snapshot output.");
  }
  assertPilotSnapshotPolicy(
    outputRow.snapshotAudience,
    outputRow.snapshotRedactionProfileId,
  );

  const facts = await loadOutputFacts(input.context, dossierId);
  if (facts.latestState.get(outputId)?.state !== "current") {
    throw new DossierGovernedError("output_not_current", 409, "A stale output cannot be approved.");
  }
  const [existing] = await input.context.db.select().from(dossierOutputApprovals).where(and(
    eq(dossierOutputApprovals.dossierId, dossierId),
    eq(dossierOutputApprovals.outputId, outputId),
    eq(dossierOutputApprovals.reviewerParticipantId, reviewerParticipantId),
  )).limit(1);
  if (existing) {
    return {
      approval: projectApproval(existing),
      output: publicOutput(outputRow.output, facts.latestState, facts.latestApproval),
      unchanged: true,
      status_transition_required: dossier.status !== "output_approved",
    };
  }

  const approvedAt = nowIso();
  const approvalId = newOpaqueId("approval");
  const approvalDigest = (await sha256Bytes(canonicalDossierJson({
    schema_version: 1,
    kind: "dossier_output_approval",
    approval_id: approvalId,
    dossier_id: dossierId,
    dossier_revision: dossier.revision,
    output_id: outputId,
    output_content_sha256: outputRow.output.contentSha256,
    snapshot_id: outputRow.output.snapshotId,
    snapshot_digest: outputRow.output.snapshotDigest,
    reviewer_participant_id: reviewerParticipantId,
    reviewer_user_id: input.context.actor.userId,
    reviewer_actor_id: input.context.actor.actorId,
    approved_at: approvedAt,
  }))).contentSha256;
  const approvalRow = {
    id: approvalId,
    dossierId,
    outputId,
    reviewerParticipantId,
    reviewerUserId: input.context.actor.userId,
    reviewerActorRef: input.context.actor.actorId,
    approvedAt,
    approvalDigest,
  } satisfies typeof dossierOutputApprovals.$inferInsert;
  const auditEvents = await input.dependencies.prepareAuditEvents(dossierId, dossier.revision, [{
    actorRole: "reviewer",
    eventType: "output_approved",
    objectRefType: "governed_output",
    objectRefId: outputId,
    summaryCode: "DOSSIER_OUTPUT_APPROVED",
    detail: {
      approval_id: approvalId,
      approval_digest: approvalDigest,
      output_id: outputId,
      output_content_sha256: outputRow.output.contentSha256,
      snapshot_id: outputRow.output.snapshotId,
      snapshot_digest: outputRow.output.snapshotDigest,
      dossier_revision: dossier.revision,
      status_transition_performed: false,
    },
    occurredAt: approvedAt,
  }]);
  try {
    await input.context.db.batch([
      input.context.db.insert(dossierOutputApprovals).values(approvalRow),
      ...auditEvents.map((event) => input.context.db.insert(dossierAuditEvents).values(event)),
    ]);
  } catch {
    throw new DossierGovernedError(
      "approval_conflict",
      409,
      "The output, reviewer authority, or audit chain changed before approval was committed.",
    );
  }
  const approvals = new Map(facts.latestApproval);
  approvals.set(outputId, approvalRow as typeof dossierOutputApprovals.$inferSelect);
  return {
    approval: projectApproval(approvalRow as typeof dossierOutputApprovals.$inferSelect),
    output: publicOutput(outputRow.output, facts.latestState, approvals),
    unchanged: false,
    status_transition_required: dossier.status !== "output_approved",
  };
}

async function loadOutputFacts(context: DossierGovernedContext, dossierId: string) {
  const [outputs, states, approvals] = await Promise.all([
    context.db.select().from(dossierGovernedOutputs)
      .where(eq(dossierGovernedOutputs.dossierId, dossierId))
      .orderBy(desc(dossierGovernedOutputs.createdAt), desc(dossierGovernedOutputs.id))
      .limit(1_000),
    context.db.select().from(dossierOutputStateEvents)
      .where(eq(dossierOutputStateEvents.dossierId, dossierId))
      .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence))
      .limit(MAX_OUTPUT_STATE_ROWS + 1),
    context.db.select().from(dossierOutputApprovals)
      .where(eq(dossierOutputApprovals.dossierId, dossierId))
      .orderBy(
        asc(dossierOutputApprovals.outputId),
        asc(dossierOutputApprovals.approvedAt),
        asc(dossierOutputApprovals.id),
      ).limit(5_000),
  ]);
  if (states.length > MAX_OUTPUT_STATE_ROWS) {
    throw new DossierGovernedError("output_state_limit", 409, "The output state register is too large to process safely.");
  }
  const latestState = new Map<string, {
    sequence: number;
    state: string;
    reason: string | null;
    occurredAt: string;
  }>();
  for (const state of states) latestState.set(state.outputId, state);
  const latestApproval = new Map<string, typeof dossierOutputApprovals.$inferSelect>();
  for (const approval of approvals) latestApproval.set(approval.outputId, approval);
  return { outputs, latestState, latestApproval };
}

function projectOutput(
  output: StoredOutput,
  states: ReadonlyMap<string, { state: string; reason: string | null; occurredAt: string }>,
  approvals: ReadonlyMap<string, typeof dossierOutputApprovals.$inferSelect>,
): DossierGovernedOutputV1 {
  const state = states.get(output.id);
  const approval = approvals.get(output.id);
  const stale = state?.state === "stale";
  return {
    object_type: "governed_output",
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    output_id: output.id,
    dossier_id: output.dossierId,
    snapshot_id: output.snapshotId,
    snapshot_digest: output.snapshotDigest,
    format: output.format as DossierGovernedOutputV1["format"],
    content_reference: output.contentReference,
    content_sha256: output.contentSha256,
    filename: output.filename,
    state: stale ? "stale" : "current",
    stale_at: stale ? state.occurredAt : null,
    stale_reason: stale ? state.reason : null,
    reviewer_actor_id: approval?.reviewerActorRef ?? null,
    approved_at: approval?.approvedAt ?? null,
    generator_schema_version: output.generatorSchemaVersion,
    generator_build_version: output.generatorBuildVersion,
    created_at: output.createdAt,
    created_by: output.createdByActorRef,
  };
}

function publicOutput(
  output: StoredOutput,
  states: ReadonlyMap<string, { state: string; reason: string | null; occurredAt: string }>,
  approvals: ReadonlyMap<string, typeof dossierOutputApprovals.$inferSelect>,
) {
  const safe = { ...projectOutput(output, states, approvals) };
  Reflect.deleteProperty(safe, "content_reference");
  return safe as Omit<ReturnType<typeof projectOutput>, "content_reference">;
}

function projectApproval(approval: typeof dossierOutputApprovals.$inferSelect) {
  return {
    object_type: "output_approval",
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    approval_id: approval.id,
    dossier_id: approval.dossierId,
    output_id: approval.outputId,
    reviewer_participant_id: approval.reviewerParticipantId,
    reviewer_actor_id: approval.reviewerActorRef,
    approved_at: approval.approvedAt,
    approval_digest: approval.approvalDigest,
  };
}

async function buildDossierReportModel(
  context: DossierGovernedContext,
  dossier: typeof dossiers.$inferSelect,
  snapshot: DossierSnapshotV1,
): Promise<DossierReportModelV1> {
  const packageGraphs = await validateSnapshotPackageGraphs(
    context,
    packageBindingsFromSnapshot(snapshot),
  );
  const sealedAuditReceipts = sealedAuditReceiptsFromSnapshot(snapshot);
  const [documentRows, assertionRows, sourceRows, anchorRows] = await Promise.all([
    context.db.select({
      documentId: dossierDocuments.id,
      title: dossierDocuments.title,
      documentType: dossierDocuments.documentType,
      classification: dossierDocuments.classification,
      documentVersionId: dossierDocumentVersions.id,
      mediaType: dossierDocumentVersions.mediaType,
      originalFilename: dossierDocumentVersions.originalFilename,
      contentSha256: dossierDocumentVersions.contentSha256,
    }).from(dossierDocuments).innerJoin(dossierDocumentVersions, and(
      eq(dossierDocumentVersions.dossierId, dossierDocuments.dossierId),
      eq(dossierDocumentVersions.documentId, dossierDocuments.id),
    )).where(eq(dossierDocuments.dossierId, dossier.id)).limit(5_000),
    context.db.select({
      id: dossierProfessionalAssertions.id,
      assertionType: dossierProfessionalAssertions.assertionType,
      statement: dossierProfessionalAssertions.statement,
    }).from(dossierProfessionalAssertions)
      .where(eq(dossierProfessionalAssertions.dossierId, dossier.id))
      .limit(10_000),
    context.db.select({
      assertionId: dossierAssertionSources.assertionId,
      sourceAnchorId: dossierAssertionSources.sourceAnchorId,
    }).from(dossierAssertionSources)
      .where(eq(dossierAssertionSources.dossierId, dossier.id))
      .limit(20_000),
    context.db.select({
      id: dossierSourceAnchors.id,
      documentId: dossierSourceAnchors.documentId,
      documentVersionId: dossierSourceAnchors.documentVersionId,
      pageNumber: dossierSourceAnchors.pageNumber,
      section: dossierSourceAnchors.section,
      heading: dossierSourceAnchors.heading,
      paragraph: dossierSourceAnchors.paragraph,
      characterStart: dossierSourceAnchors.characterStart,
      characterEnd: dossierSourceAnchors.characterEnd,
      anchorChecksum: dossierSourceAnchors.anchorChecksum,
    }).from(dossierSourceAnchors)
      .where(eq(dossierSourceAnchors.dossierId, dossier.id))
      .limit(10_000),
  ]);
  const snapshotDocumentKeys = new Set(snapshot.document_versions.map((item) =>
    `${item.document_id}\u0000${item.document_version_id}\u0000${item.content_sha256}`
  ));
  const assertionIds = new Set(snapshot.accepted_assertion_ids);
  const anchorIds = new Set(snapshot.source_anchor_ids);
  const sourcesByAssertion = new Map<string, string[]>();
  for (const source of sourceRows) {
    if (!assertionIds.has(source.assertionId) || !anchorIds.has(source.sourceAnchorId)) continue;
    sourcesByAssertion.set(source.assertionId, [
      ...(sourcesByAssertion.get(source.assertionId) ?? []),
      source.sourceAnchorId,
    ]);
  }
  return {
    format: DOSSIER_OUTPUT_MANIFEST_FORMAT,
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    profile_id: DOSSIER_REPORT_PROFILE_ID,
    source_manifest_sha256: snapshot.manifest_digest,
    dossier: {
      dossier_id: dossier.id,
      reference: dossier.reference,
      title: dossier.title,
      status: snapshot.status,
      revision: snapshot.dossier_revision,
      classification: snapshot.classification,
    },
    snapshot,
    source_register: documentRows.filter((item) => snapshotDocumentKeys.has(
      `${item.documentId}\u0000${item.documentVersionId}\u0000${item.contentSha256}`,
    )).sort((left, right) => left.documentId.localeCompare(right.documentId)).map((item) => ({
      document_id: item.documentId,
      document_version_id: item.documentVersionId,
      title: item.title,
      document_type: item.documentType,
      classification: item.classification,
      media_type: item.mediaType,
      original_filename: item.originalFilename,
      content_sha256: item.contentSha256,
    })),
    assertion_register: assertionRows.filter(({ id }) => assertionIds.has(id))
      .sort((left, right) => left.id.localeCompare(right.id)).map((item) => ({
        assertion_id: item.id,
        assertion_type: item.assertionType,
        statement: item.statement,
        source_anchor_ids: [...(sourcesByAssertion.get(item.id) ?? [])].sort(),
      })),
    anchor_register: anchorRows.filter(({ id }) => anchorIds.has(id))
      .sort((left, right) => left.id.localeCompare(right.id)).map((item) => ({
        source_anchor_id: item.id,
        document_id: item.documentId,
        document_version_id: item.documentVersionId,
        page_number: item.pageNumber,
        section: item.section,
        heading: item.heading,
        paragraph: item.paragraph,
        character_start: item.characterStart,
        character_end: item.characterEnd,
        anchor_checksum: item.anchorChecksum,
      })),
    decision_package_graphs: packageGraphs.map((item) => ({
      decision_package_reference_id: item.decisionPackageReferenceId,
      package_id: item.packageId,
      package_version: item.packageVersion,
      package_fingerprint: item.packageFingerprint,
      studio_fingerprint: item.studioFingerprint,
      graph_digest: item.graphDigest,
      graph_validation_reference: item.graphValidationReference,
      draft: item.draft,
    })),
    audit_receipts: sealedAuditReceipts,
    generator: {
      report_model_schema_version: DOSSIER_REPORT_MODEL_SCHEMA_VERSION,
      renderer_version: DOSSIER_REPORT_RENDERER_VERSION,
      build_version: DOSSIER_REPORT_BUILD_VERSION,
    },
  };
}

async function renderDossierOutput(
  model: DossierReportModelV1,
  format: GenerateDossierOutputInput["format"],
): Promise<Uint8Array> {
  if (format === "json_manifest") {
    return new TextEncoder().encode(canonicalDossierJson(model));
  }
  if (format === "markdown") {
    return new TextEncoder().encode(renderDossierMarkdown(model));
  }
  return await renderDossierPdf(model);
}

function renderDossierMarkdown(model: DossierReportModelV1) {
  const lines = [
    `# ${model.dossier.title}`,
    "",
    `- Matter reference: ${model.dossier.reference}`,
    `- Status: ${model.dossier.status}`,
    `- Dossier revision: ${model.dossier.revision}`,
    `- Snapshot ID: ${model.snapshot.snapshot_id}`,
    `- Snapshot SHA-256: ${model.source_manifest_sha256}`,
    `- Classification: ${model.snapshot.classification}`,
    `- Audience: ${model.snapshot.audience}`,
    `- Redaction profile: ${model.snapshot.redaction_profile_id}`,
    `- Generated from snapshot created: ${model.snapshot.created_at}`,
    `- Renderer: ${model.generator.renderer_version}`,
    `- Build: ${model.generator.build_version}`,
    "",
    "## Readiness at snapshot",
    "",
    `Ready: ${model.snapshot.readiness.ready ? "yes" : "no"}`,
    ...model.snapshot.readiness.dimensions.flatMap((dimension) => [
      `- ${dimension.dimension}: ${dimension.state}`,
      ...dimension.reasons.map((reason) => `  - ${reason.code}: ${reason.explanation}`),
    ]),
    "",
    "## Source register",
    "",
    ...model.source_register.flatMap((document) => [
      `### ${document.title}`,
      "",
      `- Document ID: ${document.document_id}`,
      `- Exact version: ${document.document_version_id}`,
      `- SHA-256: ${document.content_sha256}`,
      `- Media type: ${document.media_type}`,
      `- Classification: ${document.classification}`,
      "",
    ]),
    "## Accepted assertions",
    "",
    ...model.assertion_register.flatMap((assertion) => [
      `- **${assertion.assertion_type}** — ${assertion.statement}`,
      `  - Assertion ID: ${assertion.assertion_id}`,
      `  - Source anchors: ${assertion.source_anchor_ids.join(", ") || "none"}`,
    ]),
    "",
    "## Decision packages",
    "",
    ...model.decision_package_graphs.flatMap((graph) => {
      const item = model.snapshot.decision_packages.find((candidate) =>
        candidate.decision_package_reference_id === graph.decision_package_reference_id
      );
      return [
        `- ${graph.package_id}@${graph.package_version}`,
        `  - Reference ID: ${graph.decision_package_reference_id}`,
        `  - Package SHA-256: ${graph.package_fingerprint}`,
        `  - Studio SHA-256: ${graph.studio_fingerprint}`,
        `  - Graph SHA-256: ${graph.graph_digest}`,
        `  - Graph validation: ${graph.graph_validation_reference}`,
        `  - Simulation receipts: ${item?.simulation_receipt_ids.join(", ") || "none"}`,
      ];
    }),
    "",
    "## Deterministic receipt proofs",
    "",
    "~~~json",
    canonicalDossierJson(model.snapshot.deterministic_receipts),
    "~~~",
    "",
    "## Audit receipt appendix",
    "",
    ...model.audit_receipts.map((item) =>
      `- ${item.sequence}. ${item.event_type} · revision ${item.dossier_revision} · ${item.event_digest}`
    ),
    "",
  ];
  return lines.join("\n");
}

function dossierPdfTable(
  headers: string[],
  rows: string[][],
  widths?: Array<string | number>,
): ContentTable {
  const bodyRows = rows.length > 0 ? rows : [["None sealed.", ...headers.slice(1).map(() => "-")]];
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => "*"),
      body: [
        headers.map((value) => ({ text: value, style: "tableHeader" })),
        ...bodyRows.map((row) => row.map((value) => ({ text: value, style: "bodySmall" }) as TableCell)),
      ],
      dontBreakRows: true,
    },
    layout: {
      fillColor: (rowIndex: number) => rowIndex === 0 ? "#163445" : rowIndex % 2 === 0 ? "#f5f8f8" : "#ffffff",
      hLineColor: () => "#b6c4c8",
      vLineColor: () => "#b6c4c8",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
    margin: [0, 6, 0, 14],
  };
}

export function buildDossierGovernancePdfContent(model: DossierReportModelV1): Content[] {
  const deterministic = jsonObject(model.snapshot.deterministic_receipts);
  const receiptPackages = Array.isArray(deterministic?.decision_packages)
    ? deterministic.decision_packages
    : [];
  return [
    { text: "GENESIS: JURIS CODEX", style: "brand" },
    { text: "GOVERNED DECISION DOSSIER", style: "kicker" },
    { text: model.dossier.title, style: "coverTitle" },
    {
      text: "Immutable snapshot record with exact source, assertion, package, simulation, and audit bindings.",
      style: "coverSummary",
    },
    dossierPdfTable(["Matter field", "Sealed value"], [
      ["Reference", model.dossier.reference],
      ["Status / revision", `${model.dossier.status} / ${model.dossier.revision}`],
      ["Snapshot", model.snapshot.snapshot_id],
      ["Snapshot SHA-256", model.source_manifest_sha256],
      ["Created", model.snapshot.created_at],
      ["Classification / audience", `${model.snapshot.classification} / ${model.snapshot.audience}`],
      ["Redaction profile", model.snapshot.redaction_profile_id],
      ["Snapshot contract", model.snapshot.generator.contract_version],
      ["Snapshot report-model schema", String(model.snapshot.generator.report_model_schema_version)],
      ["Snapshot renderer / build", `${model.snapshot.generator.renderer_version} / ${model.snapshot.generator.build_version}`],
      ["Output renderer / build", `${model.generator.renderer_version} / ${model.generator.build_version}`],
    ], ["30%", "70%"]),
    { text: "1. Readiness at snapshot", style: "sectionTitle" },
    dossierPdfTable(["Dimension", "State", "Sealed reasons"], model.snapshot.readiness.dimensions.map((dimension) => [
      dimension.dimension,
      dimension.state,
      dimension.reasons.map((reason) => `${reason.code}: ${reason.explanation}`).join("\n") || "None",
    ]), ["23%", "15%", "62%"]),
    { text: "2. Exact source register", style: "sectionTitle" },
    dossierPdfTable(["Document", "Exact immutable version", "Content SHA-256"], model.source_register.map((document) => [
      `${document.title}\n[${document.document_id}]`,
      `${document.document_version_id}\n${document.media_type}\n${document.classification}`,
      document.content_sha256,
    ]), ["31%", "29%", "40%"]),
    { text: "3. Accepted assertions and anchors", style: "sectionTitle" },
    dossierPdfTable(["Assertion", "Professional statement", "Accepted source anchors"], model.assertion_register.map((assertion) => [
      `${assertion.assertion_type}\n[${assertion.assertion_id}]`,
      assertion.statement,
      assertion.source_anchor_ids.join("\n") || "None",
    ]), ["25%", "48%", "27%"]),
    dossierPdfTable(["Anchor", "Exact source location", "Anchor checksum"], model.anchor_register.map((anchor) => [
      anchor.source_anchor_id,
      [
        `document=${anchor.document_id}`,
        `version=${anchor.document_version_id}`,
        `page=${anchor.page_number ?? "n/a"}`,
        `section=${anchor.section ?? "n/a"}`,
        `heading=${anchor.heading ?? "n/a"}`,
        `paragraph=${anchor.paragraph ?? "n/a"}`,
        `characters=${anchor.character_start ?? "n/a"}..${anchor.character_end ?? "n/a"}`,
      ].join("\n"),
      anchor.anchor_checksum,
    ]), ["26%", "42%", "32%"]),
    { text: "4. Validated decision-package graphs", style: "sectionTitle" },
    dossierPdfTable(["Package", "Exact graph binding", "Simulation receipts"], model.decision_package_graphs.map((graph) => {
      const decisionPackage = model.snapshot.decision_packages.find((item) =>
        item.decision_package_reference_id === graph.decision_package_reference_id
      );
      return [
        `${graph.package_id}@${graph.package_version}\n[${graph.decision_package_reference_id}]`,
        [
          `package=${graph.package_fingerprint}`,
          `studio=${graph.studio_fingerprint}`,
          `graph=${graph.graph_digest}`,
          `validation=${graph.graph_validation_reference}`,
        ].join("\n"),
        decisionPackage?.simulation_receipt_ids.join("\n") || "None",
      ];
    }), ["24%", "49%", "27%"]),
    dossierPdfTable(["Package receipt", "Canonical deterministic proof"], receiptPackages.map((receipt, index) => [
      `Receipt set ${index + 1}`,
      canonicalDossierJson(receipt),
    ]), ["20%", "80%"]),
    { text: "5. Sealed simulation and parameter inputs", style: "sectionTitle" },
    dossierPdfTable(["Sealed input set", "Canonical value"], [[
      "Exact package, graph, simulation, and parameter bindings",
      canonicalDossierJson(model.snapshot.simulation_inputs),
    ]], ["24%", "76%"]),
    { text: "6. Approver records at snapshot", style: "sectionTitle" },
    dossierPdfTable(["Reviewer actor", "Approved at", "Exact output"], model.snapshot.approver_records.map((approval) => [
      approval.reviewer_actor_id,
      approval.approved_at,
      approval.output_id ?? "None",
    ]), ["30%", "30%", "40%"]),
    { text: "7. Snapshot-bounded audit receipt chain", style: "sectionTitle" },
    dossierPdfTable(["Sequence / revision", "Event", "Digest chain"], model.audit_receipts.map((item) => [
      `${item.sequence} / ${item.dossier_revision}\n${item.occurred_at}`,
      `${item.event_type}\n[${item.audit_event_id}]`,
      `previous=${item.previous_event_id ?? "GENESIS"}\ncurrent=${item.event_digest}`,
    ]), ["23%", "27%", "50%"]),
    {
      text: "Exact validated package reports and page-aware graph appendices follow.",
      style: "notice",
      margin: [0, 12, 0, 0],
    },
  ];
}

function assertDossierPdfTextSupported(model: DossierReportModelV1) {
  const visited = new WeakSet<object>();
  const inspect = (value: unknown): void => {
    if (typeof value === "string") {
      const issue = reportGraphGovernedTextIssue(value);
      if (issue) {
        throw new DossierGovernedError(
          "dossier_pdf_text_unsupported",
          409,
          `The governed PDF contains unsupported text (${issue.codePoint}).`,
        );
      }
      return;
    }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) inspect(item);
      return;
    }
    for (const item of Object.values(value as Record<string, unknown>)) inspect(item);
  };
  inspect(model);
}

function caseReportOptionsForGraph(
  model: DossierReportModelV1,
  graph: DossierReportModelV1["decision_package_graphs"][number],
): CaseReportOptions {
  const language = model.snapshot.locale.toLowerCase().startsWith("ru") ? "ru" : "en";
  const profile = primaryCaseOutput(graph.draft.caseType);
  if (!profile) {
    throw new DossierGovernedError(
      "decision_package_report_profile_missing",
      409,
      "A validated decision package has no governed report profile.",
    );
  }
  const confidentiality = model.snapshot.classification === "confidential"
    || model.snapshot.classification === "strictly_confidential"
    ? "confidential"
    : "internal";
  const publicationFingerprint = casePublicationFingerprint(graph.draft);
  return {
    language,
    profileId: profile.id,
    profileLabel: profile.label[language],
    audience: model.snapshot.audience,
    confidentiality,
    preparedBy: model.snapshot.created_by,
    preparedFor: model.snapshot.audience,
    matterReference: model.dossier.reference,
    includeEconomics: true,
    includeRegisters: true,
    includeSources: true,
    includeAuditTrail: model.snapshot.audience === "internal",
    includeTechnicalIds: model.snapshot.audience === "internal",
    generatedAt: model.snapshot.created_at,
    currentFingerprint: graph.studio_fingerprint,
    workspaceFingerprint: graph.studio_fingerprint,
    currentPublicationFingerprint: publicationFingerprint,
    workspacePublicationFingerprint: publicationFingerprint,
    privateCase: true,
    reportReceiptStorageScope: null,
    persistReportReceiptOnDevice: false,
    status: "draft",
    reviewerName: "",
    reviewerApproved: false,
    redactedNodeIds: [],
  };
}

function definitionContent(definition: TDocumentDefinitions): Content[] {
  return Array.isArray(definition.content)
    ? definition.content
    : [definition.content];
}

type DossierPdfResourceKey = "images" | "patterns" | "styles";

function serializedPdfResourceValue(value: unknown, context: string) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new DossierGovernedError(
      "decision_package_report_resource_invalid",
      409,
      `A validated decision package has an unserializable PDF ${context}.`,
    );
  }
  return serialized;
}

function mergeDossierPdfResources(
  definitions: readonly TDocumentDefinitions[],
  key: DossierPdfResourceKey,
) {
  const merged: Record<string, unknown> = {};
  const serializedByName = new Map<string, string>();
  for (const definition of definitions) {
    const resources = definition[key] as Record<string, unknown> | undefined;
    if (!resources) continue;
    for (const [name, value] of Object.entries(resources)) {
      const serialized = serializedPdfResourceValue(value, `${key} resource ${name}`);
      const prior = serializedByName.get(name);
      if (prior !== undefined && prior !== serialized) {
        throw new DossierGovernedError(
          "decision_package_report_resource_conflict",
          409,
          `Validated decision packages define conflicting PDF ${key} resources named ${name}.`,
        );
      }
      serializedByName.set(name, serialized);
      merged[name] = value;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function assertDossierPdfDefinitionCompatibility(definitions: readonly TDocumentDefinitions[]) {
  const base = definitions[0]!;
  const fields = ["pageSize", "pageOrientation", "pageMargins", "defaultStyle"] as const;
  for (const definition of definitions.slice(1)) {
    for (const field of fields) {
      const candidateValue = JSON.stringify(definition[field]) ?? "undefined";
      const baseValue = JSON.stringify(base[field]) ?? "undefined";
      if (candidateValue !== baseValue) {
        throw new DossierGovernedError(
          "decision_package_report_layout_conflict",
          409,
          `Validated decision packages require incompatible PDF ${field} settings.`,
        );
      }
    }
  }
  for (const definition of definitions) {
    const fontValues = [
      (definition.defaultStyle as { font?: unknown } | undefined)?.font,
      ...Object.values(definition.styles ?? {}).map((style) =>
        (style as { font?: unknown } | undefined)?.font
      ),
    ].filter((font): font is string => typeof font === "string");
    if (fontValues.some((font) => font !== "Roboto")) {
      throw new DossierGovernedError(
        "decision_package_report_font_unavailable",
        409,
        "A validated decision package references a font outside the governed Roboto VFS.",
      );
    }
  }
}

export function mergeDossierPdfArtifactResources(
  definitions: readonly TDocumentDefinitions[],
) {
  if (definitions.length === 0) {
    throw new DossierGovernedError(
      "decision_package_graph_missing",
      409,
      "A governed dossier PDF requires at least one validated package artifact.",
    );
  }
  assertDossierPdfDefinitionCompatibility(definitions);
  return {
    images: mergeDossierPdfResources(definitions, "images") as TDocumentDefinitions["images"],
    patterns: mergeDossierPdfResources(definitions, "patterns") as TDocumentDefinitions["patterns"],
    styles: mergeDossierPdfResources(definitions, "styles") as TDocumentDefinitions["styles"],
  };
}

async function renderDossierPdf(model: DossierReportModelV1): Promise<Uint8Array> {
  if (model.decision_package_graphs.length === 0) {
    throw new DossierGovernedError(
      "decision_package_graph_missing",
      409,
      "A governed dossier PDF requires at least one validated published package graph.",
    );
  }
  assertDossierPdfTextSupported(model);
  const artifacts = model.decision_package_graphs.map((graph) =>
    buildCaseReportArtifacts(graph.draft, caseReportOptionsForGraph(model, graph))
  );
  const artifactDefinitions = artifacts.map((artifact) => artifact.definition);
  const baseDefinition = artifacts[0]!.definition;
  const { images, patterns, styles } = mergeDossierPdfArtifactResources(artifactDefinitions);
  const content: Content[] = [...buildDossierGovernancePdfContent(model)];
  artifacts.forEach((artifact) => {
    content.push({ text: "", pageBreak: "before" });
    content.push(...definitionContent(artifact.definition));
  });
  const definition: TDocumentDefinitions = {
    ...baseDefinition,
    ...(images ? { images } : {}),
    ...(patterns ? { patterns } : {}),
    ...(styles ? { styles } : {}),
    content,
    info: {
      ...baseDefinition.info,
      title: `${model.dossier.title} - governed decision dossier`,
      author: model.snapshot.created_by,
      subject: `Snapshot ${model.snapshot.snapshot_id} ${model.source_manifest_sha256}`,
      keywords: "governed dossier, immutable snapshot, decision package, graph appendix",
      creator: `GENESIS: JURIS CODEX ${model.generator.renderer_version}`,
      creationDate: new Date(model.snapshot.created_at),
    },
  };
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake.js"),
    import("pdfmake/build/vfs_fonts.js"),
  ]);
  const runtime = pdfMake as unknown as {
    addVirtualFileSystem: (fonts: unknown) => void;
    createPdf: (document: TDocumentDefinitions) => {
      getBuffer: (callback: (value: Uint8Array) => void) => void;
    };
  };
  runtime.addVirtualFileSystem(pdfFonts);
  return await new Promise<Uint8Array>((resolve, reject) => {
    try {
      runtime.createPdf(definition).getBuffer((value) => resolve(new Uint8Array(value)));
    } catch (error) {
      reject(error);
    }
  });
}
