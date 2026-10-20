import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fetchStudioRelease, readStudioRelease, studioRelease, studioReleaseKey } from "../app/studio-release";
import { GET } from "../app/api/studio-release/route";
import { loadStudioReleaseNotice } from "../app/StudioReleaseNoticeLoader";

const baseline = { schema: "casevant.studio-release.v1" as const, applicationInputsSha256: "a".repeat(64), hostingConfigSha256: "b".repeat(64), sourceCommit: "c".repeat(40) };
const next = { ...baseline, applicationInputsSha256: "d".repeat(64), sourceCommit: "e".repeat(40) };
const require = createRequire(import.meta.url), root = fileURLToPath(new URL("..", import.meta.url));

test("public release identity is exact, documentation-only commits do not trigger changes, and unknown builds fail closed", () => {
  assert.deepEqual(readStudioRelease(baseline), baseline);
  assert.equal(studioReleaseKey(baseline), studioReleaseKey({ ...baseline, sourceCommit: "f".repeat(40) }));
  assert.notEqual(studioReleaseKey(baseline), studioReleaseKey(next));
  assert.notEqual(studioReleaseKey(baseline), studioReleaseKey({ ...baseline, hostingConfigSha256: "f".repeat(64) }));
  for (const value of [null, [], {}, { ...baseline, sourceCommit: "unknown" }, { ...baseline, applicationInputsSha256: "BAD" }, { ...baseline, extra: "case-data" }]) assert.equal(readStudioRelease(value), null);
  assert.equal(studioRelease({ ...baseline, sourceCommit: "unknown" }), null);
  const response = GET(); assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
});

test("optional notice loader owns chunk failure and ignores a departed editor without exposing a refresh", async () => {
  let calls = 0;
  const panel = () => null;
  await loadStudioReleaseNotice(() => true, () => { calls++; }, async () => ({ default: panel }));
  assert.equal(calls, 1);
  await loadStudioReleaseNotice(() => false, () => { calls++; }, async () => ({ default: panel }));
  await loadStudioReleaseNotice(() => true, () => { calls++; }, async () => { throw new Error("Failed to fetch dynamically imported module"); });
  assert.equal(calls, 1);
});

test("release fetch transmits no authority/context and rejects redirect errors, malformed and bounded streamed responses", async () => {
  const original = globalThis.fetch;
  try {
    let init: RequestInit | undefined, target: unknown;
    globalThis.fetch = async (url, options) => { target = url; init = options; return Response.json(next); };
    const signal = new AbortController().signal;
    assert.deepEqual(await fetchStudioRelease(signal), next);
    assert.equal(target, "/api/studio-release"); assert.equal(init?.credentials, "omit"); assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error"); assert.equal(init?.signal, signal);
    assert.deepEqual(init?.headers, { Accept: "application/json" }); assert.equal(init?.body, undefined);
    for (const response of [new Response("offline", { status: 503 }), new Response("{}", { headers: { "content-type": "text/html" } }), Response.json({ ...next, extra: "unknown" }), new Response("{", { headers: { "content-type": "application/json" } }), new Response("{}", { headers: { "content-type": "application/json", "content-length": "2048" } })]) {
      globalThis.fetch = async () => response; assert.equal(await fetchStudioRelease(signal), null);
    }
    let cancelled = false;
    globalThis.fetch = async () => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(600)); }, cancel() { cancelled = true; } }), { headers: { "content-type": "application/json" } });
    assert.equal(await fetchStudioRelease(signal), null); assert.equal(cancelled, true);
    globalThis.fetch = async () => { throw new TypeError("redirect refused"); };
    await assert.rejects(fetchStudioRelease(signal), /redirect refused/);
  } finally { globalThis.fetch = original; }
});

async function harness() {
  const { build } = require("esbuild") as typeof import("esbuild");
  const output = await build({ absWorkingDir: root, outfile: "notice.cjs", stdin: { contents: 'export { default, StudioReleaseNoticeContent } from "./app/StudioReleaseNotice";', resolveDir: root }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" }, define: { __GENESIS_BUILD_IDENTITY__: JSON.stringify(baseline) }, logLevel: "silent" });
  const states: unknown[] = [], timers = new Map<number, () => unknown>(), events = new Map<string, () => void>();
  let cursor = 0, effect: (() => (() => void) | undefined) | undefined, timer = 0, clock = 0, visible = true;
  let payload: unknown = next, pendingResolve: ((response: Response) => void) | undefined, delay = false;
  const signals: AbortSignal[] = [], calls: string[] = [];
  const mod = { exports: {} as { default: (props: Record<string, unknown>) => ReactNode; StudioReleaseNoticeContent: (props: Record<string, unknown>) => ReactNode } };
  class FocusTarget { isConnected = true; closest() { return null; } getClientRects() { return [1]; } focus() { calls.push("restore-focus"); } }
  const focusTarget = new FocusTarget();
  const add = (name: string, callback: () => void) => events.set(name, callback), remove = (name: string) => events.delete(name);
  const context = vm.createContext({ module: mod, exports: mod.exports, require: (name: string) => name === "react" ? {
    useState(initial: unknown) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (value: unknown) => { states[index] = value; }]; },
    useEffect(callback: () => (() => void) | undefined) { effect ??= callback; },
    useRef(initial: unknown) { const index = cursor++; if (!(index in states)) states[index] = { current: initial }; return states[index]; },
  } : require(name),
  Date: { now: () => clock }, AbortController, TextDecoder, Uint8Array, HTMLElement: FocusTarget,
  document: { activeElement: focusTarget, get visibilityState() { return visible ? "visible" : "hidden"; }, addEventListener: add, removeEventListener: remove }, window: { addEventListener: add, removeEventListener: remove },
  setTimeout: (callback: () => void) => { const id = ++timer; timers.set(id, callback); return id; }, clearTimeout: (id: number) => timers.delete(id),
  setInterval: (callback: () => void) => { events.set("interval", callback); return 99; }, clearInterval: () => events.delete("interval"),
  fetch: async (_url: unknown, init: RequestInit) => { signals.push(init.signal as AbortSignal); calls.push("read-release"); if (delay) return new Promise<Response>(resolve => { pendingResolve = resolve; }); return Response.json(payload); },
  });
  vm.runInContext(output.outputFiles[0].text, context);
  const props = { locale: "en", canSave: true, canExport: true, busy: false, onSave() { calls.push("save"); }, onExport() { calls.push("export"); } };
  const render = () => { cursor = 0; return mod.exports.default(props) as ReactElement<Record<string, unknown>> | null; };
  render(); const cleanup = effect!();
  return { render, props, calls, signals, timers, events, cleanup, content: mod.exports.StudioReleaseNoticeContent, available: () => states[0],
    tick() { clock += 60_001; }, hide() { visible = false; }, show() { visible = true; }, payload(value: unknown) { payload = value; }, delay() { delay = true; }, resolve() { pendingResolve!(Response.json(payload)); },
    async settle() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); },
  };
}

