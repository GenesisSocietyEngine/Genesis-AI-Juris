import { buildTaxCaseReportArtifacts, mayPersistGeneratedReportReceipt, type CaseReportOptions } from "./case-report";
import { freezeStudioDraftSnapshot } from "./studio-aggregate";
import { pdfBlobFromDocument } from "./pdf-blob";
import { startReportDownload } from "./report-download";
import { CASE_REPORT_PDF_FONTS } from "./report-audit-symbols";
import { withLocalChunkRecovery } from "./stale-chunk-recovery";
import { readStoredTaxReportReceipt, taxReportReceipt, writeStoredTaxReportReceipt } from "./tax-report-receipt";
import type { StudioDraft } from "./types";
import type { TaxRuntime } from "./tax-runtime/runtime";

export type TaxReportAuthorization = { canGenerate: boolean; isCurrent: () => boolean; revalidate: () => Promise<void> };
function assertCurrent(authorization: TaxReportAuthorization) {
  if (authorization.canGenerate !== true || !authorization.isCurrent()) throw new Error("Report context is no longer active.");
}
const browserRuntime = async () => (await withLocalChunkRecovery(() => import("./tax-runtime/browser"))).loadBrowserTaxRuntime();

async function render(draft: StudioDraft, options: CaseReportOptions, authorization: TaxReportAuthorization, loadRuntime: () => Promise<TaxRuntime>) {
  assertCurrent(authorization);
  const artifacts = await buildTaxCaseReportArtifacts(draft, options, loadRuntime);
  assertCurrent(authorization);
  const [{ default: pdfMake }, { default: pdfFonts }, { default: auditFont }] = await Promise.all([
    withLocalChunkRecovery(() => import("pdfmake/build/pdfmake.js")),
    withLocalChunkRecovery(() => import("pdfmake/build/vfs_fonts.js")),
    withLocalChunkRecovery(() => import("./report-audit-symbol-font.v1.json")),
  ]);
  assertCurrent(authorization);
  (pdfMake as unknown as { addVirtualFileSystem: (fonts: unknown) => void }).addVirtualFileSystem({ ...pdfFonts, ...auditFont.vfs });
  const blob = await pdfBlobFromDocument(pdfMake.createPdf(artifacts.definition, undefined, CASE_REPORT_PDF_FONTS));
  assertCurrent(authorization);
  await authorization.revalidate();
  assertCurrent(authorization);
  return { blob, artifacts };
}

/** Each preview recalculates the current frozen inputs. It has no receipt or
 * persistence side effect. The caller must fence edits, navigation and access. */
export async function createTaxCaseReportPreview(draft: StudioDraft, options: CaseReportOptions, authorization: TaxReportAuthorization, loadRuntime = browserRuntime) {
  const frozenDraft = freezeStudioDraftSnapshot(draft), frozenOptions = structuredClone(options);
  return render(frozenDraft, frozenOptions, authorization, loadRuntime);
}

export async function downloadTaxCaseReport(draft: StudioDraft, options: CaseReportOptions, authorization: TaxReportAuthorization, loadRuntime = browserRuntime) {
  assertCurrent(authorization);
  const frozenDraft = freezeStudioDraftSnapshot(draft), frozenOptions = structuredClone(options);
  const context = { scope: frozenOptions.reportReceiptStorageScope, eligible: mayPersistGeneratedReportReceipt(frozenDraft, frozenOptions), caseId: frozenDraft.caseId, profileId: frozenOptions.profileId };
  let storage: Storage | null = null;
  try { if (context.eligible && typeof window !== "undefined") storage = window.localStorage; } catch { /* Optional storage may be unavailable. */ }
  const prior = storage ? readStoredTaxReportReceipt(storage, context) : null;
  const { blob, artifacts } = await render(frozenDraft, frozenOptions, authorization, loadRuntime);
  // Validate before starting output, but never expose/retain the receipt unless
  // the authorized download-start action succeeds.
  const receipt = taxReportReceipt(artifacts, frozenOptions.generatedAt);
  assertCurrent(authorization);
  startReportDownload(blob, `${frozenDraft.caseId}-v${frozenDraft.version}-${frozenOptions.profileId}-${frozenOptions.audience}.pdf`);
  assertCurrent(authorization);
  const persistence = storage && prior && (prior.status === "known" || prior.status === "absent")
    ? writeStoredTaxReportReceipt(storage, context, receipt, prior.rawText)
    : { status: "preserved" as const };
  return { receipt, artifacts, persistence };
}
