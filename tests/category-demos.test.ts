import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATEGORY_DEMOS, buildCategoryDemo, matchingCategoryDemos } from "../app/category-demos";
import { CASE_TYPE_REGISTRY } from "../app/case-type-registry";
import { evaluateCaseTypeDraft } from "../app/case-type-playbooks";
import { normalizeStudioDraft, caseFingerprint } from "../app/case-integrity";
import { compileStudioDraft } from "../app/studio-compiler";
import CaseTemplates from "../app/CaseTemplates";
import CategoryDemoCards from "../app/CategoryDemoCards";
import { matchesCanopy } from "../app/DemoCatalogueCards";

const all = { query: "", practice: "all", jurisdiction: "all", difficulty: "all", duration: "all", tag: "all", format: "all" };

test("every registered category has one distinct, bilingual, saveable worked example", () => {
  assert.deepEqual(CATEGORY_DEMOS.map(demo => demo.caseTypeId).sort(), CASE_TYPE_REGISTRY.map(type => type.id).sort());
  assert.equal(new Set(CATEGORY_DEMOS.map(demo => demo.title.en)).size, CASE_TYPE_REGISTRY.length);
  for (const locale of ["en", "ru"] as const) for (const definition of CASE_TYPE_REGISTRY) {
    const draft = buildCategoryDemo(definition.id, locale, "2026-10-01T00:00:00.000Z");
    const normalized = normalizeStudioDraft(JSON.parse(JSON.stringify(draft)));
    assert.equal(normalized.caseType?.id, definition.id);
    assert.equal(caseFingerprint(normalized), caseFingerprint(normalizeStudioDraft(draft)));
    assert.ok(draft.nodes.some(node => node.type === "evidence"));
    assert.equal(draft.nodes.filter(node => node.type === "outcome").length, 2);
    assert.ok(evaluateCaseTypeDraft(draft, locale).filter(check => check.id.startsWith("nodes:")).every(check => check.level === "ok"));
    assert.equal(draft.classification?.legalAsOf, undefined);
    assert.equal(draft.taxAnalysis, undefined);
    assert.equal(draft.parent, null);
    assert.equal(draft.protection, undefined);
  }
});

test("training fixture compiles to an actual branching route with distinct terminal outcomes", () => {
  for (const locale of ["en", "ru"] as const) {
    const compiled = compileStudioDraft(buildCategoryDemo("training_simulation", locale));
    assert.deepEqual(compiled.issues, []);
    assert.ok(compiled.scenario);
    assert.equal(compiled.scenario.stages.filter(stage => stage.terminal).length, 2);
    assert.ok(compiled.scenario.stages.some(stage => stage.options.length === 2));
  }
});

test("demo copies never mutate the reference fixture or another launch", () => {
  const first = buildCategoryDemo("tax_planning", "en");
  first.nodes[0].detail = "Changed in working copy";
  first.taxEconomics!.baselineAnnualTaxCost = 1;
  const second = buildCategoryDemo("tax_planning", "en");
  assert.notEqual(second.nodes[0].detail, first.nodes[0].detail);
  assert.equal(second.taxEconomics!.baselineAnnualTaxCost, 100000);
  assert.match(second.taxEconomics!.assumptions, /Synthetic teaching amounts/);
});

test("worked examples obey every catalogue facet and never leak into other formats", () => {
  assert.equal(matchingCategoryDemos(all, "en").length, 9);
  assert.equal(matchingCategoryDemos({ ...all, format: "worked" }, "en").length, 9);
  assert.equal(matchingCategoryDemos({ ...all, format: "walkthrough" }, "en").length, 0);
  assert.equal(matchingCategoryDemos({ ...all, format: "simulation" }, "en").length, 0);
  assert.equal(matchingCategoryDemos({ ...all, query: "Meridian" }, "en")[0]?.caseTypeId, "tax_compliance");
  assert.equal(matchingCategoryDemos({ ...all, query: "повторные проводки" }, "ru")[0]?.caseTypeId, "erp_incident");
  assert.equal(matchingCategoryDemos({ ...all, practice: "Tax planning" }, "en")[0]?.caseTypeId, "tax_planning");
  for (const facet of [{ jurisdiction: "NL" }, { difficulty: "Advanced" }, { duration: "long" }, { tag: "absent" }, { query: "no such case" }]) {
    assert.equal(matchingCategoryDemos({ ...all, ...facet }, "en").length, 0);
  }
  assert.equal(matchesCanopy({ ...all, format: "worked" }), false);
});

test("Templates exposes nine numbered empty starters and nine explicit examples without auto-launch", () => {
  let calls = 0;
  for (const locale of ["en", "ru"] as const) {
    const html = renderToStaticMarkup(createElement(CaseTemplates, { locale, onStart: () => calls++, onExample: () => calls++, onDemo: () => calls++ }));
    assert.equal((html.match(/class="template-number"/g) ?? []).length, 9);
    assert.equal((html.match(/class="primary-cta"/g) ?? []).length, 9);
    assert.equal((html.match(/class="secondary-cta"/g) ?? []).length, 10);
    assert.match(html, /aria-labelledby="template-news-title"/);
    assert.match(html, /role="status" aria-live="polite"/);
    const cards = renderToStaticMarkup(createElement(CategoryDemoCards, { locale, demos: CATEGORY_DEMOS, onOpen: () => calls++ }));
    assert.equal((cards.match(/class="demo-catalogue-card"/g) ?? []).length, 9);
    assert.doesNotMatch(cards, /Practitioner reviewed|Law as of/);
  }
  assert.equal(calls, 0);
});
