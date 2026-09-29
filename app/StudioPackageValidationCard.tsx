"use client";

import { caseTypePlaybook } from "./case-type-playbooks";
import type { StudioDraft } from "./types";

export default function StudioPackageValidationCard({ locale, draft, warningCount }: {
  locale: "en" | "ru";
  draft: StudioDraft;
  warningCount: number;
}) {
  const playbook = caseTypePlaybook(draft.caseType);
  const ready = warningCount === 0;
  return <section className="package-validation-card page-width" aria-labelledby="package-validation-title">
    <header><div><span>{locale === "en" ? "CASE-TYPE TEST" : "ПРОВЕРКА ТИПА КЕЙСА"}</span><h2 id="package-validation-title">{playbook.test.label[locale]}</h2></div><b className={ready ? "ready" : "blocked"}>{ready ? (locale === "en" ? "READY" : "ГОТОВО") : `${warningCount} ${locale === "en" ? "TO REVIEW" : "ПРОВЕРИТЬ"}`}</b></header>
    <div className="package-validation-body">
      <div><span>{locale === "en" ? "METHOD" : "МЕТОД"}</span><strong>{playbook.test.mode.toUpperCase()}</strong><p>{playbook.summary[locale]}</p></div>
      <div><span>{locale === "en" ? "REVIEW SCOPE" : "ОБЪЁМ ПРОВЕРКИ"}</span><strong>{locale === "en" ? "Completeness, then judgment" : "Полнота и оценка"}</strong><p>{locale === "en" ? "These checks assess the package's completeness. They do not confirm that evidence is reliable or replace an independent reviewer's decision." : "Эти проверки оценивают полноту пакета. Они не подтверждают надёжность доказательств и не заменяют решение независимого рецензента."}</p></div>
      <div><span>{locale === "en" ? "PRIMARY OUTPUT" : "ОСНОВНОЙ РЕЗУЛЬТАТ"}</span><strong>{playbook.primaryOutcome[locale]}</strong><p>{ready ? (locale === "en" ? "The package is ready for professional output and review." : "Пакет готов к профессиональному результату и рецензии.") : (locale === "en" ? "Resolve the listed gaps before final review." : "Устраните перечисленные замечания перед итоговой рецензией.")}</p></div>
    </div>
  </section>;
}
