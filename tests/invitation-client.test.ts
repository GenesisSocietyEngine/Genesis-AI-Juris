import assert from "node:assert/strict";
import test from "node:test";
import { invitationFromFragment, parseInvitationContinuation, invitationDeliveryText, postInvitation } from "../app/invitation-client";
import { safeWorkspaceReturn, workspaceSignInPath } from "../app/workspace-navigation";

test("invitation and separate proof survive only a bounded well-formed continuation", () => {
  const token = "a".repeat(43), proof = "b".repeat(43);
  const value = invitationFromFragment(`#invite=${token}&proof=${proof}`);
  assert.ok(value); assert.equal(value.token, token); assert.equal(value.proof, proof);
  assert.equal(parseInvitationContinuation({ ...value, expiresAt: Date.now() - 1 }), null);
  assert.equal(parseInvitationContinuation({ ...value, expiresAt: Date.now() + 86_400_001 }), null);
  assert.equal(invitationFromFragment(`#invite=${token}&invite=${proof}`), null);
  assert.equal(invitationFromFragment(`#invite=${token}&proof=bad`), null);
  assert.equal(safeWorkspaceReturn("/invitations?lang=ru"), "/invitations?lang=ru");
  assert.equal(workspaceSignInPath("/invitations"), "/signin-with-chatgpt?return_to=%2Finvitations");
});
test("delivery labels never claim delivery or pending membership from provider acceptance", () => {
  assert.match(invitationDeliveryText("provider_accepted", "en"), /Delivery has not been confirmed/);
  assert.doesNotMatch(invitationDeliveryText("provider_accepted", "en"), /membership/);
  assert.match(invitationDeliveryText("not_configured", "en"), /not sent/);
  assert.match(invitationDeliveryText("unknown", "en"), /could not be confirmed/);
});
test("lost invitation response times out without replaying the write", async () => {
  const original = globalThis.fetch;
  let calls = 0, signal: AbortSignal | undefined | null;
  globalThis.fetch = async (_url, options) => { calls++; signal = options?.signal; return new Promise<Response>(() => {}); };
  try {
    await assert.rejects(postInvitation({ action: "accept", token: "a".repeat(43) }, 15), /outcome_unknown/);
    assert.equal(calls, 1); assert.equal(signal?.aborted, true);
  } finally { globalThis.fetch = original; }
});
