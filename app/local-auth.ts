import { and, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { authAuditEvents, authRateLimitEvents, authSessions, localAccounts, platformSecrets, users } from "../db/schema";
import {
  generateSessionToken,
  hashOpaqueToken,
  readSessionCookie,
  SESSION_TTL_SECONDS,
  timingSafeTokenHashMatch,
} from "./auth-crypto";

export type LocalAuthenticatedUser = {
  displayName: string;
  email: string;
  fullName: null;
  authSource: "local";
};

export type AuthRatePolicy = {
  emailLimit: number;
  networkLimit: number;
  windowSeconds: number;
};

const AUTH_SUBJECT_SECRET_ID = "auth-subject-hmac-v1";

export async function getLocalSessionUser(cookieHeader: string | null): Promise<LocalAuthenticatedUser | null> {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;
  const tokenHash = await hashOpaqueToken(token);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const idleCutoff = new Date(nowDate.getTime() - 12 * 60 * 60_000).toISOString();
  const db = getDb();
  const [record] = await db.select({
    sessionId: authSessions.id,
    storedTokenHash: authSessions.tokenHash,
    sessionCreatedAt: authSessions.createdAt,
    lastSeenAt: authSessions.lastSeenAt,
    passwordChangedAt: localAccounts.passwordChangedAt,
    email: users.email,
    displayName: users.displayName,
  }).from(authSessions)
    .innerJoin(localAccounts, eq(localAccounts.id, authSessions.accountId))
    .innerJoin(users, eq(users.email, localAccounts.userEmail))
    .where(and(
      eq(authSessions.tokenHash, tokenHash),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, now),
      gt(authSessions.lastSeenAt, idleCutoff),
      eq(localAccounts.status, "active"),
    )).limit(1);
  if (!record || record.sessionCreatedAt < record.passwordChangedAt || !(await timingSafeTokenHashMatch(token, record.storedTokenHash))) return null;
  if (Date.now() - Date.parse(record.lastSeenAt) > 5 * 60_000) {
    await db.update(authSessions).set({ lastSeenAt: now }).where(and(eq(authSessions.id, record.sessionId), isNull(authSessions.revokedAt)));
  }
  return { displayName: record.displayName || record.email, email: record.email, fullName: null, authSource: "local" };
}

export async function createLocalSession(accountId: number) {
  const material = await createLocalSessionMaterial();
  await getDb().insert(authSessions).values({ accountId, tokenHash: material.tokenHash, expiresAt: material.expiresAt, lastSeenAt: material.createdAt });
  return material;
}

export async function createLocalSessionMaterial() {
  const token = generateSessionToken();
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1_000).toISOString();
  return { token, tokenHash, expiresAt, createdAt: now.toISOString() };
}

export async function revokeLocalSession(cookieHeader: string | null) {
  const token = readSessionCookie(cookieHeader);
  if (!token) return null;
  const tokenHash = await hashOpaqueToken(token);
  const db = getDb();
  const [session] = await db.select({ id: authSessions.id, accountId: authSessions.accountId, tokenHash: authSessions.tokenHash })
    .from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt))).limit(1);
  if (!session || !(await timingSafeTokenHashMatch(token, session.tokenHash))) return null;
  await db.update(authSessions).set({ revokedAt: new Date().toISOString() }).where(and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)));
  return session;
}

export async function consumeAuthRateLimit(request: Request, scope: string, email: string, policy: AuthRatePolicy) {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - policy.windowSeconds * 1_000).toISOString();
  const retentionCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const [emailSubjectHash, networkSubjectHash] = await authSubjectHashes([
    `email:${email}`,
    `network:${request.headers.get("cf-connecting-ip")?.trim() || "unknown"}`,
  ]);
  const emailScope = `${scope}:email`;
  const networkScope = `${scope}:network`;
  const db = getDb();
  await db.batch([
    db.insert(authRateLimitEvents).values({ scope: emailScope, subjectHash: emailSubjectHash, createdAt: nowIso }),
    db.insert(authRateLimitEvents).values({ scope: networkScope, subjectHash: networkSubjectHash, createdAt: nowIso }),
    db.delete(authRateLimitEvents).where(lt(authRateLimitEvents.createdAt, retentionCutoff)),
  ]);
  const [emailCountResult] = await db.select({ count: sql<number>`count(*)` }).from(authRateLimitEvents).where(and(
    eq(authRateLimitEvents.scope, emailScope), eq(authRateLimitEvents.subjectHash, emailSubjectHash), gte(authRateLimitEvents.createdAt, cutoff),
  ));
  const [networkCountResult] = await db.select({ count: sql<number>`count(*)` }).from(authRateLimitEvents).where(and(
    eq(authRateLimitEvents.scope, networkScope), eq(authRateLimitEvents.subjectHash, networkSubjectHash), gte(authRateLimitEvents.createdAt, cutoff),
  ));
  return {
    allowed: Number(emailCountResult?.count ?? policy.emailLimit + 1) <= policy.emailLimit
      && Number(networkCountResult?.count ?? policy.networkLimit + 1) <= policy.networkLimit,
    emailSubjectHash,
    networkSubjectHash,
  };
}

export async function authSubjectHash(value: string) {
  const [digest] = await authSubjectHashes([value]);
  return digest;
}

async function authSubjectHashes(values: string[]) {
  const key = await getOrCreateAuthSubjectKey();
  return Promise.all(values.map(async (value) => {
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`genesis-juris-auth-v1:${value}`));
    return encodeBase64Url(new Uint8Array(digest));
  }));
}

async function getOrCreateAuthSubjectKey() {
  const db = getDb();
  const [existing] = await db.select({ secret: platformSecrets.secret }).from(platformSecrets)
    .where(eq(platformSecrets.id, AUTH_SUBJECT_SECRET_ID)).limit(1);
  if (existing) return importAuthSubjectKey(existing.secret);

  const generated = new Uint8Array(32);
  crypto.getRandomValues(generated);
  await db.insert(platformSecrets).values({ id: AUTH_SUBJECT_SECRET_ID, secret: encodeBase64Url(generated) }).onConflictDoNothing();
  const [stored] = await db.select({ secret: platformSecrets.secret }).from(platformSecrets)
    .where(eq(platformSecrets.id, AUTH_SUBJECT_SECRET_ID)).limit(1);
  if (!stored) throw new Error("The authentication pseudonymization key could not be provisioned.");
  return importAuthSubjectKey(stored.secret);
}

async function importAuthSubjectKey(encoded: string) {
  const bytes = decodeBase64Url(encoded);
  if (bytes.byteLength !== 32) throw new Error("The authentication pseudonymization key is invalid.");
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid server secret encoding.");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export async function writeAuthAudit(values: {
  accountId?: number | null;
  eventType: string;
  emailSubjectHash: string;
  networkSubjectHash?: string;
  success: boolean;
  reason?: string;
  detail?: Record<string, string | number | boolean | null>;
}) {
  await getDb().insert(authAuditEvents).values({
    accountId: values.accountId ?? null,
    eventType: values.eventType,
    subjectHash: values.emailSubjectHash,
    success: values.success,
    detail: {
      ...(values.detail ?? {}),
      networkSubjectHash: values.networkSubjectHash ?? null,
      reason: values.reason ?? null,
    },
  });
}
