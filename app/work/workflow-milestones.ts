import type { PracticeItem, PracticePlan } from "../matters/practice-plan";
import { validDate } from "../matters/practice-scheduling";

export type StepTiming = { days: number; milestone?: string };
export type MilestoneDate = { name: string; date: string };
export type FrozenStep = StepTiming & { itemId: string; held?: "manual" | "scheduled" | "completed" };
export type WorkflowSchedule = { workflow: string; dates: MilestoneDate[]; steps: FrozenStep[] };
export type DateDisposition = "add" | "move" | "unchanged" | "manual" | "scheduled" | "completed" | "missing";
export type ReviewRow = {
  id: string;
  title: string;
  kind: PracticeItem["kind"];
  previous: string | null;
  date: string | null;
  reason: DateDisposition;
};

export function milestoneName(value?: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 60 || /[\u0000-\u001f\u007f]/.test(value))
    throw Error("Use a milestone name of up to 60 characters.");
  return value.trim().normalize("NFC");
}
export function milestoneNames(steps: readonly { milestone?: string; days: number }[]) {
  return [...new Set(steps.map((step) => milestoneName(step.milestone)))];
}
export function milestoneDates(steps: readonly StepTiming[], raw: unknown): MilestoneDate[] {
  const names = milestoneNames(steps);
  if (typeof raw === "string" && names.length === 1 && names[0] === "") raw = [{ name: "", date: raw }];
  if (!Array.isArray(raw) || !names.length || raw.length !== names.length)
    throw Error("Choose a valid date for each milestone.");
  const dates = new Map<string, string>();
  for (const entry of raw) {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !names.includes(entry.name) ||
      dates.has(entry.name) ||
      !validDate(entry.date)
    )
      throw Error("Choose a valid date for each milestone.");
    dates.set(entry.name, entry.date);
  }
  return names.map((name) => ({ name, date: dates.get(name)! }));
}
function stepDates(steps: readonly StepTiming[], raw: unknown) {
  const dates = new Map(milestoneDates(steps, raw).map((d) => [d.name, d.date]));
  return steps.map((step) => {
    const time = Date.parse(dates.get(milestoneName(step.milestone))!) + step.days * 86400000;
    if (!Number.isInteger(step.days) || !Number.isFinite(time) || Math.abs(time) > 8640000000000000)
      throw Error("A step falls outside the supported date range.");
    const date = new Date(time).toISOString().split("T")[0];
    if (!validDate(date)) throw Error("A step falls outside the supported date range.");
    return date;
  });
}
export function previewSteps(
  steps: readonly (StepTiming & Pick<PracticeItem, "title" | "kind">)[],
  raw: unknown,
) {
  const dates = stepDates(steps, raw);
  return steps.map(({ title, kind }, i) => ({ title, kind, dueDate: dates[i] }));
}
export function freezeSchedule(
  items: PracticeItem[],
  steps: readonly StepTiming[],
  raw: unknown,
): WorkflowSchedule {
  if (!items[0]?.workflow || items.length !== steps.length) throw Error("Workflow dates are unavailable.");
  return {
    workflow: items[0].workflow,
    dates: milestoneDates(steps, raw),
    steps: steps.map(({ days, milestone }, i) => ({
      itemId: items[i].id,
      days,
      ...(milestone ? { milestone } : {}),
    })),
  };
}
// Older applications have one start date. Recover offsets from their creation revision.
export function originalSchedule(workflow: string, first: PracticePlan): WorkflowSchedule {
  const anchor = workflow.slice(workflow.lastIndexOf(":") + 1);
  const items = first.items.filter((item) => item.workflow === workflow);
  const steps = items.map((item) => {
    if (!validDate(anchor) || !validDate(item.dueDate))
      throw Error("The original workflow dates are unavailable.");
    return { days: (Date.parse(item.dueDate) - Date.parse(anchor)) / 86400000 };
  });
  return freezeSchedule(items, steps, anchor);
}
export function reviewSchedule(plan: PracticePlan, schedule: WorkflowSchedule, raw: unknown) {
  const dates = milestoneDates(schedule.steps, raw);
  const before = stepDates(schedule.steps, schedule.dates),
    after = stepDates(schedule.steps, dates);
  const items = new Map(
    plan.items.filter((item) => item.workflow === schedule.workflow).map((item) => [item.id, item]),
  );
  const rows: ReviewRow[] = [],
    steps: FrozenStep[] = [];
  schedule.steps.forEach((step, index) => {
    const item = items.get(step.itemId);
    const held =
      item?.status === "completed"
        ? "completed"
        : item?.timing || item?.reminder || item?.series
          ? "scheduled"
          : (step.held ?? (item && item.dueDate !== before[index] ? "manual" : undefined));
    const reason = !item ? "missing" : (held ?? (item.dueDate === after[index] ? "unchanged" : "move"));
    rows.push({
      id: step.itemId,
      title: item?.title ?? "",
      kind: item?.kind ?? "task",
      previous: item?.dueDate ?? null,
      date: reason === "move" ? after[index] : (item?.dueDate ?? null),
      reason,
    });
    steps.push(held ? { ...step, held } : step);
  });
  return {
    rows,
    schedule: { ...schedule, dates, steps },
    changed: dates.some((d, i) => d.date !== schedule.dates[i].date),
  };
}
export function rescheduleWorkflow(plan: PracticePlan, previous: WorkflowSchedule, raw: unknown) {
  const review = reviewSchedule(plan, previous, raw);
  if (!review.changed) throw Error("Change a milestone date before saving.");
  const moves = new Map(review.rows.filter((row) => row.reason === "move").map((row) => [row.id, row.date]));
  return {
    schedule: review.schedule,
    plan: {
      ...plan,
      revision: plan.revision + 1,
      items: plan.items.map((item) =>
        moves.has(item.id) ? { ...item, dueDate: moves.get(item.id)! } : item,
      ),
    },
  };
}
