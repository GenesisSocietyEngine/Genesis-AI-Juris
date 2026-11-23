import assert from "node:assert/strict";
import test from "node:test";
import { workResultSummary } from "../app/work/work-presentation";
import { workspaceTitle } from "../app/workspace-title";
import { WORK_VIEWS } from "../app/work/work-views";

test("result and loaded-case counts agree independently in EN/RU", () => {
  for (const [n, record, cases] of [[0,"записей","доступных дел"],[1,"запись","доступное дело"],[2,"записи","доступных дела"],[5,"записей","доступных дел"],[11,"записей","доступных дел"],[21,"запись","доступное дело"],[22,"записи","доступных дела"],[25,"записей","доступных дел"]] as const) {
    assert.equal(workResultSummary(n, 1, "ru"), `Найдено: ${n} ${record} · Загружено: 1 доступное дело`);
    assert.equal(workResultSummary(1, n, "ru"), `Найдено: 1 запись · Загружено: ${n} ${cases}`);
    assert.equal(workResultSummary(n, n, "en"), `${n} matching ${n === 1 ? "item" : "items"} · ${n} accessible ${n === 1 ? "case" : "cases"} loaded`);
  }
});

test("browser titles follow work navigation and language without private query content", () => {
  for (const locale of ["en", "ru"] as const) {
    for (const view of WORK_VIEWS.filter(v => v.id !== "studio" && v.id !== "library")) {
      assert.equal(workspaceTitle(`/work?view=${view.id}&dossier=private&name=Secret#private`, locale), `${view[locale]} · CaseVant`);
    }
    assert.equal(workspaceTitle("/work?view=unknown", locale), `${WORK_VIEWS[0][locale]} · CaseVant`);
    assert.equal(workspaceTitle("/", locale), null);
    assert.equal(workspaceTitle("/unrelated", locale), null);
  }
  assert.equal(workspaceTitle("/portal?access=secret", "ru"), "Клиентский портал · CaseVant");
  assert.equal(workspaceTitle("/matters?dossier=private#source-private", "en"), "My cases · CaseVant");
  assert.equal(workspaceTitle("/reports?lang=ru", "ru"), "Отчёты · CaseVant");
});
