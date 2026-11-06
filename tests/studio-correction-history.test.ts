import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createOverviewActionReturnMemory } from "../app/studio-overview-return";
import { createMaterialReadingMemory } from "../app/studio-material-search";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { parseStudioWorkflowStep, serializedStudioWorkflowStep } from "../app/studio-workflow";

// Execute the actual application handlers, including their shared calls.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["restoreGuidedStepFromHistory", "selectGuidedStep", "openWorkbench", "openOverview", "openStudioAction", "openOverviewAction", "openOverviewNode", "returnToActions", "undoStudioEdit", "redoStudioEdit", "timelineShortcut"];
const handlers = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) handlers.set(node.name.text, node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source); assert.equal(handlers.size, names.length);
const compiled = ts.transpileModule([...handlers.values()].join("\n") + "\nreturn {" + names.join(",") + "};", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(options: { pending?: boolean; empty?: boolean } = {}) {
  let href = "https://synthetic.invalid/studio?custom_case=48&lang=en&studio_step=run_compare";
  const input = { title: "QA synthetic retained evidence", detail: "Unadded input", relatedId: "source-node" };
  const state = { target: { step: 3, id: "studio-evidence-composer", nodeType: "evidence" } as null | Record<string, unknown>, notice: "Temporary action notice", step: 3, overview: false, selected: "source-node", presentation: "list", zoom: 0.5, mode: "user", input, draft: buildCanopyPackage("base").draft, undo: [{ id: "earlier-revision" }], pushes: [] as string[], travels: [] as string[] };
  const workbench = { selected: true, editorOpened: false };
  const checks = [{ id: "orphan", level: "warn" }, { id: "route", level: "warn" }];
  let memory = createMaterialReadingMemory({draft:state.draft,locale:"en",epoch:1,allowed:true});
  const originContext = { caseId: state.draft.caseId, version: state.draft.version, sourceKey: "synthetic-source", storedCaseId: 48, scope: "synthetic-account", locale: "en", epoch: 1, allowed: true };
  let origin = createOverviewActionReturnMemory(originContext);
  class Element { isContentEditable = false; }
  class Input extends Element {}
  class Textarea extends Element {}
  class Select extends Element {}
  const forbidden = () => { throw Error("Navigation must not mutate draft/input/history or persist"); };
  const scope = {
    overviewActionReturn: { clear: () => origin.clear(), remember: () => origin.remember(), active: () => origin.active(), take: () => origin.take(), requestFocus: () => origin.requestFocus() },
    materialReadingMemory: { rememberReview: (id?: string | null) => memory.rememberReview(id), reviewFinding: () => memory.reviewFinding() }, checks,
    URL, parseStudioWorkflowStep, serializedStudioWorkflowStep, restorePending: options.pending ?? false, guidedDraftIsEmpty: options.empty ?? false,
    window: { location: { get href() { return href; } }, history: { state: { retained: true }, pushState(_state: unknown, _title: string, url: URL) { href = url.href; state.pushes.push(href); } } },
    setGuidedStep: (value: number) => { state.step = value; },
    setWorkbenchSelected: (value: boolean) => { workbench.selected = value; },
    setEditorOpened: (value: boolean) => { workbench.editorOpened = value; },
    setOverviewSelected: (value: boolean) => { state.overview = value; },
    setActionTarget: (value: null | Record<string, unknown>) => { state.target = value; },
    setActionNotice: (value: string) => { state.notice = value; },
    setGraphPresentation: (value: string) => { state.presentation = value; },
    setGraphZoom: (value: number) => { state.zoom = value; },
    selectNode: (value: string) => { state.selected = value; },
    selectGraphNode: (value: string) => { state.selected = value; },
    changeDisplayMode: (value: string) => { state.mode = value; },
    clearStudioEvidenceBuffers: forbidden, onEvidenceClear: forbidden, applyCaseChange: forbidden, setDraft: forbidden, saveDraft: forbidden,
    undoDraft: () => state.travels.push("undo"), redoDraft: () => state.travels.push("redo"),
    HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLSelectElement: Select,
  };
  const actions = new Function(...Object.keys(scope), compiled)(...Object.values(scope)) as {
    openWorkbench: () => void; restoreGuidedStepFromHistory: () => void; selectGuidedStep: (step: number) => void; openOverview: () => void;
    openStudioAction: (target: Record<string, unknown>) => void; openOverviewAction: (target: Record<string, unknown>) => void; openOverviewNode: (nodeId: string, overviewOrigin?: boolean) => void; returnToActions: (message?: string) => void;
    undoStudioEdit: () => void; redoStudioEdit: () => void; timelineShortcut: (event: Record<string, unknown>) => void;
  };
  return { state, workbench, actions, checks, currentReview: () => memory.reviewFinding(), overviewOrigin: () => origin.active(), overviewFocus: () => origin.focusRequested(), replaceContext: (change: object) => { memory = createMaterialReadingMemory({draft:state.draft,locale:"en",epoch:1,allowed:true,...change}); origin = createOverviewActionReturnMemory({...originContext,...change}); }, inputElement: new Input(), navigate: (step: string) => { href = "https://synthetic.invalid/studio?custom_case=48&lang=en&studio_step=" + step; } };
}

test("browser history leaves the correction normally and preserves unadded input, records and Undo", () => {
  const { state, actions, navigate } = harness();
  const retained = { input: state.input, draft: state.draft, undo: state.undo, selected: state.selected };
  const before = JSON.stringify(retained);
  actions.restoreGuidedStepFromHistory();
  assert.equal(state.step, 5); assert.equal(state.target, null); assert.equal(state.notice, "");
  navigate("facts_assumptions"); actions.restoreGuidedStepFromHistory();
  assert.equal(state.step, 3); assert.equal(state.target, null, "Forward opens normal Sources; a new action explicitly resumes its buffer");
  assert.deepEqual({ input: state.input, draft: state.draft, undo: state.undo, selected: state.selected }, retained);
  assert.equal(JSON.stringify({ input: state.input, draft: state.draft, undo: state.undo, selected: state.selected }), before);
  assert.equal(state.input, retained.input); assert.equal(state.undo, retained.undo);
  assert.equal(state.pushes.length, 0, "restoring history must not create another history entry");
});

test("ordinary section and Overview navigation clear stale action notices and targets", () => {
  for (const overview of [false, true]) {
    const { state, actions } = harness();
    if (overview) actions.openOverview(); else actions.selectGuidedStep(4);
    assert.equal(state.target, null); assert.equal(state.notice, "");
    assert.equal(state.overview, overview); assert.equal(state.pushes.length, 1);
    assert.equal(state.input.detail, "Unadded input");
    assert.equal(state.selected, "source-node"); assert.equal(state.zoom, 0.5);
  }
});

test("Workbench entry clears only navigation targets and preserves the exact current work", () => {
  const { state, workbench, actions } = harness();
  const retained = JSON.stringify({ input: state.input, draft: state.draft, undo: state.undo, selected: state.selected });
  actions.openWorkbench();
  assert.equal(workbench.selected, true); assert.equal(workbench.editorOpened, true);
  assert.equal(state.overview, false); assert.equal(state.target, null); assert.equal(state.notice, "");
  assert.equal(state.pushes.length, 1);
  const destination = new URL(state.pushes[0]);
  assert.equal(destination.searchParams.get("studio_panel"), "workbench");
  assert.equal(destination.searchParams.get("custom_case"), "48");
  assert.equal(JSON.stringify({ input: state.input, draft: state.draft, undo: state.undo, selected: state.selected }), retained);
  actions.selectGuidedStep(3);
  assert.equal(workbench.selected, false);
  actions.openOverview();
  assert.equal(workbench.selected, false);
});

test("explicit correction and Return still install their exact target after section cleanup", () => {
  const { state, actions } = harness();
  const target = { step: 4, id: "studio-node-existing", nodeId: "existing" };
  actions.openStudioAction(target);
  assert.equal(state.target, target); assert.equal(state.step, 4); assert.equal(state.presentation, "detail"); assert.equal(state.selected, "existing");
  actions.returnToActions("Item added; save when ready.");
  assert.deepEqual(state.target, { step: 5, id: "studio-next-actions" }); assert.equal(state.step, 5);
  assert.equal(state.notice, "Item added; save when ready.");
  assert.equal(state.input.title, "QA synthetic retained evidence");
});

test("pending restore and unrecognized history do not cancel the current correction; empty case routes to brief", () => {
  const pending = harness({ pending: true }); pending.actions.restoreGuidedStepFromHistory();
  assert.equal(pending.state.target?.id, "studio-evidence-composer"); assert.equal(pending.state.notice, "Temporary action notice");
  const invalid = harness(); invalid.navigate("unknown_stage"); invalid.actions.restoreGuidedStepFromHistory();
  assert.equal(invalid.state.target?.id, "studio-evidence-composer");
  const empty = harness({ empty: true }); empty.actions.restoreGuidedStepFromHistory();
  assert.equal(empty.state.step, 1); assert.equal(empty.state.target, null);
});

test("button and keyboard Undo/Redo clear obsolete completion feedback and delegate exactly once", () => {
  const { state, actions, inputElement } = harness();
  actions.undoStudioEdit(); assert.equal(state.notice, "");
  state.notice = "Item added"; actions.redoStudioEdit(); assert.equal(state.notice, "");
  let prevented = 0;
  const event = { ctrlKey: true, key: "z", shiftKey: false, target: null, preventDefault: () => { prevented++; } };
  state.notice = "Item added"; actions.timelineShortcut(event); assert.equal(state.notice, "");
  state.notice = "Item added"; actions.timelineShortcut({ ...event, shiftKey: true }); assert.equal(state.notice, "");
  assert.deepEqual(state.travels, ["undo", "redo", "undo", "redo"]); assert.equal(prevented, 2);
  state.notice = "Retained notice"; actions.timelineShortcut({ ...event, target: inputElement });
  assert.equal(state.notice, "Retained notice", "native field Undo is left alone"); assert.equal(state.travels.length, 4);
  assert.equal(state.target?.id, "studio-evidence-composer"); assert.equal(state.input.detail, "Unadded input");
});


for (const checkId of ["orphan", "route"]) test(`actual Review → affected node → related evidence → exact ${checkId} finding preserves the complete case`, () => {
  const h = harness();
  const carrier = JSON.parse(readFileSync("tests/fixtures/fiveflats-rent-146000.studio-draft.json", "utf8"));
  h.state.draft.taxEconomics = carrier.taxEconomics;
  h.state.draft.taxAnalysis = {format:"genesis-juris-tax-attachment",carrierVersion:1,document:' {"exact":"retained historical approval bytes"} \r\n'};
  const before = JSON.stringify(h.state), originalDraft = h.state.draft, history = h.state.undo, input = h.state.input;
  const node = h.state.draft.nodes.find(node => node.type === "decision")!, evidence = h.state.draft.nodes.find(node => node.type === "evidence")!;
  h.actions.openStudioAction({step:4,id:`studio-node-${node.id}`,nodeId:node.id,reviewId:checkId});
  assert.equal(h.currentReview(),checkId);
  h.actions.openOverviewNode(evidence.id);
  assert.equal(h.currentReview(),checkId,"nested evidence inspection retains the originating Review finding");
  assert.equal(h.state.selected,evidence.id);
  h.actions.returnToActions();
  assert.deepEqual(h.state.target,{step:5,id:`action-${checkId}`});
  assert.equal(h.currentReview(),null,"the return is consumed, not sticky across subsequent navigation");
  assert.equal(h.state.draft,originalDraft);assert.equal(h.state.undo,history);assert.equal(h.state.input,input);
  assert.equal(JSON.stringify(h.state.draft),JSON.stringify(JSON.parse(before).draft));
  assert.equal(h.state.pushes.length,3,"three explicit navigation activations; this is not measured browser action timing");
});

test("cleared findings, ordinary sections and history never restore a stale Review target", () => {
  for (const leave of ["section","overview","history","resolved","unrecognized"] as const) {
    const h=harness();
    h.actions.openStudioAction({step:4,id:"studio-node-existing",nodeId:"existing",reviewId:"orphan"});
    if(leave==="section")h.actions.selectGuidedStep(3);
    if(leave==="overview")h.actions.openOverview();
    if(leave==="history")h.actions.restoreGuidedStepFromHistory();
    if(leave==="resolved")h.checks[0].level="ok";
    if(leave==="unrecognized")h.actions.openStudioAction({step:3,id:"studio-source-urls",reviewId:"not-a-current-finding"});
    h.actions.returnToActions();
    assert.deepEqual(h.state.target,{step:5,id:"studio-next-actions"},leave);
  }
});

test("changed draft/source/version, locale, authority epoch or denied access drops exact Review return", () => {
  for(const change of [{draft:{...buildCanopyPackage("base").draft,version:"99.0.0"}},{locale:"ru"},{epoch:2},{allowed:false}]) {
    const h=harness();h.actions.openStudioAction({step:4,id:"studio-node-existing",nodeId:"existing",reviewId:"route"});
    h.replaceContext(change);h.actions.returnToActions();
    assert.deepEqual(h.state.target,{step:5,id:"studio-next-actions"});assert.equal(h.currentReview(),null);
  }
});


test("Overview field corrections return to Overview once, preserving unadded input and history", () => {
  const h = harness(); const before = JSON.stringify({draft:h.state.draft,input:h.state.input,undo:h.state.undo});
  h.actions.openOverviewAction({step:3,id:"studio-publishable-context"});
  assert.equal(h.overviewOrigin(),true);assert.equal(h.currentReview(),null);
  h.actions.returnToActions("Synthetic edit retained");
  assert.equal(h.state.overview,true);assert.equal(h.state.target,null);assert.equal(h.overviewFocus(),true);
  assert.equal(h.overviewOrigin(),false);assert.match(h.state.pushes.at(-1)!,/studio_panel=overview/);
  assert.equal(h.state.notice,"Synthetic edit retained");
  assert.equal(JSON.stringify({draft:h.state.draft,input:h.state.input,undo:h.state.undo}),before);
  h.actions.selectGuidedStep(3);h.actions.returnToActions();
  assert.deepEqual(h.state.target,{step:5,id:"studio-next-actions"});assert.equal(h.overviewFocus(),false);
});

test("Overview node inspection preserves its origin through nested nodes without stealing Review finding identity", () => {
  const h=harness();h.actions.openOverviewNode("synthetic-node",true);
  h.actions.openOverviewNode("synthetic-evidence");assert.equal(h.overviewOrigin(),true);
  h.actions.returnToActions();assert.equal(h.state.overview,true);
  h.actions.openStudioAction({step:4,id:"studio-node-existing",nodeId:"existing",reviewId:"orphan"});
  assert.equal(h.overviewOrigin(),false);h.actions.returnToActions();
  assert.deepEqual(h.state.target,{step:5,id:"action-orphan"});
});

for(const leave of ["section","overview","history","context"] as const)test(`Overview return is discarded after ${leave} departure`,()=>{
  const h=harness();h.actions.openOverviewAction({step:3,id:"studio-title"});
  if(leave==="section")h.actions.selectGuidedStep(4);
  if(leave==="overview")h.actions.openOverview();
  if(leave==="history")h.actions.restoreGuidedStepFromHistory();
  if(leave==="context")h.replaceContext({epoch:2});
  h.actions.returnToActions();assert.deepEqual(h.state.target,{step:5,id:"studio-next-actions"});
});
