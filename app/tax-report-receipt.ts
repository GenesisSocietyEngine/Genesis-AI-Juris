import type { TaxCaseReportArtifacts } from "./case-report";
import { parsePreservedJson } from "./preserved-json";
import { REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION, REPORT_GRAPH_LAYOUT_RENDERER_VERSION, REPORT_GRAPH_LAYOUT_SCHEMA_VERSION } from "./report-graph-contract";
import type { ReportReceiptStorageContext } from "./report-model";
import { isStudioDeviceScope } from "./studio-device-storage";
import { canonicalWebTaxJson, WEB_TAX_SOURCE_SCHEMA } from "./studio-tax-source";
import { TAX_REPORT_EVIDENCE_SCHEMA, TAX_REPORT_MODEL_SCHEMA, type TaxReportModel, type TaxReportProfileId } from "./tax-report-model";
import { TAX_RUNTIME_CONTRACT } from "./tax-runtime/runtime";

export const TAX_REPORT_RECEIPT_SCHEMA_VERSION = 3 as const;
export type TaxReportReceiptV3 = Readonly<{
  receiptSchemaVersion: typeof TAX_REPORT_RECEIPT_SCHEMA_VERSION;
  caseId: string;
  caseVersion: string;
  profileId: TaxReportProfileId;
  rendererVersion: "web-tax-pdf-v1";
  caseFingerprint: string;
  reportFingerprint: string;
  generatedAt: string;
  status: "draft" | "final";
  audience: "internal" | "client";
  layoutSchemaVersion: typeof REPORT_GRAPH_LAYOUT_SCHEMA_VERSION;
  layoutAlgorithmVersion: typeof REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION;
  layoutRendererVersion: typeof REPORT_GRAPH_LAYOUT_RENDERER_VERSION;
  layoutFingerprint: string;
  presentationFingerprint: string;
  tax: TaxReportModel["binding"] & Readonly<{
    modelSchema: typeof TAX_REPORT_MODEL_SCHEMA;
    evidenceSchema: typeof TAX_REPORT_EVIDENCE_SCHEMA;
    evidenceFingerprint: string;
  }>;
}>;
export type TaxReportReceiptRead =
  | Readonly<{ status: "known"; receipt: TaxReportReceiptV3; rawText: string }>
  | Readonly<{ status: "unsupported" | "corrupt"; rawText: string; reason: string }>;
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const hash = (value: unknown) => typeof value === "string" && /^sha256-[a-f0-9]{64}$/.test(value);
const wireHash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const profile = (value: unknown) => value === "tax_position_memorandum" || value === "economic_assessment";
const timestamp = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const id = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) return false;
  const bytes = new TextEncoder().encode(value);
  return bytes.length <= 128 && new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) === value;
};
const revision = (value: unknown) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && (value.length < 20 || value.length === 20 && value <= "18446744073709551615");
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const keys = {
  receipt: ["receiptSchemaVersion", "caseId", "caseVersion", "profileId", "rendererVersion", "caseFingerprint", "reportFingerprint", "generatedAt", "status", "audience", "layoutSchemaVersion", "layoutAlgorithmVersion", "layoutRendererVersion", "layoutFingerprint", "presentationFingerprint", "tax"],
  tax: ["modelSchema", "evidenceSchema", "evidenceFingerprint", "attachmentDigest", "sourceFingerprint", "context", "versions", "inputHash", "bindingHash"],
  context: ["case_id", "artifact_id", "revision", "scenario_fingerprint"],
  versions: ["carrier", "authoring", "source", "transport_protocol", "input_schema", "result_schema", "calculation_version", "application_policy", "binding_hash_schema"],
} as const;

/** Unknown versions/fields are retained verbatim. A parsed receipt only records
 * an identity claim; it is neither proof of a downloaded file nor authorization.
 * The server must independently reproduce the fresh saved-source binding. */
