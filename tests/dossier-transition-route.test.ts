import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const security = readFileSync(new URL("../app/dossier-security.ts", import.meta.url), "utf8");
const route = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/transitions/route.ts", import.meta.url),
  "utf8",
);

function assertOrdered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding batch operation`);
    cursor = next;
  }
}

test("status transition is a distinct participant action for every non-viewer professional role", () => {
  assert.match(security, /"transition"/u);
  assert.match(
    security,
    /transition: \{ mode: "participant", roles: \["owner", "contributor", "reviewer"\] \}/u,
  );
  assert.match(route, /requireDossierAccess\(context, dossierId, "transition"\)/u);
});

test("transition decisions derive current output and approval facts on the server", () => {
  assert.match(route, /dossierStatusTransitionDecision/u);
  assert.match(route, /currentOutputFacts/u);
  assert.match(route, /dossierOutputApprovals/u);
  assert.match(route, /dossierOutputStateEvents/u);
  assert.match(route, /outputId: dossierOutputApprovals\.outputId/u);
  assert.match(route, /eq\(dossierOutputApprovals\.reviewerUserId, context\.actor\.userId\)/u);
  assert.match(route, /eq\(dossierOutputApprovals\.reviewerActorRef, context\.actor\.actorId\)/u);
  assert.match(route, /orderBy\(desc\(dossierOutputApprovals\.approvedAt\), asc\(dossierOutputApprovals\.outputId\), asc\(dossierOutputApprovals\.id\)\)/u);
  assert.match(route, /const approvedOutputId = newStatus === "output_approved" \? outputFacts\.approvedOutputId : null/u);
  assert.match(route, /approvedOutputId,/u);
  assert.match(route, /approved_output_id: approvedOutputId/u);
  assert.doesNotMatch(route, /payload\.hadCurrentOutput|payload\.hadReviewerApproval/u);
});

test("transition mutation binds revision, status, immutable history and audit in one D1 batch", () => {
  assert.match(route, /expectedDossierRevision/u);
  assert.match(route, /eq\(dossiers\.revision, expectedRevision\)/u);
  assert.match(route, /eq\(dossiers\.status, access\.dossier\.status\)/u);
  assert.match(route, /context\.db\.insert\(dossierStatusTransitions\)/u);
  assert.match(route, /eventType: "dossier_status_transitioned"/u);
  assert.match(route, /context\.db\.batch\(\[/u);
  assert.match(route, /closedAt: now/u);
  assert.match(route, /archivedAt: now/u);
  assertOrdered(route.slice(route.indexOf("await context.db.batch([")), [
    "context.db.insert(dossierStatusTransitions).values",
    "context.db.update(dossiers).set",
    "context.db.insert(dossierOutputStateEvents).values",
    "context.db.insert(dossierAuditEvents).values(event)",
    "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
  ]);
});

test("stale-output consequences are applied atomically while approved-output transitions preserve current output", () => {
  assert.match(route, /decision\.consequences\.includes\("mark_outputs_stale"\)/u);
  assert.match(route, /context\.db\.insert\(dossierOutputStateEvents\)/u);
  assert.match(route, /DOSSIER_STATUS_TRANSITIONED/u);
  assert.match(route, /computeStoredDossierReadiness/u);
});

test("transition payload is same-origin, bounded and rejects client authority fields", () => {
  assert.match(route, /isSameOriginMutation/u);
  assert.match(route, /ALLOWED_TRANSITION_FIELDS/u);
  assert.match(route, /protected or unknown field/u);
  assert.match(route, /optionalDossierText\(payload\.reason, "transition reason", 1_000\)/u);
  assert.doesNotMatch(route, /payload\.actor|payload\.role|payload\.platformAdmin/u);
});
