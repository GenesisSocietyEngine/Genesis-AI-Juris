import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierDocuments,
  dossierDocumentVersions,
  dossierExtractionPageMaps,
  dossierExtractionResults,
  dossierRevisionReceipts,
  dossierSourceAnchors,
  dossiers,
} from "../../../../../../db/schema";
import { canonicalDossierJson } from "../../../../../dossier-contract";
import {
  evidenceOutputAuditInputs,
  evidenceOutputStateStatements,
  evidencePageLimit,
  loadCurrentEvidenceOutputs,
  nonNegativeInteger,
  positiveInteger,
} from "../../../../../dossier-evidence-server";
import { computeStoredDossierReadiness } from "../../../../../dossier-readiness-server";
import { parseDossierOpaqueId } from "../../../../../dossier-security";
import {
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
  dossierNotFound,
  dossierSha256,
  expectedDossierRevision,
  isResponse,
  newDossierOpaqueId,
  optionalDossierText,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
  type DossierServerContext,
} from "../../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };
type DossierAccess = Exclude<Awaited<ReturnType<typeof requireDossierAccess>>, Response>;
type ProjectableAnchor = typeof dossierSourceAnchors.$inferSelect;

const MAX_PAGE_SIZE = 50;
const MAX_REQUEST_BYTES = 24_576;
const ANCHOR_ACTIONS = ["create", "review"] as const;
const ANCHOR_REVIEW_DECISIONS = ["accepted", "rejected"] as const;
const ALLOWED_ANCHOR_FIELDS = new Set([
  "action",
  "expectedRevision", "expected_revision",
  "anchorId", "anchor_id", "sourceAnchorId", "source_anchor_id",
  "documentId", "document_id",
  "documentVersionId", "document_version_id",
  "pageNumber", "page_number",
  "section", "heading", "paragraph",
  "characterStart", "character_start",
  "characterEnd", "character_end",
  "excerpt",
  "extractionVersion", "extraction_version",
  "decision",
]);
const CREATE_FIELDS = [
  "documentId", "document_id", "documentVersionId", "document_version_id",
  "pageNumber", "page_number", "section", "heading", "paragraph",
  "characterStart", "character_start", "characterEnd", "character_end",
  "excerpt", "extractionVersion", "extraction_version",
] as const;
const REVIEW_FIELDS = [
  "anchorId", "anchor_id", "sourceAnchorId", "source_anchor_id", "decision",
] as const;

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const url = new URL(request.url);
  if (url.searchParams.getAll("limit").length > 1 || url.searchParams.getAll("cursor").length > 1) {
    return dossierJson({ error: "Source-anchor pagination parameters must be unique." }, 400);
  }
  const limit = evidencePageLimit(url.searchParams.get("limit"), MAX_PAGE_SIZE);
  if (limit === null) return dossierJson({ error: "The source-anchor page limit is invalid." }, 400);

  const cursorValue = url.searchParams.get("cursor");
  let cursor: { id: string; createdAt: string } | null = null;
  if (cursorValue) {
    let cursorId: string;
    try {
      cursorId = parseDossierOpaqueId(cursorValue, "source-anchor cursor");
    } catch {
      return dossierJson({ error: "The source-anchor cursor is invalid." }, 400);
    }
    const [storedCursor] = await context.db.select({
      id: dossierSourceAnchors.id,
      createdAt: dossierSourceAnchors.createdAt,
    }).from(dossierSourceAnchors).where(and(
      eq(dossierSourceAnchors.dossierId, access.dossier.id),
      eq(dossierSourceAnchors.id, cursorId),
    )).limit(1);
    if (!storedCursor) return dossierJson({ error: "The source-anchor cursor is invalid." }, 400);
    cursor = storedCursor;
  }

  const rows = await context.db.select().from(dossierSourceAnchors).where(and(
    eq(dossierSourceAnchors.dossierId, access.dossier.id),
    cursor ? or(
      lt(dossierSourceAnchors.createdAt, cursor.createdAt),
      and(
        eq(dossierSourceAnchors.createdAt, cursor.createdAt),
        lt(dossierSourceAnchors.id, cursor.id),
      ),
    ) : undefined,
  )).orderBy(desc(dossierSourceAnchors.createdAt), desc(dossierSourceAnchors.id)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return dossierJson({
    source_anchors: visible.map(projectSourceAnchor),
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
    return dossierJson({ error: "Cross-site source-anchor mutation rejected." }, 403);
  }
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "anchors");
  if (isResponse(access)) return access;

  const payload = await readJsonObject(request, MAX_REQUEST_BYTES);
  if (!payload) return dossierJson({ error: "A valid source-anchor mutation is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_ANCHOR_FIELDS.has(key))) {
    return dossierJson({ error: "The source-anchor mutation contains a protected or unknown field." }, 400);
  }
  if (hasAmbiguousAliases(payload)) {
    return dossierJson({ error: "The source-anchor mutation contains an ambiguous field." }, 400);
  }

  let action: (typeof ANCHOR_ACTIONS)[number];
  let expectedRevision: number;
  try {
    action = dossierEnum(payload.action, ANCHOR_ACTIONS, "source-anchor action");
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The source-anchor mutation is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) return revisionConflict(access.dossier.revision);
  if (action === "create" && hasAny(payload, REVIEW_FIELDS)) {
    return dossierJson({ error: "Source-anchor create and review fields cannot be combined." }, 400);
  }
  if (action === "review" && hasAny(payload, CREATE_FIELDS)) {
    return dossierJson({ error: "Source-anchor review accepts only the anchor identity and decision." }, 400);
  }
  return action === "create"
    ? createSourceAnchor(context, access, payload, expectedRevision)
    : reviewSourceAnchor(context, access, payload, expectedRevision);
}

async function createSourceAnchor(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let input: AnchorInput;
  try {
    input = parseAnchorInput(payload);
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The source anchor is invalid.",
    }, 400);
  }

  const binding = await exactAnchorBinding(context, access.dossier.id, input);
  if (!binding.ok) return binding.response;
  const anchorChecksum = await sourceAnchorChecksum(
    access.dossier.id,
    input,
    binding.contentSha256,
  );
  const [duplicate] = await context.db.select({ id: dossierSourceAnchors.id })
    .from(dossierSourceAnchors).where(and(
      eq(dossierSourceAnchors.dossierId, access.dossier.id),
      eq(dossierSourceAnchors.documentVersionId, input.documentVersionId),
      eq(dossierSourceAnchors.anchorChecksum, anchorChecksum),
    )).limit(1);
  if (duplicate) {
    return dossierJson({
      error: "That exact immutable source anchor already exists.",
      code: "anchor_exists",
      source_anchor_id: duplicate.id,
    }, 409);
  }

  const outputStates = await loadCurrentEvidenceOutputs(context, access.dossier.id);
  if (!outputStates.ok) return outputStateLimit();
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const sourceAnchorId = newDossierOpaqueId("source_anchor");
  const values = {
    id: sourceAnchorId,
    dossierId: access.dossier.id,
    ...input,
    anchorChecksum,
    creator: "human" as const,
    reviewState: "pending" as const,
    reviewerUserId: null,
    reviewerActorRef: null,
    reviewedAt: null,
    createdByActorRef: context.actor.actorId,
    createdAt: now,
  } satisfies typeof dossierSourceAnchors.$inferInsert;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [{
      actorRole: access.role,
      eventType: "source_anchor_reviewed",
      objectRefType: "source_anchor",
      objectRefId: sourceAnchorId,
      summaryCode: "SOURCE_ANCHOR_CREATED",
      detail: {
        action: "create",
        document_id: input.documentId,
        document_version_id: input.documentVersionId,
        anchor_checksum: anchorChecksum,
        review_state: "pending",
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "SOURCE_ANCHOR_CHANGED",
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
      context.db.insert(dossierSourceAnchors).values(values),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "SOURCE_ANCHOR_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  return anchorMutationResponse(context, access, values as ProjectableAnchor, nextRevision, auditEvents[0]!.id, 201);
}

async function reviewSourceAnchor(
  context: DossierServerContext,
  access: DossierAccess,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  let sourceAnchorId: string;
  let decision: (typeof ANCHOR_REVIEW_DECISIONS)[number];
  try {
    sourceAnchorId = parseDossierOpaqueId(
      payload.sourceAnchorId ?? payload.source_anchor_id ?? payload.anchorId ?? payload.anchor_id,
      "source-anchor ID",
    );
    decision = dossierEnum(payload.decision, ANCHOR_REVIEW_DECISIONS, "source-anchor review decision");
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The source-anchor review is invalid.",
    }, 400);
  }
  const [stored] = await context.db.select().from(dossierSourceAnchors).where(and(
    eq(dossierSourceAnchors.dossierId, access.dossier.id),
    eq(dossierSourceAnchors.id, sourceAnchorId),
  )).limit(1);
  if (!stored) return dossierNotFound();
  if (stored.reviewState !== "pending") {
    return dossierJson({ error: "The source anchor is no longer pending review.", code: "anchor_not_reviewable" }, 409);
  }
  if (decision === "accepted") {
    const storedInput: AnchorInput = {
      documentId: stored.documentId,
      documentVersionId: stored.documentVersionId,
      pageNumber: stored.pageNumber,
      section: stored.section,
      heading: stored.heading,
      paragraph: stored.paragraph,
      characterStart: stored.characterStart,
      characterEnd: stored.characterEnd,
      excerpt: stored.excerpt,
      extractionVersion: stored.extractionVersion,
    };
    const binding = await exactAnchorBinding(context, access.dossier.id, storedInput);
    if (!binding.ok) return binding.response;
    const expectedChecksum = await sourceAnchorChecksum(
      access.dossier.id,
      storedInput,
      binding.contentSha256,
    );
    if (expectedChecksum !== stored.anchorChecksum) return dossierNotFound();
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
      eventType: "source_anchor_reviewed",
      objectRefType: "source_anchor",
      objectRefId: sourceAnchorId,
      summaryCode: decision === "accepted" ? "SOURCE_ANCHOR_ACCEPTED" : "SOURCE_ANCHOR_REJECTED",
      detail: {
        action: "review",
        previous_review_state: stored.reviewState,
        review_state: decision,
        document_id: stored.documentId,
        document_version_id: stored.documentVersionId,
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "SOURCE_ANCHOR_CHANGED",
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
      context.db.update(dossierSourceAnchors).set({
        reviewState: decision,
        reviewerUserId: context.actor.userId,
        reviewerActorRef: context.actor.actorId,
        reviewedAt: now,
      }).where(and(
        eq(dossierSourceAnchors.dossierId, access.dossier.id),
        eq(dossierSourceAnchors.id, sourceAnchorId),
        eq(dossierSourceAnchors.reviewState, "pending"),
      )),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "SOURCE_ANCHOR_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return mutationConflict();
  }

  return anchorMutationResponse(context, access, {
    ...stored,
    reviewState: decision,
    reviewerUserId: context.actor.userId,
    reviewerActorRef: context.actor.actorId,
    reviewedAt: now,
  }, nextRevision, auditEvents[0]!.id);
}

async function anchorMutationResponse(
  context: DossierServerContext,
  access: DossierAccess,
  anchor: ProjectableAnchor,
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
    source_anchor: projectSourceAnchor(anchor),
    dossier: { dossier_id: access.dossier.id, revision, readiness },
    audit_event_id: auditEventId,
    contract_version: "1.0.0",
  }, status);
}

