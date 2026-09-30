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
import { primaryCaseOutput } from "../app/case-type-playbooks";
import { reportReceiptStorageKey } from "../app/report-model";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import type { TaxRuntime } from "../app/tax-runtime/runtime";
import { parseTaxReportReceipt, taxReportReceiptStorageKey } from "../app/tax-report-receipt";
import { attach, reportFixture } from "./helpers/tax-report-fixture";

// Execute the actual parent callbacks, report models, receipt construction,
// privacy policy and download helper. Only React's hook scheduling/DOM and the
// PDF byte renderer are modeled. This is not browser or PDF-render acceptance.
type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
type HookSlot = { initialized?: boolean; value?: unknown; dependencies?: unknown[]; cleanup?: () => void };
type PdfState = { receipts: ReportReceiptV2[]; fail: boolean; hold: boolean; finish: Array<() => void>; paused?: () => void };
const fixtureGlobal = globalThis as typeof globalThis & {
  __reportHooks?: ReturnType<typeof hookRuntime>;
  __reportPdf?: PdfState;
  __reportLoadTaxRuntime?: () => Promise<TaxRuntime>;
};
async function awaitPdfPaused(pdf: PdfState, operation: Promise<void>, expected = 1) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("PDF renderer did not reach its paused boundary within 5 seconds")), 5_000);
        pdf.paused = () => { if (pdf.finish.length >= expected) resolve(); };
        pdf.paused();
      }),
      operation.then(() => { throw new Error("PDF operation completed before reaching its paused boundary"); }),
    ]);
  } catch (error) {
    // Fence late side effects before releasing any held work on a failed setup.
    fixtureGlobal.__reportHooks?.unmount();
    pdf.hold = false;
    for (const finish of pdf.finish.splice(0)) finish();
    let cleanupTimeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([operation.catch(() => undefined), new Promise<void>(resolve => { cleanupTimeout = setTimeout(resolve, 1_000); })]);
    clearTimeout(cleanupTimeout);
    throw error;
  } finally {
    clearTimeout(timeout);
    delete pdf.paused;
  }
}
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
  entryPoints: ["app/CaseReportDialog.tsx", "app/CaseMarkdownDialog.tsx", "app/StudioReportHistory.tsx"], outdir: ".artifacts/report-receipt-dialog/bundles", bundle: true, write: false,
  format: "esm", platform: "node", packages: "external", jsx: "automatic", loader: { ".css": "empty", ".module.css": "empty" },
  plugins: [{ name: "report-dialog-contract-runtime", setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "contract" }));
    builder.onResolve({ filter: /^\.\/case-report$/ }, args => args.importer.endsWith("CaseReportDialog.tsx") ? { path: "report", namespace: "contract" } : undefined);
    builder.onResolve({ filter: /^pdfmake\/build\/pdfmake\.js$/ }, () => ({ path: "pdf", namespace: "contract" }));
    builder.onResolve({ filter: /^pdfmake\/build\/vfs_fonts\.js$/ }, () => ({ path: "fonts", namespace: "contract" }));
    builder.onResolve({ filter: /tax-runtime\/browser$/ }, () => ({ path: "tax-runtime", namespace: "contract" }));
    builder.onLoad({ filter: /.*/, namespace: "contract" }, args => ({
      resolveDir: process.cwd(), loader: "js",
      contents: args.path === "hooks"
        ? ["useState", "useRef", "useMemo", "useEffect", "useLayoutEffect"].map(name => `export const ${name} = (...args) => globalThis.__reportHooks.${name}(...args);`).join("\n")
        : args.path === "report"
          ? `import * as actual from './app/case-report.ts'; export * from './app/case-report.ts'; export async function downloadCaseReport(...args) { const receipt = await actual.downloadCaseReport(...args); globalThis.__reportPdf.receipts.push(receipt); return receipt; }`
          : args.path === "fonts" ? "export default {};"
            : args.path === "tax-runtime" ? "export const loadBrowserTaxRuntime=()=>globalThis.__reportLoadTaxRuntime();"
            : `import { EventEmitter } from 'node:events'; export default { addVirtualFileSystem() {}, createPdf() { const state = globalThis.__reportPdf; if(state.fail) throw new Error('Controlled PDF failure'); return { getStream() { const stream = new EventEmitter(); stream.end = () => { const finish = () => { stream.emit('data', Buffer.from('%PDF-modeled-renderer')); stream.emit('end'); }; if(state.hold) { state.finish.push(finish); state.paused?.(); } else queueMicrotask(finish); }; return stream; } }; } };`,
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
const historyComponentFile = resolve(".artifacts/report-receipt-dialog/history.mjs");
writeFileSync(historyComponentFile, bundle.outputFiles.find(file => file.path.endsWith("StudioReportHistory.js"))!.text);
const HistoryParent = (await import(pathToFileURL(historyComponentFile).href)).default;

test("account export history clears immediately on identity loss and ignores late previous-account pages", async () => {
  const oldFetch = globalThis.fetch;
  fixtureGlobal.__reportHooks = hookRuntime();
  const pending: Array<(response: Response) => void> = [];
  globalThis.fetch = async () => new Promise<Response>(resolve => pending.push(resolve));
  const draft = buildCanopyPackage("base").draft;
  let props = { customCaseId: 27, scope: "a".repeat(64), authorityEpoch: 1, allowed: true, draft, profileId: "synthetic", binding: null, recorded: null, locale: "en" };
  const record = (id: number, version: string) => ({ id, recordedAt: "2026-09-27T00:00:00.000Z", event: "client_report_download_started", format: { presentationMode: "decision", includeDecisionTree: false }, receipt: {
    receiptSchemaVersion: 2, caseId: "synthetic_case", caseVersion: version, profileId: "synthetic", rendererVersion: "1.0.0", generatedAt: "2026-09-27T00:00:00.000Z", status: "draft", audience: "internal",
    caseFingerprint: "sha256-" + "a".repeat(64), reportFingerprint: "sha256-" + "b".repeat(64), layoutSchemaVersion: 1, layoutAlgorithmVersion: "1", layoutRendererVersion: "1", layoutFingerprint: "sha256-" + "c".repeat(64), presentationFingerprint: "sha256-" + "d".repeat(64),
  } });
  const render = () => { const hooks = fixtureGlobal.__reportHooks!; hooks.begin(); const tree = HistoryParent(props); hooks.flush(); return tree; };
  try {
    render(); assert.equal(pending.length, 1);
    props = { ...props, scope: "b".repeat(64), authorityEpoch: 2 }; let tree = render();
    assert.equal(pending.length, 2); assert.doesNotMatch(text(tree), /v1\.0\.0/);
    pending[1](Response.json({ receipts: [record(22, "2.0.0")], nextCursor: null }));
    await new Promise(resolve => setTimeout(resolve, 5)); tree = render(); assert.match(text(tree), /v2\.0\.0/);
    pending[0](Response.json({ receipts: [record(21, "1.0.0")], nextCursor: null }));
    await new Promise(resolve => setTimeout(resolve, 5)); tree = render();
    assert.doesNotMatch(text(tree), /v1\.0\.0/); assert.match(text(tree), /v2\.0\.0/);
    props = { ...props, allowed: false, authorityEpoch: 3 }; assert.equal(render(), null);
    assert.equal(pending.length, 2, "no read without live output authority");
  } finally { fixtureGlobal.__reportHooks?.unmount(); delete fixtureGlobal.__reportHooks; globalThis.fetch = oldFetch; }
});

test("an older account-history retry cannot replace a newer export result", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldFetch = globalThis.fetch, oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  fixtureGlobal.__reportHooks = hookRuntime();
  const pdf = fixtureGlobal.__reportPdf = { receipts: [], fail: false, hold: false, finish: [] } as PdfState;
  const pending: Array<{ body: { receipt: ReportReceiptV2 }; resolve: (value: Response) => void }> = [];
  globalThis.fetch = async (_url, init) => new Promise<Response>(resolve => pending.push({ body: JSON.parse(String(init?.body)), resolve }));
  URL.createObjectURL = () => "blob:synthetic-history"; URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem() { return null; }, removeItem() {} }, setTimeout() { return 1; }, clearTimeout() {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: null, addEventListener() {}, removeEventListener() {}, body: { appendChild() {} }, createElement() { return { remove() {}, click() {} }; } } });
  const draft = buildCanopyPackage("base").draft;
  const fp = caseFingerprint(draft), publication = casePublicationFingerprint(draft);
  const props = { locale: "en", draft, customCaseId: 27, currentFingerprint: fp, workspaceFingerprint: fp, currentPublicationFingerprint: publication, workspacePublicationFingerprint: publication,
    privateCase: false, canGenerateReport: true, reportReceiptStorageScope: "a".repeat(64), persistReportReceiptOnDevice: false,
    verifyReportAuthority: async () => () => true, close() {}, completed() {} };
  const render = () => {
    const hooks = fixtureGlobal.__reportHooks!; let tree: unknown, attempts = 0;
    do { hooks.begin(); tree = Parent(props); assert.ok(++attempts < 10); } while (hooks.needsRender());
    hooks.flush(); return tree;
  };
  const waitFor = async (count: number) => { for (let index = 0; pending.length < count && index < 500; index++) await new Promise(resolve => setTimeout(resolve, 2)); assert.equal(pending.length, count); };
  try {
    let tree = render();
    const first = click(tree, "Download PDF"); await waitFor(1);
    pending[0].resolve(new Response("unavailable", { status: 503 })); await first; tree = render();
    assert.match(text(tree), /account history was not confirmed/);
    await click(tree, "Retry recording receipt"); await waitFor(2);
    // The user can start another download while this manual recording retry waits.
    tree = render();
    const second = click(tree, "Download PDF"); await waitFor(3);
    pending[2].resolve(new Response("unavailable", { status: 503 })); await second; tree = render();
    const oldReceipt = pending[1].body.receipt;
    pending[1].resolve(Response.json({ record: { id: 21, recordedAt: new Date().toISOString(), event: "client_report_download_started", receipt: oldReceipt, format: { presentationMode: "decision", includeDecisionTree: false } }, alreadyRecorded: true }));
    await new Promise(resolve => setTimeout(resolve, 5)); tree = render();
    assert.equal(pdf.receipts.length, 2);
    assert.match(text(tree), /account history was not confirmed/);
    assert.doesNotMatch(text(tree), /Export receipt recorded in your account/);
    // Retry B, with a response for A: a different receipt must not be accepted.
    await click(tree, "Retry recording receipt"); await waitFor(4);
    const currentReceipt = pending[3].body.receipt;
    pending[3].resolve(Response.json({ record: { id: 22, recordedAt: new Date().toISOString(), event: "client_report_download_started", receipt: { ...currentReceipt, generatedAt: "2026-09-01T00:00:00.000Z" }, format: { presentationMode: "decision", includeDecisionTree: false } }, alreadyRecorded: false }));
    await new Promise(resolve => setTimeout(resolve, 5)); tree = render();
    assert.match(text(tree), /account history was not confirmed/);
    assert.equal(pdf.receipts.length, 2, "recording retries never create another PDF");
    await click(tree, "Retry recording receipt"); await waitFor(5);
    pending[4].resolve(Response.json({ record: { id: 23, recordedAt: new Date().toISOString(), event: "client_report_download_started", receipt: pending[4].body.receipt, format: { presentationMode: "decision", includeDecisionTree: false } }, alreadyRecorded: false }));
    await new Promise(resolve => setTimeout(resolve, 5)); tree = render();
    assert.match(text(tree), /Export receipt recorded in your account/);
    assert.equal(pdf.receipts.length, 2);
  } finally {
    fixtureGlobal.__reportHooks?.unmount(); delete fixtureGlobal.__reportHooks; delete fixtureGlobal.__reportPdf;
    globalThis.fetch = oldFetch; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});

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

