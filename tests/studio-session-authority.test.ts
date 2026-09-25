import assert from "node:assert/strict";
import { test } from "node:test";
import { StudioSessionAuthority, shouldDiscardStudioDraft } from "../app/studio-session-authority";
import { studioDeviceScope } from "../app/studio-device-storage";
import { NavigationController } from "../app/navigation-controller";
import { SESSION_BOUNDARY_KEY, subscribeSessionBoundary } from "../app/session-boundary";

const email = "synthetic-owner@example.test";
const me = (value = email) => Response.json({ authenticated: true, registered: true, profile: { email: value }, capabilities: { studioAI: false } });
const permitted = (access = "owner", copyProtected = false, id = 1) => Response.json({ customCase: { id, isPrivate: true, access, copyProtected } });
function harness() {
  let response = async (path: string): Promise<Response> => path === "/api/me" ? me() : permitted();
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const authority = new StudioSessionAuthority((path, init) => { calls.push({ path, init }); return response(path); });
  return { authority, calls, respond(next: typeof response) { response = next; } };
}

test("protected output uses fresh same-origin account and exact existing case permission; focus is not a grant", async () => {
  const h = harness(); await h.authority.refresh(false, 1);
  const scope = await studioDeviceScope(email);
  const permission = h.authority.reportAuthority(true, scope, 1);
  const current = await permission.verify();
  assert.equal(current(), true);
  assert.deepEqual(h.calls.map(call => call.path), ["/api/me", "/api/custom-cases?id=1", "/api/me", "/api/custom-cases?id=1"]);
  for (const { init } of h.calls) {
    assert.equal(init?.credentials, "same-origin"); assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
  }
  h.respond(async () => Response.json({ authenticated: false }, { status: 401 }));
  await assert.rejects(permission.verify());
  assert.equal(current(), false); assert.equal(h.authority.getSnapshot().phase, "suspended");
  assert.equal(h.authority.getSnapshot().discardVersion, 0, "expiry conceals recoverable memory; it does not discard the draft");
});

test("401, redirects, HTML, malformed and unverifiable identities fail closed without a focus event", async t => {
  const variants: Array<[string, () => Promise<Response>]> = [
    ["401", async () => Response.json({}, { status: 401 })],
    ["redirect", async () => Response.redirect("https://login.invalid", 302)],
    ["followed redirect", async () => { const response = me(); Object.defineProperty(response, "redirected", { value: true }); return response; }],
    ["HTML", async () => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } })],
    ["invalid JSON", async () => new Response("{", { headers: { "content-type": "application/json" } })],
    ["false authenticated", async () => Response.json({ authenticated: false })],
    ["missing profile", async () => Response.json({ authenticated: true })],
    ["empty email", async () => me("")],
    ["truthy not boolean", async () => Response.json({ authenticated: "true", registered: true, profile: { email }, capabilities: { studioAI: false } })],
    ["503", async () => Response.json({}, { status: 503 })],
    ["network", async () => { throw new TypeError("synthetic offline"); }],
    ["timeout", async () => { throw new DOMException("synthetic timeout", "TimeoutError"); }],
  ];
  for (const [label, response] of variants) await t.test(label, async () => {
    const h = harness(); await h.authority.refresh(false, 1); const scope = h.authority.getSnapshot().scope;
    h.respond(response); await assert.rejects(h.authority.reportAuthority(true, scope, 1).verify());
    assert.equal(h.authority.getSnapshot().scope, null);
    assert.equal(h.calls.filter(call => call.path.includes("custom-cases")).length, 1, "no additional case read follows unverifiable identity");
  });
});

test("exact case permission preserves owner/shared policy and rejects admin, locked share and wrong ID", async t => {
  for (const [access, locked, id, pass] of [["owner", true, 1, true], ["shared", false, 1, true], ["admin", false, 1, false], ["shared", true, 1, false], ["owner", false, 2, false]] as const) {
    await t.test(`${access}/${locked}/${id}`, async () => {
      const h = harness(); await h.authority.refresh(false, 1); const scope = h.authority.getSnapshot().scope;
      h.respond(async path => path === "/api/me" ? me() : permitted(access, locked, id));
      const result = h.authority.reportAuthority(true, scope, 1).verify();
      if (pass) assert.equal((await result)(), true); else await assert.rejects(result);
    });
  }
  const h = harness(); await h.authority.refresh(false, 1); const scope = h.authority.getSnapshot().scope;
  h.respond(async path => path === "/api/me" ? me() : Response.json({}, { status: 404 }));
  await assert.rejects(h.authority.reportAuthority(true, scope, 1).verify());
  assert.equal(h.authority.getSnapshot().discardVersion, 1, "known case denial clears private loaded state");
});

