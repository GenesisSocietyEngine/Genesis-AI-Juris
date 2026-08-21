import { getDb } from "../../../db";
import { caseFeedback } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required to submit expert feedback." }, { status: 401 });
  const payload = await request.json() as Record<string, unknown>;
  const rating = Number(payload.rating);
  const comment = typeof payload.comment === "string" ? payload.comment.trim().slice(0, 4000) : "";
  const caseId = typeof payload.caseId === "string" ? payload.caseId.trim().slice(0, 140) : "";
  const caseVersion = typeof payload.caseVersion === "string" ? payload.caseVersion.trim().slice(0, 40) : "";
  const source = payload.source === "studio" ? "studio" : "playable";
  const categories = new Set(["legal_accuracy", "realism", "usability", "learning_value", "technical", "other"]);
  const category = typeof payload.category === "string" && categories.has(payload.category) ? payload.category : "other";
  if (!caseId || !caseVersion || !comment || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Case, version, rating and comment are required." }, { status: 400 });
  }
  const db = getDb();
  const [feedback] = await db.insert(caseFeedback).values({
    caseId,
    caseVersion,
    userEmail: identity.email.toLowerCase(),
    source,
    category,
    rating,
    comment,
    studioFingerprint: typeof payload.studioFingerprint === "string" ? payload.studioFingerprint.slice(0, 140) : null,
  }).returning({ id: caseFeedback.id, createdAt: caseFeedback.createdAt });
  return Response.json({ feedback }, { status: 201 });
}
