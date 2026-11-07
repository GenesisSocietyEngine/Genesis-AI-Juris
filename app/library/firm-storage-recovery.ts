import { and, desc, eq, ne, sql } from "drizzle-orm";
import {
  firmDocumentVersions as versions,
  firmLibraryFolderPaths as folders,
  firmUploadIntents as intents,
} from "../../db/schema";
import { dossierJson, type DossierServerContext } from "../dossier-server";
import { firmReply } from "../firm-authority";
import { organizationSelectionToken } from "../organization-store";
import { canonicalR2Sha256, type PreparedDossierUpload } from "../dossier-private-upload";
import { firmFolder } from "./firm-document-model";
type Version = typeof versions.$inferSelect;
export const firmRecord = (r: Version) => ({
  id: r.documentId,
  version: r.version,
  title: r.title,
  folder: r.folder,
  filename: r.filename,
  mediaType: r.mediaType,
  bytes: r.byteLength,
  occurredAt: r.occurredAt,
});
const owner = (c: DossierServerContext, key: string) =>
  and(
    eq(intents.organizationId, c.organization!.id),
    eq(intents.actorRef, c.actor.actorId),
    eq(intents.operationKey, key),
  );
export async function firmOperation(c: DossierServerContext, key: string) {
  if (!/^[\w-]{8,120}$/.test(key)) return dossierJson({ error: "Invalid save reference." }, 400);
  const [doc, folder, intent] = await Promise.all([
    c.db
      .select()
      .from(versions)
      .where(
        and(
          eq(versions.organizationId, c.organization!.id),
          eq(versions.actorRef, c.actor.actorId),
          eq(versions.operationKey, key),
        ),
      )
      .limit(1),
    c.db
      .select({ path: folders.path })
      .from(folders)
      .where(
        and(
          eq(folders.organizationId, c.organization!.id),
          eq(folders.actorRef, c.actor.actorId),
          eq(folders.operationKey, key),
        ),
      )
      .limit(1),
    c.db.select({ state: intents.state }).from(intents).where(owner(c, key)).limit(1),
  ]);
  return firmReply(c, {
    scope: organizationSelectionToken(c.organization!),
    operation: key,
    state: doc.length || folder.length ? "committed" : (intent[0]?.state ?? "not_started"),
    ...(doc[0] ? { document: firmRecord(doc[0]) } : {}),
    ...(folder[0] ? { folder: folder[0].path } : {}),
  });
}
export async function firmCollections(c: DossierServerContext) {
  const [paths, pending] = await Promise.all([
    c.db
      .select({ path: folders.path })
      .from(folders)
      .where(eq(folders.organizationId, c.organization!.id))
      .orderBy(folders.path),
    c.db
      .select({
        key: intents.operationKey,
        id: intents.documentId,
        expectedVersion: intents.expectedVersion,
        title: intents.title,
        folder: intents.folder,
        filename: intents.filename,
      })
      .from(intents)
      .where(
        and(
          eq(intents.organizationId, c.organization!.id),
          eq(intents.actorRef, c.actor.actorId),
          eq(intents.state, "pending"),
        ),
      )
      .orderBy(desc(intents.createdAt)),
  ]);
  return {
    folders: paths.map((f) => f.path),
    incomplete: pending.map((v) => ({ ...v, id: v.expectedVersion ? v.id : null })),
  };
}
export async function saveFirmFolder(c: DossierServerContext, key: string, name: unknown) {
  let path: string;
  try {
    path = firmFolder(name);
    if (!path || !/^[\w-]{8,120}$/.test(key)) throw Error();
  } catch {
    return dossierJson({ error: "Enter a valid folder name." }, 400);
  }
  const where = and(
    eq(folders.organizationId, c.organization!.id),
    eq(folders.actorRef, c.actor.actorId),
    eq(folders.operationKey, key),
  );
  try {
    await c.db.batch([
      c.db
        .insert(folders)
        .values({
          organizationId: c.organization!.id,
          actorRef: c.actor.actorId,
          operationKey: key,
          path,
          createdAt: new Date().toISOString(),
        }),
    ]);
  } catch {
    const [prior] = await c.db.select().from(folders).where(where).limit(1);
    if (prior?.path !== path)
      return firmReply(c, { error: "Folder name unavailable. Refresh the Library." }, 409);
  }
  return firmReply(c, { operation: key, folder: path });
}
export async function stageFirmUpload(c: DossierServerContext, row: Version) {
  const read = async () => (await c.db.select().from(intents).where(owner(c, row.operationKey)).limit(1))[0];
  let existing = await read();
  if (!existing) {
    try {
      await c.db.batch([
        c.db
          .insert(intents)
          .values({
            organizationId: row.organizationId,
            actorRef: row.actorRef,
            operationKey: row.operationKey,
            requestDigest: row.requestDigest,
            documentId: row.documentId,
            expectedVersion: row.version - 1,
            title: row.title,
            folder: row.folder,
            filename: row.filename,
            byteLength: row.byteLength,
            state: "pending",
            createdAt: row.occurredAt,
          }),
      ]);
      return null;
    } catch {
      existing = await read();
      if (!existing) {
        const [usage] = await c.db
          .select({
            attempts: sql<number>`count(*)`,
            reserved: sql<number>`coalesce(sum(${intents.byteLength}),0)`,
          })
          .from(intents)
          .where(and(eq(intents.organizationId, row.organizationId), ne(intents.state, "committed")));
        if (usage.attempts >= 1000 || usage.reserved + row.byteLength > 1073741824)
          return firmReply(
            c,
            { error: "Incomplete upload storage is full. Contact your workspace administrator." },
            507,
          );
        return firmReply(c, { error: "Document changed. Refresh before uploading a version." }, 409);
      }
    }
  }
  if (existing.state === "cancelled" || existing.requestDigest !== row.requestDigest)
    return firmReply(c, { error: "This save reference is cancelled or belongs to another file." }, 409);
  return null;
}
export async function cancelFirmUpload(c: DossierServerContext, key: string) {
  if (!/^[\w-]{8,120}$/.test(key)) return dossierJson({ error: "Invalid save reference." }, 400);
  await c.db.batch([
    c.db
      .update(intents)
      .set({ state: "cancelled" })
      .where(and(owner(c, key), eq(intents.state, "pending"))),
  ]);
  // Never delete a key: another operation for this document/version can share identical bytes.
  return firmOperation(c, key);
}
export async function putFirmOriginal(bucket: R2Bucket, key: string, upload: PreparedDossierUpload) {
  const written = await bucket.put(key, upload.bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    sha256: upload.checksum,
    httpMetadata: { contentType: upload.mediaType },
    customMetadata: { contentSha256: upload.contentSha256 },
  });
  const object = written ?? (await bucket.head(key));
  if (
    !object ||
    object.size !== upload.byteLength ||
    object.httpMetadata?.contentType !== upload.mediaType ||
    object.customMetadata?.contentSha256 !== upload.contentSha256 ||
    canonicalR2Sha256(object.checksums.sha256) !== upload.contentSha256
  )
    throw Error("Original integrity unavailable.");
}
