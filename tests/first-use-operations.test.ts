import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudioFirstCaseGuide from "../app/StudioFirstCaseGuide";
import { createOperationsDiagnostic } from "../app/operations-diagnostic";

const noop = () => {};
const props = { locale: "en" as const, hasStructure: true, hasTitle: true, saved: false, busy: false, canSave: true, needsSignIn: false, savedCaseHref: "/studio?custom_case=case-1", onBrief: noop, onTitle: noop, onSave: noop, onReport: noop };

test("first-case guidance distinguishes content, pending work and confirmed persistence", () => {
  const unsaved = renderToStaticMarkup(createElement(StudioFirstCaseGuide, props));
  assert.match(unsaved, /Save this case/);
  assert.doesNotMatch(unsaved, /href=|This version has a confirmed/);
  const guest = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, needsSignIn: true }));
  assert.match(guest, /Sign in and save/);
  const profile = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, needsProfile: true }));
  assert.match(profile, /Complete profile and save/);
  const saving = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, busy: true }));
  assert.match(saving, /disabled=""/);
  assert.doesNotMatch(saving, /This version has a confirmed/);
  const saved = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, saved: true }));
  assert.match(saved, /Preview report/);
  assert.match(saved, /href="\/studio\?custom_case=case-1" target="_blank" rel="noopener noreferrer"/);
  assert.match(saved, /This version has a confirmed workspace save/);
  assert.match(saved, /Saving and exporting do not grant approval/);
  const dirtyAgain = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, saved: false }));
  assert.doesNotMatch(dirtyAgain, /Open saved copy/);
});

test("first-case guidance prioritizes missing content and preserves both languages", () => {
  const empty = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, hasStructure: false, hasTitle: false }));
  assert.match(empty, /Write the brief/);
  const untitled = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, hasTitle: false }));
  assert.match(untitled, /Add a title/);
  const oversized = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, canSave: false }));
  assert.match(oversized, /disabled=""/);
  const ru = renderToStaticMarkup(createElement(StudioFirstCaseGuide, { ...props, locale: "ru", saved: true }));
  assert.match(ru, /Сохранение этой версии в рабочем пространстве подтверждено/);
  assert.match(ru, /Сохранение и экспорт не означают утверждения/);
});

test("diagnostic downloads allowlist operational data and retain freshness limitations", () => {
  const snapshot = {
    schema: "operations-dashboard-v1", state: "no_data" as const,
    generatedAt: "2026-10-05T12:00:00Z", fromInclusive: "2026-10-05T11:00:00Z", toExclusive: "2026-10-05T12:00:00Z",
    aggregate: { replayInternalFailures: 2, expectedRevisionMismatches: 0, expectedFingerprintMismatches: 0, internalRevisionMismatches: 0, internalFingerprintMismatches: 0, historicalMisses: 0, internalHistoricalMisses: 0, secret: "PRIVATE-CONTENT" },
    release: { deploymentVersion: "v108", webCommit: "a".repeat(40), bundleRevision: 12, runtimeRevision: "runtime-v1", playedCaseSchemaRevision: 3, token: "PRIVATE-CONTENT" },
    alerts: [{ severity: "warning", window: "5m", count: 2, ratio: null, label: "PRIVATE-CONTENT", userId: "PRIVATE-CONTENT" }],
    caseContent: "PRIVATE-CONTENT", email: "PRIVATE-CONTENT",
  };
  const result = createOperationsDiagnostic(snapshot, "2026-10-05T12:00:05Z", true);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-CONTENT|caseContent|userId|email|token/);
  assert.equal(result.refreshFailed, true);
  assert.equal(result.externalNotification, "unavailable");
  assert.equal(result.aggregate.replayInternalFailures, 2);
  assert.equal(result.lastSuccessfulReadAt, "2026-10-05T12:00:05.000Z");
  const invalid = createOperationsDiagnostic({ ...snapshot, aggregate: { ...snapshot.aggregate, replayInternalFailures: Number.NaN }, generatedAt: "invalid", release: null }, "invalid", false);
  assert.equal(invalid.aggregate.replayInternalFailures, null, "missing values must not be represented as zero failures");
  assert.equal(invalid.generatedAt, null);
  assert.equal(invalid.release, null);
});
