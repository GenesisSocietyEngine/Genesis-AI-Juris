import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanopyPackage } from '../app/canopy-fixture';
import { createExampleWorkingCopy } from '../app/example-working-copy';
import { applyStudioSnapshot, emptyStudioTimeline, recordStudioRevision, snapshotStudioDraft, stepStudioTimeline } from '../app/studio-revisions';

test('node-add undo and redo retain exact source identity and manual map positions', () => {
  const before = createExampleWorkingCopy(buildCanopyPackage('base', true).draft);
  const after = structuredClone(before);
  after.nodes.push({ id: 'actor-dropped', type: 'actor', title: 'Actor', detail: '', x: 268, y: 53, mapPosition: { x: 268, y: 53 } });
  const timeline = recordStudioRevision(emptyStudioTimeline(), before, after, { label: 'Dropped Actor', source: 'visual', createdAt: '2026-10-17T21:00:00Z' });
  const undo = stepStudioTimeline(timeline, 'undo')!;
  const undone = applyStudioSnapshot(after, undo.snapshot, '2026-10-17T21:01:00Z');
  assert.deepEqual(undone.exampleSource, before.exampleSource); assert.deepEqual(undone.nodes, before.nodes);
  const redo = stepStudioTimeline(undo.timeline, 'redo')!;
  const restored = applyStudioSnapshot(undone, redo.snapshot, '2026-10-17T21:02:00Z');
  assert.deepEqual(restored.exampleSource, before.exampleSource);
  assert.deepEqual(restored.nodes, after.nodes); assert.deepEqual(restored.links, before.links);
  assert.equal(restored.caseId, before.caseId); assert.deepEqual(restored.caseType, before.caseType);
  const snapshot = snapshotStudioDraft(after);
  assert.notEqual(snapshot.exampleSource, after.exampleSource, 'the source carrier is detached');
  assert.ok(!Object.hasOwn(snapshot, 'protection') && !Object.hasOwn(snapshot, 'editHistory') && !Object.hasOwn(snapshot, 'updatedAt'));
});

test('legacy snapshots cannot erase a retained reference, and no source is invented for unreferenced cases', () => {
  const draft = createExampleWorkingCopy(buildCanopyPackage('base', true).draft);
  const legacy = snapshotStudioDraft(draft); delete legacy.exampleSource;
  assert.deepEqual(applyStudioSnapshot(draft, legacy, draft.updatedAt).exampleSource, draft.exampleSource);
  const plain = buildCanopyPackage('base', true).draft; delete plain.exampleSource;
  assert.equal(applyStudioSnapshot(plain, snapshotStudioDraft(plain), plain.updatedAt).exampleSource, undefined);
});
