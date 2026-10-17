import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStudioDraft, caseFingerprint } from '../app/case-integrity';
import { projectStudioNodes } from '../app/studio-layout';
import { buildCanopyPackage } from '../app/canopy-fixture';

test('manual placement survives normalization and independent reopening without changing historic source bytes', () => {
  const source = buildCanopyPackage('base', true).draft;
  const before = JSON.stringify(source), fingerprint = caseFingerprint(source);
  const baseProjection = projectStudioNodes(source.nodes, source.links, 'vertical', source.nodes);
  const draft = structuredClone(source);
  draft.nodes.push({ id: 'actor-dropped', type: 'actor', title: 'Synthetic dropped actor', detail: '', x: 400, y: 5000, mapPosition: { x: 400, y: 14000 } });
  const normalized = normalizeStudioDraft(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(normalized.nodes.at(-1)?.mapPosition, { x: 400, y: 14000 });
  const reopened = projectStudioNodes(normalized.nodes, normalized.links, 'vertical', normalized.nodes);
  assert.equal(reopened.at(-1)?.x, 400); assert.equal(reopened.at(-1)?.y, 14000);
  assert.deepEqual(reopened.slice(0, -1), baseProjection, 'dropping a disconnected node does not rearrange existing nodes');
  const changed = structuredClone(normalized); changed.nodes.at(-1)!.mapPosition!.y++;
  assert.notEqual(caseFingerprint(changed), caseFingerprint(normalized), 'saved receipts bind exact manual positions');
  assert.equal(JSON.stringify(source), before); assert.equal(caseFingerprint(source), fingerprint);
  assert.ok(source.nodes.every(node => !Object.hasOwn(node, 'mapPosition')), 'legacy data is not backfilled');
});

test('manual placement rejects invalid, nonfinite and excessive coordinates', () => {
  for (const position of [null, {}, { x: 1 }, { x: -1, y: 0 }, { x: 0, y: 100001 }, { x: Infinity, y: 1 }, { x: '1', y: 1 }]) {
    const draft = buildCanopyPackage('base', true).draft;
    Object.assign(draft.nodes[0], { mapPosition: position });
    assert.throws(() => normalizeStudioDraft(draft), /manual map position/);
  }
});
