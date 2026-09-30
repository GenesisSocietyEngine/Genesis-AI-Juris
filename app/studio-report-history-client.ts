import { canonicalFingerprint } from "./case-integrity";
import type { CaseReportOptions } from "./case-report";
import { parseStudioReportHistoryRecord, type StudioHistoryReceipt } from "./studio-report-history";
import { canonicalWebTaxJson } from "./studio-tax-source";

/** No automatic retry: a timeout may occur after the idempotent server write. */
export async function recordStudioReportHistory(
  customCaseId: number, expectedScope: string, receipt: StudioHistoryReceipt, options: CaseReportOptions,
  transport: typeof fetch = fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport("/api/custom-cases/report-receipts", {
      method: "POST", cache: "no-store", signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customCaseId, expectedScope, receipt, options: { ...options, generatedAt: receipt.generatedAt, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false } }),
    });
    if (!response.ok) throw new Error("Account receipt was not confirmed.");
    const payload: unknown = await response.json();
    const record = payload && typeof payload === "object" && "record" in payload ? parseStudioReportHistoryRecord(payload.record) : null;
    if (!record || (receipt.receiptSchemaVersion === 3
      ? canonicalWebTaxJson(record.receipt) !== canonicalWebTaxJson(receipt)
      : canonicalFingerprint(record.receipt) !== canonicalFingerprint(receipt))) throw new Error("Account receipt did not match this export.");
    return record;
  } finally { clearTimeout(timer); }
}
