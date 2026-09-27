"use client";

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

export default function CaseTemplates({ locale, onStart, onDemo }: {
  locale: "en" | "ru"; onStart: (id: CaseTypeId) => void; onDemo: () => void;
}) {
  const en = locale === "en";
  return <main className="learning-page page-width">
    <header className="learning-heading"><span>{en ? "START YOUR OWN CASE" : "НАЧНИТЕ СВОЙ КЕЙС"}</span><h1>{en ? "Templates" : "Шаблоны"}</h1><p>{en ? "Choose a structure. Add your own facts, evidence and questions." : "Выберите структуру. Добавьте свои факты, доказательства и вопросы."}</p></header>
    <p className="learning-note">{en ? "Each template opens a new Studio draft with a case type and intake questions. It contains no example facts or conclusions. Your current draft is replaced only after confirmation." : "Шаблон открывает новый черновик Studio с типом кейса и вопросами. В нём нет готовых фактов или выводов. Замена текущего черновика требует подтверждения."}</p>
    <div className="template-grid">{CASE_TYPE_REGISTRY.map(definition => {
      const book = caseTypePlaybook(caseTypeReference(definition.id));
      const presentation = caseTypePresentation(book, locale);
      return <article className="template-card" key={definition.id}><h2>{presentation.label}</h2><p>{presentation.summary}</p><dl><dt>{en ? "Work towards" : "Результат"}</dt><dd>{book.primaryOutcome[locale]}</dd></dl><details><summary>{en ? "What you will need" : "Что потребуется"}</summary><ul>{book.intakeQuestions.map(q => <li key={q.id}>{q.label[locale]}</li>)}</ul></details><button className="primary-cta" type="button" onClick={() => onStart(definition.id)}>{en ? "Use this template" : "Использовать шаблон"}<span className="visually-hidden"> — {presentation.label}</span></button></article>;
    })}</div>
    <div className="learning-note"><b>{en ? "Want a worked example first?" : "Нужен готовый пример?"}</b><p>{en ? "Demo contains completed fictional cases to explore. Templates give you a starting structure for your own work." : "Демо содержит готовые учебные кейсы. Шаблоны дают структуру для вашей работы."}</p><button type="button" className="secondary-cta" onClick={onDemo}>{en ? "Explore demos" : "Изучить демо"}</button></div>
  </main>;
}
