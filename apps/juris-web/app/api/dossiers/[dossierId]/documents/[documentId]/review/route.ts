import { and, eq } from "drizzle-orm";
import {
  dossierAuditEvents,
  dossierDocumentCurrentVersions,
  dossierDocuments,
  dossierRevisionReceipts,
  dossiers,
} from "../../../../../../../db/schema";
import {
  evidenceOutputAuditInputs,
  evidenceOutputStateStatements,
  loadCurrentEvidenceOutputs,
} from "../../../../../../dossier-evidence-server";
import { computeStoredDossierReadiness } from "../../../../../../dossier-readiness-server";
import { parseDossierOpaqueId } from "../../../../../../dossier-security";
import {
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
  dossierNotFound,
  expectedDossierRevision,
  isResponse,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ dossierId: string; documentId: string }>;
};

const DOCUMENT_REVIEW_DECISIONS = ["accepted_source", "rejected"] as const;
const ALLOWED_FIELDS = new Set([
  "decision",
  "expectedRevision",
  "expected_revision",
]);

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site document review rejected." }, 403);
  }
  const context = await resolveDossierServerContext();
  if (isResponse(context)) return context;
  const routeIds = await routeContext.params;
  const access = await requireDossierAccess(context, routeIds.dossierId, "documents");
  if (isResponse(access)) return access;

  let documentId: string;
  try {
    documentId = parseDossierOpaqueId(routeIds.documentId, "document ID");
  } catch {
    return dossierNotFound();
  }
  const payload = await readJsonObject(request, 8_192);
  if (!payload) return dossierJson({ error: "A valid document review is required." }, 400);
  if (Object.keys(payload).some((key) => !ALLOWED_FIELDS.has(key))) {
    return dossierJson({ error: "The document review contains a protected or unknown field." }, 400);
  }
  if ("expectedRevision" in payload && "expected_revision" in payload) {
    return dossierJson({ error: "The document review contains an ambiguous revision." }, 400);
  }

  let decision: (typeof DOCUMENT_REVIEW_DECISIONS)[number];
  let expectedRevision: number;
  try {
    decision = dossierEnum(payload.decision, DOCUMENT_REVIEW_DECISIONS, "document review decision");
    expectedRevision = expectedDossierRevision(payload.expectedRevision ?? payload.expected_revision);
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The document review is invalid.",
    }, 400);
  }
  if (expectedRevision !== access.dossier.revision) {
    return revisionConflict(access.dossier.revision);
  }

  const [stored] = await context.db.select({
    id: dossierDocuments.id,
    title: dossierDocuments.title,
    documentType: dossierDocuments.documentType,
    classification: dossierDocuments.classification,
    status: dossierDocuments.status,
    currentVersionId: dossierDocumentCurrentVersions.documentVersionId,
  }).from(dossierDocuments).innerJoin(dossierDocumentCurrentVersions, and(
    eq(dossierDocumentCurrentVersions.dossierId, dossierDocuments.dossierId),
    eq(dossierDocumentCurrentVersions.documentId, dossierDocuments.id),
  )).where(and(
    eq(dossierDocuments.dossierId, access.dossier.id),
    eq(dossierDocuments.id, documentId),
    eq(dossierDocuments.isProvisional, false),
  )).limit(1);
  if (!stored) return dossierNotFound();
  if (stored.status !== "received" && stored.status !== "under_review") {
    return dossierJson({
      error: "The document is no longer pending professional review.",
      code: "document_not_reviewable",
    }, 409);
  }

  const outputStates = await loadCurrentEvidenceOutputs(context, access.dossier.id);
  if (!outputStates.ok) {
    return dossierJson({
      error: "The Matter has too many current outputs to update safely.",
      code: "output_state_limit",
    }, 409);
  }
  const now = canonicalDossierTimestamp();
  const nextRevision = expectedRevision + 1;
  const { revisionReceipt, auditEvents } = await prepareDossierRevisionAuditBatch(
    context,
    access.dossier.id,
    nextRevision,
    [{
      actorRole: access.role,
      eventType: "dossier_updated",
      objectRefType: "document",
      objectRefId: stored.id,
      summaryCode: decision === "accepted_source"
        ? "DOCUMENT_ACCEPTED_SOURCE"
        : "DOCUMENT_REJECTED",
      detail: {
        action: "review",
        previous_status: stored.status,
        status: decision,
        current_version_id: stored.currentVersionId,
        revision_before: expectedRevision,
        revision_after: nextRevision,
      },
      occurredAt: now,
    }, ...evidenceOutputAuditInputs(
      outputStates.current,
      access.role,
      "DOCUMENT_REVIEW_CHANGED",
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
      }).where(and(
        eq(dossiers.id, access.dossier.id),
        eq(dossiers.revision, expectedRevision),
      )),
      context.db.update(dossierDocuments).set({
        status: decision,
        updatedAt: now,
        updatedByActorRef: context.actor.actorId,
      }).where(and(
        eq(dossierDocuments.dossierId, access.dossier.id),
        eq(dossierDocuments.id, stored.id),
        eq(dossierDocuments.status, stored.status),
        eq(dossierDocuments.isProvisional, false),
      )),
      ...evidenceOutputStateStatements(
        context,
        access.dossier.id,
        outputStates.current,
        "DOCUMENT_REVIEW_CHANGED",
        now,
      ),
      ...auditEvents.map((event) => context.db.insert(dossierAuditEvents).values(event)),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return dossierJson({
      error: "The document review conflicted with a newer Matter revision.",
      code: "revision_conflict",
    }, 409);
  }

  const readiness = await computeStoredDossierReadiness({
    db: context.db,
    dossierId: access.dossier.id,
    dossierRevision: nextRevision,
    keyDeadlineAt: access.dossier.keyDeadlineAt,
    evaluatedAt: canonicalDossierTimestamp(),
  });
  return dossierJson({
    document: {
      schema_version: 1,
      document_id: stored.id,
      title: stored.title,
      document_type: stored.documentType,
      classification: stored.classification,
      status: decision,
      current_version_id: stored.currentVersionId,
      updated_at: now,
      updated_by: context.actor.actorId,
    },
    dossier: {
      dossier_id: access.dossier.id,
      revision: nextRevision,
      readiness,
    },
    audit_event_id: auditEvents[0]!.id,
    contract_version: "1.0.0",
  });
}

function revisionConflict(currentRevision: number) {
  return dossierJson({
    error: "The Matter changed before this document review could be recorded.",
    code: "revision_conflict",
    current_revision: currentRevision,
  }, 409);
}
