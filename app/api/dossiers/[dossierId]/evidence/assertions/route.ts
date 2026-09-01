import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import {
  dossierAssertionSources,
  dossierAuditEvents,
  dossierDocuments,
  dossierProfessionalAssertions,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
} from "../../../../../../db/schema";
import {
  evidenceOutputAuditInputs,
  evidenceOutputStateStatements,
  evidencePageLimit,
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
  dossierStringList,
  expectedDossierRevision,
  isResponse,
  newDossierOpaqueId,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };
type DossierAccess = Exclude<Awaited<ReturnType<typeof requireDossierAccess>>, Response>;
type StoredAssertion = typeof dossierProfessionalAssertions.$inferSelect;

const MAX_PAGE_SIZE = 50;
const MAX_SOURCE_IDS = 50;
const MAX_SOURCE_ROWS = MAX_PAGE_SIZE * MAX_SOURCE_IDS;
const MAX_REQUEST_BYTES = 32_768;
const ASSERTION_ACTIONS = ["create", "review", "supersede"] as const;
const ASSERTION_TYPES = ["fact", "evidence", "rule", "assumption", "date", "contradiction"] as const;
const ASSERTION_REVIEW_DECISIONS = ["accepted", "rejected"] as const;
const ALLOWED_ASSERTION_FIELDS = new Set([
  "action",
  "expectedRevision", "expected_revision",
  "assertionId", "assertion_id", "professionalAssertionId", "professional_assertion_id",
  "assertionType", "assertion_type",
  "statement",
  "sourceAnchorIds", "source_anchor_ids",
  "decision",
]);
const CREATE_FIELDS = [
  "assertionType", "assertion_type", "statement", "sourceAnchorIds", "source_anchor_ids",
] as const;
const REVIEW_FIELDS = [
  "assertionId", "assertion_id", "professionalAssertionId", "professional_assertion_id", "decision",
] as const;

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  if (url.searchParams.getAll("limit").length > 1 || url.searchParams.getAll("cursor").length > 1) {
    return dossierJson({ error: "Assertion pagination parameters must be unique." }, 400);
  }
  const limit = evidencePageLimit(url.searchParams.get("limit"), MAX_PAGE_SIZE);
  if (limit === null) return dossierJson({ error: "The assertion page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursor: { id: string; updatedAt: string } | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "professional-assertion cursor");
    } catch {
      return dossierJson({ error: "The assertion cursor is invalid." }, 400);
    }
    const [storedCursor] = await context.db.select({
      id: dossierProfessionalAssertions.id,
      updatedAt: dossierProfessionalAssertions.updatedAt,
    }).from(dossierProfessionalAssertions).where(and(
      eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
      eq(dossierProfessionalAssertions.id, cursorId),
    )).limit(1);
    if (!storedCursor) return dossierJson({ error: "The assertion cursor is invalid." }, 400);
    cursor = storedCursor;
  }

  const rows = await context.db.select().from(dossierProfessionalAssertions).where(and(
    eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
    cursor ? or(
      lt(dossierProfessionalAssertions.updatedAt, cursor.updatedAt),
      and(
        eq(dossierProfessionalAssertions.updatedAt, cursor.updatedAt),
        lt(dossierProfessionalAssertions.id, cursor.id),
      ),
    ) : undefined,
  )).orderBy(
    desc(dossierProfessionalAssertions.updatedAt),
    desc(dossierProfessionalAssertions.id),
  ).limit(limit + 1);
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const sourceRows = visible.length === 0 ? [] : await context.db.select({
    assertionId: dossierAssertionSources.assertionId,
    sourceAnchorId: dossierAssertionSources.sourceAnchorId,
  }).from(dossierAssertionSources).where(and(
    eq(dossierAssertionSources.dossierId, access.dossier.id),
    inArray(dossierAssertionSources.assertionId, visible.map(({ id }) => id)),
  )).orderBy(asc(dossierAssertionSources.assertionId), asc(dossierAssertionSources.sourceAnchorId))
    .limit(MAX_SOURCE_ROWS + 1);
  if (sourceRows.length > MAX_SOURCE_ROWS) {
    return dossierJson({
      error: "The assertion page has too many provenance rows to return safely.",
      code: "assertion_source_limit",
    }, 409);
  }
  const sourcesByAssertion = new Map<string, string[]>();
  for (const source of sourceRows) {
    const sources = sourcesByAssertion.get(source.assertionId) ?? [];
    sources.push(source.sourceAnchorId);
    sourcesByAssertion.set(source.assertionId, sources);
  }
  return dossierJson({
    assertions: visible.map((assertion) => projectAssertion(
      assertion,
      sourcesByAssertion.get(assertion.id) ?? [],
    )),
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
    return dossierJson({ error: "Cross-site professional-assertion mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "assertions");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!payload) return dossierJson({ error: "A valid professional-assertion mutation is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_ASSERTION_FIELDS.has(key))) {
    return dossierJson({ error: "The assertion mutation contains a protected or unknown field." }, 400);
  }
  if (hasAmbiguousAliases(payload)) {
    return dossierJson({ error: "The assertion mutation contains an ambiguous field." }, 400);
  }

  let action: (typeof ASSERTION_ACTIONS)[number];
  let expectedRevision: number;
  try {
    action = dossierEnum(payload.action, ASSERTION_ACTIONS, "assertion action");
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The assertion mutation is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) return revisionConflict(access.dossier.revision);
  if (action === "create" && hasAny(payload, REVIEW_FIELDS)) {
    return dossierJson({ error: "Assertion create and review fields cannot be combined." }, 400);
  }
  if (action !== "create" && hasAny(payload, CREATE_FIELDS)) {
    return dossierJson({ error: "Assertion review accepts only the assertion identity and explicit decision." }, 400);
  }
  if (action === "review" && !("decision" in payload)) {
    return dossierJson({ error: "Assertion review requires an explicit accepted or rejected decision." }, 400);
  }
  if (action === "supersede" && "decision" in payload) {
    return dossierJson({ error: "Assertion supersession does not accept a review decision." }, 400);
  }

  if (action === "create") return createAssertion(context, access, payload, expectedRevision);
  if (action === "review") return reviewAssertion(context, access, payload, expectedRevision);
  return supersedeAssertion(context, access, payload, expectedRevision);
}

async function createAssertion(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let assertionType: (typeof ASSERTION_TYPES)[number];
  let statement: string;
  let sourceAnchorIds: string[];
  try {
    assertionType = dossierEnum(
      payload.assertionType ?? payload.assertion_type,
      ASSERTION_TYPES,
      "professional-assertion type",
    );
    statement = boundedDossierText(payload.statement, "professional assertion", 1, 8_000);
    sourceAnchorIds = dossierStringList(
      payload.sourceAnchorIds ?? payload.source_anchor_ids,
      "source-anchor ID",
      MAX_SOURCE_IDS,
      128,
    ).map((id) => parseDossierOpaqueId(id, "source-anchor ID"));
    if (sourceAnchorIds.length === 0) throw new Error("A professional assertion requires at least one source anchor.");
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The professional assertion is invalid.",
    }, 400);
  }

  const acceptedAnchors = await context.db.select({ id: dossierSourceAnchors.id })
    .from(dossierSourceAnchors).innerJoin(dossierDocuments, and(
      eq(dossierDocuments.dossierId, dossierSourceAnchors.dossierId),
      eq(dossierDocuments.id, dossierSourceAnchors.documentId),
    )).where(and(
      eq(dossierSourceAnchors.dossierId, access.dossier.id),
      inArray(dossierSourceAnchors.id, sourceAnchorIds),
      eq(dossierSourceAnchors.reviewState, "accepted"),
      eq(dossierDocuments.isProvisional, false),
    )).limit(MAX_SOURCE_IDS);
  if (acceptedAnchors.length !== sourceAnchorIds.length) return dossierNotFound();

  const outputStates = await loadCurrentEvidenceOutputs(context, access.dossier.id);
  if (!outputStates.ok) return outputStateLimit();
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const assertionId = newDossierOpaqueId("assertion");
  const values = {
    id: assertionId,
    dossierId: access.dossier.id,
    assertionType,
    statement,
    status: "needs_review" as const,
    originatingProposalId: null,
    reviewedByUserId: null,
    reviewedByActorRef: null,
    reviewedAt: null,
    createdByActorRef: context.actor.actorId,
    updatedByActorRef: context.actor.actorId,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof dossierProfessionalAssertions.$inferInsert;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [{
      actorRole: access.role,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: assertionId,
      summaryCode: "PROFESSIONAL_ASSERTION_CREATED",
      detail: {
        action: "create",
        assertion_type: assertionType,
        status: "needs_review",
        source_anchor_ids: sourceAnchorIds,
        originating_proposal_id: null,
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "PROFESSIONAL_ASSERTION_CHANGED",
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
      context.db.insert(dossierProfessionalAssertions).values(values),
      ...sourceAnchorIds.map((sourceAnchorId) => context.db.insert(dossierAssertionSources).values({
        dossierId: access.dossier.id,
        assertionId,
        sourceAnchorId,
        createdAt: now,
      })),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "PROFESSIONAL_ASSERTION_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  return assertionMutationResponse(
    context,
    access,
    values as StoredAssertion,
    sourceAnchorIds,
    nextRevision,
    auditEvents[0]!.id,
    201,
  );
}

async function reviewAssertion(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let assertionId: string;
  let decision: (typeof ASSERTION_REVIEW_DECISIONS)[number];
  try {
    assertionId = assertionIdentity(payload);
    decision = dossierEnum(payload.decision, ASSERTION_REVIEW_DECISIONS, "assertion review decision");
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The assertion review is invalid.",
    }, 400);
  }
  const [stored] = await context.db.select().from(dossierProfessionalAssertions).where(and(
    eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
    eq(dossierProfessionalAssertions.id, assertionId),
  )).limit(1);
  if (!stored) return dossierNotFound();
  if (stored.status !== "needs_review") {
    return dossierJson({ error: "The professional assertion is no longer pending review.", code: "assertion_not_reviewable" }, 409);
  }
  const sources = await assertionSources(context, access.dossier.id, assertionId);
  if (sources.length > MAX_SOURCE_IDS) return assertionSourceLimit();
  if (decision === "accepted" && (
    sources.length === 0 || sources.some(({ reviewState, isProvisional }) => (
      reviewState !== "accepted" || isProvisional
    ))
  )) {
    return dossierJson({
      error: "The assertion cannot be accepted without only accepted source anchors.",
      code: "assertion_sources_unavailable",
    }, 409);
  }

  const outputStates = await loadCurrentEvidenceOutputs(context, access.dossier.id);
  if (!outputStates.ok) return outputStateLimit();
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [{
      actorRole: access.role,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: assertionId,
      summaryCode: decision === "accepted" ? "PROFESSIONAL_ASSERTION_ACCEPTED" : "PROFESSIONAL_ASSERTION_REJECTED",
      detail: {
        action: "review",
        previous_status: stored.status,
        status: decision,
        source_anchor_ids: sources.map(({ sourceAnchorId }) => sourceAnchorId),
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "PROFESSIONAL_ASSERTION_CHANGED",
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
      context.db.update(dossierProfessionalAssertions).set({
        status: decision,
        reviewedByUserId: context.actor.userId,
        reviewedByActorRef: context.actor.actorId,
        reviewedAt: now,
        updatedByActorRef: context.actor.actorId,
        updatedAt: now,
      }).where(and(
        eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
        eq(dossierProfessionalAssertions.id, assertionId),
        eq(dossierProfessionalAssertions.status, "needs_review"),
      )),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "PROFESSIONAL_ASSERTION_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  return assertionMutationResponse(context, access, {
    ...stored,
    status: decision,
    reviewedByUserId: context.actor.userId,
    reviewedByActorRef: context.actor.actorId,
    reviewedAt: now,
    updatedByActorRef: context.actor.actorId,
    updatedAt: now,
  }, sources.map(({ sourceAnchorId }) => sourceAnchorId), nextRevision, auditEvents[0]!.id);
}

async function supersedeAssertion(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let assertionId: string;
  try {
    assertionId = assertionIdentity(payload);
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The assertion supersession is invalid.",
    }, 400);
  }
  const [stored] = await context.db.select().from(dossierProfessionalAssertions).where(and(
    eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
    eq(dossierProfessionalAssertions.id, assertionId),
  )).limit(1);
  if (!stored) return dossierNotFound();
  if (stored.status !== "accepted") {
    return dossierJson({ error: "Only an accepted professional assertion can be superseded.", code: "assertion_not_supersedable" }, 409);
  }
  const sources = await assertionSources(context, access.dossier.id, assertionId);
  if (sources.length > MAX_SOURCE_IDS) return assertionSourceLimit();
  const outputStates = await loadCurrentEvidenceOutputs(context, access.dossier.id);
  if (!outputStates.ok) return outputStateLimit();
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [{
      actorRole: access.role,
      eventType: "assertion_reviewed",
      objectRefType: "professional_assertion",
      objectRefId: assertionId,
      summaryCode: "PROFESSIONAL_ASSERTION_SUPERSEDED",
      detail: {
        action: "supersede",
        previous_status: stored.status,
        status: "superseded",
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "PROFESSIONAL_ASSERTION_CHANGED",
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
      context.db.update(dossierProfessionalAssertions).set({
        status: "superseded",
        updatedByActorRef: context.actor.actorId,
        updatedAt: now,
      }).where(and(
        eq(dossierProfessionalAssertions.dossierId, access.dossier.id),
        eq(dossierProfessionalAssertions.id, assertionId),
        eq(dossierProfessionalAssertions.status, "accepted"),
      )),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "PROFESSIONAL_ASSERTION_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }
  return assertionMutationResponse(context, access, {
    ...stored,
    status: "superseded",
    updatedByActorRef: context.actor.actorId,
    updatedAt: now,
  }, sources.map(({ sourceAnchorId }) => sourceAnchorId), nextRevision, auditEvents[0]!.id);
}

async function assertionSources(context: DossierServerContext, dossierId: string, assertionId: string) {
  return context.db.select({
    sourceAnchorId: dossierAssertionSources.sourceAnchorId,
    reviewState: dossierSourceAnchors.reviewState,
    isProvisional: dossierDocuments.isProvisional,
  }).from(dossierAssertionSources).innerJoin(dossierSourceAnchors, and(
    eq(dossierSourceAnchors.dossierId, dossierAssertionSources.dossierId),
    eq(dossierSourceAnchors.id, dossierAssertionSources.sourceAnchorId),
  )).innerJoin(dossierDocuments, and(
    eq(dossierDocuments.dossierId, dossierSourceAnchors.dossierId),
    eq(dossierDocuments.id, dossierSourceAnchors.documentId),
  )).where(and(
    eq(dossierAssertionSources.dossierId, dossierId),
    eq(dossierAssertionSources.assertionId, assertionId),
  )).orderBy(asc(dossierAssertionSources.sourceAnchorId)).limit(MAX_SOURCE_IDS + 1);
}

async function assertionMutationResponse(
  context: DossierServerContext,
  access: DossierAccess,
  assertion: StoredAssertion,
  sourceAnchorIds: readonly string[],
  revision: number,
  auditEventId: string,
  status = 200,
) {
  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: revision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: canonicalDossierTimestamp(),
  });
  return dossierJson({
    assertion: projectAssertion(assertion, sourceAnchorIds),
    dossier: { dossier_id: access.dossier.id, revision, readiness },
    audit_event_id: auditEventId,
    contract_version: "1.0.0",
  }, status);
}

