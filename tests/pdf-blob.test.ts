import assert from 'node:assert/strict';
import { test } from 'node:test';
import pdfMake from 'pdfmake/build/pdfmake.js';
import fonts from 'pdfmake/build/vfs_fonts.js';
import { pdfBlobFromDocument } from '../app/pdf-blob';
(pdfMake as unknown as {addVirtualFileSystem:(fonts:unknown)=>void}).addVirtualFileSystem(fonts);
test('PDF stream adapter delivers a real PDF and returns layout errors to the dialog', async () => {
 const blob=await pdfBlobFromDocument(pdfMake.createPdf({content:'Controlled PDF review'}));
 assert.equal(blob.type,'application/pdf');assert.match(Buffer.from(await blob.arrayBuffer()).toString('ascii',0,8),/^%PDF-/);
 await assert.rejects(pdfBlobFromDocument(pdfMake.createPdf({content:'Controlled invalid font',defaultStyle:{font:'AbsentFont'}})),/Font.*AbsentFont/);
});

import { reportPdfFixtures } from '../scripts/tests/report-pdf-fixtures';
import { buildCaseReportArtifacts } from '../app/case-report';
import { CASE_REPORT_PDF_FONTS } from '../app/report-audit-symbols';
import { primaryCaseOutput } from '../app/case-type-playbooks';
import { caseFingerprint, casePublicationFingerprint } from '../app/case-integrity';
import { buildCanopyPackage } from '../app/canopy-fixture';
import auditFont from '../app/report-audit-symbol-font.v1.json' with {type:'json'};
import { mkdirSync, writeFileSync } from 'node:fs';
test('Tax and Canopy use the same recoverable stream path for portrait PDFs',async()=>{
 (pdfMake as unknown as {addVirtualFileSystem:(fonts:unknown)=>void}).addVirtualFileSystem({...fonts,...auditFont.vfs});
 const tax=reportPdfFixtures().find(f=>f.id==='golden-tax_planning-en-internal')!; assert.ok(tax);
 const canopy=buildCanopyPackage('base').draft;
 for(const draft of [tax.draft,canopy]){
  const profile=primaryCaseOutput(draft.caseType),fp=caseFingerprint(draft),pub=casePublicationFingerprint(draft);
  const {definition}=buildCaseReportArtifacts(draft,{language:'en',profileId:profile.id,profileLabel:profile.label.en,audience:'internal',confidentiality:'draft',preparedBy:'Controlled review',preparedFor:'',matterReference:'QA',includeEconomics:true,includeRegisters:true,includeSources:true,includeAuditTrail:false,includeTechnicalIds:false,generatedAt:'2026-09-15T12:00:00.000Z',currentFingerprint:fp,workspaceFingerprint:null,currentPublicationFingerprint:pub,workspacePublicationFingerprint:null,privateCase:false,reportReceiptStorageScope:null,persistReportReceiptOnDevice:false});
  assert.equal(definition.pageOrientation,'portrait');
  const blob=await pdfBlobFromDocument(pdfMake.createPdf(definition,undefined,CASE_REPORT_PDF_FONTS));assert.ok(blob.size>1000);
  mkdirSync('.artifacts/pdf-recovery',{recursive:true});writeFileSync('.artifacts/pdf-recovery/'+draft.caseId+'.pdf',Buffer.from(await blob.arrayBuffer()));
 }
});
