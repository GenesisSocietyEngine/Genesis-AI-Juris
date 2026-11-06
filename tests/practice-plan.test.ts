import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { changePracticePlan, EMPTY_PLAN, validPracticeDate, workflowPreview, type PracticeItem } from "../app/matters/practice-plan";
const item={kind:"task",title:"Prepare report",description:"",dueDate:null,assignee:null,priority:"normal",status:"open",checklist:[{title:"Review sources",done:false}]};
test("workflow preview handles month/leap boundaries without mutating a plan",()=>{
  assert.equal(workflowPreview("intake-v1","2028-02-28")[2].dueDate,"2028-03-01");
  assert.equal(validPracticeDate("2026-02-30"),false);
  assert.equal(EMPTY_PLAN.items.length,0);
  let id=0; const next=changePracticePlan(EMPTY_PLAN,{action:"apply_workflow",templateId:"intake-v1",anchor:"2026-11-05"},()=>`item-${++id}`);
  assert.equal(new Set(next.items.map(i=>i.id)).size,4);
  assert.throws(()=>changePracticePlan(next,{action:"apply_workflow",templateId:"intake-v1",anchor:"2026-11-05"},()=>"duplicate"),/already applied/);
});
test("completion is explicit and checklist updates preserve original history",()=>{
  const first=changePracticePlan(EMPTY_PLAN,{action:"create",item},()=>"one");
  const changed=changePracticePlan(first,{action:"update",id:"one",item:{...item,checklist:[{title:"Review sources",done:true}]}},()=>"unused");
  assert.equal(changed.items[0].status,"open"); assert.equal(first.items[0].checklist[0].done,false);
  assert.throws(()=>changePracticePlan(first,{action:"update",id:"foreign",item},()=>"unused"),/not in/);
  assert.throws(()=>changePracticePlan(first,{action:"create",item:{...item,kind:"event"}},()=>"two"),/needs a date/);
  assert.throws(()=>changePracticePlan(first,{action:"create",item:{...item,actor:"foreign"}},()=>"two"),/Unsupported/);
});
test("work plan bounds are enforced without dropping prior work",()=>{
  const full={revision:1,items:Array.from({length:200},(_,i)=>({...item,id:String(i),workflow:null}) as PracticeItem)};
  assert.throws(()=>changePracticePlan(full,{action:"create",item},()=>"overflow"),/200/);
  assert.equal(full.items.length,200);
});
test("database revisions reject stale saves, removed writers, duplicate operations and history changes",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE dossiers(id text PRIMARY KEY); CREATE TABLE dossier_participants(dossier_id text, actor_id text, status text, role text); INSERT INTO dossiers VALUES('case-a'),('case-b'); INSERT INTO dossier_participants VALUES('case-a','alice','active','owner'),('case-a','bob','active','viewer');");
  for(const statement of readFileSync(new URL("../drizzle/0024_practice_plans.sql",import.meta.url),"utf8").split("--> statement-breakpoint"))db.exec(statement);
  const insert=db.prepare("INSERT INTO dossier_practice_revisions VALUES(?,?,?,?,?,?,?)");
  const save=(revision:number,actor="alice",key="save-one",caseId="case-a")=>insert.run(caseId,revision,actor,key,"digest",JSON.stringify({revision,items:[]}),"2026-11-05T12:00:00.000Z");
  save(1);
  assert.throws(()=>save(1,"alice","stale"),/practice_revision_conflict/);
  assert.throws(()=>save(2,"bob","viewer"),/practice_authority/);
  assert.throws(()=>save(2),/UNIQUE/);
  assert.throws(()=>save(1,"alice","foreign","case-b"),/practice_authority/);
  db.exec("UPDATE dossier_participants SET status='removed' WHERE actor_id='alice'");
  assert.throws(()=>save(2,"alice","revoked"),/practice_authority/);
  assert.throws(()=>db.exec("DELETE FROM dossier_practice_revisions"),/immutable/);
  assert.throws(()=>db.exec("UPDATE dossier_practice_revisions SET plan='{}'"),/immutable/);
  assert.equal(db.prepare("SELECT count(*) n FROM dossier_practice_revisions").get()?.n,1);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);db.close();
});
