import assert from "node:assert/strict";
import {test} from "node:test";
import {NavigationController,type DeparturePlan} from "../app/navigation-controller";
import {stageCasePrompt} from "../app/matters/case-prompt-departure";
import {formatNoteBlock} from "../app/matters/note-formatting";
import {isWorkspaceDepartureClick} from "../app/departure-click";
const defer=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};
function fixture(){const nav=new NavigationController({transport:async()=>Response.json({}, {status:500}),clear:()=>{},leave:()=>{}});let plan:DeparturePlan|undefined,stored="",issue="",valid=true;nav.registerDeparture((_kind,_id,p)=>plan=p);return {nav,get plan(){return plan;},get stored(){return stored;},get issue(){return issue;},invalidate(){valid=false;},options:{navigation:nav,current:()=>valid,destination:"/studio?import=markdown",commit:(text:string)=>{stored=text;},issue:(text:string)=>{issue=text;}}};}
test("C1 import bytes commit only after exact guarded departure and Stay cancels",async()=>{
  for(const stay of [true,false]){const f=fixture();await stageCasePrompt({...f.options,file:{name:"case.md",size:10,text:async()=>"Synthetic case"}});assert.equal(f.stored,"");assert.ok(f.plan?.current());if(stay){f.plan!.cancel!();assert.equal(f.plan!.commit(),false);assert.equal(f.stored,"");}else{assert.equal(f.plan!.commit(),true);assert.equal(f.stored,"Synthetic case");assert.equal(f.plan!.commit(),false);assert.equal(f.stored,"Synthetic case");}}
});
test("C1 delayed import cannot commit after authority, case, logout or newer navigation",async()=>{
  for(const kind of ["scope","expiry","logout","navigate","new-import"]){const f=fixture(),d=defer<string>();const work=stageCasePrompt({...f.options,file:{name:"case.md",size:10,text:()=>d.promise}});if(kind==="scope")f.invalidate();else if(kind==="expiry")f.nav.invalidate("expired");else if(kind==="logout")await f.nav.signOut("en");else if(kind==="navigate")f.nav.requestDeparture("link","/templates");else await stageCasePrompt({...f.options,file:{name:"new.md",size:10,text:async()=>"New case"}});const plan=f.plan;d.resolve("Obsolete case");await work;assert.equal(f.plan,plan);assert.equal(f.stored,"");}
});
test("C1 stale confirmation, unreadable file and denied storage keep work in place",async()=>{
  const f=fixture();await stageCasePrompt({...f.options,file:{name:"case.md",size:1,text:async()=>"Case"}});f.nav.beginIntent();assert.equal(f.plan!.current(),false);assert.equal(f.plan!.commit(),false);
  const g=fixture();await stageCasePrompt({...g.options,commit:()=>{throw Error("denied");},file:{name:"case.md",size:1,text:async()=>"Case"}});assert.equal(g.plan!.commit(),false);assert.match(g.issue,/current work is unchanged/);
  const h=fixture();await stageCasePrompt({...h.options,file:{name:"case.md",size:1,text:async()=>{throw Error("File unavailable");}}});assert.match(h.issue,/File unavailable/);assert.equal(h.plan,undefined);
});
test("C1 block formatting targets lines, replaces old markers and excludes next-line boundary",()=>{
  assert.equal(formatNoteBlock("\nhello",0,0,"## ").body,"## \nhello");
  assert.deepEqual(formatNoteBlock("alpha beta",6,6,"## "),{body:"## alpha beta",start:9,end:9});
  assert.equal(formatNoteBlock("alpha beta",6,6,"## ").body,"## alpha beta");
  assert.equal(formatNoteBlock("one\ntwo\nthree",1,8,"1. ").body,"1. one\n2. two\nthree");
  assert.equal(formatNoteBlock("## title\n- item",0,15,"- [ ] ").body,"- [ ] title\n- [ ] item");
  assert.equal(formatNoteBlock("",0,0,"> [!NOTE] ").body,"> [!NOTE] ");
});
test("C1 ordinary navigation is guarded while modified clicks and downloads retain semantics",()=>{
  const e={button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false},link={href:"https://test.invalid/templates",target:"",hasAttribute:()=>false},url="https://test.invalid/matters";
  assert.equal(isWorkspaceDepartureClick(e,link,url),true);
  assert.equal(isWorkspaceDepartureClick(e,{...link,href:"https://test.invalid/signin-with-chatgpt",target:"_top"},url),false);
  for(const change of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}])assert.equal(isWorkspaceDepartureClick({...e,...change},link,url),false);
  assert.equal(isWorkspaceDepartureClick(e,{...link,target:"_blank"},url),false);assert.equal(isWorkspaceDepartureClick(e,{...link,hasAttribute:()=>true},url),false);
});

