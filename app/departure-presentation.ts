import type { DepartureChange } from "./navigation-controller";

export function departureChangeLabel(change: DepartureChange, locale: "en" | "ru") {
  const labels: Record<DepartureChange, [string, string]> = {
    studio_case: ["Case changes have not been saved to your workspace.", "Изменения кейса не сохранены в рабочем пространстве."],
    contact: ["Your contact changes are still in this tab.", "Изменения контактов остаются в этой вкладке."],
    case_work: ["Your document, case update or saved view has changes in this tab. Save it to its shown destination before leaving.", "Изменения документа, дела или представления остаются во вкладке. Сохраните их в указанном месте перед выходом."],
    intake: ["Your intake changes are still in this tab. Saving a form draft keeps it on its selected case.", "Изменения формы остаются в этой вкладке. Сохранённый черновик будет доступен в выбранном деле."],
    studio_prompt: ["The AI prompt is still in this tab. Saving the case does not save this prompt.", "AI-промпт остаётся в этой вкладке. Сохранение кейса не сохраняет этот промпт."],
    studio_items: ["Working items have not been added to the case. Add them before saving.", "Рабочие элементы ещё не добавлены в кейс. Добавьте их перед сохранением."],
    portal_invitation: ["Your client invitation has not been created or sent.", "Приглашение клиента ещё не создано и не отправлено."],
    portal_reply: ["Your portal reply has not been sent.", "Ответ в портале ещё не отправлен."],
    portal_upload: ["Your selected file has not been uploaded.", "Выбранный файл ещё не загружен."],
    workspace: ["Changes in this workspace have not been saved.", "Изменения в рабочей области не сохранены."],
  };
  return labels[change][locale === "en" ? 0 : 1];
}
