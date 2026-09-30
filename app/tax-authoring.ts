import { canonicalWebTaxJson, WEB_TAX_SOURCE_SCHEMA, type WebTaxSourceDescriptor } from "./studio-tax-source";
import { parsePreservedJson } from "./preserved-json";
import { STUDIO_DRAFT_SERIALIZED_LIMIT } from "./studio-envelope";
import { TAX_RUNTIME_CONTRACT } from "./tax-runtime/runtime";

export type TaxAttachmentV1 = { format: "genesis-juris-tax-attachment"; carrierVersion: 1; document: string };
type RecordValue = Record<string, unknown>;
export type WebTaxStoredRequest = RecordValue & { context: { case_id: string; artifact_id: string; revision: string; scenario_fingerprint: string }; input: RecordValue };
export type WebTaxAuthoringDocument = {
  schema: "web-tax-authoring-artifact-v1";
  source: WebTaxSourceDescriptor;
  request: WebTaxStoredRequest;
  edit: Record<string, string>;
  bindings: RecordValue[];
  benefits: RecordValue[];
  required_component_ids: string[];
  rates_confirmed: boolean;
  legacy_documents: string[];
  previous_source_documents: string[];
  /** Historical only; loading this string never establishes a current result. */
  cached_response?: string;
};
export type TaxAttachmentRead =
  | { status: "absent" }
  | { status: "known"; attachment: TaxAttachmentV1; view: WebTaxAuthoringDocument }
  | { status: "unsupported" | "corrupt"; reason: string; original: unknown };

class ShapeError extends Error {
  constructor(readonly status: "unsupported" | "corrupt", message: string) { super(message); }
}
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown) => typeof value === "string";
const boolean = (value: unknown) => typeof value === "boolean";
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value);
const nullable = (check: Check): Check => value => value === null || check(value);
const array = (check: Check): Check => value => Array.isArray(value) && value.every(check);
type Check = (value: unknown) => boolean;
const choice = (...values: string[]): Check => value => typeof value === "string" && values.includes(value);
const strings = array(string);
const fingerprint = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) return false;
  const bytes = new TextEncoder().encode(value);
  return bytes.length <= 128 && new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) === value;
};
const revision = (value: unknown) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && (value.length < 20 || value.length === 20 && value <= "18446744073709551615");
const currency = choice("EUR", "GBP", "USD");
const category = choice("taxable_income", "deductible_expense", "non_deductible_addback", "exempt_income", "tax_loss_utilized", "taxable_adjustment", "deductible_adjustment");
const benefitType = choice("compliance_saving", "operating_cost_saving", "adviser_cost_saving", "working_capital", "revenue_uplift", "avoided_controversy_cost", "one_off_benefit", "other");
const timing = choice("recurring_annual", "one_off");

function shape(value: unknown, fields: Record<string, Check>, optional: Record<string, Check> = {}): value is RecordValue {
  if (!record(value)) throw new ShapeError("corrupt", "An authoring object is malformed.");
  if (Object.keys(value).some(key => !Object.hasOwn(fields, key) && !Object.hasOwn(optional, key))) throw new ShapeError("unsupported", "An authoring object contains unsupported fields.");
  if (Object.entries(fields).some(([key, check]) => !Object.hasOwn(value, key) || !check(value[key])) ||
      Object.entries(optional).some(([key, check]) => Object.hasOwn(value, key) && !check(value[key]))) throw new ShapeError("corrupt", "An authoring field has an unsupported shape.");
  return true;
}
function fields(names: string, check: Check): Record<string, Check> { return Object.fromEntries(names.split(" ").map(name => [name, check])); }
const component = (value: unknown) => shape(value, {
  ...fields("id label signed_amount source_type source_field period jurisdiction evidence_status note", string),
  category, source_node_id: nullable(string), include_in_calculation: boolean,
});
const benefit = (value: unknown) => shape(value, {
  id: string, label: string, benefit_type: benefitType, timing, amount: string,
  start_month: integer, end_month: nullable(integer), realization_bps: nullable(integer), probability_bps: nullable(integer),
  source_node_ids: strings, note: nullable(string), include_in_base_case: boolean,
});
const bindingDraft = (value: unknown) => shape(value, {
  ...fields("component_id label amount_text fact_id source_field scenario_fingerprint note", string),
  category, currency, ...fields("period jurisdiction confirmation_owner confirmation_as_of", nullable(string)),
  include_in_calculation: boolean, confirmed: boolean,
});
const benefitDraft = (value: unknown) => shape(value, {
  ...fields("id label amount_text start_month end_month realization_bps probability_bps note", string),
  benefit_type: benefitType, timing, source_node_ids: strings, include_in_base_case: boolean,
});
const editFields = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps";

