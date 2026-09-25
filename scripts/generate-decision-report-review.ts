import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { normalizeStudioDraft, caseFingerprint, casePublicationFingerprint } from '../app/case-integrity';
import { buildCaseReportArtifacts, createCaseReportPreview, type CaseReportOptions } from '../app/case-report';
import { reportReceipt } from '../app/report-model';
const path = resolve('tests/fixtures/fiveflats-rent-146000.studio-draft.json');
const input = readFileSync(path);
const draft = normalizeStudioDraft(JSON.parse(input.toString()));
const out = process.argv[2];
if (!out) throw new Error('Supply output directory');
if (process.argv[3] && process.argv[3] !== '--tree') throw new Error('Supported option: --tree');
const includeDecisionTree = process.argv[3] === '--tree';
mkdirSync(out, { recursive: true });
const options: CaseReportOptions = {
 language:'en', presentationMode:'decision', includeDecisionTree, profileId:'tax_position_memorandum', profileLabel:'Tax position memorandum',
 audience:'internal', confidentiality:'confidential', preparedBy:'', preparedFor:'', matterReference:'',
 includeEconomics:true, includeRegisters:true, includeSources:true, includeAuditTrail:false, includeTechnicalIds:false,
 generatedAt:new Date().toISOString(), currentFingerprint:caseFingerprint(draft), workspaceFingerprint:null,
 currentPublicationFingerprint:casePublicationFingerprint(draft), workspacePublicationFingerprint:null,
 privateCase:true, reportReceiptStorageScope:null, persistReportReceiptOnDevice:false, status:'draft',
};
const artifacts = buildCaseReportArtifacts(draft, options);
const blob = await createCaseReportPreview(draft, options, {canGenerate:true});
const pdf = Buffer.from(await blob.arrayBuffer());
writeFileSync(resolve(out, 'FiveFlats-decision-report.pdf'), pdf);
const receipt=reportReceipt(artifacts.reportModel,options.generatedAt,{
 layoutSchemaVersion:artifacts.layoutModel.layoutSchemaVersion,layoutAlgorithmVersion:artifacts.layoutModel.layoutAlgorithmVersion,
 layoutRendererVersion:artifacts.layoutModel.layoutRendererVersion,layoutFingerprint:artifacts.layoutModel.layoutFingerprint,
 presentationFingerprint:artifacts.presentationFingerprint,
});
writeFileSync(resolve(out,'FiveFlats-report-evidence.json'),JSON.stringify({purpose:'Local generator review; not hosted download or approval evidence',sourceCaseSha256:createHash('sha256').update(input).digest('hex'),pdfSha256:createHash('sha256').update(pdf).digest('hex'),pdfBytes:pdf.length,receipt},null,2)+'\n');
console.log(JSON.stringify({output:resolve(out,'FiveFlats-decision-report.pdf'),bytes:pdf.length}));
