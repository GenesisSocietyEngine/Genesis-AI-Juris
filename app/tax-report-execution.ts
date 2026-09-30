import { parsePreservedJson } from "./preserved-json";
import { freezeStudioDraftSnapshot } from "./studio-aggregate";
import { canonicalWebTaxJson, deriveWebTaxSource, WEB_TAX_SOURCE_SCHEMA, type WebTaxSource } from "./studio-tax-source";
import { readTaxAttachment, taxAttachmentDigest, type TaxAttachmentV1, type WebTaxAuthoringDocument, type WebTaxStoredRequest } from "./tax-authoring";
import { materializeWebTaxAuthoring, type MaterializedWebTaxInput, type WebTaxEditIssue } from "./tax-materialize";
import { createWebTaxRepository, type WebTaxExecution } from "./tax-runtime/web-repository";
import { TAX_RUNTIME_CONTRACT, type TaxRuntime } from "./tax-runtime/runtime";
import { formatTaxBasisPoints, formatTaxMoneyCents, formatTaxMonths } from "./tax-value-format";
import type { StudioDraft } from "./types";

type JsonObject = Record<string, unknown>;
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
const moneyFields = ["baseline_annual_tax_cost", "optimized_annual_tax_cost", "recognized_annual_tax_saving", "recognized_recurring_benefits", "recognized_one_off_benefits", "gross_recognized_annual_benefit", "operating_annual_benefit", "annualized_net_benefit", "lifecycle_net_benefit", "npv"] as const;
export type TaxReportFinancialResult = Record<typeof moneyFields[number], string> & {
  effective_annual_tax_base: string | null;
  lifecycle_roi_bps: number | null;
  lifecycle_roi_unavailable_reason: "non_positive_lifecycle_cost" | "out_of_range" | null;
  payback_months: number | null;
};
const bindingHashSchema = "tax-component-bindings-v1";
const snapshotSchema = "web-tax-report-execution-v1";
const derivedFields = new Set(["tax_base_mode", "tax_base_formula_id", "tax_base_formula_version", "tax_base_components", "derived_annual_tax_base", "missing_tax_base_inputs", "annual_tax_base_override", "override_reason", "override_owner", "override_as_of"]);

export type TaxReportSnapshot = DeepReadonly<{
  schema: typeof snapshotSchema;
  identity: string;
  draft: StudioDraft;
  attachment: TaxAttachmentV1;
  attachment_digest: string;
  source: WebTaxSource;
  context: WebTaxStoredRequest["context"];
  versions: {
    carrier: 1; authoring: "web-tax-authoring-artifact-v1"; source: typeof WEB_TAX_SOURCE_SCHEMA;
    transport_protocol: string; input_schema: string; result_schema: string; calculation_version: string; application_policy: string;
    binding_hash_schema: typeof bindingHashSchema;
  };
  command: JsonObject;
  normalized_request: WebTaxStoredRequest;
  bindings: JsonObject[];
  required_component_ids: string[];
  input_hash: string;
  binding_hash: string;
  missing_inputs: string[];
  result: TaxReportFinancialResult;
}>;

