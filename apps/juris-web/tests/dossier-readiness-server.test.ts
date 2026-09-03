import assert from "node:assert/strict";
import test from "node:test";
import { dossierReadinessFindingsFromFacts, type DossierReadinessFacts } from "../app/dossier-readiness-server";

const evaluatedAt = "2026-09-01T10:00:00.000Z";

function readyFacts(): DossierReadinessFacts {
  return {
    keyDeadlineAt: "2026-10-01T10:00:00.000Z",
    documents: [{ id: "document_ready_001", status: "accepted_source", currentVersionId: "version_ready_001" }],
    informationRequests: [],
    pendingProposals: [],
    contradictions: [],
    criticalDeadlines: [{ id: "deadline_ready_001", status: "open", dueAt: "2026-10-01T10:00:00.000Z" }],
    acceptedAssertions: [{ id: "assertion_ready_001", sourceAnchorIds: ["anchor_ready_001"] }],
    acceptedSourceAnchors: [{ id: "anchor_ready_001", documentVersionId: "version_ready_001", currentDocumentVersionId: "version_ready_001" }],
    decisionPackages: [{ id: "package_ready_001", state: "current", graphValidationStatus: "valid", simulationRunReferences: ["simulation-ready-001"] }],
    outputs: [{ id: "output_ready_001", snapshotRevision: 8, state: "current", reviewerApproved: true }],
  };
}

test("route facts produce no blocker for a fully current reviewed dossier", () => {
  assert.deepEqual(dossierReadinessFindingsFromFacts(readyFacts(), 8, evaluatedAt), []);
});

test("route facts cover every frozen readiness blocker deterministically", () => {
  const facts: DossierReadinessFacts = {
    keyDeadlineAt: null,
    documents: [{ id: "document_review_001", status: "under_review", currentVersionId: null }],
    informationRequests: [
      { id: "request_open_001", status: "open", dueAt: "2026-09-02T10:00:00.000Z" },
      { id: "request_overdue_001", status: "open", dueAt: "2026-08-31T10:00:00.000Z" },
    ],
    pendingProposals: [{ id: "proposal_pending_001" }],
    contradictions: [{ id: "assertion_contradiction_001" }],
    criticalDeadlines: [{ id: "deadline_overdue_001", status: "open", dueAt: "2026-08-30T10:00:00.000Z" }],
    acceptedAssertions: [{ id: "assertion_unsourced_001", sourceAnchorIds: [] }],
    acceptedSourceAnchors: [{ id: "anchor_stale_001", documentVersionId: "version_old_001", currentDocumentVersionId: "version_new_001" }],
    decisionPackages: [{ id: "package_invalid_001", state: "current", graphValidationStatus: "invalid", simulationRunReferences: [] }],
    outputs: [{ id: "output_stale_001", snapshotRevision: 7, state: "current", reviewerApproved: false }],
  };
  assert.deepEqual(dossierReadinessFindingsFromFacts(facts, 8, evaluatedAt).map(({ code }) => code), [
    "DOCUMENT_REVIEW_REQUIRED",
    "INFORMATION_REQUEST_OPEN",
    "INFORMATION_REQUEST_OVERDUE",
    "AI_PROPOSAL_PENDING",
    "CONTRADICTION_UNRESOLVED",
    "CRITICAL_DEADLINE_OVERDUE",
    "SOURCE_ANCHOR_MISSING",
    "SOURCE_VERSION_STALE",
    "DECISION_GRAPH_INVALID",
    "SIMULATION_REQUIRED",
    "OUTPUT_STALE",
    "REVIEWER_APPROVAL_MISSING",
  ]);
});

test("empty source, deadline, package and output registers expose required blockers", () => {
  const facts = readyFacts();
  facts.documents = [];
  facts.keyDeadlineAt = null;
  facts.criticalDeadlines = [];
  facts.decisionPackages = [];
  facts.outputs = [];
  assert.deepEqual(dossierReadinessFindingsFromFacts(facts, 8, evaluatedAt).map(({ code }) => code), [
    "DOCUMENT_REQUIRED_MISSING",
    "CRITICAL_DEADLINE_MISSING",
    "DECISION_GRAPH_INVALID",
    "SIMULATION_REQUIRED",
    "OUTPUT_REQUIRED",
    "REVIEWER_APPROVAL_MISSING",
  ]);
});
