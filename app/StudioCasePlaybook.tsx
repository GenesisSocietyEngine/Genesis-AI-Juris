"use client";

import { caseTypePlaybook, evaluateCaseTypeDraft } from "./case-type-playbooks";
import { caseTypePresentation } from "./case-type-presentation";
import type { StudioDraft } from "./types";

export default function StudioCasePlaybook({ locale, draft, phase }: {
  locale: "en" | "ru";
  draft: StudioDraft;
  phase: "intake" | "outputs";
}) {
  const playbook = caseTypePlaybook(draft.caseType);
  const presentation = caseTypePresentation(playbook, locale);
  const checks = evaluateCaseTypeDraft(draft, locale);
  const complete = checks.filter((check) => check.level === "ok").length;
  if (phase === "outputs") return <section className="case-playbook case-playbook-outputs page-width" aria-labelledby="case-playbook-output-title">
    <header><div><span>{locale === "en" ? "CASE OUTPUTS" : "РЕЗУЛЬТАТЫ КЕЙСА"}</span><h2 id="case-playbook-output-title">{playbook.primaryOutcome[locale]}</h2><p>{locale === "en" ? "Choose the professional form that matches how this matter will be reviewed or used." : "Выберите профессиональную форму, соответствующую проверке или использованию кейса."}</p></div></header>
    <div className="case-playbook-output-grid">{playbook.outputs.map((output, index) => <article key={output.id} className={output.primary ? "primary" : ""}><span>{String(index + 1).padStart(2, "0")}</span><small>{output.primary ? (locale === "en" ? "PRIMARY" : "ОСНОВНОЙ") : (locale === "en" ? "SUPPORTING" : "ДОПОЛНИТЕЛЬНЫЙ")}</small><h3>{output.label[locale]}</h3><p>{output.description[locale]}</p></article>)}</div>
    <details><summary>{locale === "en" ? "Technical details" : "Технические сведения"}</summary><p><code>{playbook.caseType.id}@{playbook.caseType.version}</code></p></details>
  </section>;
  return <section className="case-playbook page-width" aria-labelledby="case-playbook-title">
    <header><div><span>{locale === "en" ? "CASE GUIDANCE" : "ПОДСКАЗКИ ДЛЯ КЕЙСА"}</span><h2 id="case-playbook-title">{presentation.label}</h2><p>{presentation.summary}</p></div><b>{complete}/{checks.length}</b></header>
    <aside><span>{locale === "en" ? "AI STRUCTURING LENS" : "ФОКУС AI-СТРУКТУРИРОВАНИЯ"}</span><p>{playbook.aiFocus[locale]}</p></aside>
    <div className="case-playbook-question-grid">{playbook.intakeQuestions.map((question, index) => <article key={question.id}><span>{String(index + 1).padStart(2, "0")}</span><h3>{question.label[locale]}</h3><p>{question.hint[locale]}</p></article>)}</div>
    <footer><span>{locale === "en" ? "Case checks" : "Проверки кейса"}</span><b>{playbook.test.label[locale]}</b><small>{playbook.test.requiresPlayableRoute ? (locale === "en" ? "Playable route required" : "Требуется игровой маршрут") : (locale === "en" ? "Reviewable case; simulation is optional" : "Кейс для проверки; симуляция необязательна")}</small></footer>
    <details><summary>{locale === "en" ? "Technical details" : "Технические сведения"}</summary><p><code>{playbook.caseType.id}@{playbook.caseType.version}</code> · V59</p>{playbook.test.requiresPlayableRoute && <p>{locale === "en" ? "Rust-playable route required" : "Требуется игровой маршрут Rust"}</p>}</details>
  </section>;
}
