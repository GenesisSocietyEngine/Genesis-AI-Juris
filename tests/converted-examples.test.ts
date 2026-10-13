import { createExampleWorkingCopy } from "../app/example-working-copy";
import { projectCaseCoreV2 } from "../app/case-core";
import type { StudioNode } from "../app/types";
import assert from 'node:assert/strict';
import test from 'node:test';
import bundle from '../app/canonical-case-bundle.json';
import { buildConvertedExample, CONVERTED_EXAMPLES, CONVERTED_EXAMPLE_VERSION } from '../app/converted-examples';
import { normalizeStudioDraft, caseFingerprint, studioStructuralIssues } from '../app/case-integrity';
import { caseTypePlaybook, evaluateCaseTypeDraft } from '../app/case-type-playbooks';
import { buildCaseMarkdown, parseCaseMarkdown } from '../app/case-markdown';
import { buildCaseReportArtifacts } from '../app/case-report';
import { CANOPY_SCENARIOS, CANOPY_SOURCES, buildCanopyPackage } from '../app/canopy-fixture';
import { studioOverview } from '../app/studio-overview';
import { isSupportedPlayedCaseSchemaRevision } from '../app/played-case-contract';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DemoCatalogueCards from '../app/DemoCatalogueCards';

for (const [id, spec] of Object.entries(CONVERTED_EXAMPLES)) for (const locale of ['en', 'ru'] as const) test(id + ' / ' + locale + ' migrated records survive save/reopen and export', async () => {
  const original = JSON.stringify(bundle);
  const raw = bundle.cases.find(c => c.case_id === id)!.scenario!;
  const draft = buildConvertedExample(id, locale, '2026-10-12T00:00:00Z');
  assert.equal(draft.caseId, id);
  assert.equal(draft.version, CONVERTED_EXAMPLE_VERSION);
  const firstCopy = createExampleWorkingCopy(draft), secondCopy = createExampleWorkingCopy(draft);
  assert.notEqual(firstCopy.caseId, secondCopy.caseId); assert.notEqual(firstCopy.caseId, draft.caseId);
  assert.equal(firstCopy.exampleSource?.caseId, id);
  assert.deepEqual(normalizeStudioDraft(JSON.parse(JSON.stringify(firstCopy))).exampleSource, firstCopy.exampleSource);
  const copyMarkdown = await buildCaseMarkdown(firstCopy, {status:"amended",language:locale});
  assert.deepEqual((await parseCaseMarkdown(copyMarkdown.markdown))?.draft.exampleSource, firstCopy.exampleSource);
  assert.equal(projectCaseCoreV2(firstCopy).identity.exampleSource?.caseId, id);
  const core = projectCaseCoreV2(draft);
  assert.equal(core.facts.find(f => f.id === "review-assumptions")?.status, "assumed");
  const trainingCorrespondence = new Set(['client_inactivity_warning', 'client_final_inactivity_warning', 'client_terminated_engagement']);
  for (const item of raw.inbox_items) if (!item.initially_visible) { assert.ok(!core.facts.some(f => f.id === "inbox-" + item.id)); if (!trainingCorrespondence.has(item.id)) assert.ok(core.outcomes.some(o => o.id === "inbox-" + item.id)); }
  assert.ok(!draft.nodes.some(node => trainingCorrespondence.has(node.id.replace(/^inbox-/, '')) || node.id === 'outcome-client_engagement_terminated'));
  assert.doesNotMatch(draft.nodes.map(node => node.detail).join('\n'), /three simulated hours|sustained inactivity|professional standing and client trust were materially reduced/);
  for (const fact of raw.facts) assert.equal(core.facts.find(f => f.id === "fact-" + fact.id)?.status, ["proven", "admitted"].includes(fact.initial_status) ? "asserted" : "assumed");
  assert.equal(draft.caseType?.id, spec.category);
  if ("initial_resources" in raw && raw.initial_resources?.authorized_budget_eur !== undefined) assert.ok(draft.nodes.find(n => n.id === "review-assumptions")!.detail.includes(String(raw.initial_resources.authorized_budget_eur)));
  if ("deterministic_decisions" in raw) for (const decision of (raw.deterministic_decisions ?? []).filter(item => item.id !== 'inactivity_consequence')) for (const branch of decision.branches) for (const effect of branch.effects) if (effect.type === "set_resource" && "resource" in effect && "value" in effect && effect.resource?.endsWith("_eur")) assert.ok(draft.nodes.find(n => n.id === "branch-" + decision.id + "-" + branch.id)!.detail.includes("EUR " + effect.value));
  assert.equal(caseTypePlaybook(draft.caseType).test.requiresPlayableRoute, false);
  assert.ok(draft.nodes.length <= 200);
  assert.ok(!studioStructuralIssues(draft).includes("disconnected_graph"));
  assert.ok(draft.links.length <= 500);
  assert.ok(draft.nodes.every(n => n.detail.length <= 4000), 'no silently truncated records');
  assert.ok(draft.nodes.every(n => !n.detail.includes('()')), 'no silently omitted branch conditions');
  const requiredConditions = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') return [];
    const c = value as Record<string, unknown>;
    const judicial = { won: 'favorable judgment', lost: 'adverse judgment', partially_won: 'partial relief', dismissed: 'dismissal', none: 'no judgment' };
    return [typeof c.deadline === 'string' ? c.deadline : '', typeof c.task === 'string' ? c.task : '', c.type === 'judicial_result_is' ? judicial[c.result as keyof typeof judicial] : '', ...Object.values(c).flatMap(requiredConditions)].filter(Boolean);
  };
  for (const action of raw.actions) {
    const node = draft.nodes.find(n => n.id === 'action-' + action.id);
    if (node) {
      const linked = draft.links.filter(link => link.to === node.id && link.rule?.label === 'Hypothetical option conditions').map(link => draft.nodes.find(candidate => candidate.id === link.from)!);
      const recordedConditions = [node, ...linked].map(record => record.detail).join('\n');
      for (const condition of requiredConditions(action.available_when)) assert.ok(recordedConditions.includes(condition), 'retained condition ' + condition);
      assert.ok(linked.every(record => record.type === 'fact' && record.factStatus === 'assumed'));
    }
  }
  for (const e of raw.evidence) {
    const node = draft.nodes.find(n => n.id === 'evidence-' + e.id)!;
    assert.ok(node, 'stable source ID ' + e.id);
    assert.match(node.detail, e.initially_available ? /initially available/ : /missing/);
    for (const factId of e.supports_facts ?? []) assert.ok(draft.links.some(l => l.from === node.id && l.to === 'fact-' + factId));
  }
  for (const stage of raw.stages) assert.ok(draft.nodes.find(n => n.id === 'stage-' + stage.id));
  for (const task of raw.async_tasks) if ('usable_until_event' in task) assert.ok(draft.nodes.find(node => node.id === 'task-' + task.id)!.detail.includes(task.usable_until_event));
  if ('pressure_windows' in raw) for (const window of raw.pressure_windows ?? []) {
    const record = draft.nodes.find(node => node.id === 'deadline-' + window.response_deadline_id)!;
    for (const id of [window.id, window.source_actor_id, window.activation_event_id, window.countermove_event_id, ...window.response_action_ids]) assert.ok(record.detail.includes(id));
    assert.match(record.detail, /Hypothetical response window/);
  }
  for (const outcome of raw.outcomes.filter(item => item.id !== 'client_engagement_terminated')) assert.match(draft.nodes.find(n => n.id === 'outcome-' + outcome.id)!.detail, /hypothetical scenario/);
  assert.ok(draft.nodes.every(n => !n.runtime));
  assert.ok(draft.links.every(l => !l.rule?.effects && !l.rule?.guards && !l.rule?.maxUses));
  const reopened = normalizeStudioDraft(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(reopened.nodes, draft.nodes.map(n => ({ ...n, runtime: undefined })));
  assert.equal(reopened.caseType?.id, spec.category);
  assert.ok(evaluateCaseTypeDraft(draft, locale).filter(c => c.id.startsWith('nodes:')).every(c => c.level === 'ok'));
  const markdown = await buildCaseMarkdown(draft, { status: 'amended', language: locale });
  const imported = await parseCaseMarkdown(markdown.markdown);
  assert.equal(imported?.draft.caseType?.id, spec.category);
  for (const node of reopened.nodes) { const exported: StudioNode | undefined = imported?.draft.nodes.find(n => n.id === node.id); assert.equal(exported?.detail, node.detail, "Markdown source content " + node.id); }
  const book = caseTypePlaybook(draft.caseType), output = book.outputs.find(o => o.primary)!;
  const artifacts = buildCaseReportArtifacts(draft, { language: locale, profileId: output.id, profileLabel: output.label[locale], audience: 'internal', confidentiality: 'draft', preparedBy: 'Example reviewer', preparedFor: 'Decision owner', matterReference: id, includeEconomics: false, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: true, presentationMode: 'full', includeDecisionTree: false, generatedAt: '2026-10-12T00:00:00Z', currentFingerprint: caseFingerprint(draft), workspaceFingerprint: null, currentPublicationFingerprint: '', workspacePublicationFingerprint: null, privateCase: false, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false });
  const report = JSON.stringify(artifacts);
  assert.ok(report.includes('CASEVANT · BY FALCON-MERLIN GROUP'));
  assert.ok(report.includes('CaseVant Studio'));
  assert.ok(!report.includes('GENESIS: JURIS CODEX'));
  for (const e of raw.evidence) assert.ok(report.includes(e.id), 'report preserves source ' + e.id);
  const changed = structuredClone(reopened); const scenario = changed.nodes.find(n => n.id.startsWith('outcome-'))!; scenario.detail = 'Hypothetical revised assumption: independent sampling is unavailable.'; assert.notEqual(caseFingerprint(changed), caseFingerprint(reopened)); assert.deepEqual(changed.nodes.filter(n => n.type === 'evidence'), reopened.nodes.filter(n => n.type === 'evidence')); const changedExport = await buildCaseMarkdown(changed, {status:'amended',language:locale}); assert.equal((await parseCaseMarkdown(changedExport.markdown))?.draft.nodes.find(n => n.id === scenario.id)?.detail, scenario.detail);
  draft.nodes[0].detail = 'Independent edit';
  assert.notEqual(buildConvertedExample(id, locale).nodes[0].detail, draft.nodes[0].detail);
  assert.equal(JSON.stringify(bundle), original, 'legacy simulation and source fingerprint unchanged');
});

