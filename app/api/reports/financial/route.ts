import { and, asc, eq, inArray } from "drizzle-orm";
import {
  billingEvents as events,
  dossiers,
  dossierParticipants as people,
  dossierOrganizationBindings as bindings,
} from "../../../../db/schema";
import {
  dossierJson,
  isResponse,
  resolveDossierServerContext,
} from "../../../dossier-server";
import { firmReply } from "../../../firm-authority";
import { organizationSelectionToken } from "../../../organization-store";
import type { BillingRow } from "../../../billing/model";
import {
  billingRows,
  reports,
  summarize,
  type Report,
} from "../../../reports/model";
import { defaults, validConfig } from "../../../reports/config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const c = await resolveDossierServerContext(request);
  if (isResponse(c)) return c;
  const q = new URL(request.url).searchParams,
    report = q.get("report") as Report;
  const period = { from: q.get("from") || "", to: q.get("to") || "" };
  if (
    !Object.hasOwn(reports, report) ||
    reports[report].source !== "billing" ||
    !validConfig({ ...defaults(report), ...period })
  )
    return dossierJson({ error: "Invalid report" }, 400);
  const organization = c.organization!;
  // One database statement binds the complete journal to current staff participation.
  const records = await c.db
    .select({
      id: dossiers.id,
      title: dossiers.title,
      reference: dossiers.reference,
      sequence: events.sequence,
      actorRef: events.actorRef,
      createdAt: events.createdAt,
      event: events.event,
    })
    .from(dossiers)
    .innerJoin(
      bindings,
      and(
        eq(bindings.dossierId, dossiers.id),
        eq(bindings.organizationId, organization.id),
      ),
    )
    .innerJoin(
      people,
      and(
        eq(people.dossierId, dossiers.id),
        eq(people.actorId, c.actor.actorId),
        eq(people.userId, c.actor.userId),
        eq(people.status, "active"),
        inArray(people.role, ["owner", "contributor"]),
      ),
    )
    .leftJoin(
      events,
      and(
        eq(events.caseId, dossiers.id),
        eq(events.organizationId, organization.id),
      ),
    )
    .orderBy(asc(dossiers.id), asc(events.sequence));
  const cases = new Map<string, { name: string; rows: BillingRow[] }>();
  for (const item of records) {
    const group = cases.get(item.id) ?? {
      name: item.title + " · " + item.reference,
      rows: [],
    };
    if (item.sequence !== null && item.event && item.actorRef && item.createdAt)
      group.rows.push({
        sequence: item.sequence,
        event: item.event,
        actorRef: item.actorRef,
        createdAt: item.createdAt,
      });
    cases.set(item.id, group);
  }
  const today = new Date().toISOString().slice(0, 10);
  const lines = [...cases.values()].flatMap((m) =>
    billingRows(report, m.name, m.rows, period, today),
  );
  const rows =
    report === "firmTime" || report === "caseTime"
      ? summarize(lines, report === "firmTime" ? "user" : "matter", [
          "minutes",
          "expenses",
          "amount",
        ])
      : lines;
  return firmReply(c, {
    scope: organizationSelectionToken(organization),
    rows,
  });
}
