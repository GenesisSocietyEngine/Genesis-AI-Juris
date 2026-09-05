import { env } from "cloudflare:workers";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  dossierDocumentCurrentVersions,
  dossierDocumentVersions,
  dossierDocuments,
  dossierExtractionJobs,
} from "../../../../../db/schema";
import { DOSSIER_WIRE_ENUMS } from "../../../../dossier-contract";
import {
  cleanupExpiredUploadIntents,
  executeDossierDocumentUpload,
  recoverDossierExtractionJobs,
  type DossierDocumentUploadForm,
} from "../../../../dossier-document-upload-coordinator";
import {
  prepareDossierUpload,
  readBoundedDossierFormData,
  type PreparedDossierUpload,
} from "../../../../dossier-private-upload";
import { parseDossierOpaqueId } from "../../../../dossier-security";
import {
  boundedDossierText,
  dossierEnum,
  dossierJson,
  dossierNotFound,
  expectedDossierRevision,
  isResponse,
  optionalDossierText,
  prepareDossierRevisionAuditBatch,
  requireDossierAccess,
  resolveDossierServerContext,
} from "../../../../dossier-server";
import { isSameOriginMutation } from "../../../../request-security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ dossierId: string }> };

const MAX_DOCUMENTS = 100;
const MAX_VERSIONS = 1_000;
const MAX_EXTRACTION_ATTEMPTS = 10_000;
const ALLOWED_UPLOAD_FIELDS = new Set([
  "file",
  "title",
  "documentType",
  "classification",
  "privacyAcknowledged",
  "expectedRevision",
  "mediaType",
  "documentId",
  "sourceNote",
  "idempotencyKey",
]);

