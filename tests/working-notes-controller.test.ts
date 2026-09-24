import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { canonicalDossierJson } from "../app/dossier-contract";
import { WorkingNotesController, type Note } from "../app/matters/working-notes-controller";
const caseId="dossier_test_case_0001", actorId="actor_test_author_0001", id="note_test_note_000001";
const defer=<T>()=>{let resolve!:(x:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
function harness(){
  let key=0, writable=true, authorized=true, denied=false, expired=false, latest:Note|null=null;
  const operations=new Map<string,unknown>(),posts:string[]=[];
  let transport:((path:string,init?:RequestInit)=>Promise<Response>)|null=null;
  let auth:()=>Promise<boolean>=async()=>authorized;
  const standard=async(path:string,init?:RequestInit):Promise<Response>=>{
    const u=new URL(path,"https://test.invalid");
    if(init?.method==="POST"){
      const raw=String(init.body),p=JSON.parse(raw);posts.push(raw);
      if(operations.has(p.idempotencyKey))return Response.json(operations.get(p.idempotencyKey));
      if(p.expectedRevision!==(latest?.revision??0))return Response.json({code:"revision_conflict",current:latest},{status:409});
      latest={id,caseId,revision:p.expectedRevision+1,title:p.title.trim(),body:p.body,type:p.type,savedAt:"2026-09-16T08:00:00Z",savedBy:actorId,savedByRole:"owner"};
      const result={note:{...latest},operation:{id:"note_event_test_00001",key:p.idempotencyKey,action:p.action,caseId,noteId:id,revision:latest.revision,actor:actorId,occurredAt:latest.savedAt,requestDigest:"sha256-"+createHash("sha256").update(canonicalDossierJson(p)).digest("hex")}};
      operations.set(p.idempotencyKey,result);return Response.json(result,{status:p.action==="create"?201:200});
    }
    const op=u.searchParams.get("operation_key");if(op)return Response.json(operations.get(op)??{}, {status:operations.has(op)?200:404});
    if(u.searchParams.has("note_id"))return Response.json({note:latest});
    return Response.json({caseId,notes:latest?[{...latest,body:undefined,caseId:undefined}]:[],nextCursor:null});
  };
  const controller=new WorkingNotesController({scope:{actorId,caseId,organizationId:"organization_test_0001",generation:1},read:(path,init)=>(transport??standard)(path,init),authorize:()=>auth(),canWrite:()=>writable,onExpired:()=>{expired=true;},onDenied:()=>{denied=true;},newKey:()=>`operation_test_${++key}`,timeoutMs:2000});
  const begin=()=>{controller.start("blank");const key=controller.getSnapshot().selected!;controller.edit(key,{title:"Test note",body:"Private draft"});return key;};
  return {controller,standard,posts,operations,begin,editor:(key:string)=>controller.getSnapshot().editors[key],setTransport:(value:typeof transport)=>transport=value,setAuth:(value:typeof auth)=>auth=value,setWritable:(v:boolean)=>writable=v,setAuthorized:(v:boolean)=>authorized=v,get latest(){return latest;},set latest(v:Note|null){latest=v;},get expired(){return expired;},get denied(){return denied;}};
}
test("C1 first save binds original payload and assigns the server ID only after receipt",async()=>{
  const h=harness(),k=h.begin();assert.equal(h.posts.length,0);await h.controller.save(k);
  assert.equal(h.editor(k).base?.id,id);assert.equal(h.editor(k).receipt?.revision,1);assert.equal(h.editor(k).phase,"confirmed");
  h.controller.edit(k,{body:"Updated"});await h.controller.save(k);assert.equal(h.editor(k).base?.revision,2);assert.equal(JSON.parse(h.posts[1]).noteId,id);
});
test("C1 response loss, recovery GET400 and missing receipt retain identical original operation",async()=>{
  const h=harness(),k=h.begin();h.setTransport(async(path,init)=>{if(init?.method==="POST"){await h.standard(path,init);throw Error("response lost");}return h.standard(path,init);});
  await h.controller.save(k);const op=h.editor(k).operation;assert.equal(h.editor(k).phase,"unknown");h.controller.edit(k,{body:"Later draft"});
  for(const status of [400,404,503]){h.setTransport(async()=>Response.json({},{status}));await h.controller.recover(k);assert.equal(h.editor(k).phase,"unknown");assert.equal(h.editor(k).operation,op);await h.controller.save(k);assert.equal(h.posts.length,1);}
  h.setTransport(null);await h.controller.recover(k,true);assert.equal(h.posts[1],h.posts[0]);assert.equal(h.editor(k).draft.body,"Later draft");assert.equal(h.editor(k).receipt?.revision,1);assert.equal(h.latest?.revision,1);
});
test("C1 edits during the write are retained separately from the acknowledged revision",async()=>{
  const h=harness(),k=h.begin(),d=defer<Response>(),started=defer<void>();h.setTransport(async(path,init)=>{if(init?.method!=="POST")return h.standard(path,init);await h.standard(path,init);started.resolve();return d.promise;});
  const saving=h.controller.save(k);await started.promise;h.controller.edit(k,{body:"New typing"});d.resolve(Response.json(h.operations.values().next().value));await saving;
  assert.equal(h.editor(k).base?.body,"Private draft");assert.equal(h.editor(k).draft.body,"New typing");
});
test("C1 save acknowledgement survives failed current-view refresh",async()=>{
  const h=harness(),k=h.begin();h.setTransport((path,init)=>init?.method==="POST"?h.standard(path,init):Promise.resolve(Response.json({},{status:500})));
  await h.controller.save(k);assert.equal(h.editor(k).phase,"confirmed");assert.match(h.editor(k).message,/Saved; latest view unavailable/);assert.equal(h.posts.length,1);
  h.controller.edit(k,{body:"New typing after confirmed save"});
  const before=h.editor(k);
  h.setTransport(null);await h.controller.refresh(k);
  const after=h.editor(k),{noteStatus}=await import("../app/matters/working-notes-controller");
  assert.doesNotMatch(after.message,/latest view unavailable/i);
  assert.equal(noteStatus(after),"Earlier version saved; your current draft has unsaved changes.");
  assert.equal(after.phase,"confirmed");assert.equal(after.base?.revision,1);
  for(const field of ["draft","base","receipt","operation","conflict"] as const)assert.equal(after[field],before[field],field);
  assert.equal(h.posts.length,1);
});
test("C1 successful same-revision read clears a reopened note warning without changing its dirty draft",async()=>{
  const {noteStatus}=await import("../app/matters/working-notes-controller");
  const h=harness();
  h.latest={id,caseId,revision:4,title:"Existing note",body:"Acknowledged content",type:"analysis",savedAt:"2026-09-16T08:00:00Z",savedBy:actorId,savedByRole:"owner"};
  await h.controller.open(id);h.controller.edit(id,{body:"Unsaved newer content"});
  const before=h.editor(id);
  assert.equal(before.receipt,null);assert.equal(noteStatus(before),"Unsaved changes");
  h.setTransport(async()=>Response.json({},{status:500}));await h.controller.refresh(id);
  assert.match(h.editor(id).message,/^Latest view unavailable\./);
  h.setTransport(null);await h.controller.refresh(id);
  const after=h.editor(id);
  assert.doesNotMatch(after.message,/latest view unavailable/i);
  assert.equal(noteStatus(after),"Unsaved changes");
  for(const field of ["draft","base","receipt","operation","conflict"] as const)assert.equal(after[field],before[field],field);
  assert.equal(h.posts.length,0);
});
test("C1 conflict requires explicit comparison choice and fresh expected revision",async()=>{
  const h=harness(),k=h.begin();await h.controller.save(k);h.controller.edit(k,{body:"Local changed"});h.latest={...h.latest!,revision:2,body:"Other author changed"};await h.controller.save(k);
  assert.equal(h.editor(k).phase,"conflict");const count=h.posts.length;await h.controller.save(k);assert.equal(h.posts.length,count);
  h.controller.resolveConflict(k,false);assert.equal(h.editor(k).draft.body,"Local changed");assert.equal(h.posts.length,count);await h.controller.save(k);assert.equal(h.editor(k).base?.revision,3);assert.equal(JSON.parse(h.posts.at(-1)!).expectedRevision,2);
});
test("C1 case disposal fences a late write from an earlier visit",async()=>{
  const h=harness(),k=h.begin(),d=defer<Response>(),started=defer<void>();h.setTransport(async(path,init)=>{if(init?.method!=="POST")return h.standard(path,init);await h.standard(path,init);started.resolve();return d.promise;});
  const work=h.controller.save(k);await started.promise;h.controller.dispose();d.resolve(Response.json(h.operations.values().next().value));await work;assert.deepEqual(h.controller.getSnapshot().editors,{});assert.equal(h.controller.getSnapshot().visible,false);
});
test("C1 expiry hides input and preserves original uncertain operation in memory",async()=>{
  const h=harness(),k=h.begin();h.setTransport(async()=>Response.json({},{status:401}));await h.controller.save(k);assert.equal(h.controller.getSnapshot().visible,false);assert.equal(h.expired,true);assert.equal(h.editor(k).phase,"unknown");assert.ok(h.editor(k).operation);
});
test("C1 private receipt404 rechecks authority after the read",async()=>{
  const h=harness(),k=h.begin();h.setTransport(async()=>{throw Error("loss");});await h.controller.save(k);let checks=0;
  h.setAuth(async()=>{checks++;if(checks===2){h.controller.dispose();return false;}return true;});h.setTransport(async()=>Response.json({},{status:404}));await h.controller.recover(k);
  assert.equal(checks,2);assert.equal(h.controller.getSnapshot().visible,false);assert.deepEqual(h.controller.getSnapshot().editors,{});
});
test("C1 missing exact note preserves an unrelated authorized draft",async()=>{
  const h=harness(),k=h.begin();h.setTransport(async()=>Response.json({},{status:404}));await h.controller.open("note_missing_000001");assert.equal(h.editor(k).draft.body,"Private draft");assert.equal(h.controller.getSnapshot().visible,true);
});
test("C1 read-only role cannot start or save, including role loss before save",async()=>{
  const h=harness();h.setWritable(false);h.controller.start("blank");assert.equal(h.controller.getSnapshot().selected,null);h.setWritable(true);const k=h.begin();h.setAuth(async()=>{h.setWritable(false);return true;});await h.controller.save(k);assert.equal(h.posts.length,0);assert.match(h.editor(k).message,/role cannot save/);
});
test("C1 historical selection rejects reversed responses and typing cancels history",async()=>{
  const h=harness(),k=h.begin();await h.controller.save(k);const a=defer<Response>(),b=defer<Response>();h.setTransport(async path=>new URL(path,"https://test.invalid").searchParams.get("revision")==="1"?a.promise:b.promise);
  const first=h.controller.historical(k,1),second=h.controller.historical(k,2);b.resolve(Response.json({note:{...h.latest,revision:2,body:"Second"}}));await second;a.resolve(Response.json({note:h.latest}));await first;assert.equal(h.editor(k).historical?.revision,2);
  const c=defer<Response>();h.setTransport(()=>c.promise);const last=h.controller.historical(k,1);h.controller.edit(k,{body:"Typing"});c.resolve(Response.json({note:h.latest}));await last;assert.equal(h.editor(k).historical,null);
});
test("C1 reopening refreshes changed saved content without replacing local input",async()=>{
  const h=harness(),k=h.begin();await h.controller.save(k);h.controller.edit(k,{body:"Local draft"});h.controller.returnToList();h.latest={...h.latest!,revision:2,body:"Remote version"};await h.controller.open(id);assert.equal(h.editor(k).conflict?.revision,2);assert.equal(h.editor(k).draft.body,"Local draft");
});
test("C1 old refresh failure cannot replace newer save feedback",async()=>{
  const h=harness(),k=h.begin();await h.controller.save(k);const slow=defer<Response>();h.setTransport(()=>slow.promise);const first=h.controller.refresh(k);h.controller.edit(k,{body:"Second"});h.setTransport(null);await h.controller.save(k);const message=h.editor(k).message;slow.resolve(Response.json({},{status:500}));await first;assert.equal(h.editor(k).message,message);assert.equal(h.editor(k).receipt?.revision,2);
});

test("C1 reopening cannot resolve a lost write from current-note data alone",async()=>{
  const h=harness(),k=h.begin();await h.controller.save(k);h.controller.edit(k,{body:"Committed later"});h.setTransport(async(path,init)=>{const result=await h.standard(path,init);if(init?.method==="POST")throw Error("loss");return result;});await h.controller.save(k);const original=h.editor(k).operation;
  assert.equal(h.editor(k).phase,"unknown");h.controller.returnToList();await h.controller.open(id);await h.controller.refresh(k);assert.equal(h.editor(k).phase,"unknown");assert.equal(h.editor(k).operation,original);assert.equal(h.controller.pending,true);
  h.setTransport(null);await h.controller.recover(k);assert.equal(h.editor(k).receipt?.revision,2);
});

test("C1 amended indicator follows reopened title/body/type changes and reversions",async()=>{
  const {noteStatus}=await import("../app/matters/working-notes-controller");
  const h=harness(),k=h.begin();await h.controller.save(k);h.controller.discard(k);await h.controller.open(id);
  for(const change of [{title:"Changed"},{body:"Changed"},{type:"meeting" as const}]){
    h.controller.edit(id,change);assert.match(noteStatus(h.editor(id)),/Unsaved/);
    h.controller.edit(id,{title:h.latest!.title,body:h.latest!.body,type:h.latest!.type});assert.match(noteStatus(h.editor(id)),/Confirmed/);
  }
});
test("C1 comparison and feedback reject older refresh success and failure",async()=>{
  const h=harness(),k=h.begin();await h.controller.save(k);
  for(const status of [200,500]){
    const earlier=defer<Response>(),later=defer<Response>();let reads=0;h.setTransport(()=>++reads===1?earlier.promise:later.promise);
    const a=h.controller.refresh(k),b=h.controller.refresh(k);
    later.resolve(Response.json({note:{...h.latest,revision:3,body:"Revision three"}}));await b;const message=h.editor(k).message;
    earlier.resolve(Response.json({note:{...h.latest,revision:2}},{status}));await a;
    assert.equal(h.editor(k).conflict?.revision,3);assert.equal(h.editor(k).message,message);
  }
  h.setTransport(async()=>Response.json({note:{...h.latest,revision:2}}));await h.controller.refresh(k);assert.equal(h.editor(k).conflict?.revision,3);
  const pending=defer<Response>();h.setTransport(()=>pending.promise);const work=h.controller.refresh(k);h.controller.resolveConflict(k,false);pending.resolve(Response.json({note:{...h.latest,revision:4}}));await work;assert.equal(h.editor(k).base?.revision,3);assert.equal(h.editor(k).conflict,null);
});
test("C1 display prioritizes uncertainty and retains newer typing after confirmed submission",async()=>{
  const {noteStatus}=await import("../app/matters/working-notes-controller");const h=harness(),k=h.begin(),d=defer<Response>(),started=defer<void>();
  h.setTransport(async(path,init)=>{if(init?.method!=="POST")return h.standard(path,init);const result=await h.standard(path,init);started.resolve();await d.promise;return result;});
  const saving=h.controller.save(k);await started.promise;h.controller.edit(k,{body:"Newer text"});assert.match(noteStatus(h.editor(k)),/Saving/);d.resolve(Response.json({}));await saving;assert.match(noteStatus(h.editor(k)),/current draft has unsaved/);assert.equal(h.editor(k).draft.body,"Newer text");
  h.setTransport(async()=>{throw Error("response loss");});await h.controller.save(k);assert.match(noteStatus(h.editor(k)),/Uncertain/);
});
