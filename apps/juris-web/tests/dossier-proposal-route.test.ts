import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/dossiers/[dossierId]/proposals/route.ts", import.meta.url),
  "utf8",
);

function routeSection(start: string, end: string) {
  const startIndex = route.indexOf(start);
  const endIndex = route.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing route section ${start}`);
  return route.slice(startIndex, endIndex);
}

function assertOrdered(source: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding batch operation`);
    cursor = next;
  }
}

test("proposal reads and mutations use distinct joined participant actions", () => {
  assert.match(route, /requireDossierAccess\(context, dossierId, "read"\)/u);
  assert.match(route, /requireDossierAccess\(context, dossierId, "proposals"\)/u);
  assert.match(route, /isSameOriginMutation\(request\)/u);
  assert.doesNotMatch(route, /Response\.json/u);
});

test("proposal retrieval is private, bounded, cursor-paged metadata", () => {
  assert.match(route, /MAX_PAGE_SIZE = 50/u);
  assert.match(route, /Math\.min\(parsed, MAX_PAGE_SIZE\)/u);
  assert.match(route, /parseDossierOpaqueId\(cursorValue, "proposal cursor"\)/u);
  assert.match(route, /limit\(limit \+ 1\)/u);
  assert.match(route, /limit\(MAX_PAGE_SIZE \* MAX_PROPOSAL_SOURCES\)/u);
  assert.match(route, /limit\(MAX_PROPOSAL_SOURCES \+ 1\)/u);
  assert.match(route, /MAX_PROPOSED_VALUE_CHARACTERS = 65_536/u);
  assert.match(route, /PROPOSAL_VALUE_WITHHELD/u);
  assert.match(route, /dossierJson\(\{/u);
  assert.doesNotMatch(route, /DOSSIER_DOCUMENTS|binaryObjectReference|extractedTextObjectReference/u);
});

test("mutations use exact action allowlists and reject client authority or aliases", () => {
  const requestFieldDeclarations = route.slice(
    route.indexOf("const BASE_FIELDS"),
    route.indexOf("export async function GET"),
  );
  assert.match(route, /ALLOWED_FIELDS/u);
  assert.match(route, /protected or unknown field/u);
  assert.match(route, /ALIASED_FIELDS\.some/u);
  assert.match(route, /contains an ambiguous field/u);
  assert.match(route, /field that is not valid for this action/u);
  assert.match(route, /createdByActorRef: context\.actor\.actorId/u);
  assert.match(route, /reviewingUserId: context\.actor\.userId/u);
  assert.match(route, /reviewingActorRef: context\.actor\.actorId/u);
  assert.match(route, /newDossierOpaqueId\(acceptsEvidenceLink \? "evidence_link" : "assertion"\)/u);
  for (const forbidden of [
    "actorId", "actor_id", "actorRole", "actor_role", "reviewState", "review_state",
    "acceptedObjectType", "accepted_object_type", "acceptedObjectId", "accepted_object_id",
    "modelProvider", "model_provider", "createdBy", "created_by",
  ]) {
    assert.equal(
      requestFieldDeclarations.includes(`"${forbidden}"`),
      false,
      `${forbidden} must not be a request field`,
    );
  }
});

test("pending candidate creation and source rebinding are revision-CAS bound", () => {
  assert.match(route, /PROPOSAL_ACTIONS = \["create", "update", "accept", "edit_and_accept", "reject"\]/u);
  assert.match(route, /expectedDossierRevision/u);
  assert.match(route, /eq\(dossiers\.revision, expectedRevision\)/u);
  assert.match(route, /context\.db\.insert\(dossierAIProposals\)\.values/u);
  assert.match(route, /reviewState: "pending"/u);
  assert.match(route, /modelProvider: null/u);
  assert.match(route, /resolveProposalSources/u);
  assert.match(route, /Every proposal source version requires an exact source anchor/u);
  assert.match(route, /context\.db\.delete\(dossierAIProposalAnchors\)/u);
  assert.match(route, /context\.db\.delete\(dossierAIProposalVersions\)/u);
  assert.match(route, /if \(stored\.reviewState !== "pending"\)/u);
  assert.match(route, /A reviewed proposal is immutable/u);
});

test("review decisions preserve candidate content and materialize accepted assertions", () => {
  assert.match(route, /reviewDossierProposal\(proposal/u);
  assert.match(route, /anchor\.reviewState !== "accepted"/u);
  assert.match(route, /acceptedObjectType: acceptsEvidenceLink \? "evidence_link" as const : "professional_assertion" as const/u);
  assert.match(route, /context\.db\.insert\(dossierProfessionalAssertions\)\.values/u);
  assert.match(route, /status: "needs_review"/u);
  assert.match(route, /context\.db\.insert\(dossierAssertionSources\)\.values/u);
  assert.match(route, /context\.db\.update\(dossierProfessionalAssertions\)\.set\(\{/u);
  assert.match(route, /status: "accepted"/u);
  assert.match(route, /originatingProposalId: proposalId/u);
  assert.match(route, /proposed_value: proposedValue/u);
  assert.doesNotMatch(
    route,
    /update\(dossierAIProposals\)\.set\(\{[\s\S]{0,320}proposedValue/u,
    "review must never rewrite immutable candidate content",
  );
});

test("accepted evidence-link candidates bind one accepted proposal anchor to an exact current graph entity", () => {
  assert.match(route, /stored\.proposalType === "evidence_link"/u);
  assert.match(route, /parseAcceptedEvidenceLink\(decision\.proposed_value/u);
  assert.match(route, /acceptedAnchorIds\.includes\(sourceAnchorId\)/u);
  assert.match(route, /exactCurrentGraphEntityExists/u);
  assert.match(route, /eq\(dossierEvidenceLinks\.decisionPackageReferenceId, evidenceLink\.decisionPackageReferenceId\)/u);
  assert.match(route, /context\.db\.insert\(dossierEvidenceLinks\)\.values/u);
  assert.match(route, /assertionId: null/u);
  assert.match(route, /reviewedByUserId: context\.actor\.userId/u);
  assert.match(route, /evidence_link_exists/u);
  assert.match(route, /Accepted evidence-link proposals contain unsupported fields/u);
});

test("every proposal mutation writes domain, stale rows and audits before its receipt", () => {
  assert.match(route, /currentOutputStates/u);
  assert.equal(route.match(/const staleOutputs = await currentOutputStates/g)?.length, 3);
  assert.match(route, /const outputStaleReason = accepted \? "AUTHORITATIVE_PROPOSAL_ACCEPTED" : "AI_PROPOSAL_CHANGED"/u);
  assert.match(route, /reason: outputStaleReason/u);
  assert.match(route, /eventType: "proposal_reviewed"/u);
  assert.match(route, /eventType: "output_marked_stale" as const/u);
  assert.match(route, /prepareDossierRevisionAuditBatch\(context, access\.dossier\.id, nextRevision/u);
  const sections = [
    [
      routeSection("async function createProposal(", "async function updatePendingProposalSources("),
      "context.db.insert(dossierAIProposals).values",
    ],
    [
      routeSection("async function updatePendingProposalSources(", "async function reviewProposal("),
      "context.db.delete(dossierAIProposalAnchors)",
    ],
    [
      routeSection("async function reviewProposal(", "async function resolveProposalSources("),
      "context.db.update(dossierAIProposals).set",
    ],
  ] as const;
  for (const [source, domainWrite] of sections) {
    assertOrdered(source, [
      "revisionUpdate(context",
      domainWrite,
      "context.db.insert(dossierOutputStateEvents).values",
      "context.db.insert(dossierAuditEvents).values(event)",
      "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
    ]);
  }
  assert.match(route, /computeStoredDossierReadiness/u);
});

test("cross-dossier identifiers and unsupported authoritative mappings fail closed", () => {
  assert.match(route, /if \(!stored\) return dossierNotFound\(\)/u);
  assert.match(route, /anchors\.length !== anchorIds\.length\) return dossierNotFound\(\)/u);
  assert.match(route, /authoritative_mapping_unsupported/u);
  assert.match(route, /exactly one statement field/u);
  assert.match(route, /proposal_conflict/u);
});
