"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { workspaceDestination } from "./workspace-navigation";

export const WORKSPACE_PAGES = [
  { path: "/studio", view: "studio", en: "Case Studio", ru: "Студия кейсов", icon: "studio" },
  { path: "/matters", view: "matters", en: "My cases", ru: "Мои дела", icon: "cases" },
  { path: "/studio?view=demos", view: "demos", en: "Demo", ru: "Демо", icon: "demo" },
  { path: "/templates", view: "library", en: "Templates", ru: "Шаблоны", icon: "template" },
  { path: "/studio?view=play", view: "play", en: "Operations", ru: "Операции", icon: "tasks" },
] as const;

export function WorkspaceIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    studio: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    cases: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>,
    demo: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/></>,
    template: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    tasks: <><path d="m3 6 2 2 4-4m3 2h9M3 13l2 2 4-4m3 2h9M5 20h16"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.1"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.studio}</svg>;
}

export default function LegacyGenesisNavigation({ locale, location, active, onNavigate, onLanguage, menu, returnTo }: {
  locale: "en" | "ru";
  location: string;
  active: string;
  onNavigate?: (view: string) => void;
  onLanguage: () => void;
  menu?: ReactNode;
  returnTo?: string;
}) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  const en = locale === "en";
  const href = (path: string) => workspaceDestination(path, location);
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
  function follow(event: MouseEvent<HTMLAnchorElement>, view: string) {
    if (!onNavigate || view === "matters" || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(view);
  }
  return <header className="genesis-navigation">
    <a className="genesis-brand" href={href("/studio")} onClick={(event) => follow(event, "studio")} aria-label="GENESIS: JURIS — Case Studio">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/genesis-juris-codex-mark.svg" alt="" width="34" height="34"/>
      <span><b>GENESIS: JURIS</b><small>{en ? "Decision workspace" : "Пространство решений"}</small></span>
    </a>
    <span className="genesis-nav-label">{en ? "Workspace" : "Рабочее пространство"}</span>
    <nav className="genesis-nav-pages" aria-label={en ? "Workspace navigation" : "Навигация по рабочему пространству"}>
      {WORKSPACE_PAGES.map(item => <a key={item.view} href={href(item.path)} aria-current={(active === item.view || active === item.path || (active === "/canopy" && item.view === "demos")) ? "page" : undefined} onClick={event => follow(event,item.view)}><WorkspaceIcon name={item.icon}/><span>{en ? item.en : item.ru}</span></a>)}
    </nav>
    <div className="genesis-nav-footer">
      {returnTo && <a className="genesis-return" href={returnTo}>{en ? "Return to your case" : "Вернуться к делу"}</a>}
      <a href={href("/studio?view=help")} onClick={event => follow(event,"help")} aria-current={active === "help" ? "page" : undefined}><WorkspaceIcon name="help"/>{en ? "Help & guides" : "Помощь"}</a>
      <div className="genesis-nav-utilities">
        <button type="button" onClick={onLanguage} aria-label={en ? "Switch language" : "Сменить язык"}>{locale.toUpperCase()}</button>
        <details ref={moreRef} className="genesis-nav-more">
          <summary>{en ? "More" : "Ещё"}<span aria-hidden="true">⌄</span></summary>
          <div className="genesis-nav-menu" onClick={closeMore}>
            <a href={href("/account")} aria-current={active === "/account" ? "page" : undefined}>{en ? "Account" : "Аккаунт"}</a>
            <a href={href("/organizations")} aria-current={active === "/organizations" ? "page" : undefined}>{en ? "Administration" : "Администрирование"}</a>
            <a href={href("/?view=community")}>{en ? "Community & reviews" : "Сообщество и рецензии"}</a>
            <a className="genesis-mobile-help" href={href("/studio?view=help")} onClick={event => follow(event,"help")}>{en ? "Help & guides" : "Помощь"}</a>
            {menu}
          </div>
        </details>
      </div>
    </div>
  </header>;
}
