/** Exercise actual Vinext output. No test route is added to the product Worker. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Miniflare, Log, LogLevel } from "miniflare";
import { withSecurityHeaders } from "../worker/security-headers.ts";
import { verifyTaxWasmAssets } from "./tax-wasm-assets.mjs";
import { buildReleaseIdentity } from "../build/release-identity.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const evidence = join(root, ".artifacts/tax-runtime/packaging");
mkdirSync(evidence, { recursive: true });
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const corpus = JSON.parse(readFileSync(join(root, "tests/fixtures/tax-runtime/native-corpus.json"), "utf8"));
const assets = verifyTaxWasmAssets();
const responseCorpus = `[${corpus.cases.map(entry => entry.response).join(",")}]`;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const clean = git("status", "--porcelain", "--untracked-files=all") === "";
const receipt = {
  schema: "juris.tax-runtime-packaging.v1",
  sourceCommit: clean ? git("rev-parse", "HEAD") : null,
  baseCommit: git("rev-parse", "HEAD"),
  workingTreeClean: clean,
  webApplicationInputsSha256: buildReleaseIdentity(root).applicationInputsSha256,
  sourceInputsSha256: sha256(JSON.stringify(assets.inputs)),
  node: process.version,
  miniflare: require("miniflare/package.json").version,
  workerd: require("workerd/package.json").version,
  executedCommandsPerHost: corpus.cases.length,
  responseCorpusSha256: sha256(responseCorpus),
  hosts: {},
};

function entry(directory, environment) {
  const manifest = JSON.parse(readFileSync(join(directory, "tax-runtime-entry.json"), "utf8"));
  assert.equal(manifest.schema, "juris.tax-runtime-entry.v1");
  assert.equal(manifest.environment, environment);
  assert.equal(manifest.applicationInputsSha256, receipt.webApplicationInputsSha256, "Build output is stale for the current application inputs.");
  if (clean) assert.equal(manifest.sourceCommit, receipt.sourceCommit, "Rebuild on the exact committed source before recording head evidence.");
  assert.match(manifest.entry, /^_next\/static\/(?:chunks\/)?tax-runtime-[\w-]+\.js$/);
  return manifest.entry;
}

async function verifyWorker(environment, directory) {
  const runtimeEntry = entry(directory, environment);
  const modules = {};
  function visit(path) {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const absolute = join(path, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (/\.(js|wasm)$/.test(item.name)) {
        const name = relative(directory, absolute).replaceAll("\\", "/");
        modules[name] = { type: item.name.endsWith(".wasm") ? "wasm" : "esm", contents: readFileSync(absolute) };
      }
    }
  }
  visit(directory);
  modules["runtime-proof.mjs"] = { type: "esm", contents: `
    import { loadWorkerTaxRuntime } from ${JSON.stringify(`./${runtimeEntry}`)};
    export default { async fetch(request) {
      const runtime = await loadWorkerTaxRuntime();
      const cases = await request.json();
      const responses = cases.map(entry => runtime.execute(entry.request));
      let dynamicCompilationBlocked = false;
      try { await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])); }
      catch { dynamicCompilationBlocked = true; }
      return Response.json({ responses, cached: runtime === await loadWorkerTaxRuntime(), dynamicCompilationBlocked });
    } };
  ` };
  const mf = new Miniflare({
    host: "127.0.0.1", port: 0, cf: false, telemetry: { enabled: false },
    log: new Log(LogLevel.WARN), resourceTmpPath: join(evidence, `${environment}-tmp`),
    workers: [{ config: { name: `tax-${environment}-proof`, type: "worker", compatibilityDate: "2026-09-11",
      manifest: { mainModule: "runtime-proof.mjs", modulesRoot: directory, modules } } }],
  });
  try {
    const response = await mf.dispatchFetch("http://runtime.test/", { method: "POST", body: JSON.stringify(corpus.cases) });
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.deepEqual(result.responses, corpus.cases.map(entry => entry.response));
    assert.equal(result.cached, true);
    assert.equal(result.dynamicCompilationBlocked, true);
    const wasm = Object.entries(modules).filter(([, value]) => value.type === "wasm");
    assert.ok(wasm.length > 0);
    receipt.hosts[environment] = { entry: runtimeEntry, completeNativeParity: true, cached: true, dynamicCompilationBlocked: true, wasm: wasm.map(([path, value]) => ({ path, sha256: sha256(value.contents) })) };
    writeFileSync(join(evidence, `${environment}-responses.json`), `[${result.responses.join(",")}]\n`);
  } finally { await mf.dispose(); }
}

const clientDirectory = join(root, "dist/client");
const clientEntry = entry(clientDirectory, "client");
const browserModule = `
import { loadBrowserTaxRuntime } from ${JSON.stringify(`/${clientEntry}`)};
const result = { host: "browser", completeNativeParity: false };
const mode = new URL(location.href).searchParams.get("mode") || "normal";
try {
  if (mode !== "normal") {
    let firstError;
    try { await loadBrowserTaxRuntime(); } catch (error) { firstError = error; }
    if (!firstError || firstError.code !== "initialization_failed") throw Error("Readiness did not fail closed");
    let secondError;
    try { await loadBrowserTaxRuntime(); } catch (error) { secondError = error; }
    if (secondError !== firstError) throw Error("Failed initialization was not cached");
    Object.assign(result, { expectedFailure: true, mode, code: firstError.code, cached: true });
  } else {
  const runtime = await loadBrowserTaxRuntime();
  const corpus = await (await fetch("/native-corpus.json")).json();
  const responses = corpus.cases.map(entry => runtime.execute(entry.request));
  if (!responses.every((value, index) => value === corpus.cases[index].response)) throw Error("Complete native response parity failed");
  if (runtime !== await loadBrowserTaxRuntime()) throw Error("Readiness was not cached");
  let evalBlocked = false;
  try { globalThis.eval("1 + 1"); } catch { evalBlocked = true; }
  if (!evalBlocked) throw Error("JavaScript eval unexpectedly allowed");
  Object.assign(result, { completeNativeParity: true, executedCommands: responses.length, evalBlocked, cached: true, responses });
  }
} catch (error) { result.error = String(error); result.cause = String(error.cause || ""); }
const summary = { ...result };
delete summary.responses;
document.querySelector("h1").insertAdjacentHTML("afterend", '<p>30 protocol executions; 25 repeat the same calculation. Editor and report integration remain pending.</p>');
document.querySelector("pre").textContent = JSON.stringify(summary, null, 2);
document.querySelector("pre").dataset.evidence = JSON.stringify(result);
document.body.dataset.result = (result.completeNativeParity || result.expectedFailure) && !result.error ? "passed" : "failed";
`;

function browserServer() {
  let mode = "normal";
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let body; let type;
    if (url.pathname === "/") { mode = url.searchParams.get("mode") || "normal"; body = '<!doctype html><html><head><title>Shared Rust runtime packaging verification</title></head><body><h1>Shared Rust runtime packaging verification</h1><pre>Running...</pre><script type="module" src="/proof.js"></script></body></html>'; type = "text/html"; }
    else if (url.pathname === "/proof.js") { body = browserModule; type = "text/javascript"; }
    else if (url.pathname === "/native-corpus.json") { body = JSON.stringify(corpus); type = "application/json"; }
    else if (/^\/_next\/static\/(?:(?:chunks|media)\/)?[\w.-]+\.(js|wasm)$/.test(url.pathname)) {
      const path = join(clientDirectory, url.pathname);
      if (existsSync(path)) {
        body = readFileSync(path); type = path.endsWith(".wasm") ? "application/wasm" : "text/javascript";
        if (path.endsWith(".wasm") && mode === "missing") body = undefined;
        if (path.endsWith(".wasm") && mode === "corrupt") body = Buffer.from("corrupt wasm");
      }
    }
    const decorated = withSecurityHeaders(new Response(body ?? "Not found", { status: body === undefined ? 404 : 200, headers: { "Content-Type": type || "text/plain" } }), url);
    if (mode === "blocked-csp") decorated.headers.set("Content-Security-Policy", decorated.headers.get("Content-Security-Policy").replace(" 'wasm-unsafe-eval'", ""));
    decorated.headers.set("Cache-Control", "no-store");
    response.writeHead(decorated.status, Object.fromEntries(decorated.headers));
    response.end(Buffer.from(await decorated.arrayBuffer()));
  });
}

async function verifyBrowser(server) {
  const chrome = process.env.CHROME_BIN;
  if (!chrome) throw new Error("Set CHROME_BIN to the installed Chrome executable for browser verification.");
  const profile = mkdtempSync(join(evidence, "chrome-"));
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let diagnostics = "";
  child.stderr.on("data", bytes => { diagnostics += bytes; });
  let socket;
  try {
    const portFile = join(profile, "DevToolsActivePort");
    for (let attempt = 0; !existsSync(portFile) && attempt < 200; attempt++) await delay(100);
    const port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      if (event.id) {
        const handler = pending.get(event.id); pending.delete(event.id);
        if (event.error) handler.reject(new Error(JSON.stringify(event.error)));
        else handler.resolve(event.result);
      }
      if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome command timed out: ${method}`)); }, 10000);
      pending.set(id, {
        resolve(value) { clearTimeout(timer); resolve(value); },
        reject(error) { clearTimeout(timer); reject(error); },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send("Runtime.enable");
    await send("Page.enable");
    for (const mode of ["normal", "missing", "corrupt", "blocked-csp"]) {
      await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/?mode=${mode}` });
      let result;
      for (let attempt = 0; attempt < 300; attempt++) {
        result = await send("Runtime.evaluate", { expression: `new URL(location.href).searchParams.get('mode') === ${JSON.stringify(mode)} ? (document.body?.dataset.result || '') : ''`, returnByValue: true });
        if (result.result.value) break;
        await delay(100);
      }
      const content = await send("Runtime.evaluate", { expression: "document.querySelector('pre')?.dataset.evidence", returnByValue: true });
      const screenshot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(evidence, `browser-${mode}.png`), Buffer.from(screenshot.data, "base64"));
      assert.equal(result.result.value, "passed", content.result.value);
      assert.deepEqual(errors, []);
      const parsed = JSON.parse(content.result.value);
      if (mode === "normal") {
        assert.deepEqual(parsed.responses, corpus.cases.map(entry => entry.response));
        writeFileSync(join(evidence, "browser-responses.json"), `[${parsed.responses.join(",")}]\n`);
        delete parsed.responses;
        const version = await send("Browser.getVersion");
        receipt.hosts.browser = { ...parsed, version, entry: clientEntry };
      } else {
        assert.equal(parsed.expectedFailure, true);
        assert.equal(parsed.mode, mode);
        receipt.hosts[`browser-${mode}`] = parsed;
      }
    }
  } finally { socket?.close(); child.kill(); writeFileSync(join(evidence, "chrome.log"), diagnostics); }
}

try {
  await verifyWorker("rsc", join(root, "dist/server"));
  await verifyWorker("ssr", join(root, "dist/server/ssr"));
  const server = browserServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await verifyBrowser(server); } finally { await new Promise(resolve => server.close(resolve)); }
  console.log(JSON.stringify(receipt, null, 2));
} finally { writeFileSync(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n"); }
