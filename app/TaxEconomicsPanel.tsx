"use client";

import { useState } from "react";
import { defaultTaxEconomics, type TaxEconomicsResult } from "./tax-economics";

export default function TaxEconomicsPanel({ locale, model, result, disabled, onChange }: {
  locale: "en" | "ru";
  model: ReturnType<typeof defaultTaxEconomics>;
  result: TaxEconomicsResult;
  disabled: boolean;
  onChange: (change: Partial<ReturnType<typeof defaultTaxEconomics>>, label: string) => void;
}) {
  const [currencyInput, setCurrencyInput] = useState(model.currency);
  const [assumptionsInput, setAssumptionsInput] = useState(model.assumptions);
  type NumericField = "baselineAnnualTaxCost" | "optimizedAnnualTaxCost" | "implementationCost" | "annualMaintenanceCost" | "terminalTaxOrUnwindCost" | "analysisHorizonMonths" | "annualDiscountRateBps" | "benefitRealizationBps";
  const [inputs, setInputs] = useState<Record<NumericField, string>>({
    baselineAnnualTaxCost: String(model.baselineAnnualTaxCost), optimizedAnnualTaxCost: String(model.optimizedAnnualTaxCost), implementationCost: String(model.implementationCost),
    annualMaintenanceCost: String(model.annualMaintenanceCost), terminalTaxOrUnwindCost: String(model.terminalTaxOrUnwindCost), analysisHorizonMonths: String(model.analysisHorizonMonths),
    annualDiscountRateBps: String(model.annualDiscountRateBps / 100), benefitRealizationBps: String(model.benefitRealizationBps / 100),
  });
  const setInput = (field: NumericField, value: string) => setInputs((current) => ({ ...current, [field]: value }));
  const commitInput = (field: NumericField, label: string, minimum: number, maximum: number, multiplier = 1) => {
    const parsed = Number(inputs[field]);
    const next = Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed * multiplier))) : model[field];
    if (next !== model[field]) onChange({ [field]: next }, label); else setInput(field, String(next / multiplier));
  };
  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") event.currentTarget.blur(); };
  const money = (value: number) => {
    try { return new Intl.NumberFormat(locale === "en" ? "en-GB" : "ru-RU", { style: "currency", currency: model.currency, maximumFractionDigits: 0 }).format(value); }
    catch { return `${Math.round(value).toLocaleString(locale === "en" ? "en-GB" : "ru-RU")} ${model.currency}`; }
  };
  const payback = result.paybackMonths === null ? (locale === "en" ? "Not reached" : "Не достигается") : result.paybackMonths > model.analysisHorizonMonths ? (locale === "en" ? `Beyond horizon · ${result.paybackMonths.toFixed(1)} mo` : `За горизонтом · ${result.paybackMonths.toFixed(1)} мес.`) : (locale === "en" ? `${result.paybackMonths.toFixed(1)} months` : `${result.paybackMonths.toFixed(1)} мес.`);
  return <section className="tax-economics page-width" aria-labelledby="tax-economics-title" inert={disabled}>
    <header><div><span>{locale === "en" ? "TAX ECONOMICS · v1" : "ЭКОНОМИКА НАЛОГОВОЙ СТРУКТУРЫ · v1"}</span><h2 id="tax-economics-title">{locale === "en" ? "Profitability and payback estimate" : "Оценка прибыльности и срока окупаемости"}</h2></div><label><span>{locale === "en" ? "Currency" : "Валюта"}</span><input value={currencyInput} maxLength={3} pattern="[A-Za-z]{3}" aria-invalid={!/^[A-Z]{3}$/.test(currencyInput)} onChange={(event)=>setCurrencyInput(event.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3))} onBlur={() => { if (/^[A-Z]{3}$/.test(currencyInput) && currencyInput !== model.currency) onChange({currency:currencyInput},locale === "en" ? "currency" : "валюта"); else setCurrencyInput(model.currency); }}/></label></header>
    <p>{locale === "en" ? "Compare documented cash-tax costs before and after a lawful structure. Include recurring substance, governance and compliance costs; terminal tax or unwind cost prevents a deferral from being presented as a permanent saving." : "Сравните документированные денежные налоговые расходы до и после законной структуры. Учтите регулярные расходы на substance, управление и compliance; конечный налог или стоимость unwind не позволяют представить отсрочку как постоянную экономию."}</p>
    <div className="tax-economics-inputs">
      <label><span>{locale === "en" ? "Baseline annual tax" : "Налог в базовом варианте за год"}</span><input type="number" min="0" step="1" value={inputs.baselineAnnualTaxCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("baselineAnnualTaxCost",event.target.value)} onBlur={()=>commitInput("baselineAnnualTaxCost","baseline annual tax",0,1_000_000_000_000)}/></label>
      <label><span>{locale === "en" ? "Optimized annual tax" : "Налог после оптимизации за год"}</span><input type="number" min="0" step="1" value={inputs.optimizedAnnualTaxCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("optimizedAnnualTaxCost",event.target.value)} onBlur={()=>commitInput("optimizedAnnualTaxCost","optimized annual tax",0,1_000_000_000_000)}/></label>
      <label><span>{locale === "en" ? "One-off implementation" : "Разовые расходы на внедрение"}</span><input type="number" min="0" step="1" value={inputs.implementationCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("implementationCost",event.target.value)} onBlur={()=>commitInput("implementationCost","implementation cost",0,1_000_000_000_000)}/></label>
      <label><span>{locale === "en" ? "Annual structure & compliance" : "Структура и compliance за год"}</span><input type="number" min="0" step="1" value={inputs.annualMaintenanceCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("annualMaintenanceCost",event.target.value)} onBlur={()=>commitInput("annualMaintenanceCost","annual maintenance cost",0,1_000_000_000_000)}/></label>
      <label><span>{locale === "en" ? "Terminal tax / unwind" : "Конечный налог / unwind"}</span><input type="number" min="0" step="1" value={inputs.terminalTaxOrUnwindCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("terminalTaxOrUnwindCost",event.target.value)} onBlur={()=>commitInput("terminalTaxOrUnwindCost","terminal tax or unwind cost",0,1_000_000_000_000)}/></label>
      <label><span>{locale === "en" ? "Analysis horizon · months" : "Горизонт анализа · месяцы"}</span><input type="number" min="1" max="240" step="1" value={inputs.analysisHorizonMonths} onKeyDown={blurOnEnter} onChange={(event)=>setInput("analysisHorizonMonths",event.target.value)} onBlur={()=>commitInput("analysisHorizonMonths","analysis horizon",1,240)}/></label>
      <label><span>{locale === "en" ? "Discount rate · % p.a." : "Ставка дисконтирования · % годовых"}</span><input type="number" min="0" max="50" step="0.1" value={inputs.annualDiscountRateBps} onKeyDown={blurOnEnter} onChange={(event)=>setInput("annualDiscountRateBps",event.target.value)} onBlur={()=>commitInput("annualDiscountRateBps","discount rate",0,5000,100)}/></label>
      <label><span>{locale === "en" ? "Benefit realization · %" : "Вероятность реализации эффекта · %"}</span><input type="number" min="0" max="100" step="1" value={inputs.benefitRealizationBps} onKeyDown={blurOnEnter} onChange={(event)=>setInput("benefitRealizationBps",event.target.value)} onBlur={()=>commitInput("benefitRealizationBps","benefit realization",0,10000,100)}/></label>
    </div>
    <div className="tax-economics-results" aria-live="polite">
      <div><span>{locale === "en" ? "Net annual benefit" : "Чистый эффект за год"}</span><b className={result.netAnnualBenefit < 0 ? "negative" : ""}>{money(result.netAnnualBenefit)}</b><small>{locale === "en" ? `Gross tax saving ${money(result.grossAnnualTaxSaving)}` : `Валовая налоговая экономия ${money(result.grossAnnualTaxSaving)}`}</small></div>
      <div><span>{locale === "en" ? "Simple payback" : "Простая окупаемость"}</span><b>{payback}</b><small>{locale === "en" ? "Based on net annual benefit" : "По чистому годовому эффекту"}</small></div>
      <div><span>{locale === "en" ? "Lifecycle ROI" : "ROI за жизненный цикл"}</span><b className={(result.lifecycleRoiPercent ?? 0) < 0 ? "negative" : ""}>{result.lifecycleRoiPercent === null ? "—" : `${result.lifecycleRoiPercent.toFixed(1)}%`}</b><small>{locale === "en" ? `${model.analysisHorizonMonths}-month net ${money(result.horizonNetBenefit)}` : `Чистый эффект за ${model.analysisHorizonMonths} мес.: ${money(result.horizonNetBenefit)}`}</small></div>
      <div><span>NPV</span><b className={result.npv < 0 ? "negative" : ""}>{money(result.npv)}</b><small>{locale === "en" ? "Monthly discounted cash-tax estimate" : "Помесячная дисконтированная оценка"}</small></div>
    </div>
    <label className="tax-assumptions"><span>{locale === "en" ? "Assumptions, exclusions and source notes" : "Допущения, исключения и источники"}</span><textarea maxLength={4000} value={assumptionsInput} onChange={(event)=>setAssumptionsInput(event.target.value)} onBlur={() => { if (assumptionsInput !== model.assumptions) onChange({assumptions:assumptionsInput},locale === "en" ? "assumptions" : "допущения"); }}/></label>
    <aside><span className="deal-alert" aria-hidden="true">!</span><p>{locale === "en" ? "Estimate only—not tax or legal advice. Profitability does not establish legality. Publication still requires jurisdiction-specific sources, commercial purpose and review of anti-abuse, substance, disclosure and reporting rules. Node budgets are not added automatically: include them in implementation or annual costs only when appropriate, without double counting." : "Только оценка, а не налоговая или юридическая консультация. Прибыльность не подтверждает законность. Для публикации по-прежнему нужны источники по юрисдикциям, деловая цель и проверка anti-abuse, substance, раскрытия и отчётности. Бюджеты нодов автоматически не суммируются: включайте их в расходы на внедрение или ежегодные расходы только при необходимости и без двойного счёта."}</p></aside>
  </section>;
}
