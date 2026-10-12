import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DemoCatalogueCards, { matchesCanopy, type DemoCard } from "../app/DemoCatalogueCards";
import CaseTemplates from "../app/CaseTemplates";
import { bundledCataloguePresentation } from "../app/catalogue-fallback";
import { demoLearningPrompt } from "../app/demo-learning-prompts";
import DemoCases from '../app/DemoCases';
import CaseExampleLibrary from '../app/CaseExampleLibrary';
import { CONVERTED_EXAMPLES, CONVERTED_EXAMPLE_VERSION } from '../app/converted-examples';
import type { PublishedCaseSummary } from '../app/JurisApp';

const card: DemoCard = { id:"greenfire_first_72_hours", title:"GreenFire — The First 72 Hours", summary:"A fictional industrial incident.", jurisdiction:"NL", practice:"Environmental & crisis", duration:35, version:"0.4.0", review:"Editorial preview", author:"GENESIS" };
const props = { locale:"en" as const, cards:[card], showCanopy:true, busy:false, launch:()=>{}, feedback:()=>{}, openCanopy:async()=>{}, canopyWorkflowHref:"/canopy" };

test('library metadata and Canopy walkthrough use the current package version and actual category', () => {
  const records = Object.keys(CONVERTED_EXAMPLES).map(id => ({id, jurisdiction:'BE', authorName:'CaseVant', currentVersion:'1.0.0'} as PublishedCaseSummary));
  for (const locale of ['en', 'ru'] as const) {
    const html = renderToStaticMarkup(createElement(CaseExampleLibrary, { locale, records, restorePlaySession() {}, launchCase() {}, requestFeedback() {}, openCanopy:async()=>{}, canopyWorkflowHref:'/canopy', openTemplates() {}, openCategoryDemo() {}, exampleLaunch:null, cancelExample() {} }));
    assert.equal((html.match(new RegExp('v' + CONVERTED_EXAMPLE_VERSION.replaceAll('.', '\\.'), 'g')) ?? []).length, 5);
    assert.ok(!html.includes('<option value="category-demo">'));
    assert.match(html, locale === 'en' ? /Converted template · review required\. Legacy source v1\.0\.0/ : /Преобразованный шаблон · требуется проверка\. Исходный пакет v1\.0\.0/);
    const walkthrough = renderToStaticMarkup(createElement(DemoCases, {locale,openCanopy:async()=>{},canopyWorkflowHref:'/canopy'}));
    assert.match(walkthrough, locale === 'en' ? /Featured example · Advisory decision/ : /Рекомендуемый пример · Консультационное решение/);
    assert.doesNotMatch(walkthrough, /Канонический демо-кейс · Бизнес-решение/);
  }
});
test("catalogue shows neutral choices without opening Canopy or launching a simulation", () => {
  let calls = 0;
  const html = renderToStaticMarkup(createElement(DemoCatalogueCards, { ...props, launch:()=>{calls++;}, openCanopy:async()=>{calls++;} }));
  assert.equal(calls,0);
  assert.match(html, /Project Canopy/);
  assert.match(html, /GreenFire — The First 72 Hours/);
  assert.match(html, /Take guided walkthrough/);
  assert.match(html, /Open example case/);
  assert.doesNotMatch(html, /Decision simulation|Start simulation|35 min/);
  assert.doesNotMatch(html, /featured-case|selected|<details[^>]* open|demo-walkthrough|Open Canopy in Studio/);
});
test("Canopy obeys text and format filters and never appears as an empty-result fallback", () => {
  const all = { query:"", practice:"all", jurisdiction:"all", difficulty:"all", duration:"all", tag:"all", format:"all" as const };
  assert.equal(matchesCanopy(all),true);
  assert.equal(matchesCanopy({...all, query:"canopy"}),true);
  assert.equal(matchesCanopy({...all, query:"greenfire"}),false);
  assert.equal(matchesCanopy({...all, query:"no such case"}),false);
  assert.equal(matchesCanopy({...all, format:"simulation"}),false);
  assert.equal(matchesCanopy({...all, format:"walkthrough"}),true);
  assert.equal(matchesCanopy({...all, jurisdiction:"NL"}),false);
  const empty = renderToStaticMarkup(createElement(DemoCatalogueCards,{...props,cards:[],showCanopy:false}));
  assert.doesNotMatch(empty,/Project Canopy|GreenFire|Start simulation/);
});
test("every bundled simulation and Canopy expose bilingual learner tasks without launching", () => {
  const cards = Object.keys(bundledCataloguePresentation).map(id => ({ ...card, id }));
  const before = structuredClone(cards);
  for (const locale of ["en", "ru"] as const) {
    let calls = 0;
    const html = renderToStaticMarkup(createElement(DemoCatalogueCards, { ...props, locale, cards, launch: () => calls++, openCanopy: async () => { calls++; } }));
    assert.equal((html.match(locale === "en" ? /Illustrative prompt/g : /Учебный промпт/g) ?? []).length, cards.length + 1);
    for (const item of cards) assert.ok(html.includes(demoLearningPrompt(item.id, locale)));
    assert.ok(demoLearningPrompt("future-catalogue-case", locale).length > 40);
    assert.equal(calls, 0);
    assert.deepEqual(cards, before);
  }
});
test("Templates contains empty starters and no demo launch or scenario selector in both languages", () => {
  for (const locale of ["en","ru"] as const) {
    const html = renderToStaticMarkup(createElement(CaseTemplates,{locale,onStart:()=>{},onDemo:()=>{}}));
    assert.equal((html.match(/class="template-card"/g) ?? []).length,9);
    assert.match(html, /<ol class="template-grid"/);
    assert.doesNotMatch(html,/GreenFire|Project Canopy|canopy-scenario|Start simulation/);
  }
});
