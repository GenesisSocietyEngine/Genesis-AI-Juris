import assert from "node:assert/strict";
import test from "node:test";
import { beginWrite,CaseVisitEpoch,classifyWriteFailure,confirmWrite,recoveryState,retainChangedDraft,retryOriginalWrite } from "../app/matters/write-recovery";
import { buildMatterActionCollection,enterActionQueue,historicalDeadlineEligible,resolveExactAction,visibleActions } from "../app/matters/action-collection";
import { normalizeMatterDetail,type ReadinessReason } from "../app/matters/matter-view-model";
const scope={actorId:"actor_test",organizationId:"org_test",caseId:"dossier_test",recordId:"note_test",generation:1};
const draft={expectedRevision:4,title:"Original",body:"Input retained"};
test("uncertain save keeps immutable operation apart from a subsequently edited draft",()=>{
  const submitted=beginWrite(recoveryState(scope,draft),"operation-original");
  const unknown=classifyWriteFailure(submitted,scope,null);
  const edited=retainChangedDraft(unknown,{...draft,title:"Later draft"});
  assert.equal(JSON.parse(retryOriginalWrite(edited).body).title,"Original");
  assert.equal(edited.draft?.title,"Later draft");
  assert.throws(()=>beginWrite(edited,"operation-new"),/original operation/);
  const confirmed=confirmWrite(edited,scope,{caseId:scope.caseId,recordId:scope.recordId,operationKey:"operation-original",revision:5,eventId:"event_original"});
  assert.equal(confirmed.phase,"confirmed");assert.equal(confirmed.draft?.title,"Later draft");
  assert.equal(confirmWrite(edited,scope,{caseId:scope.caseId,recordId:"another",operationKey:"operation-original",revision:5,eventId:"event_original"}).phase,"unknown");
});
test("conflict requires current/proposed comparison and an explicit new operation",()=>{
  const submitted=beginWrite(recoveryState(scope,draft),"operation-original");
  const conflict=classifyWriteFailure(submitted,scope,409,{code:"revision_conflict",current:{revision:7,title:"Other person's edit"}});
  assert.equal(conflict.draft?.title,"Original");assert.equal(conflict.current?.title,"Other person's edit");
  assert.throws(()=>beginWrite(conflict,"operation-new"));
  const reviewed=retainChangedDraft(conflict,{...draft,expectedRevision:7});
  assert.throws(()=>beginWrite(reviewed,"operation-original",7),/new operation key/);
  assert.equal(beginWrite(reviewed,"operation-new",7).operation?.expectedRevision,7);
});
test("session expiry retains input in memory, validation identifies its field, and lost access clears private material",()=>{
  const submitted=beginWrite(recoveryState(scope,draft),"operation-original");
  const expired=classifyWriteFailure(submitted,scope,401);assert.deepEqual(expired.draft,draft);assert.equal(retryOriginalWrite(expired).key,"operation-original");
  assert.equal(classifyWriteFailure(submitted,scope,400,{field:"title"}).field,"title");
  for(const status of [403,404]){const denied=classifyWriteFailure(submitted,scope,status);assert.equal(denied.draft,null);assert.equal(denied.operation,null);assert.equal(denied.receipt,null);}
});
test("A to B to A generations discard earlier success, failure and cleanup",()=>{
  const visit=new CaseVisitEpoch(),a=visit.enter("org","A");assert.equal(visit.enter("org","A"),a);
  visit.enter("org","B");const laterA=visit.enter("org","A");assert.notEqual(a,laterA);assert.equal(visit.current(a),false);
  const state=beginWrite(recoveryState({...scope,generation:laterA},draft),"operation-current");
  assert.equal(classifyWriteFailure(state,{...scope,generation:a},404),state);
  assert.equal(confirmWrite(state,{...scope,generation:a},{caseId:scope.caseId,recordId:scope.recordId,operationKey:"operation-current",revision:5,eventId:"old"}),state);
});
const reason=(code:string,id:string):ReadinessReason=>({code,relatedObjectId:id,relatedObjectType:"information_request",explanation:code+" explanation",deepLink:null});
function matter(findings:ReadinessReason[]){return normalizeMatterDetail({dossier:{dossier_id:"dossier_test",title:"Synthetic queue",revision:4,readiness:{ready:false,computed_from_revision:4,evaluated_at:"2026-09-15T10:00:00Z",dimensions:[{dimension:"information",state:"blocked",reasons:findings}]}}})!;}
test("canonical collection retains all reasons, stable order and distinct same-control request identities",()=>{
  const reasons=[reason("INFORMATION_REQUEST_OPEN","request_one"),reason("INFORMATION_REQUEST_OVERDUE","request_one"),reason("INFORMATION_REQUEST_OPEN","request_two")];
  const m=matter(reasons);assert.ok(m);
  const collection=buildMatterActionCollection(m,[],[]);assert.equal(collection.total,2);assert.equal(collection.actions[0]!.target.requestId,"request_one");assert.equal(collection.actions[0]!.reasons.length,2);
  assert.deepEqual(buildMatterActionCollection(matter([...reasons].reverse()),[],[]),collection);
  const queue=enterActionQueue(null,"org","dossier_test");queue.showAll=true;queue.selectedKey=collection.actions[0]!.key;queue.scrollAnchor="selected";
  assert.equal(enterActionQueue(queue,"org","dossier_test"),queue);assert.notEqual(enterActionQueue(queue,"org_other","dossier_test").generation,queue.generation);
  const missing=buildMatterActionCollection({...m,readiness:{...m.readiness,computedFromRevision:null}},[],[]);assert.equal(visibleActions(missing,queue).empty,"unavailable");
  const stale=buildMatterActionCollection({...m,revision:5},[],[]);assert.equal(stale.availability,"outdated");
  queue.filter="review";assert.equal(visibleActions(collection,queue).empty,"no_matches");
  assert.equal(visibleActions(buildMatterActionCollection(matter([]),[],[]),queue).empty,"complete");
});
test("historical deadline eligibility matches server time and excludes simulated/future/closed dates",()=>{
  const deadline={kind:"workspace",status:"open",dueAt:"2020-01-01T12:00:00Z"};
  assert.equal(historicalDeadlineEligible(deadline,"2026-09-15T10:00:00Z"),true);
  for(const patch of [{kind:"projected"},{status:"completed"},{dueAt:"2027-01-01T00:00:00Z"},{dueAt:"invalid"},{dueAt:"2026-09-15T10:00:00Z"}])assert.equal(historicalDeadlineEligible({...deadline,...patch},"2026-09-15T10:00:00Z"),false);
});
test("exact target resolver rejects wrong records and discards late success and errors without losing origin",async()=>{
  const selection={organizationId:"org",caseId:"dossier_test",recordId:"assertion_exact",kind:"assertion" as const,generation:3,originActionKey:"original-report-action",originOutputId:"output_original"};
  const correct={assertions:[{assertion_id:selection.recordId,dossier_id:selection.caseId}]};
  const loaded=await resolveExactAction(selection,async path=>{assert.match(path,/assertion_id=assertion_exact&organization=org$/);return correct;},()=>true);
  assert.equal(loaded.status,"loaded");if(loaded.status==="loaded")assert.equal(loaded.selection.originOutputId,"output_original");
  assert.equal((await resolveExactAction(selection,async()=>({assertions:[{assertion_id:"different",dossier_id:selection.caseId}]}),()=>true)).status,"unavailable");
  for(const fail of [false,true]){let active=true,finish!:()=>void;const pending=resolveExactAction(selection,()=>new Promise((resolve,reject)=>{finish=()=>fail?reject(new Error("offline")):resolve(correct);}),()=>active);active=false;finish();assert.equal((await pending).status,"superseded");}
});


