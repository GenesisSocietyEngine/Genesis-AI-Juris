import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { recommendedGuidedStudioStep } from "../app/StudioGuidedWizard";
import { initialStudioWorkflowState, parseStudioWorkflowStep, reduceStudioWorkflow, serializedStudioWorkflowStep } from "../app/studio-workflow";

const wizardSource = readFileSync(new URL("../app/StudioGuidedWizard.tsx", import.meta.url), "utf8");
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

test("guided Studio exposes six bilingual, keyboard-accessible stages", () => {
  for (const label of ["Brief", "AI draft", "Case facts", "Decision map", "Test", "Finish"]) {
    assert.match(wizardSource, new RegExp(`label: "${label}"`));
  }
  for (const label of ["Задача", "AI-черновик", "Факты", "Карта", "Тест", "Готово"]) {
    assert.match(wizardSource, new RegExp(`label: "${label}"`));
  }
  assert.match(wizardSource, /aria-current=\{active \? "step"/);
  assert.match(wizardSource, /<progress max=\{6\}/);
  assert.match(wizardSource, /Complete the task below to continue/);
  assert.match(wizardSource, /Describe my own case/);
  assert.match(wizardSource, /Try the guided example/);
  assert.match(wizardSource, /Import an existing case/);
});

test("guided stages progressively disclose the existing canonical editor", () => {
  assert.match(appSource, /guidedStep === 1\) && <section className="prompt-deck/);
  assert.match(appSource, /guidedStep === 2\) && activeAIResult/);
  assert.match(appSource, /guidedStep === 3\) && <><div id="studio-case-settings"/);
  assert.match(appSource, /guidedStep === 4\) && <section className="studio-workspace"/);
  assert.match(appSource, /guidedStep === 5\) && <section className="studio-bottom/);
  assert.match(appSource, /guidedStep === 6 && <section className="studio-finish/);
  assert.match(appSource, /displayMode === "developer" \|\| guidedStep/);
  assert.match(appSource, /Guided · User view/);
  assert.match(appSource, /Expert · Developer view/);
  assert.match(appSource, /window\.history\.pushState/);
  assert.match(appSource, /window\.localStorage\.setItem\(guidedWorkflowKey/);
  assert.match(appSource, /window\.addEventListener\("popstate"/);
});

test("guided shell retains narrow-layout and touch-friendly presentation", () => {
  assert.match(cssSource, /\.studio-guide ol\{display:grid;grid-template-columns:repeat\(6/);
  assert.match(cssSource, /@media\(max-width:640px\)[\s\S]*\.studio-guide ol\{grid-template-columns:repeat\(2/);
  assert.match(cssSource, /\.studio-quick-starts button\{min-width:0;min-height:124px/);
  assert.match(cssSource, /\.studio-finish-options\{display:grid;grid-template-columns:repeat\(3/);
});
