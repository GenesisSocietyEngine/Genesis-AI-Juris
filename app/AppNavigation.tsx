"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import type { AppView } from "./studio-entry";
import { workspaceDestination } from "./workspace-navigation";

export default function AppNavigation({ locale, view, studioOnly, workspaceLocation, navigate, openOperations, restoreSession, exportSession, hasActiveScenario, toggleLocale, toggleTheme, dark }: {
  locale: "en" | "ru";
  view: AppView;
  studioOnly: boolean;
  workspaceLocation: string;
  navigate: (view: AppView) => void;
  openOperations: () => void;
  restoreSession: () => void;
  exportSession: () => void;
  hasActiveScenario: boolean;
  toggleLocale: () => void;
  toggleTheme: () => void;
  dark: boolean;
}) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  const en = locale === "en";
  const destination = (path: string) => workspaceDestination(path, workspaceLocation);
  const href = (next: AppView) => destination(`${studioOnly ? "/studio" : "/"}?view=${next}`);
  function follow(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    action();
  }
  function closeMore() { if (moreRef.current) moreRef.current.open = false; }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target)) closeMore();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !moreRef.current?.open) return;
      closeMore();
      moreRef.current.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  const primary: { view: AppView; label: string }[] = [
    { view: "studio", label: en ? "Case Studio" : "Студия кейсов" },
    { view: "play", label: en ? "Operations" : "Операции" },
    { view: "demos", label: en ? "Demo cases" : "Демо-кейсы" },
    { view: "library", label: en ? "Templates" : "Шаблоны" },
  ];
  return <header className="topbar app-navigation">
    <a className="brand" href={destination("/studio")} onClick={(event) => follow(event, () => navigate("studio"))} aria-label={en ? "GENESIS: JURIS — Case Studio" : "GENESIS: JURIS — Студия кейсов"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-mark" src="/brand/genesis-juris-codex-mark.svg" alt="" />
      <span><b>GENESIS: JURIS</b><small>CASE STUDIO</small></span>
    </a>
    <nav className="main-nav" aria-label={en ? "Primary navigation" : "Основная навигация"}>
      {primary.map((item) => <a key={item.view} href={href(item.view)} className={view === item.view ? "active" : ""} aria-current={view === item.view ? "page" : undefined} onClick={(event) => follow(event, () => item.view === "play" ? openOperations() : navigate(item.view))}>{item.label}</a>)}
      <a href={destination("/matters")}>{en ? "My cases" : "Мои дела"}</a>
    </nav>
    <div className="top-actions">
      <button type="button" className="utility-button language-switch" onClick={toggleLocale} aria-label={en ? "Switch language" : "Сменить язык"}>{locale.toUpperCase()}</button>
      <details className="app-more" ref={moreRef}>
        <summary>{en ? "More" : "Ещё"}<span aria-hidden="true">⌄</span></summary>
        <div className="app-more-menu" onClick={closeMore}>
          <a href={destination("/account")}>{en ? "Account" : "Аккаунт"}</a>
          <a href={destination("/organizations")}>{en ? "Organizations" : "Организации"}</a>
          <a href={destination("/?view=community")}>{en ? "Community workspace" : "Рабочее пространство сообщества"}</a>
          <a href={href("help")} onClick={(event) => follow(event, () => navigate("help"))}>{en ? "Help" : "Помощь"}</a>
          <a href="/help/studio-demo" target="_blank" rel="noreferrer">{en ? "Studio video · 3 min" : "Видео о Студии · 3 мин"}</a>
          <hr />
          <button type="button" onClick={restoreSession}>{en ? "Restore a play session" : "Восстановить прохождение"}</button>
          {hasActiveScenario && <button type="button" onClick={exportSession}>{en ? "Export play session" : "Экспорт прохождения"}</button>}
          <button type="button" onClick={toggleTheme}>{dark ? (en ? "Use light theme" : "Светлая тема") : (en ? "Use dark theme" : "Тёмная тема")}</button>
          {studioOnly && <><hr /><a href={destination("/studio")} target="_blank" rel="noreferrer">{en ? "Open in a new tab" : "Открыть в новой вкладке"}</a><a href="https://www.falcon-merlin.com/" target="_top">Falcon-Merlin.com</a></>}
        </div>
      </details>
    </div>
  </header>;
}
