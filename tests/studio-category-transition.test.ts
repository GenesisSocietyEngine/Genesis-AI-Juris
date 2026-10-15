import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { applyCaseType } from "../app/case-type-registry";
import { buildConvertedExample } from "../app/converted-examples";
import type { CaseTypeId, StudioDraft } from "../app/types";

const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler = "";
function collect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "changeCaseType") handler = node.getText(source);
  ts.forEachChild(node, collect);
}
collect(source);
assert.ok(handler, "exercise the actual Studio handler");
const code = ts.transpileModule(handler.replace('await import("./case-type-registry")', "await loadCaseTypeRegistry()") + "\nchangeCaseType;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(options: { allowed?: boolean; pending?: boolean; restoring?: boolean } = {}) {
  const original = buildConvertedExample("nl_food_safety_goldenshell_001", "en");
  const loads: Array<() => void> = [];
  const state = { draft: original, writes: 0, history: 0 };
  const context = {
    draft: original, locale: "en", canDuplicate: options.allowed !== false,
    reportAuthority: { allowed: options.allowed !== false }, restorePending: options.restoring ?? false,
    operationPending: { current: options.pending ?? false }, setRelationStatus: () => {},
    loadCaseTypeRegistry: () => new Promise(resolve => loads.push(() => resolve({ applyCaseType }))),
    applyCaseChange: (_label: string, update: (current: StudioDraft) => StudioDraft) => {
      const next = update(state.draft);
      if (next !== state.draft) { state.draft = next; state.writes++; state.history++; }
    },
  };
  const change = runInNewContext(code, context) as (id: CaseTypeId, apply: typeof applyCaseType) => void | Promise<void>;
  return { original, state, context, loads, change };
}

test("a category choice cannot finish later on a newly opened Desert case", async () => {
  const h = harness();
  const pending = h.change("compliance", applyCaseType);
  const desert = buildConvertedExample("us_environmental_desert_water_001", "en");
  h.state.draft = desert;
  const historyAtReplacement = h.state.history;
  h.loads.forEach(resolve => resolve());
  await pending;
  assert.equal(h.state.draft, desert, "late work must not alter the new source, carriers or identity");
  assert.equal(h.state.draft.caseType?.id, "litigation_strategy");
  assert.equal(h.state.history, historyAtReplacement, "no late edit-history entry belongs to the replacement");
});

test("rapid category choices retain the last visible choice even if module completions reverse", async () => {
  const h = harness();
  const first = h.change("compliance", applyCaseType);
  const second = h.change("litigation_strategy", applyCaseType);
  h.loads[1]?.(); await second;
  h.loads[0]?.(); await first;
  assert.equal(h.state.draft.caseType?.id, "litigation_strategy");
});

test("a completed category event has no deferred write after authority switches", async () => {
  const h = harness();
  const pending = h.change("litigation_strategy", applyCaseType);
  const beforeSwitch = JSON.stringify(h.state);
  h.context.reportAuthority.allowed = false;
  h.loads.forEach(resolve => resolve()); await pending;
  assert.equal(JSON.stringify(h.state), beforeSwitch);
});

for (const options of [{ allowed: false }, { pending: true }, { restoring: true }]) {
  test(`category input refuses unavailable context ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    const pending = h.change("litigation_strategy", applyCaseType);
    h.loads.forEach(resolve => resolve()); await pending;
    assert.equal(h.state.draft, h.original);
    assert.equal(h.state.writes, 0);
  });
}

test("ordinary category selection preserves exact records and source identity", async () => {
  const h = harness();
  const pending = h.change("investigation", applyCaseType);
  h.loads.forEach(resolve => resolve()); await pending;
  assert.equal(h.state.draft.caseType?.id, "investigation");
  assert.equal(h.state.draft.nodes, h.original.nodes);
  assert.equal(h.state.draft.links, h.original.links);
  assert.equal(h.state.draft.exampleSource, h.original.exampleSource);
  assert.equal(h.state.draft.caseId, h.original.caseId);
  assert.equal(h.loads.length, 0, "the visible selector's loaded function must not start a deferred mutation");
});

test("tax-specific records still block a non-tax category change", async () => {
  const h = harness();
  h.original.nodes.push({ ...h.original.nodes[0], id: "retained-tax-node", type: "cash_flow" });
  const original = JSON.stringify(h.original);
  const pending = h.change("litigation_strategy", applyCaseType);
  h.loads.forEach(resolve => resolve()); await pending;
  assert.equal(JSON.stringify(h.state.draft), original);
  assert.equal(h.state.writes, 0);
});
