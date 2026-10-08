import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, caseFeedback } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity.email)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const rows = await getDb().select().from(caseFeedback).orderBy(desc(caseFeedback.createdAt)).limit(100);
  return Response.json({ feedback: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity.email)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const payload = await readJsonObject(request, 48_000);
  const id = Number(payload?.id);
  const status = payload?.status;
  if (!Number.isInteger(id) || id <= 0 || typeof status !== "string" || !["triaged", "accepted", "resolved", "declined"].includes(status)) return Response.json({ error: "A valid moderation decision is required." }, { status: 400 });
  const moderatorNote = typeof payload?.moderatorNote === "string" ? payload.moderatorNote.trim().slice(0, 4_000) : "";
  const [updated] = await getDb().update(caseFeedback).set({ status, moderatorNote, resolvedAt: ["resolved", "declined"].includes(status) ? new Date().toISOString() : null }).where(eq(caseFeedback.id, id)).returning({ id: caseFeedback.id, status: caseFeedback.status });
  if (!updated) return Response.json({ error: "Feedback not found." }, { status: 404 });
  await getDb().insert(auditEvents).values({ actorEmail: identity.email.toLowerCase(), eventType: "feedback_moderated", objectType: "case_feedback", objectId: String(id), detail: { status } });
  return Response.json({ feedback: updated });
}
