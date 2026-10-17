import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../app/JurisApp.tsx', import.meta.url), 'utf8');
function actualZoom(scale: number, viewport: { clientWidth: number; clientHeight: number; scrollLeft: number; scrollTop: number; scrollTo: (position: unknown) => void } | null) {
  const start = source.indexOf('const changeGraphZoom = useCallback(');
  assert.ok(start >= 0);
  const controller = source.slice(start, source.indexOf('const relationPageSize', start));
  assert.doesNotMatch(controller, /setDraft|recordVisualEdit|moveNode|layoutStudioNodes/);
  const frames: Array<() => void> = [], scales: number[] = [], modes: string[] = [];
  const ref = { current: viewport };
  const js = ts.transpile(controller, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const change = new Function('useCallback', 'window', 'graphViewportRef', 'graphZoom', 'setGraphPresentation', 'setGraphZoom', `${js}; return changeGraphZoom;`)(
    (fn: unknown) => fn, { requestAnimationFrame: (fn: () => void) => frames.push(fn) }, ref, scale,
    (mode: string) => modes.push(mode), (next: number) => scales.push(next),
  ) as (direction: -1 | 1) => void;
  return { change, scales, modes, ref, flush: () => { while (frames.length) frames.shift()!(); } };
}

test('actual zoom handler uses ten percentage points and preserves the visible map centre', () => {
  for (const direction of [-1, 1] as const) {
    for (const width of [269, 610, 1400]) {
      const scrolls: unknown[] = [];
      const viewport = { clientWidth: width, clientHeight: 450, scrollLeft: 350, scrollTop: 9000, scrollTo: (position: unknown) => scrolls.push(position) };
      const actual = actualZoom(1, viewport);
      actual.change(direction);
      const next = direction === 1 ? 1.1 : 0.9;
      assert.deepEqual(actual.scales, [next]); assert.deepEqual(actual.modes, ['detail']);
      assert.deepEqual(scrolls, []);
      actual.flush();
      assert.deepEqual(scrolls, [{ left: Math.max(0, (350 + width / 2) * next - width / 2), top: 9225 * next - 225, behavior: 'auto' }]);
      assert.equal(viewport.scrollTop, 9000, 'does not reposition until the new canvas renders');
    }
  }
});

test('zoom limits, Fit scales and detached windows are handled without source edits', () => {
  const viewport = { clientWidth: 610, clientHeight: 450, scrollLeft: 0, scrollTop: 0, scrollTo: () => {} };
  for (const [scale, direction, expected] of [[0.1, -1, null], [2, 1, null], [0.03, -1, null], [0.03, 1, 0.13], [1.96, 1, 2], [0.15, -1, 0.1], [1.1, -1, 1]] as const) {
    const actual = actualZoom(scale, viewport); actual.change(direction); actual.flush();
    assert.deepEqual(actual.scales, expected === null ? [] : [expected]);
  }
  const absent = actualZoom(1, null); absent.change(1); absent.flush(); assert.deepEqual(absent.scales, []);
  let moved = false;
  const departed = actualZoom(1, { ...viewport, scrollTo: () => { moved = true; } });
  departed.change(1); departed.ref.current = null; departed.flush(); assert.equal(moved, false);
});