test("late identity success and same-account return cannot revive a prior output lease", async () => {
  const h = harness(); await h.authority.refresh(false, 1); const scope = h.authority.getSnapshot().scope;
  const old = h.authority.reportAuthority(true, scope, 1), lease = await old.verify();
  let resolve!: (response: Response) => void;
  h.respond(() => new Promise<Response>(done => { resolve = done; }));
  const pending = h.authority.refresh(false, 1);
  h.authority.sessionBoundary("revoke"); resolve(me()); await pending;
  assert.equal(h.authority.getSnapshot().phase, "revoked");
  h.respond(async path => path === "/api/me" ? me() : permitted());
  await h.authority.refresh(false, 1); assert.equal(h.authority.getSnapshot().phase, "revoked", "focus cannot undo completed logout");
  await h.authority.refresh(true, 1); assert.equal(h.authority.getSnapshot().phase, "ready");
  assert.equal(lease(), false); await assert.rejects(old.verify());
  assert.equal((await h.authority.reportAuthority(true, scope, 1).verify())(), true, "a fresh explicit operation is allowed after revalidation");
  h.respond(async () => me("different@example.test"));
  await assert.rejects(h.authority.reportAuthority(true, scope, 1).verify());
  assert.equal(h.authority.getSnapshot().phase, "revoked");
});

test("ordinary logout broadcasts suspend, preserves Retry on failure and revokes on success without focus", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const bus = new EventTarget(); const messages: string[] = [];
  const fake = Object.assign(bus, { localStorage: { setItem(key: string, value: string) { assert.equal(key, SESSION_BOUNDARY_KEY); messages.push(value); } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: fake });
  const h = harness(); await h.authority.refresh(false, 1);
  const stop = subscribeSessionBoundary(h.authority.sessionBoundary);
  let logoutStatus = 503;
  const navigation = new NavigationController({ transport: async () => Response.json({}, { status: logoutStatus }), clear() {}, leave() {} });
  try {
    await navigation.signOut("en");
    assert.equal(navigation.canRetrySignOut, true); assert.equal(h.authority.getSnapshot().phase, "suspended");
    const callCount = h.calls.length; await h.authority.refresh(true, 1); assert.equal(h.calls.length, callCount, "failed logout cannot reopen private content by refreshing");
    assert.equal(h.authority.getSnapshot().discardVersion, 0);
    logoutStatus = 200; await navigation.signOut("en");
    assert.equal(h.authority.getSnapshot().phase, "revoked"); assert.equal(h.authority.getSnapshot().discardVersion, 1);
    assert.deepEqual(messages.map(value => JSON.parse(value).phase), ["suspend", "suspend", "revoke"]);
    assert.ok(messages.every(value => !value.includes(email) && !value.includes("token")), "signal carries no actor, credential or case data");
    // Independently exercise the actual other-tab storage listener, not focus.
    const event = new Event("storage"); Object.assign(event, { key: SESSION_BOUNDARY_KEY, newValue: messages[0] }); bus.dispatchEvent(event);
    assert.equal(h.authority.getSnapshot().phase, "suspended");
  } finally { stop(); if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window"); }
});

test("anonymous local drafts keep local output without pretending to have workspace authority", async () => {
  const h = harness(); h.respond(async () => Response.json({}, { status: 401 })); await h.authority.refresh(false, 1);
  const local = h.authority.reportAuthority(false, null, null);
  assert.equal(local.allowed, true); assert.equal((await local.verify())(), true); assert.equal(h.calls.length, 1);
  assert.equal(h.authority.reportAuthority(true, null, 1).allowed, false);
  h.authority.sessionBoundary("revoke");
  assert.equal(shouldDiscardStudioDraft(h.authority.getSnapshot().discardLocal, null, false), false, "the parent must retain unrelated anonymous/local-only input on another tab's logout");
  assert.equal(shouldDiscardStudioDraft(false, 1, false), true);
  assert.equal(shouldDiscardStudioDraft(false, null, true), true);
  assert.equal(shouldDiscardStudioDraft(true, null, false), true, "actual account change retains the existing stricter cleanup policy");
});

test("same-account recovery rechecks VIEW access before revealing retained private content, preserving inspection roles", async () => {
  const h = harness(); await h.authority.refresh(false, 1); const scope = h.authority.getSnapshot().scope;
  h.authority.invalidate("suspend");
  h.respond(async path => path === "/api/me" ? me() : Response.json({}, { status: 404 }));
  await h.authority.refresh(true, 1);
  assert.equal(h.authority.reportAuthority(true, scope, 1).visible, false);
  assert.equal(h.authority.getSnapshot().phase, "revoked");
  for (const [role, locked] of [["admin", false], ["shared", true]] as const) {
    h.respond(async path => path === "/api/me" ? me() : permitted(role, locked));
    await h.authority.refresh(true, 1);
    const policy = h.authority.reportAuthority(true, scope, 1);
    assert.equal(policy.visible, true, "server-permitted inspection remains available");
    assert.equal(policy.allowed, false, "inspection does not grant report/copy authority");
  }
});
