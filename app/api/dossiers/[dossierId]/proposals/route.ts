import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import {
  dossierAIProposalAnchors,
  dossierAIProposals,
  dossierAIProposalVersions,
  dossierAssertionSources,
  dossierAuditEvents,
  dossierEvidenceLinks,
  dossierOutputStateEvents,
  dossierProfessionalAssertions,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
} from "../../../../../db/schema";
import {
  DOSSIER_WIRE_ENUMS,
  canonicalDossierJson,
  type DossierAIProposalV1,
  type JsonValue,
} from "../../../../dossier-contract";
import {
  DossierProposalReviewError,
  reviewDossierProposal,
} from "../../../../dossier-proposal-review";
import { exactCurrentGraphEntityExists, graphEntityId } from "../../../../dossier-evidence-server";
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
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierAccess,
  type DossierServerContext,
} from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };
type StoredProposal = typeof dossierAIProposals.$inferSelect;
type AcceptedEvidenceLink = {
  sourceAnchorId: string;
  decisionPackageReferenceId: string;
  targetType: "graph_node" | "graph_edge";
  targetId: string;
  relation: (typeof DOSSIER_WIRE_ENUMS.evidence_relation)[number];
  professionalMeaning: string;
};

const MAX_PAGE_SIZE = 50;
const MAX_PROPOSAL_SOURCES = 50;
const MAX_PROPOSED_VALUE_CHARACTERS = 65_536;
const MAX_REQUEST_BYTES = 98_304;
const PROPOSAL_ACTIONS = ["create", "update", "accept", "edit_and_accept", "reject"] as const;
const ASSERTION_PROPOSAL_TYPES = {
  fact: "fact",
  authority_rule: "rule",
  contradiction: "contradiction",
  assumption: "assumption",
  dated_event: "date",
} as const;

const BASE_FIELDS = ["action", "expectedRevision", "expected_revision"] as const;
const PROPOSAL_ID_FIELDS = ["proposalId", "proposal_id"] as const;
const SOURCE_FIELDS = [
  "sourceDocumentVersionIds",
  "source_document_version_ids",
  "sourceAnchorIds",
  "source_anchor_ids",
] as const;
const CREATE_FIELDS = new Set([
  ...BASE_FIELDS,
  "proposalType",
  "proposal_type",
  "proposedValue",
  "proposed_value",
  ...SOURCE_FIELDS,
]);
const UPDATE_FIELDS = new Set([...BASE_FIELDS, ...PROPOSAL_ID_FIELDS, ...SOURCE_FIELDS]);
const REVIEW_FIELDS = new Set([
  ...BASE_FIELDS,
  ...PROPOSAL_ID_FIELDS,
  "reviewNote",
  "review_note",
  "editedValue",
  "edited_value",
]);
const ALLOWED_FIELDS = new Set([...CREATE_FIELDS, ...UPDATE_FIELDS, ...REVIEW_FIELDS]);
const ALIASED_FIELDS = [
  ["expectedRevision", "expected_revision"],
  ["proposalId", "proposal_id"],
  ["proposalType", "proposal_type"],
  ["proposedValue", "proposed_value"],
  ["sourceDocumentVersionIds", "source_document_version_ids"],
  ["sourceAnchorIds", "source_anchor_ids"],
  ["reviewNote", "review_note"],
  ["editedValue", "edited_value"],
] as const;

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  const limit = pageLimit(url.searchParams.get("limit"));
  if (limit === null) return dossierJson({ error: "The proposal page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursor: { id: string; createdAt: string } | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "proposal cursor");
    } catch {
      return dossierJson({ error: "The proposal cursor is invalid." }, 400);
    }
    const [storedCursor] = await context.db.select({
      id: dossierAIProposals.id,
      createdAt: dossierAIProposals.createdAt,
    }).from(dossierAIProposals).where(and(
      eq(dossierAIProposals.dossierId, access.dossier.id),
      eq(dossierAIProposals.id, cursorId),
    )).limit(1);
    if (!storedCursor) return dossierJson({ error: "The proposal cursor is invalid." }, 400);
    cursor = storedCursor;
  }

  const rows = await context.db.select().from(dossierAIProposals).where(and(
    eq(dossierAIProposals.dossierId, access.dossier.id),
    cursor ? or(
      lt(dossierAIProposals.createdAt, cursor.createdAt),
      and(
        eq(dossierAIProposals.createdAt, cursor.createdAt),
        lt(dossierAIProposals.id, cursor.id),
      ),
    ) : undefined,
  )).orderBy(desc(dossierAIProposals.createdAt), desc(dossierAIProposals.id)).limit(limit + 1);

  const hasMore = rows.length > limit;
  const visibleRows = rows.slice(0, limit);
  const associations = await loadProposalAssociations(
    context,
    access.dossier.id,
    visibleRows.map((proposal) => proposal.id),
  );
  return dossierJson({
    proposals: visibleRows.map((proposal) => projectProposal(
      proposal,
      associations.versionIdsByProposal.get(proposal.id) ?? [],
      associations.anchorIdsByProposal.get(proposal.id) ?? [],
    )),
    page: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore ? visibleRows.at(-1)?.id ?? null : null,
    },
    contract_version: "1.0.0",
  });
}

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site proposal mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "proposals");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!payload) return dossierJson({ error: "A valid proposal action is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_FIELDS.has(key))) {
    return dossierJson({ error: "The proposal action contains a protected or unknown field." }, 400);
  }
  if (ALIASED_FIELDS.some(([camel, snake]) => camel in payload && snake in payload)) {
    return dossierJson({ error: "The proposal action contains an ambiguous field." }, 400);
  }

  let action: (typeof PROPOSAL_ACTIONS)[number];
  let expectedRevision: number;
  try {
    action = dossierEnum(payload.action, PROPOSAL_ACTIONS, "proposal action");
    expectedRevision = expectedDossierRevision(field(payload, "expectedRevision", "expected_revision"));
  } catch (error) {
    return dossierJson({ error: errorMessage(error, "The proposal action is invalid.") }, 400);
  }
  const actionFields = action === "create" ? CREATE_FIELDS : action === "update" ? UPDATE_FIELDS : REVIEW_FIELDS;
  if (Object.keys(payload).some((key) => !actionFields.has(key))) {
    return dossierJson({ error: "The proposal action contains a field that is not valid for this action." }, 400);
  }
  if (expectedRevision !== access.dossier.revision) return revisionConflict(access.dossier.revision);

  if (action === "create") return createProposal(context, access, payload, expectedRevision);
  if (action === "update") return updatePendingProposalSources(context, access, payload, expectedRevision);
  return reviewProposal(context, access, payload, expectedRevision, action);
}

