import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

type Actor = { email: string; actorId: string; userId: number };
type Result = { code?: string; token: string; id: string; delivery: string; organization: { id: string; role: string }; invitation: { organizationId: string; role: string }; invitations: Array<{ id: string; status: string; delivery: string }> };
type Route = { POST(request: Request): Promise<Response>; GET(request: Request): Promise<Response> };
let mf: Miniflare, d1: D1Database, owner: Actor, outsider: Actor, org: string;
let routes: { invitations: Route; organizations: Route };
let beforeBatch: (() => Promise<void>) | undefined;
let batchRaceReached = false;
let mailMode = 200;
const mailbox: Array<{ to: string[]; text: string }> = [];
const requestStorage = new AsyncLocalStorage<Request>();
const runtime = globalThis as unknown as { __inv_env: Record<string, unknown>; __inv_headers: () => Headers };
const originalFetch = globalThis.fetch;

async function actor(label: string) {
  const email = `${label}@example.test`;
  await d1.prepare("INSERT INTO users(email,display_name) VALUES (?,?)").bind(email, `Synthetic ${label}`).run();
  const user = await d1.prepare("SELECT id,actor_id FROM users WHERE email=?").bind(email).first<{ id: number; actor_id: string }>();
  assert.ok(user);
  return { email, actorId: user.actor_id, userId: user.id };
}
async function call(person: Actor | null, body: unknown, expected = 200, route: "invitations" | "organizations" = "invitations", origin = "https://invite.test") {
  const headers = new Headers({ origin, "sec-fetch-site": "same-origin", "content-type": "application/json" });
  if (person) headers.set("oai-authenticated-user-email", person.email);
  const request = new Request(`${origin}/api/${route}`, { method: "POST", headers, body: JSON.stringify(body) });
  const response = await requestStorage.run(request, () => routes[route].POST(request));
  const result = await response.json() as Result;
  assert.equal(response.status, expected, JSON.stringify(result));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return result;
}
const invite = (email: string, role = "member") => call(owner, { action: "invite", organizationId: org, recipientEmail: email, role }, 201);
async function proofFor(person: Actor, token: string) {
  const result = await call(person, { action: "verify", token });
  assert.equal(result.delivery, "provider_accepted");
  assert.equal("proof" in result, false);
  const message = mailbox.at(-1)!;
  assert.deepEqual(message.to, [person.email]);
  const link = message.text.match(/https:\/\/invite.test\/invitations#\S+/)![0];
  const fragment = new URLSearchParams(new URL(link).hash.slice(1));
  assert.equal(fragment.get("invite"), token);
  return fragment.get("proof")!;
}
const accept = (person: Actor, token: string, proof: string, organizationId = org, expected = 200) => call(person, { action: "accept", token, proof, organizationId }, expected);

before(async () => {
  mf = new Miniflare({ workers: [{ config: { name: "inv01-test", type: "worker", compatibilityDate: "2026-09-01",
    manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents: "export default {fetch(){return new Response('test')}}" } } },
    env: { DB: { type: "d1", name: "inv01-isolated" } } }, dev: {} }] });
  d1 = await mf.getD1Database("DB", "inv01-test") as unknown as D1Database;
  for (const entry of JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries) {
    const statements = readFileSync(`drizzle/${entry.tag}.sql`, "utf8").split("--> statement-breakpoint").map((x: string) => x.trim()).filter(Boolean);
    await d1.batch(statements.map((statement: string) => d1.prepare(statement)));
  }
  const observed = new Proxy(d1, { get(target, property) {
    if (property === "batch") return async (statements: D1PreparedStatement[]) => {
      // Deterministic race injection only at invitation commit, after auth/rate-limit writes.
      const sqlText = statements.map(s => (s as unknown as { statement?: string }).statement ?? "").join(" ");
      if (beforeBatch && sqlText.includes('update "email_invitations"')) { const hook = beforeBatch; beforeBatch = undefined; batchRaceReached = true; await hook(); }
      return target.batch(statements);
    };
    const value = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value;
  } });
  runtime.__inv_env = { DB: observed, RESEND_API_KEY: "synthetic-no-network", GENESIS_INVITATION_MAIL_ENABLED: "true", GENESIS_INVITATION_FROM_EMAIL: "test@example.test", GENESIS_PUBLIC_ORIGIN: "https://invite.test" };
  runtime.__inv_headers = () => requestStorage.getStore()!.headers;
  const bundled = await build({ stdin: { contents: "export * as invitations from './app/api/invitations/route'; export * as organizations from './app/api/organizations/route';", resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", target: "es2022",
    plugins: [{ name: "inv01-isolated-runtime", setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, args => ({ path: args.path, namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: args.path === "cloudflare:workers" ? "export const env=globalThis.__inv_env;" : args.path === "next/headers" ? "export async function headers(){return globalThis.__inv_headers()}" : "export function redirect(){throw Error('unexpected redirect')}" }));
    } }] });
  mkdirSync(".artifacts/inv01-tests", { recursive: true });
  const file = resolve(".artifacts/inv01-tests/routes.mjs"); writeFileSync(file, bundled.outputFiles[0].text);
  routes = await import(pathToFileURL(file).href);
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.resend.com/emails", "no external transport is permitted");
    mailbox.push(JSON.parse(String(options?.body)));
    if (mailMode === 0) throw new Error("synthetic lost provider response");
    return new Response("{}", { status: mailMode });
  };
  owner = await actor("owner"); outsider = await actor("outsider");
  org = (await call(owner, { action: "create", name: "Synthetic INV01 organization" }, 201, "organizations")).organization.id;
});
after(async () => { globalThis.fetch = originalFetch; await mf?.dispose(); });