test("a stored receipt is a collapsed device record and disappears synchronously across account or eligibility changes", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const draft = buildCanopyPackage("base").draft, scope = "a".repeat(64), profile = primaryCaseOutput(draft.caseType).id;
  const receipt = { caseId: draft.caseId, caseVersion: draft.version, profileId: profile, rendererVersion: "1.0.0", generatedAt: "2026-09-27T10:11:12.000Z", status: "draft", audience: "internal", caseFingerprint: caseFingerprint(draft), reportFingerprint: "sha256-" + "c".repeat(64) };
  const key = reportReceiptStorageKey(scope, draft.caseId, profile);
  const timers = new Map<number, () => void>(); let sequence = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem(candidate: string) { return candidate === key ? JSON.stringify(receipt) : null; }, removeItem() {} },
    setTimeout(callback: () => void) { timers.set(++sequence, callback); return sequence; }, clearTimeout(id: number) { timers.delete(id); },
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: null, addEventListener() {}, removeEventListener() {} } });
  fixtureGlobal.__reportHooks = hookRuntime();
  let props = { locale: "en", draft, currentFingerprint: caseFingerprint(draft), workspaceFingerprint: null,
    currentPublicationFingerprint: casePublicationFingerprint(draft), workspacePublicationFingerprint: null,
    privateCase: false, canGenerateReport: true, reportReceiptStorageScope: scope, persistReportReceiptOnDevice: true, close() {}, completed() {} };
  const render = () => {
    const hooks = fixtureGlobal.__reportHooks!; let tree: unknown, attempts = 0;
    do { hooks.begin(); tree = Parent(props); assert.ok(++attempts < 10); } while (hooks.needsRender());
    hooks.flush(); return tree;
  };
  try {
    let tree = render();
    const disclosure = elements(tree).find(element => element.type === "details" && text(element).includes("Latest receipt stored on this device"));
    assert.ok(disclosure); assert.notEqual(disclosure.props.open, true);
    assert.ok(text(disclosure).includes(receipt.generatedAt)); assert.match(text(disclosure), /not a complete export history/);
    props = { ...props, reportReceiptStorageScope: "b".repeat(64) }; tree = render();
    assert.ok(!text(tree).includes(receipt.generatedAt), "do not expose the old account record while its replacement read waits");
    for (const callback of timers.values()) callback(); timers.clear(); tree = render();
    assert.ok(!text(tree).includes(receipt.generatedAt));
    props = { ...props, reportReceiptStorageScope: scope }; tree = render();
    for (const callback of timers.values()) callback(); timers.clear(); tree = render();
    assert.ok(text(tree).includes(receipt.generatedAt));
    props = { ...props, persistReportReceiptOnDevice: false }; tree = render();
    assert.ok(!text(tree).includes(receipt.generatedAt), "privacy policy removal hides a stored receipt before the cleanup timer");
  } finally {
    fixtureGlobal.__reportHooks!.unmount(); delete fixtureGlobal.__reportHooks;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});

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
    assert.match(text(tree), /PDF generated · download started/);
    assert.match(text(tree), /matches the current case and report settings/);
    const receiptDisclosure = elements(tree).find(element => element.type === "details" && text(element.props.children).includes("Receipt details and storage"));
    assert.ok(receiptDisclosure);
    assert.notEqual(receiptDisclosure.props.open, true, "technical receipt fields start collapsed");
    assert.match(text(receiptDisclosure), /does not confirm that the file was saved by you or independently approved/);
    assert.ok(text(tree).includes(pdf.receipts[0].reportFingerprint));
    await click(tree, "Download receipt JSON");
    assert.equal(downloads.length, 2);
    assert.equal(downloads[0].blob.type, "application/pdf");
    assert.equal(downloads[1].blob.type, "application/json");
    assert.deepEqual(JSON.parse(await downloads[1].blob.text()), pdf.receipts[0], "export exactly the returned receipt, without fake PDF hash/output IDs");
    assert.deepEqual(storageWrites, [], "private sealed receipts must remain outside browser storage");

    const treeSwitch = elements(tree).find(element => element.type === "input" && element.props.role === "switch");
    assert.ok(treeSwitch); assert.equal(treeSwitch.props.checked, false, "decision tree defaults OFF");
    (elements(tree).find(element => element.type === "input" && element.props.type === "radio" && element.props.value === "full")!.props.onChange as () => void)();
    tree = render();
    const fullTreeSwitch = elements(tree).find(element => element.type === "input" && element.props.role === "switch")!;
    assert.equal(fullTreeSwitch.props.checked, true, "choosing Full from Base initializes tree ON");
    (fullTreeSwitch.props.onChange as (event: unknown) => void)({ target: { checked: false } });
    tree = render();
    assert.equal(elements(tree).find(element => element.type === "input" && element.props.role === "switch")?.props.checked, false);
    assert.ok(elements(tree).some(element => element.type === "input" && element.props.type === "radio" && element.props.value === "full" && element.props.checked), "turning the tree OFF preserves Full analysis");
    assert.match(text(tree), /OFF omits both; selected case sections and available calculations remain in Full analysis/);
    assert.doesNotMatch(text(tree), /Full records and calculations remain included with either setting/);
    (elements(tree).find(element => element.type === "input" && element.props.type === "radio" && element.props.value === "decision")!.props.onChange as () => void)();
    tree = render();
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
    assert.equal(elements(tree).find(element => element.type === "input" && element.props.role === "switch")?.props.checked, true, "choosing Full from Medium initializes tree ON");
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

    const declaration = () => elements(tree).find(element => element.type === "label" && text(element.props.children).includes("I confirm reviewer approval"))!;
    const declarationInput = () => elements(declaration()).find(element => element.type === "input")!;
    (declarationInput().props.onChange as (event: unknown) => void)({ target: { checked: true } });
    tree = render();
    assert.equal(declarationInput().props.checked, true);
    assert.match(text(tree), /Exact version saved to workspace/);
    assert.doesNotMatch(text(tree), /Workspace-saved reviewed version|Approved final|Report gate ready/);
    const originalProps = props;
    const changedDraft = { ...draft, title: draft.title + " — changed after review" };
    props = { ...props, draft: changedDraft, currentFingerprint: caseFingerprint(changedDraft), currentPublicationFingerprint: casePublicationFingerprint(changedDraft), workspaceFingerprint: caseFingerprint(changedDraft), workspacePublicationFingerprint: casePublicationFingerprint(changedDraft) };
    tree = render();
    assert.equal(declarationInput().props.checked, false, "a newly saved changed version cannot inherit the reviewer declaration");
    assert.match(text(tree), /earlier PDF download/);
    props = originalProps; tree = render();
    assert.equal(declarationInput().props.checked, false, "returning to an earlier draft does not revive its cleared declaration");

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
    const downloadsBeforeInputChange = downloads.length;
    const pending = click(tree, "Download PDF");
    await awaitPdfPaused(pdf, pending);
    assert.equal(pdf.finish.length, 1);
    tree = render();
    const changedAgain = elements(tree).find(element => element.type === "input" && element.props.placeholder === "Name / firm")!;
    (changedAgain.props.onChange as (event: unknown) => void)({ target: { value: "Typed while PDF was generating" } });
    tree = render();
    pdf.finish.shift()!(); await pending;
    tree = render();
    assert.equal(pdf.receipts.length, 1, "changed input cannot issue a late receipt");
    assert.equal(downloads.length, downloadsBeforeInputChange, "changed input cannot start a late file download");
    assert.match(text(tree), /earlier PDF download/);
    pdf.hold = false;
    await click(tree, "Download PDF"); tree = render();
    assert.equal(pdf.receipts.length, 2);
    assert.notEqual(pdf.receipts[1].presentationFingerprint, pdf.receipts[0].presentationFingerprint);
    assert.match(text(tree), /matches the current case and report settings/, "explicit retry uses current settings");
    await click(tree, "Download receipt JSON");
    assert.deepEqual(JSON.parse(await downloads.at(-1)!.blob.text()), pdf.receipts[1]);

    pdf.hold = true;
    const pendingAcrossScope = click(tree, "Download PDF");
    await awaitPdfPaused(pdf, pendingAcrossScope);
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
    await awaitPdfPaused(pdf, pendingPreview);
    assert.equal(pdf.finish.length, 1);
    props = { ...props, reportReceiptStorageScope: "d".repeat(64) };
    tree = render(); tree = render(); // Apply the new scope's reset before its own operation.
    const newScopePdf = click(tree, "Download PDF");
    await awaitPdfPaused(pdf, newScopePdf, 2);
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
    await awaitPdfPaused(pdf, pendingRevoked);
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
    await awaitPdfPaused(pdf, pendingUnmounted);
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
    // Real authority work can outlast any fixed number of event-loop turns.
    await new Promise(resolve => setTimeout(resolve, 50));
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
    pdf.hold = true; const pending = click(tree, "Download PDF"); await awaitPdfPaused(pdf, pending);
    assert.equal(pdf.finish.length, 1);
    signedIn = false; pdf.finish.shift()!(); await pending; tree = render();
    assert.deepEqual({ downloads: downloads.length, receipts: pdf.receipts.length, completed }, before);
    assert.deepEqual(storageWrites, []);

    signedIn = true; await authority.refresh(true, 1); tree = render();
    const pendingBoundary = click(tree, "Download PDF"); await awaitPdfPaused(pdf, pendingBoundary);
    assert.equal(pdf.finish.length, 1);
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

