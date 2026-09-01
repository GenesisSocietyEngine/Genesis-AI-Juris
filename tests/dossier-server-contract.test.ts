import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/dossier-server.ts", import.meta.url), "utf8");

test("dossier server context resolves only persisted stable actor identities", () => {
  assert.match(source, /users\.actorId/u);
  assert.match(source, /parseDossierOpaqueId\(user\.actorId/u);
  assert.match(source, /profile_required/u);
  assert.doesNotMatch(source, /users\.organisation|email\.split|GENESIS_ADMIN_EMAILS/u);
});

test("object access is one active participant join with a non-disclosing 404", () => {
  assert.match(source, /innerJoin\(dossierParticipants/u);
  assert.match(source, /eq\(dossierParticipants\.userId, context\.actor\.userId\)/u);
  assert.match(source, /eq\(dossierParticipants\.actorId, context\.actor\.actorId\)/u);
  assert.match(source, /eq\(dossierParticipants\.status, "active"\)/u);
  assert.match(source, /authorizeDossierAction/u);
  assert.match(source, /return dossierNotFound\(\)/u);
});

test("private responses and audit receipts contain no storage keys or document bodies", () => {
  assert.match(source, /private, no-store, max-age=0, must-revalidate/u);
  assert.match(source, /X-Content-Type-Options/u);
  assert.match(source, /previous_event_digest/u);
  assert.match(source, /canonicalDossierJson\(input\.detail \?\? \{\}\)/u);
  assert.doesNotMatch(source, /DOSSIER_DOCUMENTS|binaryObjectReference|extractedText/u);
});

test("revision receipts are separate from chained same-revision audit events", () => {
  assert.match(source, /dossierRevisionValue: number/u);
  assert.match(source, /dossierRevisionValue < 1/u);
  assert.match(source, /prepareDossierRevisionAuditBatch/u);
  assert.match(source, /revisionReceipt:/u);
  assert.match(source, /resultingRevision,/u);
  assert.match(source, /createdByActorRef: context\.actor\.actorId/u);
  assert.match(source, /dossier_revision: dossierRevision/u);
  assert.match(source, /dossierRevision,/u);
  assert.doesNotMatch(source, /mutationReceipt|mutation_receipt/u);
});
