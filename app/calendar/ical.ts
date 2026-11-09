import type { PracticeItem, PracticePlan } from "../matters/practice-plan";
export type Withdrawal = {
  item: string;
  due_date: string;
  timing: string | null;
  revision: number;
  stamp: string;
};
const utf8 = new TextEncoder();
function escapeText(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, " ")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
export function fold(s: string) {
  let bytes = 0,
    out = "";
  for (const char of s) {
    const n = utf8.encode(char).length;
    if (bytes + n > 75) {
      out += "\r\n ";
      bytes = 1;
    }
    out += char;
    bytes += n;
  }
  return out;
}
export async function sha(s: string) {
  const bytes = await crypto.subtle.digest("SHA-256", utf8.encode(s));
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
}
function timestamp(s: string) {
  return new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
function dates(date: string, timing: PracticeItem["timing"]) {
  if (timing) return ["DTSTART:" + timestamp(timing.start.at), "DTEND:" + timestamp(timing.end.at)];
  const end = new Date(date + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return [
    "DTSTART;VALUE=DATE:" + date.replaceAll("-", ""),
    "DTEND;VALUE=DATE:" + end.toISOString().slice(0, 10).replaceAll("-", ""),
  ];
}
export async function renderCalendar(
  org: string,
  scope: string,
  plan: PracticePlan,
  stamp: string,
  withdrawals: Withdrawal[],
) {
  const current = plan.items.filter((i) => i.dueDate),
    present = new Set(current.map((i) => i.id));
  const records = [
    ...current.map((i) => ({
      id: i.id,
      title: i.title,
      date: i.dueDate!,
      timing: i.timing,
      revision: plan.revision,
      stamp,
      cancel: false,
    })),
    ...withdrawals
      .filter((w) => !present.has(w.item))
      .map((w) => ({
        id: w.item,
        title: "Cancelled",
        date: w.due_date,
        timing: w.timing ? JSON.parse(w.timing) : null,
        revision: w.revision,
        stamp: w.stamp,
        cancel: true,
      })),
  ];
  const events = await Promise.all(
    records.map(async (r) => [
      "BEGIN:VEVENT",
      "UID:" + (await sha(JSON.stringify([org, scope, r.id]))) + "@casevant.pro",
      "DTSTAMP:" + timestamp(r.stamp),
      "LAST-MODIFIED:" + timestamp(r.stamp),
      "SEQUENCE:" + r.revision,
      ...dates(r.date, r.timing),
      "SUMMARY:" + escapeText(r.title),
      "STATUS:" + (r.cancel ? "CANCELLED" : "CONFIRMED"),
      "CLASS:PRIVATE",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]),
  );
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CaseVant//Work Calendar//EN",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:CaseVant",
      ...events.flat(),
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