type UploadForm = DossierDocumentUploadForm;

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await resolveDossierServerContext(_request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "read");
  if (isResponse(access)) return access;

  const bucket = (env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket }).DOSSIER_DOCUMENTS;
  if (bucket) {
    await cleanupExpiredUploadIntents(context, bucket, access.dossier.id);
    await recoverDossierExtractionJobs(context, bucket, access.dossier.id);
  }

  const [documents, versions, extractionJobs] = await Promise.all([
    context.db.select({
      documentId: dossierDocuments.id,
      title: dossierDocuments.title,
      documentType: dossierDocuments.documentType,
      sourceOrigin: dossierDocuments.sourceOrigin,
      classification: dossierDocuments.classification,
      status: dossierDocuments.status,
      tags: dossierDocuments.tags,
      updatedAt: dossierDocuments.updatedAt,
      currentVersionId: dossierDocumentCurrentVersions.documentVersionId,
    }).from(dossierDocuments)
      .leftJoin(dossierDocumentCurrentVersions, and(
        eq(dossierDocumentCurrentVersions.dossierId, dossierDocuments.dossierId),
        eq(dossierDocumentCurrentVersions.documentId, dossierDocuments.id),
      ))
      .where(and(
        eq(dossierDocuments.dossierId, access.dossier.id),
        eq(dossierDocuments.isProvisional, false),
      ))
      .orderBy(desc(dossierDocuments.updatedAt), asc(dossierDocuments.id))
      .limit(MAX_DOCUMENTS),
    context.db.select({
      documentVersionId: dossierDocumentVersions.id,
      documentId: dossierDocumentVersions.documentId,
      ordinal: dossierDocumentVersions.ordinal,
      originalFilename: dossierDocumentVersions.originalFilename,
      mediaType: dossierDocumentVersions.mediaType,
      byteLength: dossierDocumentVersions.byteLength,
      contentSha256: dossierDocumentVersions.contentSha256,
      uploaderActorId: dossierDocumentVersions.uploaderActorRef,
      uploadedAt: dossierDocumentVersions.uploadedAt,
      predecessorVersionId: dossierDocumentVersions.predecessorVersionId,
      sourceNote: dossierDocumentVersions.sourceNote,
    }).from(dossierDocumentVersions)
      .where(eq(dossierDocumentVersions.dossierId, access.dossier.id))
      .orderBy(asc(dossierDocumentVersions.documentId), desc(dossierDocumentVersions.ordinal))
      .limit(MAX_VERSIONS),
    context.db.select({
      documentVersionId: dossierExtractionJobs.documentVersionId,
      status: dossierExtractionJobs.status,
      errorCode: dossierExtractionJobs.errorCode,
      attempt: dossierExtractionJobs.attempt,
      updatedAt: dossierExtractionJobs.updatedAt,
    }).from(dossierExtractionJobs)
      .where(eq(dossierExtractionJobs.dossierId, access.dossier.id))
      .orderBy(
        asc(dossierExtractionJobs.documentVersionId),
        asc(dossierExtractionJobs.attempt),
        asc(dossierExtractionJobs.updatedAt),
      )
      .limit(MAX_EXTRACTION_ATTEMPTS),
  ]);

  const latestExtraction = new Map<string, {
    status: string;
    errorCode: string | null;
    attempt: number;
    updatedAt: string;
  }>();
  for (const job of extractionJobs) latestExtraction.set(job.documentVersionId, job);
  const versionsByDocument = new Map<string, typeof versions>();
  for (const version of versions) {
    versionsByDocument.set(
      version.documentId,
      [...(versionsByDocument.get(version.documentId) ?? []), version],
    );
  }

  return dossierJson({
    documents: documents.map((document) => ({
      schema_version: 1,
      document_id: document.documentId,
      title: document.title,
      document_type: document.documentType,
      source_origin: document.sourceOrigin,
      classification: document.classification,
      status: document.status,
      tags: document.tags,
      current_version_id: document.currentVersionId,
      updated_at: document.updatedAt,
      versions: (versionsByDocument.get(document.documentId) ?? []).map((version) => {
        const extraction = latestExtraction.get(version.documentVersionId);
        return {
          schema_version: 1,
          document_version_id: version.documentVersionId,
          document_id: version.documentId,
          ordinal: version.ordinal,
          original_filename: version.originalFilename,
          media_type: version.mediaType,
          byte_length: version.byteLength,
          content_sha256: version.contentSha256,
          uploader_actor_id: version.uploaderActorId,
          uploaded_at: version.uploadedAt,
          predecessor_version_id: version.predecessorVersionId,
          source_note: version.sourceNote,
          extraction_status: extraction?.status ?? "queued",
          extraction_error_code: extraction?.errorCode ?? null,
          extraction_attempt: extraction?.attempt ?? null,
          download_url: documentDownloadUrl(
            access.dossier.id,
            document.documentId,
            version.documentVersionId,
          ),
        };
      }),
    })),
    limits: {
      maximum_documents: MAX_DOCUMENTS,
      maximum_versions: MAX_VERSIONS,
      truncated: documents.length === MAX_DOCUMENTS || versions.length === MAX_VERSIONS,
    },
  });
}

