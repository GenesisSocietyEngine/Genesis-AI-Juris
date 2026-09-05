import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MATTER_DESTINATIONS,
  apiIssueFor,
  availableTransitions,
  destinationForDeepLink,
  mutationPayload,
  nextPageCursor,
  normalizeActivity,
  normalizeDocuments,
  normalizeMatterDetail,
  normalizeMatterList,
  normalizeProposals,
  proposalGenerationIdempotencyKey,
  readinessSummary,
  safeApiUrl,
  safeMatterLink,
  transitionConsequences,
  validatePilotFile,
} from "../app/matters/matter-view-model";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const detailFixture = {
  contract_version: "1.0.0",
  build_version: "v62-test",
  dossier: {
    object_type: "dossier",
    schema_version: 1,
    dossier_id: "dossier_workspace_001",
    reference: "MAT-2026-0042",
    title: "Длинное профессиональное дело / Long professional matter title",
    dossier_type: { registry: "genesis-juris-dossier-types", id: "general_matter", version: "1.0.0" },
    jurisdictions: ["England and Wales", "Российская Федерация"],
    status: "internal_review",
    owner_actor_id: "actor_owner_001",
    document_count: 2,
    priority: "urgent",
    classification: "strictly_confidential",
    key_deadline: { at: "2026-09-30T16:00:00.000Z", timezone: "Europe/Paris" },
    revision: 17,
    updated_at: "2026-09-01T10:00:00.000Z",
    current_participant: { role: "reviewer" },
    permissions: { can_write: false, can_review: true, can_transition: true, can_generate_output: true },
    readiness: {
      ready: false,
      computed_from_revision: 17,
      evaluated_at: "2026-09-01T10:00:00.000Z",
      dimensions: [{
        dimension: "contradictions",
        state: "blocked",
        reasons: [{
          code: "CONTRADICTION_UNRESOLVED",
          explanation: "Resolve the material contradiction before approval.",
          deep_link: "/matters/dossier_workspace_001#source-anchor_001",
          related_object_type: "professional_assertion",
          related_object_id: "assertion_001",
        }],
      }],
    },
    participants: [{
      participant_id: "participant_owner_001",
      actor_id: "actor_owner_001",
      display_name: "Named matter owner",
      role: "owner",
      status: "active",
    }],
    source_anchors: [{
      source_anchor_id: "anchor_001",
      document_id: "document_001",
      document_version_id: "version_002",
      document_title: "Source agreement",
      version_ordinal: 2,
      page_number: 14,
      paragraph: "3.2",
      excerpt: "The exact bounded source excerpt.",
      review_state: "accepted",
      anchor_checksum: `sha256-${"a".repeat(64)}`,
    }],
    professional_assertions: [{
      assertion_id: "assertion_001",
      assertion_type: "fact",
      statement: "A reviewed event occurred.",
      status: "accepted",
      source_anchor_ids: ["anchor_001"],
      reviewed_by: "actor_reviewer_001",
    }],
  },
};

test("the workspace exposes the seven bounded conceptual destinations in the required order", () => {
  assert.deepEqual(MATTER_DESTINATIONS.map(({ key, label }) => ({ key, label })), [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents & evidence" },
    { key: "evidence", label: "Evidence review" },
    { key: "decision-packages", label: "Decision packages" },
    { key: "requests", label: "Requests & deadlines" },
    { key: "outputs", label: "Outputs & approvals" },
    { key: "activity", label: "Activity" },
  ]);
});

test("matter normalisation preserves safe professional metadata, explicit readiness, owner, and role", () => {
  const detail = normalizeMatterDetail(detailFixture);
  assert.ok(detail);
  assert.equal(detail.id, "dossier_workspace_001");
  assert.equal(detail.ownerName, "Named matter owner");
  assert.equal(detail.documentCount, 2);
  assert.equal(detail.permissions.role, "reviewer");
  assert.equal(detail.permissions.canManageParticipants, false);
  assert.equal(detail.permissions.canWrite, false);
  assert.equal(detail.permissions.canApprove, true);
  assert.equal(detail.revision, 17);
  assert.equal(detail.readiness.ready, false);
  assert.equal(detail.readiness.dimensions[0].reasons[0].code, "CONTRADICTION_UNRESOLVED");
  assert.equal(detail.anchors[0].pageNumber, 14);
  assert.equal(detail.assertions[0].sourceAnchorIds[0], "anchor_001");
  assert.equal(readinessSummary(detail.readiness).headline, "Not ready — professional attention required");
  assert.match(readinessSummary(detail.readiness).detail, /Resolve the material contradiction/);

  assert.deepEqual(normalizeMatterList({ items: [detailFixture.dossier] }).map((matter) => matter.id), ["dossier_workspace_001"]);
});

