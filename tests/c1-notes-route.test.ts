import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";
import { migrationMode, verifyBaselineInputs, compileExactV91Routes, captureUpgradeState, assertOriginalSchemaPreserved, writeUpgradeEvidence, sha256 } from "./helpers/c1-migration-upgrade";
import { Miniflare } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { organizationSelectionToken, resolveOrganization, type OrganizationAuthority } from "../app/organization-store";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { compileStudioDraft } from "../app/studio-compiler";

// Only runtime transport is adapted. These tests call the real route handlers,
// identity resolver, policy, audit batches, upload coordinator and D1/R2 stores.
// Synthetic trusted headers model Sites dispatch in this isolated harness.
type Actor = { id: number; actorId: string; email: string };
type ApiResult = {
  organization: OrganizationAuthority; token: string; id: string;
  dossier: { dossier_id: string; revision: number }; dossier_id: string; dossier_revision: number;
  dossiers: unknown[]; documents: Array<{ document_id: string }>; document_id: string;
  version: { document_version_id: string; predecessor_version_id: string; content_sha256: string };
  source_anchor: { source_anchor_id: string }; assertion: { assertion_id: string }; professional_assertion?: { assertion_id: string };
  session: { sessionKey: string; status: string; revision: number; state: { currentStageId: string; decisions: unknown[] } };
  snapshot: { snapshot_id: string }; output: { output_id: string }; outputs: Array<{ state: string }>;
  decision_packages: unknown[]; next_cursor: string; capabilities: Record<string, unknown>;
};
const testGlobals = globalThis as unknown as { __p1_env: { DB: D1Database; DOSSIER_DOCUMENTS: R2Bucket }; __p1_headers: () => Headers; __p1_jobs: Promise<unknown>[] };
type Route = { GET?: Handler; POST?: Handler; PATCH?: Handler };
type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
let routes: Record<string, Route>;
let baselineRoutes: Record<string, Route>;
let successorRoutes: Record<string, Route>;
let baselineFixture: { caseFingerprint: typeof caseFingerprint; normalizeStudioDraft: typeof normalizeStudioDraft; compileStudioDraft: typeof compileStudioDraft };
async function drainRouteJobs() { while (testGlobals.__p1_jobs?.length) await Promise.all(testGlobals.__p1_jobs.splice(0)); }
let mf: Miniflare;
let d1: D1Database;
let bucket: R2Bucket;
let alice: Actor, bob: Actor, reviewer: Actor, viewer: Actor;
let beforeBatchSkip=0;
let beforeBatch: (() => Promise<void>) | undefined;
const phase2Migrations: string[] = [];
let afterObjectRead: (() => Promise<void>) | undefined;
let afterObjectWrite: (() => Promise<void>) | undefined;
let orgA: string, orgB: string, dossierId: string, documentId: string, versionId: string;
let evidenceVersionId: string;
let revision = 1;
let packageFingerprint: string;
let snapshotId: string;
let outputId: string;
let lastBatchError: unknown;
const storage = new AsyncLocalStorage<Request>();
const fixtureRoot = "docs/testing/erp-pilot-2026-09-05/";
let erpDraft = normalizeStudioDraft(JSON.parse(readFileSync(fixtureRoot + "erp-d365-pilot.studio-draft.json", "utf8")));
const paths = {
  login: "app/api/auth/login/route.ts",
  register: "app/api/auth/register/route.ts", logout: "app/api/auth/logout/route.ts",
  notes: "app/api/dossiers/[dossierId]/notes/route.ts",
  dispositions: "app/api/dossiers/[dossierId]/dispositions/route.ts",
  presentation: "app/api/dossiers/[dossierId]/outputs/[outputId]/presentation/route.ts",
  catalog: "app/api/catalog/[caseId]/route.ts",
  playSessions: "app/api/play-sessions/route.ts",
  organizations: "app/api/organizations/route.ts", dossiers: "app/api/dossiers/route.ts",
  detail: "app/api/dossiers/[dossierId]/route.ts", documents: "app/api/dossiers/[dossierId]/documents/route.ts",
  download: "app/api/dossiers/[dossierId]/documents/[documentId]/versions/[versionId]/download/route.ts",
  documentReview: "app/api/dossiers/[dossierId]/documents/[documentId]/review/route.ts",
  participants: "app/api/dossiers/[dossierId]/participants/route.ts", requests: "app/api/dossiers/[dossierId]/requests/route.ts",
  anchors: "app/api/dossiers/[dossierId]/evidence/anchors/route.ts", assertions: "app/api/dossiers/[dossierId]/evidence/assertions/route.ts",
  links: "app/api/dossiers/[dossierId]/evidence/links/route.ts", packages: "app/api/dossiers/[dossierId]/decision-packages/route.ts",
  snapshots: "app/api/dossiers/[dossierId]/snapshots/route.ts", outputs: "app/api/dossiers/[dossierId]/outputs/route.ts",
  outputDownload: "app/api/dossiers/[dossierId]/outputs/[outputId]/download/route.ts",
  manifest: "app/api/dossiers/[dossierId]/snapshots/[snapshotId]/manifest/route.ts", activity: "app/api/dossiers/[dossierId]/activity/route.ts",
  proposals: "app/api/dossiers/[dossierId]/proposals/route.ts", generate: "app/api/dossiers/[dossierId]/proposals/generate/route.ts",
  transitions: "app/api/dossiers/[dossierId]/transitions/route.ts",
};

async function call(route: keyof typeof paths, actor: Actor | null, organization: string | null, method = "GET",
  body?: unknown, params: Record<string, string> = {}, query = "") {
  const headers = new Headers({ origin: "https://erp.test", "sec-fetch-site": "same-origin" });
  if (actor) headers.set("oai-authenticated-user-email", actor.email);
  if (organization) headers.set("x-genesis-organization", organization);
  let content: BodyInit | undefined;
  if (body instanceof FormData) content = body;
  else if (body !== undefined) { headers.set("content-type", "application/json"); content = JSON.stringify(body); }
  const request = new Request("https://erp.test/api/test" + query, { method, headers, body: content });
  return storage.run(request, () => routes[route][method as keyof Route]!(request, { params: Promise.resolve(params) }));
}
async function json(response: Response, status = 200): Promise<ApiResult> {
  const payload = await response.json();
  assert.equal(response.status, status, JSON.stringify(payload) + " " + String(lastBatchError));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
  return payload as ApiResult;
}
async function newActor(label: string): Promise<Actor> {
  const email = label + "@example.test";
  await d1.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email, "Synthetic " + label).run();
  const user = await d1.prepare("SELECT id,actor_id FROM users WHERE email=?").bind(email).first<{id:number;actor_id:string}>();
  assert.ok(user); return { id: user.id, actorId: user.actor_id, email };
}
async function invite(target: Actor, role = "member") {
  const result = await json(await call("organizations", alice, orgA, "POST", { action: "invite", organizationId: orgA, recipientActorId: target.actorId, role }), 201);
  await json(await call("organizations", target, null, "POST", { action: "accept", token: result.token }));
  return result.token;
}
async function upload(filename: string, text: string, existingDocument?: string) {
  const form = new FormData();
  form.set("file", new File([text], filename, { type: "text/markdown" }));
  form.set("title", filename); form.set("documentType", "correspondence"); form.set("classification", "internal");
  form.set("privacyAcknowledged", "true"); form.set("expectedRevision", String(revision)); form.set("mediaType", "text/markdown");
  if (existingDocument) form.set("documentId", existingDocument);
  const result = await json(await call("documents", alice, orgA, "POST", form, { dossierId }), 201);
  revision = result.dossier_revision; return result;
}

