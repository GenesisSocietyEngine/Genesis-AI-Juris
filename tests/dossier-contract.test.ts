import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DOSSIER_AUDIT_EVENT_TYPES,
  DOSSIER_CONTRACT_REGISTRY,
  DOSSIER_INTEGRITY_RULES,
  DOSSIER_OBJECT_TYPES,
  DOSSIER_READINESS_DIMENSIONS,
  DOSSIER_ROLES,
  DOSSIER_STATUSES,
  DOSSIER_WIRE_ENUMS,
  DossierContractError,
  canonicalDossierJson,
  dossierStatusTransitionDecision,
  parseDossierContractBundleV1,
  serializeDossierContractBundleV1,
  validateDossierContractRegistry,
  type DossierContractBundleV1,
  type DossierContractErrorCode,
} from "../app/dossier-contract";

const AT = "2026-09-01T10:00:00.000Z";
const LATER = "2026-09-01T10:01:00.000Z";
const LATEST = "2026-09-01T10:02:00.000Z";
const REVIEW = "2026-09-01T10:03:00.000Z";
const APPROVED = "2026-09-01T10:04:00.000Z";
const AFTER_APPROVAL = "2026-09-01T10:05:00.000Z";
const hash = (digit: string) => `sha256-${digit.repeat(64)}`;

