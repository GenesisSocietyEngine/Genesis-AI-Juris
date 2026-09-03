import { and, asc, desc, eq } from "drizzle-orm";
import {
  dossierAssertionSources,
  dossierAuditEvents,
  dossierDocumentVersions,
  dossierDocuments,
  dossierOutputStateEvents,
  dossierParticipants,
  dossierProfessionalAssertions,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
} from "../../../../db/schema";
import { DOSSIER_WIRE_ENUMS } from "../../../dossier-contract";
import { computeStoredDossierReadiness } from "../../../dossier-readiness-server";
import {
  boundedDossierText,
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
  dossierStringList,
  expectedDossierRevision,
  isResponse,
  newDossierOpaqueId,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierAccess,
  type DossierServerContext,
} from "../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;
  return dossierJson(await detailPayload(context, access));
}

export async function PUT(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) return dossierJson({ error: "Cross-site Matter update rejected." }, 403);
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "update");
  if (isResponse(access)) return access;
  const payload = await readJsonObject(request, 16_384);
  if (!payload) return dossierJson({ error: "A valid Matter update is required." }, 400);
  if ([
    "id", "dossierId", "dossier_id", "ownerUserId", "owner_user_id", "ownerActorId", "owner_actor_id",
    "organisationId", "organisation_id", "tenantId", "tenant_id", "status", "statusReason", "status_reason",
    "revision", "approvals", "audit", "hash", "manifestDigest", "manifest_digest", "reference",
  ].some((key) => key in payload)) {
    return dossierJson({ error: "Protected Matter fields require their explicit governed action." }, 400);
  }

  let expectedRevision: number;
  let set: Partial<typeof dossiers.$inferInsert>;
  try {
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
    const deadlineTouched = "keyDeadlineAt" in payload || "key_deadline_at" in payload
      || "keyDeadlineTimezone" in payload || "key_deadline_timezone" in payload;
    const deadlineAtValue = payload.keyDeadlineAt ?? payload.key_deadline_at;
    const deadlineTimezoneValue = payload.keyDeadlineTimezone ?? payload.key_deadline_timezone;
    const keyDeadlineAt = !deadlineTouched
      ? access.dossier.keyDeadlineAt
      : deadlineAtValue === null || deadlineAtValue === "" ? null : canonicalInputTimestamp(deadlineAtValue, "key deadline");
    const keyDeadlineTimezone = !deadlineTouched
      ? access.dossier.keyDeadlineTimezone
      : keyDeadlineAt === null ? null : boundedDossierText(deadlineTimezoneValue, "key deadline timezone", 1, 80);
    set = {
      ...(payload.title !== undefined ? { title: boundedDossierText(payload.title, "Matter title", 2, 240) } : {}),
      ...(payload.jurisdictions !== undefined ? { jurisdictions: dossierStringList(payload.jurisdictions, "jurisdictions", 12, 100) } : {}),
      ...(payload.classification !== undefined ? { classification: dossierEnum(payload.classification, DOSSIER_WIRE_ENUMS.classification, "classification") } : {}),
      ...(payload.priority !== undefined ? { priority: dossierEnum(payload.priority, DOSSIER_WIRE_ENUMS.priority, "priority") } : {}),
      ...(deadlineTouched ? { keyDeadlineAt, keyDeadlineTimezone } : {}),
    };
  } catch (error) {
    return dossierJson({ error: error instanceof Error ? error.message : "The Matter update is invalid." }, 400);
  }
  if (expectedRevision !== access.dossier.revision) {
    return dossierJson({ error: "The Matter changed before this update.", code: "revision_conflict", currentRevision: access.dossier.revision }, 409);
  }
  const changedFields = Object.entries(set).filter(([key, value]) => !sameValue(access.dossier[key as keyof typeof access.dossier], value)).map(([key]) => key);
  if (changedFields.length === 0) return dossierJson({ ...(await detailPayload(context, access)), unchanged: true });
  const now = canonicalDossierTimestamp();
  const staleOutputs = await currentOutputStates(context, access.dossier.id);
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, expectedRevision + 1, [
    {
      actorRole: access.role,
      eventType: "dossier_updated",
      objectRefType: "dossier",
      objectRefId: access.dossier.id,
      summaryCode: "DOSSIER_UPDATED",
      detail: { changed_fields: changedFields, revision_before: expectedRevision, revision_after: expectedRevision + 1 },
      occurredAt: now,
    },
    ...staleOutputs.map((output) => ({
      actorRole: access.role,
      eventType: "output_marked_stale" as const,
      objectRefType: "governed_output" as const,
      objectRefId: output.outputId,
      summaryCode: "OUTPUT_MARKED_STALE",
      detail: { reason_code: "DOSSIER_REVISION_CHANGED", dossier_revision: expectedRevision + 1 },
      occurredAt: now,
    })),
  ]);
  try {
    await context.db.batch([
      context.db.update(dossiers).set({
        ...set,
        revision: expectedRevision + 1,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
      }).where(and(eq(dossiers.id, access.dossier.id), eq(dossiers.revision, expectedRevision))),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "DOSSIER_REVISION_CHANGED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return dossierJson({ error: "The Matter changed before this update.", code: "revision_conflict" }, 409);
  }
  const nextAccess = await requireDossierAccess(context, access.dossier.id, "read");
  if (isResponse(nextAccess)) return nextAccess;
  return dossierJson(await detailPayload(context, nextAccess));
}

async function detailPayload(context: DossierServerContext, access: DossierAccess) {
  const [participants, anchorRows, assertions, assertionSources] = await Promise.all([
    context.db.select({
      participant_id: dossierParticipants.id,
      actor_id: dossierParticipants.actorId,
      display_name: dossierParticipants.displayName,
      role: dossierParticipants.role,
      status: dossierParticipants.status,
    }).from(dossierParticipants).where(eq(dossierParticipants.dossierId, access.dossier.id))
      .orderBy(asc(dossierParticipants.createdAt), asc(dossierParticipants.id)),
    context.db.select({
      source_anchor_id: dossierSourceAnchors.id,
      document_id: dossierSourceAnchors.documentId,
      document_version_id: dossierSourceAnchors.documentVersionId,
      document_title: dossierDocuments.title,
      version_ordinal: dossierDocumentVersions.ordinal,
      page_number: dossierSourceAnchors.pageNumber,
      section: dossierSourceAnchors.section,
      heading: dossierSourceAnchors.heading,
      paragraph: dossierSourceAnchors.paragraph,
      excerpt: dossierSourceAnchors.excerpt,
      review_state: dossierSourceAnchors.reviewState,
      checksum: dossierSourceAnchors.anchorChecksum,
    }).from(dossierSourceAnchors)
      .innerJoin(dossierDocuments, and(eq(dossierDocuments.dossierId, dossierSourceAnchors.dossierId), eq(dossierDocuments.id, dossierSourceAnchors.documentId)))
      .innerJoin(dossierDocumentVersions, and(eq(dossierDocumentVersions.dossierId, dossierSourceAnchors.dossierId), eq(dossierDocumentVersions.id, dossierSourceAnchors.documentVersionId)))
      .where(eq(dossierSourceAnchors.dossierId, access.dossier.id)).orderBy(desc(dossierSourceAnchors.createdAt)).limit(1_000),
    context.db.select({
      assertion_id: dossierProfessionalAssertions.id,
      assertion_type: dossierProfessionalAssertions.assertionType,
      statement: dossierProfessionalAssertions.statement,
      status: dossierProfessionalAssertions.status,
      reviewed_by: dossierProfessionalAssertions.reviewedByActorRef,
      reviewed_at: dossierProfessionalAssertions.reviewedAt,
    }).from(dossierProfessionalAssertions).where(eq(dossierProfessionalAssertions.dossierId, access.dossier.id))
      .orderBy(desc(dossierProfessionalAssertions.updatedAt)).limit(1_000),
    context.db.select({ assertionId: dossierAssertionSources.assertionId, sourceAnchorId: dossierAssertionSources.sourceAnchorId })
      .from(dossierAssertionSources).where(eq(dossierAssertionSources.dossierId, access.dossier.id)),
  ]);
  const sourceIds = new Map<string, string[]>();
  for (const source of assertionSources) sourceIds.set(source.assertionId, [...(sourceIds.get(source.assertionId) ?? []), source.sourceAnchorId]);
  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: access.dossier.revision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: canonicalDossierTimestamp(),
  });
  const owner = participants.find((participant) => participant.actor_id === access.dossier.ownerActorId && participant.status === "active");
  return {
    dossier: {
      schema_version: 1,
      dossier_id: access.dossier.id,
      reference: access.dossier.reference,
      title: access.dossier.title,
      dossier_type: { registry: access.dossier.dossierTypeRegistry, id: access.dossier.dossierTypeId, version: access.dossier.dossierTypeVersion },
      terminology: access.dossier.terminology,
      owner_actor_id: access.dossier.ownerActorId,
      owner_display_name: owner?.display_name ?? "Assigned matter owner",
      jurisdictions: access.dossier.jurisdictions,
      classification: access.dossier.classification,
      priority: access.dossier.priority,
      status: access.dossier.status,
      status_reason: access.dossier.statusReason,
      key_deadline_at: access.dossier.keyDeadlineAt,
      key_deadline_timezone: access.dossier.keyDeadlineTimezone,
      revision: access.dossier.revision,
      created_at: access.dossier.createdAt,
      created_by: access.dossier.createdByActorRef,
      updated_at: access.dossier.updatedAt,
      participants,
      source_anchors: anchorRows,
      assertions: assertions.map((assertion) => ({ ...assertion, source_anchor_ids: sourceIds.get(assertion.assertion_id) ?? [] })),
      current_role: access.role,
      permissions: {
        role: access.role,
        can_manage_participants: access.role === "owner",
        can_write: access.role === "owner" || access.role === "contributor",
        can_review: access.role !== "viewer",
        can_transition: access.role !== "viewer",
        can_generate_output: access.role !== "viewer",
        can_approve: access.role === "reviewer",
      },
      readiness,
    },
    contract_version: "1.0.0",
  };
}

async function currentOutputStates(context: DossierServerContext, dossierId: string) {
  const states = await context.db.select({
    outputId: dossierOutputStateEvents.outputId,
    sequence: dossierOutputStateEvents.sequence,
    state: dossierOutputStateEvents.state,
  }).from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, dossierId))
    .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence));
  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  return [...latest.values()].filter(({ state }) => state === "current");
}

function canonicalInputTimestamp(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`${label} is invalid.`);
  return new Date(epoch).toISOString();
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