function validateDocument(value: unknown): value is WebTaxAuthoringDocument {
  if (!record(value)) throw new ShapeError("corrupt", "The authoring document is malformed.");
  if (value.schema !== "web-tax-authoring-artifact-v1") throw new ShapeError("unsupported", "The tax authoring document version is unsupported.");
  shape(value, { schema: string, source: record, request: record, edit: record, bindings: array(bindingDraft), benefits: array(benefitDraft), required_component_ids: strings, rates_confirmed: boolean, legacy_documents: strings, previous_source_documents: strings }, { cached_response: string });
  const source = value.source as RecordValue, request = value.request as RecordValue;
  if (source.source_schema !== WEB_TAX_SOURCE_SCHEMA ||
      request.transport_protocol !== TAX_RUNTIME_CONTRACT.transport_protocol ||
      request.input_schema !== TAX_RUNTIME_CONTRACT.input_schema ||
      request.application_policy !== TAX_RUNTIME_CONTRACT.application_policy) throw new ShapeError("unsupported", "The stored tax protocol or source version is unsupported.");
  shape(source, { source_schema: string, case_id: id, scenario_fingerprint: fingerprint, fact_ids: strings, reference_ids: strings });
  const factIds = source.fact_ids as string[], referenceIds = source.reference_ids as string[];
  // Preserve the validated P4A descriptor; do not sort or remove supplied IDs.
  const bytes = (text: string) => Array.from(new TextEncoder().encode(text), byte => byte.toString(16).padStart(2, "0")).join("");
  if (factIds.length + referenceIds.length > 10000 || [...factIds, ...referenceIds].some(value => !id(value)) ||
      [factIds, referenceIds].some(ids => ids.some((value, index) => index > 0 && bytes(ids[index - 1]) >= bytes(value))) ||
      new Set([...factIds, ...referenceIds]).size !== factIds.length + referenceIds.length) throw new ShapeError("corrupt", "The stored source index is invalid.");
  shape(request, { transport_protocol: string, input_schema: string, application_policy: string, context: record, input: record });
  const context = request.context as RecordValue;
  shape(context, { case_id: id, artifact_id: id, revision, scenario_fingerprint: fingerprint });
  if (context.case_id !== source.case_id || context.scenario_fingerprint !== source.scenario_fingerprint) throw new ShapeError("corrupt", "The stored request and source identities differ.");
  const input = request.input as RecordValue;
  if (input.kind !== "tax-economics-v2") throw new ShapeError("unsupported", "The stored tax input version is unsupported.");
  shape(input, {
    kind: string, currency, tax_input_basis: choice("amounts", "rates"), tax_base_mode: choice("derived", "manual_override"),
    ...fields("tax_base_formula_id tax_base_formula_version baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost assumptions", string),
    tax_base_components: array(component), benefit_items: array(benefit), missing_tax_base_inputs: strings,
    ...fields("derived_annual_tax_base annual_tax_base_override override_reason override_owner override_as_of", nullable(string)),
    ...fields("baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps", integer),
  });
  shape(value.edit, fields(editFields, string));
  return true;
}

export function hasTaxAttachment(value: unknown): boolean {
  return record(value) && Object.hasOwn(value, "taxAnalysis") && value.taxAnalysis !== undefined;
}

/** Storage shape only. Known means safely preserved/editable, never calculated. */
export function readTaxAttachment(value: unknown): TaxAttachmentRead {
  if (value === undefined) return { status: "absent" };
  try {
    if (!record(value)) throw new ShapeError("corrupt", "The tax attachment is malformed.");
    if (value.format !== "genesis-juris-tax-attachment" || value.carrierVersion !== 1) throw new ShapeError("unsupported", "The tax attachment carrier version is unsupported.");
    shape(value, { format: string, carrierVersion: integer, document: string });
    const document = value.document as string;
    if (new TextEncoder().encode(document).length > STUDIO_DRAFT_SERIALIZED_LIMIT) throw new ShapeError("unsupported", "The tax document exceeds the editable aggregate limit.");
    const view = parsePreservedJson(document);
    validateDocument(view);
    return { status: "known", attachment: Object.freeze({ format: "genesis-juris-tax-attachment", carrierVersion: 1, document }), view: view as WebTaxAuthoringDocument };
  } catch (error) {
    return { status: error instanceof ShapeError ? error.status : "corrupt", reason: error instanceof Error ? error.message : "Malformed tax attachment.", original: value };
  }
}

export function preserveKnownTaxAttachment(value: unknown): TaxAttachmentV1 | undefined {
  const read = readTaxAttachment(value);
  if (read.status === "absent") return undefined;
  if (read.status !== "known") throw new Error("Tax attachment requires read-only recovery before editing.");
  return read.attachment;
}

export async function taxAttachmentDigest(value: unknown): Promise<string | null> {
  if (value === undefined) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalWebTaxJson(value)));
  return `sha256-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export type TaxAttachmentMutation = { protocol: "web-tax-attachment-write-v1"; expected: string | null };
/** Validate detached inputs. The persistence caller must keep its complete
 * validated after-aggregate frozen through the final authority/CAS and write;
 * passing this guard does not authorize a later mutated caller object.
 */
export async function assertTaxAttachmentMutation(input: { before: unknown; after: unknown; precondition: unknown }): Promise<void> {
  const snapshot = structuredClone(input);
  const before = readTaxAttachment(snapshot.before), after = readTaxAttachment(snapshot.after);
  if (before.status === "absent" && after.status === "absent") return;
  if (!["absent", "known"].includes(before.status) || after.status !== "known") throw new Error("Tax attachment must be preserved; this mutation is unavailable.");
  if (!record(snapshot.precondition) || snapshot.precondition.protocol !== "web-tax-attachment-write-v1" ||
      Object.keys(snapshot.precondition).sort().join(",") !== "expected,protocol" ||
      snapshot.precondition.expected !== await taxAttachmentDigest(snapshot.before)) throw new Error("Tax attachment changed or its preservation precondition is missing.");
}
