import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { WorkingNotesController } from "../app/matters/working-notes-controller";

// Real notes/organization/dossier handlers and all canonical D1 migrations.
// Only the Sites runtime dispatch is adapted: synthetic trusted identity stays
// inside this isolated local fixture, never the browser or hosted application.
type Handler = (request: Request, context: { params: Promise<{ dossierId: string }> }) => Promise<Response>;
type Route = { GET: Handler; POST: Handler };
type Routes = Record<"notes" | "organizations" | "dossiers" | "detail", Route>;
const runtime = globalThis as unknown as {
  __notes_contract_env: { DB: D1Database };
  __notes_contract_headers: () => Headers;
  __notes_contract_jobs: Promise<unknown>[];
};
const requests = new AsyncLocalStorage<Request>();
let mf: Miniflare, db: D1Database, routes: Routes;
let actorId: string, organizationId: string, caseId: string;
const email = "notes-contract@example.test";

async function call(route: keyof Routes, method = "GET", body?: string, query = "") {
  const request = new Request("https://notes.test/api/test" + query, {
    method, body,
    headers: { origin: "https://notes.test", "sec-fetch-site": "same-origin",
      "content-type": "application/json", "oai-authenticated-user-email": email,
      ...(organizationId ? { "x-genesis-organization": organizationId } : {}) },
  });
  return requests.run(request, () => routes[route][method as "GET" | "POST"](request, { params: Promise.resolve({ dossierId: caseId }) }));
}

before(async () => {
  mf = new Miniflare({ workers: [{ config: { name: "notes-contract", type: "worker", compatibilityDate: "2026-09-01",
    manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } },
    env: { DB: { type: "d1", name: "notes-contract" } } }, dev: {} }] });
  db = await mf.getD1Database("DB", "notes-contract") as unknown as D1Database;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) {
    const statements = readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean);
    await db.batch(statements.map((sql) => db.prepare(sql)));
  }
  runtime.__notes_contract_env = { DB: db };
  runtime.__notes_contract_headers = () => requests.getStore()!.headers;
  runtime.__notes_contract_jobs = [];
  const paths = { notes: "app/api/dossiers/[dossierId]/notes/route.ts", organizations: "app/api/organizations/route.ts",
    dossiers: "app/api/dossiers/route.ts", detail: "app/api/dossiers/[dossierId]/route.ts" };
  const compiled = await build({ stdin: { contents: Object.entries(paths).map(([key, path]) => `import * as ${key} from './${path}';`).join("\n") + `\nexport {${Object.keys(paths).join(",")}};`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022",
    plugins: [{ name: "isolated-notes-runtime", setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, (args) => ({ path: args.path, namespace: "notes-runtime" }));
      builder.onLoad({ filter: /.*/, namespace: "notes-runtime" }, (args) => ({ contents: args.path === "cloudflare:workers"
        ? "export const env=globalThis.__notes_contract_env; export function waitUntil(p){globalThis.__notes_contract_jobs.push(p)}"
        : args.path === "next/headers" ? "export async function headers(){return globalThis.__notes_contract_headers()}"
          : "export function redirect(){throw new Error('unexpected redirect')}" }));
    } }],
  });
  mkdirSync(".artifacts/notes-handler-contract", { recursive: true });
  const modulePath = resolve(".artifacts/notes-handler-contract/routes.mjs");
  writeFileSync(modulePath, compiled.outputFiles[0].text);
  routes = await import(pathToFileURL(modulePath).href);
  await db.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email, "Synthetic note author").run();
  const actor = await db.prepare("SELECT actor_id FROM users WHERE email=?").bind(email).first<{ actor_id: string }>();
  assert.ok(actor); actorId = actor.actor_id;
  const organization = await call("organizations", "POST", JSON.stringify({ action: "create", name: "Synthetic notes contract" }));
  assert.equal(organization.status, 201, await organization.clone().text());
  organizationId = (await organization.json() as { organization: { id: string } }).organization.id;
  const created = await call("dossiers", "POST", JSON.stringify({ title: "Synthetic notes receipt contract", jurisdictions: ["Test"], classification: "internal" }));
  assert.equal(created.status, 201, await created.clone().text());
  caseId = (await created.json() as { dossier: { dossier_id: string } }).dossier.dossier_id;
});

