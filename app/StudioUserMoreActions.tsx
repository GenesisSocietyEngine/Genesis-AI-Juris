"use client";

import CaseMarkdownActions from "./CaseMarkdownActions";

type Locale = "en" | "ru";

export default function StudioUserMoreActions({grouped,locale,canDuplicate,exportReady,feedbackLabel,importLabel,exportLabel,startExample,startTax,requestFeedback,importJson,exportJson,saveDevice,markdownLoaded,markdownOpened,markdownFailed}:{grouped:boolean;locale:Locale;canDuplicate:boolean;exportReady:boolean;feedbackLabel:string;importLabel:string;exportLabel:string;startExample:()=>void;startTax:()=>void;requestFeedback:()=>void;importJson:()=>void;exportJson:()=>void;saveDevice:()=>void;markdownLoaded:(value:string)=>void;markdownOpened:()=>void;markdownFailed:(message:string)=>void}) {
  if (!grouped) return <>
    <button className="secondary-cta" onClick={startExample}>{locale === "en" ? "Browse demo cases" : "Каталог демо-кейсов"}</button><button className="secondary-cta" onClick={startTax}>{locale === "en" ? "Tax template" : "Налоговый шаблон"}</button><button className="secondary-cta" onClick={requestFeedback}>{feedbackLabel}</button><button className="secondary-cta" onClick={importJson} disabled={!canDuplicate}>{importLabel}</button><button className="secondary-cta" onClick={exportJson} disabled={!canDuplicate}>{exportLabel}</button><CaseMarkdownActions locale={locale} loadDisabled={!canDuplicate} exportDisabled={!canDuplicate || !exportReady} loaded={markdownLoaded} opened={markdownOpened} failed={markdownFailed}/><button className="secondary-cta" onClick={saveDevice} disabled={!canDuplicate}>{locale === "en" ? "Save on this device" : "Сохранить на устройстве"}</button>
  </>;
  return <div className="studio-more-menu">
    <section><span>{locale === "en" ? "Start or review" : "Старт и рецензия"}</span><button className="secondary-cta" onClick={startExample}>{locale === "en" ? "Browse demo cases" : "Каталог демо-кейсов"}</button><button className="secondary-cta" onClick={requestFeedback}>{feedbackLabel}</button></section>
    <section><span>{locale === "en" ? "Case prompt" : "Промпт кейса"}</span><CaseMarkdownActions locale={locale} loadDisabled={!canDuplicate} exportDisabled={!canDuplicate || !exportReady} loaded={markdownLoaded} opened={markdownOpened} failed={markdownFailed}/><small>{locale === "en" ? "A complete case prompt restores the same case and decision map." : "Полный промпт восстанавливает тот же кейс и карту решений."}</small></section>
    <section><span>{locale === "en" ? "JSON and device" : "JSON и устройство"}</span><button className="secondary-cta" onClick={importJson} disabled={!canDuplicate}>{importLabel}</button><button className="secondary-cta" onClick={exportJson} disabled={!canDuplicate}>{exportLabel}</button><button className="secondary-cta" onClick={saveDevice} disabled={!canDuplicate}>{locale === "en" ? "Save on this device" : "Сохранить на устройстве"}</button></section>
  </div>;
}