test("distinct package actions remain stable under reordered findings and pending AI proposals stay in review",()=>{
  const findings=[{...reason("DECISION_GRAPH_INVALID","package_test"),relatedObjectType:"decision_package"},{...reason("SIMULATION_REQUIRED","package_test"),relatedObjectType:"decision_package"},{...reason("AI_PROPOSAL_PENDING","proposal_test"),relatedObjectType:"ai_proposal"}];
  const collection=buildMatterActionCollection(matter(findings),[],[]);
  assert.deepEqual(buildMatterActionCollection(matter([...findings].reverse()),[],[]),collection);
  assert.equal(collection.total,3);
  const many=buildMatterActionCollection(matter(Array.from({length:8},(_,index)=>reason("INFORMATION_REQUEST_OPEN","request_"+index))),[],[]);
  const initialQueue=enterActionQueue(null,"org","dossier_test");assert.equal(visibleActions(many,initialQueue).items.length,6);assert.equal(visibleActions(many,initialQueue).total,8);initialQueue.showAll=true;assert.equal(visibleActions(many,initialQueue).items.length,8);

  const queue=enterActionQueue(null,"org","dossier_test");queue.filter="review";
  assert.ok(visibleActions(collection,queue).items.some(item=>item.target.id==="proposal-proposal_test"));
});
