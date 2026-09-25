import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CaseReportDialog from "../app/CaseReportDialog";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";

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
