import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { buildConvertedExample } from "../app/converted-examples";
import { searchStudioRecords } from "../app/studio-record-search";

test("ERP search retrieves authorization, gaps, owner and action without mutating original records", () => {
  const draft = buildConvertedExample("be_commercial_failed_erp_001", "en"), bytes = JSON.stringify(draft);
  for (const [query, id] of [["appeal_authorized", "event-appeal_authorized"], ["evidence gaps", "review-assumptions"], ["Asteron", "brief"], ["seek-client-appeal-authorization", "action-seek-client-appeal-authorization"]]) {
    assert.ok(searchStudioRecords(draft, query).some(node => node.id === id), query);
  }
  assert.deepEqual(searchStudioRecords(draft, "nonexistent source term"), []);
  assert.ok(searchStudioRecords(draft, "appeal", "evidence").every(node => node.type === "fact" || node.type === "evidence"));
  assert.equal(searchStudioRecords(draft, "").length, draft.nodes.length);
  assert.equal(JSON.stringify(draft), bytes);
  const times = Array.from({length: 100}, () => { const start = performance.now(); searchStudioRecords(draft, "appeal authorization"); return performance.now() - start; }).sort((a,b) => a-b);
  // Diagnostic only: elapsed scheduling is not a functional test or human retrieval claim.
  console.log(JSON.stringify({benchmark:"ERP authored record filter",records:draft.nodes.length,p95ms:times[94],targetMs:50}));
});

test("Unicode and multiple words search exact authored text; scope never infers completion", () => {
  const draft = buildConvertedExample("greenfire_first_72_hours", "ru");
  const node = draft.nodes[0]; node.detail = "Ответственный проверяет разрешение";
  assert.equal(searchStudioRecords(draft, "ОТВЕТСТВЕННЫЙ разрешение")[0], node);
  assert.ok(searchStudioRecords(draft, "", "scenarios").every(item => item.type === "outcome"));
});