export async function POST(request: Request, routeContext: RouteContext) {
  if (!isSameOriginMutation(request)) {
    return dossierJson({ error: "Cross-site document upload rejected." }, 403);
  }
  const context = await resolveDossierServerContext(request);
  if (isResponse(context)) return context;
  const { dossierId } = await routeContext.params;
  const access = await requireDossierAccess(context, dossierId, "upload");
  if (isResponse(access)) return access;

  const bindings = env as unknown as { DOSSIER_DOCUMENTS?: R2Bucket };
  const bucket = bindings.DOSSIER_DOCUMENTS;
  if (!bucket) {
    return dossierJson({
      error: "Private document storage is temporarily unavailable.",
      code: "document_storage_unavailable",
    }, 503);
  }
  const formData = await readBoundedDossierFormData(request);
  if (!formData) return dossierJson({ error: "A bounded multipart document upload is required." }, 400);

  let form: UploadForm;
  let prepared: PreparedDossierUpload;
  try {
    form = parseUploadForm(formData);
    prepared = await prepareDossierUpload({
      originalFilename: form.file.name,
      browserMediaType: form.file.type,
      declaredMediaType: form.declaredMediaType,
      bytes: new Uint8Array(await form.file.arrayBuffer()),
    });
  } catch (error) {
    return dossierJson({
      error: error instanceof Error ? error.message : "The document upload is invalid.",
      code: "document_upload_invalid",
    }, 400);
  }
  let existingDocument: {
    id: string;
    title: string;
    documentType: string;
    classification: string;
  } | null = null;
  if (form.documentId) {
    const versionAccess = await requireDossierAccess(context, dossierId, "version");
    if (isResponse(versionAccess)) return versionAccess;
    [existingDocument] = await context.db.select({
      id: dossierDocuments.id,
      title: dossierDocuments.title,
      documentType: dossierDocuments.documentType,
      classification: dossierDocuments.classification,
    }).from(dossierDocuments).where(and(
      eq(dossierDocuments.dossierId, access.dossier.id),
      eq(dossierDocuments.id, form.documentId),
      eq(dossierDocuments.sourceOrigin, "internal_upload"),
      eq(dossierDocuments.isProvisional, false),
    )).limit(1);
    if (!existingDocument) return dossierNotFound();
    if (
      existingDocument.title !== form.title
      || existingDocument.documentType !== form.documentType
      || existingDocument.classification !== form.classification
    ) {
      return dossierJson({
        error: "Document metadata changed before this version upload.",
        code: "document_metadata_conflict",
      }, 409);
    }
  }

  const result = await executeDossierDocumentUpload({
    context,
    bucket,
    dossierId: access.dossier.id,
    dossierRevision: access.dossier.revision,
    form,
    prepared,
    dependencies: {
      requireUploadRole: async (currentDossierId) => {
        const currentAccess = await requireDossierAccess(context, currentDossierId, "upload");
        if (
          isResponse(currentAccess)
          || (currentAccess.role !== "owner" && currentAccess.role !== "contributor")
        ) {
          throw new Error("Upload authorization changed.");
        }
        return currentAccess.role;
      },
      prepareRevisionAuditBatch: (currentDossierId, resultingRevision, inputs) =>
        prepareDossierRevisionAuditBatch(
          context,
          currentDossierId,
          resultingRevision,
          inputs,
        ),
    },
  });
  // Do not return revisions or result metadata to a membership revoked during R2 work.
  const finalAccess = await requireDossierAccess(context, dossierId, "upload");
  if (isResponse(finalAccess)) return finalAccess;
  return result;
}

function documentDownloadUrl(dossierId: string, documentId: string, versionId: string) {
  return [
    "/api/dossiers/",
    encodeURIComponent(dossierId),
    "/documents/",
    encodeURIComponent(documentId),
    "/versions/",
    encodeURIComponent(versionId),
    "/download",
  ].join("");
}

function parseUploadForm(formData: FormData): UploadForm {
  const observedKeys = [...formData.keys()];
  if (
    observedKeys.some((key) => !ALLOWED_UPLOAD_FIELDS.has(key))
    || [...new Set(observedKeys)].some((key) => formData.getAll(key).length !== 1)
  ) {
    throw new Error("The upload contains unsupported or ambiguous fields.");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("A document file is required.");
  if (stringField(formData, "privacyAcknowledged") !== "true") {
    throw new Error("Confirm that the upload is synthetic or de-identified.");
  }
  const documentIdValue = optionalFormString(formData, "documentId");
  const idempotencyValue = optionalFormString(formData, "idempotencyKey");
  return {
    file,
    title: boundedDossierText(stringField(formData, "title"), "document title", 2, 240),
    documentType: boundedDossierText(
      stringField(formData, "documentType"),
      "document type",
      1,
      120,
    ),
    classification: dossierEnum(
      stringField(formData, "classification"),
      DOSSIER_WIRE_ENUMS.classification,
      "document classification",
    ),
    expectedRevision: expectedDossierRevision(Number(stringField(formData, "expectedRevision"))),
    documentId: documentIdValue === null
      ? null
      : parseDossierOpaqueId(documentIdValue, "document ID"),
    sourceNote: optionalDossierText(optionalFormString(formData, "sourceNote"), "source note", 1_000),
    idempotencyKey: idempotencyValue === null
      ? null
      : boundedDossierText(idempotencyValue, "idempotency key", 8, 200),
    declaredMediaType: stringField(formData, "mediaType"),
  };
}

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") throw new Error(`${key} is required.`);
  return value;
}

function optionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key} is invalid.`);
  return value;
}
