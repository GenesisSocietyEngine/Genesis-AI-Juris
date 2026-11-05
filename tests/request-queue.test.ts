import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRequests } from "../app/matters/matter-view-model";
import { EMPTY_REQUEST_FILTERS, requestGroup, requestResponsibleKey, selectRequestQueue } from "../app/matters/request-queue";

const now = Date.parse("2026-11-05T12:00:00Z");
const requests = normalizeRequests({ requests: [
  { id: "r1", question: "Collect contract", reason: "Check dates", status: "open", priority: "high", requested_from_participant_id: "p1", requested_from_display_name: "Same name", due_at: "2026-11-05T12:30:00+01:00" },
  { id: "r2", question: "Collect contract", status: "open", priority: "low", requested_from_participant_id: "p2", requested_from_display_name: "Same name", due_at: "2026-11-05T13:30:00+01:00" },
  { id: "r3", status: "received", priority: "high", due_at: "2020-01-01T00:00:00Z", satisfying_document_id: "doc3" },
  { id: "r4", status: "open", due_at: "not-a-date" },
  { id: "r5", status: "waived", due_at: null },
  { id: "r6", status: "cancelled", due_at: "2020-01-01T00:00:00Z" },
  { id: "r7", status: "future_unknown_status", due_at: "2020-01-01T00:00:00Z" },
] }).requests;

test("request due groups use instants and preserve closed, invalid and unknown states", () => {
  assert.deepEqual(requests.map(r => requestGroup(r, now)), ["overdue", "upcoming", "resolved", "undated", "resolved", "resolved", "other"]);
  assert.equal(requestGroup({ ...requests[0], dueAt: "2026-11-05T12:00:00Z" }, now), "upcoming");
  assert.equal(requestGroup({ ...requests[0], dueAt: null }, now), "undated");
});
test("combined filters retain distinct same-name participants and exact request and source identities", () => {
  const before = JSON.stringify(requests);
  assert.notEqual(requestResponsibleKey(requests[0]), requestResponsibleKey(requests[1]));
  const filtered = selectRequestQueue(requests, { query: "CHECK dates", status: "overdue", priority: "high", responsible: "participant:p1" }, now);
  assert.deepEqual(filtered.map(r => r.id), ["r1"]);
  assert.equal(filtered[0], requests[0]);
  assert.deepEqual(selectRequestQueue(requests, { ...EMPTY_REQUEST_FILTERS, query: "r3" }, now).map(r => r.satisfyingDocumentId), ["doc3"]);
  assert.deepEqual(selectRequestQueue(requests, { ...EMPTY_REQUEST_FILTERS, status: "overdue", responsible: "participant:p2" }, now), []);
  assert.equal(JSON.stringify(requests), before);
});
test("undated requests sort last without mutating input and unassigned remains a distinct filter", () => {
  const result = selectRequestQueue(requests, { ...EMPTY_REQUEST_FILTERS, status: "open" }, now);
  assert.deepEqual(result.map(r => r.id), ["r1", "r2", "r4"]);
  assert.deepEqual(selectRequestQueue(requests, { ...EMPTY_REQUEST_FILTERS, status: "open", responsible: "unassigned" }, now).map(r => r.id), ["r4"]);
  assert.equal(requestResponsibleKey({ ...requests[0], requestedFromParticipantId: null }), "label:Same name");
});
