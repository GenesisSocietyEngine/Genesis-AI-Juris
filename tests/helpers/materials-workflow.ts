import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { buildCanopyPackage } from '../../app/canopy-fixture';
import { casePublicationFingerprint } from '../../app/case-integrity';
import type { EvidenceAttachmentPlan } from '../../app/studio-evidence-attachment';
import type { StudioDraft } from '../../app/types';

export type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
export function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
export function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value && typeof value === 'object' && 'props' in value ? text((value as Element).props.children) : '';
}
export function button(tree: unknown, label: string) {
  const result = elements(tree).find(e => e.type === 'button' && String(e.props['aria-label'] ?? text(e)).includes(label));
  assert.ok(result, label); return result;
}
export function click(element: Element) {
  assert.notEqual(element.props.disabled, true, 'cannot activate a disabled control');
  (element.props.onClick as () => void)();
}
export function choose(tree: unknown, option: string) {
  const select = elements(tree).find(e => e.type === 'select' && elements(e).some(x => x.type === 'option' && x.props.value === option));
  assert.ok(select, option); assert.notEqual(select.props.disabled, true);
  (select.props.onChange as (event: unknown) => void)({ target: { value: option } });
}
export function selectEvidence(tree: unknown, title: string, checked = true) {
  const checkbox = elements(tree).find(e => e.type === 'input' && e.props.type === 'checkbox' && String(e.props['aria-label']).endsWith(title));
  assert.ok(checkbox, title); assert.notEqual(checkbox.props.disabled, true);
  (checkbox.props.onChange as (event: unknown) => void)({ target: { checked } });
}

function hooks() {
  const slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }> = [];
  let cursor = 0, effects: Array<() => void> = [];
  const next = () => slots[cursor++] ?? (slots[cursor - 1] = {});
  const changed = (a: unknown[] | undefined, b: unknown[]) => !a || a.length !== b.length || b.some((v, i) => !Object.is(v, a[i]));
  return {
    begin() { cursor = 0; effects = []; },
    flush() { effects.forEach(run => run()); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
    useState(initial: unknown) { const slot = next(); if (!('value' in slot)) slot.value = initial; return [slot.value, (v: unknown) => { slot.value = typeof v === 'function' ? v(slot.value) : v; }]; },
    useRef(initial: unknown) { const slot = next(); if (!('value' in slot)) slot.value = { current: initial }; return slot.value; },
    useMemo(run: () => unknown, deps: unknown[]) { const slot = next(); if (changed(slot.deps, deps)) { slot.value = run(); slot.deps = deps; } return slot.value; },
    useEffect(run: () => void | (() => void), deps: unknown[]) { const slot = next(); if (changed(slot.deps, deps)) effects.push(() => { slot.cleanup?.(); slot.deps = deps; slot.cleanup = run() || undefined; }); },
  };
}
const globals = globalThis as typeof globalThis & { __materialsWorkflow?: ReturnType<typeof hooks>; __materialsDownloads?: Array<{ blob: Blob; filename: string }> };
const sourceRef = process.env.CASEVANT_MATERIALS_TEST_SOURCE_REF;
if (sourceRef) assert.match(sourceRef, /^[a-f0-9]{40}$/);
const entry = sourceRef ? { stdin: { contents: execFileSync('git', ['show', sourceRef + ':app/StudioMaterialsWorkspace.tsx'], { encoding: 'utf8' }), sourcefile: 'app/StudioMaterialsWorkspace.tsx', resolveDir: resolve('app'), loader: 'tsx' as const } } : { entryPoints: ['app/StudioMaterialsWorkspace.tsx'] };
const bundled = await build({
  ...entry, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic',
  loader: { '.css': 'empty', '.module.css': 'empty' },
  plugins: [{ name: 'materials-workflow-hooks', setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'workflow' }));
    b.onResolve({ filter: /^\.\/report-download$/ }, () => ({ path: 'download', namespace: 'workflow' }));
    b.onLoad({ filter: /.*/, namespace: 'workflow' }, args => ({ loader: 'js', contents: args.path === 'download' ? 'export function startReportDownload(blob,filename){globalThis.__materialsDownloads.push({blob,filename});}' : ['useState', 'useRef', 'useMemo', 'useEffect', 'useLayoutEffect'].map(name => `export const ${name}=(...args)=>globalThis.__materialsWorkflow.${name === 'useLayoutEffect' ? 'useEffect' : name}(...args);`).join('\n') }));
  } }],
});
mkdirSync('.artifacts/materials-workflow', { recursive: true });
const path = resolve('.artifacts/materials-workflow', `component-${sourceRef ?? 'current'}-${process.pid}.mjs`); writeFileSync(path, bundled.outputFiles[0].text);
const Component = (await import(pathToFileURL(path).href)).default as (props: Record<string, unknown>) => Element;

