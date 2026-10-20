import React, { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StudioMaterialsWorkspace from '../../app/StudioMaterialsWorkspace';
import { buildCanopyPackage } from '../../app/canopy-fixture';
import { createExampleWorkingCopy } from '../../app/example-working-copy';
import { casePublicationFingerprint } from '../../app/case-integrity';

const params = new URL(location.href).searchParams, locale = params.get('lang') === 'ru' ? 'ru' : 'en';
const compact = params.get('layout') !== 'wide';
const initial = createExampleWorkingCopy(buildCanopyPackage('base').draft, 'f'.repeat(32));
const existing = initial.nodes.find(node => node.type === 'evidence');
initial.nodes.push({ ...existing, id: 'qa_second_evidence', title: 'QA synthetic second evidence record', detail: 'QA fixture only. This exact unreviewed text must survive batch attachment and Undo.' });
initial.links.push({ id: 'qa_first_pilot', from: existing.id, to: 'conditional-pilot' }, { id: 'qa_second_pilot', from: 'qa_second_evidence', to: 'conditional-pilot' });
const events = [];
function trace(kind, detail = {}) {
  events.push({ kind, ...detail }); if (events.length > 50) events.shift();
  document.getElementById('trace').textContent = JSON.stringify(events, null, 2);
}
document.addEventListener('click', event => trace('click', { trusted: event.isTrusted, tag: event.target.tagName, label: event.target.getAttribute('aria-label'), text: event.target.tagName === 'BUTTON' ? event.target.textContent : null }), true);

function Fixture() {
  const [draft, setDraft] = useState(initial), [history, setHistory] = useState([]);
  const current = useRef(draft);
  const [allowed, setAllowed] = useState(true), permission = useRef(allowed);
  useLayoutEffect(() => { current.current = draft; permission.current = allowed; }, [draft, allowed]);
  const [nodeId, setNode] = useState('conditional-pilot');
  const authority = { allowed, epoch: allowed ? 0 : 1, verify: async () => { trace('synthetic-verification'); return () => permission.current; } };
  return <main className="studio-user-view studio-view">
    <p id="notice">LOCAL SYNTHETIC COMPONENT CHECK — real materials component and evidence handler. Synthetic authority; no API, login, storage or production data. History below is fixture-only, not full application Undo acceptance.</p>
    <div className="fixture-controls"><label><input type="checkbox" checked={allowed} onChange={event => setAllowed(event.target.checked)}/>Synthetic authoring allowed</label><button disabled={!history.length} onClick={() => { const previous = history.at(-1); setHistory(history.slice(0, -1)); setDraft(previous); trace('fixture-undo'); }}>Undo fixture change</button><p role="status">{draft.nodes.length} nodes · {draft.links.length} connections · {history.length} fixture changes</p></div>
    <aside className={compact ? 'node-inspector fixture-compact' : 'fixture-wide'}>
      <h2>{compact ? draft.nodes.find(node => node.id === nodeId)?.title : 'Full materials library'}</h2>
      <StudioMaterialsWorkspace draft={draft} locale={locale} nodeId={compact ? nodeId : undefined} authority={authority} onNode={setNode} onApply={(expected, next) => {
        if (!permission.current || casePublicationFingerprint(current.current) !== expected) return false;
        const previous = current.current;
        setHistory(old => [...old, previous]); setDraft(next); trace('applied', { nodes: next.nodes.length, connections: next.links.length }); return true;
      }}/>
    </aside><details><summary>Local event trace</summary><pre id="trace"/></details>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
