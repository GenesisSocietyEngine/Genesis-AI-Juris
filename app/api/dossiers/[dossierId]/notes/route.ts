import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { dossierWorkingNotes as notes, dossierWorkingNoteVersions as versions, dossierWorkingNoteSources as sources,
  dossierDocuments, dossierDocumentVersions, dossierSourceAnchors, dossierSourceAnchorRetirements, dossierDocumentCurrentVersions, organizationCasGuards } from "../../../../../db/schema";
import { canonicalDossierJson } from "../../../../dossier-contract";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import { finalizeDossierRead, boundedDossierText, canonicalDossierTimestamp, dossierEnum, dossierJson, dossierNotFound, dossierSha256,
  isResponse, newDossierOpaqueId, requireDossierAccess, resolveDossierServerContext, type DossierServerContext } from "../../../../dossier-server";
import { isSameOriginMutation, readJsonObject } from "../../../../request-security";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ dossierId: string }> };
type Version = typeof versions.$inferSelect;
const LABEL = "Working material · shared with this case";
const actions = ["create", "save", "link", "unlink"] as const;
const failure = (error: string, code: string, status = 400, field?: string) => dossierJson({error, code, ...(field ? {field} : {})}, status);
function project(row: Version) {
  return {id:row.noteId, caseId:row.dossierId, revision:row.revision, title:row.title, type:row.noteType, body:row.body,
    savedAt:row.occurredAt, savedBy:row.actorRef, savedByRole:row.actorRole, label:LABEL};
}
function receipt(row: Version, replayed = false) {
  return dossierJson({note:project(row), operation:{id:row.id, key:row.idempotencyKey, action:row.action,
    caseId:row.dossierId, noteId:row.noteId, revision:row.revision, sourceLinkId:row.sourceLinkId,
    actor:row.actorRef, occurredAt:row.occurredAt, requestDigest:row.requestDigest}, replayed}, row.action === "create" ? 201 : 200);
}
async function current(context: DossierServerContext, caseId: string, noteId: string) {
  const [row] = await context.db.select({version:versions}).from(notes).innerJoin(versions,and(eq(versions.dossierId,notes.dossierId),eq(versions.noteId,notes.id),eq(versions.revision,notes.revision)))
    .where(and(eq(notes.dossierId,caseId),eq(notes.id,noteId))).limit(1);
  return row?.version;
}
async function operation(context: DossierServerContext, caseId: string, key: string) {
  const [row] = await context.db.select().from(versions).where(and(eq(versions.dossierId,caseId),eq(versions.actorRef,context.actor.actorId),eq(versions.idempotencyKey,key))).limit(1);
  return row;
}

