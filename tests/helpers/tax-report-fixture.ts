import { readFile } from "node:fs/promises";
import { caseFingerprint, casePublicationFingerprint } from "../../app/case-integrity";
import { caseTypePlaybook } from "../../app/case-type-playbooks";
import type { CaseReportOptions } from "../../app/case-report";
import type { WebTaxAuthoringDocument } from "../../app/tax-authoring";
import type { StudioDraft } from "../../app/types";
import { deriveWebTaxSource } from "../../app/studio-tax-source";

type JsonObject = Record<string, unknown>;
const corpus = JSON.parse(await readFile(new URL("../fixtures/tax-runtime/web-corpus.json", import.meta.url), "utf8")) as { cases: { name: string; request: string; response: string }[] };
const source = JSON.parse(await readFile(new URL("../fixtures/tax-runtime/web-source.json", import.meta.url), "utf8")) as { draft: StudioDraft };
const money = "baseline_annual_tax_cost optimized_annual_tax_cost implementation_cost annual_maintenance_cost terminal_tax_or_unwind_cost annual_tax_base_override".split(" ");
const integers = "baseline_tax_rate_bps optimized_tax_rate_bps analysis_horizon_months annual_discount_rate_bps benefit_realization_bps".split(" ");
const amount = (value: unknown) => {
  if (value === null) return "";
  const cents = String(value), negative = cents.startsWith("-"), digits = (negative ? cents.slice(1) : cents).padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
};
export function fixture(name = "amounts") {
  const wire = JSON.parse(corpus.cases.find(entry => entry.name === name)!.request);
  const document: WebTaxAuthoringDocument = {
    schema: "web-tax-authoring-artifact-v1", source: wire.source, request: wire.request,
    edit: Object.fromEntries([...money.map(key => [key, amount(wire.request.input[key])]), ...integers.map(key => [key, String(wire.request.input[key])])]),
    bindings: wire.bindings.map((value: JsonObject) => {
      const binding = { ...value, amount_text: amount(value.amount) }; Reflect.deleteProperty(binding, "amount"); return binding;
    }),
    benefits: wire.request.input.benefit_items.map((value: JsonObject) => {
      const benefit: JsonObject = { ...value, amount_text: amount(value.amount), note: value.note ?? "" };
      delete benefit.amount;
      for (const key of ["start_month", "end_month", "realization_bps", "probability_bps"]) benefit[key] = value[key] === null ? "" : String(value[key]);
      return benefit;
    }),
    rates_confirmed: true, required_component_ids: wire.required_component_ids,
    legacy_documents: [' {"number":18446744073709551617,"decimal":1.2300e+0} \r\n'],
    previous_source_documents: ['{"schema":"future-preserved"}'], cached_response: "POISON cached result",
  };
  const draft = structuredClone(source.draft);
  attach(draft, document);
  return { draft, document };
}
export function attach(draft: StudioDraft, document: WebTaxAuthoringDocument) {
  draft.taxAnalysis = { format: "genesis-juris-tax-attachment", carrierVersion: 1, document: JSON.stringify(document, null, "\t") + "\r\n" };
}
/** PDF cohort uses an explicitly different, governed-font source narrative.
 * All financial inputs remain identical to the runtime corpus. The original
 * emoji-bearing corpus remains a separate renderer rejection fixture. */
export async function reportFixture(name = "amounts") {
  const value = fixture(name);
  value.draft.premise = "Synthetic tax report source. Financial values require independent review.";
  const current = await deriveWebTaxSource(value.draft);
  value.document.source = structuredClone(current.descriptor);
  value.document.request.context.scenario_fingerprint = current.descriptor.scenario_fingerprint;
  for (const binding of value.document.bindings) binding.scenario_fingerprint = current.descriptor.scenario_fingerprint;
  attach(value.draft, value.document);
  return value;
}
export function reportOptions(draft: StudioDraft, overrides: Partial<CaseReportOptions> = {}): CaseReportOptions {
  const fingerprint = caseFingerprint(draft), publication = casePublicationFingerprint(draft);
  const profileId = overrides.profileId ?? "tax_position_memorandum", language = overrides.language ?? "en";
  const profileLabel = caseTypePlaybook(draft.caseType).outputs.find(output => output.id === profileId)?.label[language];
  if (!profileLabel && !overrides.profileLabel) throw new Error("QA report profile label is unavailable.");
  return {
    language, presentationMode: "full", profileId, profileLabel: profileLabel!,
    audience: "internal", confidentiality: "confidential", preparedBy: "Synthetic reviewer", preparedFor: "Synthetic client", matterReference: "TAX-V2-QA",
    includeEconomics: true, includeRegisters: true, includeSources: true, includeAuditTrail: false, includeTechnicalIds: false,
    generatedAt: "2026-09-30T12:00:00.000Z", currentFingerprint: fingerprint, workspaceFingerprint: fingerprint,
    currentPublicationFingerprint: publication, workspacePublicationFingerprint: publication,
    privateCase: true, reportReceiptStorageScope: null, persistReportReceiptOnDevice: false, ...overrides,
  };
}
