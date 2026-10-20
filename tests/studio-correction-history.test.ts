import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parseStudioWorkflowStep, serializedStudioWorkflowStep } from "../app/studio-workflow";

// Execute the actual application handlers, including their shared calls.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["restoreGuidedStepFromHistory", "selectGuidedStep", "openOverview", "openStudioAction", "returnToActions", "undoStudioEdit", "redoStudioEdit", "timelineShortcut"];
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
  const state = { target: { step: 3, id: "studio-evidence-composer", nodeType: "evidence" } as null | Record<string, unknown>, notice: "Temporary action notice", step: 3, overview: false, selected: "source-node", presentation: "list", zoom: 0.5, mode: "user", input, draft: { nodes: [{ id: "existing" }], links: [] }, undo: [{ id: "earlier-revision" }], pushes: [] as string[], travels: [] as string[] };
  class Element { isContentEditable = false; }
  class Input extends Element {}
  class Textarea extends Element {}
  class Select extends Element {}
  const forbidden = () => { throw Error("Navigation must not mutate draft/input/history or persist"); };
  const scope = {
    URL, parseStudioWorkflowStep, serializedStudioWorkflowStep, restorePending: options.pending ?? false, guidedDraftIsEmpty: options.empty ?? false,
    window: { location: { get href() { return href; } }, history: { state: { retained: true }, pushState(_state: unknown, _title: string, url: URL) { href = url.href; state.pushes.push(href); } } },
    setGuidedStep: (value: number) => { state.step = value; },
    setOverviewSelected: (value: boolean) => { state.overview = value; },
    setActionTarget: (value: null | Record<string, unknown>) => { state.target = value; },
    setActionNotice: (value: string) => { state.notice = value; },
    setGraphPresentation: (value: string) => { state.presentation = value; },
    setGraphZoom: (value: number) => { state.zoom = value; },
    selectNode: (value: string) => { state.selected = value; },
    changeDisplayMode: (value: string) => { state.mode = value; },
    clearStudioEvidenceBuffers: forbidden, onEvidenceClear: forbidden, applyCaseChange: forbidden, setDraft: forbidden, saveDraft: forbidden,
    undoDraft: () => state.travels.push("undo"), redoDraft: () => state.travels.push("redo"),
    HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLSelectElement: Select,
  };
  const actions = new Function(...Object.keys(scope), compiled)(...Object.values(scope)) as {
    restoreGuidedStepFromHistory: () => void; selectGuidedStep: (step: number) => void; openOverview: () => void;
    openStudioAction: (target: Record<string, unknown>) => void; returnToActions: (message?: string) => void;
    undoStudioEdit: () => void; redoStudioEdit: () => void; timelineShortcut: (event: Record<string, unknown>) => void;
  };
  return { state, actions, inputElement: new Input(), navigate: (step: string) => { href = "https://synthetic.invalid/studio?custom_case=48&lang=en&studio_step=" + step; } };
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