test("C1 original import is single-use even if the confirmation is repeated",async()=>{const f=fixture();let writes=0;await stageCasePrompt({...f.options,commit:()=>{writes++;},file:{name:"case.md",size:4,text:async()=>"Case"}});assert.equal(f.plan!.commit(),true);assert.equal(f.plan!.commit(),false);assert.equal(writes,1);});

test("C1 history guard restores current entry then completes original traversal without a new entry",async()=>{
  const {installDepartureHistory}=await import("../app/departure-history");
  const f=fixture();f.nav.register({}, {risk:()=>"dirty",suspend:()=>{},deny:()=>{}});
  const target=new EventTarget();let cursor=0,reloads=0;const entries=[{url:"https://test.invalid/matters?dossier=A",state:{} as unknown}];
  const location={get href(){return entries[cursor].url;},reload(){reloads++;}};
  const history={get state(){return entries[cursor].state;},pushState(data:unknown,_unused:string,url?:string|URL|null){entries.splice(cursor+1);entries.push({state:data,url:String(url??location.href)});cursor++;},replaceState(data:unknown,_unused:string,url?:string|URL|null){entries[cursor]={state:data,url:String(url??location.href)};},go(delta:number){cursor+=delta;queueMicrotask(()=>{const event=new Event("popstate");Object.defineProperty(event,"state",{value:history.state});target.dispatchEvent(event);});}};
  const host=Object.assign(target,{history,location}) as unknown as Window;
  const remove=installDepartureHistory(host,f.nav);history.pushState({},"","https://test.invalid/matters?dossier=B");
  history.go(-1);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cursor,1);assert.ok(f.plan?.current());assert.equal(entries.length,2);
  // Stay makes no change to either history entry or input ownership.
  assert.equal(reloads,0);assert.equal(location.href,"https://test.invalid/matters?dossier=B");
  f.nav.approvePageDeparture();f.plan!.navigate!();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cursor,0);assert.equal(reloads,1);assert.equal(entries.length,2);assert.equal(entries[1].url,"https://test.invalid/matters?dossier=B");remove();
});

test("C1 delayed accepted history cannot reload after expiry, sign-out or a newer intent",async()=>{
  const {installDepartureHistory}=await import("../app/departure-history");
  for(const interruption of ["expiry","signout","intent"]){
    const f=fixture();let confirmations=0,plan:DeparturePlan|undefined;
    f.nav.registerDeparture((_kind,_id,next)=>{confirmations++;plan=next;});
    f.nav.register({}, {risk:()=>"dirty",suspend:()=>{},deny:()=>{}});
    const target=new EventTarget();let cursor=0,reloads=0;
    const entries=[{url:"https://test.invalid/matters?dossier=A",state:{} as unknown}];
    const events:Array<()=>void>=[];
    const location={get href(){return entries[cursor].url;},reload(){reloads++;}};
    const history={get state(){return entries[cursor].state;},pushState(data:unknown,_unused:string,url?:string|URL|null){entries.splice(cursor+1);entries.push({state:data,url:String(url??location.href)});cursor++;},replaceState(data:unknown,_unused:string,url?:string|URL|null){entries[cursor]={state:data,url:String(url??location.href)};},go(delta:number){events.push(()=>{cursor+=delta;const event=new Event("popstate");Object.defineProperty(event,"state",{value:history.state});target.dispatchEvent(event);});}};
    const flush=()=>{while(events.length)events.shift()!();};
    const remove=installDepartureHistory(Object.assign(target,{history,location}) as unknown as Window,f.nav);
    history.pushState({},"","https://test.invalid/matters?dossier=B");history.go(-1);flush();
    assert.equal(cursor,1);assert.equal(confirmations,1);assert.ok(plan?.current());
    f.nav.approvePageDeparture();plan!.navigate!();
    if(interruption==="expiry")f.nav.invalidate("expired");
    else if(interruption==="signout")await f.nav.signOut("en");
    else f.nav.beginIntent();
    flush();
    assert.equal(reloads,0,interruption);assert.equal(cursor,1);assert.equal(entries.length,2);assert.equal(confirmations,1);
    if(interruption==="signout"){assert.equal(f.nav.getSnapshot().endingSession,true);assert.equal(f.nav.canRetrySignOut,true);}
    else assert.equal(f.nav.warnBeforeUnload(),true);
    remove();
  }
});
