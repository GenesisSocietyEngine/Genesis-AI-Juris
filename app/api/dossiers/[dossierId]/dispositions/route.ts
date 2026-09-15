import { and, eq } from "drizzle-orm";
import { dossierDeadlineDispositions, dossierSourceAnchorRetirements, dossierDeadlineReferences, dossierSourceAnchors, dossierDocumentCurrentVersions, dossierAssertionSources, dossierProfessionalAssertions, dossiers, dossierAuditEvents, dossierRevisionReceipts } from "../../../../../db/schema";
import { boundedDossierText, canonicalDossierTimestamp, dossierEnum, dossierJson, dossierNotFound, dossierSha256, expectedDossierRevision, isResponse, newDossierOpaqueId, prepareDossierRevisionAuditBatch, requireDossierAccess, resolveDossierServerContext } from "../../../../dossier-server";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import { canonicalDossierJson } from "../../../../dossier-contract";
import { computeStoredDossierReadiness } from "../../../../dossier-readiness-server";
import { evidenceOutputAuditInputs, evidenceOutputStateStatements, loadCurrentEvidenceOutputs } from "../../../../dossier-evidence-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ dossierId: string }> };
const kinds = ["deadline", "citation"] as const;
const conflict = (revision?: number) => dossierJson({ error: "This case changed. Refresh the record, review the current state, then confirm again. Your entered reason can be retained.", code: "revision_conflict", current_revision: revision }, 409);

export async function GET(request: Request, route: RouteContext) {
 const context = await resolveDossierServerContext(request); if(isResponse(context)) return context;
 const access = await requireDossierAccess(context,(await route.params).dossierId,"read"); if(isResponse(access)) return access;
 const url=new URL(request.url); let kind: typeof kinds[number], id: string;
 try { kind=dossierEnum(url.searchParams.get("kind"),kinds,"disposition kind"); id=parseDossierOpaqueId(url.searchParams.get("id"),"record ID"); } catch { return dossierNotFound(); }
 const table=kind==="deadline"?dossierDeadlineReferences:dossierSourceAnchors;
 const [record]=await context.db.select().from(table).where(and(eq(table.dossierId,access.dossier.id),eq(table.id,id))).limit(1);
 if(!record)return dossierNotFound();
 const receiptTable=kind==="deadline"?dossierDeadlineDispositions:dossierSourceAnchorRetirements;
 const target=kind==="deadline"?dossierDeadlineDispositions.deadlineReferenceId:dossierSourceAnchorRetirements.sourceAnchorId;
 const [disposition]=await context.db.select().from(receiptTable).where(and(eq(receiptTable.dossierId,access.dossier.id),eq(target,id))).limit(1);
 const operationKey=url.searchParams.get("operation_key");
 if(operationKey!==null){
  if(url.searchParams.getAll("operation_key").length!==1)return dossierNotFound();
  try{if(boundedDossierText(operationKey,"Operation key",8,120)!==operationKey)return dossierNotFound();}catch{return dossierNotFound();}
  if(!disposition||disposition.actorRef!==context.actor.actorId||disposition.idempotencyKey!==operationKey)return dossierNotFound();
  return dossierJson({disposition,replayed:true,audit_event_id:disposition.auditEventId,dossier:{dossier_id:access.dossier.id,revision:disposition.revisionAfter}});
 }
 const dependencies=kind==="citation"?await context.db.select({id:dossierProfessionalAssertions.id,status:dossierProfessionalAssertions.status,statement:dossierProfessionalAssertions.statement}).from(dossierAssertionSources).innerJoin(dossierProfessionalAssertions,and(eq(dossierProfessionalAssertions.dossierId,dossierAssertionSources.dossierId),eq(dossierProfessionalAssertions.id,dossierAssertionSources.assertionId))).where(and(eq(dossierAssertionSources.dossierId,access.dossier.id),eq(dossierAssertionSources.sourceAnchorId,id))):[];
 const outputs=await loadCurrentEvidenceOutputs(context,access.dossier.id);
 if(!outputs.ok)return dossierJson({error:"Review the output register before confirming this outcome."},409);
 let unavailable:string|null=null;
 if(kind==="deadline"&&"deadlineKind" in record){
  if(record.deadlineKind!=="workspace")unavailable="This date belongs to a simulation. Open its decision package and review the simulation.";
  else if(record.status!=="open")unavailable="This deadline already has a recorded outcome.";
  else if(Date.parse(record.dueAt)>=Date.now())unavailable="This deadline is still current. Record a historical outcome after its due date; use the key deadline control for current case planning.";
 }
 if(kind==="citation"&&"documentId" in record){const [current]=await context.db.select().from(dossierDocumentCurrentVersions).where(and(eq(dossierDocumentCurrentVersions.dossierId,access.dossier.id),eq(dossierDocumentCurrentVersions.documentId,record.documentId))).limit(1);
 if(record.reviewState!=="accepted"||!current||current.documentVersionId===record.documentVersionId)unavailable="Retirement requires an accepted citation to an older source version. Review current evidence first.";}

 return dossierJson({actor_id:context.actor.actorId,kind,record,disposition:disposition??null,dependent_assertions:dependencies,current_output_ids:outputs.current.map(o=>o.outputId),revision:access.dossier.revision,
 can_review:access.role!=="viewer"&&!unavailable, unavailable_reason:unavailable, readiness_effect:kind==="deadline"?"Closes this historical deadline only. The key case deadline is unchanged; a missing key deadline or other incomplete work can still block readiness. Current reports must be regenerated.":"Retires this citation for current use. Every assertion that relies on it still needs explicit review or supersession; choosing replacement evidence does not automatically support an assertion. Current reports become outdated."});
}