type AnchorInput = {
  documentId: string;
  documentVersionId: string;
  pageNumber: number | null;
  section: string | null;
  heading: string | null;
  paragraph: string | null;
  characterStart: number | null;
  characterEnd: number | null;
  excerpt: string | null;
  extractionVersion: string | null;
};

async function exactAnchorBinding(
  context: DossierServerContext,
  dossierId: string,
  input: AnchorInput,
): Promise<
  | { ok: true; contentSha256: string }
  | { ok: false; response: Response }
> {
  if (
    (input.characterStart === null) !== (input.characterEnd === null)
    || (input.characterStart !== null && input.characterEnd! <= input.characterStart)
    || (input.characterStart !== null && input.extractionVersion === null)
    || (
      input.pageNumber === null
      && input.section === null
      && input.heading === null
      && input.paragraph === null
      && input.characterStart === null
    )
  ) return { ok: false, response: dossierNotFound() };

  const [version] = await context.db.select({
    contentSha256: dossierDocumentVersions.contentSha256,
  }).from(dossierDocumentVersions).innerJoin(dossierDocuments, and(
    eq(dossierDocuments.dossierId, dossierDocumentVersions.dossierId),
    eq(dossierDocuments.id, dossierDocumentVersions.documentId),
  )).where(and(
    eq(dossierDocumentVersions.dossierId, dossierId),
    eq(dossierDocumentVersions.documentId, input.documentId),
    eq(dossierDocumentVersions.id, input.documentVersionId),
    eq(dossierDocuments.isProvisional, false),
  )).limit(1);
  if (!version) return { ok: false, response: dossierNotFound() };

  if (input.extractionVersion !== null) {
    const [extraction] = await context.db.select({
      id: dossierExtractionResults.id,
      characterCount: dossierExtractionResults.characterCount,
    }).from(dossierExtractionResults).where(and(
      eq(dossierExtractionResults.dossierId, dossierId),
      eq(dossierExtractionResults.documentId, input.documentId),
      eq(dossierExtractionResults.documentVersionId, input.documentVersionId),
      eq(dossierExtractionResults.extractorVersion, input.extractionVersion),
    )).limit(1);
    if (!extraction) return { ok: false, response: dossierNotFound() };
    if (input.characterEnd !== null && input.characterEnd > extraction.characterCount) {
      return {
        ok: false,
        response: dossierJson({ error: "The source-anchor character range is outside the exact extraction." }, 400),
      };
    }
    if (input.pageNumber !== null) {
      const [pageMap] = await context.db.select({ id: dossierExtractionPageMaps.id })
        .from(dossierExtractionPageMaps).where(and(
          eq(dossierExtractionPageMaps.dossierId, dossierId),
          eq(dossierExtractionPageMaps.documentId, input.documentId),
          eq(dossierExtractionPageMaps.documentVersionId, input.documentVersionId),
          eq(dossierExtractionPageMaps.extractionResultId, extraction.id),
          eq(dossierExtractionPageMaps.pageNumber, input.pageNumber),
          input.characterStart === null ? undefined : lte(dossierExtractionPageMaps.startOffset, input.characterStart),
          input.characterEnd === null ? undefined : gte(dossierExtractionPageMaps.endOffset, input.characterEnd),
        )).limit(1);
      if (!pageMap) {
        return {
          ok: false,
          response: dossierJson({ error: "The source-anchor page is outside the exact extraction." }, 400),
        };
      }
    }
  }
  return { ok: true, contentSha256: version.contentSha256 };
}

