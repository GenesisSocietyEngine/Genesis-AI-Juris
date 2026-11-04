import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import GenesisNavigation from '../app/GenesisNavigation';
import recordings from '../app/scenario-recordings.json';

const root=process.cwd(),manifest=JSON.parse(readFileSync('public/help/scenarios-20261102/manifest.json','utf8'));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
test('recordings bind actual captured frames and every published asset to exact hashes',()=>{
  assert.equal(recordings.length,2);assert.equal(manifest.scenarios.length,2);
  assert.match(manifest.format,/step captures/);assert.match(manifest.environment,/local/);
  assert.equal(manifest.sourceCommit,'a8b919a03ebdfff32297f881f316aab0b9a377ca');
  for(const scenario of manifest.scenarios){
    assert.ok(scenario.fullyDecoded);assert.equal(scenario.durationSeconds,scenario.captures.length*8);
    for(const frame of scenario.captures){
      const file=resolve(root,'scripts/training/scenarios-20261102',frame.file);
      assert.ok(file.startsWith(resolve(root,'scripts/training/scenarios-20261102/screens')));
      const bytes=Buffer.from(readFileSync(file));assert.equal(sha(bytes),frame.sha256);assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
      assert.match(frame.url,/^http:\/\/127\.0\.0\.1:4187\/studio/);
    }
    for(const asset of scenario.assets){
      const bytes=Buffer.from(readFileSync(resolve(root,'public',asset.path.slice(1))));
      assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);
      if(asset.path.endsWith('.mp4')){assert.ok(bytes.length<24*1024*1024);assert.equal(bytes.subarray(4,8).toString(),'ftyp');assert.ok(bytes.indexOf('moov')<bytes.indexOf('mdat'),'fast start');}
    }
  }
});

test('each EN/RU caption and transcript covers the complete recorded step timeline',()=>{
  const stamp=(n:number)=>`${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}.000`;
  for(const recording of recordings) for(const locale of ['en','ru'] as const){
    const prefix='public'+recording.video.replace('.mp4','');
    const vtt=readFileSync(`${prefix}.${locale}.vtt`,'utf8'),transcript=readFileSync(`${prefix}.${locale}.md`,'utf8');
    assert.ok(vtt.startsWith('WEBVTT\n'));assert.equal((vtt.match(/ --> /g)??[]).length,recording.steps.length);
    recording.steps.forEach(step=>{assert.ok(vtt.includes(`${stamp(step.at)} --> ${stamp(step.at+8)}`));assert.ok(vtt.includes(step.text[locale]));assert.ok(transcript.includes(step.text[locale]));});
    assert.match(transcript,/local preview|локальн(?:ая версия|ой версии)/);assert.match(transcript,/Not continuous|не непрерывная/);
  }
});

const bundle=await build({entryPoints:['app/HelpCenter.tsx'],bundle:true,write:false,format:'esm',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'}});
mkdirSync('.artifacts/scenario-recording-tests',{recursive:true});const file=resolve('.artifacts/scenario-recording-tests/help.mjs');writeFileSync(file,bundle.outputFiles[0].text);
const Help=(await import(pathToFileURL(file).href)).default;
test('actual bilingual Help offers two native non-autoplay players, readable steps and scope labels',()=>{
  for(const locale of ['en','ru'] as const){
    const html=renderToStaticMarkup(createElement(Help,{locale,onNavigate(){}}));
    const current=html.slice(html.indexOf('id="recordings"'),html.indexOf('id="guides"'));
    assert.equal((current.match(/<video /g)??[]).length,2);
    assert.equal((current.match(/preload="none"/g)??[]).length,2);
    assert.equal((current.match(/<track /g)??[]).length,0);
    assert.doesNotMatch(current,/Download captions|Скачать субтитры/);
    assert.doesNotMatch(current,/<video[^>]*autoplay/i);
    assert.match(current,/local preview|локальной версии/);
    for(const recording of recordings){assert.ok(current.includes(recording.video));assert.ok(current.includes(recording.video.replace('.mp4',`.${locale}.md`)));assert.ok(current.includes(recording.title[locale]));}
    assert.match(html,/Earlier Five Flats|Предыдущий текст/);
  }
});

test('Help recordings open separately with a stable subsection URL and preserve draft context',()=>{
  const html=renderToStaticMarkup(createElement(GenesisNavigation,{locale:'en',active:'studio',location:'/studio?view=studio&lang=en',onLanguage(){}}));
  const anchor=html.match(/<a[^>]*href="[^"]*#recordings"[^>]*>Scenario recordings[^<]*<\/a>/)?.[0];
  assert.ok(anchor);assert.match(anchor,/target="_blank"/);assert.match(anchor,/rel="noopener noreferrer"/);
  assert.match(anchor,/view=help/);
});
