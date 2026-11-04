import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {buildCanopyPackage} from '../app/canopy-fixture';
import {createStudioEvidenceDrag,STUDIO_EVIDENCE_DRAG_TYPE} from '../app/studio-evidence-attachment';

const source=ts.createSourceFile('JurisApp.tsx',readFileSync('app/JurisApp.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let factory='';const handlers:string[]=[];
function visit(n:ts.Node){
 if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='evidenceDrag')factory=n.initializer!.getText(source);
 if(ts.isFunctionDeclaration(n)&&['beginEvidenceDrag','finishEvidenceDrag','dropEvidence'].includes(n.name?.text??''))handlers.push(n.getText(source));
 ts.forEachChild(n,visit);
}visit(source);assert.ok(factory&&handlers.length===3);

test('actual drag owner fences draft/source/saved identity/account/language/epoch/editability/restore transitions',()=>{
 let prior:unknown[]|undefined,owner:ReturnType<typeof createStudioEvidenceDrag>;
 const useMemo=(make:()=>typeof owner,deps:unknown[])=>{if(!prior||!deps.every((v,i)=>Object.is(v,prior![i]))){owner=make();prior=deps;}return owner;};
 const build=new Function('useMemo','createStudioEvidenceDrag','draft','canDuplicate','reportAuthority','restorePending','customCaseId','reportReceiptStorageScope','locale',compile(`return ${factory};`));
 const draft=buildCanopyPackage('base').draft,id=draft.nodes.find(n=>n.type==='evidence')!.id,target=draft.nodes.find(n=>n.type==='outcome')!.id;
 const defaults={draft,canDuplicate:true,reportAuthority:{allowed:true,epoch:1},restorePending:false,customCaseId:48,reportReceiptStorageScope:'synthetic-A',locale:'en'};
 const make=(patch:Partial<typeof defaults>={})=>{const p={...defaults,...patch};return build(useMemo,createStudioEvidenceDrag,p.draft,p.canDuplicate,p.reportAuthority,p.restorePending,p.customCaseId,p.reportReceiptStorageScope,p.locale) as typeof owner;};
 const changes:Partial<typeof defaults>[]=[{draft:{...draft}},{draft:{...draft,version:'99.0.0'}},{customCaseId:49},{reportReceiptStorageScope:'synthetic-B'},{locale:'ru'},{reportAuthority:{allowed:true,epoch:2}},{reportAuthority:{allowed:false,epoch:1}},{canDuplicate:false},{restorePending:true}];
 for(const patch of changes){const a=make(),token=a.begin([id])!;assert.equal(make(),a);const b=make(patch);assert.notEqual(b,a);assert.equal(b.drop(token,target),null);assert.equal(make().drop(token,target),null,'A→B→A cannot restore an old gesture');}
});

test('actual root drag handlers stage one preview, refuse stale/external data and never write a case',()=>{
 const draft=buildCanopyPackage('base').draft,id=draft.nodes.find(n=>n.type==='evidence')!.id,target=draft.nodes.find(n=>n.type==='outcome')!.id,before=JSON.stringify(draft);
 const owner=createStudioEvidenceDrag(draft,true),ref={current:owner},pending={current:false};const plans:unknown[]=[],notices:string[]=[];
 const run=new Function('evidenceDrag','evidenceDragOwner','operationPending','STUDIO_EVIDENCE_DRAG_TYPE','setEvidenceDrop','setEvidenceHover','setRelationStatus','locale',compile(handlers.join('\n')+';return {beginEvidenceDrag,dropEvidence,finishEvidenceDrag};'))(owner,ref,pending,STUDIO_EVIDENCE_DRAG_TYPE,(value:unknown)=>plans.push(value),()=>{},(value:string)=>notices.push(value),'en');
 const values=new Map<string,string>();let stops=0;
 const event={dataTransfer:{types:[STUDIO_EVIDENCE_DRAG_TYPE],effectAllowed:'',setData:(type:string,value:string)=>values.set(type,value),getData:(type:string)=>values.get(type)??''},preventDefault(){stops++;},stopPropagation(){stops++;}};
 run.beginEvidenceDrag(event,[id]);assert.ok(values.get(STUDIO_EVIDENCE_DRAG_TYPE));assert.equal(event.dataTransfer.effectAllowed,'copy');assert.equal(plans.length,0);
 run.dropEvidence(event,target);assert.equal(plans.length,1);assert.deepEqual((plans[0] as {plan:unknown}).plan,{evidenceIds:[id],targetNodeId:target});assert.equal(stops,2);assert.equal(JSON.stringify(draft),before);
 run.finishEvidenceDrag();assert.equal(plans.length,1);
 run.beginEvidenceDrag(event,[id]);ref.current=createStudioEvidenceDrag(draft,true);run.dropEvidence(event,target);assert.equal(plans.length,1,'an old callback cannot stage a plan after owner replacement');
 ref.current=owner;pending.current=true;run.beginEvidenceDrag(event,[id]);assert.equal(plans.length,1);assert.equal(JSON.stringify(draft),before);
 assert.ok(notices.some(n=>n.includes('preview')));
});


test('actual map background refuses file/URL/external drops without navigating away or importing data',()=>{
 let expression='';
 function find(n:ts.Node){
  if(ts.isJsxOpeningElement(n)&&n.tagName.getText(source)==='div'){
   const cls=n.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==='className') as ts.JsxAttribute|undefined;
   if(cls?.initializer&&ts.isStringLiteral(cls.initializer)&&cls.initializer.text==='graph-viewport'){
    const drop=n.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==='onDrop') as ts.JsxAttribute;
    expression=(drop.initializer as ts.JsxExpression).expression!.getText(source);
   }
  }ts.forEachChild(n,find);
 }find(source);assert.ok(expression);
 let prevented=0,palette=0;const messages:string[]=[];
 const drop=new Function('validPaletteDrag','dropPaletteNode','setRelationStatus','locale',compile(`return (${expression});`))(()=>true,()=>palette++,(m:string)=>messages.push(m),'en');
 for(const types of [['Files'],['text/uri-list'],[STUDIO_EVIDENCE_DRAG_TYPE],['Files','application/x-casevant-node']])drop({dataTransfer:{types},preventDefault(){prevented++;}});
 assert.equal(prevented,4);assert.equal(palette,0);assert.equal(messages.length,4);
 drop({dataTransfer:{types:['application/x-casevant-node']},preventDefault(){prevented++;}});assert.equal(palette,1);
});
