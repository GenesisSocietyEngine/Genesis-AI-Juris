import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import {
  dossierDocumentVersions,
  dossierDocuments,
} from "../../../../../../../../../db/schema";
import { decideDossierDownload } from "../../../../../../../../dossier-download-security";
import {
  assertDossierObjectKeyScope,
  parseDossierOpaqueId,
} from "../../../../../../../../dossier-security";
import {
  dossierJson,
  dossierNotFound,
  isResponse,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../../../../../dossier-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    dossierId: string;
    documentId: string;
    versionId: string;
  }>;
};

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext(_request);
  if (isResponse(context)) return context;
  const routeIds = await routeContext.params;
  const access = await requireDossierAccess(context, routeIds.dossierId, "download");
  if (isResponse(access)) return access;

  let documentId: string;
  let versionId: string;
  try {
    documentId = parseDossierOpaqueId(routeIds.documentId, "document ID");
    versionId = parseDossierOpaqueId(routeIds.versionId, "document-version ID");
  } catch {
    return dossierNotFound();
  }
  const [record] = await context.db.select({
    documentVersionId: dossierDocumentVersions.id,
    mediaType: dossierDocumentVersions.mediaType,
    byteLength: dossierDocumentVersions.byteLength,
    contentSha256: dossierDocumentVersions.contentSha256,
    binaryObjectReference: dossierDocumentVersions.binaryObjectReference,
    uploadIntentId: dossierDocumentVersions.uploadIntentId,
  }).from(dossierDocumentVersions)
    .innerJoin(dossierDocuments, and(
      eq(dossierDocuments.dossierId, dossierDocumentVersions.dossierId),
      eq(dossierDocuments.id, dossierDocumentVersions.documentId),
    ))
    .where(and(
      eq(dossierDocumentVersions.dossierId, access.dossier.id),
      eq(dossierDocumentVersions.documentId, documentId),
      eq(dossierDocumentVersions.id, versionId),
    ))
    .limit(1);
  if (!record) return dossierNotFound();

  const decision = decideDossierDownload({
    authenticated: true,
    resourceExists: true,
    authorized: true,
    documentVersionId: record.documentVersionId,
    mediaType: record.mediaType,
    byteLength: record.byteLength,
    contentSha256: record.contentSha256,
  });
  if (!decision.allowed) {
    return privateIntegrityError();
  }
  try {
    if (!record.uploadIntentId) return privateIntegrityError();
    assertDossierObjectKeyScope(
      record.binaryObjectReference,
      access.dossier.id,
      record.uploadIntentId,
    );
    const bindings = env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket };
    if (!bindings.DOSSIER_DOCUMENTS) return privateIntegrityError();
    const object = await bindings.DOSSIER_DOCUMENTS.get(record.binaryObjectReference);
    if (!object) return privateIntegrityError();
    const storedChecksum = canonicalR2Sha256(object.checksums.sha256);
    if (
      object.size !== record.byteLength
      || object.httpMetadata?.contentType !== record.mediaType
      || object.customMetadata?.contentSha256 !== record.contentSha256
      || storedChecksum !== record.contentSha256
    ) {
      return privateIntegrityError();
    }
    const current = await requireDossierAccess(context, routeIds.dossierId, "download");
    if (isResponse(current)) { await object.body.cancel(); return current; }
    return new Response(object.body, {
      status: decision.status,
      headers: {
        ...decision.headers,
        Pragma: "no-cache",
        "Content-Security-Policy": "sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return privateIntegrityError();
  }
}

function privateIntegrityError() {
  return dossierJson({
    error: "Document integrity is temporarily unavailable.",
    code: "document_integrity_unavailable",
  }, 503);
}

function canonicalR2Sha256(value: ArrayBuffer | undefined) {
  if (!value || value.byteLength !== 32) return null;
  const hex = [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256-${hex}`;
}
