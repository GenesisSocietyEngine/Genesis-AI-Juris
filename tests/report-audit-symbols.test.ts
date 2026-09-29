import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { buildCaseReportArtifacts, createCaseReportPreview, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint, casePublicationFingerprint } from "../app/case-integrity";
import { caseTypeReference } from "../app/case-type-reference";
import { primaryCaseOutput } from "../app/case-type-playbooks";
import { deleteStudioLink, appendStudioHistory } from "../app/studio-editing";
import { applyStudioSnapshot, emptyStudioTimeline, recordStudioRevision, stepStudioTimeline } from "../app/studio-revisions";
import { REPORT_AUDIT_SYMBOL_FONT_SHA256, reportAuditText } from "../app/report-audit-symbols";
import auditFont from "../app/report-audit-symbol-font.v1.json";
import { ReportGraphLayoutError } from "../app/report-graph-layout";
import type { StudioDraft } from "../app/types";

const createdAt = "2026-09-12T12:00:00.000Z";
const boundary: StudioDraft = {
  caseId: "the_missing_boundary", version: "1.0.0", parent: null,
  caseType: caseTypeReference("training_simulation"),
  title: "The Missing Boundary", jurisdiction: "UK · Planning", role: "Project counsel",
  premise: "A consultation map omitted two households before a permit hearing.",
  premisePublication: "author-reviewed", updatedAt: createdAt,
  classification: { practiceArea: "Planning & regulatory", difficulty: "Intermediate", tags: ["evidence", "regulatory", "deadline"], taxTopics: [], complianceOnly: true },
  nodes: [
    { id: "trigger-1", type: "trigger", title: "Omitted households discovered", detail: "The consultation map excluded two addresses.", x: 50, y: 220 },
    { id: "actor-1", type: "actor", title: "Planning authority", detail: "Requests a corrected record within 36 hours.", x: 270, y: 70 },
    { id: "evidence-1", type: "evidence", title: "Map revision history", detail: "GIS exports, contractor instructions and approval log.", x: 270, y: 270 },
    { id: "deadline-1", type: "deadline", title: "36-hour correction window", detail: "Before the permit hearing bundle closes.", x: 490, y: 80 },
    { id: "decision-1", type: "decision", title: "Correct or adjourn", detail: "Choose a corrected filing or seek an adjournment.", x: 510, y: 300 },
    { id: "outcome-1", type: "outcome", title: "Credible corrected process", detail: "The record is repaired and participation restored.", x: 750, y: 180 },
    { id: "outcome-2", type: "outcome", title: "Compromised permit position", detail: "The omission undermines procedural confidence.", x: 750, y: 390 },
  ],
  links: [
    ["trigger-1", "actor-1"], ["trigger-1", "evidence-1"], ["actor-1", "deadline-1"],
    ["evidence-1", "decision-1"], ["deadline-1", "decision-1"],
    ["decision-1", "outcome-1"], ["decision-1", "outcome-2"],
  ].map(([from, to], index) => ({ id: `link-${index + 1}`, from, to })),
  editHistory: [],
};

function reportOptions(draft: StudioDraft, language: "en" | "ru"): CaseReportOptions {
  const output = primaryCaseOutput(draft.caseType);
  return {
    language, profileId: output.id, profileLabel: output.label[language],
    audience: "internal", confidentiality: "draft", preparedBy: "", preparedFor: "", matterReference: "",
    status: "draft", includeEconomics: true, includeRegisters: true, includeSources: true,
    includeAuditTrail: true, includeTechnicalIds: false, generatedAt: createdAt,
    currentFingerprint: caseFingerprint(draft), workspaceFingerprint: null,
    currentPublicationFingerprint: casePublicationFingerprint(draft), workspacePublicationFingerprint: null,
    privateCase: false, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
  };
}

test("Missing Boundary previews after deleting and undoing an edge, preserving the audit arrow in EN/RU", async () => {
  for (const language of ["en", "ru"] as const) {
    const message = language === "en"
      ? "Visual edit: deleted relation “Omitted households discovered” → “Planning authority”."
      : "Визуальная правка: удалена связь «Omitted households discovered» → «Planning authority».";
    const removed = deleteStudioLink(boundary, boundary.links[0], {
      role: "studio", source: "visual", action: "link_deleted", message,
    }, createdAt);
    assert.equal(removed.changed, true);
    const timeline = recordStudioRevision(emptyStudioTimeline(), boundary, removed.draft, { label: message, source: "visual", createdAt });
    const undo = stepStudioTimeline(timeline, "undo") ?? assert.fail("Missing undo snapshot");
    const restored = appendStudioHistory(applyStudioSnapshot(removed.draft, undo.snapshot, createdAt), {
      role: "studio", source: "visual", action: "undo_applied", message: `Undo: ${undo.revision.label}`,
    }, createdAt);
    assert.deepEqual(restored.links, boundary.links);
    const original = JSON.stringify(restored);
    const options = reportOptions(restored, language);
    const artifacts = buildCaseReportArtifacts(restored, options);
    const pdf = await createCaseReportPreview(restored, options, { canGenerate: true });
    assert.match(Buffer.from(await pdf.arrayBuffer()).subarray(0, 8).toString(), /^%PDF-1\./u);
    assert.ok(pdf.size > 10_000);
    assert.match(JSON.stringify(artifacts.definition.content), /ReportAuditSymbols/u);
    const split = reportAuditText(message);
    assert.equal(typeof split, "object");
    if (typeof split === "object") {
      assert.equal((split.text as Array<{ text: string }>).map((run) => run.text).join(""), message);
    }
    assert.equal(JSON.stringify(restored), original);
  }
});

test("audit glyph fallback is pinned, embedded and does not relax unsupported evidence or XML checks", () => {
  const bytes = Buffer.from(auditFont.vfs["ReportAuditArrow.ttf"], "base64");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), REPORT_AUDIT_SYMBOL_FONT_SHA256);
  const require = createRequire(import.meta.url);
  const font = require("@foliojs-fork/fontkit").create(bytes) as {
    characterSet: number[]; glyphForCodePoint: (codePoint: number) => { id: number };
  };
  assert.deepEqual(font.characterSet.filter((scalar) => font.glyphForCodePoint(scalar).id !== 0), [0x2192]);
  assert.ok(font.glyphForCodePoint(0x2192).id > 0);
  for (const message of ["Arrow → then unsupported 👩", "Arrow → then control \u0000"]) {
    const unsafe = appendStudioHistory(boundary, { role: "studio", source: "visual", action: "node_updated", message }, createdAt);
    assert.throws(() => buildCaseReportArtifacts(unsafe, reportOptions(unsafe, "en")), ReportGraphLayoutError);
  }
  const graphArrow = { ...boundary, nodes: boundary.nodes.map((node, index) => index ? node : { ...node, detail: "Evidence → remains subject to graph font validation." }) };
  assert.throws(() => buildCaseReportArtifacts(graphArrow, reportOptions(graphArrow, "en")), ReportGraphLayoutError);
});
