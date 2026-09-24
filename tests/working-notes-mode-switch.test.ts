import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import postcss, { type AtRule, type Node } from "postcss";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceController } from "../app/matters/workspace-controller";

// Render the actual workspace parent with simulated reads. Identity CSS-module
// names let the CSS check follow the class actually rendered by the component.
// This is not a browser layout, keyboard or actual-zoom acceptance result.
const bundled = await build({
  entryPoints: ["app/matters/MattersClient.tsx"], bundle: true, write: false,
  format: "esm", platform: "node", packages: "external", jsx: "automatic",
  loader: { ".css": "empty" },
  plugins: [{ name: "mode-switch-render", setup(builder) {
    builder.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: "export default new Proxy({}, {get:(_,key)=>key});", loader: "js" }));
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export function useRouter(){return {push(){}}}" }));
  } }],
});
mkdirSync(".artifacts/c1-note-mode-switch", { recursive: true });
const componentFile = resolve(".artifacts/c1-note-mode-switch/component.mjs");
writeFileSync(componentFile, bundled.outputFiles[0].text);
const Parent = (await import(pathToFileURL(componentFile).href)).AuthorizedMattersClient;
const stylesheet = postcss.parse(readFileSync("app/matters/matters.module.css", "utf8"));

function directClassStyles(className: string, width: number) {
  const result: Record<string, string> = {};
  stylesheet.walkRules(rule => {
    if (!rule.selectors.includes("." + className)) return;
    for (let parent: Node | undefined = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== "atrule") continue;
      const atRule = parent as AtRule;
      if (atRule.name !== "media") continue;
      const conditions = [...atRule.params.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
      if (!conditions.length) return;
      if (conditions.some(([, kind, limit]) => kind === "max" ? width > Number(limit) : width < Number(limit))) return;
    }
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

async function harness() {
  const identity = { actorId: "mode_switch_actor", organizationId: "mode_switch_org" };
  const owner = new WorkspaceController({ identity, transport: async path => {
    const url = new URL(path, "https://test.invalid");
    if (url.pathname === "/api/organizations") return Response.json({ selected: { ...identity, selection: identity.organizationId, status: "active" } });
    if (url.pathname === "/api/dossiers/mode_switch_case") return Response.json({ dossier: { dossier_id: "mode_switch_case", title: "Mode switch fixture", permissions: { role: "owner" }, revision: 1 } });
    if (url.pathname.endsWith("/requests")) return Response.json({ requests: [], deadlines: [] });
    return Response.json({ documents: [], source_anchors: [], assertions: [], proposals: [], decision_packages: [], snapshots: [], outputs: [], events: [] });
  } });
  owner.enter("mode_switch_case");
  await owner.load();
  owner.navigate("documents");
  const render = () => renderToStaticMarkup(createElement(Parent, { ...identity, controller: owner }));
  const switchMarkup = () => {
    const html = render();
    const group = html.match(/<div class="([^"]+)" role="group" aria-label="Documents and notes">([\s\S]*?)<\/div>/);
    assert.ok(group, "the actual parent renders a named Documents and notes group");
    return { html, className: group[1], buttons: group[2] };
  };
  return { owner, switchMarkup };
}

test("documents/notes controls remain visible when main section tabs collapse", async () => {
  const { owner, switchMarkup } = await harness();
  try {
    const group = switchMarkup();
    assert.match(group.buttons, /<button type="button" aria-pressed="true">Documents &amp; evidence<\/button>/);
    assert.match(group.buttons, /<button type="button" aria-pressed="false">Working notes<\/button>/);
    for (const width of [320, 390, 500, 640, 720, 1280]) {
      const styles = directClassStyles(group.className, width);
      assert.equal(styles.display, "flex", `documents/notes switch is visible at ${width}px`);
      assert.equal(styles["flex-wrap"], "wrap", `controls can wrap at ${width}px`);
    }
    assert.equal(directClassStyles("sectionTabs", 390).display, "none", "main navigation retains its mobile select behavior");
  } finally { owner.dispose(); }
});

test("same workspace notebook and dirty text survive documents/notes switching", async () => {
  const { owner, switchMarkup } = await harness();
  try {
    owner.openNotes();
    const notebook = owner.workingNotes()!;
    notebook.start("blank");
    const key = notebook.getSnapshot().selected!;
    notebook.edit(key, { title: "Unsubmitted working note", body: "Preserved local analysis" });
    assert.match(switchMarkup().buttons, /aria-pressed="true">Working notes/);
    assert.match(switchMarkup().html, /Preserved local analysis/);
    owner.closeNotes();
    assert.match(switchMarkup().buttons, /aria-pressed="true">Documents &amp; evidence/);
    assert.doesNotMatch(switchMarkup().html, /Preserved local analysis/);
    owner.openNotes();
    assert.equal(owner.workingNotes(), notebook);
    assert.equal(notebook.dirty, true);
    assert.match(switchMarkup().html, /Preserved local analysis/);
  } finally { owner.dispose(); }
});
