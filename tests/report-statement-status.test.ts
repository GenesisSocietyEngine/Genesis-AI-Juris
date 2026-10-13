import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConvertedExample } from '../app/converted-examples';
import { buildCaseReportArtifacts } from '../app/case-report';
import { reportOptions } from './helpers/tax-report-fixture';

for (const language of ['en', 'ru'] as const) for (const presentationMode of ['decision', 'medium', 'full'] as const) test(`${language} ${presentationMode} report preserves editable statement status`, () => {
  const draft = buildConvertedExample('be_commercial_logistics_001', 'en');
  const fact = draft.nodes.find(node => node.type === 'fact')!;
  fact.title = 'Reviewed sampling assumption';
  fact.detail = 'Sampling is available; provenance is unresolved.';
  fact.factStatus = 'assumed';
  const options = reportOptions(draft, { language, presentationMode, profileId: 'strategy_risk_report', includeEconomics: false, includeDecisionTree: false });
  const assumed = buildCaseReportArtifacts(draft, options);
  assert.ok(assumed.reportModel.sections.flatMap(section => section.items).filter(item => item.id === fact.id).every(item => item.factStatus === 'assumed'));
  const text = JSON.stringify(assumed.definition);
  assert.match(text, /CASEVANT · BY FALCON-MERLIN GROUP/);
  assert.doesNotMatch(text, /GENESIS: JURIS/);
  assert.match(text, language === 'en' ? /Assumed statement — requires verification/ : /Допущение — требует проверки/);
  fact.factStatus = 'asserted';
  const asserted = buildCaseReportArtifacts(draft, options);
  assert.match(JSON.stringify(asserted.definition), language === 'en' ? /Asserted statement — independent verification not recorded/ : /Утверждение — независимая проверка не зафиксирована/);
  assert.notEqual(assumed.reportModel.contentFingerprint, asserted.reportModel.contentFingerprint);
  delete fact.factStatus;
  const legacy = buildCaseReportArtifacts(draft, options);
  assert.ok(legacy.reportModel.sections.flatMap(section => section.items).filter(item => item.id === fact.id).every(item => !Object.hasOwn(item, 'factStatus')));
});
