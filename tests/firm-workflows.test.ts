import test from "node:test";
import assert from "node:assert/strict";
import {firmWorkflows} from "../app/work/firm-workflows";
import type {FirmCase} from "../app/work/work-controller";
import type {PracticeItem} from "../app/matters/practice-plan";
const work=(id:string,workflow:string|null,status:PracticeItem["status"]="open"):PracticeItem=>({id,workflow,status,title:"Same title",description:"",dueDate:null,assignee:null,priority:"normal",checklist:[],kind:"task"});
const matter=(id:string,items:PracticeItem[]):FirmCase=>({id,title:id,participants:[],plan:{revision:0,items}});
test("applied workflow grouping preserves case, version and anchor identities with exact recorded completion",()=>{
 const rows=firmWorkflows([matter("a",[work("1","custom@2:2026-11-06","completed"),work("2","custom@2:2026-11-06"),work("3","custom@3:2026-11-06"),work("4","custom@2:2026-11-07"),work("5",null)]),matter("b",[work("1","custom@2:2026-11-06")])]);
 assert.equal(rows.length,4);const group=rows.find(r=>r.caseId==="a"&&r.anchor==="2026-11-06"&&r.version==="2")!;assert.equal(group.completed,1);assert.equal(group.items.length,2);assert.equal(rows.filter(r=>r.caseId==="b").length,1);
});
test("unknown historical source remains inspectable without fabricated version or anchor",()=>{
 const rows=firmWorkflows([matter("a",[work("1","legacy:invalid"),work("2","intake-v1:2026-11-06")])],"ru");
 assert.equal(rows.find(r=>r.source==="legacy")?.anchor,null);assert.equal(rows.find(r=>r.source==="legacy")?.version,null);assert.equal(rows.find(r=>r.version==="1")?.title,"Приём клиента");assert.deepEqual(firmWorkflows([]),[]);
});
