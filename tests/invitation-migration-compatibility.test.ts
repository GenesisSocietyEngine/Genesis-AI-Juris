import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { createPasswordCredential, SESSION_COOKIE_NAME } from "../app/auth-crypto";

// Exact attributed rollback source, not a claim about the deployed binary.
const rollbackRevision = "bf5799383a52b6617cd9d4a0acf47af780086218";
const defectiveRevision = "e256660f5e7d5c88ffe4dc0076ead74a70d18b1b";
const requests = new AsyncLocalStorage<Request>();
const runtime = globalThis as unknown as { __migrationEnv: Record<string, unknown>; __migrationHeaders: () => Headers };
type Route = { POST(request: Request): Promise<Response>; GET(request: Request): Promise<Response>; DELETE(request: Request): Promise<Response> };
type Routes = { me: Route; login: Route; organizations: Route; invitations: Route };
type Person = { email: string; actorId: string; userId: number; cookie: string };
type RouteResult = { organization: { id: string }; token: string; id: string; error?: string };
const sourceHashes: Record<string, string> = {};
const root = process.cwd();
const output = resolve(".artifacts/inv29-migration");

async function bundle(revision?: string): Promise<Routes> {
  const namespaces = ["me", "auth/login", "organizations", ...(revision ? [] : ["invitations"])];
  const result = await build({ stdin: { contents: namespaces.map(path => `export * as ${path.split("/").at(-1)} from './app/api/${path}/route';`).join("\n"), resolveDir: root, loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022",
    plugins: [{ name: "isolated-migration-runtime", setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "runtime" }));
      builder.onLoad({ filter: /.*/, namespace: "runtime" }, args => ({ contents: args.path === "cloudflare:workers" ? "export const env=globalThis.__migrationEnv;" : args.path === "next/headers" ? "export async function headers(){return globalThis.__migrationHeaders()}" : "export function redirect(){throw Error('unexpected redirect')}" }));
      if (revision) builder.onLoad({ filter: /\.(?:[cm]?[jt]sx?|json)$/, namespace: "file" }, args => {
        const path = relative(root, args.path).replaceAll("\\", "/");
        if (path.startsWith("../") || path.startsWith("node_modules/")) return;
        const contents = execFileSync("git", ["show", `${revision}:${path}`], { cwd: root, encoding: "utf8" });
        sourceHashes[path] = createHash("sha256").update(contents).digest("hex");
        return { contents, loader: path.endsWith(".json") ? "json" : path.endsWith(".tsx") ? "tsx" : "ts", resolveDir: dirname(args.path) };
      });
    } }] });
  const file = resolve(output, `${revision ?? "candidate"}.mjs`);
  writeFileSync(file, result.outputFiles[0].text);
  return await import(pathToFileURL(file).href);
}

