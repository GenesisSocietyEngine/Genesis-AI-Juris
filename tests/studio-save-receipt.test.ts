import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanopyPackage } from '../app/canopy-fixture';
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from '../app/case-integrity';
import { readStudioSaveResponse, savedStudioPath, verifiedStudioSaveReceipt } from '../app/studio-save-receipt';
import { createStudioAuthContinuation, readStudioAuthContinuation } from '../app/studio-auth-continuation';
import { studioEntry } from '../app/studio-entry';

const draft = normalizeStudioDraft(buildCanopyPackage('base').draft);
test('save response retains server conflict and authentication details without accepting malformed bodies', async () => {
  for (const [status, code] of [[409, 'stale_draft'], [403, 'profile_required']] as const) {
    const payload = { code, error: 'Synthetic save rejection' };
    assert.deepEqual(await readStudioSaveResponse(Response.json(payload, { status })), payload);
  }
  assert.equal(await readStudioSaveResponse(new Response('<html>Unavailable</html>', { status: 503 })), null);
  assert.deepEqual(await readStudioSaveResponse(Response.json(response())), response());
});
function response() {
  const exact = { caseId: draft.caseId, fingerprint: caseFingerprint(draft), publicationFingerprint: casePublicationFingerprint(draft) };
  return { customCase: { ...exact, id: 27, currentVersion: draft.version, isPrivate: false }, submission: { ...exact, id: 51, customCaseId: 27, version: draft.version, status: 'draft' } };
}
test('only a matching durable case and submission receipt confirms the draft', () => {
  assert.equal(verifiedStudioSaveReceipt(response(), draft, 'save')?.id, 27);
  for (const invalid of [{}, { customCase: response().customCase }, { ...response(), submission: { ...response().submission, customCaseId: 28 } }, { ...response(), customCase: { ...response().customCase, id: 0 } }]) assert.equal(verifiedStudioSaveReceipt(invalid, draft, 'save'), null);
  assert.equal(verifiedStudioSaveReceipt(response(), { ...draft, title: 'A different case edit' }, 'save'), null);
  assert.equal(verifiedStudioSaveReceipt(response(), draft, 'submit'), null);
  assert.equal(verifiedStudioSaveReceipt({ ...response(), submission: { ...response().submission, publicationFingerprint: 'mismatch' } }, draft, 'save'), null);
});
test('saved URLs retain exact identity and workflow without content or external destinations', () => {
  assert.equal(savedStudioPath(27, 'run_compare', 'en'), '/studio?view=studio&custom_case=27&studio_step=run_compare&lang=en');
  assert.throws(() => savedStudioPath(-1));
  const overview = new URL(savedStudioPath(27, 'case_map', 'en', 'overview'), 'https://workspace.invalid');
  assert.equal(overview.searchParams.get('studio_panel'), 'overview');
  assert.equal(overview.searchParams.get('custom_case'), '27');
  assert.equal(new URL(savedStudioPath(27, 'case_map', 'en', 'https://foreign.invalid'), 'https://workspace.invalid').searchParams.has('studio_panel'), false);
});

test('save time is taken only from the matched server receipt', () => {
  const payload = response();
  const updatedAt = '2026-09-27T09:00:00.000Z';
  assert.equal(verifiedStudioSaveReceipt({ ...payload, submission: { ...payload.submission, updatedAt } }, draft, 'save')?.savedAt, updatedAt);
  assert.equal(verifiedStudioSaveReceipt({ ...payload, submission: { ...payload.submission, updatedAt: 'invalid' } }, draft, 'save')?.savedAt, null);
  assert.equal(verifiedStudioSaveReceipt(payload, draft, 'save')?.savedAt, null);
});
test('save continuation retains intent, prompt and selection and cannot cross existing account scope', () => {
  const pending = createStudioAuthContinuation({ draft, prompt: 'Review current evidence', selectedNodeId: draft.nodes[1].id, scope: 'account-a', customCaseId: null, isPrivate: false, canDuplicate: true, action: 'save' }, 1000);
  const restored = readStudioAuthContinuation(JSON.stringify(pending), pending.id, 'account-a', 2000)!;
  assert.equal(restored.action, 'save'); assert.equal(restored.prompt, 'Review current evidence'); assert.equal(restored.selectedNodeId, draft.nodes[1].id);
  assert.equal(readStudioAuthContinuation(JSON.stringify(pending), pending.id, 'account-b', 2000), null);
  assert.equal(readStudioAuthContinuation(JSON.stringify({ ...pending, action: 'delete' }), pending.id, 'account-a', 2000), null);
});

test('opening a saved case selects Studio even when the mounted entry was Community', () => {
  const destination = new URL(savedStudioPath(3, 'case_map', 'en'), 'https://workspace.invalid');
  const params = Object.fromEntries(destination.searchParams);
  assert.equal(studioEntry(params, 'community').initialView, 'studio');
  assert.equal(params.custom_case, '3');
  assert.equal(params.studio_step, 'case_map');
  assert.equal(params.lang, 'en');
});
