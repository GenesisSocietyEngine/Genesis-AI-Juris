import test from "node:test";
import assert from "node:assert/strict";
import { CANOPY_SOURCES,CANOPY_SCENARIOS,CANOPY_DISCLOSURE,buildCanopyPackage,canopyEdgeEvidence,canopySourceText } from "../app/canopy-fixture";
import { decisionAvailability } from "../app/game-engine";
test("Canopy source fixture has nine fictional documents, eleven immutable versions and supported exact excerpts",()=>{
 assert.equal(new Set(CANOPY_SOURCES.map(s=>s.id)).size,9);assert.equal(CANOPY_SOURCES.length,11);
 for(const source of CANOPY_SOURCES){
  const text=canopySourceText(source);assert.ok(text.includes(CANOPY_DISCLOSURE));
  for(const excerpt of Object.values(source.sections)){assert.ok(excerpt.length<=500,source.id+" excerpt too long");assert.equal(text.indexOf(excerpt),text.lastIndexOf(excerpt));}
 }
 for(const id of ["D03","D06"])assert.deepEqual(CANOPY_SOURCES.filter(s=>s.id===id).map(s=>s.version),[1,2]);
});
test("Canopy numbers reconcile to the transparent source sheet and bounded demand scope",()=>{
 const sheet=CANOPY_SOURCES.find(s=>s.id==="D07")!;
 const expected={Base:[720000,80000,520000,120000,2],Upside:[840000,80000,600000,160000,1.5],Downside:[670000,100000,500000,70000,3.43]};
 for(const [section,[revenue,energy,other,contribution,payback]] of Object.entries(expected)){
  const text=sheet.sections[section];for(const n of [revenue,energy,other,contribution])assert.ok(text.includes(String(n)));
  assert.equal(revenue-energy-other,contribution);assert.equal(Math.round(240000/contribution*100)/100,payback);
 }
 assert.equal(100000/80000,1.25);assert.equal(690000-90000-520000,80000);assert.equal(780000-100000-600000,80000);assert.equal(240000/80000,3);
 assert.equal(300+180,480);assert.equal(300+180+120,600);assert.equal(600-480,120);
});
for(const declaration of CANOPY_SCENARIOS)test("Canopy "+declaration.id+" graph is reproducible, version-bound and has an irreversible safety gate",()=>{
 const a=buildCanopyPackage(declaration.id),b=buildCanopyPackage(declaration.id);
 assert.deepEqual(a,b);assert.equal(a.draft.caseType?.id,"general_advisory");
 assert.deepEqual(Object.keys(canopyEdgeEvidence(declaration.id)).sort(),a.draft.links.map(link=>link.id).sort());
 for(const refs of Object.values(canopyEdgeEvidence(declaration.id)))for(const ref of refs)assert.ok(CANOPY_SOURCES.find(s=>s.id===ref.document&&s.version===ref.version)?.sections[ref.section]);
 assert.ok(a.scenario.stages.find(s=>s.id==="studio-"+declaration.terminal)?.terminal);
 for(const link of a.draft.links.filter(l=>l.from!=="opening"))assert.deepEqual(link.rule?.effects,{position:0,evidence:0,trust:0,exposure:0});
 for(const stage of a.scenario.stages.filter(s=>s.id!=="studio-opening"))for(const option of stage.options)assert.deepEqual(option.effects,{position:0,evidence:0,trust:0,exposure:0});
 const stage=a.scenario.stages.find(s=>s.id==="studio-clearance")!;
 for(const financialPosition of [0,50,100]){
  const available=stage.options.filter(o=>decisionAvailability(o,{position:financialPosition,trust:0,evidence:100,exposure:0},0).available);
  assert.equal(available.length,1);assert.equal(available[0].nextStageId,"studio-no-go");
 }
 const pilot=a.scenario.stages.find(s=>s.id==="studio-pilot")!;
 assert.deepEqual(pilot.options.filter(o=>decisionAvailability(o,{position:100,trust:100,evidence:0,exposure:0},0).available).map(o=>o.nextStageId),["studio-conditional-pilot"]);
});
