import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createMaterialReadingMemory } from "../app/studio-material-search";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { studioReviewAction } from "../app/studio-review-action";

const source=ts.createSourceFile("JurisApp.tsx",readFileSync("app/JurisApp.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let memoryFactory="", returnExpression="", cardCallback="", focusExpression="", focusEffect="", passageReturn="";
function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="materialReadingMemory")memoryFactory=node.initializer!.getText(source);
  if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="actionFocusId")focusExpression=node.initializer!.getText(source);
  if(ts.isCallExpression(node)&&node.expression.getText(source)==="useEffect"&&node.arguments[0]?.getText(source).includes("focusActionTarget(actionFocusId)"))focusEffect=node.arguments[0].getText(source);
  if(ts.isJsxExpression(node)&&node.expression?.getText(source).startsWith("actionTarget && actionTarget.step"))returnExpression=node.expression.getText(source);
  if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==="StudioMaterialsWorkspace"){
    const attribute=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="onReturnToFinding") as ts.JsxAttribute | undefined;
    if(attribute)passageReturn=(attribute.initializer as ts.JsxExpression).expression!.getText(source);
  }
  if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==="StudioPackageValidationCard"){
    const attribute=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="onOpen") as ts.JsxAttribute;
    cardCallback=(attribute.initializer as ts.JsxExpression).expression!.getText(source);
  }
  ts.forEachChild(node,visit);
}
visit(source);
assert.ok(memoryFactory&&returnExpression&&cardCallback,"tests execute actual root expressions, not replicas");
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;

test("actual parent memory dependencies discard origins on draft/locale/authority changes and retain them through material filtering",()=>{
  let prior:unknown[]|undefined, current:ReturnType<typeof createMaterialReadingMemory>;
  const useMemo=(fn:()=>typeof current,deps:unknown[])=>{if(!prior||!deps.every((v,i)=>Object.is(v,prior![i]))){current=fn();prior=deps;}return current;};
  const evaluate=new Function("useMemo","createMaterialReadingMemory","draft","locale","reportAuthority","canDuplicate","restorePending",compile(`return ${memoryFactory};`));
  const draft=buildCanopyPackage("base").draft;
  const make=(next=draft,locale="en",epoch=1,allowed=true,canEdit=true,pending=false)=>evaluate(useMemo,createMaterialReadingMemory,next,locale,{epoch,allowed},canEdit,pending) as typeof current;
  let memory=make();memory.rememberReview("nodes:evidence");
  memory.write({query:"450 packs",filter:"reference",history:true,limit:40,returnTo:{key:"canopy:D01:v1→evidence",scrollY:420}});
  assert.equal(make(),memory);assert.equal(memory.reviewFinding(),"nodes:evidence");
  assert.equal(memory.takeReturn()?.key,"canopy:D01:v1→evidence");assert.equal(memory.reviewFinding(),"nodes:evidence");
  const changes: Parameters<typeof make>[] = [[{...draft,version:"99.0.0"}], [{...draft,exampleSource:undefined}], [draft,"ru"], [draft,"en",2], [draft,"en",1,false], [draft,"en",1,true,false], [draft,"en",1,true,true,true]];
  for(const args of changes){
    memory=make();memory.rememberReview("orphan");
    const replacement=make(...args);assert.notEqual(replacement,memory);assert.equal(replacement.reviewFinding(),null);
  }
  const denied=make(draft,"en",1,false);denied.rememberReview("orphan");assert.equal(denied.reviewFinding(),null);
  for(const id of ["","../orphan","x".repeat(121),"orphan#other"]){memory=make();memory.rememberReview(id);assert.equal(memory.reviewFinding(),null);}
});

