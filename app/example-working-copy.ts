import { caseFingerprint, normalizeStudioDraft } from './case-integrity';
import type { StudioDraft } from './types';

/** Source IDs remain pinned; each launch gets a different owner/case database key. */
export function createExampleWorkingCopy(source: StudioDraft, instanceId = crypto.randomUUID()): StudioDraft {
  const reference = normalizeStudioDraft(structuredClone(source));
  const suffix = instanceId.replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('Invalid working-copy identity');
  const copy = structuredClone(reference);
  copy.caseId = 'example_work_' + suffix;
  copy.exampleSource = {format:'casevant-example-source-v1',caseId:reference.caseId,version:reference.version,fingerprint:caseFingerprint(reference)};
  copy.parent = null;
  delete copy.protection;
  return copy;
}