// The tax cases use the real report parent, async output helper, Rust execution
// and v3 identity/storage policy. As above, DOM/hooks and PDF byte rendering are
// controlled seams, not browser-layout or PDF-render acceptance.
async function taxDialogFixture(retained?: string) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const values = new Map<string, string>(), writes: string[] = [], blobs = new Map<string, Blob>();
  const downloads: Array<{ name: string; blob: Blob }> = [], commands: Array<{ command: string; response: string }> = [];
  let sequence = 0, completed = 0, revalidated = 0;
  const source = await reportFixture();
  const scope = "a".repeat(64), key = taxReportReceiptStorageKey(scope, source.draft.caseId, "tax_position_memorandum");
  if (retained !== undefined) values.set(key, retained);
  fixtureGlobal.__reportHooks = hookRuntime();
  const pdf: PdfState = fixtureGlobal.__reportPdf = { receipts: [], fail: false, hold: false, finish: [] };
  let held: (() => void) | undefined, reached: (() => void) | undefined;
  const nextRuntime = { hold: false };
  fixtureGlobal.__reportLoadTaxRuntime = async () => {
    if (nextRuntime.hold) { nextRuntime.hold = false; await new Promise<void>(resolve => { held = resolve; reached?.(); }); }
    const runtime = await loadNodeTaxRuntime();
    return { ...runtime, execute(command: string) { const response = runtime.execute(command); if (JSON.parse(command).command === "tax_web_calculate") commands.push({ command, response }); return response; } };
  };
  URL.createObjectURL = blob => { const url = `blob:tax-${++sequence}`; blobs.set(url, blob as Blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem(key: string) { return values.get(key) ?? null; }, setItem(key: string, value: string) { writes.push(key); values.set(key, value); }, removeItem() { throw new Error("No receipt may be deleted"); } },
    setTimeout() { return 1; }, clearTimeout() {},
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    activeElement: null, addEventListener() {}, removeEventListener() {}, body: { appendChild() {} },
    createElement() { return { href: "", download: "", remove() {}, click(this: { href: string; download: string }) { downloads.push({ name: this.download, blob: blobs.get(this.href)! }); } }; },
  } });
  let props = { locale: "en", draft: source.draft, currentFingerprint: caseFingerprint(source.draft), workspaceFingerprint: caseFingerprint(source.draft),
    currentPublicationFingerprint: casePublicationFingerprint(source.draft), workspacePublicationFingerprint: casePublicationFingerprint(source.draft),
    privateCase: false, canGenerateReport: true, reportAuthorityEpoch: 1, reportReceiptStorageScope: scope, persistReportReceiptOnDevice: true,
    verifyReportAuthority: async () => { revalidated++; return () => true; }, close() {}, completed() { completed++; } };
  const render = () => {
    const hooks = fixtureGlobal.__reportHooks!; let tree: unknown, attempts = 0;
    do { hooks.begin(); tree = Parent(props); hooks.flush(); assert.ok(++attempts < 15, "tax dialog must settle"); } while (hooks.needsRender());
    return tree;
  };
  return {
    source, key, values, writes, downloads, commands, blobs, pdf, nextRuntime, render,
    get props() { return props; }, set props(value) { props = value; },
    get completed() { return completed; }, get revalidated() { return revalidated; },
    async paused(operation: Promise<void>) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([new Promise<void>((resolve, reject) => { timeout = setTimeout(() => reject(new Error("Rust load did not reach held boundary")), 5_000); reached = resolve; if (held) resolve(); }), operation.then(() => { throw new Error("Output completed before held Rust boundary"); })]); }
      finally { clearTimeout(timeout); reached = undefined; }
    },
    release() { const resume = held; held = undefined; assert.ok(resume, "runtime is actually held"); resume(); },
    cleanup() {
      fixtureGlobal.__reportHooks?.unmount(); held?.(); for (const finish of pdf.finish.splice(0)) finish();
      delete fixtureGlobal.__reportHooks; delete fixtureGlobal.__reportPdf; delete fixtureGlobal.__reportLoadTaxRuntime;
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
      if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
      if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
    },
  };
}

