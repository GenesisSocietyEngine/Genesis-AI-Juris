import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCanopyPackage, CANOPY_SCENARIOS, CANOPY_UNAVAILABLE } from "../app/canopy-fixture";
import { caseFingerprint } from "../app/case-integrity";
import { openStudioSourceFragment, studioOverview, studioOverviewAction, studioSourceFragmentId } from "../app/studio-overview";
import type { StudioOverviewProps } from "../app/StudioOverview";

const base = buildCanopyPackage("base").draft;
test("each exact existing Canopy declaration is an expected recommendation, never a selected outcome", () => {
  for (const declaration of [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE]) for (const independent of [false, true]) {
    const prepared = buildCanopyPackage(declaration.id, independent);
    const model = studioOverview(prepared.draft, "en");
    assert.equal(model.recommendation.state, "prepared");
    assert.equal(model.recommendation.text, declaration.recommendation);
    assert.equal(model.humanEvidenceReview, "not_recorded_in_studio");
    assert.equal(model.outcomes.length, 4);
  }
});
test("changes to actual inputs, route, version or identity invalidate the prepared recommendation without rewriting the draft", () => {
  const variants = [
    (draft: typeof base) => { draft.nodes.find(node => node.id === "demand")!.detail += " Changed signed scope."; },
    (draft: typeof base) => { const effects = draft.links[0]?.rule?.effects; assert.ok(effects); effects.trust = 0; },
    (draft: typeof base) => { draft.version = "9.0.0"; },
    (draft: typeof base) => { draft.title = "Edited mandate"; },
  ];
  for (const change of variants) {
    const draft = structuredClone(base); change(draft);
    const before = JSON.stringify(draft), fingerprint = caseFingerprint(draft);
    const model = studioOverview(draft, "en");
    assert.equal(model.recommendation.state, "reassessment");
    assert.equal(model.recommendation.text, null);
    assert.equal(JSON.stringify(draft), before);
    assert.equal(caseFingerprint(draft), fingerprint);
  }
});
test("similar title, arbitrary first outcome or D01 text cannot invent a generic recommendation or source packet", () => {
  const other = { ...structuredClone(base), caseId: "other_case", premise: "Should we proceed?" };
  const model = studioOverview(other, "en");
  assert.equal(model.question, other.premise);
  assert.equal(model.recommendation.state, "missing");
  assert.equal(model.recommendation.text, null);
  assert.equal(model.sourcePacket.length, 0);
  assert.equal(model.references.length, 0);
  assert.equal(model.documentCount, null);
  assert.equal(model.outcomes[0]!.title, other.nodes.find(node => node.type === "outcome")!.title);
});
test("nine documents and fifteen versions remain distinct from one evidence graph record and the unchanged two-record requirement", () => {
  const before = JSON.stringify(base);
  const model = studioOverview(base, "en");
  assert.equal(model.documentCount, 9);
  assert.equal(model.sourcePacket.length, 15);
  assert.equal(model.facts.length, 0);
  assert.equal(model.evidence.length, 1);
  assert.equal(model.recordedCount, 1);
  assert.equal(model.requiredRecordCount, 2);
  const context = model.blockers.find(check => check.id === "context")!;
  const evidence = model.blockers.find(check => check.id?.startsWith("nodes:") && /1 of 2/.test(check.text))!;
  assert.ok(context); assert.ok(evidence);
  assert.deepEqual(studioOverviewAction(base, context), { step: 3, id: "studio-publishable-context" });
  assert.deepEqual(studioOverviewAction(base, evidence), { step: 3, id: "studio-evidence-composer", nodeType: "evidence" });
  assert.equal(JSON.stringify(base), before);
});
test("exact source versions and sections resolve without latest-version substitution or invented review", () => {
  const model = studioOverview(base, "en");
  const demand = model.references.find(ref => ref.nodeId === "demand")!;
  assert.equal(demand.version, 1);
  assert.match(demand.excerpt!, /Only 300 count as signed/);
  assert.equal(demand.exactTextPresent, true);
  const changed = structuredClone(base);
  changed.nodes.find(node => node.id === "demand")!.detail = "D03 v99 § Demand: 600 signed. D03 v2 § Unknown: alleged source.";
  const missing = studioOverview(changed, "en").references.filter(ref => ref.nodeId === "demand");
  assert.equal(missing.length, 2);
  assert.ok(missing.every(ref => ref.source === null && ref.excerpt === null && !ref.exactTextPresent));
  changed.nodes.find(node => node.id === "demand")!.detail = "D03 v1 § Demand: 600 are signed.";
  const altered = studioOverview(changed, "en").references.find(ref => ref.nodeId === "demand")!;
  assert.equal(altered.exactTextPresent, false);
  assert.match(altered.excerpt!, /Only 300 count as signed/);
});
test("source jump opens and focuses only the requested retained fragment; missing source is not successful", () => {
  const events: string[] = [], details = { open: false };
  const fragment = { closest: () => details, focus: () => events.push("focus"), scrollIntoView: () => events.push("scroll") };
  const id = studioSourceFragmentId("D03", 1, "Demand");
  const root = { querySelector: (selector: string) => { assert.equal(selector, `[id="${id}"]`); return fragment; } };
  assert.equal(openStudioSourceFragment(root as unknown as HTMLElement, id), true);
  assert.equal(details.open, true); assert.deepEqual(events, ["focus", "scroll"]);
  assert.equal(openStudioSourceFragment({ querySelector: () => null }, id), false);
  assert.equal(openStudioSourceFragment(root as unknown as HTMLElement, 'unsafe"]'), false);
});

