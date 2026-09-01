import { env, waitUntil } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { users } from "../../../../../../db/schema";
import {
  createDossierAIProposalCandidates,
  dossierProposalModelConfigurationDigest,
  DOSSIER_PROPOSAL_AI_PROVIDER,
} from "../../../../../dossier-proposal-ai-server";
import {
  DossierProposalGenerationError,
  executeDossierProposalGeneration,
  parseDossierProposalGenerationRequest,
  replayReadyDossierProposalGeneration,
} from "../../../../../dossier-proposal-generation";
import {
  canonicalDossierTimestamp,
  dossierJson,
  isResponse,
  newDossierOpaqueId,
  prepareDossierAuditEvents,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../../dossier-server";
import { checkSuccessfulAuthEventLimit, consumeAuthRateLimit, writeAuthAudit } from "../../../../../local-auth";
import { isSameOriginMutation, readJsonObject } from "../../../../../request-security";
import { acquireStudioAILease, releaseStudioAILease } from "../../../../../studio-ai-capacity";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const MAX_REQUEST_BYTES = 24_576;

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site proposal generation rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "proposals");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  let generationRequest;
  try {
    generationRequest = parseDossierProposalGenerationRequest(payload);
  } catch (error) {
    if (error instanceof DossierProposalGenerationError) {
      return dossierJson({ error: error.message, code: error.code }, error.status);
    }
    return dossierJson({ error: "The proposal-generation request is invalid.", code: "invalid_request" }, 400);
  }
  try {
    const committedReplay = await replayReadyDossierProposalGeneration({
      context,
      dossierId: access.dossier.id,
      request: generationRequest,
    });
    if (committedReplay) return generationResponse(committedReplay);
  } catch (error) {
    if (error instanceof DossierProposalGenerationError) {
      return dossierJson({ error: error.message, code: error.code }, error.status);
    }
    return dossierJson({ error: "The proposal-generation receipt is unavailable." }, 503);
  }
  const bindings = env as unknown as {
    DOSSIER_DOCUMENTS?: R2Bucket;
    OPENAI_API_KEY?: string;
    GENESIS_DOSSIER_OPENAI_MODEL?: string;
    GENESIS_OPENAI_MODEL?: string;
    GENESIS_AI_DAILY_REQUEST_LIMIT?: string;
  };
  const bucket = bindings.DOSSIER_DOCUMENTS;
  const apiKey = bindings.OPENAI_API_KEY?.trim() ?? "";
  const model = bindings.GENESIS_DOSSIER_OPENAI_MODEL?.trim()
    || bindings.GENESIS_OPENAI_MODEL?.trim()
    || "gpt-5.6";
  if (
    !bucket
    || apiKey.length < 20
    || apiKey.length > 300
    || !/^[A-Za-z0-9._:-]{2,100}$/u.test(model)
  ) {
    return dossierJson({
      error: "AI proposal generation is not configured. Manual proposal review remains available.",
      code: "proposal_generation_unavailable",
      manual_proposals_available: true,
    }, 503);
  }
  const [profile] = await context.db.select({ licenseTier: users.licenseTier }).from(users)
    .where(eq(users.id, context.actor.userId)).limit(1);
  if (!profile) {
    return dossierJson({ error: "Complete your professional profile before generating proposals." }, 403);
  }
  const modelConfigurationDigest = await dossierProposalModelConfigurationDigest({ model });
  let providerAuditSubjects: { emailSubjectHash: string; networkSubjectHash: string } | null = null;
  const startedAt = Date.now();

  try {
    const result = await executeDossierProposalGeneration({
      context,
      bucket,
      dossierId: access.dossier.id,
      role: access.role,
      request: generationRequest,
      dependencies: {
        modelProvider: DOSSIER_PROPOSAL_AI_PROVIDER,
        modelName: model,
        modelConfigurationDigest,
        now: canonicalDossierTimestamp,
        newId: newDossierOpaqueId,
        prepareRevisionAuditBatch: (currentDossierId, revision, inputs) =>
          prepareDossierRevisionAuditBatch(context, currentDossierId, revision, inputs),
        prepareAuditEvents: (currentDossierId, revision, inputs) =>
          prepareDossierAuditEvents(context, currentDossierId, revision, inputs),
        acquireProviderPermission: async () => {
          const burst = await consumeAuthRateLimit(
            request,
            "dossier-ai-proposals-burst",
            context.actor.email,
            { emailLimit: 3, networkLimit: 120, windowSeconds: 60 },
          );
          providerAuditSubjects = {
            emailSubjectHash: burst.emailSubjectHash,
            networkSubjectHash: burst.networkSubjectHash,
          };
          if (!burst.allowed) {
            return { ok: false, errorCode: "rate_limited", detailCode: "burst_rate_limited" } as const;
          }
          const tierLimit = profile.licenseTier === "enterprise"
            ? 60
            : profile.licenseTier === "professional" ? 20 : 5;
          const hourly = await checkSuccessfulAuthEventLimit(
            "dossier_ai_proposal_generation",
            burst.emailSubjectHash,
            { limit: tierLimit, windowSeconds: 60 * 60 },
          );
          if (!hourly.allowed) {
            return { ok: false, errorCode: "rate_limited", detailCode: "actor_budget_reached" } as const;
          }
          const tenant = await consumeAuthRateLimit(
            request,
            "dossier-ai-proposals-tenant-daily",
            "__genesis_tenant__",
            { emailLimit: aiDailyRequestLimit(bindings.GENESIS_AI_DAILY_REQUEST_LIMIT), networkLimit: 100_000, windowSeconds: 24 * 60 * 60 },
          );
          if (!tenant.allowed) {
            return { ok: false, errorCode: "rate_limited", detailCode: "tenant_budget_reached" } as const;
          }
          let lease;
          try {
            lease = await acquireStudioAILease(burst.emailSubjectHash);
          } catch {
            return { ok: false, errorCode: "provider_unavailable", detailCode: "capacity_control_unavailable" } as const;
          }
          if (!lease) {
            return { ok: false, errorCode: "rate_limited", detailCode: "tenant_capacity_reached" } as const;
          }
          return {
            ok: true,
            safetyIdentifier: burst.emailSubjectHash,
            release: () => releaseStudioAILease(lease.id),
          } as const;
        },
        generateCandidates: ({ safetyIdentifier, sources, graphTargets }) =>
          createDossierAIProposalCandidates({
            apiKey,
            model,
            safetyIdentifier,
            sources,
            graphTargets,
            signal: request.signal,
          }),
      },
    });
    if (providerAuditSubjects) {
      const auditSubjects = providerAuditSubjects as {
        emailSubjectHash: string;
        networkSubjectHash: string;
      };
      waitUntil(writeAuthAudit({
        eventType: "dossier_ai_proposal_generation",
        ...auditSubjects,
        success: result.result === "ready",
        ...(result.result === "ready" ? {} : { reason: result.result === "failed" ? result.errorCode : "processing" }),
        detail: {
          latencyMs: Date.now() - startedAt,
          jobId: result.jobId,
          model,
          modelConfigurationDigest,
          result: result.result,
          attempt: result.result === "ready" ? null : result.attempt,
          proposalCount: result.result === "ready" ? result.proposalIds.length : 0,
          readyOutcome: result.result === "ready" ? result.outcome : null,
          analyzedSourceCount: result.result === "ready" ? result.analyzedSources.length : 0,
        },
      }).catch(() => undefined));
    }
    return generationResponse(result);
  } catch (error) {
    const generationError = error instanceof DossierProposalGenerationError ? error : null;
    if (providerAuditSubjects) {
      const auditSubjects = providerAuditSubjects as {
        emailSubjectHash: string;
        networkSubjectHash: string;
      };
      waitUntil(writeAuthAudit({
        eventType: "dossier_ai_proposal_generation",
        ...auditSubjects,
        success: false,
        reason: generationError?.code ?? "internal_error",
        detail: { latencyMs: Date.now() - startedAt, modelConfigurationDigest },
      }).catch(() => undefined));
    }
    return dossierJson({
      error: generationError?.message ?? "AI proposal generation failed. Manual proposal review remains available.",
      code: generationError?.code ?? "proposal_generation_failed",
      manual_proposals_available: true,
    }, generationError?.status ?? 503);
  }
}

