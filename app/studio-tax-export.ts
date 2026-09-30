import { canonicalFingerprint, caseFingerprint, isRecord, normalizeStudioDraft } from "./case-integrity";
import { projectCaseCoreV2 } from "./case-core";
import { caseTypeReference } from "./case-type-reference";
import { readStudioAggregate } from "./studio-aggregate";
import { STUDIO_CASE_BODY_LIMIT } from "./studio-envelope";
import { hasTaxAttachment } from "./tax-authoring";
import type { CaseMarkdownLanguage, CaseMarkdownStatus } from "./case-markdown";
import type { StudioDraft } from "./types";

export const TAX_CANONICAL_CASE_MARKER = "GENESIS-JURIS-CANONICAL-V2";
type Recovery = { status: "unsupported" | "corrupt"; rawText: string; reason: string };
type Legacy = { status: "legacy"; rawText: string };
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const digestPattern = /^sha256-[a-f0-9]{64}$/u;
const same = (left: unknown, right: unknown) => left === undefined || right === undefined
  ? left === right : canonicalFingerprint(left) === canonicalFingerprint(right);
const recovery = (rawText: string, reason: string, status: Recovery["status"] = "corrupt"): Recovery => ({ status, rawText, reason });
const caseFields = new Set(["id", "version", "fingerprint", "parent", "protection", "coreSchemaVersion", "caseType", "visibility"]);

function supportedDraft(source: StudioDraft): StudioDraft {
  if (!hasTaxAttachment(source)) return normalizeStudioDraft(structuredClone(source));
  const read = readStudioAggregate(JSON.stringify(source), { kind: "draft" });
  if (read.status !== "editable") throw new Error("This case requires read-only recovery: " + read.reason);
  return read.draft;
}

/** Data codec only. The caller must verify current access, duplication permission,
 * exact saved version and the server seal before exporting. No seal is minted. */
export function buildStudioCustomCaseExport(source: StudioDraft, options: { exportedAt: string; visibility: "private" | "restricted" }) {
  const draft = supportedDraft(source);
  if (!draft.protection || !digestPattern.test(draft.protection.currentCode ?? "") || !/^hmac-sha256-[a-f0-9]{64}$/u.test(draft.protection.seal ?? "")) {
    throw new Error("A server-sealed saved case is required for this export.");
  }
  const exportedDraft = { ...draft, updatedAt: options.exportedAt };
  const envelope = {
    format: "genesis-juris-custom-case" as const,
    schemaVersion: hasTaxAttachment(draft) ? 5 as const : 4 as const,
    exportedAt: options.exportedAt,
    case: {
      id: draft.caseId, version: draft.version, fingerprint: caseFingerprint(draft),
      parent: draft.parent, protection: draft.protection, coreSchemaVersion: 2 as const,
      caseType: draft.caseType ?? caseTypeReference("general_advisory"), visibility: options.visibility,
    },
    core: projectCaseCoreV2(exportedDraft), draft: exportedDraft,
  };
  const rawText = JSON.stringify(envelope);
  if (bytes(rawText) > STUDIO_CASE_BODY_LIMIT) throw new Error("The case export exceeds the JSON size limit.");
  return { rawText, envelope, draft: exportedDraft };
}

export type CustomCaseExportRead = Recovery | Legacy | {
  status: "editable"; rawText: string; draft: StudioDraft; envelope: Record<string, unknown>; requiresSealVerification: true;
};

/** A successful read establishes supported data, never access or a valid seal.
 * Legacy files still use the existing v1–v4 identity/seal verification path. */
