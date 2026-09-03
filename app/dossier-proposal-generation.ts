import { and, asc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import {
  caseVersions,
  dossierAIProposalAnchors,
  dossierAIProposalJobSources,
  dossierAIProposalJobs,
  dossierAIProposals,
  dossierAIProposalVersions,
  dossierAuditEvents,
  dossierDecisionPackageReferences,
  dossierDocumentCurrentVersions,
  dossierDocuments,
  dossierDocumentVersions,
  dossierExtractionJobs,
  dossierExtractionResults,
  dossierOutputStateEvents,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
} from "../db/schema";
import { canonicalDossierJson, type DossierRole, type JsonValue } from "./dossier-contract";
import { validatePublishedDecisionPackage } from "./dossier-decision-package-integration";
import {
  DossierProposalAIError,
  type DossierProposalAICandidate,
  type DossierProposalAIGraphTarget,
  type DossierProposalAIResult,
  type DossierProposalAISource,
} from "./dossier-proposal-ai-server";
import { canonicalR2Sha256, sha256Bytes } from "./dossier-private-upload";
import { parseDossierObjectKey } from "./dossier-security";
import type {
  DossierAuditEventInput,
  DossierRevisionAuditBatch,
  DossierServerContext,
} from "./dossier-server";

export const DOSSIER_PROPOSAL_MAX_SOURCE_VERSIONS = 8;
export const DOSSIER_PROPOSAL_MAX_SOURCE_OBJECT_BYTES = 2 * 1024 * 1024;
export const DOSSIER_PROPOSAL_MAX_CONTEXT_CHARACTERS = 96_000;
export const DOSSIER_PROPOSAL_MAX_CONTEXT_PER_SOURCE = 24_000;
export const DOSSIER_PROPOSAL_MAX_GRAPH_TARGETS = 500;
export const DOSSIER_PROPOSAL_MAX_ATTEMPTS = 5;
const PROPOSAL_JOB_LEASE_MS = 10 * 60 * 1_000;
const MAX_OUTPUT_STATE_ROWS = 5_000;
const SUPPORTED_EXTRACTION_VERSION = "genesis-dossier-strict-utf8-v1";

type GenerationContext = Pick<DossierServerContext, "db" | "actor">;
type StoredProposalJob = typeof dossierAIProposalJobs.$inferSelect;

export type DossierProposalGenerationRequest = {
  expectedRevision: number;
  documentVersionIds: string[];
  idempotencyKey: string;
  dataClassification: "synthetic_or_deidentified";
  privacyDisclosureAcknowledged: true;
  retryFailed: boolean;
};

export type DossierProposalGenerationDependencies = {
  modelProvider: string;
  modelName: string;
  modelConfigurationDigest: string;
  now: () => string;
  newId: (prefix: "proposal_job" | "proposal" | "source_anchor" | "output_state" | "proposal_worker") => string;
  acquireProviderPermission: () => Promise<
    | { ok: true; safetyIdentifier: string; release: () => Promise<void> }
    | { ok: false; errorCode: "rate_limited" | "provider_unavailable"; detailCode: string }
  >;
  generateCandidates: (input: {
    safetyIdentifier: string;
    sources: DossierProposalAISource[];
    graphTargets: DossierProposalAIGraphTarget[];
  }) => Promise<DossierProposalAIResult>;
  prepareRevisionAuditBatch: (
    dossierId: string,
    resultingRevision: number,
    inputs: readonly DossierAuditEventInput[],
  ) => Promise<DossierRevisionAuditBatch>;
  prepareAuditEvents: (
    dossierId: string,
    dossierRevision: number,
    inputs: readonly DossierAuditEventInput[],
  ) => Promise<DossierRevisionAuditBatch["auditEvents"]>;
};

export type DossierProposalAnalyzedSource = {
  documentVersionId: string;
  extractionVersion: string;
  contextStart: 0;
  contextEnd: number;
  sourceCharacterCount: number;
  truncated: boolean;
  maximumCharactersPerSource: number;
  maximumTotalCharacters: number;
};

type PreparedAnalyzedSource = DossierProposalAnalyzedSource & {
  sourceOrdinal: number;
  documentId: string;
  extractionResultId: string;
};

export type DossierProposalGenerationResult =
  | {
      result: "ready";
      jobId: string;
      proposalIds: string[];
      sourceAnchorIds: string[];
      dossierRevision: number;
      providerReceiptDigest: string;
      outcome: "candidates_ready" | "no_candidates";
      analyzedSources: DossierProposalAnalyzedSource[];
      idempotent: boolean;
    }
  | {
      result: "processing";
      jobId: string;
      attempt: number;
      idempotent: true;
    }
  | {
      result: "failed";
      jobId: string;
      attempt: number;
      errorCode: string;
      retryable: boolean;
      idempotent: boolean;
    };

export class DossierProposalGenerationError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DossierProposalGenerationError";
  }
}

export function parseDossierProposalGenerationRequest(value: unknown): DossierProposalGenerationRequest {
  const fields = [
    "expected_revision",
    "document_version_ids",
    "idempotency_key",
    "data_classification",
    "privacy_disclosure_acknowledged",
    "retry_failed",
  ];
  if (!isRecord(value) || Object.keys(value).some((key) => !fields.includes(key))) {
    throw new DossierProposalGenerationError("invalid_request", 400, "The proposal-generation request contains an unknown field.");
  }
  if (!Number.isSafeInteger(value.expected_revision) || (value.expected_revision as number) < 1) {
    throw invalidRequest();
  }
  if (
    !Array.isArray(value.document_version_ids)
    || value.document_version_ids.length < 1
    || value.document_version_ids.length > DOSSIER_PROPOSAL_MAX_SOURCE_VERSIONS
    || value.document_version_ids.some((id) => !opaqueReference(id))
  ) throw invalidRequest();
  const documentVersionIds = [...value.document_version_ids] as string[];
  if (new Set(documentVersionIds).size !== documentVersionIds.length) {
    throw new DossierProposalGenerationError("duplicate_source", 400, "Source document versions must be unique.");
  }
  if (
    typeof value.idempotency_key !== "string"
    || value.idempotency_key.length < 12
    || value.idempotency_key.length > 200
    || value.idempotency_key !== value.idempotency_key.trim()
    || !/^[A-Za-z0-9._:-]+$/u.test(value.idempotency_key)
  ) throw invalidRequest();
  if (
    value.data_classification !== "synthetic_or_deidentified"
    || value.privacy_disclosure_acknowledged !== true
    || (value.retry_failed !== undefined && typeof value.retry_failed !== "boolean")
  ) {
    throw new DossierProposalGenerationError(
      "privacy_acknowledgement_required",
      422,
      "AI proposal generation requires an explicit synthetic-or-de-identified data declaration and privacy acknowledgement.",
    );
  }
  return {
    expectedRevision: value.expected_revision as number,
    documentVersionIds: documentVersionIds.sort(),
    idempotencyKey: value.idempotency_key,
    dataClassification: "synthetic_or_deidentified",
    privacyDisclosureAcknowledged: true,
    retryFailed: value.retry_failed ?? false,
  };
}

/** Resolves a committed idempotency replay without consulting current model
 * configuration, provider credentials, quotas, graph state, or private R2.
 * Exact selected sources are re-proved from immutable completed job-source rows. */