test('substantive constraint options cannot be mistaken for training strain mechanics', () => {
  const raw = bundle.cases.find(item => item.case_id === 'be_commercial_failed_erp_001')!.scenario!;
  const original = JSON.stringify(bundle);
  const actions: Array<(typeof raw.actions)[number]> = raw.actions;
  const option = { ...structuredClone(actions[0]), id: 'assess_contract_constraint', title: 'Review a substantive contract constraint' };
  actions.push(option);
  try {
    const draft = buildConvertedExample('be_commercial_failed_erp_001', 'en');
    assert.equal(draft.nodes.find(node => node.id === 'action-assess_contract_constraint')?.title, option.title);
  } finally { actions.pop(); }
  assert.equal(JSON.stringify(bundle), original);
});

test('revised packages preserve authored judicial, task, deadline and decision consequences as hypotheses', () => {
  const judicial: Record<string, string> = { won: 'favorable judgment', lost: 'adverse judgment', partially_won: 'partial relief', dismissed: 'dismissal', none: 'no judgment' };
  const roles: Record<string, string> = { start_async_task: 'start', review_async_task: 'review', mark_async_task_ready: 'ready for review', expire_async_task: 'expiry', complete_deadline: 'completion', miss_deadline: 'miss' };
  const covered = new Set<string>();
  type AuditedEffect = { type: string; result?: string; task?: string; deadline?: string; decision?: string; item?: string };
  function verify(effects: readonly AuditedEffect[], records: StudioNode[], owner: string) {
    const text = records.map(record => record.detail).join('\n');
    for (const effect of effects) {
      if (effect.type === 'set_judicial_result') {
        assert.ok(effect.result, owner);
        assert.ok(text.includes('Hypothetical judgment: ' + judicial[effect.result] + ' (unrecorded).'), owner);
      } else if (effect.task && roles[effect.type]) {
        assert.ok(text.includes('Hypothetical task ' + roles[effect.type] + ': ' + effect.task), owner);
      } else if (effect.deadline && roles[effect.type]) {
        assert.ok(text.includes('Hypothetical deadline ' + roles[effect.type] + ': ' + effect.deadline), owner);
      } else if (effect.type === 'resolve_deterministic_decision') {
        assert.ok(effect.decision, owner);
        assert.ok(text.includes('Hypothetical scenario comparison: ' + effect.decision), owner);
        assert.ok(text.includes('no branch is selected'), owner);
      } else if (effect.type === 'create_inbox_item' || effect.type === 'resolve_inbox_item') {
        assert.ok(effect.item, owner);
        assert.ok(text.includes('Hypothetical correspondence ' + (effect.type === 'create_inbox_item' ? 'creation' : 'resolution') + ' (unrecorded):'), owner);
        assert.ok(text.includes(effect.item), owner);
      } else continue;
      covered.add(effect.type);
    }
  }
  for (const id of Object.keys(CONVERTED_EXAMPLES)) {
    const raw = bundle.cases.find(item => item.case_id === id)!.scenario!;
    const draft = buildConvertedExample(id, 'en');
    for (const action of raw.actions) {
      const node = draft.nodes.find(record => record.id === 'action-' + action.id);
      if (!node) continue;
      verify(action.effects, [node], action.id);
      for (const effect of action.effects) {
        if ('task' in effect) assert.ok(draft.links.some(link => link.from === node.id && link.to === 'task-' + effect.task), 'task reference ' + effect.task);
        if ('deadline' in effect) assert.ok(draft.links.some(link => link.from === node.id && link.to === 'deadline-' + effect.deadline), 'deadline reference ' + effect.deadline);
      }
      for (const effect of action.effects) if (effect.type === 'resolve_deterministic_decision' && 'decision' in effect && 'deterministic_decisions' in raw) {
        for (const branch of raw.deterministic_decisions?.find(item => item.id === effect.decision)?.branches ?? []) assert.ok(draft.links.some(link => link.from === node.id && link.to === 'branch-' + effect.decision + '-' + branch.id && link.rule?.label === 'Compare hypothetical branch'));
      }
    }
    if ('deterministic_decisions' in raw) for (const decision of raw.deterministic_decisions ?? []) {
      if (decision.id === 'inactivity_consequence') {
        assert.ok(!draft.nodes.some(node => node.id.startsWith('branch-inactivity_consequence-')), 'game inactivity ladder is not a professional decision branch');
        continue;
      }
      for (const branch of decision.branches) verify(branch.effects, [draft.nodes.find(node => node.id === 'branch-' + decision.id + '-' + branch.id)!], decision.id);
    }
    for (const event of raw.events) {
      const records = draft.nodes.filter(node => node.detail.includes('Hypothetical event ' + event.id + ':'));
      if (records.length) verify(event.effects, records, event.id);
    }
  }
  for (const type of ['set_judicial_result', 'start_async_task', 'review_async_task', 'mark_async_task_ready', 'expire_async_task', 'complete_deadline', 'miss_deadline', 'resolve_deterministic_decision', 'create_inbox_item', 'resolve_inbox_item']) assert.ok(covered.has(type), 'audited effect type ' + type);
});

