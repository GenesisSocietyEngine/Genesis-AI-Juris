import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import type { ReportReceiptV2 } from "../app/report-model";
import type { StudioDraft } from "../app/types";
import { StudioSessionAuthority } from "../app/studio-session-authority";

// Execute the actual parent callbacks, report models, receipt construction,
// privacy policy and download helper. Only React's hook scheduling/DOM and the
// PDF byte renderer are modeled. This is not browser or PDF-render acceptance.
type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
type HookSlot = { initialized?: boolean; value?: unknown; dependencies?: unknown[]; cleanup?: () => void };
type PdfState = { receipts: ReportReceiptV2[]; fail: boolean; hold: boolean; finish: Array<() => void> };
const fixtureGlobal = globalThis as typeof globalThis & {
  __reportHooks?: ReturnType<typeof hookRuntime>;
  __reportPdf?: PdfState;
};
function sameDependencies(a?: unknown[], b?: unknown[]) {
  return Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
}
function hookRuntime() {
  const slots: HookSlot[] = [];
  let cursor = 0;
  let effects: Array<() => void> = [];
  let layoutEffects: Array<() => void> = [];
  let renderAgain = false;
  const next = () => slots[cursor++] ?? (slots[cursor - 1] = {});
  const schedule = (queue: Array<() => void>, effect: () => (() => void) | undefined, dependencies?: unknown[]) => {
    const slot = next();
    if (!sameDependencies(slot.dependencies, dependencies)) {
      queue.push(() => { slot.cleanup?.(); slot.dependencies = dependencies; slot.cleanup = effect(); });
    }
  };
  return {
    begin() { cursor = 0; effects = []; layoutEffects = []; renderAgain = false; },
    needsRender() { return renderAgain; },
    flush() { for (const effect of layoutEffects) effect(); layoutEffects = []; for (const effect of effects) effect(); effects = []; },
    unmount() { for (const slot of slots) slot.cleanup?.(); },
    useState(initial: unknown) {
      const slot = next();
      if (!slot.initialized) { slot.value = typeof initial === "function" ? initial() : initial; slot.initialized = true; }
      return [slot.value, (value: unknown) => { slot.value = typeof value === "function" ? value(slot.value) : value; renderAgain = true; }];
    },
    useRef(initial: unknown) {
      const slot = next();
      if (!slot.initialized) { slot.value = { current: initial }; slot.initialized = true; }
      return slot.value;
    },
    useMemo(factory: () => unknown, dependencies: unknown[]) {
      const slot = next();
      if (!sameDependencies(slot.dependencies, dependencies)) { slot.value = factory(); slot.dependencies = dependencies; }
      return slot.value;
    },
    useEffect(effect: () => (() => void) | undefined, dependencies?: unknown[]) {
      schedule(effects, effect, dependencies);
    },
    useLayoutEffect(effect: () => (() => void) | undefined, dependencies?: unknown[]) { schedule(layoutEffects, effect, dependencies); },
  };
}

