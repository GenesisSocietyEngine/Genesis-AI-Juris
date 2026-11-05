import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { normalizeDocuments } from "../app/matters/matter-view-model";

type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown } };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
const runtime = globalThis as typeof globalThis & { __documentState?: (value: unknown) => unknown };
const compiled = await build({
  stdin: { contents: 'export {DocumentsSection} from "./app/matters/MattersClient";', resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "esm", packages: "external", loader: { ".css": "empty", ".module.css": "empty" },
  plugins: [{ name: "document-hooks", setup(builder) {
    builder.onResolve({ filter: /^react$/ }, args => args.namespace === "document-hooks" ? { path: "react", external: true } : { path: "react", namespace: "document-hooks" });
    builder.onLoad({ filter: /.*/, namespace: "document-hooks" }, () => ({ loader: "js", contents: 'export * from "react"; export const useState=value=>globalThis.__documentState(value);' }));
  } }],
});
const filename = resolve(".artifacts/document-workspace/component.mjs");
mkdirSync(resolve(".artifacts/document-workspace"), { recursive: true });
writeFileSync(filename, compiled.outputFiles[0].text);
const { DocumentsSection } = await import(pathToFileURL(filename).href);

test("document filters, exact targets and review actions retain the selected immutable identity", () => {
  const documents = normalizeDocuments({ documents: [
    { document_id: "a", title: "Same title", status: "received", current_version_id: "a2", tags: ["contract"] },
    { document_id: "b", title: "Same title", status: "accepted_source", current_version_id: "b1", tags: ["letter"] },
  ], document_versions: [
    { document_id: "a", document_version_id: "a1", ordinal: 1, original_filename: "old-contract.docx" },
    { document_id: "a", document_version_id: "a2", ordinal: 2, original_filename: "new-contract.docx" },
    { document_id: "b", document_version_id: "b1", ordinal: 1, original_filename: "letter.pdf" },
  ] });
  const before = JSON.stringify(documents), slots: unknown[] = [];
  let cursor = 0, focus: string | undefined, caseId = "case_a";
  const reviewed: string[] = [];
  runtime.__documentState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (next: unknown) => { slots[index] = next; }]; };
  const render = () => { cursor = 0; return DocumentsSection({ matter: { id: caseId, permissions: { canWrite: false, canReview: true } }, documents, activity: [], view: "user", mutationKey: null, focusedDocumentId: focus, onNavigate() {}, onUpload() {}, onReview(document: { id: string }) { reviewed.push(document.id); } }); };
  const selected = (tree: unknown) => elements(tree).filter(element => element.type === "article" && element.props.hidden === false).map(element => element.props.id);
  const change = (tree: unknown, type: string, value: string) => (elements(tree).find(element => element.type === type)!.props.onChange as (event: unknown) => void)({ target: { value } });
  try {
    let tree = render(); assert.deepEqual(selected(tree), ["document-a"]);
    change(tree, "input", "letter.pdf"); tree = render(); assert.deepEqual(selected(tree), ["document-b"]);
    change(tree, "select", "review"); tree = render(); assert.deepEqual(selected(tree), []);
    // Opening an exact source from another case action must escape old filters.
    focus = "a"; tree = render(); assert.deepEqual(selected(tree), ["document-a"]);
    assert.equal(elements(tree).find(element => element.type === "input")!.props.value, "");
    const selectB = elements(tree).find(element => element.type === "button" && element.props["aria-controls"] === "document-b")!;
    (selectB.props.onClick as () => void)(); tree = render(); assert.deepEqual(selected(tree), ["document-b"]);
    focus = "b"; tree = render(); assert.deepEqual(selected(tree), ["document-b"]);
    change(tree, "input", "new-contract"); tree = render(); assert.deepEqual(selected(tree), ["document-a"]);
    const card = elements(tree).find(element => element.type === "article" && element.props.id === "document-a")!;
    const review = elements(card).find(element => element.type === "button" && element.props.children === "Accept as governed source")!;
    (review.props.onClick as () => void)(); assert.deepEqual(reviewed, ["a"]);
    caseId = "case_b"; focus = undefined; tree = render(); assert.deepEqual(selected(tree), ["document-a"]);
    assert.equal(elements(tree).find(element => element.type === "input")!.props.value, "");
    assert.equal(JSON.stringify(documents), before);
  } finally { delete runtime.__documentState; }
});