export async function replayReadyDossierProposalGeneration(input: {
  context: GenerationContext;
  dossierId: string;
  request: DossierProposalGenerationRequest;
}): Promise<Extract<DossierProposalGenerationResult, { result: "ready" }> | null> {
  const idempotencyKeyHash = await generationSha256(input.request.idempotencyKey);
  const [job] = await input.context.db.select().from(dossierAIProposalJobs).where(and(
    eq(dossierAIProposalJobs.dossierId, input.dossierId),
    eq(dossierAIProposalJobs.requestedByActorRef, input.context.actor.actorId),
    eq(dossierAIProposalJobs.idempotencyKeyHash, idempotencyKeyHash),
  )).limit(1);
  if (!job) return null;
  if (job.expectedDossierRevision !== input.request.expectedRevision) throw idempotencyConflict();
  if (job.status !== "ready") return null;
  const jobSources = await input.context.db.select({
    documentVersionId: dossierAIProposalJobSources.documentVersionId,
  }).from(dossierAIProposalJobSources).where(and(
    eq(dossierAIProposalJobSources.dossierId, input.dossierId),
    eq(dossierAIProposalJobSources.jobId, job.id),
  )).orderBy(asc(dossierAIProposalJobSources.sourceOrdinal))
    .limit(DOSSIER_PROPOSAL_MAX_SOURCE_VERSIONS + 1);
  const storedVersionIds = jobSources.map(({ documentVersionId }) => documentVersionId).sort();
  if (!sameStringArray(storedVersionIds, input.request.documentVersionIds)) throw idempotencyConflict();
  return readyJobReplay(input.context, job) as Promise<Extract<
    DossierProposalGenerationResult,
    { result: "ready" }
  >>;
}

export async function executeDossierProposalGeneration(input: {
  context: GenerationContext;
  bucket: R2Bucket;
  dossierId: string;
  role: DossierRole;
  request: DossierProposalGenerationRequest;
  dependencies: DossierProposalGenerationDependencies;
}): Promise<DossierProposalGenerationResult> {
  const { context, bucket, dossierId, role, request, dependencies } = input;
  const { idempotencyKeyHash, requestDigest } = await proposalGenerationDigests({
    dossierId,
    actorRef: context.actor.actorId,
    request,
    modelProvider: dependencies.modelProvider,
    modelName: dependencies.modelName,
    modelConfigurationDigest: dependencies.modelConfigurationDigest,
  });
  const existing = await findProposalJob(
    context,
    dossierId,
    context.actor.actorId,
    request.expectedRevision,
    idempotencyKeyHash,
    requestDigest,
  );
  if (existing) {
    assertExactJobBinding(existing, { dossierId, request, idempotencyKeyHash, requestDigest, dependencies });
    if (existing.status === "ready") return readyJobReplay(context, existing);
    if (
      existing.status === "processing"
      && Date.parse(existing.leaseExpiresAt ?? "") > Date.parse(dependencies.now())
    ) return { result: "processing", jobId: existing.id, attempt: existing.attempt, idempotent: true };
    if (existing.status === "failed" && !request.retryFailed) return failedJobResult(existing, true);
  }
  const [exactRevision] = await context.db.select({ revision: dossiers.revision }).from(dossiers).where(and(
    eq(dossiers.id, dossierId),
    eq(dossiers.revision, request.expectedRevision),
  )).limit(1);
  if (!exactRevision) {
    throw new DossierProposalGenerationError("revision_conflict", 409, "The Matter changed before proposal generation.");
  }
  const sources = await loadReadyProposalSources(context, dossierId, request.documentVersionIds);
  const graphTargets = await loadCurrentGraphTargets(context, dossierId);
  const claim = await claimProposalJob({
    context,
    dossierId,
    request,
    idempotencyKeyHash,
    requestDigest,
    dependencies,
  });
  if (claim.result === "ready") return readyJobReplay(context, claim.job);
  if (claim.result === "processing") {
    return { result: "processing", jobId: claim.job.id, attempt: claim.job.attempt, idempotent: true };
  }
  if (claim.result === "failed") {
    return failedJobResult(claim.job, true);
  }

  const job = claim.job;
  const leaseOwner = claim.leaseOwner;
  try {
    const verifiedSources = await readVerifiedProposalSources(bucket, dossierId, sources);
    const providerSources = buildBoundedProposalContext(verifiedSources);
    const analyzedSources = prepareAnalyzedSources(verifiedSources, providerSources);
    const permission = await dependencies.acquireProviderPermission();
    if (!permission.ok) {
      const failed = await failProposalJob(
        context,
        job,
        leaseOwner,
        permission.errorCode,
        permission.detailCode,
        dependencies.now(),
      );
      return failedJobResult(failed ?? job, false);
    }
    let providerResult: DossierProposalAIResult;
    try {
      providerResult = await dependencies.generateCandidates({
        safetyIdentifier: permission.safetyIdentifier,
        sources: providerSources,
        graphTargets,
      });
    } finally {
      await permission.release().catch(() => undefined);
    }
    if (providerResult.candidates.length === 0) {
      return commitReadyNoCandidateJob({
        context,
        dossierId,
        role,
        request,
        job,
        leaseOwner,
        providerReceiptDigest: providerResult.providerReceiptDigest,
        analyzedSources,
        dependencies,
      });
    }
    const commitNow = dependencies.now();
    const materialized = await materializeDossierProposalCandidates({
      dossierId,
      actorRef: context.actor.actorId,
      jobId: job.id,
      modelProvider: job.modelProvider,
      modelName: job.modelName,
      modelConfigurationDigest: job.modelConfigurationDigest,
      candidates: providerResult.candidates,
      sources: verifiedSources,
      analyzedSources,
      graphTargets,
      now: commitNow,
      newId: dependencies.newId,
    });
    await assertNoStoredAnchorDuplicates(context, dossierId, materialized.anchors);
    const staleOutputs = await currentProposalOutputs(context, dossierId);
    const completed = await commitReadyProposalJob({
      context,
      dossierId,
      role,
      request,
      job,
      leaseOwner,
      providerReceiptDigest: providerResult.providerReceiptDigest,
      analyzedSources,
      materialized,
      staleOutputs,
      dependencies,
      now: commitNow,
    });
    return completed;
  } catch (error) {
    const mapped = proposalGenerationFailure(error);
    const failed = await failProposalJob(
      context,
      job,
      leaseOwner,
      mapped.errorCode,
      mapped.detailCode,
      dependencies.now(),
    );
    return failedJobResult(failed ?? job, false);
  }
}

type ProposalSourceRecord = {
  documentId: string;
  documentVersionId: string;
  documentContentSha256: string;
  extractionResultId: string;
  extractionVersion: string;
  extractedTextObjectReference: string;
  extractedTextSha256: string;
  extractedTextByteLength: number;
  characterCount: number;
};

export type VerifiedProposalSource = ProposalSourceRecord & { text: string };

