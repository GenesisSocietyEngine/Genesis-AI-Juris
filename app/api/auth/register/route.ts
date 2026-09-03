import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountRecoveryCodes, authAuditEvents, authSessions, localAccounts, users } from "../../../../db/schema";
import { createPasswordCredential, generateRecoveryCode, hashOpaqueToken, normalizeEmail, sessionCookie, validatePassword } from "../../../auth-crypto";
import { authJson } from "../../../auth-http";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { consumeAuthRateLimit, createLocalSessionMaterial, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity || identity.authSource !== "chatgpt") {
    return authJson({ error: "Confirm this account through the trusted ChatGPT identity before enrolling local credentials." }, 403);
  }
  const email = normalizeEmail(identity.email);
  if (!email) return authJson({ error: "Local credentials could not be enrolled." }, 400);
  const payload = await readJsonObject(request, 12_000);
  if (!payload) return authJson({ error: "A valid credential request is required." }, 400);
  const passwordIssue = validatePassword(payload.password);
  if (passwordIssue) return authJson({ error: passwordIssue }, 400);
  const password = payload.password as string;
  const limit = await consumeAuthRateLimit(request, "register", email, { emailLimit: 3, networkLimit: 10, windowSeconds: 60 * 60 });
  if (!limit.allowed) {
    await writeAuthAudit({ eventType: "local_account_enrollment", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" });
    return authJson({ error: "Too many credential attempts. Try again later." }, 429);
  }

  const credential = await createPasswordCredential(password);
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashOpaqueToken(recoveryCode);
  const session = await createLocalSessionMaterial();
  const now = new Date().toISOString();
  const displayName = (identity.fullName ?? identity.displayName).trim().slice(0, 120) || email;
  const db = getDb();
  const accountId = sql<number>`(
    SELECT ${localAccounts.id} FROM ${localAccounts}
    WHERE ${localAccounts.userEmail} = ${email}
    LIMIT 1
  )`;
  try {
    await db.batch([
      db.insert(users).values({ email, displayName, updatedAt: now }).onConflictDoNothing(),
      db.insert(localAccounts).values({
        userEmail: email,
        passwordAlgorithm: credential.algorithm,
        passwordHash: credential.hash,
        passwordSalt: credential.salt,
        passwordIterations: credential.iterations,
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(accountRecoveryCodes).values({ accountId, codeHash: recoveryCodeHash, createdAt: now }),
      // Keep the first session at or after passwordChangedAt. The resolver
      // invalidates sessions older than the current credential generation.
      db.insert(authSessions).values({ accountId, tokenHash: session.tokenHash, expiresAt: session.expiresAt, lastSeenAt: now, createdAt: now }),
      db.insert(authAuditEvents).values({ accountId, eventType: "local_account_enrollment", subjectHash: limit.emailSubjectHash, success: true, detail: { networkSubjectHash: limit.networkSubjectHash, proofSource: "trusted_chatgpt_identity" }, createdAt: now }),
    ]);
  } catch {
    await writeAuthAudit({ eventType: "local_account_enrollment", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "not_available" });
    return authJson({ error: "Local credentials could not be enrolled." }, 409);
  }
  return authJson({
    account: { email, displayName, authSource: "local", enrollmentProof: "trusted_chatgpt_identity" },
    recoveryCode,
    recoveryNotice: "Save this code now. It is shown once and cannot be retrieved later.",
  }, 201, sessionCookie(session.token));
}
