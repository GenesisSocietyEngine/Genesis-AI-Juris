import {sql} from "drizzle-orm";
import type {getDb} from "../db";
import type {ChatGPTUser} from "./chatgpt-auth";
import {normalizeEmail} from "./custom-case-access";
import {studioDeviceScope} from "./studio-device-storage";
import {hashOpaqueToken,readSessionCookie} from "./auth-crypto";
import {HistoryError,historyAuthority} from "./studio-report-history-server";
import {casePublicationFingerprint} from "./case-integrity";
import {prepareDossierUpload} from "./dossier-private-upload";
import {validPersonalFile,PERSONAL_FILE_LIMIT,PERSONAL_CASE_FILE_LIMIT,type PersonalStudioFile,type PersonalFileRegistry} from "./studio-personal-files";
type DB=ReturnType<typeof getDb>;
const OBJECT="studio_personal_files",REQUESTED="studio_file_requested",READY="studio_file_ready",LINKED="studio_file_links";
export class PersonalFileError extends Error{constructor(public status:number,message:string){super(message);}}
/** Owner-only raw-original authority, including future/unsupported case versions. No current-template substitution. */
export async function personalFileAuthority(db:DB,identity:ChatGPTUser,request:Request,id:number,scope:string){
 const email=normalizeEmail(identity.email);if(!email)throw new PersonalFileError(401,"Sign in is required.");if(scope!==await studioDeviceScope(email))throw new PersonalFileError(409,"The account changed. Reopen documents.");
 const actor=await db.get<{id:number;actorId:string}>(sql`select id,actor_id as actorId from users where email=${email}`);
 const record=await db.get<{id:number;caseId:string;ownerEmail:string}>(sql`select id,case_id as caseId,owner_email as ownerEmail from custom_cases where id=${id} and lower(owner_email)=${email}`);
 if(!actor?.actorId||!record)throw new PersonalFileError(404,"Personal case documents not found.");
 const token=identity.authSource==="local"?readSessionCookie(request.headers.get("cookie")):null;if(identity.authSource==="local"&&!token)throw new PersonalFileError(401,"Sign in is required.");
 const hash=token?await hashOpaqueToken(token):null;
 const guard=()=>{const now=new Date();return sql`exists(select 1 from users where id=${actor.id} and actor_id=${actor.actorId} and email=${email}) and exists(select 1 from custom_cases where id=${id} and case_id=${record.caseId} and owner_email=${record.ownerEmail}) and ${hash?sql`exists(select 1 from auth_sessions s join local_accounts a on a.id=s.account_id where a.user_email=${email} and a.status='active' and s.token_hash=${hash} and s.revoked_at is null and s.expires_at>${now.toISOString()} and s.last_seen_at>${new Date(now.getTime()-12*60*60_000).toISOString()} and s.created_at>=a.password_changed_at)`:sql`1`}`;};
 return {email,actorId:actor.actorId,id,caseId:record.caseId,guard};
}
type Authority=Awaited<ReturnType<typeof personalFileAuthority>>;
function where(a:Authority){return sql`object_type=${OBJECT} and object_id=${String(a.id)} and actor_email=${a.email} and json_extract(detail,'$.actorId')=${a.actorId}`;}
async function allowed(db:DB,a:Authority){if(!(await db.get<{ok:number}>(sql`select (${a.guard()}) as ok`))?.ok)throw new PersonalFileError(409,"The account or case access changed.");}
export async function personalFileRegistry(db:DB,a:Authority):Promise<PersonalFileRegistry>{
 await allowed(db,a);const rows=await db.all<{id:number;event_type:string;detail:string}>(sql`select id,event_type,cast(detail as text) as detail from audit_events where ${where(a)} and (${a.guard()}) order by id limit 1001`);
 if(rows.length>1000)throw new PersonalFileError(507,"Document history limit reached; contact the operator. All original files are retained.");
 const files=new Map<string,PersonalStudioFile>();
 for(const row of rows){let d;try{d=JSON.parse(row.detail);}catch{throw new PersonalFileError(409,"Document metadata requires recovery.");}
  if(row.event_type===REQUESTED){if(!validPersonalFile(d.file)||files.has(d.file.id))throw new PersonalFileError(409,"Document metadata requires recovery.");files.set(d.file.id,d.file);}
  else if(row.event_type===READY){const f=files.get(d.fileId);if(!f)throw new PersonalFileError(409,"Document finalization requires recovery.");files.set(f.id,{...f,status:"ready"});}
  else if(row.event_type===LINKED){if(!Array.isArray(d.changes)||d.changes.length>100)throw new PersonalFileError(409,"Document links require recovery.");for(const change of d.changes){const f=files.get(change.fileId),next=f?{...f,nodeIds:change.nodeIds}:null;if(!next||!validPersonalFile(next))throw new PersonalFileError(409,"Document links require recovery.");files.set(next.id,next);}}
 }
 await allowed(db,a);return {revision:rows.at(-1)?.id??0,files:[...files.values()]};
}
export async function personalFileWriteAuthority(db:DB,identity:ChatGPTUser,request:Request,a:Authority,expectedFingerprint:string,expectedPublicationFingerprint:string){
 const scope=await studioDeviceScope(a.email);if(!scope)throw new PersonalFileError(401,"Sign in is required.");
 const v=await historyAuthority(db,identity,request,a.id,scope);
 if(v.email!==normalizeEmail(v.record.ownerEmail)||v.record.fingerprint!==expectedFingerprint||casePublicationFingerprint(v.draft)!==expectedPublicationFingerprint)throw new PersonalFileError(409,"Save this exact personal case before changing its documents.");return v;
}
function objectKey(a:Authority,id:string){return `studio-personal/${a.actorId}/${a.id}/${id}`;}
export async function uploadPersonalFile(db:DB,bucket:R2Bucket,a:Authority,v:Awaited<ReturnType<typeof personalFileWriteAuthority>>,input:{file:File;fileId:string;nodeId:string;revision:number;privacy:boolean},signal:AbortSignal){
 if(!input.privacy||!(/^[a-f0-9-]{36}$/.test(input.fileId))||input.file.size>PERSONAL_FILE_LIMIT||!input.file.size||input.nodeId&&!v.draft.nodes.some(n=>n.id===input.nodeId))throw new PersonalFileError(400,"Choose a supported file up to 8 MB and a current node; confirm synthetic or de-identified content.");
 const declared=input.file.name.toLowerCase().endsWith('.pdf')?'application/pdf':input.file.name.toLowerCase().endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':input.file.name.toLowerCase().endsWith('.md')?'text/markdown':'text/plain';
 const prepared=await prepareDossierUpload({originalFilename:input.file.name,browserMediaType:input.file.type,declaredMediaType:declared,bytes:new Uint8Array(await input.file.arrayBuffer())});
 const f:PersonalStudioFile={id:input.fileId,filename:prepared.originalFilename,mediaType:prepared.mediaType,byteLength:prepared.byteLength,sha256:prepared.contentSha256,nodeIds:input.nodeId?[input.nodeId]:[],createdAt:new Date().toISOString(),caseVersion:v.record.currentVersion,sourceFingerprint:v.record.fingerprint,status:'pending'};
 if(!validPersonalFile(f))throw new PersonalFileError(400,"File metadata is outside supported limits.");
 const existing=await personalFileRegistry(db,a),prior=existing.files.find(x=>x.id===f.id);
 if(prior&&(prior.sha256!==f.sha256||prior.filename!==f.filename||prior.sourceFingerprint!==f.sourceFingerprint||JSON.stringify(prior.nodeIds)!==JSON.stringify(f.nodeIds)))throw new PersonalFileError(409,"This upload identity belongs to different bytes or a previous case context. The original is retained.");
 if(prior?.status==='ready')return existing;
 if(signal.aborted)throw new PersonalFileError(409,"Upload was cancelled before submission.");
 if(!prior){const detail=JSON.stringify({actorId:a.actorId,file:f});const insert=await db.run(sql`insert into audit_events(actor_email,event_type,object_type,object_id,detail,created_at) select ${a.email},${REQUESTED},${OBJECT},${String(a.id)},${detail},${f.createdAt} where (${a.guard()}) and (${v.guard()}) and (select coalesce(max(id),0) from audit_events where ${where(a)})=${input.revision} and (select count(*) from audit_events where ${where(a)})<900 and (select count(*) from audit_events where ${where(a)} and event_type=${REQUESTED})<100 and (select coalesce(sum(json_extract(detail,'$.file.byteLength')),0) from audit_events where ${where(a)} and event_type=${REQUESTED})+${f.byteLength}<=${PERSONAL_CASE_FILE_LIMIT}`);
  if(!insert.meta.changes)throw new PersonalFileError(409,"The case/documents changed or its 24 MB storage limit was reached. Refresh the list; nothing was replaced.");}
 const key=objectKey(a,f.id);const stored=await bucket.put(key,prepared.bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:f.mediaType},customMetadata:{sha256:f.sha256}});
 if(!stored){const old=await bucket.get(key);if(!old)throw new PersonalFileError(409,"Upload is still being finalized. Refresh before retrying.");const bytes=new Uint8Array(await old.arrayBuffer());if(await digest(bytes)!==f.sha256)throw new PersonalFileError(409,"Stored original differs. It was not replaced.");}
 if(signal.aborted)throw new PersonalFileError(409,"Upload may have reached storage. Refresh documents before retrying; the original is retained.");
 const detail=JSON.stringify({actorId:a.actorId,fileId:f.id});await db.run(sql`insert into audit_events(actor_email,event_type,object_type,object_id,detail,created_at) select ${a.email},${READY},${OBJECT},${String(a.id)},${detail},${new Date().toISOString()} where (${a.guard()}) and (${v.guard()}) and not exists(select 1 from audit_events where ${where(a)} and event_type=${READY} and json_extract(detail,'$.fileId')=${f.id})`);
 const result=await personalFileRegistry(db,a);if(result.files.find(x=>x.id===f.id)?.status!=='ready')throw new PersonalFileError(409,"The saved case changed during upload. The original is retained for recovery, but no completed attachment is claimed.");return result;
}
async function digest(bytes:Uint8Array){return 'sha256-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function downloadPersonalFile(db:DB,bucket:R2Bucket,a:Authority,id:string){
 const registry=await personalFileRegistry(db,a),file=registry.files.find(f=>f.id===id);if(!file)throw new PersonalFileError(404,"Document not found.");
 const object=await bucket.get(objectKey(a,id));if(!object)throw new PersonalFileError(404,"Upload is unfinished; no stored original is available yet.");
 if(object.size!==file.byteLength||object.size>PERSONAL_FILE_LIMIT)throw new PersonalFileError(409,"Original integrity verification failed.");const bytes=new Uint8Array(await object.arrayBuffer());if(await digest(bytes)!==file.sha256)throw new PersonalFileError(409,"Original integrity verification failed.");await allowed(db,a);return {file,bytes};
}
export async function linkPersonalFiles(db:DB,a:Authority,v:Awaited<ReturnType<typeof personalFileWriteAuthority>>,input:{fileIds:string[];revision:number;nodeId:string;fromNodeId?:string;mode:'attach'|'move'|'detach'}){
 const current=await personalFileRegistry(db,a);if(current.revision!==input.revision||!input.fileIds.length||input.fileIds.length>100||new Set(input.fileIds).size!==input.fileIds.length||!['attach','move','detach'].includes(input.mode)||input.mode!=='detach'&&!v.draft.nodes.some(n=>n.id===input.nodeId)||input.mode!=='attach'&&!input.fromNodeId)throw new PersonalFileError(409,"Document selection or saved node context changed.");
 const changes=input.fileIds.map(id=>{const f=current.files.find(x=>x.id===id&&x.status==='ready');if(!f||input.mode!=='attach'&&!f.nodeIds.includes(input.fromNodeId!))throw new PersonalFileError(409,"Document links changed.");const base=input.mode==='attach'?f.nodeIds:f.nodeIds.filter(n=>n!==input.fromNodeId);return {fileId:id,nodeIds:input.mode==='detach'?base:[...new Set([...base,input.nodeId])]};});
 const detail=JSON.stringify({actorId:a.actorId,caseVersion:v.record.currentVersion,sourceFingerprint:v.record.fingerprint,changes});const r=await db.run(sql`insert into audit_events(actor_email,event_type,object_type,object_id,detail,created_at) select ${a.email},${LINKED},${OBJECT},${String(a.id)},${detail},${new Date().toISOString()} where (${a.guard()}) and (${v.guard()}) and (select coalesce(max(id),0) from audit_events where ${where(a)})=${input.revision} and (select count(*) from audit_events where ${where(a)})<900`);
 if(!r.meta.changes)throw new PersonalFileError(409,"The account, saved case or document links changed. Nothing was rebound.");return personalFileRegistry(db,a);
}
export {HistoryError};
