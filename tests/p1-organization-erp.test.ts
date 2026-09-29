import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { replayRecordedCanopy } from "./helpers/canopy-replay";
import { canopySemanticInputDiff } from "../app/canopy-inputs";
import { actionUseKey, decisionAvailability } from "../app/game-engine";
import { before, after, test } from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { organizationSelectionToken, resolveOrganization, type OrganizationAuthority } from "../app/organization-store";
import { caseFingerprint, canonicalFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { compileStudioDraft } from "../app/studio-compiler";
import { CANOPY_SOURCES, CANOPY_SCENARIOS, CANOPY_DISCLOSURE, buildCanopyPackage, canopySource, canopySourceText, type CanopyScenarioId } from "../app/canopy-fixture";
import { CanopyWorkingCopy, type CanopyTransport, type Session } from "../app/canopy-workflow";

// Only runtime transport is adapted. These tests call the real route handlers,
// identity resolver, policy, audit batches, upload coordinator and D1/R2 stores.
// Synthetic trusted headers model Sites dispatch in this isolated harness.
type Actor = { id: number; actorId: string; email: string };
type ApiResult = {
  organization: OrganizationAuthority; token: string; id: string;
  dossier: { dossier_id: string; revision: number }; dossier_id: string; dossier_revision: number;
  dossiers: unknown[]; documents: Array<{ document_id: string; classification: string; source_origin: string; current_version_id: string; versions: Array<{ original_filename: string }> }>; document_id: string;
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
let mf: Miniflare;
let d1: D1Database;
let bucket: R2Bucket;
let alice: Actor, bob: Actor, reviewer: Actor, viewer: Actor;
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
const erpDraft = normalizeStudioDraft(JSON.parse(readFileSync(fixtureRoot + "erp-d365-pilot.studio-draft.json", "utf8")));
const paths = {
  login: "app/api/auth/login/route.ts",
  register: "app/api/auth/register/route.ts", logout: "app/api/auth/logout/route.ts",
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
  mf = new Miniflare({ workers: [{ config: { name: "p1-test", type: "worker", compatibilityDate: "2026-09-01",
    manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } },
    env: { DB: { type: "d1", name: "p1-test" }, DOSSIER_DOCUMENTS: { type: "r2", name: "p1-test" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "p1-test") as unknown as D1Database;
  bucket = await mf.getR2Bucket("DOSSIER_DOCUMENTS", "p1-test") as unknown as R2Bucket;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) {
    const statements = readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await d1.batch(statements.map((s) => d1.prepare(s)));
  }
  const observedD1 = new Proxy(d1, { get(target, property) {
    if (property === "batch") return async (statements: D1PreparedStatement[]) => {
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
  alice = await newActor("alice"); bob = await newActor("bob"); reviewer = await newActor("reviewer"); viewer = await newActor("viewer");
  orgA = (await json(await call("organizations", alice, null, "POST", { action: "create", name: "ERP Alpha" }), 201)).organization.id;
  orgB = (await json(await call("organizations", bob, null, "POST", { action: "create", name: "ERP Beta" }), 201)).organization.id;
  const studioFingerprint = caseFingerprint(erpDraft);
  const compiled = compileStudioDraft(erpDraft, studioFingerprint);
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
after(async () => { await mf?.dispose(); });

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

test("Upload acknowledgement and immutable versions: rejection preserves state; checked PDF upload persists and downloads", async () => {
  const actor = await newActor("upload-contract");
  const organization = (await json(await call("organizations", actor, null, "POST", { action: "create", name: "Upload contract test" }), 201)).organization.id;
  const created = await json(await call("dossiers", actor, organization, "POST", { title: "Synthetic upload contract", jurisdictions: ["Test"], classification: "confidential" }), 201);
  const id = created.dossier.dossier_id;
  const currentRevision = created.dossier.revision;
  const pdf = new Uint8Array(readFileSync("docs/testing/next-stage-2026-09-15/canopy-controlled.pdf"));
  function form(acknowledgements: string[]) {
    const value = new FormData();
    value.set("file", new File([pdf], "synthetic-canopy.pdf", { type: "application/pdf" }));
    value.set("title", "Synthetic PDF"); value.set("documentType", "analytical report");
    value.set("classification", "public"); value.set("documentId", "");
    value.set("expectedRevision", String(currentRevision)); value.set("mediaType", "application/pdf");
    for (const acknowledgement of acknowledgements) value.append("privacyAcknowledged", acknowledgement);
    return value;
  }
  const state = () => d1.prepare(`SELECT revision,
    (SELECT count(*) FROM dossier_documents WHERE dossier_id=?) AS documents,
    (SELECT count(*) FROM dossier_revision_receipts WHERE dossier_id=?) AS receipts,
    (SELECT count(*) FROM dossier_upload_intents WHERE dossier_id=?) AS intents
    FROM dossiers WHERE id=?`).bind(id, id, id, id).first();
  const beforeState = await state();
  const beforeObjects = (await bucket.list()).objects.map(object => object.key).sort();
  for (const acknowledgement of [[], ["false"], ["yes"], ["true", "true"]]) {
    const response = await call("documents", actor, organization, "POST", form(acknowledgement), { dossierId: id });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as {code:string}).code, "document_upload_invalid");
    assert.deepEqual(await state(), beforeState);
    assert.deepEqual((await bucket.list()).objects.map(object => object.key).sort(), beforeObjects);
  }
  const accepted = await json(await call("documents", actor, organization, "POST", form(["true"]), { dossierId: id }), 201);
  assert.equal(accepted.dossier_revision, currentRevision + 1);
  const reopened = await json(await call("documents", actor, organization, "GET", undefined, { dossierId: id }));
  assert.equal(reopened.documents.length, 1); assert.equal(reopened.documents[0].document_id, accepted.document_id);
  const download = await call("download", actor, organization, "GET", undefined, { dossierId: id, documentId: accepted.document_id, versionId: accepted.version.document_version_id });
  assert.equal(download.status, 200); assert.deepEqual(new Uint8Array(await download.arrayBuffer()), pdf);
  const versionForm = () => {
    const value = form(["true"]);
    value.set("documentId", accepted.document_id); value.set("expectedRevision", String(accepted.dossier_revision));
    value.set("file", new File(["# Synthetic replacement\nDifferent file, same logical document."], "renamed-replacement.md", { type: "text/markdown" }));
    value.set("mediaType", "text/markdown"); return value;
  };
  const versionState = () => d1.prepare(`SELECT document_version_id,
    (SELECT count(*) FROM dossier_document_versions WHERE dossier_id=?) AS versions
    FROM dossier_document_current_versions WHERE dossier_id=? AND document_id=?`).bind(id, id, accepted.document_id).first();
  const beforeVersionState = await versionState(), beforeVersionCase = await state();
  const beforeVersionObjects = (await bucket.list()).objects.map(object => object.key).sort();
  for (const [field, replacement] of [["title", "Wrong title"], ["documentType", "wrong type"], ["classification", "confidential"]]) {
    const mismatched = versionForm(); mismatched.set(field, replacement);
    const response = await call("documents", actor, organization, "POST", mismatched, { dossierId: id });
    assert.equal(response.status, 409); assert.equal((await response.json() as {code:string}).code, "document_metadata_conflict");
    assert.deepEqual(await versionState(), beforeVersionState); assert.deepEqual(await state(), beforeVersionCase);
    assert.deepEqual((await bucket.list()).objects.map(object => object.key).sort(), beforeVersionObjects);
  }
  const second = await json(await call("documents", actor, organization, "POST", versionForm(), { dossierId: id }), 201);
  assert.equal(second.document_id, accepted.document_id); assert.equal(second.version.predecessor_version_id, accepted.version.document_version_id);
  assert.equal(second.dossier_revision, accepted.dossier_revision + 1);
  const versionList = await json(await call("documents", actor, organization, "GET", undefined, { dossierId: id }));
  assert.equal(versionList.documents.length, 1); assert.equal(versionList.documents[0].versions.length, 2);
  assert.equal(versionList.documents[0].classification, "public"); assert.equal(versionList.documents[0].source_origin, "internal_upload");
  assert.equal(versionList.documents[0].current_version_id, second.version.document_version_id);
  assert.equal(versionList.documents[0].versions[0].original_filename, "renamed-replacement.md");
  const originalAgain = await call("download", actor, organization, "GET", undefined, { dossierId: id, documentId: accepted.document_id, versionId: accepted.version.document_version_id });
  assert.equal(originalAgain.status, 200); assert.deepEqual(new Uint8Array(await originalAgain.arrayBuffer()), pdf);
  const replacementDownload = await call("download", actor, organization, "GET", undefined, { dossierId: id, documentId: accepted.document_id, versionId: second.version.document_version_id });
  assert.equal(replacementDownload.status, 200); assert.equal(await replacementDownload.text(), "# Synthetic replacement\nDifferent file, same logical document.");
  await json(await call("documents", null, organization, "POST", form(["true"]), { dossierId: id }), 401);
  await json(await call("documents", bob, orgB, "POST", form(["true"]), { dossierId: id }), 404);
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

test("Dependable actions: historical disposition and citation retirement persist with exact audit, denial, replay and conflicts", async () => {
 const params={dossierId};
 const originalPdf=new Uint8Array(await (await call("outputDownload",alice,orgA,"GET",undefined,{dossierId,outputId})).arrayBuffer());
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
 await json(await call("activity",reviewer,orgA,"GET",undefined,params,"?event_id="),404);
 await json(await call("activity",reviewer,orgA,"GET",undefined,params,exactQuery+"&event_id=event_missing_000000000001"),400);
 await json(await call("activity",reviewer,orgA,"GET",undefined,params,exactQuery+"&cursor="),400);
 await assert.rejects(d1.prepare("UPDATE dossier_deadline_references SET due_at='2030-01-01T00:00:00.000Z' WHERE id=?").bind(fields.recordId).run());
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
 const originalReplay=await json(await call("dispositions",reviewer,orgA,"POST",fields,params));assert.equal(originalReplay.dossier.revision,result.dossier.revision);
 const recovered=await json(await call("dispositions",reviewer,orgA,"GET",undefined,params,"?kind=deadline&id="+fields.recordId+"&operation_key="+fields.idempotencyKey));assert.equal(recovered.dossier.revision,result.dossier.revision);
 await json(await call("dispositions",alice,orgA,"GET",undefined,params,"?kind=deadline&id="+fields.recordId+"&operation_key="+fields.idempotencyKey),404);
 await json(await call("dispositions",reviewer,orgA,"GET",undefined,params,"?kind=deadline&id="+fields.recordId+"&operation_key=wrong-operation-key"),404);
 const invalidReason=await call("dispositions",reviewer,orgA,"POST",{...fields,reason:""},params);assert.equal(invalidReason.status,400);assert.equal((await invalidReason.json() as {field:string}).field,"reason");
 const keyConflict=await call("dispositions",reviewer,orgA,"POST",{...fields,reason:"Changed under the original key"},params);assert.equal(keyConflict.status,409);assert.equal((await keyConflict.json() as {code:string}).code,"operation_key_conflict");
 const assertion=await d1.prepare("SELECT id FROM dossier_professional_assertions WHERE dossier_id=? ORDER BY updated_at LIMIT 1").bind(dossierId).first<{id:string}>();assert.ok(assertion);
 const exactAssertion=await (await call("assertions",alice,orgA,"GET",undefined,params,"?assertion_id="+assertion.id)).json() as {assertions:Array<{assertion_id:string}>};assert.deepEqual(exactAssertion.assertions.map(a=>a.assertion_id),[assertion.id]);
 await json(await call("assertions",bob,orgB,"GET",undefined,params,"?assertion_id="+assertion.id),404);
 await json(await call("assertions",alice,orgA,"GET",undefined,params,"?assertion_id=assertion_missing"),404);
 await json(await call("assertions",alice,orgA,"GET",undefined,params,"?assertion_id="+assertion.id+"&cursor=assertion_missing"),400);
 assert.equal((await d1.prepare("PRAGMA foreign_key_check").all()).results.length,0);
 writeFileSync(".artifacts/p1-route-tests/dependable-actions-evidence.json",JSON.stringify({environment:"Miniflare D1/R2 actual handlers; trusted-header simulation, not browser authentication",deadlineReceipt,audit,retirement:await d1.prepare("SELECT * FROM dossier_source_anchor_retirements WHERE dossier_id=?").bind(dossierId).first(),oldPdfBytesPreserved:true},null,2));
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

function canopyTransport(actor:Actor,organization:string):CanopyTransport {
 return async (path,init={})=>{
  if(typeof init.body==="string")assert.match(new Headers(init.headers).get("content-type")??"",/application\/json/u);
  for(const [key,file] of Object.entries(paths)){
   const names:string[]=[];
   const pattern=file.replace(/^app/,"").replace(/\/route\.ts$/,"").replace(/\[([^\]]+)\]/gu,(_,name:string)=>{names.push(name);return "([^/]+)";});
   const match=new RegExp("^"+pattern+"$").exec(path.split("?")[0]);
   if(!match)continue;
   const params=Object.fromEntries(names.map((name,index)=>[name,match[index+1]]));
   const body=init.body instanceof FormData?init.body:typeof init.body==="string"?JSON.parse(init.body):undefined;
   return call(key as keyof typeof paths,actor,organization,init.method??"GET",body,params,path.includes("?")?"?"+path.split("?")[1]:"");
  }
  throw new Error("Unsupported normal Canopy API route: "+path);
 };
}
test("Canopy V2: independent reviewed copies, causal walkthrough and exact output governance",async(t)=>{
 const db=drizzle(d1,{schema});
 const scenarioIds=[...CANOPY_SCENARIOS.map(s=>s.id),"hard_stop_unavailable" as const];
 const packages=[...new Map(scenarioIds.filter(id=>id!=="hard_stop_unavailable").flatMap(id=>[buildCanopyPackage(id),buildCanopyPackage(id,true)]).concat(buildCanopyPackage("hard_stop_unavailable",true)).map(p=>[p.draft.caseId+"@"+p.draft.version,p])).values()];
 for(const p of [...new Map(packages.map(p=>[p.draft.caseId,p])).values()])await db.insert(schema.cases).values({id:p.draft.caseId,currentVersion:p.draft.version,fingerprint:p.scenario.fingerprint,title:p.draft.title,jurisdiction:"Fictional Gulf market",practiceArea:"Managed-site decision",sector:"Synthetic training",difficulty:"Advanced",durationMinutes:12});
 for(const p of packages)await db.insert(schema.caseVersions).values({caseId:p.draft.caseId,version:p.draft.version,fingerprint:p.scenario.fingerprint,parentCaseId:p.draft.parent?.caseId,parentVersion:p.draft.parent?.version,parentFingerprint:p.draft.parent?.fingerprint,studioFingerprint:p.studioFingerprint,payload:{kind:"playable-scenario-v1",studioDraft:p.draft,scenario:p.scenario},publishedAt:p.draft.updatedAt});
 // Catalog rows are isolated test fixtures. This does not establish normal publication or browser acceptance.
 orgA=(await json(await call("organizations",alice,null,"POST",{action:"create",name:"Verdant Atelier V2 — synthetic local fixture"}),201)).organization.id;
 await invite(reviewer,"org_admin");await invite(viewer);
 const api=canopyTransport(alice,orgA),root=".artifacts/canopy-v2";
 mkdirSync(root+"/sources",{recursive:true});
 for(const source of CANOPY_SOURCES)writeFileSync(root+"/sources/"+source.id+"-v"+source.version+".md",canopySourceText(source));
 const copies=new Map<CanopyScenarioId,CanopyWorkingCopy>(),receipts:Array<Record<string,unknown>>=[],replays:unknown[]=[],sessions=new Map<CanopyScenarioId,Session>();
 const reviewPrepared=async(copy:CanopyWorkingCopy,id:CanopyScenarioId)=>{
  await copy.prepareScenario(id);
  for(const [key,source] of Object.entries(copy.sources))if(!source.reviewed){const [document,version]=key.split("@");await copy.reviewSource(document,Number(version));}
  const proposal=await copy.proposeScenario(id);
  await assert.rejects(copy.startRun(id),/Explicit acceptance/u);
  await copy.prepareDemoProposals(id,false);const preparedRevision=copy.revision;await copy.prepareDemoProposals(id,false);assert.equal(copy.revision,preparedRevision,"Resuming complete preparation creates no duplicate proposals");
  await copy.reviewProposal(proposal,"accept");
  const memoProposals=[...copy.pendingProposals];
  await assert.rejects(copy.startRun(id),/Review every prepared proposal/u);
  for(const pending of memoProposals)await copy.reviewProposal(pending,"accept");
  const reopened=await CanopyWorkingCopy.resume(copy.api,copy.dossierId);assert.equal(reopened.currentScenario,id,"Accepted prepared scenario survives refresh before its first run");
 };
 for(const scenario of CANOPY_SCENARIOS)await t.test("Canopy V2 scenario: "+scenario.id,async()=>{
  const checkpoints:Session[]=[];
  const tracked:CanopyTransport=async(path,init)=>{const response=await api(path,init);if(path==="/api/play-sessions"&&init?.method==="POST"&&response.ok)checkpoints.push(((await response.clone().json()) as {session:Session}).session);return response;};
  const copy=await CanopyWorkingCopy.create(tracked,undefined,scenario.id);copies.set(scenario.id,copy);
  if(scenario.id==="base"){const before=copy.revision;await assert.rejects(copy.prepareUpdate("upside"),/Complete and link/u);assert.equal(copy.revision,before);}
  assert.equal(Object.keys(copy.sources).length,9);assert.ok(Object.values(copy.sources).every(s=>!s.reviewed));
  assert.match(JSON.stringify(await copy.get()),/INFORMATION_REQUEST_OPEN/u);assert.equal((await copy.get("outputs")).outputs instanceof Array,true);
  await copy.mutate("participants",{actorId:reviewer.actorId,role:"reviewer"});await copy.mutate("participants",{actorId:viewer.actorId,role:"viewer"});
  await copy.prepareScenario(scenario.id);
  // Resume from one already accepted anchor; review must skip it rather than fail409.
  const d01=copy.source("D01",1);await copy.mutate("documents/"+d01.documentId+"/review",{decision:"accepted_source"});
  await copy.mutate("evidence/anchors",{action:"review",sourceAnchorId:d01.anchors.Mandate,decision:"accepted"});
  const resumed=await CanopyWorkingCopy.resume(tracked,copy.dossierId);
  await resumed.reviewSource("D01",1);
  copy.revision=resumed.revision;Object.assign(copy.sources,resumed.sources);
  for(const [key,source] of Object.entries(copy.sources))if(!source.reviewed){const [document,version]=key.split("@");await copy.reviewSource(document,Number(version));}
  const unsafe=await copy.propose("Treat all 600 indicated packs as signed demand.",[{id:"D03",version:scenario.d03,section:"Demand"}]);
  const gap=await copy.propose("Demand and capacity are identical.",[{id:"D03",version:scenario.d03,section:"Demand"},{id:"D04",version:1,section:"Capacity"}]);
  await copy.reviewProposal(unsafe,"reject");await copy.reviewProposal(gap,"edit_and_accept","The source records 600 indicated packs but capacity is 480. Signed commitments and stress assumptions must remain distinct.");
  await reviewPrepared(copy,scenario.id);
  for(const [key,source] of Object.entries({demand:copy.source("D03",scenario.d03),commissioning:copy.source("D06",scenario.d06),leadership:copy.source("D08",scenario.d08)}))await copy.mutate("requests",{action:"update_status",requestId:copy.openingRequests[key],status:"received",satisfyingDocumentId:source.documentId});
  checkpoints.length=0;const run=await copy.run(scenario.id);sessions.set(scenario.id,run.session);
  assert.equal(run.session.state.currentStageId,"studio-"+scenario.terminal);assert.ok(run.packageRef);
  await copy.linkScenarioEvidence(scenario.id,run.packageRef);
  const linkedRevision=copy.revision;await copy.linkScenarioEvidence(scenario.id,run.packageRef);assert.equal(copy.revision,linkedRevision,"Exact relationship retry is idempotent");
  const outputs=await copy.seal();
  await json(await call("outputs",viewer,orgA,"POST",{action:"approve",expectedRevision:copy.revision,outputId:outputs.pdfOutputId},{dossierId:copy.dossierId}),404);
  const approval=await json(await call("outputs",reviewer,orgA,"POST",{action:"approve",expectedRevision:copy.revision,outputId:outputs.pdfOutputId},{dossierId:copy.dossierId}));
  const basePath="/api/dossiers/"+copy.dossierId+"/outputs/";
  const pdf=await api(basePath+outputs.pdfOutputId+"/download");assert.equal(pdf.status,200);const pdfBytes=new Uint8Array(await pdf.arrayBuffer());
  const snapshot=await api("/api/dossiers/"+copy.dossierId+"/snapshots/"+outputs.snapshotId+"/manifest");assert.equal(snapshot.status,200);const snapshotText=await snapshot.text();
  const governed=await api(basePath+outputs.jsonOutputId+"/download");assert.equal(governed.status,200);const modelText=await governed.text(),model=JSON.parse(modelText);
  assert.ok(model.assertion_register.every((a:{statement:string})=>a.statement!=="Treat all 600 indicated packs as signed demand."));
  const pinned="Canopy pinned inputs / "+canonicalFingerprint(scenario.inputs)+": "+JSON.stringify(scenario.inputs);
  assert.ok(model.assertion_register.some((a:{statement:string})=>a.statement===pinned));
  assert.ok(model.decision_package_graphs.some((g:{package_fingerprint:string;draft:{nodes:Array<{detail:string}>}})=>g.package_fingerprint===run.prepared.scenario.fingerprint&&g.draft.nodes.some(n=>n.detail.includes(JSON.stringify(scenario.inputs)))));
  const verifyBinding=(value:typeof model)=>{
   assert.equal(value.snapshot.snapshot_id,outputs.snapshotId);
   assert.ok(value.snapshot.simulation_inputs.decision_packages.some((p:{package_fingerprint:string;simulation_runs:Array<{reference:string}>})=>p.package_fingerprint===run.prepared.scenario.fingerprint&&p.simulation_runs.some(r=>r.reference===run.session.sessionKey)));
   for(const control of scenario.controls){const expected=canopySourceText(canopySource(control.document,control.version));const stored=value.source_register.find((s:{original_filename:string})=>s.original_filename===control.document+"-v"+control.version+".md");assert.equal(stored?.content_sha256,"sha256-"+createHash("sha256").update(expected).digest("hex"));}
  };
  verifyBinding(model);const wrong=structuredClone(model);wrong.source_register[0].content_sha256="sha256-"+"0".repeat(64);
  // Tamper a decisive source, not an unused historical row.
  wrong.source_register.find((s:{original_filename:string})=>s.original_filename==="D01-v1.md").content_sha256="sha256-"+"0".repeat(64);assert.throws(()=>verifyBinding(wrong));
  const wrongPackage=structuredClone(model);wrongPackage.snapshot.simulation_inputs.decision_packages[0].package_fingerprint="sha256-"+"0".repeat(64);assert.throws(()=>verifyBinding(wrongPackage));
  const beforeExtract=await copy.get("outputs");const extract=await api(basePath+outputs.jsonOutputId+"/presentation");assert.equal(extract.status,200,await extract.clone().text());
  assert.equal(extract.headers.get("x-genesis-presentation-approval"),"none");const shortBytes=new Uint8Array(await extract.arrayBuffer());const shortHash=createHash("sha256").update(shortBytes).digest("hex");assert.equal(extract.headers.get("x-genesis-presentation-sha256"),shortHash);
  assert.deepEqual(await copy.get("outputs"),beforeExtract,"Presentation extract creates no copied approval/output row");
  await json(await call("presentation",bob,orgB,"GET",undefined,{dossierId:copy.dossierId,outputId:outputs.jsonOutputId}),404);
  await json(await call("presentation",alice,orgA,"GET",undefined,{dossierId:copy.dossierId,outputId:outputs.pdfOutputId}),400);
  const registry=(await copy.get("outputs")).outputs as Array<{output_id:string;reviewer_actor_id:string|null}>;assert.equal(registry.find(o=>o.output_id===outputs.jsonOutputId)?.reviewer_actor_id,null);
  writeFileSync(root+"/"+scenario.id+"-dossier.pdf",pdfBytes);writeFileSync(root+"/"+scenario.id+"-presentation.pdf",shortBytes);
  writeFileSync(root+"/"+scenario.id+"-snapshot.json",snapshotText);writeFileSync(root+"/"+scenario.id+"-governed.json",modelText);
  writeFileSync(root+"/"+scenario.id+"-approval.json",JSON.stringify(approval,null,2));writeFileSync(root+"/"+scenario.id+".studio-draft.json",JSON.stringify(run.prepared.draft,null,2));
  const replay=await replayRecordedCanopy(api,run.prepared.scenario,run.session,checkpoints);replays.push({scenario:scenario.id,...replay});writeFileSync(root+"/"+scenario.id+"-played-case.json",JSON.stringify(replay.file,null,2));
  receipts.push({scenario:scenario.id,actualTerminal:run.session.state.currentStageId,changed:scenario.changed,why:scenario.why,recommendation:scenario.recommendation,controls:scenario.controls,inputs:scenario.inputs,inputDigest:canonicalFingerprint(scenario.inputs),sessionKey:run.session.sessionKey,completedAt:run.session.completedAt,packageVersion:run.prepared.draft.version,packageFingerprint:run.prepared.scenario.fingerprint,...outputs,dossierId:copy.dossierId,revision:copy.revision,presentation:{sha256:shortHash,approval:"none",sourceJsonOutputId:outputs.jsonOutputId}});
  const reopened=await CanopyWorkingCopy.resume(api,copy.dossierId);assert.equal(reopened.currentScenario,scenario.id);assert.equal(reopened.revision,copy.revision);assert.equal(reopened.package().scenario.fingerprint,run.prepared.scenario.fingerprint);
 });
 await t.test("Canopy V2 causal walkthrough: Base to Upside to clearance-only Hard stop preserves other copies",async()=>{
  const copy=copies.get("base")!,old=receipts.find(r=>r.scenario==="base")!;
  const beforeOthers=await Promise.all([...copies].filter(([id])=>id!=="base").map(([,c])=>c.get("outputs")));
  const originalBytes=readFileSync(root+"/base-dossier.pdf");const walkthrough:unknown[]=[];
  for(const id of ["upside","hard_stop"] as const){await copy.supersedeAssertions();await reviewPrepared(copy,id);const run=await copy.run(id);await copy.linkScenarioEvidence(id,run.packageRef);walkthrough.push({scenario:id,session:run.session,inputs:run.prepared.declaration.inputs,packageFingerprint:run.prepared.scenario.fingerprint});}
  assert.deepEqual(canopySemanticInputDiff(CANOPY_SCENARIOS.find(s=>s.id==="upside")!.inputs,CANOPY_SCENARIOS.find(s=>s.id==="hard_stop")!.inputs),[{field:"clearance",before:"passed",after:"failed"}]);
  const stale=(await copy.get("outputs")).outputs as Array<{output_id:string;state:string;reviewer_actor_id:string|null}>;
  assert.equal(stale.find(o=>o.output_id===old.pdfOutputId)?.state,"stale");assert.equal(stale.find(o=>o.output_id===old.pdfOutputId)?.reviewer_actor_id,reviewer.actorId);
  const retained=await api("/api/dossiers/"+copy.dossierId+"/outputs/"+old.pdfOutputId+"/download");assert.deepEqual(new Uint8Array(await retained.arrayBuffer()),new Uint8Array(originalBytes));
  await json(await call("outputs",reviewer,orgA,"POST",{action:"approve",expectedRevision:copy.revision,outputId:old.pdfOutputId},{dossierId:copy.dossierId}),409);
  await assert.rejects(copy.finishRun("base",sessions.get("base")!.sessionKey),/Explicit acceptance/u);
  assert.deepEqual(await Promise.all([...copies].filter(([id])=>id!=="base").map(([,c])=>c.get("outputs"))),beforeOthers);
  const v1=copy.source("D03",1);const retainedSource=await api("/api/dossiers/"+copy.dossierId+"/documents/"+v1.documentId+"/versions/"+v1.versionId+"/download");assert.equal(await retainedSource.text(),canopySourceText(canopySource("D03",1)));
  writeFileSync(root+"/walkthrough-history.json",JSON.stringify({oldApprovedSnapshot:old,walkthrough,semanticDiff:canopySemanticInputDiff(CANOPY_SCENARIOS.find(s=>s.id==="upside")!.inputs,CANOPY_SCENARIOS.find(s=>s.id==="hard_stop")!.inputs)},null,2));
 });
 await t.test("Canopy V2 runtime: failed and unavailable cannot bypass controls; label alone cannot change outcome",async()=>{
  const runBare=async(p:ReturnType<typeof buildCanopyPackage>,decisions?:Session["state"]["decisions"])=>{
   let session=(await json(await api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"start",caseId:p.scenario.caseId,version:p.scenario.version,fingerprint:p.scenario.fingerprint})}),201)).session as unknown as Session;
   let index=0;
   while(session.status==="active"){
    const stage=p.scenario.stages.find(s=>s.id===session.state.currentStageId)!;
    const available=stage.options.filter(o=>decisionAvailability(o,session.state.metrics,session.state.actionUseCounts[actionUseKey(o)]??0).available);assert.equal(available.length,1);
    if(stage.id==="studio-clearance"&&p.declaration.inputs.clearance!=="passed")for(const blocked of stage.options.filter(o=>o.nextStageId!=="studio-no-go")){
     const denied=await api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"decision",sessionKey:session.sessionKey,eventId:crypto.randomUUID(),expectedRevision:session.revision,optionId:blocked.id})});assert.equal(denied.status,409);const current=await api("/api/play-sessions?sessionKey="+session.sessionKey);assert.equal(((await current.json()) as {session:Session}).session.revision,session.revision);
    }
    const optionId=decisions?.[index]?.optionId??available[0].id;
    session=(await json(await api("/api/play-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"decision",sessionKey:session.sessionKey,eventId:crypto.randomUUID(),expectedRevision:session.revision,optionId})}))).session as unknown as Session;index++;
   }return session;
  };
  for(const id of ["hard_stop","hard_stop_unavailable"] as const){const p=buildCanopyPackage(id,true);const actual=await runBare(p);assert.equal(actual.state.currentStageId,"studio-no-go");assert.deepEqual(canopySemanticInputDiff(CANOPY_SCENARIOS.find(s=>s.id==="upside")!.inputs,p.declaration.inputs).map(d=>d.field),["clearance"]);}
  const source=buildCanopyPackage("upside",true),draft=normalizeStudioDraft({...source.draft,version:"2.8.0",title:"No-go label only; unchanged passed inputs",parent:{caseId:source.draft.caseId,version:source.draft.version,fingerprint:source.studioFingerprint}});const fingerprint=caseFingerprint(draft),scenario=compileStudioDraft(draft,fingerprint).scenario!;
  await db.insert(schema.caseVersions).values({caseId:draft.caseId,version:draft.version,fingerprint:scenario.fingerprint,parentCaseId:source.draft.caseId,parentVersion:source.draft.version,parentFingerprint:source.studioFingerprint,studioFingerprint:fingerprint,payload:{kind:"playable-scenario-v1",studioDraft:draft,scenario},publishedAt:draft.updatedAt});
  const actual=await runBare({...source,draft,scenario,studioFingerprint:fingerprint},sessions.get("upside")!.state.decisions);assert.equal(actual.state.currentStageId,"studio-approve-operation");
 });
 const finalOutputs={outputs:(await Promise.all([...copies.values()].map(c=>c.get("outputs")))).flatMap(r=>r.outputs as unknown[])};
 assert.equal(new Set([...copies.values()].map(c=>c.dossierId)).size,4);assert.equal(new Set([...copies.values()].map(c=>c.source("D03",1).documentId)).size,4);
 writeFileSync(root+"/replay-verification.json",JSON.stringify(replays,null,2));
 writeFileSync(root+"/comparison.json",JSON.stringify({disclosure:CANOPY_DISCLOSURE,kind:"locally-tested-api-receipts",exportedAt:new Date().toISOString(),receipts,cleanCopies:[...copies.values()].map(c=>c.dossierId),finalOutputs,productionVerified:false,browserVerified:false,humanReviewed:false},null,2));
});