test("actual tax dialog freshly previews/downloads v3, compares current inputs and preserves future device bytes", async () => {
  const future = '\uFEFF {"receiptSchemaVersion":99,"amount":18446744073709551617,"rate":1.2300e+0}\r\n';
  const fixture = await taxDialogFixture(future);
  try {
    let tree = fixture.render();
    await click(tree, "Preview PDF"); tree = fixture.render();
    assert.equal(fixture.commands.length, 1); assert.equal(fixture.downloads.length, 0); assert.equal(fixture.completed, 0);
    assert.ok(elements(tree).some(element => element.type === "iframe")); assert.deepEqual(fixture.writes, []);
    await click(tree, "Download PDF"); tree = fixture.render();
    assert.equal(fixture.commands.length, 2, "download recalculates independently of preview");
    assert.equal(fixture.downloads.length, 1); assert.match(fixture.downloads[0].name, /\.pdf$/); assert.equal(fixture.completed, 1);
    assert.equal(fixture.values.get(fixture.key), future); assert.deepEqual(fixture.writes, []);
    assert.match(text(tree), /matches the current case and report settings/);
    await click(tree, "Download receipt JSON"); tree = fixture.render();
    const parsed = parseTaxReportReceipt(await fixture.downloads.at(-1)!.blob.text()); assert.equal(parsed.status, "known");
    assert.equal(parsed.receipt.receiptSchemaVersion, 3);
    const native = JSON.parse(fixture.commands[1].response);
    assert.equal(parsed.receipt.tax.inputHash, native.draft.input_hash); assert.equal(parsed.receipt.tax.bindingHash, native.draft.binding_hash);
    assert.equal(fixture.commands.length, 2, "receipt export must not pretend to calculate again");
    const changed = structuredClone(fixture.source.draft), document = structuredClone(fixture.source.document);
    document.edit.implementation_cost = "12345.67"; attach(changed, document);
    fixture.props = { ...fixture.props, draft: changed, currentFingerprint: caseFingerprint(changed), workspaceFingerprint: caseFingerprint(changed), currentPublicationFingerprint: casePublicationFingerprint(changed), workspacePublicationFingerprint: casePublicationFingerprint(changed) };
    tree = fixture.render();
    assert.ok(!elements(tree).some(element => element.type === "iframe")); assert.match(text(tree), /earlier PDF download/);
    await click(tree, "Download PDF"); tree = fixture.render(); await click(tree, "Download receipt JSON");
    const second = parseTaxReportReceipt(await fixture.downloads.at(-1)!.blob.text()); assert.equal(second.status, "known");
    assert.equal(fixture.commands.length, 3); assert.notEqual(second.receipt.tax.inputHash, parsed.receipt.tax.inputHash);
    assert.notEqual(second.receipt.tax.evidenceFingerprint, parsed.receipt.tax.evidenceFingerprint);
    assert.equal(fixture.values.get(fixture.key), future); assert.deepEqual(fixture.writes, []); assert.ok(fixture.revalidated >= 8);
  } finally { fixture.cleanup(); }
});

