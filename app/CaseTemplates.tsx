"use client";

import { useState } from "react";
import { CASE_TYPE_REGISTRY, applyCaseType } from "./case-type-registry";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypePresentation } from "./case-type-presentation";
import { caseTypeReference } from "./case-type-reference";
import type { CaseTypeId, StudioDraft } from "./types";

export function prepareCaseTemplate(blank: StudioDraft, id: CaseTypeId, locale: "en" | "ru") {
  const draft = applyCaseType(blank, id);
  const playbook = caseTypePlaybook(draft.caseType);
  const prompt = `${playbook.label[locale]}\n\n${playbook.intakeQuestions.map(q => `${q.label[locale]}\n${locale === "en" ? "Your answer" : "Ваш ответ"}: \n`).join("\n")}`;
  return { draft, prompt };
}

export default function CaseTemplates({ locale, onStart, onDemo, onExample }: {
  locale: "en" | "ru"; onStart: (id: CaseTypeId) => void; onDemo: () => void;
  onExample?: (id: CaseTypeId) => void;
}) {
  const en = locale === "en";
  const [query, setQuery] = useState("");
  const templates = CASE_TYPE_REGISTRY.map((definition, index) => {
    const book = caseTypePlaybook(caseTypeReference(definition.id));
    return { definition, number: index + 1, book, presentation: caseTypePresentation(book, locale) };
  }).filter(({ book, presentation }) => [presentation.label, presentation.summary, book.primaryOutcome[locale]].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="learning-page templates-page page-width">
    <header className="learning-heading"><span>{en ? "START YOUR OWN CASE" : "НАЧНИТЕ СВОЙ КЕЙС"}</span><h1>{en ? "Templates" : "Шаблоны"}</h1><p>{en ? "Choose a structure. Add your own facts, evidence and questions." : "Выберите структуру. Добавьте свои факты, доказательства и вопросы."}</p></header>
    {onExample && <aside className="template-announcement learning-note" aria-labelledby="template-news-title"><h2 id="template-news-title">{en ? `New: ${CASE_TYPE_REGISTRY.length} worked examples` : `Новое: ${CASE_TYPE_REGISTRY.length} учебных примеров`}</h2><p>{en ? "Start with an empty template or open its fictional example as an editable copy." : "Выберите пустой шаблон или откройте его учебный пример как рабочую копию."}</p></aside>}
    <p className="template-start-note">{en ? "Save before switching. Replacing your current work requires confirmation." : "Сохраните работу перед переключением. Замена текущего черновика требует подтверждения."}</p>
    <div className="template-toolbar"><label htmlFor="template-search">{en ? "Find a template" : "Найти шаблон"}<input id="template-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? "Search by task or output…" : "Поиск по задаче или результату…"}/></label><p role="status" aria-live="polite" aria-atomic="true">{templates.length} / {CASE_TYPE_REGISTRY.length} {en ? "templates" : "шаблонов"}</p></div>
    <ol className="template-grid" aria-label={en ? "Case templates" : "Шаблоны кейсов"}>{templates.map(({ definition, number, book, presentation }) => <li className="template-card" key={definition.id} value={number}><article aria-labelledby={`template-${definition.id}`}>
      <header className="template-card-heading"><span className="template-number" aria-hidden="true">{String(number).padStart(2, "0")}</span><h2 id={`template-${definition.id}`}>{presentation.label}</h2></header><p>{presentation.summary}</p><dl><dt>{en ? "Work towards" : "Результат"}</dt><dd>{book.primaryOutcome[locale]}</dd></dl><details><summary>{en ? "What you will need" : "Что потребуется"}<span className="visually-hidden"> — {presentation.label}</span></summary><ul>{book.intakeQuestions.map(q => <li key={q.id}><b>{q.label[locale]}</b><p>{q.hint[locale]}</p></li>)}</ul></details>
      <div className="template-actions"><button className="primary-cta" type="button" onClick={() => onStart(definition.id)}>{en ? "Use this template" : "Использовать шаблон"}<span className="visually-hidden"> — {presentation.label}</span></button>{onExample && <button className="secondary-cta" type="button" onClick={() => onExample(definition.id)}>{en ? "Open worked example" : "Открыть учебный пример"}<span className="visually-hidden"> — {presentation.label}</span></button>}</div>
    </article></li>)}</ol>
    {templates.length === 0 && <div className="learning-note"><p>{en ? "No templates match your search. Try a task such as contract, tax or investigation." : "По вашему запросу шаблоны не найдены. Попробуйте: договор, налог или расследование."}</p><button type="button" className="secondary-cta" onClick={() => setQuery("")}>{en ? "Clear search" : "Очистить поиск"}</button></div>}
    <div className="learning-note"><b>{en ? "Want a worked example first?" : "Нужен готовый пример?"}</b><p>{en ? "Demo contains completed fictional cases to explore. Templates give you a starting structure for your own work." : "Демо содержит готовые учебные кейсы. Шаблоны дают структуру для вашей работы."}</p><button type="button" className="secondary-cta" onClick={onDemo}>{en ? "Explore demos" : "Изучить демо"}</button></div>
  </main>;
}
