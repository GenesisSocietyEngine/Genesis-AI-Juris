import { isRecord, normalizeStudioDraft } from "./case-integrity";
import { parsePreservedJson } from "./preserved-json";
import { STUDIO_CASE_BODY_LIMIT } from "./studio-envelope";
import { hasTaxAttachment, readTaxAttachment } from "./tax-authoring";
import type { StudioDraft } from "./types";

export type StudioAggregateKind = "draft" | "custom-case" | "device-draft" | "canonical-markdown" | "auth-continuation";

/** Detach once, before asynchronous binding checks; persist this same snapshot. */
export function freezeStudioDraftSnapshot(draft: StudioDraft): StudioDraft {
  const snapshot = structuredClone(draft);
  function freeze(value: unknown) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  freeze(snapshot);
  return snapshot;
}
export type StudioAggregateRead =
  | { status: "editable"; rawText: string; draft: StudioDraft; envelope: Record<string, unknown>; kind: StudioAggregateKind }
  | { status: "unsupported" | "corrupt"; rawText: string; reason: string }
  | { status: "denied"; reason: string };

const formats = {
  "custom-case": { name: "genesis-juris-custom-case", versions: [1, 2, 3, 4, 5], taxVersion: 5, fields: ["format", "schemaVersion", "exportedAt", "case", "core", "draft"] },
  "device-draft": { name: "genesis-juris-device-draft", versions: [1, 2], taxVersion: 2, fields: ["format", "schemaVersion", "scope", "draft"] },
  "canonical-markdown": { name: "genesis-juris-canonical-markdown", versions: [1, 2], taxVersion: 2, fields: ["format", "schemaVersion", "fingerprint", "status", "language", "draft"] },
  "auth-continuation": { name: undefined, versions: [1, 2], taxVersion: 2, fields: ["version", "id", "createdAt", "scope", "prompt", "draft", "selectedNodeId", "action"] },
} as const;
const draftFields = new Set(["caseId", "version", "caseType", "parent", "protection", "title", "jurisdiction", "role", "premise", "premisePublication", "classification", "taxEconomics", "taxAnalysis", "dealEconomics", "nodes", "links", "editHistory", "updatedAt"]);

/** Defaults may be added, but tax-bearing input cannot lose supplied data through
 * an older nested graph/protection/history normalizer. Recovery keeps its raw text. */
function retainsSuppliedValues(before: unknown, after: unknown): boolean {
  if (Array.isArray(before)) return Array.isArray(after) && before.length === after.length && before.every((value, index) => retainsSuppliedValues(value, after[index]));
  if (isRecord(before)) return isRecord(after) && Object.entries(before).every(([key, value]) => Object.hasOwn(after, key) && retainsSuppliedValues(value, after[key]));
  return before === after;
}

/** Classify exact text before any whitelist normalizer. This is a data reader,
 * not access/seal verification: callers must retain their existing authority,
 * privacy, protection and export checks for editable AND raw recovery results.
 * A denied caller receives no raw data. Declared future formats never fall back
 * to a legacy raw draft. A successful read alone does not authorize import. */
export function readStudioAggregate(rawText: string, context: {
  kind: StudioAggregateKind;
  access?: "read" | "denied";
  expectedScope?: string | null;
  normalizeDraft?: (value: unknown) => StudioDraft;
}): StudioAggregateRead {
  if (context.access === "denied") return { status: "denied", reason: "This Studio document is not accessible." };
  const preserve = (status: "unsupported" | "corrupt", reason: string): StudioAggregateRead => ({ status, rawText, reason });
  const unverified = (reason: string): StudioAggregateRead => context.expectedScope !== undefined
    ? { status: "denied", reason: "The Studio document scope could not be verified." }
    : preserve("corrupt", reason);
  // Enforce UTF-8 size before JSON.parse, including whitespace and future data.
  const limit = context.kind === "auth-continuation" ? 1_300_000 : STUDIO_CASE_BODY_LIMIT;
  if (new TextEncoder().encode(rawText).byteLength > limit) return unverified("The Studio document exceeds the JSON size limit.");
  let value: unknown;
  try { value = parsePreservedJson(rawText); }
  catch { return unverified("The Studio document contains invalid or ambiguous JSON."); }
  if (!isRecord(value)) return unverified("The Studio document is not an object.");
  if (context.expectedScope !== undefined && value.scope !== context.expectedScope) return { status: "denied", reason: "This Studio document belongs to another scope." };

  let candidate: unknown = value;
  if (context.kind === "draft") {
    if (Object.hasOwn(value, "format") || Object.hasOwn(value, "schemaVersion")) return preserve("unsupported", "A declared Studio envelope cannot be opened as a raw draft.");
  } else {
    const spec = formats[context.kind];
    const version = context.kind === "auth-continuation" ? value.version : value.schemaVersion;
    if (value.format !== spec.name || !(spec.versions as readonly unknown[]).includes(version)) return preserve("unsupported", "The Studio document format or version is unsupported.");
    candidate = value.draft;
    if (version === spec.taxVersion && Object.keys(value).some(key => !(spec.fields as readonly string[]).includes(key))) return preserve("unsupported", "The Studio envelope contains unsupported fields.");
    if (hasTaxAttachment(candidate) && version !== spec.taxVersion) return preserve("unsupported", "This envelope version cannot carry tax authoring data.");
  }
  if (!isRecord(candidate)) return preserve("corrupt", "The Studio draft is missing or malformed.");
  const attachment = readTaxAttachment(candidate.taxAnalysis);
  if (attachment.status === "unsupported" || attachment.status === "corrupt") return preserve(attachment.status, attachment.reason);
  if (attachment.status === "known" && Object.keys(candidate).some(key => !draftFields.has(key))) return preserve("unsupported", "The tax-bearing Studio draft contains unsupported fields.");
  try {
    const draft = (context.normalizeDraft ?? normalizeStudioDraft)(candidate);
    if (attachment.status === "known" && !retainsSuppliedValues(candidate, draft)) return preserve("unsupported", "The tax-bearing draft contains data this application cannot preserve while editing.");
    return { status: "editable", rawText, draft, envelope: value, kind: context.kind };
  } catch { return preserve("corrupt", "The Studio draft failed integrity validation."); }
}
