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
      <div><span>{locale === "en" ? "AUTHORITY BOUNDARY" : "ГРАНИЦА АВТОРИТЕТНОСТИ"}</span><strong>{locale === "en" ? "One canonical draft" : "Один канонический черновик"}</strong><p>{locale === "en" ? "Package checks assess professional completeness. Any optional playable route still passes through the existing Rust compiler and runtime." : "Проверки пакета оценивают профессиональную полноту. Любой необязательный игровой маршрут по-прежнему проходит через существующие Rust-компилятор и runtime."}</p></div>
      <div><span>{locale === "en" ? "PRIMARY OUTPUT" : "ОСНОВНОЙ РЕЗУЛЬТАТ"}</span><strong>{playbook.primaryOutcome[locale]}</strong><p>{ready ? (locale === "en" ? "The package is ready for professional output and review." : "Пакет готов к профессиональному результату и рецензии.") : (locale === "en" ? "Resolve the package-specific checks below before final review." : "Устраните замечания пакета ниже перед итоговой рецензией.")}</p></div>
    </div>
  </section>;
}
