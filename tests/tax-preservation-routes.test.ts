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
import { buildCanopyPackage, CANOPY_SCENARIOS } from "../app/canopy-fixture";
import { buildConvertedExample, CONVERTED_EXAMPLES } from '../app/converted-examples';
import { createExampleWorkingCopy } from '../app/example-working-copy';
import { verifiedStudioSaveReceipt } from '../app/studio-save-receipt';
import { studioOverview } from '../app/studio-overview';
import { buildCategoryDemo } from '../app/category-demo-draft';
import { CASE_TYPE_REGISTRY } from '../app/case-type-registry';

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

test('authorized Studio search filters before pagination with literal EN/RU metadata and query-bound cursors', async () => {
  // Local migrated D1 only. No production fixtures or case payloads are changed.
  const prefix='retrieval_20261020_';
  const foreign='foreign@example.test';
  await d1.prepare('insert into users(email,display_name) values(?,?)').bind(foreign,'Автор Поиска').run();
  const create=async (suffix:string,title:string,owner=email,privateCase=1,updated='2020-01-01 00:00:00') => {
    const row=await d1.prepare('insert into custom_cases(owner_email,case_id,title,current_version,fingerprint,is_private,updated_at) values(?,?,?,?,?,?,?) returning id').bind(owner,prefix+suffix,title,'1.0.0','synthetic-search-only',privateCase,updated).first<{id:number}>();
    assert.ok(row); return row.id;
  };
  const oldest=await create('oldest','Retrieval oldest NEEDLE');
  for(let index=0;index<28;index++) await create('new_'+index,'Retrieval recent '+index,email,1,'2021-01-01 00:00:00');
  const needle2=await create('second','Retrieval second needle');
  const punctuation=await create('punctuation',"Retrieval literal % _ * ? [ ] ' quote");
  const ru=await create('ru','Retrieval Аудит Договора Ёлка');
  const shared=await create('shared','Retrieval granted needle',foreign,0);
  const hidden=await create('hidden','Retrieval hidden needle',foreign,1);
  const ungranted=await create('ungranted','Retrieval ungranted needle',foreign,0);
  const longRu=await create('long_ru','Я'.repeat(120)+' A');
  const longRu2=await create('long_ru_2','Я'.repeat(120)+' B');
  await d1.prepare('insert into custom_case_grants(custom_case_id,recipient_email,granted_by_email) values(?,?,?)').bind(shared,email,foreign).run();
  const rows=async (query:string,actor:'owner'|'shared'|'admin'|'foreign'='owner',limit=25,cursor='') => {
    const response=await requestRoute(routes.custom,'GET',`/api/custom-cases?q=${encodeURIComponent(query)}&limit=${limit}`+(cursor?'&cursor='+encodeURIComponent(cursor):''),undefined,actor);
    assert.equal(response.status,200,await response.clone().text());
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    return await response.json() as {customCases:Array<{id:number;access:string;ownerDisplayName:string}>;nextCursor:string|null};
  };
  const unfiltered=await rows(''); assert.ok(!unfiltered.customCases.some(row=>row.id===oldest));
  const all=await rows('needle'); assert.deepEqual(all.customCases.map(row=>row.id),[shared,needle2,oldest]);
  const page1=await rows('NEEDLE','owner',1); assert.equal(page1.customCases[0].id,shared); assert.ok(page1.nextCursor);
  const page2=await rows('needle','owner',1,page1.nextCursor); assert.equal(page2.customCases[0].id,needle2); assert.ok(page2.nextCursor);
  const page3=await rows('needle','owner',1,page2.nextCursor); assert.equal(page3.customCases[0].id,oldest); assert.equal(page3.nextCursor,null);
  for(const query of ['other','']) assert.equal((await requestRoute(routes.custom,'GET','/api/custom-cases?q='+query+'&cursor='+page1.nextCursor)).status,400);
  assert.deepEqual((await rows('аУдИт дОгОвОрА ёЛкА')).customCases.map(row=>row.id),[ru]);
  for(const query of ['%','_ *','* ?','[ ]',"' quote"]) assert.deepEqual((await rows(query)).customCases.map(row=>row.id),[punctuation]);
  assert.deepEqual((await rows(prefix+'oldest')).customCases.map(row=>row.id),[oldest]);
  assert.ok((await rows(String(oldest),'owner',50)).customCases.some(row=>row.id===oldest));
  assert.deepEqual((await rows('#'+oldest)).customCases.map(row=>row.id),[oldest]);
  assert.deepEqual((await rows('#'+hidden)).customCases,[]);
  const ruPage=await rows('я'.repeat(120),'owner',1); assert.equal(ruPage.customCases[0].id,longRu2); assert.ok(ruPage.nextCursor);
  assert.deepEqual((await rows('Я'.repeat(120),'owner',1,ruPage.nextCursor)).customCases.map(row=>row.id),[longRu]);
  assert.deepEqual((await rows("' OR 1=1 --")).customCases,[]);
  assert.deepEqual((await rows('АВТОР ПОИСКА')).customCases.map(row=>row.id),[shared]);
  assert.equal((await rows(foreign)).customCases.length,0,'owner email is not a search field');
  assert.deepEqual((await rows('hidden')).customCases,[]);
  assert.deepEqual((await rows('needle','shared')).customCases,[]);
  const admin=await rows('needle','admin'); assert.ok(admin.customCases.some(row=>row.id===shared)); assert.ok(admin.customCases.some(row=>row.id===ungranted)); assert.ok(!admin.customCases.some(row=>row.id===hidden||row.id===oldest));
  const foreignRows=await rows('needle','foreign'); assert.ok(foreignRows.customCases.some(row=>row.id===hidden)); assert.ok(!foreignRows.customCases.some(row=>row.id===oldest));
  await d1.prepare('delete from custom_case_grants where custom_case_id=? and recipient_email=?').bind(shared,email).run();
  assert.deepEqual((await rows('АВТОР ПОИСКА')).customCases,[]);
  assert.deepEqual((await rows('needle','owner',25,page1.nextCursor)).customCases.map(row=>row.id),[needle2,oldest]);
  for(const query of ['x'.repeat(121),'line\nbreak','\u0000']) assert.equal((await requestRoute(routes.custom,'GET','/api/custom-cases?q='+encodeURIComponent(query))).status,400);
  assert.equal((await rows('x'.repeat(120))).customCases.length,0);
  // The legacy unfiltered cursor remains usable without a query.
  assert.ok(unfiltered.nextCursor); assert.ok((await rows('','owner',25,unfiltered.nextCursor)).customCases.some(row=>row.id===oldest));
  assert.equal((await d1.prepare('select count(*) as n from case_drafts where case_id like ?').bind(prefix+'%').first<{n:number}>())?.n,0,'search creates no draft payloads');
});

