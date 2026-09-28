import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { caseReportReceiptBinding, type CaseReportOptions } from '../app/case-report';
import { caseFingerprint, casePublicationFingerprint, normalizeStudioDraft } from '../app/case-integrity';
import { isReportReceiptStale, type ReportReceiptV2 } from '../app/report-model';

test('actual pre-disclosure browser receipts retain Base/Medium freshness and retire both Full formats', () => {
 const draft=normalizeStudioDraft(JSON.parse(readFileSync('docs/testing/inv01-2026-09-28/fiveflats-pdfs/saved-draft-before-recovery.json','utf8')));
 const folder='docs/testing/inv01-2026-09-28/fiveflats-pdfs/';
 const files=readdirSync(folder).filter(name=>name.endsWith('-report-receipt.json')).sort();
 assert.equal(files.length,4);
 const modes=['decision','medium','full','full'] as const;
 for(let index=0;index<files.length;index++) {
  const receipt=JSON.parse(readFileSync(folder+files[index],'utf8')) as ReportReceiptV2;
  const options:CaseReportOptions={language:'en',presentationMode:modes[index],includeDecisionTree:index===1||index===2,profileId:'tax_position_memorandum',profileLabel:'Tax position memorandum',audience:'internal',confidentiality:'draft',preparedBy:'',preparedFor:'',matterReference:'',includeEconomics:true,includeRegisters:true,includeSources:true,includeAuditTrail:true,includeTechnicalIds:false,generatedAt:receipt.generatedAt,currentFingerprint:caseFingerprint(draft),workspaceFingerprint:caseFingerprint(draft),currentPublicationFingerprint:casePublicationFingerprint(draft),workspacePublicationFingerprint:casePublicationFingerprint(draft),privateCase:false,reportReceiptStorageScope:null,persistReportReceiptOnDevice:false,status:'draft',reviewerName:'',reviewerApproved:false,redactedNodeIds:[]};
  const binding=caseReportReceiptBinding(draft,options);
  assert.equal(binding.reportFingerprint,receipt.reportFingerprint,'canonical analysis unchanged');
  assert.equal(binding.layoutFingerprint,receipt.layoutFingerprint,'graph layout unchanged');
  assert.equal(isReportReceiptStale(receipt,draft,options.profileId,binding),index>=2,files[index]);
 }
});
