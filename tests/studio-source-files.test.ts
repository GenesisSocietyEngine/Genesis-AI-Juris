import assert from "node:assert/strict";
import test from "node:test";
import { buildCanopyPackage } from "../app/canopy-fixture";
import { attachStudioSource, sourceFiles, MAX_SOURCE_BYTES } from "../app/studio-source-files";
import { readStudioAggregate } from "../app/studio-aggregate";
import { casePublicationFingerprint } from "../app/case-integrity";
import { studioGovernedEvidenceDestination } from "../app/studio-governed-evidence";

test("source file survives private draft save and reopen with original bytes and its own fingerprint", () => {
  const original = buildCanopyPackage("base").draft;
  const file = { name: "source.pdf", data: btoa("%PDF-1.7\n\0\xff") };
  const draft = attachStudioSource(original, file);
  const reopened = readStudioAggregate(JSON.stringify(draft), {kind:"draft"});
  assert.equal(reopened.status, "editable");
  if (reopened.status === "editable") assert.deepEqual(reopened.draft.sourceFiles, [file]);
  assert.notEqual(casePublicationFingerprint(draft), casePublicationFingerprint(original));
  assert.equal(original.sourceFiles, undefined);
  for (const invalid of [{...file, name:"../file.pdf"}, {...file, name:"file.html"}, {...file, data:"!!"}, {...file, data:btoa("a".repeat(MAX_SOURCE_BYTES + 1))}])
    assert.throws(() => sourceFiles([invalid]));
});

test("team document upload uses only a verified originating case or the team picker", () => {
  const from = encodeURIComponent("/matters?organization=red&dossier=case-17");
  const result = studioGovernedEvidenceDestination("/studio?return_to=" + from, "documents");
  assert.equal(result.returning, true);
  const query = new URL(result.href, "https://test.invalid").searchParams;
  assert.deepEqual([query.get("dossier"),query.get("section"),query.get("target")], ["case-17","documents","document-upload"]);
  assert.equal(studioGovernedEvidenceDestination("/studio?organization=other&return_to=" + from, "documents").returning, false);
});

test("template import preserves text and rejects unsupported or oversized material before saving", async () => {
  const { readTemplateText } = await import("../app/casework/read-template-text");
  const text = "Дело {{case.title}}\n{{firm.name}}";
  assert.equal(await readTemplateText(new File([text], "template.txt")), text);
  for (const file of [new File(["bad"],"renamed.docx"),new File(["x".repeat(16001)],"long.txt"),new File(["code"],"script.html")]) {
    await assert.rejects(readTemplateText(file));
  }
});
