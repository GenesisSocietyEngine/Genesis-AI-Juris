import assert from "node:assert/strict";
import { test } from "node:test";
import { LibraryController } from "../app/library/library-controller";
import { firmDocumentFields, firmObjectKey } from "../app/library/firm-document-model";
import { workspaceDestination } from "../app/workspace-navigation";
import { firmHarness } from "./fixtures/firm-work";

test("firm upload retains the exact file operation through lost response, expiry and refresh failure",async()=>{
  const h=firmHarness();await h.start();let fail=false,lose=true;const posts:FormData[]=[];
  const c=new LibraryController(h.navigation,async(_path,init)=>{
    if(init?.method==="POST"){const body=init.body as FormData;posts.push(body);if(lose){lose=false;throw Error("Lost response");}return Response.json({operation:body.get("operationKey")});}
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
