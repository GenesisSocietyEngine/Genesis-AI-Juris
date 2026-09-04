import assert from "node:assert/strict";
import test from "node:test";
import type {
  DossierProposalAICandidate,
  DossierProposalAIGraphTarget,
} from "../app/dossier-proposal-ai-server";
import {
  buildBoundedProposalContext,
  DossierProposalGenerationError,
  materializeDossierProposalCandidates,
  parseDossierProposalGenerationRequest,
  prepareAnalyzedSources,
  readVerifiedProposalSources,
  type VerifiedProposalSource,
} from "../app/dossier-proposal-generation";
import { sha256Bytes } from "../app/dossier-private-upload";

const dossierId = "dossier_generation_0001";
const now = "2026-09-01T10:00:00.000Z";

async function verifiedSource(text: string, overrides: Partial<VerifiedProposalSource> = {}): Promise<VerifiedProposalSource> {
  const digest = await sha256Bytes(text);
  return {
    documentId: "document_generation_0001",
    documentVersionId: "document_version_generation_0001",
    documentContentSha256: `sha256-${"b".repeat(64)}`,
    extractionResultId: "extraction_result_generation_0001",
    extractionVersion: "genesis-dossier-strict-utf8-v1",
    extractedTextObjectReference: `dossier-v1/${dossierId}/upload_intent_generation_0001/${"c".repeat(64)}`,
    extractedTextSha256: digest.contentSha256,
    extractedTextByteLength: new TextEncoder().encode(text).byteLength,
    characterCount: text.length,
    text,
    ...overrides,
  };
}

function candidate(
  proposalType: DossierProposalAICandidate["proposal_type"],
  excerpt: string,
  overrides: Partial<DossierProposalAICandidate> = {},
): DossierProposalAICandidate {
  return {
    proposal_type: proposalType,
    statement: proposalType === "dated_event" ? "The notice has a stated date." : "The notice was issued.",
    document_version_id: "document_version_generation_0001",
    character_start: 0,
    character_end: excerpt.length,
    exact_excerpt: excerpt,
    decision_package_reference_id: null,
    target_type: null,
    target_id: null,
    relation: null,
    professional_meaning: null,
    ...overrides,
  };
}

function ids() {
  let count = 0;
  return (prefix: "proposal_job" | "proposal" | "source_anchor" | "output_state" | "proposal_worker") => {
    count += 1;
    return `${prefix}_${count.toString().padStart(24, "0")}`;
  };
}

test("generation request requires exact privacy declarations and rejects authority/unknown fields", () => {
  const parsed = parseDossierProposalGenerationRequest({
    expected_revision: 7,
    document_version_ids: ["document_version_generation_0002", "document_version_generation_0001"],
    idempotency_key: "request-key-0001",
    data_classification: "synthetic_or_deidentified",
    privacy_disclosure_acknowledged: true,
  });
  assert.deepEqual(parsed.documentVersionIds, [
    "document_version_generation_0001",
    "document_version_generation_0002",
  ]);
  assert.equal(parsed.retryFailed, false);
  assert.throws(() => parseDossierProposalGenerationRequest({
    expected_revision: 7,
    document_version_ids: ["document_version_generation_0001"],
    idempotency_key: "request-key-0002",
    data_classification: "confidential",
    privacy_disclosure_acknowledged: true,
  }), (error: unknown) => error instanceof DossierProposalGenerationError
    && error.code === "privacy_acknowledgement_required");
  assert.throws(() => parseDossierProposalGenerationRequest({
    expected_revision: 7,
    document_version_ids: ["document_version_generation_0001"],
    idempotency_key: "request-key-0003",
    data_classification: "synthetic_or_deidentified",
    privacy_disclosure_acknowledged: true,
    created_by_actor_ref: "actor_forged_0001",
  }), (error: unknown) => error instanceof DossierProposalGenerationError
    && error.code === "invalid_request");
});

test("bounded analysis discloses exact UTF-16 ranges and never splits a surrogate pair", async () => {
  const text = `${"a".repeat(23_999)}😀tail`;
  const source = await verifiedSource(text);
  const providerSources = buildBoundedProposalContext([source]);
  const analyzed = prepareAnalyzedSources([source], providerSources);
  assert.equal(providerSources[0]?.context_end, 23_999);
  assert.equal(providerSources[0]?.text, "a".repeat(23_999));
  assert.deepEqual(analyzed.map((range) => ({
    start: range.contextStart,
    end: range.contextEnd,
    sourceCharacters: range.sourceCharacterCount,
    truncated: range.truncated,
    perSource: range.maximumCharactersPerSource,
    total: range.maximumTotalCharacters,
  })), [{
    start: 0,
    end: 23_999,
    sourceCharacters: text.length,
    truncated: true,
    perSource: 24_000,
    total: 96_000,
  }]);
});

