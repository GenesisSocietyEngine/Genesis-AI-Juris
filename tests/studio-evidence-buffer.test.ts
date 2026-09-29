import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { build } from "esbuild";
import ts from "typescript";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { emptyStudioEvidenceInput, hasStudioEvidenceInput, type StudioEvidenceBuffers, type StudioEvidenceInput } from "../app/studio-evidence-buffer";
import type { StudioDraft, StudioNodeType } from "../app/types";

const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["replaceStudioDraft", "clearStudioEvidenceBuffers", "changeStudioEvidenceInput", "clearStudioEvidenceType", "addConnectedItem"];
const handlers = new Map<string, string>();
let discardReconciliation = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) handlers.set(node.name.text, node.getText(source));
  if (ts.isIfStatement(node) && node.expression.getText(source) === "studioSession.discardVersion !== studioDiscardVersion.current") discardReconciliation = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.equal(handlers.size, names.length); assert.ok(discardReconciliation, "exercise the actual parent authority-discard branch");
const bundle = await build({ stdin: { loader: "tsx", resolveDir: resolve("app"), contents: `
import {StudioEvidenceComposer} from './StudioActionPanel';
import {emptyStudioTimeline} from './studio-revisions';
import {hasStudioEvidenceInput,updateStudioEvidenceInput,clearStudioEvidenceInput} from './studio-evidence-buffer';
import {appendConnectedStudioItem} from './studio-action-editing';
import {shouldDiscardStudioDraft} from './studio-session-authority';
export {StudioEvidenceComposer};
export function owner(original,confirm,context={customCaseId:null,isPrivate:false}) {
  const state={draft:original,buffers:{},revision:0,timeline:null,selected:null,notice:'',purges:0,prompt:'Retained input'};
  const studioEvidenceBuffersRef={current:state.buffers},studioChangedBeforeRestoreRef={current:false};
  const locale='en',window={confirm};
  const setStudioEvidenceBuffers=value=>state.buffers=value;
  const setStudioOpenRevision=fn=>state.revision=fn(state.revision);
  const syncStudioDraft=value=>state.draft=value;
  const syncStudioTimeline=value=>state.timeline=value;
  ${handlers.get("replaceStudioDraft")}
  ${handlers.get("clearStudioEvidenceBuffers")}
  ${handlers.get("changeStudioEvidenceInput")}
  ${handlers.get("clearStudioEvidenceType")}
  // Execute the production discard decision; model the existing purge callback
  // as an observed boundary and reuse its actual buffer-clear helper.
  const studioDiscardVersion={current:0},savedCaseRequestRef={current:0},restoredSavedCaseRef={current:null};
  const privatePlayOrigin=null,studioCustomCaseId=context.customCaseId,studioPrivate=context.isPrivate;
  const setPrompt=value=>state.prompt=value,setFeedbackTarget=()=>{},setSessionNotice=value=>state.notice=value;
  function purgeLocalStudioState(){state.purges++;clearStudioEvidenceBuffers();}
  function reconcile(studioSession){${discardReconciliation}}
  function save(value,canDuplicate=true) {
    const draft=state.draft;
    const applyCaseChange=(_label,next)=>state.draft=next;
    const onEvidenceClear=clearStudioEvidenceType;
    const selectNode=value=>state.selected=value;
    const returnToActions=value=>state.notice=value;
    ${handlers.get("addConnectedItem")}
    addConnectedItem(value);
  }
  return {state,change:changeStudioEvidenceInput,clear:clearStudioEvidenceType,replace:replaceStudioDraft,purge:clearStudioEvidenceBuffers,save,reconcile};
}
` }, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic" });
type Owner = {
  state: { draft: StudioDraft; buffers: StudioEvidenceBuffers; revision: number; timeline: unknown; selected: string | null; notice: string; purges: number; prompt: string };
  change: (type: StudioNodeType, patch: Partial<StudioEvidenceInput>) => void;
  clear: (type: StudioNodeType) => void;
  replace: (draft: StudioDraft) => boolean;
  purge: () => void;
  save: (value: StudioEvidenceInput & { type: StudioNodeType }, canDuplicate?: boolean) => void;
  reconcile: (session: { discardVersion: number; discardLocal: boolean }) => void;
};
type Props = { draft: StudioDraft; type: StudioNodeType; locale: "en" | "ru"; canEdit: boolean; value: StudioEvidenceInput; onChange: (patch: Partial<StudioEvidenceInput>) => void; onClear: () => void; onSave: (value: StudioEvidenceInput & { type: StudioNodeType }) => void };
const loaded = { exports: {} as { owner: (draft: StudioDraft, confirm: (message: string) => boolean, context?: { customCaseId: number | null; isPrivate: boolean }) => Owner; StudioEvidenceComposer: (props: Props) => ReactElement } };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const actual = loaded.exports;
function elements(value: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children as ReactNode)];
}
function form(owner: Owner, type: StudioNodeType = "evidence") {
  return elements(actual.StudioEvidenceComposer({ draft: owner.state.draft, type, locale: "en", canEdit: true,
    value: owner.state.buffers[type] ?? emptyStudioEvidenceInput(), onChange: patch => owner.change(type, patch), onClear: () => owner.clear(type), onSave: value => owner.save(value) }));
}