const bundle = await build({
  entryPoints: ["app/CaseReportDialog.tsx", "app/CaseMarkdownDialog.tsx"], outdir: ".artifacts/report-receipt-dialog/bundles", bundle: true, write: false,
  format: "esm", platform: "node", packages: "external", jsx: "automatic",
  plugins: [{ name: "report-dialog-contract-runtime", setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "contract" }));
    builder.onResolve({ filter: /^\.\/case-report$/ }, args => args.importer.endsWith("CaseReportDialog.tsx") ? { path: "report", namespace: "contract" } : undefined);
    builder.onResolve({ filter: /^pdfmake\/build\/pdfmake\.js$/ }, () => ({ path: "pdf", namespace: "contract" }));
    builder.onResolve({ filter: /^pdfmake\/build\/vfs_fonts\.js$/ }, () => ({ path: "fonts", namespace: "contract" }));
    builder.onLoad({ filter: /.*/, namespace: "contract" }, args => ({
      resolveDir: process.cwd(), loader: "js",
      contents: args.path === "hooks"
        ? ["useState", "useRef", "useMemo", "useEffect", "useLayoutEffect"].map(name => `export const ${name} = (...args) => globalThis.__reportHooks.${name}(...args);`).join("\n")
        : args.path === "report"
          ? `import * as actual from './app/case-report.ts'; export * from './app/case-report.ts'; export async function downloadCaseReport(...args) { const receipt = await actual.downloadCaseReport(...args); globalThis.__reportPdf.receipts.push(receipt); return receipt; }`
          : args.path === "fonts" ? "export default {};"
            : `import { EventEmitter } from 'node:events'; export default { addVirtualFileSystem() {}, createPdf() { if(globalThis.__reportPdf.fail) throw new Error('Controlled PDF failure'); return { getStream() { const stream = new EventEmitter(); stream.end = () => { const finish = () => { stream.emit('data', Buffer.from('%PDF-modeled-renderer')); stream.emit('end'); }; if(globalThis.__reportPdf.hold) globalThis.__reportPdf.finish.push(finish); else queueMicrotask(finish); }; return stream; } }; } };`,
    }));
  } }],
});
mkdirSync(".artifacts/report-receipt-dialog", { recursive: true });
const componentFile = resolve(".artifacts/report-receipt-dialog/component.mjs");
writeFileSync(componentFile, bundle.outputFiles.find(file => file.path.endsWith("CaseReportDialog.js"))!.text);
const Parent = (await import(pathToFileURL(componentFile).href)).default;
const markdownComponentFile = resolve(".artifacts/report-receipt-dialog/markdown.mjs");
writeFileSync(markdownComponentFile, bundle.outputFiles.find(file => file.path.endsWith("CaseMarkdownDialog.js"))!.text);
const MarkdownParent = (await import(pathToFileURL(markdownComponentFile).href)).default;

function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
  return "";
}
function button(tree: unknown, label: string) {
  const found = elements(tree).find(element => element.type === "button" && text(element.props.children) === label);
  assert.ok(found, `button ${label} must be visible`);
  return found;
}
async function click(tree: unknown, label: string) {
  const element = button(tree, label);
  assert.notEqual(element.props.disabled, true, label + " must be enabled");
  await (element.props.onClick as () => unknown)();
}

