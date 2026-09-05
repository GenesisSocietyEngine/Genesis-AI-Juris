import assert from "node:assert/strict";
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
