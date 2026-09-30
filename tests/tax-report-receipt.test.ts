import assert from "node:assert/strict";
import test from "node:test";
import { buildTaxCaseReportArtifacts, TAX_CASE_REPORT_RENDERER_VERSION } from "../app/case-report";
import { parseReportReceipt, reportReceiptStorageKey, type ReportReceiptStorageContext } from "../app/report-model";
import { isTaxReportReceiptStale, parseTaxReportReceipt, readStoredTaxReportReceipt, taxReportReceipt, taxReportReceiptStorageKey, writeStoredTaxReportReceipt, type TaxReportReceiptV3 } from "../app/tax-report-receipt";
import { loadNodeTaxRuntime } from "../app/tax-runtime/node";
import { attach, reportFixture, reportOptions } from "./helpers/tax-report-fixture";

const timestamp = "2026-09-30T12:00:00.000Z";
const scope = "a".repeat(64);
async function artifacts() {
  const { draft } = await reportFixture();
  return buildTaxCaseReportArtifacts(draft, reportOptions(draft), loadNodeTaxRuntime);
}
function storage() {
  const values = new Map<string, string>();
  let reads = 0, writes = 0;
  return { values, get reads() { return reads; }, get writes() { return writes; },
    getItem(key: string) { reads++; return values.get(key) ?? null; },
    setItem(key: string, value: string) { writes++; values.set(key, value); },
  };
}
function context(receipt: TaxReportReceiptV3): ReportReceiptStorageContext { return { scope, eligible: true, caseId: receipt.caseId, profileId: receipt.profileId }; }

test("v3 receipt binds fresh report identities without private source, money or raw originals", async () => {
  const current = await artifacts(), receipt = taxReportReceipt(current, timestamp);
  assert.equal(receipt.receiptSchemaVersion, 3);
  assert.equal(receipt.rendererVersion, TAX_CASE_REPORT_RENDERER_VERSION);
  assert.equal(receipt.tax.evidenceFingerprint, current.taxModel.evidenceFingerprint);
  assert.deepEqual(receipt.tax.context, current.taxModel.binding.context);
  assert.deepEqual(receipt.tax.versions, current.taxModel.binding.versions);
  assert.equal(receipt.tax.attachmentDigest, current.taxModel.binding.attachmentDigest);
  assert.equal(receipt.tax.inputHash, current.taxModel.binding.inputHash);
  assert.equal(receipt.tax.bindingHash, current.taxModel.binding.bindingHash);
  assert.equal(receipt.layoutFingerprint, current.layoutModel.layoutFingerprint);
  assert.equal(receipt.reportFingerprint, current.reportModel.contentFingerprint);
  assert.equal(receipt.presentationFingerprint, current.presentationFingerprint);
  assert.ok(Object.isFrozen(receipt) && Object.isFrozen(receipt.tax.versions));
  const encoded = JSON.stringify(receipt), parsed = parseTaxReportReceipt(encoded);
  assert.equal(parsed.status, "known");
  if (parsed.status === "known") assert.deepEqual(parsed.receipt, receipt);
  for (const secret of ["normalized_request", '"draft"' + ':', "original_json", "POISON", "future-preserved", "25000000", "50,000.00"]) assert.ok(!encoded.includes(secret), secret);
  assert.equal(parseReportReceipt(encoded), null, "v3 never passes as the old v2 receipt");
  assert.equal(isTaxReportReceiptStale(receipt, current), false);
  assert.throws(() => taxReportReceipt(current, "2026-09-30"));
});

