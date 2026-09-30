import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { createPasswordCredential } from "../app/auth-crypto";
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { taxAttachmentDigest, type TaxAttachmentV1 } from "../app/tax-authoring";
import type { StudioDraft } from "../app/types";
import { buildCanopyPackage } from "../app/canopy-fixture";

// Ordinary password login + production routes + fully migrated D1. No mocked
// authorization, tax mutation guard, SQL transaction, or financial execution.
type Route = { GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response> };
const storage = new AsyncLocalStorage<Request>();
const globals = globalThis as unknown as { __tax_preservation_env: { DB: D1Database; GENESIS_ADMIN_EMAILS: string }; __tax_preservation_headers(): Headers };
let mf: Miniflare, d1: D1Database, routes: { submissions: Route; custom: Route; login: Route; admin: Route; publish: Route; verify: Route };
let beforeBatch: (() => Promise<void>) | undefined;
const email = "tax-preservation-owner@example.test", password = "Synthetic-preservation-QA-27!";
const adminEmail = "tax-preservation-admin@example.test", sharedEmail = "tax-preservation-shared@example.test";
let cookie = "";
const fixture = JSON.parse(readFileSync("tests/fixtures/fiveflats-rent-146000.studio-draft.json", "utf8"));
const source = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-source.json", "utf8"));
const corpus = JSON.parse(readFileSync("tests/fixtures/tax-runtime/web-corpus.json", "utf8"));
const prepared = JSON.parse(corpus.cases.find((entry: { name: string }) => entry.name === "prepare").response);
const editFields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const attachment: TaxAttachmentV1 = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({
  schema: "web-tax-authoring-artifact-v1", source: source.descriptor, request: prepared.request,
  edit: Object.fromEntries(editFields.map(key => [key, "unfinished"])), bindings: [], benefits: [], required_component_ids: [], rates_confirmed: false,
  legacy_documents: [' {"exact":900719925474099312345} '], previous_source_documents: [],
}, null, "\t") + "\r\n" };
const initial = (caseId: string, attached = true) => normalizeStudioDraft({ ...fixture, caseId, title: "Synthetic preservation", ...(attached ? { taxAnalysis: attachment } : {}) });
async function call(body: unknown, raw = false) {
  const request = new Request("https://preservation.test/api/submissions", { method: "POST", headers: { origin: "https://preservation.test", "sec-fetch-site": "same-origin", "content-type": "application/json", cookie }, body: raw ? String(body) : JSON.stringify(body) });
  return storage.run(request, () => routes.submissions.POST(request));
}
async function stored(caseId: string) {
  const record = await d1.prepare("select payload,fingerprint from case_drafts where case_id=? order by id desc limit 1").bind(caseId).first<{ payload: string; fingerprint: string }>();
  assert.ok(record); return { ...record, draft: JSON.parse(record.payload) as StudioDraft };
}
const mutation = async (before: unknown) => ({ protocol: "web-tax-attachment-write-v1", expected: await taxAttachmentDigest(before) });
async function updateBody(before: StudioDraft, after = before) {
  return { action: "save", draft: after, expectedFingerprint: caseFingerprint(before), expectedPublicationFingerprint: casePublicationFingerprint(before), taxAttachmentMutation: await mutation(before.taxAnalysis) };
}
async function expect(response: Response, status: number) {
  const body = await response.json() as { customCase: { id: number }; recovery: { rawText?: string; canExport: boolean }; submission: { payload?: unknown; recovery: { rawText?: string; canExport: boolean } }; draft?: unknown; valid: boolean; canDuplicate: boolean };
  assert.equal(response.status, status, JSON.stringify(body)); return body;
}
async function requestRoute(route: Route, method: "GET" | "POST", path: string, body?: unknown, actor: "owner" | "shared" | "admin" | "foreign" = "owner") {
  // Non-owner actors enter at the existing trusted-provider header boundary;
  // owner tests use a real ordinary local password session. No route auth is stubbed.
  const headers = { origin: "https://preservation.test", "sec-fetch-site": "same-origin", "content-type": "application/json", ...(actor === "owner" ? { cookie } : { "oai-authenticated-user-email": actor === "admin" ? adminEmail : actor === "shared" ? sharedEmail : "foreign@example.test" }) };
  const request = new Request(`https://preservation.test${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return storage.run(request, () => route[method](request));
}
before(async () => {
  mf = new Miniflare({ workers: [{ config: { name: "tax-preservation", type: "worker", compatibilityDate: "2026-09-01", manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } }, env: { DB: { type: "d1", name: "tax-preservation" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "tax-preservation") as unknown as D1Database;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) await d1.batch(readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map((text: string) => text.trim()).filter(Boolean).map((text: string) => d1.prepare(text)));
  globals.__tax_preservation_env = { GENESIS_ADMIN_EMAILS: adminEmail, DB: new Proxy(d1, { get(target, key) {
    if (key === "batch") return async (statements: D1PreparedStatement[]) => { const hook = beforeBatch; beforeBatch = undefined; await hook?.(); return target.batch(statements); };
    const value = Reflect.get(target, key, target); return typeof value === "function" ? value.bind(target) : value;
  } }) };
  globals.__tax_preservation_headers = () => storage.getStore()!.headers;
  const built = await build({ stdin: { contents: "export * as submissions from './app/api/submissions/route.ts'; export * as custom from './app/api/custom-cases/route.ts'; export * as login from './app/api/auth/login/route.ts'; export * as admin from './app/api/admin/submissions/route.ts'; export * as publish from './app/api/admin/cases/route.ts'; export * as verify from './app/api/case-protection/verify/route.ts';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022", plugins: [{ name: "tax-preservation-runtime", setup(b) {
    b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "tax-preservation-runtime" }));
    b.onLoad({ filter: /.*/, namespace: "tax-preservation-runtime" }, args => ({ contents: args.path === "cloudflare:workers" ? "export const env=globalThis.__tax_preservation_env" : args.path === "next/headers" ? "export async function headers(){return globalThis.__tax_preservation_headers()}" : "export function redirect(){throw new Error('unexpected redirect')}" }));
  } }] });
  mkdirSync(".artifacts/tax-preservation-routes", { recursive: true });
  const path = resolve(".artifacts/tax-preservation-routes/routes.mjs"); writeFileSync(path, built.outputFiles[0].text); routes = await import(pathToFileURL(path).href);
  const credential = await createPasswordCredential(password);
  await d1.prepare("insert into users(email,display_name) values(?,?)").bind(email, "Synthetic preservation").run();
  await d1.prepare("insert into local_accounts(user_email,password_hash,password_salt,password_iterations,password_changed_at) values(?,?,?,?,?)").bind(email, credential.hash, credential.salt, credential.iterations, "2026-01-01T00:00:00.000Z").run();
  const request = new Request("https://preservation.test/api/auth/login", { method: "POST", headers: { origin: "https://preservation.test", "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const response = await storage.run(request, () => routes.login.POST(request)); await expect(response, 200); cookie = response.headers.get("set-cookie")!.split(";")[0];
});
after(async () => { await mf?.dispose(); });

test("new tax writes require explicit capability and complete-carrier expected digest; legacy writes remain valid", async () => {
  const draft = initial("tax_guard_create");
  await expect(await call({ action: "save", draft }), 409);
  assert.equal(await d1.prepare("select count(*) n from case_drafts where case_id=?").bind(draft.caseId).first("n"), 0);
  await expect(await call({ action: "save", draft, taxAttachmentMutation: await mutation(undefined) }), 200);
  assert.equal((await stored(draft.caseId)).draft.taxAnalysis?.document, attachment.document);
  await expect(await call({ action: "save", draft: initial("legacy_guard_create", false) }), 200);
});

test("old-client omission and stale carrier hash fail even with valid case fingerprints", async () => {
  const before = await stored("tax_guard_create"), omitted = { ...before.draft }; delete omitted.taxAnalysis;
  const old = await updateBody(before.draft, omitted); delete (old as { taxAttachmentMutation?: unknown }).taxAttachmentMutation;
  await expect(await call(old), 409);
  await expect(await call({ ...await updateBody(before.draft), taxAttachmentMutation: await mutation(undefined) }), 409);
  assert.equal((await stored(before.draft.caseId)).payload, before.payload);
  const after = { ...before.draft, taxAnalysis: { ...attachment, document: attachment.document + " " } };
  await expect(await call(await updateBody(before.draft, after)), 200);
  assert.equal((await stored(before.draft.caseId)).draft.taxAnalysis?.document, after.taxAnalysis.document);
});

test("child and fork cannot omit the exact resolved parent's attachment", async () => {
  const { draft: parent } = await stored("tax_guard_create");
  for (const fork of [false, true]) {
    const child = { ...parent, caseId: fork ? "tax_guard_fork" : parent.caseId, version: fork ? "1.0.0" : "1.0.1", parent: { caseId: parent.caseId, version: parent.version, fingerprint: caseFingerprint(parent) } };
    delete child.taxAnalysis;
    const body = { action: "save", draft: child, baseFingerprint: caseFingerprint(parent), basePublicationFingerprint: casePublicationFingerprint(parent) };
    await expect(await call(body), 409);
    await expect(await call({ ...body, draft: { ...child, taxAnalysis: parent.taxAnalysis }, taxAttachmentMutation: await mutation(parent.taxAnalysis) }), 200);
  }
});

test("final database CAS rejects carrier changes after asynchronous validation without overwriting them", async () => {
  const before = await stored("tax_guard_fork");
  const concurrent = JSON.stringify({ ...before.draft, taxAnalysis: { ...before.draft.taxAnalysis, document: before.draft.taxAnalysis!.document + "\n" } });
  beforeBatch = async () => { await d1.prepare("update case_drafts set payload=? where case_id=?").bind(concurrent, before.draft.caseId).run(); };
  await expect(await call(await updateBody(before.draft, { ...before.draft, title: "Must not overwrite concurrent tax bytes" })), 409);
  assert.equal((await stored(before.draft.caseId)).payload, concurrent);
});

test("unsupported stored carriers and duplicate incoming keys remain unmodified", async () => {
  const before = await stored("tax_guard_fork");
  const future = before.payload.replace('"carrierVersion":1', '"carrierVersion":999,"future":900719925474099312345');
  assert.notEqual(future, before.payload);
  await d1.prepare("update case_drafts set payload=? where case_id=?").bind(future, before.draft.caseId).run();
  const omitted = { ...before.draft }; delete omitted.taxAnalysis;
  await expect(await call(await updateBody(before.draft, omitted)), 409);
  assert.equal((await stored(before.draft.caseId)).payload, future);
  const body = JSON.stringify({ action: "save", draft: initial("tax_duplicate") }).replace('"carrierVersion":1', '"carrierVersion":999,"carrierVersion":1');
  await expect(await call(body, true), 400);
});

test("future draft fields and invalid UTF-8 cannot be normalized into a successful write", async () => {
  const draft = initial("tax_future_input");
  for (const extra of [{ futureField: { amount: "900719925474099312345" } }, { schemaVersion: 99 }]) {
    await expect(await call({ action: "save", draft: { ...draft, ...extra }, taxAttachmentMutation: await mutation(undefined) }), 409);
  }
  const nested = structuredClone(draft) as unknown as Record<string, unknown>;
  (nested.nodes as Record<string, unknown>[])[0].futureField = "retain exactly";
  await expect(await call({ action: "save", draft: nested, taxAttachmentMutation: await mutation(undefined) }), 409);
  const body = new TextEncoder().encode(JSON.stringify({ action: "save", draft, taxAttachmentMutation: await mutation(undefined) }));
  const marker = new TextEncoder().encode("unfinished");
  const offset = body.findIndex((_, index) => marker.every((byte, at) => body[index + at] === byte));
  assert.ok(offset > 0); body[offset] = 0xff;
  const request = new Request("https://preservation.test/api/submissions", { method: "POST", headers: { origin: "https://preservation.test", "sec-fetch-site": "same-origin", "content-type": "application/json", cookie }, body });
  await expect(await storage.run(request, () => routes.submissions.POST(request)), 400);
  assert.equal(await d1.prepare("select count(*) n from case_drafts where case_id=?").bind(draft.caseId).first("n"), 0);
});

test("authorized recovery retains SQL TEXT exactly; private/shared/admin paths cannot gain raw export", async () => {
  const row = await d1.prepare("select id,custom_case_id,payload from case_drafts where case_id='tax_guard_fork'").first<{ id: number; custom_case_id: number; payload: string }>(); assert.ok(row);
  const path = `/api/custom-cases?id=${row.custom_case_id}`;
  const own = await expect(await requestRoute(routes.custom, "GET", path), 200);
  assert.equal(own.recovery.rawText, row.payload); assert.equal(own.recovery.canExport, true); assert.equal(own.draft, undefined);
  await expect(await requestRoute(routes.custom, "GET", path, undefined, "foreign"), 404);
  await d1.prepare("insert into custom_case_grants(custom_case_id,recipient_email,granted_by_email) values(?,?,?)").bind(row.custom_case_id, sharedEmail, email).run();
  for (const actor of ["shared", "admin"] as const) {
    const response = await expect(await requestRoute(routes.custom, "GET", path, undefined, actor), 200);
    assert.equal(response.recovery.canExport, false); assert.equal(response.recovery.rawText, undefined);
  }
  await d1.prepare("update custom_cases set is_private=1 where id=?").bind(row.custom_case_id).run();
  for (const actor of ["shared", "admin"] as const) await expect(await requestRoute(routes.custom, "GET", path, undefined, actor), 404);
  const malformed = '{"taxAnalysis":{BROKEN, "unknown":900719925474099312345';
  await d1.prepare("update case_drafts set payload=? where id=?").bind(malformed, row.id).run();
  assert.equal((await expect(await requestRoute(routes.custom, "GET", path), 200)).recovery.rawText, malformed);
  await d1.prepare("update custom_cases set is_private=0 where id=?").bind(row.custom_case_id).run();
  await d1.prepare("update case_drafts set payload=?,status='submitted' where id=?").bind(row.payload, row.id).run();
  const reviewed = await expect(await requestRoute(routes.admin, "GET", `/api/admin/submissions?id=${row.id}`, undefined, "admin"), 200);
  assert.equal(reviewed.submission.payload, undefined); assert.equal(reviewed.submission.recovery.canExport, false); assert.equal(reviewed.submission.recovery.rawText, undefined);
  await expect(await requestRoute(routes.admin, "POST", "/api/admin/submissions", { id: row.id, status: "accepted", reviewerNote: "Must not accept unsupported data" }, "admin"), 409);
  assert.equal(await d1.prepare("select status from case_drafts where id=?").bind(row.id).first("status"), "submitted");
  const verification = await expect(await requestRoute(routes.verify, "POST", "/api/case-protection/verify", { draft: JSON.parse(row.payload) }), 200);
  assert.equal(verification.valid, false); assert.equal(verification.canDuplicate, false); assert.equal(verification.recovery.rawText, undefined);
});

test("publication retains the complete attachment and fails atomically if source privacy changes", async () => {
  const draft = normalizeStudioDraft({ ...buildCanopyPackage("base").draft, caseId: "tax_publication_source", premisePublication: "author-reviewed", taxAnalysis: attachment });
  const saved = await expect(await call({ action: "save", draft, taxAttachmentMutation: await mutation(undefined) }), 200);
  const storedDraft = await stored(draft.caseId);
  const body = { draft: storedDraft.draft, customCaseId: saved.customCase.id, authorName: "Synthetic author", reviewerName: "Synthetic reviewer", reviewLevel: "community_beta", taxAttachmentMutation: await mutation(attachment) };
  beforeBatch = async () => { await d1.prepare("update custom_cases set is_private=1 where id=?").bind(saved.customCase.id).run(); };
  await expect(await requestRoute(routes.publish, "POST", "/api/admin/cases", body, "admin"), 409);
  assert.equal(await d1.prepare("select count(*) n from case_versions where case_id=?").bind(draft.caseId).first("n"), 0);
  assert.equal(await d1.prepare("select count(*) n from cases where id=?").bind(draft.caseId).first("n"), 0);
  await d1.prepare("update custom_cases set is_private=0 where id=?").bind(saved.customCase.id).run();
  await expect(await requestRoute(routes.publish, "POST", "/api/admin/cases", body, "admin"), 201);
  const published = await d1.prepare("select payload from case_versions where case_id=?").bind(draft.caseId).first<string>("payload"); assert.ok(published);
  assert.equal(JSON.parse(published).studioDraft.taxAnalysis.document, attachment.document);
});

test('malformed retained payload must remain listable for recovery', async () => {
    const unlocked=initial('tax_review_list_unlocked',false);
  await expect(await call({action:'save',draft:unlocked}),200);
  const locked=initial('tax_review_list_locked',false);
  await expect(await call({action:'save',draft:locked}),200);
  const previous=(await stored(locked.caseId)).draft;
  const child={...previous,version:'2.0.1',parent:{caseId:previous.caseId,version:previous.version,fingerprint:caseFingerprint(previous)}};
  const lockedSaved=await expect(await call({action:'save',draft:child,copyProtected:true,baseFingerprint:caseFingerprint(previous),basePublicationFingerprint:casePublicationFingerprint(previous)}),200);
  const lockedRow=await d1.prepare('select id,custom_case_id from case_drafts where case_id=? and version=?').bind(child.caseId,child.version).first<{id:number;custom_case_id:number}>();
  assert.ok(lockedRow);assert.notEqual(lockedRow.id,lockedRow.custom_case_id,'Deliberately distinguish inner draft and outer envelope IDs');
  const ordinaryList=await requestRoute(routes.custom,'GET','/api/custom-cases');
  assert.equal(ordinaryList.status,200);
  const ordinaryBody=await ordinaryList.json() as {customCases:{id:number;caseId:string;copyProtected:boolean}[]};
  assert.equal(ordinaryBody.customCases.find(row=>row.id===lockedSaved.customCase.id)?.copyProtected,true);
  assert.equal(ordinaryBody.customCases.find(row=>row.caseId===unlocked.caseId)?.copyProtected,false);
  const draft = initial('tax_review_list_corrupt');
  await expect(await call({ action:'save', draft, taxAttachmentMutation:await mutation(undefined) }),200);
  await d1.prepare('update case_drafts set payload=? where case_id=?').bind('{broken: retained original',draft.caseId).run();
  const response=await requestRoute(routes.custom,'GET','/api/custom-cases');
    const listing=await response.clone().json() as {customCases:{caseId:string;copyProtected:boolean}[]};
  assert.equal(listing.customCases.find(row=>row.caseId===draft.caseId)?.copyProtected,true);
  assert.ok(!JSON.stringify(listing).includes('{broken: retained original'),'list does not disclose raw recovery text');
    assert.equal(response.status,200,'retained corrupt rows must not break workspace listing');
  for(const raw of ['[]','null','"unknown"','{"protection":{"kind":"future"}}']) {
    await d1.prepare('update case_drafts set payload=? where case_id=?').bind(raw,draft.caseId).run();
    const result=await requestRoute(routes.custom,'GET','/api/custom-cases');
    assert.equal(result.status,200);
    const listed=await result.json() as {customCases:{caseId:string;copyProtected:boolean}[]};
    assert.equal(listed.customCases.find(row=>row.caseId===draft.caseId)?.copyProtected,true,raw);
  }
});

test('publication must refuse a concurrently advanced source version', async () => {
  const draft=normalizeStudioDraft({...buildCanopyPackage('base').draft,caseId:'tax_review_publish_race',premisePublication:'author-reviewed',taxAnalysis:attachment});
  const saved=await expect(await call({action:'save',draft,taxAttachmentMutation:await mutation(undefined)}),200);
  const previous=await stored(draft.caseId);
  const next={...previous.draft,version:'2.0.1',parent:{caseId:draft.caseId,version:previous.draft.version,fingerprint:caseFingerprint(previous.draft)}};
  beforeBatch=async()=>{
    await expect(await call({action:'save',draft:next,baseFingerprint:caseFingerprint(previous.draft),basePublicationFingerprint:casePublicationFingerprint(previous.draft),taxAttachmentMutation:await mutation(previous.draft.taxAnalysis)}),200);
  };
  const body={draft:previous.draft,customCaseId:saved.customCase.id,authorName:'Synthetic author',reviewerName:'Synthetic reviewer',reviewLevel:'community_beta',taxAttachmentMutation:await mutation(attachment)};
  const response=await requestRoute(routes.publish,'POST','/api/admin/cases',body,'admin');
  await response.json();

  assert.equal(response.status,409,'source current version changed before batch');
  assert.equal(await d1.prepare('select count(*) n from case_versions where case_id=?').bind(draft.caseId).first('n'),0);
});
