"use client";

import { useState } from "react";
import type { CanopyScenarioId } from "./canopy-fixture";

type Locale = "en" | "ru";
type DemoRecord = { id: string; title: string; summary: string; jurisdiction: string };
const canopyExamples: Array<{ id: CanopyScenarioId; en: string; ru: string; detail: Record<Locale, string> }> = [
  { id: "base", en: "Base", ru: "Базовый", detail: { en: "Review a conditional 90-day pilot with outstanding evidence.", ru: "Проверьте условия 90-дневного пилота и недостающие подтверждения." } },
  { id: "upside", en: "Upside", ru: "Благоприятный", detail: { en: "See how stronger demand and accepted evidence change the decision.", ru: "Посмотрите, как подтверждённый спрос и новые доказательства меняют решение." } },
  { id: "hard_stop", en: "Hard stop", ru: "Стоп-условие", detail: { en: "Check why failed mandatory clearance blocks an attractive proposal.", ru: "Проверьте, почему обязательное условие блокирует выгодное предложение." } },
  { id: "downside", en: "Downside", ru: "Неблагоприятный", detail: { en: "Test weaker demand, lower yield and higher energy costs.", ru: "Проверьте снижение спроса и выхода продукции при росте энергозатрат." } },
];

export default function DemoCases({ locale, records, openCanopy, playCase, openStudio }: {
  locale: Locale;
  records: DemoRecord[];
  openCanopy: (id: CanopyScenarioId) => Promise<void>;
  playCase: (id: string) => Promise<void>;
  openStudio: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function open(id: string, action: () => Promise<void>) {
    if (pending) return;
    setPending(id);
    setError("");
    try { await action(); }
    catch {
      setError(locale === "en"
        ? "The demo could not be opened. Your current case is still available; please try again."
        : "Не удалось открыть демо. Текущий кейс доступен; попробуйте ещё раз.");
    } finally { setPending(null); }
  }
  return <main className="demo-library page-width">
    <header className="demo-library-header">
      <div><h1>{locale === "en" ? "Demo cases" : "Демо-кейсы"}</h1>
        <p>{locale === "en" ? "Explore an example, then use the same steps for your own case." : "Изучите пример, затем пройдите те же шаги со своим кейсом."}</p>
      </div>
      <button type="button" className="secondary-cta" onClick={openStudio}>{locale === "en" ? "Back to Studio" : "Вернуться в Studio"}</button>
    </header>
    <ol className="demo-getting-started">
      <li>{locale === "en" ? "Choose an example below." : "Выберите пример ниже."}</li>
      <li>{locale === "en" ? "Review its facts, evidence and decision map." : "Проверьте факты, доказательства и карту решений."}</li>
      <li>{locale === "en" ? "Test the scenario, then open Finish to save or create a report." : "Пройдите сценарий, затем откройте «Готово» для сохранения или отчёта."}</li>
    </ol>
    {error && <p className="demo-error" role="alert">{error}</p>}
    <section className="demo-category" aria-labelledby="canopy-demo-title">
      <header><h2 id="canopy-demo-title">Canopy</h2><p>{locale === "en"
        ? "A fictional managed-site expansion decision. Each option opens a fresh working copy in Studio."
        : "Учебное решение о расширении управляемого объекта. Каждый вариант открывает отдельный рабочий черновик в Studio."}</p></header>
      <div className="demo-case-grid">
        {canopyExamples.map((example) => <article key={example.id}>
          <h3>{example[locale]}</h3><p>{example.detail[locale]}</p>
          <button type="button" className="primary-cta" disabled={pending !== null} onClick={() => void open(example.id, () => openCanopy(example.id))}>
            {pending === example.id ? (locale === "en" ? "Opening…" : "Открывается…") : (locale === "en" ? "Open in Studio" : "Открыть в Studio")}
            <span className="visually-hidden"> — Canopy {example[locale]}</span>
          </button>
        </article>)}
      </div>
    </section>
    <section className="demo-category" aria-labelledby="playable-demo-title">
      <header><h2 id="playable-demo-title">{locale === "en" ? "Playable cases" : "Игровые кейсы"}</h2><p>{locale === "en"
        ? "Read the record and make decisions through the existing guided simulations."
        : "Изучайте материалы и принимайте решения в готовых пошаговых симуляциях."}</p></header>
      <div className="demo-case-grid">
        {records.map((record) => <article key={record.id}>
          <small>{record.jurisdiction}</small><h3>{record.title}</h3><p>{record.summary}</p>
          <button type="button" className="secondary-cta" disabled={pending !== null} onClick={() => void open(record.id, () => playCase(record.id))}>
            {pending === record.id ? (locale === "en" ? "Opening…" : "Открывается…") : (locale === "en" ? "Play case" : "Пройти кейс")}
            <span className="visually-hidden"> — {record.title}</span>
          </button>
        </article>)}
      </div>
    </section>
  </main>;
}
