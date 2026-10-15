import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deploymentBuild, deploymentOrigin, inventoryDeploymentAssets, verifyDeploymentAssets, type DeploymentAsset } from "../scripts/tests/deployment-assets";

const asset = (name: string, text = "expected"): DeploymentAsset => ({ path: "/_next/static/" + name, bytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex"), mime: "text/javascript" });
test("actual production manifest is inventoried against the exact build; a wrong source commit fails before HTTP", () => {
  const built = JSON.parse(readFileSync("dist/.openai/release-provenance.json", "utf8"));
  const inventory = deploymentBuild(process.cwd(), built.sourceCommit);
  assert.ok(inventory.assets.some(row => row.path.includes("/JurisApp-") && row.mime === "text/javascript"));
  assert.ok(inventory.assets.some(row => row.mime === "text/css"));
  assert.ok(inventory.assets.some(row => row.mime === "application/wasm"));
  assert.throws(() => deploymentBuild(process.cwd(), "0".repeat(40)), /identities differ/);
  assert.throws(() => deploymentBuild(process.cwd(), "unknown"), /exact lowercase source commit/);
});
test("real static HTTP rejects missing chunks, login HTML, redirects, wrong/truncated/oversized bytes and timeouts", async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url!); assert.equal(request.method, "GET"); assert.equal(request.headers.cookie, undefined); assert.equal(request.headers.authorization, undefined);
    if (request.url!.endsWith("redirect.js")) { response.writeHead(302, { location: "https://unexpected.example.invalid/" }); response.end(); return; }
    if (request.url!.endsWith("missing.js")) { response.writeHead(404); response.end("missing"); return; }
    if (request.url!.endsWith("html.js")) { response.writeHead(200, { "content-type": "text/html" }); response.end("login"); return; }
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    if (request.url!.endsWith("slow.js")) { setTimeout(() => response.end("expected"), 150); return; }
    response.end(request.url!.endsWith("changed.js") ? "modified" : request.url!.endsWith("short.js") ? "short" : request.url!.endsWith("large.js") ? "expected extra" : "expected");
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No local test server");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const receipt = await verifyDeploymentAssets(origin, ["ok.js", "missing.js", "html.js", "redirect.js", "changed.js", "short.js", "large.js"].map(name => asset(name)), { concurrency: 2 });
    assert.equal(receipt.passed, false); assert.equal(receipt.verifiedCount, 1);
    assert.deepEqual(receipt.assets.map(r => r.reason), ["exact_bytes", "http_status", "content_type", "http_status", "content_mismatch", "content_mismatch", "body_too_large"]);
    assert.equal(requests.length, 7, "redirect must not be followed");
    assert.equal(receipt.deployedSourceVerified, false); assert.equal(receipt.browserHydrationVerified, false); assert.equal(receipt.authenticatedWorkflowsVerified, false);
    const slow = await verifyDeploymentAssets(origin, [asset("slow.js")], { timeoutMs: 25 });
    assert.equal(slow.passed, false); assert.equal(slow.assets[0].reason, "timeout");
    const success = await verifyDeploymentAssets(origin, [asset("ok.js")]); assert.equal(success.passed, true);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); }
});

test("manifest inventories lazy JS, CSS and WASM exactly; unsafe, empty and malformed inventories fail before requests", async () => {
  const root = mkdtempSync(join(tmpdir(), "casevant-assets-"));
  try {
    mkdirSync(join(root, "_next/static"), { recursive: true });
    for (const name of ["entry.js", "lazy.js", "style.css", "tax.wasm"]) writeFileSync(join(root, "_next/static", name), "synthetic " + name);
    const manifest = { entry: { file: "_next/static/entry.js", dynamicImports: ["lazy"], css: ["_next/static/style.css"], assets: ["_next/static/tax.wasm"] }, lazy: { file: "_next/static/lazy.js", css: ["_next/static/style.css"] } };
    const inventory = inventoryDeploymentAssets(root, manifest);
    assert.equal(inventory.length, 4); assert.deepEqual(inventory.map(row => row.mime), ["text/javascript", "text/javascript", "text/css", "application/wasm"]);
    for (const invalid of [{}, [], { a: null }, { a: {file:"https://outside.invalid/a.js"} }, {a:{file:"_next/static/../outside.js"}}, {a:{file:"_next/static/%2e%2e/outside.js"}}, {a:{file:"_next/static/entry.js",css:"bad"}}]) assert.throws(() => inventoryDeploymentAssets(root, invalid));
    let calls = 0; const fetcher = (async () => { calls++; throw new Error("must not fetch"); }) as typeof fetch;
    for (const path of ["X_next/static/entry.js", "//outside.invalid/a.js", "/_next/static/../outside.js", "/_next/static/%2e%2e/outside.js"]) await assert.rejects(() => verifyDeploymentAssets("https://casevant.pro", [{ ...asset("entry.js"), path }], { fetcher }));
    await assert.rejects(() => verifyDeploymentAssets("https://casevant.pro", [], { fetcher })); assert.equal(calls, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("verification targets contain no credentials, query or cross-origin redirect permission", () => {
  assert.equal(deploymentOrigin("https://casevant.pro"), "https://casevant.pro");
  for (const invalid of ["http://casevant.pro", "https://user:password@casevant.pro", "https://casevant.pro?token=secret", "https://casevant.pro/path", "https://casevant.pro#fragment"]) assert.throws(() => deploymentOrigin(invalid));
});
