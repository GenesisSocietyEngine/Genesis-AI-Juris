import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint, legacyCaseFingerprintV15, normalizeStudioDraft } from "../app/case-integrity";
import { StudioTaxWriteBaseline } from "../app/studio-tax-write-baseline";
import { savedStudioPath } from "../app/studio-save-receipt";
import { parseStudioWorkflowStep, restoredStudioWorkflowStep, serializedStudioWorkflowStep } from "../app/studio-workflow";
import type { StudioDraft } from "../app/types";

// Execute the actual parent handler, URL integration expression and effects.
// Transport, React scheduling/state and browser history/storage are modeled;
// case normalization/fingerprints and workflow helpers are real. Not browser QA.
const source = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("JurisApp.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const pieces: Record<string, string> = {};
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "openWorkspaceCustomCase") pieces.handler = node.getText(ast);
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === "restorePending" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) pieces.pending = node.initializer.expression.getText(ast);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect") {
    const effect = node.arguments[0]?.getText(ast) ?? "";
    if (effect.includes("const restoredStep = restoredStudioWorkflowStep")) pieces.restore = effect;
    if (effect.includes("const stage = serializedStudioWorkflowStep(guidedStep)")) pieces.persist = effect;
    if (effect.includes("function restoreGuidedStepFromHistory")) pieces.history = effect;
    if (effect.includes("void openWorkspaceCustomCase(Number(value), true)")) pieces.entry = effect;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
for (const key of ["handler", "pending", "restore", "persist", "history", "entry"]) assert.ok(pieces[key], "Actual source piece: " + key);
const compiled = ts.transpileModule(`${pieces.handler}\n({ load: openWorkspaceCustomCase, restore: ${pieces.restore}, persist: ${pieces.persist}, history: ${pieces.history}, entry: ${pieces.entry}, pending: () => (${pieces.pending}) });`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness(query = "custom_case=1&studio_step=case_map") {
  const exact = buildCanopyPackage("base").draft;
  const blank = { ...exact, title: "", nodes: [], links: [] };
  let href = "https://workspace.invalid/studio?" + query, installed: number | null = null;
  const requests: Array<{ resolve: (response: Response) => void; reject: (error: Error) => void }> = [];
  const timers = new Map<number, () => void>(), storage = new Map<string, string>(), listeners = new Map<string, () => void>(), notices: string[] = [];
  let timerId = 0;
  const state = {
    URL, URLSearchParams, Event, AbortSignal, locale: "en", normalizeStudioDraft, caseFingerprint, legacyCaseFingerprintV15, casePublicationFingerprint, savedStudioPath,
    parseStudioWorkflowStep, serializedStudioWorkflowStep, restoredStudioWorkflowStep,
    savedCaseRequestRef: { current: 0 }, draftRef: { current: blank as StudioDraft }, currentStudioScopeRef: { current: "account-A" as string | null },
    studioTaxWriteBaseline: { current: new StudioTaxWriteBaseline() },
    restoredSavedCaseRef: { current: null as string | null }, studioSavedBaseline: { current: null },
    savedCaseRestorePending: null as number | null, studioAIEntitlement: "not_configured", studioRestoreReady: true, studioCustomCaseId: null,
    fetch: (_path: string, init: RequestInit) => { assert.ok(init.signal, "Saved-case read has bounded cancellation"); return new Promise<Response>((resolve, reject) => requests.push({ resolve, reject })); },
    readJsonResponse: (response: Response) => response.json(),
    studioDepartureFingerprint: caseFingerprint,
    replaceStudioDraft: (draft: StudioDraft) => { state.draftRef.current = draft; return true; },
    setSavedCaseRestorePending: (value: number | null | ((current: number | null) => number | null)) => { state.savedCaseRestorePending = typeof value === "function" ? value(state.savedCaseRestorePending) : value; },
    setStudioCustomCaseId: (id: number) => { installed = id; },
    setStudioPrivate() {}, setStudioCanManagePrivacy() {}, setStudioServerFingerprint() {}, setStudioServerPublicationFingerprint() {}, setStudioCanDuplicate() {}, setStudioCopyProtectionLocked() {}, setPrompt() {}, setSelectedNodeId() {}, setView() {},
    showSessionNotice: (value: string) => notices.push(value), setSessionNotice: (value: string) => notices.push(value),
    editorOpened: true, restorePending: false, guidedDraftIsEmpty: true, guidedStep: 1,
    guidedWorkflowKey: "synthetic-navigation", guidedWorkflowRestoredRef: { current: false },
    setGuidedStep: (step: number) => { state.guidedStep = step; },
    window: {
      get location() { const current = new URL(href); return { href, search: current.search, pathname: current.pathname }; },
      history: { state: null, replaceState(_state: unknown, _title: string, value: string | URL) { href = new URL(value, href).href; } },
      localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
      setTimeout(callback: () => void) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id: number) { timers.delete(id); },
      addEventListener(name: string, callback: () => void) { listeners.set(name, callback); }, removeEventListener(name: string) { listeners.delete(name); }, dispatchEvent() {},
    },
  };
  const actions = vm.runInNewContext(compiled, state) as { load: (id: number, preserve?: boolean) => Promise<void>; restore: () => void; persist: () => void; history: () => void; entry: () => void; pending: () => boolean };
  const flush = () => { const current = [...timers.values()]; timers.clear(); current.forEach(callback => callback()); };
  const navigationEffects = () => {
    state.restorePending = actions.pending();
    state.guidedDraftIsEmpty = !state.draftRef.current.title.trim() && state.draftRef.current.nodes.length === 0 && state.draftRef.current.links.length === 0;
    actions.restore(); actions.persist(); actions.history(); flush();
  };
  const respond = (index = 0, id = 1, extra: Record<string, unknown> = {}) => requests[index].resolve(Response.json({ customCase: { id, isPrivate: false, canManagePrivacy: true, copyProtected: false, fingerprint: caseFingerprint(exact), publicationFingerprint: casePublicationFingerprint(exact), access: "owner", ...extra }, draft: exact }));
  return { state, actions, requests, exact, blank, storage, notices, listeners, navigationEffects, flush, respond, url: () => new URL(href), navigate: (next: string) => { href = new URL(next, href).href; }, installed: () => installed };
}