test("email invitation precedes account creation; separate mailbox proof and explicit acceptance grant once", async () => {
  const invitation = await invite("future@example.test");
  assert.equal(invitation.delivery, "provider_accepted");
  const person = await actor("future");
  const preview = await call(person, { action: "preview", token: invitation.token });
  assert.equal(preview.invitation.organizationId, org);
  await accept(person, invitation.token, "x".repeat(43), org, 403);
  const proof = await proofFor(person, invitation.token);
  const result = await accept(person, invitation.token, proof);
  assert.equal(result.organization.id, org);
  assert.equal(result.organization.role, "member");
  assert.equal((await accept(person, invitation.token, proof)).organization.id, org, "lost response can retry");
  const count = await d1.prepare("SELECT count(*) AS n FROM organization_security_events WHERE target_id=? AND action='email_invitation_accepted'").bind(invitation.id).first<{ n: number }>();
  assert.equal(count?.n, 1);
  const stored = await d1.prepare("SELECT * FROM email_invitations WHERE id=?").bind(invitation.id).first();
  assert.ok(!JSON.stringify(stored).includes(invitation.token));
  const proofStored = await d1.prepare("SELECT * FROM invitation_mailbox_proofs WHERE invitation_id=?").bind(invitation.id).first();
  assert.ok(!JSON.stringify(proofStored).includes(proof));
});

test("wrong account, wrong organization, wrong origin and unverified copied link cannot accept", async () => {
  const person = await actor("bound"); const invitation = await invite(person.email); const proof = await proofFor(person, invitation.token);
  await call(null, { action: "preview", token: invitation.token }, 401);
  await call(outsider, { action: "preview", token: invitation.token }, 404);
  await call(outsider, { action: "verify", token: invitation.token }, 404);
  await accept(outsider, invitation.token, proof, org, 404);
  await accept(person, invitation.token, proof, "org_wrong_12345678901234567890", 404);
  await call(person, { action: "accept", token: invitation.token, proof, organizationId: org }, 404, "invitations", "https://other.test");
  assert.equal((await accept(person, invitation.token, proof)).organization.id, org);
});

test("owner role limits, duplicate membership and pending invitation preserve existing authority", async () => {
  await call(outsider, { action: "invite", organizationId: org, recipientEmail: "other@example.test", role: "member" }, 404);
  await call(owner, { action: "invite", organizationId: org, recipientEmail: "other@example.test", role: "org_owner" }, 400);
  await call(owner, { action: "invite", organizationId: org, recipientEmail: "future@example.test", role: "member" }, 409);
  await invite("duplicate@example.test");
  const result = await call(owner, { action: "invite", organizationId: org, recipientEmail: "duplicate@example.test", role: "member" }, 409);
  assert.equal(result.code, "invitation_pending_exists");
});

test("resend rotates link and proof; revocation is durable and idempotent", async () => {
  const person = await actor("resend"); const first = await invite(person.email); const oldProof = await proofFor(person, first.token);
  const second = await call(owner, { action: "resend", organizationId: org, invitationId: first.id }, 201);
  assert.notEqual(first.token, second.token);
  await accept(person, first.token, oldProof, org, 404);
  await accept(person, second.token, oldProof, org, 403);
  const proof = await proofFor(person, second.token);
  await call(owner, { action: "revoke", organizationId: org, invitationId: second.id });
  await call(owner, { action: "revoke", organizationId: org, invitationId: second.id });
  await accept(person, second.token, proof, org, 404);
});

