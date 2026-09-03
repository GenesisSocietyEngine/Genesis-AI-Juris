"use client";

import { useState } from "react";
import { caseTypeDefinition, type CaseViewId } from "./case-type-registry";
import { projectCaseView, type CaseViewItem } from "./case-view-projections";
import type { StudioDraft } from "./types";

type Locale = "en" | "ru";

const viewCopy: Record<CaseViewId, {
  label: Record<Locale, string>;
  description: Record<Locale, string>;
  empty: Record<Locale, string>;
}> = {
  issue_map: {
    label: { en: "Issues", ru: "Вопросы" },
    description: { en: "Issues with their supporting record and possible outcomes.", ru: "Вопросы, подтверждающие материалы и возможные исходы." },
    empty: { en: "Add a Decision node to create the first issue.", ru: "Добавьте узел «Решение», чтобы создать первый вопрос." },
  },
  evidence_map: {
    label: { en: "Evidence", ru: "Доказательства" },
    description: { en: "Facts, evidence and authorities, including unlinked items that need attention.", ru: "Факты, доказательства и источники, включая несвязанные элементы." },
    empty: { en: "Add a Fact, Evidence or Tax rule node to build the record.", ru: "Добавьте факт, доказательство или налоговое правило." },
  },
  decision_table: {
    label: { en: "Decisions", ru: "Решения" },
    description: { en: "A reviewable table of options, constraints, consequences, time and cost.", ru: "Проверяемая таблица вариантов, условий, последствий, времени и стоимости." },
    empty: { en: "Connect a Decision node to at least one destination.", ru: "Свяжите узел «Решение» хотя бы с одним назначением." },
  },
  task_plan: {
    label: { en: "Process", ru: "Процесс" },
    description: { en: "A working sequence of actions, deadlines, duration and budget.", ru: "Рабочая последовательность действий, сроков, длительности и бюджета." },
    empty: { en: "Add a trigger, deadline or decision to build the process.", ru: "Добавьте триггер, срок или решение, чтобы построить процесс." },
  },
  timeline: {
    label: { en: "Timeline", ru: "Хронология" },
    description: { en: "Every case object in temporal order; unscheduled items stay visible.", ru: "Все объекты кейса по времени; незапланированные элементы остаются видимыми." },
    empty: { en: "The timeline will appear after the first case object is added.", ru: "Хронология появится после добавления первого объекта кейса." },
  },
  economics: {
    label: { en: "Economics", ru: "Экономика" },
    description: { en: "Tax-position value, payback and connected cash-flow assumptions.", ru: "Ценность налоговой позиции, окупаемость и связанные допущения cash flow." },
    empty: { en: "Add tax economics or a Cash flow node to compare value.", ru: "Добавьте налоговую экономику или узел Cash flow для сравнения ценности." },
  },
  simulation: {
    label: { en: "Simulation", ru: "Симуляция" },
    description: { en: "Playable decisions and terminal outcomes; execution remains Rust-validated.", ru: "Игровые решения и финальные исходы; исполнение проверяется Rust." },
    empty: { en: "Add a Decision and an Outcome to form a playable route.", ru: "Добавьте решение и исход, чтобы создать игровой маршрут." },
  },
};

function focusButton(locale: Locale, item: CaseViewItem, onFocusNode: (id: string) => void) {
  const nodeId = item.relatedNodeIds[0] ?? item.id;
  return <button type="button" className="case-view-focus" onClick={() => onFocusNode(nodeId)}>
    {locale === "en" ? "Open in graph" : "Открыть на схеме"}<span aria-hidden="true">→</span>
  </button>;
}