test("strict parser rejects missing/coerced/ambiguous identities and preserves future fields/versions verbatim", async () => {
  const receipt = taxReportReceipt(await artifacts(), timestamp);
  for (const mutate of [
    (value: Record<string, unknown>) => { delete value.presentationFingerprint; },
    (value: Record<string, unknown>) => { value.status = ["draft"]; },
    (value: Record<string, unknown>) => { value.audience = ["internal"]; },
    (value: Record<string, unknown>) => { value.generatedAt = "2026-02-30T12:00:00.000Z"; },
    (value: Record<string, unknown>) => { value.caseFingerprint = "unhashed"; },
  ]) {
    const value = structuredClone(receipt) as unknown as Record<string, unknown>; mutate(value);
    assert.equal(parseTaxReportReceipt(JSON.stringify(value)).status, "corrupt");
  }
  const duplicate = JSON.stringify(receipt).replace('"receiptSchemaVersion":3', '"receiptSchemaVersion":3,"receiptSchemaVersion":3');
  assert.equal(parseTaxReportReceipt(duplicate).status, "corrupt");
  for (const value of [
    { ...receipt, receiptSchemaVersion: 99, preserved: 1 },
    { ...receipt, unknown: { amount: "18446744073709551617" } },
    { ...receipt, tax: { ...receipt.tax, future: true } },
    { ...receipt, tax: { ...receipt.tax, versions: { ...receipt.tax.versions, calculation_version: "future" } } },
    { ...receipt, layoutAlgorithmVersion: "future" },
    { ...receipt, rendererVersion: "web-tax-pdf-v99" },
  ]) {
    const rawText = "  " + JSON.stringify(value, null, "\t") + "\r\n", parsed = parseTaxReportReceipt(rawText);
    assert.equal(parsed.status, "unsupported");
    assert.equal(parsed.rawText, rawText);
  }
  for (const tax of [
    { ...receipt.tax, context: { ...receipt.tax.context, case_id: "another_case" } },
    { ...receipt.tax, context: { ...receipt.tax.context, revision: "18446744073709551616" } },
    { ...receipt.tax, context: { ...receipt.tax.context, revision: 1 } },
    { ...receipt.tax, context: { ...receipt.tax.context, artifact_id: "\ud800" } },
    { ...receipt.tax, context: { ...receipt.tax.context, artifact_id: "é".repeat(65) } },
    { ...receipt.tax, sourceFingerprint: "b".repeat(64) },
  ]) assert.equal(parseTaxReportReceipt(JSON.stringify({ ...receipt, tax })).status, "corrupt");
  assert.equal(parseTaxReportReceipt(JSON.stringify({ ...receipt, tax: { ...receipt.tax, context: { ...receipt.tax.context, revision: "18446744073709551615", artifact_id: "\uFEFFvalid_id" } } })).status, "known");
});

test("freshness binds complete tax identity and every rendered report/layout/presentation version", async () => {
  const current = await artifacts(), receipt = taxReportReceipt(current, timestamp);
  for (const patch of [
    { reportFingerprint: `sha256-${"b".repeat(64)}` }, { layoutFingerprint: `sha256-${"b".repeat(64)}` },
    { presentationFingerprint: `sha256-${"b".repeat(64)}` }, { rendererVersion: "future" },
    { tax: { ...receipt.tax, attachmentDigest: `sha256-${"b".repeat(64)}` } },
    { tax: { ...receipt.tax, evidenceFingerprint: `sha256-${"b".repeat(64)}` } },
    { tax: { ...receipt.tax, context: { ...receipt.tax.context, revision: "99" } } },
    { tax: { ...receipt.tax, versions: { ...receipt.tax.versions, result_schema: "future" } } },
    { tax: { ...receipt.tax, inputHash: "b".repeat(64) } },
  ]) assert.equal(isTaxReportReceiptStale({ ...receipt, ...patch } as TaxReportReceiptV3, current), true);
  assert.equal(isTaxReportReceiptStale({ ...receipt, generatedAt: "2026-09-30T13:00:00.000Z" }, current), false, "generation time is a receipt event, not semantic financial identity");
  const { draft, document } = await reportFixture();
  document.edit.baseline_annual_tax_cost = "250001.00"; attach(draft, document);
  const changed = await buildTaxCaseReportArtifacts(draft, reportOptions(draft), loadNodeTaxRuntime);
  assert.equal(changed.taxModel.binding.context.revision, receipt.tax.context.revision);
  assert.equal(isTaxReportReceiptStale(receipt, changed), true, "same artifact revision cannot hide changed raw edits");
});