export function parseTaxReportReceipt(rawText: string): TaxReportReceiptRead {
  const fail = (status: "unsupported" | "corrupt", reason: string): TaxReportReceiptRead => freeze({ status, rawText, reason });
  if (new TextEncoder().encode(rawText).byteLength > 65_536) return fail("unsupported", "The tax receipt exceeds the supported size.");
  let value: unknown;
  try { value = parsePreservedJson(rawText); }
  catch { return fail("corrupt", "The tax receipt contains invalid or ambiguous JSON."); }
  if (!object(value)) return fail("corrupt", "The tax receipt is not an object.");
  if (value.receiptSchemaVersion !== TAX_REPORT_RECEIPT_SCHEMA_VERSION) return fail("unsupported", "The tax receipt version is unsupported.");
  if (!object(value.tax) || !object(value.tax.context) || !object(value.tax.versions)) return fail("corrupt", "The tax receipt binding is missing or malformed.");
  const tax = value.tax, context = tax.context as RecordValue, versions = tax.versions as RecordValue;
  for (const [entry, allowed] of [[value, keys.receipt], [tax, keys.tax], [context, keys.context], [versions, keys.versions]] as const) {
    if (Object.keys(entry).some(key => !(allowed as readonly string[]).includes(key))) return fail("unsupported", "The tax receipt contains unsupported fields.");
    if (Object.keys(entry).length !== allowed.length) return fail("corrupt", "The tax receipt is missing required fields.");
  }
  if (value.rendererVersion !== "web-tax-pdf-v1" || tax.modelSchema !== TAX_REPORT_MODEL_SCHEMA || tax.evidenceSchema !== TAX_REPORT_EVIDENCE_SCHEMA ||
      value.layoutSchemaVersion !== REPORT_GRAPH_LAYOUT_SCHEMA_VERSION || value.layoutAlgorithmVersion !== REPORT_GRAPH_LAYOUT_ALGORITHM_VERSION || value.layoutRendererVersion !== REPORT_GRAPH_LAYOUT_RENDERER_VERSION ||
      versions.carrier !== 1 || versions.authoring !== "web-tax-authoring-artifact-v1" || versions.source !== WEB_TAX_SOURCE_SCHEMA || versions.binding_hash_schema !== "tax-component-bindings-v1" ||
      (["transport_protocol", "input_schema", "result_schema", "calculation_version", "application_policy"] as const).some(key => versions[key] !== TAX_RUNTIME_CONTRACT[key])) return fail("unsupported", "The tax receipt renderer or calculation contract is unsupported.");
  if (!id(value.caseId) || typeof value.caseVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(value.caseVersion) || value.caseVersion.length > 32 || !profile(value.profileId) ||
      !["draft", "final"].includes(value.status as string) || !["internal", "client"].includes(value.audience as string) || !timestamp(value.generatedAt) ||
      ![value.caseFingerprint, value.reportFingerprint, value.layoutFingerprint, value.presentationFingerprint, tax.evidenceFingerprint, tax.attachmentDigest].every(hash) ||
      ![tax.sourceFingerprint, tax.inputHash, tax.bindingHash, context.scenario_fingerprint].every(wireHash) ||
      !id(context.case_id) || !id(context.artifact_id) || !revision(context.revision) || context.case_id !== value.caseId || context.scenario_fingerprint !== tax.sourceFingerprint) return fail("corrupt", "The tax receipt contains an invalid identity or value.");
  return freeze({ status: "known", receipt: value as TaxReportReceiptV3, rawText });
}

/** Call only after the application's authorized output-start action. This pure
 * constructor does not grant permission or assert that a file was completed. */
export function taxReportReceipt(artifacts: TaxCaseReportArtifacts, generatedAt: string): TaxReportReceiptV3 {
  const { reportModel: report, taxModel: tax, layoutModel: layout } = artifacts;
  const value = {
    receiptSchemaVersion: TAX_REPORT_RECEIPT_SCHEMA_VERSION,
    caseId: report.case.id, caseVersion: report.case.version, profileId: report.profile.id,
    rendererVersion: artifacts.taxRendererVersion, caseFingerprint: report.case.fingerprint,
    reportFingerprint: report.contentFingerprint, generatedAt, status: report.publication.status, audience: report.publication.audience,
    layoutSchemaVersion: layout.layoutSchemaVersion, layoutAlgorithmVersion: layout.layoutAlgorithmVersion,
    layoutRendererVersion: layout.layoutRendererVersion, layoutFingerprint: layout.layoutFingerprint,
    presentationFingerprint: artifacts.presentationFingerprint,
    tax: { modelSchema: tax.schema, evidenceSchema: TAX_REPORT_EVIDENCE_SCHEMA, evidenceFingerprint: tax.evidenceFingerprint, ...tax.binding },
  };
  if (report.profile.id !== tax.profileId) throw new Error("Tax report profile binding differs.");
  const parsed = parseTaxReportReceipt(JSON.stringify(value));
  if (parsed.status !== "known") throw new Error("Cannot create a receipt for an unsupported tax report binding.");
  return parsed.receipt;
}

