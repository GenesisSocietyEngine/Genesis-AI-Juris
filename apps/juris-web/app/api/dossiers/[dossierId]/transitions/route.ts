import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierOutputApprovals,
  dossierOutputStateEvents,
  dossierRevisionReceipts,
  dossierStatusTransitions,
  dossiers,
} from "../../../../../db/schema";
import {
  DOSSIER_STATUSES,
  dossierStatusTransitionDecision,
} from "../../../../dossier-contract";
import { computeStoredDossierReadiness } from "../../../../dossier-readiness-server";
import {
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
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

const ALLOWED_TRANSITION_FIELDS = new Set([
  "newStatus",
  "new_status",
  "expectedRevision",
  "expected_revision",
  "reason",
  "comment",
]);

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site Matter transition rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "transition");
  if (isResponse(access)) return access;
  const payload = await readJsonObject(request, 16_384);
  if (!payload) return dossierJson({ error: "A valid Matter transition is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_TRANSITION_FIELDS.has(key))) {
    return dossierJson({ error: "The Matter transition contains a protected or unknown field." }, 400);
  }
  if (
    ("newStatus" in payload && "new_status" in payload)
    || ("expectedRevision" in payload && "expected_revision" in payload)
  ) {
    return dossierJson({ error: "The Matter transition contains an ambiguous field." }, 400);
  }

  let expectedRevision: number;
  let newStatus: (typeof DOSSIER_STATUSES)[number];
  let reason: string | null;
  let comment: string | null;
  try {
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
    newStatus = dossierEnum(payload.newStatus ?? payload.new_status, DOSSIER_STATUSES, "new status");
    reason = optionalDossierText(payload.reason, "transition reason", 1_000);
    comment = optionalDossierText(payload.comment, "transition comment", 2_000);
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The Matter transition is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) {
    return dossierJson({
      error: "The Matter changed before this transition.",
      code: "revision_conflict",
      currentRevision: access.dossier.revision,
    }, 409);
  }

  const outputFacts = await currentOutputFacts(context, access.dossier.id);
  const decision = dossierStatusTransitionDecision({
    from: access.dossier.status,
    to: newStatus,
    actor_role: access.role,
    reason,
    has_current_output: outputFacts.current.length > 0,
    has_reviewer_approval: outputFacts.hasReviewerApproval,
  });
  if (!decision.allowed) {
    return dossierJson({
      error: transitionErrorMessage(decision.code),
      code: decision.code.toLowerCase(),
    }, decision.code === "ROLE_FORBIDDEN" ? 403 : 409);
  }
  if ((newStatus === "closed" || newStatus === "archived") && reason === null) {
    return dossierJson({ error: "A reason is required for this lifecycle transition." }, 409);
  }

  const now = canonicalDossierTimestamp();
  const transitionId = newDossierOpaqueId("transition");
  const nextRevision = expectedRevision + 1;
  const staleOutputs = decision.consequences.includes("mark_outputs_stale")
    ? outputFacts.current
    : [];
  const approvedOutputId = newStatus === "output_approved" ? outputFacts.approvedOutputId : null;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, nextRevision, [
    {
      actorRole: access.role,
      eventType: "dossier_status_transitioned",
      objectRefType: "status_transition",
      objectRefId: transitionId,
      summaryCode: "DOSSIER_STATUS_TRANSITIONED",
      detail: {
        previous_status: access.dossier.status,
        new_status: newStatus,
        revision_before: expectedRevision,
        revision_after: nextRevision,
        requirements: decision.requirements,
        consequences: decision.consequences,
        had_current_output: outputFacts.current.length > 0,
        had_reviewer_approval: outputFacts.hasReviewerApproval,
        approved_output_id: approvedOutputId,
      },
      occurredAt: now,
    },
    ...staleOutputs.map((output) => ({
      actorRole: access.role,
      eventType: "output_marked_stale" as const,
      objectRefType: "governed_output" as const,
      objectRefId: output.outputId,
      summaryCode: "OUTPUT_MARKED_STALE",
      detail: {
        reason_code: "DOSSIER_STATUS_TRANSITIONED",
        previous_status: access.dossier.status,
        new_status: newStatus,
        dossier_revision: nextRevision,
      },
      occurredAt: now,
    })),
  ]);

  try {
    await context.db.batch([
      context.db.insert(dossierStatusTransitions).values({
        id: transitionId,
        dossierId: access.dossier.id,
        revisionBefore: expectedRevision,
        revisionAfter: nextRevision,
        previousStatus: access.dossier.status,
        newStatus,
        approvedOutputId,
        actorUserId: context.actor.userId,
        actorRef: context.actor.actorId,
        actorRole: access.role,
        occurredAt: now,
        reason,
        comment,
        platformAdminOverride: false,
        hadCurrentOutput: outputFacts.current.length > 0,
        hadReviewerApproval: outputFacts.hasReviewerApproval,
        consequences: decision.consequences,
      }),
      context.db.update(dossiers).set({
        status: newStatus,
        statusReason: reason,
        revision: nextRevision,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
        ...(newStatus === "closed" ? {
          closedAt: now,
          closedByActorRef: context.actor.actorId,
          closureReason: reason!,
        } : {}),
        ...(newStatus === "archived" ? {
          archivedAt: now,
          archivedByActorRef: context.actor.actorId,
          archiveReason: reason!,
          archiveAdminOverride: false,
        } : {}),
      }).where(and(
        eq(dossiers.id, access.dossier.id),
        eq(dossiers.revision, expectedRevision),
        eq(dossiers.status, access.dossier.status),
      )),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "DOSSIER_STATUS_TRANSITIONED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return dossierJson({
      error: "The Matter changed before this transition or no longer satisfies its requirements.",
      code: "transition_conflict",
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
    transition: {
      schema_version: 1,
      transition_id: transitionId,
      dossier_id: access.dossier.id,
      previous_status: access.dossier.status,
      new_status: newStatus,
      actor_id: context.actor.actorId,
      actor_role: access.role,
      occurred_at: now,
      reason,
      comment,
      platform_admin_override: false,
      had_current_output: outputFacts.current.length > 0,
      had_reviewer_approval: outputFacts.hasReviewerApproval,
      approved_output_id: approvedOutputId,
      consequences: decision.consequences,
    },
    dossier: {
      dossier_id: access.dossier.id,
      status: newStatus,
      status_reason: reason,
      revision: nextRevision,
      readiness,
    },
  });
}

