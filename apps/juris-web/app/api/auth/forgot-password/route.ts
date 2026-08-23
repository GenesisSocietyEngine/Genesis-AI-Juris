import { waitUntil } from "cloudflare:workers";
import { normalizeEmail } from "../../../auth-crypto";
import { authJson } from "../../../auth-http";
import { consumeAuthRateLimit, writeAuthAudit } from "../../../local-auth";
import { issuePasswordResetEmail } from "../../../password-reset-service";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";
const GENERIC_RESPONSE = "If an account exists, a password-reset link has been sent.";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const payload = await readJsonObject(request, 8_000);
  const email = normalizeEmail(payload?.email);
  const limit = await consumeAuthRateLimit(request, "forgot-password", email ?? "invalid-email", { emailLimit: 3, networkLimit: 20, windowSeconds: 60 * 60 });
  if (email && limit.allowed) {
    waitUntil(issuePasswordResetEmail(email, "self").catch(() => undefined));
  } else if (!limit.allowed) {
    waitUntil(writeAuthAudit({ eventType: "password_reset_email", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" }).catch(() => undefined));
  }
  return authJson({ accepted: true, message: GENERIC_RESPONSE }, 202);
}