/** One authorized collection supplies notes, exact versions, operations and same-case backlinks. */
export async function GET(request: Request, route: RouteContext) {
  const context = await resolveDossierServerContext(request); if(isResponse(context)) return context;
  const access = await requireDossierAccess(context,(await route.params).dossierId,"read"); if(isResponse(access)) return access;
  const caseId = access.dossier.id, params = new URL(request.url).searchParams;
  params.delete("organization"); // Already authenticated and resolved by the organization boundary.
  if([...params.keys()].some(key=>params.getAll(key).length!==1) || [...params.keys()].some(key=>!["note_id","revision","history","cursor","document_id","version_id","operation_key","source_cursor"].includes(key))) return failure("Use one exact note, source or operation selection.","invalid_selection");
  for(const key of ["note_id","document_id","version_id","source_cursor"]){if(params.has(key)){try{parseDossierOpaqueId(params.get(key),key);}catch{return dossierNotFound();}}}
  // Invalid selectors are caller errors, not storage outages. Keep operation
  // identity byte-for-byte identical to the POST contract.
  if (params.has("operation_key")) {
    try { const raw=params.get("operation_key"); if(boundedDossierText(raw,"Operation key",8,120)!==raw) throw new Error(); }
    catch { return failure("Use the original operation key without whitespace.","invalid_selection",400,"operation_key"); }
  }
  if (params.has("cursor") && !params.has("history")) {
    try { parseDossierOpaqueId(params.get("cursor"),"cursor"); }
    catch { return failure("The page cursor is invalid.","invalid_selection",400,"cursor"); }
  }
  try {
    if(params.has("operation_key")) {
      if(params.size!==1) return failure("Operation recovery cannot be combined with another selection.","invalid_selection");
      const key=boundedDossierText(params.get("operation_key"),"Operation key",8,120);
      const row=await operation(context,caseId,key); return row ? finalizeDossierRead(context, access, receipt(row,true)) : dossierNotFound();
    }
    if(params.has("document_id")) {
      if([...params.keys()].some(key=>!["document_id","version_id","cursor"].includes(key))) return failure("Choose a source without note pagination.","invalid_selection");
      const documentId=parseDossierOpaqueId(params.get("document_id"),"document ID");
      const versionId=params.has("version_id")?parseDossierOpaqueId(params.get("version_id"),"version ID"):null;
      const [document]=await context.db.select().from(dossierDocuments).where(and(eq(dossierDocuments.dossierId,caseId),eq(dossierDocuments.id,documentId))).limit(1);
      if(!document) return dossierNotFound();
      if(versionId){const [version]=await context.db.select().from(dossierDocumentVersions).where(and(eq(dossierDocumentVersions.dossierId,caseId),eq(dossierDocumentVersions.documentId,documentId),eq(dossierDocumentVersions.id,versionId))).limit(1);if(!version)return dossierNotFound();}
      const cursor=params.has("cursor")?parseDossierOpaqueId(params.get("cursor"),"link cursor"):null;
      // Every note belongs to this already-authorized case; count the same rows returned.
      const backlinks=await context.db.select({linkId:sources.id,noteId:notes.id,title:versions.title,noteRevision:notes.revision,documentVersionId:sources.documentVersionId,sourceAnchorId:sources.sourceAnchorId})
        .from(sources).innerJoin(notes,and(eq(notes.dossierId,sources.dossierId),eq(notes.id,sources.noteId)))
        .innerJoin(versions,and(eq(versions.dossierId,notes.dossierId),eq(versions.noteId,notes.id),eq(versions.revision,notes.revision)))
        .where(and(eq(sources.dossierId,caseId),eq(sources.documentId,documentId),eq(sources.active,true),versionId?eq(sources.documentVersionId,versionId):undefined,cursor?gt(sources.id,cursor):undefined)).orderBy(sources.id).limit(51);
      const [total]=await context.db.select({count:sql<number>`count(*)`}).from(sources).where(and(eq(sources.dossierId,caseId),eq(sources.documentId,documentId),eq(sources.active,true),versionId?eq(sources.documentVersionId,versionId):undefined));
      return finalizeDossierRead(context, access, dossierJson({caseId,documentId,backlinks:backlinks.slice(0,50),count:total!.count,nextCursor:backlinks.length>50?backlinks[49]!.linkId:null,label:LABEL}));
    }
    if(params.has("note_id")) {
      if(params.has("version_id")||(params.has("history")&&params.has("source_cursor")))return failure("Choose note history or source pagination, separately.","invalid_selection");
      const noteId=parseDossierOpaqueId(params.get("note_id"),"note ID");
      const row=await current(context,caseId,noteId); if(!row)return dossierNotFound();
      if(params.has("history")) {
        if(params.get("history")!=="true"||params.has("revision"))return failure("Choose history or one revision.","invalid_selection");
        const cursor=params.has("cursor")?Number(params.get("cursor")):null;
        if(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1))return failure("The history cursor is invalid.","invalid_selection");
        const history=await context.db.select({id:versions.id,noteId:versions.noteId,revision:versions.revision,title:versions.title,noteType:versions.noteType,actorRef:versions.actorRef,actorRole:versions.actorRole,occurredAt:versions.occurredAt,action:versions.action,sourceLinkId:versions.sourceLinkId}).from(versions).where(and(eq(versions.dossierId,caseId),eq(versions.noteId,noteId),cursor?lt(versions.revision,cursor):undefined)).orderBy(desc(versions.revision)).limit(51);
        return finalizeDossierRead(context, access, dossierJson({caseId,noteId,history:history.slice(0,50).map(v=>({id:v.noteId,revision:v.revision,title:v.title,type:v.noteType,savedAt:v.occurredAt,savedBy:v.actorRef,savedByRole:v.actorRole,eventId:v.id,action:v.action,sourceLinkId:v.sourceLinkId})),nextCursor:history.length>50?history[49]!.revision:null}));
      }
      if(params.has("cursor"))return failure("History is required for a revision cursor.","invalid_selection");
      const selectedRevision=params.has("revision")?Number(params.get("revision")):row.revision;
      if(!Number.isSafeInteger(selectedRevision)||selectedRevision<1)return dossierNotFound();
      const [selected]=selectedRevision===row.revision?[row]:await context.db.select().from(versions).where(and(eq(versions.dossierId,caseId),eq(versions.noteId,noteId),eq(versions.revision,selectedRevision))).limit(1);
      if(!selected)return dossierNotFound();
      const sourceCursor=params.has("source_cursor")?parseDossierOpaqueId(params.get("source_cursor"),"source cursor"):null;
      const linked=await context.db.select({link:sources,document:dossierDocuments,version:dossierDocumentVersions,anchor:dossierSourceAnchors,retirement:dossierSourceAnchorRetirements,currentVersionId:dossierDocumentCurrentVersions.documentVersionId})
        .from(sources).innerJoin(dossierDocuments,and(eq(dossierDocuments.dossierId,sources.dossierId),eq(dossierDocuments.id,sources.documentId)))
        .innerJoin(dossierDocumentVersions,and(eq(dossierDocumentVersions.dossierId,sources.dossierId),eq(dossierDocumentVersions.id,sources.documentVersionId)))
        .leftJoin(dossierSourceAnchors,and(eq(dossierSourceAnchors.dossierId,sources.dossierId),eq(dossierSourceAnchors.id,sources.sourceAnchorId)))
        .leftJoin(dossierSourceAnchorRetirements,and(eq(dossierSourceAnchorRetirements.dossierId,sources.dossierId),eq(dossierSourceAnchorRetirements.sourceAnchorId,sources.sourceAnchorId)))
        .leftJoin(dossierDocumentCurrentVersions,and(eq(dossierDocumentCurrentVersions.dossierId,sources.dossierId),eq(dossierDocumentCurrentVersions.documentId,sources.documentId)))
        .where(and(eq(sources.dossierId,caseId),eq(sources.noteId,noteId),sourceCursor?gt(sources.id,sourceCursor):undefined,sql`${sources.createdRevision}<=${selectedRevision} AND (${sources.unlinkedRevision} IS NULL OR ${sources.unlinkedRevision}>${selectedRevision})`)).orderBy(sources.id).limit(51);
      const [total]=await context.db.select({count:sql<number>`count(*)`}).from(sources).where(and(eq(sources.dossierId,caseId),eq(sources.noteId,noteId),sql`${sources.createdRevision}<=${selectedRevision} AND (${sources.unlinkedRevision} IS NULL OR ${sources.unlinkedRevision}>${selectedRevision})`));
      return finalizeDossierRead(context, access, dossierJson({note:project(selected),currentRevision:row.revision,sourceCount:total!.count,nextSourceCursor:linked.length>50?linked[49]!.link.id:null,sources:linked.slice(0,50).map(({link,document,version,anchor,retirement,currentVersionId})=>({id:link.id,documentId:link.documentId,documentTitle:document.title,documentVersionId:link.documentVersionId,version:version.ordinal,sourceAnchorId:link.sourceAnchorId,reviewState:anchor?.reviewState??null,retired:Boolean(retirement),documentStatus:document.status,locator:anchor?{page:anchor.pageNumber,section:anchor.section,paragraph:anchor.paragraph,heading:anchor.heading,excerpt:anchor.excerpt}:null,currentSourceVersion:currentVersionId===link.documentVersionId,createdRevision:link.createdRevision,
        downloadPath:`/api/dossiers/${caseId}/documents/${link.documentId}/versions/${link.documentVersionId}/download`}))}));
    }
    if(params.has("revision")||params.has("history")||params.has("version_id")||params.has("source_cursor"))return failure("Select the note or source first.","invalid_selection");
    const cursor=params.has("cursor")?parseDossierOpaqueId(params.get("cursor"),"note cursor"):null;
    const rows=await context.db.select({id:notes.id,title:versions.title,type:versions.noteType,revision:notes.revision,savedAt:versions.occurredAt,savedBy:versions.actorRef,savedByRole:versions.actorRole}).from(notes).innerJoin(versions,and(eq(versions.dossierId,notes.dossierId),eq(versions.noteId,notes.id),eq(versions.revision,notes.revision)))
      .where(and(eq(notes.dossierId,caseId),cursor?lt(notes.id,cursor):undefined)).orderBy(desc(notes.id)).limit(51);
    return finalizeDossierRead(context, access, dossierJson({caseId,notes:rows.slice(0,50).map(r=>({...r,label:LABEL})),nextCursor:rows.length>50?rows[49]!.id:null,label:LABEL}));
  } catch { return failure("The note or source selection is invalid or unavailable. Retry loading it.","note_read_unavailable",503); }
}

