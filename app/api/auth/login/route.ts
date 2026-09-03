import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { authAuditEvents, authSessions, localAccounts, users } from "../../../../db/schema";
import { consumeDummyPasswordWork, normalizeEmail, PBKDF2_ALGORITHM, sessionCookie, verifyPassword } from "../../../auth-crypto";
import { authJson, INVALID_LOGIN_MESSAGE } from "../../../auth-http";
import { consumeAuthRateLimit, createLocalSessionMaterial, writeAuthAudit } from "../../../local-auth";
import { isSameOriginCredentialMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site credential mutation rejected." }, 403);
  const payload = await readJsonObject(request, 12_000);
  if (!payload) return authJson({ error: INVALID_LOGIN_MESSAGE }, 401);
  const email = normalizeEmail(payload.email);
  const password = typeof payload.password === "string" && [...payload.password].length <= 128 ? payload.password : null;
  const subjectEmail = email ?? "invalid-email";
  const limit = await consumeAuthRateLimit(request, "login", subjectEmail, { emailLimit: 5, networkLimit: 20, windowSeconds: 15 * 60 });
  if (!limit.allowed) {
    await writeAuthAudit({ eventType: "local_login", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "rate_limited" });
    return authJson({ error: "Too many sign-in attempts. Try again later." }, 429);
  }

  const db = getDb();
  const [account] = email ? await db.select({
    id: localAccounts.id,
    status: localAccounts.status,
    passwordAlgorithm: localAccounts.passwordAlgorithm,
    passwordHash: localAccounts.passwordHash,
    passwordSalt: localAccounts.passwordSalt,
    passwordIterations: localAccounts.passwordIterations,
    passwordChangedAt: localAccounts.passwordChangedAt,
    displayName: users.displayName,
  }).from(localAccounts).innerJoin(users, eq(users.email, localAccounts.userEmail)).where(eq(localAccounts.userEmail, email)).limit(1) : [];

  let passwordMatches = false;
  if (account && password && account.passwordAlgorithm === PBKDF2_ALGORITHM) {
    passwordMatches = await verifyPassword(password, { hash: account.passwordHash, salt: account.passwordSalt, iterations: account.passwordIterations });
  } else {
    await consumeDummyPasswordWork(password ?? "Invalid-password-0!");
  }
  if (!account || account.status !== "active" || !passwordMatches) {
    await writeAuthAudit({ accountId: account?.id, eventType: "local_login", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "invalid_credentials" });
    return authJson({ error: INVALID_LOGIN_MESSAGE }, 401);
  }

  const session = await createLocalSessionMaterial();
  const currentAccountId = sql<number>`(
    SELECT ${localAccounts.id} FROM ${localAccounts}
    WHERE ${localAccounts.id} = ${account.id}
      AND ${localAccounts.status} = 'active'
      AND ${localAccounts.passwordHash} = ${account.passwordHash}
      AND ${localAccounts.passwordChangedAt} = ${account.passwordChangedAt}
    LIMIT 1
  )`;
  try {
    await db.batch([
      db.insert(authSessions).values({ accountId: currentAccountId, tokenHash: session.tokenHash, expiresAt: session.expiresAt, lastSeenAt: session.createdAt, createdAt: session.createdAt }),
      db.insert(authAuditEvents).values({ accountId: currentAccountId, eventType: "local_login", subjectHash: limit.emailSubjectHash, success: true, detail: { networkSubjectHash: limit.networkSubjectHash }, createdAt: session.createdAt }),
    ]);
  } catch {
    await writeAuthAudit({ accountId: account.id, eventType: "local_login", emailSubjectHash: limit.emailSubjectHash, networkSubjectHash: limit.networkSubjectHash, success: false, reason: "credential_changed" });
    return authJson({ error: INVALID_LOGIN_MESSAGE }, 401);
  }
  return authJson({ authenticated: true, authSource: "local", profile: { email, displayName: account.displayName } }, 200, sessionCookie(session.token));
}
