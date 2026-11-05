import { and, desc, eq, sql } from "drizzle-orm";
import { dossierPracticeRevisions as revisions, dossierParticipants, organizationCasGuards, organizationWorkflowRevisions } from "../../../../../db/schema";
import { canonicalDossierJson } from "../../../../dossier-contract";
import { boundedDossierText, canonicalDossierTimestamp, dossierJson, dossierSha256, finalizeDossierRead, isResponse, newDossierOpaqueId, requireDossierAccess, resolveDossierServerContext } from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";
import { changePracticePlan, EMPTY_PLAN, type PracticePlan } from "../../../../matters/practice-plan";
import { readWorkflowLibrary, type WorkflowTemplate } from "../../../../work/workflow-templates";
export const dynamic = "force-dynamic";
type Route = {params: Promise<{dossierId:string}>};
export async function GET(request: Request, route: Route) {
  const context = await resolveDossierServerContext(request); if (isResponse(context)) return context;
  const access = await requireDossierAccess(context, (await route.params).dossierId, "read"); if (isResponse(access)) return access;
  const key = new URL(request.url).searchParams.get("operation");
  const [row] = await context.db.select().from(revisions).where(and(eq(revisions.dossierId, access.dossier.id), key ? eq(revisions.operationKey, key) : undefined, key ? eq(revisions.actorRef, context.actor.actorId) : undefined)).orderBy(desc(revisions.revision)).limit(1);
  return finalizeDossierRead(context, access, dossierJson({plan: row ? JSON.parse(row.plan) : EMPTY_PLAN, operation: row?.operationKey ?? null, occurredAt: row?.occurredAt ?? null, found: Boolean(row)}));
}
export async function POST(request: Request, route: Route) {
  if (!isSameOriginMutation(request)) return dossierJson({error:"Cross-site change rejected."},403);
  const context = await resolveDossierServerContext(request); if (isResponse(context)) return context;
  const access = await requireDossierAccess(context, (await route.params).dossierId, "read"); if (isResponse(access)) return access;
  if (!["owner","contributor"].includes(access.role)) return dossierJson({error:"Only case owners and contributors can change operational work."},403);
  const payload = await readJsonObject(request, 32_768);
  if (!payload) return dossierJson({error:"A work action is required."},400);
  let key: string, digest: string;
  try {
    key = boundedDossierText(payload.operationKey,"Operation key",8,120);
    if(key !== payload.operationKey || !Number.isSafeInteger(payload.expectedRevision) || Number(payload.expectedRevision)<0) throw new Error();
    const allowed = ["action","operationKey","expectedRevision",...(payload.action === "apply_workflow" ? ["templateId","templateVersion","anchor","assignee"] : payload.action === "update" ? ["id","item"] : ["item"])];
    if(Object.keys(payload).some(field=>!allowed.includes(field))) throw new Error();
    digest = await dossierSha256(canonicalDossierJson(payload));
  } catch { return dossierJson({error:"Invalid work action or revision."},400); }
  const findOriginal = async () => (await context.db.select().from(revisions).where(and(eq(revisions.dossierId,access.dossier.id),eq(revisions.actorRef,context.actor.actorId),eq(revisions.operationKey,key))).limit(1))[0];
  const reply = (row: typeof revisions.$inferSelect) => row.requestDigest === digest ? finalizeDossierRead(context,access,dossierJson({plan:JSON.parse(row.plan),operation:row.operationKey,occurredAt:row.occurredAt,found:true})) : dossierJson({error:"This key belongs to a different change."},409);
  const prior = await findOriginal(); if (prior) return reply(prior);
  const [latest] = await context.db.select().from(revisions).where(eq(revisions.dossierId,access.dossier.id)).orderBy(desc(revisions.revision)).limit(1);
  const plan: PracticePlan = latest ? JSON.parse(latest.plan) : EMPTY_PLAN;
  if(plan.revision !== payload.expectedRevision) return dossierJson({error:"The work plan changed. Refresh and compare before saving.",code:"revision_conflict"},409);
  let configured: WorkflowTemplate | undefined;
  let templateLibraryRevision: number | undefined;
  if (payload.action === "apply_workflow" && String(payload.templateId).startsWith("wf_")) {
    const [record] = await context.db.select().from(organizationWorkflowRevisions).where(eq(organizationWorkflowRevisions.organizationId,context.organization!.id)).orderBy(desc(organizationWorkflowRevisions.revision)).limit(1);
    const library = record ? readWorkflowLibrary(JSON.parse(record.library)) : null;
    configured = library?.templates.find(t=>t.id===payload.templateId);
    if (!configured || configured.archived || configured.version!==payload.templateVersion) return dossierJson({error:"Template changed or unavailable. Refresh templates and preview again."},409);
    templateLibraryRevision = library!.revision;
  } else if (payload.templateVersion!==undefined) return dossierJson({error:"Built-in templates do not accept a custom version."},400);
  let next: PracticePlan;
  try { next = changePracticePlan(plan,payload,()=>newDossierOpaqueId("work"),configured); }
  catch(error) { return dossierJson({error:error instanceof Error ? error.message : "Invalid work action."},400); }
  const participants = await context.db.select({id:dossierParticipants.id}).from(dossierParticipants).where(and(eq(dossierParticipants.dossierId,access.dossier.id),eq(dossierParticipants.status,"active")));
  const active = new Set(participants.map(p=>p.id));
  const assigned = payload.action === "apply_workflow" ? payload.assignee : (payload.item as Record<string,unknown>)?.assignee;
  if(assigned !== null && assigned !== undefined && (typeof assigned !== "string" || !active.has(assigned))) return dossierJson({error:"Choose an active participant in this case."},400);
  const row = {dossierId:access.dossier.id,revision:next.revision,actorRef:context.actor.actorId,operationKey:key,requestDigest:digest,plan:canonicalDossierJson(next),occurredAt:canonicalDossierTimestamp()};
  try { await context.db.batch([
    context.db.insert(organizationCasGuards).values({changed:assigned ? sql`CASE WHEN EXISTS (SELECT 1 FROM dossier_participants WHERE dossier_id=${access.dossier.id} AND id=${assigned} AND status='active') THEN 1 ELSE 0 END` : 1}),
    ...(templateLibraryRevision===undefined ? [] : [context.db.insert(organizationCasGuards).values({changed:sql`CASE WHEN (SELECT max(revision) FROM organization_workflow_revisions WHERE organization_id=${context.organization!.id})=${templateLibraryRevision} THEN 1 ELSE 0 END`})]),
    context.db.insert(revisions).values(row),
    context.db.delete(organizationCasGuards),
  ]); }
  catch { const original=await findOriginal(); if(original)return reply(original);return dossierJson({error:"The work plan or your access changed. Refresh before saving.",code:"revision_conflict"},409); }
  return reply(row);
}
