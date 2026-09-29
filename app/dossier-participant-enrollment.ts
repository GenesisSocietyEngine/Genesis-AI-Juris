import { and, asc, count, eq, or } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierOutputStateEvents,
  dossierParticipants,
  dossierRevisionReceipts,
  dossiers,
  users,
} from "../db/schema";
import type {
  DossierAuditEventInput,
  DossierRevisionAuditBatch,
  DossierServerContext,
} from "./dossier-server";
import { parseDossierOpaqueId } from "./dossier-security";
import { assertOrganizationCurrent, organizationMemberActive } from "./organization-store";

export const DOSSIER_ENROLLABLE_ROLES = ["contributor", "reviewer", "viewer"] as const;
export type DossierEnrollableRole = (typeof DOSSIER_ENROLLABLE_ROLES)[number];
export const DOSSIER_MAX_PARTICIPANT_ROWS = 100;

export interface DossierParticipantEnrollmentDependencies {
  now: () => string;
  newId: (prefix: string) => string;
  prepareRevisionAuditBatch: (
    context: DossierServerContext,
    dossierId: string,
    resultingRevision: number,
    inputs: readonly DossierAuditEventInput[],
  ) => Promise<DossierRevisionAuditBatch>;
}

const MAX_OUTPUT_STATE_ROWS = 5_000;
const PARTICIPANT_CHANGED_REASON = "DOSSIER_PARTICIPANT_CHANGED";

export type DossierParticipantEnrollmentResult =
  | {
      ok: true;
      participant: {
        participant_id: string;
        actor_id: string;
        display_name: string;
        role: DossierEnrollableRole;
        status: "active";
      };
      dossier_revision: number;
      audit_event_id: string;
      stale_output_ids: string[];
    }
  | {
      ok: false;
      code: "participant_enrollment_unavailable" | "revision_conflict" | "output_state_limit";
      currentRevision?: number;
    };