test("document normalisation separates logical documents from immutable ordered versions", () => {
  const documents = normalizeDocuments({
    documents: [{
      document_id: "document_001",
      title: "Very long source title",
      document_type: "agreement",
      status: "accepted_source",
      classification: "confidential",
      current_version_id: "version_002",
    }],
    document_versions: [
      { document_version_id: "version_001", document_id: "document_001", ordinal: 1, original_filename: "earlier.pdf", media_type: "application/pdf", byte_length: 50, extraction_status: "not_extractable" },
      { document_version_id: "version_002", document_id: "document_001", ordinal: 2, original_filename: "current.txt", media_type: "text/plain", byte_length: 100, extraction_status: "ready", content_sha256: `sha256-${"b".repeat(64)}`, download_url: "/api/dossiers/dossier_workspace_001/documents/document_001/download" },
    ],
  });
  assert.equal(documents.length, 1);
  assert.equal(documents[0].versions.length, 2);
  assert.deepEqual(documents[0].versions.map((version) => version.ordinal), [2, 1]);
  assert.equal(documents[0].versions[0].downloadUrl, "/api/dossiers/dossier_workspace_001/documents/document_001/download");
  assert.equal(safeApiUrl("https://attacker.example/source"), null);
  assert.equal(safeApiUrl("/api/dossiers/ok//attacker"), null);
  assert.equal(safeMatterLink("/evidence/contradictions/assertion_001"), "/evidence/contradictions/assertion_001");
  assert.equal(destinationForDeepLink("/evidence/contradictions/assertion_001"), "evidence");
  assert.equal(destinationForDeepLink("/requests-deadlines/deadline_001"), "requests");
  assert.equal(safeMatterLink("https://attacker.example/source"), null);
});

test("proposal and activity pages are bounded and expose cursors without retaining unbounded bodies", () => {
  const proposals = Array.from({ length: 130 }, (_, index) => ({
    proposal_id: `proposal_${index}`,
    proposal_type: "fact",
    proposed_value: { statement: "x".repeat(2_000) },
    review_state: "pending",
    source_anchor_ids: ["anchor_001"],
  }));
  const normalizedProposals = normalizeProposals({ proposals, next_cursor: "proposal-page-2" });
  assert.equal(normalizedProposals.length, 100);
  assert.ok(normalizedProposals[0].proposedValue.length <= 1_500);
  assert.equal(nextPageCursor({ data: { nextCursor: "proposal-page-2" } }), "proposal-page-2");

  const activity = Array.from({ length: 130 }, (_, index) => ({
    audit_event_id: `event_${index}`,
    sequence: index + 1,
    event_type: "dossier_updated",
    summary_code: "matter_metadata_changed",
    detail: { safeMetadata: "y".repeat(2_000) },
  }));
  const page = normalizeActivity({ items: activity, next_cursor: "activity-page-2" });
  assert.equal(page.items.length, 100);
  assert.equal(page.nextCursor, "activity-page-2");
  assert.ok((page.items[0].detail?.length ?? 0) <= 1_500);
});

test("canonical lifecycle actions are role-scoped and explain output/readiness consequences", () => {
  const reviewerTransitions = availableTransitions("internal_review", "reviewer");
  assert.deepEqual(reviewerTransitions.map((option) => option.to), ["active", "awaiting_input", "output_approved", "closed"]);
  const approval = reviewerTransitions.find((option) => option.to === "output_approved");
  assert.ok(approval);
  assert.equal(approval.requiresCurrentOutput, true);
  assert.equal(approval.requiresReviewerApproval, true);
  assert.equal(approval.preservesCurrentOutput, true);
  assert.match(transitionConsequences(approval).join(" "), /Readiness will be recomputed/);
  assert.match(transitionConsequences(approval).join(" "), /current approved output will be preserved/);
  assert.deepEqual(availableTransitions("internal_review", "viewer"), []);
});

