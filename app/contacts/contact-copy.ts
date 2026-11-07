import type { Relationship } from "./contact-model";
const relationshipLabels: Record<Relationship, [string, string]> = {
  prospect: ["Prospect", "Потенциальный клиент"],
  client: ["Client", "Клиент"],
  former_client: ["Former client", "Бывший клиент"],
  professional: ["Professional contact", "Профессиональный контакт"],
};
export const relationshipLabel = (value: Relationship, locale: "en" | "ru") =>
  relationshipLabels[value][locale === "ru" ? 1 : 0];
const messages: Record<string, [string, string]> = {
  create: ["Contact saved.", "Контакт сохранён."],
  edit: ["Contact changes saved.", "Изменения контакта сохранены."],
  archive: [
    "Contact archived. You can restore it from Archived.",
    "Контакт в архиве. Его можно восстановить в разделе «Архив».",
  ],
  restore: ["Contact restored.", "Контакт восстановлен."],
  link: ["Case linked.", "Связь с делом сохранена."],
  unlink: ["Case link removed.", "Связь с делом удалена."],
  import: ["Reviewed contacts imported.", "Проверенные контакты импортированы."],
  undo: [
    "Import undone. The imported contacts are in Archived.",
    "Импорт отменён. Импортированные контакты перенесены в архив.",
  ],
  load: [
    "Contacts could not be loaded. Refresh to try again.",
    "Не удалось загрузить контакты. Обновите список.",
  ],
  review: ["Review your contact changes before leaving.", "Перед выходом проверьте изменения."],
  unconfirmed: [
    "The save is unconfirmed. Check the original save to continue.",
    "Сохранение не подтверждено. Проверьте результат исходного сохранения.",
  ],
  changed: [
    "The directory changed. Review the latest record and possible matches before saving.",
    "Справочник изменился. Перед сохранением проверьте запись и возможные совпадения.",
  ],
  caseAccess: [
    "Your case access changed. Refresh the list of cases.",
    "Доступ к делу изменился. Обновите список дел.",
  ],
  undoChanged: [
    "An imported contact has changed. Review and archive contacts individually.",
    "Один из импортированных контактов изменился. Проверьте контакты и архивируйте их по отдельности.",
  ],
  batchMissing: [
    "This import is unavailable. Refresh the directory.",
    "Импорт недоступен. Обновите справочник.",
  ],
  name: ["Enter a name.", "Введите имя или название."],
  kind: ["Use person or company for the contact type.", "Укажите тип person или company."],
  relationship: ["Choose a valid relationship.", "Выберите вид отношений."],
  company: ["Choose an available company.", "Выберите доступную компанию."],
  email: ["Enter a valid email address.", "Введите действительный адрес электронной почты."],
  website: [
    "Enter a full website address starting with https:// or http://.",
    "Введите полный адрес сайта с https:// или http://.",
  ],
  invalid: ["Check the fields and their lengths.", "Проверьте поля и длину значений."],
  duplicate: ["Possible duplicate", "Возможное совпадение"],
  csvSize: [
    "Choose a CSV file up to 64 KB or paste its contents.",
    "Выберите CSV до 64 КБ или вставьте содержимое.",
  ],
  csvQuotes: ["Check the quotation marks in the CSV.", "Проверьте кавычки в CSV."],
  csvHeader: [
    "Use kind and name as headings. Optional headings are email, phone, group, website, address and relationship.",
    "Укажите заголовки kind и name. Дополнительные заголовки: email, phone, group, website, address и relationship.",
  ],
  csvRows: ["Review 1–25 contact rows per import.", "За один импорт можно проверить от 1 до 25 контактов."],
  csvColumns: ["Column count differs from the header.", "Число столбцов отличается от заголовка."],
};
export function contactMessage(code: string, locale: "en" | "ru") {
  return (messages[code] ?? messages.invalid)[locale === "ru" ? 1 : 0];
}
