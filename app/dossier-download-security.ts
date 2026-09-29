import {
  DOSSIER_MEDIA_POLICIES,
  DossierSecurityError,
  parseDossierMediaType,
  parseDossierOpaqueId,
  parseDossierSha256,
} from "./dossier-security";

const DOSSIER_PRIVATE_RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
});

export interface DossierDownloadDecisionInput {
  authenticated: unknown;
  resourceExists: unknown;
  authorized: unknown;
  documentVersionId?: unknown;
  mediaType?: unknown;
  byteLength?: unknown;
  contentSha256?: unknown;
}

export type DossierDownloadDecision =
  | {
      allowed: true;
      status: 200;
      headers: Readonly<Record<string, string>>;
    }
  | {
      allowed: false;
      status: 401 | 404 | 503;
      code: "AUTHENTICATION_REQUIRED" | "NOT_FOUND" | "DOCUMENT_INTEGRITY_UNAVAILABLE";
      headers: Readonly<Record<string, string>>;
    };

/**
 * Missing and unauthorized resources deliberately return the same decision.
 * The success response exposes no R2 key and always forces an attachment with
 * exact stored media, byte-length, and SHA-256 metadata.
 */
export function decideDossierDownload(input: DossierDownloadDecisionInput): DossierDownloadDecision {
  if (input.authenticated !== true) {
    return {
      allowed: false,
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      headers: DOSSIER_PRIVATE_RESPONSE_HEADERS,
    };
  }
  if (input.resourceExists !== true || input.authorized !== true) {
    return {
      allowed: false,
      status: 404,
      code: "NOT_FOUND",
      headers: DOSSIER_PRIVATE_RESPONSE_HEADERS,
    };
  }

  try {
    const versionId = parseDossierOpaqueId(input.documentVersionId, "document-version ID");
    const mediaType = parseDossierMediaType(input.mediaType);
    const byteLength = positiveInteger(input.byteLength);
    const contentSha256 = parseDossierSha256(input.contentSha256);
    if (byteLength === null || byteLength > DOSSIER_MEDIA_POLICIES[mediaType].maximumBytes) {
      throw new DossierSecurityError("INVALID_OBJECT_KEY", "Stored document length is invalid.");
    }
    const extension = DOSSIER_MEDIA_POLICIES[mediaType].extension;
    return {
      allowed: true,
      status: 200,
      headers: Object.freeze({
        ...DOSSIER_PRIVATE_RESPONSE_HEADERS,
        "Content-Disposition": `attachment; filename="dossier-document-${versionId}.${extension}"`,
        "Content-Length": String(byteLength),
        "Content-Type": mediaType,
        "X-Content-SHA256": contentSha256,
      }),
    };
  } catch {
    return {
      allowed: false,
      status: 503,
      code: "DOCUMENT_INTEGRITY_UNAVAILABLE",
      headers: DOSSIER_PRIVATE_RESPONSE_HEADERS,
    };
  }
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}
