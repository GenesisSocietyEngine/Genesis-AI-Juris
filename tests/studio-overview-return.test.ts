import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createOverviewActionReturnMemory } from "../app/studio-overview-return";
import { buildCanopyPackage } from "../app/canopy-fixture";

const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let factory = "";
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "overviewActionReturn") factory = node.initializer!.getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(factory);
const compiled = ts.transpileModule(`return ${factory};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test("actual Overview origin ownership survives ordinary edits but fences identity/source/account/language/access changes", () => {
  let prior: unknown[] | undefined, current: ReturnType<typeof createOverviewActionReturnMemory>;
  const useMemo = (fn: () => typeof current, deps: unknown[]) => {
    if (!prior || !deps.every((v, i) => Object.is(v, prior![i]))) { current = fn(); prior = deps; }
    return current;
  };
  const evaluate = new Function("useMemo", "createOverviewActionReturnMemory", "draft", "overviewSourceKey", "customCaseId", "reportReceiptStorageScope", "locale", "reportAuthority", "canDuplicate", "restorePending", compiled);
  const draft = buildCanopyPackage("base").draft;
  const before = JSON.stringify(draft);
  function make(next = draft, locale = "en", id: number | null = 48, scope = "synthetic-account-A", epoch = 1, allowed = true, editable = true, restoring = false) {
    return evaluate(useMemo, createOverviewActionReturnMemory, next, JSON.stringify(next.exampleSource ?? null), id, scope, locale, { epoch, allowed }, editable, restoring) as typeof current;
  }
  const origin = make(); origin.remember();
  assert.equal(make({ ...draft, premise: "Synthetic edited context", nodes: draft.nodes.map(n => ({ ...n, title: n.title + " synthetic edit" })) }), origin);
  assert.equal(origin.active(), true, "normal edits must not lose the Overview return");
  assert.equal(origin.take(), true); assert.equal(origin.take(), false, "return is consumed once");
  const changes: Parameters<typeof make>[] = [
    [{ ...draft, caseId: "another_synthetic_case" }], [{ ...draft, version: "99.0.0" }],
    [{ ...draft, exampleSource: { format: "casevant-example-source-v1", caseId: "synthetic_source", version: "1.0.0", fingerprint: "synthetic_changed_source" } }],
    [draft, "ru"], [draft, "en", 49], [draft, "en", 48, "synthetic-account-B"],
    [draft, "en", 48, "synthetic-account-A", 2], [draft, "en", 48, "synthetic-account-A", 1, false],
    [draft, "en", 48, "synthetic-account-A", 1, true, false], [draft, "en", 48, "synthetic-account-A", 1, true, true, true],
  ];
  for (const args of changes) {
    const first = make(); first.remember(); first.requestFocus();
    const changed = make(...args);
    assert.notEqual(changed, first); assert.equal(changed.active(), false); assert.equal(changed.focusRequested(), false);
    const returned = make(); assert.notEqual(returned, first); assert.equal(returned.active(), false, "A→B→A cannot resurrect an old origin");
  }
  assert.equal(JSON.stringify(draft), before);
});

test("denied Overview navigation memory cannot remember or request a return target", () => {
  const memory = createOverviewActionReturnMemory({ caseId: "synthetic", version: "1.0.0", sourceKey: "", storedCaseId: null, scope: null, locale: "en", epoch: 1, allowed: false });
  memory.remember(); memory.requestFocus();
  assert.equal(memory.active(), false); assert.equal(memory.focusRequested(), false); assert.equal(memory.take(), false);
});
