import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = import.meta.dirname, base = 'http://localhost:5281';
const fixture = JSON.parse(readFileSync(join(root, 'governed-fixture-state.json'), 'utf8'));
const credentials = JSON.parse(readFileSync(join(root, 'credentials.local.json'), 'utf8')).credentials;
const receiptPath = join(root, 'amendment-assumption-evidence.json');
const result = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : {
  startedAt: new Date().toISOString(), sourceCommit: '8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6',
  buildDigest: '25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec',
  environment: base, scope: 'Ordinary local synthetic role APIs; assumption review/supersession/replacement, no source upload',
  dossierId: fixture.dossierId, events: [], steps: {},
};
const sessions = new Map();
const save = () => writeFileSync(receiptPath, JSON.stringify(result, null, 2));
const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex');
async function api(alias, path, {method='GET', body, expected=[200], organization=fixture.actors[alias].teamSelection, bytes=false}={}) {
  const session = sessions.get(alias) ?? new Map(); sessions.set(alias,session);
  const headers = { Origin:base, 'Sec-Fetch-Site':'same-origin' };
  if (session.size) headers.Cookie=[...session].map(([k,v])=>`${k}=${v}`).join('; ');
  if (organization) headers['x-genesis-organization']=organization;
  if (body) headers['Content-Type']='application/json';
  const response=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30_000)});
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';',1)[0], at=pair.indexOf('=');session.set(pair.slice(0,at),pair.slice(at+1));}
  const data=bytes?new Uint8Array(await response.arrayBuffer()):await response.json();
  result.events.push({at:new Date().toISOString(),alias,method,path,status:response.status,expected:expected.includes(response.status),...(data?.code?{code:data.code}:{})});save();
  assert.ok(expected.includes(response.status),`${alias} ${method} ${path}: ${response.status}, ${data?.code??'no code'}`);
  return data;
}
const path=`/api/dossiers/${fixture.dossierId}`;
const detail=async(alias='owner')=>(await api(alias,path)).dossier;
async function once(key,run){if(result.steps[key])return result.steps[key];const value=await run();result.steps[key]=value;save();return value;}
async function assertionAction(alias,body){const current=await detail(alias);return api(alias,path+'/evidence/assertions',{method:'POST',body:{...body,expectedRevision:current.revision},expected:[200,201]});}
try {
  for(const alias of ['owner','contributor','reviewer','viewer']){
    const credential=credentials.find(item=>item.alias===alias);assert.ok(credential);
    const login=await api(alias,'/api/auth/login',{method:'POST',organization:null,body:{email:credential.email,password:credential.password}});assert.equal(login.authenticated,true);
  }
  const originalId=fixture.steps['assertion-assumption'].id, sourceId=fixture.steps['anchor-assumption'].id;
  const filePath=path+`/documents/${fixture.documentId}/versions/${fixture.version1Id}/download`;
  await once('before',async()=>{const current=await detail(); const outputs=await api('owner',path+'/outputs'); const packages=await api('owner',path+'/decision-packages'); const bytes=await api('viewer',filePath,{bytes:true});return {revision:current.revision,assertions:current.assertions,readiness:current.readiness,outputCount:outputs.outputs.length,packageCount:packages.decision_packages.length,sourceVersion:fixture.version1Id,sourceSha256:fingerprint(bytes)};});
  await once('viewer-review-denied',async()=>{const before=await detail();await api('viewer',path+'/evidence/assertions',{method:'POST',body:{action:'review',assertionId:originalId,decision:'accepted',expectedRevision:before.revision},expected:[404]});const after=await detail();assert.equal(after.revision,before.revision);return {status:404,revisionUnchanged:after.revision};});
  await once('original-reviewed',async()=>{const changed=await assertionAction('reviewer',{action:'review',assertionId:originalId,decision:'accepted'});assert.equal(changed.assertion.status,'accepted');assert.equal(changed.assertion.reviewed_by,fixture.actors.reviewer.actorId);return changed;});
  await once('original-superseded',async()=>{const changed=await assertionAction('contributor',{action:'supersede',assertionId:originalId});assert.equal(changed.assertion.status,'superseded');return changed;});
  await once('replacement-created',async()=>{const changed=await assertionAction('contributor',{action:'create',assertionType:'assumption',statement:'SYNTHETIC sensitivity assumption: the cited v1 passage forecasts 150 additional commitments. For a separate cautious sensitivity, suppose only 120 arrive. The 120 quantity is an unverified analyst assumption, not a fact supplied by that source; delivery-capacity evidence remains missing.',sourceAnchorIds:[sourceId]});assert.notEqual(changed.assertion.assertion_id,originalId);assert.equal(changed.assertion.status,'needs_review');assert.equal(changed.assertion.reviewed_by,null);assert.equal(changed.assertion.reviewed_at,null);return changed;});
  await once('snapshot-prerequisites',async()=>{const current=await detail();const response=await api('owner',path+'/snapshots',{method:'POST',body:{expectedRevision:current.revision,locale:'en',audience:'internal',redactionProfileId:'pilot-default'},expected:[409]});assert.equal(response.code,'snapshot_not_ready');return {status:409,code:response.code,error:response.error};});
  await once('after',async()=>{const current=await detail();const old=current.assertions.find(item=>item.assertion_id===originalId), fresh=current.assertions.find(item=>item.assertion_id===result.steps['replacement-created'].assertion.assertion_id);assert.ok(old&&fresh);assert.equal(old.statement,result.steps.before.assertions.find(item=>item.assertion_id===originalId).statement);assert.equal(old.status,'superseded');assert.equal(old.reviewed_by,fixture.actors.reviewer.actorId);assert.equal(fresh.status,'needs_review');assert.equal(fresh.reviewed_by,null);assert.equal(current.assertions.find(item=>item.assertion_id===fixture.steps['assertion-fact'].id).status,'accepted');assert.equal(current.assertions.find(item=>item.assertion_id===fixture.steps['assertion-contradiction'].id).status,'needs_review');const source=await api('viewer',filePath,{bytes:true});assert.equal(fingerprint(source),result.steps.before.sourceSha256);const outputs=await api('owner',path+'/outputs');assert.equal(outputs.outputs.length,result.steps.before.outputCount);return {revision:current.revision,oldAssertion:old,replacementAssertion:fresh,readiness:current.readiness,sourceVersion:fixture.version1Id,sourceSha256:fingerprint(source),outputCount:outputs.outputs.length};});
  result.completedAt=new Date().toISOString();result.status='PASS scoped assumption and denial checks; governed output remains blocked by recorded readiness prerequisites';save();console.log(JSON.stringify({status:result.status,dossierId:fixture.dossierId,before:result.steps.before.revision,after:result.steps.after.revision,snapshot:result.steps['snapshot-prerequisites'],receipt:receiptPath}));
} catch(error){result.status='INCOMPLETE';result.failure={at:new Date().toISOString(),message:String(error.message)};save();console.error(JSON.stringify(result.failure));process.exitCode=1;}