async function currentOutputFacts(context: DossierServerContext, dossierId: string) {
  const states = await context.db.select({
    outputId: dossierOutputStateEvents.outputId,
    sequence: dossierOutputStateEvents.sequence,
    state: dossierOutputStateEvents.state,
  }).from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, dossierId))
    .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence));
  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  const current = [...latest.values()].filter(({ state }) => state === "current");
  if (current.length === 0) return { current, hasReviewerApproval: false, approvedOutputId: null };
  const [approval] = await context.db.select({
    id: dossierOutputApprovals.id,
    outputId: dossierOutputApprovals.outputId,
  })
    .from(dossierOutputApprovals)
    .where(and(
      eq(dossierOutputApprovals.dossierId, dossierId),
      inArray(dossierOutputApprovals.outputId, current.map(({ outputId }) => outputId)),
      eq(dossierOutputApprovals.reviewerUserId, context.actor.userId),
      eq(dossierOutputApprovals.reviewerActorRef, context.actor.actorId),
    ))
    .orderBy(desc(dossierOutputApprovals.approvedAt), asc(dossierOutputApprovals.outputId), asc(dossierOutputApprovals.id))
    .limit(1);
  return {
    current,
    hasReviewerApproval: Boolean(approval),
    approvedOutputId: approval?.outputId ?? null,
  };
}

function transitionErrorMessage(code: string) {
  switch (code) {
    case "ROLE_FORBIDDEN":
      return "Your Matter role cannot perform that transition.";
    case "REASON_REQUIRED":
      return "A reason is required for that transition.";
    case "CURRENT_OUTPUT_REQUIRED":
      return "A current governed output is required for that transition.";
    case "REVIEWER_APPROVAL_REQUIRED":
      return "A reviewer approval on a current governed output is required for that transition.";
    default:
      return "That transition is not permitted from the current Matter status.";
  }
}
