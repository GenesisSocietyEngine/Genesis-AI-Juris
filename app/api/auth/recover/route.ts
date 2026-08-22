import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountRecoveryCodes, authAuditEvents, authSessions, localAccounts, passwordResetTokens } from "../../../../db/schema";
import { createPasswordCredential, generateRecoveryCode, hashOpaqueToken, normalizeEmail, sessionCookie, timingSafeTokenHashMatch, validatePassword } from "../../../auth-crypto";
import { authJson, INVALID_RECOVERY_MESSAGE } from "../../../auth-http";
import { consumeAuthRateLimit, createLocalSessionMaterial, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const payload = await readJsonObject(request, 16_000);
  if (!payload) return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  const email = normalizeEmail(payload.email);
  const recoveryCode = typeof payload.recoveryCode === "string" && payload.recoveryCode.length <= 128 ? payload.recoveryCode.trim() : "";
  const passwordIssue = validatePassword(payload.newPassword);
  if (passwordIssue) return authJson({ error: passwordIssue }, 400);
  const newPassword = payload.newPassword as string;
  const subjectEmail = email ?? "invalid-email";
  const limit = await consumeAuthRateLimit(request, "recover", subjectEmail, { emailLimit: 5, networkLimit: 15, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    await writeAuthAudit({ eventType: "offline_recovery", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" });
    return authJson({ error: "Too many recovery attempts. Try again later." }, 429);
  }

  // Always perform the configured password derivation before returning a
  // recovery result so account/code validity is not exposed by KDF timing.
  const credential = await createPasswordCredential(newPassword);
  const db = getDb();
  const [record] = email ? await db.select({
    accountId: localAccounts.id,
    passwordChangedAt: localAccounts.passwordChangedAt,
    recoveryId: accountRecoveryCodes.id,
    recoveryHash: accountRecoveryCodes.codeHash,
  }).from(localAccounts).innerJoin(accountRecoveryCodes, eq(accountRecoveryCodes.accountId, localAccounts.id)).where(and(
    eq(localAccounts.userEmail, email), eq(localAccounts.status, "active"), isNull(accountRecoveryCodes.usedAt),
  )).limit(1) : [];
  const dummyHash = await hashOpaqueToken("GJRC-invalid-recovery-placeholder");
  const codeMatches = await timingSafeTokenHashMatch(recoveryCode || "GJRC-invalid", record?.recoveryHash ?? dummyHash);
  if (!record || !codeMatches) {
    await writeAuthAudit({ accountId: record?.accountId, eventType: "offline_recovery", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "invalid_recovery" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }

  const nextRecoveryCode = generateRecoveryCode();
  const nextRecoveryHash = await hashOpaqueToken(nextRecoveryCode);
  const session = await createLocalSessionMaterial();
  const now = new Date().toISOString();
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
      )
    LIMIT 1
  )`;
  try {
    await db.batch([
      db.update(accountRecoveryCodes).set({ usedAt: now }).where(and(eq(accountRecoveryCodes.id, record.recoveryId), eq(accountRecoveryCodes.accountId, record.accountId), isNull(accountRecoveryCodes.usedAt))),
      db.update(localAccounts).set({ passwordHash: credential.hash, passwordSalt: credential.salt, passwordIterations: credential.iterations, passwordAlgorithm: credential.algorithm, passwordChangedAt: now, updatedAt: now }).where(and(eq(localAccounts.id, record.accountId), eq(localAccounts.passwordChangedAt, record.passwordChangedAt), eq(localAccounts.status, "active"))),
      db.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.accountId, record.accountId), isNull(authSessions.revokedAt))),
      db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.accountId, record.accountId), isNull(passwordResetTokens.usedAt))),
      db.insert(accountRecoveryCodes).values({ accountId: updatedAccountId, codeHash: nextRecoveryHash, createdAt: now }),
      db.insert(authSessions).values({ accountId: updatedAccountId, tokenHash: session.tokenHash, expiresAt: session.expiresAt, lastSeenAt: now, createdAt: now }),
      db.insert(authAuditEvents).values({ accountId: updatedAccountId, eventType: "offline_recovery", subjectHash: limit.emailSubjectHash, success: true, detail: { networkSubjectHash: limit.networkSubjectHash, sessionsRevoked: true }, createdAt: now }),
    ]);
  } catch {
    await writeAuthAudit({ accountId: record.accountId, eventType: "offline_recovery", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "already_used_or_changed" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }
  return authJson({
    recovered: true,
    authSource: "local",
    recoveryCode: nextRecoveryCode,
    recoveryNotice: "Your previous recovery code is invalid. Save this replacement now; it is shown once.",
  }, 200, sessionCookie(session.token));
}