export function readStudioCustomCaseExport(rawText: string): CustomCaseExportRead {
  const read = readStudioAggregate(rawText, { kind: "custom-case" });
  if (read.status !== "editable") return recovery(rawText, read.reason, read.status === "unsupported" ? "unsupported" : "corrupt");
  const envelope = read.envelope;
  if (envelope.schemaVersion !== 5) return { status: "legacy", rawText };
  if (!hasTaxAttachment(read.draft)) return recovery(rawText, "The v5 case does not contain a tax attachment.");
  const identity = envelope.case;
  if (!isRecord(identity) || typeof envelope.exportedAt !== "string") return recovery(rawText, "The case export metadata is malformed.");
  if (Object.keys(identity).some(key => !caseFields.has(key))) return recovery(rawText, "The case export metadata contains unsupported fields.", "unsupported");
  const { draft } = read;
  if (identity.id !== draft.caseId || identity.version !== draft.version || identity.fingerprint !== caseFingerprint(draft)
    || !same(identity.parent, draft.parent) || identity.coreSchemaVersion !== 2
    || !same(identity.caseType, draft.caseType ?? caseTypeReference("general_advisory"))
    || !same(envelope.core, projectCaseCoreV2(draft))) return recovery(rawText, "Case identity, fingerprint or Case Core mismatch.");
  if (!draft.protection || !same(identity.protection, draft.protection)
    || !digestPattern.test(draft.protection.currentCode ?? "") || !/^hmac-sha256-[a-f0-9]{64}$/u.test(draft.protection.seal ?? "")) {
    return recovery(rawText, "The exported protection metadata does not match the draft.");
  }
  if (identity.visibility !== "private" && identity.visibility !== "restricted") return recovery(rawText, "The case visibility is malformed.");
  return { status: "editable", rawText, draft, envelope, requiresSealVerification: true };
}

function portableTaxDraft(source: StudioDraft) {
  const candidate = supportedDraft(source);
  candidate.parent = null;
  candidate.editHistory = [];
  delete candidate.protection;
  const draft = normalizeStudioDraft(candidate);
  if (!hasTaxAttachment(draft)) throw new Error("A tax attachment is required for canonical Markdown v2.");
  return draft;
}

async function gzip(value: string) {
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < compressed.length; offset += 0x8000) binary += String.fromCharCode(...compressed.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

async function boundedGunzip(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1 || value.length > STUDIO_CASE_BODY_LIMIT) throw new Error("Invalid compressed canonical payload.");
  const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  const compressed = Uint8Array.from(binary, character => character.charCodeAt(0));
  const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > STUDIO_CASE_BODY_LIMIT) {
        await reader.cancel("Canonical payload exceeds the JSON size limit.");
        throw new Error("Canonical payload exceeds the JSON size limit.");
      }
      chunks.push(chunk);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}

/** Caller has authorized the same portable copy operation as Markdown v1.
 * Use notice in place of the legacy tax economics section; do not calculate
 * legacy amounts or show the retained cached response as a current result. */
export async function buildTaxCanonicalMarkdownPayload(source: StudioDraft, options: { status: CaseMarkdownStatus; language: CaseMarkdownLanguage }) {
  const draft = portableTaxDraft(source);
  const fingerprint = caseFingerprint(draft);
  const rawText = JSON.stringify({ format: "genesis-juris-canonical-markdown", schemaVersion: 2, fingerprint, status: options.status, language: options.language, draft });
  if (bytes(rawText) > STUDIO_CASE_BODY_LIMIT) throw new Error("Canonical payload exceeds the JSON size limit.");
  const payload = await gzip(rawText);
  const marker = `<!-- ${TAX_CANONICAL_CASE_MARKER}\nfingerprint:${fingerprint}\nencoding:gzip-base64url\npayload:${payload}\n-->`;
  if (bytes(marker) > STUDIO_CASE_BODY_LIMIT) throw new Error("Canonical marker exceeds the Markdown size limit.");
  const notice = options.language === "en"
    ? "The complete tax analysis and unfinished inputs are retained in this file. Recalculate through the shared Rust runtime after reopening. Stored results are historical; this document does not establish a current tax result."
    : "Полный налоговый анализ и незавершённые поля сохранены в этом файле. После открытия повторите расчёт через общий модуль Rust. Сохранённые результаты являются историческими; этот документ не подтверждает текущий налоговый результат.";
  return { draft, fingerprint, marker, notice };
}

