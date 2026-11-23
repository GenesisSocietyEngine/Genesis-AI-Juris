export const WORK_VIEWS = [
  { id: "home", en: "Home", ru: "Главная", icon: "home" },
  { id: "tasks", en: "Tasks", ru: "Задачи", icon: "tasks" },
  { id: "calendar", en: "Calendar", ru: "Календарь", icon: "calendar" },
  { id: "messages", en: "Messages", ru: "Сообщения", icon: "people" },
  { id: "reminders", en: "Reminders", ru: "Напоминания", icon: "reminder" },
  { id: "templates", en: "Workflow templates", ru: "Шаблоны процессов", icon: "template" },
  { id: "people", en: "Contacts", ru: "Контакты", icon: "people" },
  { id: "workflows", en: "Workflows", ru: "Процессы", icon: "flow" },
  { id: "progress", en: "Case register", ru: "Реестр дел", icon: "cases" },
  { id: "cases", en: "Case overview", ru: "Обзор дел", icon: "cases" },
  { id: "studio", en: "AI Studio", ru: "ИИ Студия", icon: "studio" },
  { id: "library", en: "Library", ru: "Библиотека", icon: "document" },
] as const;

export type WorkView = typeof WORK_VIEWS[number]["id"];