function projectAssertion(assertion: StoredAssertion, sourceAnchorIds: readonly string[]) {
  return {
    object_type: "professional_assertion",
    schema_version: 1,
    assertion_id: assertion.id,
    dossier_id: assertion.dossierId,
    assertion_type: assertion.assertionType,
    statement: assertion.statement,
    status: assertion.status,
    source_anchor_ids: [...sourceAnchorIds],
    originating_proposal_id: assertion.originatingProposalId,
    reviewed_by: assertion.reviewedByActorRef,
    reviewed_at: assertion.reviewedAt,
    created_by: assertion.createdByActorRef,
    created_at: assertion.createdAt,
    updated_by: assertion.updatedByActorRef,
    updated_at: assertion.updatedAt,
  };
}

function assertionIdentity(payload: Record<string, unknown>) {
  return parseDossierOpaqueId(
    payload.assertionId
      ?? payload.assertion_id
      ?? payload.professionalAssertionId
      ?? payload.professional_assertion_id,
    "professional-assertion ID",
  );
}

function hasAny(payload: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((field) => field in payload);
}

function hasAmbiguousAliases(payload: Record<string, unknown>) {
  const aliases = [
    ["expectedRevision", "expected_revision"],
    ["assertionType", "assertion_type"],
    ["sourceAnchorIds", "source_anchor_ids"],
    ["assertionId", "assertion_id"],
    ["professionalAssertionId", "professional_assertion_id"],
  ];
  const assertionIdentityCount = [
    "assertionId", "assertion_id", "professionalAssertionId", "professional_assertion_id",
  ].filter((field) => field in payload).length;
  return aliases.some(([camel, snake]) => camel in payload && snake in payload) || assertionIdentityCount > 1;
}

function revisionConflict(currentRevision: number) {
  return dossierJson({
    error: "The Matter changed before this professional assertion could be saved.",
    code: "revision_conflict",
    currentRevision,
  }, 409);
}

function mutationConflict() {
  return dossierJson({
    error: "The Matter changed before this assertion mutation could be recorded.",
    code: "assertion_conflict",
  }, 409);
}

function outputStateLimit() {
  return dossierJson({
    error: "The Matter has too much output history to update safely.",
    code: "output_state_limit",
  }, 409);
}

function assertionSourceLimit() {
  return dossierJson({
    error: "The professional assertion has too many provenance rows to update safely.",
    code: "assertion_source_limit",
  }, 409);
}
