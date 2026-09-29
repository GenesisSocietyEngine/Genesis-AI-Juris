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
import { SESSION_BOUNDARY_KEY, subscribeSessionBoundary } from "../app/session-boundary";

const noop = () => {};
test("cross-tab logout suspends refresh, fences late identity and clears even an unmounted invitation", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const bus = new EventTarget();
  Object.defineProperty(globalThis, "window", { configurable: true, value: bus });
  let finish!: (response: Response) => void;
  let calls = 0, clears = 0;
  const navigation = new NavigationController({ transport: () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); }, leave: noop, clear: () => { clears++; } });
  const stop = subscribeSessionBoundary(navigation.sessionBoundary);
  const broadcast = (phase: "suspend" | "revoke") => { const event = new Event("storage"); Object.assign(event, { key: SESSION_BOUNDARY_KEY, newValue: JSON.stringify({ version: 1, phase, nonce: "synthetic" }) }); bus.dispatchEvent(event); };
  try {
    const pending = navigation.refresh(); const epoch = navigation.authorityVersion;
    broadcast("suspend");
    assert.equal(navigation.getSnapshot().phase, "expired"); assert.ok(navigation.authorityVersion > epoch);
    await navigation.refresh(); assert.equal(calls, 1, "focus cannot revive a failed/in-flight logout");
    broadcast("revoke");
    finish(Response.json({ authenticated: true, identity: { displayName: "Old account", email: "old@example.test", authSource: "local" }, actorId: null, organizations: [], selected: null, profileRequired: true }));
    await pending;
    assert.equal(navigation.getSnapshot().phase, "denied"); assert.equal(navigation.getSnapshot().identity, null); assert.equal(clears, 1);
    const secondRead = navigation.refresh(); broadcast("revoke"); finish(new Response(null, {status:401})); await secondRead;
    assert.equal(navigation.getSnapshot().phase, "denied", "repeated revocation fences a read begun while denied");
  } finally { stop(); if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window"); }
});
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

// Reproduced in the actual Organizations page: a staged dirty organization
// switch must keep its intent current until Stay or explicit Discard.
async function organizationDepartureHarness() {
  const actorId = "actor_synthetic_departure_owner";
  const organization = (id: string) => ({ id, name: id, kind: "team", status: "active", role: "org_owner", revision: 1, membershipRevision: 1, actorId, selection: `${id}.1.1.${actorId}` });
  const a = organization("org_synthetic_departure_a"), b = organization("org_synthetic_departure_b");
  const requests: Array<{ action: string; organizationId: string }> = [], leaves: string[] = [];
  let risk: "clear" | "dirty" | "pending" = "dirty", denied = 0, clears = 0;
  const navigation = new NavigationController({ transport: async (path, init) => {
    if (path === "/api/workspace-session") return Response.json({ authenticated: true, identity: { displayName: "Synthetic owner", email: "departure@example.test", authSource: "local" }, actorId, organizations: [a, b], selected: a, profileRequired: false });
    const body = JSON.parse(String(init?.body)); requests.push(body);
    return Response.json({ organization: body.organizationId === b.id ? b : a });
  }, leave: path => leaves.push(path), clear: () => { clears++; } });
  await navigation.refresh();
  assert.equal(navigation.getSnapshot().phase, "ready", "synthetic receipt must establish the ready baseline");
  navigation.register({}, { risk: () => risk, suspend: noop, deny: () => { denied++; } });
  const h = handlers({ navigation, closeDrawer: noop, window: { location: { assign: (path: string) => leaves.push(path) } }, document: { querySelector: () => null }, requestAnimationFrame: noop });
  navigation.registerDeparture((kind, id, plan) => { void h.depart(kind, id, false, "", plan); });
  const request = async () => { navigation.requestDeparture("organization", b.id); await new Promise<void>(resolve => setImmediate(resolve)); return h.pending; };
  const confirm = (pending: typeof h.pending) => h.depart(pending.kind, pending.id, true, pending.target, pending.plan);
  return { navigation, h, a, b, requests, leaves, request, confirm, setRisk: (value: typeof risk) => { risk = value; }, denied: () => denied, clears: () => clears };
}

test("actual organization departure preserves Stay then commits dirty Discard exactly once", async () => {
  const h = await organizationDepartureHarness();
  const first = await h.request(); assert.equal(first.risk, "dirty");
  h.h.cancelPending(); assert.deepEqual(h.requests, []); assert.deepEqual(h.leaves, []);
  const pending = await h.request(); await h.confirm(pending);
  assert.deepEqual(h.requests, [{ action: "select", organizationId: h.b.id }]);
  assert.deepEqual(h.leaves, ["/matters?organization=" + encodeURIComponent(h.b.selection) + "&lang=en"]);
  assert.equal(h.denied(), 1); assert.equal(h.clears(), 1); assert.equal(h.h.pending, null);
});

test("actual staged organization departure never discards an uncertain operation", async () => {
  const h = await organizationDepartureHarness(); h.setRisk("pending");
  const pending = await h.request(); await h.confirm(pending);
  assert.equal(h.h.pending.risk, "pending"); assert.deepEqual(h.requests, []); assert.deepEqual(h.leaves, []);
});

test("a newer departure or direct selection invalidates the old organization confirmation", async () => {
  for (const supersede of ["link", "selection"] as const) {
    const h = await organizationDepartureHarness(); const pending = await h.request();
    if (supersede === "link") h.navigation.requestDeparture("link", "/templates");
    else await h.navigation.select(h.a.id, "en");
    assert.equal(pending.plan.current(), false); await h.confirm(pending);
    assert.deepEqual(h.requests, []); assert.deepEqual(h.leaves, []);
  }
});

test("authority expiry or revocation cancels the staged organization confirmation", async () => {
  for (const phase of ["expired", "denied"] as const) {
    const h = await organizationDepartureHarness(); const pending = await h.request();
    h.navigation.invalidate(phase); await h.confirm(pending);
    assert.deepEqual(h.requests, []); assert.deepEqual(h.leaves, []); assert.equal(h.h.pending, null);
  }
});

test("stale staged selection is rejected before a request or a new intent", async () => {
  const h = await organizationDepartureHarness(); const pending = await h.request();
  const newest = h.navigation.beginIntent();
  await h.navigation.select(h.b.id, "en", true, pending.plan);
  assert.equal(h.navigation.intentCurrent(newest), true);
  assert.deepEqual(h.requests, []); assert.deepEqual(h.leaves, []);
  assert.equal(h.navigation.getSnapshot().selected?.id, h.a.id);
});
