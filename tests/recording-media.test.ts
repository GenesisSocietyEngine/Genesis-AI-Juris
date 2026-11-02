import assert from 'node:assert/strict';
import test from 'node:test';
import {createRecordingMedia} from '../app/recording-media';

const path='/help/scenarios-20261102/canopy.mp4';
test('full 200 media response without byte ranges becomes one reusable seekable blob URL',async()=>{
  let calls=0,created=0;const revoked:string[]=[];
  const media=createRecordingMedia(path,{fetch:async(url,options)=>{
    calls++;assert.equal(url,path);assert.equal(options?.credentials,'omit');assert.equal(options?.redirect,'error');
    return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'video/mp4'}});
  },create:blob=>{created++;assert.equal(blob.size,3);assert.equal(blob.type,'video/mp4');return 'blob:recording';},revoke:url=>revoked.push(url)});
  assert.equal(calls,0,'no eager download');
  assert.deepEqual(await Promise.all([media.load(),media.load()]),['blob:recording','blob:recording']);
  assert.equal(await media.load(),'blob:recording');assert.equal(calls,1);assert.equal(created,1);
  media.dispose();assert.deepEqual(revoked,['blob:recording']);await assert.rejects(media.load(),/closed/);
});
test('unmount cancels an outstanding response and never creates a stale object URL',async()=>{
  let complete!:(response:Response)=>void,signal:AbortSignal|undefined,created=0;
  const media=createRecordingMedia(path,{fetch:async(_url,options)=>{signal=options?.signal??undefined;return new Promise(resolve=>{complete=resolve;});},create:()=>{created++;return 'blob:stale';},revoke(){}});
  const result=media.load();media.dispose();assert.equal(signal?.aborted,true);
  complete(new Response(new Uint8Array([1]),{headers:{'content-type':'video/mp4'}}));
  await assert.rejects(result,/closed/);assert.equal(created,0);
});
test('wrong route, failed response, wrong type and oversized media fail without a URL; retry is possible',async()=>{
  let calls=0;const media=createRecordingMedia(path,{fetch:async()=>{
    calls++;if(calls===1)return new Response('no',{status:503});
    if(calls===2)return new Response('html',{headers:{'content-type':'text/html'}});
    if(calls===3)return new Response(new Uint8Array(1024*1024+1),{headers:{'content-type':'video/mp4'}});
    return new Response(new Uint8Array([1]),{headers:{'content-type':'video/mp4'}});
  },create:()=> 'blob:retry',revoke(){}});
  for(let i=0;i<3;i++)await assert.rejects(media.load());
  assert.equal(await media.load(),'blob:retry');media.dispose();
  const bad=createRecordingMedia('https://elsewhere.example/private',{fetch:()=>{throw new Error('must not fetch');},create:()=>'',revoke(){}});
  await assert.rejects(bad.load(),/Unknown/);bad.dispose();
});