test("every client mutation binds an explicit optimistic-concurrency revision", () => {
  assert.deepEqual(mutationPayload(17, { expectedRevision: 99, expected_revision: 98, action: "review" }), {
    action: "review",
    expectedRevision: 17,
  });
  assert.throws(() => mutationPayload(-1, {}), /non-negative expected revision/);
  assert.throws(() => mutationPayload(1.5, {}), /non-negative expected revision/);
});

test("AI generation idempotency survives lost responses and source-order changes", async () => {
  const first = await proposalGenerationIdempotencyKey(
    "dossier_workspace_001",
    17,
    ["document_version_002", "document_version_001"],
  );
  const replay = await proposalGenerationIdempotencyKey(
    "dossier_workspace_001",
    17,
    ["document_version_001", "document_version_002"],
  );
  assert.equal(first, replay);
  assert.match(first, /^matter-proposals:[a-f0-9]{64}$/u);
  await assert.rejects(() => proposalGenerationIdempotencyKey("dossier_workspace_001", 17, []));
  await assert.rejects(() => proposalGenerationIdempotencyKey(
    "dossier_workspace_001",
    17,
    ["document_version_001", "document_version_001"],
  ));
});

test("pilot file validation rejects paths, mismatched media, empty files, and exact size overflows", () => {
  assert.deepEqual(validatePilotFile({ name: "source.pdf", size: 25 * 1024 * 1024, type: "application/pdf" }), {
    ok: true,
    canonicalMediaType: "application/pdf",
    maximumBytes: 25 * 1024 * 1024,
  });
  assert.equal(validatePilotFile({ name: "notes.md", size: 5 * 1024 * 1024, type: "text/plain" }).ok, true);
  for (const candidate of [
    { name: "../source.pdf", size: 10, type: "application/pdf" },
    { name: "source.exe", size: 10, type: "application/octet-stream" },
    { name: "source.pdf", size: 0, type: "application/pdf" },
    { name: "source.pdf", size: 25 * 1024 * 1024 + 1, type: "application/pdf" },
    { name: "source.pdf", size: 10, type: "text/html" },
  ]) assert.equal(validatePilotFile(candidate).ok, false, candidate.name);
});

test("failure states distinguish permission, stale revisions, unsupported pilot operations, and generic errors", () => {
  assert.equal(apiIssueFor(403, {}).kind, "permission");
  assert.equal(apiIssueFor(404, {}).kind, "permission");
  assert.equal(apiIssueFor(409, { code: "stale_revision" }).kind, "stale");
  assert.equal(apiIssueFor(409, { error: "The Matter could not be created." }).kind, "error");
  assert.equal(apiIssueFor(501, {}).kind, "unsupported");
  assert.equal(apiIssueFor(500, {}).kind, "error");
  assert.doesNotMatch(JSON.stringify(apiIssueFor(403, { dossier_id: "secret" })), /secret/);
});

