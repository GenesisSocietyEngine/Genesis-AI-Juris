import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import StudioFirstCaseGuide from "../app/StudioFirstCaseGuide";
import StudioPortalActions, { StudioActionGroups as StudioUserMoreActions } from "../app/StudioUserMoreActions";
import StudioActionPanel from "../app/StudioActionPanel";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { createOperationsDiagnostic } from "../app/operations-diagnostic";

const noop = () => {};
const props = { locale: "en" as const, hasStructure: true, hasTitle: true, saved: false, busy: false, canSave: true, needsSignIn: false, onBrief: noop, onTitle: noop };

test("compact coaching leaves Save/Report to the header and hides confirmed-case coaching", () => {
  for (const locale of ["en", "ru"] as const) {
    const unsaved = renderToStaticMarkup(createElement(StudioFirstCaseGuide, {...props,locale}));
    assert.doesNotMatch(unsaved, /<button|<h2|open=""|href=/);
    assert.match(unsaved, /<details/);
    assert.ok(unsaved.includes(locale === "en" ? "Help with this step" : "Помощь на этом шаге"));
    assert.ok(unsaved.includes(locale === "en" ? "Saving and exporting do not grant approval" : "Сохранение и экспорт не означают утверждения"));
    assert.equal(renderToStaticMarkup(createElement(StudioFirstCaseGuide, {...props,locale,saved:true})), "");
    assert.notEqual(renderToStaticMarkup(createElement(StudioFirstCaseGuide, {...props,locale,saved:false})), "");
    const oversized = renderToStaticMarkup(createElement(StudioFirstCaseGuide, {...props,locale,canSave:false,saved:true}));
    assert.match(oversized.split("<details")[0], /id="first-case-save-limit" role="status"/);
  }
  assert.match(renderToStaticMarkup(createElement(StudioFirstCaseGuide,{...props,needsSignIn:true})), /Sign in when you use Save above/);
  assert.match(renderToStaticMarkup(createElement(StudioFirstCaseGuide,{...props,needsProfile:true})), /Complete your profile when you use Save above/);
});

test("compact coaching retains only targeted brief/title actions and prevents busy activation", () => {
  let brief = 0, title = 0;
  for(const [change,expected] of [[{hasStructure:false,hasTitle:false},"Write the brief"],[{hasTitle:false},"Add a title"]] as const) {
    const tree = StudioFirstCaseGuide({...props,...change,onBrief:()=>brief++,onTitle:()=>title++})!;
    const button = tree.props.children[0].props.children[1];
    assert.equal(button.props.children,expected); button.props.onClick();
    const busy = renderToStaticMarkup(createElement(StudioFirstCaseGuide,{...props,...change,busy:true}));
    assert.match(busy, /disabled=""/);
  }
  assert.equal(brief,1); assert.equal(title,1);
});

test("application retains header authority, unsaved-input and failure guidance without duplicate coaching handlers", () => {
  const app = readFileSync("app/JurisApp.tsx", "utf8");
  const guide=app.slice(app.indexOf("<StudioFirstCaseGuide locale="),app.indexOf("/></Suspense>",app.indexOf("<StudioFirstCaseGuide locale=")));
  assert.doesNotMatch(guide,/onSave=|onReport=|saveConfirmedInSession=/);
  assert.match(app, /visibleStep < 5 \|\| !saveWithinEnvelope/);
  assert.match(app, /id="studio-save-status"[\s\S]*?Saved to workspace/);
  assert.match(app, /displayMode === "developer" \|\| !\["saved", "submitted"\]\.includes\(visibleWorkspaceState\)/);
  assert.match(app, /canDuplicate && !\["error", "conflict", "auth_required"\]\.includes\(visibleWorkspaceState\)/);
  assert.match(app, /\["error", "conflict", "auth_required"\]\.includes\(visibleWorkspaceState\)[\s\S]*?Retry save/);
  assert.match(app, /studio-evidence-pending/);
  assert.match(app, /savedCaseHref=\{customCaseId && \["saved", "submitted"\]\.includes\(visibleWorkspaceState\)/);
});

test("saved-version inspection is inside sidebar action groups and preserves the exact separate-tab destination", () => {
  const base = {grouped:true,locale:"en" as const,canDuplicate:true,exportReady:true,feedbackLabel:"Feedback",importLabel:"Import",exportLabel:"Export",startExample:noop,startTax:noop,requestFeedback:noop,importJson:noop,exportJson:noop,saveDevice:noop,markdownLoaded:noop,markdownOpened:noop,markdownFailed:noop};
  for (const locale of ["en", "ru"] as const) {
    const html = renderToStaticMarkup(createElement(StudioUserMoreActions, {...base,locale,savedCaseHref:"/studio?view=studio&custom_case=48&lang="+locale}));
    assert.match(html, /<div class="studio-sidebar-action-groups"><details[\s\S]*?<a class="secondary-cta"/);
    assert.match(html, /custom_case=48/);
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    assert.ok(html.includes(locale === "en" ? "JSON requires this exact version saved to workspace" : "Для JSON сохраните точную версию в workspace"));
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(StudioUserMoreActions,base)), /Inspect saved version/);
});

