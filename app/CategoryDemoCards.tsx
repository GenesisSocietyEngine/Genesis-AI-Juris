"use client";

import type { CategoryDemo } from "./category-demos";
import { categoryDemoPrompt } from "./category-demo-prompts";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypePresentation } from "./case-type-presentation";
import { caseTypeReference } from "./case-type-reference";
import type { CaseTypeId } from "./types";

export default function CategoryDemoCards({ demos, locale, onOpen }: {
  demos: readonly CategoryDemo[]; locale: "en" | "ru"; onOpen: (id: CaseTypeId) => void;
}) {
  const en = locale === "en";
  return <div className="demo-catalogue-grid category-demo-grid">{demos.map(demo => {
    const book = caseTypePlaybook(caseTypeReference(demo.caseTypeId));
    return <article className="demo-catalogue-card" key={demo.caseTypeId}>
      <span className="demo-format">{en ? "Worked Studio example" : "Учебный пример Studio"}</span>
      <h2>{demo.title[locale]}</h2><p><b>{en ? "Illustrative prompt" : "Учебный промпт"}:</b> {categoryDemoPrompt(demo.caseTypeId, locale)}</p>
      <p className="demo-card-meta">{caseTypePresentation(book, locale).label} · {en ? "Fictional · 15 min exploration" : "Учебный · 15 минут на изучение"}</p>
      <p><b>{en ? "Work towards" : "Результат"}:</b> {book.primaryOutcome[locale]}</p>
      <details className="demo-editorial"><summary>{en ? "What to explore" : "Что изучить"}</summary><p>{en ? "After opening, choose Brief & structure → Edit the brief to adapt this prompt. Opening an example does not run AI." : "После открытия выберите «Задача и структура → Изменить описание», чтобы адаптировать промпт. Открытие примера не запускает ИИ."}</p><p>{demo.evidence[locale]}</p><p>{en ? "Trace the decision to its evidence, compare both outcomes and review the expected output. Professional review remains required." : "Проследите доказательства решения, сравните исходы и изучите ожидаемый результат. Требуется профессиональная проверка."}</p>{demo.caseTypeId === "training_simulation" && <p>{en ? "In Studio, choose Test → Play to make decisions on the branching route." : "В Studio выберите «Тест → Играть», чтобы пройти маршрут решений."}</p>}</details>
      <button type="button" className="primary-cta" onClick={() => onOpen(demo.caseTypeId)} aria-label={`${en ? "Open worked example" : "Открыть учебный пример"}: ${demo.title[locale]}`}>{en ? "Open worked example" : "Открыть учебный пример"}</button>
    </article>;
  })}</div>;
}
