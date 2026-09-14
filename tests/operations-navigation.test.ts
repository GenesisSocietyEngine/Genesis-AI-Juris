import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AppNavigation from "../app/AppNavigation";
import OperationsDossier from "../app/OperationsDossier";
import { scenarios } from "../app/scenarios";

test("both Studio shells render real navigation links with locale and organization context", () => {
  const noop = () => undefined;
  for (const studioOnly of [true, false]) for (const locale of ["en", "ru"] as const) {
    const markup = renderToStaticMarkup(createElement(AppNavigation, {
      locale, studioOnly, view: "studio", workspaceLocation: `/studio?organization=org_example&lang=${locale}`,
      navigate: noop, openOperations: noop, restoreSession: noop, exportSession: noop,
      hasActiveScenario: true, toggleLocale: noop, toggleTheme: noop, dark: false,
    }));
    assert.match(markup, /aria-current="page"[^>]*>.*?(Case Studio|Студия кейсов)/);
    for (const view of ["studio", "play", "demos", "library"]) assert.ok(markup.includes(`view=${view}&amp;organization=org_example&amp;lang=${locale}`), view);
    for (const route of ["/matters", "/account", "/organizations"]) assert.ok(markup.includes(`href="${route}?organization=org_example&amp;lang=${locale}"`), route);
    assert.match(markup, /<details class="app-more"><summary>/, "secondary actions are closed on first render");
    assert.ok(markup.includes(locale === "en" ? "Restore a play session" : "Восстановить прохождение"));
    assert.ok(markup.includes(locale === "en" ? "Export play session" : "Экспорт прохождения"));
  }
});

test("long GreenFire document references stay out of document buttons and remain available in details", () => {
  const scenario = scenarios.find((item) => item.caseId === "greenfire_first_72_hours");
  assert.ok(scenario);
  const material = scenario.materials.find((item) => item.ref === "dangerous_goods_manifest");
  assert.ok(material);
  for (const locale of ["en", "ru"] as const) {
    const markup = renderToStaticMarkup(createElement(OperationsDossier, {
      locale, materials: scenario.materials, activeMaterial: material,
      selectMaterial: () => undefined, caseId: scenario.caseId, decisions: [],
    }));
    const buttons = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    assert.equal(buttons.length, scenario.materials.length);
    assert.ok(buttons.some((button) => button.includes('aria-pressed="true"') && button.includes(material.title[locale])));
    for (const button of buttons) assert.doesNotMatch(button, /<code>|dangerous_goods_manifest/);
    assert.match(markup, /<details class="material-record-details"><summary>/);
    assert.match(markup, /<code>dangerous_goods_manifest<\/code>/);
    assert.ok(markup.includes(material.title[locale]));
  }
});
