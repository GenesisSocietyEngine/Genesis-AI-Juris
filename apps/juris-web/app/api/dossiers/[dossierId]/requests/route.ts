import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierDeadlineReferences,
  dossierDeadlineSources,
  dossierDocuments,
  dossierEvidenceLinks,
  dossierInformationRequests,
  dossierOutputStateEvents,
  dossierParticipants,
  dossierRevisionReceipts,
  dossiers,
} from "../../../../../db/schema";
import { computeStoredDossierReadiness } from "../../../../dossier-readiness-server";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import {
  boundedDossierText,
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
  dossierNotFound,
  expectedDossierRevision,
  isResponse,
  newDossierOpaqueId,
  optionalDossierText,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const MAX_PAGE_SIZE = 50;
const REQUEST_ACTIONS = ["create", "update_status"] as const;
const REQUEST_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const REQUEST_STATUSES = ["open", "received", "waived", "cancelled"] as const;
const REQUEST_REASON_CODES = ["INFORMATION_REQUEST_OPEN", "INFORMATION_REQUEST_OVERDUE"] as const;

const ALLOWED_REQUEST_FIELDS = new Set([
  "action",
  "expectedRevision",
  "expected_revision",
  "requestId",
  "request_id",
  "informationRequestId",
  "information_request_id",
  "question",
  "reason",
  "priority",
  "dueAt",
  "due_at",
  "timezone",
  "readinessReasonCode",
  "readiness_reason_code",
  "requestedFromParticipantId",
  "requested_from_participant_id",
  "status",
  "satisfyingDocumentId",
  "satisfying_document_id",
  "satisfyingEvidenceLinkId",
  "satisfying_evidence_link_id",
]);

const CREATE_ONLY_FIELDS = [
  "question", "reason", "priority", "dueAt", "due_at", "timezone",
  "readinessReasonCode", "readiness_reason_code",
  "requestedFromParticipantId", "requested_from_participant_id",
] as const;

const STATUS_ONLY_FIELDS = [
  "requestId", "request_id", "informationRequestId", "information_request_id", "status",
  "satisfyingDocumentId", "satisfying_document_id",
  "satisfyingEvidenceLinkId", "satisfying_evidence_link_id",
] as const;

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  const limit = pageLimit(url.searchParams.get("limit"));
  if (limit === null) return dossierJson({ error: "The request page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursor: { id: string; createdAt: string } | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "information request cursor");
    } catch {
      return dossierJson({ error: "The request cursor is invalid." }, 400);
    }
    const [storedCursor] = await context.db.select({
      id: dossierInformationRequests.id,
      createdAt: dossierInformationRequests.createdAt,
    }).from(dossierInformationRequests).where(and(
      eq(dossierInformationRequests.dossierId, access.dossier.id),
      eq(dossierInformationRequests.id, cursorId),
    )).limit(1);
    if (!storedCursor) return dossierJson({ error: "The request cursor is invalid." }, 400);
    cursor = storedCursor;
  }

  const requestRows = await context.db.select({
    informationRequestId: dossierInformationRequests.id,
    dossierId: dossierInformationRequests.dossierId,
    question: dossierInformationRequests.question,
    ownerActorId: dossierInformationRequests.ownerActorRef,
    requestedFromParticipantId: dossierInformationRequests.requestedFromParticipantId,
    requestedFromDisplayName: dossierParticipants.displayName,
    priority: dossierInformationRequests.priority,
    dueAt: dossierInformationRequests.dueAt,
    timezone: dossierInformationRequests.timezone,
    status: dossierInformationRequests.status,
    reason: dossierInformationRequests.reason,
    readinessReasonCode: dossierInformationRequests.readinessReasonCode,
    satisfyingDocumentId: dossierInformationRequests.satisfyingDocumentId,
    satisfyingEvidenceLinkId: dossierInformationRequests.satisfyingEvidenceLinkId,
    createdAt: dossierInformationRequests.createdAt,
    createdBy: dossierInformationRequests.createdByActorRef,
    updatedAt: dossierInformationRequests.updatedAt,
    updatedBy: dossierInformationRequests.updatedByActorRef,
  }).from(dossierInformationRequests).leftJoin(dossierParticipants, and(
    eq(dossierParticipants.dossierId, dossierInformationRequests.dossierId),
    eq(dossierParticipants.id, dossierInformationRequests.requestedFromParticipantId),
  )).where(and(
    eq(dossierInformationRequests.dossierId, access.dossier.id),
    cursor ? or(
      lt(dossierInformationRequests.createdAt, cursor.createdAt),
      and(
        eq(dossierInformationRequests.createdAt, cursor.createdAt),
        lt(dossierInformationRequests.id, cursor.id),
      ),
    ) : undefined,
  )).orderBy(desc(dossierInformationRequests.createdAt), desc(dossierInformationRequests.id))
    .limit(limit + 1);

  const hasMore = requestRows.length > limit;
  const visibleRequests = requestRows.slice(0, limit);
  const deadlineRows = await context.db.select({
    deadlineReferenceId: dossierDeadlineReferences.id,
    dossierId: dossierDeadlineReferences.dossierId,
    deadlineKind: dossierDeadlineReferences.deadlineKind,
    title: dossierDeadlineReferences.title,
    dueAt: dossierDeadlineReferences.dueAt,
    timezone: dossierDeadlineReferences.timezone,
    critical: dossierDeadlineReferences.critical,
    status: dossierDeadlineReferences.status,
    decisionPackageReferenceId: dossierDeadlineReferences.decisionPackageReferenceId,
    simulationDeadlineId: dossierDeadlineReferences.simulationDeadlineId,
    createdAt: dossierDeadlineReferences.createdAt,
    createdBy: dossierDeadlineReferences.createdByActorRef,
    updatedAt: dossierDeadlineReferences.updatedAt,
    updatedBy: dossierDeadlineReferences.updatedByActorRef,
  }).from(dossierDeadlineReferences).where(eq(
    dossierDeadlineReferences.dossierId,
    access.dossier.id,
  )).orderBy(asc(dossierDeadlineReferences.dueAt), asc(dossierDeadlineReferences.id)).limit(MAX_PAGE_SIZE);

  const deadlineSourceRows = deadlineRows.length === 0 ? [] : await context.db.select({
    deadlineReferenceId: dossierDeadlineSources.deadlineReferenceId,
    sourceAnchorId: dossierDeadlineSources.sourceAnchorId,
  }).from(dossierDeadlineSources).where(and(
    eq(dossierDeadlineSources.dossierId, access.dossier.id),
    inArray(dossierDeadlineSources.deadlineReferenceId, deadlineRows.map((deadline) => deadline.deadlineReferenceId)),
  )).orderBy(asc(dossierDeadlineSources.deadlineReferenceId), asc(dossierDeadlineSources.sourceAnchorId));
  const sourcesByDeadline = new Map<string, string[]>();
  for (const source of deadlineSourceRows) {
    const sources = sourcesByDeadline.get(source.deadlineReferenceId) ?? [];
    sources.push(source.sourceAnchorId);
    sourcesByDeadline.set(source.deadlineReferenceId, sources);
  }

  return dossierJson({
    requests: visibleRequests.map(projectInformationRequest),
    deadlines: deadlineRows.map((deadline) => ({
      object_type: "deadline_reference",
      schema_version: 1,
      deadline_reference_id: deadline.deadlineReferenceId,
      dossier_id: deadline.dossierId,
      deadline_kind: deadline.deadlineKind,
      title: deadline.title,
      due_at: deadline.dueAt,
      timezone: deadline.timezone,
      critical: deadline.critical,
      status: deadline.status,
      source_anchor_ids: sourcesByDeadline.get(deadline.deadlineReferenceId) ?? [],
      decision_package_reference_id: deadline.decisionPackageReferenceId,
      simulation_deadline_id: deadline.simulationDeadlineId,
      created_at: deadline.createdAt,
      created_by: deadline.createdBy,
      updated_at: deadline.updatedAt,
      updated_by: deadline.updatedBy,
    })),
    next_cursor: hasMore ? visibleRequests[visibleRequests.length - 1]?.informationRequestId ?? null : null,
  });
}

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site information-request mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "requests");
  if (isResponse(access)) return access;
  const payload = await readJsonObject(request, 32_768);
  if (!payload) return dossierJson({ error: "A valid information-request mutation is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_REQUEST_FIELDS.has(key))) {
    return dossierJson({ error: "The information-request mutation contains a protected or unknown field." }, 400);
  }
  if (hasAmbiguousAliases(payload)) {
    return dossierJson({ error: "The information-request mutation contains an ambiguous field." }, 400);
  }

  let expectedRevision: number;
  let action: (typeof REQUEST_ACTIONS)[number];
  try {
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
    const inferredAction = hasAny(payload, STATUS_ONLY_FIELDS) ? "update_status" : "create";
    action = dossierEnum(payload.action ?? inferredAction, REQUEST_ACTIONS, "request action");
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The information-request mutation is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) {
    return dossierJson({
      error: "The Matter changed before this information request could be saved.",
      code: "revision_conflict",
      currentRevision: access.dossier.revision,
    }, 409);
  }
  if (action === "create" && hasAny(payload, STATUS_ONLY_FIELDS)) {
    return dossierJson({ error: "Create and status-update fields cannot be combined." }, 400);
  }
  if (action === "update_status" && hasAny(payload, CREATE_ONLY_FIELDS)) {
    return dossierJson({ error: "Status updates accept only the request identity, status, and satisfying evidence." }, 400);
  }

  return action === "create"
    ? createInformationRequest(context, access, payload, expectedRevision)
    : updateInformationRequestStatus(context, access, payload, expectedRevision);
}

