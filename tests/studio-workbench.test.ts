import assert from "node:assert/strict";
import test from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opensStudioWorkbench, studioWorkbenchCounts } from "../app/studio-workbench";
import StudioWorkbenchSummary from "../app/StudioWorkbenchSummary";
import StudioWorkspaceTabs from "../app/StudioWorkspaceTabs";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { workspaceDestination } from "../app/workspace-navigation";

function elements(value: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement(value)) return [];
  const node = value as ReactElement<Record<string, unknown>>;
  return [node, ...elements(node.props.children as ReactNode)];
}
const noop = () => {};

test("ordinary Studio entry opens the workbench while explicit saved stages and Overview stay authoritative", () => {
  for (const query of ["", "return_to=%2Fmatters%3Fdossier%3Dcase_1", "custom_case=42", "studio_panel=workbench&studio_step=case_map"]) {
    assert.equal(opensStudioWorkbench(new URLSearchParams(query)), true, query);
  }
  for (const query of ["studio_step=describe", "studio_step=review_ai_draft", "custom_case=42&studio_step=case_map", "studio_panel=overview"]) {
    assert.equal(opensStudioWorkbench(new URLSearchParams(query)), false, query);
  }
});

test("case-to-Studio navigation retains its return context without treating a governed case ID as a saved Studio draft", () => {
  const result = new URL(workspaceDestination("/studio?studio_panel=workbench", "/matters?organization=org_a&dossier=dossier_a&section=decision-packages&lang=ru"), "https://workspace.invalid");
  assert.equal(result.searchParams.get("organization"), "org_a");
  assert.equal(result.searchParams.get("lang"), "ru");
  assert.equal(result.searchParams.get("dossier"), null);
  assert.equal(result.searchParams.get("custom_case"), null);
  assert.match(result.searchParams.get("return_to")!, /dossier=dossier_a/);
});

for (const locale of ["en", "ru"] as const) test(`${locale}: workbench indicators reflect current records, conceal pending review totals, and navigate without writes`, () => {
  const draft = buildCanopyPackage("base").draft, before = JSON.stringify(draft);
  const counts = studioWorkbenchCounts(draft);
  assert.equal(counts.records, draft.nodes.length);
  assert.equal(counts.connections, draft.links.length);
  assert.equal(counts.evidence, draft.nodes.filter(node => node.type === "evidence").length);
  const visited: string[] = [];
  const props = { draft, locale, reviewCount: 234, checking: true, onSources: () => visited.push("sources"), onMap: () => visited.push("map"), onReview: () => visited.push("review") };
  const html = renderToStaticMarkup(createElement(StudioWorkbenchSummary, props));
  assert.ok(!html.includes("234"));
  assert.ok(html.includes("—"));
  assert.ok(!/approved|утверждено/i.test(html));
  for (const button of elements(StudioWorkbenchSummary(props)).filter(node => node.type === "button")) (button.props.onClick as () => void)();
  assert.deepEqual(visited, ["sources", "sources", "map", "review"]);
  assert.equal(JSON.stringify(draft), before);
  assert.ok(renderToStaticMarkup(createElement(StudioWorkbenchSummary, { ...props, checking: false })).includes("234"));
});

for (const locale of ["en", "ru"] as const) test(`${locale}: workbench has one selected section and preserves exact existing stage callbacks`, () => {
  const visited: unknown[] = [];
  const tree = StudioWorkspaceTabs({ locale, activeStep: 1, overview: false, workbench: true, onWorkbench: () => visited.push("workbench"), onOverview: noop, onStep: step => visited.push(step) });
  const buttons = elements(tree).filter(node => node.type === "button");
  assert.equal(buttons.filter(node => node.props["aria-pressed"]).length, 1);
  assert.equal(buttons[0].props["aria-pressed"], true);
  for (const button of buttons) (button.props.onClick as () => void)();
  assert.deepEqual(visited, ["workbench", 1, 3, 4, 5, 6]);
  const reviewTree = StudioWorkspaceTabs({ locale, activeStep: 2, overview: false, onOverview: noop, onStep: step => visited.push(step) });
  const reviewButton = elements(reviewTree).find(node => node.type === "button" && node.props["aria-pressed"]);
  (reviewButton!.props.onClick as () => void)();
  assert.equal(visited.at(-1), 2);
});