test("the dialog exposes the exact private PDF receipt, preserves it on failure and distinguishes changed options", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const blobs = new Map<string, Blob>();
  const downloads: Array<{ filename: string; blob: Blob }> = [];
  const storageWrites: unknown[] = [];
  let sequence = 0, closed = 0, completed = 0;
  fixtureGlobal.__reportHooks = hookRuntime();
  const pdf: PdfState = fixtureGlobal.__reportPdf = { receipts: [], fail: false, hold: false, finish: [] };
  URL.createObjectURL = blob => { const id = "blob:test-" + (++sequence); blobs.set(id, blob as Blob); return id; };
  URL.revokeObjectURL = id => { blobs.delete(id); };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem() { return null; }, setItem(...args: unknown[]) { storageWrites.push(args); }, removeItem() {} },
    setTimeout() { return 1; }, clearTimeout() {},
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    activeElement: null, addEventListener() {}, removeEventListener() {}, body: { appendChild() {} },
    createElement() { return { href: "", download: "", remove() {}, click(this: { href: string; download: string }) { downloads.push({ filename: this.download, blob: blobs.get(this.href)! }); } }; },
  } });
  const draft: StudioDraft = { ...buildCanopyPackage("base").draft, protection: {
    kind: "case-protection-v1", copyProtected: false, copyPolicy: "fork_allowed", parentCode: null,
    currentCode: "sha256-" + "a".repeat(64), seal: "hmac-sha256-" + "b".repeat(64),
  } };
  const fingerprint = caseFingerprint(draft), publication = casePublicationFingerprint(draft);
  let props = { locale: "en", draft, currentFingerprint: fingerprint, workspaceFingerprint: fingerprint,
    currentPublicationFingerprint: publication, workspacePublicationFingerprint: publication,
    privateCase: true, canGenerateReport: true, reportReceiptStorageScope: "a".repeat(64),
    verifyReportAuthority: async () => () => true, // Existing receipt tests isolate an already-authorized boundary; the separate test below exercises real authority checks.
    persistReportReceiptOnDevice: false, close() { closed++; }, completed() { completed++; } };
  const render = () => {
    const hooks = fixtureGlobal.__reportHooks!;
    let tree: unknown, attempts = 0;
    do { hooks.begin(); tree = Parent(props); assert.ok(++attempts < 10, "render-phase reset must settle"); } while (hooks.needsRender());
    hooks.flush(); return tree;
  };
  try {
    let tree = render();
    assert.doesNotMatch(text(tree), /Download receipt JSON/);
    await click(tree, "Download PDF");
    tree = render();
    assert.equal(closed, 0, "PDF success must retain the dialog so its actual receipt is reachable");
    assert.equal(completed, 1);
    assert.equal(pdf.receipts.length, 1);
    assert.match(text(tree), /matches the current case and report settings/);
    assert.ok(text(tree).includes(pdf.receipts[0].reportFingerprint));
    await click(tree, "Download receipt JSON");
    assert.equal(downloads.length, 2);
    assert.equal(downloads[0].blob.type, "application/pdf");
    assert.equal(downloads[1].blob.type, "application/json");
    assert.deepEqual(JSON.parse(await downloads[1].blob.text()), pdf.receipts[0], "export exactly the returned receipt, without fake PDF hash/output IDs");
    assert.deepEqual(storageWrites, [], "private sealed receipts must remain outside browser storage");

    const treeSwitch = elements(tree).find(element => element.type === "input" && element.props.role === "switch");
    assert.ok(treeSwitch); assert.equal(treeSwitch.props.checked, false, "decision tree defaults OFF");
    await click(tree, "Preview PDF"); tree = render();
    assert.ok(elements(tree).some(element => element.type === "iframe"), "OFF preview is available");
    (treeSwitch.props.onChange as (event: unknown) => void)({ target: { checked: true } });
    tree = render();
    assert.match(text(tree), /earlier PDF download/, "tree change makes previous receipt stale");
    assert.ok(!elements(tree).some(element => element.type === "iframe"), "tree change clears old preview");
    const format = elements(tree).find(element => element.type === "input" && element.props.type === "radio" && element.props.value === "medium" && element.props.checked)!;
    assert.ok(format, "tree ON selects the Medium preset");
    (elements(tree).find(element => element.type === "input" && element.props.type === "radio" && element.props.value === "full")!.props.onChange as () => void)();
    tree = render();
    assert.equal(elements(tree).find(element => element.type === "input" && element.props.role === "switch")?.props.checked, true, "format switch retains explicit tree selection");
    assert.ok(elements(tree).some(element => element.type === "input" && element.props.type === "radio" && element.props.value === "full" && element.props.checked));
    (elements(tree).find(element => element.type === "input" && element.props.type === "radio" && element.props.value === "decision")!.props.onChange as () => void)();
    (treeSwitch.props.onChange as (event: unknown) => void)({ target: { checked: false } });
    tree = render();
    assert.match(text(tree), /matches the current case and report settings/, "returning to exact options recovers receipt match");
    (elements(tree).find(element => element.type === "input" && element.props.type === "radio" && element.props.value === "medium")!.props.onChange as () => void)();
    tree = render();
    assert.equal(elements(tree).find(element => element.type === "input" && element.props.role === "switch")?.props.checked, true);
    const mediumTreeSwitch = elements(tree).find(element => element.type === "input" && element.props.role === "switch")!;
    (mediumTreeSwitch.props.onChange as (event: unknown) => void)({ target: { checked: false } });
    tree = render();
    assert.ok(elements(tree).some(element => element.type === "input" && element.props.type === "radio" && element.props.value === "decision" && element.props.checked), "Medium OFF returns to Base");

    const preparedBy = elements(tree).find(element => element.type === "input" && element.props.placeholder === "Name / firm");
    assert.ok(preparedBy);
    (preparedBy.props.onChange as (event: unknown) => void)({ target: { value: "Synthetic changed preparer" } });
    tree = render();
    assert.match(text(tree), /earlier PDF download/);
    pdf.fail = true;
    await click(tree, "Download PDF");
    tree = render();
    assert.match(text(tree), /report could not be created/);
    assert.equal(pdf.receipts.length, 1);
    await click(tree, "Download receipt JSON");
    assert.deepEqual(JSON.parse(await downloads.at(-1)!.blob.text()), pdf.receipts[0], "a failed generation must preserve the prior successful receipt");

    pdf.fail = false; pdf.hold = true;
    const pending = click(tree, "Download PDF");
    for (let attempt = 0; !pdf.finish.length && attempt < 10; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 1);
    tree = render();
    const changedAgain = elements(tree).find(element => element.type === "input" && element.props.placeholder === "Name / firm")!;
    (changedAgain.props.onChange as (event: unknown) => void)({ target: { value: "Typed while PDF was generating" } });
    tree = render();
    pdf.finish.shift()!(); await pending;
    tree = render();
    assert.equal(pdf.receipts.length, 2);
    assert.notEqual(pdf.receipts[1].presentationFingerprint, pdf.receipts[0].presentationFingerprint);
    assert.match(text(tree), /earlier PDF download/, "late completion binds captured options, not the newer form state");
    await click(tree, "Download receipt JSON");
    assert.deepEqual(JSON.parse(await downloads.at(-1)!.blob.text()), pdf.receipts[1]);

    const pendingAcrossScope = click(tree, "Download PDF");
    for (let attempt = 0; !pdf.finish.length && attempt < 10; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 1);
    const downloadsBeforeScopeChange = downloads.length;
    props = { ...props, reportReceiptStorageScope: "c".repeat(64) };
    tree = render();
    assert.doesNotMatch(text(tree), /Download receipt JSON/, "account boundary hides the old receipt synchronously");
    pdf.finish.shift()!(); await pendingAcrossScope;
    tree = render();
    assert.doesNotMatch(text(tree), /Download receipt JSON/, "late completion cannot publish the old account receipt into the new scope");
    assert.equal(completed, 2, "late completion cannot announce success in the new scope");
    assert.equal(downloads.length, downloadsBeforeScopeChange, "late old-scope generation cannot start a file download");
    assert.deepEqual(storageWrites, []);

    const pendingPreview = click(tree, "Preview PDF");
    for (let attempt = 0; !pdf.finish.length && attempt < 10; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 1);
    props = { ...props, reportReceiptStorageScope: "d".repeat(64) };
    tree = render(); tree = render(); // Apply the new scope's reset before its own operation.
    const newScopePdf = click(tree, "Download PDF");
    for (let attempt = 0; pdf.finish.length < 2 && attempt < 10; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 2);
    const urlsBeforeOldPreview = blobs.size;
    pdf.finish.shift()!(); await pendingPreview;
    tree = render();
    assert.equal(blobs.size, urlsBeforeOldPreview, "old-scope preview must not allocate or expose a new preview URL");
    assert.equal(button(tree, "Download PDF").props.disabled, true, "old preview completion cannot clear a new scope's active download state");
    pdf.finish.shift()!(); await newScopePdf;
    tree = render();
    await click(tree, "Download receipt JSON");
    assert.deepEqual(JSON.parse(await downloads.at(-1)!.blob.text()), pdf.receipts.at(-1));
    const oldExport = button(tree, "Download receipt JSON").props.onClick as () => void;
    props = { ...props, canGenerateReport: false };
    tree = render();
    const countBeforeRevokedExport = downloads.length;
    oldExport();
    assert.doesNotMatch(text(tree), /Download receipt JSON/);
    assert.equal(downloads.length, countBeforeRevokedExport, "a captured callback cannot export after authority is revoked");
    assert.deepEqual(storageWrites, []);

    props = { ...props, canGenerateReport: true };
    tree = render();
    pdf.hold = false;
    await click(tree, "Preview PDF");
    tree = render();
    assert.ok(elements(tree).some(element => element.type === "iframe"), "completed preview is initially visible");
    props = { ...props, canGenerateReport: false };
    tree = render();
    assert.ok(!elements(tree).some(element => element.type === "iframe"), "revocation hides an already completed preview");
    props = { ...props, canGenerateReport: true };
    tree = render();
    assert.ok(!elements(tree).some(element => element.type === "iframe"), "restored authority cannot revive an old-context preview");
    pdf.hold = true;
    const pendingRevoked = click(tree, "Download PDF");
    for (let attempt = 0; !pdf.finish.length && attempt < 10; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 1);
    props = { ...props, canGenerateReport: false };
    tree = render();
    const beforeRevocation = { downloads: downloads.length, receipts: pdf.receipts.length, completed };
    pdf.finish.shift()!(); await pendingRevoked;
    assert.deepEqual({ downloads: downloads.length, receipts: pdf.receipts.length, completed }, beforeRevocation,
      "revocation during PDF rendering must prevent file, receipt and success side effects");

    props = { ...props, canGenerateReport: true };
    tree = render();
    const pendingUnmounted = click(tree, "Download PDF");
    for (let attempt = 0; !pdf.finish.length && attempt < 10; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 1);
    fixtureGlobal.__reportHooks!.unmount();
    const beforeUnmount = { downloads: downloads.length, receipts: pdf.receipts.length, completed };
    pdf.finish.shift()!(); await pendingUnmounted;
    assert.deepEqual({ downloads: downloads.length, receipts: pdf.receipts.length, completed }, beforeUnmount,
      "unmounted report dialog must prevent late file, receipt and success side effects");
    assert.deepEqual(storageWrites, []);
  } finally {
    fixtureGlobal.__reportHooks?.unmount();
    delete fixtureGlobal.__reportHooks; delete fixtureGlobal.__reportPdf;
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});

