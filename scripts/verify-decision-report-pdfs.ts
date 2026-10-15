import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { buildCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";
import { reportPdfFixtures } from "./tests/report-pdf-fixtures";
import { buildConvertedExample } from "../app/converted-examples";
import { assertA4Portrait, assertExtractedText, discoverPoppler, extractPdfText, inspectPdf, renderAndInspectPdf } from "./tests/report-pdf-qa";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, ".artifacts/decision-report-qa");
const baselinePath = resolve(root, "parity/decision-report-pdf-visual-baseline.v1.json");
const updateValue = process.env.REPORT_DECISION_PDF_UPDATE_BASELINE ?? "";
assert.ok(updateValue === "" || updateValue === "1", "Baseline updates require explicit value 1");
const tools = discoverPoppler(root);
for (const version of Object.values(tools.versions)) assert.ok(version.includes("25.07.0"), "Poppler 25.07.0 is required");
(pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem(pdfFonts);
const fixtureIds = ["golden-general_advisory-en-internal", "golden-general_advisory-ru-internal", "stress-long-title-en", "stress-long-title-ru"];
const fixtures = reportPdfFixtures().filter(fixture => fixtureIds.includes(fixture.id));
assert.equal(fixtures.length, 4);
// Retain the historical ERP version that exposed the production orphan page.
for (const language of ["en", "ru"] as const) fixtures.push({
  id: `erp-historic-${language}`, family: "converted-erp", tags: ["orphan-page-regression"], language, audience: "internal",
  draft: buildConvertedExample("be_commercial_failed_erp_001", language, "2026-10-14T08:00:00.000Z", "2.3.0"),
});
const entries = [];
// New-format cohort is version-pinned; historical fixtures above remain byte-bound.
for (const language of ["en", "ru"] as const) for (const [label, caseId] of [["erp", "be_commercial_failed_erp_001"], ["greenfire", "greenfire_first_72_hours"]] as const) fixtures.push({
  id: `${label}-professional-25-${language}`, family: "professional-25", tags: ["professional-brief-regression"], language, audience: "internal",
  draft: buildConvertedExample(caseId, language, "2026-10-14T08:00:00.000Z", "2.5.0"),
});
for (const fixture of fixtures) for (const mode of ["decision", "medium"] as const) {
  if (["converted-erp", "professional-25"].includes(fixture.family) && mode === "medium") continue;
  const id = `${fixture.id}-${mode}`;
  const draft = structuredClone(fixture.draft);
  if (fixture.id.startsWith("stress-long-title")) draft.title = fixture.language === "en"
    ? "Cross-border supplier transition — review the mandate, clearance, accountability and retained evidence before committing to the proposed operating model"
    : "Переход к трансграничной модели поставок — проверка мандата, разрешений, ответственности и сохранённых доказательств до принятия обязательств по предлагаемой модели работы";
  const assumed = draft.nodes.find(node => node.type === "fact");
  if (assumed) assumed.factStatus = "assumed";
  const fingerprint = caseFingerprint(draft), publication = casePublicationFingerprint(draft);
  const profile = primaryCaseOutput(draft.caseType);
  const options: CaseReportOptions = {
    language: fixture.language, presentationMode: mode, includeDecisionTree: mode === "medium",
    profileId: profile.id, profileLabel: profile.label[fixture.language], audience: "internal", confidentiality: "draft",
    preparedBy: "CaseVant synthetic PDF QA", preparedFor: "Internal verification", matterReference: id,
    includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: false,
    generatedAt: "2026-10-14T08:00:00.000Z", currentFingerprint: fingerprint, workspaceFingerprint: null,
    currentPublicationFingerprint: publication, workspacePublicationFingerprint: null, privateCase: true,
    reportReceiptStorageScope: null, persistReportReceiptOnDevice: false, status: "draft", reviewerApproved: false,
  };
  const artifacts = buildCaseReportArtifacts(draft, options);
  const pdf = await new Promise<Buffer>((done, reject) => {
    try { pdfMake.createPdf(artifacts.definition).getBuffer(value => done(Buffer.from(value))); } catch (error) { reject(error); }
  });
  mkdirSync(output, { recursive: true });
  const pdfPath = resolve(output, `${id}.pdf`), textPath = resolve(output, `${id}.txt`);
  writeFileSync(pdfPath, pdf);
  const info = inspectPdf(tools, pdfPath); assertA4Portrait(info, pdfPath);
  const text = extractPdfText(tools, pdfPath, textPath);
  if (fixture.family === "professional-25") {
    assert.ok(info.pages <= 3, `${id}: new-format Base target is at most three pages`);
    for (const question of draft.nodes.filter(node => node.id.startsWith("review-question-"))) assertExtractedText(text, question.title, id, fixture.language);
    assertExtractedText(text, fixture.language === "en" ? "Fictional review scaffold" : "Вымышленная структура проверки", id, fixture.language);
    assertExtractedText(text, fixture.language === "en" ? "No independent expert approval" : "Независимое экспертное утверждение", id, fixture.language);
  }
  if (fixture.family === "converted-erp") {
    assert.ok(info.pages <= 3, `${id}: ERP Base target is at most three pages`);
    const qualification = fixture.language === "en" ? "Roles are proposed responsibilities" : "Роли — предлагаемая ответственность";
    const qualificationPage = text.split("\f").find(page => page.includes(qualification));
    assert.ok(qualificationPage, `${id}: proposed-role qualification retained`);
    assertExtractedText(qualificationPage, fixture.language === "en" ? "What this assessment rests on" : "На чём основана оценка", id, fixture.language);
    assertExtractedText(text, fixture.language === "en" ? "No independent expert approval" : "Независимое экспертное утверждение", id, fixture.language);
  }
  assertExtractedText(text, "CaseVant", id, fixture.language);
  assertExtractedText(text, draft.title, id, fixture.language);
  assert.ok(!text.includes("GENESIS: JURIS"), `${id} retains obsolete branding`);
  if (assumed) assertExtractedText(text, fixture.language === "en" ? "Assumed statement" : "Допущение", id, fixture.language);
  const pages = renderAndInspectPdf(tools, pdfPath, resolve(output, "png", id), info, 96);
  entries.push({ id, language: fixture.language, presentationMode: mode,
    caseFingerprint: fingerprint, reportFingerprint: artifacts.reportModel.contentFingerprint,
    presentationFingerprint: artifacts.presentationFingerprint,
    fixtureSha256: createHash("sha256").update(JSON.stringify(draft)).digest("hex"),
    pages: pages.map(page => ({ page: page.page, width: page.width, height: page.height, pngSha256: page.sha256 })),
  });
}
const current = { format: "casevant-decision-report-pdf-visual-baseline", version: 1,
  runtime: { platform: process.platform, architecture: process.arch,
    pdfmake: JSON.parse(readFileSync(resolve(root, "node_modules/pdfmake/package.json"), "utf8")).version as string,
    fontVfsSha256: createHash("sha256").update(readFileSync(resolve(root, "node_modules/pdfmake/build/vfs_fonts.js"))).digest("hex") },
  popplerVersion: "25.07.0", dpi: 96, selection: "All pages of Base and Medium EN/RU ordinary and long-title fixtures, historic ERP Base EN/RU and professional 2.5 ERP/GreenFire Base EN/RU", entries };
writeFileSync(resolve(output, "current-baseline.json"), JSON.stringify(current, null, 2) + "\n");
if (updateValue === "1") writeFileSync(baselinePath, JSON.stringify(current, null, 2) + "\n");
else assert.deepEqual(current, JSON.parse(readFileSync(baselinePath, "utf8")), "Base/Medium visual baseline differs; inspect changes before an explicit update");
console.log(JSON.stringify({ pdfs: entries.length, pages: entries.reduce((total, entry) => total + entry.pages.length, 0), baselineUpdated: updateValue === "1", output }));