function generationResponse(result: Awaited<ReturnType<typeof executeDossierProposalGeneration>>) {
  if (result.result === "ready") {
    return dossierJson({
      proposal_generation_job: {
        job_id: result.jobId,
        status: "ready",
        proposal_ids: result.proposalIds,
        source_anchor_ids: result.sourceAnchorIds,
        provider_receipt_digest: result.providerReceiptDigest,
        result_code: result.outcome === "no_candidates" ? "ready_no_candidates" : "ready_with_candidates",
        analyzed_sources: result.analyzedSources.map((source) => ({
          document_version_id: source.documentVersionId,
          extraction_version: source.extractionVersion,
          character_start: source.contextStart,
          character_end: source.contextEnd,
          source_character_count: source.sourceCharacterCount,
          truncated: source.truncated,
          maximum_characters_per_source: source.maximumCharactersPerSource,
          maximum_total_characters: source.maximumTotalCharacters,
        })),
      },
      dossier: { revision: result.dossierRevision },
      idempotent: result.idempotent,
      manual_proposals_available: true,
      contract_version: "1.0.0",
      ...(result.outcome === "no_candidates" ? {
        message: "Analysis completed successfully; no exact source-grounded candidates were found in the disclosed analyzed ranges.",
      } : {}),
    }, result.idempotent || result.outcome === "no_candidates" ? 200 : 201);
  }
  if (result.result === "processing") {
    return dossierJson({
      proposal_generation_job: { job_id: result.jobId, status: "processing", attempt: result.attempt },
      idempotent: true,
      retry_after_seconds: 10,
      manual_proposals_available: true,
      contract_version: "1.0.0",
    }, 202, { "Retry-After": "10" });
  }
  return dossierJson({
    error: "AI proposal generation failed. No candidate became authoritative; manual proposal review remains available.",
    code: "proposal_generation_failed",
    proposal_generation_job: {
      job_id: result.jobId,
      status: "failed",
      attempt: result.attempt,
      error_code: result.errorCode,
      retryable: result.retryable,
    },
    idempotent: result.idempotent,
    manual_proposals_available: true,
    contract_version: "1.0.0",
  }, result.errorCode === "rate_limited" ? 429 : 503);
}

function aiDailyRequestLimit(value: string | undefined) {
  const configured = Number(value);
  return Number.isInteger(configured) && configured >= 10 && configured <= 100_000 ? configured : 500;
}