test("populated0022 upgrade preserves legacy data and rollback routes; unaccepted proof deletion cascades, accepted history survives", async () => {
  mkdirSync(output, { recursive: true });
  const mf = new Miniflare({ workers: [{ config: { name: "migration-test", type: "worker", compatibilityDate: "2026-09-01",
    manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } },
    env: { DB: { type: "d1", name: "migration-isolated" } } }, dev: {} }] });
  const previousFetch = globalThis.fetch;
  const mailbox: Array<{ to: string[]; text: string }> = [];
  try {
    const d1 = await mf.getD1Database("DB", "migration-test") as unknown as D1Database;
    const apply = async (text: string) => d1.batch(text.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean).map(s => d1.prepare(s)));
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries as Array<{ idx: number; tag: string }>;
    for (const entry of journal.filter(e => e.idx <= 22)) await apply(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
    runtime.__migrationEnv = { DB: d1, RESEND_API_KEY: "synthetic-no-network", GENESIS_INVITATION_MAIL_ENABLED: "true", GENESIS_INVITATION_FROM_EMAIL: "test@example.test", GENESIS_PUBLIC_ORIGIN: "https://migration.test" };
    runtime.__migrationHeaders = () => requests.getStore()!.headers;
    const old = await bundle(rollbackRevision), candidate = await bundle();
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.resend.com/emails", "all transport is captured; no external request");
      mailbox.push(JSON.parse(String(options?.body)));
      return new Response("{}", { status: 200 });
    };
    async function call(routes: Routes, route: keyof Routes, method: "POST" | "GET" | "DELETE", person: Person | null, body?: unknown, expected = 200) {
      const headers = new Headers({ origin: "https://migration.test", "sec-fetch-site": "same-origin", "content-type": "application/json" });
      if (person) headers.set("cookie", person.cookie);
      assert.equal(headers.has("oai-authenticated-user-email"), false);
      const request = new Request(`https://migration.test/api/${route}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const response = await requests.run(request, () => routes[route][method](request));
      const data = await response.json() as RouteResult;
      assert.equal(response.status, expected, JSON.stringify(data));
      return { response, data };
    }
    const password = "Synthetic-migration-fixture-29!";
    const credential = await createPasswordCredential(password);
    async function person(label: string): Promise<Person> {
      const email = `${label}@example.test`;
      await d1.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email, `Synthetic ${label}`).run();
      await d1.prepare("INSERT INTO local_accounts(user_email,password_algorithm,password_hash,password_salt,password_iterations) VALUES(?,?,?,?,?)")
        .bind(email, credential.algorithm, credential.hash, credential.salt, credential.iterations).run();
      const user = await d1.prepare("SELECT id,actor_id FROM users WHERE email=?").bind(email).first<{ id: number; actor_id: string }>();
      assert.ok(user);
      const { response } = await call(old, "login", "POST", null, { email, password });
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      assert.ok(cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
      return { email, actorId: user.actor_id, userId: user.id, cookie };
    }
    const owner = await person("migration-owner"), member = await person("migration-member"), pending = await person("migration-pending");
    const recipient = await person("migration-recipient"), accepted = await person("migration-accepted");
    const org = (await call(old, "organizations", "POST", owner, { action: "create", name: "Synthetic migration compatibility" }, 201)).data.organization.id;
    const legacy = async (p: Person) => (await call(old, "organizations", "POST", owner, { action: "invite", organizationId: org, recipientActorId: p.actorId, role: "member" }, 201)).data;
    await call(old, "organizations", "POST", member, { action: "accept", token: (await legacy(member)).token });
    const pendingLegacy = await legacy(pending);
    const tables = ["users", "local_accounts", "organizations", "organization_memberships", "organization_invitations", "organization_security_events"];
    const snapshots = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table, (await d1.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])));
    const before = await snapshots();
    await apply(readFileSync("drizzle/0023_email_invitations.sql", "utf8"));
    assert.deepEqual(await snapshots(), before, "additive migration changes no existing row bytes");
    assert.deepEqual((await d1.prepare("PRAGMA foreign_key_check").all()).results, []);
    await call(old, "organizations", "GET", owner);
    await call(old, "organizations", "POST", pending, { action: "accept", token: pendingLegacy.token });
    await call(old, "organizations", "POST", owner, { action: "member", organizationId: org, actorId: pending.actorId, status: "active", role: "auditor", expectedRevision: 1 });
    async function emailInvitation(p: Person) {
      const invitation = (await call(candidate, "invitations", "POST", owner, { action: "invite", organizationId: org, recipientEmail: p.email, role: "member" }, 201)).data;
      await call(candidate, "invitations", "POST", p, { action: "verify", token: invitation.token });
      const message = mailbox.at(-1)!;
      assert.deepEqual(message.to, [p.email]);
      const fragment = new URLSearchParams(new URL(message.text.match(/https:\/\/migration.test\/invitations#\S+/)![0]).hash.slice(1));
      return { invitation, proof: fragment.get("proof")! };
    }
    const first = await emailInvitation(recipient);
    await call(old, "me", "DELETE", recipient);
    assert.equal(await d1.prepare("SELECT id FROM users WHERE id=?").bind(recipient.userId).first(), null);
    assert.equal(await d1.prepare("SELECT id FROM invitation_mailbox_proofs WHERE user_id=?").bind(recipient.userId).first(), null);
    assert.equal((await d1.prepare("SELECT status FROM email_invitations WHERE id=?").bind(first.invitation.id).first<{ status: string }>())?.status, "pending");
    const replacement = await person("migration-recipient");
    assert.notEqual(replacement.actorId, recipient.actorId);
    await call(candidate, "invitations", "POST", replacement, { action: "accept", organizationId: org, token: first.invitation.token, proof: first.proof }, 403);
    const second = await emailInvitation(accepted);
    const acceptance = { action: "accept", organizationId: org, token: second.invitation.token, proof: second.proof };
    await Promise.all([call(candidate, "invitations", "POST", accepted, acceptance), call(candidate, "invitations", "POST", accepted, acceptance)]);
    const durable = async () => ({ users: (await d1.prepare("SELECT * FROM users WHERE id=?").bind(accepted.userId).all()).results,
      proof: (await d1.prepare("SELECT * FROM invitation_mailbox_proofs WHERE invitation_id=?").bind(second.invitation.id).all()).results,
      invitation: (await d1.prepare("SELECT * FROM email_invitations WHERE id=?").bind(second.invitation.id).all()).results,
      membership: (await d1.prepare("SELECT * FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, accepted.userId).all()).results,
      events: (await d1.prepare("SELECT * FROM organization_security_events WHERE target_id=? AND action='email_invitation_accepted'").bind(second.invitation.id).all()).results });
    const committed = await durable();
    assert.equal(committed.membership.length, 1); assert.equal(committed.events.length, 1);
    await d1.prepare("INSERT INTO audit_events(actor_email,event_type,object_type,object_id,detail) VALUES(?, 'migration_atomic_sentinel', 'test', 'accepted-delete', '{}')").bind(accepted.email).run();
    const sentinel = await d1.prepare("SELECT * FROM audit_events WHERE actor_email=?").bind(accepted.email).all();
    await assert.rejects(() => call(old, "me", "DELETE", accepted), /FOREIGN KEY|constraint/i);
    assert.deepEqual(await d1.prepare("SELECT * FROM audit_events WHERE actor_email=?").bind(accepted.email).all().then(r => r.results), sentinel.results, "earlier destructive audit delete rolls back with final FK refusal");
    assert.deepEqual(await durable(), committed, "rollback-code refusal preserves identity/proof/membership/audit atomically");
    assert.deepEqual((await d1.prepare("PRAGMA foreign_key_check").all()).results, []);
    writeFileSync(resolve(output, "compatibility.json"), JSON.stringify({ rollbackRevision, sourceHashes, migration: "populated0022-to0023", legacyTablesPreserved: tables,
      ordinaryLocalLogin: true, fabricatedTrustedHeaders: false, syntheticMailOnly: true, concurrentMemberships: 1, concurrentAcceptanceEvents: 1,
      unacceptedRecipientDeletion: "PASS", acceptedRecipientDeletion: "existing FK refusal, atomic preservation", deployedBinaryTested: false }, null, 2) + "\n");
  } finally { globalThis.fetch = previousFetch; await mf.dispose(); }
});

test("retained pre-fix0023 reproduces new unaccepted-proof deletion failure", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries as Array<{ idx: number; tag: string }>;
    for (const entry of journal.filter(e => e.idx <= 22)) db.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
    db.exec("INSERT INTO users(email,display_name) VALUES('temporary@example.test','Synthetic temporary')");
    db.exec("DELETE FROM users WHERE email='temporary@example.test'"); // Prior schema permits deletion.
    db.exec(execFileSync("git", ["show", `${defectiveRevision}:drizzle/0023_email_invitations.sql`], { encoding: "utf8" }));
    db.exec("INSERT INTO users(email,display_name) VALUES('owner@example.test','Owner'),('temporary@example.test','Temporary')");
    db.exec("INSERT INTO organizations(id,name,created_by_actor_id,created_at) SELECT 'org_regression','Synthetic',actor_id,'2026-09-29T00:00:00Z' FROM users WHERE email='owner@example.test'");
    db.exec("INSERT INTO organization_memberships(organization_id,user_id,actor_id,role,created_at) SELECT 'org_regression',id,actor_id,'org_owner','2026-09-29T00:00:00Z' FROM users WHERE email='owner@example.test'");
    db.exec("INSERT INTO email_invitations(id,organization_id,recipient_email,token_digest,origin,role,invited_by_actor_id,inviter_revision,organization_revision,expires_at,created_at) SELECT 'invite_regression','org_regression','temporary@example.test','synthetic-digest','https://migration.test','member',actor_id,1,1,'2099-01-01','2026-09-29T00:00:00Z' FROM users WHERE email='owner@example.test'");
    db.exec("INSERT INTO invitation_mailbox_proofs(id,invitation_id,user_id,actor_id,email,token_digest,expires_at) SELECT 'proof_regression','invite_regression',id,actor_id,email,'synthetic-proof-digest','2099-01-01' FROM users WHERE email='temporary@example.test'");
    assert.throws(() => db.exec("DELETE FROM users WHERE email='temporary@example.test'"), /FOREIGN KEY/);
  } finally { db.close(); }
});
