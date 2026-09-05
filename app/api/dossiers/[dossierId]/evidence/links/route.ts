import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierDeadlineReferences,
  dossierDocuments,
  dossierEvidenceLinks,
  dossierProfessionalAssertions,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
} from "../../../../../../db/schema";
import {
  evidenceOutputAuditInputs,
  evidenceOutputStateStatements,
  evidencePageLimit,
  exactCurrentGraphEntityExists,
  graphEntityId,
  loadCurrentEvidenceOutputs,
} from "../../../../../dossier-evidence-server";
import { computeStoredDossierReadiness } from "../../../../../dossier-readiness-server";
import { parseDossierOpaqueId } from "../../../../../dossier-security";
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
} from "../../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };
type StoredEvidenceLink = typeof dossierEvidenceLinks.$inferSelect;

const MAX_PAGE_SIZE = 50;
const MAX_REQUEST_BYTES = 24_576;
const EVIDENCE_TARGET_TYPES = [
  "professional_assertion",
  "authority_rule",
  "graph_node",
  "graph_edge",
  "parameter_assumption",
  "deadline",
  "report_section",
] as const;
const EVIDENCE_RELATIONS = ["supports", "contradicts", "qualifies", "supersedes", "source_for"] as const;
const ALLOWED_EVIDENCE_FIELDS = new Set([
  "action",
  "expectedRevision", "expected_revision",
  "sourceAnchorId", "source_anchor_id",
  "assertionId", "assertion_id",
  "decisionPackageReferenceId", "decision_package_reference_id",
  "targetType", "target_type",
  "targetId", "target_id",
  "relation",
  "professionalMeaning", "professional_meaning",
]);

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  if (url.searchParams.getAll("limit").length > 1 || url.searchParams.getAll("cursor").length > 1) {
    return dossierJson({ error: "Evidence-link pagination parameters must be unique." }, 400);
  }
  const limit = evidencePageLimit(url.searchParams.get("limit"), MAX_PAGE_SIZE);
  if (limit === null) return dossierJson({ error: "The evidence-link page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursor: { id: string; createdAt: string } | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "evidence-link cursor");
    } catch {
      return dossierJson({ error: "The evidence-link cursor is invalid." }, 400);
    }
    const [storedCursor] = await context.db.select({
      id: dossierEvidenceLinks.id,
      createdAt: dossierEvidenceLinks.createdAt,
    }).from(dossierEvidenceLinks).where(and(
      eq(dossierEvidenceLinks.dossierId, access.dossier.id),
      eq(dossierEvidenceLinks.id, cursorId),
    )).limit(1);
    if (!storedCursor) return dossierJson({ error: "The evidence-link cursor is invalid." }, 400);
    cursor = storedCursor;
  }

  const rows = await context.db.select().from(dossierEvidenceLinks).where(and(
    eq(dossierEvidenceLinks.dossierId, access.dossier.id),
    cursor ? or(
      lt(dossierEvidenceLinks.createdAt, cursor.createdAt),
      and(
        eq(dossierEvidenceLinks.createdAt, cursor.createdAt),
        lt(dossierEvidenceLinks.id, cursor.id),
      ),
    ) : undefined,
  )).orderBy(desc(dossierEvidenceLinks.createdAt), desc(dossierEvidenceLinks.id)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return dossierJson({
    evidence_links: visible.map(projectEvidenceLink),
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
    return dossierJson({ error: "Cross-site evidence-link mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "evidence");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!payload) return dossierJson({ error: "A valid evidence-link mutation is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_EVIDENCE_FIELDS.has(key))) {
    return dossierJson({ error: "The evidence-link mutation contains a protected or unknown field." }, 400);
  }
  if (hasAmbiguousAliases(payload)) {
    return dossierJson({ error: "The evidence-link mutation contains an ambiguous field." }, 400);
  }

  let expectedRevision: number;
  let sourceAnchorId: string;
  let assertionId: string | null;
  let decisionPackageReferenceId: string | null;
  let targetType: (typeof EVIDENCE_TARGET_TYPES)[number];
  let targetId: string;
  let relation: (typeof EVIDENCE_RELATIONS)[number];
  let professionalMeaning: string;
  try {
    if (payload.action !== "create") throw new Error("Evidence links support only the explicit create action.");
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
    sourceAnchorId = parseDossierOpaqueId(
      payload.sourceAnchorId ?? payload.source_anchor_id,
      "source-anchor ID",
    );
    assertionId = optionalOpaqueId(payload.assertionId ?? payload.assertion_id, "professional-assertion ID");
    decisionPackageReferenceId = optionalOpaqueId(
      payload.decisionPackageReferenceId ?? payload.decision_package_reference_id,
      "decision-package reference ID",
    );
    targetType = dossierEnum(
      payload.targetType ?? payload.target_type,
      EVIDENCE_TARGET_TYPES,
      "evidence target type",
    );
    targetId = targetType === "graph_node" || targetType === "graph_edge"
      ? graphEntityId(payload.targetId ?? payload.target_id, "graph entity ID")
      : parseDossierOpaqueId(payload.targetId ?? payload.target_id, "evidence target ID");
    relation = dossierEnum(payload.relation, EVIDENCE_RELATIONS, "evidence relation");
    professionalMeaning = boundedDossierText(
      payload.professionalMeaning ?? payload.professional_meaning,
      "professional meaning",
      1,
      1_000,
    );
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The evidence link is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) return revisionConflict(access.dossier.revision);

  const isGraphTarget = targetType === "graph_node" || targetType === "graph_edge";
  if (isGraphTarget !== (decisionPackageReferenceId !== null)) {
    return dossierJson({
      error: "Graph evidence requires exactly one current decision-package reference; non-graph evidence cannot supply one.",
    }, 400);
  }
  if (targetType === "report_section") {
    return dossierJson({
      error: "That reviewed Evidence target is unavailable.",
      code: "evidence_target_unavailable",
    }, 404);
  }

  const [anchor] = await context.db.select({ id: dossierSourceAnchors.id })
    .from(dossierSourceAnchors).innerJoin(dossierDocuments, and(
      eq(dossierDocuments.dossierId, dossierSourceAnchors.dossierId),
      eq(dossierDocuments.id, dossierSourceAnchors.documentId),
    )).where(and(
      eq(dossierSourceAnchors.dossierId, access.dossier.id),
      eq(dossierSourceAnchors.id, sourceAnchorId),
      eq(dossierSourceAnchors.reviewState, "accepted"),
      eq(dossierDocuments.isProvisional, false),
    )).limit(1);
  if (!anchor) return dossierNotFound();

  let effectiveAssertionId = assertionId;
  let requiredAssertionType: string | null = null;
  if (targetType === "professional_assertion") {
    if (assertionId === null || assertionId !== targetId) {
      return dossierJson({ error: "Professional-assertion evidence must bind the exact target assertion." }, 400);
    }
  } else if (targetType === "authority_rule" || targetType === "parameter_assumption") {
    if (assertionId !== null && assertionId !== targetId) {
      return dossierJson({ error: "Reviewed assertion evidence must bind the exact typed assertion target." }, 400);
    }
    effectiveAssertionId = targetId;
    requiredAssertionType = targetType === "authority_rule" ? "rule" : "assumption";
  }
  if (effectiveAssertionId !== null) {
    const [assertion] = await context.db.select({
      assertionType: dossierProfessionalAssertions.assertionType,
    }).from(dossierProfessionalAssertions).where(and(
      eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
      eq(dossierProfessionalAssertions.id, effectiveAssertionId),
      eq(dossierProfessionalAssertions.status, "accepted"),
    )).limit(1);
    if (!assertion || (requiredAssertionType !== null && assertion.assertionType !== requiredAssertionType)) {
      return dossierNotFound();
    }
  }

  if (targetType === "graph_node" || targetType === "graph_edge") {
    const graphTargetExists = await exactCurrentGraphEntityExists(
      context,
      access.dossier.id,
      decisionPackageReferenceId!,
      targetType,
      targetId,
    );
    if (!graphTargetExists) return dossierNotFound();
  } else if (targetType === "deadline") {
    const [deadline] = await context.db.select({ id: dossierDeadlineReferences.id })
      .from(dossierDeadlineReferences).where(and(
        eq(dossierDeadlineReferences.dossierId, access.dossier.id),
        eq(dossierDeadlineReferences.id, targetId),
      )).limit(1);
    if (!deadline) return dossierNotFound();
  }

  const duplicateWhere = and(
    eq(dossierEvidenceLinks.dossierId, access.dossier.id),
    eq(dossierEvidenceLinks.sourceAnchorId, sourceAnchorId),
    effectiveAssertionId === null
      ? isNull(dossierEvidenceLinks.assertionId)
      : eq(dossierEvidenceLinks.assertionId, effectiveAssertionId),
    decisionPackageReferenceId === null
      ? isNull(dossierEvidenceLinks.decisionPackageReferenceId)
      : eq(dossierEvidenceLinks.decisionPackageReferenceId, decisionPackageReferenceId),
    eq(dossierEvidenceLinks.targetType, targetType),
    eq(dossierEvidenceLinks.targetId, targetId),
    eq(dossierEvidenceLinks.relation, relation),
  );
  const [duplicate] = await context.db.select({ id: dossierEvidenceLinks.id })
    .from(dossierEvidenceLinks).where(duplicateWhere).limit(1);
  if (duplicate) {
    return dossierJson({
      error: "That exact reviewed evidence relationship already exists.",
      code: "evidence_link_exists",
      evidence_link_id: duplicate.id,
    }, 409);
  }

  const outputStates = await loadCurrentEvidenceOutputs(context, access.dossier.id);
  if (!outputStates.ok) return outputStateLimit();
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const evidenceLinkId = newDossierOpaqueId("evidence_link");
  const values = {
    id: evidenceLinkId,
    dossierId: access.dossier.id,
    sourceAnchorId,
    assertionId: effectiveAssertionId,
    decisionPackageReferenceId,
    targetType,
    targetId,
    relation,
    professionalMeaning,
    createdByActorRef: context.actor.actorId,
    reviewedByUserId: context.actor.userId,
    reviewedByActorRef: context.actor.actorId,
    reviewedAt: now,
    createdAt: now,
  } satisfies typeof dossierEvidenceLinks.$inferInsert;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [{
      actorRole: access.role,
      eventType: "evidence_link_changed",
      objectRefType: "evidence_link",
      objectRefId: evidenceLinkId,
      summaryCode: "EVIDENCE_LINK_CREATED",
      detail: {
        action: "create",
        source_anchor_id: sourceAnchorId,
        assertion_id: effectiveAssertionId,
        decision_package_reference_id: decisionPackageReferenceId,
        target_type: targetType,
        target_id: targetId,
        relation,
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "EVIDENCE_LINK_CHANGED",
      nextRevision,
      now,
    )],
  );

  try {
    await context.db.batch([
      context.db.update(dossiers).set({
        revision: nextRevision,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
      }).where(and(eq(dossiers.id, access.dossier.id), eq(dossiers.revision, expectedRevision))),
      context.db.insert(dossierEvidenceLinks).values(values),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "EVIDENCE_LINK_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: nextRevision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: now,
  });
  return dossierJson({
    evidence_link: projectEvidenceLink(values as StoredEvidenceLink),
    dossier: { dossier_id: access.dossier.id, revision: nextRevision, readiness },
    audit_event_id: auditEvents[0]!.id,
    contract_version: "1.0.0",
  }, 201);
}

function projectEvidenceLink(link: StoredEvidenceLink) {
  return {
    object_type: "evidence_link",
    schema_version: 1,
    evidence_link_id: link.id,
    dossier_id: link.dossierId,
    source_anchor_id: link.sourceAnchorId,
    assertion_id: link.assertionId,
    decision_package_reference_id: link.decisionPackageReferenceId,
    target_type: link.targetType,
    target_id: link.targetId,
    relation: link.relation,
    professional_meaning: link.professionalMeaning,
    created_by: link.createdByActorRef,
    reviewed_by: link.reviewedByActorRef,
    reviewed_at: link.reviewedAt,
    created_at: link.createdAt,
  };
}

function optionalOpaqueId(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return parseDossierOpaqueId(value, label);
}

function hasAmbiguousAliases(payload: Record<string, unknown>) {
  return [
    ["expectedRevision", "expected_revision"],
    ["sourceAnchorId", "source_anchor_id"],
    ["assertionId", "assertion_id"],
    ["decisionPackageReferenceId", "decision_package_reference_id"],
    ["targetType", "target_type"],
    ["targetId", "target_id"],
    ["professionalMeaning", "professional_meaning"],
  ].some(([camel, snake]) => camel in payload && snake in payload);
}

function revisionConflict(currentRevision: number) {
  return dossierJson({
    error: "The Matter changed before this evidence link could be saved.",
    code: "revision_conflict",
    currentRevision,
  }, 409);
}

function mutationConflict() {
  return dossierJson({
    error: "The Matter changed before this evidence-link mutation could be recorded.",
    code: "evidence_link_conflict",
  }, 409);
}

function outputStateLimit() {
  return dossierJson({
    error: "The Matter has too much output history to update safely.",
    code: "output_state_limit",
  }, 409);
}
