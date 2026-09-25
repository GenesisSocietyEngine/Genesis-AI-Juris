import { caseFingerprint, casePublicationFingerprint, isRecord, normalizeStudioDraft } from './case-integrity';
import type { StudioDraft } from './types';

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
  return { id: Number(record.id), isPrivate: record.isPrivate, fingerprint, publicationFingerprint, protection: record.protection as StudioDraft['protection'] };
}

export function savedStudioPath(id: number, step = 'run_compare', locale = 'en') {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid saved case');
  return '/studio?' + new URLSearchParams({ view: 'studio', custom_case: String(id), studio_step: step, lang: locale }).toString();
}
