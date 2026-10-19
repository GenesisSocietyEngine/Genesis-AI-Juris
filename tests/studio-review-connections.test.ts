import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { validateStudioDraft } from "../app/studio-validation";
import { studioGraphAttention } from "../app/studio-graph-attention";
import { addStudioLink } from "../app/studio-editing";
import { normalizeStudioDraft } from "../app/case-integrity";
import { STUDIO_NODE_MENU_PAGE_SIZE } from "../app/studio-node-menu";
import type { StudioNode } from "../app/types";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const node = (id: string, type: StudioNode["type"] = "fact"): StudioNode => ({ id, type, title: `Record ${id}`, detail: "Synthetic record", x: 100, y: 100 });
function fixture() {
  const { draft } = buildCanopyPackage("base");
  return { ...draft, nodes: [node("start", "trigger"), node("a"), node("b"), node("c")], links: [{ id: "one", from: "start", to: "a" }, { id: "two", from: "b", to: "c" }] };
}

test("opening an affected node leaves list or overview mode before focusing its real map control", () => {
  const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("  function openStudioAction("), source.indexOf("  function returnToActions("));
  assert.ok(handler.includes("function openStudioAction"));
  const calls: unknown[] = [];
  const open = new Function("changeDisplayMode", "setGraphPresentation", "setGraphZoom", "selectNode", "selectGuidedStep", "setActionNotice", "setActionTarget",
    handler.replace("target: StudioActionTarget", "target") + "; return openStudioAction;")(
      ...["mode", "presentation", "zoom", "node", "step", "notice", "focus"].map(name => (value: unknown) => calls.push([name, value])),
    );
  const target = { step: 4, id: "studio-node-b", nodeId: "b" };
  open(target);
  assert.deepEqual(calls, [["presentation", "detail"], ["zoom", 1], ["node", "b"], ["step", 4], ["notice", ""], ["focus", target]]);
  calls.length = 0;
  open({ step: 3, id: "studio-publishable-context" });
  assert.ok(!calls.some(call => ["presentation", "zoom", "node"].includes((call as string[])[0])), "case-level review leaves the map untouched");
});
test("connected but unreachable nodes are identified exactly; case-level context does not flag nodes", () => {
  const draft = fixture(), before = JSON.stringify(draft);
  assert.deepEqual(studioGraphAttention(draft, false), { orphanIds: [], routeIds: ["b", "c"], missingStart: false });
  const checks = validateStudioDraft(draft, "en").checks;
  assert.deepEqual(checks.find(check => check.id === "route")?.nodeIds, ["b", "c"]);
  assert.equal(checks.find(check => check.id === "context")?.nodeIds, undefined);
  assert.equal(JSON.stringify(draft), before);
  const repaired = { ...draft, links: [...draft.links, { id: "repair", from: "a", to: "b" }] };
  assert.deepEqual(studioGraphAttention(repaired, false).routeIds, []);
  assert.equal(validateStudioDraft(repaired, "en").checks.find(check => check.id === "route")?.level, "ok");
});
test("missing start is a case-level action rather than falsely flagging every connected node", () => {
  const draft = fixture();
  draft.nodes[0] = node("start", "entity");
  for (const locale of ["en", "ru"] as const) {
    const check = validateStudioDraft(draft, locale).checks.find(check => check.id === "route")!;
    assert.equal(check.missingStart, true);
    assert.deepEqual(check.nodeIds, []);
    assert.ok(check.text.includes(locale === "en" ? "Trigger" : "триггер"));
  }
});
test("orphan and invalid-endpoint findings retain exact existing node identities", () => {
  const draft = fixture();
  draft.nodes.push(node("orphan"));
  draft.links.push({ id: "broken", from: "a", to: "missing" });
  const result = studioGraphAttention(draft, false);
  assert.deepEqual(result.orphanIds, ["orphan"]);
  assert.deepEqual(new Set(result.routeIds), new Set(["a", "b", "c", "orphan"]));
  draft.links.push({ id: "invalid-only", from: "orphan", to: "missing" });
  const orphanCheck = validateStudioDraft(draft, "en").checks.find(check => check.id === "orphan")!;
  assert.equal(orphanCheck.level, "warn", "a dangling edge is not a valid connection");
  assert.deepEqual(orphanCheck.nodeIds, ["orphan"]);
});

