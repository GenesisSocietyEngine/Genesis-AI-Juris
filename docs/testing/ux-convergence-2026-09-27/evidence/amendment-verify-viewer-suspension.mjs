import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname);
const base = 'http://localhost:5281';
const orgId = 'org_15eba3abeeb241c6899481f557186dd4';
const dossierId = 'dossier_4c45577c6bc54528b9330d018a893312';
const viewerActor = 'actor_be30f5cfe01560dd0ad87fa0986d2246';
const ownerActor = 'actor_f2cda772e48213c433230b4319b195d5';
const documentId = 'document_544afe4d7e6345d7a8bb82d3640f3db4';
const versionId = 'document_version_74cafe3815474c808a7adfea87340a1d';
const expectedSourceHash = 'f2d072fa17fd69a13399e0f4a3019a0eca55cfdbad53783cf48f862334f5a84e';
const detailPath = `/api/dossiers/${dossierId}`;
const documentPath = `${detailPath}/documents`;
const downloadPath = `${documentPath}/${documentId}/versions/${versionId}/download`;
const startedAt = new Date().toISOString();
const evidenceName = `amendment-viewer-suspension-${startedAt.replaceAll(':','').replaceAll('.','')}.json`;
const evidencePath = resolve(root, '../../docs/testing/ux-convergence-2026-09-27/evidence', evidenceName);
if (!root.endsWith('ux-reconciliation-auth') || existsSync(evidencePath)) throw new Error('Unexpected artifact location');
const credentials = JSON.parse(readFileSync(join(root, 'credentials.local.json'), 'utf8')).credentials;
const sessions = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
const digest = value => hash(canonical(value));
const check = (condition, label) => { if (!condition) throw new Error(label); };
const record = {
  startedAt, status:'RUNNING', origin:base, localOnly:true,
  applicationCommit:'8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6',
  builtInputDigest:'25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec',
  scope:'Ordinary API suspension/restoration of one existing synthetic viewer organization membership. No browser, upload, direct DB mutation, invitation, credential change, or new role.',
  organizationId:orgId, dossierId, documentId, sourceVersionId:versionId, viewerActorId:viewerActor,
  events:[], checks:[], restoration:{required:false,confirmed:false}, sessionCleanup:[],
};
const persist = () => writeFileSync(evidencePath, JSON.stringify(record,null,2)+'\n');
persist();
function pass(name, detail={}) { record.checks.push({name,status:'PASS',at:new Date().toISOString(),...detail}); persist(); }
async function api(alias,path,{method='GET',body,organization=orgId,expected=[200],bytes=false}={}) {
  let jar=sessions.get(alias); if(!jar){jar=new Map();sessions.set(alias,jar);}
  const headers={Origin:base,'Sec-Fetch-Site':'same-origin'};
  if(jar.size) headers.Cookie=[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
  if(organization) headers['x-genesis-organization']=organization;
  if(body!==undefined) headers['Content-Type']='application/json';
  let response;
  try { response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)}); }
  catch { record.events.push({at:new Date().toISOString(),alias,method,path,transportFailure:true});persist();throw new Error(`Transport failure during ${alias} ${method} ${path}`); }
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';',1)[0];const at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}
  const raw=new Uint8Array(await response.arrayBuffer());
  let data;
  try {data=bytes?raw:JSON.parse(new TextDecoder().decode(raw));}
  catch {throw new Error(`Invalid JSON during ${alias} ${method} ${path}`);}
  const safeCode=typeof data?.code==='string'&&/^[a-z_]+$/.test(data.code)?data.code:undefined;
  record.events.push({at:new Date().toISOString(),alias,method,path,status:response.status,
    ...(safeCode?{code:safeCode}:{}),responseBytes:raw.length,
    contentType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),
    expected:expected.includes(response.status)});persist();
  check(expected.includes(response.status),`Unexpected HTTP ${response.status} during ${alias} ${method} ${path}`);
  return {status:response.status,data,raw};
}
const memberSummary=m=>({actorId:m.actorId,role:m.role,status:m.status,revision:m.revision});
async function ownerRoster(){const data=(await api('owner','/api/organizations')).data;
  check(data.actorId===ownerActor&&data.selected?.id===orgId&&data.selected?.role==='org_owner','Owner identity/organization authority mismatch');
  return data.members.map(memberSummary).sort((a,b)=>a.actorId.localeCompare(b.actorId));}
