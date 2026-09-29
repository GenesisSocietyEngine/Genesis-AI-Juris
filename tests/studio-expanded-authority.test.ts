import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// Exercise the actual parent opening/render/invalidation code without bundling
// the unrelated Studio editor. Hooks retain state across adversarial renders.
const source = ts.createSourceFile("JurisApp.tsx", readFileSync("app/JurisApp.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let view: ts.FunctionDeclaration | undefined;
let open: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "StudioView") view = node;
  if (ts.isJsxAttribute(node) && node.name.getText(source) === "onClick" && node.initializer && ts.isJsxExpression(node.initializer)
    && node.initializer.expression?.getText(source).includes("setExpandedGraphOpening(expandedGraphContext)")) open = node.initializer.expression;
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(view?.body); assert.ok(open);
const statements = view.body.statements.filter(node => {
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.some(declaration => /^(expandedGraphContext|expandedGraphOpen|\[expandedGraphOpening, setExpandedGraphOpening\])$/.test(declaration.name.getText(source)));
  return ts.isIfStatement(node) && node.expression.getText(source).includes("expandedGraphOpening");
});
assert.equal(statements.length, 4);
const javascript = ts.transpileModule(`return function(context, useState) { const {reportAuthority,reportReceiptStorageScope,customCaseId,draft}=context;
${statements.map(node => node.getText(source)).join("\n")}
return {visible:expandedGraphOpen, open:${open.getText(source)}}; }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
type Context = { reportAuthority: { visible: boolean; allowed: boolean; epoch: number }; reportReceiptStorageScope: string | null; customCaseId: number | null; draft: { caseId: string; version: string; nodes: unknown[] } };
const actualRender = new Function(javascript)() as (context: Context, hook: (initial: null) => [string | null, (value: string | null) => void]) => { visible: boolean; open: () => void };

test("actual expanded opening cannot survive suspension or context replacement and permits inspection-only views", () => {
  let opening: string | null = null;
  const useState = (): [string | null, (value: string | null) => void] => [opening, value => { opening = value; }];
  const base: Context = { reportAuthority: { visible: true, allowed: false, epoch: 4 }, reportReceiptStorageScope: "actor-a", customCaseId: 1, draft: { caseId: "synthetic", version: "1.0.0", nodes: [{ title: "Unsaved unchanged text" }] } };
  const bytes = JSON.stringify(base.draft);
  const render = (context = base) => actualRender(context, useState);
  assert.equal(render().visible, false);
  render().open(); assert.equal(render().visible, true, "VIEW permits inspection without copying/export authority");
  assert.equal(render().visible, true, "unchanged same-context refresh preserves the deliberate opening");
  const suspended = { ...base, reportAuthority: { ...base.reportAuthority, visible: false } };
  assert.equal(render(suspended).visible, false);
  assert.equal(opening, null);
  render(suspended).open(); assert.equal(opening, null, "a stale control cannot open without visible authority");
  assert.equal(render().visible, false, "same-account recovery does not resurrect the map");
  for (const changed of [
    { ...base, reportAuthority: { ...base.reportAuthority, epoch: 5 } },
    { ...base, reportReceiptStorageScope: "actor-b" },
    { ...base, customCaseId: 2 },
    { ...base, draft: { ...base.draft, caseId: "another" } },
    { ...base, draft: { ...base.draft, version: "2.0.0" } },
  ]) {
    render().open(); assert.equal(render().visible, true);
    assert.equal(render(changed).visible, false); assert.equal(opening, null);
    assert.equal(render().visible, false, "return to old scope/case cannot restore an invalid opening");
  }
  render().open(); assert.equal(render().visible, true, "explicit reopening works");
  assert.equal(JSON.stringify(base.draft), bytes, "authority transitions preserve draft bytes");
});
