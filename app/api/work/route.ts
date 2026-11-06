import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { dossiers, dossierOrganizationBindings, dossierParticipants, dossierPracticeRevisions } from "../../../db/schema";
import { dossierJson, isResponse, revalidateDossierIdentity, resolveDossierServerContext } from "../../dossier-server";
import { assertOrganizationCurrent, organizationSelectionToken } from "../../organization-store";
import { EMPTY_PLAN, parsePracticePlan } from "../../matters/practice-plan";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request); if (isResponse(context)) return context;
  const scope = organizationSelectionToken(context.organization!);
  const cursor = new URL(request.url).searchParams.get("cursor");
  let after = "";
  try {
    if (cursor) {
      if (cursor.length > 1500) throw Error();
      const decoded = JSON.parse(atob(cursor));
      if (decoded.scope !== scope || typeof decoded.after !== "string" || !/^[\w-]{1,120}$/.test(decoded.after)) throw Error();
      after = decoded.after;
    }
  } catch { return dossierJson({ error: "Invalid work cursor. Refresh the firm view." }, 400); }
  const rows = await context.db.select({ id: dossiers.id, title: dossiers.title, role: dossierParticipants.role, grant: dossierParticipants.id,
    plan: sql<string | null>`(SELECT plan FROM ${dossierPracticeRevisions} WHERE dossier_id=${dossiers.id} ORDER BY revision DESC LIMIT 1)`
  }).from(dossiers)
    .innerJoin(dossierOrganizationBindings, and(eq(dossierOrganizationBindings.dossierId, dossiers.id), eq(dossierOrganizationBindings.organizationId, context.organization!.id)))
    .innerJoin(dossierParticipants, and(eq(dossierParticipants.dossierId, dossiers.id), eq(dossierParticipants.actorId, context.actor.actorId), eq(dossierParticipants.userId, context.actor.userId), eq(dossierParticipants.status, "active")))
    .where(after ? gt(dossiers.id, after) : undefined).orderBy(asc(dossiers.id)).limit(26);
  const page = rows.slice(0, 25), ids = rows.map(r => r.id);
  const people = ids.length ? await context.db.select({ id: dossierParticipants.id, caseId: dossierParticipants.dossierId, actorId: dossierParticipants.actorId, name: dossierParticipants.displayName, status: dossierParticipants.status, role: dossierParticipants.role }).from(dossierParticipants).where(inArray(dossierParticipants.dossierId, ids)) : [];
  const identity = await revalidateDossierIdentity(context); if (identity) return identity;
  try { await assertOrganizationCurrent(context.db, context.actor, context.organization!); }
  catch { return dossierJson({ error: "Organization access changed." }, 404); }
  // Recheck the exact grants, including the pagination lookahead, after all reads.
  const grants = ids.length ? await context.db.select({ id: dossierParticipants.id, role: dossierParticipants.role }).from(dossierParticipants).where(and(inArray(dossierParticipants.dossierId, ids), eq(dossierParticipants.userId, context.actor.userId), eq(dossierParticipants.actorId, context.actor.actorId), eq(dossierParticipants.status, "active"))) : [];
  if (rows.some(row => !grants.some(g => g.id === row.grant && g.role === row.role))) return dossierJson({ error: "Case access changed. Refresh the firm view." }, 409);
  return dossierJson({ scope, cases: page.map(row => ({ id: row.id, title: row.title, plan: row.plan ? parsePracticePlan(JSON.parse(row.plan)) : EMPTY_PLAN,
    participants: people.filter(p => p.caseId === row.id).map(p => ({ id: p.id, actorId: p.actorId, name: p.name, active: p.status === "active" })) })),
    nextCursor: rows.length > 25 ? btoa(JSON.stringify({ scope, after: page.at(-1)!.id })) : null });
}
