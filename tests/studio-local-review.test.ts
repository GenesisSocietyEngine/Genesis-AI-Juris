import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { buildCanopyPackage } from '../app/canopy-fixture';
import { planStudioPromptIteration, type StudioPromptPlan } from '../app/studio-editing';
import { applyReviewedLocalPrompt, studioLocalReview } from '../app/studio-local-review';
import type { StudioNodeType } from '../app/types';

const nodeLabels:Record<StudioNodeType,string>={trigger:'Trigger',actor:'Actor',fact:'Fact',evidence:'Evidence',deadline:'Deadline',decision:'Decision',outcome:'Outcome',entity:'Entity',tax_rule:'Tax rule',cash_flow:'Cash flow'};
const draft=buildCanopyPackage('base').draft, at='2026-11-02T00:00:00Z';
const instruction='Add 2 evidence nodes named “QA synthetic record”.';
const plan=planStudioPromptIteration(draft,{instruction,locale:'en',nodeLabels,selectedNodeId:null});
const options={instruction,locale:'en' as const,nodeLabels,selectedNodeId:null,createdAt:at};

test('local reviewed execution applies the exact current proposal without changing the source',()=>{
  const before=JSON.stringify(draft), review=studioLocalReview(draft,plan,'en',null);
  const result=applyReviewedLocalPrompt(draft,{...options,review});
  assert.ok(result?.changed);
  assert.equal(result.draft.nodes.length,draft.nodes.length+2);
  assert.equal(result.draft.nodes.at(-1)?.title,'QA synthetic record 2');
  assert.equal(JSON.stringify(draft),before);
  assert.equal(result.draft.exampleSource,draft.exampleSource);
  assert.ok(result.draft.editHistory.length>draft.editHistory.length);
});

test('changed source, brief, locale or selected node refuses reviewed execution',()=>{
  const review=studioLocalReview(draft,plan,'en',null), before=JSON.stringify(draft);
  assert.equal(applyReviewedLocalPrompt({...draft,title:'Changed after review'},{...options,review}),null);
  assert.equal(applyReviewedLocalPrompt(draft,{...options,instruction:'Add actor.',review}),null);
  assert.equal(applyReviewedLocalPrompt(draft,{...options,locale:'ru',review}),null);
  assert.equal(applyReviewedLocalPrompt(draft,{...options,selectedNodeId:draft.nodes[0].id,review}),null);
  assert.equal(JSON.stringify(draft),before,'refusal mutates no case or history');
});

const bundle=await build({entryPoints:['app/StudioLocalPlanReview.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'}});
mkdirSync('.artifacts/local-review-tests',{recursive:true});
const file=resolve('.artifacts/local-review-tests/component.mjs');writeFileSync(file,bundle.outputFiles[0].text);
const Component=(await import(pathToFileURL(file).href)).default;
const props={locale:'en',plan,nodeTitles:new Map(draft.nodes.map(n=>[n.id,n.title])),linkEndpoints:new Map(),canApply:true,onApply(){},onEdit(){}};

test('actual local proposal lists complete changes before Apply, with bilingual plain labels',()=>{
  for(const locale of ['en','ru'] as const){
    const html=renderToStaticMarkup(createElement(Component,{...props,locale}));
    assert.ok(html.includes(locale==='en'?'Review local changes':'Проверьте локальные изменения'));
    assert.ok(html.includes(locale==='en'?'Edit brief':'Изменить описание'));
    const label=locale==='en'?'Apply these changes':'Применить эти изменения';
    assert.ok(html.lastIndexOf('</ol>')<html.indexOf(label));
    assert.equal((html.match(/<li>/g)??[]).length,plan.operations.length);
    assert.doesNotMatch(html,/fallback|LOCALLY INTERPRETED|профессиональное утверждение зафиксировано/);
  }
});

test('actual rendered Apply control is disabled for blocked authority or invalid proposals',()=>{
  let applied=0;
  for(const [canApply,canPlan] of [[false,true],[true,false],[true,true]]){
    const html=renderToStaticMarkup(createElement(Component,{...props,canApply,plan:{...plan,canApply:canPlan},onApply(){applied++;}}));
    const button=html.match(/<button[^>]*>Apply these changes<\/button>/)?.[0]; assert.ok(button);
    assert.equal(button.includes('disabled'),!(canApply&&canPlan));
  }
  assert.equal(applied,0,'rendering never applies a proposal');
});

test('context-only proposals explicitly disclose that they do not create case records',()=>{
  const context:StudioPromptPlan={instruction:'Synthetic background only',operations:[],diagnostics:[],canApply:true,contextOnly:true,planner:'deterministic'};
  for(const locale of ['en','ru'] as const){
    const html=renderToStaticMarkup(createElement(Component,{...props,locale,plan:context}));
    assert.ok(html.includes(locale==='en'?'It will not create case records.':'Новые записи не появятся.'));
    assert.ok(html.includes(locale==='en'?'Add text to case context':'Добавить текст в контекст'));
  }
});
