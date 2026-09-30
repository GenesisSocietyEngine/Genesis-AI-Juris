"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import { readTaxAttachment, type WebTaxAuthoringDocument } from "./tax-authoring";
import { canonicalWebTaxJson, deriveWebTaxSource, projectWebTaxSource, type WebTaxSourceDescriptor } from "./studio-tax-source";
import { changeTaxDocument, createTaxEditorAttempts, nextTaxRevision, rebindTaxDocument, taxBenefitTypes, taxCategories, taxDocumentFromLegacy, taxDocumentFromPreparation, type TaxEditorChange } from "./tax-editor-model";
import { createTaxReportExecution, type TaxReportExecutionResult } from "./tax-report-execution";
import { createWebTaxRepository } from "./tax-runtime/web-repository";
import { formatTaxBasisPoints, formatTaxMoneyCents, formatTaxMonths } from "./tax-value-format";
import { taxLegacyReview } from "./tax-legacy-review";
import styles from "./TaxAnalysisEditor.module.css";

const loadRuntime = () => import("./tax-runtime/browser").then(module => module.loadBrowserTaxRuntime());
const repository = createWebTaxRepository(loadRuntime);
const execution = createTaxReportExecution(loadRuntime);
const fields = [
  ["baseline_annual_tax_cost", "Baseline annual tax", "Налог за год до изменений", "money"],
  ["optimized_annual_tax_cost", "Optimized annual tax", "Налог за год после изменений", "money"],
  ["implementation_cost", "Implementation cost", "Стоимость внедрения", "money"],
  ["annual_maintenance_cost", "Annual maintenance cost", "Расходы на сопровождение за год", "money"],
  ["terminal_tax_or_unwind_cost", "Terminal tax or unwind cost", "Завершающий налог или расходы", "money"],
  ["analysis_horizon_months", "Analysis horizon (months)", "Горизонт анализа (месяцы)", "integer"],
  ["annual_discount_rate_bps", "Annual discount rate (basis points)", "Годовая ставка дисконтирования (б.п.)", "integer"],
  ["benefit_realization_bps", "Benefit realization (basis points)", "Реализация выгоды (б.п.)", "integer"],
] as const;
const rateFields = [["baseline_tax_rate_bps", "Baseline tax rate (basis points)", "Исходная налоговая ставка (б.п.)"], ["optimized_tax_rate_bps", "Optimized tax rate (basis points)", "Новая налоговая ставка (б.п.)"]] as const;
const resultLabels = [
  ["baseline_annual_tax_cost", "Baseline annual tax", "Исходный годовой налог"],
  ["optimized_annual_tax_cost", "Optimized annual tax", "Новый годовой налог"],
  ["recognized_annual_tax_saving", "Recognized annual tax saving", "Признанная годовая экономия налога"],
  ["effective_annual_tax_base", "Effective annual tax base", "Годовая налоговая база"],
  ["operating_annual_benefit", "Operating annual benefit", "Годовая операционная выгода"],
  ["annualized_net_benefit", "Annualized net benefit", "Среднегодовая чистая выгода"],
  ["lifecycle_net_benefit", "Lifecycle net benefit", "Чистая выгода за весь период"],
  ["npv", "Net present value", "Чистая приведённая стоимость"],
] as const;

function RawField({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  return <label><span>{label}</span><input value={value} inputMode={numeric ? "decimal" : undefined} onChange={event => onChange(event.target.value)} /></label>;
}
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.checkbox}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}

type Props = {
  draft: StudioDraft;
  locale: "en" | "ru";
  disabled: boolean;
  /** Account/access epoch and case identity from Studio; never an access grant. */
  authorityKey: string;
  onChange: (expected: StudioDraft, document: WebTaxAuthoringDocument) => void;
};

