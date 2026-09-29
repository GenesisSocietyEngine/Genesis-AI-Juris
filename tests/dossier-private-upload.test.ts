import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOSSIER_MULTIPART_MAX_BYTES,
  canonicalR2Sha256,
  prepareDossierUpload,
  readBoundedDossierFormData,
} from "../app/dossier-private-upload";

const encoder = new TextEncoder();

test("private upload validation observes exact signatures and computes one canonical digest", async () => {
  const pdf = await prepareDossierUpload({
    originalFilename: "record.pdf",
    browserMediaType: "application/pdf",
    declaredMediaType: "application/pdf",
    bytes: encoder.encode("%PDF-1.7\nsynthetic"),
  });
  assert.equal(pdf.mediaType, "application/pdf");
  assert.equal(pdf.extraction.state, "not_extractable");
  assert.match(pdf.contentSha256, /^sha256-[a-f0-9]{64}$/u);
  assert.equal(canonicalR2Sha256(pdf.checksum), pdf.contentSha256);

  const docx = await prepareDossierUpload({
    originalFilename: "record.docx",
    browserMediaType: "",
    declaredMediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...encoder.encode("[Content_Types].xml word/document.xml"),
    ]),
  });
  assert.equal(
    docx.mediaType,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
});

test("TXT and Markdown extraction is strict, deterministic, and browser-compatible", async () => {
  const markdown = await prepareDossierUpload({
    originalFilename: "notes.md",
    browserMediaType: "text/plain",
    declaredMediaType: "text/markdown",
    bytes: encoder.encode("# Heading\r\nEvidence\r"),
  });
  assert.equal(markdown.extraction.state, "ready_to_extract");
  if (markdown.extraction.state === "ready_to_extract") {
    assert.equal(markdown.extraction.result.text, "# Heading\nEvidence\n");
    assert.equal(markdown.extraction.result.lineEnding, "LF");
  }

  await assert.rejects(
    prepareDossierUpload({
      originalFilename: "notes.txt",
      browserMediaType: "text/plain",
      declaredMediaType: "text/plain",
      bytes: new Uint8Array([0xc3, 0x28]),
    }),
    /strict UTF-8/u,
  );
});

test("extension, signature, browser media, filename, emptiness, and hard bounds fail closed", async () => {
  const cases = [
    prepareDossierUpload({
      originalFilename: "spoof.pdf",
      browserMediaType: "application/pdf",
      declaredMediaType: "application/pdf",
      bytes: encoder.encode("not a pdf"),
    }),
    prepareDossierUpload({
      originalFilename: "../record.txt",
      browserMediaType: "text/plain",
      declaredMediaType: "text/plain",
      bytes: encoder.encode("text"),
    }),
    prepareDossierUpload({
      originalFilename: "record.txt",
      browserMediaType: "application/pdf",
      declaredMediaType: "text/plain",
      bytes: encoder.encode("text"),
    }),
    prepareDossierUpload({
      originalFilename: "record.txt",
      browserMediaType: "text/plain",
      declaredMediaType: "text/plain",
      bytes: new Uint8Array(),
    }),
  ];
  for (const promise of cases) await assert.rejects(promise);
  assert.equal(DOSSIER_MULTIPART_MAX_BYTES, 26 * 1024 * 1024);
});

test("bounded multipart parsing rejects a mismatched Content-Length", async () => {
  const form = new FormData();
  form.set("title", "Synthetic source");
  const encoded = new Request("https://example.test/upload", { method: "POST", body: form });
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  const request = new Request("https://example.test/upload", {
    method: "POST",
    headers: {
      "content-type": encoded.headers.get("content-type")!,
      "content-length": String(bytes.byteLength + 1),
    },
    body: bytes,
  });
  assert.equal(await readBoundedDossierFormData(request), null);
});
