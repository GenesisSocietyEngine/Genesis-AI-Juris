import assert from "node:assert/strict";
import { test } from "node:test";
import { timeGridDays,timeGridSlot,type CalendarEntry } from "../app/work/calendar-time-grid";
import { zonedMoment } from "../app/matters/practice-scheduling";
const event:CalendarEntry={id:"event",caseId:"",caseTitle:"Firm work",title:"Review",kind:"event",dueDate:"2026-11-06",timing:{start:zonedMoment("2026-11-06T23:30","America/New_York"),end:zonedMoment("2026-11-07T01:00","America/New_York")}};
test("time grid converts zones, includes continuation and excludes exact midnight end",()=>{
  assert.equal(timeGridSlot(event,"2026-11-06","America/New_York"),23);assert.equal(timeGridSlot(event,"2026-11-07","America/New_York"),0);
  assert.equal(timeGridSlot(event,"2026-11-07","Europe/Paris"),5);assert.equal(timeGridSlot(event,"2026-11-06","Europe/Paris"),null);
  const midnight={...event,timing:{...event.timing!,end:zonedMoment("2026-11-07T00:00","America/New_York")}};assert.equal(timeGridSlot(midnight,"2026-11-07","America/New_York"),null);
  assert.equal(timeGridSlot({...event,timing:null,kind:"task"},"2026-11-06","Asia/Tokyo"),"all-day");
  assert.deepEqual(timeGridDays("2027-01-01","week"),["2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02","2027-01-03"]);
});

