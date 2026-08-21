import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { caseSubscriptions, updateReads, updates, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

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
    db.select().from(updates).where(isNotNull(updates.publishedAt)).orderBy(desc(updates.publishedAt)).limit(50),
  ]);
  const subscribed = new Set(subscriptions.map((item) => item.caseId));
  const read = new Set(reads.map((item) => item.updateId));
  const relevant = published.filter((item) => {
    if (item.expiresAt && new Date(item.expiresAt) <= new Date()) return false;
    if (item.caseId && !subscribed.has(item.caseId)) return false;
    if (!profile) return item.targetJurisdictions.length === 0 && item.targetPracticeAreas.length === 0 && item.targetRoles.length === 0;
    return matches(item.targetJurisdictions, profile.jurisdiction)
      && intersects(item.targetPracticeAreas, profile.practiceAreas)
      && matches(item.targetRoles, profile.professionalRole);
  }).map((item) => ({ ...item, read: read.has(item.id) }));
  return Response.json({ authenticated: true, updates: relevant, subscriptions: [...subscribed] });
}

export async function POST(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await request.json() as Record<string, unknown>;
  const email = identity.email.toLowerCase();
  const db = getDb();
  if (payload.action === "read" && Number.isInteger(Number(payload.updateId))) {
    await db.insert(updateReads).values({ updateId: Number(payload.updateId), userEmail: email }).onConflictDoNothing();
    return Response.json({ ok: true });
  }
  if (payload.action === "subscribe" && typeof payload.caseId === "string") {
    await db.insert(caseSubscriptions).values({ userEmail: email, caseId: payload.caseId.slice(0, 140) }).onConflictDoNothing();
    return Response.json({ ok: true, subscribed: true });
  }
  if (payload.action === "unsubscribe" && typeof payload.caseId === "string") {
    await db.delete(caseSubscriptions).where(and(eq(caseSubscriptions.userEmail, email), eq(caseSubscriptions.caseId, payload.caseId.slice(0, 140))));
    return Response.json({ ok: true, subscribed: false });
  }
  return Response.json({ error: "Unsupported update action." }, { status: 400 });
}

function matches(targets: string[], value: string) {
  return targets.length === 0 || targets.includes(value);
}
function intersects(targets: string[], values: string[]) {
  return targets.length === 0 || targets.some((target) => values.includes(target));
}
