import assert from "node:assert/strict";
import { test } from "node:test";
import { WorkController } from "../app/work/work-controller";
import { firmHarness } from "./fixtures/firm-work";
const fields = { title: "Synthetic review", archived: false, steps: [{ title: "Review sources", kind: "task" as const, days: -2 }] };
test("firm view publishes all pages, drops partial failures and retains same-actor drafts", async()=>{
  const h=firmHarness(); await h.start(); const stop=h.controller.attach(); await h.controller.refresh();
  assert.equal(h.controller.getSnapshot().cases.length,27);
  h.controller.edit();h.controller.update(fields);assert.equal(h.navigation.risk(),"dirty");
  h.externalEdit(); await h.controller.refresh();
  assert.equal(h.controller.getSnapshot().draft!.expectedRevision,0);assert.equal(h.controller.getSnapshot().library.revision,1);assert.equal(await h.controller.save(),false);
  h.controller.compare();assert.equal(await h.controller.save(),true);assert.equal(h.read().templates.length,2);
  h.failRead(true);await h.controller.refresh();assert.equal(h.controller.getSnapshot().loaded,false);assert.deepEqual(h.controller.getSnapshot().cases,[]);
  stop();
});
test("uncertain template saves replay exactly and revocation removes private work",async()=>{
  const h=firmHarness(); await h.start(); const stop=h.controller.attach();await h.controller.refresh();
  h.controller.edit();h.controller.update(fields);h.loseNext();assert.equal(await h.controller.save(),false);
  assert.equal(h.navigation.risk(),"pending");h.controller.update({...fields,title:"Replacement"});assert.equal(h.controller.getSnapshot().draft!.template.title,fields.title);
  h.navigation.invalidate("expired");assert.equal(h.controller.getSnapshot().cases.length,0);assert.ok(h.controller.getSnapshot().pending);
  await h.navigation.refresh();await h.controller.refresh();assert.equal(await h.controller.save(),true);
  assert.equal(h.posts[0],h.posts[1]);assert.equal(h.read().templates.length,1);
  h.controller.edit();h.controller.update(fields);h.navigation.invalidate("denied");assert.equal(h.controller.getSnapshot().draft,null);assert.equal(h.controller.getSnapshot().library.templates.length,0);stop();
});

test("a late firm response cannot restore cases after authority loss", async()=>{
  const h=firmHarness();await h.start();
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const owner=new WorkController(h.navigation,async(path,init)=>{if(path==="/api/work")await gate;return h.transport(path,init);});
  const stop=owner.attach();const loading=owner.refresh();h.navigation.invalidate("denied");release();await loading;
  assert.deepEqual(owner.getSnapshot().cases,[]);assert.equal(owner.getSnapshot().loaded,false);stop();
});
test("organization denial during refresh clears template drafts and library",async()=>{
  const h=firmHarness();await h.start();let deny=false;
  const owner=new WorkController(h.navigation,(path,init)=>deny?Promise.resolve(Response.json({}, {status:404})):h.transport(path,init));
  const stop=owner.attach();await owner.refresh();owner.edit();owner.update(fields);deny=true;await owner.refresh();
  assert.equal(h.navigation.getSnapshot().phase,"denied");assert.equal(owner.getSnapshot().draft,null);assert.equal(owner.getSnapshot().library.templates.length,0);stop();
});
