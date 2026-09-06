import { caseFingerprint, normalizeStudioDraft } from "./case-integrity";
import { compileStudioDraft } from "./studio-compiler";
import type { MetricGuard, Scenario, StudioDraft, StudioLink, StudioNode } from "./types";

export const CANOPY_DISCLOSURE = "This demonstration uses entirely fictional organisations, documents, people and figures. It is inspired only by publicly described industry patterns and does not represent Greeneration data, performance, controls or decisions.";
export const CANOPY_TITLE = "Project Canopy — Managed-site expansion gate";
export const CANOPY_QUESTION = "Should Verdant Atelier accept a managed-site expansion opportunity now, approve a conditional 90-day transition pilot, renegotiate/defer, or decline?";
export const CANOPY_FIXTURE_VERSION = "1.0.0";
export type CanopyScenarioId = "base" | "upside" | "downside" | "hard_stop";
export type CanopySource = { id: string; version: number; title: string; sections: Record<string, string> };
const assumption = "Illustrative synthetic assumption.";
export const CANOPY_SOURCES: readonly CanopySource[] = [
 { id:"D01", version:1, title:"Investment mandate and approval thresholds", sections:{
  Mandate:"The fictional Investment and Operating Committee has ten days from dossier opening to choose a controlled managed-site opportunity. This mandate covers premium crops and a 90-day transition pilot, not commodity-volume expansion.",
  Thresholds:"Minimum signed demand: 450 packs per week. Required yield: 90%. Maximum downside simple payback: 3 years. Setup commitment: 240000 illustrative credits. These are committee assumptions, not market forecasts.",
  Safety:"A failed or unavailable mandatory independent food-safety or traceability clearance at the production release gate means no-go regardless of financial attractiveness. No production release is permitted under the conditional pilot until all release conditions are independently accepted.",
  Alternatives:"Approve full management takeover subject to recorded conditions; approve only a conditional 90-day transition pilot; renegotiate and defer; or decline/no-go."
 }},
 { id:"D02", version:1, title:"Draft farm-management term sheet", sections:{
  Control:"Verdant Atelier Farms retains authority to pause production and deliveries. The site owner funds the illustrative setup commitment. No exclusivity or irreversible takeover is permitted during the pilot.",
  Exit:"The pilot lasts 90 days with reviews on days 30, 60 and 90. Exit without expansion is required if signed demand, yield, independent release clearance or staffing conditions fail. Commercial owner: Mara Vale; decision deadline: day 10."
 }},
 { id:"D03", version:1, title:"Hospitality demand pipeline", sections:{
  Demand:"Total indicated demand is 600 packs per week: 300 signed, 180 non-binding LOI and 120 expressions of interest. Only 300 count as signed commitments against the 450 minimum.",
  Gap:"The commercial request of 600 packs per week exceeds evidenced transition capacity of 480 by 120. Non-binding interest is not revenue or a production authorization."
 }},
 { id:"D03", version:2, title:"Hospitality demand pipeline", sections:{
  Demand:"The defined 180-pack LOI subset has become signed commitments. Signed demand is now 480 packs per week: the original 300 plus 180. The remaining 120 expressions of interest remain uncommitted; total indicated demand remains 600.",
  Gap:"Only 480 packs per week are in the approved scope, matching transition capacity. The additional 120 remain excluded pending an independently reviewed capacity change."
 }},
 { id:"D04", version:1, title:"Current capacity and crop-fit report", sections:{
  Capacity:"Evidenced premium-crop transition capacity is 480 packs per week. The candidate is suitable for the specified high-value crop mix. Commodity-volume expansion is excluded.",
  Yield:"The release yield threshold is 90%. Base demonstrated yield is 92%; upside is 95%; downside is 85%. These are illustrative synthetic scenario assumptions, not agronomy forecasts."
 }},
 { id:"D05", version:1, title:"Candidate-site technical assessment", sections:{
  Site:"The fictional candidate has suitable cultivation and environmental-control equipment for premium crops. Full operation depends on independent commissioning evidence and closed release controls.",
  Readiness:"The material traceability reconciliation item in D06 v1 remains pending. A controlled non-production transition pilot may close it; equipment suitability alone never authorizes production."
 }},
 { id:"D06", version:1, title:"Independent commissioning and traceability-readiness report", sections:{
  Commissioning:"Independent closure evidence for batch-to-delivery traceability reconciliation is pending. This material readiness gap blocks full operation but is not a failed critical safety control. Controlled non-production pilot work may resolve it.",
  Clearance:"Base declaration: no critical safety failure is identified. Hard-stop stress declaration: mandatory independent food-safety or traceability clearance fails or is unavailable at the production release gate. That declaration requires no-go even with upside economics."
 }},
 { id:"D06", version:2, title:"Independent commissioning and traceability-readiness report", sections:{
  Commissioning:"Independent evidence now closes batch-to-delivery traceability reconciliation for the 480-pack scope. The evidence requires explicit authorized review before it can support release.",
  Clearance:"Upside declaration: mandatory independent food-safety and traceability clearances are passed for the scoped operation. Reopening either clearance as failed or unavailable invokes the D01 no-go rule; this version is not an unconditional perpetual clearance."
 }},
 { id:"D07", version:1, title:"Illustrative unit-economics and scenario sheet", sections:{
  Method:assumption+" Unit: fictional credits. Simple payback = 240000 setup commitment / annual contribution. Contribution = annual revenue - energy - other annual operating costs. These transparent precomputed values are not forecasts, audited calculations or a Genesis financial engine.",
  Base:"Base: revenue 720000; energy 80000; other costs 520000; total costs 600000; contribution 120000; simple payback 2.00 years. Signed demand 300 packs/week; yield 92%. Headline economics meet the 3-year mandate; evidence and leadership remain conditions.",
  Upside:"Upside: revenue 840000; energy 80000; other costs 600000; total costs 680000; contribution 160000; simple payback 1.50 years. Signed demand 480 packs/week; yield 95%; accountable leadership confirmed.",
  Downside:"Downside: revenue 670000; energy 100000; other costs 500000; total costs 600000; contribution 70000; simple payback 3.43 years (rounded from 24/7). Energy rises 25% from 80000; signed demand 300 packs/week; yield 85%. Renegotiate and defer.",
  HardStop:"Hard stop uses the attractive upside economics (1.50-year payback) with failed or unavailable mandatory release clearance. Recommendation remains no-go. Financial values do not alter safety clearance.",
  Underwriting:"Conservative base pilot: revenue 690000 - energy 90000 - other 520000 = contribution 80000. Conservative upside operation: revenue 780000 - energy 100000 - other 600000 = contribution 80000. Both downside paybacks are 240000 / 80000 = 3.00 years, meeting the mandate. The separate Downside stress contribution of 70000 breaches it and requires renegotiation/exit. Illustrative synthetic assumptions."
 }},
 { id:"D08", version:1, title:"Staffing and 90-day transition plan", sections:{
  Leadership:"Base: transition leader appointment and minimum-team commitment are unresolved. Upside declared assumption: transition lead Inez Reed and the minimum team are confirmed before release. Operating owner Noah Wren must evidence confirmation by day 10.",
  Reviews:"Mara Vale owns signed-demand scope by day 10; Inez Reed owns commissioning evidence before release; Noah Wren owns team readiness before release; finance owner Eli Moss checks the mandate on days 30, 60 and 90. Review demand, yield, traceability, delivery performance and exit conditions at every review."
 }},
 { id:"D09", version:1, title:"Cold-chain and delivery service model", sections:{
  Service:"The fictional service model supports same-day hospitality deliveries for up to 480 packs per week. Cold-chain capacity matches the scoped upside volume. Delivery owner Sol Hart retains a contingency carrier and may pause deliveries.",
  Controls:"Production and deliveries require accepted independent release clearance. Monitor freshness SLA and routing capacity at the day 30, 60 and 90 reviews. No customer names, actual facility details or real operating figures are used."
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
 id: CanopyScenarioId; version: string; label: string; terminal: string;
 d03: number; d06: number; clearance: boolean; fullyReady: boolean; downside: boolean;
 recommendation: string; changed: string; why: string; controls: Array<{document: string; version: number; section: string}>;
};
export const CANOPY_SCENARIOS: readonly CanopyDeclaration[] = [
 {id:"base",version:"1.0.0",label:"Base",terminal:"conditional-pilot",d03:1,d06:1,clearance:true,fullyReady:false,downside:false,
 recommendation:"Approve only a conditional 90-day transition pilot. Production release is prohibited until all recorded conditions are accepted.",
 changed:"Opening evidence: 300 signed packs/week, pending independent commissioning evidence and unresolved transition leadership.",
 why:"Acceptable headline economics do not close demand, commissioning or leadership conditions.",
 controls:[{document:"D03",version:1,section:"Demand"},{document:"D06",version:1,section:"Commissioning"},{document:"D08",version:1,section:"Leadership"}]},
 {id:"upside",version:"1.1.0",label:"Upside",terminal:"approve-operation",d03:2,d06:2,clearance:true,fullyReady:true,downside:false,
 recommendation:"Approve managed-site operation for the 480-pack scope, subject to recorded release conditions and 90-day review/exit controls.",
 changed:"D03 v2 signs the defined 180-pack subset; D06 v2 supplies closure; leadership is confirmed; yield is 95%.",
 why:"Signed demand 480 meets 450, commissioned scope is independently evidenced and accepted, and the declared mandate is met.",
 controls:[{document:"D03",version:2,section:"Demand"},{document:"D06",version:2,section:"Commissioning"},{document:"D07",version:1,section:"Upside"},{document:"D08",version:1,section:"Leadership"}]},
 {id:"downside",version:"1.2.0",label:"Downside",terminal:"defer",d03:2,d06:2,clearance:true,fullyReady:false,downside:true,
 recommendation:"Renegotiate and defer. Do not authorize managed-site production or the unbounded expansion.",
 changed:"Energy +25%; yield 85%; signed demand 300; simple payback 3.43 years.",
 why:"Yield and signed demand fall below their thresholds and downside payback exceeds the 3-year mandate.",
 controls:[{document:"D07",version:1,section:"Downside"},{document:"D01",version:1,section:"Thresholds"}]},
 {id:"hard_stop",version:"1.3.0",label:"Hard stop",terminal:"no-go",d03:2,d06:2,clearance:false,fullyReady:true,downside:false,
 recommendation:"No-go. Failed or unavailable mandatory release clearance cannot be overridden by attractive financial returns.",
 changed:"Mandatory release clearance is reopened as failed/unavailable; the attractive upside economics remain unchanged.",
 why:"D01 safety is a hard stop. The graph terminates before financial gates; the approval and pilot branches are unavailable.",
 controls:[{document:"D01",version:1,section:"Safety"},{document:"D06",version:2,section:"Clearance"},{document:"D07",version:1,section:"HardStop"}]}
];
export function canopyDeclaration(id: CanopyScenarioId) {
 const declaration=CANOPY_SCENARIOS.find(s=>s.id===id);
 if(!declaration) throw new Error("Unknown prepared Canopy scenario");
 return declaration;
}
export function buildCanopyPackage(id: CanopyScenarioId): {declaration:CanopyDeclaration;draft:StudioDraft;studioFingerprint:string;scenario:Scenario} {
 const declaration=canopyDeclaration(id);
 const index=CANOPY_SCENARIOS.findIndex(s=>s.id===id);
 const previous=index>0?buildCanopyPackage(CANOPY_SCENARIOS[index-1].id):null;
 const detail=(doc:string,version:number,section:string)=>doc+" v"+version+" § "+section+": "+canopySource(doc,version).sections[section];
 const definitions: Array<[string,StudioNode["type"],string,string]> = [
 ["opening","trigger","Review the declared scenario",CANOPY_QUESTION+" "+CANOPY_DISCLOSURE],
 ["mandate","decision","Is this within the committee mandate?",detail("D01",1,"Mandate")],
 ["clearance","decision","Do mandatory safety and traceability clearances permit proceeding?",detail("D01",1,"Safety")+" "+(id==="hard_stop"?"Reviewed stress assumption: mandatory clearance is failed or unavailable at release. ":"")+detail("D06",declaration.d06,"Clearance")],
 ["demand","decision","Is sufficient demand signed, not merely indicated?",(id==="downside"?"Declared downside stress assumes 300 signed packs/week (D07 v1 § Downside); this does not rewrite the 480-pack source baseline. ":"")+detail("D03",declaration.d03,"Demand")],
 ["crop","decision","Is the site suitable for high-value crops?",detail("D04",1,"Capacity")],
 ["commissioning","decision","Is independent commissioning evidence accepted?",detail("D06",declaration.d06,"Commissioning")],
 ["leadership","decision","Can the accountable leader and minimum team be in place?",detail("D08",1,"Leadership")],
 ["cold-chain","decision","Does cold-chain capacity satisfy the service model?",detail("D09",1,"Service")],
 ["economics","decision","Does downside payback meet the mandate?",detail("D07",1,"Underwriting")+" "+detail("D07",1,declaration.id==="hard_stop"?"HardStop":declaration.label)],
 ["pilot","decision","Can remaining risks be bounded by pilot and exit conditions?",detail("D02",1,"Exit")],
 ["approve-operation","outcome","Approve managed-site operation",canopyDeclaration("upside").recommendation],
 ["conditional-pilot","outcome","Conditional 90-day transition pilot",canopyDeclaration("base").recommendation],
 ["defer","outcome","Renegotiate and defer",canopyDeclaration("downside").recommendation],
 ["no-go","outcome","Decline / no-go",canopyDeclaration("hard_stop").recommendation]
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
 {trust:declaration.clearance?100:-100,evidence:declaration.fullyReady?100:-100,exposure:declaration.downside?100:-100});
 link("mandate","clearance","Mandate confirmed",detail("D01",1,"Mandate"));
 link("clearance","no-go","Mandatory clearance failed or unavailable",detail("D01",1,"Safety"),[{metric:"trust",comparison:"eq",value:0}]);
 link("clearance","demand","No critical failure; evaluate remaining conditions",detail("D06",declaration.d06,"Clearance"),[{metric:"trust",comparison:"eq",value:100}]);
 link("demand","crop","Record signed scope and excluded interest",detail("D03",declaration.d03,"Demand"));
 link("crop","commissioning","Premium-crop scope is suitable",detail("D04",1,"Capacity"));
 link("commissioning","leadership","Record closed evidence or a no-production pilot condition",detail("D06",declaration.d06,"Commissioning"));
 link("leadership","cold-chain","Record accountable leadership condition",detail("D08",1,"Leadership"));
 link("cold-chain","economics","Delivery capacity covers only the scoped volume",detail("D09",1,"Service"));
 link("economics","defer","Downside mandate fails",detail("D07",1,"Downside"),[{metric:"exposure",comparison:"eq",value:100}]);
 link("economics","pilot","Mandate met; consider evidence and exit conditions",detail("D01",1,"Thresholds"),[{metric:"exposure",comparison:"eq",value:0}]);
 link("pilot","conditional-pilot","Pilot only; prohibit production release",detail("D01",1,"Safety")+" "+detail("D02",1,"Exit"),[{metric:"evidence",comparison:"eq",value:0},{metric:"trust",comparison:"eq",value:100}]);
 link("pilot","approve-operation","Accepted evidence permits scoped operation","Requires accepted signed scope and commissioning closure. "+detail("D03",declaration.d03,"Demand")+" "+detail("D06",declaration.d06,"Commissioning"),[{metric:"evidence",comparison:"eq",value:100},{metric:"trust",comparison:"eq",value:100}]);
 const draft:StudioDraft=normalizeStudioDraft({caseId:"project_canopy_managed_site_expansion",version:declaration.version,
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
  "clearance--no-go":[ref("D01",1,"Safety")],
  "clearance--demand":[ref("D06",scenario.d06,"Clearance")],
  "demand--crop":[ref("D03",scenario.d03,"Demand"),...(id==="downside"?[ref("D07",1,"Downside")]:[])],
  "crop--commissioning":[ref("D04",1,"Capacity")],
  "commissioning--leadership":[ref("D06",scenario.d06,"Commissioning")],
  "leadership--cold-chain":[ref("D08",1,"Leadership")],
  "cold-chain--economics":[ref("D09",1,"Service")],
  "economics--defer":[ref("D07",1,"Downside"),ref("D01",1,"Thresholds")],
  "economics--pilot":[ref("D07",1,"Underwriting"),ref("D01",1,"Thresholds")],
  "pilot--conditional-pilot":[ref("D01",1,"Safety"),ref("D02",1,"Exit")],
  "pilot--approve-operation":[ref("D03",scenario.d03,"Demand"),ref("D06",scenario.d06,"Commissioning")],
 };
}