test("actual tax dialog fences edits, account changes and unmount across held Rust/PDF work", async () => {
  for (const boundary of ["rust", "pdf"] as const) for (const change of ["edit", "account", "unmount"] as const) {
    const fixture = await taxDialogFixture();
    try {
      let tree = fixture.render();
      fixture.nextRuntime.hold = boundary === "rust"; fixture.pdf.hold = boundary === "pdf";
      const pending = click(tree, "Download PDF");
      if (boundary === "rust") await fixture.paused(pending); else await awaitPdfPaused(fixture.pdf, pending);
      const before = { downloads: fixture.downloads.length, writes: fixture.writes.length, completed: fixture.completed, urls: fixture.blobs.size };
      if (change === "edit") {
        (elements(tree).find(element => element.type === "input" && element.props.placeholder === "Name / firm")!.props.onChange as (event: unknown) => void)({ target: { value: "Changed during work" } });
        tree = fixture.render();
      } else if (change === "account") { fixture.props = { ...fixture.props, reportReceiptStorageScope: "b".repeat(64), reportAuthorityEpoch: 2 }; tree = fixture.render(); }
      else fixtureGlobal.__reportHooks!.unmount();
      if (boundary === "rust") fixture.release(); else fixture.pdf.finish.shift()!();
      await pending;
      assert.deepEqual({ downloads: fixture.downloads.length, writes: fixture.writes.length, completed: fixture.completed, urls: fixture.blobs.size }, before, `${boundary}/${change} must not issue old output`);
      if (change !== "unmount") { tree = fixture.render(); assert.equal(button(tree, "Download PDF").props.disabled, false, "new input context is not left busy"); assert.doesNotMatch(text(tree), /Download receipt JSON/); }
    } finally { fixture.cleanup(); }
  }
});

test("actual tax download persists v3 only against its pre-render device generation", async () => {
  const fixture = await taxDialogFixture();
  try {
    let tree = fixture.render(); await click(tree, "Download PDF"); tree = fixture.render();
    assert.deepEqual(fixture.writes, [fixture.key]);
    const saved = parseTaxReportReceipt(fixture.values.get(fixture.key)!); assert.equal(saved.status, "known");
    fixture.pdf.hold = true;
    const pending = click(tree, "Download PDF"); await awaitPdfPaused(fixture.pdf, pending);
    const changed = '\uFEFF {"receiptSchemaVersion":99,"newer":18446744073709551617}\r\n';
    fixture.values.set(fixture.key, changed);
    fixture.pdf.finish.shift()!(); await pending; tree = fixture.render();
    assert.equal(fixture.downloads.length, 2, "current authorized output still starts");
    assert.equal(fixture.completed, 2); assert.equal(fixture.commands.length, 2);
    assert.equal(fixture.values.get(fixture.key), changed, "pending output cannot replace the later device generation");
    assert.deepEqual(fixture.writes, [fixture.key]); assert.match(text(tree), /matches the current case and report settings/);
  } finally { fixture.cleanup(); }
});
