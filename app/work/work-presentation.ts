import { calendarDate, calendarDays, type EventTiming } from "../matters/practice-scheduling";

export type WorkState = "completed" | "overdue" | "today" | "scheduled" | "past" | "open";
type Work = { kind: string; status: string; dueDate: string | null; timing?: EventTiming | null };

/** Presentation only: never changes a saved status or schedules work. */
export function workState(item: Work, today: string, zone: string): WorkState {
  if (item.status === "completed") return "completed";
  const date = calendarDate(item, zone);
  if (calendarDays(item, zone).includes(today)) return "today";
  if (date && date < today) return item.kind === "event" ? "past" : "overdue";
  return item.kind === "event" && date ? "scheduled" : "open";
}

export function workStateLabel(state: WorkState, locale: "en" | "ru") {
  const labels = {
    completed: ["Completed", "Завершено"], overdue: ["Overdue", "Просрочено"],
    today: ["Today", "Сегодня"], scheduled: ["Scheduled", "Запланировано"],
    past: ["Past event", "Прошедшее событие"], open: ["Open", "Открыто"],
  };
  return labels[state][locale === "ru" ? 1 : 0];
}

/** Keep exact option values; only show an ID when identical names need it. */
export function distinctLabels(entries: { id: string; name: string }[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  return new Map(entries.map(entry => [entry.id, counts.get(entry.name)! > 1 ? `${entry.name} · ${entry.id}` : entry.name]));
}

export function readableDate(date: string, locale: "en" | "ru", options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
