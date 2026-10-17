import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../app/JurisApp.tsx', import.meta.url), 'utf8');
function actualReadingView(viewport: { clientWidth: number; scrollTo: (position: unknown) => void } | null, bounds: { width: number; height: number }) {
  const start = source.indexOf('const readGraph = useCallback(');
  assert.ok(start >= 0, 'opening a large map needs a readable viewport controller');
  const controller = source.slice(start, source.indexOf('const fitGraph = useCallback(', start));
  assert.doesNotMatch(controller, /setDraft|recordVisualEdit|layoutStudioNodes|moveNode/);
  const frames: Array<() => void> = [], modes: string[] = [], scales: number[] = [];
  const javascript = ts.transpile(controller, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
  const read = new Function('useCallback', 'window', 'graphViewportRef', 'graphBoundsRef', 'setGraphPresentation', 'setGraphZoom', `${javascript}; return readGraph;`)(
    (callback: () => void) => callback, { requestAnimationFrame: (frame: () => void) => frames.push(frame) },
    { current: viewport }, { current: bounds }, (mode: string) => modes.push(mode), (scale: number) => scales.push(scale),
  ) as () => void;
  return { read, frames, modes, scales };
}

test('actual opening controller keeps tall and wide maps readable without shrinking their height', () => {
  for (const bounds of [{ width: 1285, height: 13802 }, { width: 5000, height: 6000 }, { width: 600, height: 570 }]) {
    for (const clientWidth of [310, 610, 1400]) {
      const scrolls: unknown[] = [], before = JSON.stringify(bounds);
      const actual = actualReadingView({ clientWidth, scrollTo: value => scrolls.push(value) }, bounds);
      actual.read();
      assert.deepEqual(actual.modes, ['detail']); assert.deepEqual(actual.scales, [1]);
      assert.deepEqual(scrolls, [], 'wait until the full-size canvas has rendered');
      while (actual.frames.length) actual.frames.shift()!();
      assert.deepEqual(scrolls, [{ left: Math.max(0, (bounds.width - clientWidth) / 2), top: 0, behavior: 'auto' }]);
      assert.equal(JSON.stringify(bounds), before);
    }
  }
});

test('reading controller tolerates a departed viewport and opening never invokes whole-map Fit', () => {
  const actual = actualReadingView(null, { width: 1285, height: 13802 });
  actual.read(); while (actual.frames.length) actual.frames.shift()!();
  const opening = source.match(/useEffect\(\(\) => \{\s*\/\/ Opening a source[\s\S]*?\}, \[readGraph, graphViewportKey, displayMode, visibleStep\]\);/)?.[0];
  assert.ok(opening); assert.match(opening, /requestAnimationFrame\(readGraph\)/);
  assert.match(opening, /displayMode !== "developer" && visibleStep !== 4/, 'apply the reading position when the graph is actually mounted');
  assert.doesNotMatch(opening, /requestAnimationFrame\(fitGraph\)|setDraft|layoutStudioNodes/);
});
