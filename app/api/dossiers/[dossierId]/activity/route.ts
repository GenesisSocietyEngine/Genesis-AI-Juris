import { and, desc, eq, lt } from "drizzle-orm";
import { dossierAuditEvents } from "../../../../../db/schema";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import {
  dossierJson,
  isResponse,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../dossier-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const MAX_PAGE_SIZE = 50;
const MAX_DETAIL_CHARACTERS = 16_384;

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "audit");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  const limit = pageLimit(url.searchParams.get("limit"));
  if (limit === null) return dossierJson({ error: "The activity page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursorSequence: number | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "activity cursor");
    } catch {
      return dossierJson({ error: "The activity cursor is invalid." }, 400);
    }
    const [cursor] = await context.db.select({ sequence: dossierAuditEvents.sequence })
      .from(dossierAuditEvents).where(and(
        eq(dossierAuditEvents.dossierId, access.dossier.id),
        eq(dossierAuditEvents.id, cursorId),
      )).limit(1);
    if (!cursor) return dossierJson({ error: "The activity cursor is invalid." }, 400);
    cursorSequence = cursor.sequence;
  }

  const rows = await context.db.select({
    auditEventId: dossierAuditEvents.id,
    dossierId: dossierAuditEvents.dossierId,
    sequence: dossierAuditEvents.sequence,
    eventType: dossierAuditEvents.eventType,
    objectRefType: dossierAuditEvents.objectRefType,
    objectRefId: dossierAuditEvents.objectRefId,
    actorId: dossierAuditEvents.actorRef,
    actorRole: dossierAuditEvents.actorRole,
    occurredAt: dossierAuditEvents.occurredAt,
    summaryCode: dossierAuditEvents.summaryCode,
    detail: dossierAuditEvents.detail,
    previousEventId: dossierAuditEvents.previousEventId,
    eventDigest: dossierAuditEvents.eventDigest,
  }).from(dossierAuditEvents).where(and(
    eq(dossierAuditEvents.dossierId, access.dossier.id),
    cursorSequence === null ? undefined : lt(dossierAuditEvents.sequence, cursorSequence),
  )).orderBy(desc(dossierAuditEvents.sequence)).limit(limit + 1);

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return dossierJson({
    activity: visible.map((event) => ({
      object_type: "audit_event",
      schema_version: 1,
      audit_event_id: event.auditEventId,
      dossier_id: event.dossierId,
      sequence: event.sequence,
      event_type: event.eventType,
      object_ref_type: event.objectRefType,
      object_ref_id: event.objectRefId,
      actor_id: event.actorId,
      actor_role: event.actorRole,
      occurred_at: event.occurredAt,
      summary_code: event.summaryCode,
      detail: boundedMetadataDetail(event.detail),
      previous_event_id: event.previousEventId,
      event_digest: event.eventDigest,
    })),
    next_cursor: hasMore ? visible[visible.length - 1]?.auditEventId ?? null : null,
  });
}

function pageLimit(value: string | null): number | null {
  if (value === null || value === "") return MAX_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function boundedMetadataDetail(value: unknown): unknown {
  try {
    const encoded = JSON.stringify(value);
    if (encoded !== undefined && encoded.length <= MAX_DETAIL_CHARACTERS) return value;
  } catch {
    // A corrupt historical detail value must not break or expand the timeline.
  }
  return { detail_code: "DETAIL_WITHHELD", reason: "METADATA_BOUND_EXCEEDED" };
}
