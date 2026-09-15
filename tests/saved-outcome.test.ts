import assert from "node:assert/strict";
import test from "node:test";
import { refreshSavedOutcome, savedOutcomeMessage, savedOutcomeReceipt, type RefreshResult, type SavedOutcomeState } from "../app/matters/saved-outcome";

const expected = { caseId: "dossier_example_000001", recordId: "deadline_example_00001", kind: "deadline" as const,
  reason: "Received confirmation from the responsible reviewer.", revision: 8, status: "completed", support: "anchor_example_000001" };
const payload = { disposition: { dossierId: expected.caseId, deadlineReferenceId: expected.recordId, reason: expected.reason,
  newStatus: "completed", supportingSourceAnchorId: expected.support, revisionBefore: 8, revisionAfter: 9,
  actorRef: "actor_example_00000001", actorRole: "reviewer", occurredAt: "2026-09-15T09:00:00.000Z", auditEventId: "audit_example_00000001" },
  audit_event_id: "audit_example_00000001", dossier: { dossier_id: expected.caseId, revision: 9 } };
const receipt = savedOutcomeReceipt(payload, expected)!;

test("review receipt binds record, outcome, support, reason, audit and both revisions", () => {
  assert.ok(receipt); assert.equal(receipt.actorRole, "reviewer");
  for (const patch of [{ dossierId: "foreign" }, { deadlineReferenceId: "different" }, { reason: "other" },
    { newStatus: "waived" }, { supportingSourceAnchorId: null }, { revisionBefore: 7 }, { revisionAfter: 10 }, { auditEventId: "different" }]) {
    assert.equal(savedOutcomeReceipt({ ...payload, disposition: { ...payload.disposition, ...patch } }, expected), null);
  }
  assert.equal(savedOutcomeReceipt({ ...payload, dossier: { ...payload.dossier, revision: 10 } }, expected), null);
  assert.equal(savedOutcomeReceipt({ ...payload, disposition: { ...payload.disposition, actorRef: null, occurredAt: null } }, expected)?.occurredAt, null);
});

test("citation retirement receipts require the exact replacement and retain separate review consequences", () => {
  const citation = { ...expected, kind: "citation" as const, recordId: "anchor_old_00000000001" };
  const row = { ...payload.disposition, sourceAnchorId: citation.recordId, replacementSourceAnchorId: citation.support };
  assert.equal(savedOutcomeReceipt({ ...payload, disposition: row }, citation)?.outcome, "retired");
  assert.equal(savedOutcomeReceipt({ ...payload, disposition: { ...row, replacementSourceAnchorId: null } }, citation), null);
});

test("confirmed write stays saved while its deferred refresh is pending", async () => {
  const states: SavedOutcomeState[] = [];
  let finish!: (result: RefreshResult) => void;
  const pending = refreshSavedOutcome(receipt, () => new Promise(resolve => { finish = resolve; }), () => true, state => states.push(state));
  assert.deepEqual(states.map(state => state.phase), ["updating"]);
  assert.match(savedOutcomeMessage(states[0]), /Outcome saved/);
  assert.doesNotMatch(savedOutcomeMessage(states[0]), /actions updated/);
  finish({ status: "updated", revision: 9 }); await pending;
  assert.deepEqual(states.map(state => state.phase), ["updating", "updated"]);
});

test("refresh failure preserves the receipt and retry performs reads only", async () => {
  const states: SavedOutcomeState[] = []; let reads = 0;
  await refreshSavedOutcome(receipt, async () => { reads++; throw new Error("read unavailable"); }, () => true, state => states.push(state));
  assert.equal(states.at(-1)?.phase, "update_failed"); assert.equal(states.at(-1)?.receipt, receipt);
  assert.match(savedOutcomeMessage(states.at(-1)!), /Outcome saved.*could not be updated/);
  await refreshSavedOutcome(receipt, async () => { reads++; return { status: "updated", revision: 10 }; }, () => true, state => states.push(state));
  assert.equal(reads, 2); assert.equal(states.at(-1)?.phase, "updated");
});

test("an older or partial refresh cannot establish current queue readiness", async () => {
  for (const result of [{ status: "updated", revision: 8 }, { status: "failed" }] as RefreshResult[]) {
    const states: SavedOutcomeState[] = [];
    await refreshSavedOutcome(receipt, async () => result, () => true, state => states.push(state));
    assert.equal(states.at(-1)?.phase, "update_failed");
  }
});

test("late responses cannot publish completion into another case or a newer refresh", async () => {
  let current = true, finish!: (result: RefreshResult) => void;
  const states: SavedOutcomeState[] = [];
  const pending = refreshSavedOutcome(receipt, () => new Promise(resolve => { finish = resolve; }), () => current, state => states.push(state));
  current = false; finish({ status: "updated", revision: 9 }); await pending;
  assert.deepEqual(states.map(state => state.phase), ["updating"]);
});
