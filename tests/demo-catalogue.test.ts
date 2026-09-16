import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DemoCatalogueCards, { matchesCanopy, type DemoCard } from "../app/DemoCatalogueCards";
import CaseTemplates from "../app/CaseTemplates";

const card: DemoCard = { id:"greenfire_first_72_hours", title:"GreenFire — The First 72 Hours", summary:"A fictional industrial incident.", jurisdiction:"NL", practice:"Environmental & crisis", duration:35, version:"0.4.0", review:"Editorial preview", author:"GENESIS" };
const props = { locale:"en" as const, cards:[card], showCanopy:true, busy:false, launch:()=>{}, feedback:()=>{}, openCanopy:async()=>{}, canopyWorkflowHref:"/canopy" };
test("catalogue shows neutral choices without opening Canopy or launching a simulation", () => {
  let calls = 0;
  const html = renderToStaticMarkup(createElement(DemoCatalogueCards, { ...props, launch:()=>{calls++;}, openCanopy:async()=>{calls++;} }));
  assert.equal(calls,0);
  assert.match(html, /Project Canopy/);
  assert.match(html, /GreenFire — The First 72 Hours/);
  assert.match(html, /Guided walkthrough/);
  assert.match(html, /Decision simulation/);
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
test("Templates contains empty starters and no demo launch or scenario selector in both languages", () => {
  for (const locale of ["en","ru"] as const) {
    const html = renderToStaticMarkup(createElement(CaseTemplates,{locale,onStart:()=>{},onDemo:()=>{}}));
    assert.equal((html.match(/class="template-card"/g) ?? []).length,9);
    assert.doesNotMatch(html,/GreenFire|Project Canopy|canopy-scenario|Start simulation/);
  }
});
