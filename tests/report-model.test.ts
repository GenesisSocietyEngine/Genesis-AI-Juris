import assert from "node:assert/strict";
import test from "node:test";
import { caseFingerprint } from "../app/case-integrity";
import { caseTypeReference } from "../app/case-type-reference";
import { CASE_TYPE_PLAYBOOK_REGISTRY, primaryCaseOutput } from "../app/case-type-playbooks";
import { REPORT_PROFILE_REGISTRY, buildCanonicalReportModel, isReportReceiptStale, reportReceipt, validateReportReadiness } from "../app/report-model";
import type { CaseTypeId, StudioDraft } from "../app/types";

function governedDraft(id: CaseTypeId): StudioDraft {
  const output = primaryCaseOutput(caseTypeReference(id));
  return {
    caseId: `${id}_fixture`, version: "1.0.0", caseType: caseTypeReference(id), parent: null,
    title: output.label.en, jurisdiction: "Belgium", role: "Professional reviewer", premise: "A governed professional matter with sufficient long-form context for report-model verification.",
    classification: { practiceArea: id, difficulty: "Expert", tags: [], taxTopics: id.includes("tax") ? ["planning"] : [], complianceOnly: true, purpose: "compliance_review", legalAsOf: "2026-08-31", sourceUrls: ["https://example.com/authority"] },
    nodes: [
      { id: "trigger-1", type: "trigger", title: "Matter opened", detail: "The governed matter was opened.", x: 0, y: 0 },
      { id: "actor-1", type: "actor", title: "Responsible professional", detail: "Accountable reviewer.", x: 100, y: 100 },
      { id: "fact-1", type: "fact", title: "Confirmed fact", detail: "Source-backed fact.", x: 200, y: 200 },
      { id: "evidence-1", type: "evidence", title: "Evidence item", detail: "Chain-of-custody evidence.", x: 300, y: 300 },
      { id: "decision-1", type: "decision", title: "Professional decision", detail: "Controlled decision point.", x: 400, y: 400 },
      { id: "outcome-1", type: "outcome", title: "Recommended outcome", detail: "Reviewable conclusion.", x: 500, y: 500 },
    ], links: [],
    editHistory: [{ id: "audit-1", role: "author", source: "visual", action: "node_updated", message: "Evidence verified", createdAt: "2026-08-31T10:00:00.000Z" }],
    updatedAt: "2026-08-31T10:00:00.000Z",
  };
}

test("immutable report profiles cover every case-package output", () => {
  const bindings = new Set(REPORT_PROFILE_REGISTRY.profiles.flatMap((profile) => profile.caseTypes.map((id) => `${id}:${profile.id}`)));
  for (const playbook of CASE_TYPE_PLAYBOOK_REGISTRY.playbooks) for (const output of playbook.outputs) assert.ok(bindings.has(`${playbook.caseType.id}:${output.id}`));
  assert.equal(REPORT_PROFILE_REGISTRY.rendererVersion, "1.0.0");
  assert.ok(REPORT_PROFILE_REGISTRY.profiles.every((profile) => profile.sections.length > 0));
});

test("canonical report models are deterministic, governed and prompt-safe", () => {
  const draft = governedDraft("investigation");
  draft.editHistory.unshift({ id: "prompt-1", role: "author", source: "prompt", action: "prompt_submitted", message: "SECRET RAW PROMPT", createdAt: "2026-08-31T09:00:00.000Z" });
  const fingerprint = caseFingerprint(draft);
  const input = { profileId: "findings_chronology_report", status: "draft" as const, audience: "internal" as const, preparedBy: "Analyst", preparedFor: "Review team", reviewerName: "", reviewerApproved: false, currentFingerprint: fingerprint, workspaceFingerprint: fingerprint, confidential: true };
  const first = buildCanonicalReportModel(draft, input);
  const second = buildCanonicalReportModel(draft, input);
  assert.equal(first.contentFingerprint, second.contentFingerprint);
  assert.equal(first.case.type.id, "investigation");
  assert.equal(first.governance.version, "1.0.0");
  assert.equal(first.governance.evidencePack.documents.length, 1);
  assert.equal(first.governance.custody.length, 1);
  assert.doesNotMatch(JSON.stringify(first), /SECRET RAW PROMPT/);
});

test("external and final report gates fail closed until exact saved approval", () => {
  const draft = governedDraft("general_advisory");
  const fingerprint = caseFingerprint(draft);
  const blocked = validateReportReadiness(draft, { profileId: "decision_memorandum", status: "final", audience: "client", preparedBy: "", preparedFor: "", reviewerName: "", reviewerApproved: false, currentFingerprint: fingerprint, workspaceFingerprint: null });
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockers.length >= 5);
  const ready = validateReportReadiness(draft, { profileId: "decision_memorandum", status: "final", audience: "client", preparedBy: "Author", preparedFor: "Client", reviewerName: "Reviewer", reviewerApproved: true, currentFingerprint: fingerprint, workspaceFingerprint: fingerprint });
  assert.equal(ready.ready, true);
});

test("report receipts detect a changed case without storing case content", () => {
  const draft = governedDraft("training_simulation");
  const fingerprint = caseFingerprint(draft);
  const model = buildCanonicalReportModel(draft, { profileId: "facilitator_guide", status: "draft", audience: "internal", preparedBy: "Trainer", preparedFor: "Cohort", reviewerName: "", reviewerApproved: false, currentFingerprint: fingerprint, workspaceFingerprint: fingerprint, confidential: true });
  const receipt = reportReceipt(model, "2026-08-31T12:00:00.000Z");
  assert.equal(isReportReceiptStale(receipt, draft, "facilitator_guide"), false);
  const changed = { ...draft, premise: `${draft.premise} Changed.` };
  assert.equal(isReportReceiptStale(receipt, changed, "facilitator_guide"), true);
  assert.doesNotMatch(JSON.stringify(receipt), /governed professional matter/i);
});
