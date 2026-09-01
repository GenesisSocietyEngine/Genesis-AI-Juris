export const MATTER_DESTINATIONS = [
  { key: "overview", label: "Overview", shortLabel: "Overview" },
  { key: "documents", label: "Documents", shortLabel: "Documents" },
  { key: "evidence", label: "Evidence", shortLabel: "Evidence" },
  { key: "decision-packages", label: "Decision packages", shortLabel: "Packages" },
  { key: "requests", label: "Requests & deadlines", shortLabel: "Requests" },
  { key: "outputs", label: "Outputs & approvals", shortLabel: "Outputs" },
  { key: "activity", label: "Activity", shortLabel: "Activity" },
] as const;

export type MatterDestination = (typeof MATTER_DESTINATIONS)[number]["key"];
export type MatterView = "user" | "developer";
export type MatterRole = "owner" | "contributor" | "reviewer" | "viewer";
export type MatterStatus =
  | "draft"
  | "intake_review"
  | "active"
  | "awaiting_input"
  | "internal_review"
  | "output_approved"
  | "closed"
  | "archived"
  | "declined"
  | "cancelled";

export type ApiIssueKind = "error" | "permission" | "stale" | "unsupported";

export interface ApiIssue {
  kind: ApiIssueKind;
  title: string;
  message: string;
  detail: string | null;
}

export interface ReadinessReason {
  code: string;
  explanation: string;
  deepLink: string | null;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
}

export interface ReadinessDimension {
  dimension: string;
  state: "ready" | "blocked" | "not_applicable";
  reasons: ReadinessReason[];
}

export interface MatterReadiness {
  ready: boolean;
  computedFromRevision: number | null;
  evaluatedAt: string | null;
  dimensions: ReadinessDimension[];
}

export interface MatterPermissions {
  role: MatterRole;
  canManageParticipants: boolean;
  canWrite: boolean;
  canReview: boolean;
  canTransition: boolean;
  canGenerateOutput: boolean;
  canApprove: boolean;
}

export interface MatterSummary {
  id: string;
  reference: string;
  title: string;
  typeLabel: string;
  jurisdictions: string[];
  status: MatterStatus;
  ownerName: string;
  ownerActorId: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  classification: string;
  keyDeadlineAt: string | null;
  keyDeadlineTimezone: string | null;
  revision: number;
  updatedAt: string | null;
  readiness: MatterReadiness;
  permissions: MatterPermissions;
}

export interface ParticipantItem {
  id: string;
  actorId: string;
  displayName: string;
  role: MatterRole;
  status: "active" | "removed";
}

export interface SourceAnchorItem {
  id: string;
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  versionOrdinal: number | null;
  pageNumber: number | null;
  section: string | null;
  heading: string | null;
  paragraph: string | null;
  excerpt: string | null;
  reviewState: string;
  checksum: string | null;
}

