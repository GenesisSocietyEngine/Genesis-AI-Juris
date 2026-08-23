"use client";

import { useMemo } from "react";
import { calculateDealEconomics, inferDealEconomicsFromText } from "./deal-economics";
import type { StudioDraft } from "./types";

export default function DealOutcomePanel({ locale, draft }: { locale: "en" | "ru"; draft: StudioDraft }) {
  const inferredModel = useMemo(() => inferDealEconomicsFromText([
    draft.premise,
    ...draft.nodes.flatMap((node) => [node.title, node.detail]),
    ...draft.editHistory.filter((entry) => entry.action === "prompt_submitted").map((entry) => entry.message),
  ].join("\n")), [draft.editHistory, draft.nodes, draft.premise]);
  const model = draft.dealEconomics ?? inferredModel;
  const result = useMemo(() => model ? calculateDealEconomics(model) : null, [model]);
  if (!model || !result) return <section className="deal-outcome deal-outcome-empty page-width"><header><div><span>{locale === "en" ? "CASE OUTCOME · CASH FLOW" : "РЕЗУЛЬТАТ КЕЙСА · ДЕНЕЖНЫЙ ПОТОК"}</span><h2>{locale === "en" ? "Cash-flow result not calculated" : "Денежный поток не рассчитан"}</h2></div></header><p>{locale === "en" ? "The graph contains cash-flow nodes, but the case does not yet contain enough labelled financial inputs. Ask AI to extract the investment economics from the case context, then review and apply the proposed values." : "В схеме есть денежные потоки, но недостаточно подписанных финансовых данных. Попросите AI извлечь экономику инвестиции из контекста, затем проверьте и примените значения."}</p></section>;
  const money = (value: number | null) => {
    if (value === null) return "—";
    try { return new Intl.NumberFormat(locale === "en" ? "en-GB" : "ru-RU", { style: "currency", currency: model.currency, maximumFractionDigits: 0 }).format(value); }
    catch { return `${Math.round(value).toLocaleString()} ${model.currency}`; }
  };
  const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
  const scenarios = model.repaymentBasis === "amortizing" ? [result.amortizing] : model.repaymentBasis === "interest_only" ? [result.interestOnly] : [result.amortizing, result.interestOnly];
  const numericRange = (values: Array<number | null>, formatter: (value: number | null) => string) => {
    const valid = values.filter((value): value is number => value !== null).sort((left, right) => left - right);
    if (!valid.length) return "—";
    return valid.length === 1 || Math.abs(valid[0] - valid.at(-1)!) < 0.01 ? formatter(valid[0]) : `${formatter(valid[0])} – ${formatter(valid.at(-1)!)}`;
  };
  const target = model.targetAnnualReturnBps === null ? null : model.targetAnnualReturnBps / 100;
  const targetStates = scenarios.map((scenario) => scenario.targetGapPercent === null ? null : scenario.targetGapPercent >= 0);
  const targetVerdict = target === null
    ? (locale === "en" ? "Target not supplied" : "Цель не задана")
    : targetStates.every((state) => state === true)
      ? (locale === "en" ? "Target met in every modelled basis" : "Цель достигнута при всех сценариях")
      : targetStates.some((state) => state === true)
        ? (locale === "en" ? "Depends on repayment basis" : "Зависит от вида погашения")
        : (locale === "en" ? "Target not met on current inputs" : "Цель не достигнута при текущих данных");
  return <section className="deal-outcome page-width" aria-labelledby="deal-outcome-title">
    <header><div><span>{locale === "en" ? "CASE OUTCOME · CASH FLOW" : "РЕЗУЛЬТАТ КЕЙСА · ДЕНЕЖНЫЙ ПОТОК"}</span><h2 id="deal-outcome-title">{locale === "en" ? "Investment result" : "Результат инвестиции"}</h2></div><b className={targetStates.some((state) => state === true) ? "conditional" : "miss"}>{targetVerdict}</b></header>
    <p>{model.repaymentBasis === "unknown"
      ? (locale === "en" ? "The prompt does not state whether the loan is interest-only or amortizing, so both outcomes are shown." : "В промпте не указан вид погашения кредита, поэтому показаны оба сценария.")
      : (locale === "en" ? `Calculated on the stated ${model.repaymentBasis === "amortizing" ? "amortizing" : "interest-only"} basis.` : `Расчёт по указанному сценарию: ${model.repaymentBasis === "amortizing" ? "амортизируемый кредит" : "только проценты"}.`)}</p>
    <div className="deal-outcome-grid" aria-live="polite">
      <div><span>{locale === "en" ? "Initial equity" : "Начальный капитал"}</span><b>{money(result.initialEquity)}</b><small>{locale === "en" ? "Down payment + known initial fees" : "Первоначальный взнос + известные разовые расходы"}</small></div>
      <div><span>{locale === "en" ? "Gross annual rent" : "Валовая аренда за год"}</span><b>{money(model.grossAnnualIncome)}</b><small>{model.purchasePrice && model.grossAnnualIncome !== null ? `${locale === "en" ? "Gross yield" : "Валовая доходность"} ${(model.grossAnnualIncome / model.purchasePrice * 100).toFixed(1)}%` : "—"}</small></div>
      <div><span>{locale === "en" ? "Annual debt service" : "Обслуживание долга за год"}</span><b>{numericRange(scenarios.map((scenario) => scenario.annualDebtService), money)}</b><small>{model.repaymentBasis === "unknown" ? (locale === "en" ? "Interest-only to amortizing range" : "Диапазон: только проценты — амортизация") : `${model.repaymentBasis.replace("_", " ")}`}</small></div>
      <div><span>{locale === "en" ? "Annual cash flow" : "Денежный поток за год"}</span><b className={scenarios.every((scenario) => (scenario.annualCashFlow ?? 0) < 0) ? "negative" : ""}>{numericRange(scenarios.map((scenario) => scenario.annualCashFlow), money)}</b><small>{locale === "en" ? "Before tax and unprovided costs" : "До налогов и неуказанных расходов"}</small></div>
      <div><span>{locale === "en" ? "Cash-on-cash return" : "Доходность на капитал"}</span><b>{numericRange(scenarios.map((scenario) => scenario.cashOnCashReturnPercent), percent)}</b><small>{target === null ? (locale === "en" ? "No target supplied" : "Цель не задана") : `${locale === "en" ? "Target" : "Цель"} ${target.toFixed(1)}%`}</small></div>
      <div><span>DSCR</span><b>{numericRange(scenarios.map((scenario) => scenario.dscr), (value) => value === null ? "—" : `${value.toFixed(2)}×`)}</b><small>{locale === "en" ? "Before unprovided property costs" : "До неуказанных расходов объекта"}</small></div>
    </div>
    <aside><span className="deal-alert" aria-hidden="true">!</span><div><b>{locale === "en" ? "Provisional outcome" : "Предварительный результат"}</b><p>{locale === "en" ? `Missing: ${result.missingInputs.join(", ") || "none"}. Taxes, FX and legal conclusions are not inferred by this calculation.` : `Не указано: ${result.missingInputs.join(", ") || "нет"}. Налоги, FX и юридические выводы не выводятся из этого расчёта.`}</p>{!draft.dealEconomics && <small>{locale === "en" ? "Compatibility mode: values were extracted from labelled case text. Re-run AI analysis to store them as reviewed structured inputs." : "Режим совместимости: значения извлечены из подписанных данных кейса. Повторите AI-анализ, чтобы сохранить их как проверенные структурированные данные."}</small>}</div></aside>
  </section>;
}
