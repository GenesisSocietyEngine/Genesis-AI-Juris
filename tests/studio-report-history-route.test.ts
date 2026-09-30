import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { createPasswordCredential, type PasswordCredential } from "../app/auth-crypto";
import { buildCaseProtection } from "../app/case-protection";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getOrCreateCaseProtectionKey } from "../app/server-case-protection";
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { caseReportReceiptBinding, type CaseReportOptions } from "../app/case-report";
import { REPORT_RENDERER_VERSION, type ReportReceiptV2 } from "../app/report-model";
import { REPORT_GRAPH_LAYOUT_SCHEMA_VERSION, REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION, REPORT_GRAPH_LAYOUT_RENDERER_VERSION } from "../app/report-graph-contract";
import { studioDeviceScope } from "../app/studio-device-storage";
import { parseStudioReportHistoryPage, parseStudioReportHistoryRecord } from "../app/studio-report-history";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";

// Real password-login, auth resolver, route, report binding, and migrated D1.
// Only runtime transport is adapted. Fixture users and saved artifacts are seeded;
// sessions are created exclusively through the ordinary password login route.
type Route = { GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response>; DELETE(request: Request): Promise<Response> };
const storage = new AsyncLocalStorage<Request>();
const globals = globalThis as unknown as { __history_env: { DB: D1Database }; __history_headers(): Headers; __history_tax_runtime: typeof loadNodeTaxRuntime };
let mf: Miniflare, d1: D1Database, routes: { history: Route; login: Route; me: Route };
let beforeWrite: (() => Promise<void>) | undefined;
let beforeHistoryRead: (() => Promise<void>) | undefined;
let credential: PasswordCredential;
const password = "Synthetic-history-QA-27!";
const emails = { owner: "history-owner@example.test", shared: "history-shared@example.test", foreign: "history-foreign@example.test" };
const cookies: Record<string, string> = {}, scopes: Record<string, string> = {};
const draft = normalizeStudioDraft({ ...JSON.parse(readFileSync("tests/fixtures/fiveflats-rent-146000.studio-draft.json", "utf8")), caseId: "synthetic_receipt_history", title: "Synthetic receipt history fixture", version: "1.0.0" });
const fp = caseFingerprint(draft), pub = casePublicationFingerprint(draft);
let sequence = 0;
function payload(actor = "owner", overrides: Partial<CaseReportOptions> = {}) {
  const options: CaseReportOptions = { language: "en", presentationMode: "decision", includeDecisionTree: false, profileId: "tax_position_memorandum", profileLabel: "Tax position memorandum", audience: "internal", confidentiality: "confidential", preparedBy: "Synthetic QA", preparedFor: "", matterReference: "", includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: false,
    generatedAt: new Date(Date.UTC(2026, 8, 27, 12, 0, sequence++)).toISOString(), currentFingerprint: fp, workspaceFingerprint: fp, currentPublicationFingerprint: pub, workspacePublicationFingerprint: pub, privateCase: false, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false, ...overrides };
  const binding = caseReportReceiptBinding(draft, options);
  const receipt: ReportReceiptV2 = { receiptSchemaVersion: 2, caseId: draft.caseId, caseVersion: draft.version, profileId: options.profileId, rendererVersion: REPORT_RENDERER_VERSION, caseFingerprint: fp, reportFingerprint: binding.reportFingerprint, generatedAt: options.generatedAt, status: options.status ?? "draft", audience: options.audience, layoutSchemaVersion: REPORT_GRAPH_LAYOUT_SCHEMA_VERSION, layoutAlgorithmVersion: REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION, layoutRendererVersion: REPORT_GRAPH_LAYOUT_RENDERER_VERSION, layoutFingerprint: binding.layoutFingerprint, presentationFingerprint: binding.presentationFingerprint };
  return { customCaseId: 1, expectedScope: scopes[actor], receipt, options };
}
async function call(actor: string | null, method = "GET", body?: unknown, query = "", headerOverrides: Record<string, string> = {}) {
  const headers = new Headers({ origin: "https://history.test", "sec-fetch-site": "same-origin", ...headerOverrides });
  if (actor) headers.set("cookie", cookies[actor]);
  if (body !== undefined) headers.set("content-type", "application/json");
  const suffix = query || `?customCaseId=1&expectedScope=${scopes[actor ?? "owner"]}`;
  const request = new Request("https://history.test/api/custom-cases/report-receipts" + suffix, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return storage.run(request, () => routes.history[method as "GET" | "POST"](request));
}
async function read(response: Response, status = 200) {
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/); return value;
}
async function readPage(response: Response) {
  const page = parseStudioReportHistoryPage(await read(response)); assert.ok(page); return page;
}
function readRecorded(value: unknown) {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  const data = value as Record<string, unknown>;
  assert.equal(typeof data.alreadyRecorded, "boolean");
  const record = parseStudioReportHistoryRecord(data.record); assert.ok(record); return record;
}
async function count() { return (await d1.prepare("select count(*) as n from audit_events where event_type='studio_report_download_started'").first<{n:number}>())!.n; }
async function grantShared() { await d1.prepare("insert into custom_case_grants(custom_case_id,recipient_email,granted_by_email) values(1,?,?)").bind(emails.shared, emails.owner).run(); }
async function provision(actor: keyof typeof emails) {
  const email = emails[actor];
  await d1.prepare("insert into users(email,display_name) values(?,?)").bind(email, "Synthetic " + actor).run();
  await d1.prepare("insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)").bind(email, credential.hash, credential.salt, credential.iterations, "2026-01-01T00:00:00.000Z").run();
  const request = new Request("https://history.test/api/auth/login", { method: "POST", headers: { origin: "https://history.test", "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const response = await storage.run(request, () => routes.login.POST(request));
  await read(response); cookies[actor] = response.headers.get("set-cookie")!.split(";")[0]; scopes[actor] = (await studioDeviceScope(email))!;
}
before(async () => {
  mf = new Miniflare({ workers: [{ config: { name: "receipt-history", type: "worker", compatibilityDate: "2026-09-01", manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } }, env: { DB: { type: "d1", name: "receipt-history" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "receipt-history") as unknown as D1Database;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) await d1.batch(readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean).map(s => d1.prepare(s)));
  globals.__history_env = { DB: new Proxy(d1, { get(target, key) {
    if (key === "prepare") return (query: string) => {
      const wrap = (statement: D1PreparedStatement): D1PreparedStatement => new Proxy(statement, { get(s, k) {
        if (k === "bind") return (...args: unknown[]) => wrap(s.bind(...args));
        const value = Reflect.get(s, k, s);
        if (typeof value === "function" && ["run", "all", "raw"].includes(String(k))) return async (...args: unknown[]) => {
          if (/insert into audit_events\(/i.test(query)) { const hook = beforeWrite; beforeWrite = undefined; await hook?.(); }
          if (/^select .* from "audit_events"/i.test(query)) { const hook = beforeHistoryRead; beforeHistoryRead = undefined; await hook?.(); }
          return value.apply(s, args);
        };
        return typeof value === "function" ? value.bind(s) : value;
      } });
      return wrap(target.prepare(query));
    };
    const value = Reflect.get(target, key, target); return typeof value === "function" ? value.bind(target) : value;
  } }) };
  globals.__history_headers = () => storage.getStore()!.headers;
  globals.__history_tax_runtime = loadNodeTaxRuntime;
  const built = await build({ stdin: { contents: "export * as history from './app/api/custom-cases/report-receipts/route.ts'; export * as login from './app/api/auth/login/route.ts'; export * as me from './app/api/me/route.ts';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022", plugins: [{ name: "history-runtime", setup(b) {
    b.onResolve({ filter: /tax-runtime\/worker$/ }, () => ({ path: "tax-worker", namespace: "history-tax-runtime" }));
    b.onLoad({ filter: /.*/, namespace: "history-tax-runtime" }, () => ({ contents: "export const loadWorkerTaxRuntime=()=>globalThis.__history_tax_runtime()" }));
    b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "history-runtime" }));
    b.onLoad({ filter: /.*/, namespace: "history-runtime" }, args => ({ contents: args.path === "cloudflare:workers" ? "export const env=globalThis.__history_env" : args.path === "next/headers" ? "export async function headers(){return globalThis.__history_headers()}" : "export function redirect(){throw new Error('unexpected redirect')}" }));
  } }] });
  mkdirSync(".artifacts/report-history-tests", { recursive: true });
  const path = resolve(".artifacts/report-history-tests/routes.mjs"); writeFileSync(path, built.outputFiles[0].text); routes = await import(pathToFileURL(path).href);
  credential = await createPasswordCredential(password);
  for (const actor of Object.keys(emails) as Array<keyof typeof emails>) await provision(actor);
  await d1.prepare("insert into custom_cases(id,owner_email,case_id,title,current_version,fingerprint) values(1,?,?,?,?,?)").bind(emails.owner, draft.caseId, draft.title, draft.version, fp).run();
  await d1.prepare("insert into case_drafts(custom_case_id,user_email,case_id,version,fingerprint,title,payload) values(1,?,?,?,?,?,?)").bind(emails.owner, draft.caseId, draft.version, fp, draft.title, JSON.stringify(draft)).run();
  await grantShared();
});
after(async () => { await mf?.dispose(); });

test("real login records one exact receipt across simultaneous retries and reload pagination", async () => {
  const body = payload();
  const responses = await Promise.all([call("owner", "POST", body), call("owner", "POST", body)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  const results = (await Promise.all(responses.map(r => r.json()))).map(readRecorded);
  assert.equal(results[0].id, results[1].id); assert.equal(await count(), 1);
  assert.deepEqual(results[0].receipt, body.receipt);
  for (const options of [{ presentationMode: "medium", includeDecisionTree: false }, { presentationMode: "full", includeDecisionTree: false }] as const) await read(await call("owner", "POST", payload("owner", options)), 201);
  const first = await readPage(await call("owner", "GET", undefined, `?customCaseId=1&expectedScope=${scopes.owner}&limit=2`));
  assert.ok(parseStudioReportHistoryPage(first)); assert.equal(first.receipts.length, 2); assert.equal(first.receipts[1].format.includeDecisionTree, true);
  const second = await readPage(await call("owner", "GET", undefined, `?customCaseId=1&expectedScope=${scopes.owner}&limit=2&cursor=${first.nextCursor}`));
  assert.equal(second.receipts.length, 1); assert.equal(second.nextCursor, null); assert.notEqual(first.receipts[0].id, second.receipts[0].id);
});
test("account scope, ordinary grants, private visibility, and cross-site checks fail closed", async () => {
  await read(await call(null), 401); await read(await call("foreign"), 404); await read(await call("foreign", "POST", payload("foreign")), 404);
  await read(await call("shared", "POST", payload("owner")), 409);
  await read(await call("owner", "POST", payload(), "", { origin: "https://foreign.test", "sec-fetch-site": "cross-site" }), 403);
  assert.deepEqual((await readPage(await call("shared"))).receipts, []);
  await read(await call("shared", "POST", payload("shared")), 201);
  assert.equal((await readPage(await call("shared"))).receipts.length, 1);
  assert.equal((await readPage(await call("owner"))).receipts.length, 3);
  await d1.prepare("update custom_cases set is_private=1 where id=1").run();
  await read(await call("shared"), 404); await read(await call("shared", "POST", payload("shared")), 404);
  await read(await call("owner", "POST", payload("owner", { privateCase: true })), 201);
  await d1.prepare("update custom_cases set is_private=0 where id=1").run();
});
test("strict payload and exact renderer/options/version bindings reject fabricated receipts", async () => {
  const before = await count();
  for (const mutate of [
    (b: ReturnType<typeof payload>) => { (b.receipt as unknown as Record<string, unknown>).approved = true; },
    (b: ReturnType<typeof payload>) => { b.options.preparedBy = "x".repeat(513); },
    (b: ReturnType<typeof payload>) => { b.options.reportReceiptStorageScope = scopes.owner; },
  ]) { const b = payload(); mutate(b); await read(await call("owner", "POST", b), 400); }
  for (const mutate of [
    (b: ReturnType<typeof payload>) => { b.receipt.caseVersion = "9.0.0"; },
    (b: ReturnType<typeof payload>) => { b.receipt.rendererVersion = "0.0.1"; },
    (b: ReturnType<typeof payload>) => { b.receipt.presentationFingerprint = "sha256-" + "0".repeat(64); },
    (b: ReturnType<typeof payload>) => { b.options.preparedFor = "Different rendered recipient"; },
    (b: ReturnType<typeof payload>) => { b.options.workspacePublicationFingerprint = null; },
  ]) { const b = payload(); mutate(b); await read(await call("owner", "POST", b), 409); }
  assert.equal(await count(), before);
  await read(await call("owner", "GET", undefined, `?customCaseId=1&expectedScope=${scopes.owner}&limit=51`), 400);
});
test("write boundary rejects a grant removed and recreated after validation", async () => {
  const before = await count();
  beforeWrite = async () => { await d1.prepare("delete from custom_case_grants where custom_case_id=1").run(); await grantShared(); };
  await read(await call("shared", "POST", payload("shared")), 409); assert.equal(beforeWrite, undefined); assert.equal(await count(), before);
});
test("write boundary rejects saved payload changes including unchanged canonical fingerprint", async () => {
  const before = await count();
  beforeWrite = async () => { await d1.prepare("update case_drafts set payload=json_set(payload,'$.premisePublication','unreviewed') where custom_case_id=1").run(); };
  await read(await call("owner", "POST", payload()), 409); assert.equal(beforeWrite, undefined); assert.equal(await count(), before);
  await d1.prepare("update case_drafts set payload=? where custom_case_id=1").bind(JSON.stringify(draft)).run();
});
test("historical receipts retain original version after saved-case advancement", async () => {
  const old = await readPage(await call("owner"));
  const next = { ...draft, version: "1.0.1" }, nextFp = caseFingerprint(next);
  await d1.prepare("update custom_cases set current_version=?,fingerprint=? where id=1").bind(next.version, nextFp).run();
  await d1.prepare("update case_drafts set version=?,fingerprint=?,payload=? where custom_case_id=1").bind(next.version, nextFp, JSON.stringify(next)).run();
  await read(await call("owner", "POST", payload()), 409);
  assert.deepEqual((await readPage(await call("owner"))).receipts, old.receipts);
  await d1.prepare("update custom_cases set current_version=?,fingerprint=? where id=1").bind(draft.version, fp).run();
  await d1.prepare("update case_drafts set version=?,fingerprint=?,payload=? where custom_case_id=1").bind(draft.version, fp, JSON.stringify(draft)).run();
});
test("history read surfaces a late grant revoke as conflict rather than empty success", async () => {
  beforeHistoryRead = async () => { await d1.prepare("delete from custom_case_grants where custom_case_id=1").run(); };
  await read(await call("shared"), 409); assert.equal(beforeHistoryRead, undefined); await grantShared();
});
test("valid sealed protection permits owner history and rejects shared export", async () => {
  const protection = await buildCaseProtection({ caseId: draft.caseId, version: draft.version, studioFingerprint: fp, parentCaseId: draft.parent?.caseId ?? null, parentVersion: draft.parent?.version ?? null, parentFingerprint: draft.parent?.fingerprint ?? null, parentCode: null, copyPolicy: "lineage_locked" }, await getOrCreateCaseProtectionKey(drizzle(d1, { schema })));
  const protectedDraft = { ...draft, protection };
  assert.equal(caseFingerprint(protectedDraft), fp);
  await d1.prepare("update case_drafts set payload=? where custom_case_id=1").bind(JSON.stringify(protectedDraft)).run();
  await read(await call("shared"), 404); await read(await call("shared", "POST", payload("shared")), 404);
  const body = payload(); Object.assign(body.receipt, caseReportReceiptBinding(protectedDraft, body.options));
  await read(await call("owner", "POST", body), 201);
  await d1.prepare("update case_drafts set payload=? where custom_case_id=1").bind(JSON.stringify({ ...protectedDraft, protection: { ...protection, seal: "hmac-sha256-" + "0".repeat(64) } })).run();
  await read(await call("owner"), 409);
  await d1.prepare("update case_drafts set payload=? where custom_case_id=1").bind(JSON.stringify(draft)).run();
});
test("ordinary account deletion removes its receipts and recreation cannot inherit retained old-actor rows", async () => {
  const previous = await d1.prepare("select * from audit_events where event_type='studio_report_download_started' and actor_email=?").bind(emails.shared).first<{detail:string;created_at:string;actor_email:string;event_type:string;object_type:string;object_id:string}>();
  assert.ok(previous);
  const request = new Request("https://history.test/api/me", { method: "DELETE", headers: { origin: "https://history.test", "sec-fetch-site": "same-origin", cookie: cookies.shared } });
  await read(await storage.run(request, () => routes.me.DELETE(request)));
  assert.equal((await d1.prepare("select count(*) as n from audit_events where actor_email=?").bind(emails.shared).first<{n:number}>())!.n, 0);
  await read(await call("shared"), 401);
  await provision("shared"); await grantShared();
  assert.deepEqual((await readPage(await call("shared"))).receipts, []);
  // Deliberately restore the old actor's fixture row to prove identity scoping
  // even if historical metadata survives an out-of-band account deletion.
  await d1.prepare("insert into audit_events(actor_email,event_type,object_type,object_id,detail,created_at) values(?,?,?,?,?,?)").bind(previous.actor_email, previous.event_type, previous.object_type, previous.object_id, previous.detail, previous.created_at).run();
  assert.deepEqual((await readPage(await call("shared"))).receipts, []);
});
test("late session revocation cannot persist a mismatched successful receipt", async () => {
  const before = await count();
  beforeWrite = async () => { await d1.prepare("update auth_sessions set revoked_at=? where account_id=(select id from local_accounts where user_email=?)").bind(new Date().toISOString(), emails.owner).run(); };
  await read(await call("owner", "POST", payload()), 409); assert.equal(beforeWrite, undefined); assert.equal(await count(), before);
  await read(await call("owner"), 401);
});
test("client parser rejects malformed records, false format metadata, and invalid pages", async () => {
  const b = payload(); const record = { id: 1, recordedAt: b.receipt.generatedAt, event: "client_report_download_started", receipt: b.receipt, format: { presentationMode: "full", includeDecisionTree: false } };
  assert.ok(parseStudioReportHistoryRecord(record));
  for (const changed of [{ ...record, event: "file_saved" }, { ...record, id: 0 }, { ...record, extra: true }, { ...record, format: { presentationMode: "medium", includeDecisionTree: false } }, { ...record, receipt: { ...record.receipt, generatedAt: "2026-99-99" } }]) assert.equal(parseStudioReportHistoryRecord(changed), null);
  assert.equal(parseStudioReportHistoryPage({ receipts: [record, record], nextCursor: null }), null);
  assert.equal(parseStudioReportHistoryPage({ receipts: [record], nextCursor: "2" }), null);
});