export default function TaxAnalysisEditor({ draft, locale, disabled, authorityKey, onChange }: Props) {
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const read = useMemo(() => readTaxAttachment(draft.taxAnalysis), [draft.taxAnalysis]);
  const document = read.status === "known" ? read.view : null;
  const attempts = useRef(createTaxEditorAttempts());
  const live = useRef({ draft, disabled, authorityKey });
  useLayoutEffect(() => {
    const currentAttempts = attempts.current;
    live.current = { draft, disabled, authorityKey };
    return () => { currentAttempts.invalidate(); };
  }, [draft, disabled, authorityKey]);
  const [pendingContext, setPendingContext] = useState<{ draft: StudioDraft; authorityKey: string } | null>(null);
  const pending = pendingContext?.draft === draft && pendingContext.authorityKey === authorityKey && !disabled;
  const setPending = (value: boolean) => setPendingContext(value ? { draft, authorityKey } : null);
  const [notice, setNotice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [legacyRaw, setLegacyRaw] = useState("");
  const [legacySchema, setLegacySchema] = useState<"web_amounts_v1" | "web_rates_fx_v1">("web_amounts_v1");
  const [calculation, setCalculation] = useState<{ draft: StudioDraft; authorityKey: string; outcome: TaxReportExecutionResult } | null>(null);
  const [source, setSource] = useState<{ key: string; descriptor?: WebTaxSourceDescriptor; error?: string } | null>(null);
  const projection = useMemo(() => {
    try { return { key: canonicalWebTaxJson(projectWebTaxSource(draft)) }; }
    catch { return { key: "", error: locale === "en" ? "The case source is not supported. Your inputs remain preserved." : "Источник дела не поддерживается. Введённые данные сохранены." }; }
    // Locale changes only the error wording, never source identity.
  }, [draft, locale]);
  useEffect(() => {
    let active = true;
    if (projection.key) void deriveWebTaxSource(draft).then(value => { if (active) setSource({ key: projection.key, descriptor: value.descriptor }); }, () => { if (active) setSource({ key: projection.key, error: "The case source could not be validated." }); });
    return () => { active = false; };
  }, [projection.key, draft]);
  const currentSource = source?.key === projection.key ? source.descriptor : undefined;
  const stale = document && currentSource && canonicalWebTaxJson(document.source) !== canonicalWebTaxJson(currentSource);
  const current = !disabled && calculation?.draft === draft && calculation.authorityKey === authorityKey ? calculation.outcome : null;
  const historical = document?.cached_response !== undefined;
  const legacyReview = document ? taxLegacyReview(document.legacy_documents) : { status: "clear" as const };
  const importBlocksCalculation = legacyReview.status !== "clear";
  function adopt(next: WebTaxAuthoringDocument) {
    attempts.current.invalidate(); setPending(false); setCalculation(null); setNotice("");
    onChange(draft, next);
  }
  function change(change: TaxEditorChange) {
    if (disabled || !document) return;
    try { adopt(changeTaxDocument(document, change)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "The edit could not be retained."); }
  }
  async function operate(action: "prepare" | "calculate" | "rebind" | "import") {
    if (disabled || pending) return;
    const attempt = attempts.current.begin(), expected = draft, authority = authorityKey;
    const active = () => attempts.current.current(attempt) && live.current.draft === expected && live.current.authorityKey === authority && !live.current.disabled;
    setPending(true); setNotice(""); setCalculation(null);
    try {
      if (action === "calculate") {
        if (importBlocksCalculation) throw new Error(t("Review the unavailable import before using the existing inputs.", "Проверьте недоступный импорт перед использованием прежних данных."));
        const outcome = await execution.calculate(expected);
        if (active()) setCalculation({ draft: expected, authorityKey: authority, outcome });
      } else if (action === "prepare") {
        if (read.status !== "absent") throw new Error("An existing analysis cannot be replaced by preparation.");
        const prepared = await repository.prepare(expected, { artifact_id: `tax_${crypto.randomUUID()}`, revision: "0", currency });
        const next = taxDocumentFromPreparation(prepared);
        if (active()) onChange(expected, next);
      } else if (action === "rebind") {
        if (read.status !== "known") return;
        const nextSource = await deriveWebTaxSource(expected);
        const next = rebindTaxDocument(read.attachment, nextSource.descriptor);
        if (active()) { onChange(expected, next); setNotice(t("Previous source retained. Review and reconfirm rates and components.", "Прежний источник сохранён. Проверьте и подтвердите ставки и компоненты.")); }
      } else {
        if (read.status !== "known") return;
        if (new TextEncoder().encode(legacyRaw).length > 200_000) throw new Error(t("The import exceeds the 200 KB editor limit. Keep the original file for recovery.", "Импорт превышает лимит редактора 200 КБ. Сохраните исходный файл."));
        const imported = await repository.importLegacy(expected, { artifact_id: read.view.request.context.artifact_id, revision: nextTaxRevision(read.view.request.context.revision), schema: legacySchema, original_json: legacyRaw });
        const result = taxDocumentFromLegacy(read.attachment, imported);
        if (active()) { onChange(expected, result.document); setNotice(result.converted ? t("Original and import receipt retained. Review the converted input and provenance.", "Оригинал и результат импорта сохранены. Проверьте данные и их происхождение.") : t("Import unavailable. The exact original is retained; existing inputs have not been replaced.", "Импорт недоступен. Оригинал сохранён точно; прежние данные не заменены.")); }
      }
    } catch (error) { if (active()) setNotice(error instanceof Error ? error.message : t("Rust execution is unavailable. Your inputs are unchanged.", "Расчёт Rust недоступен. Данные не изменены.")); }
    finally { if (attempts.current.current(attempt)) setPending(false); }
  }

  return <section className={`${styles.editor} page-width`} aria-labelledby="tax-analysis-title">
    <h2 id="tax-analysis-title">{t("Tax analysis", "Налоговый анализ")}</h2>
    <p>{t("Exact amounts are in the selected currency. Use a dot and up to two decimal places. Rates use basis points: 100 = 1%; 10,000 = 100%. Save the complete case with the Studio save controls.", "Суммы вводятся в выбранной валюте, с точкой и не более двух знаков после неё. Ставки: 100 б.п. = 1%; 10 000 б.п. = 100%. Сохраняйте всё дело кнопками Studio.")}</p>
    {disabled && <p role="status">{t("Editing and calculation are unavailable for this account or access state.", "Редактирование и расчёт недоступны при текущем состоянии аккаунта или доступа.")}</p>}
    {read.status !== "absent" && read.status !== "known" && <p role="alert">{t("This analysis requires read-only recovery; its original data is preserved.", "Для этого анализа требуется восстановление без редактирования. Оригинал сохранён.")} {read.reason}</p>}
    {read.status === "absent" && <fieldset disabled={disabled || pending}><legend>{t("Create a Rust tax analysis", "Создать налоговый анализ Rust")}</legend><label><span>{t("Analysis currency", "Валюта анализа")}</span><select value={currency} onChange={event => setCurrency(event.target.value)}>{["EUR", "GBP", "USD"].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="primary-cta" onClick={() => void operate("prepare")}>{t("Create tax analysis", "Создать налоговый анализ")}</button><p>{t("Existing legacy values stay retained. Import them explicitly after creating the analysis.", "Прежние данные сохраняются. Импортируйте их явно после создания анализа.")}</p></fieldset>}
    {document && <>
      <p>{t("Currency", "Валюта")}: <strong>{String(document.request.input.currency)}</strong> · {t("Revision", "Ревизия")}: {document.request.context.revision}</p>
      {(projection.error || source?.error) && <p role="alert">{projection.error || source?.error}</p>}
      {stale && <div className={styles.warning} role="status"><p>{t("The case source changed. Calculation is blocked until you review and rebind. Previous input will be retained; rates and components need new confirmation.", "Источник дела изменился. Перед расчётом проверьте и обновите привязку. Прежние данные сохранятся; ставки и компоненты требуют подтверждения.")}</p><button type="button" disabled={disabled || pending} onClick={() => void operate("rebind")}>{t("Rebind to reviewed current source", "Привязать к проверенному текущему источнику")}</button></div>}
      <fieldset disabled={disabled}><legend>{t("Tax input", "Налоговые данные")}</legend>
        <label><span>{t("Tax input basis", "Основа расчёта налога")}</span><select value={String(document.request.input.tax_input_basis)} onChange={event => change({ kind: "input", field: "tax_input_basis", value: event.target.value })}><option value="amounts">{t("Annual tax amounts", "Годовые суммы налога")}</option><option value="rates">{t("Rates and tax base", "Ставки и налоговая база")}</option></select></label>
        <div className={styles.grid}>{fields.map(([key, en, ru, kind]) => <RawField key={key} label={`${t(en, ru)}${kind === "money" ? ` (${document.request.input.currency})` : ""}`} value={document.edit[key]} numeric onChange={value => change({ kind: "edit", field: key, value })}/>)}</div>
        <div className={styles.grid}>{rateFields.map(([key, en, ru]) => <RawField key={key} label={t(en, ru)} value={document.edit[key]} numeric onChange={value => change({ kind: "edit", field: key, value })}/>)}</div>
        <Checkbox label={t("I reviewed and confirm both current tax rates", "Я проверил(а) и подтверждаю обе текущие налоговые ставки")} checked={document.rates_confirmed} onChange={value => change({ kind: "rates_confirmed", value })}/>
        <label><span>{t("Tax base mode", "Режим налоговой базы")}</span><select value={String(document.request.input.tax_base_mode)} onChange={event => change({ kind: "input", field: "tax_base_mode", value: event.target.value })}><option value="derived">{t("Confirmed components", "Подтверждённые компоненты")}</option><option value="manual_override">{t("Documented manual override", "Обоснованная ручная база")}</option></select></label>
        {document.request.input.tax_base_mode === "manual_override" && <div className={styles.grid}><RawField label={t(`Manual annual tax base (${document.request.input.currency})`, `Ручная годовая база (${document.request.input.currency})`)} value={document.edit.annual_tax_base_override} numeric onChange={value => change({ kind: "edit", field: "annual_tax_base_override", value })}/>{([["override_reason", "Override reason", "Обоснование ручной базы"], ["override_owner", "Override approving person", "Подтверждающее лицо"], ["override_as_of", "Override as-of date (YYYY-MM-DD)", "Дата подтверждения (ГГГГ-ММ-ДД)"]] as const).map(([field, en, ru]) => <RawField key={field} label={t(en, ru)} value={String(document.request.input[field] ?? "")} onChange={value => change({ kind: "input", field, value })}/>)}</div>}
        <label><span>{t("Assumptions", "Допущения")}</span><textarea value={String(document.request.input.assumptions)} onChange={event => change({ kind: "input", field: "assumptions", value: event.target.value })}/></label>
      </fieldset>
      <details><summary>{t(`Tax-base components (${document.bindings.length})`, `Компоненты базы (${document.bindings.length})`)}</summary><fieldset disabled={disabled}><legend>{t("Source and confirmation", "Источник и подтверждение")}</legend><p>{t("Excluded drafts remain saved. Required components must be included and confirmed. Source identities are exact and are never trimmed.", "Исключённые черновики сохраняются. Обязательные компоненты должны быть включены и подтверждены. Идентификаторы источника сохраняются точно.")}</p>
        <label><span>{t("Required component IDs (one per line)", "ID обязательных компонентов (по одному на строку)")}</span><textarea value={document.required_component_ids.join("\n")} onChange={event => change({ kind: "required_ids", value: event.target.value === "" ? [] : event.target.value.split("\n") })}/></label>
        {document.bindings.map((binding, index) => <fieldset key={index}><legend>{t(`Component ${index + 1}`, `Компонент ${index + 1}`)}</legend><div className={styles.grid}>{[["component_id", "Component ID", "ID компонента"], ["label", "Component label", "Название компонента"], ["amount_text", `Component amount (${binding.currency})`, `Сумма компонента (${binding.currency})`], ["fact_id", "Source fact ID", "ID исходного факта"], ["source_field", "Source field", "Поле источника"], ["period", "Period", "Период"], ["jurisdiction", "Jurisdiction", "Юрисдикция"], ["confirmation_owner", "Confirming person", "Подтверждающее лицо"], ["confirmation_as_of", "Confirmation date (YYYY-MM-DD)", "Дата подтверждения (ГГГГ-ММ-ДД)"], ["note", "Component note", "Примечание компонента"]].map(([field, en, ru]) => <RawField key={field} label={t(en, ru)} value={String(binding[field] ?? "")} numeric={field === "amount_text"} onChange={value => change({ kind: "binding", index, field, value })}/>)}</div><label><span>{t("Category", "Категория")}</span><select value={String(binding.category)} onChange={event => change({ kind: "binding", index, field: "category", value: event.target.value })}>{taxCategories.map(category => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}</select></label><Checkbox label={t("Include this component", "Включить компонент")} checked={binding.include_in_calculation === true} onChange={value => change({ kind: "binding", index, field: "include_in_calculation", value })}/><Checkbox label={t("Required component", "Обязательный компонент")} checked={document.required_component_ids.includes(String(binding.component_id))} onChange={value => change({ kind: "required", id: String(binding.component_id), value })}/><Checkbox label={t("I confirm this amount and its provenance", "Я подтверждаю сумму и её происхождение")} checked={binding.confirmed === true} onChange={value => change({ kind: "binding", index, field: "confirmed", value })}/><p className={styles.identity}>{t("Bound source", "Привязанный источник")}: {String(binding.scenario_fingerprint)}</p></fieldset>)}
        <button type="button" onClick={() => change({ kind: "add_binding", id: `component_${crypto.randomUUID()}` })}>{t("Add component", "Добавить компонент")}</button><p>{t("Available fact IDs", "Доступные ID фактов")}: {document.source.fact_ids.join(", ") || t("None — add a fact to the case and rebind.", "Нет — добавьте факт в дело и обновите привязку.")}</p>
      </fieldset></details>
      <details><summary>{t(`Dated benefits (${document.benefits.length})`, `Выгоды по датам (${document.benefits.length})`)}</summary><fieldset disabled={disabled}><legend>{t("Benefit timing and evidence", "Сроки и подтверждение выгод")}</legend>
        {document.benefits.map((benefit, index) => <fieldset key={index}><legend>{t(`Benefit ${index + 1}`, `Выгода ${index + 1}`)}</legend><div className={styles.grid}>{[["id", "Benefit ID", "ID выгоды"], ["label", "Benefit label", "Название выгоды"], ["amount_text", `Benefit amount (${document.request.input.currency})`, `Сумма выгоды (${document.request.input.currency})`], ["start_month", "Start month", "Начальный месяц"], ["end_month", "End month (blank: no end)", "Последний месяц (пусто: без окончания)"], ["realization_bps", "Realization basis points (blank: default)", "Реализация, б.п. (пусто: по умолчанию)"], ["probability_bps", "Probability basis points (blank: default)", "Вероятность, б.п. (пусто: по умолчанию)"], ["note", "Benefit note", "Примечание выгоды"]].map(([field, en, ru]) => <RawField key={field} label={t(en, ru)} value={String(benefit[field])} onChange={value => change({ kind: "benefit", index, field, value })}/>)}</div><label><span>{t("Benefit type", "Тип выгоды")}</span><select value={String(benefit.benefit_type)} onChange={event => change({ kind: "benefit", index, field: "benefit_type", value: event.target.value })}>{taxBenefitTypes.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label><span>{t("Timing", "Периодичность")}</span><select value={String(benefit.timing)} onChange={event => change({ kind: "benefit", index, field: "timing", value: event.target.value })}><option value="one_off">{t("One-off", "Разовая")}</option><option value="recurring_annual">{t("Recurring annual", "Ежегодная")}</option></select></label><label><span>{t("Source node IDs (one per line)", "ID узлов-источников (по одному на строку)")}</span><textarea value={(benefit.source_node_ids as string[]).join("\n")} onChange={event => change({ kind: "benefit", index, field: "source_node_ids", value: event.target.value === "" ? [] : event.target.value.split("\n") })}/></label><Checkbox label={t("Include in base case", "Включить в базовый вариант")} checked={benefit.include_in_base_case === true} onChange={value => change({ kind: "benefit", index, field: "include_in_base_case", value })}/></fieldset>)}
        <button type="button" onClick={() => change({ kind: "add_benefit", id: `benefit_${crypto.randomUUID()}` })}>{t("Add dated benefit", "Добавить выгоду по датам")}</button>
      </fieldset></details>
      <details><summary>{t("Import legacy tax input", "Импорт прежних налоговых данных")}</summary><fieldset disabled={disabled || pending}><legend>{t("Explicit legacy conversion", "Явное преобразование прежнего формата")}</legend><label><span>{t("Legacy format", "Прежний формат")}</span><select value={legacySchema} onChange={event => setLegacySchema(event.target.value as typeof legacySchema)}><option value="web_amounts_v1">Web amounts v1</option><option value="web_rates_fx_v1">Web rates / FX v1</option></select></label><label><span>{t("Original legacy JSON", "Исходный JSON прежнего формата")}</span><textarea rows={5} value={legacyRaw} onChange={event => setLegacyRaw(event.target.value)}/></label>{draft.taxEconomics && <button type="button" onClick={() => { setLegacySchema("web_rates_fx_v1"); setLegacyRaw(JSON.stringify(draft.taxEconomics)); }}>{t("Copy retained legacy case input for review", "Скопировать прежние данные дела для проверки")}</button>}<button type="button" disabled={!legacyRaw} onClick={() => void operate("import")}>{t("Import through Rust and retain original", "Импортировать через Rust с сохранением оригинала")}</button></fieldset></details>
      {legacyReview.status !== "clear" && <div role="status" className={styles.warning}><p>{legacyReview.status === "blocked" ? legacyReview.reason : t("The last legacy import is unavailable. Existing inputs remain separate from that original.", "Последний импорт недоступен. Прежние введённые данные не связаны с этим оригиналом.")}</p>{legacyReview.status === "pending" && <button type="button" disabled={disabled} onClick={() => change({ kind: "acknowledge_unavailable_import" })}>{t("Use existing inputs without the unavailable import", "Использовать прежние данные без недоступного импорта")}</button>}</div>}
      <div className={styles.actions}><button type="button" className="primary-cta" disabled={disabled || pending || !!stale || !currentSource || importBlocksCalculation} onClick={() => void operate("calculate")}>{t("Calculate with Rust", "Рассчитать через Rust")}</button>{pending && <button type="button" onClick={() => { attempts.current.invalidate(); setPending(false); setNotice(t("Operation cancelled. Inputs are unchanged.", "Операция отменена. Данные не изменены.")); }}>{t("Cancel pending operation", "Отменить текущую операцию")}</button>}</div>
      {!current && <p>{historical ? t("A previous response is retained as historical. Calculate again for a current result.", "Прежний ответ сохранён как исторический. Для актуального результата выполните расчёт.") : t("No current result. Every edit requires a fresh calculation.", "Актуального результата нет. После каждого изменения нужен новый расчёт.")}</p>}
      {current && <div className={styles.result} aria-live="polite">{current.status === "ready" ? <><h3>{t("Fresh Rust result", "Новый результат Rust")}</h3><dl>{resultLabels.map(([key, en, ru]) => <div key={key}><dt>{t(en, ru)}</dt><dd>{formatTaxMoneyCents(current.snapshot.result[key], String(document.request.input.currency), locale)}</dd></div>)}<div><dt>{t("Lifecycle ROI", "ROI за весь период")}</dt><dd>{formatTaxBasisPoints(current.snapshot.result.lifecycle_roi_bps, locale)}</dd></div><div><dt>{t("Payback (months)", "Окупаемость (месяцы)")}</dt><dd>{formatTaxMonths(current.snapshot.result.payback_months, locale)}</dd></div></dl><p>{t("Calculation version", "Версия расчёта")}: {current.snapshot.versions.calculation_version}</p><p className={styles.identity}>{t("Input hash", "Хеш входных данных")}: {current.snapshot.input_hash}</p>{current.snapshot.missing_inputs.length > 0 && <p>{t("Unavailable tax-base inputs", "Недоступные данные налоговой базы")}: {current.snapshot.missing_inputs.join(", ")}</p>}</> : <><h3>{t("Calculation unavailable", "Расчёт недоступен")}</h3>{"issues" in current ? <ul>{current.issues.map((issue, index) => <li key={index}>{issue.field}: {issue.message}</li>)}</ul> : "reason" in current ? <p>{current.reason}</p> : <pre>{JSON.stringify(current.detail, null, 2)}</pre>}</>}</div>}
      <details><summary>{t("Retained history and source identity", "Сохранённая история и идентификатор источника")}</summary><p className={styles.identity}>{document.source.scenario_fingerprint}</p><p>{t("Legacy originals and receipts", "Оригиналы и результаты прежнего импорта")}: {document.legacy_documents.length} · {t("Prior source documents", "Документы прежних источников")}: {document.previous_source_documents.length}</p>{document.legacy_documents.map((raw, index) => <pre key={index}>{raw}</pre>)}</details>
    </>}
    <p role="status" aria-live="polite">{pending ? t("Running the shared Rust tax engine…", "Выполняется расчёт Rust…") : notice}</p>
  </section>;
}
