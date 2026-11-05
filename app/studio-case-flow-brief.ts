import { STUDIO_PROMPT_CHARACTER_LIMIT } from "./studio-prompt-limit";

const titles = { en: "## Case-flow brief", ru: "## План логики дела" } as const;
export function appendCaseFlowOutline(prompt: string, locale: "en" | "ru") {
  if (Object.values(titles).some(title => prompt.split(/\r?\n/).some(line => line.trim() === title))) {
    return { status: "already_present" as const, prompt };
  }
  const sections = locale === "en" ? [
    "### Objective and desired outcome",
    "### Jurisdiction and parties / roles",
    "### Known facts and disputed issues",
    "### Evidence references (document, version and passage)",
    "### Known dates and their basis",
    "### Decisions, alternatives and conditions",
    "### Missing information and assumptions to verify",
  ] : [
    "### Цель и желаемый результат",
    "### Юрисдикция, стороны и их роли",
    "### Известные факты и спорные вопросы",
    "### Ссылки на доказательства (документ, версия, фрагмент)",
    "### Известные даты и их основания",
    "### Решения, альтернативы и условия",
    "### Недостающая информация и допущения для проверки",
  ];
  const outline = `${titles[locale]}\n\n${sections.join("\n\n")}\n`;
  const next = `${prompt}${prompt ? "\n\n" : ""}${outline}`;
  return next.length > STUDIO_PROMPT_CHARACTER_LIMIT
    ? { status: "too_long" as const, prompt }
    : { status: "ready" as const, prompt: next };
}
