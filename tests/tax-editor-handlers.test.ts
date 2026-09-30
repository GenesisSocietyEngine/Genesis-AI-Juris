import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import ts from "typescript";
import { createWebTaxRepository } from "../app/tax-runtime/web-repository";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { createTaxReportExecution } from "../app/tax-report-execution";
import { taxDocumentFromPreparation, taxEditorAttachment } from "../app/tax-editor-model";
import type { StudioDraft } from "../app/types";

// Execute the actual component operation and committed layout fence. Controlled
// runtime completion isolates late adoption; this is not a React/browser claim.
const source = ts.createSourceFile("TaxAnalysisEditor.tsx", readFileSync("app/TaxAnalysisEditor.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let operation = "", layout = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "operate") operation = node.getText(source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useLayoutEffect" && node.arguments[0]?.getText(source).includes("live.current")) layout = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(operation); assert.ok(layout);
const bundle = await build({ stdin: { loader: "ts", resolveDir: resolve("app"), contents: `
import {readTaxAttachment} from './tax-authoring';
import {createTaxEditorAttempts,taxDocumentFromPreparation,taxDocumentFromLegacy,nextTaxRevision,rebindTaxDocument} from './tax-editor-model';
import {deriveWebTaxSource} from './studio-tax-source';
export function harness(repository,execution,initial) {
 const attempts={current:createTaxEditorAttempts()},live={current:initial};
 const state={adoptions:[],results:[],notices:[],pending:false};
 const setPending=v=>state.pending=v,setNotice=v=>state.notices.push(v),setCalculation=v=>{if(v)state.results.push(v);};
 let cleanup=()=>{};
 function commit(props){cleanup();const {draft,disabled,authorityKey}=props;const pending=false,read=readTaxAttachment(draft.taxAnalysis),document=read.status==='known'?read.view:null;
  const t=en=>en,currency='EUR',legacyRaw='',legacySchema='web_amounts_v1',importBlocksCalculation=false;
  const onChange=(expected,document)=>state.adoptions.push({expected,document});
  cleanup=(${layout})();
  ${operation}
  return operate;
 }
 return {state,commit,unmount:()=>cleanup()};
}` }, bundle: true, platform: "node", format: "esm", write: false });
mkdirSync(".artifacts/tax-editor-handlers", { recursive: true });
const output = resolve(".artifacts/tax-editor-handlers/actual.mjs"); writeFileSync(output, bundle.outputFiles[0].text);
const actual = await import(pathToFileURL(output).href);
const fixture = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-source.json", "utf8")).draft as StudioDraft;
const repository = createWebTaxRepository(loadNodeTaxRuntime), executor = createTaxReportExecution(loadNodeTaxRuntime);
function held() { let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); return { wait, release }; }

test("actual preparation refuses late adoption after edited draft, changed account/access or unmount", async () => {
  for (const boundary of ["draft", "authority", "disabled", "unmount"] as const) {
    const hold = held(), props = { draft: structuredClone(fixture), authorityKey: "account-a", disabled: false };
    const delayed = { ...repository, prepare: async (...args: Parameters<typeof repository.prepare>) => { await hold.wait; return repository.prepare(...args); } };
    const h = actual.harness(delayed, executor, props), run = h.commit(props), pending = run("prepare");
    if (boundary === "unmount") h.unmount();
    else h.commit({ ...props, ...(boundary === "draft" ? { draft: { ...props.draft, title: "Later edit" } } : boundary === "authority" ? { authorityKey: "account-b" } : { disabled: true }) });
    hold.release(); await pending;
    assert.equal(h.state.adoptions.length, 0, boundary);
    assert.equal(h.state.results.length, 0, boundary);
  }
});

test("actual calculation adopts a live fresh result and rejects held success/error after context leaves", async () => {
  const document = taxDocumentFromPreparation(await repository.prepare(fixture, { artifact_id: "handler", revision: "0", currency: "EUR" }));
  const draft = { ...fixture, taxAnalysis: taxEditorAttachment(document) }, props = { draft, authorityKey: "account-a", disabled: false };
  const live = actual.harness(repository, executor, props); await live.commit(props)("calculate");
  assert.equal(live.state.results.length, 1); assert.equal(live.state.results[0].outcome.status, "ready");
  for (const fail of [false, true]) {
    const hold = held();
    const delayed = { calculate: async (input: StudioDraft) => { await hold.wait; if (fail) throw new Error("late runtime failure"); return executor.calculate(input); } };
    const h = actual.harness(repository, delayed, props), pending = h.commit(props)("calculate");
    h.unmount(); hold.release(); await pending;
    assert.equal(h.state.results.length, 0);
    assert.deepEqual(h.state.notices, [""], "late error not adopted after leaving");
  }
});
