import rawRegistry from "./dossier-contract.v1.json";

export const DOSSIER_CONTRACT_FORMAT = "genesis-juris-dossier-contract-registry" as const;
export const DOSSIER_CONTRACT_REGISTRY_ID = "genesis-juris-dossier-contract" as const;
export const DOSSIER_CONTRACT_SCHEMA_VERSION = 1 as const;
export const DOSSIER_CONTRACT_VERSION = "1.0.0" as const;
export const DOSSIER_BUNDLE_FORMAT = "genesis-juris-dossier-bundle" as const;

export const DOSSIER_OBJECT_TYPES = [
  "dossier", "participant", "status_transition", "document", "document_version",
  "source_anchor", "professional_assertion", "evidence_link", "information_request",
  "deadline_reference", "decision_package_reference", "ai_proposal", "dossier_snapshot",
  "governed_output", "audit_event",
] as const;

export const DOSSIER_STATUSES = [
  "draft", "intake_review", "active", "awaiting_input", "internal_review",
  "output_approved", "closed", "archived", "declined", "cancelled",
] as const;

export const DOSSIER_ROLES = ["owner", "contributor", "reviewer", "viewer"] as const;

export const DOSSIER_READINESS_DIMENSIONS = [
  "document_completeness", "information_requests", "ai_proposals", "contradictions",
  "critical_deadlines", "source_provenance", "decision_graph", "simulation_tests",
  "report_freshness", "reviewer_approval",
] as const;

export const DOSSIER_INTEGRITY_RULES = [
  "graph_evidence_requires_exact_package",
  "transition_revision_and_output_binding",
  "audit_revision_receipt_chronology",
  "current_snapshot_exact_manifest",
  "private_output_content_reference",
  "sole_output_approval_freshness_exception",
] as const;

export const DOSSIER_READINESS_REASON_CODES = [
  "DOCUMENT_REQUIRED_MISSING", "DOCUMENT_REVIEW_REQUIRED", "INFORMATION_REQUEST_OPEN",
  "INFORMATION_REQUEST_OVERDUE", "AI_PROPOSAL_PENDING", "CONTRADICTION_UNRESOLVED",
  "CRITICAL_DEADLINE_MISSING", "CRITICAL_DEADLINE_OVERDUE", "SOURCE_ANCHOR_MISSING",
  "SOURCE_VERSION_STALE", "DECISION_GRAPH_INVALID", "SIMULATION_REQUIRED",
  "SIMULATION_FAILED", "OUTPUT_REQUIRED", "OUTPUT_STALE", "REVIEWER_APPROVAL_MISSING",
] as const;

export const DOSSIER_TRANSITION_REQUIREMENTS = ["reason", "current_output", "reviewer_approval"] as const;
export const DOSSIER_TRANSITION_CONSEQUENCES = ["recompute_readiness", "mark_outputs_stale", "preserve_current_output"] as const;
export const DOSSIER_PROPOSAL_ACCEPTED_OBJECT_TYPES = [
  "participant", "document", "professional_assertion", "evidence_link",
  "information_request", "deadline_reference", "decision_package_reference",
] as const;

export const DOSSIER_WIRE_ENUMS = {
  terminology: ["matter", "dossier", "engagement", "case"],
  classification: ["public", "internal", "confidential", "strictly_confidential"],
  priority: ["low", "normal", "high", "urgent"],
  participant_status: ["active", "removed"],
  document_source_origin: ["internal_upload", "external_reference", "import"],
  document_status: ["received", "under_review", "accepted_source", "superseded", "rejected"],
  document_media_type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  extraction_status: ["queued", "processing", "ready", "failed", "not_extractable"],
  extraction_error_code: ["unsupported_type", "image_only", "active_content", "malformed", "size_limit", "internal_error"],
  anchor_creator: ["human", "ai_proposal", "import"],
  review_state: ["pending", "accepted", "rejected", "superseded"],
  assertion_type: ["fact", "evidence", "rule", "assumption", "date", "contradiction"],
  assertion_status: ["accepted", "needs_review", "rejected", "superseded"],
  evidence_target_type: ["professional_assertion", "authority_rule", "graph_node", "graph_edge", "parameter_assumption", "deadline", "report_section"],
  evidence_relation: ["supports", "contradicts", "qualifies", "supersedes", "source_for"],
  information_request_status: ["open", "received", "waived", "cancelled"],
  deadline_kind: ["workspace", "projected_simulation"],
  deadline_status: ["open", "completed", "waived", "cancelled"],
  decision_package_state: ["current", "stale"],
  graph_validation_status: ["not_run", "valid", "invalid"],
  package_approval_state: ["draft", "reviewed", "approved", "published"],
  proposal_type: ["document_metadata", "participant", "dated_event", "deadline", "fact", "authority_rule", "contradiction", "information_request", "evidence_link", "graph_change", "assumption", "dossier_summary"],
  proposal_accepted_object_type: DOSSIER_PROPOSAL_ACCEPTED_OBJECT_TYPES,
  confidence_category: ["low", "medium", "high"],
  readiness_state: ["ready", "blocked", "not_applicable"],
  audience: ["internal", "client"],
  output_format: ["pdf", "json_manifest", "markdown"],
  output_state: ["current", "stale"],
  audit_actor_role: ["owner", "contributor", "reviewer", "viewer", "platform_admin", "system", "import"],
  audit_event_type: ["dossier_created", "dossier_updated", "dossier_status_transitioned", "participant_changed", "document_created", "document_version_created", "source_anchor_reviewed", "assertion_reviewed", "evidence_link_changed", "information_request_changed", "proposal_reviewed", "proposal_generation_completed", "decision_package_linked", "snapshot_created", "output_generated", "output_approved", "output_marked_stale", "legacy_case_migration_requested", "admin_archive_override"],
} as const;

export type DossierObjectType = typeof DOSSIER_OBJECT_TYPES[number];
export type DossierStatus = typeof DOSSIER_STATUSES[number];
export type DossierRole = typeof DOSSIER_ROLES[number];
export type DossierTransitionActorRole = DossierRole | "platform_admin";
export type DossierReadinessDimension = typeof DOSSIER_READINESS_DIMENSIONS[number];
export type DossierIntegrityRule = typeof DOSSIER_INTEGRITY_RULES[number];
export type DossierReadinessReasonCode = typeof DOSSIER_READINESS_REASON_CODES[number];
export type DossierTransitionRequirement = typeof DOSSIER_TRANSITION_REQUIREMENTS[number];
export type DossierTransitionConsequence = typeof DOSSIER_TRANSITION_CONSEQUENCES[number];
export type DossierTerminology = "matter" | "dossier" | "engagement" | "case";
export type DossierClassification = "public" | "internal" | "confidential" | "strictly_confidential";
export type DossierPriority = "low" | "normal" | "high" | "urgent";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type DossierReadinessReasonV1 = {
  code: DossierReadinessReasonCode;
  explanation: string;
  deep_link: string;
  related_object_type: DossierObjectType | null;
  related_object_id: string | null;
};

export type DossierReadinessDimensionV1 = {
  dimension: DossierReadinessDimension;
  state: "ready" | "blocked" | "not_applicable";
  reasons: DossierReadinessReasonV1[];
};

/** Derived state only. It is never the persisted source of truth. */
export type DossierReadinessV1 = {
  schema_version: 1;
  dossier_id: string;
  computed_from_revision: number;
  evaluated_at: string;
  ready: boolean;
  dimensions: DossierReadinessDimensionV1[];
};

export type DossierTypeReferenceV1 = {
  registry: string;
  id: string;
  version: string;
};

export type DossierV1 = {
  object_type: "dossier";
  schema_version: 1;
  dossier_id: string;
  reference: string;
  title: string;
  dossier_type: DossierTypeReferenceV1;
  terminology: DossierTerminology;
  owner_actor_id: string;
  organisation_id: string | null;
  jurisdictions: string[];
  classification: DossierClassification;
  priority: DossierPriority;
  status: DossierStatus;
  status_reason: string | null;
  key_deadline: { at: string; timezone: string } | null;
  revision: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  closure: { closed_at: string; closed_by: string; reason: string } | null;
  archive: { archived_at: string; archived_by: string; reason: string; admin_override: boolean } | null;
  participant_ids: string[];
  document_ids: string[];
  information_request_ids: string[];
  decision_package_reference_ids: string[];
  output_ids: string[];
  audit_event_ids: string[];
};

