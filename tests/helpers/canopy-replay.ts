import assert from "node:assert/strict";
import { actionUseKey, decisionAvailability, metricGuardSatisfied } from "../../app/game-engine";
import { resolvePlayedCaseScenario, restoredPlayedCaseOutcome } from "../../app/played-case-loader";
import type { Scenario } from "../../app/types";
import type { CanopyTransport, Session } from "../../app/canopy-workflow";

export function replayConstraints(scenario:Scenario,session:Session) {
 const stage=scenario.stages.find(s=>s.id===session.state.currentStageId)!;
 return {stageId:stage.id,options:stage.options.map(option=>({optionId:option.id,nextStageId:option.nextStageId,
  available:decisionAvailability(option,session.state.metrics,session.state.actionUseCounts[actionUseKey(option)]??0).available,
  guards:(option.guards??[]).map(guard=>({...guard,actual:session.state.metrics[guard.metric],passed:metricGuardSatisfied(guard,session.state.metrics)}))}))};
}
export function playedCaseV2(scenario:Scenario,session:Session) {
 return {format:"genesis-juris-played-case",schemaVersion:2,exportedAt:new Date().toISOString(),
  scenario:{id:scenario.id,caseId:session.caseId,contentVersion:session.version,fingerprint:session.fingerprint},
  playthrough:{status:session.status==="active"?"in_progress":session.status,currentStageId:session.state.currentStageId,clockMinute:session.state.clockMinute,
   decisions:session.state.decisions,derivedMetrics:session.state.metrics,outcome:session.state.outcome}};
}
export async function replayRecordedCanopy(api:CanopyTransport,scenario:Scenario,original:Session,checkpoints:Session[]) {
 const file=playedCaseV2(scenario,original);
 const resolved=await resolvePlayedCaseScenario(file.scenario,[],api);
 assert.equal(resolved.scenario.fingerprint,scenario.fingerprint);
 await assert.rejects(resolvePlayedCaseScenario({...file.scenario,fingerprint:"sha256-"+"0".repeat(64)},[],api));
 const command=async(body:unknown)=>{
  const response=await api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  assert.equal(response.status,(body as {action:string}).action==="start"?201:200,await response.clone().text());return ((await response.json()) as {session:Session}).session;
 };
 // This is a fresh authoritative session, reconstructed from recorded decisions.
 let replay=await command({action:"start",caseId:file.scenario.caseId,version:file.scenario.contentVersion,fingerprint:file.scenario.fingerprint});
 const constraints:ReturnType<typeof replayConstraints>[]=[];
 assert.notEqual(replay.sessionKey,original.sessionKey);
 assert.deepEqual(replay.state,checkpoints[0].state);
 for(const decision of file.playthrough.decisions){
  assert.equal(replay.state.currentStageId,decision.stageId);
  const evaluated=replayConstraints(resolved.scenario,replay);
  assert.deepEqual(evaluated,replayConstraints(scenario,checkpoints[decision.sequence-1]));
  assert.ok(evaluated.options.some(option=>option.optionId===decision.optionId&&option.available));
  constraints.push(evaluated);
  replay=await command({action:"decision",sessionKey:replay.sessionKey,eventId:crypto.randomUUID(),expectedRevision:replay.revision,optionId:decision.optionId});
  assert.deepEqual(replay.state.decisions,original.state.decisions.slice(0,decision.sequence));
 }
 assert.equal(replay.status,original.status);assert.deepEqual(replay.state,original.state);
 const terminal=resolved.scenario.stages.find(s=>s.id===replay.state.currentStageId)!;
 const last=replay.state.decisions.at(-1)!;
 const lastOption=resolved.scenario.stages.find(s=>s.id===last.stageId)!.options.find(o=>o.id===last.optionId);
 assert.equal(restoredPlayedCaseOutcome(true,terminal,lastOption,"weak"),original.state.outcome,"Existing V2 import keeps the authoritative authored outcome");
 assert.equal(restoredPlayedCaseOutcome(false,terminal,lastOption,"strong"),null);
 assert.equal(restoredPlayedCaseOutcome(true,{...terminal,terminalOutcome:undefined},undefined,"strong"),"strong","Legacy metric fallback remains available");
 return {kind:"existing-v2-decisions-replayed-through-normal-api",file,replay,original,constraints,scope:"Pinned published inputs and ordered semantic decisions; not a reconstruction of hidden canonical seeds or full audit events."};
}