test("missing mail, rejection and lost provider response report separate delivery states", async () => {
  runtime.__inv_env.GENESIS_INVITATION_MAIL_ENABLED = "false";
  const before = mailbox.length; const missing = await invite("nomail@example.test");
  assert.equal(missing.delivery, "not_configured"); assert.equal(mailbox.length, before);
  const person = await actor("nomail");
  assert.equal((await call(person, { action: "verify", token: missing.token })).delivery, "not_configured");
  runtime.__inv_env.GENESIS_INVITATION_MAIL_ENABLED = "true";
  mailMode = 422;
  const failure = await call(owner, { action: "resend", organizationId: org, invitationId: missing.id }, 201);
  assert.equal(failure.delivery, "failed");
  mailMode = 0;
  const unknown = await call(owner, { action: "resend", organizationId: org, invitationId: failure.id }, 201);
  assert.equal(unknown.delivery, "unknown");
  mailMode = 200;
  const retry = await call(owner, { action: "resend", organizationId: org, invitationId: unknown.id }, 201);
  assert.equal(retry.delivery, "provider_accepted");
  await call(person, { action: "preview", token: unknown.token }, 404);
});

test("concurrent acceptance creates exactly one membership and audit event", async () => {
  // Separate owner avoids previous test rate-limit consumption.
  owner = await actor("concurrent-owner"); org = (await call(owner, { action: "create", name: "Concurrent synthetic" }, 201, "organizations")).organization.id;
  const person = await actor("concurrent"); const invitation = await invite(person.email); const proof = await proofFor(person, invitation.token);
  const results = await Promise.all([accept(person, invitation.token, proof), accept(person, invitation.token, proof)]);
  assert.ok(results.every(result => result.organization.id === org));
  const count = await d1.prepare("SELECT count(*) AS n FROM organization_security_events WHERE target_id=? AND action='email_invitation_accepted'").bind(invitation.id).first<{ n: number }>();
  assert.equal(count?.n, 1);
});

test("rate limit bounds an inviter changing recipient addresses", async () => {
  for (let index = 0; index < 9; index++) await invite(`rate-${index}@example.test`);
  const result = await call(owner, { action: "invite", organizationId: org, recipientEmail: "rate-blocked@example.test", role: "member" }, 429);
  assert.equal(result.code, "invitation_rate_limited");
});

