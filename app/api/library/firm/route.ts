import { env } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";
import { firmDocumentVersions as documents } from "../../../../db/schema";
import { canonicalDossierJson } from "../../../dossier-contract";
import { canonicalDossierTimestamp, dossierJson, dossierSha256, isResponse, revalidateDossierIdentity, resolveDossierServerContext } from "../../../dossier-server";
import { assertOrganizationCurrent, organizationSelectionToken } from "../../../organization-store";
import { isSameOriginMutation } from "../../../request-security";
import { prepareDossierUpload, readBoundedDossierFormData } from "../../../dossier-private-upload";
import { firmDocumentFields, firmObjectKey } from "../../../library/firm-document-model";

export const dynamic = "force-dynamic";
type Context = Exclude<Awaited<ReturnType<typeof resolveDossierServerContext>>, Response>;
const publicRecord = (r: typeof documents.$inferSelect) => ({id:r.documentId,version:r.version,title:r.title,folder:r.folder,filename:r.filename,mediaType:r.mediaType,bytes:r.byteLength,occurredAt:r.occurredAt});
async function authority(context:Context) {
  const identity=await revalidateDossierIdentity(context); if(identity)return identity;
  try { await assertOrganizationCurrent(context.db,context.actor,context.organization!); return null; }
  catch { return dossierJson({error:"Organization access changed."},404); }
}
export async function GET(request:Request) {
  const context=await resolveDossierServerContext(request);if(isResponse(context))return context;
  const org=context.organization!,url=new URL(request.url),id=url.searchParams.get("id"),version=Number(url.searchParams.get("version"));
  if(id&&!/^firm_doc_[a-f0-9]{64}$/.test(id))return dossierJson({error:"Document not found."},404);
  if(url.searchParams.has("download")) {
    if(!id||!Number.isSafeInteger(version)||version<1)return dossierJson({error:"Document not found."},404);
    const [record]=await context.db.select().from(documents).where(and(eq(documents.organizationId,org.id),eq(documents.documentId,id),eq(documents.version,version))).limit(1);
    if(!record)return dossierJson({error:"Document not found."},404);
    try {
      if(record.objectKey!==firmObjectKey(org.id,id,version,record.contentSha256.replace(/^sha256-/,"")))throw Error();
      const bucket=(env as unknown as {DOSSIER_DOCUMENTS?:R2Bucket}).DOSSIER_DOCUMENTS;
      const object=await bucket?.get(record.objectKey);
      if(!object)throw Error();
      const checksum=object.checksums.sha256?`sha256-${Array.from(new Uint8Array(object.checksums.sha256),b=>b.toString(16).padStart(2,"0")).join("")}`:null;
      if(object.size!==record.byteLength||checksum!==record.contentSha256||object.httpMetadata?.contentType!==record.mediaType||object.customMetadata?.contentSha256!==record.contentSha256){await object.body.cancel();throw Error();}
      const denied=await authority(context);if(denied){await object.body.cancel();return denied;}
      return new Response(object.body,{headers:{"Content-Type":record.mediaType,"Content-Disposition":`attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(record.filename).replace(/'/g,"%27")}`,"Cache-Control":"private, no-store","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox","Referrer-Policy":"no-referrer"}});
    }catch{return dossierJson({error:"Document integrity is temporarily unavailable."},503);}
  }
  const cursor=url.searchParams.get("cursor")??"";
  if(cursor&&!/^firm_doc_[a-f0-9]{64}$/.test(cursor))return dossierJson({error:"Invalid page."},400);
  const rows=await context.db.select().from(documents).where(and(eq(documents.organizationId,org.id),id?eq(documents.documentId,id):sql`${documents.documentId}>${cursor} AND ${documents.version}=(SELECT MAX(v.version) FROM firm_document_versions v WHERE v.organization_id=${org.id} AND v.document_id=${documents.documentId})`)).orderBy(id?desc(documents.version):documents.documentId).limit(101);
  const denied=await authority(context);if(denied)return denied;
  return dossierJson({scope:organizationSelectionToken(org),documents:rows.slice(0,100).map(publicRecord),nextCursor:!id&&rows.length>100?rows[99].documentId:null,canWrite:org.role!=="auditor"});
}
export async function POST(request:Request) {
  if(!isSameOriginMutation(request))return dossierJson({error:"Cross-site change rejected."},403);
  const context=await resolveDossierServerContext(request);if(isResponse(context))return context;
  const org=context.organization!;
  if(org.role==="auditor")return dossierJson({error:"Auditors cannot upload documents."},403);
  let fields,upload;
  try {
    const form=await readBoundedDossierFormData(request);if(!form)throw Error("Invalid or oversized upload.");
    fields=firmDocumentFields(Object.fromEntries(form.entries()));
    if(form.get("privacyAcknowledgement")!=="synthetic_or_deidentified")throw Error("Confirm that the upload is synthetic or de-identified.");
    const file=form.get("file");if(!file||typeof file==="string")throw Error("Choose a file.");
    upload=await prepareDossierUpload({originalFilename:file.name,browserMediaType:file.type,declaredMediaType:form.get("mediaType"),bytes:new Uint8Array(await file.arrayBuffer())});
  }catch(error){return dossierJson({error:error instanceof Error?error.message:"Invalid upload."},400);}
  const digest=await dossierSha256(canonicalDossierJson({...fields,filename:upload.originalFilename,mediaType:upload.mediaType,content:upload.contentSha256}));
  const original=async()=>(await context.db.select().from(documents).where(and(eq(documents.organizationId,org.id),eq(documents.actorRef,context.actor.actorId),eq(documents.operationKey,fields.operationKey))).limit(1))[0];
  const reply=async(row:typeof documents.$inferSelect)=>{const denied=await authority(context);if(denied)return denied;return row.requestDigest===digest?dossierJson({document:publicRecord(row),operation:row.operationKey}):dossierJson({error:"This operation belongs to another upload."},409);};
  const prior=await original();if(prior)return reply(prior);
  const id=fields.id??`firm_doc_${(await dossierSha256(canonicalDossierJson([org.id,context.actor.actorId,fields.operationKey]))).replace(/^sha256-/,"")}`;
  const [latest]=await context.db.select().from(documents).where(and(eq(documents.organizationId,org.id),eq(documents.documentId,id))).orderBy(desc(documents.version)).limit(1);
  if((latest?.version??0)!==fields.expectedVersion)return dossierJson({error:"Document changed. Refresh before uploading a version."},409);
  const row={organizationId:org.id,documentId:id,version:fields.expectedVersion+1,title:fields.title,folder:fields.folder,filename:upload.originalFilename,mediaType:upload.mediaType,byteLength:upload.byteLength,contentSha256:upload.contentSha256,objectKey:firmObjectKey(org.id,id,fields.expectedVersion+1,upload.contentSha256.replace(/^sha256-/,"")),actorRef:context.actor.actorId,operationKey:fields.operationKey,requestDigest:digest,occurredAt:canonicalDossierTimestamp()};
  try {
    const denied=await authority(context);if(denied)return denied;
    const bucket=(env as unknown as {DOSSIER_DOCUMENTS?:R2Bucket}).DOSSIER_DOCUMENTS;if(!bucket)throw Error();
    await bucket.put(row.objectKey,upload.bytes,{sha256:upload.checksum,httpMetadata:{contentType:upload.mediaType},customMetadata:{contentSha256:upload.contentSha256}});
    await context.db.batch([context.db.insert(documents).values(row)]);
  }catch {const saved=await original();if(saved)return reply(saved);const [current]=await context.db.select().from(documents).where(and(eq(documents.organizationId,org.id),eq(documents.documentId,id))).orderBy(desc(documents.version)).limit(1);if((current?.version??0)!==fields.expectedVersion)return dossierJson({error:"Another version was saved. Refresh and start a new version upload."},409);return dossierJson({error:"Upload was not confirmed. Retry the original upload."},503);}
  return reply(row);
}