before(async () => {
  verifyBaselineInputs();
  mf = new Miniflare({ workers: [{ config: { name: "p1-test", type: "worker", compatibilityDate: "2026-09-01",
    manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } },
    env: { DB: { type: "d1", name: "p1-test" }, DOSSIER_DOCUMENTS: { type: "r2", name: "p1-test" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "p1-test") as unknown as D1Database;
  bucket = await mf.getR2Bucket("DOSSIER_DOCUMENTS", "p1-test") as unknown as R2Bucket;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) {
    const statements = readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    if(entry.idx>=22)phase2Migrations.push(...statements);
    else await d1.batch(statements.map((s) => d1.prepare(s)));
  }
  // First construct the exact historical v91 schema (whose original migrations
  // replace some triggers); forbid guard removal throughout populated rehearsal.
  if (migrationMode) {
    const rawD1 = d1;
    d1 = new Proxy(rawD1, { get(target, property) {
      if (property === "prepare") return (sql: string) => {
        assert.doesNotMatch(sql, /\bDROP\s+TRIGGER\b|PRAGMA\s+foreign_keys\s*=\s*(OFF|0)/iu, "migration rehearsal must never disable guards");
        return target.prepare(sql);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  }
  const observedD1 = new Proxy(d1, { get(target, property) {
    if (property === "batch") return async (statements: D1PreparedStatement[]) => {
      const hook=beforeBatchSkip>0?(beforeBatchSkip--,undefined):beforeBatch;if(hook)beforeBatch=undefined;await hook?.();
      try { return await target.batch(statements); } catch (error) { lastBatchError = error; throw error; }
    };
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  const observedBucket = new Proxy(bucket, { get(target, property) {
    const value = Reflect.get(target, property, target);
    if (property === "get") return async (...args: unknown[]) => {
      const result = await value.apply(target, args); const hook = afterObjectRead; afterObjectRead = undefined;
      await hook?.(); return result;
    };
    if (property === "put") return async (...args: unknown[]) => {
      const result = await value.apply(target, args); const hook = afterObjectWrite; afterObjectWrite = undefined;
      await hook?.(); return result;
    };
    return typeof value === "function" ? value.bind(target) : value;
  } });
  testGlobals.__p1_env = { DB: observedD1, DOSSIER_DOCUMENTS: observedBucket };
  testGlobals.__p1_headers = () => storage.getStore()!.headers;
  testGlobals.__p1_jobs = [];
  const result = await build({ stdin: { contents: Object.entries(paths).map(([key, path]) => `import * as ${key} from './${path}';`).join("\n") + `\nexport {${Object.keys(paths).join(",")}};`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022",
    plugins: [{ name: "isolated-sites-runtime", setup(b) {
      b.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, (args) => ({ path: args.path, namespace: "test-runtime" }));
      b.onLoad({ filter: /.*/, namespace: "test-runtime" }, (args) => ({ contents: args.path === "cloudflare:workers"
        ? "export const env=globalThis.__p1_env; export function waitUntil(p){globalThis.__p1_jobs.push(p)}"
        : args.path === "next/headers" ? "export async function headers(){return globalThis.__p1_headers()}"
          : "export function redirect(){throw new Error('unexpected redirect')}" }));
    } }],
  });
  mkdirSync(".artifacts/p1-route-tests", { recursive: true });
  const harness = resolve(".artifacts/p1-route-tests/routes.mjs");
  writeFileSync(harness, result.outputFiles[0].text);
  routes = await import(pathToFileURL(harness).href);
  successorRoutes = routes;
  if (migrationMode) {
    const oldModule = await compileExactV91Routes(paths);
    baselineRoutes = oldModule;
    baselineFixture = oldModule;
    routes = baselineRoutes;
    erpDraft = baselineFixture.normalizeStudioDraft(JSON.parse(readFileSync(fixtureRoot + "erp-d365-pilot.studio-draft.json", "utf8")));
  }
  alice = await newActor("alice"); bob = await newActor("bob"); reviewer = await newActor("reviewer"); viewer = await newActor("viewer");
  orgA = (await json(await call("organizations", alice, null, "POST", { action: "create", name: "ERP Alpha" }), 201)).organization.id;
  orgB = (await json(await call("organizations", bob, null, "POST", { action: "create", name: "ERP Beta" }), 201)).organization.id;
  const studioFingerprint = (migrationMode ? baselineFixture.caseFingerprint : caseFingerprint)(erpDraft);
  const compiled = (migrationMode ? baselineFixture.compileStudioDraft : compileStudioDraft)(erpDraft, studioFingerprint);
  assert.ok(compiled.scenario, JSON.stringify(compiled.issues));
  packageFingerprint = compiled.scenario.fingerprint;
  const db = drizzle(d1, { schema });
  await db.batch([
    db.insert(schema.cases).values({ id: erpDraft.caseId, currentVersion: erpDraft.version, fingerprint: packageFingerprint,
      title: erpDraft.title, jurisdiction: erpDraft.jurisdiction, practiceArea: "ERP", sector: "Training", difficulty: "Advanced", durationMinutes: 30 }),
    db.insert(schema.caseVersions).values({ caseId: erpDraft.caseId, version: erpDraft.version, fingerprint: packageFingerprint,
      studioFingerprint, payload: { kind: "playable-scenario-v1", studioDraft: erpDraft, scenario: compiled.scenario }, publishedAt: erpDraft.updatedAt }),
  ]);
});
after(async () => {
  try {
    if (migrationMode && d1 && bucket) {
      await drainRouteJobs();
      writeUpgradeEvidence("final-state", await captureUpgradeState(d1, bucket));
    }
  } finally { await mf?.dispose(); }
}, { timeout: 15000 });

test("Administration: authenticated password login cannot silently switch the effective identity", async () => {
  const count = () => d1.prepare("SELECT count(*) AS n FROM auth_sessions").first<{n:number}>();
  const before = await count();
  const response = await call("login", alice, null, "POST", {email:bob.email,password:"Synthetic-password-1!"});
  assert.equal(response.status,409);
  assert.equal((await response.json() as {code:string}).code,"already_authenticated");
  assert.equal(response.headers.get("set-cookie"),null);
  assert.deepEqual(await count(),before);
});

test("Administration: password sign-in still works after explicit local sign-out", async () => {
  const person=await newActor("admin-local-login"),password="Synthetic-local-password-1!";
  const enrolled=await call("register",person,null,"POST",{password});
  assert.equal(enrolled.status,201);
  const initialCookie=enrolled.headers.get("set-cookie")?.split(";")[0];assert.ok(initialCookie);
  const withCookie=async(route:"login"|"logout",cookie:string)=>{
    const request=new Request("https://erp.test/api/auth/"+route,{method:"POST",headers:{origin:"https://erp.test","sec-fetch-site":"same-origin",cookie,"content-type":"application/json"},body:JSON.stringify({email:person.email,password})});
    return storage.run(request,()=>routes[route].POST!(request,{params:Promise.resolve({})}));
  };
  assert.equal((await withCookie("login",initialCookie)).status,409);
  assert.equal((await withCookie("logout",initialCookie)).status,200);
  const signedIn=await withCookie("login",initialCookie);
  assert.equal(signedIn.status,200);assert.ok(signedIn.headers.get("set-cookie"));
  assert.equal((await signedIn.json() as {authenticated:boolean}).authenticated,true);
  const session=await d1.prepare("SELECT count(*) AS n FROM auth_sessions WHERE revoked_at IS NULL").first<{n:number}>();
  assert.ok(session && session.n>=1);
});

test("Administration: invitations respect existing membership and restoration with durable audit", async () => {
  const owner=await newActor("admin-owner"), member=await newActor("admin-member"), outsider=await newActor("admin-outsider");
  const organizationId=(await json(await call("organizations",owner,null,"POST",{action:"create",name:"Synthetic administration regression"}),201)).organization.id;
  const payload={action:"invite",organizationId,recipientActorId:member.actorId,role:"member"};
  const counts=()=>d1.prepare("SELECT (SELECT count(*) FROM organization_invitations WHERE organization_id=?) AS invitations, (SELECT count(*) FROM organization_security_events WHERE organization_id=?) AS events").bind(organizationId,organizationId).first();
  const rejected=async(actor:Actor,body:unknown,status:number,code:string)=>{
    const before=await counts(); const result=await call("organizations",actor,organizationId,"POST",body);
    assert.equal(result.status,status);assert.equal((await result.json() as {code:string}).code,code);assert.deepEqual(await counts(),before);
  };
  await rejected(owner,{...payload,recipientActorId:owner.actorId},400,"invitation_fields_invalid");
  await rejected(outsider,payload,404,"organization_unavailable");
  const invitation=await json(await call("organizations",owner,organizationId,"POST",payload),201);
  await json(await call("organizations",member,null,"POST",{action:"accept",token:invitation.token}));
  await rejected(owner,payload,409,"invitation_unavailable");
  await rejected(member,{...payload,recipientActorId:outsider.actorId},404,"organization_unavailable");
  const change={action:"member",organizationId,actorId:member.actorId,role:"member"};
  await json(await call("organizations",owner,organizationId,"POST",{...change,status:"suspended",expectedRevision:1}));
  await rejected(owner,payload,409,"invitation_member_suspended");
  await rejected(owner,{...change,status:"active",expectedRevision:1},409,"membership_changed");
  await json(await call("organizations",owner,organizationId,"POST",{...change,status:"active",expectedRevision:2}));
  const reopened=await (await call("organizations",member,organizationId)).json() as {selected:{id:string;membershipRevision:number}};
  assert.equal(reopened.selected.id,organizationId);assert.equal(reopened.selected.membershipRevision,3);
  await json(await call("organizations",owner,organizationId,"POST",{...change,status:"removed",expectedRevision:3}));
  await rejected(owner,payload,409,"invitation_member_removed");
  const final=await (await call("organizations",owner,organizationId)).json() as {members:Array<{actorId:string;status:string;revision:number}>;events:Array<{action:string}>};
  assert.equal(final.members.find(m=>m.actorId===member.actorId)?.status,"removed");
  assert.equal(final.members.find(m=>m.actorId===member.actorId)?.revision,4);
  assert.equal(final.events.filter(e=>e.action==="membership_changed").length,3);
});

test("P1 ERP 1: create, reopen, filter and page a dossier in exactly one organization", async () => {
  await json(await call("dossiers", null, orgA), 401);
  const created = await json(await call("dossiers", alice, orgA, "POST", { title: "Synthetic D365 batch reconciliation incident", jurisdictions: ["Test"], classification: "internal", keyDeadlineAt: "2027-01-01T12:00:00.000Z", keyDeadlineTimezone: "UTC" }), 201);
  dossierId = created.dossier?.dossier_id ?? created.dossier_id;
  assert.ok(dossierId, JSON.stringify(created));
  const list = await json(await call("dossiers", alice, orgA));
  assert.equal(list.dossiers.length, 1);
  await json(await call("detail", alice, orgA, "GET", undefined, { dossierId }));
  assert.equal((await json(await call("dossiers", bob, orgB))).dossiers.length, 0);
  await json(await call("detail", bob, orgB, "GET", undefined, { dossierId }), 404);
  await json(await call("dossiers", alice, orgB), 404);
});

test("P1 ERP 2: immutable source versions retain their hashes and private downloads", async () => {
  const source = readFileSync(fixtureRoot + "01-incident.md", "utf8");
  const first = await upload("01-incident.md", source);
  documentId = first.document_id; versionId = first.version.document_version_id;
  const second = await upload("01-incident.md", source + "\nSynthetic revision: the posting phase requires a separate reviewer.\n", documentId);
  evidenceVersionId = second.version.document_version_id;
  assert.equal(second.version.predecessor_version_id, versionId);
  assert.notEqual(second.version.content_sha256, first.version.content_sha256);
  const original = await call("download", alice, orgA, "GET", undefined, { dossierId, documentId, versionId });
  assert.equal(original.status, 200); assert.equal(await original.text(), source);
  await upload("02-event-log.md", readFileSync(fixtureRoot + "02-event-log.md", "utf8"));
  await upload("03-control-plan.md", readFileSync(fixtureRoot + "03-control-plan.md", "utf8"));
  await json(await call("download", bob, orgB, "GET", undefined, { dossierId, documentId, versionId }), 404);
});

test("P1 ERP 4: invitations are identity-bound, single-use, and confer no dossier role", async () => {
  const token = await invite(reviewer, "org_admin");
  await json(await call("organizations", reviewer, null, "POST", { action: "accept", token }), 404);
  await json(await call("organizations", viewer, null, "POST", { action: "accept", token }), 404);
  await json(await call("detail", reviewer, orgA, "GET", undefined, { dossierId }), 404);
  // A local organization administrator cannot invite without a separate delegation.
  await json(await call("organizations", reviewer, orgA, "POST", { action: "invite", organizationId: orgA, recipientActorId: viewer.actorId, role: "member" }), 404);
  const enrolment = await json(await call("participants", alice, orgA, "POST", { actorId: reviewer.actorId, role: "reviewer", expectedRevision: revision }, { dossierId }), 201);
  revision = enrolment.dossier.revision;
  await json(await call("detail", reviewer, orgA, "GET", undefined, { dossierId }));
  await json(await call("participants", alice, orgA, "POST", { actorId: bob.actorId, role: "viewer", expectedRevision: revision }, { dossierId }), 409);
  await invite(viewer);
  const viewed = await json(await call("participants", alice, orgA, "POST", { actorId: viewer.actorId, role: "viewer", expectedRevision: revision }, { dossierId }), 201);
  revision = viewed.dossier.revision;
});

test("P1 ERP 3: source anchors and assertions require explicit review before linking the ERP decision package", async () => {
  const params = { dossierId };
  const documents = await json(await call("documents", alice, orgA, "GET", undefined, params));
  for (const document of documents.documents) {
    const reviewed = await json(await call("documentReview", alice, orgA, "POST", { decision: "accepted_source", expectedRevision: revision }, { dossierId, documentId: document.document_id }));
    revision = reviewed.dossier.revision;
  }
  let result = await json(await call("anchors", alice, orgA, "POST", { action: "create", expectedRevision: revision,
    documentId, documentVersionId: evidenceVersionId, section: "Known facts", paragraph: "3",
    excerpt: "the accounting ledger has not yet changed" }, params), 201);
  revision = result.dossier.revision;
  const anchorId = result.source_anchor.source_anchor_id;
  result = await json(await call("anchors", alice, orgA, "POST", { action: "review", expectedRevision: revision, sourceAnchorId: anchorId, decision: "accepted" }, params));
  revision = result.dossier.revision;
  result = await json(await call("assertions", alice, orgA, "POST", { action: "create", expectedRevision: revision,
    assertionType: "fact", statement: "Neither import candidate has been posted in this synthetic incident.", sourceAnchorIds: [anchorId] }, params), 201);
  revision = result.dossier.revision;
  const assertionId = result.professional_assertion?.assertion_id ?? result.assertion?.assertion_id;
  result = await json(await call("assertions", alice, orgA, "POST", { action: "review", expectedRevision: revision, assertionId, decision: "accepted" }, params));
  revision = result.dossier.revision;
  const scenario = compileStudioDraft(erpDraft, caseFingerprint(erpDraft)).scenario!;
  let session = (await json(await call("playSessions", alice, null, "POST", { action: "start", caseId: erpDraft.caseId,
    version: erpDraft.version, fingerprint: packageFingerprint }), 201)).session;
  for (let step = 0; session.status === "active" && step < 12; step++) {
    const stage = scenario.stages.find((value) => value.id === session.state.currentStageId);
    assert.ok(stage?.options.length, JSON.stringify(session));
    session = (await json(await call("playSessions", alice, null, "POST", { action: "decision", sessionKey: session.sessionKey,
      eventId: crypto.randomUUID(), expectedRevision: session.revision, optionId: stage.options[0].id }))).session;
  }
  assert.equal(session.status, "completed");
  assert.ok(session.state.decisions.length > 0);
  result = await json(await call("packages", alice, orgA, "POST", { expectedRevision: revision,
    packageId: erpDraft.caseId, packageVersion: erpDraft.version, packageFingerprint, simulationReceiptIds: [session.sessionKey] }, params), 201);
  revision = result.dossier.revision;
  assert.equal((await json(await call("packages", alice, orgA, "GET", undefined, params))).decision_packages.length, 1);
});

test("P1 ERP 5: snapshot-bound PDF and JSON export, independent approval, reopen, and staleness", async () => {
  const params = { dossierId };
  const snapshot = await json(await call("snapshots", alice, orgA, "POST", { expectedRevision: revision, locale: "en", audience: "internal", redactionProfileId: "pilot-default" }, params), 201);
  snapshotId = snapshot.snapshot.snapshot_id;
  const output = await json(await call("outputs", alice, orgA, "POST", { action: "generate", expectedRevision: revision, snapshotId, format: "pdf" }, params), 201);
  outputId = output.output.output_id;
  await json(await call("outputs", viewer, orgA, "POST", { action: "approve", expectedRevision: revision, outputId }, params), 404);
  await json(await call("outputs", reviewer, orgA, "POST", { action: "approve", expectedRevision: revision, outputId }, params));
  const pdf = await call("outputDownload", reviewer, orgA, "GET", undefined, { dossierId, outputId });
  assert.equal(pdf.status, 200);
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(pdfBytes.slice(0,5)), "%PDF-");
  writeFileSync(".artifacts/p1-route-tests/erp-decision-report.pdf", pdfBytes);
  const manifest = await call("manifest", alice, orgA, "GET", undefined, { dossierId, snapshotId });
  assert.equal(manifest.status, 200);
  const exported = await manifest.text();
  assert.match(exported, new RegExp(evidenceVersionId)); assert.match(exported, new RegExp(erpDraft.caseId));
  writeFileSync(".artifacts/p1-route-tests/erp-snapshot.json", exported);
  const reopened = await json(await call("outputs", reviewer, orgA, "GET", undefined, params));
  assert.equal(reopened.outputs.length, 1);
  await upload("01-incident.md", readFileSync(fixtureRoot + "01-incident.md", "utf8") + "\nSynthetic update: additional reconciliation evidence is required.\n", documentId);
  const stale = await json(await call("outputs", alice, orgA, "GET", undefined, params));
  assert.equal(stale.outputs[0].state, "stale");
  await json(await call("outputs", reviewer, orgA, "POST", { action: "approve", expectedRevision: revision, outputId }, params), 409);
});

test(migrationMode ? "Migration baseline: v91 citation retirement preserves audit, replay and conflicts (historical deadline fixture excluded)" : "Dependable actions: historical disposition and citation retirement persist with exact audit, denial, replay and conflicts", async () => {
 const params={dossierId};
 const originalPdf=new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer());
 // The default legacy suite retains its historical fixture. Exact-v91 mode never disables its guard.
 const runHistoricalDeadlineFixture = async () => {
 // Seed a pre-registration historical record only: the production insert guard stays intact.
 const guard=await d1.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='dossier_deadline_references_unregistered_insert_guard'").first<{sql:string}>(); assert.ok(guard);
 await d1.batch([d1.prepare("DROP TRIGGER dossier_deadline_references_unregistered_insert_guard"),d1.prepare("INSERT INTO dossier_deadline_references(id,dossier_id,deadline_kind,title,due_at,timezone,critical,status,created_by_actor_ref,updated_by_actor_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind("deadline_historical_review",dossierId,"workspace","Historical filing gate","2020-01-01T12:00:00.000Z","Europe/Brussels",1,"open",alice.actorId,alice.actorId,"2020-01-01T00:00:00.000Z","2020-01-01T00:00:00.000Z"),d1.prepare(guard.sql)]);
 const before=await d1.prepare("SELECT * FROM dossier_deadline_references WHERE id=?").bind("deadline_historical_review").first<Record<string,unknown>>();assert.ok(before);
 const fields={kind:"deadline",recordId:"deadline_historical_review",status:"completed",reason:"Synthetic filing acknowledged by the receiving office.",expectedRevision:revision,idempotencyKey:"deadline-review-once"};
 await json(await call("dispositions",viewer,orgA,"POST",fields,params),404);
 await json(await call("dispositions",bob,orgB,"POST",fields,params),404);
 await json(await call("dispositions",null,orgA,"POST",fields,params),401);
 const result=await json(await call("dispositions",reviewer,orgA,"POST",fields,params));revision=result.dossier.revision;
 await json(await call("dispositions",reviewer,orgA,"POST",fields,params));
 await json(await call("dispositions",reviewer,orgA,"POST",{...fields,reason:"Changed reason under the same request"},params),409);
 const after=await d1.prepare("SELECT * FROM dossier_deadline_references WHERE id=?").bind("deadline_historical_review").first<Record<string,unknown>>();assert.ok(after);assert.equal(after.status,"completed");
 for(const field of ["due_at","timezone","title","critical","created_at","created_by_actor_ref"])assert.equal(after[field],before[field]);
 const deadlineReceipt=await d1.prepare("SELECT * FROM dossier_deadline_dispositions WHERE dossier_id=?").bind(dossierId).first<Record<string,unknown>>();assert.ok(deadlineReceipt);
 const audit=await d1.prepare("SELECT summary_code,detail FROM dossier_audit_events WHERE id=?").bind(deadlineReceipt.audit_event_id).first<{summary_code:string;detail:string}>();assert.equal(audit?.summary_code,"HISTORICAL_DEADLINE_DISPOSED");assert.equal(JSON.parse(audit!.detail).deadline_reference_id,fields.recordId);
 const exactQuery="?event_id="+encodeURIComponent(String(deadlineReceipt.audit_event_id));
 const exactAudit=await (await call("activity",reviewer,orgA,"GET",undefined,params,exactQuery)).json() as {activity:Array<{audit_event_id:string}>,next_cursor:string|null};
 assert.deepEqual(exactAudit.activity.map(event=>event.audit_event_id),[deadlineReceipt.audit_event_id]);assert.equal(exactAudit.next_cursor,null);
 await json(await call("activity",bob,orgB,"GET",undefined,params,exactQuery),404);
 await json(await call("activity",null,orgA,"GET",undefined,params,exactQuery),401);
 await json(await call("activity",reviewer,orgA,"GET",undefined,params,"?event_id=event_missing_000000000001"),404);
 await assert.rejects(d1.prepare("UPDATE dossier_deadline_references SET due_at='2030-01-01T00:00:00.000Z' WHERE id=?").bind(fields.recordId).run());
 return {fields,result,deadlineReceipt,audit};
 };
 const historicalDeadline = migrationMode ? null : await runHistoricalDeadlineFixture();
 const { deadlineReceipt, audit } = historicalDeadline ?? { deadlineReceipt: null, audit: null };
 const anchor=await d1.prepare("SELECT * FROM dossier_source_anchors WHERE dossier_id=? AND review_state='accepted' LIMIT 1").bind(dossierId).first<Record<string,unknown>>();assert.ok(anchor);
 const retire={kind:"citation",recordId:anchor.id,reason:"Superseded by the synthetic reconciliation source update.",expectedRevision:revision,idempotencyKey:"citation-retire-once"};
 await json(await call("dispositions",viewer,orgA,"POST",retire,params),404);
 await json(await call("dispositions",bob,orgB,"POST",retire,params),404);
 const retired=await json(await call("dispositions",reviewer,orgA,"POST",retire,params));revision=retired.dossier.revision;
 await json(await call("dispositions",reviewer,orgA,"POST",retire,params));
 await json(await call("dispositions",reviewer,orgA,"POST",{...retire,idempotencyKey:"other-conflicting-request"},params),409);
 assert.deepEqual(await d1.prepare("SELECT * FROM dossier_source_anchors WHERE id=?").bind(anchor.id).first(),anchor);
 const detail=await (await call("detail",alice,orgA,"GET",undefined,params)).json() as {dossier:{readiness:{dimensions:Array<{reasons:Array<{code:string}>}>}}};
 assert.match(JSON.stringify(detail),/SOURCE_ANCHOR_MISSING/);
 await json(await call("snapshots",alice,orgA,"POST",{expectedRevision:revision,locale:"en",audience:"internal",redactionProfileId:"pilot-default"},params),409);
 const preservedPdf=new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer());assert.deepEqual(preservedPdf,originalPdf);

 await json(await call("assertions",alice,orgA,"POST",{action:"create",expectedRevision:revision,assertionType:"fact",statement:"Invalid reuse of retired citation",sourceAnchorIds:[anchor.id]},params),409);
 const retiredAssertion=await d1.prepare("SELECT assertion_id FROM dossier_assertion_sources WHERE dossier_id=? AND source_anchor_id=? LIMIT 1").bind(dossierId,anchor.id).first<{assertion_id:string}>();assert.ok(retiredAssertion);
 let repaired=await json(await call("assertions",reviewer,orgA,"POST",{action:"supersede",assertionId:retiredAssertion.assertion_id,expectedRevision:revision},params));revision=repaired.dossier.revision;
 const current=await d1.prepare("SELECT document_version_id FROM dossier_document_current_versions WHERE dossier_id=? AND document_id=?").bind(dossierId,documentId).first<{document_version_id:string}>();assert.ok(current);
 repaired=await json(await call("anchors",alice,orgA,"POST",{action:"create",expectedRevision:revision,documentId,documentVersionId:current.document_version_id,section:"Known facts",paragraph:"3",excerpt:"Additional reconciliation evidence is required."},params),201);revision=repaired.dossier.revision;
 const replacementId=repaired.source_anchor.source_anchor_id;
 repaired=await json(await call("anchors",reviewer,orgA,"POST",{action:"review",expectedRevision:revision,sourceAnchorId:replacementId,decision:"accepted"},params));revision=repaired.dossier.revision;
 repaired=await json(await call("assertions",alice,orgA,"POST",{action:"create",expectedRevision:revision,assertionType:"fact",statement:"The updated synthetic reconciliation source has been reviewed.",sourceAnchorIds:[replacementId]},params),201);revision=repaired.dossier.revision;
 const replacementAssertion=repaired.professional_assertion?.assertion_id??repaired.assertion?.assertion_id;
 repaired=await json(await call("assertions",reviewer,orgA,"POST",{action:"review",expectedRevision:revision,assertionId:replacementAssertion,decision:"accepted"},params));revision=repaired.dossier.revision;
 const freshSnapshot=await json(await call("snapshots",alice,orgA,"POST",{expectedRevision:revision,locale:"en",audience:"internal",redactionProfileId:"pilot-default"},params),201);
 const freshOutput=await json(await call("outputs",alice,orgA,"POST",{action:"generate",expectedRevision:revision,snapshotId:freshSnapshot.snapshot.snapshot_id,format:"json_manifest"},params),201);
 const freshReport=await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId:freshOutput.output.output_id})).text();assert.match(freshReport,/citation_retirements/);assert.match(freshReport,new RegExp(String(anchor.id)));
 writeFileSync(".artifacts/p1-route-tests/retirement-reviewed-report.json",freshReport);
 if (historicalDeadline) {
 const { fields, result } = historicalDeadline;
 const originalReplay=await json(await call("dispositions",reviewer,orgA,"POST",fields,params));assert.equal(originalReplay.dossier.revision,result.dossier.revision);
 const recoveredOriginal=await json(await call("dispositions",reviewer,orgA,"GET",undefined,params,"?kind=deadline&id="+fields.recordId+"&operation_key="+fields.idempotencyKey));assert.equal(recoveredOriginal.dossier.revision,result.dossier.revision);
 await json(await call("dispositions",alice,orgA,"GET",undefined,params,"?kind=deadline&id="+fields.recordId+"&operation_key="+fields.idempotencyKey),404);
 }
 assert.equal((await d1.prepare("PRAGMA foreign_key_check").all()).results.length,0);
 writeFileSync(".artifacts/p1-route-tests/dependable-actions-evidence.json",JSON.stringify({environment:"Miniflare D1/R2 actual handlers; trusted-header simulation, not browser authentication",deadlineReceipt,audit,retirement:await d1.prepare("SELECT * FROM dossier_source_anchor_retirements WHERE dossier_id=?").bind(dossierId).first(),oldPdfBytesPreserved:true},null,2));
});

test(migrationMode ? "Migration rehearsal: fresh schema and exact v91 populated upgrade preserve every existing table, schema object and R2 byte" : "Phase 2: fresh schema and v86 upgrade preserve governed data and sealed bytes", async () => {
  const { DatabaseSync }=await import("node:sqlite");
  const fresh=new DatabaseSync(":memory:");fresh.exec("PRAGMA foreign_keys=ON");
  const journal=JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
  for(const entry of journal.entries){fresh.exec("BEGIN");for(const statement of readFileSync(`drizzle/${entry.tag}.sql`,"utf8").split("--> statement-breakpoint").filter(s=>s.trim()))fresh.exec(statement);fresh.exec("COMMIT");}
  assert.equal(fresh.prepare("PRAGMA foreign_key_check").all().length,0);fresh.close();
  if (migrationMode) {
    // Preserve an actual legacy request across 0022 as well as the ERP evidence and reports.
    const question = "Synthetic pre-upgrade request: preserve the reconciliation record across C1.";
    const created = await json(await call("requests", alice, orgA, "POST", { action: "create", question, reason: "Isolated populated upgrade fixture.", priority: "normal", expectedRevision: revision }, { dossierId }), 201);
    revision = created.dossier.revision;
    const request = await d1.prepare("SELECT id FROM dossier_information_requests WHERE dossier_id=? AND question=?").bind(dossierId, question).first<{id:string}>(); assert.ok(request);
    const closed = await json(await call("requests", alice, orgA, "POST", { action: "update_status", informationRequestId: request.id, status: "waived", expectedRevision: revision }, { dossierId }));
    revision = closed.dossier.revision;
  }
  const capture=async()=>{
    const tables=["dossiers","dossier_deadline_dispositions","dossier_source_anchor_retirements","dossier_snapshots","dossier_governed_outputs","dossier_audit_events","dossier_revision_receipts"];
    return Promise.all(tables.map(table=>d1.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all().then(r=>r.results)));
  };
  const before=await capture();
  const pdf=new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer());
  await drainRouteJobs();
  const completeBefore = migrationMode ? await captureUpgradeState(d1, bucket) : null;
  if (completeBefore) writeUpgradeEvidence("populated-v91-before-upgrade", completeBefore);
  await d1.batch(phase2Migrations.map(s=>d1.prepare(s)));
  if (completeBefore) {
    const completeAfter = await captureUpgradeState(d1, bucket);
    writeUpgradeEvidence("populated-v91-after-upgrade", completeAfter);
    assertOriginalSchemaPreserved(completeBefore, completeAfter);
    assert.equal(Object.keys(completeAfter.tables).length - Object.keys(completeBefore.tables).length, 5);
    routes = successorRoutes;
  }
  assert.deepEqual(await capture(),before);
  assert.deepEqual(new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer()),pdf);
  assert.equal((await d1.prepare("PRAGMA foreign_key_check").all()).results.length,0);
});

test("Phase 2: working notes persist, replay, conflict and preserve governed outputs",async(t)=>{
  type NoteResult={note:{id:string;caseId:string;revision:number;title:string;body:string};operation:{id:string;key:string;sourceLinkId:string};current?:{revision:number};replayed?:boolean;code?:string;sources?:Array<{id:string;retired:boolean;locator:unknown}>;count?:number;history?:Array<{revision:number;action:string}>};
  const params={dossierId};
  const notes=async(body:unknown,actor:Actor|null=alice,status=200)=>{
    const response=await call("notes",actor,orgA,"POST",body,params);const result=await response.json() as NoteResult;
    assert.equal(response.status,status,JSON.stringify(result)+" "+String(lastBatchError));return result;
  };
  const read=async(query:string,actor:Actor|null=alice,status=200)=>{
    const response=await call("notes",actor,orgA,"GET",undefined,params,query);assert.equal(response.status,status,await response.clone().text());return response.json() as Promise<NoteResult>;
  };
  await t.test("invalid operation whitespace and opaque cursor are deterministic caller errors",async()=>{
    for(const query of ["?operation_key=%20note-save-original%20","?operation_key=short","?cursor=bad!cursor"]){const response=await call("notes",alice,orgA,"GET",undefined,params,query);assert.equal(response.status,400);assert.equal((await response.json() as {code:string}).code,"invalid_selection");}
  });
  const state=async()=>({case:await d1.prepare("SELECT * FROM dossiers WHERE id=?").bind(dossierId).first(),
    outputs:(await d1.prepare("SELECT * FROM dossier_governed_outputs WHERE dossier_id=? ORDER BY id").bind(dossierId).all()).results,
    snapshots:(await d1.prepare("SELECT * FROM dossier_snapshots WHERE dossier_id=? ORDER BY id").bind(dossierId).all()).results,
    events:(await d1.prepare("SELECT * FROM dossier_output_state_events WHERE dossier_id=? ORDER BY id").bind(dossierId).all()).results});
  const contributor=await newActor("notes-contributor");await invite(contributor);
  const enrolled=await json(await call("participants",alice,orgA,"POST",{actorId:contributor.actorId,role:"contributor",expectedRevision:revision},params),201);revision=enrolled.dossier.revision;
  const before=await state();
  const pdf=new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer());
  const created=await notes({action:"create",title:"Synthetic review notebook",type:"analysis",body:"Original working analysis",expectedRevision:0,idempotencyKey:"note-create-original"},alice,201);
  const noteId=created.note.id;
  let noteRevision=created.note.revision;
  await t.test("save, independent reload and lost-response replay retain immutable original revision",async()=>{
    const payload={action:"save",noteId,title:"Updated review notebook",type:"analysis",body:"Retained proposal",expectedRevision:noteRevision,idempotencyKey:"note-save-original"};
    const saved=await notes(payload);noteRevision=saved.note.revision;
    assert.equal((await read("?note_id="+noteId+"&organization="+orgA)).note.body,"Retained proposal");
    const later=await notes({...payload,body:"Later authorized text",expectedRevision:noteRevision,idempotencyKey:"note-save-later"});noteRevision=later.note.revision;
    const recovered=await read("?operation_key=note-save-original");assert.deepEqual(recovered.note,saved.note);assert.equal(recovered.operation.id,saved.operation.id);
    const replay=await notes(payload);assert.deepEqual(replay.note,saved.note);assert.equal(replay.replayed,true);
    assert.equal((await notes({...payload,body:"Changed payload under old key"},alice,409)).code,"operation_key_conflict");
    assert.equal((await read("?note_id="+noteId)).note.body,"Later authorized text");
  });
  await t.test("concurrent same-revision saves have one winner and current comparison for loser",async()=>{
    const a={action:"save",noteId,title:"Concurrent review",type:"analysis",body:"Proposal A",expectedRevision:noteRevision,idempotencyKey:"note-concurrent-a"};
    const results=await Promise.all([call("notes",alice,orgA,"POST",a,params),call("notes",alice,orgA,"POST",{...a,body:"Proposal B",idempotencyKey:"note-concurrent-b"},params)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const loser=await results.find(r=>r.status===409)!.json() as NoteResult;assert.equal(loser.code,"revision_conflict");assert.equal(loser.current?.revision,noteRevision+1);
    noteRevision++;
  });
  await t.test("link exact historical source, avoid duplicates, permission-filter backlinks and safely unlink",async()=>{
    const anchor=await d1.prepare("SELECT id,document_version_id FROM dossier_source_anchors WHERE dossier_id=? AND document_id=? ORDER BY created_at LIMIT 1").bind(dossierId,documentId).first<{id:string;document_version_id:string}>();assert.ok(anchor);
    const fields={action:"link",noteId,documentId,documentVersionId:anchor.document_version_id,sourceAnchorId:anchor.id,expectedRevision:noteRevision,idempotencyKey:"note-link-original"};
    const linked=await notes(fields);noteRevision=linked.note.revision;
    assert.equal((await notes(fields)).operation.id,linked.operation.id);
    assert.equal((await notes({...fields,expectedRevision:noteRevision,idempotencyKey:"note-link-duplicate"},alice,409)).code,"already_linked");
    const detail=await read("?note_id="+noteId);assert.equal(detail.sources!.length,1);assert.equal(detail.sources![0]!.retired,true);assert.ok(detail.sources![0]!.locator);
    assert.equal((await read("?document_id="+documentId)).count,1);
    await read("?document_id="+documentId,viewer);await read("?document_id="+documentId,null,401);
    await json(await call("notes",bob,orgB,"GET",undefined,params,"?document_id="+documentId),404);
    const another=await notes({action:"create",title:"Another shared note",type:"meeting",body:"",expectedRevision:0,idempotencyKey:"note-create-another"},alice,201);
    await notes({...fields,noteId:another.note.id,expectedRevision:1,idempotencyKey:"note-link-another"});
    const unlink={action:"unlink",noteId,sourceLinkId:linked.operation.sourceLinkId,expectedRevision:noteRevision,idempotencyKey:"note-unlink-once"};
    const unlinked=await notes(unlink);noteRevision=unlinked.note.revision;
    assert.equal((await notes(unlink)).operation.id,unlinked.operation.id);
    assert.equal((await read("?note_id="+noteId)).sources!.length,0);
    assert.equal((await read("?note_id="+noteId+"&revision="+linked.note.revision)).sources!.length,1);
    assert.equal((await read("?document_id="+documentId)).count,1);
    assert.equal((await call("download",alice,orgA,"GET",undefined,{dossierId,documentId,versionId:anchor.document_version_id})).status,200);
    await notes({...fields,documentVersionId:versionId,sourceAnchorId:anchor.id,expectedRevision:noteRevision,idempotencyKey:"note-wrong-anchor"},alice,400);
    await notes({...fields,documentId:"document_missing_foreign",expectedRevision:noteRevision,idempotencyKey:"note-foreign-document"},alice,400);
    const foreignCase=await json(await call("dossiers",alice,orgA,"POST",{title:"Synthetic separate note-source case",jurisdictions:["Test"],classification:"internal"}),201);
    const foreignId=foreignCase.dossier.dossier_id;
    const form=new FormData();form.set("file",new File(["Synthetic source from a different case"],"other-case.md",{type:"text/markdown"}));form.set("title","Other case source");form.set("documentType","correspondence");form.set("classification","internal");form.set("privacyAcknowledged","true");form.set("expectedRevision","1");form.set("mediaType","text/markdown");
    const foreignDocument=await json(await call("documents",alice,orgA,"POST",form,{dossierId:foreignId}),201);
    await notes({...fields,documentId:foreignDocument.document_id,documentVersionId:foreignDocument.version.document_version_id,sourceAnchorId:null,expectedRevision:noteRevision,idempotencyKey:"note-existing-foreign-source"},alice,400);
    await read("?document_id="+foreignDocument.document_id,alice,404);

    await read("?note_id="+noteId+"&version_id="+versionId,alice,400);
  });
  await t.test(migrationMode ? "unauthorized readers/writers and real late membership removal cannot save or recover confidential data" : "unauthorized readers/writers and late case role removal cannot save or recover confidential data",async()=>{
    const payload={action:"save",noteId,title:"Denied edit",type:"analysis",body:"No write",expectedRevision:noteRevision,idempotencyKey:"note-denied-save"};
    await notes(payload,viewer,404);await notes(payload,reviewer,404);await notes(payload,null,401);
    await json(await call("notes",bob,orgB,"POST",payload,params),404);
    await read("?operation_key=note-create-original",viewer,404);
    const contributed=await notes({...payload,idempotencyKey:"note-contributor-save"},contributor);noteRevision=contributed.note.revision;payload.expectedRevision=noteRevision;
    const beforeRevocation=await d1.prepare("SELECT count(*) AS n FROM dossier_working_note_versions WHERE dossier_id=?").bind(dossierId).first();
    beforeBatchSkip=1;
    beforeBatch=async()=>{await json(await call("organizations",alice,orgA,"POST",{action:"member",organizationId:orgA,actorId:contributor.actorId,role:"member",status:"suspended",expectedRevision:1}));};
    await notes({...payload,idempotencyKey:"note-membership-revoked"},contributor,404);
    assert.equal(beforeBatch, undefined, "membership suspension race must execute");
    assert.equal((await d1.prepare("SELECT status FROM organization_memberships WHERE organization_id=? AND actor_id=?").bind(orgA, contributor.actorId).first<{status:string}>())?.status, "suspended");
    assert.deepEqual(await d1.prepare("SELECT count(*) AS n FROM dossier_working_note_versions WHERE dossier_id=?").bind(dossierId).first(),beforeRevocation);
    await read("?note_id="+noteId,contributor,404);
    await json(await call("organizations",alice,orgA,"POST",{action:"member",organizationId:orgA,actorId:contributor.actorId,role:"member",status:"active",expectedRevision:2}));
    // Exact migration mode uses the supported membership handler and keeps all guards enabled.
    if (migrationMode) {
      const member = await d1.prepare("SELECT revision FROM organization_memberships WHERE organization_id=? AND actor_id=?").bind(orgA, contributor.actorId).first<{revision:number}>(); assert.ok(member);
      beforeBatchSkip=1;
      beforeBatch=async()=>{await json(await call("organizations",alice,orgA,"POST",{action:"member",organizationId:orgA,actorId:contributor.actorId,role:"member",status:"removed",expectedRevision:member.revision}));};
      await notes({...payload,idempotencyKey:"note-membership-removed"},contributor,404);
      assert.equal(beforeBatch, undefined, "membership removal race must execute");
      assert.equal((await d1.prepare("SELECT status FROM organization_memberships WHERE organization_id=? AND actor_id=?").bind(orgA, contributor.actorId).first<{status:string}>())?.status, "removed");
      assert.deepEqual(await d1.prepare("SELECT count(*) AS n FROM dossier_working_note_versions WHERE dossier_id=?").bind(dossierId).first(),beforeRevocation);
      return;
    }
    // Controlled fixture-only identity change immediately before the real guarded D1 transaction.
    const counts=()=>d1.prepare("SELECT count(*) AS n FROM dossier_working_note_versions WHERE dossier_id=?").bind(dossierId).first();
    const count=await counts();
    beforeBatchSkip=1; // Skip personal-workspace initialization; race the actual note batch.
    beforeBatch=async()=>{
      const guards=(await d1.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='dossier_participants'").all<{name:string;sql:string}>()).results;
      await d1.batch([...guards.map(g=>d1.prepare(`DROP TRIGGER "${g.name}"`)),d1.prepare("UPDATE dossier_participants SET role='viewer' WHERE dossier_id=? AND actor_id=?").bind(dossierId,contributor.actorId),...guards.map(g=>d1.prepare(g.sql))]);
    };
    await notes({...payload,idempotencyKey:"note-role-revoked"},contributor,404);
    assert.deepEqual(await counts(),count);

  });
  await t.test("immutable content and reciprocal association application reject incomplete history",async()=>{
    await assert.rejects(d1.prepare("UPDATE dossier_working_note_versions SET body='tampered' WHERE note_id=?").bind(noteId).run());
    const old=await d1.prepare("SELECT * FROM dossier_working_note_versions WHERE note_id=? ORDER BY revision DESC LIMIT 1").bind(noteId).first<Record<string,unknown>>();assert.ok(old);
    const malformed=[d1.prepare("INSERT INTO dossier_working_note_versions(id,dossier_id,note_id,revision,title,note_type,body,action,source_link_id,actor_user_id,actor_ref,actor_role,occurred_at,idempotency_key,request_digest) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("note_event_missing_application",dossierId,noteId,noteRevision+1,old.title,old.note_type,old.body,"link","note_link_missing_application",alice.id,alice.actorId,"owner","2026-09-15T12:00:00.000Z","note-missing-application","sha256-"+"a".repeat(64)),d1.prepare("UPDATE dossier_working_notes SET revision=?,updated_at=? WHERE id=?").bind(noteRevision+1,"2026-09-15T12:00:00.000Z",noteId)];
    await assert.rejects(d1.batch(malformed));
    const liveLink=await d1.prepare("SELECT s.*,v.title,v.note_type,v.body,n.revision FROM dossier_working_note_sources s JOIN dossier_working_notes n ON n.dossier_id=s.dossier_id AND n.id=s.note_id JOIN dossier_working_note_versions v ON v.dossier_id=n.dossier_id AND v.note_id=n.id AND v.revision=n.revision WHERE s.dossier_id=? AND s.active=1 LIMIT 1").bind(dossierId).first<Record<string,unknown>>();assert.ok(liveLink);
    await assert.rejects(d1.batch([d1.prepare("INSERT INTO dossier_working_note_versions(id,dossier_id,note_id,revision,title,note_type,body,action,source_link_id,actor_user_id,actor_ref,actor_role,occurred_at,idempotency_key,request_digest) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("note_event_unapplied_unlink",dossierId,liveLink.note_id,Number(liveLink.revision)+1,liveLink.title,liveLink.note_type,liveLink.body,"unlink",liveLink.id,alice.id,alice.actorId,"owner","2026-09-15T12:00:00.000Z","note-unapplied-unlink","sha256-"+"b".repeat(64)),d1.prepare("UPDATE dossier_working_notes SET revision=?,updated_at=? WHERE id=?").bind(Number(liveLink.revision)+1,"2026-09-15T12:00:00.000Z",liveLink.note_id)]));

    assert.equal((await read("?note_id="+noteId)).note.revision,noteRevision);
    await notes({action:"create",title:"Invalid revision",type:"blank",body:"",expectedRevision:null,idempotencyKey:"note-null-revision"},alice,400);
  });
  // Enrollment precedes the baseline; note writes never change governed state.
  const after=await state();assert.deepEqual(after.case,before.case);assert.deepEqual(after.events,before.events);
  assert.deepEqual(after.outputs,before.outputs);assert.deepEqual(after.snapshots,before.snapshots);
  assert.deepEqual(new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer()),pdf);
  const history=await read("?note_id="+noteId+"&history=true");assert.equal(history.history!.length,noteRevision);
  assert.equal((await d1.prepare("PRAGMA foreign_key_check").all()).results.length,0);
});

test("Migration rehearsal: exact v91 operates on C1 schema without discarding new note records", { skip: !migrationMode }, async () => {
  const params = { dossierId };
  const currentRoutes = routes;
  const before = await captureUpgradeState(d1, bucket);
  const c1Tables = ["dossier_request_operations", "dossier_working_notes", "dossier_working_note_versions", "dossier_working_note_sources", "dossier_working_note_applications"];
  assert.ok(before.tables.dossier_working_notes.rows >= 2, "rollback must follow actual C1 data creation");
  assert.ok(before.tables.dossier_working_note_versions.rows >= 8);
  const download = async () => {
    const response = await call("outputDownload", alice, orgA, "GET", undefined, { dossierId, outputId });
    assert.equal(response.status, 200); return new Uint8Array(await response.arrayBuffer());
  };
  const sealedBefore = await download();
  const actions: Array<{ operation: string; status: number }> = [];
  try {
    routes = baselineRoutes;
    // The participant endpoint is POST-only in v91; do not invent a GET contract.
    for (const key of ["detail", "documents", "requests", "outputs", "activity"] as const) {
      const response = await call(key, alice, orgA, "GET", undefined, params);
      actions.push({ operation: "v91 GET " + key, status: response.status });
      await json(response);
    }
    await json(await call("detail", bob, orgB, "GET", undefined, params), 404);
    await json(await call("requests", viewer, orgA, "POST", { action: "create", question: "Denied", reason: "No authority", expectedRevision: revision }, params), 404);
    assert.deepEqual(await download(), sealedBefore);
    const source = await call("download", alice, orgA, "GET", undefined, { dossierId, documentId, versionId });
    assert.equal(source.status, 200); assert.ok((await source.arrayBuffer()).byteLength > 0);
    const oldManifest = await call("manifest", alice, orgA, "GET", undefined, { dossierId, snapshotId });
    assert.equal(oldManifest.status, 200); assert.match(await oldManifest.text(), new RegExp(erpDraft.caseId));
    // v91's real legacy request route has no keyed-operation API. Preserve that contract.
    const requestPayload = { action: "create", question: "Synthetic rollback: confirm reconciliation evidence remains available.", reason: "Isolated v91-on-C1 compatibility rehearsal.", priority: "normal", expectedRevision: revision };
    await json(await call("requests", alice, orgA, "POST", { ...requestPayload, idempotencyKey: "unsupported-v91-key" }, params), 400);
    const created = await json(await call("requests", alice, orgA, "POST", requestPayload, params), 201);
    revision = created.dossier.revision;
    actions.push({ operation: "v91 legacy request create", status: 201 });
    const request = await d1.prepare("SELECT id FROM dossier_information_requests WHERE dossier_id=? AND question=?").bind(dossierId, requestPayload.question).first<{ id: string }>();
    assert.ok(request);
    const closed = await json(await call("requests", alice, orgA, "POST", { action: "update_status", informationRequestId: request.id, status: "waived", expectedRevision: revision }, params));
    revision = closed.dossier.revision;
    actions.push({ operation: "v91 legacy request waive", status: 200 });
    const newSnapshot = await json(await call("snapshots", alice, orgA, "POST", { expectedRevision: revision, locale: "en", audience: "internal", redactionProfileId: "pilot-default" }, params), 201);
    const generated = await json(await call("outputs", alice, orgA, "POST", { action: "generate", expectedRevision: revision, snapshotId: newSnapshot.snapshot.snapshot_id, format: "pdf" }, params), 201);
    const pdf = await call("outputDownload", alice, orgA, "GET", undefined, { dossierId, outputId: generated.output.output_id });
    assert.equal(pdf.status, 200);
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    actions.push({ operation: "v91 fresh snapshot and PDF generation/download", status: 201 });
    assert.deepEqual(await download(), sealedBefore);
  } finally { routes = currentRoutes; }
  await drainRouteJobs();
  const after = await captureUpgradeState(d1, bucket);
  assert.deepEqual(after.schema, before.schema);
  for (const table of c1Tables) {
    assert.ok(before.tables[table], "C1 table missing before rollback: " + table);
    assert.ok(after.tables[table], "C1 table missing after rollback: " + table);
    assert.deepEqual(after.tables[table], before.tables[table], "v91 touched C1 records: " + table);
  }
  for (const object of before.r2) assert.deepEqual(after.r2.find(item => item.key === object.key), object, "v91 changed historical R2 object: " + object.key);
  // Full digests recorded, while permitted legacy writes advance dossier/audit history.
  writeUpgradeEvidence("v91-after-c1-rollback", { scope: "old application on upgraded schema; no database rollback performed", actions, before, after, preservedC1Tables: c1Tables, sealedOriginalPdfSha256: sha256(sealedBefore), historicalDeadlineFixture: "excluded; no insert guard disabled" });
});

// Insert after the v91-on-C1 rollback test, before organization lifecycle tests.
// SQL invariant test only: v91 and the successor still expose the legacy request API.
// This does not implement or claim B2 operation-key recovery from the HTTP endpoint.
test("Migration rehearsal: request operation SQL guards bind one immutable receipt to the actual legacy audit", { skip: !migrationMode }, async () => {
  const request = await d1.prepare("SELECT * FROM dossier_information_requests WHERE dossier_id=? AND question=?").bind(dossierId, "Synthetic rollback: confirm reconciliation evidence remains available.").first<Record<string, unknown>>();
  assert.ok(request, "real legacy request must have been created by the preceding rollback test");
  assert.equal(request.status, "waived");
  const audit = await d1.prepare("SELECT * FROM dossier_audit_events WHERE dossier_id=? AND object_ref_id=? AND event_type='information_request_changed' AND actor_ref=? ORDER BY dossier_revision DESC LIMIT 1").bind(dossierId, request.id, alice.actorId).first<Record<string, unknown>>();
  assert.ok(audit);
  const result = {
    request: { information_request_id: request.id, dossier_id: dossierId, status: request.status, satisfying_document_id: request.satisfying_document_id, satisfying_evidence_link_id: request.satisfying_evidence_link_id },
    dossier: { dossier_id: dossierId, revision: audit.dossier_revision }, audit_event_id: audit.id,
  };
  // This deliberately minimal SQL fixture is derived from an actual authorized audit.
  // It is not presented as a complete public API response or fabricated migration ledger entry.
  const receipt = { id: "request_operation_sql_guard_fixture", dossier_id: dossierId, actor_ref: alice.actorId, idempotency_key: "request-sql-guard-valid", request_digest: "sha256-" + sha256(JSON.stringify(result)), request_id: request.id, revision: audit.dossier_revision, audit_event_id: audit.id, result: JSON.stringify(result), http_status: 200 };
  const columns = Object.keys(receipt);
  const insert = (value: Record<string, unknown>) => d1.prepare(`INSERT INTO dossier_request_operations(${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).bind(...columns.map(key => value[key] as string | number | null)).run();
  const count = () => d1.prepare("SELECT count(*) AS n FROM dossier_request_operations").first();
  const baseline = await count();
  const probes: string[] = [];
  const rejects = async (label: string, delta: Record<string, unknown>) => {
    await assert.rejects(insert({ ...receipt, id: "request_invalid_" + probes.length, idempotency_key: "request-invalid-key-" + probes.length, ...delta }), label);
    assert.deepEqual(await count(), baseline, label + " leaked a row"); probes.push(label);
  };
  await rejects("wrong current request status", { result: JSON.stringify({ ...result, request: { ...result.request, status: "open" } }) });
  await rejects("wrong request identity in result", { result: JSON.stringify({ ...result, request: { ...result.request, information_request_id: "request_other" } }) });
  await rejects("wrong request scope in result", { result: JSON.stringify({ ...result, request: { ...result.request, dossier_id: "dossier_other" } }) });
  await rejects("wrong dossier scope in result", { result: JSON.stringify({ ...result, dossier: { ...result.dossier, dossier_id: "dossier_other" } }) });
  await rejects("wrong dossier revision in result", { result: JSON.stringify({ ...result, dossier: { ...result.dossier, revision: Number(audit.dossier_revision) + 1 } }) });
  await rejects("wrong audit in result", { result: JSON.stringify({ ...result, audit_event_id: "audit_other" }) });
  await rejects("wrong satisfying source in result", { result: JSON.stringify({ ...result, request: { ...result.request, satisfying_document_id: documentId } }) });
  await rejects("wrong actor binding", { actor_ref: reviewer.actorId });
  await rejects("wrong row revision binding", { revision: Number(audit.dossier_revision) + 1 });
  await rejects("wrong request row binding", { request_id: "request_missing" });
  await rejects("wrong audit row binding", { audit_event_id: "audit_missing" });
  await rejects("invalid JSON", { result: "{" });
  await rejects("non-success HTTP status", { http_status: 409 });
  await rejects("short operation key", { idempotency_key: "short" });
  await rejects("short digest", { request_digest: "sha256-invalid" });
  await insert(receipt);
  const committed = await d1.prepare("SELECT * FROM dossier_request_operations WHERE id=?").bind(receipt.id).first();
  assert.deepEqual(committed, receipt);
  await assert.rejects(insert({ ...receipt, id: "request_duplicate_key" }));
  await assert.rejects(insert({ ...receipt, id: "request_duplicate_audit", idempotency_key: "request-different-key" }));
  await assert.rejects(d1.prepare("UPDATE dossier_request_operations SET result='{}' WHERE id=?").bind(receipt.id).run());
  await assert.rejects(d1.prepare("DELETE FROM dossier_request_operations WHERE id=?").bind(receipt.id).run());
  assert.deepEqual(await d1.prepare("SELECT * FROM dossier_request_operations WHERE id=?").bind(receipt.id).first(), committed);
  assert.equal((await d1.prepare("PRAGMA foreign_key_check").all()).results.length, 0);
  // Exercise the same exact old application with all five new tables populated.
  const c1Tables = ["dossier_request_operations", "dossier_working_notes", "dossier_working_note_versions", "dossier_working_note_sources", "dossier_working_note_applications"];
  const beforeOldWrite = await captureUpgradeState(d1, bucket);
  for (const table of c1Tables) assert.ok(beforeOldWrite.tables[table]?.rows > 0, "non-vacuous old-app compatibility requires populated " + table);
  const currentRoutes = routes;
  try {
    routes = baselineRoutes;
    await json(await call("requests", alice, orgA, "GET", undefined, { dossierId }));
    const changed = await json(await call("requests", alice, orgA, "POST", { action: "update_status", informationRequestId: request.id, status: "cancelled", expectedRevision: revision }, { dossierId }));
    revision = changed.dossier.revision;
    const historicPdf = await call("outputDownload", alice, orgA, "GET", undefined, { dossierId, outputId });
    assert.equal(historicPdf.status, 200); assert.ok((await historicPdf.arrayBuffer()).byteLength > 0);
  } finally { routes = currentRoutes; }
  await drainRouteJobs();
  const afterOldWrite = await captureUpgradeState(d1, bucket);
  for (const table of c1Tables) assert.deepEqual(afterOldWrite.tables[table], beforeOldWrite.tables[table], "old app changed populated " + table);
  assert.deepEqual(afterOldWrite.schema, beforeOldWrite.schema);
  assert.deepEqual(afterOldWrite.r2, beforeOldWrite.r2);
  // Isolate operation-key uniqueness with a distinct, valid and unused audit from the old handler.
  const distinctAudit = await d1.prepare("SELECT id,dossier_revision FROM dossier_audit_events WHERE dossier_id=? AND object_ref_id=? AND event_type='information_request_changed' AND actor_ref=? ORDER BY dossier_revision DESC LIMIT 1").bind(dossierId, request.id, alice.actorId).first<{ id: string; dossier_revision: number }>();
  assert.ok(distinctAudit);
  assert.notEqual(distinctAudit.id, audit.id);
  assert.equal(await d1.prepare("SELECT id FROM dossier_request_operations WHERE dossier_id=? AND audit_event_id=?").bind(dossierId, distinctAudit.id).first(), null);
  const currentRequest = await d1.prepare("SELECT status FROM dossier_information_requests WHERE dossier_id=? AND id=?").bind(dossierId, request.id).first<{ status: string }>();
  assert.equal(currentRequest?.status, "cancelled");
  const distinctResult = { ...result, request: { ...result.request, status: "cancelled" }, dossier: { ...result.dossier, revision: distinctAudit.dossier_revision }, audit_event_id: distinctAudit.id };
  await assert.rejects(insert({ ...receipt, id: "request_duplicate_key_distinct_audit", audit_event_id: distinctAudit.id, revision: distinctAudit.dossier_revision, result: JSON.stringify(distinctResult), request_digest: "sha256-" + sha256(JSON.stringify(distinctResult)) }), /UNIQUE constraint failed: dossier_request_operations\.dossier_id, dossier_request_operations\.actor_ref, dossier_request_operations\.idempotency_key/u);
  assert.deepEqual(await d1.prepare("SELECT * FROM dossier_request_operations WHERE id=?").bind(receipt.id).first(), committed);
  assert.equal(await d1.prepare("SELECT id FROM dossier_request_operations WHERE id=?").bind("request_duplicate_key_distinct_audit").first(), null);
  writeUpgradeEvidence("request-operation-sql-guards", { scope: "local direct SQL invariants, no new HTTP API and no hosted evidence", deniedInvalidBindings: probes, authorizedAuditAccepted: true, duplicateReceiptDenied: true, independentUniqueKeyDenied: true, duplicateAuditDenied: true, updateDenied: true, deleteDenied: true, receiptSha256: sha256(JSON.stringify(committed)), exactV91PreservesFiveNonemptyC1Tables: true, beforeOldWrite, afterOldWrite });
});

test("Migration rehearsal: current B1 writes and historical receipt recovery work after C1 and v91 writes", { skip: !migrationMode }, async () => {
  const params = { dossierId };
  const original = await d1.prepare("SELECT * FROM dossier_source_anchor_retirements WHERE dossier_id=? AND idempotency_key=?").bind(dossierId, "citation-retire-once").first<Record<string, unknown>>();
  assert.ok(original);
  const historicalQuery = "?kind=citation&id=" + encodeURIComponent(String(original.source_anchor_id)) + "&operation_key=citation-retire-once";
  const historical = await json(await call("dispositions", reviewer, orgA, "GET", undefined, params, historicalQuery));
  const originalRevision = historical.dossier.revision;
  assert.ok(originalRevision < revision);
  await json(await call("dispositions", alice, orgA, "GET", undefined, params, historicalQuery), 404);
  // Create an older-version citation through the actual upload handler, keeping all guards enabled.
  const advancedSource = await upload("01-incident.md", readFileSync(fixtureRoot + "01-incident.md", "utf8") + "\nSynthetic post-upgrade revision: reconciliation evidence requires renewed source review.\n", documentId);
  const anchor = await d1.prepare("SELECT a.id,a.document_version_id FROM dossier_source_anchors a WHERE a.dossier_id=? AND a.document_id=? AND a.review_state='accepted' AND NOT EXISTS (SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=a.dossier_id AND r.source_anchor_id=a.id) ORDER BY a.id LIMIT 1").bind(dossierId, documentId).first<{ id: string; document_version_id: string }>();
  assert.ok(anchor);
  assert.notEqual(anchor.document_version_id, advancedSource.version.document_version_id, "retirement fixture must select an accepted citation to an older source version");
  const payload = { kind: "citation", recordId: anchor.id, reason: "Synthetic post-upgrade citation review after old-app compatibility writes.", expectedRevision: revision, idempotencyKey: "citation-after-c1-v91" };
  const beforeDenied = await d1.prepare("SELECT count(*) AS n FROM dossier_source_anchor_retirements WHERE dossier_id=?").bind(dossierId).first();
  await json(await call("dispositions", viewer, orgA, "POST", payload, params), 404);
  await json(await call("dispositions", bob, orgB, "POST", payload, params), 404);
  assert.deepEqual(await d1.prepare("SELECT count(*) AS n FROM dossier_source_anchor_retirements WHERE dossier_id=?").bind(dossierId).first(), beforeDenied);
  const applied = await json(await call("dispositions", reviewer, orgA, "POST", payload, params)); revision = applied.dossier.revision;
  const replay = await json(await call("dispositions", reviewer, orgA, "POST", payload, params));
  assert.equal(replay.dossier.revision, applied.dossier.revision);
  await json(await call("dispositions", reviewer, orgA, "POST", { ...payload, reason: "Conflicting payload under same key" }, params), 409);
  const recoveredAgain = await json(await call("dispositions", reviewer, orgA, "GET", undefined, params, historicalQuery));
  assert.equal(recoveredAgain.dossier.revision, originalRevision);
  assert.deepEqual(await d1.prepare("SELECT * FROM dossier_source_anchor_retirements WHERE id=?").bind(original.id).first(), original);
  await drainRouteJobs();
  writeUpgradeEvidence("post-upgrade-b1", { originalReceiptPreserved: true, originalRevision, currentRevision: revision, appliedReceiptRecovered: true, unauthorizedDenied: true, changedPayloadConflict: true, state: await captureUpgradeState(d1, bucket) });
});

test("P1: every dossier route denies a foreign organization before reads or side effects", async () => {
  const params = { dossierId, documentId, versionId, outputId: "output_" + "1".repeat(32), snapshotId: "snapshot_" + "2".repeat(32) };
  for (const key of ["detail", "documents", "download", "participants", "requests", "anchors", "assertions", "links", "packages", "snapshots", "outputs", "outputDownload", "manifest", "activity", "proposals"] as const) {
    if (routes[key].GET) await json(await call(key, bob, orgB, "GET", undefined, params), 404);
  }
  for (const key of ["documents", "documentReview", "participants", "requests", "anchors", "assertions", "links", "packages", "snapshots", "outputs", "proposals", "generate", "transitions"] as const) {
    if (routes[key].POST) await json(await call(key, bob, orgB, "POST", key === "outputs" ? { action: "generate" } : {}, params), 404);
  }
  const db = drizzle(d1, { schema });
  const stale = await resolveOrganization(db, { userId: reviewer.id, actorId: reviewer.actorId }, orgA);
  await json(await call("organizations", alice, orgA, "POST", { action: "member", organizationId: orgA,
    actorId: reviewer.actorId, role: "org_admin", status: "suspended", expectedRevision: stale.membershipRevision }));
  await json(await call("detail", reviewer, organizationSelectionToken(stale), "GET", undefined, { dossierId }), 404);
  await json(await call("organizations", alice, orgA, "POST", { action: "member", organizationId: orgA,
    actorId: reviewer.actorId, role: "org_admin", status: "active", expectedRevision: stale.membershipRevision + 1 }));
  await json(await call("detail", reviewer, organizationSelectionToken(stale), "GET", undefined, { dossierId }), 409);
});

test("P1: revocation during an R2 read prevents delivery of private bytes", async () => {
  const db = drizzle(d1, { schema });
  const authority = await resolveOrganization(db, { userId: reviewer.id, actorId: reviewer.actorId }, orgA);
  afterObjectRead = async () => {
    await json(await call("organizations", alice, orgA, "POST", { action: "member", organizationId: orgA,
      actorId: reviewer.actorId, role: "org_admin", status: "suspended", expectedRevision: authority.membershipRevision }));
  };
  await json(await call("download", reviewer, orgA, "GET", undefined, { dossierId, documentId, versionId }), 404);
  await json(await call("organizations", alice, orgA, "POST", { action: "member", organizationId: orgA,
    actorId: reviewer.actorId, role: "org_admin", status: "active", expectedRevision: authority.membershipRevision + 1 }));
});

test("P1: revocation during upload aborts metadata, revision and success receipts", async () => {
  const contributor = await newActor("contributor");
  await invite(contributor);
  const enrolled = await json(await call("participants", alice, orgA, "POST", { actorId: contributor.actorId, role: "contributor", expectedRevision: revision }, { dossierId }), 201);
  revision = enrolled.dossier.revision;
  const before = (await json(await call("documents", alice, orgA, "GET", undefined, { dossierId }))).documents;
  const db = drizzle(d1, { schema });
  const authority = await resolveOrganization(db, { userId: contributor.id, actorId: contributor.actorId }, orgA);
  afterObjectWrite = async () => {
    await json(await call("organizations", alice, orgA, "POST", { action: "member", organizationId: orgA,
      actorId: contributor.actorId, role: "member", status: "suspended", expectedRevision: authority.membershipRevision }));
  };
  const form = new FormData();
  form.set("file", new File(["Synthetic data that must not commit."], "revoked.md", { type: "text/markdown" }));
  form.set("title", "revoked.md"); form.set("documentType", "correspondence"); form.set("classification", "internal");
  form.set("privacyAcknowledged", "true"); form.set("expectedRevision", String(revision)); form.set("mediaType", "text/markdown");
  const rejected = await call("documents", contributor, orgA, "POST", form, { dossierId });
  assert.ok([404, 409].includes(rejected.status), await rejected.text());
  assert.equal(afterObjectWrite, undefined, "the test must revoke after the real R2 write");
  const after = await json(await call("documents", alice, orgA, "GET", undefined, { dossierId }));
  assert.deepEqual(after.documents.map((d) => d.document_id), before.map((d) => d.document_id));
  const current = await json(await call("detail", alice, orgA, "GET", undefined, { dossierId }));
  assert.equal(current.dossier.revision, revision);
});

test("P1: independent lifecycle approval invalidates contexts and outstanding invitations", async () => {
  const db = drizzle(d1, { schema });
  const stale = await resolveOrganization(db, { userId: alice.id, actorId: alice.actorId }, orgA);
  const futureMember = await newActor("future-member");
  const invitation = await json(await call("organizations", alice, orgA, "POST", { action: "invite", organizationId: orgA,
    recipientActorId: futureMember.actorId, role: "member" }), 201);
  const suspend = await json(await call("organizations", alice, orgA, "POST", { action: "lifecycle_request", organizationId: orgA, command: "suspend" }), 201);
  await json(await call("organizations", alice, orgA, "POST", { action: "lifecycle_approve", organizationId: orgA, requestId: suspend.id }), 409);
  await json(await call("organizations", reviewer, orgA, "POST", { action: "lifecycle_approve", organizationId: orgA, requestId: suspend.id }));
  await json(await call("dossiers", alice, orgA), 404);
  const resume = await json(await call("organizations", alice, orgA, "POST", { action: "lifecycle_request", organizationId: orgA, command: "resume" }), 201);
  await json(await call("organizations", reviewer, orgA, "POST", { action: "lifecycle_approve", organizationId: orgA, requestId: resume.id }));
  await json(await call("dossiers", alice, organizationSelectionToken(stale)), 409);
  await json(await call("organizations", futureMember, null, "POST", { action: "accept", token: invitation.token }), 404);
  await json(await call("detail", alice, orgA, "GET", undefined, { dossierId }));
  const receipts = await d1.prepare("SELECT action,actor_id,previous_digest,digest FROM organization_security_events WHERE organization_id=? ORDER BY sequence").bind(orgA).all();
  let previous: unknown = null;
  for (const receipt of receipts.results) { assert.equal(receipt.previous_digest, previous); previous = receipt.digest; }
  assert.ok(receipts.results.some((r) => r.action === "invitation_accepted" && r.actor_id === reviewer.actorId));
  await assert.rejects(d1.prepare("UPDATE organization_security_events SET digest='tampered' WHERE organization_id=?").bind(orgA).run());
});

test("P1: selection, cursor, CSRF and unavailable compliance features fail closed", async () => {
  await json(await call("dossiers", alice, orgA, "POST", { title: "Second synthetic case", jurisdictions: ["Test"], classification: "internal" }), 201);
  const page = await json(await call("dossiers", alice, orgA, "GET", undefined, {}, "?limit=1"));
  assert.ok(page.next_cursor, JSON.stringify(page));
  await json(await call("dossiers", bob, orgB, "GET", undefined, {}, "?cursor=" + encodeURIComponent(page.next_cursor)), 400);
  const request = new Request("https://erp.test/api/organizations", { method: "POST", headers: { origin: "https://evil.test", "sec-fetch-site": "cross-site", "oai-authenticated-user-email": alice.email }, body: JSON.stringify({ action: "create", name: "forged" }) });
  await json(await storage.run(request, () => routes.organizations.POST!(request, { params: Promise.resolve({}) })), 403);
  const workspace = await json(await call("organizations", alice, orgA));
  assert.deepEqual(workspace.capabilities, { mode: "synthetic_validation", confidentialUploads: false, entraOidc: false, complianceExport: false });
  await json(await call("organizations", alice, orgA, "POST", { action: "compliance_export", organizationId: orgA }), 400);
  assert.doesNotMatch(JSON.stringify(workspace), /tokenDigest|token_digest|secret_/u);
});
