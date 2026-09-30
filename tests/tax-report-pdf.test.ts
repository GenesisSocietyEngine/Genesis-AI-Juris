import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseReportArtifacts, buildTaxCaseReportArtifacts } from "../app/case-report";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { formatTaxMoneyCents } from "../app/tax-value-format";
import { attach, fixture, reportFixture, reportOptions } from "./helpers/tax-report-fixture";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(strings);
}

test("both tax profiles and languages reach fresh exact-cent sections in all three report modes", async () => {
  let calculations = 0;
  const runtime = await loadNodeTaxRuntime();
  const load = async () => ({ ...runtime, execute(encoded: string) {
    if (JSON.parse(encoded).command === "tax_web_calculate") calculations++;
    return runtime.execute(encoded);
  } });
  const { draft } = await reportFixture(), before = structuredClone(draft);
  for (const profileId of ["tax_position_memorandum", "economic_assessment"]) {
    for (const language of ["en", "ru"] as const) for (const presentationMode of ["decision", "medium", "full"] as const) {
      const built = await buildTaxCaseReportArtifacts(draft, reportOptions(draft, { profileId, language, presentationMode }), load);
      const output = strings(built.definition).join("\n");
      assert.ok(output.includes(language === "en" ? "Current calculation" : "Актуальный расчёт"));
      if (presentationMode !== "full") {
        assert.ok(output.includes(language === "en" ? "Review the tax analysis and source evidence" : "Проверить налоговый анализ и исходные материалы"));
        assert.ok(!output.includes("Complete the missing inputs"));
        assert.ok(!output.includes("Закрыть существенные пробелы"));
      }
      const annual = built.taxModel.sections.find(section => section.id === "results")!.rows.find(([label]) => label === (language === "en" ? "Annualized net benefit" : "Чистая выгода в годовом выражении"));
      assert.ok(annual && output.includes(annual[1]));
      assert.equal(built.taxRendererVersion, "web-tax-pdf-v1");
      assert.match(built.definition.info!.subject!, /web-tax-pdf-v1/);
      assert.equal(built.reportModel.case.fingerprint, reportOptions(draft).currentFingerprint);
      assert.ok(JSON.stringify(built.layoutModel).includes(built.reportModel.contentFingerprint));
      for (const forbidden of ["POISON cached result", "18446744073709551617", "future-preserved", "Purchase price", "Cash after debt"]) assert.ok(!output.includes(forbidden), forbidden);
    }
  }
  assert.equal(calculations, 12);
  assert.deepEqual(draft, before, "render preparation cannot mutate saved authoring state");
});

test("pending runtime snapshots the full draft/options and cannot adopt caller edits", async () => {
  const { draft, document } = await reportFixture();
  const options = reportOptions(draft), before = structuredClone(draft);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = buildTaxCaseReportArtifacts(draft, options, async () => { await gate; return loadNodeTaxRuntime(); });
  draft.title = "LATE TITLE"; document.edit.baseline_annual_tax_cost = ""; attach(draft, document);
  options.language = "ru"; options.includeEconomics = false; options.redactedNodeIds = ["fact_z"];
  release();
  const built = await pending;
  assert.equal(built.reportModel.case.title, before.title);
  assert.equal(built.taxModel.language, "en");
  assert.equal(built.taxModel.includeEconomics, true);
  assert.ok(!strings(built.definition).includes("LATE TITLE"));
});

test("tax reports preserve refusal for incomplete/stale/opaque data, old APIs and disclosure or review gates", async () => {
  const { draft, document } = await reportFixture();
  let calls = 0;
  const load = async () => { calls++; return loadNodeTaxRuntime(); };
  assert.throws(() => buildCaseReportArtifacts(draft, reportOptions(draft)), /fresh shared Rust/);
  await assert.rejects(buildTaxCaseReportArtifacts(draft, reportOptions(draft, { currentFingerprint: "stale" }), load), /current case/);
  await assert.rejects(buildTaxCaseReportArtifacts(draft, reportOptions(draft, { redactedNodeIds: ["fact_z"] }), load), /redacted/);
  await assert.rejects(buildTaxCaseReportArtifacts(draft, reportOptions(draft, { profileId: "case_summary", profileLabel: "Unsupported profile control" }), load), /profile/);
  assert.equal(calls, 0);
  document.edit.implementation_cost = ""; attach(draft, document);
  await assert.rejects(buildTaxCaseReportArtifacts(draft, reportOptions(draft), load), /incomplete/);
  assert.equal(calls, 0);
  const stale = await reportFixture(); stale.draft.title = "Changed source";
  await assert.rejects(buildTaxCaseReportArtifacts(stale.draft, reportOptions(stale.draft), load), /stale/);
  assert.equal(calls, 0);
  const known = await reportFixture();
  await assert.rejects(buildTaxCaseReportArtifacts(known.draft, reportOptions(known.draft, { audience: "client", reviewerApproved: false }), load), /Report is not ready/);
});

test("exclude economics suppresses every generated tax value and provenance section", async () => {
  const { draft } = await reportFixture();
  for (const presentationMode of ["decision", "medium", "full"] as const) {
    const built = await buildTaxCaseReportArtifacts(draft, reportOptions(draft, { includeEconomics: false, presentationMode }), loadNodeTaxRuntime);
    assert.deepEqual(built.taxModel.sections, []);
    const output = strings(built.definition).join("\n");
    for (const excluded of ["Current calculation inputs", "Current calculation", "Confirmed source components", "Retained import provenance", "POISON cached result"]) assert.ok(!output.includes(excluded));
  }
});

test("attachment bytes affect evidence while language affects presentation; unsupported original glyphs refuse", async () => {
  const { draft, document } = await reportFixture();
  const original = await buildTaxCaseReportArtifacts(draft, reportOptions(draft), loadNodeTaxRuntime);
  const translated = await buildTaxCaseReportArtifacts(draft, reportOptions(draft, { language: "ru" }), loadNodeTaxRuntime);
  assert.equal(original.reportModel.contentFingerprint, translated.reportModel.contentFingerprint);
  assert.notEqual(original.presentationFingerprint, translated.presentationFingerprint);
  document.cached_response = "a different ignored cache"; attach(draft, document);
  const changed = await buildTaxCaseReportArtifacts(draft, reportOptions(draft), loadNodeTaxRuntime);
  assert.notEqual(original.taxModel.evidenceFingerprint, changed.taxModel.evidenceFingerprint);
  assert.notEqual(original.reportModel.contentFingerprint, changed.reportModel.contentFingerprint);
  assert.deepEqual(original.taxModel.sections, changed.taxModel.sections);
  assert.equal(formatTaxMoneyCents("1", "EUR", "en"), "0.01 EUR");
  const unsupported = fixture().draft;
  await assert.rejects(buildTaxCaseReportArtifacts(unsupported, reportOptions(unsupported), loadNodeTaxRuntime), /absent from the governed Roboto fonts/);
});
