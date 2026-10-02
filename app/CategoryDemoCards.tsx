"use client";

import type { CategoryDemo } from "./category-demos";
import ExampleLaunchStatus, { type ExampleLaunch } from "./ExampleLaunchStatus";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypePresentation } from "./case-type-presentation";
import { caseTypeReference } from "./case-type-reference";
import type { CaseTypeId } from "./types";

export default function CategoryDemoCards({ demos, locale, onOpen, exampleLaunch, cancelExample }: {
  demos: readonly CategoryDemo[]; locale: "en" | "ru"; onOpen: (id: CaseTypeId) => void;
  exampleLaunch?: ExampleLaunch | null; cancelExample?: () => void;
}) {
  const en = locale === "en";
  return <div className="demo-catalogue-grid category-demo-grid">{demos.map(demo => {
    const book = caseTypePlaybook(caseTypeReference(demo.caseTypeId));
    return <article className="demo-catalogue-card" key={demo.caseTypeId}>
      <span className="demo-format">{en ? "Worked Studio example" : "Учебный пример Studio"}</span>
      <h2>{demo.title[locale]}</h2><p>{demo.question[locale]}</p>
      <p className="demo-card-meta">{caseTypePresentation(book, locale).label} · {en ? "Fictional · 15 min exploration" : "Учебный · 15 минут на изучение"}</p>
      <p><b>{en ? "Work towards" : "Результат"}:</b> {book.primaryOutcome[locale]}</p>
      <details className="demo-editorial"><summary>{en ? "What to explore" : "Что изучить"}</summary><p>{demo.evidence[locale]}</p><p>{en ? "Trace the decision to its evidence, compare both outcomes and review the expected output. Professional review remains required." : "Проследите доказательства решения, сравните исходы и изучите ожидаемый результат. Требуется профессиональная проверка."}</p>{demo.caseTypeId === "training_simulation" && <p>{en ? "In Studio, choose Test → Play to make decisions on the branching route." : "В Studio выберите «Тест → Играть», чтобы пройти маршрут решений."}</p>}</details>
      <details className="demo-editorial"><summary>{en ? "Synthetic sources & output outline" : "Учебные источники и структура результата"}<span className="visually-hidden"> — {demo.title[locale]}</span></summary>
        <p>{en ? "These inspectable excerpts are authored for teaching. They are not external documents or verified legal sources." : "Эти доступные для изучения выдержки созданы для обучения. Это не внешние документы и не проверенные правовые источники."}</p>
        <ol>{demo.facts.map((fact, index) => <li key={index}><b>{en ? `Source S${index + 1}: ${index === 0 ? "scenario record" : "unresolved assumption"}` : `Источник S${index + 1}: ${index === 0 ? "данные сценария" : "открытое допущение"}`}</b><p>{fact[locale]}</p></li>)}</ol>
        <p><b>{en ? "Evidence annotation" : "Аннотация доказательств"}:</b> {demo.evidence[locale]}</p>
        <h3>{en ? "Illustrative output outline — review required" : "Учебная структура результата — требуется проверка"}</h3>
        <p>{demo.decision[locale]}</p><ul><li>{demo.proceed[locale]}</li><li>{demo.pause[locale]}</li></ul>
        <p>{en ? "A pause can be the appropriate professional decision. Only the training simulation grades its explicitly unsafe restart route. This outline is not a generated or approved report." : "Пауза может быть правильным профессиональным решением. Только учебная симуляция оценивает явно небезопасный повторный запуск. Эта структура не является сформированным или утверждённым отчётом."}</p>
      </details>
      <button type="button" className="primary-cta" onClick={() => onOpen(demo.caseTypeId)} aria-label={`${en ? "Open worked example" : "Открыть учебный пример"}: ${demo.title[locale]}`}>{en ? "Open worked example" : "Открыть учебный пример"}</button>
      {exampleLaunch?.id === demo.caseTypeId && cancelExample && <ExampleLaunchStatus launch={exampleLaunch} locale={locale} cancel={cancelExample} retry={() => onOpen(demo.caseTypeId)}/>}
    </article>;
  })}</div>;
}
