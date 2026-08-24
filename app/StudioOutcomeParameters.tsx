"use client";

import CashFlowScenarioEditor from "./CashFlowScenarioEditor";
import TaxEconomicsPanel from "./TaxEconomicsPanel";
import type { RentalTaxBaseBreakdown, TaxEconomicsResult } from "./tax-economics";
import type { DealEconomicsV1, TaxEconomicsV1 } from "./types";

type Locale = "en" | "ru";

export default function StudioOutcomeParameters({locale,dealModel,taxModel,taxResult,taxBaseBreakdown,disabled,beginFieldEdit,commitDealField,setDealModel,changeRepaymentBasis,applyTaxChange,changeTaxCurrency}:{locale:Locale;dealModel:DealEconomicsV1|null|undefined;taxModel:TaxEconomicsV1;taxResult:TaxEconomicsResult|null;taxBaseBreakdown?:RentalTaxBaseBreakdown|null;disabled:boolean;beginFieldEdit:(value:string)=>void;commitDealField:(label:string,value:string)=>void;setDealModel:(change:Partial<DealEconomicsV1>)=>void;changeRepaymentBasis:(basis:DealEconomicsV1["repaymentBasis"])=>void;applyTaxChange:(change:Partial<TaxEconomicsV1>,label:string)=>void;changeTaxCurrency:(currency:string)=>Promise<{ok:boolean;message:string}>}) {
  return <section className="outcome-parameters page-width" aria-labelledby="outcome-parameters-title">
    <header><div><span>{locale === "en" ? "LIVE MODEL INPUTS" : "ВХОДНЫЕ ПАРАМЕТРЫ МОДЕЛИ"}</span><h2 id="outcome-parameters-title">{locale === "en" ? "Outcome recalculation parameters" : "Параметры пересчёта outcome"}</h2></div><b>{locale === "en" ? "Changes recalculate below" : "Пересчёт ниже"}</b></header>
    <p>{locale === "en" ? "Review the financial, financing and tax assumptions here. Every accepted edit immediately updates the cash-flow ranges, return tests and tax economics shown below." : "Проверьте финансовые, кредитные и налоговые допущения. Каждая правка сразу обновляет cash-flow диапазоны, тесты доходности и налоговую экономику ниже."}</p>
    <div className="outcome-parameter-groups">
      {dealModel && <details open><summary><span>{locale === "en" ? "Financial & financing" : "Финансы и кредит"}</span><small>{dealModel.currency} · {dealModel.purchasePrice?.toLocaleString() ?? "—"} · {dealModel.loanToValueBps === null ? "LTV —" : `LTV ${(dealModel.loanToValueBps / 100).toFixed(1)}%`}</small></summary><CashFlowScenarioEditor locale={locale} model={dealModel} beginFieldEdit={beginFieldEdit} commitField={commitDealField} setModel={setDealModel} changeRepaymentBasis={changeRepaymentBasis}/></details>}
      {taxResult && <details open><summary><span>{locale === "en" ? "Tax economics" : "Налоговая экономика"}</span><small>{taxModel.currency} · {taxModel.taxInputBasis === "rates" ? (locale === "en" ? "tax base + rates" : "база + ставки") : (locale === "en" ? "annual tax amounts" : "годовые суммы")}</small></summary><TaxEconomicsPanel key={JSON.stringify(taxModel)} locale={locale} model={taxModel} result={taxResult} taxBaseBreakdown={taxBaseBreakdown} disabled={disabled} onChange={applyTaxChange} onCurrencyChange={changeTaxCurrency} embedded/></details>}
    </div>
  </section>;
}