async function loadReadyProposalSources(
  context: GenerationContext,
  dossierId: string,
  documentVersionIds: string[],
): Promise<ProposalSourceRecord[]> {
  const rows = await context.db.select({
    documentId: dossierDocumentVersions.documentId,
    documentVersionId: dossierDocumentVersions.id,
    documentContentSha256: dossierDocumentVersions.contentSha256,
    extractionResultId: dossierExtractionResults.id,
    extractionVersion: dossierExtractionResults.extractorVersion,
    extractedTextObjectReference: dossierExtractionResults.extractedTextObjectReference,
    extractedTextSha256: dossierExtractionResults.extractedTextSha256,
    extractedTextByteLength: dossierExtractionResults.extractedTextByteLength,
    characterCount: dossierExtractionResults.characterCount,
  }).from(dossierDocumentVersions)
    .innerJoin(dossierDocuments, and(
      eq(dossierDocuments.dossierId, dossierDocumentVersions.dossierId),
      eq(dossierDocuments.id, dossierDocumentVersions.documentId),
    ))
    .innerJoin(dossierDocumentCurrentVersions, and(
      eq(dossierDocumentCurrentVersions.dossierId, dossierDocumentVersions.dossierId),
      eq(dossierDocumentCurrentVersions.documentId, dossierDocumentVersions.documentId),
      eq(dossierDocumentCurrentVersions.documentVersionId, dossierDocumentVersions.id),
    ))
    .innerJoin(dossierExtractionResults, and(
      eq(dossierExtractionResults.dossierId, dossierDocumentVersions.dossierId),
      eq(dossierExtractionResults.documentId, dossierDocumentVersions.documentId),
      eq(dossierExtractionResults.documentVersionId, dossierDocumentVersions.id),
      eq(dossierExtractionResults.extractorVersion, SUPPORTED_EXTRACTION_VERSION),
    ))
    .innerJoin(dossierExtractionJobs, and(
      eq(dossierExtractionJobs.dossierId, dossierExtractionResults.dossierId),
      eq(dossierExtractionJobs.id, dossierExtractionResults.extractionJobId),
      eq(dossierExtractionJobs.status, "ready"),
    ))
    .where(and(
      eq(dossierDocumentVersions.dossierId, dossierId),
      inArray(dossierDocumentVersions.id, documentVersionIds),
      eq(dossierDocuments.isProvisional, false),
    ))
    .orderBy(asc(dossierDocumentVersions.id))
    .limit(DOSSIER_PROPOSAL_MAX_SOURCE_VERSIONS + 1);
  if (
    rows.length !== documentVersionIds.length
    || rows.some((row) => row.extractedTextByteLength < 1
      || row.extractedTextByteLength > DOSSIER_PROPOSAL_MAX_SOURCE_OBJECT_BYTES
      || row.characterCount < 1)
  ) {
    throw new DossierProposalGenerationError(
      "source_not_ready",
      409,
      "Every selected source must be a finalized current document version with a supported ready extraction.",
    );
  }
  return rows;
}

async function loadCurrentGraphTargets(
  context: GenerationContext,
  dossierId: string,
): Promise<DossierProposalAIGraphTarget[]> {
  const records = await context.db.select({
    referenceId: dossierDecisionPackageReferences.id,
    referenceGraphDigest: dossierDecisionPackageReferences.graphDigest,
    packageId: caseVersions.caseId,
    packageVersion: caseVersions.version,
    packageFingerprint: caseVersions.fingerprint,
    studioFingerprint: caseVersions.studioFingerprint,
    parentPackageId: caseVersions.parentCaseId,
    parentPackageVersion: caseVersions.parentVersion,
    parentPackageFingerprint: caseVersions.parentFingerprint,
    payload: caseVersions.payload,
  }).from(dossierDecisionPackageReferences).innerJoin(caseVersions, and(
    eq(caseVersions.caseId, dossierDecisionPackageReferences.packageId),
    eq(caseVersions.version, dossierDecisionPackageReferences.packageVersion),
    eq(caseVersions.fingerprint, dossierDecisionPackageReferences.packageFingerprint),
    isNotNull(caseVersions.publishedAt),
  )).where(and(
    eq(dossierDecisionPackageReferences.dossierId, dossierId),
    eq(dossierDecisionPackageReferences.state, "current"),
    eq(dossierDecisionPackageReferences.graphValidationStatus, "valid"),
    eq(dossierDecisionPackageReferences.approvalState, "published"),
  )).orderBy(asc(dossierDecisionPackageReferences.id)).limit(11);
  const targets: DossierProposalAIGraphTarget[] = [];
  for (const record of records) {
    const validation = await validatePublishedDecisionPackage(record);
    if (!validation.ok || validation.value.graphDigest !== record.referenceGraphDigest) {
      throw new DossierProposalGenerationError(
        "graph_target_unavailable",
        409,
        "The current decision graph could not be revalidated.",
      );
    }
    for (const node of validation.value.draft.nodes) {
      targets.push({
        decision_package_reference_id: record.referenceId,
        target_type: "graph_node",
        target_id: node.id,
        label: `${node.type}: ${node.title}`.slice(0, 500),
      });
    }
    for (const link of validation.value.draft.links) {
      targets.push({
        decision_package_reference_id: record.referenceId,
        target_type: "graph_edge",
        target_id: link.id,
        label: (link.rule?.label || `${link.from} -> ${link.to}`).slice(0, 500),
      });
    }
    if (targets.length > DOSSIER_PROPOSAL_MAX_GRAPH_TARGETS) {
      throw new DossierProposalGenerationError(
        "graph_target_limit",
        409,
        "The current decision graph is too large for bounded proposal generation.",
      );
    }
  }
  return targets;
}

export async function readVerifiedProposalSources(
  bucket: R2Bucket,
  dossierId: string,
  sources: readonly ProposalSourceRecord[],
): Promise<VerifiedProposalSource[]> {
  const verified: VerifiedProposalSource[] = [];
  for (const source of sources) {
    const keyParts = parseDossierObjectKey(source.extractedTextObjectReference);
    if (keyParts.dossierId !== dossierId) throw sourceIntegrityError();
    const object = await bucket.get(source.extractedTextObjectReference);
    if (
      !object
      || object.size !== source.extractedTextByteLength
      || object.size < 1
      || object.size > DOSSIER_PROPOSAL_MAX_SOURCE_OBJECT_BYTES
      || object.httpMetadata?.contentType !== "text/plain; charset=utf-8"
      || object.customMetadata?.contentSha256 !== source.extractedTextSha256
      || canonicalR2Sha256(object.checksums.sha256) !== source.extractedTextSha256
    ) throw sourceIntegrityError();
    const bytes = new Uint8Array(await object.arrayBuffer());
    const digest = await sha256Bytes(bytes);
    if (bytes.byteLength !== source.extractedTextByteLength || digest.contentSha256 !== source.extractedTextSha256) {
      throw sourceIntegrityError();
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw sourceIntegrityError();
    }
    if (text.length !== source.characterCount || new TextEncoder().encode(text).byteLength !== bytes.byteLength) {
      throw sourceIntegrityError();
    }
    verified.push({ ...source, text });
  }
  return verified;
}

export function buildBoundedProposalContext(
  sources: readonly VerifiedProposalSource[],
): DossierProposalAISource[] {
  let remaining = DOSSIER_PROPOSAL_MAX_CONTEXT_CHARACTERS;
  return sources.map((source) => {
    let end = Math.min(source.text.length, DOSSIER_PROPOSAL_MAX_CONTEXT_PER_SOURCE, remaining);
    if (end > 0 && /[\uD800-\uDBFF]/u.test(source.text.at(end - 1) ?? "")) end -= 1;
    if (end < 1) {
      throw new DossierProposalGenerationError("source_context_limit", 413, "The selected source context is too large.");
    }
    remaining -= end;
    return {
      document_version_id: source.documentVersionId,
      extraction_version: source.extractionVersion,
      context_start: 0,
      context_end: end,
      text: source.text.slice(0, end),
    };
  });
}

export function prepareAnalyzedSources(
  sources: readonly VerifiedProposalSource[],
  providerSources: readonly DossierProposalAISource[],
): PreparedAnalyzedSource[] {
  if (sources.length !== providerSources.length) throw providerMaterializationError();
  return sources.map((source, index) => {
    const providerSource = providerSources[index];
    if (
      !providerSource
      || providerSource.document_version_id !== source.documentVersionId
      || providerSource.extraction_version !== source.extractionVersion
      || providerSource.context_start !== 0
      || providerSource.context_end < 1
      || providerSource.context_end > source.characterCount
      || providerSource.text !== source.text.slice(0, providerSource.context_end)
    ) throw providerMaterializationError();
    return {
      sourceOrdinal: index + 1,
      documentId: source.documentId,
      documentVersionId: source.documentVersionId,
      extractionResultId: source.extractionResultId,
      extractionVersion: source.extractionVersion,
      contextStart: 0,
      contextEnd: providerSource.context_end,
      sourceCharacterCount: source.characterCount,
      truncated: providerSource.context_end < source.characterCount,
      maximumCharactersPerSource: DOSSIER_PROPOSAL_MAX_CONTEXT_PER_SOURCE,
      maximumTotalCharacters: DOSSIER_PROPOSAL_MAX_CONTEXT_CHARACTERS,
    };
  });
}

