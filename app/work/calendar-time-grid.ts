import { calendarDays, localAt, type EventTiming } from "../matters/practice-scheduling";
import { agendaRange, shiftDate } from "./work-date-views";

export type CalendarEntry = { id: string; caseId: string; title: string; caseTitle: string; kind: string; dueDate: string | null; timing?: EventTiming | null };
/** End instants are exclusive. Wall-clock labels use the selected display zone. */
export function timeGridDays(anchor: string, period: "day" | "week") {
  const range = agendaRange(anchor, period);
  return Array.from({ length: period === "day" ? 1 : 7 }, (_, i) => shiftDate(range.start, i));
}
export function timeGridSlot(item: CalendarEntry, date: string, zone: string): number | "all-day" | null {
  if (!calendarDays(item, zone).includes(date)) return null;
  if (!item.timing) return "all-day";
  const start = localAt(item.timing.start.at, zone);
  return start.slice(0, 10) < date ? 0 : Number(start.slice(11, 13));
}
