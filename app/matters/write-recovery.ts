/** Recovery contract shared by case writes. Drafts are deliberately memory-only:
 * confidential drafts must not be copied into URLs or browser storage. */
export type WritePhase = "editing" | "submitting" | "unknown" | "session_expired" | "conflict" | "validation" | "confirmed" | "permission_denied";
export type WriteScope = {actorId:string;organizationId:string;caseId:string;recordId:string;generation:number};
export type WriteOperation = Readonly<{key:string;body:string;expectedRevision:number;scope:Readonly<WriteScope>}>;
export type WriteReceipt = {caseId:string;recordId:string;operationKey:string;revision:number;eventId:string};
export type RecoveryState = {scope:WriteScope;draft:Record<string,unknown>|null;operation:WriteOperation|null;phase:WritePhase;receipt:WriteReceipt|null;field:string|null;current:Record<string,unknown>|null};
export const sameWriteScope = (a:WriteScope,b:WriteScope) => a.actorId===b.actorId&&a.organizationId===b.organizationId&&a.caseId===b.caseId&&a.recordId===b.recordId&&a.generation===b.generation;
export function recoveryState(scope:WriteScope,draft:Record<string,unknown>):RecoveryState {
  return {scope:{...scope},draft:structuredClone(draft),operation:null,phase:"editing",receipt:null,field:null,current:null};
}
export function retainChangedDraft(state:RecoveryState,draft:Record<string,unknown>):RecoveryState {
  return state.phase==="permission_denied"?state:{...state,draft:structuredClone(draft)};
}
/** Explicit new submission only. Unknown outcomes and expired sessions must first reconcile the original operation. */
export function beginWrite(state:RecoveryState,key:string,reviewedCurrentRevision?:number):RecoveryState {
  if(!state.draft||["submitting","unknown","session_expired","permission_denied"].includes(state.phase))throw new Error("Resolve the original operation before starting another save.");
  const expected=state.draft.expectedRevision;
  if(typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<0)throw new Error("A valid expected revision is required.");
  if(state.phase==="conflict"&&(reviewedCurrentRevision!==state.current?.revision||expected!==reviewedCurrentRevision))throw new Error("Compare the current record and explicitly accept its revision before resubmitting.");
  if(state.operation?.key===key)throw new Error("A new proposal requires a new operation key.");
  const operation=Object.freeze({key,body:JSON.stringify({...structuredClone(state.draft),idempotencyKey:key}),expectedRevision:expected,scope:Object.freeze({...state.scope})});
  return {...state,operation,phase:"submitting",receipt:null,field:null};
}
export function retryOriginalWrite(state:RecoveryState):WriteOperation {
  if(!state.operation||!["unknown","session_expired"].includes(state.phase))throw new Error("There is no uncertain original write to reconcile.");
  return state.operation; // Exact immutable bytes; never rebuild using a subsequently edited draft.
}
export function classifyWriteFailure(state:RecoveryState,scope:WriteScope,status:number|null,payload:{code?:string;field?:string;current?:Record<string,unknown>}={}):RecoveryState {
  if(!sameWriteScope(state.scope,scope))return state;
  if(status===404||status===403)return {...state,draft:null,operation:null,receipt:null,current:null,field:null,phase:"permission_denied"};
  if(status===401)return {...state,phase:"session_expired"};
  if(status===400)return {...state,phase:"validation",field:payload.field??null};
  if(status===409&&payload.code==="revision_conflict"&&payload.current)return {...state,phase:"conflict",current:structuredClone(payload.current)};
  return {...state,phase:"unknown"};
}
export function confirmWrite(state:RecoveryState,scope:WriteScope,receipt:WriteReceipt):RecoveryState {
  if(!sameWriteScope(state.scope,scope))return state;
  const op=state.operation;
  if(!op||receipt.caseId!==scope.caseId||receipt.recordId!==scope.recordId||receipt.operationKey!==op.key||receipt.revision!==op.expectedRevision+1||!receipt.eventId)return {...state,phase:"unknown"};
  return {...state,phase:"confirmed",receipt}; // Retained changed draft is intentionally separate from the confirmed snapshot.
}

/** Each visit, including A→B→A, has its own epoch. Capture it before a read/write;
 * check it for success, failure and cleanup, not merely matching the case ID. */
export class CaseVisitEpoch {
  private value=0;
  private identity="";
  enter(organizationId:string,caseId:string){const identity=JSON.stringify([organizationId,caseId]);if(identity!==this.identity){this.identity=identity;this.value++;}return this.value;}
  invalidate(){return ++this.value;}
  current(epoch:number){return epoch===this.value;}
}