test("connection search remains clearable after adding the last match at the paging threshold", async () => {
  for (const locale of ["en", "ru"] as const) {
    const render = await connectionHarness();
    const nodes = [node("source"), ...Array.from({ length: 13 }, (_, i) => node(`target-${i}`))];
    const links: { id: string; from: string; to: string }[] = [];
    const props = { nodes, links, sourceId: "source", locale, labels: { fact: "Fact" }, disabled: false, onNode() {}, onConnect(to: string) { links.push({ id: "added", from: "source", to }); return ""; } };
    let tree = render(props);
    (tree.find(el => el.props.type === "search")!.props.onChange as (e: unknown) => void)({ target: { value: "target-12" } });
    tree = render(props);
    (tree.find(el => el.type === "select")!.props.onChange as (e: unknown) => void)({ target: { value: "target-12" } });
    tree = render(props);
    (tree.find(el => el.props.className === "secondary-cta")!.props.onClick as () => void)();
    tree = render(props);
    assert.equal(tree.find(el => el.type === "select")!.props.value, "target-12");
    assert.equal(tree.find(el => el.props.className === "secondary-cta")!.props.disabled, true);
    const search = tree.find(el => el.props.type === "search");
    assert.ok(search, "the active filter must remain visible even with only twelve remaining destinations");
    (search.props.onChange as (e: unknown) => void)({ target: { value: "" } });
    tree = render(props);
    assert.equal(tree.filter(el => el.type === "option" && el.props.value !== "").length, 13, "all twelve candidates plus the selected connected target are available");
  }
});

test("actual destination control bounds options and reaches every candidate at the 200-node limit", async () => {
  const render = await connectionHarness();
  const nodes = Array.from({ length: 200 }, (_, i) => node(`node-${i}`));
  let calls = 0;
  const props = { nodes, links: [{ id: "existing", from: "node-0", to: "node-1" }], sourceId: "node-0", locale: "en", labels: { fact: "Fact" }, disabled: false, onNode() {}, onConnect() { calls++; return ""; } };
  const seen = new Set<string>();
  let tree = render(props);
  (tree.find(el => el.type === "select")!.props.onChange as (e: unknown) => void)({ target: { value: "node-199" } });
  for (let page = 0; page < 17; page++) {
    tree = render(props);
    const options = tree.filter(el => el.type === "option" && el.props.value !== "");
    assert.ok(options.length <= STUDIO_NODE_MENU_PAGE_SIZE + 1);
    options.forEach(el => seen.add(String(el.props.value)));
    assert.equal(tree.find(el => el.type === "select")!.props.value, "node-199");
    const next = tree.find(el => el.props["aria-label"] === "Next destinations");
    if (next?.props.disabled) break;
    (next!.props.onClick as () => void)();
  }
  assert.equal(seen.size, 198);
  assert.equal(seen.has("node-0"), false);
  assert.equal(seen.has("node-1"), false);
  assert.equal(calls, 0, "search and paging never write");
});

