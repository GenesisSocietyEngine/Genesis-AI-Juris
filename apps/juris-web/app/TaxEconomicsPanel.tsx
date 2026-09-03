"use client";

import { useState } from "react";
import { defaultTaxEconomics, type RentalTaxBaseBreakdown, type TaxEconomicsResult } from "./tax-economics";
import { manualTaxRateChange, taxRateOrigin } from "./tax-rate-inference";

export default function TaxEconomicsPanel({ locale, model, result, taxBaseBreakdown, disabled, onChange, onCurrencyChange, embedded = false }: {
  locale: "en" | "ru";
  model: ReturnType<typeof defaultTaxEconomics>;
  result: TaxEconomicsResult;
  taxBaseBreakdown?: RentalTaxBaseBreakdown | null;
  disabled: boolean;
  onChange: (change: Partial<ReturnType<typeof defaultTaxEconomics>>, label: string) => void;
  onCurrencyChange: (currency: string) => Promise<{ ok: boolean; message: string }>;
  embedded?: boolean;
}) {
  const [assumptionsInput, setAssumptionsInput] = useState(model.assumptions);
  const [fxStatus, setFxStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fxMessage, setFxMessage] = useState("");
  const currencies = ["EUR", "GBP", "USD", "CHF", "CNY", "HKD", "SGD", "AED", "CAD", "AUD", "JPY", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "TRY", "RUB"];
  type NumericField = "annualTaxBase" | "baselineTaxRateBps" | "optimizedTaxRateBps" | "baselineAnnualTaxCost" | "optimizedAnnualTaxCost" | "implementationCost" | "annualMaintenanceCost" | "terminalTaxOrUnwindCost" | "analysisHorizonMonths" | "annualDiscountRateBps" | "benefitRealizationBps";
  const [inputs, setInputs] = useState<Record<NumericField, string>>({
    annualTaxBase: String(model.annualTaxBase), baselineTaxRateBps: String(model.baselineTaxRateBps / 100), optimizedTaxRateBps: String(model.optimizedTaxRateBps / 100),
    baselineAnnualTaxCost: String(model.baselineAnnualTaxCost), optimizedAnnualTaxCost: String(model.optimizedAnnualTaxCost), implementationCost: String(model.implementationCost),
    annualMaintenanceCost: String(model.annualMaintenanceCost), terminalTaxOrUnwindCost: String(model.terminalTaxOrUnwindCost), analysisHorizonMonths: String(model.analysisHorizonMonths),
    annualDiscountRateBps: String(model.annualDiscountRateBps / 100), benefitRealizationBps: String(model.benefitRealizationBps / 100),
  });
  const setInput = (field: NumericField, value: string) => setInputs((current) => ({ ...current, [field]: value }));
  const commitInput = (field: NumericField, label: string, minimum: number, maximum: number, multiplier = 1) => {
    const parsed = Number(inputs[field]);
    const next = Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed * multiplier))) : model[field];
    const rateField = field === "baselineTaxRateBps" ? "baseline" : field === "optimizedTaxRateBps" ? "optimized" : null;
    const rateChange = rateField ? manualTaxRateChange(model, rateField, next) : null;
    if (rateChange) onChange(rateChange, label);
    else if (next !== model[field]) onChange({ [field]: next }, label);
    else setInput(field, String(next / multiplier));
  };
  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") event.currentTarget.blur(); };
  const money = (value: number) => {
    try { return new Intl.NumberFormat(locale === "en" ? "en-GB" : "ru-RU", { style: "currency", currency: model.currency, maximumFractionDigits: 0 }).format(value); }
    catch { return `${Math.round(value).toLocaleString(locale === "en" ? "en-GB" : "ru-RU")} ${model.currency}`; }
  };
  const payback = result.paybackMonths === null ? (locale === "en" ? "Not reached" : "Не достигается") : result.paybackMonths > model.analysisHorizonMonths ? (locale === "en" ? `Beyond horizon · ${result.paybackMonths.toFixed(1)} mo` : `За горизонтом · ${result.paybackMonths.toFixed(1)} мес.`) : (locale === "en" ? `${result.paybackMonths.toFixed(1)} months` : `${result.paybackMonths.toFixed(1)} мес.`);
  const rateBasis = (field: "baseline" | "optimized") => {
    const origin = taxRateOrigin(model, field);
    if (!origin) return locale === "en" ? "State a labelled rate in the prompt or enter it manually." : "Укажите ставку с подписью в промпте или введите вручную.";
    if (origin === "prompt") return locale === "en" ? "Prefilled from the labelled rate in the prompt." : "Предзаполнено из явно указанной ставки в промпте.";
    if (origin === "manual") return locale === "en" ? "Manual Studio override." : "Ручная корректировка в Studio.";
    return locale === "en" ? "UK property default · 2026-08-24 · verify taxpayer and vehicle." : "UK property default · 2026-08-24 · проверьте налогоплательщика и структуру.";
  };
  const changeCurrency = async (currency: string) => {
    if (currency === model.currency || fxStatus === "loading") return;
    setFxStatus("loading");
    setFxMessage(locale === "en" ? "Loading the current ECB reference rate…" : "Загружается текущий справочный курс ECB…");
    const outcome = await onCurrencyChange(currency);
    setFxStatus(outcome.ok ? "idle" : "error");
    setFxMessage(outcome.message);
  };
  return <section className={`tax-economics ${embedded ? "embedded" : "page-width"}`} aria-labelledby="tax-economics-title" inert={disabled}>
    <header><div><span>{locale === "en" ? "TAX ECONOMICS · v1" : "ЭКОНОМИКА НАЛОГОВОЙ СТРУКТУРЫ · v1"}</span><h2 id="tax-economics-title">{locale === "en" ? "Profitability and payback estimate" : "Оценка прибыльности и срока окупаемости"}</h2></div><div className="tax-economics-header-controls"><label><span>{locale === "en" ? "Tax input basis" : "Способ ввода налога"}</span><select value={model.taxInputBasis} onChange={(event)=>onChange({taxInputBasis:event.target.value as "amounts"|"rates"},locale === "en" ? "tax input basis" : "способ ввода налога")}><option value="rates">{locale === "en" ? "Tax base + rates (%)" : "Налоговая база + ставки (%)"}</option><option value="amounts">{locale === "en" ? "Annual tax amounts" : "Годовые суммы налога"}</option></select></label><label><span>{locale === "en" ? "Currency" : "Валюта"}</span><select value={model.currency} disabled={fxStatus === "loading"} onChange={(event)=>void changeCurrency(event.target.value)} aria-label={locale === "en" ? "Tax economics currency" : "Валюта налоговой экономики"}>{!currencies.includes(model.currency) && <option value={model.currency}>{model.currency}</option>}{currencies.map((currency)=><option key={currency} value={currency}>{currency}</option>)}</select><small className={fxStatus === "error" ? "fx-error" : ""}>{fxMessage || (model.fx ? `ECB · ${model.fx.asOf} · 1 ${model.fx.sourceCurrency} = ${model.fx.rate.toPrecision(6)} ${model.fx.targetCurrency}` : (locale === "en" ? "Auto-selected from case context" : "Автоматически из контекста кейса"))}</small></label></div></header>
    <p>{locale === "en" ? "Compare documented cash-tax costs before and after a lawful structure. Include recurring substance, governance and compliance costs; terminal tax or unwind cost prevents a deferral from being presented as a permanent saving." : "Сравните документированные денежные налоговые расходы до и после законной структуры. Учтите регулярные расходы на substance, управление и compliance; конечный налог или стоимость unwind не позволяют представить отсрочку как постоянную экономию."}</p>
    <div className="tax-economics-inputs">
      {model.taxInputBasis === "rates" ? <><label><span>{locale === "en" ? "Annual taxable base · derived" : "Годовая налоговая база · расчёт"}</span><input type="number" min="0" step="1" value={inputs.annualTaxBase} readOnly aria-readonly="true"/><small>{taxBaseBreakdown ? (locale === "en" ? `Gross rent ${money(taxBaseBreakdown.grossAnnualRent)} − property expenses ${money(taxBaseBreakdown.rentalPropertyExpenses)}${taxBaseBreakdown.propertyExpensesEstimated ? " (20% base estimate)" : ""} − loan interest ${money(taxBaseBreakdown.loanInterestExpense)}` : `Валовая аренда ${money(taxBaseBreakdown.grossAnnualRent)} − расходы объекта ${money(taxBaseBreakdown.rentalPropertyExpenses)}${taxBaseBreakdown.propertyExpensesEstimated ? " (базовая оценка 20%)" : ""} − проценты ${money(taxBaseBreakdown.loanInterestExpense)}`) : (locale === "en" ? "Complete rent, property-cost and loan-interest inputs in the case." : "Заполните аренду, расходы объекта и проценты по кредиту.")}</small></label><label><span>{locale === "en" ? "Baseline tax rate · %" : "Базовая ставка налога · %"}</span><input type="number" min="0" max="100" step="0.01" value={inputs.baselineTaxRateBps} onKeyDown={blurOnEnter} onChange={(event)=>setInput("baselineTaxRateBps",event.target.value)} onBlur={()=>commitInput("baselineTaxRateBps","baseline tax rate",0,10_000,100)}/><small>{rateBasis("baseline")}</small></label><label><span>{locale === "en" ? "Optimized tax rate · %" : "Ставка после оптимизации · %"}</span><input type="number" min="0" max="100" step="0.01" value={inputs.optimizedTaxRateBps} onKeyDown={blurOnEnter} onChange={(event)=>setInput("optimizedTaxRateBps",event.target.value)} onBlur={()=>commitInput("optimizedTaxRateBps","optimized tax rate",0,10_000,100)}/><small>{rateBasis("optimized")}</small></label><div className="tax-rate-derived"><span>{locale === "en" ? "Derived annual cash tax" : "Расчётный годовой налог"}</span><b>{money(result.baselineAnnualTaxCost)} → {money(result.optimizedAnnualTaxCost)}</b><small>{locale === "en" ? "Tax base × entered percentage rate" : "Налоговая база × введённая процентная ставка"}</small></div></> : <><label><span>{locale === "en" ? "Baseline annual tax" : "Налог в базовом варианте за год"}</span><input type="number" min="0" step="1" value={inputs.baselineAnnualTaxCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("baselineAnnualTaxCost",event.target.value)} onBlur={()=>commitInput("baselineAnnualTaxCost","baseline annual tax",0,1_000_000_000_000)}/></label><label><span>{locale === "en" ? "Optimized annual tax" : "Налог после оптимизации за год"}</span><input type="number" min="0" step="1" value={inputs.optimizedAnnualTaxCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("optimizedAnnualTaxCost",event.target.value)} onBlur={()=>commitInput("optimizedAnnualTaxCost","optimized annual tax",0,1_000_000_000_000)}/></label></>}
      <label><span>{locale === "en" ? "One-off implementation" : "Разовые расходы на внедрение"}</span><input type="number" min="0" step="1" value={inputs.implementationCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("implementationCost",event.target.value)} onBlur={()=>commitInput("implementationCost","implementation cost",0,1_000_000_000_000)}/><small>{locale === "en" ? `Annualized over ${model.analysisHorizonMonths} months: ${money(result.annualizedImplementationCost)} p.a.` : `В пересчёте на год за ${model.analysisHorizonMonths} мес.: ${money(result.annualizedImplementationCost)}`}</small></label>
      <label><span>{locale === "en" ? "Annual structure & compliance" : "Структура и compliance за год"}</span><input type="number" min="0" step="1" value={inputs.annualMaintenanceCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("annualMaintenanceCost",event.target.value)} onBlur={()=>commitInput("annualMaintenanceCost","annual maintenance cost",0,1_000_000_000_000)}/><small>{locale === "en" ? "Prefilled from the case’s annual structure cost" : "Предзаполнено из годовой стоимости структуры кейса"}</small></label>
      <label><span>{locale === "en" ? "Terminal tax / unwind" : "Конечный налог / unwind"}</span><input type="number" min="0" step="1" value={inputs.terminalTaxOrUnwindCost} onKeyDown={blurOnEnter} onChange={(event)=>setInput("terminalTaxOrUnwindCost",event.target.value)} onBlur={()=>commitInput("terminalTaxOrUnwindCost","terminal tax or unwind cost",0,1_000_000_000_000)}/></label>
      <label><span>{locale === "en" ? "Analysis horizon · months" : "Горизонт анализа · месяцы"}</span><input type="number" min="1" max="240" step="1" value={inputs.analysisHorizonMonths} onKeyDown={blurOnEnter} onChange={(event)=>setInput("analysisHorizonMonths",event.target.value)} onBlur={()=>commitInput("analysisHorizonMonths","analysis horizon",1,240)}/></label>
      <label><span>{locale === "en" ? "Discount rate · % p.a." : "Ставка дисконтирования · % годовых"}</span><input type="number" min="0" max="50" step="0.1" value={inputs.annualDiscountRateBps} onKeyDown={blurOnEnter} onChange={(event)=>setInput("annualDiscountRateBps",event.target.value)} onBlur={()=>commitInput("annualDiscountRateBps","discount rate",0,5000,100)}/></label>
      <label><span>{locale === "en" ? "Benefit realization · %" : "Вероятность реализации эффекта · %"}</span><input type="number" min="0" max="100" step="1" value={inputs.benefitRealizationBps} onKeyDown={blurOnEnter} onChange={(event)=>setInput("benefitRealizationBps",event.target.value)} onBlur={()=>commitInput("benefitRealizationBps","benefit realization",0,10000,100)}/></label>
    </div>
    <div className="tax-economics-results" aria-live="polite">
      <div><span>{locale === "en" ? "Annualized net benefit" : "Чистый годовой эффект"}</span><b className={result.netAnnualBenefit < 0 ? "negative" : ""}>{money(result.netAnnualBenefit)}</b><small>{locale === "en" ? `After ${money(result.annualizedImplementationCost)} annualized implementation and ${money(model.annualMaintenanceCost)} recurring cost` : `После ${money(result.annualizedImplementationCost)} годовой доли внедрения и ${money(model.annualMaintenanceCost)} регулярных расходов`}</small></div>
      <div><span>{locale === "en" ? "Simple payback" : "Простая окупаемость"}</span><b>{payback}</b><small>{locale === "en" ? "Upfront implementation ÷ recurring annual benefit" : "Внедрение ÷ регулярный годовой эффект"}</small></div>
      <div><span>{locale === "en" ? "Lifecycle ROI" : "ROI за жизненный цикл"}</span><b className={(result.lifecycleRoiPercent ?? 0) < 0 ? "negative" : ""}>{result.lifecycleRoiPercent === null ? "—" : `${result.lifecycleRoiPercent.toFixed(1)}%`}</b><small>{locale === "en" ? `${model.analysisHorizonMonths}-month net ${money(result.horizonNetBenefit)}` : `Чистый эффект за ${model.analysisHorizonMonths} мес.: ${money(result.horizonNetBenefit)}`}</small></div>
      <div><span>NPV</span><b className={result.npv < 0 ? "negative" : ""}>{money(result.npv)}</b><small>{locale === "en" ? "Monthly discounted cash-tax estimate" : "Помесячная дисконтированная оценка"}</small></div>
    </div>
    <label className="tax-assumptions"><span>{locale === "en" ? "Assumptions, exclusions and source notes" : "Допущения, исключения и источники"}</span><textarea maxLength={4000} value={assumptionsInput} onChange={(event)=>setAssumptionsInput(event.target.value)} onBlur={() => { if (assumptionsInput !== model.assumptions) onChange({assumptions:assumptionsInput},locale === "en" ? "assumptions" : "допущения"); }}/></label>
    <aside><span className="deal-alert" aria-hidden="true">!</span><p>{locale === "en" ? "Estimate only—not tax or legal advice. Profitability does not establish legality. Publication still requires jurisdiction-specific sources, commercial purpose and review of anti-abuse, substance, disclosure and reporting rules. Node budgets are not added automatically: include them in implementation or annual costs only when appropriate, without double counting." : "Только оценка, а не налоговая или юридическая консультация. Прибыльность не подтверждает законность. Для публикации по-прежнему нужны источники по юрисдикциям, деловая цель и проверка anti-abuse, substance, раскрытия и отчётности. Бюджеты нодов автоматически не суммируются: включайте их в расходы на внедрение или ежегодные расходы только при необходимости и без двойного счёта."}</p></aside>
  </section>;
}
