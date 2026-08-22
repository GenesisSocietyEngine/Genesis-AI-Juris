import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountRecoveryCodes, authAuditEvents, authSessions, localAccounts, passwordResetTokens } from "../../../../db/schema";
import { createPasswordCredential, generateRecoveryCode, hashOpaqueToken, normalizeEmail, sessionCookie, timingSafeTokenHashMatch, validatePassword } from "../../../auth-crypto";
import { authJson, INVALID_RECOVERY_MESSAGE } from "../../../auth-http";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { consumeAuthRateLimit, createLocalSessionMaterial, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const payload = await readJsonObject(request, 16_000);
  if (!payload) return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  const passwordIssue = validatePassword(payload.newPassword);
  if (passwordIssue) return authJson({ error: passwordIssue }, 400);
  const identity = await getChatGPTUser();
  const trustedChatGPT = identity?.authSource === "chatgpt";
  const email = trustedChatGPT ? normalizeEmail(identity.email) : normalizeEmail(payload.email);
  if (trustedChatGPT && payload.email !== undefined && normalizeEmail(payload.email) !== email) {
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }
  const subjectEmail = email ?? "invalid-email";
  const limit = await consumeAuthRateLimit(request, "reset", subjectEmail, { emailLimit: 5, networkLimit: 15, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    await writeAuthAudit({ eventType: "local_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" });
    return authJson({ error: "Too many reset attempts. Try again later." }, 429);
  }

  // Match the recovery route's KDF work before revealing whether the trusted
  // identity or a future provider-issued reset token resolves to an account.
  const credential = await createPasswordCredential(payload.newPassword as string);
  const db = getDb();
  const now = new Date().toISOString();
  const suppliedToken = typeof payload.resetToken === "string" && payload.resetToken.length <= 160 ? payload.resetToken.trim() : "";
  const suppliedTokenHash = await hashOpaqueToken(suppliedToken || "invalid-reset-token");
  const [record] = email ? await db.select({
    accountId: localAccounts.id,
    passwordChangedAt: localAccounts.passwordChangedAt,
    recoveryId: accountRecoveryCodes.id,
    resetId: passwordResetTokens.id,
    resetHash: passwordResetTokens.tokenHash,
  }).from(localAccounts)
    .innerJoin(accountRecoveryCodes, and(eq(accountRecoveryCodes.accountId, localAccounts.id), isNull(accountRecoveryCodes.usedAt)))
    .leftJoin(passwordResetTokens, and(
      eq(passwordResetTokens.accountId, localAccounts.id),
      eq(passwordResetTokens.tokenHash, suppliedTokenHash),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now),
    ))
    .where(and(eq(localAccounts.userEmail, email), eq(localAccounts.status, "active"))).limit(1) : [];
  const dummyHash = await hashOpaqueToken("invalid-reset-token-placeholder");
  const tokenMatches = trustedChatGPT || await timingSafeTokenHashMatch(suppliedToken || "invalid-reset-token", record?.resetHash ?? dummyHash);
  const tokenProofAvailable = trustedChatGPT || Boolean(record?.resetId && suppliedToken && tokenMatches);
  if (!record || !tokenProofAvailable) {
    await writeAuthAudit({ accountId: record?.accountId, eventType: "local_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "invalid_reset_proof" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }

  const nextRecoveryCode = generateRecoveryCode();
  const nextRecoveryHash = await hashOpaqueToken(nextRecoveryCode);
  const session = await createLocalSessionMaterial();
  const resetProof = trustedChatGPT ? sql`` : sql`AND EXISTS (
    SELECT 1 FROM ${passwordResetTokens}
    WHERE ${passwordResetTokens.id} = ${record.resetId!}
      AND ${passwordResetTokens.accountId} = ${record.accountId}
      AND ${passwordResetTokens.usedAt} = ${now}
  )`;
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
      ${resetProof}
    LIMIT 1
  )`;
  try {
    await db.batch([
      db.update(accountRecoveryCodes).set({ usedAt: now }).where(and(eq(accountRecoveryCodes.id, record.recoveryId), eq(accountRecoveryCodes.accountId, record.accountId), isNull(accountRecoveryCodes.usedAt))),
      ...(trustedChatGPT ? [] : [db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.id, record.resetId!), eq(passwordResetTokens.accountId, record.accountId), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))]),
      db.update(localAccounts).set({ passwordHash: credential.hash, passwordSalt: credential.salt, passwordIterations: credential.iterations, passwordAlgorithm: credential.algorithm, passwordChangedAt: now, updatedAt: now }).where(and(eq(localAccounts.id, record.accountId), eq(localAccounts.passwordChangedAt, record.passwordChangedAt), eq(localAccounts.status, "active"))),
      db.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.accountId, record.accountId), isNull(authSessions.revokedAt))),
      db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.accountId, record.accountId), isNull(passwordResetTokens.usedAt))),
      db.insert(accountRecoveryCodes).values({ accountId: updatedAccountId, codeHash: nextRecoveryHash, createdAt: now }),
      db.insert(authSessions).values({ accountId: updatedAccountId, tokenHash: session.tokenHash, expiresAt: session.expiresAt, lastSeenAt: now, createdAt: now }),
      db.insert(authAuditEvents).values({ accountId: updatedAccountId, eventType: "local_password_reset", subjectHash: limit.emailSubjectHash, success: true, detail: { networkSubjectHash: limit.networkSubjectHash, proofSource: trustedChatGPT ? "trusted_chatgpt_identity" : "reset_token", sessionsRevoked: true }, createdAt: now }),
    ]);
  } catch {
    await writeAuthAudit({ accountId: record.accountId, eventType: "local_password_reset", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "already_used_or_changed" });
    return authJson({ error: INVALID_RECOVERY_MESSAGE }, 401);
  }
  return authJson({
    reset: true,
    proofSource: trustedChatGPT ? "trusted_chatgpt_identity" : "reset_token",
    recoveryCode: nextRecoveryCode,
    recoveryNotice: "All previous sessions and recovery credentials were revoked. Save this replacement code now.",
  }, 200, sessionCookie(session.token));
}
