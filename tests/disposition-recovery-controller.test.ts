import assert from "node:assert/strict";
import { test } from "node:test";
import { DispositionRecoveryController, reviewFailure } from "../app/matters/disposition-recovery-controller";

const scope = { actorId: "actor_alice", organizationId: "signed-org-selection", caseId: "dossier_example", recordId: "deadline_example", generation: 1 };
const review = (revision = 7) => ({ actor_id: scope.actorId, kind: "deadline", revision, can_review: true, disposition: null, readiness_effect: "Closes only the historical deadline.", record: { id: scope.recordId, title: "Private historical deadline" }, dependent_assertions: [], current_output_ids: [] });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const receipt = () => ({ disposition: { dossierId: scope.caseId, deadlineReferenceId: scope.recordId, reason: "Private reason", newStatus: "completed", supportingSourceAnchorId: null, revisionBefore: 7, revisionAfter: 8, auditEventId: "audit_example", idempotencyKey: "operation-original", actorRef: scope.actorId }, audit_event_id: "audit_example", dossier: { dossier_id: scope.caseId, revision: 8 } });
const currentCase = () => ({ dossier: { dossier_id: scope.caseId, revision: 8, readiness: { dossier_id: scope.caseId, computed_from_revision: 8, evaluated_at: "2026-09-15T10:00:00Z", ready: true, dimensions: [{ dimension: "information", state: "ready", reasons: [] }] } } });
function harness() {
  const queue: Array<() => Promise<Response>> = [];
  const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
  let denied = 0, resourceDenied = 0, updated = 0;
  const controller = new DispositionRecoveryController({ scope, kind: "deadline", newKey: () => "operation-original", onCaseDenied: () => denied++, onResourceDenied: () => resourceDenied++, onUpdated: () => updated++, read: async (url, init) => { calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined }); const next = queue.shift(); assert.ok(next, "unexpected transport call " + url); return next(); } });
  const enqueue = (body: unknown, status = 200) => queue.push(async () => response(body, status));
  const prepare = async () => { enqueue(review()); await controller.open(); controller.setDraft({ reason: "Private reason", status: "completed", support: "" }); };
  const uncertain = async () => { await prepare(); enqueue(review()); queue.push(async () => { throw new Error("response lost"); }); await controller.save(); assert.equal(controller.getSnapshot().phase, "unknown"); };
  return { controller, queue, calls, enqueue, prepare, uncertain, counts: () => ({ denied, resourceDenied, updated }) };
}

