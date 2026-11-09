"use client";
import { useEffect, useState } from "react";
import { WorkspaceIcon } from "./CaseVantIcon";
import { useNavigationController, useNavigationSession } from "./NavigationSession";
import { readWithTimeout } from "./read-with-timeout";
import type { selectedTeamCase } from "./workspace-navigation";
import styles from "./studio-team-case.module.css";

type Context = NonNullable<ReturnType<typeof selectedTeamCase>>;
type Locale = "en" | "ru";

function CaseName({ id, selection, locale }: { id: string; selection: string; locale: Locale }) {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active: AbortController | undefined;
    const suspend = () => { active?.abort(); setName(undefined); };
    const read = () => {
      active?.abort();
      if (document.hidden) { setName(undefined); return; }
      const visit = new AbortController();
      active = visit;
      void readWithTimeout(async signal => {
        const response = await fetch("/api/dossiers/" + encodeURIComponent(id) + "?view=identity", {
          credentials: "same-origin", cache: "no-store", headers: { "x-genesis-organization": selection }, signal,
        });
        if (!response.ok) return null;
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("id" in result) || !("title" in result)) return null;
        return result.id === id && typeof result.title === "string" && result.title.trim() ? result.title : null;
      }, { signal: visit.signal }).then(
        title => { if (!visit.signal.aborted) setName(title); },
        () => { if (!visit.signal.aborted) setName(null); },
      );
    };
    read();
    window.addEventListener("focus", read);
    window.addEventListener("pageshow", read);
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", read);
    return () => {
      active?.abort();
      window.removeEventListener("focus", read);
      window.removeEventListener("pageshow", read);
      window.removeEventListener("pagehide", suspend);
      document.removeEventListener("visibilitychange", read);
    };
  }, [id, selection]);
  return <>{name ?? (name === undefined
    ? (locale === "en" ? "Loading case name…" : "Загрузка названия дела…")
    : (locale === "en" ? "Case name unavailable" : "Название дела недоступно"))}</>;
}

/** Team identity is read only, scoped to the current visit, and never part of a Studio save. */
export default function StudioTeamCase({ context, locale }: { context: Context; locale: Locale }) {
  const session = useNavigationSession(), navigation = useNavigationController();
  const selection = session.selected?.selection;
  const allowed = session.phase === "ready" && !session.busy && !session.endingSession && session.actorId && selection
    && (!context.organization || context.organization === selection);
  const en = locale === "en";
  return <aside className={styles.case} aria-label={en ? "Current team case" : "Текущее дело команды"}>
    <span className={styles.icon}><WorkspaceIcon name="cases"/></span>
    <div><span>{en ? "Team case" : "Дело команды"}</span>
      <strong aria-live="polite">{allowed && selection
        ? <CaseName key={JSON.stringify([context.id, selection, session.actorId, navigation.authorityVersion])} id={context.id} selection={selection} locale={locale}/>
        : session.phase === "checking" ? (en ? "Checking access…" : "Проверка доступа…") : (en ? "Case name unavailable" : "Название дела недоступно")}</strong>
    </div>
  </aside>;
}
