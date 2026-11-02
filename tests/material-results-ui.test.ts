import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { buildConvertedExample } from "../app/converted-examples";
import type { StudioDraft } from "../app/types";
import { createMaterialReadingMemory, type MaterialReadingMemory } from "../app/studio-material-search";

// Real component, materials projection, archive and download helper. Hook/DOM
// scheduling is modeled: these assertions are not live browser/file acceptance.
type Element = {type: unknown; props: Record<string, unknown> & {children?: unknown}};
function hooks() {
  const slots: Array<{value?: unknown; deps?: unknown[]; cleanup?: () => void}> = [];
  let cursor = 0; let effects: Array<() => void> = [];
  const next = () => { const index = cursor++; return slots[index] ?? (slots[index] = {}); };
  const effect = (run: () => (() => void) | undefined, deps: unknown[]) => {
    const slot = next();
    if (!slot.deps || !deps.every((value, index) => Object.is(value, slot.deps![index]))) effects.push(() => {slot.cleanup?.(); slot.deps = deps; slot.cleanup = run();});
  };
  return {
    begin() {cursor = 0; effects = [];}, flush() {for (const run of effects) run();}, unmount() {slots.forEach(slot => slot.cleanup?.());},
    useState(initial: unknown) {const slot = next(); if (!("value" in slot)) slot.value = initial; return [slot.value, (value: unknown) => {slot.value = typeof value === "function" ? value(slot.value) : value;}];},
    useRef(initial: unknown) {const slot = next(); if (!("value" in slot)) slot.value = {current: initial}; return slot.value;},
    useMemo(compute: () => unknown, deps: unknown[]) {const slot = next(); if (!slot.deps || !deps.every((value,index) => Object.is(value,slot.deps![index]))) {slot.value=compute();slot.deps=deps;} return slot.value;},
    useEffect: effect, useLayoutEffect: effect,
  };
}
const globals = globalThis as typeof globalThis & {__materialsUi?: {hooks: ReturnType<typeof hooks>; failure: boolean; hold?: Promise<void>}};
const bundled = await build({entryPoints: ["app/StudioMaterialsWorkspace.tsx"], bundle: true, write: false, format: "esm", platform: "node", packages: "external", jsx: "automatic", loader: {".css": "empty", ".module.css": "empty"}, plugins: [{name: "materials-ui-contract", setup(builder) {
  builder.onResolve({filter: /^react$/}, () => ({path: "hooks", namespace: "contract"}));
  builder.onResolve({filter: /^\.\/studio-materials$/}, () => ({path: "materials", namespace: "contract"}));
  builder.onLoad({filter: /.*/, namespace: "contract"}, args => ({loader: "js", resolveDir: process.cwd(), contents: args.path === "hooks"
    ? ["useState", "useEffect", "useLayoutEffect", "useRef", "useMemo"].map(name => `export const ${name}=(...args)=>globalThis.__materialsUi.hooks.${name}(...args);`).join("\n")
    : `import * as actual from './app/studio-materials.ts'; export * from './app/studio-materials.ts'; export async function studioMaterials(...args){ const control=globalThis.__materialsUi; if(control.hold) await control.hold; if(control.failure)throw Error('Synthetic read failure'); return actual.studioMaterials(...args); }`,
  }));
}}]});
mkdirSync(".artifacts/material-results-ui", {recursive: true});
const filename = resolve(".artifacts/material-results-ui/component.mjs"); writeFileSync(filename, bundled.outputFiles[0].text);
const Component = (await import(pathToFileURL(filename).href)).default;
function elements(value: unknown): Element[] {if (Array.isArray(value)) return value.flatMap(elements); if (!value || typeof value !== "object" || !("props" in value)) return []; const element = value as Element; return [element, ...elements(element.props.children)];}
function text(value: unknown): string {if (Array.isArray(value)) return value.map(text).join(" "); if (typeof value === "string" || typeof value === "number") return String(value); return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";}
function control(tree: unknown, type: string, label: string) {const found = elements(tree).find(e => e.type === type && text(e) === label); assert.ok(found, `${type}: ${label}`); return found;}
const statuses = (tree: unknown) => elements(tree).filter(e => e.props.role === "status").map(text).join(" | ");
function fixture(locale: "en" | "ru", initial = buildCanopyPackage("base").draft, readingMemory?: MaterialReadingMemory) {
  const previous = {document: Object.getOwnPropertyDescriptor(globalThis, "document"), window: Object.getOwnPropertyDescriptor(globalThis, "window"), create: URL.createObjectURL, revoke: URL.revokeObjectURL};
  const runtime = {hooks: hooks(), failure: false, hold: undefined as Promise<void> | undefined}; globals.__materialsUi = runtime;
  let draft = initial, downloads = 0, allowed = true;
  URL.createObjectURL = () => "blob:synthetic-materials"; URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, "document", {configurable: true, value: {body: {appendChild() {}}, createElement: () => ({remove() {}, click() {downloads++;}})}});
  Object.defineProperty(globalThis, "window", {configurable: true, value: {setTimeout() {}, scrollY:420, scrollTo() {}}});
  const render = () => {runtime.hooks.begin(); const tree = Component({draft, locale, readingMemory, authority: {allowed, epoch: allowed ? 1 : 2, verify: async () => () => allowed}, onNode() {}}); runtime.hooks.flush(); return tree;};
  const settle = async (predicate: (tree: unknown) => boolean) => {for (let attempt = 0; attempt < 200; attempt++) {const tree = render(); if (predicate(tree)) return tree; await new Promise(resolve => setTimeout(resolve, 5));} throw Error("Component did not settle at expected boundary");};
  return {runtime, render, settle, replace(next: StudioDraft) {draft = next;}, deny() {allowed = false;}, get downloads() {return downloads;}, close() {
    runtime.hooks.unmount(); delete globals.__materialsUi; URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke;
    for (const name of ["document", "window"] as const) {const descriptor = previous[name]; if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);}
  }};
}

