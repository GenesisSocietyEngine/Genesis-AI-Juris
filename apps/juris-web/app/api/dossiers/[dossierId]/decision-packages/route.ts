import { and, asc, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import {
  caseVersions,
  dossierAIProposalAnchors,
  dossierAIProposals,
  dossierAuditEvents,
  dossierDecisionPackageReferences,
  dossierOutputStateEvents,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
  playEvents,
  playSessions,
} from "../../../../../db/schema";
import { DEFAULT_CASE_TYPE } from "../../../../case-type-reference";
import {
  buildDecisionPackageGraphProposalDiff,
  parseSimulationReceiptReferences,
  proveV61SimulationReceipt,
  validatePublishedDecisionPackage,
  verifyDecisionPackageGraphProposalDiff,
  type DecisionPackageGraphBinding,
  type DecisionPackageGraphTarget,
  type ValidatedPublishedDecisionPackage,
} from "../../../../dossier-decision-package-integration";
import { computeStoredDossierReadiness } from "../../../../dossier-readiness-server";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import {
  boundedDossierText,
  canonicalDossierTimestamp,
  dossierJson,
  expectedDossierRevision,
  isResponse,
  newDossierOpaqueId,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };
type StoredPackageReference = typeof dossierDecisionPackageReferences.$inferSelect;

const MAX_PAGE_SIZE = 50;
const MAX_PACKAGE_REFERENCES = 100;
const MAX_OUTPUT_STATE_ROWS = 5_000;
const MAX_REQUEST_BYTES = 16_384;
const PACKAGE_FIELDS = new Set([
  "expectedRevision",
  "expected_revision",
  "packageId",
  "package_id",
  "packageVersion",
  "package_version",
  "packageFingerprint",
  "package_fingerprint",
  "graphProposalId",
  "graph_proposal_id",
  "simulationReceiptIds",
  "simulation_receipt_ids",
]);
const ALIASED_FIELDS = [
  ["expectedRevision", "expected_revision"],
  ["packageId", "package_id"],
  ["packageVersion", "package_version"],
  ["packageFingerprint", "package_fingerprint"],
  ["graphProposalId", "graph_proposal_id"],
  ["simulationReceiptIds", "simulation_receipt_ids"],
] as const;

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  if (url.searchParams.getAll("limit").length > 1 || url.searchParams.getAll("cursor").length > 1) {
    return dossierJson({ error: "Decision-package pagination parameters must be unique." }, 400);
  }
  const limit = pageLimit(url.searchParams.get("limit"));
  if (limit === null) return dossierJson({ error: "The decision-package page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursor: { id: string; updatedAt: string } | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "decision-package cursor");
    } catch {
      return dossierJson({ error: "The decision-package cursor is invalid." }, 400);
    }
    const [storedCursor] = await context.db.select({
      id: dossierDecisionPackageReferences.id,
      updatedAt: dossierDecisionPackageReferences.updatedAt,
    }).from(dossierDecisionPackageReferences).where(and(
      eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
      eq(dossierDecisionPackageReferences.id, cursorId),
    )).limit(1);
    if (!storedCursor) return dossierJson({ error: "The decision-package cursor is invalid." }, 400);
    cursor = storedCursor;
  }

  const rows = await context.db.select().from(dossierDecisionPackageReferences).where(and(
    eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
    cursor ? or(
      lt(dossierDecisionPackageReferences.updatedAt, cursor.updatedAt),
      and(
        eq(dossierDecisionPackageReferences.updatedAt, cursor.updatedAt),
        lt(dossierDecisionPackageReferences.id, cursor.id),
      ),
    ) : undefined,
  )).orderBy(
    desc(dossierDecisionPackageReferences.updatedAt),
    desc(dossierDecisionPackageReferences.id),
  ).limit(limit + 1);

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return dossierJson({
    decision_packages: visible.map(projectPackageReference),
    page: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore ? visible.at(-1)?.id ?? null : null,
    },
    contract_version: "1.0.0",
  });
}

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site decision-package mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "snapshot");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!payload) return dossierJson({ error: "A valid decision-package link is required." }, 400);
  if (Object.keys(payload).some((key) => !PACKAGE_FIELDS.has(key))) {
    return dossierJson({ error: "The decision-package link contains a protected or unknown field." }, 400);
  }
  if (ALIASED_FIELDS.some(([camel, snake]) => camel in payload && snake in payload)) {
    return dossierJson({ error: "The decision-package link contains an ambiguous field." }, 400);
  }

  let expectedRevision: number;
  let packageId: string;
  let packageVersion: string;
  let packageFingerprint: string;
  let graphProposalId: string | null;
  let requestedSimulationReceiptIds: string[];
  try {
    expectedRevision = expectedDossierRevision(field(payload, "expectedRevision", "expected_revision"));
    packageId = publishedPackageId(field(payload, "packageId", "package_id"));
    packageVersion = semanticVersion(field(payload, "packageVersion", "package_version"));
    packageFingerprint = sha256Fingerprint(field(payload, "packageFingerprint", "package_fingerprint"));
    const proposalValue = field(payload, "graphProposalId", "graph_proposal_id");
    graphProposalId = proposalValue === undefined
      ? null
      : parseDossierOpaqueId(proposalValue, "graph proposal ID");
    requestedSimulationReceiptIds = parseSimulationReceiptReferences(
      field(payload, "simulationReceiptIds", "simulation_receipt_ids"),
    );
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The decision-package identity is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) return revisionConflict(access.dossier.revision);

  const [published] = await context.db.select({
    packageId: caseVersions.caseId,
    packageVersion: caseVersions.version,
    packageFingerprint: caseVersions.fingerprint,
    studioFingerprint: caseVersions.studioFingerprint,
    parentPackageId: caseVersions.parentCaseId,
    parentPackageVersion: caseVersions.parentVersion,
    parentPackageFingerprint: caseVersions.parentFingerprint,
    payload: caseVersions.payload,
  }).from(caseVersions).where(and(
    eq(caseVersions.caseId, packageId),
    eq(caseVersions.version, packageVersion),
    eq(caseVersions.fingerprint, packageFingerprint),
    isNotNull(caseVersions.publishedAt),
  )).limit(1);
  if (!published) {
    return dossierJson({
      error: "That exact published decision package is unavailable.",
      code: "package_not_found",
    }, 404);
  }

  const validationResult = await validatePublishedDecisionPackage(published);
  if (!validationResult.ok) {
    return dossierJson({
      error: "The published decision package failed deterministic graph validation.",
      code: validationResult.code,
      issue_codes: validationResult.issueCodes,
    }, 409);
  }
  const validation = validationResult.value;

  const [existing] = await context.db.select().from(dossierDecisionPackageReferences).where(and(
    eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
    eq(dossierDecisionPackageReferences.packageId, packageId),
    eq(dossierDecisionPackageReferences.packageVersion, packageVersion),
    eq(dossierDecisionPackageReferences.packageFingerprint, packageFingerprint),
  )).limit(1);

  let governedParent: StoredPackageReference | null = null;
  let parentValidation: ValidatedPublishedDecisionPackage | null = null;
  if (
    published.parentPackageId !== null
    && published.parentPackageVersion !== null
    && published.parentPackageFingerprint !== null
  ) {
    const [publishedParent] = await context.db.select({
      packageId: caseVersions.caseId,
      packageVersion: caseVersions.version,
      packageFingerprint: caseVersions.fingerprint,
      studioFingerprint: caseVersions.studioFingerprint,
      parentPackageId: caseVersions.parentCaseId,
      parentPackageVersion: caseVersions.parentVersion,
      parentPackageFingerprint: caseVersions.parentFingerprint,
      payload: caseVersions.payload,
    }).from(caseVersions).where(and(
      eq(caseVersions.caseId, published.parentPackageId),
      eq(caseVersions.version, published.parentPackageVersion),
      eq(caseVersions.studioFingerprint, published.parentPackageFingerprint),
      isNotNull(caseVersions.publishedAt),
    )).limit(1);
    if (!publishedParent) {
      return dossierJson({
        error: "The exact current published package lineage is unavailable.",
        code: "package_lineage_missing_or_stale",
      }, 409);
    }
    const [storedParent] = await context.db.select().from(dossierDecisionPackageReferences).where(and(
      eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
      eq(dossierDecisionPackageReferences.packageId, publishedParent.packageId),
      eq(dossierDecisionPackageReferences.packageVersion, publishedParent.packageVersion),
      eq(dossierDecisionPackageReferences.packageFingerprint, publishedParent.packageFingerprint),
    )).limit(1);
    if (
      !storedParent
      || storedParent.graphValidationStatus !== "valid"
      || storedParent.approvalState !== "published"
      || (!existing && storedParent.state !== "current")
    ) {
      return dossierJson({
        error: "The exact current published package lineage is unavailable.",
        code: "package_lineage_missing_or_stale",
      }, 409);
    }
    const parentValidationResult = await validatePublishedDecisionPackage(publishedParent);
    if (
      !parentValidationResult.ok
      || parentValidationResult.value.graphDigest !== storedParent.graphDigest
    ) {
      return dossierJson({
        error: "The governed parent no longer matches its exact published graph.",
        code: "package_lineage_graph_mismatch",
      }, 409);
    }
    governedParent = storedParent;
    parentValidation = parentValidationResult.value;
  }

  const currentReferences = await context.db.select().from(dossierDecisionPackageReferences).where(and(
    eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
    eq(dossierDecisionPackageReferences.state, "current"),
  )).limit(MAX_PACKAGE_REFERENCES + 1);
  if (currentReferences.length > MAX_PACKAGE_REFERENCES) {
    return dossierJson({ error: "The Matter has too many current decision-package references to update safely.", code: "package_limit" }, 409);
  }
  if (!existing) {
    const totalReferences = await context.db.select({ id: dossierDecisionPackageReferences.id })
      .from(dossierDecisionPackageReferences)
      .where(eq(dossierDecisionPackageReferences.dossierId, access.dossier.id))
      .limit(MAX_PACKAGE_REFERENCES);
    if (totalReferences.length >= MAX_PACKAGE_REFERENCES) {
      return dossierJson({ error: "The Matter decision-package reference limit has been reached.", code: "package_limit" }, 409);
    }
  }
  if (
    graphProposalId !== null
    && !existing
    && governedParent === null
    && currentReferences.length > 0
  ) {
    return dossierJson({
      error: "The graph proposal does not prove the exact current package graph it would replace.",
      code: "graph_proposal_base_required",
    }, 409);
  }

  const packageType = validation.draft.caseType ?? DEFAULT_CASE_TYPE;
  const referenceId = existing?.id ?? newDossierOpaqueId("decision_package");
  const receiptProofs = await resolveSimulationReceiptProofs(
    context,
    requestedSimulationReceiptIds,
    { packageId, packageVersion, packageFingerprint },
  );
  if (!receiptProofs.ok) {
    return dossierJson({
      error: "The claimed deterministic simulation receipt could not be proven.",
      code: "simulation_receipt_unproven",
    }, 409);
  }
  const simulationRunReferences = [...new Set([
    ...(existing?.simulationRunReferences ?? []),
    ...receiptProofs.proofs.map(({ reference }) => reference),
  ])].sort();
  const graphProposal = graphProposalId === null
    ? null
    : await resolveGraphProposal({
        context,
        dossierId: access.dossier.id,
        proposalId: graphProposalId,
        acceptedObjectId: referenceId,
        base: governedParent && parentValidation ? {
          binding: packageGraphBinding(governedParent),
          draft: parentValidation.draft,
        } : null,
        target: {
          binding: {
            package_id: packageId,
            package_version: packageVersion,
            package_fingerprint: packageFingerprint,
            parent_package_id: governedParent?.packageId ?? null,
            parent_package_version: governedParent?.packageVersion ?? null,
            parent_package_fingerprint: governedParent?.packageFingerprint ?? null,
            graph_digest: validation.graphDigest,
          },
          draft: validation.draft,
        },
      });
  if (graphProposal instanceof Response) return graphProposal;

  const unchangedReference = isUnchangedReference(
    existing,
    validation.graphDigest,
    packageType,
    simulationRunReferences,
  );
  if (
    unchangedReference
    && graphProposal?.needsAcceptance !== true
  ) {
    const readiness = await computeStoredDossierReadiness({
      db: context.db,
      dossierId: access.dossier.id,
      dossierRevision: expectedRevision,
      keyDeadlineAt: access.dossier.keyDeadlineAt,
      evaluatedAt: canonicalDossierTimestamp(),
    });
    return dossierJson({
      decision_package: projectPackageReference(existing),
      graph_validation_reference: validation.validationReference,
      simulation_receipt_proofs: receiptProofs.proofs.map(projectSimulationReceiptProof),
      graph_proposal_diff_reference: graphProposal?.reference ?? null,
      unchanged: true,
      dossier: { dossier_id: access.dossier.id, revision: expectedRevision, readiness },
      contract_version: "1.0.0",
    });
  }
  if (existing && !unchangedReference) {
    const mutableReceiptAttachment = existing.state === "current"
      && existing.graphValidationStatus === "valid"
      && existing.graphDigest === validation.graphDigest
      && existing.approvalState === "published"
      && existing.packageTypeRegistry === packageType.registry
      && existing.packageTypeId === packageType.id
      && existing.packageTypeVersion === packageType.version
      && simulationRunReferences.length >= existing.simulationRunReferences.length
      && existing.simulationRunReferences.every((reference) => simulationRunReferences.includes(reference));
    if (!mutableReceiptAttachment) {
      return dossierJson({
        error: "That exact immutable package reference already exists and cannot be rebound to a later Matter revision.",
        code: "immutable_package_reference_conflict",
        decision_package_reference_id: existing.id,
        source_dossier_revision: existing.sourceDossierRevision,
      }, 409);
    }
  }

  const outputStates = await loadBoundedOutputStates(context, access.dossier.id);
  if (!outputStates.ok) {
    return dossierJson({ error: "The Matter has too much output history to stale safely.", code: "output_state_limit" }, 409);
  }
  const staleOutputs = outputStates.current;
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const isNewReference = existing === undefined;
  const receiptReferencesChanged = existing === undefined
    || !sameStringArray(existing.simulationRunReferences, simulationRunReferences);
  const values = {
    id: referenceId,
    dossierId: access.dossier.id,
    packageId,
    packageVersion,
    packageFingerprint,
    parentPackageId: governedParent?.packageId ?? null,
    parentPackageVersion: governedParent?.packageVersion ?? null,
    parentPackageFingerprint: governedParent?.packageFingerprint ?? null,
    sourceSnapshotId: null,
    sourceDossierRevision: nextRevision,
    state: "current" as const,
    graphValidationStatus: "valid" as const,
    graphDigest: validation.graphDigest,
    simulationRunReferences,
    approvalState: "published" as const,
    packageTypeRegistry: packageType.registry,
    packageTypeId: packageType.id,
    packageTypeVersion: packageType.version,
    createdByActorRef: context.actor.actorId,
    updatedByActorRef: context.actor.actorId,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof dossierDecisionPackageReferences.$inferInsert;

  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [
      {
        actorRole: access.role,
        eventType: "decision_package_linked",
        objectRefType: "decision_package_reference",
        objectRefId: referenceId,
        summaryCode: "DECISION_PACKAGE_LINKED",
        detail: {
          package_id: packageId,
          package_version: packageVersion,
          package_fingerprint: packageFingerprint,
          graph_validation: {
            kind: "deterministic_graph_compilation",
            reference: validation.validationReference,
            status: "valid",
            graph_digest: validation.graphDigest,
          },
          simulation_run_references: simulationRunReferences,
          deterministic_receipt_proofs: receiptProofs.proofs.map(projectSimulationReceiptProof),
          graph_proposal_diff_reference: graphProposal?.reference ?? null,
          graph_proposal_diff_digest: graphProposal?.digest ?? null,
          mutation_kind: isNewReference
            ? "published_package_link"
            : graphProposal?.needsAcceptance
              ? "graph_proposal_diff_applied"
              : "simulation_receipts_attached",
          superseded_reference_ids: isNewReference
            ? currentReferences.map(({ id }) => id).filter((id) => id !== referenceId)
            : [],
          revision_before: expectedRevision,
          revision_after: nextRevision,
        },
        occurredAt: now,
      },
      ...(isNewReference ? currentReferences
        .filter(({ id }) => id !== referenceId)
        .map((reference) => ({
          actorRole: access.role,
          eventType: "decision_package_linked" as const,
          objectRefType: "decision_package_reference" as const,
          objectRefId: reference.id,
          summaryCode: "DECISION_PACKAGE_SUPERSEDED",
          detail: {
            superseded_by_reference_id: referenceId,
            package_id: reference.packageId,
            package_version: reference.packageVersion,
            package_fingerprint: reference.packageFingerprint,
            revision_before: expectedRevision,
            revision_after: nextRevision,
          },
          occurredAt: now,
        })) : []),
      ...(graphProposal?.needsAcceptance ? [{
        actorRole: access.role,
        eventType: "proposal_reviewed" as const,
        objectRefType: "ai_proposal" as const,
        objectRefId: graphProposal.proposalId,
        summaryCode: "GRAPH_PROPOSAL_DIFF_ACCEPTED",
        detail: {
          decision_package_reference_id: referenceId,
          proposal_diff_digest: graphProposal.digest,
          review_state: "accepted",
          revision_before: expectedRevision,
          revision_after: nextRevision,
        },
        occurredAt: now,
      }] : []),
      ...staleOutputs.map((output) => ({
        actorRole: access.role,
        eventType: "output_marked_stale" as const,
        objectRefType: "governed_output" as const,
        objectRefId: output.outputId,
        summaryCode: "OUTPUT_MARKED_STALE",
        detail: {
          reason_code: "DECISION_PACKAGE_CHANGED",
          decision_package_reference_id: referenceId,
          dossier_revision: nextRevision,
        },
        occurredAt: now,
      })),
    ],
  );

  try {
    await context.db.batch([
      context.db.update(dossiers).set({
        revision: nextRevision,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
      }).where(and(
        eq(dossiers.id, access.dossier.id),
        eq(dossiers.revision, expectedRevision),
        graphProposal?.needsAcceptance ? sql`exists (
          select 1 from ${dossierAIProposals}
          where ${dossierAIProposals.dossierId} = ${access.dossier.id}
            and ${dossierAIProposals.id} = ${graphProposal.proposalId}
            and ${dossierAIProposals.reviewState} = 'pending'
        )` : undefined,
      )),
      ...(isNewReference ? [context.db.update(dossierDecisionPackageReferences).set({
        state: "stale",
        updatedByActorRef: context.actor.actorId,
        updatedAt: now,
      }).where(and(
        eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
        eq(dossierDecisionPackageReferences.state, "current"),
      ))] : []),
      ...(isNewReference
        ? [context.db.insert(dossierDecisionPackageReferences).values(values)]
        : receiptReferencesChanged ? [context.db.update(dossierDecisionPackageReferences).set({
            simulationRunReferences,
            updatedByActorRef: context.actor.actorId,
            updatedAt: now,
          }).where(and(
            eq(dossierDecisionPackageReferences.dossierId, access.dossier.id),
            eq(dossierDecisionPackageReferences.id, referenceId),
            eq(dossierDecisionPackageReferences.state, "current"),
            eq(dossierDecisionPackageReferences.graphDigest, validation.graphDigest),
          ))] : []),
      ...(graphProposal?.needsAcceptance ? [context.db.update(dossierAIProposals).set({
        reviewState: "accepted",
        reviewingUserId: context.actor.userId,
        reviewingActorRef: context.actor.actorId,
        reviewedAt: now,
        reviewNote: "Applied as an exact reviewed published-package graph diff.",
        acceptedObjectType: "decision_package_reference",
        acceptedObjectId: referenceId,
      }).where(and(
        eq(dossierAIProposals.dossierId, access.dossier.id),
        eq(dossierAIProposals.id, graphProposal.proposalId),
        eq(dossierAIProposals.reviewState, "pending"),
      ))] : []),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "DECISION_PACKAGE_CHANGED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return revisionConflict(access.dossier.revision);
  }

  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: nextRevision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: now,
  });
  const storedResult = existing === undefined
    ? values as StoredPackageReference
    : receiptReferencesChanged
      ? {
          ...existing,
          simulationRunReferences,
          updatedByActorRef: context.actor.actorId,
          updatedAt: now,
        }
      : existing;
  return dossierJson({
    decision_package: projectPackageReference(storedResult),
    graph_validation_reference: validation.validationReference,
    simulation_receipt_proofs: receiptProofs.proofs.map(projectSimulationReceiptProof),
    graph_proposal_diff_reference: graphProposal?.reference ?? null,
    dossier: { dossier_id: access.dossier.id, revision: nextRevision, readiness },
    stale_consequences: {
      decision_package_reference_ids: isNewReference
        ? currentReferences.map(({ id }) => id).filter((id) => id !== referenceId)
        : [],
      output_ids: staleOutputs.map(({ outputId }) => outputId),
    },
    contract_version: "1.0.0",
  }, isNewReference ? 201 : 200);
}

