import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudioSavedCaseAccessNotice, { unavailableSavedCaseId } from "../app/StudioSavedCaseAccessNotice";

const opening = { phase:"unavailable",signOutPending:false,currentCaseId:null,requested:"50" };
test("unavailable opening notice requires an exact unresolved saved intent and cannot grant authority", () => {
  assert.equal(unavailableSavedCaseId(opening),50);
  for(const requested of [null,"","0","01","-1","1.1","1e2","NaN","9007199254740992","50&other=1"]) assert.equal(unavailableSavedCaseId({...opening,requested}),null);
  for(const phase of ["checking","ready","anonymous","suspended","revoked"]) assert.equal(unavailableSavedCaseId({...opening,phase}),null);
  assert.equal(unavailableSavedCaseId({...opening,currentCaseId:50}),null);
  assert.equal(unavailableSavedCaseId({...opening,currentCaseId:51}),null);
  assert.equal(unavailableSavedCaseId({...opening,signOutPending:true}),null);
});
for(const locale of ["en","ru"] as const) test(`saved-case access notice is explicit and inert in ${locale}`,()=>{
  let calls=0;
  const html=renderToStaticMarkup(createElement(StudioSavedCaseAccessNotice,{id:50,locale,disabled:false,retry:async()=>{calls++;}}));
  assert.match(html,locale==='en'?/Your saved case has not loaded/:/Сохранённый кейс ещё не загружен/);
  assert.match(html,/role="status"/);assert.match(html,/aria-describedby="studio-saved-access-status"/);
  assert.match(html,locale==='en'?/saved case #50/:/кейсу №50/);
  assert.match(html,locale==='en'?/Refresh access/:/Обновить доступ/);
  assert.doesNotMatch(html,/<a |Saved to workspace|AI analysis/);assert.equal(calls,0);
  const blocked=renderToStaticMarkup(createElement(StudioSavedCaseAccessNotice,{id:50,locale,disabled:true,retry:async()=>{calls++;}}));assert.match(blocked,/disabled=""/);assert.equal(calls,0);
});
