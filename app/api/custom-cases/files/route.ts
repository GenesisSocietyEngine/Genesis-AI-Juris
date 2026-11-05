import {env} from "cloudflare:workers";
import {getDb} from "../../../../db";
import {getChatGPTUser} from "../../../chatgpt-auth";
import {isSameOriginCredentialMutation,readJsonObject} from "../../../request-security";
import {readBoundedDossierFormData,DossierUploadValidationError} from "../../../dossier-private-upload";
import {isStudioDeviceScope} from "../../../studio-device-storage";
import {personalFileAuthority,personalFileWriteAuthority,personalFileRegistry,uploadPersonalFile,downloadPersonalFile,linkPersonalFiles,PersonalFileError,HistoryError} from "../../../studio-personal-files-server";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store","vary":"Cookie","x-content-type-options":"nosniff"};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
async function handle(request:Request,method:'GET'|'POST'|'PATCH'){
 if(method!=='GET'&&!isSameOriginCredentialMutation(request))return json({error:'Cross-site mutation rejected.'},403);
 const identity=await getChatGPTUser();if(!identity)return json({error:'Sign in is required.'},401);
 try{
  const db=getDb(),params=new URL(request.url).searchParams;
  if(method==='GET'){
   if([...params.keys()].some(k=>!['customCaseId','expectedScope','fileId'].includes(k)||params.getAll(k).length!==1))return json({error:'Invalid file query.'},400);
   const id=Number(params.get('customCaseId')),scope=params.get('expectedScope');if(!positive(id)||!isStudioDeviceScope(scope))return json({error:'Invalid file context.'},400);
   const a=await personalFileAuthority(db,identity,request,id,scope);const fileId=params.get('fileId');if(!fileId)return json(await personalFileRegistry(db,a));
   if(!/^[a-f0-9-]{36}$/.test(fileId))return json({error:'Invalid file identity.'},400);
   const bucket=(env as unknown as {DOSSIER_DOCUMENTS?:R2Bucket}).DOSSIER_DOCUMENTS;if(!bucket)return json({error:'Document storage is unavailable.'},503);
   const result=await downloadPersonalFile(db,bucket,a,fileId);return new Response(new Uint8Array(result.bytes),{headers:{...headers,'content-type':result.file.mediaType,'content-disposition':`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(result.file.filename)}`,'content-security-policy':'sandbox'}});
  }
  let body:Record<string,unknown>|null=null;let form:FormData|null=null;
  if(method==='POST'){form=await readBoundedDossierFormData(request);if(!form)return json({error:'Choose a supported file.'},400);const fields=['customCaseId','expectedScope','expectedFingerprint','expectedPublicationFingerprint','file','fileId','nodeId','revision','privacy'];if([...form.keys()].some(k=>!fields.includes(k)||form!.getAll(k).length!==1))return json({error:'Invalid upload fields.'},400);body=Object.fromEntries([...form.entries()].map(([k,v])=>[k,['customCaseId','revision'].includes(k)?Number(v):v]));}
  else body=await readJsonObject(request,24_000);
  if(!body||!positive(body.customCaseId)||!isStudioDeviceScope(body.expectedScope)||!Number.isSafeInteger(body.revision)||Number(body.revision)<0||typeof body.expectedFingerprint!=='string'||typeof body.expectedPublicationFingerprint!=='string')return json({error:'A saved personal case and exact context are required.'},400);
  const a=await personalFileAuthority(db,identity,request,body.customCaseId,body.expectedScope),v=await personalFileWriteAuthority(db,identity,request,a,body.expectedFingerprint,body.expectedPublicationFingerprint);
  if(method==='POST'){
   if(!(body.file instanceof File)||typeof body.fileId!=='string'||typeof body.nodeId!=='string')return json({error:'Choose a file and destination.'},400);
   const bucket=(env as unknown as {DOSSIER_DOCUMENTS?:R2Bucket}).DOSSIER_DOCUMENTS;if(!bucket)return json({error:'Document storage is unavailable.'},503);
   return json(await uploadPersonalFile(db,bucket,a,v,{file:body.file,fileId:body.fileId,nodeId:body.nodeId,revision:Number(body.revision),privacy:body.privacy==='true'},request.signal),201);
  }
  if(Object.keys(body).some(k=>!['customCaseId','expectedScope','expectedFingerprint','expectedPublicationFingerprint','revision','fileIds','nodeId','fromNodeId','mode'].includes(k))||!Array.isArray(body.fileIds)||!body.fileIds.every(x=>typeof x==='string')||typeof body.nodeId!=='string'||body.fromNodeId!==undefined&&typeof body.fromNodeId!=='string'||!['attach','move','detach'].includes(String(body.mode)))return json({error:'Invalid document link change.'},400);
  return json(await linkPersonalFiles(db,a,v,{fileIds:body.fileIds as string[],revision:Number(body.revision),nodeId:body.nodeId,fromNodeId:body.fromNodeId as string|undefined,mode:body.mode as 'attach'|'move'|'detach'}));
 }catch(error){if(error instanceof PersonalFileError||error instanceof HistoryError)return json({error:error.message},error.status);if(error instanceof DossierUploadValidationError)return json({error:error.message},400);return json({error:'Documents are temporarily unavailable. Existing originals are retained.'},503);}
}
export const GET=(r:Request)=>handle(r,'GET');export const POST=(r:Request)=>handle(r,'POST');export const PATCH=(r:Request)=>handle(r,'PATCH');
