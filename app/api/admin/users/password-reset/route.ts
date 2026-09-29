import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { auditEvents, users } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { normalizeEmail } from "../../../../auth-crypto";
import { consumeAuthRateLimit } from "../../../../local-auth";
import { issuePasswordResetEmail } from "../../../../password-reset-service";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../../request-security";
import { isPlatformAdmin } from "../../../../server-authorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return privateJson({ error: "Cross-site credential mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return privateJson({ error: "Administrator access is required." }, 403);
  const payload = await readJsonObject(request, 8_000);
  const userId = typeof payload?.userId === "number" && Number.isInteger(payload.userId) && payload.userId > 0 ? payload.userId : null;
  if (!userId) return privateJson({ error: "A registered user is required." }, 400);
  const db = getDb();
  const [target] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return privateJson({ error: "Registered user not found." }, 404);
  const limit = await consumeAuthRateLimit(request, "admin-password-reset", target.email, { emailLimit: 3, networkLimit: 30, windowSeconds: 60 * 60 });
  if (!limit.allowed) return privateJson({ error: "Too many reset emails were requested for this account. Try again later." }, 429);
  const result = await issuePasswordResetEmail(target.email, "admin").catch(() => "delivery_failed" as const);
  await db.insert(auditEvents).values({
    actorEmail: normalizeEmail(identity.email) ?? identity.email.toLowerCase(),
    eventType: "admin_password_reset_email_requested",
    objectType: "user",
    objectId: String(target.id),
    detail: { delivered: result === "delivered", result },
  });
  if (result === "not_found") return privateJson({ error: "This user has no active local password account." }, 409);
  if (result === "not_configured") return privateJson({ error: "Password-reset email is not configured on the server." }, 503);
  if (result !== "delivered") return privateJson({ error: "The reset email provider did not accept the message." }, 502);
  return privateJson({ delivered: true, message: "A one-time password-reset email was sent to the user’s stored address." });
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
