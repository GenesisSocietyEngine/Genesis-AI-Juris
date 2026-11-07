import { and, desc, eq, sql } from "drizzle-orm";
import { organizationWorkRevisions as revisions, organizationMemberships, organizationCasGuards, users } from "../../../../db/schema";
import { canonicalDossierJson } from "../../../dossier-contract";
import { boundedDossierText, canonicalDossierTimestamp, dossierJson, dossierSha256, isResponse, newDossierOpaqueId, revalidateDossierIdentity, resolveDossierServerContext } from "../../../dossier-server";
import { assertOrganizationCurrent, organizationSelectionToken } from "../../../organization-store";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";
import { changePracticePlan, EMPTY_PLAN, parsePracticePlan } from "../../../matters/practice-plan";

export const dynamic = "force-dynamic";
type Context = Exclude<Awaited<ReturnType<typeof resolveDossierServerContext>>, Response>;
async function finish(context: Context, data: unknown) {
  const identity=await revalidateDossierIdentity(context); if(identity)return identity;
  try { await assertOrganizationCurrent(context.db,context.actor,context.organization!); }
  catch { return dossierJson({error:"Organization access changed."},404); }
  return dossierJson(data);
}
export async function GET(request: Request) {
  const context=await resolveDossierServerContext(request);if(isResponse(context))return context;
  const org=context.organization!;
  const [row]=await context.db.select().from(revisions).where(eq(revisions.organizationId,org.id)).orderBy(desc(revisions.revision)).limit(1);
  const members=await context.db.select({id:organizationMemberships.actorId,name:users.displayName}).from(organizationMemberships).innerJoin(users,eq(users.id,organizationMemberships.userId)).where(and(eq(organizationMemberships.organizationId,org.id),eq(organizationMemberships.status,"active")));
  return finish(context,{scope:organizationSelectionToken(org),plan:row?parsePracticePlan(JSON.parse(row.plan)):EMPTY_PLAN,members,canWrite:org.role!=="auditor"});
}
export async function POST(request: Request) {
  if(!isSameOriginMutation(request))return dossierJson({error:"Cross-site change rejected."},403);
  const context=await resolveDossierServerContext(request);if(isResponse(context))return context;
  const org=context.organization!;
  if(org.role==="auditor")return dossierJson({error:"Auditors cannot change firm work."},403);
  const command=await readJsonObject(request,32768);
  let key:string,digest:string;
  try {
    if(!command||!["create","update","create_series","reminder"].includes(String(command.action)))throw Error();
    const allowed=["action","operationKey","expectedRevision",...(command.action==="update"?["id","item"]:command.action==="reminder"?["id","reminderAction"]:command.action==="create_series"?["item","recurrence"]:["item"])];
    if(Object.keys(command).some(k=>!allowed.includes(k))||!Number.isSafeInteger(command.expectedRevision)||Number(command.expectedRevision)<0)throw Error();
    key=boundedDossierText(command.operationKey,"Operation key",8,120);if(key!==command.operationKey)throw Error();
    digest=await dossierSha256(canonicalDossierJson(command));
  } catch { return dossierJson({error:"Invalid firm work action."},400); }
  const original=async()=>(await context.db.select().from(revisions).where(and(eq(revisions.organizationId,org.id),eq(revisions.actorRef,context.actor.actorId),eq(revisions.operationKey,key))).limit(1))[0];
  const reply=(row:typeof revisions.$inferSelect)=>row.requestDigest===digest?finish(context,{plan:parsePracticePlan(JSON.parse(row.plan)),operation:row.operationKey}):dossierJson({error:"This operation belongs to another change."},409);
  const prior=await original();if(prior)return reply(prior);
  const [latest]=await context.db.select().from(revisions).where(eq(revisions.organizationId,org.id)).orderBy(desc(revisions.revision)).limit(1);
  const plan=latest?parsePracticePlan(JSON.parse(latest.plan)):EMPTY_PLAN;
  if(plan.revision!==command!.expectedRevision)return dossierJson({error:"Firm work changed. Refresh and compare before saving."},409);
  let next;
  try { next=changePracticePlan(plan,command!,()=>newDossierOpaqueId("firm_work")); }
  catch(error){return dossierJson({error:error instanceof Error?error.message:"Invalid work."},400);}
  const assigned=(command!.item as Record<string,unknown>|undefined)?.assignee;
  const row={organizationId:org.id,revision:next.revision,actorRef:context.actor.actorId,operationKey:key,requestDigest:digest,plan:canonicalDossierJson(next),occurredAt:canonicalDossierTimestamp()};
  try { await context.db.batch([
    context.db.insert(organizationCasGuards).values({changed:assigned?sql`CASE WHEN EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id=${org.id} AND actor_id=${assigned} AND status='active') THEN 1 ELSE 0 END`:1}),
    context.db.insert(revisions).values(row),context.db.delete(organizationCasGuards),
  ]); } catch {const saved=await original();if(saved)return reply(saved);return dossierJson({error:"Work or membership changed. Refresh and compare."},409);}
  return reply(row);
}