type MaterializedAnchor = typeof dossierSourceAnchors.$inferInsert;
type MaterializedProposal = typeof dossierAIProposals.$inferInsert;

export type MaterializedDossierProposals = {
  anchors: MaterializedAnchor[];
  proposals: MaterializedProposal[];
  versions: Array<typeof dossierAIProposalVersions.$inferInsert>;
  proposalAnchors: Array<typeof dossierAIProposalAnchors.$inferInsert>;
};

export async function materializeDossierProposalCandidates(input: {
  dossierId: string;
  actorRef: string;
  jobId: string;
  modelProvider: string;
  modelName: string;
  modelConfigurationDigest: string;
  candidates: DossierProposalAICandidate[];
  sources: VerifiedProposalSource[];
  analyzedSources: PreparedAnalyzedSource[];
  graphTargets: DossierProposalAIGraphTarget[];
  now: string;
  newId: DossierProposalGenerationDependencies["newId"];
}): Promise<MaterializedDossierProposals> {
  if (input.candidates.length < 1 || input.candidates.length > 20) throw providerMaterializationError();
  const sources = new Map(input.sources.map((source) => [source.documentVersionId, source]));
  const analyzedEnds = new Map(input.analyzedSources.map((source) => [source.documentVersionId, source.contextEnd]));
  const graphTargets = new Set(input.graphTargets.map((target) => graphTargetKey(target)));
  const anchors: MaterializedAnchor[] = [];
  const proposals: MaterializedProposal[] = [];
  const versions: Array<typeof dossierAIProposalVersions.$inferInsert> = [];
  const proposalAnchors: Array<typeof dossierAIProposalAnchors.$inferInsert> = [];
  const anchorIdBySpan = new Map<string, string>();
  const candidateKeys = new Set<string>();
  for (const candidate of input.candidates) {
    const source = sources.get(candidate.document_version_id);
    if (
      !source
      || candidate.character_end > (analyzedEnds.get(candidate.document_version_id) ?? -1)
      || candidate.character_end > source.text.length
      || source.text.slice(candidate.character_start, candidate.character_end) !== candidate.exact_excerpt
    ) throw providerMaterializationError();
    const spanKey = `${candidate.document_version_id}:${candidate.character_start}:${candidate.character_end}`;
    const candidateKey = canonicalDossierJson(candidate);
    if (candidateKeys.has(candidateKey)) throw providerMaterializationError();
    candidateKeys.add(candidateKey);
    if (candidate.proposal_type === "evidence_link") {
      if (!graphTargets.has(graphTargetKey({
        decision_package_reference_id: candidate.decision_package_reference_id!,
        target_type: candidate.target_type!,
        target_id: candidate.target_id!,
      }))) throw providerMaterializationError();
    }
    let anchorId = anchorIdBySpan.get(spanKey);
    if (!anchorId) {
      anchorId = input.newId("source_anchor");
      anchorIdBySpan.set(spanKey, anchorId);
    }
    const proposalId = input.newId("proposal");
    const anchorInput = {
      documentId: source.documentId,
      documentVersionId: source.documentVersionId,
      pageNumber: null,
      section: null,
      heading: null,
      paragraph: null,
      characterStart: candidate.character_start,
      characterEnd: candidate.character_end,
      excerpt: candidate.exact_excerpt,
      extractionVersion: source.extractionVersion,
    };
    const anchorChecksum = await sourceAnchorChecksum(
      input.dossierId,
      anchorInput,
      source.documentContentSha256,
    );
    const proposedValue: JsonValue = candidate.proposal_type === "evidence_link"
      ? {
          schema_version: 1,
          source_anchor_id: anchorId,
          decision_package_reference_id: candidate.decision_package_reference_id!,
          target_type: candidate.target_type!,
          target_id: candidate.target_id!,
          relation: candidate.relation!,
          professional_meaning: candidate.professional_meaning!,
        }
      : { schema_version: 1, statement: candidate.statement };
    if (!anchors.some(({ id }) => id === anchorId)) {
      anchors.push({
        id: anchorId,
        dossierId: input.dossierId,
        ...anchorInput,
        anchorChecksum,
        creator: "ai_proposal",
        reviewState: "pending",
        reviewerUserId: null,
        reviewerActorRef: null,
        reviewedAt: null,
        createdByActorRef: input.actorRef,
        createdAt: input.now,
      });
    }
    proposals.push({
      id: proposalId,
      dossierId: input.dossierId,
      generationJobId: input.jobId,
      proposalType: candidate.proposal_type,
      proposedValue,
      confidenceCategory: null,
      confidenceScore: null,
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      modelConfigurationDigest: input.modelConfigurationDigest,
      reviewState: "pending",
      reviewingUserId: null,
      reviewingActorRef: null,
      reviewedAt: null,
      reviewNote: null,
      acceptedObjectType: null,
      acceptedObjectId: null,
      createdByActorRef: input.actorRef,
      createdAt: input.now,
    });
    versions.push({
      dossierId: input.dossierId,
      proposalId,
      documentId: source.documentId,
      documentVersionId: source.documentVersionId,
    });
    proposalAnchors.push({ dossierId: input.dossierId, proposalId, sourceAnchorId: anchorId });
  }
  return { anchors, proposals, versions, proposalAnchors };
}

async function proposalGenerationDigests(input: {
  dossierId: string;
  actorRef: string;
  request: DossierProposalGenerationRequest;
  modelProvider: string;
  modelName: string;
  modelConfigurationDigest: string;
}) {
  const idempotencyKeyHash = await generationSha256(input.request.idempotencyKey);
  const requestDigest = await generationSha256(canonicalDossierJson({
    kind: "genesis-juris-dossier-proposal-generation-request-v1",
    dossier_id: input.dossierId,
    requested_by_actor_ref: input.actorRef,
    expected_dossier_revision: input.request.expectedRevision,
    data_classification: input.request.dataClassification,
    privacy_disclosure_acknowledged: input.request.privacyDisclosureAcknowledged,
    document_version_ids: input.request.documentVersionIds,
    model: {
      provider: input.modelProvider,
      name: input.modelName,
      configuration_digest: input.modelConfigurationDigest,
    },
  }));
  return { idempotencyKeyHash, requestDigest };
}

type JobClaim =
  | { result: "claimed"; job: StoredProposalJob; leaseOwner: string }
  | { result: "ready"; job: StoredProposalJob }
  | { result: "processing"; job: StoredProposalJob }
  | { result: "failed"; job: StoredProposalJob };

