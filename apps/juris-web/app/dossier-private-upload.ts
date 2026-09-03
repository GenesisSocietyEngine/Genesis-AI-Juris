import {
  DOSSIER_MEDIA_POLICIES,
  decideDossierExtraction,
  decideObservedDossierUpload,
  extractDeterministicDossierText,
  parseDossierMediaType,
  type DossierMediaType,
  type DossierTextExtractionResult,
} from "./dossier-security";

export const DOSSIER_MULTIPART_MAX_BYTES = 26 * 1024 * 1024;

export class DossierUploadValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DossierUploadValidationError";
  }
}

export type PreparedDossierUpload = {
  originalFilename: string;
  mediaType: DossierMediaType;
  byteLength: number;
  contentSha256: string;
  checksum: ArrayBuffer;
  bytes: Uint8Array;
  extraction:
    | {
        state: "not_extractable";
        extractorVersion: "none";
        errorCode: "unsupported_type";
        errorDetailCode: "PARSER_NOT_APPROVED";
      }
    | {
        state: "ready_to_extract";
        extractorVersion: "genesis-dossier-strict-utf8-v1";
        result: DossierTextExtractionResult;
      };
};

export async function prepareDossierUpload(input: {
  originalFilename: unknown;
  browserMediaType: unknown;
  declaredMediaType: unknown;
  bytes: Uint8Array;
}): Promise<PreparedDossierUpload> {
  const originalFilename = dossierOriginalFilename(input.originalFilename);
  const declaredMediaType = parseDossierMediaType(input.declaredMediaType);
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0) {
    throw new DossierUploadValidationError("INVALID_CONTENT_LENGTH", "The document is empty.");
  }
  if (input.bytes.byteLength > DOSSIER_MEDIA_POLICIES[declaredMediaType].maximumBytes) {
    throw new DossierUploadValidationError("FILE_TOO_LARGE", "The document exceeds the file limit.");
  }
  validateBrowserMediaType(input.browserMediaType, declaredMediaType);
  const observedMediaType = observeMediaType(originalFilename, input.bytes);
  const digest = await sha256Bytes(input.bytes);
  const observed = decideObservedDossierUpload({
    declaredMediaType,
    observedMediaType,
    declaredByteLength: input.bytes.byteLength,
    observedByteLength: input.bytes.byteLength,
    declaredSha256: digest.contentSha256,
    observedSha256: digest.contentSha256,
  });
  if (!observed.accepted) {
    throw new DossierUploadValidationError(observed.reason, "The declared document metadata does not match its bytes.");
  }
  const extractionDecision = decideDossierExtraction(observed.mediaType);
  if (!extractionDecision.accepted) {
    throw new DossierUploadValidationError(extractionDecision.reason, "The document extraction policy rejected the upload.");
  }
  const extraction = extractionDecision.state === "not_extractable"
    ? {
        state: "not_extractable" as const,
        extractorVersion: "none" as const,
        errorCode: "unsupported_type" as const,
        errorDetailCode: extractionDecision.reason,
      }
    : {
        state: "ready_to_extract" as const,
        extractorVersion: extractionDecision.extractorVersion,
        result: extractDeterministicDossierText(observed.mediaType, input.bytes),
      };
  return {
    originalFilename,
    mediaType: observed.mediaType,
    byteLength: observed.byteLength,
    contentSha256: observed.contentSha256,
    checksum: digest.checksum,
    bytes: input.bytes,
    extraction,
  };
}

export async function readBoundedDossierFormData(request: Request): Promise<FormData | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/iu.test(contentType)) return null;
  const lengthHeader = request.headers.get("content-length");
  const hasDeclaredLength = lengthHeader !== null;
  const declaredLength = hasDeclaredLength && /^\d+$/u.test(lengthHeader)
    ? Number(lengthHeader)
    : null;
  if (
    hasDeclaredLength
    && (declaredLength === null
      || !Number.isSafeInteger(declaredLength)
      || declaredLength < 1
      || declaredLength > DOSSIER_MULTIPART_MAX_BYTES)
  ) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const exactBody = declaredLength === null ? null : new Uint8Array(declaredLength);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const previousTotal = total;
      total += value.byteLength;
      if (total > DOSSIER_MULTIPART_MAX_BYTES) {
        await reader.cancel("Matter upload exceeds the multipart limit");
        return null;
      }
      if (exactBody) {
        if (total > exactBody.byteLength) {
          await reader.cancel("Matter upload length does not match Content-Length");
          return null;
        }
        exactBody.set(value, previousTotal);
      } else {
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0 || (exactBody && total !== exactBody.byteLength)) return null;
  let bytes = exactBody;
  if (!bytes) {
    bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }
  try {
    return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
  } catch {
    return null;
  }
}

export async function sha256Bytes(value: string | Uint8Array): Promise<{
  contentSha256: string;
  checksum: ArrayBuffer;
}> {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const exactBuffer = source.byteOffset === 0
    && source.buffer instanceof ArrayBuffer
    && source.byteLength === source.buffer.byteLength
    ? source.buffer
    : source.slice().buffer;
  const checksum = await crypto.subtle.digest("SHA-256", exactBuffer);
  const contentSha256 = `sha256-${[...new Uint8Array(checksum)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
  return { contentSha256, checksum };
}

export function canonicalR2Sha256(value: ArrayBuffer | undefined): string | null {
  if (!value || value.byteLength !== 32) return null;
  return `sha256-${[...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function dossierOriginalFilename(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 255
    || value !== value.normalize("NFC")
    || value === "."
    || value === ".."
    || /[\\/\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new DossierUploadValidationError("INVALID_FILENAME", "The document filename is invalid.");
  }
  return value;
}

function validateBrowserMediaType(value: unknown, declared: DossierMediaType) {
  if (typeof value !== "string") {
    throw new DossierUploadValidationError("MEDIA_TYPE_MISMATCH", "The browser document media type is invalid.");
  }
  const browserType = value.trim().toLowerCase();
  if (
    browserType !== ""
    && browserType !== declared
    && !(declared === "text/markdown" && browserType === "text/plain")
  ) {
    throw new DossierUploadValidationError("MEDIA_TYPE_MISMATCH", "The browser document media type conflicts with the declared type.");
  }
}

function observeMediaType(filename: string, bytes: Uint8Array): DossierMediaType {
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".") + 1).toLowerCase() : "";
  switch (extension) {
    case "pdf":
      if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) break;
      return "application/pdf";
    case "docx":
      if (
        startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
        && includesAscii(bytes, "[Content_Types].xml")
        && includesAscii(bytes, "word/")
      ) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      break;
    case "txt":
      return "text/plain";
    case "md":
    case "markdown":
      return "text/markdown";
  }
  throw new DossierUploadValidationError("MEDIA_TYPE_MISMATCH", "The filename and document signature do not match an allowed type.");
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function includesAscii(bytes: Uint8Array, needle: string) {
  const pattern = new TextEncoder().encode(needle);
  outer: for (let offset = 0; offset <= bytes.length - pattern.length; offset += 1) {
    for (let index = 0; index < pattern.length; index += 1) {
      if (bytes[offset + index] !== pattern[index]) continue outer;
    }
    return true;
  }
  return false;
}