test("sidebar groups retain bilingual labels, protection and readiness without an SSR duplicate", () => {
  const base = {grouped:true,canDuplicate:false,exportReady:true,feedbackLabel:"Feedback",importLabel:"Import",exportLabel:"Export",startExample:noop,startTax:noop,requestFeedback:noop,importJson:noop,exportJson:noop,saveDevice:noop,markdownLoaded:noop,markdownOpened:noop,markdownFailed:noop};
  for (const locale of ["en", "ru"] as const) {
    const html = renderToStaticMarkup(createElement(StudioUserMoreActions, {...base,locale}));
    assert.equal((html.match(/<details /g) ?? []).length, 3);
    assert.equal((html.match(/ disabled=""/g) ?? []).length, 5);
    for (const label of locale === "en" ? ["Start or review", "Case briefs", "Case files &amp; backups"] : ["Старт и рецензия", "Описание кейса", "Файлы и резервные копии"]) assert.ok(html.includes(label));
    assert.equal(renderToStaticMarkup(createElement(StudioPortalActions, {...base,locale})), "", "the unmounted sidebar has no duplicate commands or retained owner");
  }
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


test("first-case pending labels distinguish checking, saving, restoring and check failure in both languages", () => {
  const labels = {
    en: {checking:"Checking current changes…",saving:"Saving…",restoring:"Preparing workspace…",check_failed:"Check needs retry"},
    ru: {checking:"Проверка текущих изменений…",saving:"Сохранение…",restoring:"Подготовка рабочего пространства…",check_failed:"Повторите проверку"},
  };
  for(const locale of ["en","ru"] as const) for(const busyReason of ["checking","saving","restoring","check_failed"] as const) {
    const html=renderToStaticMarkup(createElement(StudioFirstCaseGuide,{...props,locale,busy:true,busyReason}));
    assert.ok(html.includes(labels[locale][busyReason]));assert.match(html,/role="status"/);assert.doesNotMatch(html,/<button/);
    assert.doesNotMatch(html,/This version has a confirmed workspace save|Сохранение этой версии в рабочем пространстве подтверждено/);
  }
});


test("review working-save remains available during analysis but respects restore, permission, size and pending writes", () => {
  const base={draft:buildCanopyPackage("base").draft,checks:[],locale:"en" as const,checking:true,canEdit:true,onOpen:noop,onReport:noop,onSave:noop,saved:false,saving:false,withinEnvelope:true};
  const saveButton=(changes={})=>[...renderToStaticMarkup(createElement(StudioActionPanel,{...base,...changes})).matchAll(/<button\b[\s\S]*?<\/button>/g)].find(match=>match[0].includes("Save working case"))?.[0]??"missing";
  assert.match(saveButton(),/Save working case/);assert.doesNotMatch(saveButton(),/disabled=/);
  for(const change of [{restoring:true},{canEdit:false},{withinEnvelope:false},{saving:true}]) assert.match(saveButton(change),/disabled=""/);
});
