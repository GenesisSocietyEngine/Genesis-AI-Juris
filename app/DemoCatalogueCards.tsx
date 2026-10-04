"use client";

import { lazy, Suspense, useState } from "react";
import type { CanopyScenarioId } from "./canopy-fixture";
import { CANOPY_LEARNING_PROMPT, demoLearningPrompt } from "./demo-learning-prompts";

const CanopyWalkthrough = lazy(() => import("./DemoCases"));
export type DemoCard = {
  id: string; title: string; summary: string; jurisdiction: string; practice: string;
  duration: number; version: string; review: string; author: string; legalAsOf?: string;
};
export type DemoFormat = "all" | "walkthrough" | "simulation" | "worked";
export function matchesCanopy(filters: { query: string; practice: string; jurisdiction: string; difficulty: string; duration: string; tag: string; format: DemoFormat }) {
  const words = "Project Canopy Проект Канопи guided walkthrough пошаговый обзор evidence доказательства business decision бизнес решение Fictional Gulf market";
  return (filters.format === "all" || filters.format === "walkthrough") && (!filters.query.trim() || words.toLowerCase().includes(filters.query.trim().toLowerCase()))
    && (filters.practice === "all" || filters.practice === "Business decision")
    && (filters.jurisdiction === "all" || filters.jurisdiction === "Fictional Gulf market")
    && filters.difficulty === "all" && filters.duration === "all" && filters.tag === "all";
}

export default function DemoCatalogueCards({ locale, cards, showCanopy, busy, launch, feedback, openCanopy, canopyWorkflowHref }: {
  locale: "en" | "ru"; cards: DemoCard[]; showCanopy: boolean; busy: boolean;
  launch: (id: string) => void; feedback: (id: string) => void;
  openCanopy: (id: CanopyScenarioId) => Promise<void>; canopyWorkflowHref: string;
}) {
  const en = locale === "en";
  const [canopyExpanded, setCanopyExpanded] = useState(false);
  return <div className="demo-catalogue-grid">
    {showCanopy && <article className="demo-catalogue-card demo-catalogue-canopy">
      <span className="demo-format">{en ? "Guided walkthrough" : "Пошаговый обзор"}</span>
      <h2>Project Canopy</h2>
      <p>{en ? "Follow a business decision from source documents to a decision map and report. Compare four scenarios in a working copy." : "Пройдите путь от исходных документов до карты решений и отчёта. Сравните четыре сценария в рабочей копии."}</p>
      <p><b>{en ? "Illustrative prompt" : "Учебный промпт"}:</b> {CANOPY_LEARNING_PROMPT[locale]}</p>
      <p className="demo-card-meta">{en ? "Fictional Gulf market · Business decision" : "Вымышленный рынок стран Залива · Бизнес-решение"}</p>
      <details onToggle={event => setCanopyExpanded(event.currentTarget.open)}>
        <summary className="secondary-cta">{en ? "View walkthrough" : "Посмотреть обзор"}</summary>
        {canopyExpanded && <Suspense fallback={<p role="status">{en ? "Loading walkthrough…" : "Загрузка обзора…"}</p>}><CanopyWalkthrough busy={busy} locale={locale} openCanopy={openCanopy} canopyWorkflowHref={canopyWorkflowHref}/></Suspense>}
      </details>
    </article>}
    {cards.map(card => <article className="demo-catalogue-card" key={card.id}>
      <span className="demo-format">{en ? "Decision simulation" : "Симуляция решений"}</span>
      <h2>{card.title}</h2><p>{card.summary}</p>
      <p><b>{en ? "Illustrative prompt" : "Учебный промпт"}:</b> {demoLearningPrompt(card.id, locale)}</p>
      <p className="demo-card-meta">{card.jurisdiction} · {card.practice} · {card.duration} {en ? "min" : "мин"}</p>
      <details className="demo-editorial"><summary>{en ? "Editorial details" : "Редакционные сведения"}</summary><p>{card.review} · v{card.version}</p><p>{en ? "Author" : "Автор"}: {card.author}</p><p>{card.legalAsOf ? `${en ? "Law as of" : "Право на"} ${card.legalAsOf}` : (en ? "Legal review pending" : "Проверка актуальности ожидается")}</p></details>
      <div className="demo-card-actions"><button type="button" className="primary-cta" disabled={busy} onClick={() => launch(card.id)} aria-label={`${en ? "Start simulation" : "Начать симуляцию"}: ${card.title}`}>{en ? "Start simulation" : "Начать симуляцию"}</button><button type="button" className="secondary-cta" onClick={() => feedback(card.id)}>{en ? "Give feedback" : "Оставить отзыв"}</button></div>
    </article>)}
  </div>;
}
