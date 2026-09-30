import assert from "node:assert/strict";
import test from "node:test";
import { readStudioPromptFile, studioImportFileKind, studioPromptFileError } from "../app/studio-prompt-file";
import { STUDIO_PROMPT_CHARACTER_LIMIT } from "../app/studio-prompt-limit";

test("file selection distinguishes a case from a prompt without treating JSON as text", () => {
  assert.equal(studioImportFileKind({ name: "CASE.JSON", type: "text/plain" }), "case");
  assert.equal(studioImportFileKind({ name: "case.md", type: "application/json" }), "prompt");
  assert.equal(studioImportFileKind({ name: "brief.txt", type: "" }), "prompt");
  assert.equal(studioImportFileKind({ name: "upload", type: "application/json" }), "case");
  assert.equal(studioImportFileKind({ name: "report.pdf", type: "application/pdf" }), null);
});

test("prompt files retain their complete original text for explicit canonical review", async () => {
  const value = "# Canonical case\r\n\r\n  Точная формулировка / exact wording  \r\n";
  assert.equal(await readStudioPromptFile(new File([value], "case.md")), value);
  const boundary = "x".repeat(STUDIO_PROMPT_CHARACTER_LIMIT);
  assert.equal(await readStudioPromptFile(new File([boundary], "brief.txt")), boundary);
});

test("canonical original text never silently replaces malformed UTF-8 or drops its leading BOM", async () => {
  const raw = "\ufeff# Exact canonical text\r\n<!-- GENESIS-JURIS-CANONICAL-V99 -->\r\n";
  assert.equal(await readStudioPromptFile(new File([raw], "future.md")), raw);
  const prefix = new TextEncoder().encode("# Canonical text\n");
  await assert.rejects(readStudioPromptFile(new File([prefix, new Uint8Array([0xff])], "invalid.md")), /prompt_file_encoding/);
});

test("empty, over-limit and unreadable prompt files reject before replacement", async () => {
  let read = false;
  await assert.rejects(readStudioPromptFile({ size: STUDIO_PROMPT_CHARACTER_LIMIT * 2 + 1, arrayBuffer: async () => { read = true; return new ArrayBuffer(1); } }), /prompt_file_too_large/);
  assert.equal(read, false);
  await assert.rejects(readStudioPromptFile(new File(["x".repeat(STUDIO_PROMPT_CHARACTER_LIMIT + 1)], "brief.txt")), /prompt_text_too_long/);
  await assert.rejects(readStudioPromptFile(new File([" \r\n\t"], "empty.md")), /prompt_file_empty/);
  await assert.rejects(readStudioPromptFile({ size: 10, arrayBuffer: async () => { throw new Error("read failed"); } }), /read failed/);
});

test("file errors explain recovery in both languages without exposing exception details", () => {
  for (const locale of ["en", "ru"] as const) {
    const message = studioPromptFileError(new Error("private-file-path"), locale);
    assert.doesNotMatch(message, /private-file-path/);
    assert.match(message, locale === "en" ? /retry/ : /повторите/);
  }
});
