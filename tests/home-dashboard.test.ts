import assert from "node:assert/strict";
import test from "node:test";
import { homeDashboard } from "../app/work/home-dashboard";
import { workState, distinctLabels } from "../app/work/work-presentation";
import { firmHarness } from "./fixtures/firm-work";
import { zonedMoment } from "../app/matters/practice-scheduling";

test("Home totals and lists come from saved accessible work without mutating it", () => {
  const { cases } = firmHarness({ overview: true, applications: true });
  const before = JSON.stringify(cases);
  const result = homeDashboard(cases, Date.parse("2026-11-06T12:00:00Z"), "Europe/Brussels");
  assert.equal(result.cases.length, 27);
  assert.equal(result.open.length, 25);
  assert.equal(result.overdue.length, 1);
  assert.equal(result.overdue[0].caseId, "case_2");
  assert.ok(result.dueToday.every(i => i.status === "open"));
  assert.ok(result.upcoming.every(i => i.kind === "event" && i.status === "open"));
  assert.equal(JSON.stringify(cases), before);
  assert.equal(homeDashboard([], Date.now(), "UTC").open.length, 0);
});

test("Home retains ongoing cross-day events and excludes ended events from upcoming", () => {
  const { cases } = firmHarness();
  const event = cases[0].plan.items[0];
  event.timing = { start: zonedMoment("2026-11-05T23:30", "America/New_York"), end: zonedMoment("2026-11-06T01:00", "America/New_York") };
  const result = homeDashboard([cases[0]], Date.parse("2026-11-06T05:00:00Z"), "Europe/Brussels");
  assert.equal(result.dueToday.length, 1);
  assert.equal(result.upcoming.length, 1);
  assert.equal(result.overdue.length, 0);
  assert.equal(homeDashboard([cases[0]], Date.parse("2026-11-06T07:00:00Z"), "Europe/Brussels").upcoming.length, 0);
});

test("status labels distinguish completed work, late tasks and past events", () => {
  const task = {kind:"task",status:"open",dueDate:"2026-11-05"};
  assert.equal(workState(task,"2026-11-06","UTC"),"overdue");
  assert.equal(workState({...task,kind:"event"},"2026-11-06","UTC"),"past");
  assert.equal(workState({...task,status:"completed"},"2026-11-06","UTC"),"completed");
  assert.equal(workState({...task,dueDate:null},"2026-11-06","UTC"),"open");
  assert.equal(workState({...task,kind:"event",dueDate:null},"2026-11-06","UTC"),"open", "an undated event is not scheduled");
  assert.equal(workState({...task,dueDate:"2026-11-06"},"2026-11-06","UTC"),"today");
});

test("human labels hide routine IDs while duplicate names retain distinct exact identities", () => {
  const result = distinctLabels([{id:"same_suffix",name:"Alex"},{id:"other_suffix",name:"Alex"},{id:"unique",name:"Case review"}]);
  assert.equal(result.get("unique"),"Case review");
  assert.notEqual(result.get("same_suffix"),result.get("other_suffix"));
  assert.match(result.get("same_suffix")!,/same_suffix/);
});
