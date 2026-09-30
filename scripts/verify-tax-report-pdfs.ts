import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { buildTaxCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { CASE_REPORT_PDF_FONTS } from "../app/report-audit-symbols";
import { createTaxReportExecution } from "../app/tax-report-execution";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { attach, reportFixture, reportOptions } from "../tests/helpers/tax-report-fixture";
import { assertA4Portrait, assertExtractedText, assertPdfDocumentMetadata, compactPdfText, discoverPoppler, extractPdfText,
  inspectPdf, portablePath, renderAndInspectPdf, runTool, sha256File, splitExtractedPdfPages } from "./tests/report-pdf-qa";

const project = process.cwd(), tools = discoverPoppler(project);
if (process.argv.includes("--preflight")) { console.log(JSON.stringify(tools)); process.exit(0); }
const root = resolve(project, process.env.TAX_REPORT_PDF_OUTPUT ?? ".artifacts/tax-report-pdfs");
// Each attempt has a separate retained directory. Never clean previous evidence.
mkdirSync(root, { recursive: true });
const run = resolve(root, new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(run);
const audit = JSON.parse(readFileSync(resolve(project, "app/report-audit-symbol-font.v1.json"), "utf8"));
(pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem({ ...pdfFonts, ...audit.vfs });
const corpus = JSON.parse(readFileSync(resolve(project, "tests/fixtures/tax-runtime/web-corpus.json"), "utf8")) as { cases: { name: string; response: string }[] };
type Cohort = { name: string; language: "en" | "ru"; profileId: string; presentationMode: CaseReportOptions["presentationMode"]; long?: boolean };
const cohort: Cohort[] = [];
for (const profileId of ["tax_position_memorandum", "economic_assessment"]) for (const language of ["en", "ru"] as const) {
  for (const presentationMode of ["decision", "medium", "full"] as const) cohort.push({ name: "amounts", profileId, language, presentationMode });
}
for (const name of ["negative-tax-effect", "dated-benefit", "rates-derived", "manual-override"]) for (const language of ["en", "ru"] as const) {
  cohort.push({ name, profileId: "economic_assessment", language, presentationMode: "full" });
}
for (const language of ["en", "ru"] as const) cohort.push({ name: "rates-derived", profileId: "tax_position_memorandum", language, presentationMode: "full", long: true });
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", windowsHide: true }).trim().length > 0;
const results = [];
for (const item of cohort) {
  const id = `${item.name}-${item.profileId}-${item.language}-${item.presentationMode}${item.long ? "-long" : ""}`;
  const { draft, document } = await reportFixture(item.name);
  if (item.long) {
    document.request.input.assumptions = Array.from({ length: 55 }, (_, index) => `Assumption ${String(index + 1).padStart(3, "0")}: Review the source and retain this statement.`).join("\n") + "\nEND OF COMPLETE ASSUMPTIONS";
    document.bindings[0].note = Array.from({ length: 45 }, (_, index) => `Source note ${String(index + 1).padStart(3, "0")}: Retain this component provenance.`).join("\n") + "\nEND OF COMPLETE COMPONENT NOTE";
    attach(draft, document);
  }
  const verified = await createTaxReportExecution(loadNodeTaxRuntime).calculate(draft);
  assert.equal(verified.status, "ready", `${id} fresh verification`);
  if (verified.status !== "ready") throw new Error("No verified financial result");
  const expected = JSON.parse(corpus.cases.find(entry => entry.name === item.name)!.response).calculation.result;
  assert.deepEqual(verified.snapshot.result, expected, `${id} full core financial parity with real runtime corpus`);
  const options = reportOptions(draft, item);
  const artifacts = await buildTaxCaseReportArtifacts(draft, options, loadNodeTaxRuntime);
  const taxModelBeforeLayout = JSON.stringify(artifacts.taxModel);
  const pdfPath = resolve(run, `${id}.pdf`), textPath = resolve(run, `${id}.txt`);
  const bytes = await new Promise<Buffer>((accept, reject) => {
    try { pdfMake.createPdf(artifacts.definition, undefined, CASE_REPORT_PDF_FONTS).getBuffer(value => accept(Buffer.from(value))); }
    catch (error) { reject(error); }
  });
  assert.equal(JSON.stringify(artifacts.taxModel), taxModelBeforeLayout, "pdfmake cannot mutate frozen report evidence");
  writeFileSync(pdfPath, bytes, { flag: "wx" });
  const info = inspectPdf(tools, pdfPath);
  assertA4Portrait(info, pdfPath);
  assertPdfDocumentMetadata(info, bytes, artifacts.definition.info!.title!, item.language === "en" ? "en-GB" : "ru-RU", pdfPath);
  const extracted = extractPdfText(tools, pdfPath, textPath);
  // -layout interleaves a short right-column value into a wrapped left label.
  // Independently retain logical content order for complete cell text checks.
  const rawTextPath = resolve(run, `${id}.raw.txt`);
  runTool(tools.pdftotext, ["-raw", "-enc", "UTF-8", pdfPath, rawTextPath], `pdftotext raw ${id}`);
  const orderedText = readFileSync(rawTextPath, "utf8");
  assertExtractedText(orderedText, options.profileLabel, `${id} localized profile label`, item.language);
  const pages = splitExtractedPdfPages(extracted, info.pages, pdfPath);
  for (const section of artifacts.taxModel.sections) {
    assertExtractedText(orderedText, section.title, `${id}/${section.id} heading`, item.language);
    for (const [label, value] of section.rows) {
      assertExtractedText(orderedText, label, `${id}/${section.id} label`, item.language);
      // Unique numbered long-fixture lines remain individually mandatory across
      // page furniture/repeated headers; no truncation or sampling is accepted.
      for (const line of value.split(/\r?\n/).filter(line => line.trim())) assertExtractedText(orderedText, line, `${id}/${section.id} complete value`, item.language);
    }
    if (section.note) assertExtractedText(orderedText, section.note, `${id}/${section.id} note`, item.language);
  }
  for (const forbidden of ["POISON cached result", "18446744073709551617", "future-preserved", "Purchase price", "Complete the missing inputs"]) assert.ok(!extracted.includes(forbidden), `${id} leaked or misleading text: ${forbidden}`);
  const pngs = renderAndInspectPdf(tools, pdfPath, resolve(run, "png", id), info);
  const taxPages = pages.flatMap((page, index) => compactPdfText(page, item.language).includes(compactPdfText(item.language === "en" ? "Current calculation" : "Актуальный расчёт", item.language)) ? [index + 1] : []);
  assert.ok(taxPages.length, `${id} result page not found`);
  results.push({ id, pdf: portablePath(run, pdfPath), bytes: bytes.length, sha256: sha256File(pdfPath), pages: info.pages,
    reportFingerprint: artifacts.reportModel.contentFingerprint, presentationFingerprint: artifacts.presentationFingerprint,
    taxEvidenceFingerprint: artifacts.taxModel.evidenceFingerprint, inputHash: verified.snapshot.input_hash, bindingHash: verified.snapshot.binding_hash,
    taxPages, renderedPages: pngs.map(page => ({ page: page.page, path: portablePath(run, page.path), sha256: page.sha256 })) });
  console.log(`PASS ${id}: ${info.pages} pages, complete tax text, full financial parity, A4/metadata/render checks`);
}
assert.equal(results.length, 22);
const receipt = { schema: "tax-report-pdf-qa-v1", sourceSha, dirty, scope: "additive internal model/renderer cohort; no editor/UI/history/product acceptance", tools: tools.versions,
  pdfs: results.length, pages: results.reduce((sum, item) => sum + item.pages, 0), results };
writeFileSync(resolve(run, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(`PASS ${results.length} tax PDFs. Retained receipt: ${resolve(run, "receipt.json")}`);