async function createProposal(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let proposalType: (typeof DOSSIER_WIRE_ENUMS.proposal_type)[number];
  let proposedValue: JsonValue;
  let sourceVersionIds: string[];
  let sourceAnchorIds: string[];
  try {
    proposalType = dossierEnum(
      field(payload, "proposalType", "proposal_type"),
      DOSSIER_WIRE_ENUMS.proposal_type,
      "proposal type",
    );
    proposedValue = proposalJsonValue(field(payload, "proposedValue", "proposed_value"), "proposed value");
    sourceVersionIds = opaqueIdList(
      field(payload, "sourceDocumentVersionIds", "source_document_version_ids"),
      "source document-version IDs",
    );
    sourceAnchorIds = opaqueIdList(
      field(payload, "sourceAnchorIds", "source_anchor_ids"),
      "source anchor IDs",
    );
  } catch (error) {
    return dossierJson({ error: errorMessage(error, "The proposal draft is invalid.") }, 400);
  }

  const sources = await resolveProposalSources(context, access.dossier.id, sourceVersionIds, sourceAnchorIds);
  if (isResponse(sources)) return sources;
  if (sources.anchors.some((anchor) => anchor.reviewState === "rejected" || anchor.reviewState === "superseded")) {
    return dossierJson({ error: "The proposal cites a source anchor that is no longer usable." }, 409);
  }

  const proposalId = newDossierOpaqueId("proposal");
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const staleOutputs = await currentOutputStates(context, access.dossier.id);
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, nextRevision, [
    {
      actorRole: access.role,
      eventType: "proposal_reviewed",
      objectRefType: "ai_proposal",
      objectRefId: proposalId,
      summaryCode: "AI_PROPOSAL_CREATED",
      detail: {
        lifecycle_event: "created_pending",
        proposal_type: proposalType,
        source_version_count: sourceVersionIds.length,
        source_anchor_count: sourceAnchorIds.length,
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
      detail: { reason_code: "AI_PROPOSAL_CHANGED", proposal_id: proposalId, dossier_revision: nextRevision },
      occurredAt: now,
    })),
  ]);

  try {
    await context.db.batch([
      revisionUpdate(context, access, expectedRevision, nextRevision, now),
      context.db.insert(dossierAIProposals).values({
        id: proposalId,
        dossierId: access.dossier.id,
        proposalType,
        proposedValue,
        confidenceCategory: null,
        confidenceScore: null,
        modelProvider: null,
        modelName: null,
        modelConfigurationDigest: null,
        reviewState: "pending",
        reviewingUserId: null,
        reviewingActorRef: null,
        reviewedAt: null,
        reviewNote: null,
        acceptedObjectType: null,
        acceptedObjectId: null,
        createdByActorRef: context.actor.actorId,
        createdAt: now,
      }),
      ...sources.versions.map((version) => context.db.insert(dossierAIProposalVersions).values({
        dossierId: access.dossier.id,
        proposalId,
        documentId: version.documentId,
        documentVersionId: version.documentVersionId,
      })),
      ...sources.anchors.map((anchor) => context.db.insert(dossierAIProposalAnchors).values({
        dossierId: access.dossier.id,
        proposalId,
        sourceAnchorId: anchor.anchorId,
      })),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "AI_PROPOSAL_CHANGED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  const proposal: StoredProposal = {
    id: proposalId,
    dossierId: access.dossier.id,
    generationJobId: null,
    proposalType,
    proposedValue,
    confidenceCategory: null,
    confidenceScore: null,
    modelProvider: null,
    modelName: null,
    modelConfigurationDigest: null,
    reviewState: "pending",
    reviewingUserId: null,
    reviewingActorRef: null,
    reviewedAt: null,
    reviewNote: null,
    acceptedObjectType: null,
    acceptedObjectId: null,
    createdByActorRef: context.actor.actorId,
    createdAt: now,
  };
  return mutationResponse(context, access, nextRevision, now, {
    proposal: projectProposal(proposal, sourceVersionIds, sourceAnchorIds),
  }, 201);
}

async function updatePendingProposalSources(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let proposalId: string;
  let sourceVersionIds: string[];
  let sourceAnchorIds: string[];
  try {
    proposalId = parseProposalId(payload);
    sourceVersionIds = opaqueIdList(
      field(payload, "sourceDocumentVersionIds", "source_document_version_ids"),
      "source document-version IDs",
    );
    sourceAnchorIds = opaqueIdList(
      field(payload, "sourceAnchorIds", "source_anchor_ids"),
      "source anchor IDs",
    );
  } catch (error) {
    return dossierJson({ error: errorMessage(error, "The proposal source update is invalid.") }, 400);
  }

  const stored = await findProposal(context, access.dossier.id, proposalId);
  if (!stored) return dossierNotFound();
  if (stored.reviewState !== "pending") {
    return dossierJson({ error: "A reviewed proposal is immutable.", code: "proposal_state_conflict" }, 409);
  }
  const sources = await resolveProposalSources(context, access.dossier.id, sourceVersionIds, sourceAnchorIds);
  if (isResponse(sources)) return sources;
  if (sources.anchors.some((anchor) => anchor.reviewState === "rejected" || anchor.reviewState === "superseded")) {
    return dossierJson({ error: "The proposal cites a source anchor that is no longer usable." }, 409);
  }
  const existing = await loadProposalAssociations(context, access.dossier.id, [proposalId]);
  if (
    sameStringSet(existing.versionIdsByProposal.get(proposalId) ?? [], sourceVersionIds)
    && sameStringSet(existing.anchorIdsByProposal.get(proposalId) ?? [], sourceAnchorIds)
  ) {
    return mutationResponse(context, access, expectedRevision, canonicalDossierTimestamp(), {
      proposal: projectProposal(stored, sourceVersionIds, sourceAnchorIds),
      unchanged: true,
    });
  }

  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const staleOutputs = await currentOutputStates(context, access.dossier.id);
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, nextRevision, [
    {
      actorRole: access.role,
      eventType: "proposal_reviewed",
      objectRefType: "ai_proposal",
      objectRefId: proposalId,
      summaryCode: "AI_PROPOSAL_SOURCES_UPDATED",
      detail: {
        lifecycle_event: "pending_sources_updated",
        source_version_count: sourceVersionIds.length,
        source_anchor_count: sourceAnchorIds.length,
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
      detail: { reason_code: "AI_PROPOSAL_CHANGED", proposal_id: proposalId, dossier_revision: nextRevision },
      occurredAt: now,
    })),
  ]);
  try {
    await context.db.batch([
      revisionUpdate(context, access, expectedRevision, nextRevision, now),
      context.db.delete(dossierAIProposalAnchors).where(and(
        eq(dossierAIProposalAnchors.dossierId, access.dossier.id),
        eq(dossierAIProposalAnchors.proposalId, proposalId),
      )),
      context.db.delete(dossierAIProposalVersions).where(and(
        eq(dossierAIProposalVersions.dossierId, access.dossier.id),
        eq(dossierAIProposalVersions.proposalId, proposalId),
      )),
      ...sources.versions.map((version) => context.db.insert(dossierAIProposalVersions).values({
        dossierId: access.dossier.id,
        proposalId,
        documentId: version.documentId,
        documentVersionId: version.documentVersionId,
      })),
      ...sources.anchors.map((anchor) => context.db.insert(dossierAIProposalAnchors).values({
        dossierId: access.dossier.id,
        proposalId,
        sourceAnchorId: anchor.anchorId,
      })),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: "AI_PROPOSAL_CHANGED",
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }
  return mutationResponse(context, access, nextRevision, now, {
    proposal: projectProposal(stored, sourceVersionIds, sourceAnchorIds),
  });
}

async function reviewProposal(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
  action: "accept" | "edit_and_accept" | "reject",
) {
  let proposalId: string;
  try {
    proposalId = parseProposalId(payload);
  } catch (error) {
    return dossierJson({ error: errorMessage(error, "The proposal ID is invalid.") }, 400);
  }
  const stored = await findProposal(context, access.dossier.id, proposalId);
  if (!stored) return dossierNotFound();
  if (stored.reviewState !== "pending") {
    return dossierJson({ error: "A reviewed proposal is immutable.", code: "proposal_state_conflict" }, 409);
  }

  const sources = await loadReviewSources(context, access.dossier.id, proposalId);
  if (
    sources.versionIds.length === 0
    || sources.anchors.length === 0
    || sources.versionIds.length > MAX_PROPOSAL_SOURCES
    || sources.anchors.length > MAX_PROPOSAL_SOURCES
    || sources.anchors.some((anchor) => anchor.reviewState !== "accepted")
  ) {
    return dossierJson({
      error: "The proposal cannot be reviewed until every exact source anchor is professionally accepted.",
      code: "source_review_required",
    }, 409);
  }

  let proposedValue: JsonValue;
  let editedValue: JsonValue | undefined;
  let reviewNote: string | null;
  try {
    proposedValue = proposalJsonValue(stored.proposedValue, "stored proposed value");
    reviewNote = nullableReviewNote(field(payload, "reviewNote", "review_note"));
    const hasEditedValue = "editedValue" in payload || "edited_value" in payload;
    if (action === "edit_and_accept") {
      if (!hasEditedValue) throw new Error("Edit-and-accept requires an edited value.");
      editedValue = editedProposalValue(field(payload, "editedValue", "edited_value"));
    } else if (hasEditedValue) {
      throw new Error("An edited value is only valid for edit-and-accept.");
    }
  } catch (error) {
    return dossierJson({ error: errorMessage(error, "The proposal review is invalid.") }, 400);
  }

  const proposal = toContractProposal(
    stored,
    sources.versionIds,
    sources.anchors.map((anchor) => anchor.anchorId),
    proposedValue,
  );
  const now = canonicalDossierTimestamp();
  const accepted = action !== "reject";
  const acceptsEvidenceLink = accepted && stored.proposalType === "evidence_link";
  const assertionType = accepted ? assertionTypeFor(stored.proposalType) : null;
  if (accepted && assertionType === null && !acceptsEvidenceLink) {
    return dossierJson({
      error: "This proposal type has no safe authoritative mapping in the current pilot boundary.",
      code: "authoritative_mapping_unsupported",
    }, 409);
  }
  const acceptedObjectId = accepted
    ? newDossierOpaqueId(acceptsEvidenceLink ? "evidence_link" : "assertion")
    : null;
  let decision: DossierAIProposalV1;
  try {
    decision = reviewDossierProposal(proposal, {
      action: accepted ? "accept" : "reject",
      actorRole: access.role,
      actorId: context.actor.actorId,
      reviewedAt: now,
      note: reviewNote,
      ...(editedValue === undefined ? {} : { editedValue }),
      ...(accepted ? {
        acceptedObjectType: acceptsEvidenceLink ? "evidence_link" as const : "professional_assertion" as const,
        acceptedObjectId,
      } : {}),
      anchorBindings: sources.anchors.map((anchor) => ({
        anchorId: anchor.anchorId,
        documentVersionId: anchor.documentVersionId,
      })),
    });
  } catch (error) {
    if (error instanceof DossierProposalReviewError) {
      return dossierJson(
        { error: error.message, code: error.code.toLowerCase() },
        error.code === "ROLE_FORBIDDEN" ? 403 : 409,
      );
    }
    return dossierJson({ error: "The proposal review is invalid." }, 400);
  }

  let authoritativeStatement: string | null = null;
  let evidenceLink: AcceptedEvidenceLink | null = null;
  if (acceptsEvidenceLink) {
    try {
      evidenceLink = parseAcceptedEvidenceLink(decision.proposed_value, sources.anchors.map(({ anchorId }) => anchorId));
    } catch (error) {
      return dossierJson({ error: errorMessage(error, "The evidence-link proposal is invalid.") }, 409);
    }
    if (!await exactCurrentGraphEntityExists(
      context,
      access.dossier.id,
      evidenceLink.decisionPackageReferenceId,
      evidenceLink.targetType,
      evidenceLink.targetId,
    )) {
      return dossierJson({
        error: "The proposed evidence target is unavailable.",
        code: "authoritative_mapping_unsupported",
      }, 409);
    }
    const [duplicate] = await context.db.select({ id: dossierEvidenceLinks.id }).from(dossierEvidenceLinks).where(and(
      eq(dossierEvidenceLinks.dossierId, access.dossier.id),
      eq(dossierEvidenceLinks.sourceAnchorId, evidenceLink.sourceAnchorId),
      eq(dossierEvidenceLinks.decisionPackageReferenceId, evidenceLink.decisionPackageReferenceId),
      eq(dossierEvidenceLinks.targetType, evidenceLink.targetType),
      eq(dossierEvidenceLinks.targetId, evidenceLink.targetId),
      eq(dossierEvidenceLinks.relation, evidenceLink.relation),
    )).limit(1);
    if (duplicate) {
      return dossierJson({ error: "That exact reviewed evidence link already exists.", code: "evidence_link_exists" }, 409);
    }
  } else if (accepted) {
    try {
      authoritativeStatement = assertionStatement(decision.proposed_value);
    } catch (error) {
      return dossierJson({ error: errorMessage(error, "The accepted proposal value is unsupported.") }, 409);
    }
  }
  const staleOutputs = await currentOutputStates(context, access.dossier.id);
  const outputStaleReason = accepted ? "AUTHORITATIVE_PROPOSAL_ACCEPTED" : "AI_PROPOSAL_CHANGED";
  const nextRevision = expectedRevision + 1;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(context, access.dossier.id, nextRevision, [
    {
      actorRole: access.role,
      eventType: "proposal_reviewed",
      objectRefType: "ai_proposal",
      objectRefId: proposalId,
      summaryCode: accepted ? "AI_PROPOSAL_ACCEPTED" : "AI_PROPOSAL_REJECTED",
      detail: {
        action,
        review_state: decision.review_state,
        edited_before_acceptance: action === "edit_and_accept",
        accepted_object_type: decision.accepted_object_type,
        accepted_object_id: decision.accepted_object_id,
        source_version_count: sources.versionIds.length,
        source_anchor_count: sources.anchors.length,
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
      detail: {
        reason_code: outputStaleReason,
        proposal_id: proposalId,
        dossier_revision: nextRevision,
      },
      occurredAt: now,
    })),
  ]);

  try {
    await context.db.batch([
      revisionUpdate(context, access, expectedRevision, nextRevision, now),
      ...(evidenceLink ? [
        context.db.insert(dossierEvidenceLinks).values({
          id: acceptedObjectId!,
          dossierId: access.dossier.id,
          sourceAnchorId: evidenceLink.sourceAnchorId,
          assertionId: null,
          decisionPackageReferenceId: evidenceLink.decisionPackageReferenceId,
          targetType: evidenceLink.targetType,
          targetId: evidenceLink.targetId,
          relation: evidenceLink.relation,
          professionalMeaning: evidenceLink.professionalMeaning,
          originatingProposalId: proposalId,
          createdByActorRef: context.actor.actorId,
          reviewedByUserId: context.actor.userId,
          reviewedByActorRef: context.actor.actorId,
          reviewedAt: now,
          createdAt: now,
        }),
      ] : accepted ? [
        context.db.insert(dossierProfessionalAssertions).values({
          id: acceptedObjectId!,
          dossierId: access.dossier.id,
          assertionType: assertionType!,
          statement: authoritativeStatement!,
          status: "needs_review",
          originatingProposalId: proposalId,
          reviewedByUserId: null,
          reviewedByActorRef: null,
          reviewedAt: null,
          createdByActorRef: context.actor.actorId,
          updatedByActorRef: context.actor.actorId,
          createdAt: now,
          updatedAt: now,
        }),
        ...sources.anchors.map((anchor) => context.db.insert(dossierAssertionSources).values({
          dossierId: access.dossier.id,
          assertionId: acceptedObjectId!,
          sourceAnchorId: anchor.anchorId,
          createdAt: now,
        })),
        context.db.update(dossierProfessionalAssertions).set({
          status: "accepted",
          reviewedByUserId: context.actor.userId,
          reviewedByActorRef: context.actor.actorId,
          reviewedAt: now,
          updatedByActorRef: context.actor.actorId,
          updatedAt: now,
        }).where(and(
          eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
          eq(dossierProfessionalAssertions.id, acceptedObjectId!),
          eq(dossierProfessionalAssertions.status, "needs_review"),
        )),
      ] : []),
      context.db.update(dossierAIProposals).set({
        reviewState: decision.review_state,
        reviewingUserId: context.actor.userId,
        reviewingActorRef: context.actor.actorId,
        reviewedAt: now,
        reviewNote: decision.review_note,
        acceptedObjectType: decision.accepted_object_type,
        acceptedObjectId: decision.accepted_object_id,
      }).where(and(
        eq(dossierAIProposals.dossierId, access.dossier.id),
        eq(dossierAIProposals.id, proposalId),
        eq(dossierAIProposals.reviewState, "pending"),
      )),
      ...staleOutputs.map((output) => context.db.insert(dossierOutputStateEvents).values({
        id: newDossierOpaqueId("output_state"),
        dossierId: access.dossier.id,
        outputId: output.outputId,
        sequence: output.sequence + 1,
        state: "stale",
        reason: outputStaleReason,
        occurredAt: now,
        actorRef: context.actor.actorId,
      })),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  const responseProposal = {
    ...decision,
    // The candidate remains immutable. The edited value exists only in the
    // separately materialized, reviewed professional assertion.
    proposed_value: proposedValue,
  };
  return mutationResponse(context, access, nextRevision, now, {
    proposal: responseProposal,
    authoritative_object: evidenceLink ? {
      object_type: "evidence_link",
      schema_version: 1,
      evidence_link_id: acceptedObjectId,
      dossier_id: access.dossier.id,
      source_anchor_id: evidenceLink.sourceAnchorId,
      assertion_id: null,
      decision_package_reference_id: evidenceLink.decisionPackageReferenceId,
      target_type: evidenceLink.targetType,
      target_id: evidenceLink.targetId,
      relation: evidenceLink.relation,
      professional_meaning: evidenceLink.professionalMeaning,
      reviewed_by: context.actor.actorId,
      reviewed_at: now,
      created_at: now,
      created_by: context.actor.actorId,
    } : accepted ? {
      object_type: "professional_assertion",
      schema_version: 1,
      assertion_id: acceptedObjectId,
      dossier_id: access.dossier.id,
      assertion_type: assertionType,
      statement: authoritativeStatement,
      status: "accepted",
      source_anchor_ids: sources.anchors.map((anchor) => anchor.anchorId),
      originating_proposal_id: proposalId,
      reviewed_by: context.actor.actorId,
      reviewed_at: now,
      created_at: now,
      created_by: context.actor.actorId,
      updated_at: now,
      updated_by: context.actor.actorId,
    } : null,
  });
}

async function resolveProposalSources(
  context: DossierServerContext,
  dossierId: string,
  versionIds: string[],
  anchorIds: string[],
) {
  const anchors = await context.db.select({
    anchorId: dossierSourceAnchors.id,
    documentId: dossierSourceAnchors.documentId,
    documentVersionId: dossierSourceAnchors.documentVersionId,
    reviewState: dossierSourceAnchors.reviewState,
  }).from(dossierSourceAnchors).where(and(
    eq(dossierSourceAnchors.dossierId, dossierId),
    inArray(dossierSourceAnchors.id, anchorIds),
  )).orderBy(asc(dossierSourceAnchors.id));
  if (anchors.length !== anchorIds.length) return dossierNotFound();
  const byVersion = new Map(anchors.map((anchor) => [anchor.documentVersionId, anchor]));
  if (
    anchors.some((anchor) => !versionIds.includes(anchor.documentVersionId))
    || versionIds.some((versionId) => !byVersion.has(versionId))
  ) {
    return dossierJson({ error: "Every proposal source version requires an exact source anchor." }, 400);
  }
  return {
    anchors,
    versions: versionIds.map((documentVersionId) => {
      const anchor = byVersion.get(documentVersionId)!;
      return { documentId: anchor.documentId, documentVersionId };
    }),
  };
}

async function loadProposalAssociations(
  context: DossierServerContext,
  dossierId: string,
  proposalIds: string[],
) {
  const [versions, anchors] = proposalIds.length === 0 ? [[], []] : await Promise.all([
    context.db.select({
      proposalId: dossierAIProposalVersions.proposalId,
      documentVersionId: dossierAIProposalVersions.documentVersionId,
    }).from(dossierAIProposalVersions).where(and(
      eq(dossierAIProposalVersions.dossierId, dossierId),
      inArray(dossierAIProposalVersions.proposalId, proposalIds),
    )).orderBy(asc(dossierAIProposalVersions.proposalId), asc(dossierAIProposalVersions.documentVersionId))
      .limit(MAX_PAGE_SIZE * MAX_PROPOSAL_SOURCES),
    context.db.select({
      proposalId: dossierAIProposalAnchors.proposalId,
      sourceAnchorId: dossierAIProposalAnchors.sourceAnchorId,
    }).from(dossierAIProposalAnchors).where(and(
      eq(dossierAIProposalAnchors.dossierId, dossierId),
      inArray(dossierAIProposalAnchors.proposalId, proposalIds),
    )).orderBy(asc(dossierAIProposalAnchors.proposalId), asc(dossierAIProposalAnchors.sourceAnchorId))
      .limit(MAX_PAGE_SIZE * MAX_PROPOSAL_SOURCES),
  ]);
  const versionIdsByProposal = new Map<string, string[]>();
  const anchorIdsByProposal = new Map<string, string[]>();
  for (const version of versions) pushMapValue(versionIdsByProposal, version.proposalId, version.documentVersionId);
  for (const anchor of anchors) pushMapValue(anchorIdsByProposal, anchor.proposalId, anchor.sourceAnchorId);
  return { versionIdsByProposal, anchorIdsByProposal };
}

async function loadReviewSources(context: DossierServerContext, dossierId: string, proposalId: string) {
  const [versions, anchors] = await Promise.all([
    context.db.select({ documentVersionId: dossierAIProposalVersions.documentVersionId })
      .from(dossierAIProposalVersions).where(and(
        eq(dossierAIProposalVersions.dossierId, dossierId),
        eq(dossierAIProposalVersions.proposalId, proposalId),
      )).orderBy(asc(dossierAIProposalVersions.documentVersionId))
        .limit(MAX_PROPOSAL_SOURCES + 1),
    context.db.select({
      anchorId: dossierAIProposalAnchors.sourceAnchorId,
      documentVersionId: dossierSourceAnchors.documentVersionId,
      reviewState: dossierSourceAnchors.reviewState,
    }).from(dossierAIProposalAnchors).innerJoin(dossierSourceAnchors, and(
      eq(dossierSourceAnchors.dossierId, dossierAIProposalAnchors.dossierId),
      eq(dossierSourceAnchors.id, dossierAIProposalAnchors.sourceAnchorId),
    )).where(and(
      eq(dossierAIProposalAnchors.dossierId, dossierId),
      eq(dossierAIProposalAnchors.proposalId, proposalId),
    )).orderBy(asc(dossierAIProposalAnchors.sourceAnchorId))
      .limit(MAX_PROPOSAL_SOURCES + 1),
  ]);
  return { versionIds: versions.map((version) => version.documentVersionId), anchors };
}

async function findProposal(context: DossierServerContext, dossierId: string, proposalId: string) {
  const [proposal] = await context.db.select().from(dossierAIProposals).where(and(
    eq(dossierAIProposals.dossierId, dossierId),
    eq(dossierAIProposals.id, proposalId),
  )).limit(1);
  return proposal ?? null;
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
  return [...latest.values()].filter((state) => state.state === "current");
}

function revisionUpdate(
  context: DossierServerContext,
  access: DossierAccess,
  expectedRevision: number,
  nextRevision: number,
  now: string,
) {
  return context.db.update(dossiers).set({
    revision: nextRevision,
    updatedAt: now,
    updatedByActorRef: context.actor.actorId,
  }).where(and(
    eq(dossiers.id, access.dossier.id),
    eq(dossiers.revision, expectedRevision),
  ));
}

async function mutationResponse(
  context: DossierServerContext,
  access: DossierAccess,
  revision: number,
  evaluatedAt: string,
  body: Record<string, unknown>,
  status = 200,
) {
  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: revision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt,
  });
  return dossierJson({
    ...body,
    dossier: { dossier_id: access.dossier.id, revision, readiness },
    contract_version: "1.0.0",
  }, status);
}

function projectProposal(proposal: StoredProposal, versionIds: string[], anchorIds: string[]) {
  return {
    object_type: "ai_proposal" as const,
    schema_version: 1 as const,
    proposal_id: proposal.id,
    dossier_id: proposal.dossierId,
    source_document_version_ids: [...versionIds],
    source_anchor_ids: [...anchorIds],
    proposal_type: proposal.proposalType,
    proposed_value: boundedStoredProposalValue(proposal.proposedValue),
    confidence: proposal.confidenceCategory === null ? null : {
      category: proposal.confidenceCategory,
      score: proposal.confidenceScore,
    },
    model_provenance: proposal.modelProvider === null
      || proposal.modelName === null
      || proposal.modelConfigurationDigest === null
      ? null
      : {
          provider: proposal.modelProvider,
          model: proposal.modelName,
          configuration_digest: proposal.modelConfigurationDigest,
        },
    review_state: proposal.reviewState,
    reviewing_actor_id: proposal.reviewingActorRef,
    reviewed_at: proposal.reviewedAt,
    review_note: proposal.reviewNote,
    accepted_object_type: proposal.acceptedObjectType,
    accepted_object_id: proposal.acceptedObjectId,
    created_at: proposal.createdAt,
    created_by: proposal.createdByActorRef,
  };
}

function toContractProposal(
  proposal: StoredProposal,
  versionIds: string[],
  anchorIds: string[],
  proposedValue: JsonValue,
): DossierAIProposalV1 {
  const projected = projectProposal(proposal, versionIds, anchorIds);
  const confidence: DossierAIProposalV1["confidence"] = proposal.confidenceCategory === "low"
    || proposal.confidenceCategory === "medium"
    || proposal.confidenceCategory === "high"
    ? {
        category: proposal.confidenceCategory as "low" | "medium" | "high",
        score: proposal.confidenceScore,
      }
    : null;
  return {
    ...projected,
    proposal_type: proposal.proposalType as DossierAIProposalV1["proposal_type"],
    proposed_value: proposedValue,
    confidence,
    review_state: proposal.reviewState as DossierAIProposalV1["review_state"],
    accepted_object_type: proposal.acceptedObjectType as DossierAIProposalV1["accepted_object_type"],
  };
}

function assertionTypeFor(proposalType: string) {
  return ASSERTION_PROPOSAL_TYPES[proposalType as keyof typeof ASSERTION_PROPOSAL_TYPES] ?? null;
}

function assertionStatement(value: JsonValue) {
  if (typeof value === "string") {
    return boundedDossierText(value, "accepted assertion statement", 1, 20_000);
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Accepted assertion proposals require a statement.");
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "statement") {
    throw new Error("Accepted assertion proposals require exactly one statement field.");
  }
  return boundedDossierText(value.statement, "accepted assertion statement", 1, 20_000);
}

function parseAcceptedEvidenceLink(value: JsonValue, acceptedAnchorIds: string[]): AcceptedEvidenceLink {
  const keys = [
    "decision_package_reference_id",
    "professional_meaning",
    "relation",
    "schema_version",
    "source_anchor_id",
    "target_id",
    "target_type",
  ];
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Accepted evidence-link proposals require an exact structured value.");
  }
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== keys.length || actualKeys.some((key, index) => key !== keys[index])) {
    throw new Error("Accepted evidence-link proposals contain unsupported fields.");
  }
  if (value.schema_version !== 1) throw new Error("The evidence-link schema version is unsupported.");
  const sourceAnchorId = parseDossierOpaqueId(value.source_anchor_id, "source anchor ID");
  if (!acceptedAnchorIds.includes(sourceAnchorId)) {
    throw new Error("The evidence link must bind an exact accepted source anchor from this proposal.");
  }
  const targetType = dossierEnum(value.target_type, ["graph_node", "graph_edge"] as const, "evidence target type");
  return {
    sourceAnchorId,
    decisionPackageReferenceId: parseDossierOpaqueId(
      value.decision_package_reference_id,
      "decision-package reference ID",
    ),
    targetType,
    targetId: graphEntityId(value.target_id, "graph target ID"),
    relation: dossierEnum(value.relation, DOSSIER_WIRE_ENUMS.evidence_relation, "evidence relation"),
    professionalMeaning: boundedDossierText(value.professional_meaning, "professional meaning", 1, 1_000),
  };
}

