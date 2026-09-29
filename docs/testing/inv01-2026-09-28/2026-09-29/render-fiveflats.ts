import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCaseReportPreview, caseReportReceiptBinding, type CaseReportOptions } from '../../../../app/case-report';
import { normalizeStudioDraft, caseFingerprint, casePublicationFingerprint } from '../../../../app/case-integrity';
import { discoverPoppler, inspectPdf, assertA4Portrait, renderAndInspectPdf, sha256File } from '../../../../scripts/tests/report-pdf-qa';
const root=resolve(process.argv[2] ?? 'docs/testing/inv01-2026-09-28/2026-09-29/pdfs-v5'); mkdirSync(root,{recursive:true});
const draft=normalizeStudioDraft(JSON.parse(readFileSync('docs/testing/inv01-2026-09-28/fiveflats-pdfs/saved-draft-before-recovery.json','utf8')));
const before=JSON.stringify(draft), tools=discoverPoppler(process.cwd()), results=[];
for(const language of ['en','ru'] as const) for(const includeDecisionTree of [true,false]) {
 const name=`full-${language}-${includeDecisionTree?'on':'off'}`, file=resolve(root,name+'.pdf');
 const options:CaseReportOptions={language,presentationMode:'full',includeDecisionTree,profileId:'tax_position_memorandum',profileLabel:'Tax position memorandum',audience:'internal',confidentiality:'draft',preparedBy:'',preparedFor:'',matterReference:'',includeEconomics:true,includeRegisters:true,includeSources:true,includeAuditTrail:true,includeTechnicalIds:false,generatedAt:'2026-09-29T02:00:00.000Z',currentFingerprint:caseFingerprint(draft),workspaceFingerprint:caseFingerprint(draft),currentPublicationFingerprint:casePublicationFingerprint(draft),workspacePublicationFingerprint:casePublicationFingerprint(draft),privateCase:false,reportReceiptStorageScope:null,persistReportReceiptOnDevice:false,status:'draft',reviewerName:'',reviewerApproved:false,redactedNodeIds:[]};
 const blob=await createCaseReportPreview(draft,options,{canGenerate:true});
 writeFileSync(file,Buffer.from(await blob.arrayBuffer()));
 execFileSync(tools.pdftotext,['-layout',file,resolve(root,name+'.txt')]);
 const text=readFileSync(resolve(root,name+'.txt'),'utf8');
 if(language==='en') {
  for(const phrase of ['146,000','36,500','85.0%','36 months','8.0%','25,000','68.6 months exceeds','not a verified legal currency check','Future-dated entries require correction']) assert.ok(text.includes(phrase),phrase);
  if(!includeDecisionTree) for(const phrase of ['Profile-specific analysis','Facts, evidence and rules register','Authorities and source register','Authoring and review trail','Verification and sign-off','Unverified tax scenario','The complete graph text appendix is omitted']) assert.ok(text.includes(phrase),phrase);
 }
 const info=inspectPdf(tools,file);assertA4Portrait(info,file);
 const render=renderAndInspectPdf(tools,file,resolve('.artifacts/inv29-pdf-render',name),info,72);
 results.push({name,sha256:sha256File(file),pages:info.pages,binding:caseReportReceiptBinding(draft,options),render});
 assert.equal(JSON.stringify(draft),before);
}
writeFileSync(resolve(root,'inspection.json'),JSON.stringify({purpose:'Programmatic renderer regression using actual previously saved synthetic draft; not a browser download, professional approval or hosted acceptance',renderer:5,source:'saved-draft-before-recovery.json',sourceSha256:sha256File('docs/testing/inv01-2026-09-28/fiveflats-pdfs/saved-draft-before-recovery.json'),tools:tools.versions,results},null,2)+'\n');
console.log(JSON.stringify(results.map(({name,pages,sha256})=>({name,pages,sha256}))));