test("R1 first guard 500 retains uncertain original body/key and uses honest read-only recovery", async () => {
  const h = harness(); await h.uncertain(); const operation = h.controller.getSnapshot().operation;
  h.enqueue({}, 500); await h.controller.checkOriginal();
  assert.equal(h.controller.getSnapshot().operation, operation); assert.equal(h.controller.getSnapshot().draft?.reason, "Private reason");
  assert.equal(h.controller.getSnapshot().phase, "unknown"); assert.match(h.controller.getSnapshot().message, /couldn't check/); assert.doesNotMatch(h.controller.getSnapshot().message, /cleared|no longer/);
  assert.equal(h.calls.filter(c => c.method === "POST").length, 1); assert.equal(h.controller.getSnapshot().busy, false);
});
test("R1 second lookup 403 clears prohibited state; authority 200 preserves the case distinction", async () => {
  const h = harness(); await h.uncertain(); h.enqueue(review()); h.enqueue({}, 403); h.enqueue(currentCase()); await h.controller.checkOriginal();
  const state = h.controller.getSnapshot(); assert.equal(state.phase, "resource_denied");
  for (const field of ["record", "draft", "receipt", "operation"] as const) assert.equal(state[field], null);
  assert.deepEqual(h.counts(), { denied: 0, resourceDenied: 1, updated: 0 });
  const count = h.calls.length; await h.controller.open(); await h.controller.checkOriginal(); await h.controller.replayOriginal(); assert.equal(h.calls.length, count);
});
test("R1 second lookup denial plus case authority denial clears the case and cannot repopulate it", async () => {
  const h = harness(); await h.uncertain(); h.enqueue(review()); h.enqueue({}, 403); h.enqueue({}, 404); await h.controller.checkOriginal();
  assert.equal(h.controller.getSnapshot().phase, "case_denied"); assert.equal(h.counts().denied, 1); assert.equal(h.controller.getSnapshot().draft, null);
});
test("R1 confirmed receipt survives readiness500; Retry update is read-only", async () => {
  const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue(receipt()); h.enqueue({}, 500); await h.controller.save();
  assert.equal(h.controller.getSnapshot().phase, "update_failed"); assert.equal(h.controller.getSnapshot().receipt?.revision, 8);
  h.enqueue(currentCase()); await h.controller.refreshCase(); assert.equal(h.controller.getSnapshot().phase, "updated"); assert.equal(h.calls.filter(c => c.method === "POST").length, 1);
});
test("R1 case denial invalidates deferred successful refresh and its cleanup", async () => {
  const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue(receipt());
  let finish!: (r: Response) => void; h.queue.push(() => new Promise(resolve => { finish = resolve; })); const saving = h.controller.save();
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  h.enqueue({}, 403); h.enqueue({}, 403); await h.controller.open();
  assert.equal(h.controller.getSnapshot().phase, "case_denied"); finish(response(currentCase())); await saving;
  assert.equal(h.controller.getSnapshot().phase, "case_denied"); assert.equal(h.controller.getSnapshot().receipt, null); assert.equal(h.counts().updated, 0);
});
test("R1 operation404 preserves uncertainty; explicit replay uses byte-identical original write", async () => {
  const h = harness(); await h.uncertain(); const original = h.controller.getSnapshot().operation;
  h.enqueue(review()); h.enqueue({}, 404); await h.controller.checkOriginal(); assert.equal(h.controller.getSnapshot().operation, original); assert.equal(h.controller.getSnapshot().replayEligible, true);
  h.controller.setDraft({ reason: "Changed proposal", status: "waived", support: "" }); assert.equal(h.controller.getSnapshot().draft?.reason, "Private reason");
  h.enqueue(review()); h.enqueue(receipt()); h.enqueue(currentCase()); await h.controller.replayOriginal();
  const writes = h.calls.filter(c => c.method === "POST"); assert.equal(writes.length, 2); assert.equal(writes[0].body, writes[1].body);
});
test("R1 expired sessions hide private UI state without re-keying or promising redirect continuity", async () => {
  const h = harness(); await h.uncertain(); const op = h.controller.getSnapshot().operation; h.enqueue({}, 401); await h.controller.checkOriginal();
  assert.equal(h.controller.getSnapshot().phase, "session_expired"); assert.equal(h.controller.getSnapshot().operation, op); assert.match(h.controller.getSnapshot().message, /full-page sign-in may discard/);
});
test("R1 case visits discard old callbacks, including A to B to A", async () => {
  const h = harness(); let finish!: (r: Response) => void; h.queue.push(() => new Promise(resolve => { finish = resolve; })); const opening = h.controller.open();
  h.controller.invalidate({ ...scope, generation: 3 }); finish(response(review())); await opening; assert.equal(h.controller.getSnapshot().record, null); assert.equal(h.controller.getSnapshot().draft, null);
});
test("R1 validation retains input and conflict requires explicit comparison before a new write", async () => {
  const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue({ field: "reason" }, 400); await h.controller.save(); assert.equal(h.controller.getSnapshot().field, "reason"); assert.equal(h.controller.getSnapshot().draft?.reason, "Private reason");
  h.enqueue(review()); h.enqueue({ code: "revision_conflict" }, 409); await h.controller.save(); assert.equal(h.controller.getSnapshot().phase, "conflict");
  const count = h.calls.length; await h.controller.save(); assert.equal(h.calls.length, count);
  h.enqueue(review(9)); await h.controller.compareConflict(); h.controller.confirmComparedRevision(9); assert.equal(h.controller.getSnapshot().phase, "editing"); assert.equal(h.controller.getSnapshot().operation, null);
});
test("R1 response purpose distinguishes absent operations, missing cases and refresh failures", () => {
  assert.equal(reviewFailure("original_operation", 404, false), "unknown"); assert.equal(reviewFailure("current_case", 404, true), "case_denied"); assert.equal(reviewFailure("current_case", 500, true), "update_failed");
});

test("R1 401 privacy latch survives 500 and network failure until exact authority is renewed", async () => {
  const h = harness(); await h.prepare(); h.enqueue({}, 401); await h.controller.open();
  assert.equal(h.controller.getSnapshot().authorityVisible, false);
  h.enqueue({}, 500); await h.controller.open();
  assert.equal(h.controller.getSnapshot().authorityVisible, false); assert.equal(h.controller.getSnapshot().requiresSignIn, true);
  h.queue.push(async () => { throw new Error("offline"); }); await h.controller.open();
  assert.equal(h.controller.getSnapshot().authorityVisible, false); assert.equal(h.controller.getSnapshot().draft?.reason, "Private reason");
  h.enqueue(review()); await h.controller.open(); assert.equal(h.controller.getSnapshot().authorityVisible, true); assert.equal(h.controller.getSnapshot().requiresSignIn, false);
});
test("R1 confirmed receipt stays hidden during deferred session revalidation and failed refresh", async () => {
  const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue(receipt()); h.enqueue({}, 401); await h.controller.save();
  assert.equal(h.controller.getSnapshot().receipt?.revision, 8); assert.equal(h.controller.getSnapshot().authorityVisible, false);
  let finish!: (r: Response) => void; h.queue.push(() => new Promise(resolve => { finish = resolve; })); const refresh = h.controller.refreshCase();
  assert.equal(h.controller.getSnapshot().authorityVisible, false); finish(response({}, 500)); await refresh;
  assert.equal(h.controller.getSnapshot().authorityVisible, false); assert.equal(h.controller.getSnapshot().receipt?.revision, 8); assert.equal(h.counts().updated, 0);
});
test("R1 denied resource plus expired case authority retains sign-in recovery without forbidden retries", async () => {
  const h = harness(); await h.uncertain(); h.enqueue(review()); h.enqueue({}, 403); h.enqueue({}, 401); await h.controller.checkOriginal();
  assert.equal(h.controller.getSnapshot().requiresSignIn, true); assert.equal(h.controller.getSnapshot().resourceBlocked, true);
  assert.equal(h.controller.getSnapshot().operation, null); const count = h.calls.length;
  await h.controller.open(); await h.controller.checkOriginal(); await h.controller.refreshCase(); assert.equal(h.calls.length, count);
});
test("R1 malformed or foreign readiness never confirms a current queue", async () => {
  for (const payload of [{ dossier: { dossier_id: scope.caseId } }, { dossier: { dossier_id: scope.caseId, revision: 8, readiness: { dossier_id: "another", computed_from_revision: 8 } } }, { dossier: { dossier_id: scope.caseId, revision: 8, readiness: { dossier_id: scope.caseId, computed_from_revision: 8 } } }]) {
    const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue(receipt()); h.enqueue(payload); await h.controller.save();
    assert.equal(h.controller.getSnapshot().phase, "update_failed"); assert.equal(h.counts().updated, 0); assert.equal(h.controller.getSnapshot().receipt?.revision, 8);
  }
});
test("R1 recorded outcomes cannot be overwritten by a new submission", async () => {
  const h = harness(); h.enqueue({ ...review(), disposition: { reason: "Already decided", newStatus: "waived" } }); await h.controller.open();
  h.controller.setDraft({ reason: "A new proposal", status: "completed", support: "" }); await h.controller.save();
  assert.equal(h.calls.filter(c => c.method === "POST").length, 0);
});

test("R1 comparison failure and reauthentication preserve the explicit conflict path", async () => {
  const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue({ code: "revision_conflict" }, 409); await h.controller.save();
  h.enqueue({}, 500); await h.controller.compareConflict(); assert.equal(h.controller.getSnapshot().phase, "conflict");
  h.enqueue({}, 401); await h.controller.compareConflict(); assert.equal(h.controller.getSnapshot().authorityVisible, false);
  h.enqueue(review(9)); await h.controller.open(); assert.equal(h.controller.getSnapshot().phase, "conflict");
  h.controller.confirmComparedRevision(9); assert.equal(h.controller.getSnapshot().phase, "editing");
  assert.equal(h.calls.filter(c => c.method === "POST").length, 1);
});
test("R1 unknown validation field remains a form error without accusing the reason field", async () => {
  const h = harness(); await h.prepare(); h.enqueue(review()); h.enqueue({ error: "Invalid support" }, 400); await h.controller.save();
  assert.equal(h.controller.getSnapshot().field, null); assert.match(h.controller.getSnapshot().message, /review details/);
});
test("R1 HTML or empty write denial still clears or hides private state according to HTTP authority", async () => {
  for (const status of [401, 403, 404]) {
    const h = harness(); await h.prepare(); h.enqueue(review()); h.queue.push(async () => new Response(status === 401 ? "<html>Session expired</html>" : "", { status }));
    if (status !== 401) h.enqueue(currentCase());
    await h.controller.save(); const state = h.controller.getSnapshot();
    assert.equal(state.authorityVisible, false); assert.equal(state.phase, status === 401 ? "session_expired" : "resource_denied");
    if (status !== 401) { assert.equal(state.draft, null); assert.equal(state.operation, null); }
    else { assert.equal(state.requiresSignIn, true); assert.ok(state.operation); }
  }
});
