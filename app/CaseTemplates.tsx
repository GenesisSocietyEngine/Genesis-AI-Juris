"use client";

import { useState } from "react";
import ExampleLaunchStatus, { type ExampleLaunch } from "./ExampleLaunchStatus";
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

export default function CaseTemplates({ locale, onStart, onDemo, onExample, exampleLaunch, cancelExample }: {
  locale: "en" | "ru"; onStart: (id: CaseTypeId) => void; onDemo: () => void;
  onExample?: (id: CaseTypeId) => void;
  exampleLaunch?: ExampleLaunch | null; cancelExample?: () => void;
}) {
  const en = locale === "en";
  const [query, setQuery] = useState("");
  const templates = CASE_TYPE_REGISTRY.map((definition, index) => {
    const book = caseTypePlaybook(caseTypeReference(definition.id));
    return { definition, number: index + 1, book, presentation: caseTypePresentation(book, locale) };
  }).filter(({ book, presentation }) => [presentation.label, presentation.summary, book.primaryOutcome[locale]].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="learning-page templates-page page-width">
    <header className="learning-heading"><span>{en ? "START YOUR OWN CASE" : "НАЧНИТЕ СВОЙ КЕЙС"}</span><h1>{en ? "Templates" : "Шаблоны"}</h1><p>{en ? "Choose a structure. Add your own facts, evidence and questions." : "Выберите структуру. Добавьте свои факты, доказательства и вопросы."}</p></header>
    {onExample && <aside className="template-announcement learning-note" aria-labelledby="template-news-title"><h2 id="template-news-title">{en ? `${CASE_TYPE_REGISTRY.length} worked examples` : `${CASE_TYPE_REGISTRY.length} учебных примеров`}</h2><p>{en ? "Start with an empty template or open its fictional example as an editable copy." : "Выберите пустой шаблон или откройте его учебный пример как рабочую копию."}</p></aside>}
    <p className="template-start-note">{en ? "With a verified account, eligible local drafts are retained in Earlier device drafts before replacement. Save important work to the workspace. Undo history and unadded form items are not archived." : "После проверки аккаунта допустимые локальные черновики сохраняются в разделе «Предыдущие черновики устройства» до замены. Сохраняйте важную работу в workspace. История отмены и недобавленные элементы формы не архивируются."}</p>
    <div className="template-toolbar"><label htmlFor="template-search">{en ? "Find a template" : "Найти шаблон"}<input id="template-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? "Search by task or output…" : "Поиск по задаче или результату…"}/></label><p role="status" aria-live="polite" aria-atomic="true">{templates.length} / {CASE_TYPE_REGISTRY.length} {en ? "templates" : "шаблонов"}</p></div>
    <ol className="template-grid" aria-label={en ? "Case templates" : "Шаблоны кейсов"}>{templates.map(({ definition, number, book, presentation }) => <li className="template-card" key={definition.id} value={number}><article aria-labelledby={`template-${definition.id}`}>
      <header className="template-card-heading"><span className="template-number" aria-hidden="true">{String(number).padStart(2, "0")}</span><h2 id={`template-${definition.id}`}>{presentation.label}</h2></header><p>{presentation.summary}</p><dl><dt>{en ? "Work towards" : "Результат"}</dt><dd>{book.primaryOutcome[locale]}</dd></dl><details><summary>{en ? "What you will need" : "Что потребуется"}<span className="visually-hidden"> — {presentation.label}</span></summary><ul>{book.intakeQuestions.map(q => <li key={q.id}><b>{q.label[locale]}</b><p>{q.hint[locale]}</p></li>)}</ul></details>
      <div className="template-actions"><button className="primary-cta" type="button" onClick={() => onStart(definition.id)}>{en ? "Use this template" : "Использовать шаблон"}<span className="visually-hidden"> — {presentation.label}</span></button>{onExample && <button className="secondary-cta" type="button" onClick={() => onExample(definition.id)}>{en ? "Open worked example" : "Открыть учебный пример"}<span className="visually-hidden"> — {presentation.label}</span></button>}</div>
      {exampleLaunch?.id === definition.id && onExample && cancelExample && <ExampleLaunchStatus launch={exampleLaunch} locale={locale} cancel={cancelExample} retry={() => onExample(definition.id)}/>}
    </article></li>)}</ol>
    {templates.length === 0 && <div className="learning-note"><p>{en ? "No templates match your search. Try a task such as contract, tax or investigation." : "По вашему запросу шаблоны не найдены. Попробуйте: договор, налог или расследование."}</p><button type="button" className="secondary-cta" onClick={() => setQuery("")}>{en ? "Clear search" : "Очистить поиск"}</button></div>}
    <div className="learning-note"><b>{en ? "Want a worked example first?" : "Нужен учебный пример?"}</b><p>{en ? "Explore guided walkthroughs, decision simulations and editable fictional drafts. Expected outputs describe what to prepare; they are not approved reports. Templates give you a starting structure for your own work." : "Изучите пошаговые обзоры, симуляции решений и редактируемые учебные черновики. Ожидаемые результаты показывают, что подготовить; это не утверждённые отчёты. Шаблоны дают структуру для вашей работы."}</p><button type="button" className="secondary-cta" onClick={onDemo}>{en ? "Explore demos" : "Изучить демо"}</button></div>
  </main>;
}
