import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relative: string) {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

const snapshotsRoute = source("app/api/dossiers/[dossierId]/snapshots/route.ts");
const outputsRoute = source("app/api/dossiers/[dossierId]/outputs/route.ts");
const manifestRoute = source(
  "app/api/dossiers/[dossierId]/snapshots/[snapshotId]/manifest/route.ts",
);
const downloadRoute = source(
  "app/api/dossiers/[dossierId]/outputs/[outputId]/download/route.ts",
);
const governedServer = source("app/dossier-governed-output-server.ts");

test("snapshot and output aliases derive revision only from the authorized current dossier", () => {
  assert.match(snapshotsRoute, /export async function GET/u);
  assert.match(snapshotsRoute, /export async function POST/u);
  assert.match(outputsRoute, /export async function GET/u);
  assert.match(outputsRoute, /export async function POST/u);
  assert.match(
    snapshotsRoute,
    /"expectedRevision" in payload \|\| "expected_revision" in payload[\s\S]*: access\.dossier\.revision/u,
  );
  assert.match(
    outputsRoute,
    /"expectedRevision" in payload \|\| "expected_revision" in payload[\s\S]*: access\.dossier\.revision/u,
  );
  assert.ok(
    snapshotsRoute.indexOf("requireDossierAccess") < snapshotsRoute.indexOf("access.dossier.revision"),
  );
  assert.ok(
    outputsRoute.indexOf("requireDossierAccess") < outputsRoute.indexOf("access.dossier.revision"),
  );
});

test("snapshot and output mutations reject ambiguous or protected client fields", () => {
  assert.match(snapshotsRoute, /SNAPSHOT_FIELDS/u);
  assert.match(snapshotsRoute, /protected or unknown field/u);
  assert.match(snapshotsRoute, /"expectedRevision" in payload && "expected_revision" in payload/u);
  assert.match(outputsRoute, /OUTPUT_FIELDS/u);
  assert.match(outputsRoute, /protected or unknown field/u);
  assert.match(outputsRoute, /"snapshotId" in payload && "snapshot_id" in payload/u);
  assert.match(outputsRoute, /"outputId" in payload && "output_id" in payload/u);
  assert.match(outputsRoute, /Approval accepts only the exact output ID and expected revision/u);
  assert.match(outputsRoute, /Generation accepts only an exact snapshot ID and format/u);
});

test("the pilot fails closed for client or custom-redaction snapshots at route and service boundaries", () => {
  assert.match(snapshotsRoute, /DOSSIER_PILOT_SNAPSHOT_AUDIENCE/u);
  assert.match(snapshotsRoute, /DOSSIER_PILOT_REDACTION_PROFILE_ID/u);
  assert.match(snapshotsRoute, /snapshot_redaction_unavailable/u);
  assert.match(governedServer, /function assertPilotSnapshotPolicy/u);
  assert.match(governedServer, /snapshot_redaction_unavailable/u);
  assert.match(governedServer, /assertPilotSnapshotPolicy\(input\.audience, input\.redactionProfileId\)/u);
  assert.match(governedServer, /assertPilotSnapshotPolicy\(snapshotRecord\.audience, snapshotRecord\.redactionProfileId\)/u);
  assert.match(governedServer, /assertPilotSnapshotPolicy\(record\.audience, record\.redactionProfileId\)/u);
  assert.match(governedServer, /assertPilotSnapshotPolicy\(bound\.snapshotAudience, bound\.snapshotRedactionProfileId\)/u);
  assert.match(governedServer, /outputRow\.snapshotAudience[\s\S]*outputRow\.snapshotRedactionProfileId/u);
});

test("authorization runs before private storage access and downloads require download capability", () => {
  for (const route of [snapshotsRoute, outputsRoute, manifestRoute, downloadRoute]) {
    assert.ok(route.indexOf("requireDossierAccess") < route.indexOf("env as unknown"));
  }
  assert.match(manifestRoute, /requireDossierAccess\(context, dossierId, "download"\)/u);
  assert.match(downloadRoute, /requireDossierAccess\(context, dossierId, "download"\)/u);
  assert.match(manifestRoute, /parseDossierOpaqueId\(snapshotIdValue, "snapshot ID"\)/u);
  assert.match(downloadRoute, /parseDossierOpaqueId\(outputIdValue, "output ID"\)/u);
});

test("governed server uses exact published graphs, sealed audits, private integrity checks, and the A4 renderer", () => {
  assert.match(governedServer, /validatePublishedDecisionPackage\(published\)/u);
  assert.match(governedServer, /graph_validation_reference/u);
  assert.match(governedServer, /runtime_state_digest/u);
  assert.match(governedServer, /parameter_binding_digest/u);
  assert.match(governedServer, /receipt_digest/u);
  assert.match(governedServer, /audit_chain/u);
  assert.match(governedServer, /sealedAuditReceiptsFromSnapshot\(snapshot\)/u);
  assert.match(governedServer, /buildCaseReportArtifacts\(/u);
  assert.match(governedServer, /import\("pdfmake\/build\/pdfmake\.js"\)/u);
  assert.match(governedServer, /buildDossierGovernancePdfContent/u);
  assert.match(governedServer, /model\.snapshot\.generator\.contract_version/u);
  assert.match(governedServer, /canonicalDossierJson\(model\.snapshot\.simulation_inputs\)/u);
  assert.match(governedServer, /model\.snapshot\.approver_records\.map/u);
  assert.match(governedServer, /mergeDossierPdfArtifactResources\(artifactDefinitions\)/u);
  assert.match(governedServer, /mergeDossierPdfResources\(definitions, "images"\)/u);
  assert.match(governedServer, /mergeDossierPdfResources\(definitions, "patterns"\)/u);
  assert.match(governedServer, /mergeDossierPdfResources\(definitions, "styles"\)/u);
  assert.match(governedServer, /decision_package_report_resource_conflict/u);
  assert.match(governedServer, /decision_package_report_font_unavailable/u);
  assert.doesNotMatch(governedServer, /buildSimplePdf|asciiPdfText/u);
  assert.match(governedServer, /deleteVerifiedPrivateObject\(input\.bucket, manifestObjectReference\)/u);
  assert.match(governedServer, /deleteVerifiedPrivateObject\(input\.bucket, contentReference\)/u);
  assert.match(governedServer, /readVerifiedPrivateObject/u);
});