export interface AssertionItem {
  id: string;
  type: string;
  statement: string;
  status: string;
  sourceAnchorIds: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface MatterDetail extends MatterSummary {
  statusReason: string | null;
  createdAt: string | null;
  createdBy: string | null;
  dossierTypeRegistry: string | null;
  dossierTypeId: string | null;
  dossierTypeVersion: string | null;
  participants: ParticipantItem[];
  anchors: SourceAnchorItem[];
  assertions: AssertionItem[];
  rawSchemaVersion: number | null;
  contractVersion: string | null;
  buildVersion: string | null;
}

export interface DocumentVersionItem {
  id: string;
  ordinal: number;
  originalFilename: string;
  mediaType: string;
  byteLength: number;
  contentSha256: string | null;
  extractionStatus: string;
  extractionErrorCode: string | null;
  uploadedAt: string | null;
  uploaderActorId: string | null;
  predecessorVersionId: string | null;
  sourceNote: string | null;
  downloadUrl: string | null;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: string;
  status: string;
  classification: string;
  currentVersionId: string;
  tags: string[];
  updatedAt: string | null;
  versions: DocumentVersionItem[];
}

export interface ProposalItem {
  id: string;
  type: string;
  proposedValue: string;
  reviewState: string;
  confidenceCategory: string | null;
  confidenceScore: number | null;
  provider: string | null;
  model: string | null;
  sourceAnchorIds: string[];
  destinationType: string | null;
  destinationId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

export interface RequestItem {
  id: string;
  question: string;
  ownerActorId: string | null;
  requestedFrom: string | null;
  priority: string;
  dueAt: string | null;
  timezone: string | null;
  status: string;
  reason: string;
  readinessReasonCode: string | null;
}

export interface DeadlineItem {
  id: string;
  kind: string;
  title: string;
  dueAt: string | null;
  timezone: string | null;
  critical: boolean;
  status: string;
  sourceAnchorIds: string[];
}

export interface DecisionPackageItem {
  id: string;
  packageId: string;
  packageVersion: string;
  packageFingerprint: string | null;
  sourceSnapshotId: string | null;
  sourceRevision: number | null;
  state: string;
  graphValidationStatus: string;
  graphDigest: string | null;
  approvalState: string;
  updatedAt: string | null;
}

export interface SnapshotItem {
  id: string;
  dossierRevision: number | null;
  status: string;
  manifestDigest: string | null;
  locale: string;
  audience: string;
  classification: string;
  createdAt: string | null;
  createdBy: string | null;
}

export interface OutputItem {
  id: string;
  snapshotId: string;
  snapshotDigest: string | null;
  format: string;
  filename: string;
  state: string;
  contentSha256: string | null;
  reviewerActorId: string | null;
  approvedAt: string | null;
  staleReason: string | null;
  createdAt: string | null;
  downloadUrl: string | null;
}

export interface ActivityItem {
  id: string;
  sequence: number | null;
  eventType: string;
  summaryCode: string;
  actorId: string | null;
  actorRole: string | null;
  occurredAt: string | null;
  objectType: string | null;
  objectId: string | null;
  eventDigest: string | null;
  detail: string | null;
}

type UnknownRecord = Record<string, unknown>;

const EMPTY_READINESS: MatterReadiness = {
  ready: false,
  computedFromRevision: null,
  evaluatedAt: null,
  dimensions: [],
};

const STATUS_VALUES = new Set<MatterStatus>([
  "draft", "intake_review", "active", "awaiting_input", "internal_review",
  "output_approved", "closed", "archived", "declined", "cancelled",
]);
const ROLE_VALUES = new Set<MatterRole>(["owner", "contributor", "reviewer", "viewer"]);
const PRIORITY_VALUES = new Set(["low", "normal", "high", "urgent"] as const);

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function firstRecord(value: unknown, keys: readonly string[]): UnknownRecord {
  const outer = record(value);
  for (const key of keys) {
    const candidate = record(outer[key]);
    if (Object.keys(candidate).length > 0) return candidate;
  }
  const data = record(outer.data);
  for (const key of keys) {
    const candidate = record(data[key]);
    if (Object.keys(candidate).length > 0) return candidate;
  }
  return Object.keys(data).length > 0 ? data : outer;
}

function valueAt(source: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function textValue(source: UnknownRecord, keys: readonly string[], fallback = ""): string {
  const value = valueAt(source, ...keys);
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function nullableText(source: UnknownRecord, keys: readonly string[]): string | null {
  const value = textValue(source, keys);
  return value || null;
}

function numberValue(source: UnknownRecord, keys: readonly string[], fallback = 0): number {
  const value = valueAt(source, ...keys);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(source: UnknownRecord, keys: readonly string[], fallback: boolean): boolean {
  const value = valueAt(source, ...keys);
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(source: UnknownRecord, keys: readonly string[], limit = 100): string[] {
  const value = valueAt(source, ...keys);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, limit);
}

function recordsFrom(value: unknown, keys: readonly string[], limit: number): UnknownRecord[] {
  const outer = record(value);
  const data = record(outer.data);
  for (const source of [outer, data]) {
    for (const key of keys) {
      if (Array.isArray(source[key])) return (source[key] as unknown[]).slice(0, limit).map(record);
    }
  }
  if (Array.isArray(value)) return value.slice(0, limit).map(record);
  return [];
}

function knownStatus(value: string): MatterStatus {
  return STATUS_VALUES.has(value as MatterStatus) ? value as MatterStatus : "draft";
}

function knownRole(value: string): MatterRole {
  return ROLE_VALUES.has(value as MatterRole) ? value as MatterRole : "viewer";
}

function readinessFrom(source: UnknownRecord): MatterReadiness {
  const readiness = record(valueAt(source, "readiness", "readiness_summary"));
  if (Object.keys(readiness).length === 0) return { ...EMPTY_READINESS };
  const dimensions = recordsFrom(readiness, ["dimensions"], 10).map((dimension) => {
    const stateValue = textValue(dimension, ["state"], "blocked");
    const state = stateValue === "ready" || stateValue === "not_applicable" ? stateValue : "blocked";
    const reasons = recordsFrom(dimension, ["reasons", "findings"], 100).map((reason) => ({
      code: textValue(reason, ["code"], "READINESS_ATTENTION_REQUIRED"),
      explanation: boundedText(textValue(reason, ["explanation", "message"], "Professional review is required."), 500),
      deepLink: safeMatterLink(nullableText(reason, ["deep_link", "deepLink"])),
      relatedObjectType: nullableText(reason, ["related_object_type", "relatedObjectType"]),
      relatedObjectId: nullableText(reason, ["related_object_id", "relatedObjectId"]),
    }));
    return {
      dimension: textValue(dimension, ["dimension", "name"], "readiness"),
      state,
      reasons,
    } satisfies ReadinessDimension;
  });
  const explicitReady = valueAt(readiness, "ready");
  return {
    ready: typeof explicitReady === "boolean" ? explicitReady : dimensions.length > 0 && dimensions.every((item) => item.state !== "blocked"),
    computedFromRevision: nullableInteger(valueAt(readiness, "computed_from_revision", "computedFromRevision")),
    evaluatedAt: nullableText(readiness, ["evaluated_at", "evaluatedAt"]),
    dimensions,
  };
}

function permissionsFrom(source: UnknownRecord): MatterPermissions {
  const permissionSource = record(valueAt(source, "permissions", "authorization"));
  const participant = record(valueAt(source, "current_participant", "currentParticipant"));
  const role = knownRole(
    textValue(permissionSource, ["role"], textValue(participant, ["role"], textValue(source, ["current_role", "currentRole", "role"], "viewer"))),
  );
  const canWriteByRole = role === "owner" || role === "contributor";
  const canReviewByRole = role === "owner" || role === "reviewer";
  return {
    role,
    canManageParticipants: booleanValue(
      permissionSource,
      ["can_manage_participants", "canManageParticipants"],
      role === "owner",
    ),
    canWrite: booleanValue(permissionSource, ["can_write", "canWrite", "write"], canWriteByRole),
    canReview: booleanValue(permissionSource, ["can_review", "canReview", "review"], canReviewByRole),
    canTransition: booleanValue(permissionSource, ["can_transition", "canTransition", "transition"], role !== "viewer"),
    canGenerateOutput: booleanValue(permissionSource, ["can_generate_output", "canGenerateOutput", "generateOutput"], canReviewByRole),
    canApprove: booleanValue(permissionSource, ["can_approve", "canApprove", "approve"], role === "reviewer"),
  };
}

function normalizeSummary(source: UnknownRecord): MatterSummary | null {
  const id = textValue(source, ["dossier_id", "dossierId", "id"]);
  if (!id) return null;
  const typeSource = record(valueAt(source, "dossier_type", "dossierType", "type"));
  const ownerSource = record(valueAt(source, "owner", "owner_participant", "ownerParticipant"));
  const deadlineSource = record(valueAt(source, "key_deadline", "keyDeadline"));
  const priorityValue = textValue(source, ["priority"], "normal");
  const ownerActorId = nullableText(source, ["owner_actor_id", "ownerActorId"])
    ?? nullableText(ownerSource, ["actor_id", "actorId", "id"]);
  return {
    id,
    reference: textValue(source, ["reference", "matter_reference", "matterReference"], "Unreferenced matter"),
    title: boundedText(textValue(source, ["title", "name"], "Untitled matter"), 500),
    typeLabel: textValue(typeSource, ["label", "name", "id"], textValue(source, ["type_label", "typeLabel"], "Professional matter")),
    jurisdictions: stringArray(source, ["jurisdictions", "jurisdiction"], 20),
    status: knownStatus(textValue(source, ["status"], "draft")),
    ownerName: boundedText(
      textValue(source, ["owner_display_name", "ownerDisplayName"], textValue(ownerSource, ["display_name", "displayName", "name"], "Assigned matter owner")),
      200,
    ),
    ownerActorId,
    priority: PRIORITY_VALUES.has(priorityValue as "low") ? priorityValue as MatterSummary["priority"] : "normal",
    classification: textValue(source, ["classification"], "confidential"),
    keyDeadlineAt: nullableText(deadlineSource, ["at", "due_at", "dueAt"])
      ?? nullableText(source, ["key_deadline_at", "keyDeadlineAt"]),
    keyDeadlineTimezone: nullableText(deadlineSource, ["timezone"])
      ?? nullableText(source, ["key_deadline_timezone", "keyDeadlineTimezone"]),
    revision: Math.max(0, Math.trunc(numberValue(source, ["revision", "dossier_revision", "dossierRevision"], 0))),
    updatedAt: nullableText(source, ["updated_at", "updatedAt"]),
    readiness: readinessFrom(source),
    permissions: permissionsFrom(source),
  };
}

export function normalizeMatterList(payload: unknown): MatterSummary[] {
  return recordsFrom(payload, ["dossiers", "matters", "items", "results"], 200)
    .map(normalizeSummary)
    .filter((item): item is MatterSummary => item !== null);
}

export function normalizeMatterDetail(payload: unknown): MatterDetail | null {
  const source = firstRecord(payload, ["dossier", "matter"]);
  const base = normalizeSummary(source);
  if (!base) return null;
  const participants = recordsFrom(source, ["participants"], 100).map((participant) => ({
    id: textValue(participant, ["participant_id", "participantId", "id"]),
    actorId: textValue(participant, ["actor_id", "actorId"]),
    displayName: boundedText(textValue(participant, ["display_name", "displayName", "name"], "Matter participant"), 200),
    role: knownRole(textValue(participant, ["role"], "viewer")),
    status: textValue(participant, ["status"], "active") === "removed" ? "removed" as const : "active" as const,
  })).filter((participant) => participant.id);
  const typeSource = record(valueAt(source, "dossier_type", "dossierType"));
  const anchors = normalizeAnchors(source);
  const ownerParticipant = participants.find((participant) => participant.actorId === base.ownerActorId && participant.status === "active");
  return {
    ...base,
    ownerName: ownerParticipant?.displayName ?? base.ownerName,
    statusReason: nullableText(source, ["status_reason", "statusReason"]),
    createdAt: nullableText(source, ["created_at", "createdAt"]),
    createdBy: nullableText(source, ["created_by", "createdBy"]),
    dossierTypeRegistry: nullableText(typeSource, ["registry"]),
    dossierTypeId: nullableText(typeSource, ["id"]),
    dossierTypeVersion: nullableText(typeSource, ["version"]),
    participants,
    anchors,
    assertions: normalizeAssertions(source),
    rawSchemaVersion: nullableInteger(valueAt(source, "schema_version", "schemaVersion")),
    contractVersion: nullableText(record(payload), ["contract_version", "contractVersion"])
      ?? nullableText(source, ["contract_version", "contractVersion"]),
    buildVersion: nullableText(record(payload), ["build_version", "buildVersion"])
      ?? nullableText(source, ["build_version", "buildVersion"]),
  };
}

function normalizeAnchors(payload: unknown): SourceAnchorItem[] {
  return recordsFrom(payload, ["source_anchors", "sourceAnchors", "anchors"], 1_000).map((anchor) => ({
    id: textValue(anchor, ["source_anchor_id", "sourceAnchorId", "id"]),
    documentId: textValue(anchor, ["document_id", "documentId"]),
    documentVersionId: textValue(anchor, ["document_version_id", "documentVersionId"]),
    documentTitle: boundedText(textValue(anchor, ["document_title", "documentTitle"], "Source document"), 300),
    versionOrdinal: nullableInteger(valueAt(anchor, "version_ordinal", "versionOrdinal")),
    pageNumber: nullableInteger(valueAt(anchor, "page_number", "pageNumber")),
    section: nullableText(anchor, ["section"]),
    heading: nullableText(anchor, ["heading"]),
    paragraph: nullableText(anchor, ["paragraph"]),
    excerpt: nullableText(anchor, ["excerpt"]) ? boundedText(textValue(anchor, ["excerpt"]), 1_200) : null,
    reviewState: textValue(anchor, ["review_state", "reviewState"], "pending"),
    checksum: nullableText(anchor, ["anchor_checksum", "anchorChecksum", "checksum"]),
  })).filter((anchor) => anchor.id);
}

function normalizeAssertions(payload: unknown): AssertionItem[] {
  return recordsFrom(payload, ["professional_assertions", "professionalAssertions", "assertions"], 1_000).map((assertion) => ({
    id: textValue(assertion, ["assertion_id", "assertionId", "id"]),
    type: textValue(assertion, ["assertion_type", "assertionType", "type"], "fact"),
    statement: boundedText(textValue(assertion, ["statement", "title"], "Untitled professional assertion"), 1_200),
    status: textValue(assertion, ["status"], "needs_review"),
    sourceAnchorIds: stringArray(assertion, ["source_anchor_ids", "sourceAnchorIds"], 100),
    reviewedBy: nullableText(assertion, ["reviewed_by", "reviewedBy"]),
    reviewedAt: nullableText(assertion, ["reviewed_at", "reviewedAt"]),
  })).filter((assertion) => assertion.id);
}

export function normalizeDocuments(payload: unknown): DocumentItem[] {
  const versions = recordsFrom(payload, ["document_versions", "documentVersions", "versions"], 1_000);
  return recordsFrom(payload, ["documents", "items"], 100).map((document) => {
    const id = textValue(document, ["document_id", "documentId", "id"]);
    const nestedVersions = recordsFrom(document, ["versions", "document_versions", "documentVersions"], 50);
    const relatedVersions = nestedVersions.length > 0
      ? nestedVersions
      : versions.filter((version) => textValue(version, ["document_id", "documentId"]) === id);
    return {
      id,
      title: boundedText(textValue(document, ["title", "name"], "Untitled document"), 500),
      type: textValue(document, ["document_type", "documentType", "type"], "source_document"),
      status: textValue(document, ["status"], "received"),
      classification: textValue(document, ["classification"], "confidential"),
      currentVersionId: textValue(document, ["current_version_id", "currentVersionId"]),
      tags: stringArray(document, ["tags"], 50),
      updatedAt: nullableText(document, ["updated_at", "updatedAt"]),
      versions: relatedVersions.map(normalizeDocumentVersion).filter((version) => version.id).sort((left, right) => right.ordinal - left.ordinal),
    };
  }).filter((document) => document.id);
}

function normalizeDocumentVersion(version: UnknownRecord): DocumentVersionItem {
  return {
    id: textValue(version, ["document_version_id", "documentVersionId", "id"]),
    ordinal: Math.max(0, Math.trunc(numberValue(version, ["ordinal", "version"], 0))),
    originalFilename: boundedText(textValue(version, ["original_filename", "originalFilename", "filename"], "Unnamed file"), 500),
    mediaType: textValue(version, ["media_type", "mediaType"], "application/octet-stream"),
    byteLength: Math.max(0, Math.trunc(numberValue(version, ["byte_length", "byteLength", "size"], 0))),
    contentSha256: nullableText(version, ["content_sha256", "contentSha256", "sha256"]),
    extractionStatus: textValue(version, ["extraction_status", "extractionStatus"], "queued"),
    extractionErrorCode: nullableText(version, ["extraction_error_code", "extractionErrorCode"]),
    uploadedAt: nullableText(version, ["uploaded_at", "uploadedAt", "created_at", "createdAt"]),
    uploaderActorId: nullableText(version, ["uploader_actor_id", "uploaderActorId", "created_by", "createdBy"]),
    predecessorVersionId: nullableText(version, ["predecessor_version_id", "predecessorVersionId"]),
    sourceNote: nullableText(version, ["source_note", "sourceNote"]),
    downloadUrl: safeApiUrl(nullableText(version, ["download_url", "downloadUrl"])),
  };
}

export function normalizeProposals(payload: unknown): ProposalItem[] {
  return recordsFrom(payload, ["proposals", "ai_proposals", "aiProposals", "items"], 100).map((proposal) => {
    const confidence = record(valueAt(proposal, "confidence"));
    const provenance = record(valueAt(proposal, "model_provenance", "modelProvenance", "provenance"));
    return {
      id: textValue(proposal, ["proposal_id", "proposalId", "id"]),
      type: textValue(proposal, ["proposal_type", "proposalType", "type"], "professional_change"),
      proposedValue: boundedJson(valueAt(proposal, "proposed_value", "proposedValue", "value"), 1_500),
      reviewState: textValue(proposal, ["review_state", "reviewState", "status"], "pending"),
      confidenceCategory: nullableText(confidence, ["category"]),
      confidenceScore: nullableNumber(valueAt(confidence, "score")),
      provider: nullableText(provenance, ["provider"]),
      model: nullableText(provenance, ["model"]),
      sourceAnchorIds: stringArray(proposal, ["source_anchor_ids", "sourceAnchorIds"], 100),
      destinationType: nullableText(proposal, ["accepted_object_type", "acceptedObjectType", "destination_type", "destinationType"]),
      destinationId: nullableText(proposal, ["accepted_object_id", "acceptedObjectId", "destination_id", "destinationId"]),
      reviewNote: nullableText(proposal, ["review_note", "reviewNote"]),
      reviewedAt: nullableText(proposal, ["reviewed_at", "reviewedAt"]),
      createdAt: nullableText(proposal, ["created_at", "createdAt"]),
    };
  }).filter((proposal) => proposal.id);
}

export function normalizeRequests(payload: unknown): { requests: RequestItem[]; deadlines: DeadlineItem[] } {
  const requests = recordsFrom(payload, ["requests", "information_requests", "informationRequests", "items"], 1_000).map((request) => ({
    id: textValue(request, ["information_request_id", "informationRequestId", "request_id", "requestId", "id"]),
    question: boundedText(textValue(request, ["question", "requested_item", "requestedItem", "title"], "Information requested"), 1_000),
    ownerActorId: nullableText(request, ["owner_actor_id", "ownerActorId"]),
    requestedFrom: nullableText(request, ["requested_from_display_name", "requestedFromDisplayName", "requested_from_participant_id", "requestedFromParticipantId"]),
    priority: textValue(request, ["priority"], "normal"),
    dueAt: nullableText(request, ["due_at", "dueAt"]),
    timezone: nullableText(request, ["timezone"]),
    status: textValue(request, ["status"], "open"),
    reason: boundedText(textValue(request, ["reason"], "Needed for professional review."), 800),
    readinessReasonCode: nullableText(request, ["readiness_reason_code", "readinessReasonCode"]),
  })).filter((request) => request.id);
  const deadlines = recordsFrom(payload, ["deadlines", "deadline_references", "deadlineReferences"], 1_000).map((deadline) => ({
    id: textValue(deadline, ["deadline_reference_id", "deadlineReferenceId", "id"]),
    kind: textValue(deadline, ["deadline_kind", "deadlineKind", "kind"], "workspace"),
    title: boundedText(textValue(deadline, ["title", "name"], "Matter deadline"), 500),
    dueAt: nullableText(deadline, ["due_at", "dueAt"]),
    timezone: nullableText(deadline, ["timezone"]),
    critical: booleanValue(deadline, ["critical"], false),
    status: textValue(deadline, ["status"], "open"),
    sourceAnchorIds: stringArray(deadline, ["source_anchor_ids", "sourceAnchorIds"], 100),
  })).filter((deadline) => deadline.id);
  return { requests, deadlines };
}

export function normalizePackages(payload: unknown): DecisionPackageItem[] {
  return recordsFrom(payload, ["decision_packages", "decisionPackages", "packages", "items"], 500).map((item) => ({
    id: textValue(item, ["decision_package_reference_id", "decisionPackageReferenceId", "id"]),
    packageId: textValue(item, ["package_id", "packageId"], "Unidentified package"),
    packageVersion: textValue(item, ["package_version", "packageVersion", "version"], "unversioned"),
    packageFingerprint: nullableText(item, ["package_fingerprint", "packageFingerprint"]),
    sourceSnapshotId: nullableText(item, ["source_snapshot_id", "sourceSnapshotId"]),
    sourceRevision: nullableInteger(valueAt(item, "source_dossier_revision", "sourceDossierRevision", "sourceRevision")),
    state: textValue(item, ["state"], "stale"),
    graphValidationStatus: textValue(item, ["graph_validation_status", "graphValidationStatus"], "not_run"),
    graphDigest: nullableText(item, ["graph_digest", "graphDigest"]),
    approvalState: textValue(item, ["approval_state", "approvalState"], "draft"),
    updatedAt: nullableText(item, ["updated_at", "updatedAt"]),
  })).filter((item) => item.id);
}

export function normalizeSnapshots(payload: unknown): SnapshotItem[] {
  return recordsFrom(payload, ["snapshots", "items"], 500).map((item) => ({
    id: textValue(item, ["snapshot_id", "snapshotId", "id"]),
    dossierRevision: nullableInteger(valueAt(item, "dossier_revision", "dossierRevision")),
    status: textValue(item, ["status"], "draft"),
    manifestDigest: nullableText(item, ["manifest_digest", "manifestDigest"]),
    locale: textValue(item, ["locale"], "en"),
    audience: textValue(item, ["audience"], "internal"),
    classification: textValue(item, ["classification"], "confidential"),
    createdAt: nullableText(item, ["created_at", "createdAt"]),
    createdBy: nullableText(item, ["created_by", "createdBy"]),
  })).filter((item) => item.id);
}

export function normalizeOutputs(payload: unknown): OutputItem[] {
  return recordsFrom(payload, ["outputs", "governed_outputs", "governedOutputs", "items"], 500).map((item) => ({
    id: textValue(item, ["output_id", "outputId", "id"]),
    snapshotId: textValue(item, ["snapshot_id", "snapshotId"]),
    snapshotDigest: nullableText(item, ["snapshot_digest", "snapshotDigest"]),
    format: textValue(item, ["format"], "pdf"),
    filename: boundedText(textValue(item, ["filename"], "Governed matter output"), 500),
    state: textValue(item, ["state"], "stale"),
    contentSha256: nullableText(item, ["content_sha256", "contentSha256"]),
    reviewerActorId: nullableText(item, ["reviewer_actor_id", "reviewerActorId"]),
    approvedAt: nullableText(item, ["approved_at", "approvedAt"]),
    staleReason: nullableText(item, ["stale_reason", "staleReason"]),
    createdAt: nullableText(item, ["created_at", "createdAt"]),
    downloadUrl: safeApiUrl(nullableText(item, ["download_url", "downloadUrl"])),
  })).filter((item) => item.id);
}

export function normalizeActivity(payload: unknown): { items: ActivityItem[]; nextCursor: string | null } {
  const outer = record(payload);
  const data = record(outer.data);
  const items = recordsFrom(payload, ["activity", "audit_events", "auditEvents", "items", "events"], 100).map((item) => ({
    id: textValue(item, ["audit_event_id", "auditEventId", "event_id", "eventId", "id"]),
    sequence: nullableInteger(valueAt(item, "sequence")),
    eventType: textValue(item, ["event_type", "eventType", "type"], "dossier_updated"),
    summaryCode: textValue(item, ["summary_code", "summaryCode", "summary"], "Matter record updated"),
    actorId: nullableText(item, ["actor_id", "actorId"]),
    actorRole: nullableText(item, ["actor_role", "actorRole"]),
    occurredAt: nullableText(item, ["occurred_at", "occurredAt", "created_at", "createdAt"]),
    objectType: nullableText(item, ["object_ref_type", "objectRefType", "object_type", "objectType"]),
    objectId: nullableText(item, ["object_ref_id", "objectRefId", "object_id", "objectId"]),
    eventDigest: nullableText(item, ["event_digest", "eventDigest"]),
    detail: valueAt(item, "detail") === undefined ? null : boundedJson(valueAt(item, "detail"), 1_500),
  })).filter((item) => item.id);
  return {
    items,
    nextCursor: nullableText(outer, ["next_cursor", "nextCursor"])
      ?? nullableText(data, ["next_cursor", "nextCursor"]),
  };
}

export function nextPageCursor(payload: unknown): string | null {
  const outer = record(payload);
  const data = record(outer.data);
  return nullableText(outer, ["next_cursor", "nextCursor"])
    ?? nullableText(data, ["next_cursor", "nextCursor"]);
}

export interface TransitionOption {
  to: MatterStatus;
  roles: MatterRole[];
  requiresReason: boolean;
  requiresCurrentOutput: boolean;
  requiresReviewerApproval: boolean;
  preservesCurrentOutput: boolean;
}

const TRANSITIONS: Readonly<Record<MatterStatus, readonly TransitionOption[]>> = {
  draft: [
    transition("intake_review", ["owner", "contributor"]),
    transition("declined", ["owner", "reviewer"], true),
    transition("cancelled", ["owner"], true),
  ],
  intake_review: [
    transition("draft", ["owner", "contributor", "reviewer"]),
    transition("active", ["owner", "reviewer"]),
    transition("awaiting_input", ["owner", "contributor", "reviewer"], true),
    transition("declined", ["owner", "reviewer"], true),
    transition("cancelled", ["owner"], true),
  ],
  active: [
    transition("awaiting_input", ["owner", "contributor", "reviewer"], true),
    transition("internal_review", ["owner", "contributor", "reviewer"], true),
    transition("closed", ["owner", "reviewer"], true),
    transition("cancelled", ["owner"], true),
  ],
  awaiting_input: [
    transition("active", ["owner", "contributor", "reviewer"]),
    transition("internal_review", ["owner", "contributor", "reviewer"], true),
    transition("cancelled", ["owner"], true),
  ],
  internal_review: [
    transition("active", ["owner", "contributor", "reviewer"]),
    transition("awaiting_input", ["owner", "contributor", "reviewer"], true),
    transition("output_approved", ["reviewer"], false, true, true, true),
    transition("closed", ["owner", "reviewer"], true),
  ],
  output_approved: [
    transition("active", ["owner", "reviewer"], true),
    transition("closed", ["owner", "reviewer"], true),
    transition("cancelled", ["owner"], true),
  ],
  closed: [
    transition("active", ["owner", "reviewer"], true),
    transition("archived", ["owner", "reviewer"], true),
  ],
  declined: [
    transition("active", ["owner", "reviewer"], true),
    transition("archived", ["owner", "reviewer"], true),
  ],
  cancelled: [
    transition("active", ["owner", "reviewer"], true),
    transition("archived", ["owner", "reviewer"], true),
  ],
  archived: [transition("active", ["owner", "reviewer"], true)],
};

function transition(
  to: MatterStatus,
  roles: MatterRole[],
  requiresReason = false,
  requiresCurrentOutput = false,
  requiresReviewerApproval = false,
  preservesCurrentOutput = false,
): TransitionOption {
  return { to, roles, requiresReason, requiresCurrentOutput, requiresReviewerApproval, preservesCurrentOutput };
}

export function availableTransitions(status: MatterStatus, role: MatterRole): TransitionOption[] {
  return [...TRANSITIONS[status]].filter((option) => option.roles.includes(role));
}

export function transitionConsequences(option: TransitionOption): string[] {
  const consequences = ["Readiness will be recomputed from authoritative records."];
  consequences.push(option.preservesCurrentOutput
    ? "The current approved output will be preserved."
    : "Any current governed output may be marked stale.");
  if (option.requiresCurrentOutput) consequences.push("A current output is required.");
  if (option.requiresReviewerApproval) consequences.push("A reviewer approval is required.");
  return consequences;
}

export function statusLabel(value: string): string {
  return sentenceLabel(value);
}

export function sentenceLabel(value: string): string {
  const words = value.replaceAll("_", " ").replaceAll("-", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Not recorded";
}

export function readinessSummary(readiness: MatterReadiness): { headline: string; detail: string; blockedCount: number } {
  const blocked = readiness.dimensions.filter((dimension) => dimension.state === "blocked");
  const reasons = blocked.flatMap((dimension) => dimension.reasons);
  if (readiness.ready) return {
    headline: "Ready for the next governed step",
    detail: "No readiness blockers are recorded at this revision.",
    blockedCount: 0,
  };
  if (reasons.length > 0) return {
    headline: "Not ready — professional attention required",
    detail: reasons[0].explanation + (reasons.length > 1 ? " " + (reasons.length - 1) + " more reason" + (reasons.length === 2 ? " remains." : "s remain.") : ""),
    blockedCount: reasons.length,
  };
  return {
    headline: "Readiness has not been established",
    detail: "Open the matter and complete the recorded professional checks before graph testing or report approval.",
    blockedCount: 0,
  };
}

export function nextAttention(matter: MatterSummary): string {
  const readiness = readinessSummary(matter.readiness);
  if (!matter.readiness.ready) return readiness.detail;
  if (matter.status === "draft") return "Submit the draft for intake review when its core records are complete.";
  if (matter.status === "awaiting_input") return "Review newly received information or record why the matter remains paused.";
  if (matter.status === "internal_review") return "Complete reviewer checks and approve a current governed output.";
  if (matter.status === "output_approved") return "Confirm closure criteria or return the matter to active work with a reason.";
  if (matter.status === "closed") return "Retain the closed record or archive it through an explicit action.";
  return "Review the current evidence, package validation, and governed output state.";
}

export function apiIssueFor(status: number, payload: unknown): ApiIssue {
  const outer = record(payload);
  const error = record(outer.error);
  const code = textValue(outer, ["code", "error_code", "errorCode"], textValue(error, ["code"], ""));
  const serverMessage = textValue(outer, ["message"], textValue(error, ["message"], typeof outer.error === "string" ? outer.error : ""));
  const detail = boundedText(textValue(outer, ["detail"], textValue(error, ["detail"], "")), 500) || null;
  if (status === 401 || status === 403 || status === 404) return {
    kind: "permission",
    title: status === 401 ? "Sign-in required" : status === 404 ? "Matter unavailable" : "No permission for this matter",
    message: status === 401
      ? "Use a trusted account before opening private matter records."
      : status === 404
        ? "The matter is unavailable to this account or no longer exists. No private metadata was disclosed."
        : "Your current participant role does not permit this operation.",
    detail: null,
  };
  if (status === 412 || /stale|revision/i.test(code) || (status === 409 && /changed|revision/i.test(serverMessage))) return {
    kind: "stale",
    title: "This matter changed elsewhere",
    message: "No write was retried. Reload the current revision, review the differences, and submit the action again.",
    detail: serverMessage || detail,
  };
  if (status === 415 || status === 501 || /unsupported|not_extractable|not_supported/i.test(code)) return {
    kind: "unsupported",
    title: "Unavailable in the current pilot boundary",
    message: "The record remains usable, but this operation is not supported by the current deployment.",
    detail: serverMessage || detail,
  };
  return {
    kind: "error",
    title: "The workspace could not complete that request",
    message: serverMessage || "The server returned an unexpected response. No client-side change was treated as saved.",
    detail,
  };
}

export function mutationPayload(expectedRevision: number, fields: Record<string, unknown>): Record<string, unknown> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("A non-negative expected revision is required.");
  const safeFields = { ...fields };
  delete safeFields.expectedRevision;
  delete safeFields.expected_revision;
  return { ...safeFields, expectedRevision };
}

export async function proposalGenerationIdempotencyKey(
  dossierId: string,
  expectedRevision: number,
  documentVersionIds: readonly string[],
): Promise<string> {
  const normalizedDossierId = dossierId.trim();
  const normalizedVersionIds = documentVersionIds.map((value) => value.trim()).sort();
  if (
    normalizedDossierId.length < 1
    || normalizedDossierId.length > 200
    || !Number.isSafeInteger(expectedRevision)
    || expectedRevision < 1
    || normalizedVersionIds.length < 1
    || normalizedVersionIds.length > 8
    || normalizedVersionIds.some((value) => value.length < 1 || value.length > 200)
    || new Set(normalizedVersionIds).size !== normalizedVersionIds.length
  ) throw new Error("A valid exact proposal-generation request is required.");
  const canonical = JSON.stringify({
    kind: "genesis-juris-matter-proposal-idempotency-v1",
    dossier_id: normalizedDossierId,
    expected_revision: expectedRevision,
    document_version_ids: normalizedVersionIds,
  });
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  ));
  return "matter-proposals:" + [...digest]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export interface PilotFileLike { name: string; size: number; type: string }

const UPLOAD_POLICY = {
  pdf: { mediaType: "application/pdf", maximumBytes: 25 * 1024 * 1024, browserTypes: ["application/pdf"] },
  docx: { mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", maximumBytes: 25 * 1024 * 1024, browserTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  txt: { mediaType: "text/plain", maximumBytes: 5 * 1024 * 1024, browserTypes: ["text/plain"] },
  md: { mediaType: "text/markdown", maximumBytes: 5 * 1024 * 1024, browserTypes: ["text/markdown", "text/plain"] },
} as const;

export type PilotFileValidation =
  | { ok: true; canonicalMediaType: string; maximumBytes: number }
  | { ok: false; message: string };

export function validatePilotFile(file: PilotFileLike): PilotFileValidation {
  const name = file.name.trim();
  if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(name) || name === "." || name === "..") {
    return { ok: false, message: "Choose a simple filename without paths or control characters (255 characters maximum)." };
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return { ok: false, message: "The selected file is empty or has an invalid size." };
  const match = /\.([a-z0-9]+)$/iu.exec(name);
  const extension = match?.[1]?.toLowerCase() as keyof typeof UPLOAD_POLICY | undefined;
  const policy = extension ? UPLOAD_POLICY[extension] : undefined;
  if (!policy) return { ok: false, message: "Use PDF, DOCX, TXT, or Markdown (.md) files only." };
  if (file.size > policy.maximumBytes) {
    const limit = policy.maximumBytes / (1024 * 1024);
    return { ok: false, message: "This " + (extension ?? "file").toUpperCase() + " file exceeds the " + limit + " MiB pilot limit." };
  }
  if (file.type && !(policy.browserTypes as readonly string[]).includes(file.type.toLowerCase())) {
    return { ok: false, message: "The browser-reported media type does not match the filename extension." };
  }
  return { ok: true, canonicalMediaType: policy.mediaType, maximumBytes: policy.maximumBytes };
}

export function safeApiUrl(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/api/dossiers/") || value.includes("\\") || value.includes("//")) return null;
  return value;
}

export function safeMatterLink(value: string | null): string | null {
  if (!value) return null;
  const canonicalSection = /^\/(?:documents|requests(?:-deadlines)?|evidence|decision-packages|outputs)(?:\/|$)/u.test(value);
  if ((!value.startsWith("/matters") && !value.startsWith("#") && !canonicalSection) || value.includes("\\") || value.includes("//")) return null;
  return value;
}

export function destinationForDeepLink(value: string): MatterDestination {
  if (value.startsWith("/documents")) return "documents";
  if (value.startsWith("/requests") || value.startsWith("/requests-deadlines")) return "requests";
  if (value.startsWith("/evidence")) return "evidence";
  if (value.startsWith("/decision-packages")) return "decision-packages";
  if (value.startsWith("/outputs")) return "outputs";
  return "overview";
}

export function formatMatterDate(value: string | null, locale = "en-GB", timezone?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date recorded";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Unknown size";
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KiB";
  return (value / (1024 * 1024)).toFixed(1) + " MiB";
}

export function isOverdue(value: string | null, status: string, now = Date.now()): boolean {
  if (!value || status !== "open") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && epoch < now;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedText(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return value.slice(0, Math.max(0, maximum - 1)).trimEnd() + "…";
}

function boundedJson(value: unknown, maximum: number): string {
  if (typeof value === "string") return boundedText(value, maximum);
  try {
    return boundedText(JSON.stringify(value, null, 2) ?? "No proposed value recorded", maximum);
  } catch {
    return "The proposed value could not be displayed safely.";
  }
}
