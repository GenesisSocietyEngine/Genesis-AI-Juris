import { eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, authAuditEvents, authRateLimitEvents, caseDrafts, caseFeedback, caseSubscriptions, customCaseGrants, customCases, localAccounts, playSessions, updateReads, users } from "../../../db/schema";
import { clearSessionCookie } from "../../auth-crypto";
import { authJson } from "../../auth-http";
import { getChatGPTUser } from "../../chatgpt-auth";
import { authSubjectHash } from "../../local-auth";
import { isSameOriginCredentialMutation, isSameOriginMutation, readJsonObject } from "../../request-security";
import { isPlatformAdmin } from "../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return authJson({ authenticated: false }, 401);
  const email = identity.email.toLowerCase();
  const db = getDb();
  const [storedProfile] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const profile = storedProfile ?? {
    email,
    displayName: identity.fullName ?? identity.displayName,
    professionalRole: "practitioner",
    organisation: "",
    jurisdiction: "",
    practiceAreas: [],
    experienceLevel: "mid",
    locale: "en",
    productUpdates: false,
    caseUpdates: false,
    researchInvites: false,
    verifiedPractitioner: false,
    licenseTier: "community",
  };
  return authJson({ authenticated: true, registered: Boolean(storedProfile), authSource: identity.authSource, profile, isAdmin: isPlatformAdmin(identity) });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return authJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return authJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request);
  if (!payload) return authJson({ error: "A valid JSON object is required." }, 400);
  const email = identity.email.toLowerCase();
  const values = {
    email,
    displayName: clean(payload.displayName, identity.displayName, 120) || identity.displayName,
    professionalRole: enumValue(payload.professionalRole, ["practitioner", "in_house", "academic", "student", "product"], "practitioner"),
    organisation: clean(payload.organisation, "", 160),
    jurisdiction: clean(payload.jurisdiction, "", 100),
    practiceAreas: list(payload.practiceAreas, 12, 100),
    experienceLevel: enumValue(payload.experienceLevel, ["early", "mid", "senior"], "mid"),
    locale: payload.locale === "ru" ? "ru" : "en",
    productUpdates: payload.productUpdates === true,
    caseUpdates: payload.caseUpdates === true,
    researchInvites: payload.researchInvites === true,
    communicationsConsentAt: payload.productUpdates === true || payload.caseUpdates === true || payload.researchInvites === true ? new Date().toISOString() : null,
    privacyNoticeVersion: "2026-08-21",
    updatedAt: new Date().toISOString(),
  };
  const db = getDb();
  const [profile] = await db.insert(users).values(values).onConflictDoUpdate({
    target: users.email,
    set: values,
  }).returning();
  await db.insert(auditEvents).values({
    actorEmail: email,
    eventType: "profile_and_communications_updated",
    objectType: "user",
    objectId: email,
    detail: { productUpdates: values.productUpdates, caseUpdates: values.caseUpdates, researchInvites: values.researchInvites, privacyNoticeVersion: values.privacyNoticeVersion },
  });
  return authJson({ authSource: identity.authSource, profile, isAdmin: isPlatformAdmin(identity) });
}

export async function DELETE(request: Request) {
  if (!isSameOriginCredentialMutation(request)) return authJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return authJson({ error: "Sign in is required." }, 401, clearSessionCookie());
  const email = identity.email.toLowerCase();
  const db = getDb();
  const [localAccount] = await db.select({ id: localAccounts.id }).from(localAccounts).where(eq(localAccounts.userEmail, email)).limit(1);
  const emailSubjectHash = await authSubjectHash(`email:${email}`);
  const ownedCustomCases = await db.select({ id: customCases.id }).from(customCases).where(eq(customCases.ownerEmail, email));
  const ownedIds = ownedCustomCases.map((item) => item.id);
  const authAuditDelete = localAccount
    ? db.delete(authAuditEvents).where(or(eq(authAuditEvents.accountId, localAccount.id), eq(authAuditEvents.subjectHash, emailSubjectHash))!)
    : db.delete(authAuditEvents).where(eq(authAuditEvents.subjectHash, emailSubjectHash));
  await db.batch([
    db.delete(caseSubscriptions).where(eq(caseSubscriptions.userEmail, email)),
    db.delete(updateReads).where(eq(updateReads.userEmail, email)),
    db.delete(caseFeedback).where(eq(caseFeedback.userEmail, email)),
    ...(ownedIds.length ? [
      db.delete(caseFeedback).where(inArray(caseFeedback.customCaseId, ownedIds)),
      db.delete(customCaseGrants).where(inArray(customCaseGrants.customCaseId, ownedIds)),
      db.delete(caseDrafts).where(inArray(caseDrafts.customCaseId, ownedIds)),
    ] : []),
    db.delete(customCaseGrants).where(eq(customCaseGrants.recipientEmail, email)),
    db.delete(caseDrafts).where(eq(caseDrafts.userEmail, email)),
    db.delete(playSessions).where(eq(playSessions.userEmail, email)),
    ...(ownedIds.length ? [db.delete(customCases).where(inArray(customCases.id, ownedIds))] : []),
    db.delete(auditEvents).where(eq(auditEvents.actorEmail, email)),
    authAuditDelete,
    db.delete(authRateLimitEvents).where(eq(authRateLimitEvents.subjectHash, emailSubjectHash)),
    db.delete(users).where(eq(users.email, email)),
  ]);
  return authJson({ deleted: true }, 200, clearSessionCookie());
}

function clean(value: unknown, fallback: string, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}
function list(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}
