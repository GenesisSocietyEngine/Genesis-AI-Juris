"use client";

import { useInterfaceLocale, useWorkspaceLocation } from "./use-interface-locale";
import { safeWorkspaceReturn, workspaceDestination } from "./workspace-navigation";

export default function WorkspaceNavigation({ active }: { active: string }) {
  const [locale, setLocale] = useInterfaceLocale();
  const location = useWorkspaceLocation();
  const returnTo = safeWorkspaceReturn(new URL(location, "https://workspace.invalid").searchParams.get("return_to"), "");
  const items = [["/matters", "My cases", "Мои дела"], ["/studio", "Studio", "Студия"], ["/templates", "Templates", "Шаблоны"], ["/canopy", "Canopy", "Canopy"], ["/organizations", "Organizations", "Организации"], ["/account", "Account", "Аккаунт"]];
  return <nav className="workspace-navigation" aria-label={locale === "en" ? "Workspace navigation" : "Навигация по рабочему пространству"}>
    <a className="workspace-navigation-brand" href={workspaceDestination("/studio", location)}>GENESIS: JURIS</a>
    <div>{items.map(([path, en, ru]) => <a key={path} href={workspaceDestination(path, location)} aria-current={active === path ? "page" : undefined}>{locale === "en" ? en : ru}</a>)}</div>
    <label><span className="visually-hidden">{locale === "en" ? "Language" : "Язык"}</span><select value={locale} onChange={event => setLocale(event.target.value as "en" | "ru")}><option value="en">English</option><option value="ru">Русский</option></select></label>
    {returnTo && <a className="workspace-return" href={returnTo}>{locale === "en" ? "Return to your case" : "Вернуться к делу"}</a>}
  </nav>;
}