async function createInformationRequest(
  context: DossierServerContext,
  access: Exclude<Awaited<ReturnType<typeof requireDossierAccess>>, Response>,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let question: string;
  let reason: string;
  let priority: (typeof REQUEST_PRIORITIES)[number];
  let requestedFromParticipantId: string | null;
  let due: { dueAt: string | null; timezone: string | null };
  try {
    question = boundedDossierText(payload.question, "information-request question", 1, 4_000);
    reason = boundedDossierText(payload.reason, "information-request reason", 1, 1_000);
    priority = dossierEnum(payload.priority ?? "normal", REQUEST_PRIORITIES, "information-request priority");
    requestedFromParticipantId = optionalOpaqueId(
      payload.requestedFromParticipantId ?? payload.requested_from_participant_id,
      "requested-from participant ID",
    );
    due = normaliseDuePair(payload.dueAt ?? payload.due_at, payload.timezone);
    if (payload.readinessReasonCode !== undefined || payload.readiness_reason_code !== undefined) {
      dossierEnum(
        payload.readinessReasonCode ?? payload.readiness_reason_code,
        REQUEST_REASON_CODES,
        "information-request readiness reason",
      );
    }
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The information request is invalid.",
    }, 400);
  }

  const participant = await resolveRequestedParticipant(context, access.dossier.id, requestedFromParticipantId);
  if (!participant.valid) {
    return dossierJson({ error: "A valid active Matter participant is required." }, 400);
  }

  const now = canonicalDossierTimestamp();
  const informationRequestId = newDossierOpaqueId("request");
  const nextRevision = expectedRevision + 1;
  const readinessReasonCode = due.dueAt && Date.parse(due.dueAt) < Date.parse(now)
    ? "INFORMATION_REQUEST_OVERDUE"
    : "INFORMATION_REQUEST_OPEN";
  const values = {
    id: informationRequestId,
    dossierId: access.dossier.id,
    question,
    ownerUserId: context.actor.userId,
    ownerActorRef: context.actor.actorId,
    requestedFromParticipantId,
    priority,
    dueAt: due.dueAt,
    timezone: due.timezone,
    status: "open" as const,
    reason,
    readinessReasonCode,
    satisfyingDocumentId: null,
    satisfyingEvidenceLinkId: null,
    createdByActorRef: context.actor.actorId,
    updatedByActorRef: context.actor.actorId,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof dossierInformationRequests.$inferInsert;
  const staleOutputs = await currentOutputStates(context, access.dossier.id);
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, nextRevision, [
    {
      actorRole: access.role,
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: informationRequestId,
      summaryCode: "INFORMATION_REQUEST_CREATED",
      detail: {
        action: "create",
        priority,
        status: "open",
        due_at: due.dueAt,
        readiness_reason_code: readinessReasonCode,
        requested_from_participant_id: requestedFromParticipantId,
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    },
    ...staleOutputs.map((output) => ({
      actorRole: access.role,
      eventType: "output_marked_stale" as const,
      objectRefType: "governed_output" as const,
      objectRefId: output.outputId,
      summaryCode: "OUTPUT_MARKED_STALE",
      detail: { reason_code: "INFORMATION_REQUEST_CHANGED", dossier_revision: nextRevision },
      occurredAt: now,
    })),
  ]);

  try {
    await context.db.batch([
      context.db.update(dossiers).set({
        revision: nextRevision,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
      }).where(and(eq(dossiers.id, access.dossier.id), eq(dossiers.revision, expectedRevision))),
      context.db.insert(dossierInformationRequests).values(values),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "INFORMATION_REQUEST_CHANGED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return dossierJson({
      error: "The Matter changed before this information request could be recorded.",
      code: "request_conflict",
    }, 409);
  }

  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: nextRevision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: now,
  });
  return dossierJson({
    request: projectInformationRequest({
      informationRequestId,
      dossierId: access.dossier.id,
      question,
      ownerActorId: context.actor.actorId,
      requestedFromParticipantId,
      requestedFromDisplayName: participant.displayName,
      priority,
      dueAt: due.dueAt,
      timezone: due.timezone,
      status: "open",
      reason,
      readinessReasonCode,
      satisfyingDocumentId: null,
      satisfyingEvidenceLinkId: null,
      createdAt: now,
      createdBy: context.actor.actorId,
      updatedAt: now,
      updatedBy: context.actor.actorId,
    }),
    dossier: { dossier_id: access.dossier.id, revision: nextRevision, readiness },
    audit_event_id: auditEvents[0]!.id,
  }, 201);
}