function sampleBundle(): DossierContractBundleV1 {
  const dossierId = "dossier_00000001";
  const ownerParticipantId = "participant_owner_0001";
  const contributorParticipantId = "participant_contributor_0001";
  const reviewerParticipantId = "participant_reviewer_0001";
  const documentId = "document_00000001";
  const versionId = "document_version_0001";
  const anchorId = "source_anchor_000001";
  const proposalId = "ai_proposal_0000001";
  const assertionId = "assertion_00000001";
  const evidenceLinkId = "evidence_link_000001";
  const requestId = "information_request_001";
  const deadlineId = "deadline_reference_001";
  const packageReferenceId = "package_reference_0001";
  const snapshotId = "dossier_snapshot_0001";
  const outputId = "governed_output_00001";
  const transitionOneId = "status_transition_001";
  const transitionTwoId = "status_transition_002";
  const auditOneId = "audit_event_00000001";
  const auditTwoId = "audit_event_00000002";
  const auditThreeId = "audit_event_00000003";

  const dimensions = DOSSIER_READINESS_DIMENSIONS.map((dimension) => ({
    dimension,
    state: dimension === "contradictions" ? "blocked" as const : "ready" as const,
    reasons: dimension === "contradictions"
      ? [{
          code: "CONTRADICTION_UNRESOLVED" as const,
          explanation: "A material contradiction remains unresolved.",
          deep_link: `/evidence/contradictions/${assertionId}`,
          related_object_type: "professional_assertion" as const,
          related_object_id: assertionId,
        }]
      : [],
  }));

  return {
    format: "genesis-juris-dossier-bundle",
    schema_version: 1,
    contract_registry: "genesis-juris-dossier-contract",
    contract_version: "1.0.0",
    export_id: "export_000000000001",
    exported_at: LATEST,
    exported_by: "actor_owner_0001",
    dossiers: [{
      object_type: "dossier",
      schema_version: 1,
      dossier_id: dossierId,
      reference: "MAT-2026-001",
      title: "Controlled professional matter",
      dossier_type: { registry: "genesis-juris-dossier-types", id: "general_matter", version: "1.0.0" },
      terminology: "matter",
      owner_actor_id: "actor_owner_0001",
      organisation_id: null,
      jurisdictions: ["England and Wales"],
      classification: "confidential",
      priority: "high",
      status: "active",
      status_reason: null,
      key_deadline: { at: "2026-09-30T16:00:00.000Z", timezone: "Europe/Paris" },
      revision: 3,
      created_at: AT,
      created_by: "actor_owner_0001",
      updated_at: LATEST,
      updated_by: "actor_reviewer_0001",
      closure: null,
      archive: null,
      participant_ids: [ownerParticipantId, contributorParticipantId, reviewerParticipantId],
      document_ids: [documentId],
      information_request_ids: [requestId],
      decision_package_reference_ids: [packageReferenceId],
      output_ids: [outputId],
      audit_event_ids: [auditOneId, auditTwoId, auditThreeId],
    }],
    participants: [
      {
        object_type: "participant", schema_version: 1, participant_id: ownerParticipantId,
        dossier_id: dossierId, actor_id: "actor_owner_0001", display_name: "Matter owner",
        role: "owner", status: "active", created_at: AT, created_by: "actor_owner_0001",
        updated_at: AT, updated_by: "actor_owner_0001",
      },
      {
        object_type: "participant", schema_version: 1, participant_id: contributorParticipantId,
        dossier_id: dossierId, actor_id: "actor_contributor_0001", display_name: "Contributor",
        role: "contributor", status: "active", created_at: AT, created_by: "actor_owner_0001",
        updated_at: AT, updated_by: "actor_owner_0001",
      },
      {
        object_type: "participant", schema_version: 1, participant_id: reviewerParticipantId,
        dossier_id: dossierId, actor_id: "actor_reviewer_0001", display_name: "Reviewer",
        role: "reviewer", status: "active", created_at: AT, created_by: "actor_owner_0001",
        updated_at: AT, updated_by: "actor_owner_0001",
      },
    ],
    status_transitions: [
      {
        object_type: "status_transition", schema_version: 1, transition_id: transitionOneId,
        dossier_id: dossierId, previous_status: "draft", new_status: "intake_review",
        revision_before: 1, revision_after: 2, approved_output_id: null,
        actor_id: "actor_contributor_0001", actor_role: "contributor", occurred_at: LATER,
        reason: null, comment: null, platform_admin_override: false, had_current_output: false,
        had_reviewer_approval: false, consequences: ["recompute_readiness", "mark_outputs_stale"],
      },
      {
        object_type: "status_transition", schema_version: 1, transition_id: transitionTwoId,
        dossier_id: dossierId, previous_status: "intake_review", new_status: "active",
        revision_before: 2, revision_after: 3, approved_output_id: null,
        actor_id: "actor_reviewer_0001", actor_role: "reviewer", occurred_at: LATEST,
        reason: null, comment: "Intake accepted.", platform_admin_override: false, had_current_output: false,
        had_reviewer_approval: false, consequences: ["recompute_readiness", "mark_outputs_stale"],
      },
    ],
    documents: [{
      object_type: "document", schema_version: 1, document_id: documentId, dossier_id: dossierId,
      title: "Source statement", document_type: "witness_statement", source_origin: "internal_upload",
      classification: "confidential", current_version_id: versionId, status: "accepted_source",
      tags: ["statement"], external_system_reference: null, created_at: AT, created_by: "actor_owner_0001",
      updated_at: AT, updated_by: "actor_owner_0001",
    }],
    document_versions: [{
      object_type: "document_version", schema_version: 1, document_version_id: versionId,
      dossier_id: dossierId, document_id: documentId, ordinal: 1,
      binary_object_reference: "r2-private-opaque-key-00000001", original_filename: "source.txt",
      media_type: "text/plain", byte_length: 128, content_sha256: hash("a"),
      uploader_actor_id: "actor_owner_0001", uploaded_at: AT, extraction_status: "ready",
      extraction_error_code: null, extracted_text_version: "extractor-v1",
      extracted_text_checksum: hash("b"),
      page_map: [{ page_number: 1, section_id: "section_1", heading: "Statement", start_offset: 0, end_offset: 128, checksum: hash("c") }],
      predecessor_version_id: null, source_note: "Received directly from the source.",
      created_at: AT, created_by: "actor_owner_0001",
    }],
    source_anchors: [{
      object_type: "source_anchor", schema_version: 1, source_anchor_id: anchorId,
      dossier_id: dossierId, document_id: documentId, document_version_id: versionId,
      page_number: 1, section: "section_1", heading: "Statement", paragraph: "1",
      character_start: 0, character_end: 42, excerpt: "The reviewed source statement.",
      anchor_checksum: hash("d"), extraction_version: "extractor-v1", creator: "ai_proposal",
      review_state: "accepted", reviewer_actor_id: "actor_reviewer_0001", reviewed_at: LATER,
      created_at: AT, created_by: "actor_owner_0001",
    }],
    professional_assertions: [{
      object_type: "professional_assertion", schema_version: 1, assertion_id: assertionId,
      dossier_id: dossierId, assertion_type: "fact", statement: "The reviewed event occurred.",
      status: "accepted", source_anchor_ids: [anchorId], originating_proposal_id: proposalId,
      reviewed_by: "actor_reviewer_0001", reviewed_at: LATER, created_at: AT,
      created_by: "actor_owner_0001", updated_at: LATER, updated_by: "actor_reviewer_0001",
    }],
    evidence_links: [{
      object_type: "evidence_link", schema_version: 1, evidence_link_id: evidenceLinkId,
      dossier_id: dossierId, source_anchor_id: anchorId, assertion_id: assertionId,
      decision_package_reference_id: null,
      target_type: "professional_assertion", target_id: assertionId, relation: "supports",
      professional_meaning: "The exact reviewed passage supports the accepted fact.",
      created_at: LATER, created_by: "actor_reviewer_0001", reviewed_by: "actor_reviewer_0001",
      reviewed_at: LATER,
    }],
    information_requests: [{
      object_type: "information_request", schema_version: 1, information_request_id: requestId,
      dossier_id: dossierId, question: "Provide the signed source statement.", owner_actor_id: "actor_owner_0001",
      requested_from_participant_id: contributorParticipantId, priority: "high", due_at: "2026-09-10T16:00:00.000Z",
      timezone: "Europe/Paris", status: "received", reason: "Required for source completeness.",
      readiness_reason_code: "INFORMATION_REQUEST_OPEN", satisfying_document_id: documentId,
      satisfying_evidence_link_id: evidenceLinkId, created_at: AT, created_by: "actor_owner_0001",
      updated_at: LATER, updated_by: "actor_contributor_0001",
    }],
    deadline_references: [{
      object_type: "deadline_reference", schema_version: 1, deadline_reference_id: deadlineId,
      dossier_id: dossierId, deadline_kind: "workspace", title: "Professional review deadline",
      due_at: "2026-09-30T16:00:00.000Z", timezone: "Europe/Paris", critical: true,
      status: "open", source_anchor_ids: [anchorId], decision_package_reference_id: null,
      simulation_deadline_id: null, created_at: AT, created_by: "actor_owner_0001",
      updated_at: AT, updated_by: "actor_owner_0001",
    }],
    decision_package_references: [{
      object_type: "decision_package_reference", schema_version: 1,
      decision_package_reference_id: packageReferenceId, dossier_id: dossierId,
      package_id: "case_package_001", package_version: "1.0.0", package_fingerprint: hash("e"),
      parent_package_id: null, parent_package_version: null, parent_package_fingerprint: null,
      source_snapshot_id: null, source_dossier_revision: 3, state: "current",
      graph_validation_status: "valid", graph_digest: hash("f"),
      simulation_run_references: ["simulation_run_v61_001"], approval_state: "reviewed",
      package_type: { registry: "genesis-juris-case-types", id: "general_advisory", version: "1.0.0" },
      created_at: AT, created_by: "actor_owner_0001", updated_at: LATER, updated_by: "actor_reviewer_0001",
    }],
    ai_proposals: [{
      object_type: "ai_proposal", schema_version: 1, proposal_id: proposalId, dossier_id: dossierId,
      source_document_version_ids: [versionId], source_anchor_ids: [anchorId], proposal_type: "fact",
      proposed_value: { statement: "The reviewed event occurred." },
      confidence: { category: "high", score: 0.9 },
      model_provenance: { provider: "configured-provider", model: "configured-model", configuration_digest: hash("1") },
      review_state: "accepted", reviewing_actor_id: "actor_reviewer_0001", reviewed_at: LATER,
      review_note: "Accepted after checking the exact source.", accepted_object_type: "professional_assertion",
      accepted_object_id: assertionId, created_at: AT, created_by: "actor_owner_0001",
    }],
    dossier_snapshots: [{
      object_type: "dossier_snapshot", schema_version: 1, snapshot_id: snapshotId,
      dossier_id: dossierId, dossier_revision: 3,
      document_versions: [{ document_id: documentId, document_version_id: versionId, content_sha256: hash("a") }],
      accepted_assertion_ids: [assertionId], source_anchor_ids: [anchorId],
      decision_packages: [{ decision_package_reference_id: packageReferenceId, package_id: "case_package_001", package_version: "1.0.0", graph_digest: hash("f"), simulation_receipt_ids: ["simulation_receipt_001"] }],
      simulation_inputs: { seed: 7 }, deterministic_receipts: { trace: "trace_001" },
      status: "active",
      readiness: { schema_version: 1, dossier_id: dossierId, computed_from_revision: 3, evaluated_at: LATEST, ready: false, dimensions },
      approver_records: [], locale: "en", audience: "internal", classification: "confidential",
      redaction_profile_id: "redaction_none", generator: { contract_version: "1.0.0", report_model_schema_version: 1, renderer_version: "1.0.0", build_version: "v62-contract" },
      manifest_digest: hash("2"), created_at: LATEST, created_by: "actor_owner_0001",
    }],
    governed_outputs: [{
      object_type: "governed_output", schema_version: 1, output_id: outputId, dossier_id: dossierId,
      snapshot_id: snapshotId, snapshot_digest: hash("2"), format: "json_manifest",
      content_reference: "private/outputs/dossier_00000001/governed_output_00001", content_sha256: hash("3"),
      filename: "matter-manifest.json", state: "current", stale_at: null, stale_reason: null,
      reviewer_actor_id: null, approved_at: null, generator_schema_version: 1,
      generator_build_version: "v62-contract", created_at: LATEST, created_by: "actor_owner_0001",
    }],
    audit_events: [
      {
        object_type: "audit_event", schema_version: 1, audit_event_id: auditOneId, dossier_id: dossierId,
        dossier_revision: 1, sequence: 1, event_type: "dossier_created", object_ref_type: "dossier", object_ref_id: dossierId,
        actor_id: "actor_owner_0001", actor_role: "owner", occurred_at: AT, summary_code: "DOSSIER_CREATED",
        detail: { revision: 1 }, previous_event_id: null, event_digest: hash("4"),
      },
      {
        object_type: "audit_event", schema_version: 1, audit_event_id: auditTwoId, dossier_id: dossierId,
        dossier_revision: 2, sequence: 2, event_type: "dossier_status_transitioned", object_ref_type: "status_transition", object_ref_id: transitionOneId,
        actor_id: "actor_contributor_0001", actor_role: "contributor", occurred_at: LATER, summary_code: "STATUS_INTAKE_REVIEW",
        detail: { from: "draft", to: "intake_review" }, previous_event_id: auditOneId, event_digest: hash("5"),
      },
      {
        object_type: "audit_event", schema_version: 1, audit_event_id: auditThreeId, dossier_id: dossierId,
        dossier_revision: 3, sequence: 3, event_type: "dossier_status_transitioned", object_ref_type: "status_transition", object_ref_id: transitionTwoId,
        actor_id: "actor_reviewer_0001", actor_role: "reviewer", occurred_at: LATEST, summary_code: "STATUS_ACTIVE",
        detail: { from: "intake_review", to: "active" }, previous_event_id: auditTwoId, event_digest: hash("6"),
      },
    ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sampleApprovedOutputBundle(): DossierContractBundleV1 {
  const bundle = sampleBundle();
  const dossier = bundle.dossiers[0];
  const snapshot = bundle.dossier_snapshots[0];
  const output = bundle.governed_outputs[0];
  const reviewTransitionId = "status_transition_003";
  const approvalTransitionId = "status_transition_004";
  const reviewAuditId = "audit_event_00000004";
  const approvalAuditId = "audit_event_00000005";

  dossier.status = "output_approved";
  dossier.revision = 5;
  dossier.updated_at = APPROVED;
  dossier.updated_by = "actor_reviewer_0001";
  dossier.audit_event_ids.push(reviewAuditId, approvalAuditId);
  bundle.status_transitions.push(
    {
      object_type: "status_transition", schema_version: 1, transition_id: reviewTransitionId,
      dossier_id: dossier.dossier_id, previous_status: "active", new_status: "internal_review",
      revision_before: 3, revision_after: 4, approved_output_id: null,
      actor_id: "actor_reviewer_0001", actor_role: "reviewer", occurred_at: REVIEW,
      reason: "Ready for internal review.", comment: null, platform_admin_override: false,
      had_current_output: true, had_reviewer_approval: false,
      consequences: ["recompute_readiness", "mark_outputs_stale"],
    },
    {
      object_type: "status_transition", schema_version: 1, transition_id: approvalTransitionId,
      dossier_id: dossier.dossier_id, previous_status: "internal_review", new_status: "output_approved",
      revision_before: 4, revision_after: 5, approved_output_id: output.output_id,
      actor_id: "actor_reviewer_0001", actor_role: "reviewer", occurred_at: APPROVED,
      reason: null, comment: "Exact governed output approved.", platform_admin_override: false,
      had_current_output: true, had_reviewer_approval: true,
      consequences: ["recompute_readiness", "preserve_current_output"],
    },
  );
  snapshot.dossier_revision = 4;
  snapshot.status = "internal_review";
  snapshot.readiness.computed_from_revision = 4;
  snapshot.created_at = REVIEW;
  output.reviewer_actor_id = "actor_reviewer_0001";
  output.approved_at = APPROVED;
  output.created_at = REVIEW;
  bundle.audit_events.push(
    {
      object_type: "audit_event", schema_version: 1, audit_event_id: reviewAuditId,
      dossier_id: dossier.dossier_id, dossier_revision: 4, sequence: 4,
      event_type: "dossier_status_transitioned", object_ref_type: "status_transition",
      object_ref_id: reviewTransitionId, actor_id: "actor_reviewer_0001", actor_role: "reviewer",
      occurred_at: REVIEW, summary_code: "STATUS_INTERNAL_REVIEW",
      detail: { from: "active", to: "internal_review" },
      previous_event_id: bundle.audit_events[2].audit_event_id, event_digest: hash("7"),
    },
    {
      object_type: "audit_event", schema_version: 1, audit_event_id: approvalAuditId,
      dossier_id: dossier.dossier_id, dossier_revision: 5, sequence: 5,
      event_type: "dossier_status_transitioned", object_ref_type: "status_transition",
      object_ref_id: approvalTransitionId, actor_id: "actor_reviewer_0001", actor_role: "reviewer",
      occurred_at: APPROVED, summary_code: "STATUS_OUTPUT_APPROVED",
      detail: { from: "internal_review", to: "output_approved", approved_output_id: output.output_id },
      previous_event_id: reviewAuditId, event_digest: hash("8"),
    },
  );
  return bundle;
}

function assertContractError(callback: () => unknown, code: DossierContractErrorCode) {
  assert.throws(callback, (error: unknown) => error instanceof DossierContractError && error.code === code);
}

test("the complete v1 dossier bundle validates, canonicalizes and round-trips exactly", () => {
  const bundle = sampleBundle();
  const serialized = serializeDossierContractBundleV1(bundle);
  const parsed = parseDossierContractBundleV1(serialized);
  assert.deepEqual(parsed, parseDossierContractBundleV1(bundle));
  assert.equal(serializeDossierContractBundleV1(parsed), serialized);
  assert.equal(canonicalDossierJson({ z: 1, a: { z: 2, a: 3 } }), '{"a":{"a":3,"z":2},"z":1}');
  assert.equal(parsed.dossiers[0].status, "active");
  assert.equal(parsed.dossier_snapshots[0].readiness.ready, false, "lifecycle status and computed readiness remain separate");
  assert.equal(parsed.document_versions[0].binary_object_reference, "r2-private-opaque-key-00000001");
  assert.equal("proposed_value" in parsed.professional_assertions[0], false, "accepted assertions are authoritative records, not hidden proposal output");
});

test("AI generation completion is auditable without inventing an unexportable v1 object type", () => {
  assert.ok(DOSSIER_AUDIT_EVENT_TYPES.includes("proposal_generation_completed"));
  assert.ok(DOSSIER_WIRE_ENUMS.audit_event_type.includes("proposal_generation_completed"));
  assert.equal(DOSSIER_OBJECT_TYPES.includes("ai_proposal_job" as never), false);
});

test("v1 rejects unknown keys, schemas, enums and every future portable enum vocabulary", () => {
  const unknownKey = clone(sampleBundle()) as DossierContractBundleV1 & { future?: boolean };
  unknownKey.future = true;
  assertContractError(() => parseDossierContractBundleV1(unknownKey), "UNKNOWN_SCHEMA");

  const objectKey = clone(sampleBundle()) as unknown as { dossiers: Array<Record<string, unknown>> };
  objectKey.dossiers[0].readiness = true;
  assertContractError(() => parseDossierContractBundleV1(objectKey), "UNKNOWN_SCHEMA");

  const bundleSchema = clone(sampleBundle()) as unknown as { schema_version: number };
  bundleSchema.schema_version = 2;
  assertContractError(() => parseDossierContractBundleV1(bundleSchema), "UNKNOWN_SCHEMA");

  const objectSchema = clone(sampleBundle()) as unknown as { documents: Array<Record<string, unknown>> };
  objectSchema.documents[0].schema_version = 2;
  assertContractError(() => parseDossierContractBundleV1(objectSchema), "UNKNOWN_SCHEMA");

  const unknownStatus = clone(sampleBundle()) as unknown as { dossiers: Array<Record<string, unknown>> };
  unknownStatus.dossiers[0].status = "future_status";
  assertContractError(() => parseDossierContractBundleV1(unknownStatus), "UNKNOWN_ENUM");

  const unknownAcceptedObject = clone(sampleBundle()) as unknown as { ai_proposals: Array<Record<string, unknown>> };
  unknownAcceptedObject.ai_proposals[0].accepted_object_type = "dossier";
  assertContractError(() => parseDossierContractBundleV1(unknownAcceptedObject), "UNKNOWN_ENUM");

  for (const enumName of Object.keys(DOSSIER_WIRE_ENUMS) as Array<keyof typeof DOSSIER_WIRE_ENUMS>) {
    const registry = clone(DOSSIER_CONTRACT_REGISTRY) as unknown as { wire_enums: Record<string, string[]> };
    registry.wire_enums[enumName].push("future_value");
    assertContractError(() => validateDossierContractRegistry(registry), "UNKNOWN_SCHEMA");
  }
  assert.deepEqual(DOSSIER_CONTRACT_REGISTRY.integrity_rules, DOSSIER_INTEGRITY_RULES);
  const futureIntegrityRule = clone(DOSSIER_CONTRACT_REGISTRY) as unknown as { integrity_rules: string[] };
  futureIntegrityRule.integrity_rules.push("future_integrity_rule");
  assertContractError(() => validateDossierContractRegistry(futureIntegrityRule), "UNKNOWN_SCHEMA");
});

test("reference integrity fails closed across versions, anchors, snapshots, outputs and audit order", () => {
  const mutations: Array<(bundle: DossierContractBundleV1) => void> = [
    (bundle) => { bundle.documents[0].current_version_id = "document_version_missing"; },
    (bundle) => { bundle.source_anchors[0].document_version_id = "document_version_missing"; },
    (bundle) => { bundle.dossier_snapshots[0].document_versions[0].content_sha256 = hash("9"); },
    (bundle) => { bundle.governed_outputs[0].snapshot_digest = hash("8"); },
    (bundle) => { bundle.audit_events[2].previous_event_id = bundle.audit_events[0].audit_event_id; },
    (bundle) => { bundle.ai_proposals[0].source_anchor_ids = []; },
    (bundle) => {
      bundle.source_anchors[0].review_state = "pending";
      bundle.source_anchors[0].reviewer_actor_id = null;
      bundle.source_anchors[0].reviewed_at = null;
    },
    (bundle) => { bundle.dossier_snapshots[0].dossier_revision = 4; bundle.dossier_snapshots[0].readiness.computed_from_revision = 4; },
    (bundle) => { bundle.dossier_snapshots[0].document_versions = []; },
    (bundle) => { bundle.governed_outputs[0].reviewer_actor_id = "actor_owner_0001"; bundle.governed_outputs[0].approved_at = LATEST; },
  ];
  for (const mutate of mutations) {
    const candidate = clone(sampleBundle());
    mutate(candidate);
    assert.throws(() => parseDossierContractBundleV1(candidate), DossierContractError);
  }
});

test("graph evidence identifies the exact same-dossier decision-package reference", () => {
  const graphEvidence = sampleBundle();
  graphEvidence.evidence_links[0].assertion_id = null;
  graphEvidence.evidence_links[0].target_type = "graph_node";
  graphEvidence.evidence_links[0].target_id = "graph_node_000001";
  graphEvidence.evidence_links[0].decision_package_reference_id = graphEvidence.decision_package_references[0].decision_package_reference_id;
  assert.doesNotThrow(() => parseDossierContractBundleV1(graphEvidence));

  const missingPackageScope = clone(graphEvidence);
  missingPackageScope.evidence_links[0].decision_package_reference_id = null;
  assertContractError(() => parseDossierContractBundleV1(missingPackageScope), "INVALID_REFERENCE");

  const unknownPackageScope = clone(graphEvidence);
  unknownPackageScope.evidence_links[0].decision_package_reference_id = "package_reference_missing";
  assertContractError(() => parseDossierContractBundleV1(unknownPackageScope), "INVALID_REFERENCE");

  const packageOnNonGraphEvidence = sampleBundle();
  packageOnNonGraphEvidence.evidence_links[0].decision_package_reference_id = packageOnNonGraphEvidence.decision_package_references[0].decision_package_reference_id;
  assertContractError(() => parseDossierContractBundleV1(packageOnNonGraphEvidence), "INVALID_REFERENCE");
});

test("transition revisions bind to audit receipt revisions while secondary events may share a revision", () => {
  const withSecondaryAudit = sampleBundle();
  const secondaryAuditId = "audit_event_00000004";
  withSecondaryAudit.dossiers[0].audit_event_ids.push(secondaryAuditId);
  withSecondaryAudit.audit_events.push({
    object_type: "audit_event", schema_version: 1, audit_event_id: secondaryAuditId,
    dossier_id: withSecondaryAudit.dossiers[0].dossier_id, dossier_revision: 3, sequence: 4,
    event_type: "output_generated", object_ref_type: "governed_output",
    object_ref_id: withSecondaryAudit.governed_outputs[0].output_id,
    actor_id: "actor_owner_0001", actor_role: "owner", occurred_at: LATEST,
    summary_code: "OUTPUT_GENERATED", detail: { consequence_of_revision: 3 },
    previous_event_id: withSecondaryAudit.audit_events[2].audit_event_id, event_digest: hash("9"),
  });
  assert.doesNotThrow(() => parseDossierContractBundleV1(withSecondaryAudit));

  const nonCasTransition = sampleBundle();
  nonCasTransition.status_transitions[0].revision_after = 3;
  assertContractError(() => parseDossierContractBundleV1(nonCasTransition), "INVALID_TRANSITION");

  const wrongReceiptRevision = sampleBundle();
  wrongReceiptRevision.audit_events[1].dossier_revision = 3;
  assertContractError(() => parseDossierContractBundleV1(wrongReceiptRevision), "INVALID_REFERENCE");

  const regression = sampleBundle();
  regression.audit_events[2].dossier_revision = 2;
  assertContractError(() => parseDossierContractBundleV1(regression), "INVALID_REFERENCE");
});

test("a current-revision snapshot is an exact manifest of accepted anchors and current packages", () => {
  const missingAcceptedAnchor = sampleBundle();
  missingAcceptedAnchor.dossier_snapshots[0].source_anchor_ids = [];
  assertContractError(() => parseDossierContractBundleV1(missingAcceptedAnchor), "INVALID_REFERENCE");

  const missingCurrentPackage = sampleBundle();
  missingCurrentPackage.dossier_snapshots[0].decision_packages = [];
  assertContractError(() => parseDossierContractBundleV1(missingCurrentPackage), "INVALID_REFERENCE");

  const stalePackageIncludedAsCurrent = sampleBundle();
  stalePackageIncludedAsCurrent.decision_package_references[0].state = "stale";
  assertContractError(() => parseDossierContractBundleV1(stalePackageIncludedAsCurrent), "INVALID_REFERENCE");
});

test("governed output references are private opaque locators", () => {
  for (const contentReference of [
    "https://private.example.test/output/content/0001",
    "private/outputs/../shared/output/content/0001",
    "private\\outputs\\dossier_00000001\\content_0001",
    "private/output/short",
  ]) {
    const bundle = sampleBundle();
    bundle.governed_outputs[0].content_reference = contentReference;
    assertContractError(() => parseDossierContractBundleV1(bundle), "INVALID_SHAPE");
  }
});

test("a current output may trail live revision only for its sole exact output-approval transition", () => {
  const approved = sampleApprovedOutputBundle();
  assert.doesNotThrow(() => parseDossierContractBundleV1(approved));

  const wrongApprovedOutput = clone(approved);
  wrongApprovedOutput.status_transitions.at(-1)!.approved_output_id = "governed_output_missing";
  assertContractError(() => parseDossierContractBundleV1(wrongApprovedOutput), "INVALID_REFERENCE");

  const wrongSnapshotRevision = clone(approved);
  wrongSnapshotRevision.dossier_snapshots[0].dossier_revision = 3;
  wrongSnapshotRevision.dossier_snapshots[0].readiness.computed_from_revision = 3;
  assertContractError(() => parseDossierContractBundleV1(wrongSnapshotRevision), "INVALID_REFERENCE");

  const laterMutation = clone(approved);
  const laterAuditId = "audit_event_00000006";
  laterMutation.dossiers[0].revision = 6;
  laterMutation.dossiers[0].updated_at = AFTER_APPROVAL;
  laterMutation.dossiers[0].audit_event_ids.push(laterAuditId);
  laterMutation.audit_events.push({
    object_type: "audit_event", schema_version: 1, audit_event_id: laterAuditId,
    dossier_id: laterMutation.dossiers[0].dossier_id, dossier_revision: 6, sequence: 6,
    event_type: "dossier_updated", object_ref_type: "dossier",
    object_ref_id: laterMutation.dossiers[0].dossier_id,
    actor_id: "actor_owner_0001", actor_role: "owner", occurred_at: AFTER_APPROVAL,
    summary_code: "DOSSIER_UPDATED", detail: { revision: 6 },
    previous_event_id: laterMutation.audit_events[4].audit_event_id, event_digest: hash("9"),
  });
  assertContractError(() => parseDossierContractBundleV1(laterMutation), "INVALID_REFERENCE");
});

test("every workspace-role status transition is exactly the declared matrix", () => {
  for (const from of DOSSIER_STATUSES) for (const to of DOSSIER_STATUSES) for (const actorRole of DOSSIER_ROLES) {
    const declared = DOSSIER_CONTRACT_REGISTRY.transitions.find((rule) => rule.from === from && rule.to === to);
    const expected = from !== to && Boolean(declared?.roles.includes(actorRole));
    const decision = dossierStatusTransitionDecision({
      from, to, actor_role: actorRole, reason: "Recorded reason.",
      has_current_output: true, has_reviewer_approval: true,
    });
    assert.equal(decision.allowed, expected, `${from}->${to} as ${actorRole}`);
    assert.equal(
      decision.code,
      expected ? "ALLOWED" : declared ? "ROLE_FORBIDDEN" : "TRANSITION_FORBIDDEN",
      `${from}->${to} as ${actorRole} code`,
    );
  }
});

test("every declared transition enforces its exact current-output, reviewer and reason requirements", () => {
  for (const rule of DOSSIER_CONTRACT_REGISTRY.transitions) {
    const actorRole = rule.roles[0];
    const allowed = dossierStatusTransitionDecision({
      from: rule.from,
      to: rule.to,
      actor_role: actorRole,
      reason: "Recorded reason.",
      has_current_output: true,
      has_reviewer_approval: true,
    });
    assert.equal(allowed.allowed, true, `${rule.from}->${rule.to} baseline`);
    assert.deepEqual(allowed.requirements, rule.requires);
    assert.deepEqual(allowed.consequences, rule.consequences);

    if (rule.requires.includes("reason")) {
      assert.equal(dossierStatusTransitionDecision({
        from: rule.from,
        to: rule.to,
        actor_role: actorRole,
        has_current_output: true,
        has_reviewer_approval: true,
      }).code, "REASON_REQUIRED", `${rule.from}->${rule.to} reason`);
    }
    if (rule.requires.includes("current_output")) {
      assert.equal(dossierStatusTransitionDecision({
        from: rule.from,
        to: rule.to,
        actor_role: actorRole,
        reason: "Recorded reason.",
        has_reviewer_approval: true,
      }).code, "CURRENT_OUTPUT_REQUIRED", `${rule.from}->${rule.to} current output`);
    }
    if (rule.requires.includes("reviewer_approval")) {
      assert.equal(dossierStatusTransitionDecision({
        from: rule.from,
        to: rule.to,
        actor_role: actorRole,
        reason: "Recorded reason.",
        has_current_output: true,
      }).code, "REVIEWER_APPROVAL_REQUIRED", `${rule.from}->${rule.to} reviewer approval`);
    }
  }
});

test("platform-admin archive override is the only administrative transition", () => {
  for (const from of DOSSIER_STATUSES) for (const to of DOSSIER_STATUSES) {
    const expected = from !== "archived" && to === "archived";
    const decision = dossierStatusTransitionDecision({
      from,
      to,
      actor_role: "platform_admin",
      platform_admin_override: true,
      reason: "Separately audited override.",
      has_current_output: true,
      has_reviewer_approval: true,
    });
    assert.equal(decision.allowed, expected, `${from}->${to} as platform_admin`);
    assert.equal(
      dossierStatusTransitionDecision({
        from,
        to,
        actor_role: "platform_admin",
        reason: "Override not asserted.",
      }).allowed,
      false,
      `${from}->${to} without override`,
    );
  }
});

test("approval, reason, viewer and platform-admin archive gates fail closed with exact codes", () => {
  assert.deepEqual(
    dossierStatusTransitionDecision({ from: "internal_review", to: "output_approved", actor_role: "reviewer" }).code,
    "CURRENT_OUTPUT_REQUIRED",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "internal_review", to: "output_approved", actor_role: "reviewer", has_current_output: true }).code,
    "REVIEWER_APPROVAL_REQUIRED",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "internal_review", to: "output_approved", actor_role: "reviewer", has_current_output: true, has_reviewer_approval: true }).allowed,
    true,
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "internal_review", to: "output_approved", actor_role: "contributor", has_current_output: true, has_reviewer_approval: true }).code,
    "ROLE_FORBIDDEN",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "active", to: "closed", actor_role: "owner" }).code,
    "REASON_REQUIRED",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "draft", to: "intake_review", actor_role: "viewer" }).code,
    "ROLE_FORBIDDEN",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "active", to: "archived", actor_role: "owner", reason: "Archive." }).code,
    "TRANSITION_FORBIDDEN",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "active", to: "archived", actor_role: "platform_admin", reason: "Override." }).code,
    "ADMIN_OVERRIDE_REQUIRED",
  );
  assert.equal(
    dossierStatusTransitionDecision({ from: "active", to: "archived", actor_role: "platform_admin", platform_admin_override: true }).code,
    "REASON_REQUIRED",
  );
  const override = dossierStatusTransitionDecision({ from: "active", to: "archived", actor_role: "platform_admin", platform_admin_override: true, reason: "Separately audited override." });
  assert.equal(override.allowed, true);
  assert.deepEqual(override.consequences, ["recompute_readiness", "mark_outputs_stale"]);
  assert.equal(dossierStatusTransitionDecision({ from: "future", to: "active", actor_role: "owner" }).code, "UNKNOWN_STATUS");
  assert.equal(dossierStatusTransitionDecision({ from: "draft", to: "intake_review", actor_role: "future" }).code, "UNKNOWN_ROLE");
});

test("the dossier contract stays dormant from v61 fingerprints, report semantics and Rust runtime adapters", () => {
  const caseIntegrity = readFileSync(new URL("../app/case-integrity.ts", import.meta.url), "utf8");
  const reportModel = readFileSync(new URL("../app/report-model.ts", import.meta.url), "utf8");
  const canonicalRuntime = readFileSync(new URL("../app/canonical-runtime.ts", import.meta.url), "utf8");
  for (const source of [caseIntegrity, reportModel, canonicalRuntime]) assert.doesNotMatch(source, /dossier-contract/u);
});
