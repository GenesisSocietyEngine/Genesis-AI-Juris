import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import ts from "typescript";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint, legacyCaseFingerprintV15 } from "../app/case-integrity";
import { NavigationController, type DeparturePlan } from "../app/navigation-controller";
import { installDepartureHistory } from "../app/departure-history";
import { studioDepartureFingerprint, studioDepartureRisk, type StudioDepartureInput } from "../app/studio-departure";
import { readStudioAuthContinuation, STUDIO_AUTH_CONTINUATION_KEY } from "../app/studio-auth-continuation";

// Execute actual parent registration/baseline and auth continuation handlers;
// this contract harness does not claim browser dialog or focus acceptance.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map<string,string>(); let registration = "";
function visit(node:ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && ["blankStudioDraft", "rememberStudioWorkspaceSave", "openStudioAccess", "mayLeaveStudio"].includes(node.name.text)) functions.set(node.name.text,node.getText(source));
  if (ts.isCallExpression(node) && node.expression.getText(source)==="useEffect" && node.arguments[0]?.getText(source).includes("registerStudioDeparture(navigation,")) registration = node.arguments[0].getText(source);
  ts.forEachChild(node,visit);
}
visit(source); assert.equal(functions.size,4); assert.ok(registration,"the real parent must install its guard");
const compiled = await build({ stdin:{loader:"ts",resolveDir:resolve("app"),contents:`
import {caseTypeReference} from './case-type-reference';
import {StudioTaxWriteBaseline} from './studio-tax-write-baseline';
import {registerStudioDeparture,studioDepartureFingerprint} from './studio-departure';
import {hasStudioEvidenceInput} from './studio-evidence-buffer';
import {createStudioAuthContinuation,writeStudioAuthContinuation,STUDIO_AUTH_CONTINUATION_KEY} from './studio-auth-continuation';
import {workspaceSignInPath} from './workspace-navigation';
${functions.get("blankStudioDraft")}
export const blank=blankStudioDraft('2026-09-27T00:00:00.000Z');
export function parent(navigation,input) {
 const studioDepartureInput={current:input},draftRef={current:input.draft},studioOperationPending={current:input.operationPending},studioSavedBaseline={current:input.saved},currentStudioScopeRef={current:input.scope},initialBlankDraft=input.blank;
 const studioTaxWriteBaseline={current:new StudioTaxWriteBaseline()};
 const studioEvidenceBuffersRef={current:input.evidencePending?{evidence:{title:'Unadded item',detail:'',relatedId:''}}:{}};
 const locale='en',notices=[];const showSessionNotice=value=>notices.push(value);
 ${functions.get("rememberStudioWorkspaceSave")}
 ${functions.get("mayLeaveStudio")}
 const remove=(${registration})();
 return {remove,rememberStudioWorkspaceSave,mayLeaveStudio,notices,update(next){Object.assign(input,next);draftRef.current=input.draft;studioOperationPending.current=input.operationPending;studioSavedBaseline.current=input.saved;currentStudioScopeRef.current=input.scope;studioEvidenceBuffersRef.current=input.evidencePending?{evidence:{title:'Unadded item',detail:'',relatedId:''}}:{};},get baseline(){return studioSavedBaseline.current;}};
}
export function auth(options) {
 const {draft,prompt='',evidenceBuffers={},selectedNodeId=null,reportReceiptStorageScope=null,customCaseId=null,isPrivate=false,canDuplicate=true,locale='en',window,onAuthDeparture}=options;
 const state={};const setAccountTabNeeded=value=>state.accountTabNeeded=value,setWorkspaceState=value=>state.workspace=value,setWorkspaceError=value=>state.error=value;
 ${functions.get("openStudioAccess")}
 return {openStudioAccess,state};
}`},bundle:true,write:false,platform:"node",format:"esm" });
const output=resolve(".artifacts/studio-departure/handlers.mjs");mkdirSync(resolve(".artifacts/studio-departure"),{recursive:true});writeFileSync(output,compiled.outputFiles[0].text);
const actual=await import(pathToFileURL(output).href);

function input():StudioDepartureInput { return {draft:buildCanopyPackage("base").draft,blank:actual.blank,prompt:"",operationPending:false,deviceEligible:true,scope:null,customCaseId:null,serverFingerprint:null,serverPublicationFingerprint:null,saved:null}; }
function nav() { const leaves:string[]=[];return {leaves,navigation:new NavigationController({transport:async()=>new Response(null,{status:204}),leave:destination=>leaves.push(destination),clear:()=>{}})}; }

