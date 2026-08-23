import { env, waitUntil } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { checkSuccessfulAuthEventLimit, consumeAuthRateLimit, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";
import { acquireStudioAILease, releaseStudioAILease } from "../../../studio-ai-capacity";
import { STUDIO_AI_PROVIDER_CONTEXT_LIMIT, studioAIProviderContextBytes } from "../../../studio-ai-provider-context";
import { STUDIO_CASE_BODY_LIMIT } from "../../../studio-envelope";
import { normalizeStudioAIContext, studioAIBaseFingerprint, type StudioAIContext } from "../../../studio-ai-plan";
import { createAIStudioPlan, StudioAIServiceError, studioAIAvailable } from "../../../studio-ai-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return privateJson({ error: "Cross-site AI request rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required for AI-assisted planning.", code: "sign_in_required" }, 401);
  const [profile] = await getDb().select({ licenseTier: users.licenseTier }).from(users).where(eq(users.email, identity.email.toLowerCase())).limit(1);
  if (!profile) return privateJson({ error: "Complete your professional profile before using AI-assisted planning.", code: "profile_required" }, 403);
  const payload = await readJsonObject(request, STUDIO_CASE_BODY_LIMIT);
  const instruction = typeof payload?.instruction === "string" ? payload.instruction.trim() : "";
  const locale = payload?.locale === "ru" ? "ru" : payload?.locale === "en" ? "en" : null;
  const selectedNodeId = payload?.selectedNodeId === null || payload?.selectedNodeId === undefined
    ? null
    : typeof payload.selectedNodeId === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(payload.selectedNodeId) ? payload.selectedNodeId : undefined;
  if (!payload || !instruction || instruction.length > 8_000 || !locale || selectedNodeId === undefined) return privateJson({ error: "A valid Studio prompt and graph context are required.", code: "invalid_request" }, 400);

  let draft;
  let baseFingerprint;
  let providerContextBytes;
  try {
    draft = normalizeStudioAIContext(payload.draft);
    providerContextBytes = studioAIProviderContextBytes({ draft, instruction, locale, selectedNodeId });
    if (providerContextBytes > STUDIO_AI_PROVIDER_CONTEXT_LIMIT) {
      return privateJson({
        error: "AI analysis accepts up to 128 KB of prompt and graph context. Shorten long details or analyse a smaller branch.",
        code: "ai_context_too_large",
        limitBytes: STUDIO_AI_PROVIDER_CONTEXT_LIMIT,
        actualBytes: providerContextBytes,
      }, 413);
    }
    baseFingerprint = studioAIBaseFingerprint(draft as StudioAIContext);
  } catch { return privateJson({ error: "The Studio graph context failed validation.", code: "invalid_context" }, 400); }
  if (payload.baseFingerprint !== baseFingerprint) return privateJson({ error: "The Studio graph changed before AI analysis began.", code: "stale_context" }, 409);
  if (!studioAIAvailable()) {
    return privateJson({ error: "AI planning is not configured on this deployment. The exact-command fallback remains available.", code: "not_configured" }, 503);
  }
  const tierLimit = profile.licenseTier === "enterprise" ? 60 : profile.licenseTier === "professional" ? 20 : 5;
  const burstLimit = await consumeAuthRateLimit(request, "studio-ai-plan-burst", identity.email.toLowerCase(), { emailLimit: 3, networkLimit: 120, windowSeconds: 60 });
  if (!burstLimit.allowed) {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: burstLimit.emailSubjectHash, networkSubjectHash: burstLimit.networkSubjectHash, success: false, reason: "burst_rate_limited" }).catch(() => undefined));
    return privateJson({ error: "AI is receiving too many requests. Wait one minute or use the local builder.", code: "burst_rate_limited" }, 429, { "Retry-After": "60" });
  }
  const limit = { emailSubjectHash: burstLimit.emailSubjectHash, networkSubjectHash: burstLimit.networkSubjectHash };
  const successfulUsage = await checkSuccessfulAuthEventLimit("studio_ai_plan", limit.emailSubjectHash, { limit: tierLimit, windowSeconds: 60 * 60 });
  if (!successfulUsage.allowed) {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" }).catch(() => undefined));
    return privateJson({ error: "AI planning limit reached. Use the local builder or try later.", code: "rate_limited" }, 429, { "Retry-After": "3600" });
  }
  const tenantLimit = await consumeAuthRateLimit(request, "studio-ai-tenant-daily", "__genesis_tenant__", { emailLimit: aiDailyRequestLimit(), networkLimit: 100_000, windowSeconds: 24 * 60 * 60 });
  if (!tenantLimit.allowed) {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "tenant_budget_reached" }).catch(() => undefined));
    return privateJson({ error: "The daily AI pilot budget is reached. The exact-command fallback remains available.", code: "tenant_budget_reached" }, 429);
  }
  let lease;
  try {
    lease = await acquireStudioAILease(limit.emailSubjectHash);
  } catch {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "tenant_capacity_unavailable" }).catch(() => undefined));
    return privateJson({ error: "AI capacity control is temporarily unavailable. No graph changes were made.", code: "tenant_capacity_unavailable" }, 503, { "Retry-After": "10" });
  }
  if (!lease) {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "tenant_capacity_reached" }).catch(() => undefined));
    return privateJson({ error: "AI is processing the maximum number of plans. Try again shortly or use the local builder.", code: "tenant_capacity_reached" }, 429, { "Retry-After": "10" });
  }
  const providerStartedAt = Date.now();
  try {
    const { usage, ...result } = await createAIStudioPlan({ draft, instruction, locale, selectedNodeId, safetyIdentifier: limit.emailSubjectHash, signal: request.signal });
    waitUntil(writeAuthAudit({
      eventType: "studio_ai_plan",
      emailSubjectHash: limit.emailSubjectHash,
      networkSubjectHash: limit.networkSubjectHash,
      success: true,
      detail: {
        model: result.model,
        latencyMs: Date.now() - providerStartedAt,
        contextBytes: providerContextBytes,
        inputTokens: usage?.inputTokens ?? null,
        cachedInputTokens: usage?.cachedInputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        reasoningOutputTokens: usage?.reasoningOutputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
      },
    }).catch(() => undefined));
    return privateJson({ ...result, baseFingerprint });
  } catch (error) {
    const reason = error instanceof StudioAIServiceError ? error.code : "provider_unavailable";
    const providerFailure = error instanceof StudioAIServiceError ? error.providerFailure : null;
    const usage = error instanceof StudioAIServiceError ? error.usage : null;
    waitUntil(writeAuthAudit({
      eventType: "studio_ai_plan",
      emailSubjectHash: limit.emailSubjectHash,
      networkSubjectHash: limit.networkSubjectHash,
      success: false,
      reason,
      detail: {
        latencyMs: Date.now() - providerStartedAt,
        contextBytes: providerContextBytes,
        providerStatus: providerFailure?.status ?? null,
        providerCode: providerFailure?.providerCode ?? null,
        providerType: providerFailure?.providerType ?? null,
        providerParam: providerFailure?.providerParam ?? null,
        incompleteReason: error instanceof StudioAIServiceError ? error.incompleteReason : null,
        invalidStage: error instanceof StudioAIServiceError ? error.invalidStage : null,
        inputTokens: usage?.inputTokens ?? null,
        cachedInputTokens: usage?.cachedInputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        reasoningOutputTokens: usage?.reasoningOutputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
      },
    }).catch(() => undefined));
    const refused = reason === "refused";
    const providerError = studioAIProviderError(reason);
    return privateJson({
      error: refused ? "The source could not be converted into a safe graph plan." : providerError.message,
      code: reason,
    }, refused ? 422 : providerError.status, providerFailure?.retryAfterSeconds ? { "Retry-After": String(providerFailure.retryAfterSeconds) } : {});
  } finally {
    waitUntil(releaseStudioAILease(lease.id).catch(() => undefined));
  }
}