test('migrated examples survive real authenticated save, reopen, scenario amendment and stale writes', async () => {
  const examples = Object.keys(CONVERTED_EXAMPLES).map(id => buildConvertedExample(id, 'en'))
    .concat(CANOPY_SCENARIOS.map(scenario => buildCanopyPackage(scenario.id, true).draft))
    .concat(CASE_TYPE_REGISTRY.map(type => buildCategoryDemo(type.id, 'en')));
  for (const source of examples) {
    const existing = normalizeStudioDraft({ ...structuredClone(source), parent: null, title: 'Existing saved user work: ' + source.title });
    if (source.caseId in CONVERTED_EXAMPLES) existing.version = '2.1.0';
    if (source.caseId.startsWith('demo_')) {
      existing.version = '1.0.0';
      delete existing.nodes.find(node => node.id === 'fact-2')!.factStatus;
    }
    existing.nodes[0].detail += '\nPreviously saved independent notes.';
    const existingSave = await expect(await call({ action: 'save', draft: existing, isPrivate: true }), 200);
    const originalPayload = (await stored(existing.caseId)).payload;
    const originalEnvelope = await d1.prepare('select * from custom_cases where id=?').bind(existingSave.customCase.id).first();
    const earlier = source.caseId in CONVERTED_EXAMPLES ? normalizeStudioDraft({ ...structuredClone(existing), caseId: 'retained_20_' + source.caseId, version: '2.0.0' }) : null;
    const earlierSave = earlier ? await expect(await call({ action: 'save', draft: earlier, isPrivate: true }), 200) : null;
    const earlierPayload = earlier ? (await stored(earlier.caseId)).payload : null;
    const earlierEnvelope = earlierSave ? await d1.prepare('select * from custom_cases where id=?').bind(earlierSave.customCase.id).first() : null;
    const copies = [createExampleWorkingCopy(source), createExampleWorkingCopy(source)];
    const ids: number[] = [];
    for (const copy of copies) {
      const saved = await expect(await call({ action: 'save', draft: copy, isPrivate: true }), 200);
      assert.equal(verifiedStudioSaveReceipt(saved, copy, 'save')?.id, saved.customCase.id);
      ids.push(saved.customCase.id);
      const reopenedResponse = await expect(await requestRoute(routes.custom, 'GET', `/api/custom-cases?id=${saved.customCase.id}`), 200);
      const reopened = normalizeStudioDraft(reopenedResponse.draft);
      assert.equal(reopened.caseType?.id, source.caseType?.id);
      assert.equal(caseFingerprint(reopened), caseFingerprint(copy));
      assert.deepEqual(reopened.exampleSource, copy.exampleSource);
      assert.deepEqual(reopened.nodes.filter(node => node.type === 'evidence'), copy.nodes.filter(node => node.type === 'evidence'));
      if (source.caseId.startsWith('project_canopy')) {
        assert.equal(studioOverview(reopened, 'en').documentCount, 9);
        assert.equal(studioOverview(reopened, 'en').exactScenario, studioOverview(source, 'en').exactScenario);
      }
      const amended = structuredClone(reopened);
      amended.nodes.find(node => node.type === 'outcome')!.detail += '\nHypothetical review scenario: independent verification is still outstanding.';
      const updated = await expect(await call({ action: 'save', draft: amended, expectedFingerprint: caseFingerprint(reopened), expectedPublicationFingerprint: casePublicationFingerprint(reopened) }), 200);
      assert.equal(verifiedStudioSaveReceipt(updated, amended, 'save')?.id, saved.customCase.id);
      const currentPayload = (await stored(copy.caseId)).payload;
      await expect(await call({ action: 'save', draft: reopened, expectedFingerprint: caseFingerprint(reopened), expectedPublicationFingerprint: casePublicationFingerprint(reopened) }), 409);
      assert.equal((await stored(copy.caseId)).payload, currentPayload, 'a stale save cannot erase the scenario amendment');
      const finalResponse = await expect(await requestRoute(routes.custom, 'GET', `/api/custom-cases?id=${saved.customCase.id}`), 200);
      const final = normalizeStudioDraft(finalResponse.draft);
      assert.equal(caseFingerprint(final), caseFingerprint(amended));
      assert.deepEqual(final.exampleSource, copy.exampleSource);
      assert.deepEqual(final.nodes.filter(node => node.type === 'evidence'), copy.nodes.filter(node => node.type === 'evidence'));
      if (source.caseId.startsWith('project_canopy')) {
        assert.equal(studioOverview(final, 'en').recommendation.state, 'reassessment');
        assert.equal(studioOverview(final, 'en').documentCount, 9);
      }
      await expect(await requestRoute(routes.custom, 'GET', `/api/custom-cases?id=${saved.customCase.id}`, undefined, 'foreign'), 404);
    }
    assert.notEqual(ids[0], ids[1], 'repeated launches save as independent workspace envelopes');
    assert.equal((await stored(existing.caseId)).payload, originalPayload);
    assert.deepEqual(await d1.prepare('select * from custom_cases where id=?').bind(existingSave.customCase.id).first(), originalEnvelope);
    if (earlier && earlierSave) {
      assert.equal((await stored(earlier.caseId)).payload, earlierPayload);
      assert.deepEqual(await d1.prepare('select * from custom_cases where id=?').bind(earlierSave.customCase.id).first(), earlierEnvelope);
    }
  }
});

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

