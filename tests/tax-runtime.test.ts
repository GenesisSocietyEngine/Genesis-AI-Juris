import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkedTaxRuntime, createTaxRuntimeLoader, TAX_RUNTIME_CONTRACT, TaxRuntimeError } from "../app/tax-runtime/runtime";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { verifyTaxWasmAssets } from "../scripts/tax-wasm-assets.mjs";

const capabilities = JSON.stringify({ ...TAX_RUNTIME_CONTRACT, currencies: ["EUR", "GBP", "USD"] });
const corpus = JSON.parse(await readFile(new URL("./fixtures/tax-runtime/native-corpus.json", import.meta.url), "utf8")) as { cases: { request: string; response: string }[] };

test("generated Rust source, tool receipt, assets and native corpus agree", () => {
  verifyTaxWasmAssets();
});

test("Node shared Rust runtime matches every complete native response", async () => {
  const runtime = await loadNodeTaxRuntime();
  assert.equal(await loadNodeTaxRuntime(), runtime);
  assert.equal(corpus.cases.length, 30);
  for (const entry of corpus.cases) assert.equal(runtime.execute(entry.request), entry.response);
  assert.throws(() => runtime.execute('{"command":"create_session"}'), { code: "unsupported_command" });
  assert.equal(JSON.parse(runtime.execute(JSON.stringify({ command: "tax_capabilities", padding: "x".repeat(262144) }))).detail.detail.code, "policy_rejected");
  const prepare = JSON.parse(corpus.cases[1].request);
  assert.equal(JSON.parse(runtime.execute(JSON.stringify({ ...prepare, unexpected: true }))).detail.detail.code, "invalid_payload");
});

test("concurrent readiness loads once and never exposes the executor before readiness", async () => {
  let calls = 0;
  let resolve!: (execute: (input: string) => string) => void;
  const ready = new Promise<(input: string) => string>(value => { resolve = value; });
  const load = createTaxRuntimeLoader(async () => { calls++; return ready; });
  const first = load();
  assert.equal(load(), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve(() => capabilities);
  assert.equal(await first, await load());
});

test("failed initialization stays failed with no retry or JavaScript fallback", async () => {
  let calls = 0;
  const load = createTaxRuntimeLoader(async () => { calls++; throw new Error("missing or corrupt asset"); });
  await assert.rejects(load(), { code: "initialization_failed" });
  await assert.rejects(load(), { code: "initialization_failed" });
  assert.equal(calls, 1);
});

test("every locked capability fails closed when incompatible", () => {
  for (const key of [...Object.keys(TAX_RUNTIME_CONTRACT), "currencies"]) {
    const value = { ...JSON.parse(capabilities), [key]: null };
    assert.throws(() => checkedTaxRuntime(() => JSON.stringify(value)), { code: "incompatible_runtime" });
  }
  for (const value of [undefined, "not json", "null", "[]"]) {
    assert.throws(() => checkedTaxRuntime(() => value), { code: "incompatible_runtime" });
  }
});

test("Rust errors are preserved without JavaScript financial or request validation", () => {
  const error = '{"type":"tax_error","detail":{"code":"incomplete_input"}}';
  const runtime = checkedTaxRuntime(input => input.includes("tax_capabilities") ? capabilities : error);
  assert.equal(runtime.execute("{invalid caller text"), error);
  const broken = checkedTaxRuntime(input => {
    if (input.includes("tax_capabilities")) return capabilities;
    throw new Error("WASM trap");
  });
  assert.throws(() => broken.execute("command"), (error) => error instanceof TaxRuntimeError && error.code === "execution_failed");
});