async function sourceAnchorChecksum(
  dossierId: string,
  input: AnchorInput,
  documentContentSha256: string,
) {
  return dossierSha256(canonicalDossierJson({
    kind: "genesis-juris-source-anchor-v1",
    dossier_id: dossierId,
    document_id: input.documentId,
    document_version_id: input.documentVersionId,
    document_content_sha256: documentContentSha256,
    page_number: input.pageNumber,
    section: input.section,
    heading: input.heading,
    paragraph: input.paragraph,
    character_start: input.characterStart,
    character_end: input.characterEnd,
    excerpt: input.excerpt,
    extraction_version: input.extractionVersion,
  }));
}

function parseAnchorInput(payload: Record<string, unknown>): AnchorInput {
  const documentId = parseDossierOpaqueId(payload.documentId ?? payload.document_id, "source document ID");
  const documentVersionId = parseDossierOpaqueId(
    payload.documentVersionId ?? payload.document_version_id,
    "source document-version ID",
  );
  const rawPage = payload.pageNumber ?? payload.page_number;
  const rawStart = payload.characterStart ?? payload.character_start;
  const rawEnd = payload.characterEnd ?? payload.character_end;
  const pageNumber = rawPage === undefined || rawPage === null ? null : positiveInteger(rawPage, "source-anchor page number");
  const characterStart = rawStart === undefined || rawStart === null
    ? null
    : nonNegativeInteger(rawStart, "source-anchor character start");
  const characterEnd = rawEnd === undefined || rawEnd === null
    ? null
    : nonNegativeInteger(rawEnd, "source-anchor character end");
  if ((characterStart === null) !== (characterEnd === null) || (characterStart !== null && characterEnd! <= characterStart)) {
    throw new Error("The source-anchor character range is invalid.");
  }
  const section = optionalDossierText(payload.section, "source-anchor section", 500);
  const heading = optionalDossierText(payload.heading, "source-anchor heading", 500);
  const paragraph = optionalDossierText(payload.paragraph, "source-anchor paragraph", 500);
  const excerpt = optionalDossierText(payload.excerpt, "source-anchor excerpt", 500);
  const extractionVersion = optionalDossierText(
    payload.extractionVersion ?? payload.extraction_version,
    "source-anchor extraction version",
    100,
  );
  if (characterStart !== null && extractionVersion === null) {
    throw new Error("Character anchors require an exact extraction version.");
  }
  if (pageNumber === null && section === null && heading === null && paragraph === null && characterStart === null) {
    throw new Error("A source anchor requires an exact page, section, heading, paragraph, or character range.");
  }
  return {
    documentId,
    documentVersionId,
    pageNumber,
    section,
    heading,
    paragraph,
    characterStart,
    characterEnd,
    excerpt,
    extractionVersion,
  };
}

