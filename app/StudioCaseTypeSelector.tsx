"use client";

import { CASE_TYPE_REGISTRY, caseTypeDefinition } from "./case-type-registry";
import type { CaseTypeId, CaseTypeReference } from "./types";

const presentation: Record<CaseTypeId, {
  label: { en: string; ru: string };
  summary: { en: string; ru: string };
  outcome: { en: string; ru: string };
}> = {
  general_advisory: {
    label: { en: "Advisory decision", ru: "Консультационное решение" },
    summary: { en: "Structure issues, evidence, options and a reasoned recommendation.", ru: "Структурируйте вопросы, доказательства, варианты и обоснованную рекомендацию." },
    outcome: { en: "Decision memorandum", ru: "Меморандум по решению" },
  },
  tax_compliance: {
    label: { en: "Tax & compliance", ru: "Налоги и compliance" },
    summary: { en: "Compare lawful positions, economics, sources and reporting obligations.", ru: "Сравните законные позиции, экономику, источники и обязанности по отчётности." },
    outcome: { en: "Tax position memorandum", ru: "Меморандум по налоговой позиции" },
  },
  erp_incident: {
    label: { en: "ERP incident & solution", ru: "ERP-инцидент и решение" },
    summary: { en: "Capture the process failure, root cause, controls, solution and test evidence.", ru: "Зафиксируйте сбой процесса, первопричину, контроли, решение и тестовые доказательства." },
    outcome: { en: "Solution design & test pack", ru: "Проект решения и пакет тестов" },
  },
  training_simulation: {
    label: { en: "Training simulation", ru: "Учебная симуляция" },
    summary: { en: "Build a deterministic branching route with decisions, pressure and outcomes.", ru: "Создайте детерминированный ветвящийся маршрут с решениями, давлением и исходами." },
    outcome: { en: "Playable scenario", ru: "Игровой сценарий" },
  },
};

export default function StudioCaseTypeSelector({ locale, value, disabled, onChange }: {
  locale: "en" | "ru";
  value?: CaseTypeReference;
  disabled: boolean;
  onChange: (id: CaseTypeId) => void;
}) {
  const selected = caseTypeDefinition(value);
  return <section className="case-type-picker page-width" aria-labelledby="case-type-title">
    <header>
      <div><span>{locale === "en" ? "CASE TYPE · VERSIONED PACKAGE" : "ТИП КЕЙСА · ВЕРСИОНИРУЕМЫЙ ПАКЕТ"}</span><h2 id="case-type-title">{locale === "en" ? "What kind of matter are you structuring?" : "Какую профессиональную задачу вы структурируете?"}</h2></div>
      <code>{selected.id} · v{selected.version}</code>
    </header>
    <div className="case-type-options" role="radiogroup" aria-label={locale === "en" ? "Case type" : "Тип кейса"}>
      {CASE_TYPE_REGISTRY.map((definition) => {
        const active = definition.id === selected.id;
        const text = presentation[definition.id];
        return <button key={definition.id} type="button" role="radio" aria-checked={active} className={active ? "active" : ""} disabled={disabled} onClick={() => onChange(definition.id)}>
          <span>{text.label[locale]}</span>
          <small>{text.summary[locale]}</small>
          <b>{text.outcome[locale]}</b>
        </button>;
      })}
    </div>
    <footer><span>{locale === "en" ? "Workflow" : "Процесс"}: <b>{selected.workflowMode}</b></span><span>{locale === "en" ? "Primary result" : "Основной результат"}: <b>{presentation[selected.id].outcome[locale]}</b></span><span>{locale === "en" ? "Pinned definition" : "Зафиксированная версия"}: <b>{selected.version}</b></span></footer>
  </section>;
}
