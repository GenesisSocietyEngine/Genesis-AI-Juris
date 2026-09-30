import { sha256 } from "./case-integrity";
import { parsePreservedJson } from "./preserved-json";
import { readTaxAttachment } from "./tax-authoring";
import { WEB_TAX_SOURCE_SCHEMA } from "./studio-tax-source";

const protocol = "web-tax-legacy-review-v1";
type Receipt = { index: number; sha256: string; originalSha256: string; unavailable: boolean };
export type TaxLegacyReview = { status: "clear" } | { status: "pending"; receipt: Receipt } | { status: "blocked"; reason: string };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const knownFields = (value: unknown, allowed: readonly string[]): boolean => strings(value) && new Set(value).size === value.length && value.every(field => allowed.includes(field));
const id = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) return false;
  const bytes = new TextEncoder().encode(value);
  return bytes.length <= 128 && new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) === value;
};
const money = (value: unknown): boolean => typeof value === "string" && /^-?(0|[1-9]\d*)$/.test(value) && value.length <= 20 && BigInt(value) >= BigInt("-9223372036854775808") && BigInt(value) <= BigInt("9223372036854775807");
const u32 = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4294967295;
const u16 = (value: unknown): value is number => u32(value) && value <= 65535;
const editFields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");

function validSource(value: unknown): value is Record<string, unknown> {
  if (!exact(value, ["case_id", "scenario_fingerprint", "fact_ids", "reference_ids"]) || !id(value.case_id) || !hash(value.scenario_fingerprint) || !strings(value.fact_ids) || !strings(value.reference_ids)) return false;
  const all = [...value.fact_ids, ...value.reference_ids];
  if (all.length > 10000 || !all.every(id) || new Set(all).size !== all.length) return false;
  const bytes = (text: string) => Array.from(new TextEncoder().encode(text), byte => byte.toString(16).padStart(2, "0")).join("");
  return [value.fact_ids, value.reference_ids].every(ids => ids.every((entry, index) => index === 0 || bytes(ids[index - 1]) < bytes(entry)));
}

function validUnavailableReason(value: unknown): boolean {
  if (!object(value)) return false;
  if (value.code === "invalid_legacy" || value.code === "invalid_binding") return exact(value, ["code", "field", "reason"]) && typeof value.field === "string" && typeof value.reason === "string";
  if (value.code === "missing_legacy_inputs" || value.code === "missing_override_provenance") return exact(value, ["code", "fields"]) && strings(value.fields);
  if (value.code === "stale_source") return exact(value, ["code", "field"]) && typeof value.field === "string";
  if (value.code !== "boundary" || !exact(value, ["code", "detail"]) || !object(value.detail)) return false;
  const detail = value.detail;
  if (detail.code === "invalid_payload") return exact(detail, ["code", "message"]) && typeof detail.message === "string";
  if (detail.code === "unsupported_version") return exact(detail, ["code", "field", "value"]) && typeof detail.field === "string" && typeof detail.value === "string";
  return detail.code === "policy_rejected" && exact(detail, ["code", "field", "reason"]) && typeof detail.field === "string" && typeof detail.reason === "string";
}

/** Validate retained wire structure, not financial correctness or provenance
 * authenticity. A malformed/future receipt must never clear a review gate. */