test("actual PDF parent and helper reject a stale active tab, recheck after rendering and never revive old output after sign-in", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const blobs = new Map<string, Blob>(), downloads: Blob[] = [], storageWrites: unknown[] = [];
  let sequence = 0, completed = 0, signedIn = true;
  const calls: string[] = [];
  const authority = new StudioSessionAuthority(async path => {
    calls.push(path);
    if (!signedIn) return Response.json({ authenticated: false }, { status: 401 });
    return Response.json(path === "/api/me"
      ? { authenticated: true, registered: true, profile: { email: "owner@example.test" }, capabilities: { studioAI: false } }
      : { customCase: { id: 1, isPrivate: true, access: "owner", copyProtected: false } });
  });
  await authority.refresh(false, 1);
  const scope = authority.getSnapshot().scope;
  fixtureGlobal.__reportHooks = hookRuntime();
  const pdf: PdfState = fixtureGlobal.__reportPdf = { receipts: [], fail: false, hold: false, finish: [] };
  URL.createObjectURL = blob => { const url = `blob:auth-${++sequence}`; blobs.set(url, blob as Blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem() { return null; }, setItem(...args: unknown[]) { storageWrites.push(args); }, removeItem() {} }, setTimeout() { return 1; }, clearTimeout() {},
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    activeElement: null, addEventListener() {}, removeEventListener() {}, body: { appendChild() {} },
    createElement() { return { href: "", download: "", remove() {}, click(this: { href: string }) { downloads.push(blobs.get(this.href)!); } }; },
  } });
  const draft = buildCanopyPackage("base").draft;
  const fingerprint = caseFingerprint(draft), publication = casePublicationFingerprint(draft);
  const render = () => {
    const permission = authority.reportAuthority(true, scope, 1);
    const props = { locale: "en", draft, currentFingerprint: fingerprint, workspaceFingerprint: fingerprint,
      currentPublicationFingerprint: publication, workspacePublicationFingerprint: publication,
      privateCase: true, canGenerateReport: permission.allowed, reportAuthorityEpoch: permission.epoch,
      verifyReportAuthority: permission.verify, reportReceiptStorageScope: scope, persistReportReceiptOnDevice: false,
      close() {}, completed() { completed++; } };
    const hooks = fixtureGlobal.__reportHooks!;
    let tree: unknown, attempts = 0;
    do { hooks.begin(); tree = Parent(props); assert.ok(++attempts < 10); } while (hooks.needsRender());
    hooks.flush(); return tree;
  };
  const finishRendering = async () => {
    for (let attempt = 0; !pdf.finish.length && attempt < 20; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(pdf.finish.length, 1);
  };
  try {
    let tree = render(); await click(tree, "Preview PDF"); tree = render();
    assert.ok(elements(tree).some(element => element.type === "iframe"));
    const previewUrl = [...blobs.keys()][0]; assert.ok(previewUrl);
    // Confirmed hosted reproduction: old tab retains canGenerate=true, no focus or boundary signal, but the server is now signed out.
    signedIn = false; const before = { downloads: downloads.length, receipts: pdf.receipts.length, completed };
    await click(tree, "Download PDF"); tree = render();
    assert.deepEqual({ downloads: downloads.length, receipts: pdf.receipts.length, completed }, before);
    assert.equal(blobs.has(previewUrl), false, "actual completed preview URL is revoked after server denial");
    assert.ok(!elements(tree).some(element => element.type === "iframe"));
    assert.doesNotMatch(text(tree), /Download receipt JSON/);
    signedIn = true; await authority.refresh(true, 1); tree = render();
    assert.ok(!elements(tree).some(element => element.type === "iframe"), "same-account recovery must not revive the prior preview");

    // No signal is delivered while rendering: the mandatory final server check still prevents issuance.
    pdf.hold = true; const pending = click(tree, "Download PDF"); await finishRendering();
    signedIn = false; pdf.finish.shift()!(); await pending; tree = render();
    assert.deepEqual({ downloads: downloads.length, receipts: pdf.receipts.length, completed }, before);
    assert.deepEqual(storageWrites, []);

    signedIn = true; await authority.refresh(true, 1); tree = render();
    const pendingBoundary = click(tree, "Download PDF"); await finishRendering();
    authority.sessionBoundary("revoke"); // No React rerender before the late callback: synchronous epoch must suffice.
    pdf.finish.shift()!(); await pendingBoundary;
    assert.deepEqual({ downloads: downloads.length, receipts: pdf.receipts.length, completed }, before);
    await authority.refresh(true, 1); tree = render(); pdf.hold = false;
    await click(tree, "Download PDF"); tree = render();
    assert.equal(downloads.length, 1); assert.equal(completed, 1); assert.equal(pdf.receipts.length, 1);
    signedIn = false; await click(tree, "Download receipt JSON"); tree = render();
    assert.equal(downloads.length, 1, "a receipt is also protected output, not a bypass around PDF authority");
    assert.doesNotMatch(text(tree), /Download receipt JSON/);
    assert.deepEqual(storageWrites, []);
    assert.ok(calls.filter(path => path === "/api/custom-cases?id=1").length >= 4, "actual case permission is rechecked rather than guessed from /api/me");
  } finally {
    fixtureGlobal.__reportHooks?.unmount(); delete fixtureGlobal.__reportHooks; delete fixtureGlobal.__reportPdf;
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});

