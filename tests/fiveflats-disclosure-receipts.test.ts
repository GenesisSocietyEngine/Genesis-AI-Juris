import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { caseReportReceiptBinding, type CaseReportOptions } from '../app/case-report';
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from '../app/case-integrity';
import { isReportReceiptStale, type CurrentReportReceiptBinding, type ReportReceiptV2 } from '../app/report-model';

test('actual older receipts retain Base/Medium freshness and retire Full renderer2 and3', () => {
 const draft=normalizeStudioDraft(JSON.parse(readFileSync('docs/testing/inv01-2026-09-28/fiveflats-pdfs/saved-draft-before-recovery.json','utf8')));
 for (const revision of ['', 'disclosures/']) {
 const folder='docs/testing/inv01-2026-09-28/fiveflats-pdfs/'+revision;
 const files=readdirSync(folder).filter(name=>name.endsWith('-report-receipt.json')).sort();
 assert.equal(files.length,revision ? 2 : 4);
 const modes = revision ? ['full','full'] as const : ['decision','medium','full','full'] as const;
 for(let index=0;index<files.length;index++) {
  const receipt=JSON.parse(readFileSync(folder+files[index],'utf8')) as ReportReceiptV2;
  const options:CaseReportOptions={language:'en',presentationMode:modes[index],includeDecisionTree:revision ? index===0 : index===1||index===2,profileId:'tax_position_memorandum',profileLabel:'Tax position memorandum',audience:'internal',confidentiality:'draft',preparedBy:'',preparedFor:'',matterReference:'',includeEconomics:true,includeRegisters:true,includeSources:true,includeAuditTrail:true,includeTechnicalIds:false,generatedAt:receipt.generatedAt,currentFingerprint:caseFingerprint(draft),workspaceFingerprint:caseFingerprint(draft),currentPublicationFingerprint:casePublicationFingerprint(draft),workspacePublicationFingerprint:casePublicationFingerprint(draft),privateCase:false,reportReceiptStorageScope:null,persistReportReceiptOnDevice:false,status:'draft',reviewerName:'',reviewerApproved:false,redactedNodeIds:[]};
  const binding=caseReportReceiptBinding(draft,options);
  assert.equal(binding.reportFingerprint,receipt.reportFingerprint,'canonical analysis unchanged');
  assert.equal(binding.layoutFingerprint,receipt.layoutFingerprint,'graph layout unchanged');
  assert.equal(isReportReceiptStale(receipt,draft,options.profileId,binding),Boolean(revision)||index>=2,files[index]);
 }
 }
});

test('retained renderer4 output bindings become stale for Full EN/RU ON/OFF', () => {
 const draft=normalizeStudioDraft(JSON.parse(readFileSync('docs/testing/inv01-2026-09-28/fiveflats-pdfs/saved-draft-before-recovery.json','utf8')));
 const retained=JSON.parse(readFileSync('docs/testing/inv01-2026-09-28/2026-09-29/pdfs/inspection.json','utf8')) as {
  renderer:number; results:Array<{name:string; binding:CurrentReportReceiptBinding}>;
 };
 assert.equal(retained.renderer,4);
 assert.deepEqual(retained.results.map(result=>result.name).sort(),['full-en-off','full-en-on','full-ru-off','full-ru-on']);
 const folder='docs/testing/inv01-2026-09-28/fiveflats-pdfs/disclosures/';
 const reference=JSON.parse(readFileSync(folder+readdirSync(folder).filter(name=>name.endsWith('-report-receipt.json')).sort()[0],'utf8')) as ReportReceiptV2;
 for(const result of retained.results) {
  const options:CaseReportOptions={language:result.name.includes('-ru-')?'ru':'en',presentationMode:'full',includeDecisionTree:result.name.endsWith('-on'),profileId:'tax_position_memorandum',profileLabel:'Tax position memorandum',audience:'internal',confidentiality:'draft',preparedBy:'',preparedFor:'',matterReference:'',includeEconomics:true,includeRegisters:true,includeSources:true,includeAuditTrail:true,includeTechnicalIds:false,generatedAt:reference.generatedAt,currentFingerprint:caseFingerprint(draft),workspaceFingerprint:caseFingerprint(draft),currentPublicationFingerprint:casePublicationFingerprint(draft),workspacePublicationFingerprint:casePublicationFingerprint(draft),privateCase:false,reportReceiptStorageScope:null,persistReportReceiptOnDevice:false,status:'draft',reviewerName:'',reviewerApproved:false,redactedNodeIds:[]};
  const current=caseReportReceiptBinding(draft,options);
  assert.equal(current.reportFingerprint,result.binding.reportFingerprint,'substantive analysis unchanged');
  assert.equal(current.layoutFingerprint,result.binding.layoutFingerprint,'graph layout unchanged');
  assert.notEqual(current.presentationFingerprint,result.binding.presentationFingerprint,'corrected Full presentation differs from renderer4');
  // Transient test receipts use actual retained output bindings; no stored/browser receipt is invented.
  assert.equal(isReportReceiptStale({...reference,...result.binding},draft,options.profileId,current),true,result.name);
  assert.equal(isReportReceiptStale({...reference,...current},draft,options.profileId,current),false,result.name);
 }
});
