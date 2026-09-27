import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import ts from "typescript";
import GenesisNavigation from "../app/GenesisNavigation";
import NavigationSession from "../app/NavigationSession";
import { NavigationController } from "../app/navigation-controller";

const noop = () => {};
test("Studio and workspace pages share expandable routes, labels and exact active contexts", () => {
  for (const locale of ["en", "ru"] as const) for (const active of ["studio", "matters", "/templates", "community", "/canopy", "help", "/help/studio-demo"]) {
    const props = { locale, active, location: "/studio?organization=org_synthetic&lang=" + locale, onLanguage: noop };
    const studio = renderToStaticMarkup(createElement(GenesisNavigation, { ...props, expandable: true }));
    const workspace = renderToStaticMarkup(createElement(GenesisNavigation, props));
    assert.equal(studio, workspace, `${locale}/${active}: the caller must not select a different navigation shell`);
    assert.equal((studio.match(/aria-current="page"/g) ?? []).length, 1, active);
    assert.match(studio, /class="genesis-nav-group"/);
    assert.match(studio, /view=community&amp;organization=org_synthetic/);
    assert.match(studio, /href="\/help\/studio-demo" target="_blank"/, "static training retains its public route and does not inherit private return context");
    assert.doesNotMatch(studio, /genesis-mobile-toggle|genesis-sidebar-content/);
  }
});

test("verified member sees the shared account and organization but no owner-only access action", async () => {
  const actorId = "actor_synthetic_navigation_member";
  const selected = { id: "org_synthetic_navigation", name: "Synthetic organization with a long name", kind: "team", status: "active", role: "member", revision: 1, membershipRevision: 1, actorId, selection: "org_synthetic_navigation.1.1." + actorId };
  const navigation = new NavigationController({ transport: async () => Response.json({ authenticated: true, identity: { displayName: "Synthetic member", email: "member@example.test", authSource: "chatgpt" }, actorId, organizations: [selected], selected, profileRequired: false }), leave: noop, clear: noop });
  await navigation.refresh();
  assert.equal(navigation.getSnapshot().phase, "ready");
  for (const expandable of [true, false]) {
    const html = renderToStaticMarkup(createElement(NavigationSession, { controller: navigation } as Parameters<typeof NavigationSession>[0], createElement(GenesisNavigation, { expandable, locale: "en", active: "studio", location: "/studio", onLanguage: noop })));
    assert.match(html, /Synthetic member/);
    assert.match(html, /Manage organizations/);
    assert.match(html, /Sign out/);
    assert.doesNotMatch(html, /Users &amp; access|Sign in/);
  }
});

test("optional Studio and simulation actions survive canonical navigation", () => {
  const html = renderToStaticMarkup(createElement(GenesisNavigation, { expandable: true, locale: "en", active: "studio", location: "/studio", onLanguage: noop, newCase: noop, importCase: noop,
    operationsActions: createElement("button", { onClick: noop }, "Restore a play session"), menu: createElement("button", { onClick: noop }, "Use dark theme") }));
  for (const label of ["New blank case", "Import case or prompt", "Restore a play session", "Use dark theme", "Saved Studio drafts", "10-minute training"]) assert.ok(html.includes(label), label);
});

// Exercise the actual component handlers and real NavigationController without
// claiming DOM layout/focus or browser acceptance. AST extraction avoids
// reproducing their departure logic or adding test-only production exports.
const source = ts.createSourceFile("LegacyGenesisNavigation.tsx", readFileSync("app/LegacyGenesisNavigation.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const wanted = new Set(["depart", "cancelPending", "guardedLink", "follow", "studioAction"]);
const functions = new Map<string, string>();
function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name && wanted.has(node.name.text)) functions.set(node.name.text, node.getText(source)); ts.forEachChild(node, visit); }
visit(source); assert.equal(functions.size, wanted.size);
const bundle = await build({ stdin: { loader: "ts", resolveDir: resolve("app"), contents: `import {isWorkspaceDepartureClick} from './departure-click'; export default function({navigation,allowDeparture,onNavigate,closeDrawer,window,document,requestAnimationFrame}) { const locale='en'; let pending=null; const setPending=value=>{pending=typeof value==='function'?value(pending):value;}; ${[...functions.values()].join("\n")} return {depart,cancelPending,guardedLink,follow,studioAction,get pending(){return pending;}}; }` }, bundle: true, write: false, platform: "node", format: "esm" });
const generated = resolve(".artifacts/navigation-shell/handlers.mjs"); mkdirSync(resolve(".artifacts/navigation-shell"), { recursive: true }); writeFileSync(generated, bundle.outputFiles[0].text);
const handlers = (await import(pathToFileURL(generated).href)).default;

