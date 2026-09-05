"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { setOrganizationSelection, type ClientOrganization } from "../organization-client";
import styles from "./organizations.module.css";

/** Mount children only after the server resolves this tab's organization.
 * Full navigation on switch discards every in-flight closure and case cache. */
export default function OrganizationBoundary({ children, signedIn, signInUrl }: { children: ReactNode; signedIn: boolean; signInUrl: string }) {
  const [organizations, setOrganizations] = useState<ClientOrganization[]>([]);
  const [active, setActive] = useState<ClientOrganization | null>(null);
  const [issue, setIssue] = useState(signedIn ? "" : "Sign in to open your organization. / Войдите для доступа к организации.");
  const [locale, setLocale] = useState("en");
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
      }).catch((error: Error) => { if (!controller.signal.aborted) setIssue(error.message); });
    // Browser back-forward caches must revalidate, never reveal a prior tenant.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onPageShow);
    return () => { controller.abort(); window.removeEventListener("pageshow", onPageShow); };
  }, [signedIn]);
  return <>
    <div className={styles.contextBar}>
      <label>{t("Organization", "Организация")} <select aria-label={t("Organization", "Организация")} value={active?.id ?? ""} onChange={(event) => {
        // Immediately remove all private UI before navigating to a new scope.
        setActive(null);
        window.location.replace("/matters?organization=" + encodeURIComponent(event.target.value));
      }}><option value="" disabled>{t("Select organization", "Выберите организацию")}</option>{organizations.filter((o) => o.status === "active").map((o) =>
        <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <Link href={"/organizations" + (active ? "?organization=" + encodeURIComponent(active.id) : "")}>{t("Manage organizations", "Управление организациями")}</Link>
      <label>{t("Language", "Язык")} <select value={locale} onChange={(event) => setLocale(event.target.value)}><option value="en">English</option><option value="ru">Русский</option></select></label>
    </div>
    {issue && <p className={styles.issue} role="alert">{issue} <a href={signInUrl} target="_top">{t("Sign in", "Войти")}</a> · <Link href="/account">{t("Account", "Аккаунт")}</Link></p>}
    {active ? children : !issue ? <p className={styles.loading} role="status">{t("Loading your organization…", "Загрузка организации…")}</p> : null}
  </>;
}
