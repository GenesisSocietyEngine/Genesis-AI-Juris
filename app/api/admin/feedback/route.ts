import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, caseFeedback, customCases } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const rows = await getDb().select({ feedback: caseFeedback }).from(caseFeedback).leftJoin(customCases, eq(customCases.id, caseFeedback.customCaseId)).where(or(
    isNull(caseFeedback.customCaseId),
    and(eq(customCases.isPrivate, false), ne(caseFeedback.audience, "owner_private")),
  )).orderBy(desc(caseFeedback.createdAt)).limit(100);
  return Response.json({ feedback: rows.map((row) => row.feedback) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const payload = await readJsonObject(request, 48_000);
  const id = Number(payload?.id);
  const status = payload?.status;
  if (!Number.isInteger(id) || id <= 0 || typeof status !== "string" || !["triaged", "accepted", "resolved", "declined"].includes(status)) return Response.json({ error: "A valid moderation decision is required." }, { status: 400 });
  const moderatorNote = typeof payload?.moderatorNote === "string" ? payload.moderatorNote.trim().slice(0, 4_000) : "";
  const [visible] = await getDb().select({ id: caseFeedback.id }).from(caseFeedback).leftJoin(customCases, eq(customCases.id, caseFeedback.customCaseId)).where(and(eq(caseFeedback.id, id), or(
    isNull(caseFeedback.customCaseId),
    and(eq(customCases.isPrivate, false), ne(caseFeedback.audience, "owner_private")),
  ))).limit(1);
  if (!visible) return Response.json({ error: "Feedback not found." }, { status: 404 });
  let updated: { id: number; status: string } | undefined;
  try {
    [updated] = await getDb().update(caseFeedback).set({ status, moderatorNote, resolvedAt: ["resolved", "declined"].includes(status) ? new Date().toISOString() : null }).where(eq(caseFeedback.id, id)).returning({ id: caseFeedback.id, status: caseFeedback.status });
  } catch {
    return Response.json({ error: "Feedback not found." }, { status: 404 });
  }
  if (!updated) return Response.json({ error: "Feedback not found." }, { status: 404 });
  await getDb().insert(auditEvents).values({ actorEmail: identity.email.toLowerCase(), eventType: "feedback_moderated", objectType: "case_feedback", objectId: String(id), detail: { status } });
  return Response.json({ feedback: updated });
}
