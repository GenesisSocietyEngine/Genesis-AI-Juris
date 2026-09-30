import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { caseFingerprint, normalizeStudioDraft } from "../app/case-integrity";
import { buildCaseMarkdown } from "../app/case-markdown";
import { buildStudioCustomCaseExport, buildTaxCanonicalMarkdownPayload, readStudioCanonicalMarkdown, readStudioCustomCaseExport, TAX_CANONICAL_CASE_MARKER } from "../app/studio-tax-export";
import { STUDIO_CASE_BODY_LIMIT } from "../app/studio-envelope";
import type { TaxAttachmentV1 } from "../app/tax-authoring";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/fiveflats-rent-146000.studio-draft.json", import.meta.url), "utf8"));
const source = JSON.parse(readFileSync(new URL("./fixtures/tax-runtime/web-source.json", import.meta.url), "utf8"));
const corpus = JSON.parse(readFileSync(new URL("./fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; response: string }[] };
const prepare = JSON.parse(corpus.cases.find(entry => entry.name === "prepare")!.response);
const fields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const attachment: TaxAttachmentV1 = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({
  schema: "web-tax-authoring-artifact-v1", source: source.descriptor, request: prepare.request,
  edit: Object.fromEntries(fields.map(key => [key, key === "implementation_cost" ? "12." : ""])), bindings: [], benefits: [], required_component_ids: ["missing"], rates_confirmed: false,
  legacy_documents: [' {"large":900719925474099312345,"decimal":1.2300e+0,"escaped":"\\u00e9"} \r\n'], previous_source_documents: ['{"schema":"future","number":18446744073709551617}'], cached_response: '{ "historical": true }',
}, null, "\t") + "\r\n" };
const protection = { kind: "case-protection-v1", copyProtected: true, copyPolicy: "lineage_locked", parentCode: null, currentCode: `sha256-${"a".repeat(64)}`, seal: `hmac-sha256-${"b".repeat(64)}` };
const draft = () => normalizeStudioDraft({ ...structuredClone(fixture), protection, taxAnalysis: attachment });
const exportOptions = { exportedAt: "2026-09-30T16:00:00.000Z", visibility: "private" as const };
const marker = (json: string, version = "V2", fingerprint = `sha256-${"a".repeat(64)}`) => `# Original narrative\r\n<!-- GENESIS-JURIS-CANONICAL-${version}\nfingerprint:${fingerprint}\nencoding:gzip-base64url\npayload:${btoa(String.fromCharCode(...gzipSync(json))).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")}\n-->\r\n`;

test("v5 sealed JSON retains the whole incomplete carrier, core and protection without changing source", () => {
  const input = draft(), before = structuredClone(input);
  const built = buildStudioCustomCaseExport(input, exportOptions);
  assert.equal(built.envelope.schemaVersion, 5);
  assert.equal(built.envelope.case.fingerprint, caseFingerprint(input));
  const read = readStudioCustomCaseExport(built.rawText);
  assert.equal(read.status, "editable");
  if (read.status !== "editable") assert.fail(JSON.stringify(read));
  assert.deepEqual(read.draft.taxAnalysis, attachment);
  assert.deepEqual(read.draft.protection, input.protection);
  assert.equal(read.draft.updatedAt, exportOptions.exportedAt);
  assert.equal(read.requiresSealVerification, true, "syntactically valid fake seal must never become authority");
  assert.deepEqual(input, before);
});

test("legacy v1–v4 non-tax exports retain their existing verifier route; v4 cannot carry v2 tax", () => {
  const input = draft(); delete input.taxAnalysis;
  const built = buildStudioCustomCaseExport(input, exportOptions);
  assert.equal(built.envelope.schemaVersion, 4);
  for (const schemaVersion of [1, 2, 3, 4]) {
    const rawText = JSON.stringify({ ...built.envelope, schemaVersion });
    assert.deepEqual(readStudioCustomCaseExport(rawText), { status: "legacy", rawText });
  }
  const rawText = JSON.stringify({ ...buildStudioCustomCaseExport(draft(), exportOptions).envelope, schemaVersion: 4 });
  assert.equal(readStudioCustomCaseExport(rawText).status, "unsupported");
});

test("v5 tampered identity, core, protection and visibility fail before caller adoption", () => {
  const base = buildStudioCustomCaseExport(draft(), exportOptions).envelope;
  for (const mutate of [
    (value: typeof base) => { value.case.id = "different"; },
    (value: typeof base) => { value.case.parent = { caseId: "different", version: "1.0.0", fingerprint: `sha256-${"a".repeat(64)}` }; },
    (value: typeof base) => { value.core.matter.title = "different"; },
    (value: typeof base) => { value.case.protection = { ...value.case.protection!, seal: `hmac-sha256-${"c".repeat(64)}` }; },
    (value: typeof base) => { Reflect.deleteProperty(value.case, "visibility"); },
  ]) {
    const value = structuredClone(base); mutate(value);
    const rawText = JSON.stringify(value), read = readStudioCustomCaseExport(rawText);
    assert.equal(read.status, "corrupt");
    assert.equal("rawText" in read && read.rawText, rawText);
  }
});

test("future envelopes, carrier extras, duplicate fields and large numeric tokens retain exact original JSON", () => {
  const base = buildStudioCustomCaseExport(draft(), exportOptions).envelope;
  const unknowns = [
    ' {"format":"genesis-juris-custom-case","schemaVersion":99,"future":18446744073709551617} \r\n',
    JSON.stringify({ ...base, future: "unknown" }),
    JSON.stringify({ ...base, case: { ...base.case, future: "unknown" } }),
    JSON.stringify({ ...base, draft: { ...base.draft, taxAnalysis: { ...attachment, carrierVersion: 99 } } }),
    JSON.stringify({ ...base, draft: { ...base.draft, taxAnalysis: { ...attachment, future: "unknown" } } }),
    JSON.stringify(base).replace('"schemaVersion":5', '"schemaVersion":5,"schemaVersion":5'),
    JSON.stringify({ ...base, draft: { ...base.draft, taxAnalysis: { ...attachment, document: attachment.document.replace('"schema": "web-tax-authoring-artifact-v1"', '"schema": "web-tax-authoring-artifact-v1", "future":18446744073709551617') } } }),
  ];
  for (const rawText of unknowns) {
    const read = readStudioCustomCaseExport(rawText);
    assert.ok(read.status === "unsupported" || read.status === "corrupt", JSON.stringify(read));
    assert.equal("rawText" in read && read.rawText, rawText);
  }
});

test("canonical v2 portable payload retains exact attachment and reports historical status in both languages", async () => {
  for (const language of ["en", "ru"] as const) {
    const input = draft(), before = structuredClone(input);
    input.parent = { caseId: "parent_case", version: "1.0.0", fingerprint: `sha256-${"a".repeat(64)}` };
    before.parent = structuredClone(input.parent);
    const built = await buildTaxCanonicalMarkdownPayload(input, { status: "amended", language });
    assert.match(built.marker, new RegExp(TAX_CANONICAL_CASE_MARKER));
    assert.equal(built.draft.parent, null); assert.equal(built.draft.protection, undefined); assert.deepEqual(built.draft.editHistory, []);
    const rawText = `# ${input.title}\n\n${built.notice}\n\n${built.marker}\n`;
    const read = await readStudioCanonicalMarkdown(rawText);
    assert.equal(read.status, "editable");
    if (read.status !== "editable") assert.fail(JSON.stringify(read));
    assert.deepEqual(read.draft.taxAnalysis, attachment);
    assert.equal(read.fingerprint, built.fingerprint); assert.equal(read.language, language); assert.equal(read.documentStatus, "amended");
    assert.match(built.notice, language === "en" ? /historical/ : /историческими/);
    assert.doesNotMatch(built.notice, /50000|NPV|Annualized implementation/);
    assert.deepEqual(input, before);
  }
});

test("existing non-tax v1 Markdown remains delegated while tax-bearing v1 is refused", async () => {
  const legacy = draft(); delete legacy.taxAnalysis;
  const built = await buildCaseMarkdown(legacy, { status: "final", language: "en" });
  assert.deepEqual(await readStudioCanonicalMarkdown(built.markdown), { status: "legacy", rawText: built.markdown });
  const rawText = marker(JSON.stringify({ format: "genesis-juris-canonical-markdown", schemaVersion: 1, fingerprint: `sha256-${"a".repeat(64)}`, status: "final", language: "en", draft: draft() }), "V1");
  assert.equal((await readStudioCanonicalMarkdown(rawText)).status, "unsupported");
});

test("future or ambiguous Markdown retains the full original including compressed unknown numbers", async () => {
  const built = await buildTaxCanonicalMarkdownPayload(draft(), { status: "final", language: "en" });
  const envelope = { format: "genesis-juris-canonical-markdown", schemaVersion: 2, fingerprint: built.fingerprint, status: "final", language: "en", draft: built.draft };
  const rawFiles = [
    marker('{"future":18446744073709551617}', "V99"),
    marker(' {"format":"genesis-juris-canonical-markdown","schemaVersion":99,"future":18446744073709551617} \r\n'),
    marker(JSON.stringify({ ...envelope, future: "unknown" }), "V2", built.fingerprint),
    marker(JSON.stringify(envelope).replace('"schemaVersion":2', '"schemaVersion":2,"schemaVersion":2'), "V2", built.fingerprint),
    marker(JSON.stringify(envelope), "V1", built.fingerprint),
    built.marker + built.marker,
    '<!-- GENESIS-JURIS-CANONICAL-\npayload:opaque-future\n-->',
    '<!-- GENESIS-JURIS-CANONICAL-',
    '<!-- GENESIS-JURIS-CANONICAL-\n-->' + built.marker,
    built.marker.replace("encoding:gzip-base64url", "encoding:gzip-base64url\nencoding:gzip-base64url"),
    built.marker.replace(built.fingerprint, `sha256-${"c".repeat(64)}`),
  ];
  for (const rawText of rawFiles) {
    const read = await readStudioCanonicalMarkdown(rawText);
    assert.ok(read.status === "unsupported" || read.status === "corrupt", JSON.stringify(read));
    assert.equal("rawText" in read && read.rawText, rawText);
  }
  assert.deepEqual(await readStudioCanonicalMarkdown("Ordinary prompt"), { status: "absent" });
});

test("input and gzip expansion bounds preserve raw recovery without throwing or normalizing", async () => {
  const rawJson = " ".repeat(STUDIO_CASE_BODY_LIMIT + 1);
  assert.equal(readStudioCustomCaseExport(rawJson).status, "corrupt");
  assert.equal((await readStudioCanonicalMarkdown(rawJson)).status, "unsupported");
  const bomb = marker(" ".repeat(STUDIO_CASE_BODY_LIMIT + 1));
  assert.ok(bomb.length < 5000);
  const read = await readStudioCanonicalMarkdown(bomb);
  assert.equal(read.status, "corrupt"); assert.equal("rawText" in read && read.rawText, bomb);
  assert.equal((await readStudioCanonicalMarkdown(bomb.replace(/payload:[^\n]+/, "payload:not_base64!"))).status, "corrupt");
});

test("v2 portable lineage is checked before normalization can erase unknown or missing fields", async () => {
  const built = await buildTaxCanonicalMarkdownPayload(draft(), { status: "final", language: "en" });
  const envelope = { format: "genesis-juris-canonical-markdown", schemaVersion: 2, fingerprint: built.fingerprint, status: "final", language: "en", draft: built.draft };
  const candidates = [
    { ...built.draft, parent: { future: "keep me" } },
    { ...built.draft, protection: { kind: "future", unknown: "keep me" } },
    { ...built.draft, protection: null },
    { ...built.draft, editHistory: { future: "keep me" } },
    { ...built.draft, editHistory: [{ future: "keep me" }] },
    Object.fromEntries(Object.entries(built.draft).filter(([key]) => key !== "parent")),
    Object.fromEntries(Object.entries(built.draft).filter(([key]) => key !== "editHistory")),
  ];
  for (const candidate of candidates) {
    const rawText = marker(JSON.stringify({ ...envelope, draft: candidate }), "V2", built.fingerprint);
    const read = await readStudioCanonicalMarkdown(rawText);
    assert.equal(read.status, "corrupt");
    assert.equal("rawText" in read && read.rawText, rawText);
  }
});

test("builders refuse unknown carriers, missing seals and oversized output", async () => {
  const unsealed = draft(); delete unsealed.protection;
  assert.throws(() => buildStudioCustomCaseExport(unsealed, exportOptions), /server-sealed/);
  const future = draft(); future.taxAnalysis = { ...attachment, carrierVersion: 99 } as unknown as TaxAttachmentV1;
  assert.throws(() => buildStudioCustomCaseExport(future, exportOptions), /read-only recovery/);
  await assert.rejects(buildTaxCanonicalMarkdownPayload(future, { status: "final", language: "en" }), /read-only recovery/);
  assert.throws(() => buildStudioCustomCaseExport(draft(), { ...exportOptions, exportedAt: "x".repeat(STUDIO_CASE_BODY_LIMIT) }), /size limit/);
});
