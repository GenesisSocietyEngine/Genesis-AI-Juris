import assert from "node:assert/strict";
import test from "node:test";
import { overviewAction } from "../app/matters/overview-action-copy";
import { actionForFinding } from "../app/matters/matter-actions";
import type {
  ReadinessReason,
  SnapshotItem,
} from "../app/matters/matter-view-model";
test("report guidance follows the actual prerequisite, revision and approval role", () => {
  const finding: ReadinessReason = {
    code: "REVIEWER_APPROVAL_MISSING",
    explanation: "Internal record detail",
    relatedObjectType: null,
    relatedObjectId: null,
    deepLink: null,
  };
  const first = actionForFinding(finding, [], [], 7);
  assert.equal(
    overviewAction(first.title, first.target, "en", false),
    "Save the evidence for the report",
  );
  const sealed = {
    sealed: true,
    dossierRevision: 7,
    manifestDigest: "fixture",
  } as SnapshotItem;
  const generate = actionForFinding(finding, [sealed], [], 7);
  assert.equal(
    overviewAction(generate.title, generate.target, "en", false),
    "Generate the report",
  );
  const review = actionForFinding(
    { ...finding, relatedObjectId: "out" },
    [],
    [],
    7,
  );
  assert.equal(
    overviewAction(review.title, review.target, "en", false),
    "Ask a reviewer to approve the report",
  );
  assert.equal(
    overviewAction(review.title, review.target, "ru", true),
    "Проверьте отчёт для утверждения",
  );
  assert.equal(
    overviewAction(
      "Review document: Imported Title",
      { destination: "documents", id: "document-1" },
      "ru",
      false,
    ),
    "Проверьте документ — Imported Title",
  );
});
