import { sql } from "drizzle-orm";
import { dossierJson, isResponse, resolveDossierServerContext, revalidateDossierIdentity } from "../../../dossier-server";
import { assertOrganizationCurrent } from "../../../organization-store";

export const dynamic = "force-dynamic";

// Return thread metadata only. Message bodies are read through the existing per-invitation staff portal.
export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const org = context.organization!;
  if (org.role === "auditor") return dossierJson({error:"Unavailable"}, 403);
  const params = new URL(request.url).searchParams;
  const caseId = params.get("case"), before = Number(params.get("before") || 0);
  if (!Number.isSafeInteger(before) || before < 0) return dossierJson({error:"Invalid cursor"},400);
  const access = sql`FROM dossier_participants p
    JOIN dossier_organization_bindings b ON b.dossier_id=p.dossier_id
    WHERE b.organization_id=${org.id} AND p.user_id=${context.actor.userId} AND p.actor_id=${context.actor.actorId}
      AND p.status='active' AND p.role IN ('owner','contributor')`;
  const rows = await context.db.all<{caseId:string; caseTitle:string; recipient:string; id:string; stamp:string; seq:number; participant:string}>(sql`
    SELECT g.case_id AS caseId,d.title AS caseTitle,g.email AS recipient,g.id AS id,e.stamp,e.seq,
      (SELECT p.id ${access} AND p.dossier_id=g.case_id) AS participant
    FROM portal_grants g JOIN dossiers d ON d.id=g.case_id
    JOIN portal_entries e ON e.seq=(SELECT MAX(last.seq) FROM portal_entries last WHERE last.grant_id=g.id AND last.kind='message')
    WHERE g.organization_id=${org.id} AND EXISTS(SELECT 1 ${access} AND p.dossier_id=g.case_id)
      ${caseId ? sql`AND g.case_id=${caseId}` : sql.empty()}
      ${before ? sql`AND e.seq<${before}` : sql.empty()}
    ORDER BY e.seq DESC LIMIT 51`);
  const denied = await revalidateDossierIdentity(context);
  if (denied) return denied;
  try { await assertOrganizationCurrent(context.db, context.actor, org); }
  catch { return dossierJson({error:"Organization access changed"},404); }
  if (rows.length) {
    const grants = await context.db.all<{id:string}>(sql`SELECT p.id ${access}
      AND p.id IN (SELECT value FROM json_each(${JSON.stringify(rows.map(r=>r.participant))}))`);
    const valid = new Set(grants.map(g=>g.id));
    if (rows.some(r=>!valid.has(r.participant))) return dossierJson({error:"Case access changed"},409);
  }
  const page = rows.slice(0,50);
  return dossierJson({threads:page.map(r=>({caseId:r.caseId,caseTitle:r.caseTitle,id:r.id,recipient:r.recipient,stamp:r.stamp})),before:rows.length>50?page.at(-1)!.seq:null});
}
