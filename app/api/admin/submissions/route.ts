import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, caseDrafts, customCases } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const idParam = new URL(request.url).searchParams.get("id");
  if (idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Submission not found." }, { status: 404 });
    const [row] = await getDb().select({ submission: caseDrafts, isPrivate: customCases.isPrivate }).from(caseDrafts).leftJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(eq(caseDrafts.id, id)).limit(1);
    if (!row || row.isPrivate === true) return Response.json({ error: "Submission not found." }, { status: 404 });
    return Response.json({ submission: row.submission }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const rows = await getDb().select({
    id: caseDrafts.id,
    customCaseId: caseDrafts.customCaseId,
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
  }).from(caseDrafts).leftJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(or(isNull(customCases.id), eq(customCases.isPrivate, false))).orderBy(desc(caseDrafts.updatedAt)).limit(100);
  return Response.json({ submissions: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const payload = await readJsonObject(request, 48_000);
  const id = Number(payload?.id);
  const status = payload?.status;
  if (!Number.isInteger(id) || id <= 0 || typeof status !== "string" || !["changes_requested", "accepted", "rejected"].includes(status)) return Response.json({ error: "A valid review decision is required." }, { status: 400 });
  const reviewerNote = typeof payload?.reviewerNote === "string" ? payload.reviewerNote.trim().slice(0, 4_000) : "";
  if (reviewerNote.length < 10) return Response.json({ error: "A substantive reviewer note is required." }, { status: 400 });
  const db = getDb();
  const [visible] = await db.select({ id: caseDrafts.id }).from(caseDrafts).leftJoin(customCases, eq(customCases.id, caseDrafts.customCaseId)).where(and(eq(caseDrafts.id, id), or(isNull(customCases.id), eq(customCases.isPrivate, false)))).limit(1);
  if (!visible) return Response.json({ error: "Submission not found." }, { status: 404 });
  const now = new Date().toISOString();
  const reviewerEmail = identity.email.toLowerCase();
  const remainsCentrallyVisible = sql<boolean>`(
    ${caseDrafts.customCaseId} IS NULL
    OR EXISTS (
      SELECT 1
      FROM ${customCases}
      WHERE ${customCases.id} = ${caseDrafts.customCaseId}
        AND ${customCases.isPrivate} = false
    )
  )`;
  const auditedObjectId = sql<string>`(
    SELECT CAST(${caseDrafts.id} AS TEXT)
    FROM ${caseDrafts}
    WHERE changes() = 1
      AND ${caseDrafts.id} = ${id}
      AND ${caseDrafts.status} = ${status}
      AND ${caseDrafts.reviewerEmail} = ${reviewerEmail}
      AND ${caseDrafts.reviewedAt} = ${now}
    LIMIT 1
  )`;
  let updated: { id: number; status: string } | undefined;
  try {
    const [updatedRows] = await db.batch([
      db.update(caseDrafts).set({ status, reviewerEmail, reviewerNote, reviewedAt: now, updatedAt: now }).where(and(eq(caseDrafts.id, id), eq(caseDrafts.status, "submitted"), remainsCentrallyVisible)).returning({ id: caseDrafts.id, status: caseDrafts.status }),
      // audit_events.object_id is NOT NULL. changes() refers to the immediately
      // preceding UPDATE, so a missed CAS or failed review write aborts the
      // complete D1 batch instead of leaving either side half-committed.
      db.insert(auditEvents).values({ actorEmail: reviewerEmail, eventType: "case_submission_reviewed", objectType: "case_draft", objectId: auditedObjectId, detail: { status } }),
    ]);
    updated = updatedRows[0];
  } catch {
    return Response.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!updated) return Response.json({ error: "Submission not found." }, { status: 404 });
  return Response.json({ submission: updated });
}
