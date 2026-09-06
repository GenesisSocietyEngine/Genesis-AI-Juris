import { caseFingerprint, normalizeStudioDraft } from "./case-integrity";
import { compileStudioDraft } from "./studio-compiler";
import type { MetricGuard, Scenario, StudioDraft, StudioLink, StudioNode } from "./types";

import { CANOPY_DISCLOSURE } from "./canopy-disclosure";
import { CANOPY_HISTORICAL_SOURCES, type CanopySource } from "./canopy-source-history";
import { CANOPY_UPSIDE_INPUTS, canopyGuardDeclaration, type CanopyInputs } from "./canopy-inputs";
export { CANOPY_DISCLOSURE };
export type { CanopySource };
export const CANOPY_TITLE = "Project Canopy — Managed-site expansion gate";
export const CANOPY_QUESTION = "Should Verdant Atelier accept a managed-site expansion opportunity now, approve a conditional 90-day transition pilot, renegotiate/defer, or decline?";
export const CANOPY_FIXTURE_VERSION = "2.0.0";
export type CanopyScenarioId = "base" | "upside" | "downside" | "hard_stop" | "hard_stop_unavailable";
// Existing eleven source versions remain byte-identical. Corrections are append-only.
export const CANOPY_SOURCES: readonly CanopySource[] = [...CANOPY_HISTORICAL_SOURCES,
 {id:"D08",version:2,title:"Staffing confirmation addendum",sections:{
  Leadership:"Synthetic confirmation, 2026-09-08 09:00 UTC. Operating owner Noah Wren confirms appointment of transition lead Inez Reed and commitment of the minimum operating team for the 480-pack/week scope. Confirmation supersedes the unresolved appointment in D08 v1; an authorized reviewer must accept this exact anchor before using it for readiness.",
  Reviews:"Mara Vale owns signed-demand scope by day 10; Inez Reed owns commissioning evidence before release; Noah Wren owns team readiness before release. Eli Moss checks the mandate on days 30, 60 and 90. Review demand, yield, traceability, delivery performance and exit conditions at every review."
 }},
 {id:"D06",version:3,title:"Synthetic mandatory-clearance failure event",sections:{
  Commissioning:"The commissioning acceptance recorded in D06 v2 for the 480-pack scope is retained. This later release event changes only mandatory clearance; it does not rewrite the earlier commissioning record.",
  Clearance:"Synthetic event, 2026-09-09 09:00 UTC. Independent release officer Ari Stone records a FAILED traceability release check for the scoped operation. Finding: the mandatory batch-to-delivery release check did not pass. Clearance is failed, not merely missing. This separate fictional event invokes D01 Safety; authorized review is required."
 }},
 {id:"D06",version:4,title:"Synthetic unavailable-clearance alternative record",sections:{
  Commissioning:"Independent alternative scenario copy: commissioning acceptance remains as in D06 v2. This unavailable-clearance record is not a continuation of the failed-inspection scenario and does not assert an inspection failed.",
  Clearance:"Synthetic alternative, 2026-09-09 09:00 UTC. Release officer Ari Stone records that the required current clearance certificate is UNAVAILABLE at the release gate. No failed inspection is evidenced. Missing clearance independently blocks release under D01 Safety. All non-clearance Upside inputs remain pinned; authorized review is required."
 }},
 {id:"D07",version:2,title:"Reviewed scenario assumptions and units addendum",sections:{
  Method:"Illustrative synthetic assumptions, not forecasts. Annual values use fictional credits; volume is packs/week. Simple payback is setup divided by annual contribution. D01 thresholds are demand >=450 packs/week, yield >=90%, conservative payback <=3 years. Percentages describe declared assumptions, not measured production.",
  Base:"Source baseline: 300 signed packs/week (D03 v1). Scenario assumptions: demand 300, yield 92%; annual revenue 720000, energy 80000, other costs 520000; contribution 120000; setup 240000; simple payback 2.00 years. Conservative payback 3.00 years. Unresolved source conditions prohibit production.",
  Upside:"Source baseline: 480 signed packs/week (D03 v2). Scenario assumptions: demand 480, yield 95%; annual revenue 840000, energy 80000, other costs 600000; contribution 160000; setup 240000; simple payback 1.50 years. Conservative payback 3.00 years. Staffing fact comes from D08 v2, not D08 v1's assumption.",
  Downside:"Source baseline: 480 signed packs/week. Scenario assumption: demand stressed to 300 packs/week to test demand retention; yield 85%, ten percentage points below Upside 95%. Annual revenue 670000, energy 100000 (+25% from 80000), other costs 500000; contribution 70000; setup 240000; payback 3.43 years rounded from 24/7. Explicit professional review is required; D03 v2 stays unchanged.",
  HardStop:"Pin all accepted Upside non-clearance inputs: demand/baseline/capacity 480 packs/week, yield 95%, annual revenue 840000, energy 80000, other costs 600000, setup 240000, payback 1.50 years and conservative payback 3.00 years; staffing confirmed, commissioning accepted, policy unchanged. Change only clearance from passed to the separately evidenced failed event or unavailable alternative.",
  Underwriting:"Conservative Base: 690000 - 90000 - 520000 = 80000 annual contribution. Conservative Upside: 780000 - 100000 - 600000 = 80000. Both: 240000 / 80000 = 3.00 years. Downside stress: 240000 / 70000 = 3.43 years (rounded), above the inclusive 3-year maximum. This is transparent fixture arithmetic, not a new financial engine."
 }}
];
export function canopySource(id: string, version: number) {
 const source = CANOPY_SOURCES.find(s => s.id === id && s.version === version);
 if (!source) throw new Error("Unknown immutable Canopy source");
 return source;
}
export function canopySourceText(source: CanopySource) {
 return "# "+source.id+" v"+source.version+" — "+source.title+"\n\n"+CANOPY_DISCLOSURE+"\n\n"+Object.entries(source.sections).map(([heading,text])=>"## "+heading+"\n\n"+text).join("\n\n")+"\n";
}
export type CanopyDeclaration = {
 id: CanopyScenarioId; version: string; parent: CanopyScenarioId|null; label: string; terminal: string;
 d03: number; d06: number; d08: number; inputs: CanopyInputs;
 recommendation: string; changed: string; why: string; controls: Array<{document: string; version: number; section: string}>;
};
const refs = (d03:number,d06:number,d08:number,section:string) => [
 {document:"D01",version:1,section:"Thresholds"},{document:"D03",version:d03,section:"Demand"},
 {document:"D06",version:d06,section:"Clearance"},{document:"D06",version:d06,section:"Commissioning"},
 {document:"D08",version:d08,section:"Leadership"},{document:"D07",version:2,section},
 {document:"D04",version:1,section:"Capacity"},{document:"D09",version:1,section:"Service"},
 {document:"D01",version:1,section:"Safety"}];
