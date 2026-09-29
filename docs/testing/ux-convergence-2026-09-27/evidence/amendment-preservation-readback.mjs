import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root=import.meta.dirname, base='http://localhost:5281';
const fixture=JSON.parse(readFileSync(join(root,'governed-fixture-state.json'),'utf8'));
const previousBytes=readFileSync(join(root,'amendment-assumption-evidence.json'));
const previous=JSON.parse(previousBytes);
const credential=JSON.parse(readFileSync(join(root,'credentials.local.json'),'utf8')).credentials.find(item=>item.alias==='owner');
const cookies=new Map(), events=[];
async function request(path,body){
  const headers={Origin:base,'Sec-Fetch-Site':'same-origin'};
  if(cookies.size)headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
  if(body)headers['Content-Type']='application/json';
  if(!body)headers['x-genesis-organization']=fixture.actors.owner.teamSelection;
  const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30_000)});
  for(const c of r.headers.getSetCookie()){const p=c.split(';',1)[0],at=p.indexOf('=');cookies.set(p.slice(0,at),p.slice(at+1));}
  const data=await r.json();events.push({path,method:body?'POST':'GET',status:r.status});assert.equal(r.status,200);return data;
}
const startedAt=new Date().toISOString();
await request('/api/auth/login',{email:credential.email,password:credential.password});
const current=(await request(`/api/dossiers/${fixture.dossierId}`)).dossier;
const records=[];
for(const kind of ['fact','contradiction']){
  const id=fixture.steps[`assertion-${kind}`].id;
  const before=previous.steps.before.assertions.find(x=>x.assertion_id===id);
  const after=current.assertions.find(x=>x.assertion_id===id);
  assert.ok(before&&after);assert.deepEqual(after,before);
  records.push({kind,before,after,completeReadModelEquality:true});
}
assert.equal(current.revision,previous.steps.after.revision);
const receipt={startedAt,completedAt:new Date().toISOString(),status:'PASS',scope:'Independent fresh API readback of complete fact/contradiction assertion read models, not database row/audit history equality',applicationCommit:previous.sourceCommit,buildDigest:previous.buildDigest,assumptionReceiptSha256:createHash('sha256').update(previousBytes).digest('hex'),revision:current.revision,events,records};
writeFileSync(join(root,'amendment-preservation-evidence.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({status:receipt.status,revision:receipt.revision,completeReadModelsCompared:records.length}));
