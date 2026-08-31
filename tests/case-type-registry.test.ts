import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { projectCaseCoreV2 } from "../app/case-core";
import {
  applyCaseType,
  CASE_TYPE_REGISTRY,
  caseTypeDefinition,
  caseTypeReference,
  caseTypeRegistrySignature,
  normalizeCaseTypeReference,
} from "../app/case-type-registry";
import type { StudioDraft } from "../app/types";

function legacyDraft(): StudioDraft {
  return {
    caseId: "legacy_case",
    version: "1.0.0",
    parent: null,
    title: "Legacy case",
    jurisdiction: "BE",
    role: "Professional adviser",
    premise: "A legacy case remains importable without a case-type field.",
    classification: { domain: "general", practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true },
    nodes: [{ id: "trigger-1", type: "trigger", title: "Matter opened", detail: "The matter was received.", x: 0, y: 0 }],
    links: [],
    editHistory: [],
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

test("case-type registry exposes four immutable v1 packages", () => {
  assert.deepEqual(CASE_TYPE_REGISTRY.map((item) => item.id), ["general_advisory", "tax_compliance", "erp_incident", "training_simulation"]);
  assert.ok(CASE_TYPE_REGISTRY.every((item) => item.version === "1.0.0"));
  assert.deepEqual(caseTypeDefinition(caseTypeReference("erp_incident")).views, ["task_plan", "evidence_map", "decision_table", "timeline"]);
  assert.throws(() => normalizeCaseTypeReference({ registry: "genesis-juris-case-types", id: "erp_incident", version: "2.0.0" }), /Unsupported case type version/);
  const manifest = JSON.parse(readFileSync(new URL("../app/case-type-registry.v1.json", import.meta.url), "utf8")) as { types: unknown };
  assert.deepEqual(caseTypeRegistrySignature(), manifest.types);
});

test("legacy drafts preserve their existing fingerprint until a case type is explicitly selected", () => {
  const legacy = legacyDraft();
  const before = caseFingerprint(legacy);
  const normalized = normalizeStudioDraft(legacy);
  assert.equal(normalized.caseType, undefined);
  assert.equal(caseFingerprint(normalized), before);
  const typed = applyCaseType(normalized, "erp_incident");
  assert.notEqual(caseFingerprint(typed), before);
  assert.equal(typed.caseType?.id, "erp_incident");
  assert.equal(typed.classification?.practiceArea, "ERP incident & solution design");
});

test("Case Core v2 is a deterministic, domain-neutral projection", () => {
  const typed = applyCaseType(legacyDraft(), "general_advisory");
  typed.nodes.push(
    { id: "actor-1", type: "actor", title: "Client", detail: "The instructing party.", x: 100, y: 100 },
    { id: "fact-1", type: "fact", title: "Notice received", detail: "The client received notice.", x: 200, y: 200 },
    { id: "evidence-1", type: "evidence", title: "Notice", detail: "Signed notice.", x: 300, y: 300 },
    { id: "decision-1", type: "decision", title: "Response", detail: "Choose a response.", x: 400, y: 400 },
    { id: "outcome-1", type: "outcome", title: "Resolved", detail: "Matter resolved.", x: 500, y: 500 },
  );
  const core = projectCaseCoreV2(typed);
  assert.equal(core.schemaVersion, 2);
  assert.equal(core.caseType.id, "general_advisory");
  assert.equal(core.participants[0]?.title, "Client");
  assert.equal(core.facts[0]?.statement, "The client received notice.");
  assert.equal(core.evidence[0]?.title, "Notice");
  assert.equal(core.issues[0]?.title, "Response");
  assert.equal(core.outcomes[0]?.title, "Resolved");
});

test("Studio exposes case types and exports the Case Core v2 package", () => {
  const app = readFileSync(new URL("../app/JurisApp.tsx", import.meta.url), "utf8");
  const selector = readFileSync(new URL("../app/StudioCaseTypeSelector.tsx", import.meta.url), "utf8");
  assert.match(app, /schemaVersion: 4/);
  assert.match(app, /core: projectCaseCoreV2\(exportedDraft\)/);
  assert.match(app, /StudioCaseTypeSelector/);
  assert.match(selector, /role="radiogroup"/);
  assert.match(selector, /Pinned definition/);
});
