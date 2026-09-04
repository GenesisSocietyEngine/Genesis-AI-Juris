import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { caseDrafts, caseFeedback, cases, caseVersions, customCaseGrants, customCases } from "../../../db/schema";
import { canViewCustomCase, customFeedbackAudience, normalizeEmail } from "../../custom-case-access";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { scenarios } from "../../scenarios";
import { isPlatformAdmin } from "../../server-authorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required to submit expert feedback." }, { status: 401 });
  const payload = await readJsonObject(request, 48_000);
  if (!payload) return Response.json({ error: "A valid JSON object is required." }, { status: 400 });
  const rating = Number(payload.rating);
  const comment = typeof payload.comment === "string" ? payload.comment.trim().slice(0, 4000) : "";
  const caseId = typeof payload.caseId === "string" ? payload.caseId.trim().slice(0, 140) : "";
  const caseVersion = typeof payload.caseVersion === "string" ? payload.caseVersion.trim().slice(0, 40) : "";
  const privacyMode = payload.privacyMode === "product_only" || payload.privacyMode === "private_note" ? payload.privacyMode : null;
  const source = privacyMode === "product_only" ? "product" : payload.source === "studio" || payload.source === "playable" ? payload.source : null;
  const categories = new Set(["legal_accuracy", "realism", "usability", "learning_value", "technical", "other"]);
  const category = typeof payload.category === "string" && categories.has(payload.category) ? payload.category : "other";
  const studioFingerprint = typeof payload.studioFingerprint === "string" ? payload.studioFingerprint.trim().slice(0, 140) : "";
  const contextType = typeof payload.contextType === "string" && ["case", "stage", "decision", "node"].includes(payload.contextType) ? payload.contextType : "case";
  const contextId = typeof payload.contextId === "string" ? payload.contextId.trim().slice(0, 160) : "";
  const severity = typeof payload.severity === "string" && ["suggestion", "material", "critical"].includes(payload.severity) ? payload.severity : "suggestion";
  const suggestedCorrection = typeof payload.suggestedCorrection === "string" ? payload.suggestedCorrection.trim().slice(0, 4000) : "";
  const citationUrl = validHttpsUrl(payload.citationUrl);
  if (!source || (source !== "product" && (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(caseId) || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(caseVersion))) || comment.length < 10 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Case, version, rating and comment are required." }, { status: 400 });
  }
  if (source === "studio" && !/^sha256-[a-f0-9]{64}$/.test(studioFingerprint)) {
    return Response.json({ error: "A valid Studio content fingerprint is required." }, { status: 400 });
  }
  if (privacyMode === "private_note" && source !== "studio") {
    return Response.json({ error: "Private notes require an exact Studio workspace case." }, { status: 400 });
  }
  const db = getDb();
  if (source === "playable" && !await isPublishedCase(db, caseId, caseVersion, studioFingerprint)) {
    return Response.json({ error: "The playable case identity does not match a published catalogue version." }, { status: 409 });
  }
  let customCaseId: number | null = null;
  let audience = "central";
  let feedbackStatus = "new";
  if (source === "studio") {
    const requestedCustomCaseId = typeof payload.customCaseId === "number" && Number.isInteger(payload.customCaseId) && payload.customCaseId > 0
      ? payload.customCaseId
      : null;
    if (!requestedCustomCaseId) return Response.json({ error: "Save and reopen this exact Studio workspace case before submitting case feedback." }, { status: 409 });
    const viewerEmail = normalizeEmail(identity.email);
    const admin = isPlatformAdmin(identity);
    const candidates = await db.select({ customCase: customCases, draftId: caseDrafts.id }).from(caseDrafts).innerJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(and(
      eq(customCases.id, requestedCustomCaseId),
      eq(customCases.caseId, caseId),
      eq(customCases.currentVersion, caseVersion),
      eq(customCases.fingerprint, studioFingerprint),
      eq(caseDrafts.caseId, caseId),
      eq(caseDrafts.version, caseVersion),
      eq(caseDrafts.fingerprint, studioFingerprint),
    )).limit(2);
    if (candidates.length !== 1) return Response.json({ error: "The exact Studio workspace case is unavailable or ambiguous. Reopen it before submitting feedback." }, { status: 409 });
    const candidate = candidates[0];
    const [grant] = await db.select({ id: customCaseGrants.id }).from(customCaseGrants).where(and(
      eq(customCaseGrants.customCaseId, requestedCustomCaseId),
      eq(customCaseGrants.recipientEmail, viewerEmail),
    )).limit(1);
    const access = { viewerEmail, ownerEmail: candidate.customCase.ownerEmail, isPrivate: candidate.customCase.isPrivate, isAdmin: admin, hasGrant: Boolean(grant) };
    if (!canViewCustomCase(access)) return Response.json({ error: "Custom case not found." }, { status: 404 });
    const resolvedAudience = customFeedbackAudience(access);
    if (!resolvedAudience) return Response.json({ error: "Custom case not found." }, { status: 404 });
    const owner = viewerEmail === normalizeEmail(candidate.customCase.ownerEmail);
    if (privacyMode === "private_note" && (!owner || !candidate.customCase.isPrivate || resolvedAudience !== "owner_private")) {
      return Response.json({ error: "A private note can be saved only by the owner of this exact Private workspace case." }, { status: 409 });
    }
    if (privacyMode !== "private_note" && candidate.customCase.isPrivate) {
      return Response.json({ error: "Choose the owner-only private-note channel or send redacted product feedback." }, { status: 409 });
    }
    customCaseId = requestedCustomCaseId;
    audience = resolvedAudience;
    feedbackStatus = resolvedAudience === "owner_private" ? "private_note" : "new";
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(caseFeedback).where(and(
    eq(caseFeedback.userEmail, identity.email.toLowerCase()),
    sql`${caseFeedback.createdAt} >= datetime('now', '-1 hour')`,
  ));
  if (Number(count) >= 20) return Response.json({ error: "Feedback rate limit reached. Try again later." }, { status: 429 });
  let feedback: { id: number; createdAt: string } | undefined;
  try {
    [feedback] = await db.insert(caseFeedback).values({
      caseId: source === "product" ? "private_case_redacted" : caseId,
      caseVersion: source === "product" ? "0.0.0" : caseVersion,
      userEmail: identity.email.toLowerCase(),
      source,
      category,
      rating,
      comment,
      studioFingerprint: source === "product" ? null : studioFingerprint || null,
      customCaseId,
      audience,
      contextType: source === "product" ? "case" : contextType,
      contextId: source === "product" ? null : contextId || null,
      severity,
      suggestedCorrection: source === "product" ? "" : suggestedCorrection,
      citationUrl: source === "product" ? null : citationUrl,
      status: feedbackStatus,
    }).returning({ id: caseFeedback.id, createdAt: caseFeedback.createdAt });
  } catch {
    return Response.json({ error: "Case visibility changed before feedback could be saved. Reopen the case and choose the current feedback channel." }, { status: 409 });
  }
  return Response.json({ feedback, audience }, { status: 201 });
}

function validHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim().slice(0, 500));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function isPublishedCase(db: ReturnType<typeof getDb>, caseId: string, version: string, fingerprint: string) {
  if (scenarios.some((item) => item.caseId === caseId && item.version === version && item.fingerprint === fingerprint)) return true;
  const [published] = await db.select({ publishedAt: caseVersions.publishedAt })
    .from(caseVersions)
    .innerJoin(cases, eq(cases.id, caseVersions.caseId))
    .where(and(
      eq(caseVersions.caseId, caseId),
      eq(caseVersions.version, version),
      eq(caseVersions.fingerprint, fingerprint),
      isNotNull(caseVersions.publishedAt),
      eq(cases.status, "published"),
    ))
    .limit(1);
  return Boolean(published);
}