test("ordinary-case future fields require owner-only recovery and cannot be normalized into a write", async () => {
  const draft = createExampleWorkingCopy(buildCategoryDemo("general_advisory", "en"));
  const saved = await expect(await call({ action: "save", draft, isPrivate: true }), 200);
  const before = await stored(draft.caseId);
  const future = JSON.parse(before.payload);
  future.nodes[0].futureReview = { exact: "900719925474099312345" };
  const raw = JSON.stringify(future, null, "\t") + "\r\n";
  await d1.prepare("update case_drafts set payload=? where case_id=?").bind(raw, draft.caseId).run();
  const path = `/api/custom-cases?id=${saved.customCase.id}`;
  const owner = await expect(await requestRoute(routes.custom, "GET", path), 200);
  assert.equal(owner.recovery.rawText, raw); assert.equal(owner.recovery.canExport, true); assert.equal(owner.draft, undefined);
  await expect(await requestRoute(routes.custom, "GET", path, undefined, "foreign"), 404);
  await expect(await call({ action: "save", draft: before.draft, expectedFingerprint: caseFingerprint(before.draft), expectedPublicationFingerprint: casePublicationFingerprint(before.draft) }), 409);
  assert.equal((await stored(draft.caseId)).payload, raw);
  const incoming = createExampleWorkingCopy(buildCategoryDemo("general_advisory", "en"));
  Object.assign(incoming.nodes[0], { futureReview: { exact: "retain" } });
  await expect(await call({ action: "save", draft: incoming, isPrivate: true }), 409);
  assert.equal(await d1.prepare("select count(*) n from custom_cases where case_id=?").bind(incoming.caseId).first("n"), 0);
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
