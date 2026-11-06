"use client";

import type { StudioWorkflowStep } from "./studio-workflow";

const sections = [
  { step: 1, en: "AI case flow", ru: "AI-схема дела", hintEn: "Describe the case and review an AI-assisted flow proposal before applying changes.", hintRu: "Опишите дело и проверьте предложенную AI-схему перед применением изменений." },
  { step: 3, en: "Sources & evidence", ru: "Источники и факты", hintEn: "Read sources and connect evidence to the case.", hintRu: "Изучите источники и свяжите факты с кейсом." },
  { step: 4, en: "Decision", ru: "Решение", hintEn: "Compare options on the decision map.", hintRu: "Сравните варианты на карте решений." },
  { step: 5, en: "Review", ru: "Проверка", hintEn: "Check gaps before preparing a report. Human approval is separate.", hintRu: "Проверьте пробелы перед отчётом. Утверждение человеком — отдельно." },
  { step: 6, en: "Reports", ru: "Отчёты", hintEn: "Prepare and download case reports.", hintRu: "Подготовьте и скачайте отчёты по кейсу." },
] as const;

/** Presentation over existing workflow stages: old URLs and data stay valid. */
export default function StudioWorkspaceTabs({ locale, activeStep, overview, workbench = false, onWorkbench, onOverview, onStep }: {
  locale: "en" | "ru";
  activeStep: StudioWorkflowStep;
  overview: boolean;
  workbench?: boolean;
  onWorkbench?: () => void;
  onOverview: () => void;
  onStep: (step: StudioWorkflowStep) => void;
}) {
  const en = locale === "en";
  return <div className="studio-workspace-navigation page-width">
    <nav aria-label={en ? "Case sections" : "Разделы дела"}>
      {onWorkbench && <button type="button" aria-pressed={workbench} onClick={onWorkbench}>{en ? "Workbench" : "Рабочее поле"}</button>}
      <button type="button" aria-pressed={overview} title={en ? "See the decision, recommendation and next actions." : "Посмотрите задачу, рекомендацию и следующие действия."} onClick={onOverview}>{en ? "Overview" : "Обзор"}</button>
      {sections.map(section => <button key={section.step} type="button" aria-pressed={!overview && !workbench && activeStep === section.step} title={en ? section.hintEn : section.hintRu} onClick={() => onStep(section.step)}>{en ? section.en : section.ru}</button>)}
    </nav>
    {!workbench && <details className="studio-preparation-tools" open={!overview && activeStep < 3 ? true : undefined}>
      <summary>{en ? "Flow review tools" : "Проверка схемы"}</summary>
      <div>
        <button type="button" aria-pressed={!overview && !workbench && activeStep === 2} onClick={() => onStep(2)}>{en ? "Review proposed changes" : "Проверить изменения"}</button>
      </div>
    </details>}
  </div>;
}
