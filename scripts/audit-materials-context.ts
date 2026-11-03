import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, sep } from 'node:path';
import { fixture, choose, selectEvidence, button, click, elements } from '../tests/helpers/materials-workflow';

const args = process.argv.slice(2);
assert.equal(args.length, 4, 'Use --expected-stale-writes 0|1 --output .artifacts/unique-proof.json');
assert.equal(args[0], '--expected-stale-writes'); assert.match(args[1], /^[01]$/); assert.equal(args[2], '--output');
const output = resolve(args[3]);
assert.ok(output.startsWith(resolve('.artifacts') + sep), 'Audit output must remain in workspace .artifacts');
const sourceRef = process.env.CASEVANT_MATERIALS_TEST_SOURCE_REF;
const component = sourceRef ? execFileSync('git', ['show', sourceRef + ':app/StudioMaterialsWorkspace.tsx']) : readFileSync('app/StudioMaterialsWorkspace.tsx');
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const f = fixture(); let release = () => {};
try {
  let tree = await f.settle();
  selectEvidence(tree, 'QA synthetic evidence A'); tree = f.render();
  selectEvidence(tree, 'QA synthetic evidence B'); tree = f.render();
  if (elements(tree).some(e => e.type === 'option' && e.props.value === 'move')) { choose(tree, 'move'); tree = f.render(); }
  choose(tree, f.draft.nodes.find(n => n.type === 'outcome')!.id); tree = f.render();
  const fieldset = elements(tree).find(e => e.type === 'fieldset'); assert.ok(fieldset);
  const controls = { buttons: elements(fieldset).filter(e => e.type === 'button').length, selects: elements(fieldset).filter(e => e.type === 'select').length };
  const modern = elements(tree).some(e => e.type === 'button' && String(e.props['aria-label']).startsWith('Apply change:'));
  release = f.hold(); click(button(tree, modern ? 'Apply change' : 'Move to node'));
  f.node(f.draft.nodes[0].id); f.render(); release();
  // Authority resumes through microtasks; the evidence handler itself is synchronous thereafter.
  await new Promise(done => setTimeout(done, 20));
  assert.equal(f.writes.length, Number(args[1]), 'Unexpected stale-node behavior');
  if (!f.writes.length) assert.equal(JSON.stringify(f.draft), f.original);
  const result = {
    scope: 'Exact Git component or working source; actual projection/handler, modeled hooks/authority and synthetic data. Not a published old application, browser, API or production-case observation.',
    componentRef: sourceRef ?? 'working-tree', componentSha256: digest(component), controls,
    pendingMoveAfterNodeChangeWrites: f.writes.length, authorityCalls: f.verificationCalls,
    beforeSha256: digest(f.original), afterSha256: digest(JSON.stringify(f.draft)), productionCasesTouched: false,
  };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
} finally { release(); f.close(); }
