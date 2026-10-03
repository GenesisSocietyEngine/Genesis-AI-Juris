import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, caseDrafts, users } from "../../../db/schema";
import { caseFingerprint, normalizeStudioDraft, studioStructuralIssues } from "../../case-integrity";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const rows = await getDb().select({
    id: caseDrafts.id,
    caseId: caseDrafts.caseId,
    version: caseDrafts.version,
    fingerprint: caseDrafts.fingerprint,
    title: caseDrafts.title,
    status: caseDrafts.status,
    reviewerNote: caseDrafts.reviewerNote,
    submittedAt: caseDrafts.submittedAt,
    reviewedAt: caseDrafts.reviewedAt,
    updatedAt: caseDrafts.updatedAt,
  }).from(caseDrafts).where(eq(caseDrafts.userEmail, identity.email.toLowerCase())).orderBy(desc(caseDrafts.updatedAt)).limit(50);
  return privateJson({ submissions: rows });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request, 512_000);
  if (!payload || (payload.action !== "save" && payload.action !== "submit")) return privateJson({ error: "A valid save or submit request is required." }, 400);
  const email = identity.email.toLowerCase();
  const db = getDb();
  const [profile] = await db.select({ email: users.email }).from(users).where(eq(users.email, email)).limit(1);
  if (!profile) return privateJson({ error: "Complete your professional profile before saving a shared workspace draft." }, 409);
  let draft;
  try { draft = normalizeStudioDraft(payload.draft); } catch { return privateJson({ error: "The Studio draft failed integrity validation." }, 400); }
  const structuralIssues = studioStructuralIssues(draft);
  if (payload.action === "submit" && structuralIssues.length) return privateJson({ error: "Resolve the Studio integrity checks before submission.", issues: structuralIssues }, 422);
  const fingerprint = caseFingerprint(draft);
  const [existing] = await db.select({ id: caseDrafts.id, status: caseDrafts.status }).from(caseDrafts).where(and(
    eq(caseDrafts.userEmail, email), eq(caseDrafts.caseId, draft.caseId), eq(caseDrafts.version, draft.version),
  )).limit(1);
  if (existing && ["accepted", "published"].includes(existing.status)) return privateJson({ error: "An accepted version is immutable. Create a child version." }, 409);
  if (existing?.status === "submitted") return privateJson({ error: "A submitted version is frozen until a reviewer requests changes." }, 409);
  const now = new Date().toISOString();
  const status = payload.action === "submit" ? "submitted" : "draft";
  const [saved] = await db.insert(caseDrafts).values({
    userEmail: email, caseId: draft.caseId, version: draft.version, fingerprint, title: draft.title,
    payload: draft as unknown as Record<string, unknown>, status,
    submittedAt: payload.action === "submit" ? now : null, updatedAt: now,
  }).onConflictDoUpdate({
    target: [caseDrafts.userEmail, caseDrafts.caseId, caseDrafts.version],
    set: { fingerprint, title: draft.title, payload: draft as unknown as Record<string, unknown>, status, submittedAt: payload.action === "submit" ? now : undefined, updatedAt: now },
  }).returning({ id: caseDrafts.id, caseId: caseDrafts.caseId, version: caseDrafts.version, fingerprint: caseDrafts.fingerprint, status: caseDrafts.status, updatedAt: caseDrafts.updatedAt });
  await db.insert(auditEvents).values({ actorEmail: email, eventType: payload.action === "submit" ? "case_submitted" : "case_draft_saved", objectType: "case_draft", objectId: String(saved.id), detail: { caseId: draft.caseId, version: draft.version, fingerprint } });
  return privateJson({ submission: saved }, payload.action === "submit" ? 201 : 200);
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
