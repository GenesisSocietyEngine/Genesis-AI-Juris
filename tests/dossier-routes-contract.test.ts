import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/dossiers/route.ts", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/api/dossiers/[dossierId]/route.ts", import.meta.url), "utf8");

function assertOrdered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding batch operation`);
    cursor = next;
  }
}

test("Matter list is participant-scoped, bounded and metadata-only", () => {
  assert.match(route, /dossierParticipants\.userId/u);
  assert.match(route, /dossierParticipants\.actorId/u);
  assert.match(route, /dossierParticipants\.status, "active"/u);
  assert.match(route, /MAX_PAGE_SIZE = 50/u);
  assert.match(route, /documentCount/u);
  assert.match(route, /dossierDocuments\.isProvisional/u);
  assert.match(route, /currentOutputCount/u);
  assert.doesNotMatch(route, /binaryObjectReference|extractedText|DOSSIER_DOCUMENTS/u);
});

test("Matter creation ignores client authority, generates its reference, and begins at revision one", () => {
  assert.match(route, /Owner, tenant authority, and the Matter reference are resolved by the server/u);
  assert.match(route, /ownerUserId: context\.actor\.userId/u);
  assert.match(route, /ownerActorId: context\.actor\.actorId/u);
  assert.match(route, /organisationId: null/u);
  assert.match(route, /status: "draft"/u);
  assert.match(route, /revision: 1/u);
  assert.match(route, /At least one jurisdiction is required/u);
  assert.match(route, /isSameOriginMutation/u);
  assert.match(route, /reference: generatedReference\(now, id\)/u);
  assert.doesNotMatch(route, /suppliedReference|eq\(dossiers\.reference, values\.reference\)/u);
});

test("Matter creation and audit are one D1 batch with private responses", () => {
  assert.match(route, /context\.db\.batch\(\[/u);
  assert.match(route, /context\.db\.insert\(dossiers\)/u);
  assert.match(route, /context\.db\.insert\(dossierRevisionReceipts\)/u);
  assert.match(route, /context\.db\.insert\(dossierAuditEvents\)/u);
  assert.match(route, /eventType: "dossier_created"/u);
  assertOrdered(route.slice(route.indexOf("await context.db.batch([")), [
    "context.db.insert(dossiers).values(values)",
    "context.db.insert(dossierAuditEvents).values(audit!)",
    "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
  ]);
  assert.match(route, /return dossierJson/u);
});

test("Matter detail and update use joined authorization, revision CAS and explicit protected actions", () => {
  assert.match(detail, /requireDossierAccess\(context, dossierId, "read"\)/u);
  assert.match(detail, /requireDossierAccess\(context, dossierId, "update"\)/u);
  assert.match(detail, /expectedDossierRevision/u);
  assert.match(detail, /eq\(dossiers\.revision, expectedRevision\)/u);
  assert.match(detail, /Protected Matter fields require their explicit governed action/u);
  assert.match(detail, /"manifest_digest", "reference"/u);
  assert.doesNotMatch(detail, /set\.reference|eq\(dossiers\.reference/u);
  assert.doesNotMatch(detail, /\.set\(payload\)|Object\.assign\([^,]+, payload/u);
});

test("authoritative Matter update stales current outputs and appends one audit chain atomically", () => {
  assert.match(detail, /state: "stale"/u);
  assert.match(detail, /DOSSIER_REVISION_CHANGED/u);
  assert.match(detail, /output_marked_stale/u);
  assert.match(detail, /prepareDossierRevisionAuditBatch/u);
  assert.match(detail, /insert\(dossierRevisionReceipts\)\.values\(revisionReceipt\)/u);
  assert.match(detail, /context\.db\.batch\(\[/u);
  assertOrdered(detail.slice(detail.indexOf("await context.db.batch([")), [
    "context.db.update(dossiers).set",
    "context.db.insert(dossierOutputStateEvents).values",
    "context.db.insert(dossierAuditEvents).values(event)",
    "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
  ]);
  assert.match(detail, /computeStoredDossierReadiness/u);
});
