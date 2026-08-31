import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CASE_TYPE_REGISTRY, caseTypeRegistrySignature } from "../app/case-type-registry";
import { CASE_TYPE_PLAYBOOK_REGISTRY, caseTypePlaybook, caseTypePlaybookSignature, evaluateCaseTypeDraft } from "../app/case-type-playbooks";
import { caseTypeReference } from "../app/case-type-reference";
import { studioAIProviderContext } from "../app/studio-ai-provider-context";
import type { CaseTypeId, StudioDraft, StudioNodeType } from "../app/types";

const root = fileURLToPath(new URL("..", import.meta.url));

function draftFor(id: CaseTypeId, nodeTypes: StudioNodeType[]): StudioDraft {
  return {
    caseId: `${id}_case`, version: "1.0.0", caseType: caseTypeReference(id), parent: null,
    title: "Reviewable professional matter", jurisdiction: "Belgium", role: "Professional reviewer", premise: "A documented matter requires structured analysis and a reviewable decision package.",
    classification: { practiceArea: "Professional", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: id === "tax_compliance", purpose: "compliance_review", legalAsOf: id === "tax_compliance" ? "2026-08-31" : undefined, sourceUrls: id === "tax_compliance" ? ["https://example.com/authority"] : [] },
    nodes: nodeTypes.map((type, index) => ({ id: `${type}-${index + 1}`, type, title: `${type} ${index + 1}`, detail: `Reviewable ${type}`, x: index * 180, y: index * 140 })),
    links: [], editHistory: [], updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

test("v59 provides one complete declarative playbook for every immutable case type", () => {
  assert.equal(CASE_TYPE_PLAYBOOK_REGISTRY.format, "genesis-juris-case-playbook-registry");
  assert.equal(CASE_TYPE_PLAYBOOK_REGISTRY.schemaVersion, 1);
  assert.deepEqual(CASE_TYPE_PLAYBOOK_REGISTRY.playbooks.map((item) => item.caseType.id).sort(), CASE_TYPE_REGISTRY.map((item) => item.id).sort());
  assert.equal(caseTypePlaybookSignature().length, caseTypeRegistrySignature().length);
  for (const definition of CASE_TYPE_REGISTRY) {
    const playbook = caseTypePlaybook(caseTypeReference(definition.id));
    assert.equal(playbook.caseType.version, definition.version);
    assert.equal(playbook.intakeQuestions.length, 4);
    assert.ok(playbook.requiredNodeGroups.length >= 4);
    assert.ok(playbook.outputs.some((output) => output.primary));
  }
});

test("each first-release case type has distinct completeness and testing rules", () => {
  const advisory = draftFor("general_advisory", ["actor", "fact", "evidence", "decision", "outcome"]);
  const tax = draftFor("tax_compliance", ["entity", "cash_flow", "tax_rule", "fact", "decision", "outcome"]);
  const erp = draftFor("erp_incident", ["trigger", "actor", "fact", "evidence", "decision", "outcome"]);
  const training = draftFor("training_simulation", ["trigger", "actor", "evidence", "decision", "outcome", "outcome"]);
  for (const draft of [advisory, tax, erp, training]) assert.equal(evaluateCaseTypeDraft(draft, "en").filter((check) => check.level === "warn").length, 0, draft.caseType?.id);
  assert.equal(caseTypePlaybook(advisory.caseType).test.requiresPlayableRoute, false);
  assert.equal(caseTypePlaybook(tax.caseType).test.mode, "compare");
  assert.equal(caseTypePlaybook(erp.caseType).test.mode, "process");
  assert.equal(caseTypePlaybook(training.caseType).test.requiresPlayableRoute, true);
});

test("tax playbook fails closed without legal currency and source controls", () => {
  const draft = draftFor("tax_compliance", ["entity", "cash_flow", "tax_rule", "fact", "decision", "outcome"]);
  draft.classification = { ...draft.classification!, legalAsOf: undefined, sourceUrls: [], complianceOnly: false };
  const warnings = evaluateCaseTypeDraft(draft, "en").filter((check) => check.level === "warn").map((check) => check.id);
  assert.deepEqual(warnings, ["legal-as-of", "https-sources", "compliance-gate"]);
});

test("AI provider context is explicitly package-driven", () => {
  const draft = draftFor("erp_incident", ["trigger", "actor", "fact", "evidence", "decision", "outcome"]);
  const context = studioAIProviderContext({ draft, instruction: "Structure the incident", locale: "en" });
  assert.match(context.instructions, /Package: erp_incident@1\.0\.0/);
  assert.match(context.instructions, /Test mode: process/);
  assert.match(context.instructions, /Do not force a training-game route/);
  assert.match(context.input, /"caseType":\{"registry":"genesis-juris-case-types","id":"erp_incident"/);
});

test("v59 UI and report profiles consume the playbook registry rather than duplicating case copy", () => {
  const selector = readFileSync(`${root}/app/StudioCaseTypeSelector.tsx`, "utf8");
  const dialog = readFileSync(`${root}/app/CaseReportDialog.tsx`, "utf8");
  const app = readFileSync(`${root}/app/JurisApp.tsx`, "utf8");
  assert.match(selector, /caseTypePlaybook/);
  assert.match(dialog, /playbook\.outputs\.map/);
  assert.match(app, /packageRequiresPlayableRoute/);
  assert.match(app, /import\("\.\/studio-validation"\)/);
  assert.match(app, /validationReady=\{validationReady\}/);
});