export type CanonicalMarkdownRead = Recovery | Legacy | { status: "absent" } | {
  status: "editable"; rawText: string; draft: StudioDraft; fingerprint: string; documentStatus: CaseMarkdownStatus; language: CaseMarkdownLanguage;
};

/** The entire original Markdown remains the recovery file, including unknown
 * compressed data. Future markers never fall back to ordinary prompt parsing. */
export async function readStudioCanonicalMarkdown(rawText: string): Promise<CanonicalMarkdownRead> {
  if (bytes(rawText) > STUDIO_CASE_BODY_LIMIT) return recovery(rawText, "The Markdown file exceeds the size limit.", "unsupported");
  const markers = [...rawText.matchAll(/<!--\s*GENESIS-JURIS-CANONICAL-([^\s<>]*)/gu)];
  if (markers.length === 0) return { status: "absent" };
  if (markers.length !== 1) return recovery(rawText, "The canonical marker is ambiguous.");
  const marker = markers[0];
  if (!marker[1]) return recovery(rawText, "The canonical marker version is missing.");
  if (marker[1] !== "V1" && marker[1] !== "V2") return recovery(rawText, "The canonical marker version is unsupported.", "unsupported");
  const start = marker.index! + marker[0].length;
  const end = rawText.indexOf("-->", start);
  if (end < 0) return recovery(rawText, "The canonical marker is incomplete.");
  const fields: Record<string, string> = {};
  for (const line of rawText.slice(start, end).trim().split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    const key = line.slice(0, separator);
    if (separator < 1 || !["fingerprint", "encoding", "payload"].includes(key) || Object.hasOwn(fields, key)) return recovery(rawText, "The canonical marker fields are invalid or ambiguous.");
    fields[key] = line.slice(separator + 1);
  }
  if (fields.encoding !== "gzip-base64url" || !fields.payload || !digestPattern.test(fields.fingerprint ?? "")) return recovery(rawText, "The canonical marker fields are invalid.");
  let decoded: string;
  try { decoded = await boundedGunzip(fields.payload); }
  catch { return recovery(rawText, "The canonical payload is invalid or exceeds the size limit."); }
  const read = readStudioAggregate(decoded, {
    kind: "canonical-markdown",
    normalizeDraft: value => {
      // The portable v2 wire shape requires these exact fields. Validate the
      // original object before the legacy normalizer can discard future forms.
      if (hasTaxAttachment(value) && (!isRecord(value) || value.parent !== null
        || Object.hasOwn(value, "protection") || !Array.isArray(value.editHistory) || value.editHistory.length !== 0)) {
        throw new Error("Canonical Markdown v2 contains nonportable lineage metadata.");
      }
      return normalizeStudioDraft(value);
    },
  });
  if (read.status !== "editable") return recovery(rawText, read.reason, read.status === "unsupported" ? "unsupported" : "corrupt");
  const envelope = read.envelope;
  if (envelope.schemaVersion !== Number(marker[1].slice(1))) return recovery(rawText, "The canonical marker and payload versions disagree.");
  if (envelope.fingerprint !== fields.fingerprint || (envelope.status !== "amended" && envelope.status !== "final") || (envelope.language !== "en" && envelope.language !== "ru")) return recovery(rawText, "The canonical payload metadata is invalid.");
  if (envelope.schemaVersion === 1) return { status: "legacy", rawText };
  if (!hasTaxAttachment(read.draft)) return recovery(rawText, "Canonical Markdown v2 requires a tax attachment.");
  if (read.draft.parent !== null || read.draft.protection || read.draft.editHistory?.length) return recovery(rawText, "Canonical Markdown v2 contains nonportable lineage metadata.");
  if (caseFingerprint(read.draft) !== fields.fingerprint) return recovery(rawText, "Canonical case fingerprint mismatch.");
  return { status: "editable", rawText, draft: read.draft, fingerprint: fields.fingerprint, documentStatus: envelope.status as CaseMarkdownStatus, language: envelope.language as CaseMarkdownLanguage };
}
