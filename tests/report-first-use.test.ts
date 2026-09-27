import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";

// Render the actual component; CSS geometry is verified separately in the browser.
const bundle = await build({ entryPoints: ["app/CaseReportDialog.tsx"], bundle: true, write: false,
  format: "esm", platform: "node", packages: "external", jsx: "automatic", loader: { ".css": "empty", ".module.css": "empty" } });
mkdirSync(".artifacts/report-first-use", { recursive: true });
const componentFile = resolve(".artifacts/report-first-use/component.mjs");
writeFileSync(componentFile, bundle.outputFiles[0].text);
const CaseReportDialog = (await import(pathToFileURL(componentFile).href)).default;

const draft = buildCanopyPackage("base").draft;
const common = {
  draft, currentFingerprint: caseFingerprint(draft), workspaceFingerprint: null,
  currentPublicationFingerprint: casePublicationFingerprint(draft), workspacePublicationFingerprint: null,
  privateCase: false, canGenerateReport: true, reportReceiptStorageScope: null,
  persistReportReceiptOnDevice: false, close() {}, completed() {},
};

for (const locale of ["en", "ru"] as const) {
  test(`first report offers a preliminary preview before optional controls (${locale})`, () => {
    const html = renderToStaticMarkup(createElement(CaseReportDialog, { ...common, locale }));
    const previewButton = html.match(/<button[^>]*data-report-preview[^>]*>/)?.[0];
    assert.ok(previewButton);
    assert.equal((html.match(/type="radio"/g)??[]).length,3);
    assert.ok(html.indexOf('name="report-presentation-format"') < html.indexOf('data-report-preview'), "all three formats appear before preview and download");
    assert.doesNotMatch(previewButton, /disabled/);
    assert.ok(html.indexOf("data-report-preview") < html.indexOf('<details class="case-report-settings"'));
    assert.match(html, /<details class="case-report-settings">/);
    assert.match(html, locale === "en" ? /Preliminary draft/ : /Предварительный черновик/);
    assert.match(html, locale === "en" ? /does not create an independent approval/ : /не создаёт независимого утверждения/);
    const developer = renderToStaticMarkup(createElement(CaseReportDialog, { ...common, locale, developerView: true }));
    assert.match(developer, /<details class="case-report-settings" open="">/);
  });
}

test("simplified report actions remain unavailable with inspection-only access", () => {
  const html = renderToStaticMarkup(createElement(CaseReportDialog, { ...common, locale: "en", canGenerateReport: false }));
  assert.match(html.match(/<button[^>]*data-report-preview[^>]*>/)?.[0] ?? "", /disabled/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Download PDF<\/button>/);
  assert.match(html, /Report export is unavailable in inspection-only mode/);
});
