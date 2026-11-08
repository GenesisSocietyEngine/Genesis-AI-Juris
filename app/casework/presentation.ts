import type { Locale } from "./model";
export const words = (l: Locale) => (en: string, ru: string) => (l === "en" ? en : ru);
const copy: Record<string, [string, string]> = {
  template: ["Template saved to the firm library.", "Шаблон сохранён в библиотеке фирмы."],
  generate: [
    "Document saved to the selected case. It is ready to download.",
    "Документ сохранён в выбранном деле и доступен для скачивания.",
  ],
  progress: ["Dated update saved to the case.", "Сообщение с датой сохранено в деле."],
  view: ["Personal view saved.", "Личное представление сохранено."],
  archive: ["Moved to Archived. It can be restored.", "Перемещено в архив. Можно восстановить."],
  restore: ["Restored.", "Восстановлено."],
  changed: [
    "A newer version was saved. Review the latest version before editing again.",
    "Сохранена более новая версия. Откройте её перед редактированием.",
  ],
  previewChanged: [
    "Case details or the template changed. Review the new preview before saving.",
    "Изменились сведения о деле или шаблон. Проверьте текст перед сохранением.",
  ],
  access: [
    "Case access changed. Refresh to see available cases.",
    "Доступ к делу изменился. Обновите список.",
  ],
  readOnly: ["This workspace is read-only.", "Рабочее пространство доступно только для чтения."],
  review: ["Review the fields below before saving.", "Проверьте поля перед сохранением."],
  unconfirmed: [
    "Save not confirmed. Check the save before trying again.",
    "Сохранение не подтверждено. Проверьте его результат.",
  ],
  load: [
    "Could not load this workspace. Refresh to retry.",
    "Не удалось загрузить рабочее пространство. Обновите страницу.",
  ],
  history: [
    "Could not load the updates. Open history again.",
    "Не удалось загрузить сообщения. Откройте историю ещё раз.",
  ],
  download: [
    "Could not download this document. Refresh and try again.",
    "Не удалось скачать документ. Обновите и попробуйте ещё раз.",
  ],
  fields: ["Check the required fields.", "Проверьте обязательные поля."],
  unknownField: [
    "Use the listed merge fields. One placeholder is not recognized.",
    "Используйте поля из списка. Один заполнитель не распознан.",
  ],
};
export const message = (code: string, l: Locale) => (copy[code] ?? copy.fields)[l === "en" ? 0 : 1];
export const when = (v: string, l: Locale) =>
  new Date(v).toLocaleString(l === "en" ? "en-GB" : "ru-RU", { dateStyle: "medium", timeStyle: "short" });