for (const locale of ["en", "ru"] as const) test(`${locale}: actual material counts remain visible through download, search and version filters`, async () => {
  const original = buildCanopyPackage("base").draft, before = JSON.stringify(original), f = fixture(locale, original);
  const count = (n: number) => locale === "en" ? `${n} matching materials` : `Материалов найдено: ${n}`;
  try {
    let tree = await f.settle(tree => statuses(tree).includes(count(10)));
    (control(tree, "button", locale === "en" ? "Download all (.zip)" : "Скачать всё (.zip)").props.onClick as () => void)();
    tree = await f.settle(tree => statuses(tree).includes(locale === "en" ? "Download prepared" : "Скачивание подготовлено"));
    assert.equal(f.downloads, 1); assert.ok(statuses(tree).includes(count(10)), "operation feedback must not replace result count");
    const search = elements(tree).find(e => e.type === "input" && e.props.type === "search")!;
    (search.props.onChange as (event: unknown) => void)({target: {value: "D05"}}); tree = f.render(); assert.ok(statuses(tree).includes(count(1)));
    (search.props.onChange as (event: unknown) => void)({target: {value: "no-synthetic-match"}}); tree = f.render(); assert.ok(statuses(tree).includes(count(0)));
    (search.props.onChange as (event: unknown) => void)({target: {value: ""}});
    const selector = elements(tree).find(e => e.type === "select")!;
    (selector.props.onChange as (event: unknown) => void)({target: {value: "reference"}}); tree = f.render(); assert.ok(statuses(tree).includes(count(9)));
    (elements(tree).find(e => e.type === "input" && e.props.type === "checkbox")!.props.onChange as (event: unknown) => void)({target: {checked: true}});
    tree = f.render(); assert.ok(statuses(tree).includes(count(15)));
    assert.match(statuses(tree), locale === "en" ? /Download prepared/ : /Скачивание подготовлено/);
    assert.equal(JSON.stringify(original), before);
  } finally {f.close();}
});

test("body-only results expose literal passage, exact section, reset and retained filter state", async () => {
  const draft=buildCanopyPackage('base').draft, memory=createMaterialReadingMemory({draft,locale:'en',epoch:1,allowed:true});
  let f=fixture('en',draft,memory);
  try {
    let tree=await f.settle(tree=>statuses(tree).includes('10 matching materials'));
    const search=elements(tree).find(e=>e.type==='input' && e.props.type==='search')!;
    (search.props.onChange as (event:unknown)=>void)({target:{value:'450 packs'}});
    tree=f.render(); assert.match(statuses(tree),/2 matching materials/);
    assert.match(text(tree),/Thresholds/);
    assert.ok(elements(tree).some(e=>e.type==='mark' && text(e)==='450 packs'));
    assert.ok(elements(tree).some(e=>e.type==='summary' && text(e).includes('Read matching passage')));
    const selector=elements(tree).find(e=>e.type==='select')!;
    (selector.props.onChange as (event:unknown)=>void)({target:{value:'reference'}});
    (elements(tree).find(e=>e.type==='input' && e.props.type==='checkbox')!.props.onChange as (event:unknown)=>void)({target:{checked:true}});
    tree=f.render();
    const linked=elements(tree).find(e=>e.type==='button' && typeof e.props['data-material-node']==='string')!;
    (linked.props.onClick as (event:unknown)=>void)({currentTarget:{getBoundingClientRect:()=>({top:160})}});
    assert.equal(memory.read()?.returnTo?.scrollY,420);
    assert.equal(memory.read()?.returnTo?.viewportTop,160);
    assert.equal(memory.read()?.query,'450 packs');
    f.close(); f=fixture('en',draft,memory);
    tree=await f.settle(tree=>statuses(tree).includes('2 matching materials'));
    assert.equal(elements(tree).find(e=>e.type==='input' && e.props.type==='search')?.props.value,'450 packs');
    assert.equal(elements(tree).find(e=>e.type==='select')?.props.value,'reference');
    assert.equal(elements(tree).find(e=>e.type==='input' && e.props.type==='checkbox')?.props.checked,true);
    (control(tree,'button','Reset filters').props.onClick as ()=>void)();
    tree=f.render(); assert.match(statuses(tree),/10 matching materials/);
    assert.equal(memory.read()?.query,'');
    assert.equal(JSON.stringify(draft),JSON.stringify(buildCanopyPackage('base').draft));
  } finally {f.close();}
});