type SimulationReceiptProof = {
  reference: string;
  runtimeStateDigest: string;
  parameterBindingDigest: string;
  receiptDigest: string;
};

async function resolveSimulationReceiptProofs(
  context: DossierServerContext,
  references: string[],
  expected: { packageId: string; packageVersion: string; packageFingerprint: string },
): Promise<
  | { ok: true; proofs: SimulationReceiptProof[] }
  | { ok: false; proofs: [] }
> {
  if (references.length === 0) return { ok: true, proofs: [] };
  const sessions = await context.db.select({
    id: playSessions.id,
    sessionKey: playSessions.sessionKey,
    userEmail: playSessions.userEmail,
    caseId: playSessions.caseId,
    caseVersion: playSessions.caseVersion,
    caseFingerprint: playSessions.caseFingerprint,
    state: playSessions.state,
    status: playSessions.status,
    revision: playSessions.revision,
    startedAt: playSessions.startedAt,
    completedAt: playSessions.completedAt,
  }).from(playSessions).where(and(
    eq(playSessions.userEmail, context.actor.email),
    inArray(playSessions.sessionKey, references),
  )).limit(references.length + 1);
  if (sessions.length !== references.length) return { ok: false, proofs: [] };
  const sessionIds = sessions.map(({ id }) => id);
  const eventSummaries = await context.db.select({
    playSessionId: playEvents.playSessionId,
    eventCount: sql<number>`count(*)`,
    minimumEventSequence: sql<number | null>`min(${playEvents.sequence})`,
    maximumEventSequence: sql<number | null>`max(${playEvents.sequence})`,
    startEventCount: sql<number>`sum(case when ${playEvents.sequence} = 0 and ${playEvents.eventType} = 'session_started' then 1 else 0 end)`,
  }).from(playEvents).where(inArray(playEvents.playSessionId, sessionIds))
    .groupBy(playEvents.playSessionId)
    .limit(references.length + 1);
  const summaryBySession = new Map(eventSummaries.map((summary) => [summary.playSessionId, summary]));
  const sessionByReference = new Map(sessions.map((session) => [session.sessionKey, session]));
  const proofs: SimulationReceiptProof[] = [];
  for (const reference of references) {
    const session = sessionByReference.get(reference);
    const summary = session ? summaryBySession.get(session.id) : undefined;
    if (!session || !summary) return { ok: false, proofs: [] };
    const proof = await proveV61SimulationReceipt({
      sessionKey: session.sessionKey,
      userEmail: session.userEmail,
      caseId: session.caseId,
      caseVersion: session.caseVersion,
      caseFingerprint: session.caseFingerprint,
      state: session.state,
      status: session.status,
      revision: session.revision,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      eventCount: Number(summary.eventCount),
      minimumEventSequence: summary.minimumEventSequence === null
        ? null
        : Number(summary.minimumEventSequence),
      maximumEventSequence: summary.maximumEventSequence === null
        ? null
        : Number(summary.maximumEventSequence),
      startEventCount: Number(summary.startEventCount),
    }, {
      userEmail: context.actor.email,
      ...expected,
    });
    if (!proof.ok) return { ok: false, proofs: [] };
    proofs.push(proof);
  }
  return { ok: true, proofs };
}

