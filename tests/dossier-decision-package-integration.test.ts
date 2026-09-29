import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import {
  buildDecisionPackageGraphProposalDiff,
  parseSimulationReceiptReferences,
  proveV61SimulationReceipt,
  validatePublishedDecisionPackage,
  verifyDecisionPackageGraphProposalDiff,
  type PublishedDecisionPackageRecord,
} from "../app/dossier-decision-package-integration";
import { compileStudioDraft } from "../app/studio-compiler";
import type { StudioDraft } from "../app/types";

const at = "2026-09-01T10:00:00.000Z";
const sessionKey = "11111111-1111-4111-8111-111111111111";

function draft(): StudioDraft {
  return {
    caseId: "package_integration",
    version: "1.0.0",
    parent: null,
    title: "Package integration",
    jurisdiction: "Belgium",
    role: "Counsel",
    premise: "A regulator requests a documented response.",
    premisePublication: "author-reviewed",
    classification: {
      domain: "general",
      practiceArea: "Regulatory",
      difficulty: "Advanced",
      tags: [],
      taxTopics: [],
      complianceOnly: true,
      purpose: "compliance_review",
      legalAsOf: "",
      sourceUrls: [],
    },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Request", detail: "Response required.", x: 20, y: 180 },
      { id: "actor-1", type: "actor", title: "Legal team", detail: "Coordinates.", x: 220, y: 70 },
      { id: "evidence-1", type: "evidence", title: "Minutes", detail: "Source.", x: 220, y: 280 },
      { id: "decision-1", type: "decision", title: "Respond", detail: "Choose.", x: 460, y: 180 },
      { id: "outcome-1", type: "outcome", title: "Strong", detail: "Protected.", x: 720, y: 80 },
      { id: "outcome-2", type: "outcome", title: "Weak", detail: "Compromised.", x: 720, y: 300 },
    ],
    links: [
      { id: "link-1", from: "trigger-1", to: "actor-1" },
      { id: "link-2", from: "trigger-1", to: "evidence-1" },
      { id: "link-3", from: "actor-1", to: "decision-1" },
      { id: "link-4", from: "evidence-1", to: "decision-1" },
      { id: "link-5", from: "decision-1", to: "outcome-1" },
      { id: "link-6", from: "decision-1", to: "outcome-2" },
    ],
    editHistory: [],
    updatedAt: at,
  };
}

function published(value: StudioDraft): PublishedDecisionPackageRecord {
  const studioFingerprint = caseFingerprint(value);
  const compilation = compileStudioDraft(value, studioFingerprint);
  assert.ok(compilation.scenario);
  assert.deepEqual(compilation.issues, []);
  return {
    packageId: value.caseId,
    packageVersion: value.version,
    packageFingerprint: compilation.scenario.fingerprint,
    studioFingerprint,
    parentPackageId: value.parent?.caseId ?? null,
    parentPackageVersion: value.parent?.version ?? null,
    parentPackageFingerprint: value.parent?.fingerprint ?? null,
    payload: { studioDraft: value },
  };
}

test("published package validation binds exact ID, version, playable fingerprint, Studio graph, and lineage", async () => {
  const base = draft();
  const exact = published(base);
  const result = await validatePublishedDecisionPackage(exact);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.value.graphDigest, /^sha256-[a-f0-9]{64}$/u);
  assert.match(result.value.validationReference, /^graph_validation_v1_[a-f0-9]{64}$/u);

  const versionSubstitution = await validatePublishedDecisionPackage({
    ...exact,
    packageVersion: "1.0.1",
  });
  assert.equal(versionSubstitution.ok, false);
  const playableSubstitution = await validatePublishedDecisionPackage({
    ...exact,
    packageFingerprint: `sha256-${"f".repeat(64)}`,
  });
  assert.equal(playableSubstitution.ok, false);
});

test("Studio parent substitution is rejected before governed playable-lineage translation", async () => {
  const base = published(draft());
  const childDraft = {
    ...draft(),
    version: "1.0.1",
    parent: {
      caseId: base.packageId,
      version: base.packageVersion,
      fingerprint: base.studioFingerprint!,
    },
    nodes: draft().nodes.map((node) => node.id === "actor-1"
      ? { ...node, title: "Reviewed response team" }
      : node),
  };
  const child = published(childDraft);
  assert.equal((await validatePublishedDecisionPackage(child)).ok, true);
  assert.equal((await validatePublishedDecisionPackage({
    ...child,
    parentPackageFingerprint: `sha256-${"e".repeat(64)}`,
  })).ok, false);
});