test("material page depth survives a scoped remount while changed source/access clears search", async () => {
  const draft=buildCanopyPackage('base').draft, template=draft.nodes.find(node=>node.type==='evidence')!;
  draft.nodes.push(...Array.from({length:25},(_,index)=>({...template,id:`synthetic_page_${index}`,title:`QA ${index}`,detail:'Synthetic pagination needle'})));
  const memory=createMaterialReadingMemory({draft,locale:'en',epoch:1,allowed:true});let f=fixture('en',draft,memory);
  try {
    let tree=await f.settle(tree=>statuses(tree).includes('26 matching materials'));
    const search=elements(tree).find(e=>e.type==='input' && e.props.type==='search')!;
    (search.props.onChange as (event:unknown)=>void)({target:{value:'pagination needle'}}); tree=f.render();
    (control(tree,'button','Show 20 more').props.onClick as ()=>void)(); tree=f.render();
    assert.equal(elements(tree).filter(e=>e.type==='li').length,25); assert.equal(memory.read()?.limit,40);
    f.close();f=fixture('en',draft,memory);
    tree=await f.settle(tree=>statuses(tree).includes('25 matching materials'));
    assert.equal(elements(tree).filter(e=>e.type==='li').length,25);
    f.deny();tree=f.render();
    assert.equal(elements(tree).find(e=>e.type==='input' && e.props.type==='search')?.props.value,'');
    assert.equal(memory.read()?.query,'');
    f.replace({...draft,title:'Different exact source'}); tree=f.render();
    assert.match(statuses(tree),/Loading materials/);
  } finally {f.close();}
});

test("previous action notices cannot turn pending or failed material reads into false empty results", async () => {
  const f = fixture("en"); let release!: () => void;
  try {
    let tree = await f.settle(tree => statuses(tree).includes("10 matching materials"));
    (control(tree, "button", "Download all (.zip)").props.onClick as () => void)(); await f.settle(tree => statuses(tree).includes("Download prepared"));
    f.runtime.hold = new Promise<void>(resolve => {release = resolve;}); f.runtime.failure = true;
    f.replace({...buildCanopyPackage("base").draft, title: "Synthetic replacement read"});
    tree = f.render(); assert.match(statuses(tree), /Loading materials/); assert.doesNotMatch(text(tree), /No matching materials/);
    release(); tree = await f.settle(tree => statuses(tree).includes("Materials could not be read"));
    assert.doesNotMatch(statuses(tree), /0 matching|Download prepared/); assert.doesNotMatch(text(tree), /No matching materials/);
  } finally {release?.(); f.close();}
});

test("missing-original filter counts are actual records and never fabricate downloadable bodies", async () => {
  const f = fixture("en", buildConvertedExample("greenfire_first_72_hours", "en"));
  try {
    let tree = await f.settle(tree => statuses(tree).includes("24 matching materials"));
    (elements(tree).find(e => e.type === "select")!.props.onChange as (event: unknown) => void)({target: {value: "missing"}});
    tree = f.render(); assert.match(statuses(tree), /7 matching materials/);
    const rows = elements(tree).filter(e => e.type === "li"); assert.equal(rows.length, 7);
    rows.forEach(row => {assert.match(text(row), /Original body not supplied/); assert.ok(!elements(row).some(e => e.type === "button" && text(e) === "Download text"));});
    f.deny(); tree = f.render(); assert.equal(control(tree, "button", "Download all (.zip)").props.disabled, true); assert.equal(f.downloads, 0);
  } finally {f.close();}
});

test("compact inventory keeps status and downloads outside collapsed text-and-node disclosures", async () => {
  const draft=buildCanopyPackage('base').draft,before=JSON.stringify(draft),f=fixture('en',draft);
  try {
    const tree=await f.settle(tree=>statuses(tree).includes('10 matching materials'));
    const rows=elements(tree).filter(e=>e.type==='li' && typeof e.props['data-material-id']==='string');
    assert.equal(rows.length,10);
    for(const row of rows){
      const details=elements(row).filter(e=>e.type==='details');assert.equal(details.length,1);assert.notEqual(details[0].props.open,true);
      const summary=elements(details[0]).find(e=>e.type==='summary')!;
      assert.match(text(summary),/review is separate|Fictional reference/);
      assert.match(text(summary),/Read text/);assert.match(text(summary),/related nodes?/);
      assert.ok(elements(row).some(e=>e.type==='button' && text(e)==='Download text'));
      assert.ok(!elements(details[0]).some(e=>e.type==='button' && text(e)==='Download text'),'download is available without expanding');
      const hasLinks=elements(details[0]).some(e=>e.type==='button' && typeof e.props['data-material-node']==='string');
      if(text(summary).includes('0 related nodes')){assert.equal(hasLinks,false);assert.match(text(details[0]),/No related nodes recorded/);}else assert.ok(hasLinks);
    }
    assert.equal(JSON.stringify(draft),before);
  } finally {f.close();}
});