function opaqueIdList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PROPOSAL_SOURCES) {
    throw new Error(`${label} are invalid.`);
  }
  const ids = value.map((id) => parseDossierOpaqueId(id, label));
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contain duplicates.`);
  return ids;
}

function proposalJsonValue(value: unknown, label: string): JsonValue {
  const serialized = canonicalDossierJson(value);
  if (serialized.length > MAX_PROPOSED_VALUE_CHARACTERS) {
    throw new Error(`${label} exceeds the proposal limit.`);
  }
  return JSON.parse(serialized) as JsonValue;
}

function editedProposalValue(value: unknown) {
  if (typeof value !== "string") return proposalJsonValue(value, "edited value");
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("The edited value is invalid.");
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("The edited structured value is not valid JSON.");
    }
    return proposalJsonValue(parsed, "edited value");
  }
  return proposalJsonValue(trimmed, "edited value");
}

function boundedStoredProposalValue(value: unknown): JsonValue {
  try {
    return proposalJsonValue(value, "stored proposed value");
  } catch {
    return { unavailable_reason: "PROPOSAL_VALUE_WITHHELD" };
  }
}

function nullableReviewNote(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return boundedDossierText(value, "review note", 1, 2_000);
}

function parseProposalId(payload: Record<string, unknown>) {
  return parseDossierOpaqueId(field(payload, "proposalId", "proposal_id"), "proposal ID");
}

function field(payload: Record<string, unknown>, camel: string, snake: string) {
  return payload[camel] ?? payload[snake];
}

function pageLimit(value: string | null) {
  if (value === null) return MAX_PAGE_SIZE;
  if (!/^\d{1,3}$/u.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function pushMapValue(map: Map<string, string[]>, key: string, value: string) {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function sameStringSet(left: string[], right: string[]) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((value, index) => value === sortedRight[index]);
}

function revisionConflict(currentRevision: number) {
  return dossierJson({
    error: "The Matter changed before this proposal action.",
    code: "revision_conflict",
    currentRevision,
  }, 409);
}

function mutationConflict() {
  return dossierJson({
    error: "The Matter or proposal changed before this action could be recorded.",
    code: "proposal_conflict",
  }, 409);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
