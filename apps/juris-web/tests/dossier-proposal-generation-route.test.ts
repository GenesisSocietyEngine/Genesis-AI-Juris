import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/proposals/generate/route.ts", import.meta.url),
  "utf8",
);
const coordinator = readFileSync(
  new URL("../app/dossier-proposal-generation.ts", import.meta.url),
  "utf8",
);
const provider = readFileSync(
  new URL("../app/dossier-proposal-ai-server.ts", import.meta.url),
  "utf8",
);

function section(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing section ${start}`);
  return source.slice(startIndex, endIndex);
}

function ordered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding operation`);
    cursor = next;
  }
}

test("generation route is same-origin, participant-role scoped, explicitly private, and capacity bounded", () => {
  assert.match(route, /isSameOriginMutation\(request\)/u);
  assert.match(route, /requireDossierAccess\(context, dossierId, "proposals"\)/u);
  assert.match(route, /parseDossierProposalGenerationRequest/u);
  assert.match(coordinator, /data_classification/u);
  assert.match(coordinator, /synthetic_or_deidentified/u);
  assert.match(coordinator, /privacy_disclosure_acknowledged/u);
  assert.match(route, /DOSSIER_DOCUMENTS/u);
  assert.match(route, /consumeAuthRateLimit/u);
  assert.match(route, /checkSuccessfulAuthEventLimit/u);
  assert.match(route, /acquireStudioAILease/u);
  assert.match(route, /releaseStudioAILease/u);
  assert.match(route, /safetyIdentifier: burst\.emailSubjectHash/u);
  assert.match(provider, /store: false/u);
  assert.match(provider, /safety_identifier: input\.safetyIdentifier/u);
  assert.match(provider, /strict: true/u);
  assert.doesNotMatch(route, /extractedTextObjectReference|exact_excerpt|OPENAI_API_KEY:/u);
});

test("ready replay and active-job convergence occur before revision, source, graph, quota, or provider work", () => {
  const execute = section(coordinator, "export async function executeDossierProposalGeneration", "type ProposalSourceRecord");
  ordered(execute, [
    "proposalGenerationDigests",
    "findProposalJob",
    'existing.status === "ready"',
    'existing.status === "processing"',
    "exactRevision",
    "loadReadyProposalSources",
    "loadCurrentGraphTargets",
    "claimProposalJob",
    "readVerifiedProposalSources",
    "acquireProviderPermission",
    "generateCandidates",
  ]);
  assert.doesNotMatch(route, /generationRequest\.expectedRevision !== access\.dossier\.revision/u);
  assert.match(coordinator, /dossierAIProposalJobs\.requestDigest/u);
  assert.match(coordinator, /dossierAIProposalJobs\.idempotencyKeyHash/u);
  assert.match(coordinator, /status: "queued" as const/u);
  assert.match(coordinator, /status: "processing"/u);
  assert.match(coordinator, /job\.status === "failed" \|\| job\.status === "processing"/u);
  assert.match(coordinator, /attempt: job\.attempt \+ 1/u);
  assert.match(coordinator, /lt\(dossierAIProposalJobs\.leaseExpiresAt, requeuedAt\)/u);
  ordered(route, [
    "parseDossierProposalGenerationRequest",
    "replayReadyDossierProposalGeneration",
    "const bindings = env",
    "OPENAI_API_KEY",
    "dossierProposalModelConfigurationDigest",
    "executeDossierProposalGeneration",
  ]);
  const replay = section(
    coordinator,
    "export async function replayReadyDossierProposalGeneration",
    "export async function executeDossierProposalGeneration",
  );
  assert.match(replay, /dossierAIProposalJobs\.idempotencyKeyHash/u);
  assert.match(replay, /dossierAIProposalJobSources\.documentVersionId/u);
  assert.match(replay, /sameStringArray\(storedVersionIds, input\.request\.documentVersionIds\)/u);
  assert.doesNotMatch(replay, /modelProvider|modelConfigurationDigest|R2Bucket|loadCurrentGraphTargets|acquireProviderPermission/u);
});

test("positive and zero-candidate commits match the frozen D1 ordering and exact completion receipt", () => {
  const positive = section(coordinator, "async function commitReadyProposalJob", "async function commitReadyNoCandidateJob");
  ordered(positive, [
    "input.context.db.update(dossiers)",
    "proposalJobSourceStatements",
    "dossierSourceAnchors",
    "dossierAIProposals",
    "dossierAIProposalVersions",
    "dossierAIProposalAnchors",
    "dossierOutputStateEvents",
    "dossierAuditEvents",
    "dossierRevisionReceipts",
    "dossierAIProposalJobs",
  ]);
  const zero = section(coordinator, "async function commitReadyNoCandidateJob", "function proposalGenerationCompletionAudit");
  ordered(zero, [
    "proposalJobSourceStatements",
    "dossierAuditEvents",
    "readyProposalJobStatement",
  ]);
  assert.doesNotMatch(zero, /update\(dossiers\)|dossierOutputStateEvents|dossierRevisionReceipts/u);
  const completion = section(coordinator, "function proposalGenerationCompletionAudit", "function proposalJobSourceStatements");
  for (const key of [
    "job_id",
    "result_code",
    "candidate_count",
    "analyzed_source_count",
    "analyzed_character_count",
    "model_receipt_digest",
  ]) assert.match(completion, new RegExp(`${key}:`, "u"));
  assert.match(completion, /eventType: "proposal_generation_completed"/u);
  assert.match(completion, /objectRefType: "dossier"/u);
  assert.match(completion, /AI_PROPOSAL_GENERATION_NO_CANDIDATES/u);
  assert.match(completion, /AI_PROPOSAL_GENERATION_READY/u);
});

test("terminal no-candidates is successful, visible, non-retryable, and discloses only bounded analyzed ranges", () => {
  assert.match(coordinator, /providerResult\.candidates\.length === 0/u);
  assert.match(coordinator, /outcome: "no_candidates"/u);
  assert.match(route, /result_code: result\.outcome === "no_candidates" \? "ready_no_candidates"/u);
  assert.match(route, /Analysis completed successfully; no exact source-grounded candidates/u);
  assert.match(route, /result\.idempotent \|\| result\.outcome === "no_candidates" \? 200 : 201/u);
  for (const field of [
    "document_version_id",
    "extraction_version",
    "character_start",
    "character_end",
    "source_character_count",
    "truncated",
    "maximum_characters_per_source",
    "maximum_total_characters",
  ]) assert.match(route, new RegExp(`${field}:`, "u"));
  assert.doesNotMatch(route, /analyzed_sources:[\s\S]{0,800}(?:text:|object_reference|object_key)/u);
});
