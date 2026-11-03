import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { buildConvertedExample } from '../app/converted-examples';
import { deleteStudioNodeKeepingEvidence } from '../app/studio-evidence-operations';
import { fixture, elements, text, button, click, choose, selectEvidence } from './helpers/materials-workflow';

const drain = () => new Promise(done => setTimeout(done, 15));
const applyLabel = (locale: 'en' | 'ru') => locale === 'en' ? 'Apply change' : 'Применить изменение';
async function planned(f: ReturnType<typeof fixture>, mode: 'attach' | 'move' | 'detach' = 'move') {
  let tree = await f.settle();
  selectEvidence(tree, 'QA synthetic evidence A'); tree = f.render();
  selectEvidence(tree, 'QA synthetic evidence B'); tree = f.render();
  if (elements(tree).some(e => e.type === 'option' && e.props.value === mode)) { choose(tree, mode); tree = f.render(); }
  const destination = f.draft.nodes.find(n => n.type === 'outcome')!.id;
  if (mode !== 'detach') { choose(tree, destination); tree = f.render(); }
  return { tree, destination };
}

for (const locale of ['en', 'ru'] as const) for (const mode of ['attach', 'move', 'detach'] as const) test(`${locale}: one explicit ${mode} plan retains evidence and full relation carriers`, async () => {
  const f = fixture(locale);
  try {
    const { tree, destination } = await planned(f, mode), before = structuredClone(f.draft);
    const plan = elements(tree).find(e => e.props['aria-label'] === (locale === 'en' ? 'Evidence change preview' : 'Предпросмотр изменений материалов'));
    assert.ok(plan); assert.ok(text(plan).includes('2')); assert.ok(text(plan).includes(mode === 'detach' ? '90-day' : f.draft.nodes.find(n => n.id === destination)!.title));
    const batch = elements(tree).find(e => e.type === 'fieldset'); assert.ok(batch);
    assert.equal(elements(batch).filter(e => e.type === 'button').length, 2, 'one apply action and clear/cancel');
    assert.equal(elements(batch).filter(e => e.type === 'details')[0].props.open, undefined);
    assert.equal(f.writes.length, 0, 'preview never applies changes');
    click(button(tree, applyLabel(locale))); await drain(); assert.equal(f.writes.length, 1);
    const after = f.writes[0]; assert.deepEqual(after.nodes, before.nodes);
    assert.deepEqual({ ...after, links: before.links }, before, 'all other case carriers stay exact');
    const old = before.links.find(l => l.id === 'qa_a')!;
    if (mode === 'move') assert.deepEqual(after.links.find(l => l.id === old.id), { ...old, to: destination });
    if (mode === 'attach') { assert.deepEqual(after.links.find(l => l.id === old.id), old); assert.equal(after.links.length, before.links.length + 2); }
    if (mode === 'detach') assert.equal(after.links.length, 0);
  } finally { f.close(); }
});

const transitions = {
  node: (f: ReturnType<typeof fixture>) => f.node(f.draft.nodes[0].id),
  locale: (f: ReturnType<typeof fixture>) => f.language('ru'),
  source: (f: ReturnType<typeof fixture>) => f.replace(),
  denial: (f: ReturnType<typeof fixture>) => f.permission(false),
  authorityEpoch: (f: ReturnType<typeof fixture>) => f.permission(true),
};
for (const [name, change] of Object.entries(transitions)) test(`${name}: a pending evidence write cannot complete in a changed context`, async () => {
  const f = fixture(); let release = () => {};
  try {
    const { tree } = await planned(f), before = JSON.stringify(f.draft);
    release = f.hold(); const oldApply = button(tree, 'Apply change').props.onClick as () => void;
    click(button(tree, 'Apply change')); assert.equal(f.verificationCalls, 1);
    change(f); const changed = f.render();
    assert.equal(elements(changed).filter(e => e.type === 'fieldset').length, 0, 'old selection/preview concealed immediately');
    oldApply(); release(); await drain(); assert.equal(f.writes.length, 0); assert.equal(JSON.stringify(f.draft), before);
  } finally { release(); f.close(); }
});