export type TaxReportExecutionResult =
  | { status: "ready"; snapshot: TaxReportSnapshot }
  | { status: "absent" | "unsupported" | "corrupt" | "runtime_error" | "invalid_response"; reason: string }
  | { status: "incomplete" | "stale"; issues: readonly WebTaxEditIssue[] }
  | { status: "tax_error"; detail: DeepReadonly<unknown> };

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Rust response contains a malformed object.");
  return value as JsonObject;
}
function keys(value: JsonObject, expected: readonly string[]) {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) throw new Error("The Rust response fields do not match this report contract.");
}
function equal(actual: unknown, expected: unknown) {
  if (canonicalWebTaxJson(actual) !== canonicalWebTaxJson(expected)) throw new Error("The Rust response does not match the frozen report input.");
}
function strings(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== "string")) throw new Error("The Rust response contains a malformed string list.");
}
function hash(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error("The Rust response contains an invalid identity hash.");
}
async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalWebTaxJson(value));
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256-${Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function financialResult(value: unknown, currency: string): TaxReportFinancialResult {
  const result = object(value);
  keys(result, [...moneyFields, "effective_annual_tax_base", "lifecycle_roi_bps", "lifecycle_roi_unavailable_reason", "payback_months"]);
  for (const field of moneyFields) {
    if (typeof result[field] !== "string") throw new Error("A Rust money result is missing or is not exact cents.");
    formatTaxMoneyCents(result[field], currency, "en");
  }
  if (result.effective_annual_tax_base !== null && typeof result.effective_annual_tax_base !== "string") throw new Error("Invalid nullable tax base.");
  formatTaxMoneyCents(result.effective_annual_tax_base as string | null, currency, "en");
  if (result.lifecycle_roi_bps !== null && typeof result.lifecycle_roi_bps !== "number") throw new Error("Invalid nullable ROI.");
  formatTaxBasisPoints(result.lifecycle_roi_bps as number | null, "en");
  if (result.payback_months !== null && typeof result.payback_months !== "number") throw new Error("Invalid nullable payback.");
  formatTaxMonths(result.payback_months as number | null, "en");
  const reason = result.lifecycle_roi_unavailable_reason;
  if (reason !== null && reason !== "non_positive_lifecycle_cost" && reason !== "out_of_range") throw new Error("Unknown ROI unavailability reason.");
  if ((result.lifecycle_roi_bps === null) !== (reason !== null)) throw new Error("ROI and its availability reason disagree.");
  return result as TaxReportFinancialResult;
}

/** Verify transport binding without reimplementing Rust financial calculations
 * or its hashing algorithm. Hashes are validated and bound as Rust wire values;
 * this does not attest a caller-injected runtime's honesty.
 */
function verify(execution: WebTaxExecution, source: WebTaxSource, input: MaterializedWebTaxInput, document: WebTaxAuthoringDocument) {
  equal(execution.source, source);
  const command = { command: "tax_web_calculate", ...input, source: source.descriptor };
  equal(parsePreservedJson(execution.request), command);
  const response = object(parsePreservedJson(execution.response));
  if (response.type === "tax_error") {
    if (!Object.hasOwn(response, "detail")) throw new Error("The Rust error is missing its detail.");
    return { status: "tax_error" as const, detail: response.detail };
  }
  keys(response, ["type", "source_schema", "source", "draft", "calculation"]);
  if (response.type !== "tax_calculated" || response.source_schema !== WEB_TAX_SOURCE_SCHEMA) throw new Error("Unsupported Rust report response.");
  const currentSource = Object.fromEntries(Object.entries(source.descriptor).filter(([field]) => field !== "source_schema"));
  equal(response.source, currentSource);
  const bound = object(response.draft), calculation = object(response.calculation);
  keys(bound, ["request", "input_hash", "missing_inputs", "bindings", "required_component_ids", "binding_hash_schema", "binding_hash"]);
  keys(calculation, ["transport_protocol", "result_schema", "calculation_version", "application_policy", "context", "result"]);
  for (const field of ["transport_protocol", "result_schema", "calculation_version", "application_policy"] as const) {
    if (calculation[field] !== TAX_RUNTIME_CONTRACT[field]) throw new Error("The Rust calculation version does not match this application.");
  }
  equal(calculation.context, input.request.context);
  // Reuse the strict stored request shape; future fields are never normalized away.
  const normalized = readTaxAttachment({ format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify({ ...document, request: bound.request }) });
  if (normalized.status !== "known") throw new Error("The normalized Rust request has an unsupported shape.");
  const request = normalized.view.request;
  const authored = object(input.request.input);
  if (authored.tax_base_mode === "manual_override") equal(request, input.request);
  else {
    equal({ ...request, input: null }, { ...input.request, input: null });
    const retained = (value: JsonObject) => Object.fromEntries(Object.entries(value).filter(([field]) => !derivedFields.has(field)));
    equal(retained(request.input), retained(authored));
    equal({
      mode: request.input.tax_base_mode, formula: request.input.tax_base_formula_id, version: request.input.tax_base_formula_version,
      derived: request.input.derived_annual_tax_base, override: request.input.annual_tax_base_override,
      reason: request.input.override_reason, owner: request.input.override_owner, as_of: request.input.override_as_of,
      missing: request.input.missing_tax_base_inputs,
    }, { mode: "derived", formula: "confirmed-monetary-components", version: "1", derived: null, override: null, reason: null, owner: null, as_of: null, missing: bound.missing_inputs });
  }
  equal(bound.bindings, input.bindings);
  equal(bound.required_component_ids, input.required_component_ids);
  if (bound.binding_hash_schema !== bindingHashSchema) throw new Error("The binding hash version does not match this application.");
  hash(bound.input_hash); hash(bound.binding_hash); strings(bound.missing_inputs);
  const result = financialResult(calculation.result, authored.currency as string);
  return {
    status: "ready" as const, command, request, result,
    input_hash: bound.input_hash, binding_hash: bound.binding_hash, missing_inputs: bound.missing_inputs,
  };
}

/** Internal report evidence only: neither calculation nor snapshot creation
 * authorizes copying/exporting. Existing privacy, access, professional-review
 * and redaction gates must approve any output. Full draft/raw attachment stay
 * internal; there is no logging, persistence, renderer or export here.
 *
 * Every call freezes the complete input before its first await and performs one
 * fresh Rust calculation (plus cached capability negotiation). Historical cached
 * responses are never adopted. Callers must fence asynchronous UI adoption.
 */
export function createTaxReportExecution(loadRuntime: () => Promise<TaxRuntime>) {
  const repository = createWebTaxRepository(loadRuntime);
  return Object.freeze({
    async calculate(draft: StudioDraft): Promise<TaxReportExecutionResult> {
      let snapshot: StudioDraft;
      try { snapshot = freezeStudioDraftSnapshot(draft); }
      catch { return freeze({ status: "corrupt", reason: "The report source cannot be detached safely." }); }
      const attachment = readTaxAttachment(snapshot.taxAnalysis);
      if (attachment.status === "absent") return freeze({ status: "absent", reason: "There is no tax authoring attachment." });
      if (attachment.status !== "known") return freeze({ status: attachment.status, reason: attachment.reason });
      let source: WebTaxSource;
      try { source = await deriveWebTaxSource(snapshot); }
      catch { return freeze({ status: "corrupt", reason: "The report source does not satisfy the web tax source contract." }); }
      const materialized = materializeWebTaxAuthoring(attachment.view, source.descriptor);
      if (materialized.status !== "ready") return materialized;
      let execution: WebTaxExecution;
      try { execution = await repository.calculate(snapshot, materialized.input); }
      catch { return freeze({ status: "runtime_error", reason: "The shared Rust calculation could not execute." }); }
      try {
        const checked = verify(execution, source, materialized.input, attachment.view);
        if (checked.status !== "ready") return freeze(checked);
        const body = {
          schema: snapshotSchema as typeof snapshotSchema, draft: snapshot, attachment: attachment.attachment,
          attachment_digest: (await taxAttachmentDigest(attachment.attachment))!, source,
          context: checked.request.context,
          versions: {
            carrier: 1 as const, authoring: attachment.view.schema, source: WEB_TAX_SOURCE_SCHEMA,
            transport_protocol: TAX_RUNTIME_CONTRACT.transport_protocol, input_schema: TAX_RUNTIME_CONTRACT.input_schema,
            result_schema: TAX_RUNTIME_CONTRACT.result_schema, calculation_version: TAX_RUNTIME_CONTRACT.calculation_version,
            application_policy: TAX_RUNTIME_CONTRACT.application_policy, binding_hash_schema: bindingHashSchema as typeof bindingHashSchema,
          },
          command: checked.command, normalized_request: checked.request, bindings: materialized.input.bindings,
          required_component_ids: materialized.input.required_component_ids, input_hash: checked.input_hash,
          binding_hash: checked.binding_hash, missing_inputs: checked.missing_inputs, result: checked.result,
        };
        return freeze({ status: "ready", snapshot: { ...body, identity: await digest(body) } });
      } catch { return freeze({ status: "invalid_response", reason: "The Rust response does not bind to the current report input and supported versions." }); }
    },
  });
}
