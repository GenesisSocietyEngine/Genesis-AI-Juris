import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadStudioPanel } from "../app/StudioDeferredPanel";
import StudioSimulationPanel, { type StudioSimulationPanelProps } from "../app/StudioSimulationPanel";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { compileStudioDraft } from "../app/studio-compiler";
import { hasLocalChunkRecovery } from "../app/stale-chunk-recovery";

test("deferred panels adopt only active requests and retain local recovery on failure", async () => {
  let resolve!: (value: string) => void;
  let active = true;
  const values: string[] = [];
  const pending = loadStudioPanel(() => new Promise<string>(done => { resolve = done; }), () => active, value => values.push(value), () => assert.fail());
  active = false; resolve("old case"); await pending;
  assert.equal(values.length, 0);
  await loadStudioPanel(() => Promise.resolve("current case"), () => true, value => values.push(value), () => assert.fail());
  let failures = 0;
  await loadStudioPanel(() => Promise.reject(new Error("offline")), () => true, () => assert.fail(), () => { failures++; });
  await loadStudioPanel(() => Promise.reject(new Error("departed")), () => false, () => assert.fail(), () => assert.fail());
  assert.deepEqual(values, ["current case"]); assert.equal(failures, 1);
  assert.equal(hasLocalChunkRecovery(), false, "local recovery must not reload the page");
});

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Record<string, unknown>>(child) ? [child, ...elements(child.props.children as ReactNode)] : []);
}
function props(locale: "en" | "ru"): StudioSimulationPanelProps {
  const draft = buildCanopyPackage("base").draft;
  return { locale, text: { checks: "Integrity", localNote: "Synthetic test only" }, draft, displayMode: "user", trainingWorkflow: false,
    checks: [], visibleChecks: [], derivationsSettled: true, compiledDraft: compileStudioDraft(draft),
    playDraft: () => assert.fail("render must not execute"), onFixNode: () => assert.fail("render must not select") };
}
for (const locale of ["en", "ru"] as const) {
  test(`extracted panel ${locale} retains professional/Training and pending/empty states without source edits`, () => {
    const p = props(locale), before = JSON.stringify(p.draft);
    const html = renderToStaticMarkup(createElement(StudioSimulationPanel, p));
    assert.match(html, locale === "en" ? /ROUTE SIMULATION PREVIEW/ : /ПРЕДПРОСМОТР СИМУЛЯЦИИ МАРШРУТА/);
    const training = renderToStaticMarkup(createElement(StudioSimulationPanel, { ...p, trainingWorkflow: true }));
    assert.match(training, locale === "en" ? /PLAYABLE CASE PREVIEW/ : /ПРЕДПРОСМОТР ИГРАБЕЛЬНОГО КЕЙСА/);
    const pending = renderToStaticMarkup(createElement(StudioSimulationPanel, { ...p, derivationsSettled: false }));
    assert.match(pending, locale === "en" ? /Working-draft saving remains available/ : /Сохранение рабочего черновика остаётся доступным/);
    const empty = renderToStaticMarkup(createElement(StudioSimulationPanel, { ...p, draft: { ...p.draft, nodes: [] } }));
    assert.match(empty, locale === "en" ? /Your new draft is empty/ : /Новый черновик пуст/);
    assert.equal(JSON.stringify(p.draft), before);
  });
  test(`extracted panel ${locale} retains exact fix-node and explicit play callbacks`, () => {
    const p = props(locale), selected: string[] = [];
    const tree = StudioSimulationPanel({ ...p, compiledDraft: { scenario: null, warnings: [], issues: [{ code: "dead_end", message: "", nodeIds: [p.draft.nodes[0].id] }] }, onFixNode: id => selected.push(id) });
    const button = elements(tree).find(e => e.type === "button" && e.props.type === "button")!;
    (button.props.onClick as () => void)(); assert.deepEqual(selected, [p.draft.nodes[0].id]);
    let played = 0;
    const playable = elements(StudioSimulationPanel({ ...p, compiledDraft: { ...p.compiledDraft, scenario: { stages: [{ options: [] }] } as unknown as NonNullable<typeof p.compiledDraft.scenario> }, playDraft: () => { played++; } }));
    const play = playable.find(e => e.type === "button" && e.props.className === "primary-cta")!;
    assert.equal(played, 0); (play.props.onClick as () => void)(); assert.equal(played, 1);
  });
}
