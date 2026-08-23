import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditEvents, localAccounts, users } from "../../../../db/schema";
import { normalizeEmail, normalizeLicenseTier } from "../../../custom-case-access";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { isPlatformAdmin } from "../../../server-authorization";
import { passwordResetMailAvailable } from "../../../reset-mail";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return privateJson({ error: "Administrator access is required." }, 403);
  const rows = await getDb().select({ id: users.id, email: users.email, displayName: users.displayName, organisation: users.organisation, licenseTier: users.licenseTier, verifiedPractitioner: users.verifiedPractitioner, localAccountId: localAccounts.id, localAccountStatus: localAccounts.status }).from(users).leftJoin(localAccounts, eq(localAccounts.userEmail, users.email)).orderBy(asc(users.displayName));
  return privateJson({ users: rows.map(({ localAccountId, ...row }) => ({ ...row, hasLocalAccount: localAccountId !== null })), emailResetAvailable: passwordResetMailAvailable() });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) return privateJson({ error: "Administrator access is required." }, 403);
  const payload = await readJsonObject(request, 12_000);
  const email = typeof payload?.email === "string" ? normalizeEmail(payload.email).slice(0, 320) : "";
  const licenseTier = normalizeLicenseTier(payload?.licenseTier);
  if (!email) return privateJson({ error: "A registered user is required." }, 400);
  const db = getDb();
  const now = new Date().toISOString();
  const actorEmail = normalizeEmail(identity.email);
  const auditedObjectId = sql<string>`(
    SELECT ${users.email}
    FROM ${users}
    WHERE changes() = 1
      AND ${users.email} = ${email}
      AND ${users.licenseTier} = ${licenseTier}
      AND ${users.updatedAt} = ${now}
    LIMIT 1
  )`;
  let updated: { email: string; licenseTier: string } | undefined;
  try {
    const [updatedRows] = await db.batch([
      db.update(users).set({ licenseTier, updatedAt: now }).where(eq(users.email, email)).returning({ email: users.email, licenseTier: users.licenseTier }),
      db.insert(auditEvents).values({ actorEmail, eventType: "user_license_changed", objectType: "user", objectId: auditedObjectId, detail: { licenseTier } }),
    ]);
    updated = updatedRows[0];
  } catch {
    return privateJson({ error: "Registered user not found." }, 404);
  }
  if (!updated) return privateJson({ error: "Registered user not found." }, 404);
  return privateJson({ user: updated });
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