export const CANOPY_SCENARIOS: readonly CanopyDeclaration[] = [
 {id:"base",version:"2.0.0",parent:null,label:"Base",terminal:"conditional-pilot",d03:1,d06:1,d08:1,
 inputs:{...CANOPY_UPSIDE_INPUTS,sourceBaselineSignedPacksPerWeek:300,assumedDemandPacksPerWeek:300,assumedYieldPercent:92,annualRevenueCredits:720000,annualOtherCostsCredits:520000,staffing:"unresolved",commissioning:"pending",clearance:"no_critical_failure_identified"},
 recommendation:"Approve only a conditional 90-day transition pilot. Production release is prohibited until all recorded conditions are accepted.",
 changed:"Source baseline: 300 signed packs/week; commissioning and staffing remain unresolved. Yield 92% and economics are scenario assumptions.",
 why:"Acceptable illustrative economics do not close demand, commissioning or leadership conditions.",controls:refs(1,1,1,"Base")},
 {id:"upside",version:"2.1.0",parent:"base",label:"Upside",terminal:"approve-operation",d03:2,d06:2,d08:2,inputs:{...CANOPY_UPSIDE_INPUTS},
 recommendation:"Recommend managed-site operation within 480 packs/week, subject to accepted release conditions and 90-day review/exit controls.",
 changed:"D03 v2 evidences 480 signed packs/week; D06 v2 records commissioning and passed clearance; D08 v2 records Noah Wren's dated staffing confirmation. Yield 95% remains a reviewed assumption.",
 why:"Accepted evidence and reviewed assumptions meet the declared mandate. Memorandum approval is not operational release authority.",controls:refs(2,2,2,"Upside")},
 {id:"hard_stop",version:"2.2.0",parent:"upside",label:"Hard stop",terminal:"no-go",d03:2,d06:3,d08:2,inputs:{...CANOPY_UPSIDE_INPUTS,clearance:"failed"},
 recommendation:"No-go: the mandatory traceability clearance failed. Do not begin production, irrespective of attractive economics.",
 changed:"Only clearance changes from passed to failed, supported by the later synthetic D06 v3 event. Demand, yield, energy, capacity, staffing, commissioning, finances and policy remain pinned to Upside.",
 why:"D01 Safety blocks every operation/pilot branch. This is an evidenced fictional failed check, distinct from an unavailable certificate.",controls:refs(2,3,2,"HardStop")},
 {id:"downside",version:"2.4.0",parent:null,label:"Downside",terminal:"defer",d03:2,d06:2,d08:2,
 inputs:{...CANOPY_UPSIDE_INPUTS,assumedDemandPacksPerWeek:300,assumedYieldPercent:85,annualRevenueCredits:670000,annualEnergyCredits:100000,annualOtherCostsCredits:500000,conservativePaybackYears:24/7},
 recommendation:"Renegotiate and defer under the reviewed stress assumptions. Production is not authorized.",
 changed:"Source baseline: 480 signed packs/week. Scenario assumption: demand stressed to 300 packs/week; yield 85% (10 percentage points lower), energy +25%, payback 3.43 years. D03 v2 remains unchanged.",
 why:"The independently initialized stress copy breaches yield and payback policy; it is not a new signed-demand source fact.",controls:refs(2,2,2,"Downside")}
];
export const CANOPY_UNAVAILABLE: CanopyDeclaration = {
 ...CANOPY_SCENARIOS[2],id:"hard_stop_unavailable",version:"2.3.0",label:"Clearance unavailable",d06:4,
 inputs:{...CANOPY_UPSIDE_INPUTS,clearance:"unavailable"},
 recommendation:"No-go: mandatory clearance is unavailable. No failed inspection is asserted; production remains prohibited.",
 changed:"Only clearance changes from passed to unavailable, recorded in the independent D06 v4 alternative. All non-clearance Upside inputs remain pinned.",
 why:"D01 Safety independently blocks missing mandatory clearance; unavailable evidence is not a demonstrated failed inspection.",controls:refs(2,4,2,"HardStop")
};
export function canopyDeclaration(id: CanopyScenarioId) {
 const declaration=[...CANOPY_SCENARIOS,CANOPY_UNAVAILABLE].find(s=>s.id===id);
 if(!declaration) throw new Error("Unknown prepared Canopy scenario");
 return declaration;
}
export function buildCanopyPackage(id: CanopyScenarioId, independent=false): {declaration:CanopyDeclaration;draft:StudioDraft;studioFingerprint:string;scenario:Scenario} {
 const sourceDeclaration=canopyDeclaration(id);
 const independentVersions:Record<CanopyScenarioId,string>={base:"2.0.0",upside:"2.5.0",hard_stop:"2.6.0",hard_stop_unavailable:"2.7.0",downside:"2.4.0"};
 const standalone=independent||id==="downside"||id==="hard_stop_unavailable";
 const declaration=standalone?{...sourceDeclaration,version:independent?independentVersions[id]:sourceDeclaration.version,parent:null}:sourceDeclaration;
 const previous=declaration.parent?buildCanopyPackage(declaration.parent):null;
 const guards=canopyGuardDeclaration(declaration.inputs);
 const detail=(doc:string,version:number,section:string)=>doc+" v"+version+" § "+section+": "+canopySource(doc,version).sections[section];
 const definitions: Array<[string,StudioNode["type"],string,string]> = [
 ["opening","trigger","Review the declared scenario",CANOPY_QUESTION+" "+CANOPY_DISCLOSURE+" Pinned reviewed inputs: "+JSON.stringify(declaration.inputs)],
 ["mandate","decision","Is this within the committee mandate?",detail("D01",1,"Mandate")],
 ["clearance","decision","Do mandatory safety and traceability clearances permit proceeding?",detail("D01",1,"Safety")+" "+("Clearance state: "+declaration.inputs.clearance+". ")+detail("D06",declaration.d06,"Clearance")],
 ["demand","decision","Is sufficient demand signed, not merely indicated?",(id==="downside"?"Source baseline: 480 signed packs/week. Scenario assumption: demand stressed to 300 packs/week (D07 v2 § Downside); D03 v2 is unchanged. ":"")+detail("D03",declaration.d03,"Demand")],
 ["crop","decision","Is the site suitable for high-value crops?",detail("D04",1,"Capacity")],
 ["commissioning","evidence","Is independent commissioning evidence accepted?",detail("D06",declaration.d06,"Commissioning")],
 ["leadership","actor","Can the accountable leader and minimum team be in place?",detail("D08",declaration.d08,"Leadership")],
 ["cold-chain","decision","Does cold-chain capacity satisfy the service model?",detail("D09",1,"Service")],
 ["economics","decision","Does downside payback meet the mandate?",detail("D07",2,"Underwriting")+" "+detail("D07",2,declaration.id.startsWith("hard_stop")?"HardStop":declaration.label)],
 ["pilot","decision","Can remaining risks be bounded by pilot and exit conditions?",detail("D02",1,"Exit")],
 ["approve-operation","outcome","Approve managed-site operation",canopyDeclaration("upside").recommendation],
 ["conditional-pilot","outcome","Conditional 90-day transition pilot",canopyDeclaration("base").recommendation],
 ["defer","outcome","Renegotiate and defer",canopyDeclaration("downside").recommendation],
 ["no-go","outcome","Decline / no-go",id.startsWith("hard_stop")?declaration.recommendation:"Mandatory failed or unavailable clearance prohibits production. See the exact current clearance record."]
 ];
 const nodes:StudioNode[]=definitions.map(([nodeId,type,title,nodeDetail],index)=>({id:nodeId,type,title,detail:nodeDetail,x:index*260,y:0,
 runtime:{day:1,time:"09:00",...(type==="outcome"?{terminalOutcome:nodeId==="approve-operation"?"strong" as const:nodeId==="no-go"?"weak" as const:"mixed" as const}:{})}}));
 const links:StudioLink[]=[];
 const link=(from:string,to:string,label:string,source:string,guards?:MetricGuard[],effects:NonNullable<StudioLink["rule"]>["effects"] = {position:0,evidence:0,trust:0,exposure:0})=>{
  links.push({id:from+"--"+to,from,to,rule:{label,detail:source,result:label,cost:0,minutes:1,effects,guards,repeatability:"once"}});
 };
 // Existing authored metric guards encode only this immutable scenario declaration.
 // They are not farm measurements or financial formulas. No later edge can alter
 // trust (the mandatory clearance latch), so economics cannot reopen a hard stop.
 link("opening","mandate","Apply explicitly reviewed scenario declaration",declaration.changed+" "+declaration.controls.map(c=>c.document+" v"+c.version+" § "+c.section).join("; "),undefined,
 {trust:guards.clearance?100:-100,evidence:guards.fullyReady?100:-100,exposure:guards.downside?100:-100});
 link("mandate","clearance","Mandate confirmed",detail("D01",1,"Mandate"));
 link("clearance","no-go","Mandatory clearance blocks release: "+declaration.inputs.clearance,detail("D01",1,"Safety")+" "+detail("D06",declaration.d06,"Clearance"),[{metric:"trust",comparison:"eq",value:0}]);
 link("clearance","demand","No critical failure; evaluate remaining conditions",detail("D06",declaration.d06,"Clearance"),[{metric:"trust",comparison:"eq",value:100}]);
 link("demand","crop","Record signed scope and excluded interest",detail("D03",declaration.d03,"Demand"));
 link("crop","commissioning","Premium-crop scope is suitable",detail("D04",1,"Capacity"));
 link("commissioning","leadership","Record closed evidence or a no-production pilot condition",detail("D06",declaration.d06,"Commissioning"));
 link("leadership","cold-chain","Record accountable leadership condition",detail("D08",declaration.d08,"Leadership"));
 link("cold-chain","economics","Delivery capacity covers only the scoped volume",detail("D09",1,"Service"));
 link("economics","defer","Downside mandate fails",detail("D07",2,"Downside"),[{metric:"exposure",comparison:"eq",value:100}]);
 link("economics","pilot","Mandate met; consider evidence and exit conditions",detail("D01",1,"Thresholds"),[{metric:"exposure",comparison:"eq",value:0}]);
 link("pilot","conditional-pilot","Pilot only; prohibit production release",detail("D01",1,"Safety")+" "+detail("D02",1,"Exit"),[{metric:"evidence",comparison:"eq",value:0},{metric:"trust",comparison:"eq",value:100}]);
 link("pilot","approve-operation","Accepted evidence permits scoped operation","Requires accepted signed scope and commissioning closure. "+detail("D03",declaration.d03,"Demand")+" "+detail("D06",declaration.d06,"Commissioning"),[{metric:"evidence",comparison:"eq",value:100},{metric:"trust",comparison:"eq",value:100}]);
 const draft:StudioDraft=normalizeStudioDraft({caseId:"project_canopy_managed_site_expansion"+(standalone&&id!=="base"?"_"+id:""),version:declaration.version,
 caseType:{registry:"genesis-juris-case-types",id:"general_advisory",version:"1.0.0"},parent:previous?{caseId:previous.draft.caseId,version:previous.draft.version,fingerprint:previous.studioFingerprint}:null,title:CANOPY_TITLE,
 jurisdiction:"Fictional Gulf market",role:"Investment and Operating Committee",
 premise:CANOPY_QUESTION+" "+declaration.label+": "+declaration.recommendation+" "+CANOPY_DISCLOSURE,
 classification:{domain:"general",practiceArea:"Managed-site operating decision",difficulty:"Advanced",tags:["synthetic","canopy"],taxTopics:[],complianceOnly:true,purpose:"compliance_review",legalAsOf:"2026-09-06",sourceUrls:[]},
 nodes,links,editHistory:[],updatedAt:"2026-09-06T09:00:00.000Z"});
 const fingerprint=caseFingerprint(draft);
 const compiled=compileStudioDraft(draft,fingerprint);
 if(!compiled.scenario) throw new Error(JSON.stringify(compiled.issues));
 return {declaration,draft,studioFingerprint:fingerprint,scenario:compiled.scenario};
}