test("separate scoped device slot uses captured generation and leaves v1/v2 and other accounts untouched", async () => {
  const receipt = taxReportReceipt(await artifacts(), timestamp), saved = storage(), ctx = context(receipt);
  const key = taxReportReceiptStorageKey(scope, receipt.caseId, receipt.profileId);
  const old = reportReceiptStorageKey(scope, receipt.caseId, receipt.profileId), other = taxReportReceiptStorageKey("b".repeat(64), receipt.caseId, receipt.profileId);
  saved.values.set(old, "old v2 bytes"); saved.values.set(other, "other account bytes");
  const before = readStoredTaxReportReceipt(saved, ctx);
  assert.deepEqual(before, { status: "absent", rawText: null });
  assert.deepEqual(writeStoredTaxReportReceipt(saved, ctx, receipt, null), { status: "saved" });
  const first = readStoredTaxReportReceipt(saved, ctx);
  assert.equal(first.status, "known");
  if (first.status !== "known") assert.fail(JSON.stringify(first));
  const next = { ...receipt, generatedAt: "2026-09-30T13:00:00.000Z" };
  assert.equal(writeStoredTaxReportReceipt(saved, ctx, next, null).status, "conflict");
  assert.equal(saved.values.get(key), first.rawText);
  assert.equal(writeStoredTaxReportReceipt(saved, ctx, next, first.rawText).status, "saved");
  assert.equal(saved.values.get(old), "old v2 bytes"); assert.equal(saved.values.get(other), "other account bytes");
  assert.equal(writeStoredTaxReportReceipt(saved, { ...ctx, caseId: "wrong_case" }, receipt, null).status, "denied");
});

test("unknown/corrupt device bytes remain exact even with matching precondition and denied reads disclose nothing", async () => {
  const receipt = taxReportReceipt(await artifacts(), timestamp), saved = storage(), ctx = context(receipt);
  const key = taxReportReceiptStorageKey(scope, receipt.caseId, receipt.profileId);
  for (const rawText of [
    '\uFEFF {"receiptSchemaVersion":99,"future":18446744073709551617,"rate":1.2300e+0} \r\n',
    '{"receiptSchemaVersion":99,"future":18446744073709551617,"rate":1.2300e+0}', "", "{truncated", " ".repeat(65_537),
    JSON.stringify({ ...receipt, caseId: "other_case", tax: { ...receipt.tax, context: { ...receipt.tax.context, case_id: "other_case" } } }),
  ]) {
    saved.values.set(key, rawText);
    const result = readStoredTaxReportReceipt(saved, ctx);
    assert.ok(result.status === "unsupported" || result.status === "corrupt");
    if (result.status === "unsupported" || result.status === "corrupt") assert.equal(result.rawText, rawText);
    assert.equal(writeStoredTaxReportReceipt(saved, ctx, receipt, rawText).status, "preserved");
    assert.equal(saved.values.get(key), rawText);
  }
  const reads = saved.reads, writes = saved.writes;
  for (const denied of [{ ...ctx, eligible: false }, { ...ctx, scope: null }, { ...ctx, scope: "invalid" }]) {
    const result = readStoredTaxReportReceipt(saved, denied);
    assert.equal(result.status, "denied"); assert.ok(!Object.hasOwn(result, "rawText"));
    assert.equal(writeStoredTaxReportReceipt(saved, denied, receipt, null).status, "denied");
  }
  assert.equal(saved.reads, reads); assert.equal(saved.writes, writes);
});

test("storage failures are unavailable rather than empty, and receipt payload freezes before storage callbacks", async () => {
  const receipt = taxReportReceipt(await artifacts(), timestamp), ctx = context(receipt);
  const unreadable = { getItem() { throw new Error("read failure"); }, setItem() { assert.fail("must not write after failed read"); } };
  assert.equal(readStoredTaxReportReceipt(unreadable, ctx).status, "unavailable");
  assert.equal(writeStoredTaxReportReceipt(unreadable, ctx, receipt, null).status, "unavailable");
  assert.equal(writeStoredTaxReportReceipt({ getItem: () => null, setItem() { throw new Error("quota"); } }, ctx, receipt, null).status, "unavailable");
  const mutable = structuredClone(receipt) as { -readonly [P in keyof TaxReportReceiptV3]: TaxReportReceiptV3[P] };
  const values = new Map<string, string>();
  const callbackStorage = { getItem(key: string) { mutable.generatedAt = "2030-01-01T00:00:00.000Z"; return values.get(key) ?? null; }, setItem(key: string, value: string) { values.set(key, value); } };
  assert.equal(writeStoredTaxReportReceipt(callbackStorage, ctx, mutable, null).status, "saved");
  const raw = values.get(taxReportReceiptStorageKey(scope, receipt.caseId, receipt.profileId))!;
  assert.equal(JSON.parse(raw).generatedAt, timestamp);
});
