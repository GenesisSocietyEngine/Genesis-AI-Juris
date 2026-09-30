import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { createPasswordCredential } from "../app/auth-crypto";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { buildCaseProtection } from "../app/case-protection";
import { buildTaxCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { getOrCreateCaseProtectionKey } from "../app/server-case-protection";
import { studioDeviceScope } from "../app/studio-device-storage";
import { parseStudioReportHistoryPage, parseStudioReportHistoryRecord, parseStudioHistoryReceipt, strictHistoryObject } from "../app/studio-report-history";
import { taxReportReceipt } from "../app/tax-report-receipt";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import type { TaxRuntime } from "../app/tax-runtime/runtime";
import { attach, reportFixture, reportOptions } from "./helpers/tax-report-fixture";
import type { StudioDraft } from "../app/types";

// Real login/auth resolver, route, all migrated D1 tables and fresh packaged
// Rust WASM. Only Worker transport is adapted to the exact Node artifact.
type Route = { GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response> };
const requests = new AsyncLocalStorage<Request>();
const globals = globalThis as unknown as { __tax_history_env: { DB: D1Database }; __tax_history_headers(): Headers; __tax_history_load(): Promise<TaxRuntime> };
let mf: Miniflare, d1: D1Database, history: Route, login: Route, draft: StudioDraft, raw: string;
let beforeRuntime: (() => Promise<void>) | undefined, beforeWrite: (() => Promise<void>) | undefined;
let runtimeLoads = 0, calculations = 0, sequence = 0;
const emails = { owner: "tax-history-owner@example.test", shared: "tax-history-shared@example.test", foreign: "tax-history-foreign@example.test" };
const cookies: Record<string, string> = {}, scopes: Record<string, string> = {};
async function count() { return (await d1.prepare("select count(*) as n from audit_events where event_type='studio_report_download_started'").first<{n:number}>())!.n; }
async function grant() { await d1.prepare("insert into custom_case_grants(custom_case_id,recipient_email,granted_by_email) values(1,?,?)").bind(emails.shared, emails.owner).run(); }
async function restoreSaved() {
  await d1.prepare("update custom_cases set current_version=?,fingerprint=?,is_private=0 where id=1").bind(draft.version, caseFingerprint(draft)).run();
  await d1.prepare("delete from case_drafts where custom_case_id=1 and id<>1").run();
  await d1.prepare("update case_drafts set version=?,fingerprint=?,payload=? where id=1").bind(draft.version, caseFingerprint(draft), raw).run();
}
async function body(actor = "owner", overrides: Partial<CaseReportOptions> = {}, source = draft) {
  const options = reportOptions(source, { privateCase: false, generatedAt: new Date(Date.UTC(2026, 8, 30, 12, 0, sequence++)).toISOString(), ...overrides });
  const artifacts = await buildTaxCaseReportArtifacts(source, options, loadNodeTaxRuntime);
  return { customCaseId: 1, expectedScope: scopes[actor], receipt: taxReportReceipt(artifacts, options.generatedAt), options };
}
async function call(actor: string | null, method = "GET", value?: unknown) {
  const headers = new Headers({ origin: "https://tax-history.test", "sec-fetch-site": "same-origin" });
  if (actor) headers.set("cookie", cookies[actor]);
  if (value !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`https://tax-history.test/api/custom-cases/report-receipts?customCaseId=1&expectedScope=${scopes[actor ?? "owner"]}`, { method, headers, body: value === undefined ? undefined : JSON.stringify(value) });
  return requests.run(request, () => history[method as "GET" | "POST"](request));
}
async function read(response: Response, status = 200) {
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return value;
}
before(async () => {
  mf = new Miniflare({ workers: [{ config: { name: "tax-receipt-history", type: "worker", compatibilityDate: "2026-09-01", manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } }, env: { DB: { type: "d1", name: "tax-receipt-history" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "tax-receipt-history") as unknown as D1Database;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) await d1.batch(readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map((s: string) => s.trim()).filter(Boolean).map((s: string) => d1.prepare(s)));
  globals.__tax_history_env = { DB: new Proxy(d1, { get(target, key) {
    if (key === "prepare") return (query: string) => {
      const wrap = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, { get(s, k) {
        if (k === "bind") return (...args: unknown[]) => wrap(s.bind(...args));
        const value = Reflect.get(s, k, s);
        if (typeof value === "function" && ["run", "all", "raw"].includes(String(k))) return async (...args: unknown[]) => {
          if (/insert into audit_events\(/i.test(query)) { const hook = beforeWrite; beforeWrite = undefined; await hook?.(); }
          return value.apply(s, args);
        };
        return typeof value === "function" ? value.bind(s) : value;
      } });
      return wrap(target.prepare(query));
    };
    const value = Reflect.get(target, key, target); return typeof value === "function" ? value.bind(target) : value;
  } }) };
  globals.__tax_history_headers = () => requests.getStore()!.headers;
  globals.__tax_history_load = async () => {
    runtimeLoads++;
    const hook = beforeRuntime; beforeRuntime = undefined; await hook?.();
    const runtime = await loadNodeTaxRuntime();
    return { ...runtime, execute(encoded: string) { if (JSON.parse(encoded).command === "tax_web_calculate") calculations++; return runtime.execute(encoded); } };
  };
  const bundle = await build({ stdin: { contents: "export * as history from './app/api/custom-cases/report-receipts/route.ts'; export * as login from './app/api/auth/login/route.ts';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022", plugins: [{ name: "tax-history-runtime", setup(b) {
    b.onResolve({ filter: /tax-runtime\/worker$/ }, () => ({ path: "tax-worker", namespace: "tax-history-worker" }));
    b.onLoad({ filter: /.*/, namespace: "tax-history-worker" }, () => ({ contents: "export const loadWorkerTaxRuntime=()=>globalThis.__tax_history_load()" }));
    b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "tax-history-env" }));
    b.onLoad({ filter: /.*/, namespace: "tax-history-env" }, args => ({ contents: args.path === "cloudflare:workers" ? "export const env=globalThis.__tax_history_env" : args.path === "next/headers" ? "export async function headers(){return globalThis.__tax_history_headers()}" : "export function redirect(){throw new Error('unexpected redirect')}" }));
  } }] });
  mkdirSync(".artifacts/tax-report-history-tests", { recursive: true });
  const path = resolve(".artifacts/tax-report-history-tests/routes.mjs"); writeFileSync(path, bundle.outputFiles[0].text);
  ({ history, login } = await import(pathToFileURL(path).href));
  const password = "Synthetic-tax-history-QA-30!", credential = await createPasswordCredential(password);
  for (const [actor, email] of Object.entries(emails)) {
    await d1.prepare("insert into users(email,display_name) values(?,?)").bind(email, "Synthetic " + actor).run();
    await d1.prepare("insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)").bind(email, credential.hash, credential.salt, credential.iterations, "2026-01-01T00:00:00.000Z").run();
    const request = new Request("https://tax-history.test/api/auth/login", { method: "POST", headers: { origin: "https://tax-history.test", "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const response = await requests.run(request, () => login.POST(request)); await read(response);
    cookies[actor] = response.headers.get("set-cookie")!.split(";")[0]; scopes[actor] = (await studioDeviceScope(email))!;
  }
  ({ draft } = await reportFixture()); raw = JSON.stringify(draft, null, "\t") + "\r\n";
  await d1.prepare("insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint) values(1,?,?,?,?,?)").bind(emails.owner, draft.caseId, draft.title, draft.version, caseFingerprint(draft)).run();
  await d1.prepare("insert into case_drafts(id,custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(1,1,?,?,?,?,?,?)").bind(emails.owner, draft.caseId, draft.version, caseFingerprint(draft), draft.title, raw).run();
  await grant();
});
after(async () => { await mf?.dispose(); });

test("v3 route freshly recomputes saved Rust evidence; retries are idempotent and retain no private source", async () => {
  const payload = await body(), before = calculations;
  const first = await read(await call("owner", "POST", payload), 201);
  const second = await read(await call("owner", "POST", payload));
  assert.ok(strictHistoryObject(first, ["record", "alreadyRecorded"])); assert.ok(strictHistoryObject(second, ["record", "alreadyRecorded"]));
  const firstRecord = parseStudioReportHistoryRecord(first.record), secondRecord = parseStudioReportHistoryRecord(second.record);
  assert.ok(firstRecord); assert.ok(secondRecord);
  assert.equal(firstRecord.id, secondRecord.id); assert.equal(second.alreadyRecorded, true);
  assert.deepEqual(firstRecord.receipt, payload.receipt); assert.equal(calculations - before, 2, "each attempt executes freshly, even dedupe");
  const page = parseStudioReportHistoryPage(await read(await call("owner"))); assert.ok(page);
  assert.equal(page.receipts[0].receipt.receiptSchemaVersion, 3);
  const rows = await d1.prepare("select detail from audit_events where event_type='studio_report_download_started'").all<{detail:string}>();
  for (const row of rows.results) for (const privateValue of ["normalized_request", "original_json", "POISON", "future-preserved", "25000000"]) assert.ok(!row.detail.includes(privateValue));
  assert.equal((await d1.prepare("select payload from case_drafts where id=1").first<{payload:string}>())!.payload, raw);
});

test("v3 history keeps account, grant, privacy and protection gates", async () => {
  const initial = await count();
  await read(await call(null), 401); await read(await call("foreign"), 404);
  await read(await call("shared", "POST", await body("owner")), 409);
  await read(await call("shared", "POST", await body("shared")), 201);
  await d1.prepare("update custom_cases set is_private=1 where id=1").run();
  await read(await call("shared", "POST", await body("shared")), 404);
  await read(await call("owner", "POST", await body("owner", { privateCase: true })), 201);
  await restoreSaved();
  const protection = await buildCaseProtection({ caseId: draft.caseId, version: draft.version, studioFingerprint: caseFingerprint(draft), parentCaseId: draft.parent?.caseId ?? null, parentVersion: draft.parent?.version ?? null, parentFingerprint: draft.parent?.fingerprint ?? null, parentCode: null, copyPolicy: "lineage_locked" }, await getOrCreateCaseProtectionKey(drizzle(d1, { schema })));
  const protectedDraft = { ...draft, protection };
  await d1.prepare("update case_drafts set payload=? where id=1").bind(JSON.stringify(protectedDraft)).run();
  await read(await call("shared", "POST", await body("shared", {}, protectedDraft)), 404);
  await read(await call("owner", "POST", await body("owner", {}, protectedDraft)), 201);
  await restoreSaved(); assert.equal(await count(), initial + 3);
});

test("opaque or ambiguous authoritative SQL is refused before runtime and remains exact", async () => {
  const payload = await body(), initial = await count();
  for (const retained of [
    JSON.stringify({ ...draft, taxAnalysis: { ...draft.taxAnalysis, carrierVersion: 99 } }),
    raw.replace('"caseId":', '"caseId":"duplicate", "caseId":'),
    "{truncated", JSON.stringify({ ...draft, taxAnalysis: { ...draft.taxAnalysis, document: '{"schema":"future","big":18446744073709551617}' } }),
  ]) {
    await d1.prepare("update case_drafts set payload=? where id=1").bind(retained).run();
    const loads = runtimeLoads, response = await read(await call("owner", "POST", payload), 409);
    assert.equal(runtimeLoads, loads); assert.ok(!JSON.stringify(response).includes(retained));
    assert.equal((await d1.prepare("select payload from case_drafts where id=1").first<{payload:string}>())!.payload, retained);
  }
  await restoreSaved(); assert.equal(await count(), initial);
});

test("held runtime cannot authorize changed raw text, latest row, privacy, grants or session", async () => {
  const initial = await count();
  const cases: Array<{ name: string; actor?: string; change: () => Promise<unknown>; restore?: () => Promise<unknown> }> = [
    { name: "raw bytes", change: () => d1.prepare("update case_drafts set payload=? where id=1").bind(" " + raw).run() },
    { name: "latest saved row", change: () => d1.prepare("insert into case_drafts(custom_case_id,user_email,case_id,version,fingerprint,title,payload,updated_at) select custom_case_id,?,case_id,version,fingerprint,title,payload,'2099-01-01' from case_drafts where id=1").bind(emails.shared).run() },
    { name: "privacy", change: () => d1.prepare("update custom_cases set is_private=1 where id=1").run() },
    { name: "grant generation", actor: "shared", change: async () => { await d1.prepare("delete from custom_case_grants where custom_case_id=1").run(); await grant(); } },
    { name: "session", change: () => d1.prepare("update auth_sessions set revoked_at='2099-01-01' where account_id=(select id from local_accounts where user_email=?)").bind(emails.owner).run(), restore: () => d1.prepare("update auth_sessions set revoked_at=null where account_id=(select id from local_accounts where user_email=?)").bind(emails.owner).run() },
  ];
  for (const scenario of cases) {
    const payload = await body(scenario.actor ?? "owner"), before = calculations;
    let hookError: unknown;
    beforeRuntime = async () => { try { await scenario.change(); } catch (error) { hookError = error; throw error; } };
    await read(await call(scenario.actor ?? "owner", "POST", payload), 409);
    assert.equal(hookError, undefined, `${scenario.name}: fixture mutation must succeed`);
    assert.equal(beforeRuntime, undefined, scenario.name); assert.equal(calculations, before + 1, scenario.name);
    assert.equal(await count(), initial); await scenario.restore?.(); await restoreSaved();
  }
  const payload = await body(); beforeWrite = async () => { await d1.prepare("update case_drafts set payload=? where id=1").bind(raw + " ").run(); };
  await read(await call("owner", "POST", payload), 409); assert.equal(beforeWrite, undefined); assert.equal(await count(), initial); await restoreSaved();
});

test("forged v3 result identities and v2 downgrade cannot record tax output", async () => {
  const original = await body(), initial = await count();
  for (const receipt of [
    { ...original.receipt, tax: { ...original.receipt.tax, evidenceFingerprint: `sha256-${"0".repeat(64)}` } },
    { ...original.receipt, tax: { ...original.receipt.tax, inputHash: "0".repeat(64) } },
    { ...original.receipt, presentationFingerprint: `sha256-${"0".repeat(64)}` },
  ]) await read(await call("owner", "POST", { ...original, receipt }), 409);
  const { tax: ignoredTax, ...base } = original.receipt; assert.ok(ignoredTax);
  await read(await call("owner", "POST", { ...original, receipt: { ...base, receiptSchemaVersion: 2, rendererVersion: "1.0.0" } }), 409);
  assert.equal(parseStudioHistoryReceipt({ ...original.receipt, receiptSchemaVersion: 99 }), null);
  await read(await call("owner", "POST", { ...original, result: { npv: "999" } }), 400);
  await read(await call("owner", "POST", { ...original, receipt: { ...original.receipt, tax: { ...original.receipt.tax, cached_response: "injected" } } }), 400);
  assert.equal(await count(), initial);
});

test("fresh runtime failure and incomplete authoritative edits cannot adopt historical cached results", async () => {
  const payload = await body(), initial = await count();
  beforeRuntime = async () => { throw new Error("deliberate runtime unavailable"); };
  await read(await call("owner", "POST", payload), 409); assert.equal(await count(), initial);
  const { draft: incomplete, document } = await reportFixture(); document.edit.implementation_cost = ""; attach(incomplete, document);
  await d1.prepare("update custom_cases set fingerprint=? where id=1").bind(caseFingerprint(incomplete)).run();
  await d1.prepare("update case_drafts set fingerprint=?,payload=? where id=1").bind(caseFingerprint(incomplete), JSON.stringify(incomplete)).run();
  const options = { ...payload.options, currentFingerprint: caseFingerprint(incomplete), workspaceFingerprint: caseFingerprint(incomplete), currentPublicationFingerprint: casePublicationFingerprint(incomplete), workspacePublicationFingerprint: casePublicationFingerprint(incomplete) };
  const loads = runtimeLoads;
  await read(await call("owner", "POST", { ...payload, options }), 409);
  assert.equal(runtimeLoads, loads); assert.equal(await count(), initial); await restoreSaved();
});
