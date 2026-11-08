type Locale = "en" | "ru";
const filingLabels = new Map([
  ["Filing", "Подача документов"], ["Review", "Проверка"],
  ["Prepare filing packet", "Подготовить пакет документов"], ["File documents", "Подать документы"],
  ["Review meeting", "Встреча для проверки"], ["Record review follow-up", "Записать итоги проверки"],
]);

export function workflowLabel(text: string, application: string, locale: Locale) {
  if (!text) return locale === "ru" ? "Начало процесса" : "Workflow start";
  return locale === "ru" && application.split(":")[0] === "filing-review-v1" ? filingLabels.get(text) ?? text : text;
}