function projectSourceAnchor(anchor: ProjectableAnchor) {
  return {
    object_type: "source_anchor",
    schema_version: 1,
    source_anchor_id: anchor.id,
    dossier_id: anchor.dossierId,
    document_id: anchor.documentId,
    document_version_id: anchor.documentVersionId,
    page_number: anchor.pageNumber,
    section: anchor.section,
    heading: anchor.heading,
    paragraph: anchor.paragraph,
    character_start: anchor.characterStart,
    character_end: anchor.characterEnd,
    excerpt: anchor.excerpt,
    anchor_checksum: anchor.anchorChecksum,
    extraction_version: anchor.extractionVersion,
    creator: anchor.creator,
    review_state: anchor.reviewState,
    reviewer_actor_id: anchor.reviewerActorRef,
    reviewed_at: anchor.reviewedAt,
    created_by: anchor.createdByActorRef,
    created_at: anchor.createdAt,
  };
}

function hasAny(payload: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((field) => field in payload);
}

function hasAmbiguousAliases(payload: Record<string, unknown>) {
  const aliases = [
    ["expectedRevision", "expected_revision"],
    ["documentId", "document_id"],
    ["documentVersionId", "document_version_id"],
    ["pageNumber", "page_number"],
    ["characterStart", "character_start"],
    ["characterEnd", "character_end"],
    ["extractionVersion", "extraction_version"],
    ["anchorId", "anchor_id"],
    ["sourceAnchorId", "source_anchor_id"],
  ];
  const anchorIdentityCount = ["anchorId", "anchor_id", "sourceAnchorId", "source_anchor_id"]
    .filter((field) => field in payload).length;
  return aliases.some(([camel, snake]) => camel in payload && snake in payload) || anchorIdentityCount > 1;
}

function revisionConflict(currentRevision: number) {
  return dossierJson({
    error: "The Matter changed before this source anchor could be saved.",
    code: "revision_conflict",
    currentRevision,
  }, 409);
}

function mutationConflict() {
  return dossierJson({
    error: "The Matter changed before this source-anchor mutation could be recorded.",
    code: "anchor_conflict",
  }, 409);
}

function outputStateLimit() {
  return dossierJson({
    error: "The Matter has too much output history to update safely.",
    code: "output_state_limit",
  }, 409);
}
