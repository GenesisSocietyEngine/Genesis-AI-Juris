import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { buildCanopyPackage } from "../app/canopy-fixture";
import type { StudioDraft } from "../app/types";

const result = await build({
  absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
  entryPoints: ["app/StudioDecisionList.tsx"], bundle: true, write: false,
  platform: "node", format: "cjs", packages: "external", jsx: "automatic",
});
const loaded = { exports: {} as { default: ComponentType<{ draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void }> } };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const render = (draft: StudioDraft) => renderToStaticMarkup(createElement(loaded.exports.default, { draft, locale: "en", onNode() {} }));

test("decision list retains every recorded Canopy branch label and explanation without selecting an outcome", () => {
  const draft = buildCanopyPackage("base").draft, before = JSON.stringify(draft), html = render(draft);
  assert.match(html, /Their order does not select or approve an outcome/);
  for (const link of draft.links) {
    const label = renderToStaticMarkup(createElement("strong", null, link.rule!.label));
    const detail = renderToStaticMarkup(createElement("p", null, link.rule!.detail));
    assert.ok(html.includes(label), `${link.id}: recorded branch label must remain visible`);
    assert.ok(html.includes(detail), `${link.id}: recorded explanation must remain visible`);
  }
  assert.equal(JSON.stringify(draft), before);
});

test("parallel relations with label-only conditions stay distinct and in recorded order", () => {
  const original = buildCanopyPackage("base").draft;
  const draft = { ...original, nodes: original.nodes.slice(0, 2), links: [
    { id: "branch-granted", from: original.nodes[0].id, to: original.nodes[1].id, rule: { label: "Permission granted" } },
    { id: "branch-withheld", from: original.nodes[0].id, to: original.nodes[1].id, rule: { label: "Permission withheld — seek review" } },
  ] };
  const html = render(draft);
  assert.match(html, /<strong>Permission granted<\/strong>/);
  assert.match(html, /<strong>Permission withheld — seek review<\/strong>/);
  assert.ok(html.indexOf("Permission granted") < html.indexOf("Permission withheld"));
  assert.equal((html.match(/<button type="button">Is this within the committee mandate\?<\/button>/g) ?? []).length, 2);
});
