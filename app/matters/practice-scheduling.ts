export type ClockChoice = "reject" | "earlier" | "later";
export type ZonedMoment = { local: string; timeZone: string; choice: ClockChoice; at: string };
export type EventTiming = { start: ZonedMoment; end: ZonedMoment };
export type WorkReminder = ZonedMoment & { state: "active" | "dismissed" };
export type Recurrence = { frequency: "daily" | "weekly" | "monthly"; interval: number; count: number };
export type SeriesOccurrence = Recurrence & { id: string; index: number; anchorDate: string };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  if (typeof timeZone !== "string" || timeZone.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(timeZone)) throw Error("Choose a named IANA timezone, such as Europe/Paris.");
  let value = formatters.get(timeZone);
  if (!value) {
    try { value = new Intl.DateTimeFormat("en-CA", { timeZone, calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
    catch { throw Error("Unknown timezone. Use a named IANA timezone, such as Europe/Paris."); }
    if (formatters.size > 128) formatters.clear();
    formatters.set(timeZone, value);
  }
  return value;
}
export function localAt(at: string | number, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(at)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function zonedMoment(local: string, timeZone: string, choice: ClockChoice = "reject"): ZonedMoment {
  if (typeof local !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !validDate(local.slice(0,10)) || local.slice(11,13) > "23" || local.slice(14) > "59" || !["reject", "earlier", "later"].includes(choice)) throw Error("Enter a valid local date and time.");
  if (local.slice(0,4) < "1970" || local.slice(0,4) > "2100") throw Error("Timed scheduling supports years 1970–2100.");
  formatter(timeZone);
  const wall = Date.parse(`${local}:00.000Z`), offsets = new Set<number>();
  // Obtain offsets on both sides of nearby transitions, then round-trip each
  // candidate. Never silently shift a nonexistent time across a DST gap.
  for (let hour = -36; hour <= 36; hour += 6) {
    const sample = wall + hour * 3_600_000;
    offsets.add(Date.parse(localAt(sample,timeZone)+":00.000Z") - sample);
  }
  const candidates = [...offsets].map(offset=>wall-offset).filter(at=>localAt(at,timeZone)===local).sort((a,b)=>a-b);
  if (!candidates.length) throw Error("This local time does not exist in that timezone. Choose another time.");
  if (candidates.length > 1 && choice === "reject") throw Error("This clock time occurs twice. Choose the earlier or later occurrence.");
  return { local, timeZone, choice, at: new Date(choice === "later" ? candidates.at(-1)! : candidates[0]).toISOString() };
}
export function readMoment(value: unknown): ZonedMoment {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("A timezone-aware time is required.");
  const m = value as ZonedMoment;
  if (Object.keys(m).some(k=>!["local","timeZone","choice","at"].includes(k))) throw Error("Unsupported time field.");
  if(!["reject","earlier","later"].includes(m.choice))throw Error("Choose how to handle a repeated clock time.");
  const resolved = zonedMoment(m.local,m.timeZone,m.choice);
  if (resolved.at !== m.at) throw Error("The UTC instant does not match the local time and timezone. Preview again.");
  return resolved;
}
export function readTiming(value: unknown): EventTiming {
  if (!value || typeof value !== "object" || Object.keys(value).some(k=>!["start","end"].includes(k))) throw Error("Enter an event start and end.");
  const timing = value as EventTiming, start = readMoment(timing.start), end = readMoment(timing.end);
  if (start.timeZone !== end.timeZone) throw Error("Use the same event timezone for start and end.");
  if (end.at <= start.at) throw Error("Event end must follow its start.");
  if (Date.parse(end.at)-Date.parse(start.at)>31*86_400_000) throw Error("A timed event can span at most 31 days.");
  return { start, end };
}
export function readReminder(value: unknown): WorkReminder {
  if (!value || typeof value !== "object") throw Error("Enter a reminder time.");
  const { state, ...moment } = value as WorkReminder;
  if (state !== "active" && state !== "dismissed") throw Error("Choose an active or dismissed reminder.");
  return { ...readMoment(moment), state };
}
export function readRecurrence(value: unknown): Recurrence {
  const r = value as Recurrence;
  if (!r || typeof r !== "object" || Object.keys(r).some(k=>!["frequency","interval","count"].includes(k)) || !["daily","weekly","monthly"].includes(r.frequency) || !Number.isInteger(r.interval) || r.interval<1 || r.interval>12 || !Number.isInteger(r.count) || r.count<2 || r.count>52) throw Error("Choose daily, weekly or monthly recurrence, an interval of 1–12 and 2–52 occurrences.");
  return { frequency:r.frequency, interval:r.interval, count:r.count };
}
export function recurrenceDates(anchor: string, value: unknown) {
  if (!validDate(anchor)) throw Error("A recurring task needs a valid first due date.");
  const rule = readRecurrence(value), initial = new Date(anchor+"T00:00:00Z");
  return Array.from({length:rule.count},(_,index)=>{
    let result: Date;
    if (rule.frequency === "monthly") {
      result = new Date(initial); result.setUTCDate(1); result.setUTCMonth(initial.getUTCMonth()+index*rule.interval);
      const end = new Date(result); end.setUTCMonth(end.getUTCMonth()+1); end.setUTCDate(0);
      result.setUTCDate(Math.min(initial.getUTCDate(),end.getUTCDate()));
    } else result = new Date(initial.getTime()+index*rule.interval*(rule.frequency==="weekly"?7:1)*86_400_000);
    const date = result.toISOString().slice(0,10); if (!validDate(date)) throw Error("A recurrence falls outside the supported date range."); return date;
  });
}
export function shiftReminder(reminder: WorkReminder, anchor: string, nextDate: string): WorkReminder {
  const days = (Date.parse(nextDate)-Date.parse(anchor))/86_400_000;
  const next = new Date(Date.parse(reminder.local.slice(0,10))+days*86_400_000).toISOString().slice(0,10)+reminder.local.slice(10);
  return {...zonedMoment(next,reminder.timeZone,reminder.choice),state:"active"};
}
export function reminderDue(item: {status:string;reminder?:WorkReminder|null}, now: number) { return item.status === "open" && item.reminder?.state === "active" && Date.parse(item.reminder.at) <= now; }
export function calendarDate(item: {dueDate:string|null;timing?:EventTiming|null}, zone: string) { return item.timing ? localAt(item.timing.start.at,zone).slice(0,10) : item.dueDate; }
export function calendarDays(item: {dueDate:string|null;timing?:EventTiming|null}, zone: string) {
  const start=calendarDate(item,zone);if(!start)return [];
  const end=item.timing?localAt(Date.parse(item.timing.end.at)-1,zone).slice(0,10):start;
  const days:string[]=[];
  for(let time=Date.parse(start);time<=Date.parse(end)&&days.length<33;time+=86_400_000)days.push(new Date(time).toISOString().slice(0,10));
  return days;
}
export function scheduleLabel(item: {dueDate:string|null;timing?:EventTiming|null}, zone?: string) {
  if (!item.timing) return item.dueDate ?? "";
  const tz = zone ?? item.timing.start.timeZone;
  return `${localAt(item.timing.start.at,tz).replace("T"," ")} – ${localAt(item.timing.end.at,tz).replace("T"," ")} (${tz})`;
}
