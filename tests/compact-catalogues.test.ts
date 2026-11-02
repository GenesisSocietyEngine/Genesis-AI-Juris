import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CaseTemplates from "../app/CaseTemplates";
import CategoryDemoCards from "../app/CategoryDemoCards";
import DemoCatalogueCards, { type DemoCard } from "../app/DemoCatalogueCards";
import { CATEGORY_DEMOS } from "../app/category-demos";
import { bundledCataloguePresentation } from "../app/catalogue-fallback";
import type { ExampleLaunch } from "../app/ExampleLaunchStatus";

// Observe disclosure ancestry in generated markup, including nested guidance.
// Opening/cancel/retry actions must be reachable with every disclosure closed.
function disclosureDepths(html: string, target: RegExp) {
  let depth = 0;
  const found: number[] = [];
  for (const token of html.matchAll(/<details\b[^>]*>|<\/details>|<button\b[^>]*>[\s\S]*?<\/button>/g)) {
    if (token[0].startsWith("</details")) depth--;
    else if (token[0].startsWith("<details")) { assert.doesNotMatch(token[0], /\sopen(?:[\s=>])/); depth++; }
    else if (target.test(token[0])) found.push(depth);
    assert.ok(depth >= 0);
  }
  assert.equal(depth, 0);
  return found;
}
const inert = () => {};
const cards: DemoCard[] = Object.keys(bundledCataloguePresentation).map(id => ({id, title:id, summary:"Retained complete summary", jurisdiction:"BE", practice:"Litigation strategy", output:"Strategy and risk report", duration:20, version:"2.5.0", review:"Review required", author:"CaseVant"}));

for (const locale of ["en", "ru"] as const) {
  test(`compact ${locale} catalogues retain direct opening and independent cancellation outside closed guidance`, () => {
    let calls = 0;
    const action = () => { calls++; };
    const launch: ExampleLaunch = {id:`category:${CATEGORY_DEMOS[0].caseTypeId}`,phase:"loading",context:"synthetic"};
    const templates = renderToStaticMarkup(createElement(CaseTemplates,{locale,onStart:action,onExample:action,onDemo:action,exampleLaunch:launch,cancelExample:action}));
    assert.deepEqual(disclosureDepths(templates,/class="(?:primary|secondary)-cta"/),Array(20).fill(0)); // 18 starts + cancellation + footer
    assert.equal((templates.match(/class="catalogue-row-details"/g) ?? []).length,9);
    assert.match(templates,locale === "en" ? /Undo history and unadded form items are not archived/ : /История отмены и недобавленные элементы формы не архивируются/);
    const category = renderToStaticMarkup(createElement(CategoryDemoCards,{locale,demos:CATEGORY_DEMOS,onOpen:action,exampleLaunch:launch,cancelExample:action}));
    assert.deepEqual(disclosureDepths(category,/class="(?:primary|secondary)-cta"/),Array(10).fill(0));
    assert.equal((category.match(/class="catalogue-row-details"/g) ?? []).length,9);
    assert.match(category,locale === "en" ? /not external documents or verified legal sources/ : /не внешние документы и не проверенные правовые источники/);
    for (const id of ["canopy:base","converted:" + cards[0].id] as const) {
      const demos = renderToStaticMarkup(createElement(DemoCatalogueCards,{locale,cards,showCanopy:true,busy:false,launch:action,feedback:action,openCanopy:async()=>{calls++;},canopyWorkflowHref:"/canopy",exampleLaunch:{...launch,id:id as ExampleLaunch["id"]},cancelExample:action}));
      assert.deepEqual(disclosureDepths(demos,/class="primary-cta"/),Array(cards.length+1).fill(0));
      assert.deepEqual(disclosureDepths(demos,locale === "en" ? /Cancel opening/ : /Отменить загрузку/),[0]);
      assert.deepEqual(disclosureDepths(demos,locale === "en" ? /Give feedback/ : /Оставить отзыв/),Array(cards.length).fill(1));
      assert.equal((demos.match(/class="catalogue-row-details"/g) ?? []).length,cards.length+1);
      assert.match(demos,locale === "en" ? /nine illustrative source documents and four scenario variants/ : /Сравните четыре сценария/);
      assert.match(demos,/Retained complete summary/);
    }
    assert.equal(calls,0,"rendering/disclosing guidance must not create a working copy or launch AI");
  });
  test(`compact ${locale} failed example keeps retry reachable without revealing guidance`,()=>{
    const html=renderToStaticMarkup(createElement(DemoCatalogueCards,{locale,cards:[],showCanopy:true,busy:false,launch:inert,feedback:inert,openCanopy:async()=>{},canopyWorkflowHref:"/canopy",exampleLaunch:{id:"canopy:base",phase:"error",context:"synthetic"},cancelExample:inert}));
    assert.deepEqual(disclosureDepths(html,locale === "en" ? /Try again/ : /Повторить/),[0]);
  });
}
