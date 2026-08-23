import { env, waitUntil } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { consumeAuthRateLimit, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";
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
  try {
    baseFingerprint = studioAIBaseFingerprint(payload.draft as StudioAIContext);
    draft = normalizeStudioAIContext(payload.draft);
  } catch { return privateJson({ error: "The Studio graph context failed validation.", code: "invalid_context" }, 400); }
  if (payload.baseFingerprint !== baseFingerprint) return privateJson({ error: "The Studio graph changed before AI analysis began.", code: "stale_context" }, 409);
  if (!studioAIAvailable()) {
    return privateJson({ error: "AI planning is not configured on this deployment. The exact-command fallback remains available.", code: "not_configured" }, 503);
  }
  const tierLimit = profile.licenseTier === "enterprise" ? 60 : profile.licenseTier === "professional" ? 20 : 5;
  const limit = await consumeAuthRateLimit(request, "studio-ai-plan", identity.email.toLowerCase(), { emailLimit: tierLimit, networkLimit: 1_000, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" }).catch(() => undefined));
    return privateJson({ error: "AI planning limit reached. Use the exact-command fallback or try later.", code: "rate_limited" }, 429);
  }
  const tenantLimit = await consumeAuthRateLimit(request, "studio-ai-tenant-daily", "__genesis_tenant__", { emailLimit: aiDailyRequestLimit(), networkLimit: 100_000, windowSeconds: 24 * 60 * 60 });
  if (!tenantLimit.allowed) {
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "tenant_budget_reached" }).catch(() => undefined));
    return privateJson({ error: "The daily AI pilot budget is reached. The exact-command fallback remains available.", code: "tenant_budget_reached" }, 429);
  }
  try {
    const result = await createAIStudioPlan({ draft, instruction, locale, selectedNodeId });
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: true }).catch(() => undefined));
    return privateJson({ ...result, baseFingerprint });
  } catch (error) {
    const reason = error instanceof StudioAIServiceError ? error.code : "provider_unavailable";
    waitUntil(writeAuthAudit({ eventType: "studio_ai_plan", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason }).catch(() => undefined));
    const refused = reason === "refused";
    return privateJson({
      error: refused ? "The source could not be converted into a safe graph plan." : "AI planning is temporarily unavailable. No graph changes were made.",
      code: reason,
    }, refused ? 422 : 502);
  }
}

function aiDailyRequestLimit() {
  const configured = Number((env as unknown as { GENESIS_AI_DAILY_REQUEST_LIMIT?: string }).GENESIS_AI_DAILY_REQUEST_LIMIT);
  return Number.isInteger(configured) && configured >= 10 && configured <= 100_000 ? configured : 500;
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Pragma: "no-cache" } });
}
