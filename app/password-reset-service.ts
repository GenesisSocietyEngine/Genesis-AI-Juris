import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { authAuditEvents, localAccounts, passwordResetTokens } from "../db/schema";
import { generateSessionToken, hashOpaqueToken, normalizeEmail } from "./auth-crypto";
import { authSubjectHash } from "./local-auth";
import { passwordResetMailAvailable, sendPasswordResetMail } from "./reset-mail";

export type PasswordResetIssueResult = "delivered" | "not_found" | "not_configured" | "delivery_failed";

export async function issuePasswordResetEmail(rawEmail: string, requestKind: "self" | "admin"): Promise<PasswordResetIssueResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "not_found";
  const db = getDb();
  const [account] = await db.select({ id: localAccounts.id, email: localAccounts.userEmail }).from(localAccounts).where(and(
    eq(localAccounts.userEmail, email),
    eq(localAccounts.status, "active"),
  )).limit(1);
  if (!account) return "not_found";
  const subjectHash = await authSubjectHash(`email:${account.email}`);
  if (!passwordResetMailAvailable()) {
    await db.insert(authAuditEvents).values({ accountId: account.id, eventType: "password_reset_email", subjectHash, success: false, detail: { requestKind, reason: "not_configured" } });
    return "not_configured";
  }

  const token = generateSessionToken();
  const tokenHash = await hashOpaqueToken(token);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = new Date(nowDate.getTime() + 15 * 60_000).toISOString();
  try {
    await db.batch([
      db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.accountId, account.id), isNull(passwordResetTokens.usedAt))),
      db.insert(passwordResetTokens).values({ accountId: account.id, tokenHash, expiresAt, createdAt: now }),
    ]);
  } catch {
    await db.insert(authAuditEvents).values({ accountId: account.id, eventType: "password_reset_email", subjectHash, success: false, detail: { requestKind, reason: "issuance_failed" }, createdAt: now });
    return "delivery_failed";
  }
  const delivery = await sendPasswordResetMail({ to: account.email, token, tokenHash });
  if (!delivery.ok) {
    await db.batch([
      db.update(passwordResetTokens).set({ usedAt: new Date().toISOString() }).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt))),
      db.insert(authAuditEvents).values({ accountId: account.id, eventType: "password_reset_email", subjectHash, success: false, detail: { requestKind, reason: delivery.reason }, createdAt: now }),
    ]);
    return delivery.reason === "not_configured" ? "not_configured" : "delivery_failed";
  }
  await db.insert(authAuditEvents).values({ accountId: account.id, eventType: "password_reset_email", subjectHash, success: true, detail: { requestKind, expiresAt }, createdAt: now });
  return "delivered";
}
