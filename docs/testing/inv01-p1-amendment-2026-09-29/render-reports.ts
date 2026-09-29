import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCaseReportPreview, caseReportReceiptBinding, type CaseReportOptions } from '../../../app/case-report';
import { normalizeStudioDraft, caseFingerprint, casePublicationFingerprint } from '../../../app/case-integrity';
import { discoverPoppler, inspectPdf, assertA4Portrait, renderAndInspectPdf, sha256File } from '../../../scripts/tests/report-pdf-qa';

const root = resolve('docs/testing/inv01-p1-amendment-2026-09-29/pdfs');
mkdirSync(root, { recursive: true });
const fixture = 'docs/testing/inv01-2026-09-28/fiveflats-pdfs/saved-draft-before-recovery.json';
const saved = normalizeStudioDraft(JSON.parse(readFileSync(fixture, 'utf8')));
const tools = discoverPoppler(process.cwd()), results = [];
const oldInspection = JSON.parse(readFileSync('docs/testing/inv01-2026-09-28/2026-09-29/pdfs/inspection.json', 'utf8'));
const scenarios = [
  ...(['en', 'ru'] as const).flatMap(language => [true, false].map(includeDecisionTree => ({
    name: `full-${language}-${includeDecisionTree ? 'on' : 'off'}`, language, includeDecisionTree, separator: '',
  }))),
  ...Object.entries({ LF: '\n', CRLF: '\r\n', CR: '\r' }).map(([name, separator]) => ({
    name: `boundary-${name.toLowerCase()}`, language: 'en' as const, includeDecisionTree: false, separator,
  })),
];
for (const scenario of scenarios) {
  const draft = structuredClone(saved);
  if (scenario.separator) draft.dealEconomics!.assumptions.push(['Boundary start', ...Array.from({ length: 65 }, (_, i) => String(i % 10)), 'Boundary end'].join(scenario.separator));
  const before = JSON.stringify(draft), file = resolve(root, scenario.name + '.pdf');
  const options: CaseReportOptions = {
    language: scenario.language, presentationMode: 'full', includeDecisionTree: scenario.includeDecisionTree,
    profileId: 'tax_position_memorandum', profileLabel: 'Tax position memorandum', audience: 'internal', confidentiality: 'draft',
    preparedBy: '', preparedFor: '', matterReference: '', includeEconomics: true, includeRegisters: true, includeSources: true,
    includeAuditTrail: true, includeTechnicalIds: false, generatedAt: '2026-09-29T02:00:00.000Z',
    currentFingerprint: caseFingerprint(draft), workspaceFingerprint: caseFingerprint(draft),
    currentPublicationFingerprint: casePublicationFingerprint(draft), workspacePublicationFingerprint: casePublicationFingerprint(draft),
    privateCase: false, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false,
    status: 'draft', reviewerName: '', reviewerApproved: false, redactedNodeIds: [],
  };
  const blob = await createCaseReportPreview(draft, options, { canGenerate: true });
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  const textFile = resolve(root, scenario.name + '.txt');
  execFileSync(tools.pdftotext, ['-layout', file, textFile], { windowsHide: true });
  const text = readFileSync(textFile, 'utf8');
  if (scenario.separator) {
    const start = text.indexOf('Boundary start'), end = text.indexOf('Boundary end');
    assert.ok(start >= 0 && end > start);
    const digits = text.slice(start, end).split(/\r?\n/).map(line => line.trim()).filter(line => /^\d$/.test(line));
    assert.deepEqual(digits, Array.from({ length: 65 }, (_, i) => String(i % 10)));
    assert.ok(!text.split('\f').some(page => page.includes('Boundary start') && page.includes('Boundary end')));
  } else {
    const oldText = readFileSync(`docs/testing/inv01-2026-09-28/2026-09-29/pdfs/${scenario.name}.txt`, 'utf8');
    assert.equal(text.replace(/\s/g, ''), oldText.replace(/\s/g, ''), 'all substantive text and numeric values match prior output');
    const oldBinding = oldInspection.results.find((item: { name: string }) => item.name === scenario.name).binding;
    const binding = caseReportReceiptBinding(draft, options);
    assert.equal(binding.reportFingerprint, oldBinding.reportFingerprint);
    assert.equal(binding.layoutFingerprint, oldBinding.layoutFingerprint);
    assert.notEqual(binding.presentationFingerprint, oldBinding.presentationFingerprint);
  }
  const info = inspectPdf(tools, file); assertA4Portrait(info, file);
  const render = renderAndInspectPdf(tools, file, resolve('.artifacts/p1-pdf-render', scenario.name), info, 72);
  assert.equal(JSON.stringify(draft), before, 'input remains unchanged');
  results.push({ name: scenario.name, sha256: sha256File(file), pages: info.pages, binding: caseReportReceiptBinding(draft, options), render });
  console.log(`${scenario.name}: ${info.pages} pages; content, input, bindings and raster sanity PASS`);
}
writeFileSync(resolve(root, 'inspection.json'), JSON.stringify({
  purpose: 'Production renderer verification using the saved synthetic draft; not browser delivery, provider transport or hosted acceptance',
  renderer: 5, sourceSha256: sha256File(fixture), tools: tools.versions, results,
}, null, 2) + '\n');
