import assert from "node:assert/strict";
import test from "node:test";
import { practiceHarness } from "./fixtures/practice-owner";
const create={action:"create",item:{kind:"task",title:"Synthetic task",description:"",dueDate:null,assignee:null,priority:"normal",status:"open",checklist:[]}};
test("lost response retains original operation across sections and recovers without duplication",async()=>{
  const h=practiceHarness();await h.start();h.loseNext();
  assert.equal(await h.owner.savePractice(create),false);
  assert.equal(h.owner.departureRisk(),"pending");
  h.owner.navigate("calendar");h.owner.reviewBeforeLeaving();assert.equal(h.owner.getSnapshot().destination,"tasks");
  assert.equal(await h.owner.savePractice(),true);
  assert.equal(h.posts[0],h.posts[1]);assert.equal(h.read().items.length,1);assert.equal(h.owner.departureRisk(),"clear");h.owner.dispose();
});
test("drafts survive tab navigation and private plan clears on account revocation",async()=>{
  const h=practiceHarness();await h.start();await h.owner.savePractice(create);
  h.owner.rememberDraft("practice-editor","unsaved","");h.owner.navigate("workflows");
  assert.equal(h.owner.draft("practice-editor"),"unsaved");assert.equal(h.owner.departureRisk(),"dirty");
  h.owner.revokeAuthority();assert.equal(h.owner.practice.plan.items.length,0);assert.equal(h.owner.draft("practice-editor"),undefined);
  assert.equal(await h.owner.savePractice(create),false);h.owner.dispose();
});
test("an editor's original revision remains authoritative after a list refresh",async()=>{
  const h=practiceHarness();await h.start();await h.owner.savePractice(create);await h.owner.loadPractice();
  assert.equal(await h.owner.savePractice({...create,expectedRevision:0}),false);
  assert.equal(JSON.parse(h.posts[1]).expectedRevision,0);
  assert.equal(h.read().items.length,1);assert.equal(h.owner.practice.pending,null);h.owner.dispose();
});
