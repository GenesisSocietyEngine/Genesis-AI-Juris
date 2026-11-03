import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {buildCanopyPackage,CANOPY_SOURCES} from "../app/canopy-fixture";
import {buildConvertedExample} from "../app/converted-examples";
import {studioMaterials,studioMaterialCitations,materialHash} from "../app/studio-materials";
import {fixture as taxFixture} from "./helpers/tax-report-fixture";

function working(){const p=buildCanopyPackage("base");return {...p.draft,caseId:"qa_exact_passages",exampleSource:{format:"casevant-example-source-v1" as const,caseId:p.draft.caseId,version:p.draft.version,fingerprint:p.studioFingerprint}};}

test("exact node citations bind document/version/section to canonical retained bytes without modifying carriers",async()=>{
 const draft=working(),tax=JSON.parse(readFileSync('tests/fixtures/fiveflats-rent-146000.studio-draft.json','utf8'));
 draft.taxEconomics=tax.taxEconomics;draft.taxAnalysis=taxFixture().draft.taxAnalysis;
 const items=await studioMaterials(draft,'en'),before=JSON.stringify({draft,items});
 const cites=studioMaterialCitations(draft,'en','economics',items);
 assert.deepEqual(cites.map(c=>c.id),['D07:v2:Underwriting','D07:v2:Base']);
 for(const cite of cites){const exact=CANOPY_SOURCES.find(s=>s.id===cite.document&&s.version===cite.version)!.sections[cite.section];assert.equal(cite.text,exact);assert.equal(cite.verbatimInNode,true);assert.equal(cite.selectedInSourceScenario,true);assert.equal(await materialHash(cite.text!),"sha256:"+createHash('sha256').update(exact).digest('hex'));}
 assert.equal(JSON.stringify({draft,items}),before);assert.equal(studioMaterialCitations(draft,'en','no-such-node',items).length,0);assert.equal(studioMaterialCitations(draft,'en',undefined,items).length,0);
});

test("edited node wording still opens the declared original section and discloses verbatim mismatch",async()=>{
 const draft=working();draft.nodes=draft.nodes.map(n=>n.id==='mandate'?{...n,detail:'Changed authored summary. D01 v1 § Mandate'}:n);
 const before=JSON.stringify(draft),c=studioMaterialCitations(draft,'ru','mandate',await studioMaterials(draft,'ru'))[0];
 assert.equal(c.id,'D01:v1:Mandate');assert.equal(c.text,CANOPY_SOURCES.find(s=>s.id==='D01'&&s.version===1)!.sections.Mandate);assert.equal(c.verbatimInNode,false);assert.equal(JSON.stringify(draft),before);
});

test("explicit retained versions are readable; unknown versions never substitute the selected version",async()=>{
 const draft=working();draft.nodes=draft.nodes.map(n=>n.id==='demand'?{...n,detail:'D03 v2 § Demand'}:n);
 let items=await studioMaterials(draft,'en');assert.equal(items.find(i=>i.id==='canopy:D03:v2')?.selected,false);
 assert.equal(studioMaterialCitations(draft,'en','demand',items)[0].text,CANOPY_SOURCES.find(s=>s.id==='D03'&&s.version===2)!.sections.Demand);assert.equal(studioMaterialCitations(draft,'en','demand',items)[0].selectedInSourceScenario,false);
 draft.nodes=draft.nodes.map(n=>n.id==='demand'?{...n,detail:'D03 v99 § Demand'}:n);items=await studioMaterials(draft,'en');
 const unknown=studioMaterialCitations(draft,'en','demand',items)[0];assert.equal(unknown.id,'D03:v99:Demand');assert.equal(unknown.text,null);assert.equal(unknown.verbatimInNode,false);
 draft.nodes=draft.nodes.map(n=>n.id==='demand'?{...n,detail:'D03 v1 § MissingSection'}:n);items=await studioMaterials(draft,'en');assert.equal(studioMaterialCitations(draft,'en','demand',items)[0].text,null);
});

test("tampered, detached or missing material refuses the precise passage instead of matching a document name",async()=>{
 const draft=working(),items=await studioMaterials(draft,'en');
 for(const change of [{text:'Altered full document'},{nodeIds:[]},{sections:{}},{kind:'working' as const}]){
  const altered=items.map(i=>i.id==='canopy:D01:v1'?{...i,...change}:i);assert.equal(studioMaterialCitations(draft,'en','mandate',altered)[0].text,null);
 }
 assert.equal(studioMaterialCitations(draft,'en','mandate',[])[0].text,null);
 for(const exampleSource of [{...draft.exampleSource,version:'99.0.0'},{...draft.exampleSource,caseId:'unknown_source_family'}]) assert.deepEqual(studioMaterialCitations({...draft,exampleSource},'en','mandate',items),[]);
});

test("converted missing originals and URL-only references gain no fabricated section bodies",async()=>{
 const draft=buildConvertedExample('greenfire_first_72_hours','ru'),before=JSON.stringify(draft),items=await studioMaterials(draft,'ru');
 assert.equal(items.filter(i=>i.kind==='missing').length,7);
 for(const node of draft.nodes)assert.deepEqual(studioMaterialCitations(draft,'ru',node.id,items),[]);
 assert.ok(items.filter(i=>i.kind==='missing'||i.kind==='url').every(i=>i.text===null));assert.equal(JSON.stringify(draft),before);
});


test("unsupported tax carriers retain their bytes and existing recovery refusal during passage projection",()=>{
 const draft=working();draft.taxAnalysis={format:'genesis-juris-tax-attachment',carrierVersion:1,document:' {"schema":"unsupported-synthetic-version","exact":"retain these bytes"} \r\n'};
 const before=JSON.stringify(draft);assert.throws(()=>studioMaterialCitations(draft,'en','mandate',[]),/read-only recovery/);assert.equal(JSON.stringify(draft),before);
});