async function resolveGraphProposal(input: {
  context: DossierServerContext;
  dossierId: string;
  proposalId: string;
  acceptedObjectId: string;
  base: { binding: DecisionPackageGraphBinding; draft: ValidatedPublishedDecisionPackage["draft"] } | null;
  target: { binding: DecisionPackageGraphTarget; draft: ValidatedPublishedDecisionPackage["draft"] };
}) {
  const [proposal] = await input.context.db.select().from(dossierAIProposals).where(and(
    eq(dossierAIProposals.dossierId, input.dossierId),
    eq(dossierAIProposals.id, input.proposalId),
  )).limit(1);
  if (!proposal) {
    return dossierJson({ error: "The graph proposal is unavailable." }, 404);
  }
  if (
    proposal.proposalType !== "graph_change"
    || (proposal.reviewState !== "pending" && proposal.reviewState !== "accepted")
  ) {
    return dossierJson({
      error: "The graph proposal is not eligible for exact application.",
      code: "graph_proposal_state_conflict",
    }, 409);
  }
  const sources = await input.context.db.select({
    anchorId: dossierAIProposalAnchors.sourceAnchorId,
    reviewState: dossierSourceAnchors.reviewState,
  }).from(dossierAIProposalAnchors).innerJoin(dossierSourceAnchors, and(
    eq(dossierSourceAnchors.dossierId, dossierAIProposalAnchors.dossierId),
    eq(dossierSourceAnchors.id, dossierAIProposalAnchors.sourceAnchorId),
  )).where(and(
    eq(dossierAIProposalAnchors.dossierId, input.dossierId),
    eq(dossierAIProposalAnchors.proposalId, input.proposalId),
  )).limit(51);
  if (
    sources.length === 0
    || sources.length > 50
    || sources.some(({ reviewState }) => reviewState !== "accepted")
  ) {
    return dossierJson({
      error: "The graph proposal lacks accepted exact source anchors.",
      code: "graph_proposal_source_review_required",
    }, 409);
  }
  const expectedDiff = buildDecisionPackageGraphProposalDiff({
    base: input.base,
    target: input.target,
  });
  const verification = await verifyDecisionPackageGraphProposalDiff(
    proposal.proposedValue,
    expectedDiff,
  );
  if (!verification.ok) {
    return dossierJson({
      error: "The proposal diff does not match the exact current and target published graphs.",
      code: "graph_proposal_diff_mismatch",
    }, 409);
  }
  if (proposal.reviewState === "accepted") {
    if (
      proposal.acceptedObjectType !== "decision_package_reference"
      || proposal.acceptedObjectId !== input.acceptedObjectId
    ) {
      return dossierJson({
        error: "The reviewed graph proposal is bound to another authoritative object.",
        code: "graph_proposal_binding_conflict",
      }, 409);
    }
    return {
      proposalId: proposal.id,
      digest: verification.digest,
      needsAcceptance: false as const,
      reference: {
        proposal_id: proposal.id,
        diff_digest: verification.digest,
        review_state: "accepted",
      },
    };
  }
  if (proposal.acceptedObjectType !== null || proposal.acceptedObjectId !== null) {
    return dossierJson({
      error: "The pending graph proposal has an invalid authority binding.",
      code: "graph_proposal_binding_conflict",
    }, 409);
  }
  return {
    proposalId: proposal.id,
    digest: verification.digest,
    needsAcceptance: true as const,
    reference: {
      proposal_id: proposal.id,
      diff_digest: verification.digest,
      review_state: "accepted_on_commit",
    },
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
  if (states.length > MAX_OUTPUT_STATE_ROWS) return { ok: false as const, current: [] };
  const latest = new Map<string, { outputId: string; sequence: number; state: string }>();
  for (const state of states) latest.set(state.outputId, state);
  return { ok: true as const, current: [...latest.values()].filter(({ state }) => state === "current") };
}

function projectPackageReference(reference: StoredPackageReference) {
  return {
    object_type: "decision_package_reference",
    schema_version: 1,
    decision_package_reference_id: reference.id,
    dossier_id: reference.dossierId,
    package_id: reference.packageId,
    package_version: reference.packageVersion,
    package_fingerprint: reference.packageFingerprint,
    parent_package_id: reference.parentPackageId,
    parent_package_version: reference.parentPackageVersion,
    parent_package_fingerprint: reference.parentPackageFingerprint,
    source_snapshot_id: reference.sourceSnapshotId,
    source_dossier_revision: reference.sourceDossierRevision,
    state: reference.state,
    graph_validation_status: reference.graphValidationStatus,
    graph_digest: reference.graphDigest,
    simulation_run_references: [...reference.simulationRunReferences],
    approval_state: reference.approvalState,
    package_type: {
      registry: reference.packageTypeRegistry,
      id: reference.packageTypeId,
      version: reference.packageTypeVersion,
    },
    created_at: reference.createdAt,
    created_by: reference.createdByActorRef,
    updated_at: reference.updatedAt,
    updated_by: reference.updatedByActorRef,
  };
}

function packageGraphBinding(reference: StoredPackageReference): DecisionPackageGraphBinding {
  return {
    decision_package_reference_id: reference.id,
    package_id: reference.packageId,
    package_version: reference.packageVersion,
    package_fingerprint: reference.packageFingerprint,
    graph_digest: reference.graphDigest,
  };
}

function projectSimulationReceiptProof(proof: SimulationReceiptProof) {
  return {
    reference: proof.reference,
    runtime_state_digest: proof.runtimeStateDigest,
    parameter_binding_digest: proof.parameterBindingDigest,
    receipt_digest: proof.receiptDigest,
  };
}

function isUnchangedReference(
  reference: StoredPackageReference | undefined,
  graphDigest: string,
  packageType: typeof DEFAULT_CASE_TYPE,
  simulationRunReferences: string[],
) {
  return reference !== undefined
    && reference.state === "current"
    && reference.graphValidationStatus === "valid"
    && reference.graphDigest === graphDigest
    && sameStringArray(reference.simulationRunReferences, simulationRunReferences)
    && reference.approvalState === "published"
    && reference.packageTypeRegistry === packageType.registry
    && reference.packageTypeId === packageType.id
    && reference.packageTypeVersion === packageType.version;
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function pageLimit(value: string | null) {
  if (value === null) return MAX_PAGE_SIZE;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function field(payload: Record<string, unknown>, camel: string, snake: string) {
  return payload[camel] ?? payload[snake];
}

function publishedPackageId(value: unknown) {
  const id = boundedDossierText(value, "package ID", 1, 140);
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(id)) throw new Error("Package ID is invalid.");
  return id;
}

function semanticVersion(value: unknown) {
  const version = boundedDossierText(value, "package version", 5, 40);
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error("Package version is invalid.");
  return version;
}

function sha256Fingerprint(value: unknown) {
  const fingerprint = boundedDossierText(value, "package fingerprint", 71, 71);
  if (!sha256Pattern(fingerprint)) throw new Error("Package fingerprint is invalid.");
  return fingerprint;
}

function sha256Pattern(value: unknown): value is string {
  return typeof value === "string" && /^sha256-[a-f0-9]{64}$/u.test(value);
}

function revisionConflict(currentRevision: number) {
  return dossierJson({
    error: "The Matter changed before this decision package could be linked.",
    code: "revision_conflict",
    currentRevision,
  }, 409);
}
