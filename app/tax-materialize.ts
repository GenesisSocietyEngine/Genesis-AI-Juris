import { canonicalWebTaxJson, type WebTaxSourceDescriptor } from "./studio-tax-source";
import { readTaxAttachment, type WebTaxAuthoringDocument } from "./tax-authoring";

type JsonObject = Record<string, unknown>;
export type MaterializedWebTaxInput = {
  request: JsonObject;
  bindings: JsonObject[];
  required_component_ids: string[];
};
export type WebTaxEditIssue = Readonly<{ field: string; code: string; message: string }>;
export type WebTaxMaterialization =
  | Readonly<{ status: "ready"; input: MaterializedWebTaxInput }>
  | Readonly<{ status: "incomplete" | "stale"; issues: readonly WebTaxEditIssue[] }>;

const moneyFields = ["baseline_annual_tax_cost", "optimized_annual_tax_cost", "implementation_cost", "annual_maintenance_cost", "terminal_tax_or_unwind_cost", "annual_tax_base_override"] as const;
const integerFields = ["baseline_tax_rate_bps", "optimized_tax_rate_bps", "analysis_horizon_months", "annual_discount_rate_bps", "benefit_realization_bps"] as const;
const i64Min = BigInt("-9223372036854775808"), i64Max = BigInt("9223372036854775807");

/** Exact entry conversion only. Rust still enforces financial/domain policy. */
export function parseWebTaxAmount(text: string): string {
  if (typeof text !== "string" || text.length > 24 || !/^-?(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(text)) throw new Error("Enter an amount using a dot and at most two decimal places.");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const magnitude = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  const cents = negative ? -magnitude : magnitude;
  if (cents < i64Min || cents > i64Max) throw new Error("Amount exceeds the signed 64-bit wire range.");
  return cents.toString();
}

function unsigned(text: string, maximum: number): number {
  if (typeof text !== "string" || text.length > 10 || !/^(0|[1-9][0-9]*)$/.test(text)) throw new Error("Enter a whole nonnegative number.");
  const value = BigInt(text);
  if (value > BigInt(maximum)) throw new Error("Value exceeds the supported integer wire range.");
  return Number(value); // u16/u32 are exactly representable; money never uses Number.
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Shared editor/report input conversion. No revision bump, source rebinding,
 * calculation, cached-result adoption or fallback to an older request value.
 * `ready` means convertible authoring input, not a valid Rust calculation.
 */
export function materializeWebTaxAuthoring(document: WebTaxAuthoringDocument, currentSource: WebTaxSourceDescriptor): WebTaxMaterialization {
  const snapshot = structuredClone(document), source = structuredClone(currentSource);
  const issues: WebTaxEditIssue[] = [];
  const issue = (field: string, code: string, message: string) => { issues.push({ field, code, message }); };
  const known = readTaxAttachment({ format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify(snapshot) });
  if (known.status !== "known") return freeze({ status: "incomplete", issues: [{ field: "document", code: "unsupported_document", message: "Reopen or recover the preserved authoring document before calculating." }] });
  if (canonicalWebTaxJson(snapshot.source) !== canonicalWebTaxJson(source)) return freeze({ status: "stale", issues: [{ field: "source", code: "stale_source", message: "The source changed. Review and explicitly rebind the analysis before calculating." }] });

  const request = snapshot.request, input = request.input;
  const convert = (field: string, value: string, conversion: (raw: string) => unknown): unknown => {
    try { return conversion(value); }
    catch (error) { issue(field, value === "" ? "missing_value" : "invalid_value", error instanceof Error ? error.message : "Invalid input."); return undefined; }
  };
  for (const field of moneyFields) input[field] = field === "annual_tax_base_override" && snapshot.edit[field] === "" ? null : convert(`edit.${field}`, snapshot.edit[field], parseWebTaxAmount);
  for (const field of integerFields) input[field] = convert(`edit.${field}`, snapshot.edit[field], raw => unsigned(raw, field === "analysis_horizon_months" ? 4_294_967_295 : 65_535));
  if (input.tax_input_basis === "rates" && !snapshot.rates_confirmed) issue("rates_confirmed", "confirmation_required", "Review and explicitly confirm both current tax rates.");

  const required = new Set(snapshot.required_component_ids);
  const bindings: JsonObject[] = [];
  let staleBinding = false;
  for (const [index, binding] of snapshot.bindings.entries()) {
    if (!binding.include_in_calculation && !binding.confirmed && !required.has(binding.component_id as string)) continue;
    const field = `bindings.${index}`;
    if (binding.scenario_fingerprint !== source.scenario_fingerprint) {
      staleBinding = true;
      issue(field, "stale_source", "Review this component against the current source before confirming it.");
    }
    if (!binding.confirmed) issue(`${field}.confirmed`, "confirmation_required", "Confirm the extracted amount before using it.");
    if (binding.confirmed && (typeof binding.confirmation_owner !== "string" || !binding.confirmation_owner.trim() || typeof binding.confirmation_as_of !== "string" || !binding.confirmation_as_of.trim())) issue(field, "confirmation_provenance_required", "A confirmed amount needs an owner and an as-of date.");
    binding.amount = convert(`${field}.amount_text`, binding.amount_text as string, parseWebTaxAmount);
    delete binding.amount_text;
    bindings.push(binding);
  }
  for (const id of required) if (!bindings.some(binding => binding.component_id === id && binding.confirmed === true && binding.include_in_calculation === true)) issue("required_component_ids", "required_component_unconfirmed", `Confirm and include required component ${id}.`);

  const benefits: JsonObject[] = [];
  for (const [index, benefit] of snapshot.benefits.entries()) {
    if (!benefit.include_in_base_case) continue;
    const field = `benefits.${index}`;
    benefit.amount = convert(`${field}.amount_text`, benefit.amount_text as string, parseWebTaxAmount);
    delete benefit.amount_text;
    benefit.start_month = convert(`${field}.start_month`, benefit.start_month as string, raw => unsigned(raw, 4_294_967_295));
    for (const key of ["end_month", "realization_bps", "probability_bps"] as const) benefit[key] = benefit[key] === "" ? null : convert(`${field}.${key}`, benefit[key] as string, raw => unsigned(raw, key === "end_month" ? 4_294_967_295 : 65_535));
    benefits.push(benefit);
  }
  input.benefit_items = benefits;
  // Rust replaces derived components/base/missing-input state from these exact
  // bindings; manual override provenance remains explicit current authoring input.
  if (issues.length) return freeze({ status: staleBinding ? "stale" : "incomplete", issues });
  return freeze({ status: "ready", input: { request, bindings, required_component_ids: snapshot.required_component_ids } });
}
