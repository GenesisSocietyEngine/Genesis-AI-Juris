import { readTaxAttachment, type TaxAttachmentV1, type WebTaxAuthoringDocument, type WebTaxStoredRequest } from "./tax-authoring";
import { canonicalWebTaxJson, WEB_TAX_SOURCE_SCHEMA, type WebTaxSourceDescriptor } from "./studio-tax-source";
import type { WebTaxExecution } from "./tax-runtime/web-repository";
import { parsePreservedJson } from "./preserved-json";
import { taxLegacyDecision } from "./tax-legacy-review";

type Json = Record<string, unknown>;
export const taxMoneyEdits = ["baseline_annual_tax_cost", "optimized_annual_tax_cost", "implementation_cost", "annual_maintenance_cost", "terminal_tax_or_unwind_cost", "annual_tax_base_override"] as const;
export const taxIntegerEdits = ["baseline_tax_rate_bps", "optimized_tax_rate_bps", "analysis_horizon_months", "annual_discount_rate_bps", "benefit_realization_bps"] as const;
export const taxCategories = ["taxable_income", "deductible_expense", "non_deductible_addback", "exempt_income", "tax_loss_utilized", "taxable_adjustment", "deductible_adjustment"] as const;
export const taxBenefitTypes = ["compliance_saving", "operating_cost_saving", "adviser_cost_saving", "working_capital", "revenue_uplift", "avoided_controversy_cost", "one_off_benefit", "other"] as const;
const legacyEditFields: Record<string, string> = { annualTaxBase: "annual_tax_base_override", baselineTaxRateBps: "baseline_tax_rate_bps", optimizedTaxRateBps: "optimized_tax_rate_bps" };

/** Presentation conversion only: exact Rust cents to editable major units. */
export function taxAmountText(value: unknown): string {
  if (value === null) return "";
  if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(value)) throw new Error("Rust returned an invalid money amount.");
  const negative = value.startsWith("-"), digits = (negative ? value.slice(1) : value).padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function taxEditorAttachment(document: WebTaxAuthoringDocument): TaxAttachmentV1 {
  const attachment: TaxAttachmentV1 = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify(document) };
  const read = readTaxAttachment(attachment);
  if (read.status !== "known") throw new Error(read.status === "absent" ? "Missing tax document." : read.reason);
  return attachment;
}

export function nextTaxRevision(revision: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(revision)) throw new Error("Invalid analysis revision.");
  const next = BigInt(revision) + BigInt(1);
  if (next > BigInt("18446744073709551615")) throw new Error("This analysis reached its revision limit. Export it before creating a new analysis.");
  return next.toString();
}

function edits(request: WebTaxStoredRequest): Record<string, string> {
  return Object.fromEntries([
    ...taxMoneyEdits.map(key => [key, taxAmountText(request.input[key])]),
    ...taxIntegerEdits.map(key => [key, String(request.input[key])]),
  ]);
}
function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unexpected Rust tax response.");
  return value as Json;
}
function verifySource(execution: WebTaxExecution, response: Json) {
  const source = Object.fromEntries(Object.entries(execution.source.descriptor).filter(([key]) => key !== "source_schema"));
  if (response.source_schema !== WEB_TAX_SOURCE_SCHEMA || canonicalWebTaxJson(response.source) !== canonicalWebTaxJson(source)) throw new Error("Rust returned a different tax source.");
}
function fromRequest(requestValue: unknown, source: WebTaxSourceDescriptor): WebTaxAuthoringDocument {
  const request = structuredClone(object(requestValue)) as WebTaxStoredRequest;
  const input = object(request.input);
  const benefits = (input.benefit_items as Json[]).map(item => {
    const benefit = { ...item, amount_text: taxAmountText(item.amount), note: item.note ?? "" };
    delete (benefit as Json).amount;
    for (const key of ["start_month", "end_month", "realization_bps", "probability_bps"]) (benefit as Json)[key] = item[key] === null ? "" : String(item[key]);
    return benefit;
  });
  const document: WebTaxAuthoringDocument = {
    schema: "web-tax-authoring-artifact-v1", source: structuredClone(source), request,
    edit: edits(request), bindings: [], benefits, required_component_ids: [], rates_confirmed: false,
    legacy_documents: [], previous_source_documents: [],
  };
  taxEditorAttachment(document);
  return document;
}

export function taxDocumentFromPreparation(execution: WebTaxExecution): WebTaxAuthoringDocument {
  const response = object(parsePreservedJson(execution.response)); verifySource(execution, response);
  if (response.type !== "tax_prepared") throw new Error("Rust could not prepare this analysis.");
  const document = fromRequest(response.request, execution.source.descriptor);
  const command = object(parsePreservedJson(execution.request));
  if (document.request.context.artifact_id !== command.artifact_id || document.request.context.revision !== command.revision || document.request.input.currency !== command.currency) throw new Error("Rust preparation did not match the requested analysis.");
  return document;
}

export type TaxEditorChange =
  | { kind: "edit"; field: string; value: string }
  | { kind: "input"; field: "tax_input_basis" | "tax_base_mode" | "override_reason" | "override_owner" | "override_as_of" | "assumptions"; value: string }
  | { kind: "rates_confirmed"; value: boolean }
  | { kind: "acknowledge_unavailable_import" }
  | { kind: "binding"; index: number; field: string; value: string | boolean }
  | { kind: "required"; id: string; value: boolean }
  | { kind: "required_ids"; value: string[] }
  | { kind: "add_binding"; id: string }
  | { kind: "benefit"; index: number; field: string; value: string | boolean | string[] }
  | { kind: "add_benefit"; id: string };