function harness() {
  const leaves: string[] = [], views: string[] = [], requests: string[] = [];
  let allowed = true, guardCalls = 0, closes = 0, risk: "clear" | "dirty" | "pending" = "clear";
  const navigation = new NavigationController({ transport: async path => { requests.push(path); return new Response(null, { status: 204 }); }, leave: path => leaves.push(path), clear: noop });
  navigation.register({}, { risk: () => risk, suspend: noop, deny: noop });
  const window = { location: { href: "https://synthetic.invalid/studio", assign: (path: string) => leaves.push(path) }, open: (path: string) => leaves.push(path) };
  const h = handlers({ navigation, allowDeparture: () => { guardCalls++; return allowed; }, onNavigate: (view: string) => views.push(view), closeDrawer: () => closes++, window, document: { querySelector: () => null }, requestAnimationFrame: (callback: () => void) => callback() });
  navigation.registerDeparture((kind, id, plan) => { void h.depart(kind, id, false, plan?.target ?? "", plan); });
  return { h, navigation, leaves, views, requests, setAllowed: (value: boolean) => allowed = value, setRisk: (value: typeof risk) => risk = value, guardCalls: () => guardCalls, closes: () => closes };
}
function click(path = "/templates", modified = false) {
  return { button: 0, ctrlKey: modified, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
    currentTarget: { href: "https://synthetic.invalid" + path, target: "", hasAttribute: () => false },
    preventDefault() { this.defaultPrevented = true; } };
}

test("actual handlers retain Studio pending guard without intercepting modified/new-window navigation", () => {
  const h = harness(); h.setAllowed(false);
  const modified = click("/templates", true); h.h.follow(modified, "templates");
  assert.equal(modified.defaultPrevented, false); assert.equal(h.guardCalls(), 0);
  const newWindow = click("/help/studio-demo"); newWindow.currentTarget.target = "_blank"; h.h.guardedLink(newWindow);
  assert.equal(newWindow.defaultPrevented, false); assert.equal(h.guardCalls(), 0);
  const normal = click(); h.h.follow(normal, "templates"); assert.equal(normal.defaultPrevented, true); assert.deepEqual(h.views, []);
  const page = click("/account"); h.h.guardedLink(page); assert.equal(page.defaultPrevented, true); assert.deepEqual(h.leaves, []);
  let actions = 0; h.h.studioAction(() => actions++); assert.equal(actions, 0);
  h.setAllowed(true); h.h.studioAction(() => actions++); h.h.follow(click(), "templates");
  assert.equal(actions, 1); assert.deepEqual(h.views, ["templates"]);
});

test("actual shared departure preserves Stay, explicit Discard and uncertain-write protection", async () => {
  const h = harness(); h.setRisk("dirty");
  h.h.follow(click("/matters"), "matters"); assert.equal(h.h.pending.risk, "dirty"); assert.deepEqual(h.leaves, []);
  h.h.cancelPending(); assert.equal(h.h.pending, null); assert.deepEqual(h.leaves, []);
  h.h.follow(click("/matters"), "matters"); const pending = h.h.pending;
  await h.h.depart(pending.kind, pending.id, true, pending.target, pending.plan);
  assert.deepEqual(h.leaves, ["https://synthetic.invalid/matters"]);
  const uncertain = harness(); uncertain.setRisk("pending"); uncertain.h.follow(click(), "templates"); const operation = uncertain.h.pending;
  await uncertain.h.depart(operation.kind, operation.id, true, operation.target, operation.plan);
  assert.equal(uncertain.h.pending.risk, "pending"); assert.deepEqual(uncertain.leaves, []); assert.deepEqual(uncertain.views, []);
});

test("old departure loses authority and sign-out remains available despite the Studio operation guard", async () => {
  const h = harness(); h.setRisk("dirty"); h.h.follow(click(), "templates"); const pending = h.h.pending;
  h.navigation.invalidate("expired"); await h.h.depart(pending.kind, pending.id, true, pending.target, pending.plan);
  assert.deepEqual(h.leaves, []); assert.equal(h.h.pending, null);
  h.setAllowed(false); h.setRisk("pending"); await h.h.depart("signout");
  assert.deepEqual(h.requests, ["/api/auth/logout"]); assert.equal(h.leaves.length, 1);
  assert.match(h.leaves[0], /^\/signout-with-chatgpt\?/); assert.equal(h.navigation.getSnapshot().identity, null);
});
