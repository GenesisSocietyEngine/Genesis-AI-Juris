import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { buildCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { primaryCaseOutput } from "../app/case-type-playbooks";
import { computeDossierReadiness } from "../app/dossier-readiness";
import { dossierReadinessFindingsFromFacts, type DossierReadinessFacts } from "../app/dossier-readiness-server";
import { destinationForDeepLink, normalizeAssertions, safeMatterLink } from "../app/matters/matter-view-model";
import { isReportReceiptStale, reportReceipt } from "../app/report-model";
import { appendConnectedStudioItem } from "../app/studio-action-editing";
import { studioOverview, studioOverviewAction } from "../app/studio-overview";

const at = "2026-09-27T10:00:00.000Z";

// Synthetic read-model fixture, never an API bypass or a real review record.
// Dossier and Studio remain separate entities; no automatic mapping is assumed.
function fixtureC() {
  const assertions = [
    { assertion_id: "assertion_c_fact", assertion_type: "fact", statement: "SYNTHETIC: test reviewer recorded 300 signed commitments in source v1.", status: "accepted", source_anchor_ids: ["anchor_c_v1"], reviewed_by: "actor_synthetic_reviewer", reviewed_at: at },
    { assertion_id: "assertion_c_assumption", assertion_type: "assumption", statement: "SYNTHETIC: 150 additional commitments may arrive; this is unverified.", status: "needs_review", source_anchor_ids: [], reviewed_by: null, reviewed_at: null },
    { assertion_id: "assertion_c_conflict", assertion_type: "contradiction", statement: "SYNTHETIC: another claim says 600 signed; reconcile it to the 300 source figure.", status: "needs_review", source_anchor_ids: ["anchor_c_v1"], reviewed_by: null, reviewed_at: null },
    { assertion_id: "assertion_c_gap", assertion_type: "fact", statement: "SYNTHETIC historical accepted assertion has lost its source; do not rely on it.", status: "accepted", source_anchor_ids: [], reviewed_by: "actor_synthetic_reviewer", reviewed_at: at },
  ];
  const facts: DossierReadinessFacts = {
    keyDeadlineAt: "2026-10-01T10:00:00.000Z",
    documents: [{ id: "document_c", status: "accepted_source", currentVersionId: "version_c_1" }],
    informationRequests: [], pendingProposals: [], criticalDeadlines: [],
    contradictions: [{ id: "assertion_c_conflict" }],
    acceptedAssertions: assertions.filter(item => item.status === "accepted").map(item => ({ id: item.assertion_id, sourceAnchorIds: item.source_anchor_ids })),
    acceptedSourceAnchors: [{ id: "anchor_c_v1", documentVersionId: "version_c_1", currentDocumentVersionId: "version_c_1" }],
    decisionPackages: [{ id: "package_c", state: "current", graphValidationStatus: "valid", simulationRunReferences: ["synthetic_run_c"] }],
    outputs: [{ id: "output_c", snapshotRevision: 6, state: "current", reviewerApproved: false }],
  };
  return { assertions, facts };
}

test("fixture C retains distinct assertion types and addresses the exact contradiction and missing-source correction targets", () => {
  const fixture = fixtureC(), before = structuredClone(fixture);
  const assertions = normalizeAssertions({ professional_assertions: fixture.assertions });
  assert.deepEqual(assertions.map(item => [item.id, item.type, item.status, item.reviewedBy]), [
    ["assertion_c_fact", "fact", "accepted", "actor_synthetic_reviewer"],
    ["assertion_c_assumption", "assumption", "needs_review", null],
    ["assertion_c_conflict", "contradiction", "needs_review", null],
    ["assertion_c_gap", "fact", "accepted", "actor_synthetic_reviewer"],
  ]);
  const readiness = computeDossierReadiness({ dossierId: "dossier_ux_fixture_c", revision: 6, evaluatedAt: at,
    findings: dossierReadinessFindingsFromFacts(fixture.facts, 6, at) });
  const reasons = readiness.dimensions.flatMap(item => item.reasons);
  assert.equal(readiness.ready, false);
  for (const [code, expected] of [
    ["CONTRADICTION_UNRESOLVED", "/evidence/contradictions/assertion_c_conflict"],
    ["SOURCE_ANCHOR_MISSING", "/evidence/assertion_c_gap"],
  ]) {
    const reason = reasons.find(item => item.code === code)!;
    assert.equal(safeMatterLink(reason.deep_link), expected);
    assert.equal(destinationForDeepLink(reason.deep_link), "evidence");
  }
  assert.ok(reasons.some(item => item.code === "REVIEWER_APPROVAL_MISSING"));
  assert.deepEqual(fixture, before, "projection must not approve, rewrite or resolve any assertion");
});

test("fixture C source correction removes only its gap; a new source/version preserves the old anchor and requires output reassessment", () => {
  const { facts } = fixtureC();
  const corrected = structuredClone(facts);
  corrected.acceptedAssertions = corrected.acceptedAssertions.map(item => item.id === "assertion_c_gap" ? { ...item, sourceAnchorIds: ["anchor_c_v1"] } : item);
  const correctedFindings = dossierReadinessFindingsFromFacts(corrected, 6, at);
  assert.ok(!correctedFindings.some(item => item.code === "SOURCE_ANCHOR_MISSING"));
  assert.ok(correctedFindings.some(item => item.code === "CONTRADICTION_UNRESOLVED"));
  assert.ok(correctedFindings.some(item => item.code === "REVIEWER_APPROVAL_MISSING"));
  const changed = structuredClone(corrected);
  changed.documents = changed.documents.map(item => ({ ...item, currentVersionId: "version_c_2" }));
  changed.acceptedSourceAnchors = changed.acceptedSourceAnchors.map(item => ({ ...item, currentDocumentVersionId: "version_c_2" }));
  const findings = dossierReadinessFindingsFromFacts(changed, 7, at);
  assert.ok(findings.some(item => item.code === "SOURCE_VERSION_STALE" && item.relatedObjectId === "anchor_c_v1"));
  assert.ok(findings.some(item => item.code === "OUTPUT_STALE" && item.relatedObjectId === "output_c"));
  assert.ok(findings.some(item => item.code === "REVIEWER_APPROVAL_MISSING"));
  assert.equal(changed.acceptedSourceAnchors[0].documentVersionId, "version_c_1");
  assert.deepEqual(changed.outputs, facts.outputs, "detect staleness without rewriting an earlier output or inventing approval");
});

test("Studio correction uses the existing connected-item helper and invalidates the prepared recommendation and earlier report receipt", () => {
  const base = buildCanopyPackage("base").draft, before = structuredClone(base);
  const overview = studioOverview(base, "en");
  const gap = overview.blockers.find(item => item.id?.startsWith("nodes:") && /1 of 2/.test(item.text))!;
  assert.deepEqual(studioOverviewAction(base, gap), { step: 3, id: "studio-evidence-composer", nodeType: "evidence" });
  const profile = primaryCaseOutput(base.caseType), fingerprint = caseFingerprint(base);
  const options: CaseReportOptions = { language: "en", presentationMode: "decision", includeDecisionTree: false,
    profileId: profile.id, profileLabel: profile.label.en, audience: "internal", confidentiality: "confidential",
    preparedBy: "Synthetic author", preparedFor: "Synthetic reviewer", matterReference: "UX-FIXTURE-C",
    includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: false,
    generatedAt: at, currentFingerprint: fingerprint, workspaceFingerprint: null, privateCase: true,
    currentPublicationFingerprint: casePublicationFingerprint(base), workspacePublicationFingerprint: null,
    reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
    status: "draft", reviewerName: "", reviewerApproved: false };
  const old = buildCaseReportArtifacts(base, options);
  const oldBinding = { ...old.layoutModel, presentationFingerprint: old.presentationFingerprint };
  const receipt = reportReceipt(old.reportModel, at, oldBinding);
  const currentBinding = { reportFingerprint: old.reportModel.contentFingerprint, layoutFingerprint: old.layoutModel.layoutFingerprint, presentationFingerprint: old.presentationFingerprint };
  assert.equal(isReportReceiptStale(receipt, base, profile.id, currentBinding), false);
  const added = appendConnectedStudioItem(base, { type: "evidence", title: "Synthetic missing basis supplied", detail: "Synthetic unreviewed source explanation; no confirmation or approval is created.", relatedId: "demand" });
  assert.ok(added);
  const corrected = studioOverview(added.draft, "en");
  assert.equal(corrected.recordedCount, 2);
  assert.ok(!corrected.blockers.some(item => item.id === gap.id));
  assert.equal(corrected.recommendation.state, "reassessment");
  assert.equal(corrected.recommendation.text, null);
  assert.equal(corrected.humanEvidenceReview, "not_recorded_in_studio");
  assert.equal(isReportReceiptStale(receipt, added.draft, profile.id, currentBinding), true);
  assert.deepEqual(base, before);
});