test("the rendered client includes required states, endpoints, citations, privacy, and compact phone navigation", () => {
  const client = source("app/matters/MattersClient.tsx");
  const viewModel = source("app/matters/matter-view-model.ts");
  const workspaceSource = client + viewModel;
  const css = source("app/matters/matters.module.css");
  const page = source("app/matters/page.tsx");
  const runtimeConstants = source("app/runtime-constants.ts");
  const app = source("app/JurisApp.tsx");

  for (const endpoint of [
    "/api/dossiers", "/documents", "/transitions", "/requests", "/proposals",
    "/decision-packages", "/snapshots", "/outputs", "/activity",
    "/evidence/anchors", "/evidence/assertions", "/evidence/links",
  ]) assert.match(client, new RegExp(endpoint.replaceAll("/", "\\/")));
  for (const copy of [
    "My cases", "New case", "Import case prompt (.md)", "Browse templates",
    "All case types", "Owned by me", "Shared with me", "Recent activity",
    "Documents & evidence",
    "What needs attention next", "Lifecycle status", "Owner", "Key deadline",
    "AI-PROPOSED · NOT AUTHORITATIVE", "Version history", "Source anchor register",
    "User view", "Developer view", "synthetic or de-identified", "STALE REVISION",
    "No permission for this matter", "Unavailable in the current pilot boundary",
    "Create source anchor for review", "Create assertion for review",
    "Link evidence to graph entity", "Mark request received with source",
    "Add a new immutable version of",
    "Accepted graph proposal ID (optional)",
    "Completed simulation receipt IDs (optional)",
    "The server revalidates the published graph",
    "Generate source-grounded AI proposals",
    "Zero grounded candidates is a valid terminal result",
  ]) assert.match(workspaceSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /form\.set\("expectedRevision", String\(workspace\.matter\.revision\)\)/);
  assert.match(client, /mutationPayload\(workspace\.matter\.revision/);
  assert.match(client, /requiresReviewerApproval \|\| currentReviewerApproval/);
  assert.match(client, /matter\.permissions\.canApprove/);
  assert.match(client, /collision-resistant Matter reference come from the trusted server/);
  assert.doesNotMatch(client, /name="reference"/);
  assert.match(client, /Internal-only pilot boundary/);
  assert.match(client, /fixed pilot-default profile/);
  assert.doesNotMatch(client, /<option value="client">Client<\/option>/);
  assert.doesNotMatch(client, /name="redactionProfileId"/);
  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /aria-label=\{"Inspect AI proposal source/);
  assert.match(client, /name="documentId"/);
  assert.match(client, /action: "update_status", status: "received"/);
  assert.match(client, /action: "review", sourceAnchorId: anchor\.id, decision/);
  assert.match(client, /action: "review", assertionId: assertion\.id, decision/);
  assert.match(client, /decisionPackageReferenceId/);
  assert.match(client, /\/proposals\/generate/);
  assert.match(client, /expected_revision: workspace\.matter\.revision/);
  assert.match(client, /document_version_ids: sortedDocumentVersionIds/);
  assert.match(client, /idempotency_key: await proposalGenerationIdempotencyKey/);
  assert.match(client, /data_classification: "synthetic_or_deidentified"/);
  assert.match(client, /privacy_disclosure_acknowledged: true/);
  assert.match(client, /form\.getAll\("documentVersionIds"\)/);
  assert.match(client, /job\.result_code === "ready_no_candidates" && proposalCount === 0/);
  assert.match(client, /job\.result_code === "ready_with_candidates" && proposalCount > 0/);
  assert.match(client, /job\.analyzed_sources/);
  assert.match(client, /range\.character_start/);
  assert.match(client, /range\.character_end/);
  assert.match(client, /truncatedSources/);
  assert.match(client, /graphProposalId/);
  assert.match(client, /simulationReceiptIds/);
  assert.match(client, /\.split\(\/\[\\s,\]\+\/u\)/);
  assert.match(client, /role="tablist"/);
  assert.match(client, /mobileSectionSelect/);
  assert.match(client, /href="\/matters" aria-current="page"/);
  assert.match(client, /matter\.documentCount/);
  assert.match(client, /<details className=\{styles\.advancedFilters\}>/);
  assert.match(client, /view === "developer" \? ` · REVISION/);
  assert.doesNotMatch(client, /loaded authorised matter/);
  assert.match(client, /Product \{PRODUCT_RELEASE\}/);
  assert.match(runtimeConstants, /PRODUCT_RELEASE = "v62"/);
  assert.match(app, /className="catalogue-filter-more"/);
  assert.match(app, /className="case-trust-details"/);
  assert.match(app, /GENESIS: JURIS \{PRODUCT_RELEASE\}/);
  assert.match(client, /PENDING_CASE_PROMPT_KEY/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /\.sort\(\(left, right\)/);
  assert.doesNotMatch(client, /console\.|FileReader|readAs(?:Text|ArrayBuffer|DataURL)/);

  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.sectionTabs\{display:none\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(forced-colors:active\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
});

test("organization-gated pages render a safe sign-in state before client hydration", () => {
  const organizationsPage = source("app/organizations/page.tsx");
  const organizationsClient = source("app/organizations/OrganizationsClient.tsx");
  const mattersPage = source("app/matters/page.tsx");
  const organizationBoundary = source("app/organizations/OrganizationBoundary.tsx");

  for (const page of [organizationsPage, mattersPage]) {
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.match(page, /await getChatGPTUser\(\)/);
    assert.match(page, /signedIn=\{Boolean\(identity\)\}/);
  }
  assert.match(organizationsPage, /chatGPTSignInPath\("\/organizations"\)/);
  assert.match(mattersPage, /chatGPTSignInPath\("\/matters"\)/);

  for (const client of [organizationsClient, organizationBoundary]) {
    assert.match(client, /if \(!signedIn\) return;/);
    assert.match(client, /<a href=\{signInUrl\} target="_top">/);
    assert.match(client, /useState\(signedIn \? "" : "Sign in/);
  }
});
