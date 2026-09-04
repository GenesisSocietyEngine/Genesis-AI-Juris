"use client";

import { DEFAULT_DEAL_SCENARIO_PROBABILITIES } from "./deal-economics";
import type { DealEconomicsV1 } from "./types";

type Locale = "en" | "ru";
type ScenarioKey = keyof DealEconomicsV1["scenarioProbabilities"];

function optionalInteger(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1_000_000_000_000, Math.round(parsed))) : null;
}

const currencies = ["GBP", "EUR", "USD", "CHF", "CNY", "HKD", "SGD", "AED", "CAD", "AUD", "JPY"];

export default function CashFlowScenarioEditor({ locale, model, beginFieldEdit, commitField, setModel, changeRepaymentBasis }: {
  locale: Locale;
  model: DealEconomicsV1;
  beginFieldEdit: (value: string) => void;
  commitField: (label: string, value: string) => void;
  setModel: (change: Partial<DealEconomicsV1>) => void;
  changeRepaymentBasis: (basis: DealEconomicsV1["repaymentBasis"]) => void;
}) {
  const probabilities = model.scenarioProbabilities ?? DEFAULT_DEAL_SCENARIO_PROBABILITIES;
  const setProbability = (key: ScenarioKey, percentValue: string) => {
    const requested = Math.max(0, Math.min(10_000, Math.round((Number(percentValue) || 0) * 100)));
    if (key === "interestOnlyBps") {
      setModel({ scenarioProbabilities: { ...probabilities, interestOnlyBps: requested } });
      return;
    }
    let { favorableBps, baseBps, stressedBps } = probabilities;
    if (key === "favorableBps") {
      favorableBps = Math.min(requested, 10_000 - stressedBps);
      baseBps = 10_000 - favorableBps - stressedBps;
    } else if (key === "stressedBps") {
      stressedBps = Math.min(requested, 10_000 - favorableBps);
      baseBps = 10_000 - favorableBps - stressedBps;
    } else {
      baseBps = requested;
      const remainder = 10_000 - baseBps;
      const sideTotal = favorableBps + stressedBps;
      favorableBps = sideTotal ? Math.round(remainder * favorableBps / sideTotal) : Math.round(remainder / 2);
      stressedBps = remainder - favorableBps;
    }
    setModel({ scenarioProbabilities: { ...probabilities, favorableBps, baseBps, stressedBps } });
  };
  const field = (label: string, value: number | null, change: (value: string) => void, commitLabel: string, placeholder?: string) =>
    <label><span>{label}</span><input type="number" min="0" step="1" value={value ?? ""} placeholder={placeholder} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => change(event.target.value)} onBlur={(event) => commitField(commitLabel, event.currentTarget.value)}/></label>;
  const percentField = (label: string, value: number | null, change: (value: number | null) => void, commitLabel: string, maximum = 100) =>
    <label><span>{label}</span><input type="number" min="0" max={maximum} step="0.1" value={value === null ? "" : value / 100} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => change(event.target.value ? Math.round(Number(event.target.value) * 100) : null)} onBlur={(event) => commitField(commitLabel, event.currentTarget.value)}/></label>;
  const probabilityField = (key: ScenarioKey, label: string, commitLabel: string) =>
    <label><span>{label}</span><input type="number" min="0" max="100" step="0.1" value={(probabilities[key] / 100).toFixed(1)} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setProbability(key, event.target.value)} onBlur={(event) => commitField(commitLabel, event.currentTarget.value)}/></label>;

  return <fieldset className="cash-flow-scenario-fields"><legend>{locale === "en" ? "CASH-FLOW SCENARIO" : "CASH-FLOW СЦЕНАРИЙ"}</legend>
    <p>{locale === "en" ? "These reviewed inputs drive the live investment outcome and four probability ranges. Extra cash-flow nodes represent separate payment streams, not probability bands." : "Эти проверенные параметры формируют outcome и четыре вероятностных диапазона. Дополнительные cash-flow ноды означают отдельные потоки, а не диапазоны вероятности."}</p>
    <div className="cash-flow-core-inputs">
      <label><span>{locale === "en" ? "Currency" : "Валюта"}</span><select value={model.currency} onChange={(event) => setModel({ currency: event.target.value })}>{!currencies.includes(model.currency) && <option value={model.currency}>{model.currency}</option>}{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
      {field(locale === "en" ? "Purchase price" : "Стоимость покупки", model.purchasePrice, (value) => setModel({ purchasePrice: optionalInteger(value) }), locale === "en" ? "purchase price" : "стоимость покупки")}
      {percentField(locale === "en" ? "Loan-to-value · %" : "Кредит / стоимость · %", model.loanToValueBps, (value) => setModel({ loanToValueBps: value }), locale === "en" ? "loan-to-value" : "LTV")}
      {percentField(locale === "en" ? "Interest rate · % p.a." : "Процентная ставка · % годовых", model.annualInterestRateBps, (value) => setModel({ annualInterestRateBps: value }), locale === "en" ? "interest rate" : "процентная ставка")}
      <label><span>{locale === "en" ? "Loan term · years" : "Срок кредита · лет"}</span><input type="number" min="0.1" max="100" step="0.1" value={model.termMonths === null ? "" : Number((model.termMonths / 12).toFixed(2))} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setModel({ termMonths: event.target.value ? Math.max(1, Math.round(Number(event.target.value) * 12)) : null })} onBlur={(event) => commitField(locale === "en" ? "loan term" : "срок кредита", event.currentTarget.value)}/></label>
    </div>
    <label><span>{locale === "en" ? "Repayment basis" : "Вид погашения"}</span><select value={model.repaymentBasis} onChange={(event) => changeRepaymentBasis(event.target.value as DealEconomicsV1["repaymentBasis"])}><option value="unknown">{locale === "en" ? "Unknown · model both" : "Неизвестно · оба сценария"}</option><option value="amortizing">{locale === "en" ? "Amortizing" : "Амортизируемый"}</option><option value="interest_only">{locale === "en" ? "Interest-only" : "Только проценты"}</option></select></label>
    {model.repaymentBasis === "unknown" && probabilityField("interestOnlyBps", locale === "en" ? "Interest-only scenario probability · %" : "Вероятность interest-only · %", locale === "en" ? "interest-only probability" : "вероятность interest-only")}
    {field(locale === "en" ? "Gross annual rent" : "Валовая аренда за год", model.grossAnnualIncome, (value) => setModel({ grossAnnualIncome: optionalInteger(value) }), locale === "en" ? "gross annual rent" : "валовая аренда")}
    {field(locale === "en" ? "Known annual property costs" : "Известные годовые расходы объекта", model.annualOperatingCosts, (value) => setModel({ annualOperatingCosts: optionalInteger(value) }), locale === "en" ? "property costs" : "расходы объекта", locale === "en" ? "blank = probability stress" : "пусто = стресс-модель")}
    {field(locale === "en" ? "Annual fund administration" : "Годовое администрирование фонда", model.annualStructureCost, (value) => setModel({ annualStructureCost: optionalInteger(value) }), locale === "en" ? "annual administration" : "годовое администрирование")}
    {field(locale === "en" ? "One-off structure cost" : "Разовая стоимость структуры", model.oneOffStructureCost, (value) => setModel({ oneOffStructureCost: optionalInteger(value) }), locale === "en" ? "one-off structure cost" : "разовая стоимость структуры")}
    {field(locale === "en" ? "Other acquisition / initial costs" : "Прочие расходы на приобретение", model.otherInitialCosts, (value) => setModel({ otherInitialCosts: optionalInteger(value) }), locale === "en" ? "other initial costs" : "прочие первоначальные расходы", locale === "en" ? "tax, legal, valuation, financing" : "налоги, legal, valuation, financing")}
    <label><span>{locale === "en" ? "Target cash-on-cash return · %" : "Целевая доходность на капитал · %"}</span><input type="number" min="0" max="1000" step="0.1" value={model.targetAnnualReturnBps === null ? "" : model.targetAnnualReturnBps / 100} onFocus={(event) => beginFieldEdit(event.currentTarget.value)} onChange={(event) => setModel({ targetAnnualReturnBps: event.target.value ? Math.round(Number(event.target.value) * 100) : null })} onBlur={(event) => commitField(locale === "en" ? "target return" : "целевая доходность", event.currentTarget.value)}/></label>
    <div className="cash-flow-probability-editor"><b>{locale === "en" ? "Occupancy / cost scenario weights" : "Веса occupancy / cost сценариев"}</b><small>{locale === "en" ? "Changing favourable or low occupancy automatically rebalances the base case so the total remains 100%." : "Изменение favourable или low occupancy автоматически балансирует базовый сценарий, сохраняя сумму 100%."}</small>
      {probabilityField("favorableBps", locale === "en" ? "Favourable · 10% stress" : "Favourable · стресс 10%", locale === "en" ? "favourable occupancy probability" : "вероятность favourable occupancy")}
      {probabilityField("baseBps", locale === "en" ? "Base · 20% stress" : "Base · стресс 20%", locale === "en" ? "base occupancy probability" : "вероятность base occupancy")}
      {probabilityField("stressedBps", locale === "en" ? "Low occupancy · 30% stress" : "Low occupancy · стресс 30%", locale === "en" ? "low occupancy probability" : "вероятность low occupancy")}
    </div>
  </fieldset>;
}