test('cancel and unmount refuse pending writes; clearing a preview does not request authority', async () => {
  for (const unmount of [false, true]) {
    const f = fixture(); let release = () => {};
    try {
      let { tree } = await planned(f);
      if (!unmount) {
        click(button(tree, 'Clear selection')); assert.equal(f.verificationCalls, 0);
        ({ tree } = await planned(f));
      }
      release = f.hold(); click(button(tree, 'Apply change')); tree = f.render();
      if (unmount) f.unmount(); else click(button(tree, 'Cancel'));
      release(); await drain(); assert.equal(f.writes.length, 0); assert.equal(JSON.stringify(f.draft), f.original);
    } finally { release(); f.close(); }
  }
});

test('rapid activation starts one operation; a cancelled completion cannot clear a newer pending operation', async () => {
  const f = fixture(); let releaseOld = () => {}, releaseNew = () => {};
  try {
    let { tree } = await planned(f); releaseOld = f.hold(); const apply = button(tree, 'Apply change');
    click(apply); click(apply); assert.equal(f.verificationCalls, 1);
    tree = f.render(); click(button(tree, 'Cancel')); ({ tree } = await planned(f));
    releaseNew = f.hold(); click(button(tree, 'Apply change')); assert.equal(f.verificationCalls, 2);
    releaseOld(); await drain(); tree = f.render();
    assert.equal(f.writes.length, 0); assert.equal(button(tree, 'Apply change').props.disabled, true);
    releaseNew(); await drain(); assert.equal(f.writes.length, 1);
  } finally { releaseOld(); releaseNew(); f.close(); }
});

test('destination conflicts and stale compare-and-swap refuse atomically without losing carriers', async () => {
  for (const conflict of [true, false]) {
    const f = fixture(); let release = () => {};
    try {
      if (conflict) {
        const destination = f.draft.nodes.find(n => n.type === 'outcome')!.id;
        f.replace({ ...f.draft, links: [...f.draft.links, { id: 'qa_duplicate_destination', from: f.evidenceIds[0], to: destination, rule: { detail: 'Do not merge', guards: [], effects: {} } }] });
      }
      const { tree } = await planned(f); const before = JSON.stringify(f.draft);
      release = f.hold(); click(button(tree, 'Apply change'));
      if (!conflict) f.draft.title += ' — concurrently changed fixture';
      release(); await drain(); assert.equal(f.writes.length, 0);
      if (conflict) { assert.equal(JSON.stringify(f.draft), before); assert.match(text(f.render()), /no link details were merged or removed/); }
    } finally { release(); f.close(); }
  }
});

test('scope changes also cancel file delivery, while an in-scope literal text download remains exact', async () => {
  for (const [name, change] of Object.entries(transitions)) {
    const f = fixture(); let release = () => {};
    try {
      const tree = await f.settle(); release = f.hold();
      click(button(tree, 'Download text: QA synthetic evidence A')); change(f); f.render(); release(); await drain();
      assert.equal(f.downloads.length, 0, name); assert.equal(f.writes.length, 0);
    } finally { release(); f.close(); }
  }
  const f = fixture(); try {
    const tree = await f.settle(); click(button(tree, 'Download text: QA synthetic evidence A')); await drain();
    assert.equal(f.downloads.length, 1); assert.equal(await f.downloads[0].blob.text(), f.draft.nodes.find(n => n.id === f.evidenceIds[0])!.detail);
    assert.equal(f.writes.length, 0, 'download sink is not a save or browser-file observation');
  } finally { f.close(); }
});

test('numeric node prefixes and supported long titles remain inspectable', async () => {
  const f = fixture('ru');
  try {
    const title = 'Длинное синтетическое название — '.repeat(5);
    const node = f.draft.nodes[0]; f.replace({ ...f.draft, nodes: [...f.draft.nodes, ...Array.from({ length: 20 }, (_, i) => ({ ...node, id: 'qa_order_' + i, title: i === 0 ? title : 'QA ' + (20 - i) }))] });
    const { tree } = await planned(f); const select = elements(tree).find(e => e.type === 'select' && e.props['aria-label'] === 'Узел назначения'); assert.ok(select);
    const labels = elements(select).filter(e => e.type === 'option' && e.props.value).map(text);
    const numbers = labels.map(x => Number(x.match(/N(\d+)/)?.[1])); assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b)); assert.ok(labels.some(x => x.includes(title)));
  } finally { f.close(); }
});


