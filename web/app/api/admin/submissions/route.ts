import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, caseDrafts } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity.email)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const idParam = new URL(request.url).searchParams.get("id");
  if (idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Submission not found." }, { status: 404 });
    const [submission] = await getDb().select().from(caseDrafts).where(eq(caseDrafts.id, id)).limit(1);
    if (!submission) return Response.json({ error: "Submission not found." }, { status: 404 });
    return Response.json({ submission }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const rows = await getDb().select({
    id: caseDrafts.id,
    userEmail: caseDrafts.userEmail,
    caseId: caseDrafts.caseId,
    version: caseDrafts.version,
    fingerprint: caseDrafts.fingerprint,
    title: caseDrafts.title,
    status: caseDrafts.status,
    reviewerEmail: caseDrafts.reviewerEmail,
    reviewerNote: caseDrafts.reviewerNote,
    submittedAt: caseDrafts.submittedAt,
    reviewedAt: caseDrafts.reviewedAt,
    updatedAt: caseDrafts.updatedAt,
  }).from(caseDrafts).orderBy(desc(caseDrafts.updatedAt)).limit(100);
  return Response.json({ submissions: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity.email)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const payload = await readJsonObject(request, 48_000);
  const id = Number(payload?.id);
  const status = payload?.status;
  if (!Number.isInteger(id) || id <= 0 || typeof status !== "string" || !["changes_requested", "accepted", "rejected"].includes(status)) return Response.json({ error: "A valid review decision is required." }, { status: 400 });
  const reviewerNote = typeof payload?.reviewerNote === "string" ? payload.reviewerNote.trim().slice(0, 4_000) : "";
  if (reviewerNote.length < 10) return Response.json({ error: "A substantive reviewer note is required." }, { status: 400 });
  const now = new Date().toISOString();
  const [updated] = await getDb().update(caseDrafts).set({ status, reviewerEmail: identity.email.toLowerCase(), reviewerNote, reviewedAt: now, updatedAt: now }).where(and(eq(caseDrafts.id, id), eq(caseDrafts.status, "submitted"))).returning({ id: caseDrafts.id, status: caseDrafts.status });
  if (!updated) return Response.json({ error: "Submission not found." }, { status: 404 });
  await getDb().insert(auditEvents).values({ actorEmail: identity.email.toLowerCase(), eventType: "case_submission_reviewed", objectType: "case_draft", objectId: String(id), detail: { status } });
  return Response.json({ submission: updated });
}
