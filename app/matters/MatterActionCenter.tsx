'use client';
import { useState } from 'react';
import ActionTile from '../ActionTile';
import { actionForFinding, type MatterActionTarget } from './matter-actions';
import type { MatterDetail, SnapshotItem, OutputItem, RequestItem, DocumentItem } from './matter-view-model';

export default function MatterActionCenter({ matter, snapshots, outputs, requests = [], documents = [], onOpen }: { matter: MatterDetail; snapshots: SnapshotItem[]; outputs: OutputItem[]; requests?: RequestItem[]; documents?: DocumentItem[]; onOpen: (target: MatterActionTarget) => void }) {
  const [showAll, setShowAll] = useState(false);
  const findings = matter.readiness.dimensions.flatMap(dimension => dimension.reasons);
  const actions = findings.map(finding => {
    const action = actionForFinding(finding, snapshots, outputs, matter.revision);
    const request = requests.find(item => item.id === finding.relatedObjectId && finding.relatedObjectType === 'information_request');
    const document = documents.find(item => item.id === finding.relatedObjectId && finding.relatedObjectType === 'document');
    return { ...action, detail: request ? `${request.question} — ${request.requestedFrom ?? 'Unassigned'} · ${request.priority} priority. ${request.reason}` : document ? `${document.title}. ${finding.explanation}` : action.detail, key: `${finding.code}-${finding.relatedObjectId ?? ''}` };
  });
  const targets = new Set(actions.map(action => action.target.id));
  for (const anchor of matter.anchors.filter(anchor => anchor.reviewState === 'needs_review' || anchor.reviewState === 'pending')) {
    if (!targets.has(`source-${anchor.id}`)) actions.push({ key: `source-${anchor.id}`, title: 'Review the source citation', detail: anchor.excerpt || 'Check the exact source before accepting this citation.', target: { destination: 'evidence', id: `source-${anchor.id}` } });
  }
  for (const assertion of matter.assertions.filter(assertion => assertion.status === 'needs_review')) {
    if (!targets.has(`assertion-${assertion.id}`)) actions.push({ key: `assertion-${assertion.id}`, title: 'Review the professional assertion', detail: assertion.statement, target: { destination: 'evidence', id: `assertion-${assertion.id}` } });
  }
  const unique = actions.filter((action, index) => actions.findIndex(other => other.target.id === action.target.id && other.target.requestId === action.target.requestId && other.target.packageRefId === action.target.packageRefId) === index);
  return <section id="matter-next-actions" className="action-center" aria-labelledby="matter-next-actions-title" tabIndex={-1}>
    <header><div><h2 id="matter-next-actions-title">Your next actions</h2><p>Resolve the case’s outstanding work. Each action opens its relevant record or control.</p></div><span>{unique.length} to review</span></header>
    {!matter.permissions.canWrite && !matter.permissions.canReview && <p className="action-prerequisite">You can inspect these records. Ask the case owner for the contributor or reviewer role needed to make a change.</p>}
    <div className="action-tile-grid">{(showAll ? unique : unique.slice(0, 6)).map(action => <ActionTile key={action.key} title={action.title} detail={action.detail} status="Needs attention" next="Open" onClick={() => onOpen(action.target)}/>)}</div>
    {unique.length > 6 && <button type="button" className="secondary-cta" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? "Show priority actions" : `Show all ${unique.length} actions`}</button>}
    {!unique.length && !matter.readiness.dimensions.length && <p role="status">Readiness has not been computed for this case. Refresh the case before deciding it has no outstanding work.</p>}
    {!unique.length && matter.readiness.dimensions.length > 0 && <p className="action-complete">No outstanding action is reported for this revision. Readiness does not replace independent approval.</p>}
  </section>;
}