test("actual parent registers anonymous Canopy and prompt work without creating a storage fallback", () => {
  const state=input(), original=structuredClone(state.draft), h=nav(), parent=actual.parent(h.navigation,state);
  assert.equal(state.draft.nodes.length,14); assert.equal(h.navigation.risk(),"dirty"); assert.equal(h.navigation.warnBeforeUnload(),true);
  assert.equal(parent.mayLeaveStudio(),true,"dirty risk must reach existing Stay/Discard rather than blocking explicit discard");
  assert.deepEqual(state.draft,original);assert.equal(parent.baseline,null);
  parent.update({draft:actual.blank});assert.equal(h.navigation.risk(),"clear");
  parent.update({prompt:"Unapplied source facts"});assert.equal(h.navigation.risk(),"dirty");
  parent.remove();assert.equal(h.navigation.risk(),"clear");
});

test("exact verified workspace baseline is clear; changed version/history/prompt and stale receipt remain dirty", () => {
  const state=input(), h=nav();state.scope="verified-account";state.customCaseId=7;state.serverFingerprint=caseFingerprint(state.draft);state.serverPublicationFingerprint=casePublicationFingerprint(state.draft);
  const parent=actual.parent(h.navigation,state);parent.rememberStudioWorkspaceSave(state.draft,7);assert.equal(h.navigation.risk(),"clear");
  const saved=parent.baseline;parent.update({saved,draft:{...state.draft,updatedAt:"2099-01-01T00:00:00Z"}});assert.equal(h.navigation.risk(),"clear","timestamp-only projection is not unsaved content");
  const exact=state.draft;
  for(const change of [{version:"1.0.99"},{title:"Changed"},{premisePublication:"prompt-derived"},{editHistory:[...exact.editHistory,{id:"synthetic-extra",createdAt:"2026-09-27T00:00:00Z",role:"studio",source:"visual",action:"case_updated",message:"Unpersisted history"}]}]) {
    parent.update({draft:{...exact,...change}});assert.equal(h.navigation.risk(),"dirty");
  }
  parent.update({draft:exact,prompt:"Unapplied instruction"});assert.equal(h.navigation.risk(),"dirty");
  parent.update({prompt:"",serverFingerprint:"sha256-"+"0".repeat(64)});assert.equal(h.navigation.risk(),"dirty");
  parent.update({serverFingerprint:legacyCaseFingerprintV15(exact)});assert.equal(h.navigation.risk(),"clear","existing verified legacy read compatibility is retained");
  parent.update({scope:"different-account"});assert.equal(h.navigation.risk(),"dirty");parent.remove();
});

test("pending work takes precedence over a saved baseline; logout stays available", async () => {
  const state=input(),h=nav(),parent=actual.parent(h.navigation,state);parent.update({operationPending:true});
  assert.equal(h.navigation.risk(),"pending");assert.equal(parent.mayLeaveStudio(),false);assert.match(parent.notices[0],/still running/);
  await h.navigation.signOut("en");assert.equal(h.navigation.warnBeforeUnload(),false);assert.equal(h.leaves.length,1);assert.equal(h.navigation.getSnapshot().endingSession,true);parent.remove();
});

test("device baseline requires the same verified scope, exact content and continued persistence eligibility", () => {
  const state=input();state.scope="verified-account";state.saved={kind:"device",scope:state.scope,customCaseId:null,fingerprint:studioDepartureFingerprint(state.draft)};
  assert.equal(studioDepartureRisk(state),"clear");
  for(const change of [{scope:null},{deviceEligible:false},{prompt:"Not part of a device save"},{customCaseId:1},{draft:{...state.draft,title:"Changed after save"}}]) assert.equal(studioDepartureRisk({...state,...change}),"dirty");
});

