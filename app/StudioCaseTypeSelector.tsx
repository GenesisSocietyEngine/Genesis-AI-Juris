"use client";

import { CASE_TYPE_REGISTRY, caseTypeDefinition } from "./case-type-registry";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypePresentation } from "./case-type-presentation";
import { caseTypeReference } from "./case-type-reference";
import type { CaseTypeId, CaseTypeReference } from "./types";

export default function StudioCaseTypeSelector({ locale, value, disabled, onChange }: {
  locale: "en" | "ru";
  value?: CaseTypeReference;
  disabled: boolean;
  onChange: (id: CaseTypeId) => void;
}) {
  const selected = caseTypeDefinition(value);
  return <section className="case-type-picker page-width" aria-labelledby="case-type-title">
    <header>
      <div><span>{locale === "en" ? "CASE TYPE" : "ТИП КЕЙСА"}</span><h2 id="case-type-title">{locale === "en" ? "What kind of matter are you structuring?" : "Какую профессиональную задачу вы структурируете?"}</h2></div>
    </header>
    <div className="case-type-options" role="radiogroup" aria-label={locale === "en" ? "Case type" : "Тип кейса"}>
      {CASE_TYPE_REGISTRY.map((definition) => {
        const active = definition.id === selected.id;
        const text = caseTypePlaybook(caseTypeReference(definition.id));
        const presentation = caseTypePresentation(text, locale);
        return <button key={definition.id} type="button" role="radio" aria-checked={active} className={active ? "active" : ""} disabled={disabled} onClick={() => onChange(definition.id)}>
          <span>{presentation.label}</span>
          <small>{presentation.summary}</small>
          <b>{text.primaryOutcome[locale]}</b>
        </button>;
      })}
    </div>
    <footer><span>{locale === "en" ? "Primary result" : "Основной результат"}: <b>{caseTypePlaybook(value).primaryOutcome[locale]}</b></span></footer>
    <details><summary>{locale === "en" ? "Technical details" : "Технические сведения"}</summary><p><code>{selected.id} · v{selected.version}</code></p><p>{locale === "en" ? "Workflow" : "Процесс"}: <b>{selected.workflowMode}</b> · {locale === "en" ? "Pinned definition" : "Зафиксированная версия"}: <b>{selected.version}</b></p></details>
  </section>;
}
