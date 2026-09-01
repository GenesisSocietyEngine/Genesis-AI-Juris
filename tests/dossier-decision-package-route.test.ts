import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/decision-packages/route.ts", import.meta.url),
  "utf8",
);
const integration = readFileSync(
  new URL("../app/dossier-decision-package-integration.ts", import.meta.url),
  "utf8",
);

function assertOrdered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding batch operation`);
    cursor = next;
  }
}

test("decision-package retrieval is participant-scoped, private, bounded, and cursor paged", () => {
  assert.match(route, /requireDossierAccess\(context, dossierId, "read"\)/u);
  assert.match(route, /MAX_PAGE_SIZE = 50/u);
  assert.match(route, /Math\.min\(parsed, MAX_PAGE_SIZE\)/u);
  assert.match(route, /parseDossierOpaqueId\(cursorValue, "decision-package cursor"\)/u);
  assert.match(route, /limit\(limit \+ 1\)/u);
  assert.match(route, /decision_packages: visible\.map\(projectPackageReference\)/u);
  assert.match(route, /dossierJson\(\{/u);
  assert.doesNotMatch(route, /Response\.json/u);
});

test("link mutation has a same-origin gate and an exact client-field allowlist", () => {
  assert.match(route, /isSameOriginMutation\(request\)/u);
  assert.match(route, /requireDossierAccess\(context, dossierId, "snapshot"\)/u);
  assert.match(route, /readJsonObject\(request, MAX_REQUEST_BYTES\)/u);
  assert.match(route, /PACKAGE_FIELDS/u);
  assert.match(route, /protected or unknown field/u);
  assert.match(route, /ALIASED_FIELDS\.some/u);
  assert.match(route, /"graphProposalId"/u);
  assert.match(route, /"simulationReceiptIds"/u);
  for (const protectedField of [
    "graphValidationStatus", "graph_validation_status", "graphDigest", "graph_digest",
    "simulationRunReferences", "simulation_run_references", "approvalState", "approval_state",
    "parentPackageId", "parent_package_id", "sourceDossierRevision", "source_dossier_revision",
    "createdByActorRef", "updatedByActorRef",
  ]) {
    assert.equal(
      route.slice(route.indexOf("const PACKAGE_FIELDS"), route.indexOf("export async function GET")).includes(`\"${protectedField}\"`),
      false,
      `${protectedField} must not be a request field`,
    );
  }
});

test("the server resolves and verifies one exact published case version", () => {
  assert.match(route, /eq\(caseVersions\.caseId, packageId\)/u);
  assert.match(route, /eq\(caseVersions\.version, packageVersion\)/u);
  assert.match(route, /eq\(caseVersions\.fingerprint, packageFingerprint\)/u);
  assert.match(route, /isNotNull\(caseVersions\.publishedAt\)/u);
  assert.match(route, /validatePublishedDecisionPackage\(published\)/u);
  assert.match(integration, /normalizeStudioDraft\(published\.payload\.studioDraft\)/u);
  assert.match(integration, /caseFingerprint\(draft\) !== published\.studioFingerprint/u);
  assert.match(integration, /draftParentMatchesPublishedLineage\(draft, published\)/u);
  assert.match(integration, /compileStudioDraft\(draft, published\.studioFingerprint\)/u);
  assert.match(integration, /compilation\.scenario\.fingerprint !== published\.packageFingerprint/u);
  assert.doesNotMatch(route, /caseDrafts|customCases|customCaseGrants/u);
});

test("published parent lineage must be exact, current for a new link, and revalidated against its published graph", () => {
  assert.match(route, /published\.parentPackageId !== null/u);
  assert.match(route, /eq\(caseVersions\.caseId, published\.parentPackageId\)/u);
  assert.match(route, /eq\(caseVersions\.version, published\.parentPackageVersion\)/u);
  assert.match(route, /eq\(caseVersions\.studioFingerprint, published\.parentPackageFingerprint\)/u);
  assert.match(route, /eq\(dossierDecisionPackageReferences\.packageId, publishedParent\.packageId\)/u);
  assert.match(route, /eq\(dossierDecisionPackageReferences\.packageVersion, publishedParent\.packageVersion\)/u);
  assert.match(route, /eq\(dossierDecisionPackageReferences\.packageFingerprint, publishedParent\.packageFingerprint\)/u);
  assert.match(route, /storedParent\.graphValidationStatus !== "valid"/u);
  assert.match(route, /storedParent\.approvalState !== "published"/u);
  assert.match(route, /!existing && storedParent\.state !== "current"/u);
  assert.match(route, /validatePublishedDecisionPackage\(publishedParent\)/u);
  assert.match(route, /parentValidationResult\.value\.graphDigest !== storedParent\.graphDigest/u);
  assert.match(route, /code: "package_lineage_missing_or_stale"/u);
});