test("review actions open context, missing-start composer and the exact disconnected record", async () => {
  const { build } = require("esbuild") as typeof import("esbuild");
  const result = await build({ absWorkingDir: root, stdin: { contents: 'export { default } from "./app/StudioActionPanel";', resolveDir: root }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", logLevel: "silent" });
  const mod = { exports: {} as { default: (props: Record<string, unknown>) => ReactNode } };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)(require, mod, mod.exports);
  for (const locale of ["en", "ru"] as const) {
    const draft = fixture(), opened: unknown[] = [];
    const render = (check: unknown) => elements(mod.exports.default({ draft, checks: [check], locale, checking: false, canEdit: true, onOpen: (target: unknown) => opened.push(target), onReport() {}, onSave() {}, saved: false, saving: false, withinEnvelope: true }));
    const checks = validateStudioDraft(draft, locale).checks;
    for (const [check, expected] of [
      [{ id: "context", level: "warn", text: "Review context" }, { step: 3, id: "studio-publishable-context" }],
      [checks.find(check => check.id === "route"), { step: 4, id: "studio-node-b", nodeId: "b" }],
      [{ id: "route", level: "warn", text: "Missing start", missingStart: true }, { step: 3, id: "studio-evidence-composer", nodeType: "trigger" }],
    ] as const) {
      const tile = render(check).find(el => el.props.id === `action-${check?.id}`)!;
      assert.ok(tile);
      (tile.props.onClick as () => void)();
      assert.deepEqual(opened.pop(), expected);
    }
  }
});

function elements(value: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as ReactNode)];
}
async function connectionHarness() {
  const { build } = require("esbuild") as typeof import("esbuild");
  const result = await build({ absWorkingDir: root, stdin: { contents: 'export { default } from "./app/StudioNodeConnections";', resolveDir: root }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", logLevel: "silent" });
  const state: unknown[] = []; let cursor = 0;
  const mod = { exports: {} as { default: (props: Record<string, unknown>) => ReactNode } };
  new Function("require", "module", "exports", result.outputFiles[0]!.text)((name: string) => name === "react" ? {
    useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (next: unknown) => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; },
  } : require(name), mod, mod.exports);
  return (props: Record<string, unknown>) => { cursor = 0; return elements(mod.exports.default(props)); };
}
test("actual connection control keeps selection through paging/add, prevents duplicate UI add, and survives serialization", async () => {
  const render = await connectionHarness();
  let draft = fixture();
  draft.nodes.push(...Array.from({ length: 25 }, (_, i) => node(`extra-${i}`)));
  const before = JSON.stringify(draft); let calls = 0;
  const props = () => ({ nodes: draft.nodes, links: draft.links, sourceId: "a", locale: "en", labels: { fact: "Fact", trigger: "Trigger" }, disabled: false, onNode() {}, onConnect(to: string) {
    calls++;
    draft = addStudioLink(draft, { id: "new-link", from: "a", to }, { role: "studio", source: "visual", action: "link_added", message: "Synthetic test connection" }, "2026-10-19T10:00:00Z").draft;
    return "";
  } });
  let tree = render(props());
  const selector = () => tree.find(el => el.type === "select")!;
  (selector().props.onChange as (e: unknown) => void)({ target: { value: "b" } });
  tree = render(props());
  assert.equal(selector().props.value, "b");
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(draft), before, "choosing is not a write");
  (tree.find(el => el.props["aria-label"] === "Next destinations")!.props.onClick as () => void)();
  tree = render(props());
  assert.equal(selector().props.value, "b");
  assert.ok(tree.some(el => el.type === "option" && el.props.value === "b"));
  (tree.find(el => el.type === "button" && el.props.className === "secondary-cta")!.props.onClick as () => void)();
  tree = render(props());
  assert.equal(calls, 1);
  assert.equal(selector().props.value, "b");
  assert.equal(tree.find(el => el.type === "button" && el.props.className === "secondary-cta")!.props.disabled, true);
  assert.equal(draft.links.filter(link => link.from === "a" && link.to === "b").length, 1);
  assert.deepEqual(normalizeStudioDraft(JSON.parse(JSON.stringify(draft))).links, draft.links);
  draft = { ...draft, links: draft.links.filter(link => link.id !== "new-link") };
  tree = render(props());
  assert.equal(selector().props.value, "b");
  assert.equal(tree.find(el => el.type === "button" && el.props.className === "secondary-cta")!.props.disabled, false, "undo restores add availability");
  tree = render({ ...props(), disabled: true });
  assert.equal(selector().props.disabled, true);
});
