import { normalizeCaseTypeReference } from "./case-type-reference";
import type { StudioDraft } from "./types";

export const WEB_TAX_SOURCE_SCHEMA = "web-studio-tax-source-v1" as const;
const fields = ["caseId", "version", "caseType", "parent", "title", "jurisdiction", "role", "premise", "premisePublication", "classification", "dealEconomics", "nodes", "links"] as const;

export type WebTaxSourceProjection = {
  format: "genesis-juris-web-tax-source";
  schemaVersion: 1;
  source: Pick<StudioDraft, typeof fields[number]>;
};
export type WebTaxSourceDescriptor = {
  source_schema: typeof WEB_TAX_SOURCE_SCHEMA;
  case_id: string;
  scenario_fingerprint: string;
  fact_ids: string[];
  reference_ids: string[];
};
export type WebTaxSource = {
  projection: WebTaxSourceProjection;
  canonicalJson: string;
  descriptor: WebTaxSourceDescriptor;
};

export class WebTaxSourceError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "WebTaxSourceError";
  }
}

/** A new source identity only: existing case/seal fingerprint algorithms stay unchanged.
 * Emit sorted entries directly: constructing an object would reorder numeric keys.
 * JSON convention: -0 becomes 0; lone surrogates are escaped; strings are not normalized.
 */
export function canonicalWebTaxJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new WebTaxSourceError("source", "Source numbers must be finite.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const entries: string[] = [];
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new WebTaxSourceError("source", "Sparse source arrays are unsupported.");
      entries.push(canonicalWebTaxJson(value[index]));
    }
    return `[${entries.join(",")}]`;
  }
  if (typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new WebTaxSourceError("source", "Source values must be plain JSON data.");
  }
  if (Object.getOwnPropertySymbols(value).length) throw new WebTaxSourceError("source", "Symbol source keys are unsupported.");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter(key => record[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalWebTaxJson(record[key])}`).join(",")}}`;
}

function identifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0") || !wellFormedUnicode(value) || new TextEncoder().encode(value).length > 128) {
    throw new WebTaxSourceError(field, "Tax source identifiers must be nonempty, well-formed Unicode, NUL-free and at most 128 UTF-8 bytes.");
  }
}

// TextEncoder replaces lone surrogates; reject them before deriving Rust IDs.
function wellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

/** The Rust descriptor orders identifiers by UTF-8 bytes, independently of locale. */
function utf8Order(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left), b = encoder.encode(right);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Input is the exact validated Studio snapshot used for persistence.
 * No trimming/defaulting/normalization is performed here, and no tax data enters
 * the projection. Unknown aggregate versions must be classified before calling.
 */
export function projectWebTaxSource(draft: StudioDraft): WebTaxSourceProjection {
  const detached = structuredClone(draft);
  identifier(detached.caseId, "case_id");
  if (detached.caseType !== undefined) {
    const reference = normalizeCaseTypeReference(detached.caseType);
    if (!reference || canonicalWebTaxJson(reference) !== canonicalWebTaxJson(detached.caseType)) throw new WebTaxSourceError("caseType", "Unsupported case-type package.");
  }
  const source = Object.fromEntries(fields.filter(field => detached[field] !== undefined).map(field => [field, detached[field]])) as WebTaxSourceProjection["source"];
  const projection: WebTaxSourceProjection = { format: "genesis-juris-web-tax-source", schemaVersion: 1, source };
  // Validate JSON values now, before any asynchronous work can observe them.
  canonicalWebTaxJson(projection);
  return freeze(projection);
}

/** Detach projection and derive indexes from that SAME snapshot before hashing.
 * A caller mutation during crypto.subtle.digest cannot mix graph/hash/index.
 * The descriptor is caller-authoritative; Rust does not attest the omitted graph.
 */
export async function deriveWebTaxSource(draft: StudioDraft): Promise<WebTaxSource> {
  const projection = projectWebTaxSource(draft);
  const allIds = new Set<string>();
  const fact_ids: string[] = [], reference_ids: string[] = [];
  for (const node of projection.source.nodes) {
    identifier(node.id, "node.id");
    if (allIds.has(node.id)) throw new WebTaxSourceError("node.id", "Duplicate source node identifier.");
    allIds.add(node.id);
    // Match CaseCore's exact fact/evidence index, not its lossy matter projection.
    if (node.type === "fact") fact_ids.push(node.id);
    if (node.type === "evidence") reference_ids.push(node.id);
  }
  if (fact_ids.length + reference_ids.length > 10000) throw new WebTaxSourceError("source", "Tax source index exceeds its policy.");
  fact_ids.sort(utf8Order); reference_ids.sort(utf8Order);
  const canonicalJson = canonicalWebTaxJson(projection);
  const bytes = new TextEncoder().encode(canonicalJson);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const scenario_fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return freeze({ projection, canonicalJson, descriptor: {
    source_schema: WEB_TAX_SOURCE_SCHEMA, case_id: projection.source.caseId,
    scenario_fingerprint, fact_ids, reference_ids,
  } });
}