function ProjectionRows({ id, items, locale, onFocusNode }: { id: CaseViewId; items: CaseViewItem[]; locale: Locale; onFocusNode: (id: string) => void }) {
  if (!items.length) return <div className="case-view-empty"><span>00</span><p>{viewCopy[id].empty[locale]}</p></div>;

  if (id === "decision_table") return <div className="case-view-table-wrap"><table className="case-view-table">
    <thead><tr><th>{locale === "en" ? "Decision / option" : "Решение / вариант"}</th><th>{locale === "en" ? "Availability" : "Доступность"}</th><th>{locale === "en" ? "Time & cost" : "Время и стоимость"}</th><th>{locale === "en" ? "Consequence" : "Последствие"}</th><th><span className="visually-hidden">{locale === "en" ? "Open" : "Открыть"}</span></th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id} className={`status-${item.status}`}><td><small>{item.kind}</small><b>{item.title}</b></td><td>{item.primaryMeta}</td><td>{item.secondaryMeta || "—"}</td><td>{item.detail || "—"}</td><td>{focusButton(locale, item, onFocusNode)}</td></tr>)}</tbody>
  </table></div>;

  if (id === "timeline") return <ol className="case-view-timeline">{items.map((item, index) => <li key={item.id} className={`status-${item.status}`}>
    <div><span>{String(index + 1).padStart(2, "0")}</span><i/></div>
    <article><small>{item.primaryMeta} · {item.kind}</small><h3>{item.title}</h3><p>{item.detail}</p><footer>{item.secondaryMeta && <b>{item.secondaryMeta}</b>}{focusButton(locale, item, onFocusNode)}</footer></article>
  </li>)}</ol>;

  return <div className={`case-view-cards case-view-cards-${id}`}>{items.map((item, index) => <article key={item.id} className={`status-${item.status}`}>
    <header><span>{String(index + 1).padStart(2, "0")}</span><small>{item.kind}</small><i aria-label={item.status === "attention" ? (locale === "en" ? "Needs attention" : "Требует внимания") : undefined}/></header>
    <h3>{item.title}</h3><p>{item.detail || (locale === "en" ? "Add a concise explanation." : "Добавьте краткое объяснение.")}</p>
    <dl><div><dt>{locale === "en" ? "Primary" : "Основное"}</dt><dd>{item.primaryMeta || "—"}</dd></div><div><dt>{locale === "en" ? "Context" : "Контекст"}</dt><dd>{item.secondaryMeta || "—"}</dd></div></dl>
    {focusButton(locale, item, onFocusNode)}
  </article>)}</div>;
}

export default function StudioCaseViews({ locale, draft, onFocusNode }: { locale: Locale; draft: StudioDraft; onFocusNode: (id: string) => void }) {
  const definition = caseTypeDefinition(draft.caseType);
  const [activeView, setActiveView] = useState<CaseViewId>(definition.views[0]);
  const resolvedActiveView = definition.views.includes(activeView) ? activeView : definition.views[0];
  const projection = projectCaseView(draft, resolvedActiveView);
  return <section className="case-view-studio page-width" aria-labelledby="case-view-studio-title">
    <header>
      <div><span>{locale === "en" ? "V58 · MULTI-VIEW CASE STUDIO" : "V58 · МНОГОПРОФИЛЬНАЯ СТУДИЯ"}</span><h2 id="case-view-studio-title">{locale === "en" ? "See the same matter from the angle you need" : "Посмотрите на один кейс с нужной точки зрения"}</h2><p>{locale === "en" ? "Every view is projected from the same versioned draft. Switching views never creates or changes case content." : "Каждое представление строится из одного версионируемого черновика. Переключение не создаёт и не меняет содержание кейса."}</p></div>
      <code>{definition.id} · v{definition.version}</code>
    </header>
    <div className="case-view-tabs" role="tablist" aria-label={locale === "en" ? "Case views" : "Представления кейса"}>
      {definition.views.map((viewId) => <button key={viewId} type="button" role="tab" id={`case-view-tab-${viewId}`} aria-selected={resolvedActiveView === viewId} aria-controls={`case-view-panel-${viewId}`} tabIndex={resolvedActiveView === viewId ? 0 : -1} className={resolvedActiveView === viewId ? "active" : ""} onClick={() => setActiveView(viewId)}><span>{viewCopy[viewId].label[locale]}</span><small>{projectCaseView(draft, viewId).items.length.toString().padStart(2, "0")}</small></button>)}
    </div>
    <div className="case-view-panel" id={`case-view-panel-${resolvedActiveView}`} role="tabpanel" aria-labelledby={`case-view-tab-${resolvedActiveView}`}>
      <div className="case-view-panel-heading"><div><span>{viewCopy[resolvedActiveView].label[locale]}</span><p>{viewCopy[resolvedActiveView].description[locale]}</p></div><b>{projection.sourceNodeCount} N · {projection.sourceLinkCount} L</b></div>
      <ProjectionRows id={resolvedActiveView} items={projection.items} locale={locale} onFocusNode={onFocusNode}/>
    </div>
  </section>;
}
