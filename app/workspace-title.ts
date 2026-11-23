import { WORK_VIEWS } from "./work/work-views";
import type { InterfaceLocale } from "./use-interface-locale";

const titles: Record<string, readonly [string, string]> = {
  "/matters": ["My cases", "Мои дела"], "/studio": ["AI Studio", "ИИ Студия"],
  "/billing": ["Billing", "Счета"], "/reports": ["Reports", "Отчёты"],
  "/library": ["Library", "Библиотека"], "/portal": ["Client portal", "Клиентский портал"],
  "/organizations": ["Organizations", "Организации"], "/invitations": ["Accept invitation", "Принять приглашение"],
  "/account": ["Account", "Аккаунт"], "/templates": ["Templates", "Шаблоны"],
};

/** Public route labels only: never copy authored names, IDs or access tokens into the tab. */
export function workspaceTitle(location: string, locale: InterfaceLocale): string | null {
  const url = new URL(location, "https://workspace.invalid");
  if (url.pathname === "/work") {
    const view = WORK_VIEWS.find(item => item.id !== "studio" && item.id !== "library" && item.id === url.searchParams.get("view")) ?? WORK_VIEWS[0];
    return `${view[locale]} · CaseVant`;
  }
  const label = titles[url.pathname];
  return label ? `${label[locale === "ru" ? 1 : 0]} · CaseVant` : null;
}
