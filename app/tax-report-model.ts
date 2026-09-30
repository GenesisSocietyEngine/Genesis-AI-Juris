import { parsePreservedJson } from "./preserved-json";
import { reportProfile } from "./report-model";
import { canonicalWebTaxJson, WEB_TAX_SOURCE_SCHEMA } from "./studio-tax-source";
import { readTaxAttachment } from "./tax-authoring";
import type { TaxReportSnapshot } from "./tax-report-execution";
import { formatTaxBasisPoints, formatTaxMoneyCents, formatTaxMonths, type TaxValueLanguage } from "./tax-value-format";

export const TAX_REPORT_MODEL_SCHEMA = "web-tax-report-model-v1" as const;
export const TAX_REPORT_EVIDENCE_SCHEMA = "web-tax-report-evidence-v1" as const;
export const TAX_REPORT_PRESENTATION_SCHEMA = "web-tax-report-presentation-v1" as const;
export type TaxReportProfileId = "tax_position_memorandum" | "economic_assessment";
export type TaxReportModelOptions = {
  profileId: TaxReportProfileId;
  language: TaxValueLanguage;
  includeEconomics: boolean;
  redactedNodeIds?: readonly string[];
};
export type TaxReportSection = Readonly<{
  id: string;
  title: string;
  rows: readonly (readonly [string, string])[];
  note?: string;
}>;
export type TaxReportModel = Readonly<{
  schema: typeof TAX_REPORT_MODEL_SCHEMA;
  evidenceFingerprint: string;
  presentationFingerprint: string;
  profileId: TaxReportProfileId;
  language: TaxValueLanguage;
  includeEconomics: boolean;
  /** Identity metadata only. The private execution snapshot and semantic
   * evidence body must never be spread into PDF metadata or receipt history. */
  binding: Readonly<{
    attachmentDigest: string;
    sourceFingerprint: string;
    context: TaxReportSnapshot["context"];
    versions: TaxReportSnapshot["versions"];
    inputHash: string;
    bindingHash: string;
  }>;
  sections: readonly TaxReportSection[];
}>;
export type TaxReportModelResult =
  | Readonly<{ status: "ready"; model: TaxReportModel }>
  | Readonly<{ status: "blocked"; code: "unsupported_profile" | "unsupported_options" | "redaction_requires_review" | "invalid_snapshot"; reason: string }>;

