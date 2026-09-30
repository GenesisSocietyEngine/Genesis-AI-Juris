import { parseReportReceipt, type ReportReceiptV2 } from "./report-model";
import { parseTaxReportReceipt, type TaxReportReceiptV3 } from "./tax-report-receipt";

export type StudioHistoryReceipt = ReportReceiptV2 | TaxReportReceiptV3;

export type StudioReportHistoryRecord = {
  id: number;
  recordedAt: string;
  event: "client_report_download_started";
  receipt: StudioHistoryReceipt;
  format: { presentationMode: "decision" | "medium" | "full"; includeDecisionTree: boolean };
};
export type StudioReportHistoryPage = { receipts: StudioReportHistoryRecord[]; nextCursor: string | null };

export function strictHistoryObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).every(key => keys.includes(key));
}
export function historyTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
const RECEIPT_KEYS = ["receiptSchemaVersion", "caseId", "caseVersion", "profileId", "rendererVersion", "caseFingerprint", "reportFingerprint", "generatedAt", "status", "audience", "layoutSchemaVersion", "layoutAlgorithmVersion", "layoutRendererVersion", "layoutFingerprint", "presentationFingerprint"];
export function parseStudioHistoryReceipt(value: unknown): StudioHistoryReceipt | null {
  if (value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).receiptSchemaVersion === 3) {
    try {
      const parsed = parseTaxReportReceipt(JSON.stringify(value));
      return parsed.status === "known" ? parsed.receipt : null;
    } catch { return null; }
  }
  if (!strictHistoryObject(value, RECEIPT_KEYS) || Object.keys(value).length !== RECEIPT_KEYS.length
    || value.receiptSchemaVersion !== 2 || !historyTimestamp(value.generatedAt)
    || typeof value.caseId !== "string" || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value.caseId) || value.caseId.length > 128
    || typeof value.caseVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(value.caseVersion) || value.caseVersion.length > 32
    || typeof value.profileId !== "string" || !/^[a-z0-9_-]{1,128}$/.test(value.profileId)
    || ![value.rendererVersion, value.layoutAlgorithmVersion, value.layoutRendererVersion].every(item => typeof item === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(item))
    || !Number.isSafeInteger(value.layoutSchemaVersion) || Number(value.layoutSchemaVersion) < 1
    || typeof value.presentationFingerprint !== "string" || !/^sha256-[a-f0-9]{64}$/.test(value.presentationFingerprint)) return null;
  const receipt = parseReportReceipt(JSON.stringify(value));
  return receipt?.receiptSchemaVersion === 2 ? receipt : null;
}
export function parseStudioReportHistoryRecord(value: unknown): StudioReportHistoryRecord | null {
  if (!strictHistoryObject(value, ["id", "recordedAt", "event", "receipt", "format"])
    || !Number.isSafeInteger(value.id) || Number(value.id) <= 0 || !historyTimestamp(value.recordedAt)
    || value.event !== "client_report_download_started"
    || !strictHistoryObject(value.format, ["presentationMode", "includeDecisionTree"])
    || !["decision", "medium", "full"].includes(String(value.format.presentationMode))
    || typeof value.format.includeDecisionTree !== "boolean"
    || value.format.presentationMode === "medium" && !value.format.includeDecisionTree) return null;
  const receipt = parseStudioHistoryReceipt(value.receipt);
  if (!receipt) return null;
  return { id: Number(value.id), recordedAt: value.recordedAt, event: value.event, receipt,
    format: { presentationMode: value.format.presentationMode as "decision" | "medium" | "full", includeDecisionTree: value.format.includeDecisionTree } };
}
export function parseStudioReportHistoryPage(value: unknown): StudioReportHistoryPage | null {
  if (!strictHistoryObject(value, ["receipts", "nextCursor"]) || !Array.isArray(value.receipts) || value.receipts.length > 50
    || !(value.nextCursor === null || typeof value.nextCursor === "string" && /^[1-9]\d{0,15}$/.test(value.nextCursor) && Number.isSafeInteger(Number(value.nextCursor)))) return null;
  const receipts = value.receipts.map(parseStudioReportHistoryRecord);
  if (receipts.some(item => !item)) return null;
  const records = receipts as StudioReportHistoryRecord[];
  if (records.some((item, index) => index > 0 && item.id >= records[index - 1].id)
    || value.nextCursor !== null && value.nextCursor !== String(records.at(-1)?.id)) return null;
  return { receipts: records, nextCursor: value.nextCursor as string | null };
}
