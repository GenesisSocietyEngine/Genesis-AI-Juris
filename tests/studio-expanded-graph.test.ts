import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { StudioLink, StudioNode } from "../app/types";

const require = createRequire(import.meta.url);
const nodes: StudioNode[] = [
  { id: "question", type: "trigger", title: "A recorded question", detail: "Unchanged authored text", x: -25, y: 0 },
  { id: "conditional", type: "outcome", title: "Conditional outcome — requires independent review", detail: "Not an approval", x: 230, y: 700 },
];
const links: StudioLink[] = [
  { id: "recorded-forward", from: "question", to: "conditional", rule: { label: "Existing condition" } },
  { id: "recorded-return", from: "conditional", to: "question" },
];

type TestBindings = { effects: Array<() => void | (() => void)>; refs: Array<{ current: unknown }> };
type Component = (props: { nodes: StudioNode[]; links: StudioLink[]; locale: "en" | "ru"; onClose: () => void; onNode: (id: string) => void }) => ReactElement;
const loaded = (async () => {
  const { build } = require("esbuild") as typeof import("esbuild");
  const result = await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    stdin: { contents: 'export { default } from "./app/StudioExpandedGraph";', resolveDir: fileURLToPath(new URL("..", import.meta.url)) },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", logLevel: "silent",
    plugins: [{ name: "css-test-names", setup(build) { build.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, { get: (_, key) => String(key) });', loader: "js" })); } }],
  });
  return (bindings: TestBindings) => {
    const bundledModule = { exports: {} as { default: Component } };
    const componentRequire = (name: string) => name === "react" ? {
      useId: () => ":expanded-test:",
      useRef: (value: unknown) => { const ref = { current: value }; bindings.refs.push(ref); return ref; },
      useEffect: (effect: () => void | (() => void)) => { bindings.effects.push(effect); },
    } : require(name);
    new Function("require", "module", "exports", result.outputFiles[0]!.text)(componentRequire, bundledModule, bundledModule.exports);
    return bundledModule.exports.default;
  };
})();
function elements(value: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as ReactNode)];
}

test("actual expanded view preserves supplied nodes, positions, links and order without selecting an outcome", async () => {
  const bindings = { effects: [], refs: [] } as TestBindings;
  const component = (await loaded)(bindings);
  const before = JSON.stringify({ nodes, links });
  const rendered = elements(component({ nodes, links, locale: "en", onClose() {}, onNode() {} }));
  assert.deepEqual(rendered.filter(element => element.props["data-node-id"]).map(element => [element.props["data-node-id"], element.props.transform]), [
    ["question", "translate(-25 0)"], ["conditional", "translate(230 700)"],
  ]);
  assert.deepEqual(rendered.filter(element => element.props["data-link-id"]).map(element => element.props["data-link-id"]), links.map(link => link.id));
  assert.equal(rendered.find(element => element.type === "svg")?.props.role, "group");
  const viewBox = String(rendered.find(element => element.type === "svg")?.props.viewBox).split(" ").map(Number);
  assert.ok(viewBox[0]! < -25 && viewBox[1]! < 0 && viewBox[0]! + viewBox[2]! > 395 && viewBox[1]! + viewBox[3]! > 796);
  assert.equal(JSON.stringify({ nodes, links }), before);
  assert.ok(rendered.filter(element => element.props["data-node-id"]).every(element => element.props.tabIndex === 0));
});

test("node Enter, Space and selector close first, then request the exact existing detail", async () => {
  const sequence: string[] = [];
  const component = (await loaded)({ effects: [], refs: [] });
  const rendered = elements(component({ nodes, links, locale: "en", onClose: () => sequence.push("close"), onNode: id => sequence.push(id) }));
  const node = rendered.find(element => element.props["data-node-id"] === "conditional")!;
  for (const key of ["Enter", " "]) {
    sequence.length = 0;
    (node.props.onKeyDown as (event: unknown) => void)({ key, preventDefault: () => sequence.push("prevent") });
    assert.deepEqual(sequence, ["prevent", "close", "conditional"]);
  }
  sequence.length = 0;
  (node.props.onKeyDown as (event: unknown) => void)({ key: "Delete", preventDefault: () => sequence.push("prevent") });
  assert.deepEqual(sequence, []);
  const select = rendered.find(element => element.type === "select")!;
  (select.props.onChange as (event: unknown) => void)({ target: { value: "question" } });
  assert.deepEqual(sequence, ["close", "question"]);
  sequence.length = 0;
  (select.props.onChange as (event: unknown) => void)({ target: { value: "missing-node" } });
  assert.deepEqual(sequence, []);
});

test("native modal lifecycle and Escape request closure; cleanup restores the original connected control", async () => {
  const bindings = { effects: [], refs: [] } as TestBindings;
  const events: string[] = [];
  const component = (await loaded)(bindings);
  const tree = component({ nodes, links, locale: "en", onClose: () => events.push("close-request"), onNode() {} });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  class Control {
    isConnected = true;
    concealed = false;
    closest() { return this.concealed ? {} : null; }
    getClientRects() { return [1]; }
    focus() { events.push("focus-return"); }
  }
  const fakeDialog = { open: false, showModal() { this.open = true; events.push("showModal"); }, close() { this.open = false; events.push("close-native"); } };
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: new Control() } });
    Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: Control });
    bindings.refs[0]!.current = fakeDialog;
    const cleanup = bindings.effects[0]!();
    assert.deepEqual(events, ["showModal"]);
    ((tree.props as Record<string, unknown>).onCancel as (event: unknown) => void)({ preventDefault: () => events.push("cancel-native-default") });
    assert.deepEqual(events, ["showModal", "cancel-native-default", "close-request"]);
    assert.equal(typeof cleanup, "function");
    (cleanup as () => void)();
    assert.deepEqual(events.slice(-2), ["close-native", "focus-return"]);
    events.length = 0;
    const inaccessible = new Control();
    Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: inaccessible } });
    const concealedCleanup = bindings.effects[0]!();
    inaccessible.concealed = true;
    (concealedCleanup as () => void)();
    assert.deepEqual(events, ["showModal", "close-native"], "authority closure cannot focus the concealed former control");
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
    if (originalHTMLElement) Object.defineProperty(globalThis, "HTMLElement", originalHTMLElement); else Reflect.deleteProperty(globalThis, "HTMLElement");
  }
});

test("missing graph endpoints and invalid coordinates remain explicit rather than inventing replacements", async () => {
  const component = (await loaded)({ effects: [], refs: [] });
  const missingLinks = [...links, { id: "unresolved", from: "question", to: "absent" }];
  const rendered = elements(component({ nodes, links: missingLinks, locale: "en", onClose() {}, onNode() {} }));
  assert.ok(rendered.some(element => element.props.role === "status" && String(element.props.children).includes("missing endpoint")));
  assert.deepEqual(rendered.filter(element => element.props["data-link-id"]).map(element => element.props["data-link-id"]), links.map(link => link.id));
  const invalid = elements(component({ nodes: [{ ...nodes[0]!, x: Number.NaN }], links: [], locale: "ru", onClose() {}, onNode() {} }));
  assert.ok(!invalid.some(element => element.type === "svg"));
  assert.ok(invalid.some(element => element.type === "select"));
  assert.ok(invalid.some(element => element.props.role === "status" && String(element.props.children).includes("Координаты карты недоступны")));
});