test("a delayed exact saved case retains its requested map and Overview panel without placeholder URL writes", async () => {
  for (const panel of ["", "&studio_panel=overview"]) {
    const h = harness("custom_case=1&studio_step=case_map" + panel);
    const pending = h.actions.load(1, true);
    h.state.guidedWorkflowRestoredRef.current = true;
    h.navigationEffects();
    assert.equal(h.url().searchParams.get("studio_step"), "case_map");
    assert.equal(h.storage.size, 0);
    h.listeners.get("popstate")?.();
    h.respond(); await pending; h.navigationEffects();
    assert.equal(h.installed(), 1);
    assert.equal(caseFingerprint(h.state.draftRef.current), caseFingerprint(h.exact));
    assert.equal(h.url().searchParams.get("studio_step"), "case_map");
    assert.equal(h.url().searchParams.get("studio_panel"), panel ? "overview" : null);
    assert.equal(h.state.guidedStep, 4);
    assert.equal(h.state.savedCaseRestorePending, null);
  }
});

test("a newer tab selection for the same saved case survives its pending read", async () => {
  const h = harness(), pending = h.actions.load(1, true);
  h.navigationEffects();
  h.navigate("?custom_case=1&studio_step=report_save");
  h.listeners.get("popstate")?.();
  h.respond(); await pending; h.navigationEffects();
  assert.equal(h.installed(), 1);
  assert.equal(h.url().searchParams.get("studio_step"), "report_save");
  assert.equal(h.state.guidedStep, 6);
});

test("late saved-case data does not pull a newer page/view/case navigation back to Studio", async () => {
  for (const target of ["/templates", "/studio?view=demos", "/studio?custom_case=2&studio_step=case_map"]) {
    const h = harness(), pending = h.actions.load(1, true);
    h.navigate(target); const next = h.url().href;
    h.respond(); await pending;
    assert.equal(h.installed(), null); assert.equal(h.url().href, next);
    assert.equal(h.state.savedCaseRestorePending, null);
  }
});

test("failed, denied and invalid saved reads release restoration and preserve the genuine-empty Brief rule", async () => {
  for (const failure of ["network", "denied", "fingerprint"]) {
    const h = harness(), pending = h.actions.load(1, true);
    if (failure === "network") h.requests[0].reject(new Error("Request timed out"));
    else if (failure === "denied") h.requests[0].resolve(Response.json({ error: "Denied" }, { status: 403 }));
    else h.respond(0, 1, { fingerprint: "invalid" });
    await pending; h.navigationEffects();
    assert.equal(h.installed(), null); assert.equal(h.state.draftRef.current, h.blank);
    assert.equal(h.state.savedCaseRestorePending, null);
    assert.equal(h.url().searchParams.get("studio_step"), "describe");
    assert.ok(h.notices.length);
  }
});

test("an older completion cannot clear a newer request's pending gate", async () => {
  const h = harness(), first = h.actions.load(1, true);
  h.navigate("?custom_case=2&studio_step=case_map");
  const second = h.actions.load(2, true);
  h.respond(0, 1); await first;
  assert.equal(h.installed(), null); assert.equal(h.state.savedCaseRestorePending, 2);
  h.navigationEffects(); assert.equal(h.url().searchParams.get("studio_step"), "case_map");
  h.respond(1, 2); await second;
  assert.equal(h.installed(), 2); assert.equal(h.state.savedCaseRestorePending, null);
});

test("changed draft or account invalidates the read without leaving a pending gate", async () => {
  for (const change of ["draft", "scope", "request"]) {
    const h = harness(), pending = h.actions.load(1, true);
    if (change === "draft") h.state.draftRef.current = { ...h.blank, title: "New local work" };
    if (change === "scope") h.state.currentStudioScopeRef.current = "account-B";
    if (change === "request") h.state.savedCaseRequestRef.current += 1;
    const current = h.state.draftRef.current;
    h.respond(); await pending;
    assert.equal(h.installed(), null); assert.equal(h.state.draftRef.current, current);
    assert.equal(h.state.savedCaseRestorePending, null);
  }
});

test("anonymous and unavailable identity do not start or retain a saved-case restore request", () => {
  for (const entitlement of ["anonymous", "unavailable"]) {
    const h = harness(); h.state.studioAIEntitlement = entitlement;
    h.actions.entry(); h.flush();
    assert.equal(h.requests.length, 0); assert.equal(h.state.savedCaseRestorePending, null);
    assert.equal(h.actions.pending(), false);
  }
});
