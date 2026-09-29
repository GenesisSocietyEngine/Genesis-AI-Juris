import { CANOPY_DISCLOSURE, CANOPY_SCENARIOS, CANOPY_SOURCES, CANOPY_TITLE, buildCanopyPackage, canopyEdgeEvidence, canopySource, canopySourceText, type CanopyScenarioId } from "./canopy-fixture";
import { decisionAvailability } from "./game-engine";
import { canonicalFingerprint } from "./case-integrity";
import type { MetricKey } from "./types";

/** The caller supplies its normal authenticated, organization-scoped transport.
 * This module has no DB, session, environment, deletion or privileged reset access. */
export type CanopyTransport = (path: string, init?: RequestInit) => Promise<Response>;
export type CanopyPublicationStatus = {
 state: "ready" | "missing" | "mismatch";
 caseId: string;
 version: string;
};
type Wire = Record<string, unknown>;
type SourceBinding = { documentId: string; versionId: string; anchors: Record<string,string>; anchorStates:Record<string,string>; reviewed: boolean; current:boolean; documentAccepted:boolean };
export class CanopyWorkingCopy {
 revision=1;
 readonly sources:Record<string,SourceBinding>={};
 readonly acceptedAssertions:string[]=[];
 readonly pendingProposals:string[]=[];
 readonly scenarioProposals=new Map<string,CanopyScenarioId>();
 readonly reviewedScenarios=new Set<CanopyScenarioId>();
 readonly openingRequests:Record<string,string>={};
 lastScenario:CanopyScenarioId|null=null;
 currentScenario:CanopyScenarioId="base";
 independent=false;
 lastSessionKey:string|null=null;
 private preparationCache:Map<string,string>|null=null;
 package(id:CanopyScenarioId=this.currentScenario){return buildCanopyPackage(id,this.independent);}
 /** Read the pinned version, not merely the catalogue's latest version. This is
  * UI guidance only: starting a run still requires the server's normal checks.
  * Never publish or replace a package as a side effect of a readiness check. */
 async publicationStatus(id:CanopyScenarioId=this.currentScenario):Promise<CanopyPublicationStatus> {
  const prepared=this.package(id);
  const identity={caseId:prepared.draft.caseId,version:prepared.draft.version};
  const response=await this.api("/api/catalog/"+encodeURIComponent(identity.caseId)+"?version="+encodeURIComponent(identity.version),{
   cache:"no-store",headers:{"X-GENESIS-Expected-Fingerprint":prepared.scenario.fingerprint},
  });
  if(response.status===404)return {...identity,state:"missing"};
  const published=await checked(response);
  return {...identity,state:published.caseId===identity.caseId&&published.currentVersion===identity.version&&published.fingerprint===prepared.scenario.fingerprint?"ready":"mismatch"};
 }
 constructor(readonly api:CanopyTransport, readonly dossierId:string) {}
 static async resume(api:CanopyTransport,dossierId:string) {
  const copy=new CanopyWorkingCopy(api,dossierId);
  const [detail,documents,proposals,packages]=await Promise.all([copy.get(),copy.get("documents"),copy.get("proposals"),copy.get("decision-packages")]);
  const dossier=detail.dossier as {title:string;revision:number;source_anchors:Array<{source_anchor_id:string;document_version_id:string;section:string;review_state:string}>;assertions:Array<{assertion_id:string;statement:string;status:string}>};
  const standalone=CANOPY_SCENARIOS.find(s=>dossier.title===CANOPY_TITLE+" · "+s.label+" copy");
  if(standalone){copy.independent=true;copy.currentScenario=standalone.id;}
  for(const ref of packages.decision_packages as Array<{package_id:string;package_version:string;package_fingerprint:string}>){
   const linked=CANOPY_SCENARIOS.find(s=>{const p=buildCanopyPackage(s.id,true);return s.id!=="base"&&ref.package_id===p.draft.caseId&&ref.package_version===p.draft.version&&ref.package_fingerprint===p.scenario.fingerprint;});
   if(linked){copy.independent=true;copy.currentScenario=linked.id;break;}
  }
  copy.revision=dossier.revision;
  for(const document of documents.documents as Array<{document_id:string;current_version_id:string;status:string;versions:Array<{document_version_id:string;original_filename:string;content_sha256:string}>}>){
   for(const version of document.versions){
    const match=/^(D\d\d)-v(\d+)\.md$/u.exec(version.original_filename);if(!match)continue;
    const source=canopySource(match[1],Number(match[2]));
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canopySourceText(source)));
    const expected="sha256-"+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
    if(version.content_sha256!==expected)throw new Error("The retained source bytes differ from this immutable fixture version. Review the Matter directly.");
    const anchors=dossier.source_anchors.filter(anchor=>anchor.document_version_id===version.document_version_id);
    copy.sources[match[1]+"@"+match[2]]={documentId:document.document_id,versionId:version.document_version_id,current:document.current_version_id===version.document_version_id,documentAccepted:document.status==="accepted_source",anchors:Object.fromEntries(anchors.map(a=>[a.section,a.source_anchor_id])),anchorStates:Object.fromEntries(anchors.map(a=>[a.source_anchor_id,a.review_state])),reviewed:document.status==="accepted_source"&&anchors.length===Object.keys(source.sections).length&&anchors.every(a=>a.review_state==="accepted")};
   }
  }
  for(const assertion of dossier.assertions.filter(a=>a.status==="accepted"&&["Canopy memo / ","Canopy pinned inputs / ","Source-backed fact / ","Policy threshold / "].some(prefix=>a.statement.startsWith(prefix))))copy.acceptedAssertions.push(assertion.assertion_id);
  for(const proposal of proposals.proposals as Array<{proposal_id:string;review_state:string;proposed_value:{statement?:string}}>){
   if(proposal.review_state==="pending")copy.pendingProposals.push(proposal.proposal_id);
   for(const scenario of CANOPY_SCENARIOS)if(proposal.proposed_value.statement===scenarioStatement(scenario.id))copy.scenarioProposals.set(proposal.proposal_id,scenario.id);
  }
  for(const scenario of CANOPY_SCENARIOS)if(dossier.assertions.some(a=>a.status==="accepted"&&a.statement===scenarioStatement(scenario.id)))copy.reviewedScenarios.add(scenario.id);
  for(const ref of packages.decision_packages as Array<{state:string;package_version:string;package_fingerprint:string;simulation_run_references:string[]}>){
   const scenario=CANOPY_SCENARIOS.find(s=>{const p=copy.package(s.id);return p.draft.version===ref.package_version&&p.scenario.fingerprint===ref.package_fingerprint;});
   if(ref.state==="current"&&scenario){copy.lastScenario=scenario.id;copy.currentScenario=scenario.id;copy.lastSessionKey=ref.simulation_run_references[0]??null;break;}
  }
  if(!copy.independent){
   if(copy.sources["D06@3"]?.current)copy.currentScenario="hard_stop";
   else if(copy.sources["D03@2"]?.current)copy.currentScenario="upside";
  }
  const acceptedScenario=CANOPY_SCENARIOS.find(s=>dossier.assertions.some(a=>a.status==="accepted"&&a.statement===scenarioStatement(s.id)));
  if(acceptedScenario)copy.currentScenario=acceptedScenario.id;
  const pendingScenario=(proposals.proposals as Array<{review_state:string;proposed_value:{statement?:string}}>).filter(p=>p.review_state==="pending").map(p=>CANOPY_SCENARIOS.find(s=>p.proposed_value.statement===scenarioStatement(s.id))).find(Boolean);
  if(pendingScenario)copy.currentScenario=pendingScenario.id;
  return copy;
 }
 static async create(api:CanopyTransport,onCreated?:(dossierId:string)=>void,scenarioId:CanopyScenarioId="base") {
  const response=await api("/api/dossiers",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:scenarioId==="base"?CANOPY_TITLE:CANOPY_TITLE+" · "+buildCanopyPackage(scenarioId).declaration.label+" copy",jurisdictions:["Fictional Gulf market"],classification:"internal",
   keyDeadlineAt:new Date(Date.now()+10*86400000).toISOString(),keyDeadlineTimezone:"UTC"})});
  const payload=await checked(response);
  const dossier=payload.dossier as {dossier_id:string};
  const copy=new CanopyWorkingCopy(api,dossier.dossier_id);
  copy.independent=scenarioId!=="base";copy.currentScenario=scenarioId;
  onCreated?.(copy.dossierId);
  for(const source of CANOPY_SOURCES.filter(s=>s.version===1)) await copy.upload(source.id,source.version);
  for(const [key,question] of Object.entries({demand:"Mara Vale: document current signed demand, the 450-pack minimum and any scope gap.",commissioning:"Inez Reed: document the current independent commissioning/clearance status and any unresolved release conditions.",leadership:"Noah Wren: document current transition-leader/team availability and any unresolved appointment conditions."})){
   const request=await copy.mutate("requests",{action:"create",question,reason:"Evidence-status question for reporting. Receiving an answer does not approve production or close a recorded release condition.",priority:"high"});
   copy.openingRequests[key]=(request.request as {information_request_id:string}).information_request_id;
  }
  for(const status of ["intake_review","active","internal_review"]) await copy.mutate("transitions",{newStatus:status,reason:"Synthetic demonstration: evidence remains under explicit human review."});
  return copy;
 }
 async prepareScenario(id:CanopyScenarioId) {
  if(this.independent&&id!==this.currentScenario)throw new Error("An independent scenario copy keeps its pinned inputs. Create another copy for another scenario.");
  const declaration=buildCanopyPackage(id).declaration;
  if(!this.independent&&id!==this.currentScenario&&this.lastScenario!==declaration.parent)throw new Error("Complete and link the preceding scenario before preparing this update.");
  if(declaration.d06>2&&!this.sources["D06@2"]){if(!this.sources["D06@1"])await this.upload("D06",1);await this.upload("D06",2);}
  for(const [document,version] of [...CANOPY_SOURCES.filter(s=>s.version===1).map(s=>[s.id,s.version] as const),["D03",declaration.d03],["D06",declaration.d06],["D08",declaration.d08],["D07",2]] as const){
   if(!this.sources[document+"@"+version])await this.upload(document,version);
   else await this.ensureAnchors(document,version);
  }
  this.currentScenario=id;
  const requests=(await this.get("requests")).requests as Array<{information_request_id:string;question:string}>;
  for(const [key,question] of Object.entries({demand:"Mara Vale: document current signed demand, the 450-pack minimum and any scope gap.",commissioning:"Inez Reed: document the current independent commissioning/clearance status and any unresolved release conditions.",leadership:"Noah Wren: document current transition-leader/team availability and any unresolved appointment conditions."})){
   const existing=requests.find(r=>r.question===question);
   if(existing)this.openingRequests[key]=existing.information_request_id;
   else{const result=await this.mutate("requests",{action:"create",question,reason:"Evidence-status question for reporting; does not authorize production.",priority:"high"});this.openingRequests[key]=(result.request as {information_request_id:string}).information_request_id;}
  }
  const status=((await this.get()).dossier as {status:string}).status;
  const stages=["draft","intake_review","active","internal_review"];
  const index=stages.indexOf(status);
  if(index>=0)for(const next of stages.slice(index+1))await this.mutate("transitions",{newStatus:next,reason:"Resume synthetic preparation; reviews and production conditions remain explicit."});
 }
 async get(suffix="") {return checked(await this.api("/api/dossiers/"+this.dossierId+(suffix?"/"+suffix:"")));}
 async mutate(suffix:string,body:Wire) {
  const result=await checked(await this.api("/api/dossiers/"+this.dossierId+"/"+suffix,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,expectedRevision:this.revision})}));
  this.revision=(result.dossier as {revision?:number}|undefined)?.revision ?? result.dossier_revision as number ?? this.revision;
  return result;
 }
 async upload(id:string,version:number) {
  this.reviewedScenarios.clear();
  const source=canopySource(id,version);
  const text=canopySourceText(source);
  const previous=Object.entries(this.sources).find(([key])=>key.startsWith(id+"@"))?.[1];
  const form=new FormData();
  form.set("file",new File([text],id+"-v"+version+".md",{type:"text/markdown"}));
  form.set("title",id+" — "+canopySource(id,1).title);form.set("documentType","correspondence");form.set("classification","internal");
  form.set("privacyAcknowledged","true");form.set("expectedRevision",String(this.revision));form.set("mediaType","text/markdown");
  if(previous)form.set("documentId",previous.documentId);
  const result=await checked(await this.api("/api/dossiers/"+this.dossierId+"/documents",{method:"POST",body:form}));
  this.revision=result.dossier_revision as number;
  const stored=result.version as {document_version_id:string};
  for(const source of Object.values(this.sources))if(source.documentId===result.document_id)source.current=false;
  const binding:SourceBinding={documentId:result.document_id as string,versionId:stored.document_version_id,anchors:{},anchorStates:{},reviewed:false,current:true,documentAccepted:previous?.documentAccepted??false};
  this.sources[id+"@"+version]=binding;
  await this.ensureAnchors(id,version);
  return binding;
 }
 async ensureAnchors(id:string,version:number) {
  const source=canopySource(id,version),binding=this.source(id,version);
  for(const [section,excerpt] of Object.entries(source.sections)){
   if(binding.anchors[section])continue;
   const anchor=await this.mutate("evidence/anchors",{action:"create",documentId:binding.documentId,documentVersionId:binding.versionId,
    section,paragraph:"1",excerpt});
   binding.anchors[section]=(anchor.source_anchor as {source_anchor_id:string}).source_anchor_id;
   binding.anchorStates[binding.anchors[section]]="pending";
  }
 }
 async reviewSource(id:string,version:number) {
  const binding=this.source(id,version);
  if(binding.reviewed)return;
  await this.ensureAnchors(id,version);
  const documentAlreadyReviewed=Object.values(this.sources).some(source=>source.documentId===binding.documentId&&source.documentAccepted);
  if(!documentAlreadyReviewed)await this.mutate("documents/"+binding.documentId+"/review",{decision:"accepted_source"});
  for(const source of Object.values(this.sources))if(source.documentId===binding.documentId)source.documentAccepted=true;
  for(const anchor of Object.values(binding.anchors))if(binding.anchorStates[anchor]!=="accepted"){
   if(binding.anchorStates[anchor]!=="pending")throw new Error("Rejected source anchors require a new reviewed source version.");
   await this.mutate("evidence/anchors",{action:"review",sourceAnchorId:anchor,decision:"accepted"});binding.anchorStates[anchor]="accepted";
  }
  binding.reviewed=true;
 }
 source(id:string,version:number){const source=this.sources[id+"@"+version];if(!source)throw new Error("Source is not in this working copy");return source;}
 async propose(statement:string,refs:Array<{id:string;version:number;section:string}>,proposalType="fact") {
  const retained=this.preparationCache?.get(statement);if(retained)return retained;
  const result=await this.mutate("proposals",{action:"create",proposalType,proposedValue:{statement},
   sourceDocumentVersionIds:[...new Set(refs.map(r=>this.source(r.id,r.version).versionId))],
   sourceAnchorIds:refs.map(r=>this.source(r.id,r.version).anchors[r.section])});
  const id=(result.proposal as {proposal_id:string}).proposal_id;
  this.pendingProposals.push(id);this.preparationCache?.set(statement,id);return id;
 }
 async reviewProposal(proposalId:string,decision:"accept"|"reject"|"edit_and_accept",editedStatement?:string){
  if(decision==="edit_and_accept"&&!editedStatement)throw new Error("Explicit edited statement required");
  const result=await this.mutate("proposals",{action:decision,proposalId,reviewNote:"Explicit review of prepared synthetic proposal fixture; no live model provenance.",
   ...(editedStatement?{editedValue:{statement:editedStatement}}:{})});
  const proposal=result.proposal as {accepted_object_id?:string};
  if(proposal.accepted_object_id)this.acceptedAssertions.push(proposal.accepted_object_id);
  const scenario=this.scenarioProposals.get(proposalId);
  if(scenario&&decision==="accept")this.reviewedScenarios.add(scenario);
  const pendingIndex=this.pendingProposals.indexOf(proposalId);
  if(pendingIndex>=0)this.pendingProposals.splice(pendingIndex,1);
  return result;
 }
 async supersedeAssertions(){
  for(const assertionId of this.acceptedAssertions)await this.mutate("evidence/assertions",{action:"supersede",assertionId});
  this.acceptedAssertions.length=0;
  this.reviewedScenarios.clear();
 }
 async prepareUpdate(id:CanopyScenarioId){
  if(this.independent||this.lastScenario!==this.package(id).declaration.parent)throw new Error("Complete and link the preceding scenario before preparing this update.");
  if(this.currentScenario!==id)await this.supersedeAssertions();
  await this.prepareScenario(id);await this.prepareDemoProposals(id,false);
 }
 /** Resume only missing preparation. Rejected proposals are never resurrected. */
 async prepareDemoProposals(id:CanopyScenarioId,includeExercise=true){
  const [detail,result]=await Promise.all([this.get(),this.get("proposals")]);
  const assertions=(detail.dossier as {assertions:Array<{assertion_id:string;status:string}>}).assertions;
  const proposals=result.proposals as Array<{proposal_id:string;review_state:string;accepted_object_id:string|null;proposed_value:{statement?:string}}>;
  this.preparationCache=new Map(proposals.filter(p=>p.review_state==="pending"||p.review_state==="rejected"||(p.review_state==="accepted"&&assertions.some(a=>a.assertion_id===p.accepted_object_id&&a.status==="accepted"))).filter(p=>p.proposed_value.statement).map(p=>[p.proposed_value.statement!,p.proposal_id]));
  try{
   const declaration=this.package(id).declaration;
   if(includeExercise){
    await this.propose("Treat all 600 indicated packs as signed demand.",[{id:"D03",version:declaration.d03,section:"Demand"}]);
    await this.propose("Demand and capacity are identical.",[{id:"D03",version:declaration.d03,section:"Demand"},{id:"D04",version:1,section:"Capacity"}]);
   }
   await this.proposeScenario(id);await this.proposeMemorandum(id);
  }finally{this.preparationCache=null;}
 }
 async proposeScenario(id:CanopyScenarioId){
  const {declaration}=buildCanopyPackage(id);
  const proposalId=await this.propose(scenarioStatement(id),
   declaration.controls.map(c=>({id:c.document,version:c.version,section:c.section})),"assumption");
  this.scenarioProposals.set(proposalId,id);return proposalId;
 }
 async proposeMemorandum(id:CanopyScenarioId){
  const {declaration}=buildCanopyPackage(id);
  const fields:Array<{heading:string;statement:string;refs:Array<{id:string;version:number;section:string}>}>=[
   {heading:"Decision requested",statement:CANOPY_TITLE+". "+canopySource("D01",1).sections.Mandate,refs:[{id:"D01",version:1,section:"Mandate"}]},
   {heading:"Scope and evidence limitation",statement:"Source-backed baseline: "+declaration.inputs.sourceBaselineSignedPacksPerWeek+" signed packs/week. "+(id==="downside"?"Scenario assumption: demand stressed to 300 packs/week to test retention; the 480-pack source baseline is unchanged. ":"")+"Maximum evidenced capacity: 480 packs/week. This is a scope bound, not permission to operate. Additional 120 indicated packs remain excluded.",refs:[{id:"D03",version:declaration.d03,section:"Demand"},{id:"D04",version:1,section:"Capacity"},...(id==="downside"?[{id:"D07",version:2,section:"Downside"}]:[])]},
   {heading:"Conditions and no-go rule",statement:canopySource("D01",1).sections.Safety+" "+canopySource("D01",1).sections.Thresholds,refs:[{id:"D01",version:1,section:"Safety"},{id:"D01",version:1,section:"Thresholds"}]},
   {heading:"Accountable owners and review dates",statement:canopySource("D08",declaration.d08).sections.Reviews,refs:[{id:"D08",version:declaration.d08,section:"Reviews"}]},
   {heading:"Alternatives and exit",statement:canopySource("D01",1).sections.Alternatives+" "+canopySource("D02",1).sections.Exit,refs:[{id:"D01",version:1,section:"Alternatives"},{id:"D02",version:1,section:"Exit"}]},
   {heading:"Assumptions and economics",statement:canopySource("D07",2).sections[declaration.id.startsWith("hard_stop")?"HardStop":declaration.label]+" "+canopySource("D07",2).sections.Underwriting,refs:[{id:"D07",version:2,section:declaration.id.startsWith("hard_stop")?"HardStop":declaration.label},{id:"D07",version:2,section:"Underwriting"}]}
  ];
  const proposals:string[]=[];
  for(const field of fields)proposals.push(await this.propose("Canopy memo / "+field.heading+": "+field.statement,field.refs,"assumption"));
  proposals.push(await this.propose("Canopy pinned inputs / "+canonicalFingerprint(declaration.inputs)+": "+JSON.stringify(declaration.inputs),declaration.controls.map(c=>({id:c.document,version:c.version,section:c.section})),"assumption"));
  for(const [document,version,section] of [["D03",declaration.d03,"Demand"],["D06",declaration.d06,"Clearance"],["D08",declaration.d08,"Leadership"]] as const){
   const sourceText=canopySource(document,version).sections[section];
   const fact=version===1&&document==="D06"?sourceText.split(" Hard-stop")[0]:version===1&&document==="D08"?sourceText.split(" Upside")[0]:sourceText;
   proposals.push(await this.propose("Source-backed fact / "+document+" v"+version+" § "+section+": "+fact,[{id:document,version,section}],"fact"));
  }
  proposals.push(await this.propose("Policy threshold / "+canopySource("D01",1).sections.Thresholds,[{id:"D01",version:1,section:"Thresholds"}],"authority_rule"));
  return proposals;
 }
 async validateReviewedInputs(id:CanopyScenarioId) {
  if(!this.reviewedScenarios.has(id))throw new Error("Explicit acceptance of this prepared scenario declaration is required");
  const prepared=this.package(id);
  for(const ref of prepared.declaration.controls)if(!this.source(ref.document,ref.version).reviewed)throw new Error("Explicit source review required before scenario replay");
  if(this.pendingProposals.length)throw new Error("Review every prepared proposal before replay");
  const current=(await this.get()).dossier as {assertions:Array<{statement:string;status:string;source_anchor_ids:string[]}>};
  const inputStatement="Canopy pinned inputs / "+canonicalFingerprint(prepared.declaration.inputs)+": "+JSON.stringify(prepared.declaration.inputs);
  const requiredAnchors=prepared.declaration.controls.map(ref=>this.source(ref.document,ref.version).anchors[ref.section]);
  if(!current.assertions.some(a=>a.status==="accepted"&&a.statement===inputStatement&&requiredAnchors.every(anchor=>a.source_anchor_ids.includes(anchor))))throw new Error("Accept the exact source-bound pinned input proposal before running");
  const live=await CanopyWorkingCopy.resume(this.api,this.dossierId);
  for(const ref of prepared.declaration.controls){const source=live.source(ref.document,ref.version);if(!source.current||!source.reviewed)throw new Error("Current accepted source versions and anchors are required");}
  if(live.pendingProposals.length||!live.reviewedScenarios.has(id))throw new Error("Current explicit proposal review is required");
  return prepared;
 }
 async startRun(id:CanopyScenarioId,sessionKey=crypto.randomUUID()) {
  const prepared=await this.validateReviewedInputs(id);
  if(this.lastScenario!==null&&this.lastScenario!==id&&this.lastScenario!==prepared.declaration.parent)throw new Error("Use Base → Upside → Hard stop, or create an independent pinned scenario copy. Downside is separate.");
  const session=(await checked(await this.api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"start",sessionKey,caseId:prepared.draft.caseId,version:prepared.draft.version,fingerprint:prepared.scenario.fingerprint})}))).session as Session;
  return {prepared,session};
 }
 async advanceRun(session:Session,optionId:string) {
  return (await checked(await this.api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"decision",sessionKey:session.sessionKey,eventId:crypto.randomUUID(),expectedRevision:session.revision,optionId})}))).session as Session;
 }
 async finishRun(id:CanopyScenarioId,sessionKey:string) {
  const prepared=await this.validateReviewedInputs(id);
  const session=(await checked(await this.api("/api/play-sessions?sessionKey="+encodeURIComponent(sessionKey)))).session as Session;
  if(session.caseId!==prepared.scenario.caseId||session.version!==prepared.scenario.version||session.fingerprint!==prepared.scenario.fingerprint)throw new Error("Recorded session is bound to another package");
  if(session.status!=="completed")throw new Error("A completed authoritative session is required");
  const packages=(await this.get("decision-packages")).decision_packages as Array<{package_id:string;package_version:string;package_fingerprint:string;simulation_run_references:string[]}>;
  const prior=packages.find(p=>p.package_id===prepared.draft.caseId&&p.package_version===prepared.draft.version&&p.package_fingerprint===prepared.scenario.fingerprint);
  const linked=await this.mutate("decision-packages",{packageId:prepared.draft.caseId,packageVersion:prepared.draft.version,packageFingerprint:prepared.scenario.fingerprint,simulationReceiptIds:[...new Set([...(prior?.simulation_run_references??[]),session.sessionKey])]});
  const packageRef=(linked.decision_package as {decision_package_reference_id:string})?.decision_package_reference_id;
  this.lastScenario=id;
  return {prepared,session,packageRef,linked};
 }
 /** Automated fixture runner. The user interface uses start/advance explicitly. */
 async run(id:CanopyScenarioId) {
  const started=await this.startRun(id);const prepared=started.prepared;let session=started.session;
  for(let step=0;session.status==="active"&&step<30;step++){
   const stage=prepared.scenario.stages.find(s=>s.id===session.state.currentStageId);
   const available=stage?.options.filter(o=>decisionAvailability(o,session.state.metrics,0).available);
   if(available?.length!==1)throw new Error("Prepared graph must have exactly one available reviewed route");
   session=await this.advanceRun(session,available[0].id);
  }
  if(session.status!=="completed"||session.state.currentStageId!=="studio-"+prepared.declaration.terminal)throw new Error("Actual simulation result does not match the reviewed fixture");
  return this.finishRun(id,session.sessionKey);
 }
 async seal() {
  if(this.lastScenario!==this.currentScenario)throw new Error("Link the completed current scenario before sealing");
  await this.validateReviewedInputs(this.currentScenario);
  const snapshot=await this.mutate("snapshots",{locale:"en",audience:"internal",redactionProfileId:"pilot-default"});
  const snapshotId=(snapshot.snapshot as {snapshot_id:string}).snapshot_id;
  const pdf=await this.mutate("outputs",{action:"generate",snapshotId,format:"pdf"});
  const json=await this.mutate("outputs",{action:"generate",snapshotId,format:"json_manifest"});
  return {snapshotId,pdfOutputId:(pdf.output as {output_id:string}).output_id,jsonOutputId:(json.output as {output_id:string}).output_id};
 }
 async linkScenarioEvidence(id:CanopyScenarioId,packageRef:string) {
  const existing=new Set<string>();let cursor:string|null=null;
  do{const page=await this.get("evidence/links?limit=50"+(cursor?"&cursor="+encodeURIComponent(cursor):""));
   for(const link of page.evidence_links as Array<{source_anchor_id:string;decision_package_reference_id:string;target_id:string;target_type:string;relation:string;assertion_id:string|null}>)if(link.target_type==="graph_edge"&&link.relation==="supports"&&link.assertion_id===null)existing.add(link.source_anchor_id+"|"+link.decision_package_reference_id+"|"+link.target_id);
   cursor=(page.page as {next_cursor:string|null}).next_cursor;
  }while(cursor);
  for(const [edge,refs] of Object.entries(canopyEdgeEvidence(id)))for(const ref of refs){
   const source=this.source(ref.document,ref.version);
   if(existing.has(source.anchors[ref.section]+"|"+packageRef+"|"+edge))continue;
   if(!source.reviewed)throw new Error("Explicit source review required before graph evidence linking");
   await this.mutate("evidence/links",{action:"create",sourceAnchorId:source.anchors[ref.section],decisionPackageReferenceId:packageRef,
    targetType:"graph_edge",targetId:edge,relation:"supports",professionalMeaning:"Controlling source for the reviewed Canopy gate; exact version and section retained."});
  }
 }
}
export type Session={sessionKey:string;caseId:string;version:string;fingerprint:string;status:string;revision:number;startedAt:string;completedAt:string|null;state:{currentStageId:string;metrics:Record<MetricKey,number>;actionUseCounts:Record<string,number>;clockMinute:number;outcome:unknown;decisions:Array<{sequence:number;stageId:string;optionId:string}>}};
async function checked(response:Response):Promise<Wire>{
 const result=await response.json() as Wire;
 if(!response.ok)throw new Error("Canopy API "+response.status+": "+JSON.stringify(result));
 return result;
}
export {CANOPY_DISCLOSURE};
function scenarioStatement(id:CanopyScenarioId) {
 const d=buildCanopyPackage(id).declaration;
 return "Canopy memo / Executive recommendation: Professional judgment: "+d.recommendation+" "+d.changed+" "+d.why;
}