test("unadded working input keeps an otherwise saved case dirty and prevents an unsafe same-tab sign-in", () => {
  const state=input(), h=nav();state.scope="verified-account";state.customCaseId=7;state.serverFingerprint=caseFingerprint(state.draft);state.serverPublicationFingerprint=casePublicationFingerprint(state.draft);
  const parent=actual.parent(h.navigation,state);parent.rememberStudioWorkspaceSave(state.draft,7);const saved=parent.baseline;
  assert.equal(h.navigation.risk(),"clear");
  parent.update({saved,evidencePending:true});assert.equal(h.navigation.risk(),"dirty");assert.equal(h.navigation.warnBeforeUnload(),true);
  const handler=actual.auth({draft:state.draft,evidenceBuffers:{evidence:{title:"Keep this working item",detail:"Synthetic source",relatedId:"opening"}},window:{},onAuthDeparture:()=>assert.fail("Unadded input must not approve a page departure")});
  handler.openStudioAccess(true,"save");assert.equal(handler.state.accountTabNeeded,true);assert.match(handler.state.error,/unadded working item/i);
  parent.update({saved,evidencePending:false});assert.equal(h.navigation.risk(),"clear");parent.remove();
});

test("real history guard retains anonymous Studio on Stay and completes only explicit original departure", async () => {
  const state=input(),original=structuredClone(state.draft),h=nav(),parent=actual.parent(h.navigation,state);
  let plan:DeparturePlan|undefined;h.navigation.registerDeparture((_kind,_id,next)=>{plan=next;});
  const target=new EventTarget();let cursor=0,reloads=0;const entries=[{url:"https://test.invalid/studio",state:{} as unknown}];
  const location={get href(){return entries[cursor].url;},reload(){reloads++;}};
  const history={get state(){return entries[cursor].state;},pushState(data:unknown,_unused:string,url?:string|URL|null){entries.splice(cursor+1);entries.push({state:data,url:String(url??location.href)});cursor++;},replaceState(data:unknown,_unused:string,url?:string|URL|null){entries[cursor]={state:data,url:String(url??location.href)};},go(delta:number){cursor+=delta;queueMicrotask(()=>{const event=new Event("popstate");Object.defineProperty(event,"state",{value:history.state});target.dispatchEvent(event);});}};
  const remove=installDepartureHistory(Object.assign(target,{history,location}) as unknown as Window,h.navigation);
  history.pushState({},"","https://test.invalid/studio?example=canopy");history.go(-1);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(cursor,1);assert.ok(plan?.current());assert.equal(reloads,0);assert.deepEqual(state.draft,original);assert.equal(h.navigation.warnBeforeUnload(),true);
  h.navigation.approvePageDeparture();plan!.navigate!();await new Promise(resolve=>setImmediate(resolve));assert.equal(cursor,0);assert.equal(reloads,1);assert.equal(h.navigation.warnBeforeUnload(),false);remove();parent.remove();
});

test("actual sign-in continuation approves departure only after its write; storage or navigation failure retains warning", () => {
  for(const failure of ["none","storage","navigation","private"]){
    const state=input(),h=nav(),parent=actual.parent(h.navigation,state),storage=new Map<string,string>(),events:string[]=[];
    const window={sessionStorage:{getItem(key:string){return storage.get(key)??null;},setItem(key:string,value:string){events.push("store");if(failure==="storage")throw Error("Unavailable");storage.set(key,value);}},history:{replaceState(){events.push("replace");},state:{}},location:{href:"https://test.invalid/studio?studio_step=case_map",assign(){events.push("leave");if(failure==="navigation")throw Error("Navigation unavailable");}}};
    const handler=actual.auth({draft:state.draft,prompt:"Keep this prompt",window,isPrivate:failure==="private",onAuthDeparture:(approved:boolean)=>{events.push(approved?"approve":"cancel");if(approved) h.navigation.approvePageDeparture(); else h.navigation.cancelPageDeparture();}});
    handler.openStudioAccess(true,"save");
    if(failure==="none") {assert.deepEqual(events,["store","replace","approve","leave"]);assert.equal(h.navigation.warnBeforeUnload(),false);const raw=storage.get(STUDIO_AUTH_CONTINUATION_KEY)!;const envelope=JSON.parse(raw);assert.equal(readStudioAuthContinuation(raw,envelope.id,null)?.prompt,"Keep this prompt");}
    else {assert.equal(h.navigation.warnBeforeUnload(),true);assert.equal(handler.state.accountTabNeeded,true);assert.equal(handler.state.workspace,"auth_required");if(failure!=="navigation")assert.equal(events.includes("approve"),false);}
    assert.deepEqual(state.draft,buildCanopyPackage("base").draft);parent.remove();
  }
});
