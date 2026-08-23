import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountRecoveryCodes, authAuditEvents, authSessions, localAccounts, passwordResetTokens } from "../../../../db/schema";
import { createPasswordCredential, generateRecoveryCode, generateSessionToken, hashOpaqueToken, normalizeEmail, sessionCookie, validatePassword } from "../../../auth-crypto";
import { authJson, INVALID_RECOVERY_MESSAGE } from "../../../auth-http";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { consumeAuthRateLimit, createLocalSessionMaterial, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

/** Password replacement proved by the trusted ChatGPT identity only. */
export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity || identity.authSource !== "chatgpt") return authJson({ error: "Trusted ChatGPT identity is required for this reset path." }, 403);
  const email = normalizeEmail(identity.email);
  if (!email) return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  const payload = await readJsonObject(request, 12_000);
  if (!payload) return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  const passwordIssue = validatePassword(payload.newPassword);
  if (passwordIssue) return authJson({ error: passwordIssue }, 400);
  const limit = await consumeAuthRateLimit(request, "reset", email, { emailLimit: 5, networkLimit: 15, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    await writeAuthAudit({ eventType: "local_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" });
    return authJson({ error: "Too many reset attempts. Try again later." }, 429);
  }

  const credential = await createPasswordCredential(payload.newPassword as string);
  const db = getDb();
  const [record] = await db.select({ accountId: localAccounts.id, passwordChangedAt: localAccounts.passwordChangedAt, recoveryId: accountRecoveryCodes.id })
    .from(localAccounts).innerJoin(accountRecoveryCodes, eq(accountRecoveryCodes.accountId, localAccounts.id)).where(and(
      eq(localAccounts.userEmail, email), eq(localAccounts.status, "active"), isNull(accountRecoveryCodes.usedAt),
    )).limit(1);
  if (!record) {
    await writeAuthAudit({ eventType: "local_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "account_not_enrolled" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }
  const nextRecoveryCode = generateRecoveryCode();
  const nextRecoveryHash = await hashOpaqueToken(nextRecoveryCode);
  const session = await createLocalSessionMaterial();
  const now = new Date().toISOString();
  const consumptionNonce = generateSessionToken();
  const updatedAccountId = sql<number>`(
    SELECT ${localAccounts.id} FROM ${localAccounts}
    WHERE ${localAccounts.id} = ${record.accountId}
      AND ${localAccounts.status} = 'active'
      AND ${localAccounts.passwordChangedAt} = ${now}
      AND EXISTS (
        SELECT 1 FROM ${accountRecoveryCodes}
        WHERE ${accountRecoveryCodes.id} = ${record.recoveryId}
          AND ${accountRecoveryCodes.accountId} = ${record.accountId}
          AND ${accountRecoveryCodes.usedAt} = ${now}
          AND ${accountRecoveryCodes.consumedBy} = ${consumptionNonce}
      )
    LIMIT 1
  )`;
  try {
    await db.batch([
      db.update(accountRecoveryCodes).set({ usedAt: now, consumedBy: consumptionNonce }).where(and(eq(accountRecoveryCodes.id, record.recoveryId), eq(accountRecoveryCodes.accountId, record.accountId), isNull(accountRecoveryCodes.usedAt))),
      db.update(localAccounts).set({ passwordHash: credential.hash, passwordSalt: credential.salt, passwordIterations: credential.iterations, passwordAlgorithm: credential.algorithm, passwordChangedAt: now, updatedAt: now }).where(and(eq(localAccounts.id, record.accountId), eq(localAccounts.passwordChangedAt, record.passwordChangedAt), eq(localAccounts.status, "active"))),
      db.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.accountId, record.accountId), isNull(authSessions.revokedAt))),
      db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.accountId, record.accountId), isNull(passwordResetTokens.usedAt))),
      db.insert(accountRecoveryCodes).values({ accountId: updatedAccountId, codeHash: nextRecoveryHash, createdAt: now }),
      db.insert(authSessions).values({ accountId: updatedAccountId, tokenHash: session.tokenHash, expiresAt: session.expiresAt, lastSeenAt: now, createdAt: now }),
      db.insert(authAuditEvents).values({ accountId: updatedAccountId, eventType: "local_password_reset", subjectHash: limit.emailSubjectHash, success: true, detail: { networkSubjectHash: limit.networkSubjectHash, proofSource: "trusted_chatgpt_identity", sessionsRevoked: true }, createdAt: now }),
    ]);
  } catch {
    await writeAuthAudit({ accountId: record.accountId, eventType: "local_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "already_used_or_changed" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }
  return authJson({ reset: true, proofSource: "trusted_chatgpt_identity", recoveryCode: nextRecoveryCode, recoveryNotice: "All previous sessions and recovery credentials were revoked. Save this replacement code now." }, 200, sessionCookie(session.token));
}