test("canonical graph proposal diffs reject target and base substitution", async () => {
  const baseRecord = published(draft());
  const childDraft = {
    ...draft(),
    version: "1.0.1",
    parent: {
      caseId: baseRecord.packageId,
      version: baseRecord.packageVersion,
      fingerprint: baseRecord.studioFingerprint!,
    },
    nodes: draft().nodes.map((node) => node.id === "actor-1"
      ? { ...node, title: "Reviewed response team" }
      : node),
  };
  const childRecord = published(childDraft);
  const baseValidation = await validatePublishedDecisionPackage(baseRecord);
  const childValidation = await validatePublishedDecisionPackage(childRecord);
  assert.equal(baseValidation.ok, true);
  assert.equal(childValidation.ok, true);
  if (!baseValidation.ok || !childValidation.ok) return;
  const diff = buildDecisionPackageGraphProposalDiff({
    base: {
      binding: {
        decision_package_reference_id: "decision_package_base_001",
        package_id: baseRecord.packageId,
        package_version: baseRecord.packageVersion,
        package_fingerprint: baseRecord.packageFingerprint,
        graph_digest: baseValidation.value.graphDigest,
      },
      draft: baseValidation.value.draft,
    },
    target: {
      binding: {
        package_id: childRecord.packageId,
        package_version: childRecord.packageVersion,
        package_fingerprint: childRecord.packageFingerprint,
        parent_package_id: baseRecord.packageId,
        parent_package_version: baseRecord.packageVersion,
        parent_package_fingerprint: baseRecord.packageFingerprint,
        graph_digest: childValidation.value.graphDigest,
      },
      draft: childValidation.value.draft,
    },
  });
  assert.deepEqual(diff.changes.node_ids.changed, ["actor-1"]);
  assert.equal((await verifyDecisionPackageGraphProposalDiff(structuredClone(diff), diff)).ok, true);
  const substituted = structuredClone(diff);
  substituted.target.package_version = "9.9.9";
  assert.equal((await verifyDecisionPackageGraphProposalDiff(substituted, diff)).ok, false);
  const staleBase = structuredClone(diff);
  staleBase.base!.decision_package_reference_id = "decision_package_stale_001";
  assert.equal((await verifyDecisionPackageGraphProposalDiff(staleBase, diff)).ok, false);
});

test("simulation receipt request references are canonical, bounded, sorted, and unique", () => {
  const second = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(parseSimulationReceiptReferences([second, sessionKey]), [sessionKey, second]);
  assert.throws(() => parseSimulationReceiptReferences([sessionKey, sessionKey]), /unique/u);
  assert.throws(() => parseSimulationReceiptReferences(["simulation_run_v61_001"]), /invalid/u);
  assert.throws(() => parseSimulationReceiptReferences(Array.from({ length: 21 }, () => sessionKey)), /invalid/u);
});

test("a complete exact v61 persisted session proves a receipt without changing its reference", async () => {
  const packageRecord = published(draft());
  const proof = await proveV61SimulationReceipt({
    sessionKey,
    userEmail: "owner@example.test",
    caseId: packageRecord.packageId,
    caseVersion: packageRecord.packageVersion,
    caseFingerprint: packageRecord.packageFingerprint,
    state: { outcome: "strong", decisions: [{ sequence: 1, optionId: "option-1" }] },
    status: "completed",
    revision: 3,
    startedAt: at,
    completedAt: "2026-09-01T10:03:00.000Z",
    eventCount: 4,
    minimumEventSequence: 0,
    maximumEventSequence: 3,
    startEventCount: 1,
  }, {
    userEmail: "owner@example.test",
    packageId: packageRecord.packageId,
    packageVersion: packageRecord.packageVersion,
    packageFingerprint: packageRecord.packageFingerprint,
  });
  assert.equal(proof.ok, true);
  if (!proof.ok) return;
  assert.equal(proof.reference, sessionKey, "the existing v61 session reference remains unchanged");
  assert.match(proof.runtimeStateDigest, /^sha256-[a-f0-9]{64}$/u);
  assert.match(proof.parameterBindingDigest, /^sha256-[a-f0-9]{64}$/u);
  assert.match(proof.receiptDigest, /^sha256-[a-f0-9]{64}$/u);
});

test("unowned, substituted, active, or incomplete v61 sessions fail closed", async () => {
  const packageRecord = published(draft());
  const exact = {
    sessionKey,
    userEmail: "owner@example.test",
    caseId: packageRecord.packageId,
    caseVersion: packageRecord.packageVersion,
    caseFingerprint: packageRecord.packageFingerprint,
    state: { outcome: "strong" },
    status: "completed",
    revision: 2,
    startedAt: at,
    completedAt: "2026-09-01T10:03:00.000Z",
    eventCount: 3,
    minimumEventSequence: 0,
    maximumEventSequence: 2,
    startEventCount: 1,
  };
  const expected = {
    userEmail: exact.userEmail,
    packageId: exact.caseId,
    packageVersion: exact.caseVersion,
    packageFingerprint: exact.caseFingerprint,
  };
  assert.equal((await proveV61SimulationReceipt({ ...exact, userEmail: "other@example.test" }, expected)).ok, false);
  assert.equal((await proveV61SimulationReceipt({ ...exact, caseVersion: "9.9.9" }, expected)).ok, false);
  assert.equal((await proveV61SimulationReceipt({ ...exact, status: "active", completedAt: null }, expected)).ok, false);
  assert.equal((await proveV61SimulationReceipt({ ...exact, eventCount: 2 }, expected)).ok, false);
});

test("the integration helper validates receipts but does not reimplement the v61 simulation runtime", () => {
  const source = readFileSync(
    new URL("../app/dossier-decision-package-integration.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /canonical-runtime|game-engine|dispatchCanonicalAction|advanceCanonicalTime/u);
});