export type DossierParticipantV1 = {
  object_type: "participant";
  schema_version: 1;
  participant_id: string;
  dossier_id: string;
  actor_id: string;
  display_name: string;
  role: DossierRole;
  status: "active" | "removed";
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type DossierStatusTransitionV1 = {
  object_type: "status_transition";
  schema_version: 1;
  transition_id: string;
  dossier_id: string;
  previous_status: DossierStatus;
  new_status: DossierStatus;
  revision_before: number;
  revision_after: number;
  approved_output_id: string | null;
  actor_id: string;
  actor_role: DossierTransitionActorRole;
  occurred_at: string;
  reason: string | null;
  comment: string | null;
  platform_admin_override: boolean;
  had_current_output: boolean;
  had_reviewer_approval: boolean;
  consequences: DossierTransitionConsequence[];
};

export type DossierDocumentV1 = {
  object_type: "document";
  schema_version: 1;
  document_id: string;
  dossier_id: string;
  title: string;
  document_type: string;
  source_origin: "internal_upload" | "external_reference" | "import";
  classification: DossierClassification;
  current_version_id: string;
  status: "received" | "under_review" | "accepted_source" | "superseded" | "rejected";
  tags: string[];
  external_system_reference: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type DossierDocumentVersionV1 = {
  object_type: "document_version";
  schema_version: 1;
  document_version_id: string;
  dossier_id: string;
  document_id: string;
  ordinal: number;
  binary_object_reference: string;
  original_filename: string;
  media_type: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "text/plain" | "text/markdown";
  byte_length: number;
  content_sha256: string;
  uploader_actor_id: string;
  uploaded_at: string;
  extraction_status: "queued" | "processing" | "ready" | "failed" | "not_extractable";
  extraction_error_code: "unsupported_type" | "image_only" | "active_content" | "malformed" | "size_limit" | "internal_error" | null;
  extracted_text_version: string | null;
  extracted_text_checksum: string | null;
  page_map: Array<{
    page_number: number;
    section_id: string | null;
    heading: string | null;
    start_offset: number;
    end_offset: number;
    checksum: string;
  }>;
  predecessor_version_id: string | null;
  source_note: string | null;
  created_at: string;
  created_by: string;
};

export type DossierSourceAnchorV1 = {
  object_type: "source_anchor";
  schema_version: 1;
  source_anchor_id: string;
  dossier_id: string;
  document_id: string;
  document_version_id: string;
  page_number: number | null;
  section: string | null;
  heading: string | null;
  paragraph: string | null;
  character_start: number | null;
  character_end: number | null;
  excerpt: string | null;
  anchor_checksum: string;
  extraction_version: string | null;
  creator: "human" | "ai_proposal" | "import";
  review_state: "pending" | "accepted" | "rejected" | "superseded";
  reviewer_actor_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  created_by: string;
};

export type DossierProfessionalAssertionV1 = {
  object_type: "professional_assertion";
  schema_version: 1;
  assertion_id: string;
  dossier_id: string;
  assertion_type: "fact" | "evidence" | "rule" | "assumption" | "date" | "contradiction";
  statement: string;
  status: "accepted" | "needs_review" | "rejected" | "superseded";
  source_anchor_ids: string[];
  originating_proposal_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type DossierEvidenceLinkV1 = {
  object_type: "evidence_link";
  schema_version: 1;
  evidence_link_id: string;
  dossier_id: string;
  source_anchor_id: string;
  assertion_id: string | null;
  decision_package_reference_id: string | null;
  target_type: "professional_assertion" | "authority_rule" | "graph_node" | "graph_edge" | "parameter_assumption" | "deadline" | "report_section";
  target_id: string;
  relation: "supports" | "contradicts" | "qualifies" | "supersedes" | "source_for";
  professional_meaning: string;
  created_at: string;
  created_by: string;
  reviewed_by: string;
  reviewed_at: string;
};

export type DossierInformationRequestV1 = {
  object_type: "information_request";
  schema_version: 1;
  information_request_id: string;
  dossier_id: string;
  question: string;
  owner_actor_id: string;
  requested_from_participant_id: string | null;
  priority: DossierPriority;
  due_at: string | null;
  timezone: string | null;
  status: "open" | "received" | "waived" | "cancelled";
  reason: string;
  readiness_reason_code: DossierReadinessReasonCode;
  satisfying_document_id: string | null;
  satisfying_evidence_link_id: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type DossierDeadlineReferenceV1 = {
  object_type: "deadline_reference";
  schema_version: 1;
  deadline_reference_id: string;
  dossier_id: string;
  deadline_kind: "workspace" | "projected_simulation";
  title: string;
  due_at: string;
  timezone: string;
  critical: boolean;
  status: "open" | "completed" | "waived" | "cancelled";
  source_anchor_ids: string[];
  decision_package_reference_id: string | null;
  simulation_deadline_id: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type DossierDecisionPackageReferenceV1 = {
  object_type: "decision_package_reference";
  schema_version: 1;
  decision_package_reference_id: string;
  dossier_id: string;
  package_id: string;
  package_version: string;
  package_fingerprint: string;
  parent_package_id: string | null;
  parent_package_version: string | null;
  parent_package_fingerprint: string | null;
  source_snapshot_id: string | null;
  source_dossier_revision: number;
  state: "current" | "stale";
  graph_validation_status: "not_run" | "valid" | "invalid";
  graph_digest: string;
  simulation_run_references: string[];
  approval_state: "draft" | "reviewed" | "approved" | "published";
  package_type: { registry: string; id: string; version: string };
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type DossierAIProposalV1 = {
  object_type: "ai_proposal";
  schema_version: 1;
  proposal_id: string;
  dossier_id: string;
  source_document_version_ids: string[];
  source_anchor_ids: string[];
  proposal_type: "document_metadata" | "participant" | "dated_event" | "deadline" | "fact" | "authority_rule" | "contradiction" | "information_request" | "evidence_link" | "graph_change" | "assumption" | "dossier_summary";
  proposed_value: JsonValue;
  confidence: { category: "low" | "medium" | "high"; score: number | null } | null;
  model_provenance: { provider: string; model: string; configuration_digest: string } | null;
  review_state: "pending" | "accepted" | "rejected" | "superseded";
  reviewing_actor_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  accepted_object_type: typeof DOSSIER_PROPOSAL_ACCEPTED_OBJECT_TYPES[number] | null;
  accepted_object_id: string | null;
  created_at: string;
  created_by: string;
};

export type DossierSnapshotV1 = {
  object_type: "dossier_snapshot";
  schema_version: 1;
  snapshot_id: string;
  dossier_id: string;
  dossier_revision: number;
  document_versions: Array<{ document_id: string; document_version_id: string; content_sha256: string }>;
  accepted_assertion_ids: string[];
  source_anchor_ids: string[];
  decision_packages: Array<{ decision_package_reference_id: string; package_id: string; package_version: string; graph_digest: string; simulation_receipt_ids: string[] }>;
  simulation_inputs: JsonValue;
  deterministic_receipts: JsonValue;
  status: DossierStatus;
  readiness: DossierReadinessV1;
  approver_records: Array<{ reviewer_actor_id: string; approved_at: string; output_id: string | null }>;
  locale: string;
  audience: "internal" | "client";
  classification: DossierClassification;
  redaction_profile_id: string;
  generator: { contract_version: string; report_model_schema_version: number; renderer_version: string; build_version: string };
  manifest_digest: string;
  created_at: string;
  created_by: string;
};

export type DossierGovernedOutputV1 = {
  object_type: "governed_output";
  schema_version: 1;
  output_id: string;
  dossier_id: string;
  snapshot_id: string;
  snapshot_digest: string;
  format: "pdf" | "json_manifest" | "markdown";
  content_reference: string;
  content_sha256: string;
  filename: string;
  state: "current" | "stale";
  stale_at: string | null;
  stale_reason: string | null;
  reviewer_actor_id: string | null;
  approved_at: string | null;
  generator_schema_version: number;
  generator_build_version: string;
  created_at: string;
  created_by: string;
};

export const DOSSIER_AUDIT_EVENT_TYPES = [
  "dossier_created", "dossier_updated", "dossier_status_transitioned", "participant_changed",
  "document_created", "document_version_created", "source_anchor_reviewed", "assertion_reviewed",
  "evidence_link_changed", "information_request_changed", "proposal_reviewed",
  "proposal_generation_completed", "decision_package_linked", "snapshot_created", "output_generated", "output_approved",
  "output_marked_stale", "legacy_case_migration_requested", "admin_archive_override",
] as const;

export type DossierAuditEventV1 = {
  object_type: "audit_event";
  schema_version: 1;
  audit_event_id: string;
  dossier_id: string;
  dossier_revision: number;
  sequence: number;
  event_type: typeof DOSSIER_AUDIT_EVENT_TYPES[number];
  object_ref_type: DossierObjectType;
  object_ref_id: string;
  actor_id: string;
  actor_role: DossierRole | "platform_admin" | "system" | "import";
  occurred_at: string;
  summary_code: string;
  detail: JsonValue;
  previous_event_id: string | null;
  event_digest: string;
};

export type DossierContractBundleV1 = {
  format: typeof DOSSIER_BUNDLE_FORMAT;
  schema_version: 1;
  contract_registry: typeof DOSSIER_CONTRACT_REGISTRY_ID;
  contract_version: typeof DOSSIER_CONTRACT_VERSION;
  export_id: string;
  exported_at: string;
  exported_by: string;
  dossiers: DossierV1[];
  participants: DossierParticipantV1[];
  status_transitions: DossierStatusTransitionV1[];
  documents: DossierDocumentV1[];
  document_versions: DossierDocumentVersionV1[];
  source_anchors: DossierSourceAnchorV1[];
  professional_assertions: DossierProfessionalAssertionV1[];
  evidence_links: DossierEvidenceLinkV1[];
  information_requests: DossierInformationRequestV1[];
  deadline_references: DossierDeadlineReferenceV1[];
  decision_package_references: DossierDecisionPackageReferenceV1[];
  ai_proposals: DossierAIProposalV1[];
  dossier_snapshots: DossierSnapshotV1[];
  governed_outputs: DossierGovernedOutputV1[];
  audit_events: DossierAuditEventV1[];
};

export type DossierContractErrorCode =
  | "INVALID_SHAPE"
  | "UNKNOWN_SCHEMA"
  | "UNKNOWN_ENUM"
  | "INVALID_REFERENCE"
  | "INVALID_TRANSITION"
  | "LIMIT_EXCEEDED";

export class DossierContractError extends Error {
  constructor(public readonly code: DossierContractErrorCode, public readonly path: string) {
    super(`Dossier contract rejected at ${path} (${code}).`);
    this.name = "DossierContractError";
  }
}

type RegistryTransitionV1 = {
  from: DossierStatus;
  to: DossierStatus;
  roles: DossierRole[];
  requires: DossierTransitionRequirement[];
  consequences: DossierTransitionConsequence[];
};

type DossierContractRegistryV1 = {
  format: typeof DOSSIER_CONTRACT_FORMAT;
  schema_version: 1;
  registry: typeof DOSSIER_CONTRACT_REGISTRY_ID;
  version: typeof DOSSIER_CONTRACT_VERSION;
  object_types: DossierObjectType[];
  statuses: DossierStatus[];
  roles: DossierRole[];
  readiness_dimensions: DossierReadinessDimension[];
  integrity_rules: DossierIntegrityRule[];
  wire_enums: typeof DOSSIER_WIRE_ENUMS;
  readiness_reasons: Array<{
    code: DossierReadinessReasonCode;
    dimension: DossierReadinessDimension;
    explanation: string;
    deep_link_prefix: string;
  }>;
  transitions: RegistryTransitionV1[];
};

export function validateDossierContractRegistry(value: unknown): DossierContractRegistryV1 {
  const root = record(value, "$registry");
  exactKeys(root, ["format", "schema_version", "registry", "version", "object_types", "statuses", "roles", "readiness_dimensions", "integrity_rules", "wire_enums", "readiness_reasons", "transitions"], "$registry");
  if (root.format !== DOSSIER_CONTRACT_FORMAT || root.registry !== DOSSIER_CONTRACT_REGISTRY_ID || root.version !== DOSSIER_CONTRACT_VERSION) fail("UNKNOWN_SCHEMA", "$registry.identity");
  if (root.schema_version !== DOSSIER_CONTRACT_SCHEMA_VERSION) fail("UNKNOWN_SCHEMA", "$registry.schema_version");
  exactLiteralArray(root.object_types, DOSSIER_OBJECT_TYPES, "$registry.object_types");
  exactLiteralArray(root.statuses, DOSSIER_STATUSES, "$registry.statuses");
  exactLiteralArray(root.roles, DOSSIER_ROLES, "$registry.roles");
  exactLiteralArray(root.readiness_dimensions, DOSSIER_READINESS_DIMENSIONS, "$registry.readiness_dimensions");
  exactLiteralArray(root.integrity_rules, DOSSIER_INTEGRITY_RULES, "$registry.integrity_rules");
  const wireEnums = record(root.wire_enums, "$registry.wire_enums");
  exactKeys(wireEnums, Object.keys(DOSSIER_WIRE_ENUMS), "$registry.wire_enums");
  for (const [key, expected] of Object.entries(DOSSIER_WIRE_ENUMS)) exactLiteralArray(wireEnums[key], expected, `$registry.wire_enums.${key}`);

  const readinessReasons = array(root.readiness_reasons, "$registry.readiness_reasons").map((item, index) => {
    const path = `$registry.readiness_reasons[${index}]`;
    const candidate = record(item, path);
    exactKeys(candidate, ["code", "dimension", "explanation", "deep_link_prefix"], path);
    const code = enumeration(candidate.code, DOSSIER_READINESS_REASON_CODES, `${path}.code`);
    const dimension = enumeration(candidate.dimension, DOSSIER_READINESS_DIMENSIONS, `${path}.dimension`);
    const explanation = boundedText(candidate.explanation, `${path}.explanation`, 1, 300);
    const deep_link_prefix = boundedText(candidate.deep_link_prefix, `${path}.deep_link_prefix`, 1, 120);
    if (!deep_link_prefix.startsWith("/") || deep_link_prefix.startsWith("//")) fail("INVALID_SHAPE", `${path}.deep_link_prefix`);
    return { code, dimension, explanation, deep_link_prefix };
  });
  exactLiteralArray(readinessReasons.map(({ code }) => code), DOSSIER_READINESS_REASON_CODES, "$registry.readiness_reasons.codes");

  const transitionKeys = new Set<string>();
  const transitions = array(root.transitions, "$registry.transitions").map((item, index) => {
    const path = `$registry.transitions[${index}]`;
    const candidate = record(item, path);
    exactKeys(candidate, ["from", "to", "roles", "requires", "consequences"], path);
    const from = enumeration(candidate.from, DOSSIER_STATUSES, `${path}.from`);
    const to = enumeration(candidate.to, DOSSIER_STATUSES, `${path}.to`);
    if (from === to) fail("INVALID_TRANSITION", path);
    const key = `${from}->${to}`;
    if (transitionKeys.has(key)) fail("INVALID_TRANSITION", path);
    transitionKeys.add(key);
    const roles = enumArray(candidate.roles, DOSSIER_ROLES, `${path}.roles`, 1);
    if (roles.includes("viewer")) fail("INVALID_TRANSITION", `${path}.roles`);
    const requires = enumArray(candidate.requires, DOSSIER_TRANSITION_REQUIREMENTS, `${path}.requires`, 0);
    const consequences = enumArray(candidate.consequences, DOSSIER_TRANSITION_CONSEQUENCES, `${path}.consequences`, 1);
    if (to === "output_approved" && (!requires.includes("current_output") || !requires.includes("reviewer_approval") || roles.some((role) => role !== "reviewer"))) fail("INVALID_TRANSITION", path);
    if (to === "archived" && !["closed", "declined", "cancelled"].includes(from)) fail("INVALID_TRANSITION", path);
    return { from, to, roles, requires, consequences };
  });
  if (!transitions.length) fail("INVALID_TRANSITION", "$registry.transitions");

  return {
    format: DOSSIER_CONTRACT_FORMAT,
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    registry: DOSSIER_CONTRACT_REGISTRY_ID,
    version: DOSSIER_CONTRACT_VERSION,
    object_types: [...DOSSIER_OBJECT_TYPES],
    statuses: [...DOSSIER_STATUSES],
    roles: [...DOSSIER_ROLES],
    readiness_dimensions: [...DOSSIER_READINESS_DIMENSIONS],
    integrity_rules: [...DOSSIER_INTEGRITY_RULES],
    wire_enums: DOSSIER_WIRE_ENUMS,
    readiness_reasons: readinessReasons,
    transitions,
  };
}

export const DOSSIER_CONTRACT_REGISTRY = validateDossierContractRegistry(rawRegistry);

export type DossierTransitionDecision =
  | { allowed: true; code: "ALLOWED"; requirements: DossierTransitionRequirement[]; consequences: DossierTransitionConsequence[] }
  | { allowed: false; code: "UNKNOWN_STATUS" | "UNKNOWN_ROLE" | "TRANSITION_FORBIDDEN" | "ROLE_FORBIDDEN" | "REASON_REQUIRED" | "CURRENT_OUTPUT_REQUIRED" | "REVIEWER_APPROVAL_REQUIRED" | "ADMIN_OVERRIDE_REQUIRED"; requirements: DossierTransitionRequirement[]; consequences: DossierTransitionConsequence[] };

export function dossierStatusTransitionDecision(input: {
  from: unknown;
  to: unknown;
  actor_role: unknown;
  reason?: unknown;
  has_current_output?: boolean;
  has_reviewer_approval?: boolean;
  platform_admin_override?: boolean;
}): DossierTransitionDecision {
  if (!isEnum(input.from, DOSSIER_STATUSES) || !isEnum(input.to, DOSSIER_STATUSES)) return denied("UNKNOWN_STATUS");
  if (input.from === input.to) return denied("TRANSITION_FORBIDDEN");

  if (input.actor_role === "platform_admin") {
    if (input.platform_admin_override !== true || input.to !== "archived" || input.from === "archived") return denied("ADMIN_OVERRIDE_REQUIRED");
    if (!nonBlank(input.reason)) return denied("REASON_REQUIRED", ["reason"]);
    return { allowed: true, code: "ALLOWED", requirements: ["reason"], consequences: ["recompute_readiness", "mark_outputs_stale"] };
  }
  if (!isEnum(input.actor_role, DOSSIER_ROLES)) return denied("UNKNOWN_ROLE");
  const rule = DOSSIER_CONTRACT_REGISTRY.transitions.find(({ from, to }) => from === input.from && to === input.to);
  if (!rule) return denied("TRANSITION_FORBIDDEN");
  if (!rule.roles.includes(input.actor_role)) return denied("ROLE_FORBIDDEN", rule.requires, rule.consequences);
  if (rule.requires.includes("reason") && !nonBlank(input.reason)) return denied("REASON_REQUIRED", rule.requires, rule.consequences);
  if (rule.requires.includes("current_output") && input.has_current_output !== true) return denied("CURRENT_OUTPUT_REQUIRED", rule.requires, rule.consequences);
  if (rule.requires.includes("reviewer_approval") && input.has_reviewer_approval !== true) return denied("REVIEWER_APPROVAL_REQUIRED", rule.requires, rule.consequences);
  return { allowed: true, code: "ALLOWED", requirements: [...rule.requires], consequences: [...rule.consequences] };
}

export function readinessReasonDefinition(code: unknown) {
  if (!isEnum(code, DOSSIER_READINESS_REASON_CODES)) fail("UNKNOWN_ENUM", "$readiness_reason.code");
  const definition = DOSSIER_CONTRACT_REGISTRY.readiness_reasons.find((item) => item.code === code);
  if (!definition) fail("UNKNOWN_SCHEMA", "$registry.readiness_reasons");
  return { ...definition };
}

function denied(code: Exclude<DossierTransitionDecision["code"], "ALLOWED">, requirements: DossierTransitionRequirement[] = [], consequences: DossierTransitionConsequence[] = []): DossierTransitionDecision {
  return { allowed: false, code, requirements: [...requirements], consequences: [...consequences] };
}

function fail(code: DossierContractErrorCode, path: string): never {
  throw new DossierContractError(code, path);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_SHAPE", path);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail("INVALID_SHAPE", path);
  return value;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail("UNKNOWN_SCHEMA", path);
}

function isEnum<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function enumeration<const T extends readonly string[]>(value: unknown, values: T, path: string): T[number] {
  if (!isEnum(value, values)) fail("UNKNOWN_ENUM", path);
  return value;
}

function enumArray<const T extends readonly string[]>(value: unknown, values: T, path: string, minimum: number): T[number][] {
  const result = array(value, path).map((item, index) => enumeration(item, values, `${path}[${index}]`));
  if (result.length < minimum || new Set(result).size !== result.length) fail("INVALID_SHAPE", path);
  return result;
}

function exactLiteralArray(value: unknown, expected: readonly string[], path: string) {
  const result = array(value, path);
  if (result.length !== expected.length || result.some((item, index) => item !== expected[index])) fail("UNKNOWN_SCHEMA", path);
}

function boundedText(value: unknown, path: string, minimum: number, maximum: number): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || value.includes("\u0000")) fail("INVALID_SHAPE", path);
  return value;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseDossierContractBundleV1(value: unknown): DossierContractBundleV1 {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source) as unknown;
    } catch {
      fail("INVALID_SHAPE", "$bundle");
    }
  }
  const root = record(source, "$bundle");
  exactKeys(root, [
    "format", "schema_version", "contract_registry", "contract_version", "export_id", "exported_at", "exported_by",
    "dossiers", "participants", "status_transitions", "documents", "document_versions", "source_anchors",
    "professional_assertions", "evidence_links", "information_requests", "deadline_references",
    "decision_package_references", "ai_proposals", "dossier_snapshots", "governed_outputs", "audit_events",
  ], "$bundle");
  if (root.format !== DOSSIER_BUNDLE_FORMAT || root.contract_registry !== DOSSIER_CONTRACT_REGISTRY_ID || root.contract_version !== DOSSIER_CONTRACT_VERSION) fail("UNKNOWN_SCHEMA", "$bundle.identity");
  if (root.schema_version !== DOSSIER_CONTRACT_SCHEMA_VERSION) fail("UNKNOWN_SCHEMA", "$bundle.schema_version");
  const parsed: DossierContractBundleV1 = {
    format: DOSSIER_BUNDLE_FORMAT,
    schema_version: DOSSIER_CONTRACT_SCHEMA_VERSION,
    contract_registry: DOSSIER_CONTRACT_REGISTRY_ID,
    contract_version: DOSSIER_CONTRACT_VERSION,
    export_id: opaqueId(root.export_id, "$bundle.export_id"),
    exported_at: timestamp(root.exported_at, "$bundle.exported_at"),
    exported_by: referenceId(root.exported_by, "$bundle.exported_by"),
    dossiers: objectArray(root.dossiers, "$bundle.dossiers", "dossier", [
      "object_type", "schema_version", "dossier_id", "reference", "title", "dossier_type", "terminology",
      "owner_actor_id", "organisation_id", "jurisdictions", "classification", "priority", "status",
      "status_reason", "key_deadline", "revision", "created_at", "created_by", "updated_at", "updated_by",
      "closure", "archive", "participant_ids", "document_ids", "information_request_ids",
      "decision_package_reference_ids", "output_ids", "audit_event_ids",
    ], validateDossier),
    participants: objectArray(root.participants, "$bundle.participants", "participant", [
      "object_type", "schema_version", "participant_id", "dossier_id", "actor_id", "display_name", "role",
      "status", "created_at", "created_by", "updated_at", "updated_by",
    ], validateParticipant),
    status_transitions: objectArray(root.status_transitions, "$bundle.status_transitions", "status_transition", [
      "object_type", "schema_version", "transition_id", "dossier_id", "previous_status", "new_status",
      "revision_before", "revision_after", "approved_output_id", "actor_id", "actor_role", "occurred_at", "reason", "comment", "platform_admin_override",
      "had_current_output", "had_reviewer_approval", "consequences",
    ], validateStatusTransition),
    documents: objectArray(root.documents, "$bundle.documents", "document", [
      "object_type", "schema_version", "document_id", "dossier_id", "title", "document_type",
      "source_origin", "classification", "current_version_id", "status", "tags",
      "external_system_reference", "created_at", "created_by", "updated_at", "updated_by",
    ], validateDocument),
    document_versions: objectArray(root.document_versions, "$bundle.document_versions", "document_version", [
      "object_type", "schema_version", "document_version_id", "dossier_id", "document_id", "ordinal",
      "binary_object_reference", "original_filename", "media_type", "byte_length", "content_sha256",
      "uploader_actor_id", "uploaded_at", "extraction_status", "extraction_error_code",
      "extracted_text_version", "extracted_text_checksum", "page_map", "predecessor_version_id",
      "source_note", "created_at", "created_by",
    ], validateDocumentVersion),
    source_anchors: objectArray(root.source_anchors, "$bundle.source_anchors", "source_anchor", [
      "object_type", "schema_version", "source_anchor_id", "dossier_id", "document_id",
      "document_version_id", "page_number", "section", "heading", "paragraph", "character_start",
      "character_end", "excerpt", "anchor_checksum", "extraction_version", "creator", "review_state",
      "reviewer_actor_id", "reviewed_at", "created_at", "created_by",
    ], validateSourceAnchor),
    professional_assertions: objectArray(root.professional_assertions, "$bundle.professional_assertions", "professional_assertion", [
      "object_type", "schema_version", "assertion_id", "dossier_id", "assertion_type", "statement",
      "status", "source_anchor_ids", "originating_proposal_id", "reviewed_by", "reviewed_at",
      "created_at", "created_by", "updated_at", "updated_by",
    ], validateProfessionalAssertion),
    evidence_links: objectArray(root.evidence_links, "$bundle.evidence_links", "evidence_link", [
      "object_type", "schema_version", "evidence_link_id", "dossier_id", "source_anchor_id",
      "assertion_id", "decision_package_reference_id", "target_type", "target_id", "relation", "professional_meaning",
      "created_at", "created_by", "reviewed_by", "reviewed_at",
    ], validateEvidenceLink),
    information_requests: objectArray(root.information_requests, "$bundle.information_requests", "information_request", [
      "object_type", "schema_version", "information_request_id", "dossier_id", "question", "owner_actor_id",
      "requested_from_participant_id", "priority", "due_at", "timezone", "status", "reason",
      "readiness_reason_code", "satisfying_document_id", "satisfying_evidence_link_id",
      "created_at", "created_by", "updated_at", "updated_by",
    ], validateInformationRequest),
    deadline_references: objectArray(root.deadline_references, "$bundle.deadline_references", "deadline_reference", [
      "object_type", "schema_version", "deadline_reference_id", "dossier_id", "deadline_kind", "title",
      "due_at", "timezone", "critical", "status", "source_anchor_ids", "decision_package_reference_id",
      "simulation_deadline_id", "created_at", "created_by", "updated_at", "updated_by",
    ], validateDeadlineReference),
    decision_package_references: objectArray(root.decision_package_references, "$bundle.decision_package_references", "decision_package_reference", [
      "object_type", "schema_version", "decision_package_reference_id", "dossier_id", "package_id",
      "package_version", "package_fingerprint", "parent_package_id", "parent_package_version",
      "parent_package_fingerprint", "source_snapshot_id", "source_dossier_revision", "state",
      "graph_validation_status", "graph_digest", "simulation_run_references", "approval_state",
      "package_type", "created_at", "created_by", "updated_at", "updated_by",
    ], validateDecisionPackageReference),
    ai_proposals: objectArray(root.ai_proposals, "$bundle.ai_proposals", "ai_proposal", [
      "object_type", "schema_version", "proposal_id", "dossier_id", "source_document_version_ids",
      "source_anchor_ids", "proposal_type", "proposed_value", "confidence", "model_provenance",
      "review_state", "reviewing_actor_id", "reviewed_at", "review_note", "accepted_object_type",
      "accepted_object_id", "created_at", "created_by",
    ], validateAIProposal),
    dossier_snapshots: objectArray(root.dossier_snapshots, "$bundle.dossier_snapshots", "dossier_snapshot", [
      "object_type", "schema_version", "snapshot_id", "dossier_id", "dossier_revision",
      "document_versions", "accepted_assertion_ids", "source_anchor_ids", "decision_packages",
      "simulation_inputs", "deterministic_receipts", "status", "readiness", "approver_records",
      "locale", "audience", "classification", "redaction_profile_id", "generator",
      "manifest_digest", "created_at", "created_by",
    ], validateSnapshot),
    governed_outputs: objectArray(root.governed_outputs, "$bundle.governed_outputs", "governed_output", [
      "object_type", "schema_version", "output_id", "dossier_id", "snapshot_id", "snapshot_digest",
      "format", "content_reference", "content_sha256", "filename", "state", "stale_at",
      "stale_reason", "reviewer_actor_id", "approved_at", "generator_schema_version",
      "generator_build_version", "created_at", "created_by",
    ], validateGovernedOutput),
    audit_events: objectArray(root.audit_events, "$bundle.audit_events", "audit_event", [
      "object_type", "schema_version", "audit_event_id", "dossier_id", "dossier_revision", "sequence", "event_type",
      "object_ref_type", "object_ref_id", "actor_id", "actor_role", "occurred_at", "summary_code",
      "detail", "previous_event_id", "event_digest",
    ], validateAuditEvent),
  };
  validateBundleReferences(parsed);
  return parsed;
}

export function serializeDossierContractBundleV1(value: unknown): string {
  return canonicalDossierJson(parseDossierContractBundleV1(value));
}

export function canonicalDossierJson(value: unknown): string {
  validateJsonValue(value, "$canonical", 0);
  return JSON.stringify(canonicalize(value as JsonValue));
}

function objectArray<T>(value: unknown, path: string, objectType: DossierObjectType, keys: readonly string[], validate: (value: Record<string, unknown>, path: string) => void): T[] {
  const values = array(value, path);
  if (values.length > 10_000) fail("LIMIT_EXCEEDED", path);
  return values.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const candidate = record(item, itemPath);
    exactKeys(candidate, keys, itemPath);
    if (candidate.object_type !== objectType) fail("UNKNOWN_ENUM", `${itemPath}.object_type`);
    if (candidate.schema_version !== DOSSIER_CONTRACT_SCHEMA_VERSION) fail("UNKNOWN_SCHEMA", `${itemPath}.schema_version`);
    validate(candidate, itemPath);
    validateJsonValue(candidate, itemPath, 0);
    return JSON.parse(canonicalDossierJson(candidate)) as T;
  });
}

