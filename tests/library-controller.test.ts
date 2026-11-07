import assert from "node:assert/strict";
import { test } from "node:test";
import { LibraryController } from "../app/library/library-controller";
import { firmDocumentFields, firmObjectKey } from "../app/library/firm-document-model";
import { workspaceDestination } from "../app/workspace-navigation";
import { firmHarness } from "./fixtures/firm-work";

const saved={id:"firm_doc_"+"a".repeat(64),version:1,title:"Policy",folder:"",filename:"policy.txt",mediaType:"text/plain",bytes:9,occurredAt:"2026-11-07T08:00:00.000Z"};

test("firm upload retains the exact file operation through lost response, expiry and refresh failure",async()=>{
  const h=firmHarness();await h.start();let fail=false,lose=true;const posts:FormData[]=[];
  const c=new LibraryController(h.navigation,async(_path,init)=>{
    if(init?.method==="POST"){const body=init.body as FormData;posts.push(body);if(lose){lose=false;throw Error("Lost response");}return Response.json({operation:body.get("operationKey"),document:saved});}
    if(fail)return Response.json({},{status:503});return Response.json({scope:h.org.selection,documents:[],nextCursor:null,canWrite:true});
  });
  const stop=c.attach();await c.refresh();c.edit();c.update({...c.getSnapshot().draft!,title:"Policy",file:new File(["Synthetic"],"policy.txt",{type:"text/plain"}),mediaType:"text/plain",acknowledged:true});
  assert.equal(await c.upload(),false);assert.equal(h.navigation.risk(),"pending");
  fail=true;await c.refresh();assert.ok(c.getSnapshot().pending);assert.equal(c.getSnapshot().draft?.title,"Policy");
  h.navigation.invalidate("expired");assert.ok(c.getSnapshot().pending);fail=false;await h.navigation.refresh();await c.refresh();assert.equal(await c.upload(),true);assert.equal(posts[0],posts[1]);assert.equal(c.getSnapshot().draft,null);
  c.edit();h.navigation.invalidate("denied");assert.equal(c.getSnapshot().draft,null);assert.equal(c.getSnapshot().documents.length,0);stop();
});

test("late document list cannot restore revoked private content",async()=>{
  const h=firmHarness();await h.start();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const c=new LibraryController(h.navigation,async()=>{await gate;return Response.json({scope:h.org.selection,documents:[{title:"Private"}],nextCursor:null,canWrite:true});});
  const stop=c.attach();const request=c.refresh();h.navigation.invalidate("denied");release();await request;assert.deepEqual(c.getSnapshot().documents,[]);assert.equal(c.getSnapshot().loaded,false);stop();
});

test("firm file identity rejects traversal, wrong version and unsafe storage scope",()=>{
  const fields={title:"Policy",folder:"Policies / Team",operationKey:"original-upload",expectedVersion:"0"};
  assert.equal(firmDocumentFields(fields).folder,"Policies/Team");
  assert.throws(()=>firmDocumentFields({...fields,folder:"../other"}));
  assert.throws(()=>firmDocumentFields({...fields,id:`firm_doc_${"a".repeat(64)}`}));
  assert.throws(()=>firmObjectKey("org/foreign",`firm_doc_${"a".repeat(64)}`,1,"b".repeat(64)));
});

test("Library navigation retains the exact case and saved Studio return context",()=>{
 const current="/matters?organization=org_A&dossier=case_A&studio_case=51";
 const library=workspaceDestination("/library?view=firm",current);const target=new URL(workspaceDestination("/studio",library),"https://test.invalid");
 assert.equal(target.searchParams.get("custom_case"),"51");assert.equal(target.searchParams.get("return_to"),current);assert.equal(target.searchParams.get("organization"),"org_A");
});

test("a mismatched receipt never clears an uncertain upload; exact readback confirms without a resend",async()=>{
 const h=firmHarness();await h.start();let writes=0,key="",wrong=true;
 const c=new LibraryController(h.navigation,async(path,init)=>{
  if(init?.method==="POST"){writes++;key=String((init.body as FormData).get("operationKey"));throw Error("Response lost");}
  if(path.includes("?operation="))return Response.json({scope:h.org.selection,operation:key,state:"committed",document:{...saved,bytes:wrong?70:saved.bytes}});
  return Response.json({scope:h.org.selection,documents:[],canWrite:true,nextCursor:null});
 });const stop=c.attach();await c.refresh();c.edit();c.update({...c.getSnapshot().draft!,title:"Policy",file:new File(["Synthetic"],"policy.txt",{type:"text/plain"}),mediaType:"text/plain",acknowledged:true});assert.equal(await c.upload(),false);
 await c.checkSaved();assert.ok(c.getSnapshot().pending);wrong=false;await c.checkSaved();assert.equal(writes,1);assert.equal(c.getSnapshot().draft,null);assert.equal(h.navigation.risk(),"clear");stop();
});
test("a stale version requires explicit comparison and a resumed upload retains its original identity",async()=>{
 const h=firmHarness();await h.start();let version=1,readOnly=false;
 const item={key:"resume-original",id:saved.id,expectedVersion:1,title:saved.title,folder:saved.folder,filename:saved.filename};
 const c=new LibraryController(h.navigation,async()=>Response.json({scope:h.org.selection,documents:[{...saved,version}],incomplete:[item],folders:["Empty"],canWrite:!readOnly,nextCursor:null}));
 const stop=c.attach();await c.refresh();assert.deepEqual(c.getSnapshot().folders,["Empty"]);c.edit(saved);c.update({...c.getSnapshot().draft!,file:new File(["Synthetic"],"policy.txt"),acknowledged:true});version=2;await c.refresh();assert.ok(c.stale());assert.equal(c.canSave(),false);c.compare();assert.equal(c.getSnapshot().draft?.expectedVersion,2);assert.equal(c.canSave(),true);
 c.discard();c.resume(item);assert.ok(c.stale());c.compare();assert.equal(c.getSnapshot().draft?.expectedVersion,1);assert.equal(c.canSave(),false);c.discard();readOnly=true;await c.refresh();c.editFolder();assert.equal(c.getSnapshot().draft,null);stop();
});
