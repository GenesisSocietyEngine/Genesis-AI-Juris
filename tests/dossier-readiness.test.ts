import assert from "node:assert/strict";
import test from "node:test";
import { DOSSIER_READINESS_DIMENSIONS } from "../app/dossier-contract";
import { computeDossierReadiness, DossierReadinessError } from "../app/dossier-readiness";

const base = {
  dossierId: "dossier_readiness_001",
  revision: 7,
  evaluatedAt: "2026-09-01T10:00:00.000Z",
};

test("readiness emits every contract dimension in canonical order", () => {
  const readiness = computeDossierReadiness({ ...base, findings: [] });
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.dimensions.map(({ dimension }) => dimension), DOSSIER_READINESS_DIMENSIONS);
  assert.ok(readiness.dimensions.every(({ state, reasons }) => state === "ready" && reasons.length === 0));
});

test("readiness blockers are deterministic, source-linked and status-independent", () => {
  const findings = [
    { code: "OUTPUT_STALE" as const, relatedObjectType: "governed_output" as const, relatedObjectId: "output_current_001" },
    { code: "DOCUMENT_REVIEW_REQUIRED" as const, relatedObjectType: "document" as const, relatedObjectId: "document_contract_002" },
    { code: "DOCUMENT_REQUIRED_MISSING" as const, relatedObjectType: null, relatedObjectId: null },
  ];
  const forward = computeDossierReadiness({ ...base, findings });
  const reversed = computeDossierReadiness({ ...base, findings: [...findings].reverse() });
  assert.deepEqual(forward, reversed);
  assert.equal(forward.ready, false);
  const documents = forward.dimensions[0];
  assert.equal(documents.state, "blocked");
  assert.deepEqual(documents.reasons.map(({ code }) => code), ["DOCUMENT_REQUIRED_MISSING", "DOCUMENT_REVIEW_REQUIRED"]);
  assert.equal(documents.reasons[1].deep_link, "/documents/document_contract_002");
  const output = forward.dimensions.find(({ dimension }) => dimension === "report_freshness");
  assert.equal(output?.reasons[0].deep_link, "/outputs/output_current_001");
});

test("not-applicable dimensions remain explicit and cannot hide blockers", () => {
  const readiness = computeDossierReadiness({
    ...base,
    findings: [],
    notApplicableDimensions: ["ai_proposals", "simulation_tests"],
  });
  assert.equal(readiness.dimensions.find(({ dimension }) => dimension === "ai_proposals")?.state, "not_applicable");
  assert.equal(readiness.dimensions.find(({ dimension }) => dimension === "simulation_tests")?.state, "not_applicable");
  assert.equal(readiness.ready, true);
  assert.throws(() => computeDossierReadiness({
    ...base,
    findings: [{ code: "AI_PROPOSAL_PENDING", relatedObjectType: "ai_proposal", relatedObjectId: "proposal_pending_001" }],
    notApplicableDimensions: ["ai_proposals"],
  }), (error: unknown) => error instanceof DossierReadinessError && error.code === "CONFLICTING_DIMENSION");
});

test("readiness rejects duplicate, malformed and non-reproducible inputs", () => {
  const finding = { code: "INFORMATION_REQUEST_OPEN" as const, relatedObjectType: "information_request" as const, relatedObjectId: "request_open_001" };
  assert.throws(() => computeDossierReadiness({ ...base, findings: [finding, finding] }), (error: unknown) => error instanceof DossierReadinessError && error.code === "DUPLICATE_FINDING");
  assert.throws(() => computeDossierReadiness({ ...base, revision: 0, findings: [] }), /positive dossier revision/u);
  assert.throws(() => computeDossierReadiness({ ...base, evaluatedAt: "yesterday", findings: [] }), /canonical ISO timestamp/u);
  assert.throws(() => computeDossierReadiness({
    ...base,
    findings: [{ code: "OUTPUT_REQUIRED", relatedObjectType: "governed_output", relatedObjectId: null }],
  }), /related-object fields must be paired/u);
});