export function isTaxReportReceiptStale(receipt: TaxReportReceiptV3, current: TaxCaseReportArtifacts): boolean {
  try { return canonicalWebTaxJson(receipt) !== canonicalWebTaxJson(taxReportReceipt(current, receipt.generatedAt)); }
  catch { return true; }
}

export type TaxReceiptDeviceStorage = Pick<Storage, "getItem" | "setItem">;
export type TaxReceiptDeviceRead = TaxReportReceiptRead
  | Readonly<{ status: "absent"; rawText: null }>
  | Readonly<{ status: "denied" | "unavailable"; reason: string }>;
export type TaxReceiptDeviceWrite = Readonly<{ status: "saved" }>
  | Readonly<{ status: "denied" | "conflict" | "preserved" | "unavailable"; reason: string }>;
export function taxReportReceiptStorageKey(scope: string, caseId: string, profileId: string) {
  if (!isStudioDeviceScope(scope) || !id(caseId) || !profile(profileId)) throw new Error("Invalid tax receipt storage context.");
  return `genesis-juris-tax-report-receipt:v3:${scope}:${encodeURIComponent(caseId)}:${encodeURIComponent(profileId)}`;
}

/** The caller supplies current privacy/authority eligibility. Denied reads do
 * not touch storage; no legacy/future/corrupt entry is automatically removed. */
export function readStoredTaxReportReceipt(storage: Pick<TaxReceiptDeviceStorage, "getItem">, context: ReportReceiptStorageContext): TaxReceiptDeviceRead {
  if (!context.eligible || !isStudioDeviceScope(context.scope)) return { status: "denied", reason: "Device receipt access is unavailable for this context." };
  try {
    const raw = storage.getItem(taxReportReceiptStorageKey(context.scope, context.caseId, context.profileId));
    if (raw === null) return { status: "absent", rawText: null };
    const parsed = parseTaxReportReceipt(raw);
    if (parsed.status === "known" && (parsed.receipt.caseId !== context.caseId || parsed.receipt.profileId !== context.profileId)) return { status: "corrupt", rawText: raw, reason: "The retained receipt belongs to a different case or profile." };
    return parsed;
  } catch { return { status: "unavailable", reason: "The device receipt could not be read." }; }
}

/** Preserve a changed generation and all unrecognized entries. expectedRawText
 * must come from the caller's earlier scoped read, never a fresh read used to
 * authorize an old pending output. Synchronous same-context ordering only:
 * localStorage offers no cross-tab compare-and-swap transaction. */
export function writeStoredTaxReportReceipt(storage: TaxReceiptDeviceStorage, context: ReportReceiptStorageContext, receipt: TaxReportReceiptV3, expectedRawText: string | null): TaxReceiptDeviceWrite {
  if (!context.eligible || !isStudioDeviceScope(context.scope)) return { status: "denied", reason: "Device receipt persistence is unavailable for this context." };
  try {
    const frozen = parseTaxReportReceipt(JSON.stringify(receipt));
    if (frozen.status !== "known" || frozen.receipt.caseId !== context.caseId || frozen.receipt.profileId !== context.profileId) return { status: "denied", reason: "The receipt does not match its storage context." };
    const key = taxReportReceiptStorageKey(context.scope, context.caseId, context.profileId), current = readStoredTaxReportReceipt(storage, context);
    if (current.status === "denied" || current.status === "unavailable") return current;
    if (current.status === "unsupported" || current.status === "corrupt") return { status: "preserved", reason: "The retained receipt requires recovery before replacement." };
    if (current.status !== "known" && current.status !== "absent") return { status: "unavailable", reason: "The device receipt generation is unavailable." };
    if (current.rawText !== expectedRawText) return { status: "conflict", reason: "Another receipt generation was saved while the report was pending." };
    storage.setItem(key, frozen.rawText);
    if (storage.getItem(key) !== frozen.rawText) return { status: "conflict", reason: "The stored receipt changed before verification." };
    return { status: "saved" };
  } catch { return { status: "unavailable", reason: "The device receipt could not be saved." }; }
}