test('Canopy retains nine documents, four variants, exact citations and independent edits', () => {
  assert.equal(new Set(CANOPY_SOURCES.map(s => s.id)).size, 9);
  assert.equal(CANOPY_SCENARIOS.length, 4);
  const fingerprints = new Set<string>();
  for (const variant of CANOPY_SCENARIOS) {
    const prepared = buildCanopyPackage(variant.id, true);
    const working = createExampleWorkingCopy(prepared.draft);
    assert.equal(studioOverview(working, 'en').documentCount, 9);
    assert.equal(studioOverview(working, 'en').exactScenario, variant.id);
    working.nodes[0].detail += ' Independent edited assumption.';
    assert.equal(studioOverview(working, 'en').recommendation.state, 'reassessment');
    assert.equal(studioOverview(working, 'en').documentCount, 9);
    const reopened = normalizeStudioDraft(JSON.parse(JSON.stringify(prepared.draft)));
    assert.equal(reopened.caseType?.id, 'general_advisory');
    assert.equal(studioOverview(prepared.draft, 'en').documentCount, 9);
    assert.equal(studioOverview(prepared.draft, 'en').exactScenario, variant.id);
    assert.ok(studioOverview(prepared.draft, 'en').references.every(r => r.source && r.excerpt));
    fingerprints.add(caseFingerprint(reopened));
    prepared.draft.nodes[0].detail = 'Changed copy';
    assert.notEqual(buildCanopyPackage(variant.id, true).draft.nodes[0].detail, 'Changed copy');
  }
  assert.equal(fingerprints.size, 4);
  for (const revision of [1, 2, 3]) assert.equal(isSupportedPlayedCaseSchemaRevision(revision), true);
});

test('ordinary cards open Studio examples and omit gameplay badges', () => {
  const html = renderToStaticMarkup(createElement(DemoCatalogueCards, { locale: 'en', cards: [{id:'erp',title:'ERP',summary:'Mandate',jurisdiction:'BE',practice:'Litigation strategy',duration:45,version:'2.0.0',review:'Pending',author:'CaseVant',output:'Strategy and risk report'}], showCanopy:true, busy:false, launch:()=>{}, feedback:()=>{}, openCanopy:async()=>{}, canopyWorkflowHref:'/canopy' }));
  assert.match(html, /Featured example.*Advisory decision/);
  assert.match(html, /Open example case/);
  assert.match(html, /Take guided walkthrough/);
  assert.doesNotMatch(html, /Start simulation|Decision simulation|45 min|Stamina|Fatigue/);
});

 test("legacy fact nodes keep their exact fingerprint and default projection", () => { const draft = buildCanopyPackage("base", true).draft; const normalized = normalizeStudioDraft(draft); assert.equal(caseFingerprint(draft),caseFingerprint(normalized)); assert.ok(projectCaseCoreV2(draft).facts.every(f => f.status === "asserted")); });