async function claimProposalJob(input: {
  context: GenerationContext;
  dossierId: string;
  request: DossierProposalGenerationRequest;
  idempotencyKeyHash: string;
  requestDigest: string;
  dependencies: DossierProposalGenerationDependencies;
}): Promise<JobClaim> {
  const { context, dossierId, request, dependencies } = input;
  let job = await findProposalJob(
    context,
    dossierId,
    context.actor.actorId,
    request.expectedRevision,
    input.idempotencyKeyHash,
    input.requestDigest,
  );
  if (job) {
    assertExactJobBinding(job, input);
    if (job.status === "ready") return { result: "ready", job };
    const replayNow = dependencies.now();
    if (job.status === "processing" && Date.parse(job.leaseExpiresAt ?? "") > Date.parse(replayNow)) {
      return { result: "processing", job };
    }
    if (job.status === "failed" && !request.retryFailed) return { result: "failed", job };
  }
  const [dossier] = await context.db.select({ revision: dossiers.revision }).from(dossiers).where(and(
    eq(dossiers.id, dossierId),
    eq(dossiers.revision, request.expectedRevision),
  )).limit(1);
  if (!dossier) {
    throw new DossierProposalGenerationError("revision_conflict", 409, "The Matter changed before proposal generation.");
  }
  if (!job) {
    const now = dependencies.now();
    const values = {
      id: dependencies.newId("proposal_job"),
      dossierId,
      expectedDossierRevision: request.expectedRevision,
      requestedByUserId: context.actor.userId,
      requestedByActorRef: context.actor.actorId,
      idempotencyKeyHash: input.idempotencyKeyHash,
      requestDigest: input.requestDigest,
      status: "queued" as const,
      attempt: 1,
      modelProvider: dependencies.modelProvider,
      modelName: dependencies.modelName,
      modelConfigurationDigest: dependencies.modelConfigurationDigest,
      leaseOwner: null,
      leaseExpiresAt: null,
      providerReceiptDigest: null,
      errorCode: null,
      errorDetailCode: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    };
    try {
      await context.db.insert(dossierAIProposalJobs).values(values);
      job = values;
    } catch {
      job = await findProposalJob(
        context,
        dossierId,
        context.actor.actorId,
        request.expectedRevision,
        input.idempotencyKeyHash,
        input.requestDigest,
      );
      if (!job) {
        throw new DossierProposalGenerationError("generation_capacity_reached", 429, "Too many proposal jobs are active.");
      }
    }
  }
  assertExactJobBinding(job, input);
  if (job.status === "ready") return { result: "ready", job };
  const now = dependencies.now();
  if (job.status === "processing" && Date.parse(job.leaseExpiresAt ?? "") > Date.parse(now)) {
    return { result: "processing", job };
  }
  if (job.status === "failed" && !request.retryFailed) return { result: "failed", job };
  let queued = job;
  if (job.status === "failed" || job.status === "processing") {
    if (job.attempt >= DOSSIER_PROPOSAL_MAX_ATTEMPTS) return { result: "failed", job };
    const requeuedAt = dependencies.now();
    await context.db.update(dossierAIProposalJobs).set({
      status: "queued",
      attempt: job.attempt + 1,
      leaseOwner: null,
      leaseExpiresAt: null,
      providerReceiptDigest: null,
      errorCode: null,
      errorDetailCode: null,
      updatedAt: requeuedAt,
      startedAt: null,
      completedAt: null,
    }).where(and(
      eq(dossierAIProposalJobs.dossierId, dossierId),
      eq(dossierAIProposalJobs.id, job.id),
      eq(dossierAIProposalJobs.status, job.status),
      eq(dossierAIProposalJobs.attempt, job.attempt),
      job.status === "processing" ? eq(dossierAIProposalJobs.leaseOwner, job.leaseOwner!) : undefined,
      job.status === "processing" ? lt(dossierAIProposalJobs.leaseExpiresAt, requeuedAt) : undefined,
    ));
    const [fresh] = await context.db.select().from(dossierAIProposalJobs).where(and(
      eq(dossierAIProposalJobs.dossierId, dossierId),
      eq(dossierAIProposalJobs.id, job.id),
    )).limit(1);
    if (!fresh) throw new DossierProposalGenerationError("generation_unavailable", 503, "Proposal generation is unavailable.");
    if (fresh.status !== "queued") return { result: fresh.status === "ready" ? "ready" : fresh.status === "failed" ? "failed" : "processing", job: fresh };
    queued = fresh;
  }
  const leaseOwner = dependencies.newId("proposal_worker");
  const startedAt = dependencies.now();
  const leaseExpiresAt = new Date(Date.parse(startedAt) + PROPOSAL_JOB_LEASE_MS).toISOString();
  await context.db.update(dossierAIProposalJobs).set({
    status: "processing",
    leaseOwner,
    leaseExpiresAt,
    errorCode: null,
    errorDetailCode: null,
    startedAt,
    completedAt: null,
    updatedAt: startedAt,
  }).where(and(
    eq(dossierAIProposalJobs.dossierId, dossierId),
    eq(dossierAIProposalJobs.id, queued.id),
    eq(dossierAIProposalJobs.status, "queued"),
    eq(dossierAIProposalJobs.attempt, queued.attempt),
  ));
  const [claimed] = await context.db.select().from(dossierAIProposalJobs).where(and(
    eq(dossierAIProposalJobs.dossierId, dossierId),
    eq(dossierAIProposalJobs.id, queued.id),
  )).limit(1);
  if (!claimed) throw new DossierProposalGenerationError("generation_unavailable", 503, "Proposal generation is unavailable.");
  if (claimed.status !== "processing" || claimed.leaseOwner !== leaseOwner) {
    return { result: claimed.status === "ready" ? "ready" : claimed.status === "failed" ? "failed" : "processing", job: claimed };
  }
  return { result: "claimed", job: claimed, leaseOwner };
}

async function findProposalJob(
  context: GenerationContext,
  dossierId: string,
  actorRef: string,
  expectedRevision: number,
  idempotencyKeyHash: string,
  requestDigest: string,
) {
  const [byKey] = await context.db.select().from(dossierAIProposalJobs).where(and(
    eq(dossierAIProposalJobs.dossierId, dossierId),
    eq(dossierAIProposalJobs.requestedByActorRef, actorRef),
    eq(dossierAIProposalJobs.idempotencyKeyHash, idempotencyKeyHash),
  )).limit(1);
  if (byKey) return byKey;
  const [byRequest] = await context.db.select().from(dossierAIProposalJobs).where(and(
    eq(dossierAIProposalJobs.dossierId, dossierId),
    eq(dossierAIProposalJobs.expectedDossierRevision, expectedRevision),
    eq(dossierAIProposalJobs.requestDigest, requestDigest),
  )).limit(1);
  return byRequest;
}

function assertExactJobBinding(
  job: StoredProposalJob,
  input: {
    dossierId: string;
    request: DossierProposalGenerationRequest;
    idempotencyKeyHash: string;
    requestDigest: string;
    dependencies: DossierProposalGenerationDependencies;
  },
) {
  if (
    job.dossierId !== input.dossierId
    || job.expectedDossierRevision !== input.request.expectedRevision
    || job.requestDigest !== input.requestDigest
    || job.modelProvider !== input.dependencies.modelProvider
    || job.modelName !== input.dependencies.modelName
    || job.modelConfigurationDigest !== input.dependencies.modelConfigurationDigest
  ) {
    throw idempotencyConflict();
  }
}

