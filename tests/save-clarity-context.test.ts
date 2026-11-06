import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NavigationController, type DepartureRisk } from "../app/navigation-controller";
import { registerStudioDeparture, studioDepartureChanges, studioDepartureFingerprint, type StudioDepartureInput } from "../app/studio-departure";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { workspaceDestination, resumeWorkspaceDestination, currentCaseOverviewDestination, isStudioPanelNavigation } from "../app/workspace-navigation";
import StudioSaveStatus from "../app/StudioSaveStatus";
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const componentPath=resolve(".artifacts/save-clarity/work-tabs.mjs");
const component=await build({entryPoints:["app/work/WorkTabs.tsx"],bundle:true,write:false,platform:"node",format:"esm",packages:"external",loader:{".module.css":"empty"}});
mkdirSync(resolve(".artifacts/save-clarity"),{recursive:true});writeFileSync(componentPath,component.outputFiles[0].text);
const WorkTabs=(await import(pathToFileURL(componentPath).href)).default;

const nav = () => new NavigationController({ transport: async () => new Response(null, {status:204}), leave: () => assert.fail("saving alone must not navigate"), clear: () => {} });
function savingGuard(navigation: NavigationController) {
  let risk: DepartureRisk = "dirty", writes = 0, complete!: (value:boolean) => void;
  const remove = navigation.register({}, { risk:()=>risk, suspend:()=>{}, deny:()=>{}, canSave:()=>true, save:()=>{writes++;return new Promise<boolean>(resolve=>{complete=resolve;});} });
  return { remove, setRisk(value:DepartureRisk){risk=value;}, finish(value=true){complete(value);}, get writes(){return writes;} };
}
test("Save and continue requires a confirmed save and fresh clear state; repeated activation writes once", async()=>{
  const n=nav(), g=savingGuard(n); assert.equal(n.canSaveBeforeDeparture(),true);
  const saving=n.saveBeforeDeparture(); assert.equal(g.writes,1); assert.equal(await n.saveBeforeDeparture(),false);
  g.setRisk("clear");g.finish();assert.equal(await saving,true);assert.equal(n.warnBeforeUnload(),false);
});
test("failed, uncertain, or newly edited work never earns departure",async()=>{
  for(const scenario of ["failure","dirty","pending"] as const){
    const n=nav(),g=savingGuard(n),saving=n.saveBeforeDeparture();
    g.setRisk(scenario==="pending"?"pending":"dirty");g.finish(scenario!=="failure");
    assert.equal(await saving,false);assert.equal(n.warnBeforeUnload(),true);
  }
});
test("cancel, another destination, authority loss and replacement guards invalidate an in-flight continuation",async()=>{
  for(const scenario of ["cancel","intent","authority","replace"] as const){
    const n=nav(),g=savingGuard(n);let current=true;const saving=n.saveBeforeDeparture(()=>current);
    if(scenario==="cancel")current=false;
    if(scenario==="intent")n.beginIntent();
    if(scenario==="authority")n.invalidate("expired");
    if(scenario==="replace"){g.remove();n.register({}, {risk:()=>"clear",suspend:()=>{},deny:()=>{}});}
    g.setRisk("clear");g.finish();assert.equal(await saving,false,scenario);
  }
});
test("unsupported changes and pending operations prevent any save attempt; exceptions stay recoverable",async()=>{
  for(const risk of ["dirty","pending"] as const){const n=nav(),g=savingGuard(n);n.register({}, {risk:()=>risk,suspend:()=>{},deny:()=>{}});assert.equal(await n.saveBeforeDeparture(),false);assert.equal(g.writes,0);}
  const n=nav();let writes=0;n.register({}, {risk:()=>"dirty",suspend:()=>{},deny:()=>{},canSave:()=>true,save:async()=>{writes++;throw Error("offline");}});
  assert.equal(await n.saveBeforeDeparture(),false);assert.equal(n.canSaveBeforeDeparture(),true);assert.equal(writes,1);
});
test("saved case plus unadded input is explained separately and cannot be cleared by ordinary Save",async()=>{
  const draft=buildCanopyPackage("base").draft;
  const input:StudioDepartureInput={draft,blank:{...draft,title:"Other"},prompt:"Unsent request",evidencePending:true,operationPending:false,deviceEligible:false,scope:"actor",customCaseId:51,serverFingerprint:caseFingerprint(draft),serverPublicationFingerprint:casePublicationFingerprint(draft),saved:{kind:"workspace",scope:"actor",customCaseId:51,fingerprint:studioDepartureFingerprint(draft)}};
  assert.deepEqual(studioDepartureChanges(input),["studio_prompt","studio_items"]);
  const n=nav();let saves=0,reviews=0;registerStudioDeparture(n,()=>input,()=>({canSave:()=>true,save:async()=>{saves++;return true;},review:()=>reviews++}));
  assert.equal(await n.saveBeforeDeparture(),false);assert.equal(saves,0);n.reviewUnsaved();assert.equal(reviews,1);
  input.prompt="";input.evidencePending=false;assert.equal(n.risk(),"clear");
  input.draft={...draft,title:"Changed title"};assert.deepEqual(studioDepartureChanges(input),["studio_case"]);assert.equal(n.canSaveBeforeDeparture(),true);
});
test("save status distinguishes confirmed content, unsaved buffers, and failed or later edits in both languages",()=>{
  for(const locale of ["en","ru"] as const){
    const props={state:"saved" as const,locale,hasSavedCase:true,savedAt:"2026-11-06T20:00:00.000Z",promptPending:true,itemsPending:false,onReview:()=>{}};
    const html=renderToStaticMarkup(createElement(StudioSaveStatus,props));assert.match(html,/data-state="partial"/);assert.match(html,/<time/);assert.ok(html.includes(locale==="en"?"AI prompt is not saved.":"AI-промпт не сохранён."));
    for(const state of ["idle","conflict","error","saving"] as const){const unsaved=renderToStaticMarkup(createElement(StudioSaveStatus,{...props,state}));assert.doesNotMatch(unsaved,/<time/);assert.ok(!unsaved.includes(locale==="en"?"Case saved to workspace":"Кейс сохранён в рабочем пространстве"));}
  }
});
const url=(path:string)=>new URL(path,"https://casevant.pro");
test("local history exemption never follows a different case, account, locale, example or suite view",()=>{
  const source="/studio?custom_case=51&organization=a&lang=en&studio_panel=overview";
  assert.equal(isStudioPanelNavigation(source,"/studio?view=studio&organization=a&custom_case=51&lang=en&studio_panel=workbench"),true);
  for(const target of [source.replace("51","52"),source.replace("organization=a","organization=b"),source.replace("lang=en","lang=ru"),source+"&example=canopy",source+"&view=demos","/work?studio_case=51","https://other.test"+source])assert.equal(isStudioPanelNavigation(source,target),false,target);
});
test("saved Studio → Calendar → case overview / Studio retains the exact draft and governed context",()=>{
  const context="/matters?dossier=matter-a&organization=org-a&section=evidence&lang=ru";
  const studio="/studio?custom_case=51&studio_step=reports&studio_panel=workbench&organization=org-a&lang=ru&return_to="+encodeURIComponent(context);
  const calendar=workspaceDestination("/work?view=calendar",studio);
  assert.equal(url(calendar).searchParams.get("studio_case"),"51");
  const overview=currentCaseOverviewDestination(calendar)!;assert.equal(url(overview).pathname,"/studio");assert.equal(url(overview).searchParams.get("custom_case"),"51");assert.equal(url(overview).searchParams.get("studio_panel"),"overview");assert.equal(url(overview).searchParams.get("return_to"),context);
  const back=workspaceDestination("/studio?studio_panel=workbench",calendar);assert.equal(url(back).searchParams.get("custom_case"),"51");assert.equal(url(back).searchParams.get("studio_step"),"reports");
  const matter=workspaceDestination("/matters",calendar);assert.equal(url(matter).searchParams.get("dossier"),"matter-a");assert.equal(url(matter).searchParams.get("studio_case"),"51");
  assert.equal(url(workspaceDestination("/studio",matter)).searchParams.get("custom_case"),"51");
});
test("explicit case/organization changes do not carry old saved Studio identity; first save refreshes its link",()=>{
  const source="/studio?custom_case=51&organization=org-a&return_to="+encodeURIComponent("/matters?dossier=a&organization=org-a");
  for(const target of ["/matters?dossier=b","/work?organization=org-b"]){const result=url(workspaceDestination(target,source));assert.equal(result.searchParams.has("studio_case"),false);}
  assert.equal(url(workspaceDestination("/studio?custom_case=52",source)).searchParams.get("custom_case"),"52");
  const rebound=resumeWorkspaceDestination("https://casevant.pro/work?view=calendar","https://casevant.pro"+source);assert.equal(url(rebound).searchParams.get("studio_case"),"51");
  assert.equal(resumeWorkspaceDestination("https://example.com/","https://casevant.pro"+source),"https://example.com/");
  for(const id of ["0","-1","9007199254740992","abc"]){assert.equal(url(workspaceDestination("/work",`/studio?custom_case=${id}`)).searchParams.has("studio_case"),false);}
  assert.equal(currentCaseOverviewDestination("/work?view=home"),null);
});
test("case overview and Studio are in-place buttons within Studio, and return links elsewhere",()=>{
  const local=renderToStaticMarkup(createElement(WorkTabs,{locale:"en",active:"cases",location:"/studio?custom_case=51",onCaseOverview:()=>{},onStudio:()=>{}}));
  assert.match(local,/<button[^>]*aria-current="page"[^>]*>[\s\S]*?Case overview/);assert.equal((local.match(/aria-current="page"/g)??[]).length,1);
  const elsewhere=renderToStaticMarkup(createElement(WorkTabs,{locale:"en",active:"calendar",location:"/work?view=calendar&studio_case=51",onView:()=>{}}));assert.match(elsewhere,/href="\/studio\?studio_panel=overview&amp;custom_case=51"/);
});
