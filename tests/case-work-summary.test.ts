import test from "node:test";
import assert from "node:assert/strict";
import {caseWorkSummary} from "../app/work/case-work-summary";
import {zonedMoment} from "../app/matters/practice-scheduling";
import type {PracticeItem} from "../app/matters/practice-plan";
import type {FirmCase} from "../app/work/work-controller";
const work=(id:string,dueDate:string|null,fields:Partial<PracticeItem>={}):PracticeItem=>({id,dueDate,title:id,kind:"task",description:"",status:"open",assignee:"person",priority:"normal",workflow:null,checklist:[],...fields});
const matter=(items:PracticeItem[],id="case"):FirmCase=>({id,title:id,participants:[],plan:{revision:0,items}});
test("case summary separates overdue from next work and preserves zero-work cases",()=>{
 const rows=caseWorkSummary([matter([work("old","2026-11-05"),work("today","2026-11-06"),work("later","2026-11-08"),work("no-date",null,{assignee:null}),work("done","2026-11-01",{status:"completed",assignee:null})]),matter([],"empty")],Date.parse("2026-11-06T12:00Z"),"Europe/Paris");
 const row=rows[0];assert.equal(row.nextTask?.id,"today");assert.equal(row.open,4);assert.equal(row.completed,1);assert.equal(row.overdue,1);assert.equal(row.undated,1);assert.equal(row.unassigned,1);assert.equal(row.needsAttention,true);assert.equal(rows[1].open,0);assert.equal(rows[1].nextTask,null);assert.equal(rows[1].needsAttention,false);
});
test("ongoing cross-day events remain next until their exclusive end, in the display timezone",()=>{
 const event=work("ongoing","2026-11-06",{kind:"event",timing:{start:zonedMoment("2026-11-06T23:30","America/New_York"),end:zonedMoment("2026-11-07T01:00","America/New_York")}});
 const c=matter([event,work("later","2026-11-08",{kind:"event"}),work("past","2026-11-05",{kind:"event"}),work("undated",null,{kind:"event"})]);
 assert.equal(caseWorkSummary([c],Date.parse("2026-11-07T05:30Z"),"Europe/Paris")[0].nextEvent?.id,"ongoing");assert.equal(caseWorkSummary([c],Date.parse(event.timing!.end.at),"Europe/Paris")[0].nextEvent?.id,"later");
});
test("today uses display timezone near UTC midnight; all-day dates remain fixed",()=>{
 const c=matter([work("task","2026-11-06"),work("all-day","2026-11-06",{kind:"event"})]);
 const now=Date.parse("2026-11-07T00:30Z");const west=caseWorkSummary([c],now,"America/New_York")[0],east=caseWorkSummary([c],now,"Europe/Paris")[0];
 assert.equal(west.overdue,0);assert.equal(west.nextEvent?.id,"all-day");assert.equal(east.overdue,1);assert.equal(east.nextTask,null);assert.equal(east.nextEvent,null);
});
