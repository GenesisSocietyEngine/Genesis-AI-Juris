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
export type ExactActionSelection = {
  organizationId: string; caseId: string; generation: number; recordId: string;
  kind: "assertion" | "request" | "anchor"; originActionKey: string;
  originOutputId?: string; originSnapshotId?: string;
};
export type ExactActionFailure = {
  purpose: "exact_record";
  kind: "session_expired" | "resource_denied" | "not_found" | "server_error" | "network_error" | "invalid_response" | "request_error";
  httpStatus: number | null;
  recovery: "sign_in" | "check_case_access" | "retry_read" | "return_to_origin";
};
export type ExactActionResult =
  | { status: "loaded"; record: Record<string, unknown>; selection: ExactActionSelection }
  | { status: "superseded"; selection: ExactActionSelection }
  | { status: "unavailable"; selection: ExactActionSelection; failure: ExactActionFailure };

function exactRecordFailure(error: unknown): ExactActionFailure {
  const status = error !== null && typeof error === "object" && "status" in error
    && typeof error.status === "number" && Number.isInteger(error.status)
    && error.status >= 400 && error.status <= 599 ? error.status : null;
  const base = { purpose: "exact_record" as const, httpStatus: status };
  if (status === 401) return { ...base, kind: "session_expired", recovery: "sign_in" };
  // A record read is not a current-case authority check. Remove the prohibited
  // resource and resolve case authority before deciding what else must clear.
  if (status === 403) return { ...base, kind: "resource_denied", recovery: "check_case_access" };
  if (status === 404) return { ...base, kind: "not_found", recovery: "return_to_origin" };
  if (status !== null && status >= 500) return { ...base, kind: "server_error", recovery: "retry_read" };
  if (status === null) return { ...base, kind: "network_error", recovery: "retry_read" };
  return { ...base, kind: "request_error", recovery: "return_to_origin" };
}

/** These reads locate a record; they neither confirm nor replay a mutation.
 * Retain the captured origin on every result, including rejected late replies.
 * Consumers must ignore superseded results rather than restore their context. */
export async function resolveExactAction(
  selection: ExactActionSelection,
  read: (path: string) => Promise<unknown>,
  isCurrent: () => boolean,
): Promise<ExactActionResult> {
  const captured = { ...selection };
  const superseded = (): ExactActionResult => ({ status: "superseded", selection: captured });
  if (!isCurrent()) return superseded();
  const path = `/api/dossiers/${encodeURIComponent(captured.caseId)}/${captured.kind === "assertion" ? "evidence/assertions?assertion_id=" : captured.kind === "anchor" ? "evidence/anchors?anchor_id=" : "requests?request_id="}${encodeURIComponent(captured.recordId)}&organization=${encodeURIComponent(captured.organizationId)}`;
  try {
    const payload = await read(path);
    if (!isCurrent()) return superseded();
    const data = payload as Record<string, unknown> | null;
    const rows = data?.[captured.kind === "assertion" ? "assertions" : captured.kind === "anchor" ? "source_anchors" : "requests"];
    const record = Array.isArray(rows) && rows.length === 1 ? rows[0] as Record<string, unknown> | null : null;
    if (!record || record[captured.kind === "assertion" ? "assertion_id" : captured.kind === "anchor" ? "source_anchor_id" : "information_request_id"] !== captured.recordId || record.dossier_id !== captured.caseId) {
      return { status: "unavailable", selection: captured, failure: {
        purpose: "exact_record", kind: "invalid_response", httpStatus: null, recovery: "retry_read",
      } };
    }
    return { status: "loaded", record, selection: captured };
  } catch (error) {
    return isCurrent()
      ? { status: "unavailable", selection: captured, failure: exactRecordFailure(error) }
      : superseded();
  }
}
