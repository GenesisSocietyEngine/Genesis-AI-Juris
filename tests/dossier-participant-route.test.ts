import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/participants/route.ts", import.meta.url),
  "utf8",
);
const enrollment = readFileSync(
  new URL("../app/dossier-participant-enrollment.ts", import.meta.url),
  "utf8",
);
const detail = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/route.ts", import.meta.url),
  "utf8",
);
const list = readFileSync(new URL("../app/api/dossiers/route.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../app/matters/MattersClient.tsx", import.meta.url), "utf8");

function assertOrdered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding enrollment batch operation`);
    cursor = next;
  }
}

test("participant POST is same-origin, owner-only, revision-CAS, and has an exact field boundary", () => {
  assert.match(route, /isSameOriginMutation\(request\)/u);
  assert.match(route, /requireDossierAccess\(context, dossierId, "participants"\)/u);
  assert.match(route, /expectedDossierRevision/u);
  assert.match(route, /expectedRevision !== access\.dossier\.revision/u);
  assert.match(route, /PARTICIPANT_FIELDS/u);
  assert.match(route, /Object\.keys\(payload\)\.some/u);
  assert.match(route, /parseDossierOpaqueId\(payload\.actorId \?\? payload\.actor_id/u);
  assert.doesNotMatch(route, /payload\.email|payload\.displayName|payload\.userId|payload\.owner/u);
});

test("only non-owner roles are enrollable and account identity is resolved by exact Actor ID", () => {
  assert.match(enrollment, /\["contributor", "reviewer", "viewer"\] as const/u);
  assert.doesNotMatch(
    enrollment.slice(
      enrollment.indexOf("DOSSIER_ENROLLABLE_ROLES"),
      enrollment.indexOf("const MAX_OUTPUT_STATE_ROWS"),
    ),
    /"owner"/u,
  );
  assert.match(enrollment, /eq\(users\.actorId, targetActorId\)/u);
  assert.match(enrollment, /displayName: users\.displayName/u);
  assert.match(enrollment, /eq\(dossierParticipants\.role, "owner"\)/u);
  assert.match(enrollment, /eq\(dossierParticipants\.status, "active"\)/u);
  assert.doesNotMatch(enrollment, /users\.email|eq\(users\.email/u);
});

test("enrollment atomically advances revision, inserts canonical provenance, stales outputs, audits, then receipts", () => {
  assert.match(enrollment, /createdByActorRef: input\.context\.actor\.actorId/u);
  assert.match(enrollment, /updatedByActorRef: input\.context\.actor\.actorId/u);
  assert.match(enrollment, /createdAt: now/u);
  assert.match(enrollment, /updatedAt: now/u);
  assert.match(enrollment, /eventType: "participant_changed"/u);
  assert.match(enrollment, /eventType: "output_marked_stale"/u);
  assert.match(enrollment, /DOSSIER_PARTICIPANT_CHANGED/u);
  assert.match(enrollment, /MAX_OUTPUT_STATE_ROWS = 5_000/u);
  assertOrdered(enrollment.slice(enrollment.indexOf("await input.context.db.batch([")), [
    "input.context.db.update(dossiers).set",
    "input.context.db.insert(dossierParticipants).values(participant)",
    "input.context.db.insert(dossierOutputStateEvents).values",
    "input.context.db.insert(dossierAuditEvents).values(event)",
    "input.context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
  ]);
});

test("missing, duplicate, and removed target accounts use one non-enumerating failure", () => {
  assert.match(enrollment, /DOSSIER_MAX_PARTICIPANT_ROWS = 100/u);
  assert.match(enrollment, /total: count\(\)/u);
  assert.match(enrollment, /eq\(dossierParticipants\.dossierId, dossierId\)/u);
  assert.match(enrollment, /Number\(capacity\?\.total \?\? 0\) >= DOSSIER_MAX_PARTICIPANT_ROWS/u);
  const capacitySection = enrollment.slice(
    enrollment.indexOf("const [capacity]"),
    enrollment.indexOf("const [target]"),
  );
  assert.doesNotMatch(capacitySection, /dossierParticipants\.status/u);
  assert.match(enrollment, /if \(!target\?\.actorId\) return unavailable\(\)/u);
  assert.match(enrollment, /if \(existing\) return unavailable\(\)/u);
  assert.match(enrollment, /code: "participant_enrollment_unavailable"/u);
  assert.match(route, /Participant enrollment could not be completed\./u);
  assert.doesNotMatch(route, /account does not exist|already (?:exists|enrolled)|removed participant/iu);
});

test("the participant register stays visible while enrollment is an explicit owner permission", () => {
  assert.match(detail, /can_manage_participants: access\.role === "owner"/u);
  assert.match(list, /can_manage_participants: role === "owner"/u);
  assert.match(client, /Participant register/u);
  assert.match(client, /matter\.participants\.map/u);
  assert.match(client, /matter\.permissions\.canManageParticipants/u);
  assert.match(client, /dossierPath \+ "\/participants"/u);
  assert.match(client, /defaultValue="reviewer"/u);
  assert.match(client, /<option value="reviewer">Reviewer<\/option>/u);
  assert.match(client, /<option value="contributor">Contributor<\/option>/u);
  assert.match(client, /<option value="viewer">Viewer<\/option>/u);
  assert.doesNotMatch(client, /<option value="owner">Owner<\/option>/u);
  assert.doesNotMatch(client, /name="email"/u);
});
