import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDays, localAt, readTiming, recurrenceDates, reminderDue, scheduleLabel, shiftReminder, zonedMoment } from "../app/matters/practice-scheduling";
import { changePracticePlan, EMPTY_PLAN, parsePracticePlan, type PracticeItem } from "../app/matters/practice-plan";

const base = { kind:"task" as const,title:"Review sources",description:"Synthetic only",dueDate:"2026-01-31",assignee:null,priority:"normal" as const,status:"open" as const,checklist:[{title:"Read",done:true}] };
test("timezone conversion rejects gaps and requires an explicit repeated-time choice",()=>{
  assert.throws(()=>zonedMoment("2026-03-29T02:30","Europe/Paris"),/does not exist/);
  assert.throws(()=>zonedMoment("2026-10-25T02:30","Europe/Paris"),/occurs twice/);
  assert.equal(zonedMoment("2026-10-25T02:30","Europe/Paris","earlier").at,"2026-10-25T00:30:00.000Z");
  assert.equal(zonedMoment("2026-10-25T02:30","Europe/Paris","later").at,"2026-10-25T01:30:00.000Z");
  assert.throws(()=>zonedMoment("2026-03-08T02:30","America/New_York"),/does not exist/);
  assert.equal(zonedMoment("2026-11-01T01:30","America/New_York","later").at,"2026-11-01T06:30:00.000Z");
  assert.equal(zonedMoment("2026-11-06T09:00","Asia/Kathmandu").at,"2026-11-06T03:15:00.000Z");
  const earlier=zonedMoment("2026-04-05T01:45","Australia/Lord_Howe","earlier"),later=zonedMoment("2026-04-05T01:45","Australia/Lord_Howe","later");
  assert.equal(Date.parse(later.at)-Date.parse(earlier.at),30*60000);
  assert.throws(()=>zonedMoment("2026-11-06T09:00","Invalid/Zone"),/timezone/);
  assert.throws(()=>zonedMoment("2026-02-30T09:00","UTC"),/valid/);
});
test("timed events span display days, midnight is exclusive and UTC cannot be forged",()=>{
  const timing={start:zonedMoment("2026-11-30T23:30","America/New_York"),end:zonedMoment("2026-12-01T01:00","America/New_York")};
  assert.deepEqual(calendarDays({dueDate:"2026-11-30",timing},"America/New_York"),["2026-11-30","2026-12-01"]);
  assert.deepEqual(calendarDays({dueDate:"2026-11-30",timing},"Europe/Paris"),["2026-12-01"]);
  assert.deepEqual(calendarDays({dueDate:"2026-11-30",timing:{...timing,end:zonedMoment("2026-12-01T00:00","America/New_York")}},"America/New_York"),["2026-11-30"]);
  assert.throws(()=>readTiming({...timing,start:{...timing.start,at:"2026-11-30T23:30:00.000Z"}}),/UTC/);
  assert.throws(()=>readTiming({start:timing.end,end:timing.start}),/follow/);
  assert.match(scheduleLabel({dueDate:"2026-11-30",timing},"Europe/Paris"),/2026-12-01 05:30/);
});
test("monthly recurrence remains anchored and reminders keep local time across DST",()=>{
  assert.deepEqual(recurrenceDates("2028-01-31",{frequency:"monthly",interval:1,count:4}),["2028-01-31","2028-02-29","2028-03-31","2028-04-30"]);
  assert.deepEqual(recurrenceDates("2026-11-06",{frequency:"weekly",interval:2,count:3}),["2026-11-06","2026-11-20","2026-12-04"]);
  const reminder={...zonedMoment("2026-03-28T09:00","Europe/Paris"),state:"active" as const};
  const next=shiftReminder(reminder,"2026-03-28","2026-03-29");assert.equal(next.local,"2026-03-29T09:00");assert.equal(Date.parse(next.at)-Date.parse(reminder.at),23*3600000);
  assert.throws(()=>shiftReminder({...zonedMoment("2026-03-28T02:30","Europe/Paris"),state:"active"},"2026-03-28","2026-03-29"),/does not exist/);
});
test("series saves independently; reminders dismiss/snooze without completing work; old writes fail closed",()=>{
  let serial=0;const id=()=>`work_${++serial}`;
  const item={...base,reminder:{...zonedMoment("2026-01-31T09:00","Europe/Paris"),state:"active" as const}};
  const plan=changePracticePlan(EMPTY_PLAN,{action:"create_series",item,recurrence:{frequency:"monthly",interval:1,count:3}},id);
  assert.equal(plan.schedulingVersion,1);assert.equal(plan.items.length,3);assert.equal(new Set(plan.items.map(i=>i.id)).size,3);assert.equal(new Set(plan.items.map(i=>i.series!.id)).size,1);
  assert.ok(plan.items.every(i=>!i.checklist[0].done&&i.status==="open"));assert.deepEqual(parsePracticePlan(plan),plan);
  const now=Date.parse("2026-02-01T12:00:00Z");assert.equal(reminderDue(plan.items[0],now),true);
  const dismissed=changePracticePlan(plan,{action:"reminder",id:plan.items[0].id,reminderAction:"dismiss"},id,undefined,now);
  assert.equal(dismissed.items[0].status,"open");assert.equal(reminderDue(dismissed.items[0],now),false);assert.equal(plan.items[0].reminder!.state,"active");
  const snoozed=changePracticePlan(dismissed,{action:"reminder",id:plan.items[0].id,reminderAction:"snooze"},id,undefined,now);
  assert.equal(snoozed.items[0].reminder!.at,"2026-02-01T13:00:00.000Z");assert.equal(localAt(snoozed.items[0].reminder!.at,"Europe/Paris"),"2026-02-01T14:00");
  assert.throws(()=>changePracticePlan(plan,{action:"update",id:plan.items[0].id,item:base},id),/current editor/);
  const updated=changePracticePlan(plan,{action:"update",id:plan.items[0].id,item:{...item,status:"completed"}},id);
  assert.deepEqual(updated.items.slice(1),plan.items.slice(1));assert.equal(reminderDue(updated.items[0],now),false);
  assert.throws(()=>changePracticePlan({...EMPTY_PLAN,items:Array.from({length:199},(_,index)=>({...base,id:`old_${index}`,workflow:null} as PracticeItem))},{action:"create_series",item:base,recurrence:{frequency:"daily",interval:1,count:2}},id),/200/);
  assert.throws(()=>recurrenceDates("2026-01-01",{frequency:"daily",interval:1,count:53}),/52/);
});