/** Pure, immutable transitions. Numeric text is never parsed/defaulted here.
 * Cached responses remain historical; UI results live outside the document. */
export function changeTaxDocument(original: WebTaxAuthoringDocument, change: TaxEditorChange): WebTaxAuthoringDocument {
  const document = structuredClone(original);
  document.request.context.revision = nextTaxRevision(original.request.context.revision);
  if (change.kind === "edit") {
    if (!Object.hasOwn(document.edit, change.field)) throw new Error("Unknown tax input.");
    document.edit[change.field] = change.value;
    if (["baseline_tax_rate_bps", "optimized_tax_rate_bps"].includes(change.field)) document.rates_confirmed = false;
  } else if (change.kind === "input") {
    document.request.input[change.field] = change.value;
    if (change.field === "tax_input_basis" || change.field === "tax_base_mode") document.rates_confirmed = false;
  } else if (change.kind === "rates_confirmed") document.rates_confirmed = change.value;
  else if (change.kind === "acknowledge_unavailable_import") document.legacy_documents.push(taxLegacyDecision(document.legacy_documents));
  else if (change.kind === "binding") {
    const binding = document.bindings[change.index];
    if (!binding || !Object.hasOwn(binding, change.field) || change.field === "scenario_fingerprint" || change.field === "currency") throw new Error("Unknown tax component field.");
    const previousId = binding.component_id;
    binding[change.field] = change.value;
    if (change.field !== "confirmed") binding.confirmed = false;
    if (change.field === "component_id") document.required_component_ids = document.required_component_ids.map(id => id === previousId ? String(change.value) : id);
  } else if (change.kind === "required") {
    document.required_component_ids = change.value ? [...new Set([...document.required_component_ids, change.id])] : document.required_component_ids.filter(id => id !== change.id);
  } else if (change.kind === "required_ids") {
    document.required_component_ids = [...change.value];
  } else if (change.kind === "add_binding") {
    document.bindings.push({ component_id: change.id, label: "", amount_text: "", fact_id: "", source_field: "", scenario_fingerprint: document.source.scenario_fingerprint, note: "", category: "taxable_income", currency: document.request.input.currency, period: null, jurisdiction: null, confirmation_owner: null, confirmation_as_of: null, include_in_calculation: true, confirmed: false });
  } else if (change.kind === "benefit") {
    const benefit = document.benefits[change.index];
    if (!benefit || !Object.hasOwn(benefit, change.field)) throw new Error("Unknown benefit field.");
    benefit[change.field] = structuredClone(change.value);
  } else {
    document.benefits.push({ id: change.id, label: "", amount_text: "", start_month: "0", end_month: "", realization_bps: "", probability_bps: "", note: "", benefit_type: "other", timing: "one_off", source_node_ids: [], include_in_base_case: true });
  }
  taxEditorAttachment(document);
  return document;
}

export function rebindTaxDocument(original: TaxAttachmentV1, source: WebTaxSourceDescriptor): WebTaxAuthoringDocument {
  const read = readTaxAttachment(original);
  if (read.status !== "known") throw new Error("Recover the original analysis before rebinding.");
  const document = read.view;
  document.previous_source_documents.push(original.document);
  document.source = structuredClone(source);
  document.request.context = { ...document.request.context, case_id: source.case_id, scenario_fingerprint: source.scenario_fingerprint, revision: nextTaxRevision(document.request.context.revision) };
  document.rates_confirmed = false;
  for (const binding of document.bindings) { binding.scenario_fingerprint = source.scenario_fingerprint; binding.confirmed = false; }
  taxEditorAttachment(document);
  return document;
}

export function taxDocumentFromLegacy(original: TaxAttachmentV1, execution: WebTaxExecution): { document: WebTaxAuthoringDocument; converted: boolean } {
  const read = readTaxAttachment(original);
  if (read.status !== "known") throw new Error("Recover the current analysis before importing.");
  const response = object(parsePreservedJson(execution.response)); verifySource(execution, response);
  if (response.type !== "tax_imported") throw new Error("Rust could not import this legacy source.");
  const command = object(parsePreservedJson(execution.request)), legacy = object(response.legacy), status = object(legacy.status);
  if (legacy.original_json !== command.original_json || legacy.schema !== command.schema) throw new Error("Rust did not retain the exact legacy source.");
  const converted = status.status === "converted";
  if (!converted && status.status !== "unavailable") throw new Error("Unknown legacy conversion status.");
  const document = converted ? fromRequest(object(status.draft).request, execution.source.descriptor) : structuredClone(read.view);
  if (converted && (document.request.context.artifact_id !== command.artifact_id || document.request.context.revision !== command.revision)) throw new Error("Legacy conversion returned another analysis.");
  document.request.context.revision = String(command.revision);
  document.legacy_documents = [...read.view.legacy_documents, String(command.original_json), execution.response];
  document.previous_source_documents = [...read.view.previous_source_documents, original.document];
  if (read.view.cached_response !== undefined) document.cached_response = read.view.cached_response;
  if (converted) {
    const unavailable = object(status.draft).unavailable_legacy_fields;
    if (Array.isArray(unavailable)) for (const field of unavailable) {
      if (typeof field !== "string" || !Object.hasOwn(legacyEditFields, field)) throw new Error("Rust returned an unsupported unavailable legacy field.");
      document.edit[legacyEditFields[field]] = "";
    }
  }
  taxEditorAttachment(document);
  return { document, converted };
}

/** A completed operation is usable only in the exact synchronous caller epoch.
 * Editors must additionally compare the live draft/authority reference. */
export function createTaxEditorAttempts() {
  let generation = 0;
  return { begin: () => ++generation, invalidate: () => { generation++; }, current: (attempt: number) => attempt === generation };
}
