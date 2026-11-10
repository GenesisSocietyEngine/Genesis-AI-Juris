import {
  contactRows,
  reports,
  workRows,
  type Period,
  type Report,
  type Row,
  type WorkCase,
} from "./model";
import type { Contact } from "../contacts/contact-model";
import type { PracticePlan } from "../matters/practice-plan";

export async function readReport(
  report: Report,
  scope: string,
  period: Period,
  signal: AbortSignal,
  firmLabel: string,
): Promise<Row[]> {
  async function read<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { "x-genesis-organization": scope },
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw Error("unavailable");
    const data = (await response.json()) as T & { scope: string };
    if (data.scope !== scope) throw Error("scope");
    return data;
  }
  const rows: Row[] = [];
  const seen = new Set<string>();
  const source = reports[report].source;
  if (source === "billing") {
    const query = new URLSearchParams({
      report,
      from: period.from,
      to: period.to,
    });
    const data = await read<{ rows: Row[] }>("/api/reports/financial?" + query);
    return data.rows;
  } else if (source === "contacts") {
    let after: string | null = "";
    do {
      if (seen.has(after)) throw Error("cursor");
      seen.add(after);
      const data: { contacts: Contact[]; next: string | null } = await read(
        "/api/contacts?after=" + encodeURIComponent(after),
      );
      rows.push(...contactRows(report, data.contacts));
      after = data.next;
    } while (after);
  } else {
    let cursor: string | null = "";
    do {
      if (seen.has(cursor)) throw Error("cursor");
      seen.add(cursor);
      const data: { cases: WorkCase[]; nextCursor: string | null } = await read(
        "/api/work?cursor=" + encodeURIComponent(cursor),
      );
      for (const c of data.cases) rows.push(...workRows(report, c, period));
      cursor = data.nextCursor;
    } while (cursor);
    if (report === "events") {
      const { plan } = await read<{ plan: PracticePlan }>("/api/work/firm");
      rows.push(
        ...workRows(
          report,
          {
            id: "",
            title: firmLabel,
            reference: "",
            status: "",
            createdAt: "",
            plan,
          },
          period,
        ),
      );
    }
  }
  return rows;
}
