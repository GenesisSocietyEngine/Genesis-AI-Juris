import { waitUntil } from "cloudflare:workers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountRecoveryCodes, authAuditEvents, authSessions, localAccounts, passwordResetTokens } from "../../../../db/schema";
import { createPasswordCredential, generateRecoveryCode, generateSessionToken, hashOpaqueToken, timingSafeTokenHashMatch, validatePassword } from "../../../auth-crypto";
import { authJson, INVALID_RECOVERY_MESSAGE } from "../../../auth-http";
import { consumeAuthRateLimit, writeAuthAudit } from "../../../local-auth";
import { sendPasswordChangedMail } from "../../../reset-mail";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const payload = await readJsonObject(request, 12_000);
  if (!payload) return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  const token = typeof payload.resetToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(payload.resetToken) ? payload.resetToken : "";
  const passwordIssue = validatePassword(payload.newPassword);
  if (passwordIssue) return authJson({ error: passwordIssue }, 400);
  const tokenHash = await hashOpaqueToken(token || "invalid-reset-token");
  const limit = await consumeAuthRateLimit(request, "email-reset", tokenHash, { emailLimit: 5, networkLimit: 15, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    await writeAuthAudit({ eventType: "email_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" });
    return authJson({ error: "Too many reset attempts. Request a new link later." }, 429);
  }

  // PBKDF2 work is deliberately performed before proof resolution so invalid
  // and valid reset attempts have comparable expensive work.
  const credential = await createPasswordCredential(payload.newPassword as string);
  const db = getDb();
  const now = new Date().toISOString();
  const [record] = token ? await db.select({
    resetId: passwordResetTokens.id,
    resetHash: passwordResetTokens.tokenHash,
    accountId: localAccounts.id,
    email: localAccounts.userEmail,
    passwordChangedAt: localAccounts.passwordChangedAt,
  }).from(passwordResetTokens).innerJoin(localAccounts, eq(localAccounts.id, passwordResetTokens.accountId)).where(and(
    eq(passwordResetTokens.tokenHash, tokenHash),
    isNull(passwordResetTokens.usedAt),
    gt(passwordResetTokens.expiresAt, now),
    eq(localAccounts.status, "active"),
  )).limit(1) : [];
  const dummyHash = await hashOpaqueToken("invalid-reset-token-placeholder");
  const tokenMatches = await timingSafeTokenHashMatch(token || "invalid-reset-token", record?.resetHash ?? dummyHash);
  if (!record || !tokenMatches) {
    await writeAuthAudit({ accountId: record?.accountId, eventType: "email_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "invalid_or_expired_token" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }

  const nextRecoveryCode = generateRecoveryCode();
  const nextRecoveryHash = await hashOpaqueToken(nextRecoveryCode);
  const consumptionNonce = generateSessionToken();
  const updatedAccountId = sql<number>`(
    SELECT ${localAccounts.id} FROM ${localAccounts}
    WHERE ${localAccounts.id} = ${record.accountId}
      AND ${localAccounts.status} = 'active'
      AND ${localAccounts.passwordChangedAt} = ${now}
      AND EXISTS (
        SELECT 1 FROM ${passwordResetTokens}
        WHERE ${passwordResetTokens.id} = ${record.resetId}
          AND ${passwordResetTokens.accountId} = ${record.accountId}
          AND ${passwordResetTokens.usedAt} = ${now}
          AND ${passwordResetTokens.consumedBy} = ${consumptionNonce}
      )
    LIMIT 1
  )`;
  try {
    await db.batch([
      db.update(passwordResetTokens).set({ usedAt: now, consumedBy: consumptionNonce }).where(and(eq(passwordResetTokens.id, record.resetId), eq(passwordResetTokens.accountId, record.accountId), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now))),
      db.update(localAccounts).set({ passwordHash: credential.hash, passwordSalt: credential.salt, passwordIterations: credential.iterations, passwordAlgorithm: credential.algorithm, passwordChangedAt: now, updatedAt: now }).where(and(eq(localAccounts.id, record.accountId), eq(localAccounts.passwordChangedAt, record.passwordChangedAt), eq(localAccounts.status, "active"))),
      db.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.accountId, record.accountId), isNull(authSessions.revokedAt))),
      db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.accountId, record.accountId), isNull(passwordResetTokens.usedAt))),
      db.update(accountRecoveryCodes).set({ usedAt: now }).where(and(eq(accountRecoveryCodes.accountId, record.accountId), isNull(accountRecoveryCodes.usedAt))),
      db.insert(accountRecoveryCodes).values({ accountId: updatedAccountId, codeHash: nextRecoveryHash, createdAt: now }),
      db.insert(authAuditEvents).values({ accountId: updatedAccountId, eventType: "email_password_reset", subjectHash: limit.emailSubjectHash, success: true, detail: { networkSubjectHash: limit.networkSubjectHash, proofSource: "reset_token", sessionsRevoked: true, automaticLogin: false }, createdAt: now }),
    ]);
  } catch {
    await writeAuthAudit({ accountId: record.accountId, eventType: "email_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "already_used_or_changed" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }
  waitUntil(sendPasswordChangedMail({ to: record.email, accountId: record.accountId, changedAt: now }).catch(() => undefined));
  return authJson({
    reset: true,
    automaticLogin: false,
    recoveryCode: nextRecoveryCode,
    recoveryNotice: "Password changed. All prior sessions and recovery credentials were revoked. Save this replacement code, then sign in normally.",
  });
}
