import type { MatterActionTarget } from "./matter-actions";

const actions: Record<string, [string, string]> = {
  "Add a source document": [
    "Add a source document",
    "Добавьте исходный документ",
  ],
  "Review the source document": [
    "Review the source document",
    "Проверьте исходный документ",
  ],
  "Provide requested information": [
    "Answer the information request",
    "Ответьте на запрос",
  ],
  "Review the proposed change": [
    "Review the proposed change",
    "Проверьте предложенное изменение",
  ],
  "Review conflicting evidence": [
    "Review conflicting evidence",
    "Сверьте противоречащие доказательства",
  ],
  "Repair the evidence citation": [
    "Check the evidence citation",
    "Проверьте ссылку на доказательство",
  ],
  "Review the changed source": [
    "Review the updated source",
    "Проверьте обновлённый источник",
  ],
  "Set the key case deadline": [
    "Set the case deadline",
    "Укажите срок по делу",
  ],
  "Review the overdue deadline": [
    "Review the overdue deadline",
    "Проверьте пропущенный срок",
  ],
  "Link a verified decision map": [
    "Link the decision map",
    "Добавьте карту решений",
  ],
  "Attach a completed simulation": [
    "Attach the simulation results",
    "Добавьте результаты моделирования",
  ],
  "Refresh the outdated report": ["Update the report", "Обновите отчёт"],
  "Review the source citation": [
    "Review the source citation",
    "Проверьте ссылку на источник",
  ],
  "Review the professional assertion": [
    "Review the finding",
    "Проверьте вывод",
  ],
  "Inspect the readiness finding": [
    "Review this check",
    "Проверьте этот пункт",
  ],
};
export function overviewAction(
  title: string,
  target: MatterActionTarget,
  locale: "en" | "ru",
  canApprove: boolean,
) {
  const i = locale === "en" ? 0 : 1;
  if (target.id === "snapshot-create")
    return [
      "Save the evidence for the report",
      "Сохраните доказательства для отчёта",
    ][i];
  if (target.id === "report-generate")
    return ["Generate the report", "Подготовьте отчёт"][i];
  if (title === "Review the current report")
    return (
      canApprove
        ? ["Review the report for approval", "Проверьте отчёт для утверждения"]
        : [
            "Ask a reviewer to approve the report",
            "Попросите проверяющего утвердить отчёт",
          ]
    )[i];
  for (const [prefix, ru] of [
    ["Provide information: ", "Ответьте на запрос — "],
    ["Review document: ", "Проверьте документ — "],
  ])
    if (title.startsWith(prefix))
      return i === 0 ? title : ru + title.slice(prefix.length);
  return actions[title]?.[i] ?? title;
}
