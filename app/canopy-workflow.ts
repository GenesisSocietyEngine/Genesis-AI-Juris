import { CANOPY_DISCLOSURE, CANOPY_SOURCES, CANOPY_TITLE, buildCanopyPackage, canopyEdgeEvidence, canopySource, canopySourceText, type CanopyScenarioId } from "./canopy-fixture";
import { decisionAvailability } from "./game-engine";
import type { MetricKey } from "./types";

/** The caller supplies its normal authenticated, organization-scoped transport.
 * This module has no DB, session, environment, deletion or privileged reset access. */
export type CanopyTransport = (path: string, init?: RequestInit) => Promise<Response>;
type Wire = Record<string, unknown>;
type SourceBinding = { documentId: string; versionId: string; anchors: Record<string,string>; reviewed: boolean };
export class CanopyWorkingCopy {
 revision=1;
 readonly sources:Record<string,SourceBinding>={};
 readonly acceptedAssertions:string[]=[];
 readonly pendingProposals:string[]=[];
 readonly scenarioProposals=new Map<string,CanopyScenarioId>();
 readonly reviewedScenarios=new Set<CanopyScenarioId>();
 readonly openingRequests:Record<string,string>={};
 lastScenario:CanopyScenarioId|null=null;
 constructor(readonly api:CanopyTransport, readonly dossierId:string) {}
 static async create(api:CanopyTransport,onCreated?:(dossierId:string)=>void) {
  const response=await api("/api/dossiers",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:CANOPY_TITLE,jurisdictions:["Fictional Gulf market"],classification:"internal",
   keyDeadlineAt:new Date(Date.now()+10*86400000).toISOString(),keyDeadlineTimezone:"UTC"})});
  const payload=await checked(response);
  const dossier=payload.dossier as {dossier_id:string};
  const copy=new CanopyWorkingCopy(api,dossier.dossier_id);
  onCreated?.(copy.dossierId);
  for(const source of CANOPY_SOURCES.filter(s=>s.version===1)) await copy.upload(source.id,source.version);
  for(const [key,question] of Object.entries({demand:"Mara Vale: document current signed demand, the 450-pack minimum and any scope gap.",commissioning:"Inez Reed: document the current independent commissioning/clearance status and any unresolved release conditions.",leadership:"Noah Wren: document current transition-leader/team availability and any unresolved appointment conditions."})){
   const request=await copy.mutate("requests",{action:"create",question,reason:"Evidence-status question for reporting. Receiving an answer does not approve production or close a recorded release condition.",priority:"high"});
   copy.openingRequests[key]=(request.request as {information_request_id:string}).information_request_id;
  }
  for(const status of ["intake_review","active","internal_review"]) await copy.mutate("transitions",{newStatus:status,reason:"Synthetic demonstration: evidence remains under explicit human review."});
  return copy;
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
  form.set("title",id+" — "+source.title);form.set("documentType","correspondence");form.set("classification","internal");
  form.set("privacyAcknowledged","true");form.set("expectedRevision",String(this.revision));form.set("mediaType","text/markdown");
  if(previous)form.set("documentId",previous.documentId);
  const result=await checked(await this.api("/api/dossiers/"+this.dossierId+"/documents",{method:"POST",body:form}));
  this.revision=result.dossier_revision as number;
  const stored=result.version as {document_version_id:string};
  const binding:SourceBinding={documentId:result.document_id as string,versionId:stored.document_version_id,anchors:{},reviewed:false};
  this.sources[id+"@"+version]=binding;
  for(const [section,excerpt] of Object.entries(source.sections)){
   const anchor=await this.mutate("evidence/anchors",{action:"create",documentId:binding.documentId,documentVersionId:binding.versionId,
    section,paragraph:"1",excerpt});
   binding.anchors[section]=(anchor.source_anchor as {source_anchor_id:string}).source_anchor_id;
  }
  return binding;
 }
 async reviewSource(id:string,version:number) {
  const binding=this.source(id,version);
  if(binding.reviewed)return;
  const documentAlreadyReviewed=Object.values(this.sources).some(source=>source.documentId===binding.documentId&&source.reviewed);
  if(!documentAlreadyReviewed)await this.mutate("documents/"+binding.documentId+"/review",{decision:"accepted_source"});
  for(const anchor of Object.values(binding.anchors))await this.mutate("evidence/anchors",{action:"review",sourceAnchorId:anchor,decision:"accepted"});
  binding.reviewed=true;
 }
 source(id:string,version:number){const source=this.sources[id+"@"+version];if(!source)throw new Error("Source is not in this working copy");return source;}
 async propose(statement:string,refs:Array<{id:string;version:number;section:string}>,proposalType="fact") {
  const result=await this.mutate("proposals",{action:"create",proposalType,proposedValue:{statement},
   sourceDocumentVersionIds:[...new Set(refs.map(r=>this.source(r.id,r.version).versionId))],
   sourceAnchorIds:refs.map(r=>this.source(r.id,r.version).anchors[r.section])});
  const id=(result.proposal as {proposal_id:string}).proposal_id;
  this.pendingProposals.push(id);return id;
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
 async proposeScenario(id:CanopyScenarioId){
  const {declaration}=buildCanopyPackage(id);
  const proposalId=await this.propose("Canopy memo / Executive recommendation: "+declaration.recommendation+" "+declaration.changed+" "+declaration.why,
   declaration.controls.map(c=>({id:c.document,version:c.version,section:c.section})),"assumption");
  this.scenarioProposals.set(proposalId,id);return proposalId;
 }
 async proposeMemorandum(id:CanopyScenarioId){
  const {declaration}=buildCanopyPackage(id);
  const fields:Array<{heading:string;statement:string;refs:Array<{id:string;version:number;section:string}>}>=[
   {heading:"Decision requested",statement:CANOPY_TITLE+". "+canopySource("D01",1).sections.Mandate,refs:[{id:"D01",version:1,section:"Mandate"}]},
   {heading:"Scope and evidence limitation",statement:canopySource("D03",declaration.d03).sections.Gap,refs:[{id:"D03",version:declaration.d03,section:"Gap"},{id:"D04",version:1,section:"Capacity"}]},
   {heading:"Conditions and no-go rule",statement:canopySource("D01",1).sections.Safety+" "+canopySource("D01",1).sections.Thresholds,refs:[{id:"D01",version:1,section:"Safety"},{id:"D01",version:1,section:"Thresholds"}]},
   {heading:"Accountable owners and review dates",statement:canopySource("D08",1).sections.Reviews,refs:[{id:"D08",version:1,section:"Reviews"}]},
   {heading:"Alternatives and exit",statement:canopySource("D01",1).sections.Alternatives+" "+canopySource("D02",1).sections.Exit,refs:[{id:"D01",version:1,section:"Alternatives"},{id:"D02",version:1,section:"Exit"}]},
   {heading:"Assumptions and economics",statement:canopySource("D07",1).sections[declaration.id==="hard_stop"?"HardStop":declaration.label]+" "+canopySource("D07",1).sections.Underwriting,refs:[{id:"D07",version:1,section:declaration.id==="hard_stop"?"HardStop":declaration.label},{id:"D07",version:1,section:"Underwriting"}]}
  ];
  const proposals:string[]=[];
  for(const field of fields)proposals.push(await this.propose("Canopy memo / "+field.heading+": "+field.statement,field.refs,"assumption"));
  return proposals;
 }
 async run(id:CanopyScenarioId) {
  if(!this.reviewedScenarios.has(id))throw new Error("Explicit acceptance of this prepared scenario declaration is required");
  const prepared=buildCanopyPackage(id);
  const expectedPrevious:Record<CanopyScenarioId,CanopyScenarioId|null>={base:null,upside:"base",downside:"upside",hard_stop:"downside"};
  if(this.lastScenario!==expectedPrevious[id])throw new Error("Follow the reviewed package lineage: Base, Upside, Downside, Hard stop. Create a clean copy to restart.");
  for(const ref of prepared.declaration.controls)if(!this.source(ref.document,ref.version).reviewed)throw new Error("Explicit source review required before scenario replay");
  if(this.pendingProposals.length)throw new Error("Review every prepared proposal before replay");
  let session=(await checked(await this.api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"start",caseId:prepared.draft.caseId,version:prepared.draft.version,fingerprint:prepared.scenario.fingerprint})}))).session as Session;
  for(let step=0;session.status==="active"&&step<30;step++){
   const stage=prepared.scenario.stages.find(s=>s.id===session.state.currentStageId);
   const available=stage?.options.filter(o=>decisionAvailability(o,session.state.metrics,0).available);
   if(available?.length!==1)throw new Error("Prepared graph must have exactly one available reviewed route");
   session=(await checked(await this.api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"decision",sessionKey:session.sessionKey,
    eventId:crypto.randomUUID(),expectedRevision:session.revision,optionId:available[0].id})}))).session as Session;
  }
  if(session.status!=="completed"||session.state.currentStageId!=="studio-"+prepared.declaration.terminal)throw new Error("Actual simulation result does not match the reviewed fixture");
  const linked=await this.mutate("decision-packages",{packageId:prepared.draft.caseId,packageVersion:prepared.draft.version,packageFingerprint:prepared.scenario.fingerprint,simulationReceiptIds:[session.sessionKey]});
  const packageRef=(linked.decision_package as {decision_package_reference_id:string})?.decision_package_reference_id;
  this.lastScenario=id;
  return {prepared,session,packageRef,linked};
 }
 async seal() {
  const snapshot=await this.mutate("snapshots",{locale:"en",audience:"internal",redactionProfileId:"pilot-default"});
  const snapshotId=(snapshot.snapshot as {snapshot_id:string}).snapshot_id;
  const pdf=await this.mutate("outputs",{action:"generate",snapshotId,format:"pdf"});
  const json=await this.mutate("outputs",{action:"generate",snapshotId,format:"json_manifest"});
  return {snapshotId,pdfOutputId:(pdf.output as {output_id:string}).output_id,jsonOutputId:(json.output as {output_id:string}).output_id};
 }
 async linkScenarioEvidence(id:CanopyScenarioId,packageRef:string) {
  for(const [edge,refs] of Object.entries(canopyEdgeEvidence(id)))for(const ref of refs){
   const source=this.source(ref.document,ref.version);
   if(!source.reviewed)throw new Error("Explicit source review required before graph evidence linking");
   await this.mutate("evidence/links",{action:"create",sourceAnchorId:source.anchors[ref.section],decisionPackageReferenceId:packageRef,
    targetType:"graph_edge",targetId:edge,relation:"supports",professionalMeaning:"Controlling source for the reviewed Canopy gate; exact version and section retained."});
  }
 }
}
type Session={sessionKey:string;status:string;revision:number;state:{currentStageId:string;metrics:Record<MetricKey,number>;decisions:unknown[]}};
async function checked(response:Response):Promise<Wire>{
 const result=await response.json() as Wire;
 if(!response.ok)throw new Error("Canopy API "+response.status+": "+JSON.stringify(result));
 return result;
}
export {CANOPY_DISCLOSURE};