async function updateInformationRequestStatus(
  context: DossierServerContext,
  access: Exclude<Awaited<ReturnType<typeof requireDossierAccess>>, Response>,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let informationRequestId: string;
  let status: (typeof REQUEST_STATUSES)[number];
  let suppliedDocumentId: string | null;
  let suppliedEvidenceLinkId: string | null;
  try {
    informationRequestId = parseDossierOpaqueId(
      payload.informationRequestId ?? payload.information_request_id ?? payload.requestId ?? payload.request_id,
      "information request ID",
    );
    status = dossierEnum(payload.status, REQUEST_STATUSES, "information-request status");
    suppliedDocumentId = optionalOpaqueId(
      payload.satisfyingDocumentId ?? payload.satisfying_document_id,
      "satisfying document ID",
    );
    suppliedEvidenceLinkId = optionalOpaqueId(
      payload.satisfyingEvidenceLinkId ?? payload.satisfying_evidence_link_id,
      "satisfying evidence-link ID",
    );
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The information-request status update is invalid.",
    }, 400);
  }

  const [stored] = await context.db.select().from(dossierInformationRequests).where(and(
    eq(dossierInformationRequests.dossierId, access.dossier.id),
    eq(dossierInformationRequests.id, informationRequestId),
  )).limit(1);
  if (!stored) return dossierNotFound();

  const satisfyingDocumentId = status === "received"
    ? suppliedDocumentId ?? stored.satisfyingDocumentId
    : null;
  const satisfyingEvidenceLinkId = status === "received"
    ? suppliedEvidenceLinkId ?? stored.satisfyingEvidenceLinkId
    : null;
  if (status === "received" && !satisfyingDocumentId && !satisfyingEvidenceLinkId) {
    return dossierJson({ error: "A received request must identify a satisfying document or reviewed evidence link." }, 400);
  }
  if (satisfyingDocumentId && !(await documentExists(context, access.dossier.id, satisfyingDocumentId))) {
    return dossierJson({ error: "The satisfying Matter source is unavailable." }, 400);
  }
  if (satisfyingEvidenceLinkId && !(await evidenceLinkExists(context, access.dossier.id, satisfyingEvidenceLinkId))) {
    return dossierJson({ error: "The satisfying Matter source is unavailable." }, 400);
  }
  if (
    status === stored.status
    && satisfyingDocumentId === stored.satisfyingDocumentId
    && satisfyingEvidenceLinkId === stored.satisfyingEvidenceLinkId
  ) {
    return dossierJson({ error: "The information request already has that status and satisfying source.", code: "no_change" }, 409);
  }

  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const staleOutputs = await currentOutputStates(context, access.dossier.id);
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, nextRevision, [
    {
      actorRole: access.role,
      eventType: "information_request_changed",
      objectRefType: "information_request",
      objectRefId: informationRequestId,
      summaryCode: "INFORMATION_REQUEST_STATUS_CHANGED",
      detail: {
        action: "update_status",
        previous_status: stored.status,
        new_status: status,
        satisfying_document_id: satisfyingDocumentId,
        satisfying_evidence_link_id: satisfyingEvidenceLinkId,
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    },
    ...staleOutputs.map((output) => ({
      actorRole: access.role,
      eventType: "output_marked_stale" as const,
      objectRefType: "governed_output" as const,
      objectRefId: output.outputId,
      summaryCode: "OUTPUT_MARKED_STALE",
      detail: { reason_code: "INFORMATION_REQUEST_CHANGED", dossier_revision: nextRevision },
      occurredAt: now,
    })),
  ]);

  try {
    await context.db.batch([
      context.db.update(dossiers).set({
        revision: nextRevision,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
      }).where(and(eq(dossiers.id, access.dossier.id), eq(dossiers.revision, expectedRevision))),
      context.db.update(dossierInformationRequests).set({
        status,
        satisfyingDocumentId,
        satisfyingEvidenceLinkId,
        updatedByActorRef: context.actor.actorId,
        updatedAt: now,
      }).where(and(
        eq(dossierInformationRequests.dossierId, access.dossier.id),
        eq(dossierInformationRequests.id, informationRequestId),
      )),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "INFORMATION_REQUEST_CHANGED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return dossierJson({
      error: "The Matter changed before this information-request status could be recorded.",
      code: "request_conflict",
    }, 409);
  }

  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: nextRevision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: now,
  });
  const participant = await resolveRequestedParticipant(
    context,
    access.dossier.id,
    stored.requestedFromParticipantId,
  );
  return dossierJson({
    request: projectInformationRequest({
      informationRequestId: stored.id,
      dossierId: stored.dossierId,
      question: stored.question,
      ownerActorId: stored.ownerActorRef,
      requestedFromParticipantId: stored.requestedFromParticipantId,
      requestedFromDisplayName: participant.displayName,
      priority: stored.priority,
      dueAt: stored.dueAt,
      timezone: stored.timezone,
      status,
      reason: stored.reason,
      readinessReasonCode: stored.readinessReasonCode,
      satisfyingDocumentId,
      satisfyingEvidenceLinkId,
      createdAt: stored.createdAt,
      createdBy: stored.createdByActorRef,
      updatedAt: now,
      updatedBy: context.actor.actorId,
    }),
    dossier: { dossier_id: access.dossier.id, revision: nextRevision, readiness },
    audit_event_id: auditEvents[0]!.id,
  });
}