export function canopyEdgeEvidence(id:CanopyScenarioId) {
 const scenario=canopyDeclaration(id);
 const ref=(document:string,version:number,section:string)=>({document,version,section});
 return {
  "opening--mandate":scenario.controls,
  "mandate--clearance":[ref("D01",1,"Mandate")],
  "clearance--no-go":[ref("D01",1,"Safety"),ref("D06",scenario.d06,"Clearance")],
  "clearance--demand":[ref("D06",scenario.d06,"Clearance")],
  "demand--crop":[ref("D03",scenario.d03,"Demand"),...(id==="downside"?[ref("D07",2,"Downside")]:[])],
  "crop--commissioning":[ref("D04",1,"Capacity")],
  "commissioning--leadership":[ref("D06",scenario.d06,"Commissioning")],
  "leadership--cold-chain":[ref("D08",scenario.d08,"Leadership")],
  "cold-chain--economics":[ref("D09",1,"Service")],
  "economics--defer":[ref("D07",2,"Downside"),ref("D01",1,"Thresholds")],
  "economics--pilot":[ref("D07",2,"Underwriting"),ref("D01",1,"Thresholds")],
  "pilot--conditional-pilot":[ref("D01",1,"Safety"),ref("D02",1,"Exit")],
  "pilot--approve-operation":[ref("D03",scenario.d03,"Demand"),ref("D06",scenario.d06,"Commissioning")],
 };
}