test("controlled composer recovers title, explanation and selection after remount and keeps different item types separate", () => {
  const owner = actual.owner(buildCanopyPackage("base").draft, () => false);
  for (const [field, value] of Object.entries({ title: "Synthetic retained item", detail: "Synthetic source and explanation", relatedId: "opening" })) {
    const control = form(owner).find(element => element.props.name === field)!;
    (control.props.onChange as (event: unknown) => void)({ target: { value } });
  }
  owner.change("fact", { title: "A separate fact buffer" });
  const reopened = form(owner); // A fresh component instance after leaving/reentering Sources.
  assert.equal(reopened.find(element => element.props.name === "title")?.props.value, "Synthetic retained item");
  assert.equal(reopened.find(element => element.props.name === "detail")?.props.value, "Synthetic source and explanation");
  assert.equal(reopened.find(element => element.props.name === "relatedId")?.props.value, "opening");
  assert.equal(form(owner, "fact").find(element => element.props.name === "title")?.props.value, "A separate fact buffer");
  assert.equal(owner.state.draft.nodes.length, 14, "typing must not prematurely add an evidence record");
});

test("actual parent replacement cancellation preserves working input and graph, explicit replacement and purge clear memory", () => {
  let approved = false, prompts = 0;
  const original = buildCanopyPackage("base").draft, replacement = buildCanopyPackage("upside").draft;
  const owner = actual.owner(original, message => { prompts++; assert.match(message, /unadded working items/); return approved; });
  owner.change("evidence", { title: "Keep this unadded source" });
  const before = structuredClone(owner.state);
  assert.equal(owner.replace(replacement), false);assert.deepEqual(owner.state, before);
  approved = true;assert.equal(owner.replace(replacement), true);
  assert.equal(owner.state.draft, replacement);assert.equal(hasStudioEvidenceInput(owner.state.buffers), false);assert.equal(owner.state.revision, 1);assert.equal(prompts, 2);
  owner.change("evidence", { detail: "Clear on confirmed authority termination" });owner.purge();assert.deepEqual(owner.state.buffers, {});
});

test("failed additions retain input; a successful connected addition clears only the committed item type", () => {
  const owner = actual.owner(buildCanopyPackage("base").draft, () => false);
  const input = { title: "Synthetic item", detail: "Review this synthetic source", relatedId: "opening" };
  owner.change("evidence", input);owner.change("fact", { title: "Keep this other draft" });
  owner.save({ ...input, type: "evidence", relatedId: "missing" });assert.deepEqual(owner.state.buffers.evidence, input);
  owner.save({ ...input, type: "evidence" }, false);assert.deepEqual(owner.state.buffers.evidence, input);
  const component = form(owner), submit = component.find(element => element.type === "form")!;
  (submit.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  assert.equal(owner.state.draft.nodes.length, 15);assert.equal(owner.state.draft.nodes.at(-1)?.title, input.title);
  assert.equal(owner.state.buffers.evidence, undefined);assert.equal(owner.state.buffers.fact?.title, "Keep this other draft");
  assert.ok(owner.state.draft.links.some(link => link.from === owner.state.selected || link.to === owner.state.selected));
  assert.match(owner.state.notice, /working draft/);
});

test("a removed relation target is explicit and keeps the entered source text available", () => {
  const owner = actual.owner(buildCanopyPackage("base").draft, () => false);
  owner.change("evidence", { title: "Unadded evidence", detail: "Retained explanation", relatedId: "deleted-step" });
  const rendered = form(owner);
  assert.equal(rendered.find(element => element.props.name === "relatedId")?.props.value, "");
  assert.ok(rendered.some(element => element.props.role === "alert"));
  assert.equal(rendered.find(element => element.props.name === "detail")?.props.value, "Retained explanation");
});

test("actual authority reconciliation preserves unrelated local input but purges protected or account-changed buffers", () => {
  const draft = buildCanopyPackage("base").draft;
  const input = { title: "Unadded local evidence", detail: "Keep this synthetic source explanation", relatedId: "opening" };
  const local = actual.owner(draft, () => { throw new Error("session handling must not require confirmation"); });
  local.change("evidence", input);
  local.reconcile({ discardVersion: 1, discardLocal: false });
  assert.deepEqual(local.state.buffers.evidence, input, "another tab's logout must not clear an unrelated local composer");
  assert.equal(local.state.draft, draft);
  assert.equal(local.state.prompt, "Retained input");
  assert.equal(local.state.purges, 0);
  for (const context of [{ customCaseId: 12, isPrivate: false }, { customCaseId: null, isPrivate: true }]) {
    const protectedOwner = actual.owner(draft, () => false, context);
    protectedOwner.change("evidence", input);
    protectedOwner.reconcile({ discardVersion: 1, discardLocal: false });
    assert.deepEqual(protectedOwner.state.buffers, {});
    assert.equal(protectedOwner.state.purges, 1);
    assert.equal(protectedOwner.state.prompt, "");
  }
  local.reconcile({ discardVersion: 2, discardLocal: true });
  assert.deepEqual(local.state.buffers, {});
  assert.equal(local.state.purges, 1, "actual identity change retains the stricter local-data cleanup");
  assert.equal(local.state.prompt, "");
});