for(const locale of ["en","ru"] as const)test(`${locale}: actual correction return names the Review origin, stays inert when rendered, and disappears after returning`,()=>{
  const memory=createMaterialReadingMemory({draft:{},locale,allowed:true});let navigations=0;
  const actualRender=new Function("React","locale","overviewActionReturn","materialReadingMemory","actionTarget","returnToActions",compile(`return (${returnExpression});`));
  const render=(react:unknown,lang:string,memory:unknown,target:unknown,back:()=>void)=>actualRender(react,lang,{active:()=>false},memory,target,back);
  memory.rememberReview("orphan");
  const html=renderToStaticMarkup(render({createElement},locale,memory,{step:4,id:"studio-node-a"},()=>navigations++));
  assert.match(html,locale==="en"?/Back to review finding/:/Вернуться к замечанию/);assert.match(html,/<button type="button"/);assert.equal(navigations,0);
  assert.equal(renderToStaticMarkup(render({createElement},locale,memory,{step:5,id:"action-orphan"},()=>navigations++)),"");
  const overviewHtml=renderToStaticMarkup(actualRender({createElement},locale,{active:()=>true},memory,{step:3,id:"studio-case-brief"},()=>navigations++));
  assert.match(overviewHtml,locale==="en"?/Back to Overview/:/Вернуться к обзору/);
  assert.equal(navigations,0);
  memory.rememberReview(null);
  assert.match(renderToStaticMarkup(render({createElement},locale,memory,{step:3,id:"studio-source-urls"},()=>navigations++)),locale==="en"?/Back to case actions/:/Вернуться к действиям/);
});

test("actual completeness-card correction callback includes the exact Review identity without changing its destination",()=>{
  const draft=buildCanopyPackage("base").draft, before=JSON.stringify(draft), opened:unknown[]=[];
  const open=new Function("draft","studioReviewAction","openStudioAction",compile(`return (${cardCallback});`))(draft,studioReviewAction,(target:unknown)=>opened.push(target));
  const check={id:"orphan",level:"warn" as const,text:"Synthetic detached evidence",nodeIds:[draft.nodes[2].id]};
  open(check);assert.deepEqual(opened,[{...studioReviewAction(draft,check),reviewId:"orphan"}]);assert.equal(JSON.stringify(draft),before);
});


test("actual focus effect falls back when asynchronous checks remove a returned finding, without retargeting fields",()=>{
  assert.ok(focusExpression&&focusEffect);
  const actualId=new Function("showOverview","overviewActionReturn","actionTarget","checks",compile(`return (${focusExpression});`));
  const id=(target:unknown,checks:unknown)=>actualId(false,{focusRequested:()=>false},target,checks);
  assert.equal(actualId(true,{focusRequested:()=>true},null,[]),"studio-overview-actions");
  const target={step:5,id:"action-orphan"};
  assert.equal(id(target,[{id:"orphan",level:"warn"}]),"action-orphan");
  assert.equal(id(target,[{id:"orphan",level:"ok"}]),"studio-next-actions");
  assert.equal(id({step:3,id:"studio-source-urls"},[]),"studio-source-urls");
  assert.equal(id({step:4,id:"studio-node-evidence"},[]),"studio-node-evidence");
  const calls:string[]=[];
  class Observer {observe() {} disconnect() {}}
  const effect=new Function("actionFocusId","focusActionTarget","MutationObserver","requestAnimationFrame","cancelAnimationFrame","document",compile(`return (${focusEffect})();`));
  const cleanup=effect(id(target,[]),(value:string)=>{calls.push(value);return true;},Observer,(run:()=>void)=>{run();return 1;},()=>{},{body:{}});
  assert.deepEqual(calls,["studio-next-actions"]);cleanup();
});


test("actual node-reader Review return reuses the existing parent action only for an active origin",()=>{
 assert.ok(passageReturn);let returned=0;
 const callback=new Function('materialReadingMemory','returnToActions',compile(`return (${passageReturn});`));
 assert.equal(callback({reviewFinding:()=>null},()=>returned++),undefined);
 callback({reviewFinding:()=>'orphan'},()=>returned++)();assert.equal(returned,1);
});
