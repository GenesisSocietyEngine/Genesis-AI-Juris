import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import {
  publishedGraphDigest,
  validatedPublishedGraphTarget,
} from "../app/dossier-evidence-graph";
import { compileStudioDraft } from "../app/studio-compiler";
import type { StudioDraft } from "../app/types";

const anchors = source("../app/api/dossiers/[dossierId]/evidence/anchors/route.ts");
const assertions = source("../app/api/dossiers/[dossierId]/evidence/assertions/route.ts");
const links = source("../app/api/dossiers/[dossierId]/evidence/links/route.ts");
const server = source("../app/dossier-evidence-server.ts");
const graph = source("../app/dossier-evidence-graph.ts");

function source(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function section(input: string, start: string, end: string) {
  const startIndex = input.indexOf(start);
  const endIndex = input.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing section ${start}`);
  return input.slice(startIndex, endIndex);
}

function assertOrdered(input: string, needles: readonly string[]) {
  let cursor = -1;
  for (const needle of needles) {
    const next = input.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the preceding operation`);
    cursor = next;
  }
}

test("Evidence reads are participant-scoped, bounded, cursor-paged metadata", () => {
  for (const route of [anchors, assertions, links]) {
    assert.match(route, /requireDossierAccess\(context, dossierId, "read"\)/u);
    assert.match(route, /MAX_PAGE_SIZE = 50/u);
    assert.match(route, /getAll\("limit"\)\.length > 1/u);
    assert.match(route, /getAll\("cursor"\)\.length > 1/u);
    assert.match(route, /parseDossierOpaqueId\(cursorValue/u);
    assert.match(route, /eq\([^\n]+\.dossierId, access\.dossier\.id\)/u);
    assert.match(route, /limit\(limit \+ 1\)/u);
    assert.doesNotMatch(route, /binaryObjectReference|extractedTextObjectReference|contentReference/u);
  }
  assert.match(assertions, /MAX_SOURCE_ROWS = MAX_PAGE_SIZE \* MAX_SOURCE_IDS/u);
  assert.match(assertions, /limit\(MAX_SOURCE_ROWS \+ 1\)/u);
});

test("Evidence mutations are same-origin, role-scoped and reject ambient authority fields", () => {
  for (const route of [anchors, assertions, links]) {
    assert.match(route, /isSameOriginMutation\(request\)/u);
    assert.match(route, /contains a protected or unknown field/u);
    assert.match(route, /expectedDossierRevision/u);
    assert.match(route, /expectedRevision !== access\.dossier\.revision/u);
    assert.match(route, /eq\(dossiers\.revision, expectedRevision\)/u);
  }
  assert.match(anchors, /requireDossierAccess\(context, dossierId, "anchors"\)/u);
  assert.match(assertions, /requireDossierAccess\(context, dossierId, "assertions"\)/u);
  assert.match(links, /requireDossierAccess\(context, dossierId, "evidence"\)/u);

  const anchorAllowlist = section(anchors, "const ALLOWED_ANCHOR_FIELDS", "]);\nconst CREATE_FIELDS");
  const assertionAllowlist = section(assertions, "const ALLOWED_ASSERTION_FIELDS", "]);\nconst CREATE_FIELDS");
  const evidenceAllowlist = section(links, "const ALLOWED_EVIDENCE_FIELDS", "]);\n\nexport async function GET");
  for (const allowlist of [anchorAllowlist, assertionAllowlist, evidenceAllowlist]) {
    assert.doesNotMatch(allowlist, /actor|reviewer|createdBy|created_by|owner|role|organisation|userId/u);
  }
  assert.doesNotMatch(anchorAllowlist, /checksum|creator|reviewState|review_state/u);
  assert.doesNotMatch(assertionAllowlist, /status|originatingProposal|originating_proposal/u);
});

test("manual anchors bind a finalized immutable version and server-derived provenance", () => {
  assert.match(anchors, /from\(dossierDocumentVersions\)\.innerJoin\(dossierDocuments/u);
  assert.match(anchors, /eq\(dossierDocumentVersions\.dossierId, dossierId\)/u);
  assert.match(anchors, /eq\(dossierDocumentVersions\.documentId, input\.documentId\)/u);
  assert.match(anchors, /eq\(dossierDocumentVersions\.id, input\.documentVersionId\)/u);
  assert.match(anchors, /eq\(dossierDocuments\.isProvisional, false\)/u);
  assert.match(anchors, /eq\(dossierExtractionResults\.extractorVersion, input\.extractionVersion\)/u);
  assert.match(anchors, /input\.characterEnd > extraction\.characterCount/u);
  assert.match(anchors, /eq\(dossierExtractionPageMaps\.extractionResultId, extraction\.id\)/u);
  assert.match(anchors, /document_content_sha256: documentContentSha256/u);
  assert.match(anchors, /const anchorChecksum = await sourceAnchorChecksum/u);
  assert.match(anchors, /const expectedChecksum = await sourceAnchorChecksum/u);
  assert.match(anchors, /expectedChecksum !== stored\.anchorChecksum\) return dossierNotFound\(\)/u);
  assert.match(anchors, /creator: "human" as const/u);
  assert.match(anchors, /reviewState: "pending" as const/u);
  assert.match(anchors, /reviewerUserId: null/u);
  assert.match(anchors, /reviewerActorRef: null/u);
  assert.match(anchors, /reviewedAt: null/u);
});

test("professional assertions enter review, retain accepted anchors, and never accept AI authority input", () => {
  assert.match(assertions, /eq\(dossierSourceAnchors\.reviewState, "accepted"\)/u);
  assert.match(assertions, /eq\(dossierDocuments\.isProvisional, false\)/u);
  assert.match(assertions, /acceptedAnchors\.length !== sourceAnchorIds\.length/u);
  assert.match(assertions, /status: "needs_review" as const/u);
  assert.match(assertions, /originatingProposalId: null/u);
  assert.match(assertions, /reviewedByUserId: null/u);
  assert.match(assertions, /decision === "accepted"[\s\S]*sources\.some\(\(\{ reviewState, isProvisional \}\)/u);
  assert.match(assertions, /reviewState !== "accepted" \|\| isProvisional/u);
  assert.match(assertions, /reviewedByUserId: context\.actor\.userId/u);
  assert.match(assertions, /reviewedByActorRef: context\.actor\.actorId/u);
  assert.match(assertions, /eq\(dossierProfessionalAssertions\.status, "needs_review"\)/u);
  assert.match(assertions, /eq\(dossierProfessionalAssertions\.status, "accepted"\)/u);
  assert.match(assertions, /status: "superseded"/u);
});

test("reviewed evidence links validate exact accepted same-dossier targets and fail closed", () => {
  assert.match(links, /eq\(dossierSourceAnchors\.dossierId, access\.dossier\.id\)/u);
  assert.match(links, /eq\(dossierSourceAnchors\.reviewState, "accepted"\)/u);
  assert.match(links, /eq\(dossierDocuments\.isProvisional, false\)/u);
  assert.match(links, /eq\(dossierProfessionalAssertions\.dossierId, access\.dossier\.id\)/u);
  assert.match(links, /eq\(dossierProfessionalAssertions\.status, "accepted"\)/u);
  assert.match(links, /targetType === "authority_rule" \? "rule" : "assumption"/u);
  assert.match(links, /eq\(dossierDeadlineReferences\.dossierId, access\.dossier\.id\)/u);
  assert.match(links, /targetType === "report_section"[\s\S]*evidence_target_unavailable/u);
  assert.match(links, /reviewedByUserId: context\.actor\.userId/u);
  assert.match(links, /reviewedByActorRef: context\.actor\.actorId/u);
  assert.match(links, /if \(!graphTargetExists\) return dossierNotFound\(\)/u);
  assert.match(links, /if \(!anchor\) return dossierNotFound\(\)/u);
  assert.match(links, /if \(!deadline\) return dossierNotFound\(\)/u);
});

test("graph links revalidate the exact current published package and entity ID", () => {
  assert.match(server, /innerJoin\(caseVersions/u);
  assert.match(server, /eq\(caseVersions\.caseId, dossierDecisionPackageReferences\.packageId\)/u);
  assert.match(server, /eq\(caseVersions\.version, dossierDecisionPackageReferences\.packageVersion\)/u);
  assert.match(server, /eq\(caseVersions\.fingerprint, dossierDecisionPackageReferences\.packageFingerprint\)/u);
  assert.match(server, /isNotNull\(caseVersions\.publishedAt\)/u);
  assert.match(server, /eq\(dossierDecisionPackageReferences\.dossierId, dossierId\)/u);
  assert.match(server, /eq\(dossierDecisionPackageReferences\.id, decisionPackageReferenceId\)/u);
  assert.match(server, /eq\(dossierDecisionPackageReferences\.state, "current"\)/u);
  assert.match(server, /eq\(dossierDecisionPackageReferences\.graphValidationStatus, "valid"\)/u);
  assert.match(server, /validatedPublishedGraphTarget\(record, targetType, targetId\)/u);
  assert.match(graph, /caseFingerprint\(draft\) !== record\.studioFingerprint/u);
  assert.match(graph, /compileStudioDraft\(draft, record\.studioFingerprint\)/u);
  assert.match(graph, /compilation\.scenario\.fingerprint !== record\.packageFingerprint/u);
  assert.match(graph, /graphDigest !== record\.referenceGraphDigest/u);
  assert.match(graph, /draft\.nodes\.some\(\(\{ id \}\) => id === targetId\)/u);
  assert.match(graph, /draft\.links\.some\(\(\{ id \}\) => id === targetId\)/u);
});

test("the production graph validator accepts exact entities and rejects substitution", async () => {
  const draft = validDraft();
  const studioFingerprint = caseFingerprint(draft);
  const compilation = compileStudioDraft(draft, studioFingerprint);
  assert.deepEqual(compilation.issues, []);
  assert.ok(compilation.scenario);
  const referenceGraphDigest = await publishedGraphDigest({
    packageId: draft.caseId,
    packageVersion: draft.version,
    studioFingerprint,
    nodes: draft.nodes,
    links: draft.links,
  });
  const exact = {
    referenceGraphDigest,
    packageId: draft.caseId,
    packageVersion: draft.version,
    packageFingerprint: compilation.scenario.fingerprint,
    studioFingerprint,
    payload: { studioDraft: draft },
  };
  assert.equal(await validatedPublishedGraphTarget(exact, "graph_node", "decision-1"), true);
  assert.equal(await validatedPublishedGraphTarget(exact, "graph_edge", "link-2"), true);
  assert.equal(await validatedPublishedGraphTarget(exact, "graph_node", "missing-node"), false);
  assert.equal(await validatedPublishedGraphTarget(exact, "graph_edge", "missing-link"), false);
  assert.equal(await validatedPublishedGraphTarget({ ...exact, referenceGraphDigest: `sha256-${"0".repeat(64)}` }, "graph_node", "decision-1"), false);
  assert.equal(await validatedPublishedGraphTarget({
    ...exact,
    payload: { studioDraft: { ...draft, title: "Substituted package" } },
  }, "graph_node", "decision-1"), false);
});

test("every Evidence mutation stales current outputs and appends audits before its receipt", () => {
  const mutationSections = [
    [section(anchors, "async function createSourceAnchor(", "async function reviewSourceAnchor("), "context.db.insert(dossierSourceAnchors).values(values)"],
    [section(anchors, "async function reviewSourceAnchor(", "async function anchorMutationResponse("), "context.db.update(dossierSourceAnchors).set"],
    [section(assertions, "async function createAssertion(", "async function reviewAssertion("), "context.db.insert(dossierProfessionalAssertions).values(values)"],
    [section(assertions, "async function reviewAssertion(", "async function supersedeAssertion("), "context.db.update(dossierProfessionalAssertions).set"],
    [section(assertions, "async function supersedeAssertion(", "async function assertionSources("), "context.db.update(dossierProfessionalAssertions).set"],
    [section(links, "export async function POST(", "function projectEvidenceLink("), "context.db.insert(dossierEvidenceLinks).values(values)"],
  ] as const;
  for (const [input, domainWrite] of mutationSections) {
    assertOrdered(input, [
      "context.db.update(dossiers).set",
      domainWrite,
      "...evidenceOutputStateStatements",
      "context.db.insert(dossierAuditEvents).values(event)",
      "context.db.insert(dossierRevisionReceipts).values(revisionReceipt)",
    ]);
  }
  assert.match(server, /limit\(MAX_OUTPUT_STATE_ROWS \+ 1\)/u);
  assert.match(server, /filter\(\(\{ state \}\) => state === "current"\)/u);
  assert.match(server, /sequence: output\.sequence \+ 1/u);
});

function validDraft(): StudioDraft {
  return {
    caseId: "evidence_graph_test",
    version: "1.0.0",
    parent: null,
    title: "Evidence graph test",
    jurisdiction: "EU",
    role: "Counsel",
    premise: "Validate exact Evidence graph targets.",
    classification: {
      domain: "general",
      practiceArea: "General legal",
      difficulty: "Intermediate",
      tags: [],
      taxTopics: [],
      complianceOnly: true,
      purpose: "compliance_review",
      legalAsOf: "",
      sourceUrls: [],
    },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Trigger", detail: "", x: 10, y: 10 },
      { id: "decision-1", type: "decision", title: "Decision", detail: "", x: 210, y: 10 },
      { id: "outcome-1", type: "outcome", title: "Outcome", detail: "", x: 410, y: 10 },
    ],
    links: [
      { id: "link-1", from: "trigger-1", to: "decision-1" },
      { id: "link-2", from: "decision-1", to: "outcome-1" },
    ],
    editHistory: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}
