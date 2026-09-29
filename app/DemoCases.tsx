"use client";

import { useState } from "react";
import { CANOPY_QUESTION, CANOPY_SCENARIOS, CANOPY_SOURCES, type CanopyScenarioId } from "./canopy-fixture";
import { WorkspaceIcon } from "./GenesisNavigation";

type Locale = "en" | "ru";
const canopyExamples: Array<{ id: CanopyScenarioId; en: string; ru: string; detail: Record<Locale, string> }> = [
  { id: "base", en: "Base", ru: "Базовый", detail: { en: "Review a conditional 90-day pilot with outstanding evidence.", ru: "Проверьте условия 90-дневного пилота и недостающие подтверждения." } },
  { id: "upside", en: "Upside", ru: "Благоприятный", detail: { en: "See how stronger demand and accepted evidence change the decision.", ru: "Посмотрите, как подтверждённый спрос и новые доказательства меняют решение." } },
  { id: "hard_stop", en: "Hard stop", ru: "Стоп-условие", detail: { en: "Check why failed mandatory clearance blocks an attractive proposal.", ru: "Проверьте, почему обязательное условие блокирует выгодное предложение." } },
  { id: "downside", en: "Downside", ru: "Неблагоприятный", detail: { en: "Test weaker demand, lower yield and higher energy costs.", ru: "Проверьте снижение спроса и выхода продукции при росте энергозатрат." } },
];

export default function DemoCases({ locale, openCanopy, canopyWorkflowHref, busy = false }: {
  locale: Locale;
  busy?: boolean;
  openCanopy: (id: CanopyScenarioId) => Promise<void>;
  canopyWorkflowHref: string;
}) {
  const [selected, setSelected] = useState<CanopyScenarioId>("base");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function open(id: string, action: () => Promise<void>) {
    if (pending || busy) return;
    setPending(id);
    setError("");
    try { await action(); }
    catch {
      setError(locale === "en"
        ? "The demo could not be opened. Your current case is still available; please try again."
        : "Не удалось открыть демо. Текущий кейс доступен; попробуйте ещё раз.");
    } finally { setPending(null); }
  }
  const declaration = CANOPY_SCENARIOS.find(item => item.id === selected)!;
  const sourceVersions = new Map<string, number>([["D03", declaration.d03], ["D06", declaration.d06], ["D08", declaration.d08], ["D07", 2]]);
  const sources = CANOPY_SOURCES.filter(source => source.version === (sourceVersions.get(source.id) ?? 1));
  return <section className="demo-walkthrough">
    {error && <p className="demo-error" role="alert">{error}</p>}
    <section className="demo-canopy-feature" aria-labelledby="canopy-demo-title">
      <div className="demo-canopy-introduction">
        <span className="workspace-eyebrow">{locale === "en" ? "Canonical demo · Business decision" : "Канонический демо-кейс · Бизнес-решение"}</span>
        <h2 id="canopy-demo-title">Project Canopy</h2>
        <p className="demo-canopy-question">{locale === "en" ? CANOPY_QUESTION : "Стоит ли Verdant Atelier принять предложение по расширению управляемого объекта, одобрить условный 90-дневный пилот, пересмотреть условия или отказаться?"}</p>
        <p className="demo-synthetic-note">{locale === "en" ? "Fictional training case. Sources, assumptions and decision conditions are identified separately." : "Учебный вымышленный кейс. Источники, допущения и условия решения обозначены отдельно."}</p>
        <ol className="demo-start-steps">
          <li><b>1</b><span>{locale === "en" ? "Read the scenario and source dossier" : "Изучите сценарий и материалы"}<small>{locale === "en" ? "Nine source documents explain the mandate and outstanding conditions." : "Девять документов описывают задачу и невыполненные условия."}</small></span></li>
          <li><b>2</b><span>{locale === "en" ? "Follow the decision map" : "Пройдите карту решений"}<small>{locale === "en" ? "Trace each option to its evidence and test the route." : "Проверьте доказательства для каждого варианта и протестируйте маршрут."}</small></span></li>
          <li><b>3</b><span>{locale === "en" ? "Preview your decision package" : "Просмотрите пакет решений"}<small>{locale === "en" ? "Create an analytical draft with rationale, conditions and an A4 map." : "Сформируйте аналитический черновик с обоснованием, условиями и картой A4."}</small></span></li>
        </ol>
      </div>
      <div className="demo-scenario-picker">
        <h3>{locale === "en" ? "Choose a scenario" : "Выберите сценарий"}</h3>
        <p>{locale === "en" ? "Start with Base, then compare what changes." : "Начните с базового варианта, затем сравните изменения."}</p>
        <fieldset><legend className="visually-hidden">{locale === "en" ? "Canopy scenario" : "Сценарий Canopy"}</legend>{canopyExamples.map(example => <label key={example.id} className={selected === example.id ? "selected" : ""}><input type="radio" name="canopy-scenario" value={example.id} checked={selected === example.id} onChange={() => setSelected(example.id)}/><span><b>{example[locale]}</b><small>{example.detail[locale]}</small></span></label>)}</fieldset>
        <button type="button" className="primary-cta" disabled={pending !== null || busy} onClick={() => void open(selected, () => openCanopy(selected))}>{pending === selected ? (locale === "en" ? "Opening…" : "Открывается…") : (locale === "en" ? "Open Canopy in Studio" : "Открыть Canopy в Студии")}<WorkspaceIcon name="arrow"/></button>
        <small>{locale === "en" ? "Opens a separate working copy. The reference case is preserved." : "Открывается отдельный рабочий черновик. Эталонный кейс сохраняется."}</small>
      </div>
    </section>
    <details className="demo-source-dossier">
      <summary>{locale === "en" ? "Source dossier & expected output" : "Материалы и ожидаемый результат"}<span>{sources.length} {locale === "en" ? "documents" : "документов"}</span></summary>
      <div className="demo-expected-output"><h3>{locale === "en" ? "Expected reasoning" : "Ожидаемое обоснование"} · {declaration.label}</h3><p>{declaration.recommendation}</p><p>{declaration.why}</p><details><summary>{locale === "en" ? "What changed in this scenario?" : "Что изменилось в сценарии?"}</summary><p>{declaration.changed}</p></details></div>
      <div className="demo-source-list">{sources.map(source => <details key={source.id}><summary><WorkspaceIcon name="studio"/><span>{source.title}</span><small>{source.id} · v{source.version}</small></summary>{Object.entries(source.sections).map(([section,content]) => <section key={section}><h4>{section}</h4><p>{content}</p></section>)}</details>)}</div>
      <p className="demo-saved-walkthrough">{locale === "en" ? "For a saved case with source acceptance, review tasks and approved outputs:" : "Для сохранённого кейса с проверкой источников, задачами и утверждёнными результатами:"} <a href={canopyWorkflowHref}>{locale === "en" ? "Open the full Canopy walkthrough" : "Открыть полный процесс Canopy"}</a><small>{locale === "en" ? "Sign-in, organization access and reviewer permissions are required for the governed workflow." : "Для управляемого процесса необходимы вход, доступ к организации и права рецензента."}</small></p>
    </details>
  </section>;
}
