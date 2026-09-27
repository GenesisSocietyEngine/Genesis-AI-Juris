import { caseFingerprint, casePublicationFingerprint, isRecord, normalizeStudioDraft } from './case-integrity';
import type { StudioDraft } from './types';

/** Error responses carry conflict/authentication codes; never discard them based on status. */
export async function readStudioSaveResponse(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

/** A successful HTTP response is not, by itself, proof that this draft was saved. */
export function verifiedStudioSaveReceipt(value: unknown, draft: StudioDraft, action: 'save' | 'submit') {
  if (!isRecord(value) || !isRecord(value.customCase) || !isRecord(value.submission)) return null;
  const record = value.customCase;
  const receipt = value.submission;
  const exact = normalizeStudioDraft(draft);
  const fingerprint = caseFingerprint(exact);
  const publicationFingerprint = casePublicationFingerprint(exact);
  if (!Number.isSafeInteger(record.id) || Number(record.id) <= 0 || !Number.isSafeInteger(receipt.id) || Number(receipt.id) <= 0
    || receipt.customCaseId !== record.id || record.caseId !== exact.caseId || receipt.caseId !== exact.caseId
    || record.currentVersion !== exact.version || receipt.version !== exact.version
    || record.fingerprint !== fingerprint || receipt.fingerprint !== fingerprint
    || record.publicationFingerprint !== publicationFingerprint || receipt.publicationFingerprint !== publicationFingerprint
    || receipt.status !== (action === 'submit' ? 'submitted' : 'draft') || typeof record.isPrivate !== 'boolean') return null;
  const savedAt = typeof receipt.updatedAt === 'string' && Number.isFinite(Date.parse(receipt.updatedAt)) ? receipt.updatedAt : null;
  return { id: Number(record.id), isPrivate: record.isPrivate, fingerprint, publicationFingerprint, savedAt, protection: record.protection as StudioDraft['protection'] };
}

export function savedStudioPath(id: number, step = 'run_compare', locale = 'en', panel: string | null = null) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid saved case');
  const params = new URLSearchParams({ view: 'studio', custom_case: String(id), studio_step: step, lang: locale });
  if (panel === 'overview') params.set('studio_panel', panel);
  return '/studio?' + params.toString();
}
