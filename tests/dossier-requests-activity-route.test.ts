import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requests = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/requests/route.ts", import.meta.url),
  "utf8",
);
const activity = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/activity/route.ts", import.meta.url),
  "utf8",
);

function requestSection(start: string, end: string) {
  const startIndex = requests.indexOf(start);
  const endIndex = requests.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing request section ${start}`);
  return requests.slice(startIndex, endIndex);
}

function assertOrdered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding batch operation`);
    cursor = next;
  }
}

test("request and activity reads use viewer-safe joined participant actions", () => {
  assert.match(
    requests,
    /export async function GET[\s\S]*?requireDossierAccess\(context, dossierId, "read"\)/u,
  );
  assert.match(
    requests,
    /export async function POST[\s\S]*?requireDossierAccess\(context, dossierId, "requests"\)/u,
  );
  assert.match(activity, /requireDossierAccess\(context, dossierId, "audit"\)/u);
  assert.match(requests, /dossierParticipants\.status, "active"/u);
  assert.doesNotMatch(requests + activity, /Response\.json/u);
});

test("request and deadline retrieval is bounded, cursor-paged and metadata-only", () => {
  assert.match(requests, /MAX_PAGE_SIZE = 50/u);
  assert.match(requests, /Math\.min\(parsed, MAX_PAGE_SIZE\)/u);
  assert.match(requests, /parseDossierOpaqueId\(cursorValue/u);
  assert.match(requests, /limit\(limit \+ 1\)/u);
  assert.match(requests, /dossierDeadlineReferences/u);
  assert.match(requests, /dossierDeadlineSources/u);
  assert.match(requests, /source_anchor_ids/u);
  assert.doesNotMatch(requests, /binaryObjectReference|extractedTextObjectReference|DOSSIER_DOCUMENTS/u);
});

test("request mutation rejects ambient authority and uses server actor identity", () => {
  assert.match(requests, /isSameOriginMutation/u);
  assert.match(requests, /ALLOWED_REQUEST_FIELDS/u);
  assert.match(requests, /protected or unknown field/u);
  assert.match(requests, /requestIdentityCount > 1/u);
  assert.match(requests, /ownerUserId: context\.actor\.userId/u);
  assert.match(requests, /ownerActorRef: context\.actor\.actorId/u);
  assert.match(requests, /createdByActorRef: context\.actor\.actorId/u);
  assert.doesNotMatch(requests, /payload\.owner|payload\.actor|payload\.role|payload\.organisation/u);
});

test("create and status update stale outputs and append audits before their receipt", () => {
  assert.match(requests, /expectedDossierRevision/u);
  assert.match(requests, /eq\(dossiers\.revision, expectedRevision\)/u);
  assert.match(requests, /prepareDossierRevisionAuditBatch\(context, access\.dossier\.id, nextRevision/u);
  assert.match(requests, /eventType: "information_request_changed"/u);
  assert.match(requests, /objectRefType: "information_request"/u);
  assert.match(requests, /context\.db\.batch\(\[/u);
  assert.match(requests, /context\.db\.insert\(dossierInformationRequests\)/u);
  assert.match(requests, /context\.db\.update\(dossierInformationRequests\)/u);
  assert.match(requests, /reason: "INFORMATION_REQUEST_CHANGED"/u);
  assert.equal(requests.match(/const staleOutputs = await currentOutputStates/g)?.length, 2);
  const sections = [
    [
      requestSection("async function createInformationRequest(", "async function updateInformationRequestStatus("),
      "context.db.insert(dossierInformationRequests).values(values)",
    ],
    [
      requestSection("async function updateInformationRequestStatus(", "async function resolveRequestedParticipant("),
      "context.db.update(dossierInformationRequests).set",
    ],
  ] as const;
  for (const [source, domainWrite] of sections) {
    assertOrdered(source, [
      "context.db.update(dossiers).set",
      domainWrite,
      "context.db.insert(dossierOutputStateEvents).values",
      "context.db.insert(dossierAuditEvents).values(event)",
      "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
    ]);
  }
});

test("received status requires a same-dossier satisfying source and unknown request IDs do not disclose", () => {
  assert.match(requests, /status === "received" && !satisfyingDocumentId && !satisfyingEvidenceLinkId/u);
  assert.match(requests, /eq\(dossierDocuments\.dossierId, dossierId\)/u);
  assert.match(requests, /eq\(dossierEvidenceLinks\.dossierId, dossierId\)/u);
  assert.match(requests, /if \(!stored\) return dossierNotFound\(\)/u);
  assert.match(requests, /computeStoredDossierReadiness/u);
});

test("activity pages the immutable audit sequence with bounded metadata detail", () => {
  assert.match(activity, /MAX_PAGE_SIZE = 50/u);
  assert.match(activity, /Math\.min\(parsed, MAX_PAGE_SIZE\)/u);
  assert.match(activity, /parseDossierOpaqueId\(cursorValue/u);
  assert.match(activity, /lt\(dossierAuditEvents\.sequence, cursorSequence\)/u);
  assert.match(activity, /orderBy\(desc\(dossierAuditEvents\.sequence\)\)/u);
  assert.match(activity, /MAX_DETAIL_CHARACTERS = 16_384/u);
  assert.match(activity, /DETAIL_WITHHELD/u);
  assert.doesNotMatch(activity, /dossierDocumentVersions|binaryObjectReference|DOSSIER_DOCUMENTS/u);
});
