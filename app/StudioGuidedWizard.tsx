"use client";

import type { StudioWorkflowStep } from "./studio-workflow";

export type GuidedStudioStep = StudioWorkflowStep;

type Locale = "en" | "ru";

type StepCopy = {
  label: string;
  short: string;
  title: string;
  description: string;
  ready: string;
};

const copy: Record<Locale, StepCopy[]> = {
  en: [
    { label: "Brief", short: "Describe", title: "Tell us what needs to be decided", description: "Use plain language. Include the parties, jurisdiction, important facts, desired outcome and anything still uncertain.", ready: "The brief is ready for review." },
    { label: "AI draft", short: "Review", title: "Review the proposed structure", description: "Nothing changes until you approve it. Check assumptions, warnings and every proposed operation before applying the draft.", ready: "A structured draft has been applied." },
    { label: "Case facts", short: "Complete", title: "Confirm the facts and assumptions", description: "Give the case a clear title, confirm jurisdiction and role, then check the publishable context and economic assumptions.", ready: "The core case details are complete." },
    { label: "Decision map", short: "Map", title: "Make every route understandable", description: "Inspect the visual map. Each choice should lead somewhere intentional, and every route should finish at an Outcome.", ready: "The decision map has nodes and connections." },
    { label: "Test", short: "Validate", title: "Run the case before sharing it", description: "Resolve plain-language checks, then play the scenario exactly as a learner or client will experience it.", ready: "The case compiles and is ready to test." },
    { label: "Finish", short: "Share", title: "Save, report and submit", description: "Choose the right output: keep a workspace draft, preview an analytical draft, or submit the case for expert review.", ready: "Choose a final action below." },
  ],
  ru: [
    { label: "Задача", short: "Опишите", title: "Расскажите, какое решение нужно принять", description: "Пишите обычным языком. Укажите стороны, юрисдикцию, важные факты, желаемый результат и всё, что пока неизвестно.", ready: "Описание готово к проверке." },
    { label: "AI-черновик", short: "Проверьте", title: "Проверьте предложенную структуру", description: "До вашего подтверждения ничего не изменится. Проверьте допущения, предупреждения и каждую операцию перед применением.", ready: "Структурированный черновик применён." },
    { label: "Факты", short: "Уточните", title: "Подтвердите факты и допущения", description: "Дайте кейсу понятное название, подтвердите юрисдикцию и роль, затем проверьте публикуемый контекст и экономические допущения.", ready: "Основные детали кейса заполнены." },
    { label: "Карта", short: "Свяжите", title: "Сделайте каждый маршрут понятным", description: "Проверьте визуальную карту. Каждый выбор должен вести к осмысленному продолжению, а каждый маршрут — завершаться исходом.", ready: "В карте есть узлы и связи." },
    { label: "Тест", short: "Проверьте", title: "Пройдите кейс перед отправкой", description: "Устраните понятные замечания, затем пройдите сценарий так, как его увидит обучающийся или клиент.", ready: "Кейс собран и готов к тесту." },
    { label: "Готово", short: "Сохраните", title: "Сохраните, создайте отчёт или отправьте", description: "Выберите результат: сохранить черновик в workspace, просмотреть аналитический черновик или отправить кейс на экспертную рецензию.", ready: "Выберите итоговое действие ниже." },
  ],
};

export function recommendedGuidedStudioStep(readiness: readonly boolean[]): GuidedStudioStep {
  const incomplete = readiness.findIndex((ready) => !ready);
  return Math.min(6, (incomplete < 0 ? 6 : incomplete + 1)) as GuidedStudioStep;
}

