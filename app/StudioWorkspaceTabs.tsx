"use client";

import type { StudioWorkflowStep } from "./studio-workflow";

const sections = [
  { step: 3, en: "Sources & evidence", ru: "Источники и факты" },
  { step: 4, en: "Decision", ru: "Решение" },
  { step: 5, en: "Review", ru: "Проверка" },
  { step: 6, en: "Reports", ru: "Отчёты" },
] as const;

/** Presentation over existing workflow stages: old URLs and data stay valid. */
export default function StudioWorkspaceTabs({ locale, activeStep, overview, onOverview, onStep }: {
  locale: "en" | "ru";
  activeStep: StudioWorkflowStep;
  overview: boolean;
  onOverview: () => void;
  onStep: (step: StudioWorkflowStep) => void;
}) {
  const en = locale === "en";
  return <div className="studio-workspace-navigation page-width">
    <nav aria-label={en ? "Case sections" : "Разделы дела"}>
      <button type="button" aria-pressed={overview} onClick={onOverview}>{en ? "Overview" : "Обзор"}</button>
      {sections.map(section => <button key={section.step} type="button" aria-pressed={!overview && activeStep === section.step} onClick={() => onStep(section.step)}>{en ? section.en : section.ru}</button>)}
    </nav>
    <details className="studio-preparation-tools" open={!overview && activeStep < 3 ? true : undefined}>
      <summary>{en ? "Brief & structure" : "Задача и структура"}</summary>
      <div>
        <button type="button" aria-pressed={!overview && activeStep === 1} onClick={() => onStep(1)}>{en ? "Edit the brief" : "Изменить описание"}</button>
        <button type="button" aria-pressed={!overview && activeStep === 2} onClick={() => onStep(2)}>{en ? "Review proposed changes" : "Проверить изменения"}</button>
      </div>
    </details>
  </div>;
}
