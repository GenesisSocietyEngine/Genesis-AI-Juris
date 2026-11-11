import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const compiled = await build({
  stdin: { contents: readFileSync("app/activity/RecentActivity.tsx", "utf8") + "\nexport { Feed };", resolveDir: resolve("app/activity"), loader: "tsx" },
  bundle: true, write: false, jsx: "automatic", format: "esm", platform: "node", packages: "external", loader: { ".css": "empty", ".module.css": "empty" },
  plugins: [{ name: "activity-state", setup(builder) {
    builder.onResolve({ filter: /^react$/ }, args => args.namespace === "activity-state" ? { path: "react", external: true } : { path: "react", namespace: "activity-state" });
    builder.onLoad({ filter: /.*/, namespace: "activity-state" }, () => ({ contents: 'export * from "react"; export const useEffect=()=>{}; export const useState=value=>[Array.isArray(value)?globalThis.__activityLinkRows:value,()=>{}];' }));
  } }],
});
const file = resolve(".artifacts/activity-links/component.mjs");
mkdirSync(resolve(".artifacts/activity-links"), { recursive: true });
writeFileSync(file, compiled.outputFiles[0].text);
const { Feed } = await import(pathToFileURL(file).href);
const runtime = globalThis as typeof globalThis & { __activityLinkRows?: unknown[] };

for (const locale of ["en", "ru"]) test(`activity document links use exact workspace targets and preserve scope (${locale})`, () => {
  runtime.__activityLinkRows = ["document_created", "document_version_created"].map((action, index) => ({
    id: `doc:${index}`, category: "document", action, subject: "Same title", actor: "Synthetic actor",
    stamp: "2026-11-11T00:00:00Z", caseId: "case a", caseTitle: "Synthetic case", docId: `document_${index}`,
  }));
  try {
    for (const history of [false, true]) {
      const html = renderToStaticMarkup(createElement(Feed, { scope: "signed org", locale, history, initial: "document" }));
      const targets = [...html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll("&amp;", "&"), "https://test.invalid")).filter(url => url.searchParams.has("target"));
      assert.equal(targets.length, 2);
      for (const [index, url] of targets.entries()) {
        assert.equal(url.pathname, "/matters");
        assert.equal(url.searchParams.get("target"), `document-document_${index}`);
        assert.equal(url.searchParams.get("dossier"), "case a");
        assert.equal(url.searchParams.get("section"), "documents");
        assert.equal(url.searchParams.get("organization"), "signed org");
        assert.equal(url.searchParams.get("lang"), locale);
      }
    }
  } finally { delete runtime.__activityLinkRows; }
});
