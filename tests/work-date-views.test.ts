import assert from "node:assert/strict";
import test from "node:test";
import { agendaRange,moveAgenda,matchesDue,inAgenda,monthDates } from "../app/work/work-date-views";
import { zonedMoment,calendarDays } from "../app/matters/practice-scheduling";
test("month grid has complete Monday weeks, leap days and correct outside-month boundaries",()=>{
 const days=monthDates("2028-02-17");assert.equal(days.length,42);assert.equal(days[0].date,"2028-01-31");assert.equal(days.filter(d=>d.inMonth).length,29);assert.equal(days.at(-1)?.date,"2028-03-12");assert.equal(days[0].inMonth,false);assert.equal(days.find(d=>d.date==="2028-02-29")?.inMonth,true);
});
test("agenda weeks cross years; months include leap days; navigation stays calendar based",()=>{
 assert.deepEqual(agendaRange("2027-01-01","week"),{start:"2026-12-28",end:"2027-01-03"});
 assert.deepEqual(agendaRange("2028-02-28","month"),{start:"2028-02-01",end:"2028-02-29"});
 assert.equal(moveAgenda("2026-01-31","month",1),"2026-02-01");
 assert.equal(moveAgenda("2026-03-29","week",1),"2026-04-05");
 assert.equal(moveAgenda("2026-12-31","day",1),"2027-01-01");
 assert.throws(()=>agendaRange("2026-02-30","month"));
});
test("due scopes retain undated work and never mark completed work overdue",()=>{
 const item={status:"open",dueDate:"2026-11-05"};
 assert.equal(matchesDue(item,"overdue","2026-11-06","Europe/Paris"),true);
 assert.equal(matchesDue({...item,status:"completed"},"overdue","2026-11-06","Europe/Paris"),false);
 assert.equal(matchesDue({...item,dueDate:null},"undated","2026-11-06","UTC"),true);
 assert.equal(matchesDue({...item,dueDate:"2026-11-12"},"next7","2026-11-06","UTC"),true);
 assert.equal(matchesDue({...item,dueDate:"2026-11-13"},"next7","2026-11-06","UTC"),false);
});
test("display-zone dates determine event scopes; cross-boundary days remain visible",()=>{
 const item={status:"open",dueDate:"2026-11-30",timing:{start:zonedMoment("2026-11-30T23:30","America/New_York"),end:zonedMoment("2026-12-01T01:00","America/New_York")}};
 assert.equal(matchesDue(item,"today","2026-12-01","Europe/Paris"),true);
 assert.equal(matchesDue(item,"today","2026-12-01","America/New_York"),false);
 assert.ok(calendarDays(item,"America/New_York").some(day=>inAgenda(day,agendaRange("2026-12-01","day"))));
});