export async function enrollDossierParticipant(input: {
  context: DossierServerContext;
  dossierId: string;
  targetActorId: string;
  role: DossierEnrollableRole;
  expectedRevision: number;
  dependencies: DossierParticipantEnrollmentDependencies;
}): Promise<DossierParticipantEnrollmentResult> {
  let dossierId: string;
  let targetActorId: string;
  try {
    dossierId = parseDossierOpaqueId(input.dossierId, "dossier ID");
    targetActorId = parseDossierOpaqueId(input.targetActorId, "participant Actor ID");
  } catch {
    return unavailable();
  }
  if (
    !DOSSIER_ENROLLABLE_ROLES.includes(input.role)
    || !Number.isSafeInteger(input.expectedRevision)
    || input.expectedRevision < 1
  ) {
    return unavailable();
  }

  // Re-resolve exact live owner authority in the service so a route cannot
  // accidentally widen this mutation by passing client-derived role data.
  const [owner] = await input.context.db.select({
    revision: dossiers.revision,
  }).from(dossiers).innerJoin(dossierParticipants, and(
    eq(dossierParticipants.dossierId, dossiers.id),
    eq(dossierParticipants.userId, input.context.actor.userId),
    eq(dossierParticipants.actorId, input.context.actor.actorId),
    eq(dossierParticipants.role, "owner"),
    eq(dossierParticipants.status, "active"),
  )).where(and(
    eq(dossiers.id, dossierId),
    eq(dossiers.ownerUserId, input.context.actor.userId),
    eq(dossiers.ownerActorId, input.context.actor.actorId),
  )).limit(1);
  if (!owner) return unavailable();
  if (owner.revision !== input.expectedRevision) {
    return { ok: false, code: "revision_conflict", currentRevision: owner.revision };
  }

  // Removed rows are immutable participation history and consume capacity too.
  // Resolve this boundary before the target profile so at-capacity, missing,
  // duplicate, and removed targets retain one non-enumerating result.
  const [capacity] = await input.context.db.select({
    total: count(),
  }).from(dossierParticipants).where(eq(dossierParticipants.dossierId, dossierId));
  if (Number(capacity?.total ?? 0) >= DOSSIER_MAX_PARTICIPANT_ROWS) {
    return unavailable();
  }

  // Actor ID is the only account lookup key. Email and display name are never
  // accepted from the client; the canonical profile row supplies both identity
  // binding and the participant register label.
  const [target] = await input.context.db.select({
    userId: users.id,
    actorId: users.actorId,
    displayName: users.displayName,
  }).from(users).where(eq(users.actorId, targetActorId)).limit(1);
  if (!target?.actorId) return unavailable();
  if (input.context.organization) {
    try {
      await assertOrganizationCurrent(input.context.db, input.context.actor, input.context.organization);
      if (!await organizationMemberActive(input.context.db, input.context.organization.id, target.actorId)) return unavailable();
    } catch { return unavailable(); }
  }

  const [existing] = await input.context.db.select({ id: dossierParticipants.id })
    .from(dossierParticipants).where(and(
      eq(dossierParticipants.dossierId, dossierId),
      or(
        eq(dossierParticipants.userId, target.userId),
        eq(dossierParticipants.actorId, targetActorId),
      ),
    )).limit(1);
  // Missing accounts, existing participants, removed participants, and owner
  // self-enrollment intentionally share one non-enumerating result.
  if (existing) return unavailable();

  const outputStates = await loadBoundedOutputStates(input.context, dossierId);
  if (!outputStates.ok) return { ok: false, code: "output_state_limit" };

  const now = input.dependencies.now();
  const nextRevision = input.expectedRevision + 1;
  const participantId = input.dependencies.newId("participant");
  const participant = {
    id: participantId,
    dossierId,
    userId: target.userId,
    actorId: targetActorId,
    displayName: target.displayName,
    role: input.role,
    status: "active" as const,
    createdByActorRef: input.context.actor.actorId,
    updatedByActorRef: input.context.actor.actorId,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof dossierParticipants.$inferInsert;
  const { revisionReceipt, auditEvents } = await input.dependencies.prepareRevisionAuditBatch(
    input.context,
    dossierId,
    nextRevision,
    [
      {
        actorRole: "owner",
        eventType: "participant_changed",
        objectRefType: "participant",
        objectRefId: participantId,
        summaryCode: "PARTICIPANT_ENROLLED",
        detail: {
          action: "enrolled",
          participant_actor_id: targetActorId,
          participant_role: input.role,
          participant_status: "active",
          revision_before: input.expectedRevision,
          revision_after: nextRevision,
        },
        occurredAt: now,
      },
      ...outputStates.current.map((output) => ({
        actorRole: "owner" as const,
        eventType: "output_marked_stale" as const,
        objectRefType: "governed_output" as const,
        objectRefId: output.outputId,
        summaryCode: "OUTPUT_MARKED_STALE",
        detail: {
          reason_code: PARTICIPANT_CHANGED_REASON,
          participant_id: participantId,
          dossier_revision: nextRevision,
        },
        occurredAt: now,
      })),
    ],
  );

  try {
    await input.context.db.batch([
      input.context.db.update(dossiers).set({
        revision: nextRevision,
        updatedAt: now,
        updatedByActorRef: input.context.actor.actorId,
      }).where(and(
        eq(dossiers.id, dossierId),
        eq(dossiers.revision, input.expectedRevision),
        eq(dossiers.ownerUserId, input.context.actor.userId),
        eq(dossiers.ownerActorId, input.context.actor.actorId),
      )),
      input.context.db.insert(dossierParticipants).values(participant),
      ...outputStates.current.map((output) => input.context.db.insert(dossierOutputStateEvents).values({
        id: input.dependencies.newId("output_state"),
        dossierId,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: PARTICIPANT_CHANGED_REASON,
        occurredAt: now,
        actorRef: input.context.actor.actorId,
      })),
      ...auditEvents.map((event) => input.context.db.insert(dossierAuditEvents).values(event)),
      input.context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    // A concurrent dossier revision, account enrollment, or authority change
    // returns the same CAS-shaped failure without confirming account existence.
    return { ok: false, code: "revision_conflict" };
  }

  return {
    ok: true,
    participant: {
      participant_id: participantId,
      actor_id: targetActorId,
      display_name: target.displayName,
      role: input.role,
      status: "active",
    },
    dossier_revision: nextRevision,
    audit_event_id: auditEvents[0]!.id,
    stale_output_ids: outputStates.current.map(({ outputId }) => outputId),
  };
}

async function loadBoundedOutputStates(context: DossierServerContext, dossierId: string) {
  const states = await context.db.select({
    outputId: dossierOutputStateEvents.outputId,
    sequence: dossierOutputStateEvents.sequence,
    state: dossierOutputStateEvents.state,
  }).from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, dossierId))
    .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence))
    .limit(MAX_OUTPUT_STATE_ROWS + 1);
  if (states.length > MAX_OUTPUT_STATE_ROWS) {
    return { ok: false as const, current: [] };
  }
  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  return {
    ok: true as const,
    current: [...latest.values()].filter(({ state }) => state === "current"),
  };
}

function unavailable(): DossierParticipantEnrollmentResult {
  return { ok: false, code: "participant_enrollment_unavailable" };
}