function validateDossier(value: Record<string, unknown>, path: string) {
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  boundedText(value.reference, `${path}.reference`, 1, 120);
  boundedText(value.title, `${path}.title`, 1, 300);
  validateRegistryReference(value.dossier_type, `${path}.dossier_type`);
  enumeration(value.terminology, DOSSIER_WIRE_ENUMS.terminology, `${path}.terminology`);
  referenceId(value.owner_actor_id, `${path}.owner_actor_id`);
  nullableReference(value.organisation_id, `${path}.organisation_id`);
  stringArray(value.jurisdictions, `${path}.jurisdictions`, 1, 20, 160);
  enumeration(value.classification, DOSSIER_WIRE_ENUMS.classification, `${path}.classification`);
  enumeration(value.priority, DOSSIER_WIRE_ENUMS.priority, `${path}.priority`);
  enumeration(value.status, DOSSIER_STATUSES, `${path}.status`);
  nullableText(value.status_reason, `${path}.status_reason`, 500);
  if (value.key_deadline !== null) {
    const deadline = record(value.key_deadline, `${path}.key_deadline`);
    exactKeys(deadline, ["at", "timezone"], `${path}.key_deadline`);
    timestamp(deadline.at, `${path}.key_deadline.at`);
    timezone(deadline.timezone, `${path}.key_deadline.timezone`);
  }
  positiveInteger(value.revision, `${path}.revision`);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
  timestamp(value.updated_at, `${path}.updated_at`);
  referenceId(value.updated_by, `${path}.updated_by`);
  validateClosure(value.closure, `${path}.closure`);
  validateArchive(value.archive, `${path}.archive`);
  idArray(value.participant_ids, `${path}.participant_ids`);
  idArray(value.document_ids, `${path}.document_ids`);
  idArray(value.information_request_ids, `${path}.information_request_ids`);
  idArray(value.decision_package_reference_ids, `${path}.decision_package_reference_ids`);
  idArray(value.output_ids, `${path}.output_ids`);
  idArray(value.audit_event_ids, `${path}.audit_event_ids`);
}

