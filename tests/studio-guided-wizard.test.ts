import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import StudioEntryScreen from "../app/StudioEntryScreen";
import StudioGuidedWizard, { recommendedGuidedStudioStep } from "../app/StudioGuidedWizard";
import { initialStudioWorkflowState, parseStudioWorkflowStep, reduceStudioWorkflow, restoredStudioWorkflowStep, serializedStudioWorkflowStep } from "../app/studio-workflow";

const appSource = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("guided workflow selects the first incomplete stage", () => {
  assert.equal(recommendedGuidedStudioStep([false, false, false, false, false, false]), 1);
  assert.equal(recommendedGuidedStudioStep([true, true, false, false, false, false]), 3);
  assert.equal(recommendedGuidedStudioStep([true, true, true, true, true, false]), 6);
  assert.equal(recommendedGuidedStudioStep([true, true, true, true, true, true]), 6);
});

test("shared workflow transitions and downstream invalidation are deterministic", () => {
  const described = reduceStudioWorkflow(initialStudioWorkflowState, { type: "complete", stage: "describe" });
  assert.equal(described.activeStage, "review_ai_draft");
  assert.deepEqual(described.completedStages, ["describe"]);
  const reviewed = reduceStudioWorkflow(described, { type: "complete", stage: "review_ai_draft" });
  const invalidated = reduceStudioWorkflow(reviewed, { type: "invalidate_from", stage: "review_ai_draft" });
  assert.equal(invalidated.activeStage, "review_ai_draft");
  assert.deepEqual(invalidated.completedStages, ["describe"]);
  assert.equal(parseStudioWorkflowStep("case_map"), 4);
  assert.equal(parseStudioWorkflowStep("6"), 6);
  assert.equal(parseStudioWorkflowStep("unknown"), null);
  assert.equal(serializedStudioWorkflowStep(5), "run_compare");
});

test("an empty untitled draft always restores at Step 1", () => {
  assert.equal(restoredStudioWorkflowStep(true, 6, 6), 1);
  assert.equal(restoredStudioWorkflowStep(true, null, 6), 1);
  assert.equal(restoredStudioWorkflowStep(false, 4, 6), 4);
  assert.equal(restoredStudioWorkflowStep(false, null, 6), 6);
  assert.match(appSource, /restoredStudioWorkflowStep\(guidedDraftIsEmpty, queryStep, storedStep\)/);
  assert.match(appSource, /window\.localStorage\.setItem\(guidedWorkflowKey, stage\)/);
});

test("guided Studio renders numbered bilingual stages and explicit input and next action", () => {
  const noop = () => undefined;
  for (const locale of ["en", "ru"] as const) {
    const markup = renderToStaticMarkup(createElement(StudioGuidedWizard, {
      locale, activeStep: 1, readiness: [true, true, true, true, false, false],
      onStepChange: noop, onFocusBrief: noop, onStartExample: noop,
      onBrowseDemos: noop, onImport: noop, caseName: "Canopy",
      saveState: "idle", validationReady: false,
    }));
    const labels = locale === "en"
      ? ["Brief", "Draft review", "Facts &amp; evidence", "Decision map", "Test", "Finish"]
      : ["Задача", "Черновик", "Факты и материалы", "Карта", "Тест", "Готово"];
    for (const label of labels) assert.ok(markup.includes(label), label);
    for (let number = 1; number <= 6; number += 1) {
      assert.ok(markup.includes("<b>" + number + "</b>"), "completed stages retain their numbers");
    }
    assert.match(markup, /aria-current="step"/);
    assert.match(markup, /<progress max="6"/);
    assert.ok(markup.includes(locale === "en" ? "Input" : "Нужно"));
    assert.ok(markup.includes(locale === "en" ? "Next" : "Далее"));
    const entry = renderToStaticMarkup(createElement(StudioEntryScreen, {locale, recentTitle: "Canopy", onCreate: noop, onImport: noop, onDemo: noop, onContinue: noop}));
    assert.ok(entry.includes(locale === "en" ? "Open Canopy overview" : "Открыть обзор Canopy"));
    assert.ok(entry.includes(locale === "en" ? "Create a case" : "Создать кейс"));
    assert.ok(entry.includes("JSON · Markdown · TXT"));
    assert.ok(entry.includes("Canopy"));
  }
});

test("guided stages progressively disclose the existing canonical editor", () => {
  assert.match(appSource, /visibleStep === 1\) && <section className="prompt-deck/);
  assert.match(appSource, /visibleStep === 2\) && activeAIResult/);
  assert.match(appSource, /visibleStep === 3\) && <><details id="studio-case-settings"/);
  assert.match(appSource, /visibleStep === 4\) && <section className="studio-workspace"/);
  assert.match(appSource, /visibleStep === 5 && packageRequiresPlayableRoute\)\) && <details className="studio-simulation-tools/);
  assert.match(appSource, /visibleStep === 6 && <section className="studio-finish/);
  assert.match(appSource, /displayMode === "developer" \|\| visibleStep/);
  assert.match(appSource, /User view/);
  assert.match(appSource, /Developer view/);
  assert.match(appSource, /window\.history\.pushState/);
  assert.match(appSource, /window\.localStorage\.setItem\(guidedWorkflowKey/);
  assert.match(appSource, /window\.addEventListener\("popstate"/);
});

test("guided shell retains narrow-layout and touch-friendly presentation", () => {
  assert.match(cssSource, /\.studio-guide ol\{display:grid;grid-template-columns:repeat\(6/);
  assert.match(cssSource, /@media\(max-width:640px\)[\s\S]*\.studio-guide ol\{grid-template-columns:repeat\(2/);
  assert.match(cssSource, /\.studio-user-view \.studio-quick-starts button\{min-height:78px/);
  assert.match(cssSource, /\.studio-finish-options\{display:grid;grid-template-columns:repeat\(3/);
});