test("actual notice effect is read-only, throttled, quiet on errors, dismissible per release and cancels late completions", async () => {
  const h = await harness();
  assert.equal(h.render(), null); await h.timers.get(1)!(); await h.settle();
  assert.ok(h.render()); assert.deepEqual(h.calls, ["read-release"]);
  h.events.get("focus")!(); await h.settle(); assert.equal(h.calls.length, 1, "focus is throttled");
  (h.render()!.props.onDismiss as () => void)(); assert.equal(h.render(), null);
  assert.equal(h.calls.pop(), "restore-focus", "explicit dismissal returns to the visible original control without stealing focus on appearance");
  h.tick(); h.hide(); h.events.get("interval")!(); await h.settle(); assert.equal(h.calls.length, 1);
  h.show(); h.payload({ ...next, hostingConfigSha256: "f".repeat(64) }); h.events.get("visibilitychange")!(); await h.settle(); assert.ok(h.render(), "a different later identity can be announced");
  const current = h.available(); h.tick(); h.payload({ malformed: true }); h.events.get("focus")!(); await h.settle(); assert.equal(h.available(), current, "invalid responses leave the editor and notice alone");
  h.tick(); h.delay(); h.events.get("focus")!(); await h.settle();
  h.cleanup!(); h.payload(baseline); h.resolve(); await h.settle();
  assert.equal(h.available(), current, "late same-release response cannot clear or change the unmounted notice");
  assert.equal(h.signals.at(-1)!.aborted, true); assert.equal(h.timers.size, 0); assert.equal(h.events.size, 0);
  assert.ok(h.calls.every(call => call === "read-release"), "no save/export/navigation/focus/storage mutation occurs automatically");
});

test("same application hashes remain quiet and a timed-out check cannot announce a late release", async () => {
  const same = await harness(); same.payload({ ...baseline, sourceCommit: "f".repeat(40) });
  await same.timers.get(1)!(); await same.settle(); assert.equal(same.render(), null); same.cleanup!();
  const timed = await harness(); timed.delay(); await timed.timers.get(1)!(); await timed.settle();
  timed.timers.get(2)!(); assert.equal(timed.signals[0].aborted, true);
  timed.resolve(); await timed.settle(); assert.equal(timed.render(), null); timed.cleanup!();
  assert.deepEqual(timed.calls, ["read-release"]);
});

test("notice content is bilingual, uses explicit guarded actions and opens updated Studio without transferring a draft", async () => {
  const h = await harness();
  for (const locale of ["en", "ru"]) for (const allowed of [false, true]) {
    const props = { ...h.props, locale, canSave: allowed, canExport: allowed, busy: true, onDismiss() { h.calls.push("dismiss"); } };
    const tree = h.content(props), html = renderToStaticMarkup(tree);
    assert.match(html, /role="status"/); assert.match(html, /<details>/); assert.doesNotMatch(html, /autofocus|custom_case|organization=|return_to=/i);
    assert.ok(html.includes(`href="/studio?lang=${locale}"`)); assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    assert.equal((html.match(/ disabled=""/g) ?? []).length, allowed ? 2 : 0);
    assert.ok(html.includes(locale === "en" ? "Unadded form input" : "Недобавленные записи"));
    assert.equal(h.calls.length, 0, "rendering never saves or exports");
  }
  // Execute actual click callbacks; existing Studio handlers retain authority.
  const walk = (value: ReactNode): ReactElement<Record<string, unknown>>[] => Array.isArray(value) ? value.flatMap(walk) : isValidElement<Record<string, unknown>>(value) ? [value, ...walk(value.props.children as ReactNode)] : [];
  const controls = walk(h.content({ ...h.props, onDismiss() {} }));
  (controls.find(item => item.type === "button" && item.props.className === "primary-cta")!.props.onClick as () => void)();
  assert.deepEqual(h.calls, ["save"]);
  assert.ok(renderToStaticMarkup(createElement("div", {}, h.content({ ...h.props, onDismiss() {} }))));
});
