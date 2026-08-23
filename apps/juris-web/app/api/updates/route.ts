import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { cases, caseSubscriptions, updateReads, updates, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ authenticated: false, updates: [] }, { status: 401 });
  const email = identity.email.toLowerCase();
  const db = getDb();
  const [[profile], subscriptions, reads, published] = await Promise.all([
    db.select().from(users).where(eq(users.email, email)).limit(1),
    db.select({ caseId: caseSubscriptions.caseId }).from(caseSubscriptions).where(eq(caseSubscriptions.userEmail, email)),
    db.select({ updateId: updateReads.updateId }).from(updateReads).where(eq(updateReads.userEmail, email)),
    db.select().from(updates).where(isNotNull(updates.publishedAt)).orderBy(desc(updates.publishedAt)).limit(500),
  ]);
  const subscribed = new Set(subscriptions.map((item) => item.caseId));
  const read = new Set(reads.map((item) => item.updateId));
  const now = new Date();
  const relevant = published.filter((item) => {
    if (!profile) return false;
    if (!item.publishedAt || !Number.isFinite(Date.parse(item.publishedAt)) || new Date(item.publishedAt) > now) return false;
    if (item.expiresAt && (!Number.isFinite(Date.parse(item.expiresAt)) || new Date(item.expiresAt) <= now)) return false;
    if (item.kind === "product" && !profile.productUpdates) return false;
    if (item.kind === "case" && !profile.caseUpdates) return false;
    if (item.kind === "research" && !profile.researchInvites) return false;
    if (item.caseId && !subscribed.has(item.caseId)) return false;
    return matches(item.targetJurisdictions, profile.jurisdiction)
      && intersects(item.targetPracticeAreas, profile.practiceAreas)
      && matches(item.targetRoles, profile.professionalRole);
  }).slice(0, 50).map((item) => ({ ...item, read: read.has(item.id) }));
  return Response.json({ authenticated: true, updates: relevant, subscriptions: [...subscribed] });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Cross-site mutation rejected." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await readJsonObject(request);
  if (!payload) return Response.json({ error: "A valid JSON object is required." }, { status: 400 });
  const email = identity.email.toLowerCase();
  const db = getDb();
  if (payload.action === "read" && Number.isInteger(Number(payload.updateId)) && Number(payload.updateId) > 0) {
    const updateId = Number(payload.updateId);
    const [existing] = await db.select({ id: updates.id }).from(updates).where(eq(updates.id, updateId)).limit(1);
    if (!existing) return Response.json({ error: "Update not found." }, { status: 404 });
    await db.insert(updateReads).values({ updateId, userEmail: email }).onConflictDoNothing();
    return Response.json({ ok: true });
  }
  if (payload.action === "subscribe" && typeof payload.caseId === "string") {
    const caseId = payload.caseId.trim().slice(0, 140);
    const [publishedCase] = await db.select({ id: cases.id }).from(cases).where(and(eq(cases.id, caseId), eq(cases.status, "published"))).limit(1);
    if (!publishedCase) return Response.json({ error: "Published case not found." }, { status: 404 });
    await db.insert(caseSubscriptions).values({ userEmail: email, caseId }).onConflictDoNothing();
    return Response.json({ ok: true, subscribed: true });
  }
  if (payload.action === "unsubscribe" && typeof payload.caseId === "string") {
    await db.delete(caseSubscriptions).where(and(eq(caseSubscriptions.userEmail, email), eq(caseSubscriptions.caseId, payload.caseId.slice(0, 140))));
    return Response.json({ ok: true, subscribed: false });
  }
  return Response.json({ error: "Unsupported update action." }, { status: 400 });
}

function matches(targets: string[], value: string) {
  const normalized = normalize(value);
  return targets.length === 0 || targets.some((target) => normalize(target) === normalized);
}
function intersects(targets: string[], values: string[]) {
  const normalizedValues = new Set(values.map(normalize));
  return targets.length === 0 || targets.some((target) => normalizedValues.has(normalize(target)));
}
function normalize(value: string) { return value.trim().toLocaleLowerCase("en"); }
