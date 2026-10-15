import assert from "node:assert/strict";
import test from "node:test";
import { buildConvertedExample, CONVERTED_EXAMPLES } from "../app/converted-examples";
import { caseReviewQuestions, hasProfessionalCaseBrief } from "../app/case-review-questions";
import { createExampleWorkingCopy } from "../app/example-working-copy";
import { buildConvertedSourcePacket } from "../app/converted-source-packet";
import { readStudioAggregate } from "../app/studio-aggregate";
import { buildCaseReportArtifacts, type CaseReportOptions } from "../app/case-report";
import { caseFingerprint } from "../app/case-integrity";
import { primaryCaseOutput } from "../app/case-type-playbooks";

for (const id of Object.keys(CONVERTED_EXAMPLES)) for (const language of ["en", "ru"] as const) test(`${id} ${language}: professional brief is additive, recoverable and does not replace source evidence`, async () => {
  const old = buildConvertedExample(id, language, "2026-10-15T08:00:00.000Z", "2.4.0");
  const current = buildConvertedExample(id, language, "2026-10-15T08:00:00.000Z", "2.5.0");
  assert.deepEqual(current.nodes.slice(0, old.nodes.length), old.nodes);
  assert.deepEqual(current.links.slice(0, old.links.length), old.links);
  assert.equal(current.nodes.length, old.nodes.length + 3);
  assert.equal(hasProfessionalCaseBrief(old), false);
  const questions = caseReviewQuestions(current);
  assert.equal(questions.length, 3);
  for (const question of questions) {
    assert.match(question.detail, language === "en" ? /Fictional review scaffold; no finding, instruction or approval/ : /Вымышленная структура проверки/);
    assert.ok(current.links.some(link => link.from === "brief" && link.to === question.id));
  }
  const oldCopy = createExampleWorkingCopy(old), newCopy = createExampleWorkingCopy(current);
  assert.notEqual(newCopy.caseId, oldCopy.caseId);
  const oldBytes = JSON.stringify(oldCopy);
  const packet = await buildConvertedSourcePacket(newCopy), historical = await buildConvertedSourcePacket(oldCopy);
  assert.ok(packet && historical);
  assert.equal(historical.template.version, "2.4.0");
  assert.equal(packet.template.version, "2.5.0");
  assert.deepEqual(packet.messages.map(m => [m.originalId, m.text, m.contentSha256]), historical.messages.map(m => [m.originalId, m.text, m.contentSha256]));
  assert.deepEqual(packet.missingDocuments, historical.missingDocuments);
  const reopened = readStudioAggregate(JSON.stringify(newCopy), { kind: "draft" });
  assert.equal(reopened.status, "editable");
  if (reopened.status !== "editable") throw new Error("Cannot reopen case");
  assert.deepEqual(caseReviewQuestions(reopened.draft), questions.map(q => ({ ...q, runtime: undefined })));
  assert.equal(caseFingerprint(reopened.draft), caseFingerprint(newCopy));
  const profile = primaryCaseOutput(newCopy.caseType);
  const options: CaseReportOptions = { language, presentationMode: "decision", profileId: profile.id, profileLabel: profile.label[language],
    audience: "internal", confidentiality: "draft", preparedBy: "Synthetic format QA", preparedFor: "", matterReference: "",
    includeEconomics: false, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: false,
    generatedAt: "2026-10-15T08:00:00.000Z", currentFingerprint: caseFingerprint(newCopy), workspaceFingerprint: null,
    currentPublicationFingerprint: "", workspacePublicationFingerprint: null, privateCase: true, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false };
  const text = JSON.stringify(buildCaseReportArtifacts(reopened.draft, options).definition.content);
  for (const question of questions) assert.ok(text.includes(question.title));
  reopened.draft.nodes = reopened.draft.nodes.filter(node => !questions.some(q => q.id === node.id));
  reopened.draft.links = reopened.draft.links.filter(link => !questions.some(q => q.id === link.from || q.id === link.to));
  const removedText = JSON.stringify(buildCaseReportArtifacts(reopened.draft, options).definition.content);
  assert.ok(removedText.includes(language === "en" ? "No professional review questions are recorded" : "Профессиональные вопросы проверки не записаны"));
  for (const question of questions) assert.ok(!removedText.includes(question.title));
  assert.equal(JSON.stringify(oldCopy), oldBytes);
});