export default function StudioGuidedWizard({
  locale,
  activeStep,
  readiness,
  onStepChange,
  onFocusBrief,
  onStartExample,
  onImport,
  caseName,
  saveState,
  validationReady,
}: {
  locale: Locale;
  activeStep: GuidedStudioStep;
  readiness: readonly boolean[];
  onStepChange: (step: GuidedStudioStep) => void;
  onFocusBrief: () => void;
  onStartExample: () => void;
  onImport: () => void;
  caseName: string;
  saveState: "idle" | "saving" | "saved" | "submitted" | "conflict" | "auth_required" | "error";
  validationReady: boolean;
}) {
  const steps = copy[locale];
  const completed = readiness.filter(Boolean).length;
  const current = steps[activeStep - 1];
  const canContinue = activeStep === 6 || readiness[activeStep - 1];
  const saveLabel = saveState === "saving" ? (locale === "en" ? "Saving…" : "Сохранение…")
    : saveState === "saved" ? (locale === "en" ? "Saved to workspace" : "Сохранено в рабочем пространстве")
    : saveState === "submitted" ? (locale === "en" ? "Submitted for review" : "Отправлено на рецензию")
    : saveState === "idle" ? (locale === "en" ? "Not saved to workspace" : "Не сохранено в рабочем пространстве")
    : (locale === "en" ? "Saving needs attention" : "Проверьте сохранение");

  function changeStep(step: GuidedStudioStep) {
    onStepChange(step);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.requestAnimationFrame(() => document.getElementById("studio-guided-workflow")?.scrollIntoView({ behavior, block: "start" }));
  }

  return <section className="studio-guide-shell page-width" id="studio-guided-workflow" aria-labelledby="studio-guided-title">
    {activeStep === 1 && <div className="studio-quick-starts" aria-label={locale === "en" ? "Quick starts" : "Быстрый старт"}>
      <button type="button" onClick={onStartExample}><span>01</span><b>{locale === "en" ? "Open an example" : "Открыть пример"}</b><small>{locale === "en" ? "Edit a prepared case and inspect its decision map" : "Измените готовый кейс и изучите карту решений"}</small></button>
      <button type="button" onClick={onImport}><span>02</span><b>{locale === "en" ? "Load a case or prompt" : "Загрузить кейс или промпт"}</b><small>{locale === "en" ? "Studio JSON, canonical Markdown or a text description" : "JSON Studio, канонический Markdown или текстовое описание"}</small></button>
      <button type="button" onClick={onFocusBrief}><span>03</span><b>{locale === "en" ? "Describe a task" : "Описать задачу"}</b><small>{locale === "en" ? "Start with a plain-language brief" : "Начните с описания обычным языком"}</small></button>
    </div>}
    <header className="studio-guide-progress studio-guide-progress-compact">
      <div>
        <h2 id="studio-guided-title">{caseName.trim() || (locale === "en" ? "New case" : "Новый кейс")}</h2>
        <p className={`studio-guide-save save-${saveState}`}><span>{saveLabel}</span><span aria-hidden="true"> · </span><span>{validationReady ? (locale === "en" ? "Ready to test" : "Готово к тесту") : (locale === "en" ? "Work in progress" : "В работе")}</span></p>
      </div>
      <div className="studio-guide-meter" aria-label={locale === "en" ? `${completed} of 6 sections contain data` : `Заполнено разделов: ${completed} из 6`}>
        <b>{completed}/6</b><small>{locale === "en" ? "Sections filled" : "Разделы заполнены"}</small>
        <progress max={6} value={completed} aria-label={locale === "en" ? "Case content progress; review and testing are separate" : "Заполнение кейса; проверка и тестирование отдельно"}/>
      </div>
    </header>
    <nav className="studio-guide" aria-label={locale === "en" ? "Case authoring steps" : "Этапы создания кейса"}>
      <ol>
        {steps.map((step, index) => {
          const number = (index + 1) as GuidedStudioStep;
          const done = readiness[index];
          const active = activeStep === number;
          const available = index === 0 || readiness.slice(0, index).every(Boolean);
          return <li key={step.label} className={active ? "current" : done ? "done" : available ? "available" : "blocked"}>
            <button type="button" disabled={!active && !available} aria-current={active ? "step" : undefined} onClick={() => changeStep(number)}>
              <b>{done ? "✓" : number}</b>
              <span>{step.label}<small>{step.short}</small></span>
            </button>
          </li>;
        })}
      </ol>
    </nav>
    <div className="studio-guide-task studio-guide-task-compact" aria-live="polite">
      <div className="studio-guide-task-copy">
        <h3>{current.title}</h3>
        <p>{current.description}</p>
        {readiness[activeStep - 1] && <small className="ready">✓ {current.ready}</small>}
      </div>
      <div className="studio-guide-navigation">
        {activeStep > 1 && <button type="button" className="secondary-cta" onClick={() => changeStep((activeStep - 1) as GuidedStudioStep)}>{locale === "en" ? "Back" : "Назад"}</button>}
        {activeStep < 6 && <button type="button" className="primary-cta" disabled={!canContinue} onClick={() => changeStep((activeStep + 1) as GuidedStudioStep)}>{locale === "en" ? "Continue" : "Продолжить"}<span aria-hidden="true">→</span></button>}
      </div>
    </div>

  </section>;
}