test("expired mailbox proof and changed organization fail at the commit boundary without membership", async () => {
  owner = await actor("fenced-owner"); org = (await call(owner, { action: "create", name: "Fenced synthetic" }, 201, "organizations")).organization.id;
  const person = await actor("proof-expired"); const invitation = await invite(person.email); const proof = await proofFor(person, invitation.token);
  beforeBatch = async () => { await d1.prepare("UPDATE invitation_mailbox_proofs SET expires_at='2020-01-01T00:00:00.000Z' WHERE invitation_id=?").bind(invitation.id).run(); };
  batchRaceReached = false;
  await accept(person, invitation.token, proof, org, 404);
  assert.equal(batchRaceReached, true, "deterministic race reached the authoritative batch");
  assert.equal((await d1.prepare("SELECT count(*) AS n FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, person.userId).first<{ n: number }>())?.n, 0);
  assert.equal((await d1.prepare("SELECT status FROM email_invitations WHERE id=?").bind(invitation.id).first<{ status: string }>())?.status, "pending");
  const newProof = await proofFor(person, invitation.token);
  // An organization rename is a supported revisioned write; it invalidates an in-flight invitation context.
  beforeBatch = async () => { await d1.prepare("UPDATE organizations SET name='Changed organization context',revision=revision+1 WHERE id=?").bind(org).run(); };
  batchRaceReached = false;
  await accept(person, invitation.token, newProof, org, 404);
  assert.equal(batchRaceReached, true);
  assert.equal((await d1.prepare("SELECT count(*) AS n FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, person.userId).first<{ n: number }>())?.n, 0);
});

test("expired invitation, suspended member and accepted retry after organization revision remain distinct", async () => {
  owner = await actor("expiry-owner"); org = (await call(owner, { action: "create", name: "Expiry synthetic" }, 201, "organizations")).organization.id;
  const person = await actor("expiry-person");
  const timestamp = Date.now;
  let expired: Result;
  try { Date.now = () => timestamp() - 172_800_000; expired = await invite(person.email); } finally { Date.now = timestamp; }
  await call(person, { action: "preview", token: expired!.token }, 404);
  const fresh = await call(owner, { action: "resend", organizationId: org, invitationId: expired!.id }, 201);
  const proof = await proofFor(person, fresh.token);
  await accept(person, fresh.token, proof);
  await d1.prepare("UPDATE organizations SET name='Renamed after acceptance',revision=revision+1 WHERE id=?").bind(org).run();
  await accept(person, fresh.token, proof);
  await d1.prepare("UPDATE organization_memberships SET role='auditor',revision=revision+1 WHERE organization_id=? AND user_id=?").bind(org, person.userId).run();
  assert.equal((await call(person, { action: "preview", token: fresh.token })).invitation.role, "auditor", "accepted-link recovery shows the current authorized role");
  await d1.prepare("UPDATE organization_memberships SET status='suspended',revision=revision+1 WHERE organization_id=? AND user_id=?").bind(org, person.userId).run();
  await accept(person, fresh.token, proof, org, 404);
  const denied = await call(owner, { action: "invite", organizationId: org, recipientEmail: person.email, role: "member" }, 409);
  assert.equal(denied.code, "invitation_member_suspended");
});

test("rotating invitation IDs cannot bypass canonical recipient rate limit", async () => {
  const email = "bounded-resend@example.test";
  let invitation = await invite(email);
  for (let i = 0; i < 4; i++) invitation = await call(owner, { action: "resend", organizationId: org, invitationId: invitation.id }, 201);
  const result = await call(owner, { action: "resend", organizationId: org, invitationId: invitation.id }, 429);
  assert.equal(result.code, "invitation_rate_limited");
});

// These are synthetic handler/D1 schedules, not provider authentication or
// mailbox-browser evidence. Every authority change uses the supported route;
// the owner-invariant negative check leaves all database guards installed.
async function freshOrganization(label: string) {
  owner = await actor(`${label}-owner`);
  org = (await call(owner, { action: "create", name: `Synthetic ${label}` }, 201, "organizations")).organization.id;
}
async function assertUnaccepted(invitation: Result, person: Actor, status = "pending") {
  assert.equal((await d1.prepare("SELECT status FROM email_invitations WHERE id=?").bind(invitation.id).first<{ status: string }>())?.status, status);
  assert.equal((await d1.prepare("SELECT count(*) AS n FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, person.userId).first<{ n: number }>())?.n, 0);
  assert.equal((await d1.prepare("SELECT used_at FROM invitation_mailbox_proofs WHERE invitation_id=?").bind(invitation.id).first<{ used_at: string | null }>())?.used_at, null);
  assert.equal((await d1.prepare("SELECT count(*) AS n FROM organization_security_events WHERE target_id=? AND action='email_invitation_accepted'").bind(invitation.id).first<{ n: number }>())?.n, 0);
}

test("each permissible recipient role is exact and cannot invite, resend, revoke or read owner history", async () => {
  await freshOrganization("role-boundary");
  const pending = await invite("role-boundary-pending@example.test");
  for (const role of ["member", "org_admin", "auditor"]) {
    const person = await actor(`role-boundary-${role}`), invitation = await invite(person.email, role);
    const proof = await proofFor(person, invitation.token);
    assert.equal((await accept(person, invitation.token, proof)).organization.role, role);
    const sent = mailbox.length;
    await call(person, { action: "invite", organizationId: org, recipientEmail: `unauthorized-${role}@example.test`, role: "member" }, 404);
    for (const action of ["resend", "revoke"]) await call(person, { action, organizationId: org, invitationId: pending.id }, 404);
    const request = new Request(`https://invite.test/api/invitations?organization=${org}`, { headers: { "oai-authenticated-user-email": person.email } });
    const history = await requestStorage.run(request, () => routes.invitations.GET(request));
    assert.equal(history.status, 404); assert.match(history.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(mailbox.length, sent, "denied owner actions cannot send mail");
  }
  assert.equal((await d1.prepare("SELECT status FROM email_invitations WHERE id=?").bind(pending.id).first<{ status: string }>())?.status, "pending");
});

test("existing owner policy forbids manufactured inviter demotion or suspension", async () => {
  await freshOrganization("owner-invariant");
  const row = await d1.prepare("SELECT * FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, owner.userId).first();
  assert.ok(row);
  for (const change of [{ role: "member", status: "active" }, { role: "org_owner", status: "suspended" }]) {
    await call(owner, { action: "member", organizationId: org, actorId: owner.actorId, expectedRevision: row.revision, ...change }, 404, "organizations");
    await assert.rejects(d1.prepare("UPDATE organization_memberships SET role=?,status=?,revision=revision+1 WHERE organization_id=? AND user_id=?")
      .bind(change.role, change.status, org, owner.userId).run(), /membership identity, owner and revision are protected/);
  }
  assert.deepEqual(await d1.prepare("SELECT * FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, owner.userId).first(), row);
});

for (const command of ["suspend", "close"]) test(`independent lifecycle ${command} at acceptance commit withdraws authority atomically`, async () => {
  await freshOrganization(`lifecycle-${command}`);
  const admin = await actor(`lifecycle-${command}-admin`), adminInvite = await invite(admin.email, "org_admin");
  await accept(admin, adminInvite.token, await proofFor(admin, adminInvite.token));
  const person = await actor(`lifecycle-${command}-recipient`), invitation = await invite(person.email);
  const proof = await proofFor(person, invitation.token);
  const request = await call(owner, { action: "lifecycle_request", organizationId: org, command }, 201, "organizations");
  beforeBatch = async () => { await call(admin, { action: "lifecycle_approve", organizationId: org, requestId: request.id }, 200, "organizations"); };
  batchRaceReached = false; await accept(person, invitation.token, proof, org, 404); assert.equal(batchRaceReached, true);
  const changed = await d1.prepare("SELECT status,revision FROM organizations WHERE id=?").bind(org).first<{ status: string; revision: number }>();
  assert.equal(changed?.status, command === "suspend" ? "suspended" : "closed"); assert.equal(changed?.revision, 2);
  await assertUnaccepted(invitation, person);
});

for (const action of ["revoke", "resend"]) test(`owner ${action} at acceptance commit defeats the old credential without partial membership`, async () => {
  await freshOrganization(`commit-${action}`);
  const person = await actor(`commit-${action}-recipient`), invitation = await invite(person.email);
  const proof = await proofFor(person, invitation.token); let replacement: Result | undefined;
  beforeBatch = async () => { replacement = await call(owner, { action, organizationId: org, invitationId: invitation.id }, action === "resend" ? 201 : 200); };
  batchRaceReached = false; await accept(person, invitation.token, proof, org, 404); assert.equal(batchRaceReached, true);
  await assertUnaccepted(invitation, person, action === "resend" ? "superseded" : "revoked");
  if (action === "resend") {
    assert.ok(replacement); assert.notEqual(replacement.token, invitation.token);
    await accept(person, replacement.token, proof, org, 403);
    assert.equal((await accept(person, replacement.token, await proofFor(person, replacement.token))).organization.id, org);
  }
});

test("a separately accepted legacy membership wins an email-acceptance race without role replacement", async () => {
  await freshOrganization("legacy-race");
  const person = await actor("legacy-race-recipient"), invitation = await invite(person.email, "org_admin");
  const proof = await proofFor(person, invitation.token);
  const legacy = await call(owner, { action: "invite", organizationId: org, recipientActorId: person.actorId, role: "auditor" }, 201, "organizations");
  beforeBatch = async () => { await call(person, { action: "accept", token: legacy.token }, 200, "organizations"); };
  batchRaceReached = false; await accept(person, invitation.token, proof, org, 404); assert.equal(batchRaceReached, true);
  const memberships = await d1.prepare("SELECT role,revision FROM organization_memberships WHERE organization_id=? AND user_id=?").bind(org, person.userId).all<{ role: string; revision: number }>();
  assert.deepEqual(memberships.results, [{ role: "auditor", revision: 1 }]);
  assert.equal((await d1.prepare("SELECT status FROM email_invitations WHERE id=?").bind(invitation.id).first<{ status: string }>())?.status, "pending");
  assert.equal((await d1.prepare("SELECT used_at FROM invitation_mailbox_proofs WHERE invitation_id=?").bind(invitation.id).first<{ used_at: string | null }>())?.used_at, null);
  assert.equal((await d1.prepare("SELECT count(*) AS n FROM organization_security_events WHERE target_id=? AND action='email_invitation_accepted'").bind(invitation.id).first<{ n: number }>())?.n, 0);
});

test("concurrent duplicate creation produces one pending invitation and one synthetic message", async () => {
  await freshOrganization("duplicate-create"); const sent = mailbox.length, email = "duplicate-create-recipient@example.test";
  const create = () => {
    const request = new Request("https://invite.test/api/invitations", { method: "POST", headers: { origin: "https://invite.test", "sec-fetch-site": "same-origin", "content-type": "application/json", "oai-authenticated-user-email": owner.email },
      body: JSON.stringify({ action: "invite", organizationId: org, recipientEmail: email, role: "member" }) });
    return requestStorage.run(request, () => routes.invitations.POST(request));
  };
  const responses = await Promise.all([create(), create()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal((await d1.prepare("SELECT count(*) AS n FROM email_invitations WHERE organization_id=? AND recipient_email=? AND status='pending'").bind(org, email).first<{ n: number }>())?.n, 1);
  assert.equal(mailbox.length - sent, 1);
});
