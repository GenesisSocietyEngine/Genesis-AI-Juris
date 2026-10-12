import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import { buildConvertedExample, CONVERTED_EXAMPLES } from '../app/converted-examples';
import { CANOPY_SCENARIOS, buildCanopyPackage } from '../app/canopy-fixture';
import { buildCaseReportArtifacts, type CaseReportOptions } from '../app/case-report';
import { caseFingerprint, casePublicationFingerprint } from '../app/case-integrity';
import { caseTypePlaybook } from '../app/case-type-playbooks';
import { discoverPoppler, extractPdfText, inspectPdf } from './tests/report-pdf-qa';
(pdfMake as unknown as {addVirtualFileSystem:(v:unknown)=>void}).addVirtualFileSystem(pdfFonts);
const tools = discoverPoppler(process.cwd());
const output = '.artifacts/migration-pdfs'; mkdirSync(output,{recursive:true});
const cases = Object.keys(CONVERTED_EXAMPLES).map(id=>buildConvertedExample(id,'en')).concat(CANOPY_SCENARIOS.map(s=>buildCanopyPackage(s.id,true).draft));
for(const draft of cases){
 const profile=caseTypePlaybook(draft.caseType).outputs.find(o=>o.primary)!;
 const options:CaseReportOptions={language:'en',presentationMode:'full',includeDecisionTree:false,profileId:profile.id,profileLabel:profile.label.en,audience:'internal',confidentiality:'draft',preparedBy:'Case reviewer',preparedFor:'Decision owner',matterReference:draft.caseId,includeEconomics:false,includeRegisters:true,includeSources:true,includeAuditTrail:false,includeTechnicalIds:true,generatedAt:'2026-10-12T00:00:00Z',currentFingerprint:caseFingerprint(draft),workspaceFingerprint:null,currentPublicationFingerprint:casePublicationFingerprint(draft),workspacePublicationFingerprint:null,privateCase:false,reportReceiptStorageScope:null,persistReportReceiptOnDevice:false};
 const artifacts=buildCaseReportArtifacts(draft,options);
 const buffer=await new Promise<Buffer>((resolve,reject)=>{try{pdfMake.createPdf(artifacts.definition).getBuffer(value=>resolve(Buffer.from(value)));}catch(error){reject(error);}});
 const path=output+'/'+draft.caseId+'-'+draft.version+'.pdf'; writeFileSync(path,buffer);
 const info=inspectPdf(tools,path);
 const rendered=spawnSync(tools.pdftoppm,['-f','1','-l','1','-scale-to','900','-png','-singlefile',path,path+'-first'],{windowsHide:true}); if(rendered.status!==0)throw new Error('PDF render failed '+path); const text=extractPdfText(tools,path,path+".txt");
 if(buffer.length<1000||!text.includes(draft.title.split(' — ')[0]))throw new Error('Invalid report '+draft.caseId);
 for(const node of draft.nodes.filter(n=>n.id.startsWith('evidence-')))if(!text.includes(node.id.slice(9)))throw new Error('Missing source '+node.id);
 console.log('PASS PDF',draft.caseId,draft.version,buffer.length,info.pages + " pages");
}
