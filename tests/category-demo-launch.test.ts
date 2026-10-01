import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { buildCategoryDemo } from "../app/category-demo-draft";
import type { StudioDraft } from "../app/types";

// Execute the real parent launch/replacement handlers, rather than duplicating their logic.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers: string[] = [];
function collect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && ["resetStudioDraft", "openCategoryDemo"].includes(node.name.text)) handlers.push(node.getText(source));
  ts.forEachChild(node, collect);
}
collect(source);
assert.equal(handlers.length, 2);
async function launch({ leave = true, confirm = true, enter = true, load = true } = {}) {
  const original = buildCategoryDemo("contract_review", "en");
  const state = { draft: original, prompts: [] as string[], destinations: [] as [string, number][], confirmations: [] as string[], replacements: 0, notices: [] as string[] };
  const code = ts.transpileModule(`${handlers.join("\n")}\nopenCategoryDemo("tax_planning");`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  await runInNewContext(code, {
    locale: "en", prompt: "Unapplied instruction", draftRef: { current: original }, starterCancelledRef: { current: false },
    loadCategoryDemo: async (...args: Parameters<typeof buildCategoryDemo>) => { if (!load) throw new Error("offline chunk"); return buildCategoryDemo(...args); },
    showSessionNotice: (message: string) => state.notices.push(message), mayLeaveStudio: () => leave,
    window: { confirm: (message: string) => { state.confirmations.push(message); return confirm; } },
    enterNewLocalDraft: (next: StudioDraft) => { if (!enter) return false; state.replacements++; state.draft = next; return true; },
    setPrompt: (value: string) => state.prompts.push(value),
    navigate: (destination: string, step: number) => state.destinations.push([destination, step]),
  });
  return { state, original };
}

test("cancelled example replacement preserves the actual graph, prompt and navigation", async () => {
  const { state, original } = await launch({ confirm: false });
  assert.equal(state.draft, original);
  assert.equal(state.replacements, 0);
  assert.deepEqual(state.prompts, []);
  assert.deepEqual(state.destinations, []);
  assert.match(state.confirmations[0], /Save your current draft first/);
});
test("a pending operation blocks example launch before replacement confirmation", async () => {
  const { state, original } = await launch({ leave: false });
  assert.equal(state.draft, original);
  assert.deepEqual(state.confirmations, []);
  assert.equal(state.replacements, 0);
});
test("confirmed example launch uses the existing isolated replacement path and opens Decision", async () => {
  const { state } = await launch();
  assert.equal(state.replacements, 1);
  assert.equal(state.draft.caseType?.id, "tax_planning");
  assert.deepEqual(state.prompts, [""]);
  assert.deepEqual(state.destinations, [["studio", 4]]);
});
test("a refused protected replacement cannot clear the prompt or navigate", async () => {
  const { state, original } = await launch({ enter: false });
  assert.equal(state.draft, original);
  assert.deepEqual(state.prompts, []);
  assert.deepEqual(state.destinations, []);
});

test("a failed deferred example load preserves the draft and offers a retry", async () => {
  const { state, original } = await launch({ load: false });
  assert.equal(state.draft, original);
  assert.equal(state.replacements, 0);
  assert.deepEqual(state.confirmations, []);
  assert.deepEqual(state.destinations, []);
  assert.match(state.notices[0], /could not load.*unchanged.*try again/);
});
