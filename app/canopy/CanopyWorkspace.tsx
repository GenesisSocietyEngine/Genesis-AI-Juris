"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildCanopyPackage, CANOPY_SCENARIOS, type CanopyScenarioId } from "../canopy-fixture";
import { CanopyWorkingCopy, type CanopyPublicationStatus, type CanopyTransport, type Session } from "../canopy-workflow";
import { actionUseKey, decisionAvailability } from "../game-engine";
import { organizationWorkspaceUrl, organizationScopedUrl, scopedOrganizationHeaders } from "../organization-client";
import type { LocalText } from "../types";
import styles from "./canopy.module.css";

const api:CanopyTransport=(path,init={})=>fetch(path,{...init,credentials:"same-origin",cache:"no-store",headers:{...scopedOrganizationHeaders(),...init.headers}});
type Proposal={proposal_id:string;proposal_type:string;review_state:string;proposed_value:{statement?:string}};
type Output={output_id:string;format:string;state:string;reviewer_actor_id:string|null;download_url:string};
type Detail={status:string;revision:number;readiness:unknown};
const local=(value:string|LocalText)=>typeof value==="string"?value:value.en;

export default function CanopyWorkspace({dossierId,initialScenario}:{dossierId:string;initialScenario:CanopyScenarioId}) {
 const [copy,setCopy]=useState<CanopyWorkingCopy|null>(null),[detail,setDetail]=useState<Detail|null>(null);
 const [scenarioId,setScenarioId]=useState(initialScenario),[session,setSession]=useState<Session|null>(null);
 const [publication,setPublication]=useState<CanopyPublicationStatus|null>(null);
 const [proposals,setProposals]=useState<Proposal[]>([]),[outputs,setOutputs]=useState<Output[]>([]);
 const [edits,setEdits]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const running=useRef(false);
 const prepared=copy?.package(scenarioId)??buildCanopyPackage(scenarioId);
 const refresh=useCallback(async()=>{
  setPublication(null);
  const restored=await CanopyWorkingCopy.resume(api,dossierId);
  const [overview,pending,generated,published]=await Promise.all([restored.get(),restored.get("proposals"),restored.get("outputs"),restored.publicationStatus()]);
  setCopy(restored);setScenarioId(restored.currentScenario);setDetail(overview.dossier as Detail);setProposals(pending.proposals as Proposal[]);setOutputs(generated.outputs as Output[]);setPublication(published);
  const url=new URL(window.location.href);const run=(url.searchParams.get("dossier")===dossierId?url.searchParams.get("run"):null)??restored.lastSessionKey;if(!run){setSession(null);return;}
  const response=await api("/api/play-sessions?sessionKey="+encodeURIComponent(run));
  if(response.ok){const stored=((await response.json()) as {session:Session}).session;const candidate=CANOPY_SCENARIOS.find(s=>restored.package(s.id).draft.version===stored.version&&restored.package(s.id).scenario.fingerprint===stored.fingerprint);if(candidate&&candidate.id===restored.currentScenario){setSession(stored);return;}}
  setSession(null);
 },[dossierId]);
 useEffect(()=>{let cancelled=false;void Promise.resolve().then(refresh).catch(e=>{if(!cancelled)setError(String(e));});return()=>{cancelled=true;};},[refresh]);
 async function act(fn:()=>Promise<unknown>){if(running.current)return;running.current=true;setBusy(true);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{running.current=false;setBusy(false);}}
 function remember(id:CanopyScenarioId,run?:string){const url=new URL(window.location.href);url.searchParams.set("dossier",dossierId);url.searchParams.set("scenario",id);if(run)url.searchParams.set("run",run);else url.searchParams.delete("run");window.history.replaceState(null,"",url);}
 if(!copy||!detail)return <section><p role="status">{error?"The copy could not be reopened. Use My cases to inspect it.":"Loading the private working copy…"}</p><details><summary>Verification details</summary><pre>{error}</pre></details></section>;
 const working=copy;
 const stage=session?prepared.scenario.stages.find(s=>s.id===session.state.currentStageId):undefined;
 const actual=session?.status==="completed"&&session.fingerprint===prepared.scenario.fingerprint;
 const next=working.independent?null:scenarioId==="base"?"upside":scenarioId==="upside"?"hard_stop":null;
 return <section aria-label="Executable Canopy working copy"><h2>Working copy · {prepared.declaration.label}</h2><p>Lifecycle: <strong>{detail.status}</strong>. Next action: review sources and pending proposals before a recorded run.</p>
  <p><Link href={organizationWorkspaceUrl("/matters?dossier="+encodeURIComponent(dossierId))}>Open Matter Overview, release questions and independent output review</Link></p>
  <button disabled={busy} onClick={()=>void act(refresh)}>Refresh authoritative state</button>
  <button disabled={busy} onClick={()=>void act(async()=>{await working.prepareScenario(scenarioId);await working.prepareDemoProposals(scenarioId,scenarioId==="base"||working.independent);await refresh();})}>Resume missing preparation</button>
  <details><summary>Readiness and verification details</summary><pre>{JSON.stringify({dossierId,revision:detail.revision,readiness:detail.readiness},null,2)}</pre></details>
  {error&&<><p role="alert" className={styles.issue}>The action did not complete. Refresh before retrying. A recorded session requires the exact published package and normal authorization.</p><details><summary>Verification details · error</summary><pre>{error}</pre></details></>}
  <h3>Exact sources and anchors</h3>{Object.entries(working.sources).map(([key,binding])=>{const [id,version]=key.split("@");return <div className={styles.reviewRow} key={key}><a href={"#"+id+"-v"+version}>{id} v{version} · source sections</a><span>{(binding.current?"Current version · ":"Historical version · ")+(binding.reviewed?"Accepted anchors":"Pending review")}</span><button disabled={busy||binding.reviewed} onClick={()=>void act(async()=>{await working.reviewSource(id,Number(version));await refresh();})}>Accept this source and its anchors</button><details><summary>Verification details · exact anchor IDs</summary><pre>{JSON.stringify(binding,null,2)}</pre></details></div>;})}
  <h3>Prepared demo proposals</h3><p>No live-model provenance. Accept, reject or edit each proposal explicitly.</p>{proposals.map(proposal=><details key={proposal.proposal_id} className={styles.reviewRow}><summary>{proposal.proposal_type} · {proposal.review_state} · {proposal.proposed_value.statement?.slice(0,90)}</summary><p>{proposal.proposed_value.statement}</p>{proposal.review_state==="pending"&&<><label>Edited statement<textarea value={edits[proposal.proposal_id]??proposal.proposed_value.statement??""} onChange={event=>setEdits({...edits,[proposal.proposal_id]:event.target.value})}/></label><div className={styles.tabs}><button disabled={busy} onClick={()=>void act(async()=>{await working.reviewProposal(proposal.proposal_id,"reject");await refresh();})}>Reject</button><button disabled={busy} onClick={()=>void act(async()=>{await working.reviewProposal(proposal.proposal_id,"accept");await refresh();})}>Accept</button><button disabled={busy||!edits[proposal.proposal_id]} onClick={()=>void act(async()=>{await working.reviewProposal(proposal.proposal_id,"edit_and_accept",edits[proposal.proposal_id]);await refresh();})}>Edit and accept</button></div></>}</details>)}
  <h3>Decision map and recorded run</h3><p>Import and review the exact draft in Decision Studio; use its ordinary compile/publication controls. An authorized publisher must publish the exact package before a recorded run. The private Matter remains private.</p>
  <p role="status">{publication===null?"Checking the published scenario…":publication.state==="ready"?"The matching scenario version is published. Complete the source and proposal reviews, then start the recorded run.":publication.state==="missing"?"Publish this scenario before starting a recorded run. Download its Studio draft below, import and review it in Decision Studio, then use the ordinary publication process. Return here and refresh after publication.":"The published version differs from this prepared scenario. Ask the publisher to reconcile the exact package before running; existing published versions must remain unchanged."}</p>
  <p><a download={scenarioId+".studio-draft.json"} href={"data:application/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(prepared.draft,null,2))}>Download exact Studio draft</a> · <Link href="/studio">Open Decision Studio</Link></p>
  <button disabled={busy||Boolean(session)||publication?.state!=="ready"} onClick={()=>void act(async()=>{const published=await working.publicationStatus(scenarioId);setPublication(published);if(published.state!=="ready")return;const run=new URL(window.location.href).searchParams.get("run")??crypto.randomUUID();remember(scenarioId,run);const started=await working.startRun(scenarioId,run);setSession(started.session);remember(scenarioId,started.session.sessionKey);})}>Start recorded session</button>
  {session&&<article className={styles.comparison}><p>{actual?"Actual outcome":"Run in progress"} · {actual?session.completedAt:session.startedAt}</p><h3>{stage?local(stage.headline):"Exact session stage unavailable"}</h3>{!actual&&stage?.options.map(option=>{const available=decisionAvailability(option,session.state.metrics,session.state.actionUseCounts[actionUseKey(option)]??0).available;return <p key={option.id}><button disabled={busy||!available} onClick={()=>void act(async()=>{setSession(await working.advanceRun(session,option.id));})}>{local(option.label)}</button>{!available&&<span> Unavailable under evaluated controls</span>}</p>;})}{actual&&<><p>{prepared.declaration.recommendation}</p><p>{prepared.declaration.changed}</p><button disabled={busy} onClick={()=>void act(async()=>{const run=await working.finishRun(scenarioId,session.sessionKey);await working.linkScenarioEvidence(scenarioId,run.packageRef);await refresh();})}>Link this completed run and controlling evidence</button></>}<details><summary>Verification details · actual session and evaluated controls</summary><pre>{JSON.stringify(session,null,2)}</pre></details></article>}
  <p>Resolve evidence-status questions in Matter Overview before sealing. Receiving an answer records the evidence status; it does not authorize production.</p>
  <button disabled={busy||!actual} onClick={()=>void act(async()=>{await working.seal();await refresh();})}>Seal snapshot and generate full PDF / JSON</button>
  {outputs.map(output=><p key={output.output_id}>{output.format} · {output.state} as of this read · {output.reviewer_actor_id?"exact-output approval recorded":"no approval"} · <a href={organizationScopedUrl(output.download_url)}>Open</a>{output.format==="json_manifest"&&<> · <a href={organizationScopedUrl("/api/dossiers/"+dossierId+"/outputs/"+output.output_id+"/presentation")}>Short presentation memo · not approved</a></>}</p>)}
  {next&&<p><button disabled={busy||working.lastScenario!==scenarioId} onClick={()=>void act(async()=>{await working.prepareUpdate(next);setScenarioId(next);setSession(null);remember(next);await refresh();})}>Prepare {next==="upside"?"Upside evidence update":"clearance failure update"}</button> Explicitly updates this copy and requires fresh review. Prior approved files stay immutable and may become stale. Downside uses a separate clean copy.</p>}
 </section>;
}
