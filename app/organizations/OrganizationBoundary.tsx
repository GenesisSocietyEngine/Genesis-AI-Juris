"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import WorkspaceNavigation from "../WorkspaceNavigation";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { workspaceDestination } from "../workspace-navigation";
import { setOrganizationSelection, type ClientOrganization } from "../organization-client";
import styles from "./organizations.module.css";

/** Mount children only after the server resolves this tab's organization.
 * Full navigation on switch discards every in-flight closure and case cache. */
export default function OrganizationBoundary({ children, signedIn, signInUrl }: { children: ReactNode; signedIn: boolean; signInUrl: string }) {
  const [organizations, setOrganizations] = useState<ClientOrganization[]>([]);
  const [active, setActive] = useState<ClientOrganization | null>(null);
  const [issue, setIssue] = useState(signedIn ? "" : "Sign in to open your organization. / Войдите для доступа к организации.");
  const [locale] = useInterfaceLocale();
  const location = useWorkspaceLocation();
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    const organization = new URL(window.location.href).searchParams.get("organization");
    fetch("/api/organizations" + (organization ? "?organization=" + encodeURIComponent(organization) : ""),
      { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to open your organization. / Войдите для доступа к организации." : "Organizations could not be loaded. Refresh to retry. / Не удалось загрузить организации. Обновите страницу.");
        const data = await response.json() as { organizations: ClientOrganization[]; selected: ClientOrganization | null; selectionIssue: string | null };
        if (controller.signal.aborted) return;
        setOrganizations(data.organizations);
        if (!data.selected || data.selectionIssue || data.selected.status !== "active") {
          setIssue("Choose an active organization to continue. / Выберите активную организацию."); return;
        }
        setOrganizationSelection(data.selected.selection);
        setActive(data.selected);
        const contextUrl = new URL(window.location.href);
        contextUrl.searchParams.set("organization", data.selected.selection);
        window.history.replaceState(window.history.state, "", contextUrl);
        window.dispatchEvent(new Event("genesis-interface-change"));
      }).catch((error: Error) => { if (!controller.signal.aborted) setIssue(error.message); });
    // Browser back-forward caches must revalidate, never reveal a prior tenant.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onPageShow);
    return () => { controller.abort(); window.removeEventListener("pageshow", onPageShow); };
  }, [signedIn]);
  if (!signedIn) return <>
    <WorkspaceNavigation active={location.split("?")[0]}/>
    <main className={styles.accessEmpty}>
      <h1>{t("Your team's case workspace", "Рабочее пространство вашей команды")}</h1>
      <p>{t("Sign in to continue saved cases, review evidence with your team and prepare reports for approval.", "Войдите, чтобы продолжить сохранённые дела, проверить доказательства с командой и подготовить отчёты к утверждению.")}</p>
      <p>{t("Just exploring? Canopy and the playable demos are available without an account.", "Знакомитесь с продуктом? Canopy и игровые демо доступны без аккаунта.")}</p>
      <div className={styles.accessEmptyActions}>
        <a href={signInUrl} target="_top">{t("Sign in to continue", "Войти и продолжить")}</a>
        <a href={workspaceDestination("/studio?view=demos", location)}>{t("Open demo case", "Открыть демо-кейс")}</a>
        <a href={workspaceDestination("/account", location)}>{t("Account options", "Варианты входа")}</a>
      </div>
    </main>
  </>;
  return <>
    <WorkspaceNavigation active={location.split("?")[0]}/>
    <div className={styles.contextBar}>
      <label>{t("Organization", "Организация")} <select aria-label={t("Organization", "Организация")} value={active?.id ?? ""} onChange={(event) => {
        // Immediately remove all private UI before navigating to a new scope.
        setActive(null);
        window.location.replace("/matters?organization=" + encodeURIComponent(event.target.value) + "&lang=" + locale);
      }}><option value="" disabled>{t("Select organization", "Выберите организацию")}</option>{organizations.filter((o) => o.status === "active").map((o) =>
        <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <Link href={workspaceDestination("/organizations", location)}>{t("Manage organizations", "Управление организациями")}</Link>

    <small>{t("Changing organization opens its case list and clears the current case context.", "Смена организации откроет её список дел и сбросит контекст текущего дела.")}</small></div>
    {issue && <p className={styles.issue} role="alert">{issue.includes(" / ") ? issue.split(" / ")[locale === "ru" ? 1 : 0] : issue} <a href={signInUrl} target="_top">{t("Sign in", "Войти")}</a> · <a href={workspaceDestination("/account", location)}>{t("Account", "Аккаунт")}</a></p>}
    {active ? children : !issue ? <p className={styles.loading} role="status">{t("Loading your organization…", "Загрузка организации…")}</p> : null}
  </>;
}
