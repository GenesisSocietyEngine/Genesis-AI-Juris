"use client";

import { useEffect, useState, type ReactNode } from "react";
import WorkspaceNavigation from "../WorkspaceNavigation";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { workspaceDestination } from "../workspace-navigation";
import { setOrganizationSelection, type ClientOrganization } from "../organization-client";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import styles from "./organizations.module.css";
import { OrganizationContext } from "./organization-context";

/** The verified shell owns organization state. Retain the mounted B1 owner on
 * expiry so its original operation can recover; that owner gates private DOM. */
export default function OrganizationBoundary({ children, signedIn, signInUrl }: { children: ReactNode; signedIn: boolean; signInUrl: string }) {
  const navigation = useNavigationController();
  const session = useNavigationSession();
  const [retained,setRetained] = useState<ClientOrganization | null>(null);
  if (session.phase === "ready" && session.selected && retained !== session.selected) setRetained(session.selected);
  const [locale] = useInterfaceLocale();
  const location = useWorkspaceLocation();
  const recovering = location.split("?")[0] === "/matters" && session.phase !== "ready";
  const active = session.selected ?? (recovering ? retained : null);
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  useEffect(() => {
    if (session.phase !== "ready" || !session.selected) return;
    setOrganizationSelection(session.selected.selection);
    const url = new URL(window.location.href);
    if (url.searchParams.get("organization") !== session.selected.selection) {
      url.searchParams.set("organization",session.selected.selection);
      window.history.replaceState(window.history.state,"",url);
      window.dispatchEvent(new Event("genesis-interface-change"));
    }
  }, [session.phase, session.selected]);
  const anonymous = session.phase === "anonymous" || session.phase === "checking" && !signedIn;
  return <>
    <WorkspaceNavigation active={location.split("?")[0]}/>
    {anonymous ? <main className={styles.accessEmpty}>
      <h1>{t("Your team's case workspace", "Рабочее пространство вашей команды")}</h1>
      <p>{t("Sign in to continue saved cases, review evidence with your team and prepare reports for approval.", "Войдите, чтобы продолжить сохранённые дела, проверить доказательства с командой и подготовить отчёты к утверждению.")}</p>
      <p>{t("Just exploring? The demo cases are available without an account.", "Знакомитесь с продуктом? Демо-кейсы доступны без аккаунта.")}</p>
      <div className={styles.accessEmptyActions}>
        <a href={signInUrl} target="_top">{t("Sign in to continue", "Войти и продолжить")}</a>
        <a href={workspaceDestination("/studio?view=demos", location)}>{t("Open demo case", "Открыть демо-кейс")}</a>
        <a href={workspaceDestination("/account", location)}>{t("Account options", "Варианты входа")}</a>
      </div>
    </main> : !active && <main className={styles.accessEmpty}>
      <h1>{t("Your workspace", "Ваше рабочее пространство")}</h1>
      <p role="status">{session.phase === "checking" ? t("Checking your access…", "Проверяем доступ…") : session.profileRequired ? t("Complete your profile to open saved work.", "Заполните профиль для доступа к сохранённым делам.") : t("Choose an available organization in the sidebar, or refresh your access.", "Выберите доступную организацию в боковом меню или обновите доступ.")}</p>
      <button type="button" onClick={()=>void navigation.refresh(new URL(location,"https://workspace.invalid").searchParams.get("organization")??undefined)}>{t("Refresh access", "Обновить доступ")}</button>
    </main>}
    {active && (session.phase === "ready" || location.split("?")[0] === "/matters") && <OrganizationContext.Provider key={active.selection} value={active}>{children}</OrganizationContext.Provider>}
  </>;
}
