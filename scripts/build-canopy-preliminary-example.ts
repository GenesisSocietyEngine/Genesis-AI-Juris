import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { buildCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";

// Reproducible synthetic example. This command has no database, identity,
// publication, simulation, approval or receipt-writing capability.
const destination = resolve(process.argv[2] ?? ".artifacts/canopy-preliminary");
const language = process.argv[3] ?? "en";
assert.ok(language === "en" || language === "ru", "Report language must be en or ru");
const { draft, scenario } = buildCanopyPackage("base");
const fingerprint = caseFingerprint(draft);
const publicationReviewFingerprint = casePublicationFingerprint(draft);
const playableFingerprint = scenario.fingerprint;
assert.equal(fingerprint, "sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702");
assert.equal(playableFingerprint, "sha256-4c17139f6cf47399349aeaf27a473bbcb1429e7d6a9cc3eb0766e12ab290b31b");
const profile = primaryCaseOutput(draft.caseType);
const options: CaseReportOptions = {
  language, profileId: profile.id, profileLabel: profile.label[language],
  audience: "internal", confidentiality: "draft",
  preparedBy: "Synthetic demonstration", preparedFor: "Product review",
  matterReference: "CANOPY-BASE-2.0.0-PRELIMINARY",
  includeEconomics: true, includeRegisters: true, includeSources: true,
  includeAuditTrail: false, includeTechnicalIds: false,
  generatedAt: new Date().toISOString(),
  currentFingerprint: fingerprint, workspaceFingerprint: null,
  currentPublicationFingerprint: publicationReviewFingerprint, workspacePublicationFingerprint: null,
  privateCase: false, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
  status: "draft", reviewerName: "", reviewerApproved: false, redactedNodeIds: [],
};
const artifacts = buildCaseReportArtifacts(draft, options);
(pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);
const pdf = await new Promise<Buffer>((done, fail) => {
  try { pdfMake.createPdf(artifacts.definition).getBuffer(value => done(Buffer.from(value))); }
  catch (error) { fail(error); }
});
mkdirSync(destination, { recursive: true });
writeFileSync(resolve(destination, "Canopy_Preliminary_Analysis.pdf"), pdf);
writeFileSync(resolve(destination, "Canopy_Base_2.0.0.studio-draft.json"), JSON.stringify(draft, null, 2) + "\n");
writeFileSync(resolve(destination, "Canopy_Preliminary_Model.json"), JSON.stringify(artifacts.reportModel, null, 2) + "\n");
writeFileSync(resolve(destination, "sample-provenance.json"), JSON.stringify({
  kind: "synthetic-local-preliminary-report", generatedAt: options.generatedAt,
  pdfSha256: createHash("sha256").update(pdf).digest("hex"), fingerprint, playableFingerprint, publicationReviewFingerprint,
  approval: "none", productionRun: false, firstReportTiming: "Not verified",
  renderer: "app/case-report.ts", model: "Local report model; not a governed workflow JSON export",
  language, presentationFingerprint: artifacts.presentationFingerprint,
}, null, 2) + "\n");
console.log(JSON.stringify({ destination, pdfBytes: pdf.length, fingerprint, playableFingerprint, approval: "none" }));
