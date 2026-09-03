import { and, asc, eq, isNotNull } from "drizzle-orm";
import {
  caseVersions,
  dossierDecisionPackageReferences,
  dossierOutputStateEvents,
} from "../db/schema";
import type { DossierRole } from "./dossier-contract";
import { validatedPublishedGraphTarget } from "./dossier-evidence-graph";
import {
  newDossierOpaqueId,
  type DossierAuditEventInput,
  type DossierServerContext,
} from "./dossier-server";

const MAX_OUTPUT_STATE_ROWS = 5_000;

export type CurrentEvidenceOutput = {
  outputId: string;
  sequence: number;
};

export async function loadCurrentEvidenceOutputs(
  context: DossierServerContext,
  dossierId: string,
): Promise<
  | { ok: true; current: CurrentEvidenceOutput[] }
  | { ok: false; current: [] }
> {
  const states = await context.db.select({
    outputId: dossierOutputStateEvents.outputId,
    sequence: dossierOutputStateEvents.sequence,
    state: dossierOutputStateEvents.state,
  }).from(dossierOutputStateEvents).where(eq(dossierOutputStateEvents.dossierId, dossierId))
    .orderBy(asc(dossierOutputStateEvents.outputId), asc(dossierOutputStateEvents.sequence))
    .limit(MAX_OUTPUT_STATE_ROWS + 1);
  if (states.length > MAX_OUTPUT_STATE_ROWS) return { ok: false, current: [] };

  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  return {
    ok: true,
    current: [...latest.values()]
      .filter(({ state }) => state === "current")
      .map(({ outputId, sequence }) => ({ outputId, sequence })),
  };
}

export function evidenceOutputStateStatements(
  context: DossierServerContext,
  dossierId: string,
  outputs: readonly CurrentEvidenceOutput[],
  reason: EvidenceStaleReason,
  occurredAt: string,
) {
  return outputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
    id: newDossierOpaqueId("output_state"),
    dossierId,
    outputId: output.outputId,
    sequence: output.sequence + 1,
    state: "stale",
    reason,
    occurredAt,
    actorRef: context.actor.actorId,
  }));
}

export function evidenceOutputAuditInputs(
  outputs: readonly CurrentEvidenceOutput[],
  role: DossierRole,
  reason: EvidenceStaleReason,
  dossierRevision: number,
  occurredAt: string,
): DossierAuditEventInput[] {
  return outputs.map((output) => ({
    actorRole: role,
    eventType: "output_marked_stale",
    objectRefType: "governed_output",
    objectRefId: output.outputId,
    summaryCode: "OUTPUT_MARKED_STALE",
    detail: { reason_code: reason, dossier_revision: dossierRevision },
    occurredAt,
  }));
}

export type EvidenceStaleReason =
  | "DOCUMENT_REVIEW_CHANGED"
  | "SOURCE_ANCHOR_CHANGED"
  | "PROFESSIONAL_ASSERTION_CHANGED"
  | "EVIDENCE_LINK_CHANGED";

/** Re-validates the exact immutable published graph behind a current
 * same-dossier reference before trusting a graph node or edge identifier. */
export async function exactCurrentGraphEntityExists(
  context: DossierServerContext,
  dossierId: string,
  decisionPackageReferenceId: string,
  targetType: "graph_node" | "graph_edge",
  targetId: string,
): Promise<boolean> {
  const [record] = await context.db.select({
    referenceGraphDigest: dossierDecisionPackageReferences.graphDigest,
    packageId: caseVersions.caseId,
    packageVersion: caseVersions.version,
    packageFingerprint: caseVersions.fingerprint,
    studioFingerprint: caseVersions.studioFingerprint,
    payload: caseVersions.payload,
  }).from(dossierDecisionPackageReferences).innerJoin(caseVersions, and(
    eq(caseVersions.caseId, dossierDecisionPackageReferences.packageId),
    eq(caseVersions.version, dossierDecisionPackageReferences.packageVersion),
    eq(caseVersions.fingerprint, dossierDecisionPackageReferences.packageFingerprint),
    isNotNull(caseVersions.publishedAt),
  )).where(and(
    eq(dossierDecisionPackageReferences.dossierId, dossierId),
    eq(dossierDecisionPackageReferences.id, decisionPackageReferenceId),
    eq(dossierDecisionPackageReferences.state, "current"),
    eq(dossierDecisionPackageReferences.graphValidationStatus, "valid"),
    eq(dossierDecisionPackageReferences.approvalState, "published"),
  )).limit(1);
  if (!record) return false;
  return validatedPublishedGraphTarget(record, targetType, targetId);
}

export function evidencePageLimit(value: string | null, maximum = 50): number | null {
  if (value === null || value === "") return maximum;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maximum);
}

export function graphEntityId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/u.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

export function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`${label} is invalid.`);
  return value as number;
}

export function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} is invalid.`);
  return value as number;
}
