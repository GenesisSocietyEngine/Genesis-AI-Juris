import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Actual handlers and transport; modeled DOM delivery is not browser file proof.
function handler(file: string, name: string) {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(result, `Actual ${name} handler exists`);
  return result;
}
const transport = readFileSync(new URL("../app/report-download.ts", import.meta.url), "utf8").replace("export function", "function");
function fixture(file: string, name: string, extra: Record<string, unknown>, blocked = false) {
  const blobs = new Map<string, Blob>(), clicks: string[] = [], releases: Array<() => void> = [];
  let attached = 0, removed = 0;
  const link = { href: "", download: "", target: "", rel: "", remove() { removed++; }, click() { if (blocked) throw new Error("Synthetic browser handoff refusal"); clicks.push(this.download); } };
  const source = ts.transpileModule(`${transport}; ${handler(file, name)}; globalThis.run = ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ Blob, ...extra,
    URL: { createObjectURL(blob: Blob) { const id = `blob:synthetic-${blobs.size}`; blobs.set(id, blob); return id; }, revokeObjectURL(id: string) { blobs.delete(id); } },
    document: { createElement() { return link; }, body: { appendChild() { attached++; } } },
    window: { setTimeout(fn: () => void, delay: number) { assert.equal(delay, 60_000); releases.push(fn); } },
  });
  vm.runInContext(source, context);
  return { run: context.run as (...args: unknown[]) => Promise<void>, blobs, clicks, releases, link, counts: () => ({ attached, removed }) };
}

test("Markdown handoff retains exact canonical text until deferred browser delivery", async () => {
  const markdown = "# Учебный кейс\r\n\n<!-- canonical bytes: 900719925474099312345 -->\n";
  const errors: string[] = []; let completed = 0;
  const f = fixture("CaseMarkdownDialog.tsx", "downloadMarkdown", { canExport: true, verifyExport: async () => () => true, markdown,
    filename: "synthetic.md", draft: {}, status: "final", openedAt: new Date(), locale: "en",
    normalizeCaseMarkdownFilename: () => "synthetic.md", caseMarkdownFilename: () => "fallback.md", setFilename() {}, setError: (error: string) => errors.push(error), completed() { completed++; } });
  await f.run(); assert.equal(completed, 1); assert.deepEqual(errors, []);
  assert.deepEqual(f.clicks, ["synthetic.md"]); assert.deepEqual(f.counts(), { attached: 1, removed: 1 });
  assert.equal(f.link.target, "_blank"); assert.equal(f.blobs.size, 1);
  const blob = [...f.blobs.values()][0]; assert.equal(blob.type, "text/markdown;charset=utf-8");
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new TextEncoder().encode(markdown));
  f.releases.forEach(release => release()); assert.equal(f.blobs.size, 0);
});

test("Markdown handoff refuses stale authority and reports a thrown delivery error without completion", async () => {
  for (const allowed of [false, true]) {
    const errors: string[] = []; let completed = 0;
    const f = fixture("CaseMarkdownDialog.tsx", "downloadMarkdown", { canExport: true, verifyExport: async () => () => allowed,
      markdown: "synthetic", filename: "synthetic.md", draft: {}, status: "final", openedAt: new Date(), locale: "ru",
      normalizeCaseMarkdownFilename: () => "synthetic.md", caseMarkdownFilename: () => "fallback.md", setFilename() {},
      setError: (error: string) => errors.push(error), completed() { completed++; } }, true);
    await f.run(); assert.equal(completed, 0); assert.equal(f.blobs.size, 0); assert.equal(f.releases.length, 0);
    assert.equal(errors.length, allowed ? 1 : 0);
    if (allowed) assert.match(errors[0], /Кейс.*открыт/);
    else assert.deepEqual(f.counts(), { attached: 0, removed: 0 });
  }
});

test("device recovery retains its complete envelope, original text and history without mutating the entry", async () => {
  const entry = { id: "synthetic-archive", scope: "synthetic-owner", rawText: '\ufeff {"future":900719925474099312345}\r\n',
    draft: { title: "Учебный", futureCarrier: { preserved: true }, editHistory: [{ action: "node_added" }] }, prompt: "synthetic prompt" };
  const before = JSON.stringify(entry), errors: boolean[] = [];
  const f = fixture("StudioDraftArchive.tsx", "exportEntry", { setExportError: (value: boolean) => errors.push(value) });
  await f.run(entry); assert.equal(JSON.stringify(entry), before); assert.deepEqual(errors, [false]);
  assert.deepEqual(f.clicks, ["studio-recovery-synthetic-archive.json"]); assert.equal(f.blobs.size, 1);
  const blob = [...f.blobs.values()][0]; assert.equal(blob.type, "application/json");
  assert.equal(await blob.text(), JSON.stringify({ format: "genesis-juris-archive-backup", schemaVersion: 1, entry }));
  assert.deepEqual(f.counts(), { attached: 1, removed: 1 });
  f.releases.forEach(release => release()); assert.equal(f.blobs.size, 0);
});

test("device recovery delivery failure keeps the source intact and exposes recovery error state", async () => {
  const entry = { id: "synthetic-archive", rawText: "original" }, before = JSON.stringify(entry), errors: boolean[] = [];
  const f = fixture("StudioDraftArchive.tsx", "exportEntry", { setExportError: (value: boolean) => errors.push(value) }, true);
  await f.run(entry); assert.equal(JSON.stringify(entry), before); assert.deepEqual(errors, [false, true]);
  assert.equal(f.blobs.size, 0); assert.equal(f.releases.length, 0); assert.equal(f.clicks.length, 0);
});