function withoutReadiness(payload){const {readiness,...dossier}=payload.dossier;return dossier;}
let original, beforeRoster, beforeDossier, beforeDocuments, beforeClaims, oldViewerSelection;
let suspensionAttempted=false, mainFailure=null, restoreFailure=null;
try {
  for(const alias of ['owner','viewer']){
    const credential=credentials.find(c=>c.alias===alias);check(Boolean(credential),'Missing required local fixture credential');
    const login=await api(alias,'/api/auth/login',{method:'POST',organization:null,body:{email:credential.email,password:credential.password}});
    check(login.data.authenticated===true&&login.data.authSource==='local',`Ordinary ${alias} local sign-in failed`);
  }
  beforeRoster=await ownerRoster(); original=beforeRoster.find(m=>m.actorId===viewerActor);
  check(original?.status==='active'&&original.role==='member'&&Number.isSafeInteger(original.revision),'Viewer original organization membership mismatch');
  record.originalMembership=original;record.originalOtherMembers=beforeRoster.filter(m=>m.actorId!==viewerActor);persist();
  const viewerOrg=(await api('viewer','/api/organizations')).data;
  check(viewerOrg.actorId===viewerActor&&viewerOrg.selected?.id===orgId&&viewerOrg.selected?.role===original.role,'Viewer actor-specific organization authority mismatch');
  oldViewerSelection=viewerOrg.selected.selection;
  check(oldViewerSelection.endsWith('.'+viewerActor),'Viewer selection is not actor-bound');
  const viewerBefore=(await api('viewer',detailPath,{organization:oldViewerSelection})).data;
  beforeDossier=(await api('owner',detailPath)).data;
  beforeClaims=withoutReadiness(beforeDossier);
  check(beforeClaims.revision===21,'Expected fixtureC revision21 before suspension');
  check(viewerBefore.dossier.current_role==='viewer','Existing dossier participation is not viewer');
  const viewerParticipant=beforeClaims.participants.find(p=>p.actor_id===viewerActor);
  check(viewerParticipant?.role==='viewer'&&viewerParticipant.status==='active','Existing viewer participant mismatch');
  beforeDocuments=(await api('viewer',documentPath,{organization:oldViewerSelection})).data;
  const beforeFile=(await api('viewer',downloadPath,{organization:oldViewerSelection,bytes:true})).data;
  check(beforeFile.length===422&&hash(beforeFile)===expectedSourceHash,'Original exact-v1 file hash/length mismatch');
  record.baseline={dossierRevision:21,dossierWithoutReadinessSha256:digest(beforeClaims),
    assertionsSha256:digest(beforeClaims.assertions),participantsSha256:digest(beforeClaims.participants),
    documentsSha256:digest(beforeDocuments),viewerParticipant,sourceBytes:beforeFile.length,sourceSha256:hash(beforeFile),
    viewerMembershipRevision:viewerOrg.selected.membershipRevision};
  pass('Ordinary owner/viewer login and existing exact viewer dossier/source access');
  suspensionAttempted=true;record.restoration.required=true;persist();
  const suspended=await api('owner','/api/organizations',{method:'POST',body:{action:'member',organizationId:orgId,
    actorId:viewerActor,role:original.role,status:'suspended',expectedRevision:original.revision}});
  check(suspended.data.ok===true,'Suspension success receipt missing');
  const duringRoster=await ownerRoster();const during=duringRoster.find(m=>m.actorId===viewerActor);
  check(during?.status==='suspended'&&during.role===original.role&&during.revision===original.revision+1,'Suspended membership readback mismatch');
  check(canonical(duringRoster.filter(m=>m.actorId!==viewerActor))===canonical(record.originalOtherMembers),'Other memberships changed during suspension');
  record.suspendedMembership=during;
  for(const path of [detailPath,documentPath,downloadPath]){
    const denied=await api('viewer',path,{organization:oldViewerSelection,expected:[404]});
    check(denied.data.code==='organization_unavailable','Suspended viewer wrong denial code');
    check(Object.keys(denied.data).every(k=>['error','code'].includes(k)),'Private denial contains unexpected content fields');
    check(!new TextDecoder().decode(denied.raw).includes('SYNTHETIC'),'Private denial contains fixture content');
  }
  pass('Same viewer session and old selection denied dossier/documents/exact-version bytes after suspension',{statusCode:404,code:'organization_unavailable',privatePayloadOnly:true});
} catch(error) {
  mainFailure=error instanceof Error?error.message:'Unclassified bounded-check failure';
  record.failure=mainFailure;persist();console.error('CHECK FAILED; attempting protected restoration. '+mainFailure);
} finally {
  if(suspensionAttempted&&original){
    for(let attempt=1;attempt<=2&&!record.restoration.confirmed;attempt++){
      try{
        const roster=await ownerRoster();const current=roster.find(m=>m.actorId===viewerActor);
        check(current?.role===original.role,'Restoration refuses unexpected role');
        check(['active','suspended'].includes(current.status),'Restoration refuses unexpected member status');
        if(current.status==='suspended'){
          const restored=await api('owner','/api/organizations',{method:'POST',body:{action:'member',organizationId:orgId,
            actorId:viewerActor,role:original.role,status:'active',expectedRevision:current.revision}});
          check(restored.data.ok===true,'Restoration success receipt missing');
        }
        const finalRoster=await ownerRoster();const final=finalRoster.find(m=>m.actorId===viewerActor);
        check(final?.status===original.status&&final.role===original.role,'Restoration not confirmed by owner readback');
        check(canonical(finalRoster.filter(m=>m.actorId!==viewerActor))===canonical(record.originalOtherMembers),'Other memberships changed across restore');
        record.restoration={required:true,confirmed:true,at:new Date().toISOString(),attempt,membership:final,otherMembersUnchanged:true};
        persist();console.log('RESTORED: synthetic viewer organization membership active with original role.');
      }catch(error){restoreFailure=error instanceof Error?error.message:'Restoration failure';record.restoration.lastFailure=restoreFailure;persist();}
    }
  }
}
try {
  if(mainFailure) throw new Error(mainFailure);
  check(record.restoration.confirmed,'URGENT: viewer restoration unconfirmed');
  check(record.restoration.membership.revision===original.revision+2,'Unexpected membership revision after successful cycle');
  for(const path of [detailPath,documentPath,downloadPath]){
    const stale=await api('viewer',path,{organization:oldViewerSelection,expected:[409]});
    check(stale.data.code==='organization_context_changed','Restored old selection wrong stale-context code');
    check(Object.keys(stale.data).every(k=>['error','code'].includes(k)),'Stale context response contains unexpected content fields');
  }
  pass('Restoration does not resurrect the old actor selection',{statusCode:409,code:'organization_context_changed'});
  const refreshed=(await api('viewer','/api/organizations',{organization:orgId})).data;
  check(refreshed.actorId===viewerActor&&refreshed.selected?.id===orgId&&refreshed.selected.role===original.role,'Fresh viewer authority mismatch');
  const freshSelection=refreshed.selected.selection;
  check(freshSelection!==oldViewerSelection&&freshSelection.endsWith('.'+viewerActor),'Expected new actor-specific selection');
  check(refreshed.selected.membershipRevision===original.revision+2,'Fresh viewer membership revision mismatch');
  const viewerAfter=(await api('viewer',detailPath,{organization:freshSelection})).data;
  check(viewerAfter.dossier.current_role==='viewer'&&viewerAfter.dossier.revision===21,'Restored viewer dossier role/revision mismatch');
  const documentsAfter=(await api('viewer',documentPath,{organization:freshSelection})).data;
  check(canonical(documentsAfter)===canonical(beforeDocuments),'Document/version metadata changed');
  const afterFile=(await api('viewer',downloadPath,{organization:freshSelection,bytes:true})).data;
  check(afterFile.length===422&&hash(afterFile)===expectedSourceHash,'Restored exact-v1 file differs');
  const afterClaims=withoutReadiness((await api('owner',detailPath)).data);
  check(canonical(afterClaims)===canonical(beforeClaims),'Dossier assertions/participants/revision changed');
  record.finalState={dossierRevision:afterClaims.revision,dossierWithoutReadinessSha256:digest(afterClaims),
    assertionsSha256:digest(afterClaims.assertions),participantsSha256:digest(afterClaims.participants),
    documentsSha256:digest(documentsAfter),sourceBytes:afterFile.length,sourceSha256:hash(afterFile),
    viewerMembershipRevision:refreshed.selected.membershipRevision};
  pass('Fresh ordinary viewer selection restores dossier, documents and exact422-byte v1');
  pass('Dossier revision21, all assertions/participants/source metadata and other organization members preserved');
  record.status='PASS';
} catch(error){record.status='FAIL';record.failure=error instanceof Error?error.message:'Post-restoration check failed';
  if(!record.restoration.confirmed&&record.restoration.required)record.restoration.urgent=true;
  persist();console.error('FINAL CHECK FAILURE: '+record.failure);}
finally{
  // Revoke only the two fresh sessions created by this script; never touch the browser session.
  for(const alias of ['viewer','owner'])if(sessions.get(alias)?.size){
    try{const result=await api(alias,'/api/auth/logout',{method:'POST',organization:null});
      check(result.data.authenticated===false,`${alias} logout receipt missing`);
      record.sessionCleanup.push({alias,ordinaryLogoutConfirmed:true});
    }catch{record.sessionCleanup.push({alias,ordinaryLogoutConfirmed:false});record.status='FAIL';}
  }
  record.completedAt=new Date().toISOString();persist();
  console.log(JSON.stringify({status:record.status,restored:record.restoration.confirmed,evidence:evidenceName,checks:record.checks.length}));
  if(record.status!=='PASS')process.exitCode=1;
}