test("actual Markdown download and clipboard callbacks share protected-output authority", async () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document"), oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  let downloads = 0, copies = 0, signedIn = true;
  const authority = new StudioSessionAuthority(async path => !signedIn ? Response.json({}, { status: 401 }) : Response.json(path === "/api/me"
    ? { authenticated: true, registered: true, profile: { email: "owner@example.test" }, capabilities: { studioAI: false } }
    : { customCase: { id: 1, isPrivate: true, access: "owner", copyProtected: false } }));
  await authority.refresh(false, 1); const scope = authority.getSnapshot().scope;
  fixtureGlobal.__reportHooks = hookRuntime();
  URL.createObjectURL = () => "blob:markdown"; URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement() { return { href: "", click() { downloads++; } }; } } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { async writeText() { copies++; } } } });
  const draft = buildCanopyPackage("base").draft;
  const render = () => {
    const permission = authority.reportAuthority(true, scope, 1), hooks = fixtureGlobal.__reportHooks!;
    hooks.begin(); const tree = MarkdownParent({ locale: "en", draft, canExport: permission.allowed, verifyAuthority: permission.verify, close() {}, completed() {} }); hooks.flush(); return tree;
  };
  try {
    let tree = render();
    for (let attempt = 0; button(tree, "Download .md").props.disabled && attempt < 100; attempt++) { await new Promise(resolve => setTimeout(resolve, 2)); tree = render(); }
    assert.equal(button(tree, "Download .md").props.disabled, false);
    const staleCopy = button(tree, "Copy Markdown").props.onClick as () => void;
    signedIn = false; await click(tree, "Download .md"); staleCopy();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(downloads, 0); assert.equal(copies, 0);
    signedIn = true; await authority.refresh(true, 1); tree = render(); await click(tree, "Download .md");
    assert.equal(downloads, 1);
    const oldDownload = button(tree, "Download .md").props.onClick as () => Promise<void>;
    fixtureGlobal.__reportHooks!.unmount(); await oldDownload();
    assert.equal(downloads, 1, "closing the dialog while authority is checked cannot create a late file");
  } finally {
    fixtureGlobal.__reportHooks?.unmount(); delete fixtureGlobal.__reportHooks;
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
    if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator); else Reflect.deleteProperty(globalThis, "navigator");
  }
});
