import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, caseDrafts, caseFeedback, caseSubscriptions, updateReads, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { isPlatformAdmin } from "../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ authenticated: false }, { status: 401 });
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
  };
  return Response.json({ authenticated: true, registered: Boolean(storedProfile), profile, isAdmin: isPlatformAdmin(email) });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await readJsonObject(request);
  if (!payload) return Response.json({ error: "A valid JSON object is required." }, { status: 400 });
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
  return Response.json({ profile, isAdmin: isPlatformAdmin(email) });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const email = identity.email.toLowerCase();
  const db = getDb();
  await db.delete(caseSubscriptions).where(eq(caseSubscriptions.userEmail, email));
  await db.delete(updateReads).where(eq(updateReads.userEmail, email));
  await db.delete(caseFeedback).where(eq(caseFeedback.userEmail, email));
  await db.delete(caseDrafts).where(eq(caseDrafts.userEmail, email));
  await db.delete(auditEvents).where(eq(auditEvents.actorEmail, email));
  await db.delete(users).where(eq(users.email, email));
  return Response.json({ deleted: true });
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
