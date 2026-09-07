import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { caseFeedback, cases, caseVersions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { scenarios } from "../../scenarios";

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
  const source = payload.source === "studio" || payload.source === "playable" ? payload.source : null;
  const categories = new Set(["legal_accuracy", "realism", "usability", "learning_value", "technical", "other"]);
  const category = typeof payload.category === "string" && categories.has(payload.category) ? payload.category : "other";
  const studioFingerprint = typeof payload.studioFingerprint === "string" ? payload.studioFingerprint.trim().slice(0, 140) : "";
  const contextType = typeof payload.contextType === "string" && ["case", "stage", "decision", "node"].includes(payload.contextType) ? payload.contextType : "case";
  const contextId = typeof payload.contextId === "string" ? payload.contextId.trim().slice(0, 160) : "";
  const severity = typeof payload.severity === "string" && ["suggestion", "material", "critical"].includes(payload.severity) ? payload.severity : "suggestion";
  const suggestedCorrection = typeof payload.suggestedCorrection === "string" ? payload.suggestedCorrection.trim().slice(0, 4000) : "";
  const citationUrl = validHttpsUrl(payload.citationUrl);
  if (!source || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(caseId) || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(caseVersion) || comment.length < 10 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Case, version, rating and comment are required." }, { status: 400 });
  }
  if (source === "studio" && !/^sha256-[a-f0-9]{64}$/.test(studioFingerprint)) {
    return Response.json({ error: "A valid Studio content fingerprint is required." }, { status: 400 });
  }
  const db = getDb();
  if (source === "playable" && !await isPublishedCase(db, caseId, caseVersion, studioFingerprint)) {
    return Response.json({ error: "The playable case identity does not match a published catalogue version." }, { status: 409 });
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(caseFeedback).where(and(
    eq(caseFeedback.userEmail, identity.email.toLowerCase()),
    sql`${caseFeedback.createdAt} >= datetime('now', '-1 hour')`,
  ));
  if (Number(count) >= 20) return Response.json({ error: "Feedback rate limit reached. Try again later." }, { status: 429 });
  const [feedback] = await db.insert(caseFeedback).values({
    caseId,
    caseVersion,
    userEmail: identity.email.toLowerCase(),
    source,
    category,
    rating,
    comment,
    studioFingerprint: studioFingerprint || null,
    contextType,
    contextId: contextId || null,
    severity,
    suggestedCorrection,
    citationUrl,
  }).returning({ id: caseFeedback.id, createdAt: caseFeedback.createdAt });
  return Response.json({ feedback }, { status: 201 });
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