type RecordValue = Record<string, unknown>;
type Row = readonly [string, string];
const object = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
async function sha256(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function fingerprint(value: unknown) { return `sha256-${await sha256(canonicalWebTaxJson(value))}`; }

const labels = {
  inputs: ["Current calculation inputs", "Текущие исходные данные"],
  results: ["Current calculation", "Актуальный расчёт"],
  components: ["Confirmed source components", "Подтверждённые компоненты источника"],
  benefits: ["Included benefits and timing", "Учтённые выгоды и сроки"],
  override: ["Manual tax base and approval", "Налоговая база вручную и согласование"],
  assumptions: ["Assumptions", "Допущения"],
  provenance: ["Retained import provenance", "Сохранённое происхождение импорта"],
  currency: ["Currency / monetary scale", "Валюта / денежная шкала"],
  tax_input_basis: ["Input basis", "Основа ввода"],
  tax_base_mode: ["Tax base method", "Метод налоговой базы"],
  baseline_annual_tax_cost: ["Baseline annual tax cost", "Исходный годовой налог"],
  optimized_annual_tax_cost: ["Optimized annual tax cost", "Оптимизированный годовой налог"],
  implementation_cost: ["Implementation cost", "Стоимость внедрения"],
  annual_maintenance_cost: ["Annual maintenance cost", "Годовая стоимость сопровождения"],
  terminal_tax_or_unwind_cost: ["Terminal tax or unwind cost", "Налог или затраты при завершении"],
  baseline_tax_rate_bps: ["Baseline tax rate", "Исходная налоговая ставка"],
  optimized_tax_rate_bps: ["Optimized tax rate", "Оптимизированная налоговая ставка"],
  analysis_horizon_months: ["Analysis horizon", "Горизонт анализа"],
  annual_discount_rate_bps: ["Annual discount rate", "Годовая ставка дисконтирования"],
  benefit_realization_bps: ["Overall benefit realization", "Общая реализация выгод"],
  effective_annual_tax_base: ["Effective annual tax base", "Эффективная годовая налоговая база"],
  recognized_annual_tax_saving: ["Recognized annual tax saving", "Учтённая годовая налоговая экономия"],
  recognized_recurring_benefits: ["Recognized recurring benefits", "Учтённые регулярные выгоды"],
  recognized_one_off_benefits: ["Recognized one-off benefits", "Учтённые разовые выгоды"],
  gross_recognized_annual_benefit: ["Gross recognized annual benefit", "Валовая учтённая годовая выгода"],
  operating_annual_benefit: ["Operating annual benefit", "Операционная годовая выгода"],
  annualized_net_benefit: ["Annualized net benefit", "Чистая выгода в годовом выражении"],
  lifecycle_net_benefit: ["Lifecycle net benefit", "Чистая выгода за весь период"],
  npv: ["Net present value (NPV)", "Чистая приведённая стоимость (NPV)"],
  lifecycle_roi_bps: ["Lifecycle ROI", "ROI за весь период"],
  lifecycle_roi_unavailable_reason: ["ROI availability", "Доступность ROI"],
  payback_months: ["Simple payback", "Простая окупаемость"],
  amount: ["Amount", "Сумма"], category: ["Category", "Категория"],
  source: ["Source references", "Ссылки на источник"],
  confirmed: ["Confirmed", "Подтверждено"], included: ["Included in calculation", "Включено в расчёт"],
  owner: ["Confirmation owner", "Кем подтверждено"], as_of: ["As-of date", "Дата подтверждения"],
  period: ["Period", "Период"], jurisdiction: ["Jurisdiction", "Юрисдикция"],
  note: ["Note", "Примечание"], reason: ["Reason", "Обоснование"],
  start_month: ["Start month", "Начальный месяц"], end_month: ["End month", "Конечный месяц"],
  realization_bps: ["Realization", "Реализация"], probability_bps: ["Probability", "Вероятность"],
  timing: ["Timing", "Периодичность"],
  annual_tax_base_override: ["Approved manual annual tax base", "Согласованная годовая база вручную"],
  originals: ["Retained legacy documents", "Сохранённые исходные документы"],
  unknown_originals: ["Documents without a supported FX presentation", "Документы без поддерживаемого представления валютных данных"],
  provider: ["FX source", "Источник курса"], source_currency: ["Original currency", "Исходная валюта"],
  target_currency: ["Converted currency", "Валюта пересчёта"], rate: ["Retained exchange rate", "Сохранённый курс"],
} as const;
type Label = keyof typeof labels;
const enums: Record<string, readonly [string, string]> = {
  amounts: ["Saved amounts", "Сохранённые суммы"], rates: ["Tax base and rates", "Налоговая база и ставки"],
  derived: ["Confirmed source components", "Подтверждённые компоненты"], manual_override: ["Manual override", "Ввод вручную"],
  taxable_income: ["Taxable income", "Налогооблагаемый доход"], deductible_expense: ["Deductible expense", "Вычитаемые расходы"],
  non_deductible_addback: ["Non-deductible add-back", "Невычитаемые расходы"], exempt_income: ["Exempt income", "Освобождённый доход"],
  tax_loss_utilized: ["Tax loss utilized", "Использованный налоговый убыток"], taxable_adjustment: ["Taxable adjustment", "Налогооблагаемая корректировка"],
  deductible_adjustment: ["Deductible adjustment", "Вычитаемая корректировка"],
  recurring_annual: ["Recurring annually", "Ежегодно"], one_off: ["One-off", "Однократно"],
  compliance_saving: ["Compliance saving", "Экономия на соблюдении требований"], operating_cost_saving: ["Operating cost saving", "Экономия операционных затрат"],
  adviser_cost_saving: ["Adviser cost saving", "Экономия на консультантах"], working_capital: ["Working capital", "Оборотный капитал"],
  revenue_uplift: ["Revenue uplift", "Рост выручки"], avoided_controversy_cost: ["Avoided controversy cost", "Предотвращённые затраты на споры"],
  one_off_benefit: ["One-off benefit", "Разовая выгода"], other: ["Other", "Прочее"],
};

/** Extract a field token from already grammar/duplicate-validated JSON without
 * passing its number spelling through Number. Only top-level keys are read. */
function fieldToken(encoded: string, wanted: string): string | undefined {
  let position = 1;
  const space = () => { while (/\s/.test(encoded[position] ?? "") && position < encoded.length) position++; };
  const stringEnd = () => {
    position++;
    while (position < encoded.length) {
      const char = encoded[position++];
      if (char === "\\") position++;
      else if (char === '"') return;
    }
  };
  // Leading JSON whitespace is legal.
  position = encoded.indexOf("{") + 1;
  while (position < encoded.length) {
    space();
    if (encoded[position] === "}") return undefined;
    const keyStart = position;
    stringEnd();
    const key = JSON.parse(encoded.slice(keyStart, position)) as string;
    space(); position++; space();
    const start = position;
    let depth = 0;
    while (position < encoded.length) {
      const char = encoded[position];
      if (char === '"') { stringEnd(); continue; }
      if (depth === 0 && (char === "," || char === "}")) break;
      if (char === "{" || char === "[") depth++;
      if (char === "}" || char === "]") depth--;
      position++;
    }
    if (key === wanted) return encoded.slice(start, position).trim();
    if (encoded[position++] === "}") return undefined;
  }
  return undefined;
}

/** Only the pinned Rust legacy record and a scalar FX allowlist are projected.
 * Originals, extra fields and converted historical requests are never printed.
 * A hash confirms retained-byte identity, not source reliability or approval. */
async function legacyFx(originals: readonly string[]) {
  const records: { provider: string; sourceCurrency: string; targetCurrency: string; rate: string; asOf: string }[] = [];
  for (const encoded of originals) {
    try {
      const retained = parsePreservedJson(encoded);
      // The editor retains complete native import responses alongside each raw
      // original. Bare legacy records remain supported for existing carriers.
      const legacy = object(retained) && retained.type === "tax_imported" && retained.source_schema === WEB_TAX_SOURCE_SCHEMA &&
        Object.keys(retained).sort().join(",") === "legacy,source,source_schema,type"
        ? retained.legacy : retained;
      if (!object(legacy) || legacy.schema !== "web_rates_fx_v1" || typeof legacy.original_json !== "string" ||
          typeof legacy.original_sha256 !== "string" || !object(legacy.status) || legacy.status.status !== "converted" || !object(legacy.status.draft)) continue;
      if (await sha256(legacy.original_json) !== legacy.original_sha256) continue;
      const rawFx = legacy.status.draft.fx_json;
      if (typeof rawFx !== "string") continue;
      const fx = parsePreservedJson(rawFx), original = parsePreservedJson(legacy.original_json);
      if (!object(fx) || !object(original) || fieldToken(legacy.original_json, "fx") !== rawFx ||
          Object.keys(fx).sort().join(",") !== "asOf,provider,rate,sourceCurrency,targetCurrency" ||
          ["provider", "sourceCurrency", "targetCurrency", "asOf"].some(key => typeof fx[key] !== "string") ||
          typeof fx.rate !== "number" || !Number.isFinite(fx.rate) || fx.rate <= 0) continue;
      const rate = fieldToken(rawFx, "rate");
      if (rate === undefined) continue;
      records.push({ provider: fx.provider as string, sourceCurrency: fx.sourceCurrency as string, targetCurrency: fx.targetCurrency as string, asOf: fx.asOf as string, rate });
    } catch { /* Retained unknown data remains internal and is counted below. */ }
  }
  return records;
}

/** Pure presentation from createTaxReportExecution's verified ready snapshot.
 * This does not execute Rust, trust a historical cache, attest an injected
 * runtime, or grant permission to disclose/copy/export. The caller must retain
 * publication, privacy and authority checks. Inputs are detached before awaits.
 *
 * Semantic evidence deliberately excludes the full private draft identity
 * (updatedAt/protection/history). The complete attachment is still digest-bound;
 * graph/audit/options actually emitted must have their own outer report binding.
 */
export async function buildTaxReportModel(snapshot: TaxReportSnapshot, options: TaxReportModelOptions): Promise<TaxReportModelResult> {
  const block = (code: Extract<TaxReportModelResult, { status: "blocked" }>["code"], reason: string): TaxReportModelResult => freeze({ status: "blocked", code, reason });
  let saved: TaxReportSnapshot, selected: TaxReportModelOptions;
  try { saved = freeze(structuredClone(snapshot)); selected = freeze(structuredClone(options)); }
  catch { return block("invalid_snapshot", "The verified tax report snapshot cannot be detached safely."); }
  if (!["tax_position_memorandum", "economic_assessment"].includes(selected.profileId)) return block("unsupported_profile", "This profile does not support the current tax report model.");
  try {
    if (!saved.draft.caseType) throw new Error("Missing case type");
    reportProfile(selected.profileId, saved.draft.caseType.id);
  }
  catch { return block("unsupported_profile", "This profile does not support the current case type."); }
  if (!["en", "ru"].includes(selected.language) || typeof selected.includeEconomics !== "boolean" ||
      (selected.redactedNodeIds !== undefined && (!Array.isArray(selected.redactedNodeIds) || selected.redactedNodeIds.some(id => typeof id !== "string")))) return block("unsupported_options", "Unsupported tax report presentation options.");
  if (selected.redactedNodeIds?.length) return block("redaction_requires_review", "Tax output with redacted source content requires a reviewed disclosure policy.");

  try {
    if (saved.schema !== "web-tax-report-execution-v1") throw new Error("Unsupported execution snapshot");
    const attachment = readTaxAttachment(saved.attachment);
    if (attachment.status !== "known" || await fingerprint(attachment.attachment) !== saved.attachment_digest) throw new Error("Attachment identity mismatch");
    const evidenceFingerprint = await fingerprint({
      schema: TAX_REPORT_EVIDENCE_SCHEMA, attachment_digest: saved.attachment_digest,
      source: saved.source.descriptor, context: saved.context, versions: saved.versions,
      normalized_request: saved.normalized_request, bindings: saved.bindings,
      required_component_ids: saved.required_component_ids, input_hash: saved.input_hash,
      binding_hash: saved.binding_hash, missing_inputs: saved.missing_inputs, result: saved.result,
    });
    const sections: TaxReportSection[] = [];
    if (selected.includeEconomics) {
      const language = selected.language, index = language === "ru" ? 1 : 0;
      const local = (en: string, ru: string) => index ? ru : en;
      const label = (key: Label) => labels[key][index];
      const unavailable = local("Unavailable", "Недоступно");
      const text = (value: unknown) => value === null ? unavailable : typeof value === "string" ? value : (() => { throw new Error("Invalid text"); })();
      const enumeration = (value: unknown) => typeof value === "string" && enums[value] ? enums[value][index] : text(value);
      const yesNo = (value: unknown) => value === true ? local("Yes", "Да") : value === false ? local("No", "Нет") : (() => { throw new Error("Invalid boolean"); })();
      const input = saved.normalized_request.input, currency = text(input.currency);
      const money = (value: unknown) => formatTaxMoneyCents(value as string | null, currency, language);
      const bps = (value: unknown) => formatTaxBasisPoints(value as number | null, language);
      const months = (value: unknown) => formatTaxMonths(value as number | null, language);
      const row = (key: Label, value: string): Row => [label(key), value];
      const add = (id: Label, rows: Row[], note?: string) => sections.push({ id, title: label(id), rows, ...(note === undefined ? {} : { note }) });
      add("inputs", [row("currency", `${currency}; ${local("100 cents per unit", "100 центов на единицу")}`),
        row("tax_input_basis", enumeration(input.tax_input_basis)), row("tax_base_mode", enumeration(input.tax_base_mode)),
        ...(["baseline_annual_tax_cost", "optimized_annual_tax_cost", "implementation_cost", "annual_maintenance_cost", "terminal_tax_or_unwind_cost"] as const).map(key => row(key, money(input[key]))),
        ...(input.tax_input_basis === "rates" ? (["baseline_tax_rate_bps", "optimized_tax_rate_bps"] as const).map(key => row(key, bps(input[key]))) : []),
        ...(["annual_discount_rate_bps", "benefit_realization_bps"] as const).map(key => row(key, bps(input[key]))),
        row("analysis_horizon_months", months(input.analysis_horizon_months)),
      ], input.tax_input_basis === "rates" ? local("Saved amount slots are retained inputs; current tax costs are calculated from the confirmed base and rates below.", "Сохранённые суммы приведены как исходные данные; текущие налоги рассчитаны по подтверждённой базе и ставкам ниже.") : undefined);
      const result = saved.result;
      add("results", [
        ...(["effective_annual_tax_base", "baseline_annual_tax_cost", "optimized_annual_tax_cost", "recognized_annual_tax_saving", "recognized_recurring_benefits", "recognized_one_off_benefits", "gross_recognized_annual_benefit", "operating_annual_benefit", "annualized_net_benefit", "lifecycle_net_benefit", "npv"] as const).map(key => row(key, money(result[key]))),
        row("lifecycle_roi_bps", bps(result.lifecycle_roi_bps)),
        ...(result.lifecycle_roi_unavailable_reason === null ? [] : [row("lifecycle_roi_unavailable_reason", result.lifecycle_roi_unavailable_reason === "non_positive_lifecycle_cost" ? local("Lifecycle cost is not positive.", "Затраты за весь период не положительны.") : local("ROI exceeds the supported range.", "ROI выходит за поддерживаемый диапазон."))]),
        row("payback_months", months(result.payback_months)),
      ], local("Simple payback is a steady-state measure, not the dated cash-flow break-even point. Lifecycle benefit and NPV include the specified timing.", "Простая окупаемость — показатель постоянного режима, а не момент безубыточности датированных денежных потоков. Выгода за весь период и NPV учитывают заданные сроки."));
      if (saved.bindings.length) add("components", saved.bindings.flatMap((component, i): Row[] => [
        [`${i + 1}. ${text(component.label)}`, text(component.component_id)], row("category", enumeration(component.category)), row("amount", money(component.amount)),
        row("included", yesNo(component.include_in_calculation)), row("confirmed", yesNo(component.confirmed)),
        row("source", `${text(component.fact_id)} · ${text(component.source_field)}`), row("owner", text(component.confirmation_owner)),
        row("as_of", text(component.confirmation_as_of)), row("period", text(component.period)), row("jurisdiction", text(component.jurisdiction)), row("note", text(component.note)),
      ]));
      if (input.tax_base_mode === "manual_override") add("override", [row("annual_tax_base_override", money(input.annual_tax_base_override)), row("reason", text(input.override_reason)), row("owner", text(input.override_owner)), row("as_of", text(input.override_as_of))]);
      const benefits = input.benefit_items as readonly RecordValue[];
      if (benefits.length) add("benefits", benefits.flatMap((benefit, i): Row[] => [
        [`${i + 1}. ${text(benefit.label)}`, text(benefit.id)], row("category", enumeration(benefit.benefit_type)), row("timing", enumeration(benefit.timing)),
        row("amount", money(benefit.amount)), row("included", yesNo(benefit.include_in_base_case)), row("start_month", months(benefit.start_month)),
        row("end_month", benefit.end_month === null ? local("Through the analysis horizon", "До конца горизонта анализа") : months(benefit.end_month)),
        row("realization_bps", benefit.realization_bps === null ? local("Uses overall benefit realization", "Используется общая реализация выгод") : bps(benefit.realization_bps)),
        row("probability_bps", benefit.probability_bps === null ? local("Default 100.00%", "По умолчанию 100,00%") : bps(benefit.probability_bps)),
        row("source", (benefit.source_node_ids as string[]).join(", ")), row("note", text(benefit.note)),
      ]));
      add("assumptions", [[label("assumptions"), text(input.assumptions) || local("None supplied", "Не указаны")]]);
      const originals = attachment.view.legacy_documents;
      if (originals.length) {
        const fx = await legacyFx(originals);
        add("provenance", [row("originals", String(originals.length)), row("unknown_originals", String(originals.length - fx.length)),
          ...fx.flatMap((record, i): Row[] => [
            [`${i + 1}. ${label("provider")}`, record.provider], row("source_currency", record.sourceCurrency), row("target_currency", record.targetCurrency),
            row("rate", record.rate), row("as_of", record.asOf),
          ]),
        ], local("Historical FX metadata is retained provenance only; no exchange conversion is applied again. Unsupported originals and previous source documents remain private and are not reproduced here.", "Исторические валютные данные отражают только происхождение; повторный пересчёт не выполняется. Неподдерживаемые оригиналы и прежние источники остаются приватными и здесь не воспроизводятся."));
      }
    }
    const body = {
      schema: TAX_REPORT_MODEL_SCHEMA, evidenceFingerprint,
      profileId: selected.profileId, language: selected.language, includeEconomics: selected.includeEconomics,
      binding: { attachmentDigest: saved.attachment_digest, sourceFingerprint: saved.source.descriptor.scenario_fingerprint,
        context: saved.context, versions: saved.versions, inputHash: saved.input_hash, bindingHash: saved.binding_hash },
      sections,
    };
    return freeze({ status: "ready", model: { ...body, presentationFingerprint: await fingerprint({ schema: TAX_REPORT_PRESENTATION_SCHEMA, model: body }) } });
  } catch { return block("invalid_snapshot", "The verified tax snapshot cannot be presented without changing its meaning."); }
}
