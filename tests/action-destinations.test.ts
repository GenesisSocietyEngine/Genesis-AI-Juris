import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionForFinding } from '../app/matters/matter-actions';
import { normalizeRequests, normalizeSnapshots, type ReadinessReason, type SnapshotItem, type OutputItem } from '../app/matters/matter-view-model';
import { appendConnectedStudioItem } from '../app/studio-action-editing';
import { studioStructuralIssues } from '../app/case-integrity';
import { validateStudioDraft } from '../app/studio-validation';
import { buildCanopyPackage } from '../app/canopy-fixture';

const finding = (code: string, id: string|null = null): ReadinessReason => ({code, relatedObjectId:id, relatedObjectType:null, explanation:'Action needed.',deepLink:'https://untrusted.example/replace-case'});
test('actions ignore remote deep links and preserve the exact request and evidence identity',()=>{
  assert.deepEqual(actionForFinding(finding('INFORMATION_REQUEST_OPEN','request-two')).target, {destination:'requests',id:'request-response',requestId:'request-two'});
  assert.deepEqual(actionForFinding(finding('SOURCE_VERSION_STALE','anchor-two')).target,{destination:'evidence',id:'source-anchor-two'});
  assert.deepEqual(actionForFinding(finding('CONTRADICTION_UNRESOLVED','assertion-two')).target,{destination:'evidence',id:'assertion-assertion-two'});
  assert.deepEqual(actionForFinding(finding('DOCUMENT_REVIEW_REQUIRED','document-two')).target,{destination:'documents',id:'document-document-two'});
});
test('report actions disclose prerequisites and retain an outdated output as the exact target',()=>{
  assert.equal(actionForFinding(finding('OUTPUT_REQUIRED')).target.id,'snapshot-create');
  assert.equal(actionForFinding(finding('OUTPUT_REQUIRED'),[{id:'snapshot-one',sealed:true,dossierRevision:17,manifestDigest:'sha256-verified'} as SnapshotItem],[],17).target.id,'report-generate');
  assert.equal(actionForFinding(finding('OUTPUT_REQUIRED'),[{id:'old',sealed:true,dossierRevision:16,manifestDigest:'sha256-old'} as SnapshotItem],[],17).target.id,'snapshot-create');
  assert.equal(actionForFinding(finding('OUTPUT_STALE','output-two')).target.id,'output-output-two');
  assert.notEqual(actionForFinding(finding('REVIEWER_APPROVAL_MISSING','missing'),[],[{id:'different',state:'current'} as OutputItem]).target.id,'output-different');
});
test('request normalization preserves exact receipt proof without substituting the first document',()=>{
  const {requests}=normalizeRequests({requests:[{id:'two',status:'received',satisfying_document_id:'doc-two',satisfying_evidence_link_id:'link-two'}]});
  assert.equal(requests[0].satisfyingDocumentId,'doc-two');
  assert.equal(requests[0].satisfyingEvidenceLinkId,'link-two');
});
test('Studio action check identifiers are stable and complete',()=>{
  const {draft}=buildCanopyPackage('base');
  const {checks}=validateStudioDraft(draft,'en');
  assert.ok(checks.length>0);
  assert.equal(new Set(checks.map(check=>check.id)).size, checks.length);
  assert.ok(checks.every(check=>check.id));
});

test('adding evidence preserves the original graph and adds a reachable node without mutating source data',()=>{
  const {draft}=buildCanopyPackage('base');
  const before=JSON.stringify(draft);
  const added=appendConnectedStudioItem(draft,{type:'evidence',title:'Source for review',detail:'Synthetic source reference.',relatedId:draft.nodes.find(node=>node.type==='decision')!.id});
  assert.ok(added);
  assert.equal(JSON.stringify(draft),before);
  assert.deepEqual(added.draft.nodes.slice(0,-1),draft.nodes);
  assert.deepEqual(added.draft.links.slice(0,-1),draft.links);
  assert.ok(!studioStructuralIssues(added.draft).includes('disconnected_graph'));
  assert.equal(appendConnectedStudioItem({...draft,links:Array.from({length:500},()=>draft.links[0])},{type:'evidence',title:'x',detail:'y',relatedId:draft.nodes[0].id}),null);
  assert.equal(appendConnectedStudioItem(draft,{type:'evidence',title:'x',detail:'y',relatedId:'not-in-case'}),null);
});

test('package actions retain the exact package reference and unsealed snapshots remain unavailable',()=>{
  assert.equal(actionForFinding(finding('SIMULATION_REQUIRED','package-two')).target.packageRefId,'package-two');
  assert.equal(actionForFinding(finding('OUTPUT_REQUIRED'),[{id:'pending',sealed:false,dossierRevision:17,manifestDigest:'sha256-pending'} as SnapshotItem],[],17).target.id,'snapshot-create');
});

test('snapshot normalization requires an explicit sealed flag',()=>{
 const snapshots=normalizeSnapshots({snapshots:[{snapshot_id:'a',dossier_revision:17,sealed:true},{snapshot_id:'b',dossier_revision:17}]});
 assert.equal(snapshots[0].sealed,true);assert.equal(snapshots[1].sealed,false);
});
