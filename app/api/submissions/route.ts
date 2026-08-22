import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditEvents, caseDrafts, customCases, users } from "../../../db/schema";
import { caseFingerprint, normalizeStudioDraft, studioStructuralIssues } from "../../case-integrity";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const rows = await getDb().select({
    id: caseDrafts.id,
    customCaseId: caseDrafts.customCaseId,
    caseId: caseDrafts.caseId,
    version: caseDrafts.version,
    fingerprint: caseDrafts.fingerprint,
    title: caseDrafts.title,
    status: caseDrafts.status,
    reviewerNote: caseDrafts.reviewerNote,
    submittedAt: caseDrafts.submittedAt,
    reviewedAt: caseDrafts.reviewedAt,
    updatedAt: caseDrafts.updatedAt,
    isPrivate: customCases.isPrivate,
    customStatus: customCases.status,
  }).from(caseDrafts).leftJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(eq(caseDrafts.userEmail, identity.email.toLowerCase())).orderBy(desc(caseDrafts.updatedAt)).limit(50);
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
  const [existingCustom] = await db.select().from(customCases).where(and(eq(customCases.ownerEmail, email), eq(customCases.caseId, draft.caseId))).limit(1);
  // Once a workspace envelope exists, visibility changes only through the
  // dedicated privacy action. A stale save from another tab cannot un-private it.
  const requestedPrivate = existingCustom ? existingCustom.isPrivate : payload.isPrivate === true;
  if (payload.action === "submit" && requestedPrivate) return privateJson({ error: "Turn off Private before submitting a case for review." }, 409);
  const [existing] = await db.select({ id: caseDrafts.id, status: caseDrafts.status }).from(caseDrafts).where(and(
    eq(caseDrafts.userEmail, email), eq(caseDrafts.caseId, draft.caseId), eq(caseDrafts.version, draft.version),
  )).limit(1);
  if (existing && ["accepted", "published"].includes(existing.status)) return privateJson({ error: "An accepted version is immutable. Create a child version." }, 409);
  if (existing?.status === "submitted") return privateJson({ error: "A submitted version is frozen until a reviewer requests changes." }, 409);
  const now = new Date().toISOString();
  const status = payload.action === "submit" ? "submitted" : "draft";
  const [customCase] = await db.insert(customCases).values({
    ownerEmail: email, caseId: draft.caseId, title: draft.title, currentVersion: draft.version, fingerprint,
    isPrivate: requestedPrivate, status: "custom", updatedAt: now,
  }).onConflictDoUpdate({
    target: [customCases.ownerEmail, customCases.caseId],
    set: { title: draft.title, currentVersion: draft.version, fingerprint, updatedAt: now },
  }).returning({ id: customCases.id, isPrivate: customCases.isPrivate, status: customCases.status });
  let saved: { id: number; customCaseId: number | null; caseId: string; version: string; fingerprint: string; status: string; updatedAt: string } | undefined;
  try {
    [saved] = await db.insert(caseDrafts).values({
      customCaseId: customCase.id, userEmail: email, caseId: draft.caseId, version: draft.version, fingerprint, title: draft.title,
      payload: draft as unknown as Record<string, unknown>, status,
      submittedAt: payload.action === "submit" ? now : null, updatedAt: now,
    }).onConflictDoUpdate({
      target: [caseDrafts.userEmail, caseDrafts.caseId, caseDrafts.version],
      set: { customCaseId: customCase.id, fingerprint, title: draft.title, payload: draft as unknown as Record<string, unknown>, status, submittedAt: payload.action === "submit" ? now : undefined, updatedAt: now },
    }).returning({ id: caseDrafts.id, customCaseId: caseDrafts.customCaseId, caseId: caseDrafts.caseId, version: caseDrafts.version, fingerprint: caseDrafts.fingerprint, status: caseDrafts.status, updatedAt: caseDrafts.updatedAt });
  } catch {
    return privateJson({ error: "Case visibility changed before review submission. Reopen the case and use its current visibility." }, 409);
  }
  if (!saved) return privateJson({ error: "The Studio draft could not be saved." }, 409);
  await db.insert(auditEvents).values({ actorEmail: email, eventType: payload.action === "submit" ? "case_submitted" : "case_draft_saved", objectType: "case_draft", objectId: String(saved.id), detail: { customCaseId: customCase.id, caseId: draft.caseId, version: draft.version, fingerprint, isPrivate: requestedPrivate } });
  return privateJson({ submission: saved, customCase: { ...customCase, caseId: draft.caseId, title: draft.title } }, payload.action === "submit" ? 201 : 200);
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