after(async () => {
  try { while (runtime.__notes_contract_jobs?.length) await Promise.all(runtime.__notes_contract_jobs.splice(0)); }
  finally { await mf?.dispose(); }
});

test("C1 real handler receipts confirm create/save and reconcile response loss without replacing newer drafts", async () => {
  let mode: "normal" | "lost" | "corrupt" = "normal", sequence = 0;
  const posts: string[] = [];
  const controller = new WorkingNotesController({ scope: { actorId, organizationId, caseId, generation: 1 },
    authorize: async () => (await call("detail")).ok, canWrite: () => true,
    onExpired: () => assert.fail("unexpected fixture expiry"), onDenied: () => assert.fail("unexpected fixture denial"),
    newKey: () => "contract-operation-" + ++sequence, timeoutMs: 30_000,
    read: async (path, init) => {
      const query = new URL(path, "https://notes.test").search;
      const response = await call("notes", init?.method ?? "GET", init?.body === undefined ? undefined : String(init.body), query);
      if (init?.method !== "POST") return response;
      posts.push(String(init.body));
      assert.ok(response.ok, await response.clone().text());
      const payload = await response.clone().json() as { operation: { requestDigest: string } };
      assert.match(payload.operation.requestDigest, /^sha256-[a-f0-9]{64}$/);
      if (mode === "lost") throw new Error("simulated loss after actual durable write");
      if (mode === "corrupt") return Response.json({ ...payload, operation: { ...payload.operation, requestDigest: "sha256-" + "0".repeat(64) } }, { status: response.status });
      return response;
    },
  });
  controller.start("blank"); const key = controller.getSnapshot().selected!;
  const editor = () => controller.getSnapshot().editors[key];
  controller.edit(key, { title: "Synthetic receipt", body: "Initial original text" });
  await controller.save(key);
  assert.equal(editor().phase, "confirmed", "real POST receipt must satisfy the controller contract");
  assert.equal(editor().base?.revision, 1); assert.match(editor().receipt!.requestDigest, /^sha256-[a-f0-9]{64}$/);
  const noteId = editor().base!.id;
  controller.edit(key, { body: "Second original text" }); await controller.save(key);
  assert.equal(editor().phase, "confirmed"); assert.equal(editor().base?.revision, 2);

  mode = "lost"; controller.edit(key, { body: "Third committed text" }); await controller.save(key);
  assert.equal(editor().phase, "unknown");
  const original = editor().operation;
  controller.edit(key, { body: "Newer unsaved text after loss" });
  mode = "normal"; await controller.recover(key);
  assert.equal(editor().operation, original); assert.equal(editor().phase, "confirmed");
  assert.equal(editor().base?.revision, 3); assert.equal(editor().base?.body, "Third committed text");
  assert.equal(editor().draft.body, "Newer unsaved text after loss"); assert.equal(posts.length, 3);

  mode = "lost"; await controller.save(key); assert.equal(editor().phase, "unknown");
  controller.edit(key, { body: "Even newer unsaved text" });
  mode = "normal"; await controller.recover(key, true);
  assert.equal(posts[4], posts[3]); assert.equal(editor().base?.revision, 4);
  assert.equal(editor().phase, "confirmed"); assert.equal(editor().draft.body, "Even newer unsaved text");
  const stored = await db.prepare("SELECT count(*) AS n FROM dossier_working_note_versions WHERE note_id=?").bind(noteId).first<{ n: number }>();
  assert.equal(stored?.n, 4, "identical resend must not create another revision");

  mode = "corrupt"; await controller.save(key);
  assert.equal(editor().phase, "unknown", "a mismatched digest must still be rejected");
  assert.equal(editor().receipt?.revision, 4, "an invalid acknowledgement must not replace the previous receipt");
  mode = "normal"; await controller.recover(key);
  assert.equal(editor().phase, "confirmed"); assert.equal(editor().base?.revision, 5);
  assert.equal((await db.prepare("PRAGMA foreign_key_check").all()).results.length, 0);
  controller.dispose();
});
