import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual component download handler. DOM/Blob delivery is modeled;
// this is not a browser download or a production owner-recovery observation.
const source = readFileSync(new URL("../app/StudioRecoveryView.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("StudioRecoveryView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "download") handler = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(handler, "Actual recovery download function must exist");
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const transport = readFileSync(new URL("../app/report-download.ts", import.meta.url), "utf8").replace("export function", "function");

test("actual owner recovery download retains UTF-8 bytes, large numbers, BOM, whitespace and CRLF exactly", async () => {
  const rawText = '\ufeff \t{"future":900719925474099312345,"label":"Учебный оригинал"}\r\n';
  const blobs: Blob[] = [], filenames: string[] = [], revoked: string[] = [];
  let release: (() => void) | undefined;
  let attached = 0, removed = 0;
  const link = { href: "", download: "", remove() { removed++; }, click() { filenames.push(this.download); } };
  const javascriptTransport = ts.transpileModule(transport, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = vm.runInNewContext(`${javascriptTransport}; ${handler}; download`, {
    recovery: { rawText, canExport: true, filename: "synthetic-owner-original.json" }, Blob,
    URL: { createObjectURL(blob: Blob) { blobs.push(blob); return "blob:synthetic-local-only"; }, revokeObjectURL(url: string) { revoked.push(url); } },
    document: { body: { appendChild() { attached++; } }, createElement(tag: string) { assert.equal(tag, "a"); return link; } },
    window: { setTimeout(fn: () => void, delay: number) { assert.equal(delay, 60_000); release = fn; } },
  });
  run(); assert.equal(blobs.length, 1); assert.deepEqual(filenames, ["synthetic-owner-original.json"]);
  assert.equal(blobs[0].type, "application/json;charset=utf-8");
  const actual = new Uint8Array(await blobs[0].arrayBuffer()), expected = new TextEncoder().encode(rawText);
  assert.deepEqual(actual, expected); assert.equal(hash(actual), hash(expected));
  assert.equal(attached, 1); assert.equal(removed, 1);
  assert.deepEqual(revoked, []); release!(); assert.deepEqual(revoked, ["blob:synthetic-local-only"]);
});

test("actual recovery download refuses unverified import or unavailable owner bytes without side effects", () => {
  for (const recovery of [{ canExport: false, rawText: "Retained but unverified" }, { canExport: true }, { canExport: false }]) {
    const fail = () => assert.fail("No download, timer, URL or DOM operation is allowed");
    const run = vm.runInNewContext(`${handler}; download`, { recovery, Blob: fail, URL: { createObjectURL: fail }, document: { createElement: fail }, window: { setTimeout: fail } });
    run();
  }
});