async function commitReadyProposalJob(input: {
  context: GenerationContext;
  dossierId: string;
  role: DossierRole;
  request: DossierProposalGenerationRequest;
  job: StoredProposalJob;
  leaseOwner: string;
  providerReceiptDigest: string;
  analyzedSources: PreparedAnalyzedSource[];
  materialized: MaterializedDossierProposals;
  staleOutputs: Array<{ outputId: string; sequence: number }>;
  dependencies: DossierProposalGenerationDependencies;
  now: string;
}): Promise<DossierProposalGenerationResult> {
  const now = input.now;
  const nextRevision = input.request.expectedRevision + 1;
  const auditInputs: DossierAuditEventInput[] = [
    ...input.materialized.anchors.map((anchor) => ({
      actorRole: input.role,
      eventType: "source_anchor_reviewed" as const,
      objectRefType: "source_anchor" as const,
      objectRefId: anchor.id!,
      summaryCode: "SOURCE_ANCHOR_CREATED",
      detail: {
        lifecycle_event: "generated_pending",
        generation_job_id: input.job.id,
        document_id: anchor.documentId,
        document_version_id: anchor.documentVersionId,
        anchor_checksum: anchor.anchorChecksum,
        review_state: "pending",
        revision_before: input.request.expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    })),
    ...input.materialized.proposals.map((proposal) => ({
      actorRole: input.role,
      eventType: "proposal_reviewed" as const,
      objectRefType: "ai_proposal" as const,
      objectRefId: proposal.id!,
      summaryCode: "AI_PROPOSAL_CREATED",
      detail: {
        lifecycle_event: "generated_pending",
        generation_job_id: input.job.id,
        proposal_type: proposal.proposalType,
        source_version_count: 1,
        source_anchor_count: 1,
        model_configuration_digest: input.job.modelConfigurationDigest,
        revision_before: input.request.expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    })),
    ...input.staleOutputs.map((output) => ({
      actorRole: input.role,
      eventType: "output_marked_stale" as const,
      objectRefType: "governed_output" as const,
      objectRefId: output.outputId,
      summaryCode: "OUTPUT_MARKED_STALE",
      detail: {
        reason_code: "AI_PROPOSAL_CHANGED",
        generation_job_id: input.job.id,
        dossier_revision: nextRevision,
      },
      occurredAt: now,
    })),
    proposalGenerationCompletionAudit({
      dossierId: input.dossierId,
      jobId: input.job.id,
      actorRole: input.role,
      candidateCount: input.materialized.proposals.length,
      analyzedSources: input.analyzedSources,
      providerReceiptDigest: input.providerReceiptDigest,
      occurredAt: now,
    }),
  ];
  const { auditEvents, revisionReceipt } = await input.dependencies.prepareRevisionAuditBatch(
    input.dossierId,
    nextRevision,
    auditInputs,
  );
  const statements = [
    input.context.db.update(dossiers).set({
      revision: nextRevision,
      updatedByActorRef: input.context.actor.actorId,
      updatedAt: now,
    }).where(and(
      eq(dossiers.id, input.dossierId),
      eq(dossiers.revision, input.request.expectedRevision),
    )),
    ...proposalJobSourceStatements(
      input.context,
      input.dossierId,
      input.job,
      input.leaseOwner,
      input.analyzedSources,
      now,
    ),
    ...input.materialized.anchors.map((anchor) => input.context.db.insert(dossierSourceAnchors).values(anchor)),
    ...input.materialized.proposals.map((proposal) => input.context.db.insert(dossierAIProposals).values(proposal)),
    ...input.materialized.versions.map((version) => input.context.db.insert(dossierAIProposalVersions).values(version)),
    ...input.materialized.proposalAnchors.map((anchor) => input.context.db.insert(dossierAIProposalAnchors).values(anchor)),
    ...input.staleOutputs.map((output) => input.context.db.insert(dossierOutputStateEvents).values({
      id: input.dependencies.newId("output_state"),
      dossierId: input.dossierId,
      outputId: output.outputId,
      sequence: output.sequence + 1,
      state: "stale",
      reason: "AI_PROPOSAL_CHANGED",
      occurredAt: now,
      actorRef: input.context.actor.actorId,
    })),
    ...auditEvents.map((event) => input.context.db.insert(dossierAuditEvents).values(event)),
    input.context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    input.context.db.update(dossierAIProposalJobs).set({
      status: "ready",
      leaseOwner: null,
      leaseExpiresAt: null,
      providerReceiptDigest: input.providerReceiptDigest,
      errorCode: null,
      errorDetailCode: null,
      completedAt: now,
      updatedAt: now,
    }).where(and(
      eq(dossierAIProposalJobs.dossierId, input.dossierId),
      eq(dossierAIProposalJobs.id, input.job.id),
      eq(dossierAIProposalJobs.status, "processing"),
      eq(dossierAIProposalJobs.attempt, input.job.attempt),
      eq(dossierAIProposalJobs.leaseOwner, input.leaseOwner),
    )),
  ];
  await input.context.db.batch([statements[0]!, ...statements.slice(1)]);
  return {
    result: "ready",
    jobId: input.job.id,
    proposalIds: input.materialized.proposals.map((proposal) => proposal.id!),
    sourceAnchorIds: input.materialized.anchors.map((anchor) => anchor.id!),
    dossierRevision: nextRevision,
    providerReceiptDigest: input.providerReceiptDigest,
    outcome: "candidates_ready",
    analyzedSources: projectAnalyzedSources(input.analyzedSources),
    idempotent: false,
  };
}

async function commitReadyNoCandidateJob(input: {
  context: GenerationContext;
  dossierId: string;
  role: DossierRole;
  request: DossierProposalGenerationRequest;
  job: StoredProposalJob;
  leaseOwner: string;
  providerReceiptDigest: string;
  analyzedSources: PreparedAnalyzedSource[];
  dependencies: DossierProposalGenerationDependencies;
}): Promise<DossierProposalGenerationResult> {
  const now = input.dependencies.now();
  const [completionAudit] = await input.dependencies.prepareAuditEvents(
    input.dossierId,
    input.request.expectedRevision,
    [proposalGenerationCompletionAudit({
      dossierId: input.dossierId,
      jobId: input.job.id,
      actorRole: input.role,
      candidateCount: 0,
      analyzedSources: input.analyzedSources,
      providerReceiptDigest: input.providerReceiptDigest,
      occurredAt: now,
    })],
  );
  if (!completionAudit) throw generationReceiptUnavailable();
  const statements = [
    ...proposalJobSourceStatements(
      input.context,
      input.dossierId,
      input.job,
      input.leaseOwner,
      input.analyzedSources,
      now,
    ),
    input.context.db.insert(dossierAuditEvents).values(completionAudit),
    readyProposalJobStatement({
      context: input.context,
      dossierId: input.dossierId,
      job: input.job,
      leaseOwner: input.leaseOwner,
      providerReceiptDigest: input.providerReceiptDigest,
      now,
    }),
  ];
  await input.context.db.batch([statements[0]!, ...statements.slice(1)]);
  return {
    result: "ready",
    jobId: input.job.id,
    proposalIds: [],
    sourceAnchorIds: [],
    dossierRevision: input.request.expectedRevision,
    providerReceiptDigest: input.providerReceiptDigest,
    outcome: "no_candidates",
    analyzedSources: projectAnalyzedSources(input.analyzedSources),
    idempotent: false,
  };
}

function proposalGenerationCompletionAudit(input: {
  dossierId: string;
  jobId: string;
  actorRole: DossierRole;
  candidateCount: number;
  analyzedSources: readonly PreparedAnalyzedSource[];
  providerReceiptDigest: string;
  occurredAt: string;
}): DossierAuditEventInput {
  const noCandidates = input.candidateCount === 0;
  return {
    actorRole: input.actorRole,
    eventType: "proposal_generation_completed",
    objectRefType: "dossier",
    objectRefId: input.dossierId,
    summaryCode: noCandidates
      ? "AI_PROPOSAL_GENERATION_NO_CANDIDATES"
      : "AI_PROPOSAL_GENERATION_READY",
    detail: {
      job_id: input.jobId,
      result_code: noCandidates ? "ready_no_candidates" : "ready_with_candidates",
      candidate_count: input.candidateCount,
      analyzed_source_count: input.analyzedSources.length,
      analyzed_character_count: analyzedCharacterCount(input.analyzedSources),
      model_receipt_digest: input.providerReceiptDigest,
    },
    occurredAt: input.occurredAt,
  };
}

function proposalJobSourceStatements(
  context: GenerationContext,
  dossierId: string,
  job: StoredProposalJob,
  leaseOwner: string,
  analyzedSources: readonly PreparedAnalyzedSource[],
  now: string,
) {
  return analyzedSources.map((source) => context.db.insert(dossierAIProposalJobSources).values({
    dossierId,
    jobId: job.id,
    jobAttempt: job.attempt,
    leaseOwner,
    sourceOrdinal: source.sourceOrdinal,
    documentId: source.documentId,
    documentVersionId: source.documentVersionId,
    extractionResultId: source.extractionResultId,
    contextStart: source.contextStart,
    contextEnd: source.contextEnd,
    createdAt: now,
  }));
}

function readyProposalJobStatement(input: {
  context: GenerationContext;
  dossierId: string;
  job: StoredProposalJob;
  leaseOwner: string;
  providerReceiptDigest: string;
  now: string;
}) {
  return input.context.db.update(dossierAIProposalJobs).set({
    status: "ready",
    leaseOwner: null,
    leaseExpiresAt: null,
    providerReceiptDigest: input.providerReceiptDigest,
    errorCode: null,
    errorDetailCode: null,
    completedAt: input.now,
    updatedAt: input.now,
  }).where(and(
    eq(dossierAIProposalJobs.dossierId, input.dossierId),
    eq(dossierAIProposalJobs.id, input.job.id),
    eq(dossierAIProposalJobs.status, "processing"),
    eq(dossierAIProposalJobs.attempt, input.job.attempt),
    eq(dossierAIProposalJobs.leaseOwner, input.leaseOwner),
  ));
}

function analyzedCharacterCount(sources: readonly Pick<PreparedAnalyzedSource, "contextStart" | "contextEnd">[]) {
  return sources.reduce((total, source) => total + source.contextEnd - source.contextStart, 0);
}

function projectAnalyzedSources(sources: readonly PreparedAnalyzedSource[]): DossierProposalAnalyzedSource[] {
  return sources.map((source) => ({
    documentVersionId: source.documentVersionId,
    extractionVersion: source.extractionVersion,
    contextStart: 0,
    contextEnd: source.contextEnd,
    sourceCharacterCount: source.sourceCharacterCount,
    truncated: source.truncated,
    maximumCharactersPerSource: DOSSIER_PROPOSAL_MAX_CONTEXT_PER_SOURCE,
    maximumTotalCharacters: DOSSIER_PROPOSAL_MAX_CONTEXT_CHARACTERS,
  }));
}

async function currentProposalOutputs(context: GenerationContext, dossierId: string) {
  const states = await context.db.select({
    outputId: dossierOutputStateEvents.outputId,
    sequence: dossierOutputStateEvents.sequence,
    state: dossierOutputStateEvents.state,
  }).from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, dossierId))
    .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence))
    .limit(MAX_OUTPUT_STATE_ROWS + 1);
  if (states.length > MAX_OUTPUT_STATE_ROWS) {
    throw new DossierProposalGenerationError("output_state_limit", 409, "The Matter has too much output history to stale safely.");
  }
  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  return [...latest.values()].filter(({ state }) => state === "current")
    .map(({ outputId, sequence }) => ({ outputId, sequence }));
}

