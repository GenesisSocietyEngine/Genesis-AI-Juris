import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ authenticated: false }, { status: 401 });
  const email = identity.email.toLowerCase();
  const db = getDb();
  let [profile] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!profile) {
    [profile] = await db.insert(users).values({
      email,
      displayName: identity.fullName ?? identity.displayName,
    }).returning();
  }
  return Response.json({ authenticated: true, profile });
}

export async function POST(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await request.json() as Record<string, unknown>;
  const email = identity.email.toLowerCase();
  const values = {
    email,
    displayName: clean(payload.displayName, identity.displayName, 120),
    professionalRole: clean(payload.professionalRole, "practitioner", 60),
    organisation: clean(payload.organisation, "", 160),
    jurisdiction: clean(payload.jurisdiction, "", 100),
    practiceAreas: Array.isArray(payload.practiceAreas) ? payload.practiceAreas.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
    experienceLevel: clean(payload.experienceLevel, "mid", 40),
    locale: payload.locale === "ru" ? "ru" : "en",
    productUpdates: payload.productUpdates !== false,
    caseUpdates: payload.caseUpdates !== false,
    researchInvites: payload.researchInvites === true,
    updatedAt: new Date().toISOString(),
  };
  const db = getDb();
  const [profile] = await db.insert(users).values(values).onConflictDoUpdate({
    target: users.email,
    set: values,
  }).returning();
  return Response.json({ profile });
}

function clean(value: unknown, fallback: string, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}
