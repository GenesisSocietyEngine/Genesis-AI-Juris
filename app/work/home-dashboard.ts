import { calendarDate, calendarDays, localAt } from "../matters/practice-scheduling";
import type { FirmCase } from "./work-controller";
import { caseWorkSummary } from "./case-work-summary";

export function homeDashboard(cases: FirmCase[], now: number, zone: string) {
  const today = localAt(now, zone).slice(0, 10);
  const all = cases.flatMap(matter => matter.plan.items.map(item => ({ ...item, caseId: matter.id, caseTitle: matter.title })));
  const open = all.filter(item => item.status === "open");
  const sort = (a: typeof all[number], b: typeof all[number]) =>
    (calendarDate(a, zone) ?? "9999").localeCompare(calendarDate(b, zone) ?? "9999") ||
    (a.timing?.start.at ?? "").localeCompare(b.timing?.start.at ?? "") || a.title.localeCompare(b.title);
  const overdue = open.filter(item => item.kind === "task" && item.dueDate && item.dueDate < today).sort(sort);
  const dueToday = open.filter(item => calendarDays(item, zone).includes(today)).sort(sort);
  const upcoming = open.filter(item => item.kind === "event" && (item.timing ? Date.parse(item.timing.end.at) > now : Boolean(item.dueDate && item.dueDate >= today))).sort(sort);
  return { today, open, overdue, dueToday, upcoming, cases: caseWorkSummary(cases, now, zone) };
}