test("graph validation and optional v61 simulation receipts remain distinct and fail closed", () => {
  assert.match(integration, /genesis-juris-deterministic-graph-validation-v1/u);
  assert.match(integration, /integrationSha256\(canonicalDossierJson\(graphPayload\)\)/u);
  assert.match(route, /graphValidationStatus: "valid"/u);
  assert.match(integration, /validationReference: `graph_validation_v1_/u);
  assert.match(route, /eq\(playSessions\.userEmail, context\.actor\.email\)/u);
  assert.match(route, /eq\(playSessions\.sessionKey|inArray\(playSessions\.sessionKey/u);
  assert.match(route, /eventCount: sql<number>`count\(\*\)`/u);
  assert.match(route, /proveV61SimulationReceipt/u);
  assert.match(route, /code: "simulation_receipt_unproven"/u);
  assert.match(integration, /record\.caseFingerprint !== expected\.packageFingerprint/u);
  assert.match(integration, /record\.status !== "completed"/u);
  assert.match(integration, /record\.eventCount !== record\.revision \+ 1/u);
  assert.doesNotMatch(integration, /canonical-runtime|dispatchCanonicalAction|advanceCanonicalTime/u);
});

test("graph proposals stay proposal-only until an exact source-grounded diff is accepted in the package batch", () => {
  assert.match(route, /proposal\.proposalType !== "graph_change"/u);
  assert.match(route, /sources\.some\(\(\{ reviewState \}\) => reviewState !== "accepted"\)/u);
  assert.match(route, /buildDecisionPackageGraphProposalDiff/u);
  assert.match(route, /verifyDecisionPackageGraphProposalDiff/u);
  assert.match(route, /acceptedObjectType: "decision_package_reference"/u);
  assert.match(route, /acceptedObjectId: referenceId/u);
  assert.match(route, /graphProposal\?\.needsAcceptance \? sql`exists/u);
  assert.match(route, /code: "graph_proposal_base_required"/u);
  assert.match(integration, /proposedCanonical !== expectedCanonical/u);
});

test("linking atomically advances revision, stales prior packages and outputs, then writes audits before the receipt", () => {
  assert.match(route, /expectedDossierRevision/u);
  assert.match(route, /eq\(dossiers\.revision, expectedRevision\)/u);
  assert.match(route, /insert\(dossierRevisionReceipts\)\.values\(revisionReceipt\)/u);
  assert.match(route, /update\(dossierDecisionPackageReferences\)\.set\(\{[\s\S]{0,220}state: "stale"/u);
  assert.match(route, /state: "current" as const/u);
  assert.match(route, /reason: "DECISION_PACKAGE_CHANGED"/u);
  assert.match(route, /eventType: "decision_package_linked"/u);
  assert.match(route, /summaryCode: "DECISION_PACKAGE_SUPERSEDED"/u);
  assert.match(route, /superseded_by_reference_id: referenceId/u);
  assert.match(route, /eventType: "output_marked_stale" as const/u);
  assert.match(route, /prepareDossierRevisionAuditBatch/u);
  assert.match(route, /unchangedReference/u);
  assert.match(route, /context\.db\.batch\(\[/u);
  assert.match(route, /\.\.\.auditEvents\.map\(\(event\) => context\.db\.insert\(dossierAuditEvents\)\.values\(event\)\)/u);
  assertOrdered(route.slice(route.indexOf("await context.db.batch([")), [
    "context.db.update(dossiers).set",
    "context.db.insert(dossierDecisionPackageReferences).values(values)",
    "context.db.insert(dossierOutputStateEvents).values",
    "context.db.insert(dossierAuditEvents).values(event)",
    "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
  ]);
});

test("an exact immutable reference is idempotent or accepts only append-only proven receipts", () => {
  assert.match(route, /isUnchangedReference\(/u);
  assert.match(route, /existing\.simulationRunReferences\.every\(\(reference\) => simulationRunReferences\.includes\(reference\)\)/u);
  assert.match(route, /simulationRunReferences,/u);
  assert.match(route, /code: "immutable_package_reference_conflict"/u);
  assert.match(route, /source_dossier_revision: existing\.sourceDossierRevision/u);
  assert.doesNotMatch(route, /DECISION_PACKAGE_RELINKED/u);
  assert.doesNotMatch(
    route,
    /existing\s*\?\s*context\.db\.update\(dossierDecisionPackageReferences\)/u,
  );
  assert.match(route, /context\.db\.insert\(dossierDecisionPackageReferences\)\.values\(values\)/u);
});

test("responses expose bounded metadata and preserve the simulation-readiness blocker", () => {
  assert.match(route, /graph_validation_reference/u);
  assert.match(route, /computeStoredDossierReadiness/u);
  assert.match(route, /package_type: \{/u);
  assert.match(route, /simulation_run_references: \[\.\.\.reference\.simulationRunReferences\]/u);
  const projection = route.slice(
    route.indexOf("function projectPackageReference"),
    route.indexOf("function isUnchangedReference"),
  );
  assert.doesNotMatch(projection, /payload|studioDraft|scenario/u);
});
