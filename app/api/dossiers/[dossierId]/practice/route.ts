import { and, desc, eq, sql } from "drizzle-orm";
import { dossierPracticeRevisions as revisions, dossierParticipants, caseWorkflowMilestones, organizationCasGuards, organizationWorkflowRevisions } from "../../../../../db/schema";
import { canonicalDossierJson } from "../../../../dossier-contract";
import { boundedDossierText, canonicalDossierTimestamp, dossierJson, dossierSha256, finalizeDossierRead, isResponse, newDossierOpaqueId, requireDossierAccess, resolveDossierServerContext } from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";
import { changePracticePlan, parsePracticePlan, EMPTY_PLAN, PRACTICE_WORKFLOWS, type PracticePlan } from "../../../../matters/practice-plan";
import { readWorkflowLibrary, type WorkflowTemplate } from "../../../../work/workflow-templates";
import { terminal } from "../../../../casework/model";
import { caseSchedule, templateMilestones } from "../../../../work/workflow-milestone-store";
import { freezeSchedule, rescheduleWorkflow, type WorkflowSchedule } from "../../../../work/workflow-milestones";
export const dynamic = "force-dynamic";
type Route = {params: Promise<{dossierId:string}>};
export async function GET(request: Request, route: Route) {
  const context = await resolveDossierServerContext(request); if (isResponse(context)) return context;
  const access = await requireDossierAccess(context, (await route.params).dossierId, "read"); if (isResponse(access)) return access;
  const key = new URL(request.url).searchParams.get("operation");
  const [row] = await context.db.select().from(revisions).where(and(eq(revisions.dossierId, access.dossier.id), key ? eq(revisions.operationKey, key) : undefined, key ? eq(revisions.actorRef, context.actor.actorId) : undefined)).orderBy(desc(revisions.revision)).limit(1);
  const plan = row ? parsePracticePlan(JSON.parse(row.plan)) : EMPTY_PLAN;
  const workflow = new URL(request.url).searchParams.get("workflow");
  if (workflow !== null) {
    const schedule = await caseSchedule(context.db, access.dossier.id, plan, workflow);
    return finalizeDossierRead(context, access, schedule ? dossierJson({schedule, revision: plan.revision}) : dossierJson({error:"This workflow is unavailable in the selected case."},404));
  }
  return finalizeDossierRead(context, access, dossierJson({plan, canSchedule: context.organization!.role !== "auditor" && !terminal(access.dossier.status) && ["owner","contributor"].includes(access.role), operation: row?.operationKey ?? null, occurredAt: row?.occurredAt ?? null, found: Boolean(row)}));
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
    const allowed = ["action","operationKey","expectedRevision",...(payload.action === "apply_workflow" ? ["templateId","templateVersion","anchor","milestones","assignee"] : payload.action === "reschedule_workflow" ? ["workflow","milestones"] : payload.action === "update" ? ["id","item"] : payload.action === "create_series" ? ["item","recurrence"] : payload.action === "reminder" ? ["id","reminderAction"] : ["item"])];
    if(Object.keys(payload).some(field=>!allowed.includes(field))) throw new Error();
    digest = await dossierSha256(canonicalDossierJson(payload));
  } catch { return dossierJson({error:"Invalid work action or revision."},400); }
  const findOriginal = async () => (await context.db.select().from(revisions).where(and(eq(revisions.dossierId,access.dossier.id),eq(revisions.actorRef,context.actor.actorId),eq(revisions.operationKey,key))).limit(1))[0];
  const reply = (row: typeof revisions.$inferSelect) => row.requestDigest === digest ? finalizeDossierRead(context,access,dossierJson({plan:JSON.parse(row.plan),operation:row.operationKey,occurredAt:row.occurredAt,found:true})) : dossierJson({error:"This key belongs to a different change."},409);
  const prior = await findOriginal(); if (prior) return reply(prior);
  const scheduling = payload.action === "apply_workflow" || payload.action === "reschedule_workflow";
  if (scheduling && (context.organization!.role === "auditor" || terminal(access.dossier.status)))
    return dossierJson({error:"This case is read-only for workflow scheduling."},403);
  const [latest] = await context.db.select().from(revisions).where(eq(revisions.dossierId,access.dossier.id)).orderBy(desc(revisions.revision)).limit(1);
  const plan: PracticePlan = latest ? parsePracticePlan(JSON.parse(latest.plan)) : EMPTY_PLAN;
  if(plan.revision !== payload.expectedRevision) return dossierJson({error:"The work plan changed. Refresh and compare before saving.",code:"revision_conflict"},409);
  let configured: WorkflowTemplate | undefined;
  let templateLibraryRevision: number | undefined;
  if (payload.action === "apply_workflow" && String(payload.templateId).startsWith("wf_")) {
    const [record] = await context.db.select().from(organizationWorkflowRevisions).where(eq(organizationWorkflowRevisions.organizationId,context.organization!.id)).orderBy(desc(organizationWorkflowRevisions.revision)).limit(1);
    const library = record ? readWorkflowLibrary(JSON.parse(record.library)) : null;
    const versions = library && await templateMilestones(context.db, context.organization!.id, library);
    configured = library && versions ? readWorkflowLibrary(library, versions).templates.find(t=>t.id===payload.templateId) : undefined;
    if (!configured || configured.archived || configured.version!==payload.templateVersion) return dossierJson({error:"Template changed or unavailable. Refresh templates and preview again."},409);
    templateLibraryRevision = library!.revision;
  } else if (payload.templateVersion!==undefined) return dossierJson({error:"Built-in templates do not accept a custom version."},400);
  let next: PracticePlan;
  let schedule: WorkflowSchedule | undefined;
  try {
    if (payload.action === "reschedule_workflow") {
      const previous = await caseSchedule(context.db, access.dossier.id, plan, payload.workflow);
      if (!previous) return dossierJson({error:"Choose an applied workflow in this case."},400);
      const change = rescheduleWorkflow(plan, previous, payload.milestones);
      next = change.plan;
      schedule = change.schedule;
    } else {
      next = changePracticePlan(plan,payload,()=>newDossierOpaqueId("work"),configured);
      if (payload.action === "apply_workflow") {
        const template = configured ?? PRACTICE_WORKFLOWS.find(t => t.id === payload.templateId)!;
        schedule = freezeSchedule(next.items.slice(plan.items.length), template.steps, payload.milestones ?? payload.anchor);
      }
    }
  }
  catch(error) { return dossierJson({error:error instanceof Error ? error.message : "Invalid work action."},400); }
  const participants = await context.db.select({id:dossierParticipants.id}).from(dossierParticipants).where(and(eq(dossierParticipants.dossierId,access.dossier.id),eq(dossierParticipants.status,"active")));
  const active = new Set(participants.map(p=>p.id));
  const assigned = payload.action === "apply_workflow" ? payload.assignee : (payload.item as Record<string,unknown>)?.assignee;
  if(assigned !== null && assigned !== undefined && (typeof assigned !== "string" || !active.has(assigned))) return dossierJson({error:"Choose an active participant in this case."},400);
  const row = {dossierId:access.dossier.id,revision:next.revision,actorRef:context.actor.actorId,operationKey:key,requestDigest:digest,plan:canonicalDossierJson(next),occurredAt:canonicalDossierTimestamp()};
  try { await context.db.batch([
    context.db.insert(organizationCasGuards).values({changed:assigned ? sql`CASE WHEN EXISTS (SELECT 1 FROM dossier_participants WHERE dossier_id=${access.dossier.id} AND id=${assigned} AND status='active') THEN 1 ELSE 0 END` : 1}),
    ...(templateLibraryRevision===undefined ? [] : [context.db.insert(organizationCasGuards).values({changed:sql`CASE WHEN (SELECT max(revision) FROM organization_workflow_revisions WHERE organization_id=${context.organization!.id})=${templateLibraryRevision} THEN 1 ELSE 0 END`})]),
    ...(scheduling ? [context.db.insert(organizationCasGuards).values({changed:sql`CASE WHEN EXISTS (SELECT 1 FROM dossiers WHERE id=${access.dossier.id} AND status NOT IN ('closed','archived','declined','cancelled')) THEN 1 ELSE 0 END`})] : []),
    context.db.insert(revisions).values(row),
    ...(schedule ? [context.db.insert(caseWorkflowMilestones).values({dossierId:row.dossierId, revision:row.revision, workflow:schedule.workflow, schedule:canonicalDossierJson(schedule)})] : []),
    context.db.delete(organizationCasGuards),
  ]); }
  catch { const original=await findOriginal(); if(original)return reply(original);return dossierJson({error:"The work plan or your access changed. Refresh before saving.",code:"revision_conflict"},409); }
  return reply(row);
}
