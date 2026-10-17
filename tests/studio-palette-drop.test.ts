import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../app/JurisApp.tsx', import.meta.url), 'utf8');
function actualDrop(options: { scale?: number; allowed?: boolean; count?: number } = {}) {
  const start = source.indexOf('function startPaletteDrag(');
  assert.ok(start >= 0);
  const controller = source.slice(start, source.indexOf('async function autoLayoutGraph(', start));
  const draftRef = { current: { nodes: Array(options.count ?? 65).fill({}) } };
  const dragRef = { current: null as unknown };
  const added: unknown[][] = [], statuses: string[] = [];
  const javascript = ts.transpile(controller, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const handlers = new Function('paletteDragRef', 'canDuplicate', 'draft', 'paletteNodeTypes', 'reportReceiptStorageScope', 'graphZoom', 'addNode', 'setRelationStatus', 'locale', `${javascript}; return {startPaletteDrag,validPaletteDrag,dropPaletteNode};`)(
    dragRef, options.allowed ?? true, draftRef.current, ['fact', 'actor'], 'account-A', options.scale ?? 1,
    (...args: unknown[]) => added.push(args), (value: string) => statuses.push(value), 'en',
  );
  const data: Record<string, string> = {};
  let prevented = 0;
  const event = { preventDefault: () => { prevented++; }, dataTransfer: {
    effectAllowed: '', setData: (type: string, value: string) => { data[type] = value; }, getData: (type: string) => data[type],
  }, clientX: 250, clientY: 400, currentTarget: { clientLeft: 1, clientTop: 1, scrollLeft: 350, scrollTop: 9000, getBoundingClientRect: () => ({ left: 100, top: 200 }) } };
  return { ...handlers, draftRef, dragRef, added, statuses, data, event, prevented: () => prevented };
}

test('actual palette drop converts scrolled and zoomed coordinates and creates one undoable node', () => {
  for (const scale of [0.1, 0.9, 1, 1.1, 2]) {
    const h = actualDrop({ scale }); h.startPaletteDrag(h.event, 'fact'); h.dropPaletteNode(h.event);
    assert.deepEqual(h.added, [['fact', { x: 499 / scale - 82.5, y: 9199 / scale - 48 }, true]]);
    assert.equal(h.dragRef.current, null); assert.equal(h.statuses.length, 1);
    h.dropPaletteNode(h.event); assert.equal(h.added.length, 1, 'a consumed drag cannot add twice');
  }
  const add = source.slice(source.indexOf('function addNode('), source.indexOf('function addLink('));
  assert.match(add, /exactPosition && preferredPosition/);
  assert.match(add, /commitStudioDraft/); assert.match(add, /action: "node_added"/);
  assert.match(add, /mapPosition: \{ x:.*\n?[^}]*y: Math.max\(20, Math.min\(100_000, Math.round\(preferredPosition.y\)\)\)/, 'a drop on a tall map must not clamp back to 5000');
  const key = source.match(/const graphViewportKey = .*;/)?.[0] ?? '';
  assert.doesNotMatch(key, /draft.nodes/, 'adding a node must preserve the current zoom and scroll');
});

test('outside, stale, canceled, protected, invalid and over-limit drags write nothing', () => {
  for (const reason of ['outside', 'stale', 'canceled', 'protected', 'limit', 'type', 'scope', 'payload']) {
    const h = actualDrop({ allowed: reason !== 'protected', count: reason === 'limit' ? 200 : 65 });
    if (reason !== 'outside') h.startPaletteDrag(h.event, reason === 'type' ? 'tax_rule' : 'fact');
    if (reason === 'stale') (h.dragRef.current as { draft: unknown }).draft = { nodes: [] };
    if (reason === 'canceled') h.dragRef.current = null;
    if (reason === 'scope') (h.dragRef.current as { scope: string }).scope = 'account-B';
    if (reason === 'payload') h.data['application/x-casevant-node'] = 'actor';
    h.dropPaletteNode(h.event); assert.deepEqual(h.added, [], reason);
  }
  assert.match(source, /onDragEnd=\{\(\) => \{ paletteDragRef.current = null; \}\}/);
  assert.match(source, /onAdd=\{\(type\) => \{ addNode\(type, visibleGraphCenter\(\), true\)/, 'click and keyboard activation stay available');
});