async function assertNoStoredAnchorDuplicates(
  context: GenerationContext,
  dossierId: string,
  anchors: readonly MaterializedAnchor[],
) {
  const checksums = anchors.map((anchor) => anchor.anchorChecksum);
  const [duplicate] = await context.db.select({ id: dossierSourceAnchors.id }).from(dossierSourceAnchors).where(and(
    eq(dossierSourceAnchors.dossierId, dossierId),
    inArray(dossierSourceAnchors.anchorChecksum, checksums),
  )).limit(1);
  if (duplicate) throw providerMaterializationError();
}

async function readyJobReplay(
  context: GenerationContext,
  job: StoredProposalJob,
): Promise<DossierProposalGenerationResult> {
  const proposals = await context.db.select({ id: dossierAIProposals.id }).from(dossierAIProposals).where(and(
    eq(dossierAIProposals.dossierId, job.dossierId),
    eq(dossierAIProposals.generationJobId, job.id),
  )).orderBy(asc(dossierAIProposals.id)).limit(21);
  const proposalIds = proposals.map(({ id }) => id);
  const anchors = proposalIds.length === 0 ? [] : await context.db.select({
    id: dossierAIProposalAnchors.sourceAnchorId,
  }).from(dossierAIProposalAnchors).where(and(
    eq(dossierAIProposalAnchors.dossierId, job.dossierId),
    inArray(dossierAIProposalAnchors.proposalId, proposalIds),
  )).orderBy(asc(dossierAIProposalAnchors.sourceAnchorId)).limit(21);
  const sourceRows = await context.db.select({
    sourceOrdinal: dossierAIProposalJobSources.sourceOrdinal,
    documentId: dossierAIProposalJobSources.documentId,
    documentVersionId: dossierAIProposalJobSources.documentVersionId,
    extractionResultId: dossierAIProposalJobSources.extractionResultId,
    contextStart: dossierAIProposalJobSources.contextStart,
    contextEnd: dossierAIProposalJobSources.contextEnd,
    extractionVersion: dossierExtractionResults.extractorVersion,
    sourceCharacterCount: dossierExtractionResults.characterCount,
  }).from(dossierAIProposalJobSources).innerJoin(dossierExtractionResults, and(
    eq(dossierExtractionResults.dossierId, dossierAIProposalJobSources.dossierId),
    eq(dossierExtractionResults.id, dossierAIProposalJobSources.extractionResultId),
    eq(dossierExtractionResults.documentId, dossierAIProposalJobSources.documentId),
    eq(dossierExtractionResults.documentVersionId, dossierAIProposalJobSources.documentVersionId),
  )).where(and(
    eq(dossierAIProposalJobSources.dossierId, job.dossierId),
    eq(dossierAIProposalJobSources.jobId, job.id),
  )).orderBy(asc(dossierAIProposalJobSources.sourceOrdinal)).limit(DOSSIER_PROPOSAL_MAX_SOURCE_VERSIONS + 1);
  const analyzedSources: PreparedAnalyzedSource[] = sourceRows.map((source) => ({
    ...source,
    contextStart: 0,
    truncated: source.contextEnd < source.sourceCharacterCount,
    maximumCharactersPerSource: DOSSIER_PROPOSAL_MAX_CONTEXT_PER_SOURCE,
    maximumTotalCharacters: DOSSIER_PROPOSAL_MAX_CONTEXT_CHARACTERS,
  }));
  const resultRevision = proposalIds.length === 0 ? job.expectedDossierRevision : job.expectedDossierRevision + 1;
  const completionAudits = await context.db.select({
    dossierRevision: dossierAuditEvents.dossierRevision,
    actorUserId: dossierAuditEvents.actorUserId,
    actorRef: dossierAuditEvents.actorRef,
    summaryCode: dossierAuditEvents.summaryCode,
    detail: dossierAuditEvents.detail,
  }).from(dossierAuditEvents).where(and(
    eq(dossierAuditEvents.dossierId, job.dossierId),
    eq(dossierAuditEvents.eventType, "proposal_generation_completed"),
    eq(dossierAuditEvents.objectRefType, "dossier"),
    eq(dossierAuditEvents.objectRefId, job.dossierId),
    sql`json_extract(${dossierAuditEvents.detail}, '$.job_id') = ${job.id}`,
  )).limit(2);
  const receipts = await context.db.select({
    resultingRevision: dossierRevisionReceipts.resultingRevision,
  }).from(dossierRevisionReceipts).where(and(
    eq(dossierRevisionReceipts.dossierId, job.dossierId),
    eq(dossierRevisionReceipts.resultingRevision, resultRevision),
  )).limit(2);
  const completionAudit = completionAudits[0];
  const validSources = analyzedSources.length >= 1
    && analyzedSources.length <= DOSSIER_PROPOSAL_MAX_SOURCE_VERSIONS
    && analyzedSources.every((source, index) => source.sourceOrdinal === index + 1
      && source.contextStart === 0
      && source.contextEnd > 0
      && source.contextEnd <= source.sourceCharacterCount
      && source.contextEnd <= DOSSIER_PROPOSAL_MAX_CONTEXT_PER_SOURCE
      && source.extractionVersion === SUPPORTED_EXTRACTION_VERSION)
    && analyzedCharacterCount(analyzedSources) <= DOSSIER_PROPOSAL_MAX_CONTEXT_CHARACTERS;
  if (
    proposalIds.length > 20
    || (proposalIds.length === 0 ? anchors.length !== 0 : anchors.length !== proposalIds.length)
    || !job.providerReceiptDigest
    || !/^sha256-[a-f0-9]{64}$/u.test(job.providerReceiptDigest)
    || !validSources
    || completionAudits.length !== 1
    || !completionAudit
    || completionAudit.dossierRevision !== resultRevision
    || completionAudit.actorUserId !== job.requestedByUserId
    || completionAudit.actorRef !== job.requestedByActorRef
    || !validCompletionAuditDetail(
      completionAudit.detail,
      completionAudit.summaryCode,
      job,
      proposalIds.length,
      analyzedSources,
    )
    || receipts.length !== 1
  ) throw generationReceiptUnavailable();
  return {
    result: "ready",
    jobId: job.id,
    proposalIds,
    sourceAnchorIds: [...new Set(anchors.map(({ id }) => id))],
    dossierRevision: resultRevision,
    providerReceiptDigest: job.providerReceiptDigest,
    outcome: proposalIds.length === 0 ? "no_candidates" : "candidates_ready",
    analyzedSources: projectAnalyzedSources(analyzedSources),
    idempotent: true,
  };
}