export async function POST(request: Request, route: RouteContext) {
  if(!isSameOriginMutation(request))return failure("Submit changes from this case.","cross_origin",403);
  const context=await resolveDossierServerContext(request);if(isResponse(context))return context;
  const access=await requireDossierAccess(context,(await route.params).dossierId,"update");if(isResponse(access))return access;
  const caseId=access.dossier.id, payload=await readJsonObject(request,420_000);
  if(!payload)return failure("Enter a note change.","validation");
  let action:typeof actions[number],key:string,noteId:string,expected:number,digest:string;
  try {
    action=dossierEnum(payload.action,actions,"note action");
    const allowed=new Set(["action","noteId","expectedRevision","idempotencyKey",...(action==="create"||action==="save"?["title","type","body"]:action==="link"?["documentId","documentVersionId","sourceAnchorId"]:["sourceLinkId"])]);
    if(Object.keys(payload).some(k=>!allowed.has(k)))return failure("This change contains an unsupported field.","validation");
    key=boundedDossierText(payload.idempotencyKey,"Operation key",8,120);
    if(key!==payload.idempotencyKey)return failure("Use the original operation key without whitespace.","validation",400,"idempotencyKey");
    expected=payload.expectedRevision as number;if(typeof expected!=="number"||!Number.isSafeInteger(expected)||expected<(action==="create"?0:1)||(action==="create"&&expected!==0))return failure("Review the current note revision before saving.","validation",400,"expectedRevision");
    if(action==="create"&&payload.noteId!==undefined)return failure("New notes receive a server identity.","validation",400,"noteId");
    noteId=action==="create"?newDossierOpaqueId("note"):parseDossierOpaqueId(payload.noteId,"note ID");
    digest=await dossierSha256(canonicalDossierJson(payload));
  }catch{return failure("The note action or identity is invalid.","validation");}
  const prior=await operation(context,caseId,key);
  if(prior)return prior.requestDigest===digest?receipt(prior,true):failure("This operation key belongs to a different change. Resolve that operation before submitting your edited draft.","operation_key_conflict",409);
  const old=action==="create"?undefined:await current(context,caseId,noteId);
  if(action!=="create"&&!old)return dossierNotFound();
  if(old&&old.revision!==expected)return dossierJson({error:"The note changed. Compare the current note with your retained draft before explicitly saving again.",code:"revision_conflict",current:project(old)},409);
  let title=old?.title??"",body=old?.body??"",noteType=old?.noteType??"blank";
  if(action==="create"||action==="save") {
    try{title=boundedDossierText(payload.title,"Note title",1,200);}catch{return failure("Enter a title of 1–200 characters.","validation",400,"title");}
    try{noteType=dossierEnum(payload.type,["blank","meeting","analysis"] as const,"note type");}catch{return failure("Choose a supported note type.","validation",400,"type");}
    if(typeof payload.body!=="string"||payload.body.length>100_000||payload.body.includes("\u0000"))return failure("Use up to 100,000 characters in the note body.","validation",400,"body");
    body=payload.body;
  }
  let documentId:string|null=null,documentVersionId:string|null=null,sourceAnchorId:string|null=null,sourceLinkId:string|null=null;
  if(action==="link") {
    try{documentId=parseDossierOpaqueId(payload.documentId,"document ID");documentVersionId=parseDossierOpaqueId(payload.documentVersionId,"document version ID");sourceAnchorId=payload.sourceAnchorId?parseDossierOpaqueId(payload.sourceAnchorId,"source anchor ID"):null;}catch{return failure("Choose the document and exact source version.","validation",400,"documentVersionId");}
    const [version]=await context.db.select().from(dossierDocumentVersions).where(and(eq(dossierDocumentVersions.dossierId,caseId),eq(dossierDocumentVersions.documentId,documentId),eq(dossierDocumentVersions.id,documentVersionId))).limit(1);
    if(!version)return failure("Choose an existing source version in this case.","source_unavailable",400,"documentVersionId");
    if(sourceAnchorId){const [anchor]=await context.db.select().from(dossierSourceAnchors).where(and(eq(dossierSourceAnchors.dossierId,caseId),eq(dossierSourceAnchors.documentId,documentId),eq(dossierSourceAnchors.documentVersionId,documentVersionId),eq(dossierSourceAnchors.id,sourceAnchorId))).limit(1);if(!anchor)return failure("Choose a citation from this exact source version.","source_unavailable",400,"sourceAnchorId");}
    const [duplicate]=await context.db.select().from(sources).where(and(eq(sources.dossierId,caseId),eq(sources.noteId,noteId),eq(sources.documentVersionId,documentVersionId),eq(sources.anchorKey,sourceAnchorId??""),eq(sources.active,true))).limit(1);
    if(duplicate)return dossierJson({error:"This source is already linked to the note.",code:"already_linked",sourceLinkId:duplicate.id,currentRevision:old!.revision},409);
    sourceLinkId=newDossierOpaqueId("note_link");
  }
  if(action==="unlink") {
    try{sourceLinkId=parseDossierOpaqueId(payload.sourceLinkId,"source link ID");}catch{return failure("Select the exact source link.","validation",400,"sourceLinkId");}
    const [link]=await context.db.select().from(sources).where(and(eq(sources.dossierId,caseId),eq(sources.noteId,noteId),eq(sources.id,sourceLinkId))).limit(1);
    if(!link)return dossierNotFound();
    if(!link.active)return failure("The source link was already removed. Refresh this note.","already_unlinked",409);
  }
  const now=canonicalDossierTimestamp(), next=expected+1;
  const row:Version={id:newDossierOpaqueId("note_event"),dossierId:caseId,noteId,revision:next,title,noteType,body,action,sourceLinkId,actorUserId:context.actor.userId,actorRef:context.actor.actorId,actorRole:access.role,occurredAt:now,idempotencyKey:key,requestDigest:digest};
  try {
    const statements = [
      ...(action==="create"?[context.db.insert(notes).values({id:noteId,dossierId:caseId,organizationId:context.organization!.id,revision:1,createdBy:context.actor.actorId,createdAt:now,updatedAt:now})]:[]),
      // Version trigger rechecks active case participation inside the fenced org batch.
      context.db.insert(versions).values(row),
      ...(action!=="create"?[context.db.update(notes).set({revision:next,updatedAt:now}).where(and(eq(notes.dossierId,caseId),eq(notes.id,noteId),eq(notes.revision,expected))),context.db.insert(organizationCasGuards).values({changed:sql`changes()`}),context.db.delete(organizationCasGuards)]:[]),
      ...(action==="link"?[context.db.insert(sources).values({id:sourceLinkId!,dossierId:caseId,noteId,documentId:documentId!,documentVersionId:documentVersionId!,sourceAnchorId,anchorKey:sourceAnchorId??"",createdRevision:next})]:[]),
      ...(action==="unlink"?[context.db.update(sources).set({active:false,unlinkedRevision:next}).where(and(eq(sources.dossierId,caseId),eq(sources.noteId,noteId),eq(sources.id,sourceLinkId!),eq(sources.active,true))),context.db.insert(organizationCasGuards).values({changed:sql`changes()`}),context.db.delete(organizationCasGuards)]:[]),
    ];
    await context.db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
  } catch {
    const accessNow=await requireDossierAccess(context,caseId,"update");if(isResponse(accessNow))return accessNow;
    const duplicate=await operation(context,caseId,key);if(duplicate)return duplicate.requestDigest===digest?receipt(duplicate,true):failure("This operation belongs to different content.","operation_key_conflict",409);
    const latest=await current(context,caseId,noteId);
    if(latest&&latest.revision!==expected)return dossierJson({error:"The note changed. Review the current version alongside your retained draft.",code:"revision_conflict",current:project(latest)},409);
    return failure("The save could not be confirmed. Keep your draft and check this operation before retrying the identical change.","save_unconfirmed",503);
  }
  return receipt(row);
}
