import { test } from "node:test";
import assert from "node:assert/strict";
import { changePracticePlan, EMPTY_PLAN, PRACTICE_WORKFLOWS } from "../app/matters/practice-plan";
import {
  milestoneDates,
  previewSteps,
  freezeSchedule,
  originalSchedule,
  rescheduleWorkflow,
  reviewSchedule,
} from "../app/work/workflow-milestones";

import { zonedMoment } from "../app/matters/practice-scheduling";

const steps = PRACTICE_WORKFLOWS[2].steps;
const dates = [
  { name: "Filing", date: "2028-03-02" },
  { name: "Review", date: "2028-03-10" },
];
const later = [
  { name: "Filing", date: "2028-03-12" },
  { name: "Review", date: "2028-03-20" },
];
test("named milestone scheduling uses calendar days, step order and complete unambiguous input", () => {
  assert.deepEqual(
    previewSteps(steps, [...dates].reverse()).map((s) => s.dueDate),
    ["2028-02-29", "2028-03-02", "2028-03-10", "2028-03-11"],
  );
  for (const raw of [
    dates.slice(0, 1),
    [...dates, dates[1]],
    [dates[0], dates[0]],
    "2028-03-02",
    [{ ...dates[0], date: "2027-02-29" }, dates[1]],
  ])
    assert.throws(() => milestoneDates(steps, raw));
  for (const [date, days] of [
    ["0000-01-01", -1],
    ["9999-12-31", 1],
  ] as const)
    assert.throws(() => previewSteps([{ title: "Step", kind: "task", days }], date));
  assert.deepEqual(
    milestoneDates([{ days: 0, milestone: "__proto__" }], [{ name: "__proto__", date: "2026-11-08" }]),
    [{ name: "__proto__", date: "2026-11-08" }],
  );
});
test("replanning changes eligible dates and keeps individual decisions through repeated moves", () => {
  let id = 0;
  const plan = changePracticePlan(
    EMPTY_PLAN,
    { action: "apply_workflow", templateId: "filing-review-v1", milestones: dates },
    () => String(++id),
  );
  const app = freezeSchedule(plan.items, steps, dates);
  plan.items[0].dueDate = "2028-03-10";
  plan.items[1].status = "completed";
  plan.items[2].reminder = { ...zonedMoment("2028-03-09T09:00", "UTC"), state: "active" };
  plan.items[3].description = "Keep my notes";
  plan.items[3].checklist = [{ title: "Verify", done: true }];
  assert.deepEqual(
    reviewSchedule(plan, app, later).rows.map((r) => r.reason),
    ["manual", "completed", "scheduled", "move"],
  );
  const next = rescheduleWorkflow(plan, app, later);
  assert.deepEqual(
    next.plan.items,
    plan.items.map((i, n) => (n === 3 ? { ...i, dueDate: "2028-03-21" } : i)),
  );
  assert.equal(next.schedule.workflow, app.workflow);
  assert.deepEqual(
    reviewSchedule(next.plan, next.schedule, dates).rows.map((r) => r.reason),
    ["manual", "completed", "scheduled", "move"],
  );
  assert.throws(() => rescheduleWorkflow(next.plan, next.schedule, later));
  const legacy = changePracticePlan(
    EMPTY_PLAN,
    { action: "apply_workflow", templateId: "intake-v1", anchor: "2026-11-08" },
    () => String(++id),
  );
  assert.deepEqual(
    originalSchedule(legacy.items[0].workflow!, legacy).steps.map((s) => s.days),
    [0, 1, 2, 3],
  );
});