type ProjectableRequest = {
  informationRequestId: string;
  dossierId: string;
  question: string;
  ownerActorId: string;
  requestedFromParticipantId: string | null;
  requestedFromDisplayName: string | null;
  priority: string;
  dueAt: string | null;
  timezone: string | null;
  status: string;
  reason: string;
  readinessReasonCode: string;
  satisfyingDocumentId: string | null;
  satisfyingEvidenceLinkId: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

function projectInformationRequest(value: ProjectableRequest) {
  return {
    object_type: "information_request",
    schema_version: 1,
    information_request_id: value.informationRequestId,
    dossier_id: value.dossierId,
    question: value.question,
    owner_actor_id: value.ownerActorId,
    requested_from_participant_id: value.requestedFromParticipantId,
    requested_from_display_name: value.requestedFromDisplayName,
    priority: value.priority,
    due_at: value.dueAt,
    timezone: value.timezone,
    status: value.status,
    reason: value.reason,
    readiness_reason_code: value.readinessReasonCode,
    satisfying_document_id: value.satisfyingDocumentId,
    satisfying_evidence_link_id: value.satisfyingEvidenceLinkId,
    created_at: value.createdAt,
    created_by: value.createdBy,
    updated_at: value.updatedAt,
    updated_by: value.updatedBy,
  };
}

async function resolveRequestedParticipant(
  context: DossierServerContext,
  dossierId: string,
  participantId: string | null,
): Promise<{ valid: boolean; displayName: string | null }> {
  if (participantId === null) return { valid: true, displayName: null };
  const [participant] = await context.db.select({ displayName: dossierParticipants.displayName })
    .from(dossierParticipants).where(and(
      eq(dossierParticipants.dossierId, dossierId),
      eq(dossierParticipants.id, participantId),
      eq(dossierParticipants.status, "active"),
    )).limit(1);
  return participant
    ? { valid: true, displayName: participant.displayName }
    : { valid: false, displayName: null };
}

async function documentExists(context: DossierServerContext, dossierId: string, documentId: string) {
  const [row] = await context.db.select({ id: dossierDocuments.id }).from(dossierDocuments).where(and(
    eq(dossierDocuments.dossierId, dossierId),
    eq(dossierDocuments.id, documentId),
  )).limit(1);
  return Boolean(row);
}

async function evidenceLinkExists(context: DossierServerContext, dossierId: string, evidenceLinkId: string) {
  const [row] = await context.db.select({ id: dossierEvidenceLinks.id }).from(dossierEvidenceLinks).where(and(
    eq(dossierEvidenceLinks.dossierId, dossierId),
    eq(dossierEvidenceLinks.id, evidenceLinkId),
  )).limit(1);
  return Boolean(row);
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

function pageLimit(value: string | null): number | null {
  if (value === null || value === "") return MAX_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function hasAny(payload: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((field) => field in payload);
}

function hasAmbiguousAliases(payload: Record<string, unknown>) {
  const aliasConflict = [
    ["expectedRevision", "expected_revision"],
    ["requestId", "request_id"],
    ["informationRequestId", "information_request_id"],
    ["dueAt", "due_at"],
    ["readinessReasonCode", "readiness_reason_code"],
    ["requestedFromParticipantId", "requested_from_participant_id"],
    ["satisfyingDocumentId", "satisfying_document_id"],
    ["satisfyingEvidenceLinkId", "satisfying_evidence_link_id"],
  ].some(([camel, snake]) => camel in payload && snake in payload);
  const requestIdentityCount = [
    "requestId", "request_id", "informationRequestId", "information_request_id",
  ].filter((field) => field in payload).length;
  return aliasConflict || requestIdentityCount > 1;
}

function optionalOpaqueId(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return parseDossierOpaqueId(value, label);
}

function normaliseDuePair(dueAtValue: unknown, timezoneValue: unknown) {
  if (dueAtValue === undefined || dueAtValue === null || dueAtValue === "") {
    return { dueAt: null, timezone: null };
  }
  const dueAt = boundedDossierText(dueAtValue, "information-request due time", 1, 64);
  const timezone = optionalDossierText(timezoneValue, "information-request timezone", 80);
  if (!timezone || !validTimezone(timezone)) throw new Error("A valid IANA timezone is required with the due time.");
  const explicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/u.test(dueAt);
  if (explicitOffset) {
    const epoch = Date.parse(dueAt);
    if (!Number.isFinite(epoch)) throw new Error("The information-request due time is invalid.");
    return { dueAt: new Date(epoch).toISOString(), timezone };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(dueAt);
  if (!match) throw new Error("The information-request due time is invalid.");
  const requested = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
  const targetWallClock = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
    requested.second,
  );
  let instant = targetWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const displayed = zonedDateParts(instant, timezone);
    const displayedWallClock = Date.UTC(
      displayed.year,
      displayed.month - 1,
      displayed.day,
      displayed.hour,
      displayed.minute,
      displayed.second,
    );
    instant += targetWallClock - displayedWallClock;
  }
  const observed = zonedDateParts(instant, timezone);
  if (Object.keys(requested).some((key) => observed[key as keyof typeof observed] !== requested[key as keyof typeof requested])) {
    throw new Error("The due time does not exist in the selected timezone.");
  }
  return { dueAt: new Date(instant).toISOString(), timezone };
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function zonedDateParts(epoch: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epoch));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}