export async function POST(request: Request, route: RouteContext) {
 if(!isSameOriginMutation(request))return dossierJson({error:"Use this case's review form to submit the change."},403);
 const context=await resolveDossierServerContext(request); if(isResponse(context))return context;
 const access=await requireDossierAccess(context,(await route.params).dossierId,"requests"); if(isResponse(access))return access;
 const payload=await readJsonObject(request); if(!payload)return dossierJson({error:"A review disposition is required."},400);
 let kind:typeof kinds[number],id:string,reason:string,key:string,expected:number,status:string|null,support:string|null;
 try{reason=boundedDossierText(payload.reason,"Reason",5,2000);}catch{return dossierJson({error:"Explain the reason in 5–2000 characters.",code:"validation",field:"reason"},400);}
 try {
  const allowed=new Set(["kind","recordId","reason","idempotencyKey","expectedRevision","status","supportingSourceAnchorId","replacementSourceAnchorId"]);
  if(Object.keys(payload).some(k=>!allowed.has(k)))throw new Error("Unexpected disposition field.");
  kind=dossierEnum(payload.kind,kinds,"disposition kind");id=parseDossierOpaqueId(payload.recordId,"record ID");
  key=boundedDossierText(payload.idempotencyKey,"Request identity",8,120);if(key!==payload.idempotencyKey)throw new Error("Use the original operation key without whitespace.");expected=expectedDossierRevision(payload.expectedRevision);
  status=kind==="deadline"?dossierEnum(payload.status,["completed","waived","cancelled"] as const,"deadline outcome"):null;
  const supplied=kind==="deadline"?payload.supportingSourceAnchorId:payload.replacementSourceAnchorId;
  support=supplied?parseDossierOpaqueId(supplied,"supporting citation"):null;
 }catch(error){return dossierJson({error:error instanceof Error?error.message:"Invalid disposition."},400);}
 const table=kind==="deadline"?dossierDeadlineDispositions:dossierSourceAnchorRetirements;
 const digest=await dossierSha256(canonicalDossierJson({kind,id,reason,status,support,expected}));
 const previous=async()=>{const [row]=await context.db.select().from(table).where(and(eq(table.dossierId,access.dossier.id),eq(table.actorRef,context.actor.actorId),eq(table.idempotencyKey,key))).limit(1);return row;};
 const respond=async(receipt:typeof dossierDeadlineDispositions.$inferSelect|typeof dossierSourceAnchorRetirements.$inferSelect,replayed=false)=>dossierJson({disposition:receipt,replayed,audit_event_id:receipt.auditEventId,dossier:{dossier_id:access.dossier.id,revision:receipt.revisionAfter},message:"Review outcome saved. Refresh the action queue to see current readiness."});
 const existing=await previous();if(existing)return existing.requestDigest===digest?respond(existing,true):dossierJson({error:"This operation key belongs to a different proposal. Resolve the original save before submitting changed input.",code:"operation_key_conflict"},409);
 if(expected!==access.dossier.revision)return conflict(access.dossier.revision);
 const now=canonicalDossierTimestamp(),next=expected+1;
 const [deadline]=kind==="deadline"?await context.db.select().from(dossierDeadlineReferences).where(and(eq(dossierDeadlineReferences.dossierId,access.dossier.id),eq(dossierDeadlineReferences.id,id))).limit(1):[];
 const [anchor]=kind==="citation"?await context.db.select().from(dossierSourceAnchors).where(and(eq(dossierSourceAnchors.dossierId,access.dossier.id),eq(dossierSourceAnchors.id,id))).limit(1):[];
 if(kind==="deadline"&&(!deadline||deadline.deadlineKind!=="workspace"||deadline.status!=="open"||Date.parse(deadline.dueAt)>=Date.parse(now)))return dossierJson({error:"Select an open historical workspace deadline. Projected simulation dates must be resolved in their simulation.",code:"deadline_not_disposable"},409);
 if(kind==="citation"){
  if(!anchor||anchor.reviewState!=="accepted")return dossierNotFound();
  const [current]=await context.db.select().from(dossierDocumentCurrentVersions).where(and(eq(dossierDocumentCurrentVersions.dossierId,access.dossier.id),eq(dossierDocumentCurrentVersions.documentId,anchor.documentId))).limit(1);
  if(!current||current.documentVersionId===anchor.documentVersionId)return dossierJson({error:"Only an accepted citation to an older source version can be retired here."},409);
 }
 if(support){
  const [valid]=await context.db.select({id:dossierSourceAnchors.id}).from(dossierSourceAnchors).innerJoin(dossierDocumentCurrentVersions,and(eq(dossierDocumentCurrentVersions.dossierId,dossierSourceAnchors.dossierId),eq(dossierDocumentCurrentVersions.documentVersionId,dossierSourceAnchors.documentVersionId))).where(and(eq(dossierSourceAnchors.dossierId,access.dossier.id),eq(dossierSourceAnchors.id,support),eq(dossierSourceAnchors.reviewState,"accepted"))).limit(1);
  const [retired]=await context.db.select().from(dossierSourceAnchorRetirements).where(and(eq(dossierSourceAnchorRetirements.dossierId,access.dossier.id),eq(dossierSourceAnchorRetirements.sourceAnchorId,support))).limit(1);
  if(!valid||retired||(kind==="citation"&&support===id))return dossierJson({error:"Choose an accepted citation from the current source version in this case."},400);
 }
 const states=await loadCurrentEvidenceOutputs(context,access.dossier.id);if(!states.ok)return dossierJson({error:"The output register requires review before this mutation."},409);
 const dispositionId=newDossierOpaqueId("disposition");
 const dependencies=kind==="citation"?await context.db.select({assertionId:dossierAssertionSources.assertionId}).from(dossierAssertionSources).where(and(eq(dossierAssertionSources.dossierId,access.dossier.id),eq(dossierAssertionSources.sourceAnchorId,id))):[];
 const detail={action_schema_version:1,action:kind==="deadline"?"dispose_historical_deadline":"retire",disposition_id:dispositionId,reason,revision_before:expected,revision_after:next,...(deadline?{deadline_reference_id:id,previous_status:"open",new_status:status,supporting_source_anchor_id:support,original_due_at:deadline.dueAt,original_timezone:deadline.timezone}:{source_anchor_id:id,replacement_source_anchor_id:support,original_acceptance:{reviewer_actor_id:anchor!.reviewerActorRef,reviewed_at:anchor!.reviewedAt},affected_assertion_ids:dependencies.map(a=>a.assertionId),affected_current_output_ids:states.current.map(o=>o.outputId)})};
 const staleReason=kind==="citation"?"SOURCE_ANCHOR_CHANGED":"DEADLINE_DISPOSED";
 const {revisionReceipt,auditEvents}=await prepareDossierRevisionAuditBatch(context,access.dossier.id,next,[{actorRole:access.role,eventType:kind==="deadline"?"dossier_updated":"source_anchor_reviewed",objectRefType:kind==="deadline"?"dossier":"source_anchor",objectRefId:kind==="deadline"?access.dossier.id:id,summaryCode:kind==="deadline"?"HISTORICAL_DEADLINE_DISPOSED":"SOURCE_ANCHOR_RETIRED",detail,occurredAt:now},...evidenceOutputAuditInputs(states.current,access.role,staleReason,next,now)]);
 const common={id:dispositionId,dossierId:access.dossier.id,reason,actorUserId:context.actor.userId,actorRef:context.actor.actorId,actorRole:access.role,occurredAt:now,revisionBefore:expected,revisionAfter:next,idempotencyKey:key,requestDigest:digest,auditEventId:auditEvents[0]!.id};
 try{
  await context.db.batch([
   context.db.update(dossiers).set({revision:next,updatedAt:now,updatedByActorRef:context.actor.actorId}).where(and(eq(dossiers.id,access.dossier.id),eq(dossiers.revision,expected))),
   ...(kind==="deadline"?[context.db.insert(dossierDeadlineDispositions).values({...common,deadlineReferenceId:id,newStatus:status!,supportingSourceAnchorId:support}),context.db.update(dossierDeadlineReferences).set({status:status!,updatedAt:now,updatedByActorRef:context.actor.actorId}).where(and(eq(dossierDeadlineReferences.dossierId,access.dossier.id),eq(dossierDeadlineReferences.id,id),eq(dossierDeadlineReferences.status,"open")))]:[context.db.insert(dossierSourceAnchorRetirements).values({...common,sourceAnchorId:id,replacementSourceAnchorId:support})]),
   ...evidenceOutputStateStatements(context,access.dossier.id,states.current,staleReason,now),...auditEvents.map(e=>context.db.insert(dossierAuditEvents).values(e)),context.db.insert(dossierRevisionReceipts).values(revisionReceipt)
  ]);
 }catch{const duplicate=await previous();return duplicate?.requestDigest===digest?respond(duplicate,true):conflict();}
 const readiness=await computeStoredDossierReadiness({db:context.db,dossierId:access.dossier.id,dossierRevision:next,keyDeadlineAt:access.dossier.keyDeadlineAt,evaluatedAt:now});
 return dossierJson({disposition:await previous(),audit_event_id:common.auditEventId,dossier:{dossier_id:access.dossier.id,revision:next,readiness},message:"Review outcome saved. Current outputs require regeneration."});
}