function validImport(value: Record<string, unknown>): boolean {
  if (!exact(value, ["type", "source_schema", "source", "legacy"]) || value.source_schema !== WEB_TAX_SOURCE_SCHEMA || !validSource(value.source)) return false;
  const legacy = value.legacy;
  if (!exact(legacy, ["schema", "original_json", "original_sha256", "status"]) || (legacy.schema !== "web_amounts_v1" && legacy.schema !== "web_rates_fx_v1") || !hash(legacy.original_sha256) || typeof legacy.original_json !== "string" || sha256(legacy.original_json) !== legacy.original_sha256 || !object(legacy.status)) return false;
  const status = legacy.status;
  if (status.status === "unavailable") return exact(status, ["status", "reason"]) && validUnavailableReason(status.reason);
  if (status.status !== "converted" || !exact(status, ["status", "draft"])) return false;
  const draft = status.draft;
  if (!exact(draft, ["request", "input_hash", "fx_json", "inactive_tax_base", "missing_override_provenance", "unavailable_legacy_fields"]) || !hash(draft.input_hash) || !strings(draft.missing_override_provenance) || !strings(draft.unavailable_legacy_fields) || !(draft.fx_json === null || typeof draft.fx_json === "string")) return false;
  if (!knownFields(draft.missing_override_provenance, ["override_reason", "override_owner", "override_as_of"]) || !knownFields(draft.unavailable_legacy_fields, ["annualTaxBase", "baselineTaxRateBps", "optimizedTaxRateBps", "assumptions"])) return false;
  if (draft.fx_json !== null) { try { parsePreservedJson(draft.fx_json); } catch { return false; } }
  if (draft.inactive_tax_base !== null) {
    const inactive = draft.inactive_tax_base;
    if (!exact(inactive, ["amount", "currency", "source_original_sha256", "provenance"]) || !money(inactive.amount) || !["EUR", "GBP", "USD"].includes(inactive.currency as string) || inactive.source_original_sha256 !== legacy.original_sha256 || inactive.provenance !== "unknown") return false;
  }
  // Reuse the strict source/request schema without importing editor transitions
  // or adopting any values. Empty edit slots are validation scaffolding only.
  const read = readTaxAttachment({ format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({ schema: "web-tax-authoring-artifact-v1", source: { ...value.source, source_schema: WEB_TAX_SOURCE_SCHEMA }, request: draft.request, edit: Object.fromEntries(editFields.map(key => [key, ""])), bindings: [], benefits: [], required_component_ids: [], rates_confirmed: false, legacy_documents: [], previous_source_documents: [] }) });
  if (read.status !== "known") return false;
  const input = read.view.request.input;
  return ["baseline_annual_tax_cost", "optimized_annual_tax_cost", "implementation_cost", "annual_maintenance_cost", "terminal_tax_or_unwind_cost"].every(key => money(input[key])) &&
    ["derived_annual_tax_base", "annual_tax_base_override"].every(key => input[key] === null || money(input[key])) &&
    ["baseline_tax_rate_bps", "optimized_tax_rate_bps", "annual_discount_rate_bps", "benefit_realization_bps"].every(key => u16(input[key])) && u32(input.analysis_horizon_months);
}

/** Retained originals are opaque. Recognized Rust import receipts and explicit
 * decisions form a strict review history shared by editor and report execution. */
export function taxLegacyReview(documents: readonly string[]): TaxLegacyReview {
  let latest: Receipt | undefined;
  const acknowledged = new Set<number>();
  for (const [index, raw] of documents.entries()) {
    let value: unknown;
    try { value = parsePreservedJson(raw); }
    catch {
      if (raw.includes(protocol)) return { status: "blocked", reason: "The retained legacy review decision is malformed." };
      continue;
    }
    if (!object(value)) continue;
    if (value.type === "tax_imported") {
      const legacy = value.legacy;
      if (!validImport(value) || !object(legacy) || !hash(legacy.original_sha256) || !object(legacy.status)) return { status: "blocked", reason: "The retained legacy import receipt is unsupported or inconsistent." };
      latest = { index, sha256: sha256(raw), originalSha256: legacy.original_sha256, unavailable: legacy.status.status === "unavailable" };
    } else if (typeof value.protocol === "string" && value.protocol.startsWith("web-tax-legacy-review")) {
      if (value.protocol !== protocol || Object.keys(value).sort().join(",") !== "decision,original_sha256,protocol,receipt_index,receipt_sha256" || value.decision !== "retain_existing_inputs" || !latest || !latest.unavailable || latest.index !== index - 1 || value.receipt_index !== latest.index || value.receipt_sha256 !== latest.sha256 || value.original_sha256 !== latest.originalSha256 || acknowledged.has(latest.index)) return { status: "blocked", reason: "The legacy review decision does not uniquely match its preceding complete import receipt." };
      acknowledged.add(latest.index);
    }
  }
  return latest?.unavailable && !acknowledged.has(latest.index) ? { status: "pending", receipt: latest } : { status: "clear" };
}

export function taxLegacyDecision(documents: readonly string[]): string {
  const review = taxLegacyReview(documents);
  if (review.status !== "pending" || review.receipt.index !== documents.length - 1) throw new Error("The unavailable import cannot be acknowledged from this history.");
  return JSON.stringify({ protocol, decision: "retain_existing_inputs", receipt_index: review.receipt.index, receipt_sha256: review.receipt.sha256, original_sha256: review.receipt.originalSha256 });
}