function studioAIProviderError(reason: string) {
  const errors: Record<string, { message: string; status: number }> = {
    provider_authentication: { message: "The configured OpenAI API key was rejected. Replace it with an active project API key.", status: 502 },
    provider_permission: { message: "The OpenAI project key cannot use the configured model or Responses API. Update the key permissions or project access.", status: 502 },
    provider_quota: { message: "The OpenAI API project has no usable credit or has reached a spend or usage limit. Update API billing or limits, then retry.", status: 503 },
    provider_rate_limited: { message: "The OpenAI API rate limit was reached. Wait for the indicated interval, then retry.", status: 429 },
    provider_model_unavailable: { message: "The configured OpenAI model is not available to this API project. Choose a model enabled for the project.", status: 502 },
    provider_bad_request: { message: "The OpenAI API rejected both the structured planner request and its safe JSON compatibility fallback.", status: 502 },
    provider_rejected: { message: "The OpenAI API rejected the planner request. Check the project key, model access and API limits.", status: 502 },
    provider_unavailable: { message: "The OpenAI API could not be reached or returned a temporary server error. No graph changes were made.", status: 502 },
    invalid_output: { message: "AI returned a plan that did not pass the graph safety validation. No graph changes were made.", status: 502 },
    incomplete: { message: "AI did not finish the plan. No graph changes were made.", status: 502 },
  };
  return errors[reason] ?? errors.provider_unavailable;
}

function aiDailyRequestLimit() {
  const configured = Number((env as unknown as { GENESIS_AI_DAILY_REQUEST_LIMIT?: string }).GENESIS_AI_DAILY_REQUEST_LIMIT);
  return Number.isInteger(configured) && configured >= 10 && configured <= 100_000 ? configured : 500;
}

function privateJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Pragma: "no-cache", ...extraHeaders } });
}