function validCompletionAuditDetail(
  value: unknown,
  summaryCode: string,
  job: StoredProposalJob,
  candidateCount: number,
  analyzedSources: readonly PreparedAnalyzedSource[],
) {
  if (!isRecord(value)) return false;
  const expectedKeys = [
    "analyzed_character_count",
    "analyzed_source_count",
    "candidate_count",
    "job_id",
    "model_receipt_digest",
    "result_code",
  ];
  const actualKeys = Object.keys(value).sort();
  const noCandidates = candidateCount === 0;
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index])
    && value.job_id === job.id
    && value.result_code === (noCandidates ? "ready_no_candidates" : "ready_with_candidates")
    && value.candidate_count === candidateCount
    && value.analyzed_source_count === analyzedSources.length
    && value.analyzed_character_count === analyzedCharacterCount(analyzedSources)
    && value.model_receipt_digest === job.providerReceiptDigest
    && summaryCode === (noCandidates
      ? "AI_PROPOSAL_GENERATION_NO_CANDIDATES"
      : "AI_PROPOSAL_GENERATION_READY");
}

async function failProposalJob(
  context: GenerationContext,
  job: StoredProposalJob,
  leaseOwner: string,
  errorCode: "rate_limited" | "provider_unavailable" | "invalid_response" | "safety_rejected" | "timeout" | "internal_error",
  errorDetailCode: string,
  now: string,
) {
  const boundedDetailCode = errorDetailCode.toLowerCase().replaceAll(/[^a-z0-9_]/gu, "_").slice(0, 120);
  await context.db.update(dossierAIProposalJobs).set({
    status: "failed",
    leaseOwner: null,
    leaseExpiresAt: null,
    providerReceiptDigest: null,
    errorCode,
    errorDetailCode: boundedDetailCode || "generation_internal_failure",
    completedAt: now,
    updatedAt: now,
  }).where(and(
    eq(dossierAIProposalJobs.dossierId, job.dossierId),
    eq(dossierAIProposalJobs.id, job.id),
    eq(dossierAIProposalJobs.status, "processing"),
    eq(dossierAIProposalJobs.attempt, job.attempt),
    eq(dossierAIProposalJobs.leaseOwner, leaseOwner),
  ));
  return (await context.db.select().from(dossierAIProposalJobs).where(and(
    eq(dossierAIProposalJobs.dossierId, job.dossierId),
    eq(dossierAIProposalJobs.id, job.id),
  )).limit(1))[0];
}

function failedJobResult(job: StoredProposalJob, idempotent: boolean): DossierProposalGenerationResult {
  return {
    result: "failed",
    jobId: job.id,
    attempt: job.attempt,
    errorCode: job.errorCode ?? "internal_error",
    retryable: job.attempt < DOSSIER_PROPOSAL_MAX_ATTEMPTS,
    idempotent,
  };
}

function proposalGenerationFailure(error: unknown): {
  errorCode: "rate_limited" | "provider_unavailable" | "invalid_response" | "safety_rejected" | "timeout" | "internal_error";
  detailCode: string;
} {
  if (error instanceof DossierProposalAIError) {
    return { errorCode: error.code, detailCode: error.detailCode };
  }
  if (error instanceof DossierProposalGenerationError) {
    return {
      errorCode: error.code === "revision_conflict" ? "internal_error" : "invalid_response",
      detailCode: error.code === "revision_conflict" ? "DOSSIER_REVISION_STALE" : "MATERIALIZATION_REJECTED",
    };
  }
  return { errorCode: "internal_error", detailCode: "GENERATION_INTERNAL_FAILURE" };
}

async function sourceAnchorChecksum(
  dossierId: string,
  input: {
    documentId: string;
    documentVersionId: string;
    pageNumber: number | null;
    section: string | null;
    heading: string | null;
    paragraph: string | null;
    characterStart: number;
    characterEnd: number;
    excerpt: string;
    extractionVersion: string;
  },
  documentContentSha256: string,
) {
  return generationSha256(canonicalDossierJson({
    kind: "genesis-juris-source-anchor-v1",
    dossier_id: dossierId,
    document_id: input.documentId,
    document_version_id: input.documentVersionId,
    document_content_sha256: documentContentSha256,
    page_number: input.pageNumber,
    section: input.section,
    heading: input.heading,
    paragraph: input.paragraph,
    character_start: input.characterStart,
    character_end: input.characterEnd,
    excerpt: input.excerpt,
    extraction_version: input.extractionVersion,
  }));
}

function graphTargetKey(target: Pick<
  DossierProposalAIGraphTarget,
  "decision_package_reference_id" | "target_type" | "target_id"
>) {
  return `${target.decision_package_reference_id}:${target.target_type}:${target.target_id}`;
}

function sourceIntegrityError() {
  return new DossierProposalGenerationError(
    "source_integrity_failed",
    409,
    "A selected extraction no longer matches its private stored object.",
  );
}

function providerMaterializationError() {
  return new DossierProposalGenerationError(
    "invalid_provider_candidate",
    409,
    "The generated candidates could not be bound to exact source spans and current graph targets.",
  );
}

function generationReceiptUnavailable() {
  return new DossierProposalGenerationError(
    "generation_receipt_unavailable",
    503,
    "The completed proposal receipt is unavailable.",
  );
}

function invalidRequest() {
  return new DossierProposalGenerationError("invalid_request", 400, "The proposal-generation request is invalid.");
}

function idempotencyConflict() {
  return new DossierProposalGenerationError(
    "idempotency_conflict",
    409,
    "The idempotency key is already bound to a different proposal-generation request.",
  );
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function opaqueReference(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/u.test(value);
}

async function generationSha256(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  ));
  return `sha256-${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
