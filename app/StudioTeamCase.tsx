"use client";
import { useAuthorizedCaseName } from "./use-authorized-case-name";
import { WorkspaceIcon } from "./CaseVantIcon";
import { useNavigationController, useNavigationSession } from "./NavigationSession";
import type { selectedTeamCase } from "./workspace-navigation";
import styles from "./studio-team-case.module.css";

type Context = NonNullable<ReturnType<typeof selectedTeamCase>>;
type Locale = "en" | "ru";

function CaseName({ id, selection, locale }: { id: string; selection: string; locale: Locale }) {
  const name = useAuthorizedCaseName(id, selection);
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