/** Actual materials component/projection/evidence handler; modeled hooks and authority. No DOM/browser/API/storage. */
export function fixture(locale: 'en' | 'ru' = 'en', options: { plan?: EvidenceAttachmentPlan; onPlanCancel?: () => void } = {}) {
  const runtime = hooks(); globals.__materialsWorkflow = runtime;
  const downloads: Array<{ blob: Blob; filename: string }> = []; globals.__materialsDownloads = downloads;
  let draft = structuredClone(buildCanopyPackage('base').draft), nodeId: string | undefined = 'conditional-pilot';
  let language = locale, allowed = true, epoch = 0, gate: Promise<void> | undefined, calls = 0;
  const writes: StudioDraft[] = [], focuses: string[] = [];
  const evidence = draft.nodes.find(n => n.type === 'evidence')!;
  evidence.title = 'QA synthetic evidence A';
  draft.nodes.push({ ...evidence, id: 'qa_evidence_b', title: 'QA synthetic evidence B', detail: 'Unreviewed synthetic second record — café.' });
  draft.links = [
    { id: 'qa_a', from: evidence.id, to: 'conditional-pilot', rule: { detail: 'Preserve complete carrier', cost: 42, guards: [], effects: { exposure: 1 } } },
    { id: 'qa_b', from: 'qa_evidence_b', to: 'conditional-pilot' },
  ];
  const original = JSON.stringify(draft), evidenceIds = [evidence.id, 'qa_evidence_b'];
  const render = () => {
    runtime.begin();
    const tree = Component({ draft, locale: language, nodeId, attachmentPlan: options.plan, onPlanCancel: options.onPlanCancel, authority: { allowed, epoch, verify: async () => { calls++; await gate; return () => allowed; } }, onNode: (id: string) => { nodeId = id; }, onApply: (expected: string, next: StudioDraft) => {
      if (!allowed || casePublicationFingerprint(draft) !== expected) return false;
      writes.push(next); draft = next; return true;
    } });
    const ref = tree.props.ref as { current: unknown } | undefined; if (ref) ref.current = { querySelectorAll: () => [], querySelector: () => ({ focus: () => focuses.push('search'), scrollIntoView: () => focuses.push('search-scroll') }) };
    runtime.flush(); return tree;
  };
  return {
    render, writes, original, evidenceIds, downloads, focuses,
    get draft() { return draft; }, get verificationCalls() { return calls; },
    hold() { let release!: () => void; gate = new Promise<void>(done => { release = done; }); return release; },
    node(id?: string) { nodeId = id; }, language(value: 'en' | 'ru') { language = value; },
    permission(value: boolean) { allowed = value; epoch++; }, replace(value = structuredClone(draft)) { draft = value; },
    async settle(predicate: (tree: Element) => boolean = tree => !text(tree).includes('Loading materials…') && !text(tree).includes('Загрузка материалов…')) {
      for (let i = 0; i < 500; i++) { const tree = render(); if (predicate(tree)) return tree; await new Promise(done => setTimeout(done, 10)); }
      throw Error('Materials did not settle');
    },
    unmount() { runtime.unmount(); },
    close() { runtime.unmount(); delete globals.__materialsWorkflow; delete globals.__materialsDownloads; },
  };
}