function validateParticipant(value: Record<string, unknown>, path: string) {
  opaqueId(value.participant_id, `${path}.participant_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  referenceId(value.actor_id, `${path}.actor_id`);
  boundedText(value.display_name, `${path}.display_name`, 1, 200);
  enumeration(value.role, DOSSIER_ROLES, `${path}.role`);
  enumeration(value.status, DOSSIER_WIRE_ENUMS.participant_status, `${path}.status`);
  auditMetadata(value, path);
}

function validateStatusTransition(value: Record<string, unknown>, path: string) {
  opaqueId(value.transition_id, `${path}.transition_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  enumeration(value.previous_status, DOSSIER_STATUSES, `${path}.previous_status`);
  enumeration(value.new_status, DOSSIER_STATUSES, `${path}.new_status`);
  const revisionBefore = positiveInteger(value.revision_before, `${path}.revision_before`);
  const revisionAfter = positiveInteger(value.revision_after, `${path}.revision_after`);
  if (revisionAfter !== revisionBefore + 1) fail("INVALID_TRANSITION", `${path}.revision_after`);
  const approvedOutputId = nullableOpaqueId(value.approved_output_id, `${path}.approved_output_id`);
  if ((value.new_status === "output_approved") !== (approvedOutputId !== null)) fail("INVALID_TRANSITION", `${path}.approved_output_id`);
  referenceId(value.actor_id, `${path}.actor_id`);
  if (value.actor_role !== "platform_admin") enumeration(value.actor_role, DOSSIER_ROLES, `${path}.actor_role`);
  timestamp(value.occurred_at, `${path}.occurred_at`);
  nullableText(value.reason, `${path}.reason`, 1_000);
  nullableText(value.comment, `${path}.comment`, 2_000);
  booleanValue(value.platform_admin_override, `${path}.platform_admin_override`);
  booleanValue(value.had_current_output, `${path}.had_current_output`);
  booleanValue(value.had_reviewer_approval, `${path}.had_reviewer_approval`);
  const consequences = enumArray(value.consequences, DOSSIER_TRANSITION_CONSEQUENCES, `${path}.consequences`, 1);
  const decision = dossierStatusTransitionDecision({
    from: value.previous_status,
    to: value.new_status,
    actor_role: value.actor_role,
    reason: value.reason,
    has_current_output: value.had_current_output === true,
    has_reviewer_approval: value.had_reviewer_approval === true,
    platform_admin_override: value.platform_admin_override === true,
  });
  if (!decision.allowed || !sameArray(consequences, decision.consequences)) fail("INVALID_TRANSITION", path);
}

function validateDocument(value: Record<string, unknown>, path: string) {
  opaqueId(value.document_id, `${path}.document_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  boundedText(value.title, `${path}.title`, 1, 300);
  boundedText(value.document_type, `${path}.document_type`, 1, 120);
  enumeration(value.source_origin, DOSSIER_WIRE_ENUMS.document_source_origin, `${path}.source_origin`);
  enumeration(value.classification, DOSSIER_WIRE_ENUMS.classification, `${path}.classification`);
  opaqueId(value.current_version_id, `${path}.current_version_id`);
  enumeration(value.status, DOSSIER_WIRE_ENUMS.document_status, `${path}.status`);
  stringArray(value.tags, `${path}.tags`, 0, 50, 100);
  nullableText(value.external_system_reference, `${path}.external_system_reference`, 300);
  auditMetadata(value, path);
}

function validateDocumentVersion(value: Record<string, unknown>, path: string) {
  opaqueId(value.document_version_id, `${path}.document_version_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  opaqueId(value.document_id, `${path}.document_id`);
  positiveInteger(value.ordinal, `${path}.ordinal`);
  boundedText(value.binary_object_reference, `${path}.binary_object_reference`, 16, 500);
  const filename = boundedText(value.original_filename, `${path}.original_filename`, 1, 255);
  if (filename === "." || filename === ".." || filename.includes("/") || filename.includes("\\")) fail("INVALID_SHAPE", `${path}.original_filename`);
  enumeration(value.media_type, DOSSIER_WIRE_ENUMS.document_media_type, `${path}.media_type`);
  boundedInteger(value.byte_length, `${path}.byte_length`, 1, 100_000_000);
  sha256(value.content_sha256, `${path}.content_sha256`);
  referenceId(value.uploader_actor_id, `${path}.uploader_actor_id`);
  timestamp(value.uploaded_at, `${path}.uploaded_at`);
  const extractionStatus = enumeration(value.extraction_status, DOSSIER_WIRE_ENUMS.extraction_status, `${path}.extraction_status`);
  if (value.extraction_error_code !== null) enumeration(value.extraction_error_code, DOSSIER_WIRE_ENUMS.extraction_error_code, `${path}.extraction_error_code`);
  nullableText(value.extracted_text_version, `${path}.extracted_text_version`, 100);
  if (value.extracted_text_checksum !== null) sha256(value.extracted_text_checksum, `${path}.extracted_text_checksum`);
  if (extractionStatus === "ready" && (value.extracted_text_version === null || value.extracted_text_checksum === null || value.extraction_error_code !== null)) fail("INVALID_SHAPE", `${path}.extraction_status`);
  if ((extractionStatus === "failed" || extractionStatus === "not_extractable") && value.extraction_error_code === null) fail("INVALID_SHAPE", `${path}.extraction_error_code`);
  if ((extractionStatus === "queued" || extractionStatus === "processing") && (value.extraction_error_code !== null || value.extracted_text_version !== null || value.extracted_text_checksum !== null)) fail("INVALID_SHAPE", `${path}.extraction_status`);
  const pageNumbers = new Set<number>();
  for (const [index, item] of array(value.page_map, `${path}.page_map`).entries()) {
    const pagePath = `${path}.page_map[${index}]`;
    const page = record(item, pagePath);
    exactKeys(page, ["page_number", "section_id", "heading", "start_offset", "end_offset", "checksum"], pagePath);
    const pageNumber = positiveInteger(page.page_number, `${pagePath}.page_number`);
    if (pageNumbers.has(pageNumber)) fail("INVALID_SHAPE", `${pagePath}.page_number`);
    pageNumbers.add(pageNumber);
    nullableText(page.section_id, `${pagePath}.section_id`, 160);
    nullableText(page.heading, `${pagePath}.heading`, 500);
    const start = boundedInteger(page.start_offset, `${pagePath}.start_offset`, 0, 100_000_000);
    const end = boundedInteger(page.end_offset, `${pagePath}.end_offset`, 0, 100_000_000);
    if (end < start) fail("INVALID_SHAPE", pagePath);
    sha256(page.checksum, `${pagePath}.checksum`);
  }
  nullableOpaqueId(value.predecessor_version_id, `${path}.predecessor_version_id`);
  nullableText(value.source_note, `${path}.source_note`, 1_000);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
}

function validateSourceAnchor(value: Record<string, unknown>, path: string) {
  opaqueId(value.source_anchor_id, `${path}.source_anchor_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  opaqueId(value.document_id, `${path}.document_id`);
  opaqueId(value.document_version_id, `${path}.document_version_id`);
  nullablePositiveInteger(value.page_number, `${path}.page_number`);
  nullableText(value.section, `${path}.section`, 500);
  nullableText(value.heading, `${path}.heading`, 500);
  nullableText(value.paragraph, `${path}.paragraph`, 500);
  const start = nullableBoundedInteger(value.character_start, `${path}.character_start`, 0, 100_000_000);
  const end = nullableBoundedInteger(value.character_end, `${path}.character_end`, 0, 100_000_000);
  if ((start === null) !== (end === null) || (start !== null && end !== null && end < start)) fail("INVALID_SHAPE", path);
  nullableText(value.excerpt, `${path}.excerpt`, 500);
  sha256(value.anchor_checksum, `${path}.anchor_checksum`);
  nullableText(value.extraction_version, `${path}.extraction_version`, 100);
  enumeration(value.creator, DOSSIER_WIRE_ENUMS.anchor_creator, `${path}.creator`);
  const reviewState = enumeration(value.review_state, DOSSIER_WIRE_ENUMS.review_state, `${path}.review_state`);
  nullableReference(value.reviewer_actor_id, `${path}.reviewer_actor_id`);
  nullableTimestamp(value.reviewed_at, `${path}.reviewed_at`);
  if ((reviewState === "accepted" || reviewState === "rejected") !== (value.reviewer_actor_id !== null && value.reviewed_at !== null)) fail("INVALID_SHAPE", `${path}.review_state`);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
}

function validateProfessionalAssertion(value: Record<string, unknown>, path: string) {
  opaqueId(value.assertion_id, `${path}.assertion_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  enumeration(value.assertion_type, DOSSIER_WIRE_ENUMS.assertion_type, `${path}.assertion_type`);
  boundedText(value.statement, `${path}.statement`, 1, 8_000);
  const status = enumeration(value.status, DOSSIER_WIRE_ENUMS.assertion_status, `${path}.status`);
  const anchors = idArray(value.source_anchor_ids, `${path}.source_anchor_ids`);
  nullableOpaqueId(value.originating_proposal_id, `${path}.originating_proposal_id`);
  nullableReference(value.reviewed_by, `${path}.reviewed_by`);
  nullableTimestamp(value.reviewed_at, `${path}.reviewed_at`);
  if (status === "accepted" && (!anchors.length || value.reviewed_by === null || value.reviewed_at === null)) fail("INVALID_SHAPE", `${path}.status`);
  if (status === "needs_review" && (value.reviewed_by !== null || value.reviewed_at !== null)) fail("INVALID_SHAPE", `${path}.status`);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
  timestamp(value.updated_at, `${path}.updated_at`);
  referenceId(value.updated_by, `${path}.updated_by`);
}

function validateEvidenceLink(value: Record<string, unknown>, path: string) {
  opaqueId(value.evidence_link_id, `${path}.evidence_link_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  opaqueId(value.source_anchor_id, `${path}.source_anchor_id`);
  nullableOpaqueId(value.assertion_id, `${path}.assertion_id`);
  const packageReferenceId = nullableOpaqueId(value.decision_package_reference_id, `${path}.decision_package_reference_id`);
  const targetType = enumeration(value.target_type, DOSSIER_WIRE_ENUMS.evidence_target_type, `${path}.target_type`);
  referenceId(value.target_id, `${path}.target_id`);
  enumeration(value.relation, DOSSIER_WIRE_ENUMS.evidence_relation, `${path}.relation`);
  boundedText(value.professional_meaning, `${path}.professional_meaning`, 1, 1_000);
  if (targetType === "professional_assertion" && value.assertion_id !== value.target_id) fail("INVALID_REFERENCE", `${path}.target_id`);
  const targetsDecisionGraph = targetType === "graph_node" || targetType === "graph_edge";
  if (targetsDecisionGraph !== (packageReferenceId !== null)) fail("INVALID_REFERENCE", `${path}.decision_package_reference_id`);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
  referenceId(value.reviewed_by, `${path}.reviewed_by`);
  timestamp(value.reviewed_at, `${path}.reviewed_at`);
}

function validateInformationRequest(value: Record<string, unknown>, path: string) {
  opaqueId(value.information_request_id, `${path}.information_request_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  boundedText(value.question, `${path}.question`, 1, 4_000);
  referenceId(value.owner_actor_id, `${path}.owner_actor_id`);
  nullableOpaqueId(value.requested_from_participant_id, `${path}.requested_from_participant_id`);
  enumeration(value.priority, DOSSIER_WIRE_ENUMS.priority, `${path}.priority`);
  nullableTimestamp(value.due_at, `${path}.due_at`);
  if (value.timezone !== null) timezone(value.timezone, `${path}.timezone`);
  if ((value.due_at === null) !== (value.timezone === null)) fail("INVALID_SHAPE", path);
  const status = enumeration(value.status, DOSSIER_WIRE_ENUMS.information_request_status, `${path}.status`);
  boundedText(value.reason, `${path}.reason`, 1, 1_000);
  const readinessCode = enumeration(value.readiness_reason_code, DOSSIER_READINESS_REASON_CODES, `${path}.readiness_reason_code`);
  if (!["INFORMATION_REQUEST_OPEN", "INFORMATION_REQUEST_OVERDUE"].includes(readinessCode)) fail("INVALID_SHAPE", `${path}.readiness_reason_code`);
  nullableOpaqueId(value.satisfying_document_id, `${path}.satisfying_document_id`);
  nullableOpaqueId(value.satisfying_evidence_link_id, `${path}.satisfying_evidence_link_id`);
  if (status === "received" && value.satisfying_document_id === null && value.satisfying_evidence_link_id === null) fail("INVALID_SHAPE", `${path}.status`);
  auditMetadata(value, path);
}

function validateDeadlineReference(value: Record<string, unknown>, path: string) {
  opaqueId(value.deadline_reference_id, `${path}.deadline_reference_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  const kind = enumeration(value.deadline_kind, DOSSIER_WIRE_ENUMS.deadline_kind, `${path}.deadline_kind`);
  boundedText(value.title, `${path}.title`, 1, 500);
  timestamp(value.due_at, `${path}.due_at`);
  timezone(value.timezone, `${path}.timezone`);
  booleanValue(value.critical, `${path}.critical`);
  enumeration(value.status, DOSSIER_WIRE_ENUMS.deadline_status, `${path}.status`);
  idArray(value.source_anchor_ids, `${path}.source_anchor_ids`);
  nullableOpaqueId(value.decision_package_reference_id, `${path}.decision_package_reference_id`);
  nullableReference(value.simulation_deadline_id, `${path}.simulation_deadline_id`);
  if (kind === "workspace" && (value.decision_package_reference_id !== null || value.simulation_deadline_id !== null)) fail("INVALID_SHAPE", `${path}.deadline_kind`);
  if (kind === "projected_simulation" && (value.decision_package_reference_id === null || value.simulation_deadline_id === null)) fail("INVALID_SHAPE", `${path}.deadline_kind`);
  auditMetadata(value, path);
}

function validateDecisionPackageReference(value: Record<string, unknown>, path: string) {
  opaqueId(value.decision_package_reference_id, `${path}.decision_package_reference_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  referenceId(value.package_id, `${path}.package_id`);
  semanticVersion(value.package_version, `${path}.package_version`);
  sha256(value.package_fingerprint, `${path}.package_fingerprint`);
  nullableReference(value.parent_package_id, `${path}.parent_package_id`);
  if (value.parent_package_version !== null) semanticVersion(value.parent_package_version, `${path}.parent_package_version`);
  if (value.parent_package_fingerprint !== null) sha256(value.parent_package_fingerprint, `${path}.parent_package_fingerprint`);
  const hasParent = value.parent_package_id !== null;
  if (hasParent !== (value.parent_package_version !== null) || hasParent !== (value.parent_package_fingerprint !== null)) fail("INVALID_SHAPE", `${path}.parent_package_id`);
  nullableOpaqueId(value.source_snapshot_id, `${path}.source_snapshot_id`);
  positiveInteger(value.source_dossier_revision, `${path}.source_dossier_revision`);
  enumeration(value.state, DOSSIER_WIRE_ENUMS.decision_package_state, `${path}.state`);
  enumeration(value.graph_validation_status, DOSSIER_WIRE_ENUMS.graph_validation_status, `${path}.graph_validation_status`);
  sha256(value.graph_digest, `${path}.graph_digest`);
  referenceArray(value.simulation_run_references, `${path}.simulation_run_references`);
  enumeration(value.approval_state, DOSSIER_WIRE_ENUMS.package_approval_state, `${path}.approval_state`);
  validateRegistryReference(value.package_type, `${path}.package_type`);
  auditMetadata(value, path);
}

function validateAIProposal(value: Record<string, unknown>, path: string) {
  opaqueId(value.proposal_id, `${path}.proposal_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  const sourceVersions = idArray(value.source_document_version_ids, `${path}.source_document_version_ids`);
  const anchors = idArray(value.source_anchor_ids, `${path}.source_anchor_ids`);
  if (!sourceVersions.length || !anchors.length) fail("INVALID_SHAPE", path);
  enumeration(value.proposal_type, DOSSIER_WIRE_ENUMS.proposal_type, `${path}.proposal_type`);
  validateJsonValue(value.proposed_value, `${path}.proposed_value`, 0);
  if (canonicalDossierJson(value.proposed_value).length > 65_536) fail("LIMIT_EXCEEDED", `${path}.proposed_value`);
  if (value.confidence !== null) {
    const confidence = record(value.confidence, `${path}.confidence`);
    exactKeys(confidence, ["category", "score"], `${path}.confidence`);
    enumeration(confidence.category, DOSSIER_WIRE_ENUMS.confidence_category, `${path}.confidence.category`);
    if (confidence.score !== null && (typeof confidence.score !== "number" || !Number.isFinite(confidence.score) || confidence.score < 0 || confidence.score > 1)) fail("INVALID_SHAPE", `${path}.confidence.score`);
  }
  if (value.model_provenance !== null) {
    const provenance = record(value.model_provenance, `${path}.model_provenance`);
    exactKeys(provenance, ["provider", "model", "configuration_digest"], `${path}.model_provenance`);
    boundedText(provenance.provider, `${path}.model_provenance.provider`, 1, 100);
    boundedText(provenance.model, `${path}.model_provenance.model`, 1, 160);
    sha256(provenance.configuration_digest, `${path}.model_provenance.configuration_digest`);
  }
  const reviewState = enumeration(value.review_state, DOSSIER_WIRE_ENUMS.review_state, `${path}.review_state`);
  nullableReference(value.reviewing_actor_id, `${path}.reviewing_actor_id`);
  nullableTimestamp(value.reviewed_at, `${path}.reviewed_at`);
  nullableText(value.review_note, `${path}.review_note`, 2_000);
  if (value.accepted_object_type !== null) enumeration(value.accepted_object_type, DOSSIER_PROPOSAL_ACCEPTED_OBJECT_TYPES, `${path}.accepted_object_type`);
  nullableReference(value.accepted_object_id, `${path}.accepted_object_id`);
  const reviewed = value.reviewing_actor_id !== null && value.reviewed_at !== null;
  if ((reviewState === "accepted" || reviewState === "rejected") !== reviewed) fail("INVALID_SHAPE", `${path}.review_state`);
  if (reviewState === "accepted" && (value.accepted_object_type === null || value.accepted_object_id === null)) fail("INVALID_SHAPE", `${path}.accepted_object_id`);
  if (reviewState !== "accepted" && (value.accepted_object_type !== null || value.accepted_object_id !== null)) fail("INVALID_SHAPE", `${path}.accepted_object_id`);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
}

function validateSnapshot(value: Record<string, unknown>, path: string) {
  opaqueId(value.snapshot_id, `${path}.snapshot_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  positiveInteger(value.dossier_revision, `${path}.dossier_revision`);
  for (const [index, item] of array(value.document_versions, `${path}.document_versions`).entries()) {
    const itemPath = `${path}.document_versions[${index}]`;
    const entry = record(item, itemPath);
    exactKeys(entry, ["document_id", "document_version_id", "content_sha256"], itemPath);
    opaqueId(entry.document_id, `${itemPath}.document_id`);
    opaqueId(entry.document_version_id, `${itemPath}.document_version_id`);
    sha256(entry.content_sha256, `${itemPath}.content_sha256`);
  }
  idArray(value.accepted_assertion_ids, `${path}.accepted_assertion_ids`);
  idArray(value.source_anchor_ids, `${path}.source_anchor_ids`);
  for (const [index, item] of array(value.decision_packages, `${path}.decision_packages`).entries()) {
    const itemPath = `${path}.decision_packages[${index}]`;
    const entry = record(item, itemPath);
    exactKeys(entry, ["decision_package_reference_id", "package_id", "package_version", "graph_digest", "simulation_receipt_ids"], itemPath);
    opaqueId(entry.decision_package_reference_id, `${itemPath}.decision_package_reference_id`);
    referenceId(entry.package_id, `${itemPath}.package_id`);
    semanticVersion(entry.package_version, `${itemPath}.package_version`);
    sha256(entry.graph_digest, `${itemPath}.graph_digest`);
    referenceArray(entry.simulation_receipt_ids, `${itemPath}.simulation_receipt_ids`);
  }
  validateJsonValue(value.simulation_inputs, `${path}.simulation_inputs`, 0);
  validateJsonValue(value.deterministic_receipts, `${path}.deterministic_receipts`, 0);
  enumeration(value.status, DOSSIER_STATUSES, `${path}.status`);
  validateReadiness(value.readiness, `${path}.readiness`);
  for (const [index, item] of array(value.approver_records, `${path}.approver_records`).entries()) {
    const itemPath = `${path}.approver_records[${index}]`;
    const entry = record(item, itemPath);
    exactKeys(entry, ["reviewer_actor_id", "approved_at", "output_id"], itemPath);
    referenceId(entry.reviewer_actor_id, `${itemPath}.reviewer_actor_id`);
    timestamp(entry.approved_at, `${itemPath}.approved_at`);
    nullableOpaqueId(entry.output_id, `${itemPath}.output_id`);
  }
  boundedText(value.locale, `${path}.locale`, 2, 20);
  enumeration(value.audience, DOSSIER_WIRE_ENUMS.audience, `${path}.audience`);
  enumeration(value.classification, DOSSIER_WIRE_ENUMS.classification, `${path}.classification`);
  referenceId(value.redaction_profile_id, `${path}.redaction_profile_id`);
  const generator = record(value.generator, `${path}.generator`);
  exactKeys(generator, ["contract_version", "report_model_schema_version", "renderer_version", "build_version"], `${path}.generator`);
  if (generator.contract_version !== DOSSIER_CONTRACT_VERSION) fail("UNKNOWN_SCHEMA", `${path}.generator.contract_version`);
  positiveInteger(generator.report_model_schema_version, `${path}.generator.report_model_schema_version`);
  boundedText(generator.renderer_version, `${path}.generator.renderer_version`, 1, 100);
  boundedText(generator.build_version, `${path}.generator.build_version`, 1, 160);
  sha256(value.manifest_digest, `${path}.manifest_digest`);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
}

function validateReadiness(value: unknown, path: string) {
  const readiness = record(value, path);
  exactKeys(readiness, ["schema_version", "dossier_id", "computed_from_revision", "evaluated_at", "ready", "dimensions"], path);
  if (readiness.schema_version !== DOSSIER_CONTRACT_SCHEMA_VERSION) fail("UNKNOWN_SCHEMA", `${path}.schema_version`);
  opaqueId(readiness.dossier_id, `${path}.dossier_id`);
  positiveInteger(readiness.computed_from_revision, `${path}.computed_from_revision`);
  timestamp(readiness.evaluated_at, `${path}.evaluated_at`);
  booleanValue(readiness.ready, `${path}.ready`);
  const dimensions = array(readiness.dimensions, `${path}.dimensions`).map((item, index) => {
    const itemPath = `${path}.dimensions[${index}]`;
    const dimension = record(item, itemPath);
    exactKeys(dimension, ["dimension", "state", "reasons"], itemPath);
    const dimensionId = enumeration(dimension.dimension, DOSSIER_READINESS_DIMENSIONS, `${itemPath}.dimension`);
    const state = enumeration(dimension.state, DOSSIER_WIRE_ENUMS.readiness_state, `${itemPath}.state`);
    const reasons = array(dimension.reasons, `${itemPath}.reasons`).map((reasonItem, reasonIndex) => {
      const reasonPath = `${itemPath}.reasons[${reasonIndex}]`;
      const reason = record(reasonItem, reasonPath);
      exactKeys(reason, ["code", "explanation", "deep_link", "related_object_type", "related_object_id"], reasonPath);
      const definition = readinessReasonDefinition(reason.code);
      if (definition.dimension !== dimensionId || reason.explanation !== definition.explanation) fail("INVALID_SHAPE", reasonPath);
      const deepLink = boundedText(reason.deep_link, `${reasonPath}.deep_link`, 1, 500);
      if (!deepLink.startsWith(definition.deep_link_prefix) || deepLink.startsWith("//")) fail("INVALID_SHAPE", `${reasonPath}.deep_link`);
      if (reason.related_object_type !== null) enumeration(reason.related_object_type, DOSSIER_OBJECT_TYPES, `${reasonPath}.related_object_type`);
      nullableReference(reason.related_object_id, `${reasonPath}.related_object_id`);
      if ((reason.related_object_type === null) !== (reason.related_object_id === null)) fail("INVALID_SHAPE", reasonPath);
      return definition.code;
    });
    if ((state === "blocked") !== (reasons.length > 0)) fail("INVALID_SHAPE", itemPath);
    return { dimensionId, state };
  });
  exactLiteralArray(dimensions.map(({ dimensionId }) => dimensionId), DOSSIER_READINESS_DIMENSIONS, `${path}.dimensions.order`);
  const computedReady = dimensions.every(({ state }) => state !== "blocked");
  if (readiness.ready !== computedReady) fail("INVALID_SHAPE", `${path}.ready`);
}

function validateGovernedOutput(value: Record<string, unknown>, path: string) {
  opaqueId(value.output_id, `${path}.output_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  opaqueId(value.snapshot_id, `${path}.snapshot_id`);
  sha256(value.snapshot_digest, `${path}.snapshot_digest`);
  enumeration(value.format, DOSSIER_WIRE_ENUMS.output_format, `${path}.format`);
  privateObjectReference(value.content_reference, `${path}.content_reference`);
  sha256(value.content_sha256, `${path}.content_sha256`);
  const filename = boundedText(value.filename, `${path}.filename`, 1, 255);
  if (filename.includes("/") || filename.includes("\\")) fail("INVALID_SHAPE", `${path}.filename`);
  const state = enumeration(value.state, DOSSIER_WIRE_ENUMS.output_state, `${path}.state`);
  nullableTimestamp(value.stale_at, `${path}.stale_at`);
  nullableText(value.stale_reason, `${path}.stale_reason`, 1_000);
  if ((state === "stale") !== (value.stale_at !== null && value.stale_reason !== null)) fail("INVALID_SHAPE", `${path}.state`);
  nullableReference(value.reviewer_actor_id, `${path}.reviewer_actor_id`);
  nullableTimestamp(value.approved_at, `${path}.approved_at`);
  if ((value.reviewer_actor_id === null) !== (value.approved_at === null)) fail("INVALID_SHAPE", `${path}.approved_at`);
  positiveInteger(value.generator_schema_version, `${path}.generator_schema_version`);
  boundedText(value.generator_build_version, `${path}.generator_build_version`, 1, 160);
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
}

function validateAuditEvent(value: Record<string, unknown>, path: string) {
  opaqueId(value.audit_event_id, `${path}.audit_event_id`);
  opaqueId(value.dossier_id, `${path}.dossier_id`);
  positiveInteger(value.dossier_revision, `${path}.dossier_revision`);
  positiveInteger(value.sequence, `${path}.sequence`);
  enumeration(value.event_type, DOSSIER_AUDIT_EVENT_TYPES, `${path}.event_type`);
  enumeration(value.object_ref_type, DOSSIER_OBJECT_TYPES, `${path}.object_ref_type`);
  referenceId(value.object_ref_id, `${path}.object_ref_id`);
  referenceId(value.actor_id, `${path}.actor_id`);
  enumeration(value.actor_role, DOSSIER_WIRE_ENUMS.audit_actor_role, `${path}.actor_role`);
  timestamp(value.occurred_at, `${path}.occurred_at`);
  boundedText(value.summary_code, `${path}.summary_code`, 1, 120);
  validateJsonValue(value.detail, `${path}.detail`, 0);
  if (canonicalDossierJson(value.detail).length > 16_384) fail("LIMIT_EXCEEDED", `${path}.detail`);
  nullableOpaqueId(value.previous_event_id, `${path}.previous_event_id`);
  sha256(value.event_digest, `${path}.event_digest`);
}

function validateBundleReferences(bundle: DossierContractBundleV1) {
  const dossiers = indexBy(bundle.dossiers, "dossier_id", "$bundle.dossiers");
  const participants = indexBy(bundle.participants, "participant_id", "$bundle.participants");
  const transitions = indexBy(bundle.status_transitions, "transition_id", "$bundle.status_transitions");
  const documents = indexBy(bundle.documents, "document_id", "$bundle.documents");
  const versions = indexBy(bundle.document_versions, "document_version_id", "$bundle.document_versions");
  const anchors = indexBy(bundle.source_anchors, "source_anchor_id", "$bundle.source_anchors");
  const assertions = indexBy(bundle.professional_assertions, "assertion_id", "$bundle.professional_assertions");
  const evidenceLinks = indexBy(bundle.evidence_links, "evidence_link_id", "$bundle.evidence_links");
  const requests = indexBy(bundle.information_requests, "information_request_id", "$bundle.information_requests");
  const deadlines = indexBy(bundle.deadline_references, "deadline_reference_id", "$bundle.deadline_references");
  const packages = indexBy(bundle.decision_package_references, "decision_package_reference_id", "$bundle.decision_package_references");
  const proposals = indexBy(bundle.ai_proposals, "proposal_id", "$bundle.ai_proposals");
  const snapshots = indexBy(bundle.dossier_snapshots, "snapshot_id", "$bundle.dossier_snapshots");
  const outputs = indexBy(bundle.governed_outputs, "output_id", "$bundle.governed_outputs");
  const audits = indexBy(bundle.audit_events, "audit_event_id", "$bundle.audit_events");
  const objectMaps: Record<DossierObjectType, Map<string, { dossier_id?: string }>> = {
    dossier: dossiers,
    participant: participants,
    status_transition: transitions,
    document: documents,
    document_version: versions,
    source_anchor: anchors,
    professional_assertion: assertions,
    evidence_link: evidenceLinks,
    information_request: requests,
    deadline_reference: deadlines,
    decision_package_reference: packages,
    ai_proposal: proposals,
    dossier_snapshot: snapshots,
    governed_output: outputs,
    audit_event: audits,
  };

  const globallyUniqueObjectIds = new Set<string>();
  for (const map of Object.values(objectMaps)) for (const id of map.keys()) {
    if (globallyUniqueObjectIds.has(id)) fail("INVALID_REFERENCE", `$bundle.duplicate_object_id.${id}`);
    globallyUniqueObjectIds.add(id);
  }

  for (const dossier of bundle.dossiers) {
    const dossierPath = `$bundle.dossiers.${dossier.dossier_id}`;
    exactDossierLinks(dossier.participant_ids, bundle.participants, "participant_id", dossier.dossier_id, `${dossierPath}.participant_ids`);
    exactDossierLinks(dossier.document_ids, bundle.documents, "document_id", dossier.dossier_id, `${dossierPath}.document_ids`);
    exactDossierLinks(dossier.information_request_ids, bundle.information_requests, "information_request_id", dossier.dossier_id, `${dossierPath}.information_request_ids`);
    exactDossierLinks(dossier.decision_package_reference_ids, bundle.decision_package_references, "decision_package_reference_id", dossier.dossier_id, `${dossierPath}.decision_package_reference_ids`);
    exactDossierLinks(dossier.output_ids, bundle.governed_outputs, "output_id", dossier.dossier_id, `${dossierPath}.output_ids`);
    exactDossierLinks(dossier.audit_event_ids, bundle.audit_events, "audit_event_id", dossier.dossier_id, `${dossierPath}.audit_event_ids`);
    const owner = bundle.participants.find((participant) => participant.dossier_id === dossier.dossier_id && participant.actor_id === dossier.owner_actor_id && participant.role === "owner" && participant.status === "active");
    if (!owner) fail("INVALID_REFERENCE", `${dossierPath}.owner_actor_id`);
    if (dossier.status === "closed" && dossier.closure === null) fail("INVALID_REFERENCE", `${dossierPath}.closure`);
    if (dossier.status === "archived" && dossier.archive === null) fail("INVALID_REFERENCE", `${dossierPath}.archive`);
    if (dossier.status === "output_approved" && !bundle.governed_outputs.some((output) =>
      output.dossier_id === dossier.dossier_id
      && output.state === "current"
      && output.reviewer_actor_id !== null
      && output.approved_at !== null
    )) fail("INVALID_REFERENCE", `${dossierPath}.status`);
  }

  for (const participant of bundle.participants) requireDossier(participant, dossiers, `$bundle.participants.${participant.participant_id}`);
  for (const transition of bundle.status_transitions) {
    requireDossier(transition, dossiers, `$bundle.status_transitions.${transition.transition_id}`);
    const dossier = dossiers.get(transition.dossier_id);
    if (!dossier || transition.revision_after > dossier.revision) fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.revision_after`);
    if (transition.actor_role !== "platform_admin" && !bundle.participants.some(({ dossier_id, actor_id, role, status }) => dossier_id === transition.dossier_id && actor_id === transition.actor_id && role === transition.actor_role && status === "active")) fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.actor_id`);
    const transitionAudits = bundle.audit_events.filter((event) => event.dossier_id === transition.dossier_id && event.event_type === "dossier_status_transitioned" && event.object_ref_type === "status_transition" && event.object_ref_id === transition.transition_id);
    if (transitionAudits.length !== 1 || transitionAudits[0].dossier_revision !== transition.revision_after) fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.audit_event`);
    if (transition.approved_output_id !== null) {
      const approvedOutput = outputs.get(transition.approved_output_id);
      if (!approvedOutput
        || approvedOutput.dossier_id !== transition.dossier_id
        || approvedOutput.state !== "current"
        || approvedOutput.reviewer_actor_id !== transition.actor_id
        || approvedOutput.approved_at === null) fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.approved_output_id`);
    }
    if (transition.platform_admin_override) {
      const overrideAudits = bundle.audit_events.filter((event) => event.dossier_id === transition.dossier_id && event.event_type === "admin_archive_override" && event.object_ref_type === "status_transition" && event.object_ref_id === transition.transition_id);
      if (overrideAudits.length !== 1) fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.admin_override_audit`);
    }
  }
  for (const dossier of bundle.dossiers) {
    const ordered = bundle.status_transitions
      .filter((transition) => transition.dossier_id === dossier.dossier_id)
      .sort((left, right) => left.revision_after - right.revision_after || left.transition_id.localeCompare(right.transition_id));
    if (!ordered.length && dossier.status !== "draft") fail("INVALID_REFERENCE", `$bundle.dossiers.${dossier.dossier_id}.status`);
    ordered.forEach((transition, index) => {
      if (index === 0 && transition.previous_status !== "draft") fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.previous_status`);
      if (index > 0 && (
        transition.previous_status !== ordered[index - 1].new_status
        || transition.revision_before < ordered[index - 1].revision_after
        || transition.occurred_at <= ordered[index - 1].occurred_at
      )) fail("INVALID_REFERENCE", `$bundle.status_transitions.${transition.transition_id}.previous_status`);
    });
    if (ordered.length && ordered.at(-1)?.new_status !== dossier.status) fail("INVALID_REFERENCE", `$bundle.dossiers.${dossier.dossier_id}.status`);
  }

  for (const document of bundle.documents) {
    requireDossier(document, dossiers, `$bundle.documents.${document.document_id}`);
    const current = versions.get(document.current_version_id);
    if (!current || current.document_id !== document.document_id || current.dossier_id !== document.dossier_id) fail("INVALID_REFERENCE", `$bundle.documents.${document.document_id}.current_version_id`);
  }
  for (const version of bundle.document_versions) requireDossier(version, dossiers, `$bundle.document_versions.${version.document_version_id}`);
  for (const document of bundle.documents) {
    const ordered = bundle.document_versions.filter((version) => version.document_id === document.document_id).sort((left, right) => left.ordinal - right.ordinal);
    if (!ordered.length) fail("INVALID_REFERENCE", `$bundle.documents.${document.document_id}.current_version_id`);
    ordered.forEach((version, index) => {
      const expectedOrdinal = index + 1;
      if (version.ordinal !== expectedOrdinal) fail("INVALID_REFERENCE", `$bundle.document_versions.${version.document_version_id}.ordinal`);
      const expectedPredecessor = index === 0 ? null : ordered[index - 1].document_version_id;
      if (version.predecessor_version_id !== expectedPredecessor || version.dossier_id !== document.dossier_id) fail("INVALID_REFERENCE", `$bundle.document_versions.${version.document_version_id}.predecessor_version_id`);
    });
    if (ordered.at(-1)?.document_version_id !== document.current_version_id) fail("INVALID_REFERENCE", `$bundle.documents.${document.document_id}.current_version_id`);
  }

  for (const anchor of bundle.source_anchors) {
    requireDossier(anchor, dossiers, `$bundle.source_anchors.${anchor.source_anchor_id}`);
    const document = documents.get(anchor.document_id);
    const version = versions.get(anchor.document_version_id);
    if (!document || !version || document.dossier_id !== anchor.dossier_id || version.dossier_id !== anchor.dossier_id || version.document_id !== anchor.document_id) fail("INVALID_REFERENCE", `$bundle.source_anchors.${anchor.source_anchor_id}.document_version_id`);
    if (anchor.extraction_version !== null && anchor.extraction_version !== version.extracted_text_version) fail("INVALID_REFERENCE", `$bundle.source_anchors.${anchor.source_anchor_id}.extraction_version`);
  }

  for (const assertion of bundle.professional_assertions) {
    requireDossier(assertion, dossiers, `$bundle.professional_assertions.${assertion.assertion_id}`);
    requireSameDossierIds(assertion.source_anchor_ids, anchors, assertion.dossier_id, `$bundle.professional_assertions.${assertion.assertion_id}.source_anchor_ids`);
    if (assertion.status === "accepted" && assertion.source_anchor_ids.some((id) => anchors.get(id)?.review_state !== "accepted")) fail("INVALID_REFERENCE", `$bundle.professional_assertions.${assertion.assertion_id}.source_anchor_ids`);
    if (assertion.originating_proposal_id !== null) requireSameDossier(assertion.originating_proposal_id, proposals, assertion.dossier_id, `$bundle.professional_assertions.${assertion.assertion_id}.originating_proposal_id`);
  }

  for (const link of bundle.evidence_links) {
    requireDossier(link, dossiers, `$bundle.evidence_links.${link.evidence_link_id}`);
    requireSameDossier(link.source_anchor_id, anchors, link.dossier_id, `$bundle.evidence_links.${link.evidence_link_id}.source_anchor_id`);
    if (anchors.get(link.source_anchor_id)?.review_state !== "accepted") fail("INVALID_REFERENCE", `$bundle.evidence_links.${link.evidence_link_id}.source_anchor_id`);
    if (link.assertion_id !== null) requireSameDossier(link.assertion_id, assertions, link.dossier_id, `$bundle.evidence_links.${link.evidence_link_id}.assertion_id`);
    if (link.decision_package_reference_id !== null) requireSameDossier(link.decision_package_reference_id, packages, link.dossier_id, `$bundle.evidence_links.${link.evidence_link_id}.decision_package_reference_id`);
  }

  for (const request of bundle.information_requests) {
    requireDossier(request, dossiers, `$bundle.information_requests.${request.information_request_id}`);
    if (request.requested_from_participant_id !== null) requireSameDossier(request.requested_from_participant_id, participants, request.dossier_id, `$bundle.information_requests.${request.information_request_id}.requested_from_participant_id`);
    if (request.satisfying_document_id !== null) requireSameDossier(request.satisfying_document_id, documents, request.dossier_id, `$bundle.information_requests.${request.information_request_id}.satisfying_document_id`);
    if (request.satisfying_evidence_link_id !== null) requireSameDossier(request.satisfying_evidence_link_id, evidenceLinks, request.dossier_id, `$bundle.information_requests.${request.information_request_id}.satisfying_evidence_link_id`);
  }

  for (const deadline of bundle.deadline_references) {
    requireDossier(deadline, dossiers, `$bundle.deadline_references.${deadline.deadline_reference_id}`);
    requireSameDossierIds(deadline.source_anchor_ids, anchors, deadline.dossier_id, `$bundle.deadline_references.${deadline.deadline_reference_id}.source_anchor_ids`);
    if (deadline.decision_package_reference_id !== null) requireSameDossier(deadline.decision_package_reference_id, packages, deadline.dossier_id, `$bundle.deadline_references.${deadline.deadline_reference_id}.decision_package_reference_id`);
  }

  for (const packageReference of bundle.decision_package_references) {
    requireDossier(packageReference, dossiers, `$bundle.decision_package_references.${packageReference.decision_package_reference_id}`);
    if (packageReference.source_snapshot_id !== null) requireSameDossier(packageReference.source_snapshot_id, snapshots, packageReference.dossier_id, `$bundle.decision_package_references.${packageReference.decision_package_reference_id}.source_snapshot_id`);
  }

  for (const proposal of bundle.ai_proposals) {
    requireDossier(proposal, dossiers, `$bundle.ai_proposals.${proposal.proposal_id}`);
    requireSameDossierIds(proposal.source_document_version_ids, versions, proposal.dossier_id, `$bundle.ai_proposals.${proposal.proposal_id}.source_document_version_ids`);
    requireSameDossierIds(proposal.source_anchor_ids, anchors, proposal.dossier_id, `$bundle.ai_proposals.${proposal.proposal_id}.source_anchor_ids`);
    const sourceVersions = new Set(proposal.source_document_version_ids);
    if (proposal.source_anchor_ids.some((id) => !sourceVersions.has(anchors.get(id)?.document_version_id ?? ""))) fail("INVALID_REFERENCE", `$bundle.ai_proposals.${proposal.proposal_id}.source_anchor_ids`);
    if (proposal.review_state === "accepted" && proposal.source_anchor_ids.some((id) => anchors.get(id)?.review_state !== "accepted")) fail("INVALID_REFERENCE", `$bundle.ai_proposals.${proposal.proposal_id}.source_anchor_ids`);
    if (proposal.accepted_object_type !== null && proposal.accepted_object_id !== null) requireSameDossier(proposal.accepted_object_id, objectMaps[proposal.accepted_object_type], proposal.dossier_id, `$bundle.ai_proposals.${proposal.proposal_id}.accepted_object_id`);
  }

  for (const snapshot of bundle.dossier_snapshots) {
    requireDossier(snapshot, dossiers, `$bundle.dossier_snapshots.${snapshot.snapshot_id}`);
    const dossier = dossiers.get(snapshot.dossier_id);
    if (!dossier || snapshot.dossier_revision > dossier.revision) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.dossier_revision`);
    if (snapshot.readiness.dossier_id !== snapshot.dossier_id || snapshot.readiness.computed_from_revision !== snapshot.dossier_revision) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.readiness`);
    const snapshotVersionIds = new Set<string>();
    for (const entry of snapshot.document_versions) {
      const version = versions.get(entry.document_version_id);
      if (!version || version.document_id !== entry.document_id || version.dossier_id !== snapshot.dossier_id || version.content_sha256 !== entry.content_sha256 || snapshotVersionIds.has(entry.document_version_id)) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.document_versions`);
      snapshotVersionIds.add(entry.document_version_id);
    }
    for (const assertionId of snapshot.accepted_assertion_ids) {
      const assertion = assertions.get(assertionId);
      if (!assertion || assertion.dossier_id !== snapshot.dossier_id || assertion.status !== "accepted") fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.accepted_assertion_ids`);
    }
    requireSameDossierIds(snapshot.source_anchor_ids, anchors, snapshot.dossier_id, `$bundle.dossier_snapshots.${snapshot.snapshot_id}.source_anchor_ids`);
    if (snapshot.source_anchor_ids.some((id) => anchors.get(id)?.review_state !== "accepted")) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.source_anchor_ids`);
    if (snapshot.dossier_revision === dossier.revision) {
      if (snapshot.status !== dossier.status) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.status`);
      const currentVersionIds = bundle.documents.filter((document) => document.dossier_id === snapshot.dossier_id).map((document) => document.current_version_id).sort();
      if (!sameArray([...snapshotVersionIds].sort(), currentVersionIds)) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.document_versions`);
      const currentAcceptedAssertionIds = bundle.professional_assertions.filter((assertion) => assertion.dossier_id === snapshot.dossier_id && assertion.status === "accepted").map((assertion) => assertion.assertion_id).sort();
      if (!sameArray([...snapshot.accepted_assertion_ids].sort(), currentAcceptedAssertionIds)) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.accepted_assertion_ids`);
      const currentAcceptedAnchorIds = bundle.source_anchors.filter((anchor) => anchor.dossier_id === snapshot.dossier_id && anchor.review_state === "accepted").map((anchor) => anchor.source_anchor_id).sort();
      if (!sameArray([...snapshot.source_anchor_ids].sort(), currentAcceptedAnchorIds)) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.source_anchor_ids`);
      const currentPackageReferenceIds = bundle.decision_package_references.filter((packageReference) => packageReference.dossier_id === snapshot.dossier_id && packageReference.state === "current").map((packageReference) => packageReference.decision_package_reference_id).sort();
      const snapshotPackageReferenceIds = snapshot.decision_packages.map((entry) => entry.decision_package_reference_id).sort();
      if (!sameArray(snapshotPackageReferenceIds, currentPackageReferenceIds)) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.decision_packages`);
    }
    const snapshotPackageReferenceIds = new Set<string>();
    for (const entry of snapshot.decision_packages) {
      const packageReference = packages.get(entry.decision_package_reference_id);
      if (!packageReference
        || packageReference.dossier_id !== snapshot.dossier_id
        || packageReference.package_id !== entry.package_id
        || packageReference.package_version !== entry.package_version
        || packageReference.graph_digest !== entry.graph_digest
        || snapshotPackageReferenceIds.has(entry.decision_package_reference_id)) fail("INVALID_REFERENCE", `$bundle.dossier_snapshots.${snapshot.snapshot_id}.decision_packages`);
      snapshotPackageReferenceIds.add(entry.decision_package_reference_id);
    }
    for (const approval of snapshot.approver_records) if (approval.output_id !== null) requireSameDossier(approval.output_id, outputs, snapshot.dossier_id, `$bundle.dossier_snapshots.${snapshot.snapshot_id}.approver_records`);
  }

  for (const output of bundle.governed_outputs) {
    requireDossier(output, dossiers, `$bundle.governed_outputs.${output.output_id}`);
    const snapshot = snapshots.get(output.snapshot_id);
    if (!snapshot || snapshot.dossier_id !== output.dossier_id || snapshot.manifest_digest !== output.snapshot_digest) fail("INVALID_REFERENCE", `$bundle.governed_outputs.${output.output_id}.snapshot_id`);
    const dossier = dossiers.get(output.dossier_id);
    if (output.state === "current"
      && dossier
      && snapshot.dossier_revision !== dossier.revision
      && !hasSoleOutputApprovalFreshnessException(output, snapshot, dossier, bundle)) fail("INVALID_REFERENCE", `$bundle.governed_outputs.${output.output_id}.state`);
    if (output.reviewer_actor_id !== null && !bundle.participants.some((participant) =>
      participant.dossier_id === output.dossier_id
      && participant.actor_id === output.reviewer_actor_id
      && participant.role === "reviewer"
      && participant.status === "active"
    )) fail("INVALID_REFERENCE", `$bundle.governed_outputs.${output.output_id}.reviewer_actor_id`);
  }

  for (const audit of bundle.audit_events) {
    requireDossier(audit, dossiers, `$bundle.audit_events.${audit.audit_event_id}`);
    const dossier = dossiers.get(audit.dossier_id);
    if (!dossier || audit.dossier_revision > dossier.revision) fail("INVALID_REFERENCE", `$bundle.audit_events.${audit.audit_event_id}.dossier_revision`);
    const target = objectMaps[audit.object_ref_type].get(audit.object_ref_id);
    if (!target || ("dossier_id" in target && target.dossier_id !== audit.dossier_id)) fail("INVALID_REFERENCE", `$bundle.audit_events.${audit.audit_event_id}.object_ref_id`);
  }
  for (const dossier of bundle.dossiers) {
    const ordered = bundle.audit_events.filter((event) => event.dossier_id === dossier.dossier_id).sort((left, right) => left.sequence - right.sequence);
    const receiptRevisions = new Set<number>();
    ordered.forEach((event, index) => {
      if (event.sequence !== index + 1 || event.previous_event_id !== (index === 0 ? null : ordered[index - 1].audit_event_id)) fail("INVALID_REFERENCE", `$bundle.audit_events.${event.audit_event_id}.sequence`);
      if (index > 0 && (
        event.dossier_revision < ordered[index - 1].dossier_revision
        || event.occurred_at < ordered[index - 1].occurred_at
      )) fail("INVALID_REFERENCE", `$bundle.audit_events.${event.audit_event_id}.dossier_revision`);
      receiptRevisions.add(event.dossier_revision);
    });
    const first = ordered[0];
    if (!first
      || first.dossier_revision !== 1
      || first.event_type !== "dossier_created"
      || first.object_ref_type !== "dossier"
      || first.object_ref_id !== dossier.dossier_id
      || receiptRevisions.size !== dossier.revision) fail("INVALID_REFERENCE", `$bundle.dossiers.${dossier.dossier_id}.audit_event_ids`);
  }
}

function hasSoleOutputApprovalFreshnessException(
  output: DossierGovernedOutputV1,
  snapshot: DossierSnapshotV1,
  dossier: DossierV1,
  bundle: DossierContractBundleV1,
): boolean {
  if (snapshot.dossier_revision + 1 !== dossier.revision
    || snapshot.status !== "internal_review"
    || dossier.status !== "output_approved"
    || output.reviewer_actor_id === null
    || output.approved_at === null) return false;
  const interveningTransitions = bundle.status_transitions.filter((transition) =>
    transition.dossier_id === dossier.dossier_id
    && transition.revision_after > snapshot.dossier_revision
    && transition.revision_after <= dossier.revision
  );
  if (interveningTransitions.length !== 1) return false;
  const transition = interveningTransitions[0];
  return transition.previous_status === "internal_review"
    && transition.new_status === "output_approved"
    && transition.revision_before === snapshot.dossier_revision
    && transition.revision_after === dossier.revision
    && transition.approved_output_id === output.output_id
    && transition.actor_role === "reviewer"
    && transition.actor_id === output.reviewer_actor_id
    && transition.had_current_output
    && transition.had_reviewer_approval;
}

function exactDossierLinks<T extends { dossier_id: string }, K extends keyof T>(declared: string[], records: T[], key: K, dossierId: string, path: string) {
  const expected = records.filter((record) => record.dossier_id === dossierId).map((record) => String(record[key])).sort();
  const actual = [...declared].sort();
  if (!sameArray(actual, expected)) fail("INVALID_REFERENCE", path);
}

function requireDossier(value: { dossier_id: string }, dossiers: Map<string, unknown>, path: string) {
  if (!dossiers.has(value.dossier_id)) fail("INVALID_REFERENCE", `${path}.dossier_id`);
}

function requireSameDossier<T extends { dossier_id?: string }>(id: string, values: Map<string, T>, dossierId: string, path: string) {
  const value = values.get(id);
  if (!value || (value.dossier_id !== undefined && value.dossier_id !== dossierId)) fail("INVALID_REFERENCE", path);
}

function requireSameDossierIds<T extends { dossier_id?: string }>(ids: string[], values: Map<string, T>, dossierId: string, path: string) {
  ids.forEach((id) => requireSameDossier(id, values, dossierId, path));
}

function indexBy<T extends object, K extends keyof T>(values: T[], key: K, path: string): Map<string, T> {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    const id = String(value[key]);
    if (result.has(id)) fail("INVALID_REFERENCE", `${path}[${index}].${String(key)}`);
    result.set(id, value);
  });
  return result;
}

function validateRegistryReference(value: unknown, path: string) {
  const reference = record(value, path);
  exactKeys(reference, ["registry", "id", "version"], path);
  referenceId(reference.registry, `${path}.registry`);
  referenceId(reference.id, `${path}.id`);
  semanticVersion(reference.version, `${path}.version`);
}

function validateClosure(value: unknown, path: string) {
  if (value === null) return;
  const closure = record(value, path);
  exactKeys(closure, ["closed_at", "closed_by", "reason"], path);
  timestamp(closure.closed_at, `${path}.closed_at`);
  referenceId(closure.closed_by, `${path}.closed_by`);
  boundedText(closure.reason, `${path}.reason`, 1, 1_000);
}

function validateArchive(value: unknown, path: string) {
  if (value === null) return;
  const archive = record(value, path);
  exactKeys(archive, ["archived_at", "archived_by", "reason", "admin_override"], path);
  timestamp(archive.archived_at, `${path}.archived_at`);
  referenceId(archive.archived_by, `${path}.archived_by`);
  boundedText(archive.reason, `${path}.reason`, 1, 1_000);
  booleanValue(archive.admin_override, `${path}.admin_override`);
}

function auditMetadata(value: Record<string, unknown>, path: string) {
  timestamp(value.created_at, `${path}.created_at`);
  referenceId(value.created_by, `${path}.created_by`);
  timestamp(value.updated_at, `${path}.updated_at`);
  referenceId(value.updated_by, `${path}.updated_by`);
}

function opaqueId(value: unknown, path: string): string {
  const result = boundedText(value, path, 8, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]+$/u.test(result)) fail("INVALID_SHAPE", path);
  return result;
}

function nullableOpaqueId(value: unknown, path: string): string | null {
  return value === null ? null : opaqueId(value, path);
}

function referenceId(value: unknown, path: string): string {
  const result = boundedText(value, path, 1, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u.test(result) || result.includes("//")) fail("INVALID_SHAPE", path);
  return result;
}

function nullableReference(value: unknown, path: string): string | null {
  return value === null ? null : referenceId(value, path);
}

function privateObjectReference(value: unknown, path: string): string {
  const result = boundedText(value, path, 32, 500);
  if (result.includes("://") || result.includes("..") || result.includes(String.fromCharCode(92))) fail("INVALID_SHAPE", path);
  return result;
}

function semanticVersion(value: unknown, path: string): string {
  const result = boundedText(value, path, 5, 40);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(result)) fail("INVALID_SHAPE", path);
  return result;
}

function sha256(value: unknown, path: string): string {
  const result = boundedText(value, path, 71, 71);
  if (!/^sha256-[a-f0-9]{64}$/u.test(result)) fail("INVALID_SHAPE", path);
  return result;
}

function timestamp(value: unknown, path: string): string {
  const result = boundedText(value, path, 24, 24);
  if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) fail("INVALID_SHAPE", path);
  return result;
}

function nullableTimestamp(value: unknown, path: string): string | null {
  return value === null ? null : timestamp(value, path);
}

function timezone(value: unknown, path: string): string {
  const result = boundedText(value, path, 1, 80);
  if (result !== "UTC" && !/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+$/u.test(result)) fail("INVALID_SHAPE", path);
  return result;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail("INVALID_SHAPE", path);
  return value;
}

function boundedInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) fail("INVALID_SHAPE", path);
  return value as number;
}

function positiveInteger(value: unknown, path: string): number {
  return boundedInteger(value, path, 1, Number.MAX_SAFE_INTEGER);
}

function nullablePositiveInteger(value: unknown, path: string): number | null {
  return value === null ? null : positiveInteger(value, path);
}

function nullableBoundedInteger(value: unknown, path: string, minimum: number, maximum: number): number | null {
  return value === null ? null : boundedInteger(value, path, minimum, maximum);
}

function nullableText(value: unknown, path: string, maximum: number): string | null {
  return value === null ? null : boundedText(value, path, 1, maximum);
}

function stringArray(value: unknown, path: string, minimum: number, maximum: number, itemMaximum: number): string[] {
  const result = array(value, path).map((item, index) => boundedText(item, `${path}[${index}]`, 1, itemMaximum));
  if (result.length < minimum || result.length > maximum || new Set(result).size !== result.length) fail("INVALID_SHAPE", path);
  return result;
}

function idArray(value: unknown, path: string): string[] {
  const result = array(value, path).map((item, index) => opaqueId(item, `${path}[${index}]`));
  if (result.length > 10_000 || new Set(result).size !== result.length) fail("INVALID_SHAPE", path);
  return result;
}

function referenceArray(value: unknown, path: string): string[] {
  const result = array(value, path).map((item, index) => referenceId(item, `${path}[${index}]`));
  if (result.length > 10_000 || new Set(result).size !== result.length) fail("INVALID_SHAPE", path);
  return result;
}

function validateJsonValue(value: unknown, path: string, depth: number): asserts value is JsonValue {
  if (depth > 20) fail("LIMIT_EXCEEDED", path);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (value.length > 100_000 || value.includes("\u0000")) fail("LIMIT_EXCEEDED", path);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("INVALID_SHAPE", path);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000) fail("LIMIT_EXCEEDED", path);
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  const object = record(value, path);
  const keys = Object.keys(object);
  if (keys.length > 1_000 || keys.some((key) => key === "__proto__" || key === "prototype" || key === "constructor" || key.includes("\u0000"))) fail("INVALID_SHAPE", path);
  keys.forEach((key) => validateJsonValue(object[key], `${path}.${key}`, depth + 1));
}

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sameArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
