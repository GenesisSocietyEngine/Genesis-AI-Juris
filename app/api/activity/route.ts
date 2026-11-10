import {
  filters,
  feedQuery,
  type Entry,
  type Filter,
} from "../../activity/feed";
import {
  dossierJson,
  isResponse,
  resolveDossierServerContext,
} from "../../dossier-server";
import { firmReply } from "../../firm-authority";
import { organizationSelectionToken } from "../../organization-store";
import { and, eq, inArray } from "drizzle-orm";
import {
  dossierOrganizationBindings as bindings,
  dossierParticipants as people,
} from "../../../db/schema";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const params = new URL(request.url).searchParams;
  const filter = (params.get("filter") ?? "all") as Filter;
  const before = params.get("before") ?? "",
    id = params.get("id") ?? "";
  if (
    !filters.includes(filter) ||
    before.length > 40 ||
    id.length > 600 ||
    Boolean(before) !== Boolean(id)
  )
    return dossierJson({ error: "Invalid activity filter or cursor." }, 400);
  const org = context.organization!,
    limit = params.get("history") === "1" ? 30 : 6;
  const rows = await context.db.all<Entry>(
    feedQuery(
      org.id,
      context.actor.userId,
      context.actor.actorId,
      filter,
      before,
      id,
      limit + 1,
    ),
  );
  const cases = [
    ...new Set(rows.flatMap((row) => (row.caseId ? [row.caseId] : []))),
  ];
  if (cases.length) {
    const grants = await context.db
      .select({ id: people.dossierId, role: people.role })
      .from(people)
      .innerJoin(
        bindings,
        and(
          eq(bindings.dossierId, people.dossierId),
          eq(bindings.organizationId, org.id),
        ),
      )
      .where(
        and(
          inArray(people.dossierId, cases),
          eq(people.userId, context.actor.userId),
          eq(people.actorId, context.actor.actorId),
          eq(people.status, "active"),
        ),
      );
    const roles = new Map(grants.map((g) => [g.id, g.role]));
    if (
      rows.some(
        (row) =>
          row.caseId &&
          (!roles.has(row.caseId) ||
            (row.id.startsWith("bill:") &&
              !["owner", "contributor"].includes(roles.get(row.caseId)!))),
      )
    )
      return dossierJson({ error: "Case access changed." }, 403);
  }
  return firmReply(context, {
    scope: organizationSelectionToken(org),
    rows: rows.slice(0, limit),
    more: rows.length > limit,
  });
}