test('deleted-node evidence remains in the library for a previewed bulk reattachment', async () => {
  const f = fixture();
  try {
    const bodies = f.draft.nodes.filter(n => f.evidenceIds.includes(n.id));
    f.replace(deleteStudioNodeKeepingEvidence(f.draft, 'conditional-pilot', null)); f.node(undefined);
    const { tree, destination } = await planned(f, 'attach');
    assert.equal(elements(tree).filter(e => e.type === 'option' && ['move','detach'].includes(String(e.props.value))).length, 0);
    click(button(tree, 'Apply change')); await drain(); assert.equal(f.writes.length, 1);
    assert.deepEqual(f.writes[0].nodes.filter(n => f.evidenceIds.includes(n.id)), bodies);
    assert.ok(f.evidenceIds.every(id => f.writes[0].links.some(l => l.from === id && l.to === destination)));
  } finally { f.close(); }
});

test('converted missing originals have no file controls and stay disclosed in the actual ZIP projection', async () => {
  const f = fixture();
  try {
    f.replace(buildConvertedExample('greenfire_first_72_hours','en')); f.node(undefined);
    const tree = await f.settle(); const missing = elements(tree).filter(e => e.type === 'li' && String(e.props['data-material-id']).startsWith('missing:'));
    assert.ok(missing.length > 0);
    for (const row of missing) assert.equal(elements(row).filter(e => e.type === 'button' && String(e.props['aria-label']).startsWith('Download text:')).length, 0);
    click(button(tree,'Download all (.zip)')); await f.settle(()=>f.downloads.length===1); assert.equal(f.downloads.length,1);
    const files=unzipSync(new Uint8Array(await f.downloads[0].blob.arrayBuffer()));
    const manifest=JSON.parse(strFromU8(files['manifest.json']));
    assert.ok(manifest.entries.some((entry:{kind:string;filename:string|null})=>entry.kind==='missing'&&entry.filename===null));
    assert.equal(f.writes.length,0);
  } finally { f.close(); }
});


test('a changed or cleared selection refuses a captured Apply callback without another authority request', async () => {
 const f=fixture();try{
  const {tree}=await planned(f);const stale=button(tree,'Apply change').props.onClick as ()=>void;
  click(button(tree,'Clear selection'));f.render();stale();await drain();
  assert.equal(f.verificationCalls,0);assert.equal(f.writes.length,0);
 }finally{f.close();}
});


test('switching inspected nodes preserves same-case search while discarding the edit selection', async () => {
 const f=fixture();try{
  let {tree}=await planned(f);const search=elements(tree).find(e=>e.type==='input'&&e.props.type==='search')!;
  (search.props.onChange as (event:unknown)=>void)({target:{value:'QA synthetic'}});tree=f.render();
  f.node(f.draft.nodes[0].id);tree=f.render();
  assert.equal(elements(tree).find(e=>e.type==='input'&&e.props.type==='search')!.props.value,'QA synthetic');
  assert.equal(elements(tree).filter(e=>e.type==='fieldset').length,0);assert.equal(f.writes.length,0);
 }finally{f.close();}
});


test('clear/cancel provides a status and a scoped search focus target', async () => {
 const f=fixture();try{
  const {tree}=await planned(f);click(button(tree,'Clear selection'));const cleared=f.render();
  assert.deepEqual(f.focuses,['search','search-scroll']);assert.match(text(cleared),/Selection cleared. No pending change was applied/);
  assert.equal(f.writes.length,0);assert.equal(f.verificationCalls,0);
 }finally{f.close();}
});

test('completed selection cannot be applied a second time by a captured callback before another render', async () => {
 const f=fixture();try{
  const {tree}=await planned(f);const apply=button(tree,'Apply change');click(apply);await drain();
  assert.equal(f.writes.length,1);click(apply);await drain();assert.equal(f.verificationCalls,1);assert.equal(f.writes.length,1);
 }finally{f.close();}
});