test("fact and dated-event candidates may reuse one exact generated anchor", async () => {
  const excerpt = "Notice issued 1 September 2026.";
  const source = await verifiedSource(excerpt);
  const analyzed = prepareAnalyzedSources([source], buildBoundedProposalContext([source]));
  const result = await materializeDossierProposalCandidates({
    dossierId,
    actorRef: "actor_generation_0001",
    jobId: "proposal_job_generation_0001",
    modelProvider: "openai",
    modelName: "gpt-test-proposals",
    modelConfigurationDigest: `sha256-${"d".repeat(64)}`,
    candidates: [candidate("fact", excerpt), candidate("dated_event", excerpt)],
    sources: [source],
    analyzedSources: analyzed,
    graphTargets: [],
    now,
    newId: ids(),
  });
  assert.equal(result.anchors.length, 1);
  assert.equal(result.proposals.length, 2);
  assert.equal(result.proposalAnchors.length, 2);
  assert.equal(result.proposalAnchors[0]?.sourceAnchorId, result.proposalAnchors[1]?.sourceAnchorId);
  assert.equal(result.anchors[0]?.creator, "ai_proposal");
  assert.equal(result.anchors[0]?.reviewState, "pending");
  assert.ok(result.proposals.every((proposal) => proposal.reviewState === "pending"
    && proposal.confidenceCategory === null
    && proposal.confidenceScore === null));
});

test("materialization rejects invented/out-of-analysis spans, duplicate candidates, and stale graph targets", async () => {
  const text = `${"a".repeat(24_010)}tail`;
  const source = await verifiedSource(text);
  const analyzed = prepareAnalyzedSources([source], buildBoundedProposalContext([source]));
  const outside = candidate("fact", "aaaa", {
    character_start: 24_001,
    character_end: 24_005,
    exact_excerpt: text.slice(24_001, 24_005),
  });
  await assert.rejects(() => materializeDossierProposalCandidates({
    dossierId,
    actorRef: "actor_generation_0001",
    jobId: "proposal_job_generation_0001",
    modelProvider: "openai",
    modelName: "gpt-test-proposals",
    modelConfigurationDigest: `sha256-${"d".repeat(64)}`,
    candidates: [outside],
    sources: [source],
    analyzedSources: analyzed,
    graphTargets: [],
    now,
    newId: ids(),
  }), (error: unknown) => error instanceof DossierProposalGenerationError
    && error.code === "invalid_provider_candidate");

  const excerpt = text.slice(0, 4);
  await assert.rejects(() => materializeDossierProposalCandidates({
    dossierId,
    actorRef: "actor_generation_0001",
    jobId: "proposal_job_generation_0001",
    modelProvider: "openai",
    modelName: "gpt-test-proposals",
    modelConfigurationDigest: `sha256-${"d".repeat(64)}`,
    candidates: [candidate("fact", excerpt), candidate("fact", excerpt)],
    sources: [source],
    analyzedSources: analyzed,
    graphTargets: [],
    now,
    newId: ids(),
  }), (error: unknown) => error instanceof DossierProposalGenerationError
    && error.code === "invalid_provider_candidate");

  const currentTarget: DossierProposalAIGraphTarget = {
    decision_package_reference_id: "package_reference_generation_0001",
    target_type: "graph_node",
    target_id: "current_node",
    label: "Current node",
  };
  await assert.rejects(() => materializeDossierProposalCandidates({
    dossierId,
    actorRef: "actor_generation_0001",
    jobId: "proposal_job_generation_0001",
    modelProvider: "openai",
    modelName: "gpt-test-proposals",
    modelConfigurationDigest: `sha256-${"d".repeat(64)}`,
    candidates: [candidate("evidence_link", excerpt, {
      decision_package_reference_id: currentTarget.decision_package_reference_id,
      target_type: "graph_node",
      target_id: "stale_or_invented_node",
      relation: "supports",
      professional_meaning: "Would ground an unavailable node.",
    })],
    sources: [source],
    analyzedSources: analyzed,
    graphTargets: [currentTarget],
    now,
    newId: ids(),
  }), (error: unknown) => error instanceof DossierProposalGenerationError
    && error.code === "invalid_provider_candidate");
});

test("private extracted text requires exact size, media metadata, R2 checksum, and SHA", async () => {
  const text = "Verified extracted text.";
  const source = await verifiedSource(text);
  const digest = await sha256Bytes(text);
  const bytes = new TextEncoder().encode(text);
  const object = (metadataDigest: string) => ({
    size: bytes.byteLength,
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { contentSha256: metadataDigest },
    checksums: { sha256: digest.checksum },
    arrayBuffer: async () => bytes.slice().buffer,
  });
  const validBucket = {
    get: async (key: string) => key === source.extractedTextObjectReference
      ? object(source.extractedTextSha256)
      : null,
  } as unknown as R2Bucket;
  const verified = await readVerifiedProposalSources(validBucket, dossierId, [source]);
  assert.equal(verified[0]?.text, text);

  const tamperedBucket = {
    get: async () => object(`sha256-${"e".repeat(64)}`),
  } as unknown as R2Bucket;
  await assert.rejects(() => readVerifiedProposalSources(tamperedBucket, dossierId, [source]), (error: unknown) => {
    assert.ok(error instanceof DossierProposalGenerationError);
    assert.equal(error.code, "source_integrity_failed");
    assert.doesNotMatch(error.message, /dossier-v1|upload_intent|Verified extracted text/u);
    return true;
  });
});