const require = createRequire(import.meta.url);
type Components = { StudioOverview: (props: StudioOverviewProps) => ReactElement; StudioSourcesPanel: (props: StudioOverviewProps) => ReactElement };
const components = (async () => {
  const { build } = require("esbuild") as typeof import("esbuild");
  const bundled = await build({ absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    stdin: { contents: 'export { default as StudioOverview } from "./app/StudioOverview"; export { default as StudioSourcesPanel } from "./app/StudioSourcesPanel";', resolveDir: fileURLToPath(new URL("..", import.meta.url)) },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", logLevel: "silent",
    plugins: [{ name: "css-module-test-only", setup(build) { build.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, { get: (_, key) => String(key) });', loader: "js" })); } }],
  });
  const bundledModule = { exports: {} };
  new Function("require", "module", "exports", bundled.outputFiles[0]!.text)(require, bundledModule, bundledModule.exports);
  return bundledModule.exports as Components;
})();
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (!isValidElement<Record<string, unknown>>(node)) return Array.isArray(node) ? node.flatMap(elements) : [];
  return [node, ...elements(node.props.children as ReactNode)];
}
test("actual Overview renders honest states and preserves exact gap/outcome callbacks in both languages", async () => {
  const { StudioOverview, StudioSourcesPanel } = await components;
  const actions: unknown[] = [], nodes: string[] = [], steps: number[] = [];
  const props: StudioOverviewProps = { draft: base, locale: "en", onStep: step => steps.push(step), onNode: id => nodes.push(id), onAction: target => actions.push(target) };
  const tree = StudioOverview(props);
  const buttons = elements(tree).filter(element => element.type === "button");
  for (const button of buttons.filter(element => element.props.children === "Open the relevant control")) (button.props.onClick as () => void)();
  assert.ok(actions.some(value => (value as { id: string }).id === "studio-publishable-context"));
  assert.ok(actions.some(value => (value as { id: string }).id === "studio-evidence-composer"));
  const outcome = buttons.find(element => element.props.children === "Conditional 90-day transition pilot")!;
  (outcome.props.onClick as () => void)(); assert.deepEqual(nodes, ["conditional-pilot"]);
  const source = buttons.find(element => element.props.children === "Inspect sources and evidence")!;
  (source.props.onClick as () => void)(); assert.deepEqual(steps, [3]);
  for (const locale of ["en", "ru"] as const) {
    const html = renderToStaticMarkup(createElement(StudioOverview, { ...props, locale }));
    assert.match(html, locale === "en" ? /Prepared scenario recommendation/ : /Рекомендация подготовленного сценария/);
    assert.match(html, locale === "en" ? /not an executed outcome or independent approval/ : /не результат прохождения или независимое утверждение/);
    const sources = renderToStaticMarkup(createElement(StudioSourcesPanel, { ...props, locale }));
    assert.ok(sources.includes('id="studio-reference-D03-v1-Demand"'));
    assert.ok(sources.includes('id="studio-reference-D03-v2-Demand"'));
    assert.match(sources, locale === "en" ? /Not recorded in Studio/ : /Не фиксируются в Studio/);
  }
  const edited = structuredClone(base); edited.nodes[0]!.detail += " Edited assumption.";
  const staleHtml = renderToStaticMarkup(createElement(StudioOverview, { ...props, draft: edited }));
  assert.match(staleHtml, /Requires reassessment/);
  assert.doesNotMatch(staleHtml, /<h3[^>]*>Prepared scenario recommendation/);
});
test("empty and generic source views expose next action without fake document or approval counts", async () => {
  const { StudioOverview, StudioSourcesPanel } = await components;
  const empty = { ...structuredClone(base), caseId: "untitled_case", title: "", premise: "", nodes: [], links: [] };
  const props: StudioOverviewProps = { draft: empty, locale: "en", onStep() {}, onNode() {} };
  assert.match(renderToStaticMarkup(createElement(StudioOverview, props)), /Add the case question/);
  assert.match(renderToStaticMarkup(createElement(StudioOverview, props)), /Recommendation not prepared/);
  const html = renderToStaticMarkup(createElement(StudioSourcesPanel, props));
  assert.match(html, /Not attached/); assert.match(html, /Text references only/);
  assert.doesNotMatch(html, /Retained fictional source packet/);
});
