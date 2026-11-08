import type { IntakeStatus } from "./intake-model";
export type Locale = "en" | "ru";
export const words = (locale: Locale) => (en: string, ru: string) => (locale === "en" ? en : ru);
const labels: Record<IntakeStatus, [string, string]> = {
  available: ["Available", "Доступна"],
  archived: ["Archived", "В архиве"],
  draft: ["Draft", "Черновик"],
  complete: ["Complete", "Заполнена"],
};
export const statusLabel = (s: IntakeStatus, l: Locale) => labels[s][l === "en" ? 0 : 1];
const feedback: Record<string, [string, string]> = {
  design: ["Questionnaire saved to the firm library.", "Анкета сохранена в библиотеке фирмы."],
  archive: [
    "Questionnaire archived. Existing forms keep their questions and answers.",
    "Анкета в архиве. Вопросы и ответы в созданных формах сохранены.",
  ],
  restore: ["Questionnaire restored for new forms.", "Анкета снова доступна для новых форм."],
  draft: ["Draft saved to the selected case.", "Черновик сохранён в выбранном деле."],
  complete: ["Completed form saved to the case.", "Заполненная форма сохранена в деле."],
  reopen: [
    "Form reopened as a draft. The completed version is retained.",
    "Форма снова открыта как черновик. Заполненная версия сохранена.",
  ],
  load: [
    "Intake could not be loaded. Refresh to try again.",
    "Не удалось загрузить формы. Обновите страницу.",
  ],
  changed: [
    "The saved version changed. Review it before editing again.",
    "Сохранённая версия изменилась. Сверьте её перед редактированием.",
  ],
  templateChanged: [
    "This questionnaire changed. Start a new form from the current questionnaire.",
    "Анкета изменилась. Начните форму по её актуальной версии.",
  ],
  caseAccess: [
    "Your access changed. Refresh the list to see available forms.",
    "Ваш доступ изменился. Обновите список доступных форм.",
  ],
  readOnly: ["You have read-only access.", "У вас доступ только для чтения."],
  unconfirmed: [
    "Save not confirmed. Check the original save before continuing.",
    "Сохранение не подтверждено. Проверьте результат перед продолжением.",
  ],
  review: ["Review the open intake editor before leaving.", "Проверьте открытую форму перед выходом."],
  required: [
    "Answer every required question to complete this form.",
    "Чтобы завершить форму, ответьте на все обязательные вопросы.",
  ],
  duplicateQuestion: [
    "Give each question a different label.",
    "У каждого вопроса должно быть своё название.",
  ],
};
export const intakeMessage = (s: string, l: Locale) =>
  (feedback[s] ?? ["Review the fields and try again.", "Проверьте поля и повторите попытку."])[
    l === "en" ? 0 : 1
  ];
