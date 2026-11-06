import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const dir = resolve(".artifacts/case-editor-preview"); mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "entry.tsx"), `import React,{useSyncExternalStore} from 'react';import{createRoot}from'react-dom/client';
import{AuthorizedMattersClient}from'../../app/matters/MattersClient';import{caseEditorHarness}from'../../tests/fixtures/case-editor';import{useInterfaceLocale}from'../../app/use-interface-locale';
import'../../app/globals.css';import'../../app/workspace-design.css';import'../../app/casevant.css';import'../../app/outlook-controls.css';
const h=caseEditorHarness();await h.start();function App(){useSyncExternalStore(h.owner.subscribe,h.owner.getSnapshot,h.owner.getSnapshot);const[locale,setLocale]=useInterfaceLocale();return <><aside aria-label='Synthetic fixture controls'><strong>Synthetic editor preview · no live writes</strong><button onClick={()=>{h.change();void h.owner.load()}}>Simulate colleague change</button><button onClick={()=>h.lose('after')}>Lose next save response</button><button onClick={()=>{h.readonly();void h.owner.load()}}>Make read-only</button><button onClick={()=>setLocale(locale==='en'?'ru':'en')}>EN / RU</button><output>Writes: {h.writes.length} · Saved version: {h.read().revision}</output></aside><AuthorizedMattersClient actorId='synthetic-owner' organizationId='synthetic-org' controller={h.owner}/></>};createRoot(document.getElementById('root')).render(<App/>);`);
await build({ entryPoints: [resolve(dir, "entry.tsx")], bundle: true, conditions: ["style", "browser", "import", "default"], outdir: dir, format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "preview-next", setup(b) {
  b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "preview" })); b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "preview-link" }));
  b.onLoad({ filter: /.*/, namespace: "preview-link" }, () => ({ resolveDir: process.cwd(), contents: "import React from 'react';export default function Link(props){return React.createElement('a',props)}" }));
  b.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: "export function useRouter(){return {push(){}}}" }));
} }] });
writeFileSync(resolve(dir, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CaseVant · synthetic case editor</title><link rel="stylesheet" href="/entry.css"><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;font:14px 'Segoe UI',sans-serif}aside{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 20px;background:#e8f2fc;border-bottom:1px solid #b9cfe2}aside strong{flex:1}aside button{min-height:36px;border:1px solid #a9b6c2;border-radius:4px;background:#fff;padding:6px 10px}aside output{font-size:12px}main{min-width:0}#root{max-width:1440px;margin:auto}</style><div id="root"></div><script type="module" src="/entry.js"></script></html>`);
if (!process.argv.includes("--build-only")) createServer((request, response) => {
  const path = request.url?.split("?")[0], file = path === "/entry.js" ? "entry.js" : path === "/entry.css" ? "entry.css" : "index.html";
  response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); response.end(readFileSync(resolve(dir, file)));
}).listen(4321, "127.0.0.1", () => console.log("Synthetic case editor: http://127.0.0.1:4321"));
