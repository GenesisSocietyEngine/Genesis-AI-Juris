import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TrainingVideo from '../app/TrainingVideo';
import training from '../app/training-current.json';
import { helpContent } from '../app/help-content';
import { createRecordingMedia } from '../app/recording-media';

const manifest=JSON.parse(readFileSync('public/help/training-20261103/manifest.json','utf8'));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const ascii=(data:Uint8Array,start:number,end:number)=>new TextDecoder('ascii').decode(data.subarray(start,end));
function boxes(data:Uint8Array,start=0,end=data.length){
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const result:Array<{kind:string;start:number;end:number;offset:number}>=[];
  for(let at=start;at+8<=end;){
    let size=view.getUint32(at),header=8;
    if(size===1){size=Number(view.getBigUint64(at+8));header=16;}
    if(size===0)size=end-at;
    assert.ok(size>=header&&at+size<=end);
    result.push({kind:ascii(data,at+4,at+8),start:at+header,end:at+size,offset:at});at+=size;
  }
  return result;
}

test('current training is a decoded four-minute audio/video guide without a subtitle stream',()=>{
  assert.equal(training.durationSeconds,240);assert.equal(training.scenes.length,8);
  assert.equal(manifest.durationSeconds,240);assert.equal(manifest.firstVideoFrameSeconds,0);
  assert.equal(manifest.fullyDecoded,true);assert.equal(manifest.burnedInNarration,false);assert.equal(manifest.subtitleStreams,0);
  assert.equal(manifest.workflowSourceCommit,'c295a1a968611104b40e0923b3d480e77bfb5b20');
  assert.equal(sha(readFileSync('app/training-current.json')),manifest.scriptSha256);
  assert.equal(sha(readFileSync('scripts/training/20261103/render.py')),manifest.rendererSha256);
  const bytes=readFileSync('public'+training.video),top=boxes(bytes),movie=top.find(b=>b.kind==='moov')!;
  assert.ok(bytes.length<8*1024*1024);assert.ok(movie.offset<top.find(b=>b.kind==='mdat')!.offset);
  const handlers=boxes(bytes,movie.start,movie.end).filter(b=>b.kind==='trak').map(track=>{
    const media=boxes(bytes,track.start,track.end).find(b=>b.kind==='mdia')!;
    const handler=boxes(bytes,media.start,media.end).find(b=>b.kind==='hdlr')!;
    return ascii(bytes,handler.start+8,handler.start+12);
  });
  assert.deepEqual(handlers.sort(),['soun','vide']);
  for(const asset of manifest.assets){const actual=readFileSync('public'+asset.path);assert.equal(actual.length,asset.bytes);assert.equal(sha(actual),asset.sha256);}
  for(const [index,scene]of training.scenes.entries()){
    assert.equal(scene.at,index*30);assert.equal(manifest.scenes[index].at,scene.at);
    assert.ok(manifest.scenes[index].speechSeconds>1&&manifest.scenes[index].speechSeconds<29.5);
    assert.equal(sha(readFileSync(`scripts/training/20261103/frames/${scene.id}.jpg`)),manifest.scenes[index].frameSha256);
  }
});

test('both locales offer no subtitle tracks or caption links and retain every spoken scene as readable text',()=>{
  for(const locale of ['en','ru'] as const){
    const html=renderToStaticMarkup(createElement(TrainingVideo,{locale}));
    assert.doesNotMatch(html,/<track\b|\.vtt|autoPlay=|autoplay=/);
    assert.match(html,/preload="none"/);assert.ok(html.includes(training.title[locale]));
    assert.ok(html.includes(locale==='en'?'No subtitles':'Без субтитров'));
    assert.ok(html.includes(`/help/training-20261103/transcript.${locale}.md`));
    const transcript=readFileSync(`public/help/training-20261103/transcript.${locale}.md`,'utf8');
    for(const scene of training.scenes){assert.ok(html.includes(scene.narration[locale]));assert.ok(transcript.includes(scene.narration[locale]));}
    assert.match(html,/not a screen recording|Это не запись экрана/);
  }
});

test('downloadable quick starts match the current bilingual evidence, save and report guidance',()=>{
  for(const locale of ['en','ru'] as const){
    const quick=readFileSync(`public/help/casevant-quick-start.${locale}.md`,'utf8');assert.match(quick,/2026-11-03/);
    assert.equal(helpContent[locale].guides.length,9);
    for(const [title,body]of helpContent[locale].guides){assert.ok(quick.includes(title));assert.ok(quick.includes(body));}
    assert.match(quick,/Cancel|отмен/);assert.match(quick,/Full analysis|Полный анализ/);
  }
});

test('new training media uses a bounded public-only loader and refuses oversized responses',async()=>{
  let size=2*1024*1024,created=0;
  const media=createRecordingMedia(training.video,{fetch:async(path,options)=>{
    assert.equal(path,training.video);assert.equal(options?.credentials,'omit');assert.equal(options?.redirect,'error');
    return new Response(new Uint8Array(size),{headers:{'content-type':'video/mp4'}});
  },create:()=>{created++;return 'blob:training';},revoke(){}});
  assert.equal(await media.load(),'blob:training');assert.equal(created,1);media.dispose();
  size=8*1024*1024+1;
  const tooLarge=createRecordingMedia(training.video,{fetch:async()=>new Response(new Uint8Array(size),{headers:{'content-type':'video/mp4'}}),create:()=>{throw Error('must not create');},revoke(){}});
  await assert.rejects(tooLarge.load(),/size invalid/);tooLarge.dispose();
});
