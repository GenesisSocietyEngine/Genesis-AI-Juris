import { actionForFinding, type MatterAction, type MatterActionTarget } from "./matter-actions";
import type { MatterDetail, SnapshotItem, OutputItem, RequestItem, DocumentItem, ReadinessReason, DeadlineItem } from "./matter-view-model";
export type CaseAction = {key:string;caseId:string;title:string;reasons:ReadinessReason[];target:MatterActionTarget;owner:string|null;dueAt:string|null;priority:string|null;blocking:boolean;requiresReview:boolean};
export type ActionCollection = {availability:"current"|"outdated"|"unavailable";actions:CaseAction[];total:number};
export function historicalDeadlineEligible(deadline:Pick<DeadlineItem,"kind"|"status"|"dueAt">,evaluatedAt:string){
  return deadline.kind==="workspace"&&deadline.status==="open"&&Number.isFinite(Date.parse(deadline.dueAt??""))&&Date.parse(deadline.dueAt!)<Date.parse(evaluatedAt);
}
/** Canonical model, independent of rendering. All counts and filtered slices derive from these grouped actions. */
export function buildMatterActionCollection(matter:MatterDetail,snapshots:SnapshotItem[],outputs:OutputItem[],requests:RequestItem[]=[],documents:DocumentItem[]=[],evaluatedAt=matter.readiness.evaluatedAt??""):ActionCollection {
  const availability=!matter.readiness.dimensions.length||matter.readiness.computedFromRevision===null||!Number.isFinite(Date.parse(evaluatedAt))?"unavailable":matter.readiness.computedFromRevision!==matter.revision?"outdated":"current";
  const groups=new Map<string,CaseAction>();
  const add=(finding:ReadinessReason,blocking:boolean,mapped: MatterAction=actionForFinding(finding,snapshots,outputs,matter.revision))=>{
    const intent=finding.code==="DECISION_GRAPH_INVALID"?"repair_graph":["SIMULATION_FAILED","SIMULATION_REQUIRED"].includes(finding.code)?"complete_simulation":"resolve_record";
    const key=JSON.stringify([matter.id,intent,mapped.target.destination,mapped.target.id,mapped.target.requestId??null,mapped.target.packageRefId??null]);
    let item=groups.get(key);
    const request=finding.relatedObjectType==="information_request"?requests.find(r=>r.id===finding.relatedObjectId):undefined;
    const document=finding.relatedObjectType==="document"?documents.find(d=>d.id===finding.relatedObjectId):undefined;
    if(!item){item={key,caseId:matter.id,title:request?`Provide information: ${request.question}`:document?`Review document: ${document.title}`:mapped.title,reasons:[],target:mapped.target,owner:request?.requestedFrom??null,dueAt:request?.dueAt??null,priority:request?.priority??null,blocking:false,requiresReview:false};groups.set(key,item);}
    if(!item.reasons.some(r=>r.code===finding.code&&r.explanation===finding.explanation))item.reasons.push(finding);
    item.blocking ||= blocking;item.requiresReview ||= finding.code==="AI_PROPOSAL_PENDING"||/REVIEW|APPROVAL|CONTRADICTION|SOURCE/.test(finding.code);
  };
  for(const dimension of matter.readiness.dimensions)for(const finding of dimension.reasons)add(finding,dimension.state==="blocked");
  for(const a of matter.anchors.filter(a=>a.reviewState==="pending"||a.reviewState==="needs_review"))add({code:"CITATION_REVIEW_PENDING",explanation:a.excerpt||"Check the exact citation before accepting it.",relatedObjectType:"source_anchor",relatedObjectId:a.id,deepLink:null},false,{title:"Review the source citation",detail:a.excerpt||"Review this citation.",target:{destination:"evidence",id:`source-${a.id}`}});
  for(const a of matter.assertions.filter(a=>a.status==="needs_review"))add({code:"ASSERTION_REVIEW_PENDING",explanation:a.statement,relatedObjectType:"professional_assertion",relatedObjectId:a.id,deepLink:null},false,{title:"Review the professional assertion",detail:a.statement,target:{destination:"evidence",id:`assertion-${a.id}`}});
  const actions=[...groups.values()];
  const rank=(a:CaseAction)=>a.priority==="urgent"||(a.dueAt&&Date.parse(a.dueAt)<Date.parse(evaluatedAt))||a.reasons.some(r=>r.code.endsWith("OVERDUE"))?0:a.blocking?1:a.requiresReview?2:3;
  for(const action of actions)action.reasons.sort((a,b)=>(a.code+a.explanation).localeCompare(b.code+b.explanation));
  actions.sort((a,b)=>rank(a)-rank(b)||a.key.localeCompare(b.key));
  return {availability,actions,total:actions.length};
}
export type QueueState={organizationId:string;caseId:string;generation:number;filter:"all"|"blocking"|"review";showAll:boolean;selectedKey:string|null;scrollAnchor:string|null};
export function enterActionQueue(previous:QueueState|null,organizationId:string,caseId:string):QueueState {
  return previous?.organizationId===organizationId&&previous.caseId===caseId?previous:{organizationId,caseId,generation:(previous?.generation??0)+1,filter:"all",showAll:false,selectedKey:null,scrollAnchor:null};
}
export function visibleActions(collection:ActionCollection,state:QueueState){const filtered=collection.actions.filter(a=>state.filter==="all"||(state.filter==="blocking"?a.blocking:a.requiresReview));return {items:state.showAll?filtered:filtered.slice(0,6),filteredCount:filtered.length,total:collection.total,empty:collection.availability!=="current"?collection.availability:!collection.total?"complete":!filtered.length?"no_matches":null};}
export type ExactActionSelection={organizationId:string;caseId:string;generation:number;recordId:string;kind:"assertion"|"request";originActionKey:string;originOutputId?:string};
export async function resolveExactAction(selection:ExactActionSelection,read:(path:string)=>Promise<unknown>,isCurrent:()=>boolean):Promise<{status:"loaded";record:Record<string,unknown>;selection:ExactActionSelection}|{status:"superseded"|"unavailable"}> {
  const path=`/api/dossiers/${encodeURIComponent(selection.caseId)}/${selection.kind==="assertion"?"evidence/assertions?assertion_id=":"requests?request_id="}${encodeURIComponent(selection.recordId)}&organization=${encodeURIComponent(selection.organizationId)}`;
  try{
    const payload=await read(path);if(!isCurrent())return {status:"superseded"};
    const data=payload as Record<string,unknown>;const rows=data?.[selection.kind==="assertion"?"assertions":"requests"];
    if(!Array.isArray(rows)||rows.length!==1)return {status:"unavailable"};
    const record=rows[0] as Record<string,unknown>;if(record?.[selection.kind==="assertion"?"assertion_id":"information_request_id"]!==selection.recordId||record.dossier_id!==selection.caseId)return {status:"unavailable"};
    return {status:"loaded",record,selection};
  }catch{return {status:isCurrent()?"unavailable":"superseded"};}
}
