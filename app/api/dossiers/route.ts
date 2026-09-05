import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  dossierAIProposals,
  dossierOrganizationBindings,
  dossierAuditEvents,
  dossierDecisionPackageReferences,
  dossierDocuments,
  dossierGovernedOutputs,
  dossierInformationRequests,
  dossierOutputApprovals,
  dossierOutputStateEvents,
  dossierParticipants,
  dossierRevisionReceipts,
  dossierSnapshots,
  dossiers,
  users,
} from "../../../db/schema";
import {
  DOSSIER_STATUSES,
  DOSSIER_WIRE_ENUMS,
  type DossierRole,
} from "../../dossier-contract";
import { computeDossierReadiness, type DossierReadinessFinding } from "../../dossier-readiness";
import {
  boundedDossierText,
  canonicalDossierTimestamp,
  dossierEnum,
  dossierJson,
  dossierStringList,
  isResponse,
  newDossierOpaqueId,
  prepareDossierRevisionAuditBatch,
  resolveDossierServerContext,
} from "../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { organizationSelectionToken, assertOrganizationCurrent } from "../../organization-store";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit)) : 25;
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const statusParam = url.searchParams.get("status");
  const priorityParam = url.searchParams.get("priority");
  const cursorParam = url.searchParams.get("cursor");
  const scope = organizationSelectionToken(context.organization!);
  const cursor = cursorParam ? decodeCursor(cursorParam, scope) : null;
  if (cursorParam && !cursor) return dossierJson({ error: "The Matter cursor is invalid." }, 400);
  if (statusParam && !DOSSIER_STATUSES.includes(statusParam as never)) return dossierJson({ error: "The status filter is invalid." }, 400);
  if (priorityParam && !DOSSIER_WIRE_ENUMS.priority.includes(priorityParam as never)) return dossierJson({ error: "The priority filter is invalid." }, 400);

  const filters = [
    eq(dossierOrganizationBindings.organizationId, context.organization!.id),
    eq(dossierParticipants.userId, context.actor.userId),
    eq(dossierParticipants.actorId, context.actor.actorId),
    eq(dossierParticipants.status, "active"),
    query ? or(
      sql<boolean>`instr(lower(${dossiers.title}), lower(${query})) > 0`,
      sql<boolean>`instr(lower(${dossiers.reference}), lower(${query})) > 0`,
    )! : undefined,
    statusParam ? eq(dossiers.status, statusParam) : undefined,
    priorityParam ? eq(dossiers.priority, priorityParam) : undefined,
    cursor ? or(
      lt(dossiers.updatedAt, cursor.updatedAt),
      and(eq(dossiers.updatedAt, cursor.updatedAt), lt(dossiers.id, cursor.id)),
    )! : undefined,
  ].filter((filter) => filter !== undefined);

  const rows = await context.db.select({
    dossier: dossiers,
    role: dossierParticipants.role,
    documentCount: sql<number>`(select count(*) from ${dossierDocuments} where ${dossierDocuments.dossierId} = ${dossiers.id} and ${dossierDocuments.isProvisional} = false)`,
    openRequestCount: sql<number>`(select count(*) from ${dossierInformationRequests} where ${dossierInformationRequests.dossierId} = ${dossiers.id} and ${dossierInformationRequests.status} = 'open')`,
    overdueRequestCount: sql<number>`(select count(*) from ${dossierInformationRequests} where ${dossierInformationRequests.dossierId} = ${dossiers.id} and ${dossierInformationRequests.status} = 'open' and ${dossierInformationRequests.dueAt} < CURRENT_TIMESTAMP)`,
    pendingProposalCount: sql<number>`(select count(*) from ${dossierAIProposals} where ${dossierAIProposals.dossierId} = ${dossiers.id} and ${dossierAIProposals.reviewState} = 'pending')`,
    validPackageCount: sql<number>`(select count(*) from ${dossierDecisionPackageReferences} where ${dossierDecisionPackageReferences.dossierId} = ${dossiers.id} and ${dossierDecisionPackageReferences.state} = 'current' and ${dossierDecisionPackageReferences.graphValidationStatus} = 'valid')`,
    simulatedPackageCount: sql<number>`(select count(*) from ${dossierDecisionPackageReferences} where ${dossierDecisionPackageReferences.dossierId} = ${dossiers.id} and ${dossierDecisionPackageReferences.state} = 'current' and json_array_length(${dossierDecisionPackageReferences.simulationRunReferences}) > 0)`,
    currentOutputCount: sql<number>`(select count(*) from ${dossierGovernedOutputs} go join ${dossierSnapshots} ds on ds.dossier_id = go.dossier_id and ds.id = go.snapshot_id where go.dossier_id = ${dossiers.id} and ds.dossier_revision = ${dossiers.revision} and (select ose.state from ${dossierOutputStateEvents} ose where ose.dossier_id = go.dossier_id and ose.output_id = go.id order by ose.sequence desc limit 1) = 'current')`,
    approvedCurrentOutputCount: sql<number>`(select count(*) from ${dossierGovernedOutputs} go join ${dossierSnapshots} ds on ds.dossier_id = go.dossier_id and ds.id = go.snapshot_id where go.dossier_id = ${dossiers.id} and ds.dossier_revision = ${dossiers.revision} and (select ose.state from ${dossierOutputStateEvents} ose where ose.dossier_id = go.dossier_id and ose.output_id = go.id order by ose.sequence desc limit 1) = 'current' and exists (select 1 from ${dossierOutputApprovals} oa where oa.dossier_id = go.dossier_id and oa.output_id = go.id))`,
  }).from(dossiers).innerJoin(dossierOrganizationBindings, eq(dossierOrganizationBindings.dossierId, dossiers.id))
    .innerJoin(dossierParticipants, eq(dossierParticipants.dossierId, dossiers.id))
    .where(and(...filters)).orderBy(desc(dossiers.updatedAt), desc(dossiers.id)).limit(limit + 1);

  const page = rows.slice(0, limit);
  const ownerIds = [...new Set(page.map(({ dossier }) => dossier.ownerUserId))];
  const owners = ownerIds.length
    ? await context.db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, ownerIds))
    : [];
  const ownerName = new Map(owners.map((owner) => [owner.id, owner.displayName]));
  const evaluatedAt = canonicalDossierTimestamp();
  const items = page.map((row) => projectSummary(row, ownerName.get(row.dossier.ownerUserId) ?? "Assigned matter owner", evaluatedAt));
  const last = page.at(-1)?.dossier;
  try { await assertOrganizationCurrent(context.db, context.actor, context.organization!); }
  catch { return dossierJson({ error: "Organization access changed. Refresh your organizations." }, 404); }
  return dossierJson({
    dossiers: items,
    next_cursor: rows.length > limit && last ? encodeCursor(last.updatedAt, last.id, scope) : null,
    count: items.length,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return dossierJson({ error: "Cross-site Matter creation rejected." }, 403);
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  if (!context.organization || context.organization.role === "auditor") return dossierJson({ error: "Case creation is unavailable for this organization role." }, 403);
  const payload = await readJsonObject(request, 16_384);
  if (!payload) return dossierJson({ error: "A valid Matter object is required." }, 400);
  if (["ownerUserId", "ownerActorId", "owner_user_id", "owner_actor_id", "organisationId", "organisation_id", "tenantId", "tenant_id", "reference"].some((key) => key in payload)) {
    return dossierJson({ error: "Owner, tenant authority, and the Matter reference are resolved by the server." }, 400);
  }

  let values: typeof dossiers.$inferInsert;
  try {
    const now = canonicalDossierTimestamp();
    const id = newDossierOpaqueId("dossier");
    const title = boundedDossierText(payload.title, "Matter title", 2, 240);
    const keyDeadlineAt = payload.keyDeadlineAt == null || payload.keyDeadlineAt === "" ? null : canonicalInputTimestamp(payload.keyDeadlineAt, "key deadline");
    const keyDeadlineTimezone = keyDeadlineAt === null ? null : boundedDossierText(payload.keyDeadlineTimezone, "key deadline timezone", 1, 80);
    const jurisdictions = dossierStringList(payload.jurisdictions, "jurisdictions", 12, 100);
    if (jurisdictions.length === 0) throw new Error("At least one jurisdiction is required.");
    if (payload.status !== undefined && payload.status !== "draft") throw new Error("A Matter must begin in draft status.");
    values = {
      id,
      reference: generatedReference(now, id),
      title,
      dossierTypeRegistry: "genesis-juris-dossier-types",
      dossierTypeId: "general-matter",
      dossierTypeVersion: "1.0.0",
      terminology: payload.terminology === undefined ? "matter" : dossierEnum(payload.terminology, DOSSIER_WIRE_ENUMS.terminology, "terminology"),
      ownerUserId: context.actor.userId,
      ownerActorId: context.actor.actorId,
      organisationId: null,
      jurisdictions,
      classification: payload.classification === undefined ? "confidential" : dossierEnum(payload.classification, DOSSIER_WIRE_ENUMS.classification, "classification"),
      priority: payload.priority === undefined ? "normal" : dossierEnum(payload.priority, DOSSIER_WIRE_ENUMS.priority, "priority"),
      status: "draft",
      statusReason: null,
      keyDeadlineAt,
      keyDeadlineTimezone,
      revision: 1,
      createdByActorRef: context.actor.actorId,
      updatedByActorRef: context.actor.actorId,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    return dossierJson({ error: error instanceof Error ? error.message : "The Matter fields are invalid." }, 400);
  }

  const { revisionReceipt, auditEvents: [audit] } = await prepareDossierRevisionAuditBatch(context, values.id, 1, [{
    actorRole: "owner",
    eventType: "dossier_created",
    objectRefType: "dossier",
    objectRefId: values.id,
    summaryCode: "DOSSIER_CREATED",
    detail: { classification: values.classification, priority: values.priority, terminology: values.terminology },
    occurredAt: values.createdAt,
  }]);
  try {
    await context.db.batch([
      context.db.insert(dossierOrganizationBindings).values({ dossierId: values.id, organizationId: context.organization.id,
        createdByActorId: context.actor.actorId, createdAt: values.createdAt! }),
      context.db.insert(dossiers).values(values),
      context.db.insert(dossierAuditEvents).values(audit!),
      context.db.insert(dossierRevisionReceipts).values(revisionReceipt),
    ]);
  } catch {
    return dossierJson({ error: "The Matter could not be created." }, 409);
  }

  const createdAt = values.createdAt;
  if (typeof createdAt !== "string") return dossierJson({ error: "The Matter creation receipt is unavailable." }, 503);
  const readiness = computeDossierReadiness({
    dossierId: values.id,
    revision: 1,
    evaluatedAt: createdAt,
    findings: initialReadinessFindings(values.keyDeadlineAt ?? null),
  });
  return dossierJson({
    dossier: {
      ...projectDossier(values),
      owner_display_name: context.actor.displayName,
      current_role: "owner",
      permissions: permissions("owner"),
      readiness,
    },
  }, 201, { Location: `/api/dossiers/${values.id}` });
}

function projectSummary(
  row: {
    dossier: typeof dossiers.$inferSelect;
    role: string;
    documentCount: number;
    openRequestCount: number;
    overdueRequestCount: number;
    pendingProposalCount: number;
    validPackageCount: number;
    simulatedPackageCount: number;
    currentOutputCount: number;
    approvedCurrentOutputCount: number;
  },
  ownerDisplayName: string,
  evaluatedAt: string,
) {
  const findings: DossierReadinessFinding[] = [];
  const add = (code: DossierReadinessFinding["code"]) => findings.push({ code, relatedObjectType: null, relatedObjectId: null });
  if (Number(row.documentCount) === 0) add("DOCUMENT_REQUIRED_MISSING");
  if (Number(row.overdueRequestCount) > 0) add("INFORMATION_REQUEST_OVERDUE");
  else if (Number(row.openRequestCount) > 0) add("INFORMATION_REQUEST_OPEN");
  if (Number(row.pendingProposalCount) > 0) add("AI_PROPOSAL_PENDING");
  if (!row.dossier.keyDeadlineAt) add("CRITICAL_DEADLINE_MISSING");
  if (Number(row.validPackageCount) === 0) add("DECISION_GRAPH_INVALID");
  if (Number(row.simulatedPackageCount) === 0) add("SIMULATION_REQUIRED");
  if (Number(row.currentOutputCount) === 0) add("OUTPUT_REQUIRED");
  if (Number(row.approvedCurrentOutputCount) === 0) add("REVIEWER_APPROVAL_MISSING");
  const role = isRole(row.role) ? row.role : "viewer";
  return {
    ...projectDossier(row.dossier),
    owner_display_name: ownerDisplayName,
    document_count: Number(row.documentCount),
    current_role: role,
    permissions: permissions(role),
    readiness: computeDossierReadiness({
      dossierId: row.dossier.id,
      revision: row.dossier.revision,
      evaluatedAt,
      findings,
    }),
  };
}

function projectDossier(value: typeof dossiers.$inferSelect | typeof dossiers.$inferInsert) {
  return {
    schema_version: 1,
    dossier_id: value.id,
    reference: value.reference,
    title: value.title,
    dossier_type: { registry: value.dossierTypeRegistry, id: value.dossierTypeId, version: value.dossierTypeVersion },
    terminology: value.terminology,
    owner_actor_id: value.ownerActorId,
    jurisdictions: value.jurisdictions,
    classification: value.classification,
    priority: value.priority,
    status: value.status,
    status_reason: value.statusReason,
    key_deadline_at: value.keyDeadlineAt,
    key_deadline_timezone: value.keyDeadlineTimezone,
    revision: value.revision,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

function permissions(role: DossierRole) {
  return {
    role,
    can_manage_participants: role === "owner",
    can_write: role === "owner" || role === "contributor",
    can_review: role !== "viewer",
    can_transition: role !== "viewer",
    can_generate_output: role !== "viewer",
    can_approve: role === "reviewer",
  };
}

function initialReadinessFindings(keyDeadlineAt: string | null): DossierReadinessFinding[] {
  return [
    { code: "DOCUMENT_REQUIRED_MISSING", relatedObjectType: null, relatedObjectId: null },
    ...(keyDeadlineAt ? [] : [{ code: "CRITICAL_DEADLINE_MISSING" as const, relatedObjectType: null, relatedObjectId: null }]),
    { code: "DECISION_GRAPH_INVALID", relatedObjectType: null, relatedObjectId: null },
    { code: "SIMULATION_REQUIRED", relatedObjectType: null, relatedObjectId: null },
    { code: "OUTPUT_REQUIRED", relatedObjectType: null, relatedObjectId: null },
    { code: "REVIEWER_APPROVAL_MISSING", relatedObjectType: null, relatedObjectId: null },
  ];
}

function generatedReference(now: string, id: string) {
  return `MAT-${now.slice(0, 10).replaceAll("-", "")}-${id.slice(-16).toUpperCase()}`;
}

function canonicalInputTimestamp(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`${label} is invalid.`);
  return new Date(epoch).toISOString();
}

function encodeCursor(updatedAt: string, id: string, scope: string) {
  return encodeURIComponent(`${updatedAt}|${id}|${scope}`);
}

function decodeCursor(value: string, scope: string) {
  try {
    const [updatedAt, id, cursorScope, ...rest] = decodeURIComponent(value).split("|");
    if (cursorScope !== scope || rest.length || !updatedAt || !id || new Date(updatedAt).toISOString() !== updatedAt || !/^dossier_[a-f0-9]{32}$/u.test(id)) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

function isRole(value: unknown): value is DossierRole {
  return value === "owner" || value === "contributor" || value === "reviewer" || value === "viewer";
}
