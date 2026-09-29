import type { CaseTypePlaybook } from "./case-type-playbooks";

// UI guidance only: persisted packages, AI inputs and report copy use the registry.
export function caseTypePresentation(playbook: CaseTypePlaybook, locale: "en" | "ru") {
  if (playbook.caseType.id === "tax_planning") return {
    label: playbook.label[locale],
    summary: locale === "en"
      ? "Compare lawful tax structures and their economics. Choose this for a tax position memorandum and an economic assessment."
      : "Сравните законные налоговые структуры и их экономику. Для меморандума по налоговой позиции и экономической оценки.",
  };
  if (playbook.caseType.id === "tax_compliance") return {
    label: locale === "en" ? "Tax & compliance" : playbook.label[locale],
    summary: locale === "en"
      ? "Combine tax analysis with a compliance schedule for reporting, approvals, owners and effective dates."
      : "Дополните налоговый анализ планом отчётности, согласований, ответственных и дат.",
  };
  return { label: playbook.label[locale], summary: playbook.summary[locale] };
}
