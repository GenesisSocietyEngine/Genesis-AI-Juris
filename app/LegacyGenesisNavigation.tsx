"use client";

import { pendingSignOutMessage } from "./session-boundary";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { workspaceDestination, workspaceSignInPath } from "./workspace-navigation";
import { useNavigationController, useNavigationSession } from "./NavigationSession";
import { isWorkspaceDepartureClick } from "./departure-click";
import type { DepartureRisk, DeparturePlan } from "./navigation-controller";
import { organizationDisplayLabel } from "./organization-label";

export const WORKSPACE_PAGES = [
  { path: "/studio", view: "studio", en: "Case Studio", ru: "Студия кейсов", icon: "studio" },
  { path: "/matters", view: "matters", en: "My cases", ru: "Мои кейсы", icon: "cases" },
  { path: "/studio?view=demos", view: "demos", en: "Demo", ru: "Демо", icon: "demo" },
  { path: "/templates", view: "templates", en: "Templates", ru: "Шаблоны", icon: "template" },
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
    organization: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2m-6 6h4v4"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/></>,
    account: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    exit: <><path d="M9 3H3v18h6m5-15 6 6-6 6m-5-6h11"/></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.studio}</svg>;
}

export type GenesisNavigationProps = {
  locale: "en" | "ru";
  location: string;
  active: string;
  onNavigate?: (view: string) => void;
  onLanguage: () => void;
  menu?: ReactNode;
  returnTo?: string;
  allowDeparture?: () => boolean;
  newCase?: () => void;
  importCase?: () => void;
  operationsActions?: ReactNode;
};

export default function GenesisNavigation({ locale, location, active, onNavigate, onLanguage, menu, returnTo, allowDeparture, newCase, importCase, operationsActions }: GenesisNavigationProps) {
  const moreRef = useRef<HTMLDetailsElement>(null);
  const organizationRef = useRef<HTMLDetailsElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState<{kind:"organization"|"signout"|"link";id:string;risk:DepartureRisk;authority:number;target:string;plan?:DeparturePlan} | null>(null);
  const navigation = useNavigationController();
  const session = useNavigationSession();
  const en = locale === "en";
  const organizationLabel = session.selected ? organizationDisplayLabel(session.selected, session.organizations, locale) : (en ? "No organization selected" : "Организация не выбрана");
  const href = (path: string) => workspaceDestination(path, location);
  function closeMore() { if (moreRef.current) moreRef.current.open = false; }
  function closeDrawer(focus = false) { drawerRef.current?.close();setDrawerOpen(false);if(focus)menuButton.current?.focus(); }
  useEffect(()=>{const media=window.matchMedia("(max-width: 800px)");const update=()=>{setMobile(media.matches);setDrawerOpen(false);};update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  useEffect(()=>{if(pending)confirmRef.current?.showModal();else confirmRef.current?.close();},[pending]);
  function cancelPending() { pending?.plan?.cancel?.(); setPending(null); }
  async function depart(kind:"organization"|"signout"|"link",id="",discard=false,target="",plan?:DeparturePlan) {
    if(plan&&!plan.current()){plan.cancel?.();setPending(null);return;}
    if(kind==="signout"){setPending(null);closeDrawer();await navigation.signOut(locale);return;}
    if(allowDeparture&&!allowDeparture()){plan?.cancel?.();setPending(null);return;}
    const risk=kind==="organization"?await navigation.select(id,locale,discard,plan):navigation.risk();
    if(risk!=="clear"&&!(risk==="dirty"&&discard)){setPending({kind,id,risk,authority:navigation.authorityVersion,target,plan});return;}
    setPending(null);
    if(kind==="link"){if(plan&&(!plan.current()||!plan.commit())){plan.cancel?.();return;}navigation.approvePageDeparture();closeDrawer();if(plan?.navigate)plan.navigate();else if(target==="_top"||target==="_parent")window.open(id,target);else window.location.assign(id);}
  }
  useEffect(()=>navigation.registerDeparture((kind,id,plan)=>{void depart(kind,id,false,plan?.target??"",plan);}),[navigation,locale,allowDeparture]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>navigation.subscribe(()=>setPending(current=>{if(current&&(current.authority!==navigation.authorityVersion||current.plan&&!current.plan.current())){current.plan?.cancel?.();return null;}return current;})),[navigation]);
  function guardedLink(event:MouseEvent<HTMLAnchorElement>) {
    if(!isWorkspaceDepartureClick(event,event.currentTarget,window.location.href))return;
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    if(allowDeparture&&!allowDeparture()){event.preventDefault();return;}
    if(navigation.risk()!=="clear"){event.preventDefault();navigation.requestDeparture("link",event.currentTarget.href);return;}
    closeDrawer();
  }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target)) closeMore();
      if(event.target instanceof Node&&!organizationRef.current?.contains(event.target)&&organizationRef.current)organizationRef.current.open=false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const expanded=organizationRef.current?.open?organizationRef.current:moreRef.current?.open?moreRef.current:null;
      if(expanded){event.preventDefault();expanded.open=false;expanded.querySelector("summary")?.focus();}
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  function follow(event: MouseEvent<HTMLAnchorElement>, view: string) {
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    if (!onNavigate || view === "matters") { guardedLink(event);return; }
    if(event.defaultPrevented)return;
    if(allowDeparture&&!allowDeparture()){event.preventDefault();return;}
    if(navigation.risk()!=="clear"){event.preventDefault();navigation.requestDeparture("link",event.currentTarget.href);return;}
    event.preventDefault(); closeDrawer();onNavigate(view);
    requestAnimationFrame(()=>{const main=document.querySelector<HTMLElement>("main h1, main");if(main){main.tabIndex=-1;main.focus();}});
  }
  function studioAction(action: () => void) {
    if(allowDeparture&&!allowDeparture())return;
    action();closeDrawer();
  }
  const contents=<>
    <span className="genesis-nav-label">{en ? "Workspace" : "Рабочее пространство"}</span>
    <nav className="genesis-nav-pages" aria-label={en ? "Workspace navigation" : "Навигация по рабочему пространству"}>
      {WORKSPACE_PAGES.map(item => {
        const selected = active === item.view || active === item.path || ((active === "/canopy" || active === "library") && item.view === "demos") || (active === "community" && item.view === "matters");
        return <details className="genesis-nav-group" key={`${item.view}-${selected}`} open={selected}>
          <summary><WorkspaceIcon name={item.icon}/><span>{en ? item.en : item.ru}</span><span className="nav-chevron" aria-hidden="true">⌄</span></summary>
          <div className="genesis-nav-children">
            <a href={href(item.path)} aria-current={selected && active !== "community" ? "page" : undefined} onClick={event => follow(event,item.view)}>{en ? (item.view === "templates" ? "Choose a template" : item.view === "demos" ? "Browse demo cases" : `Open ${item.en}`) : (item.view === "templates" ? "Выбрать шаблон" : item.view === "demos" ? "Каталог демо-кейсов" : `Открыть: ${item.ru}`)}</a>
            {item.view === "studio" && <>{newCase && <button type="button" onClick={() => studioAction(newCase)}>{en ? "New blank case" : "Новый пустой кейс"}</button>}{importCase && <button type="button" onClick={() => studioAction(importCase)}>{en ? "Import case or prompt" : "Импорт кейса или промпта"}</button>}</>}
            {item.view === "matters" && <a href={href("/studio?view=community")} aria-current={active === "community" ? "page" : undefined} onClick={event => follow(event,"community")}>{en ? "Saved Studio drafts" : "Черновики Studio"}</a>}
            {item.view === "play" && operationsActions}
          </div>
        </details>;
      })}
    </nav>
    <div className="genesis-nav-lower">
      {session.phase==="ready"&&session.identity&&<nav className="genesis-nav-organization" aria-label={en?"Organization controls":"Организация"}>
        <details ref={organizationRef} className="genesis-organization-picker">
          <summary><WorkspaceIcon name="organization"/><span><small>{en?"Organization":"Организация"}</small><b title={organizationLabel}>{session.selected?.name??organizationLabel}</b>{session.selected&&<small>{organizationLabel.slice(session.selected.name.length+3)}</small>}</span><span aria-hidden="true">⌄</span></summary>
          <div className="genesis-organization-options">
            <p>{en?"Switching organization opens its case list.":"Смена организации открывает её список дел."}</p>
            {session.organizations.map(o=><button type="button" key={o.id} disabled={session.busy} aria-current={session.selected?.id===o.id?"true":undefined} onClick={()=>void depart("organization",o.id)}>{organizationDisplayLabel(o,session.organizations,locale)}{session.selected?.id===o.id&&<small>{en?"Current":"Текущая"}</small>}</button>)}
            {!session.organizations.length&&<p>{en?"No active memberships.":"Нет активного членства."}</p>}
          </div>
        </details>
        <a href={href("/organizations")} onClick={guardedLink} aria-current={active==="/organizations"?"page":undefined}><WorkspaceIcon name="organization"/>{en?"Manage organizations":"Управление организациями"}</a>
        {session.selected?.role==="org_owner"&&<a href={href("/organizations?organization="+encodeURIComponent(session.selected.selection)+"#organization-users")} onClick={guardedLink}><WorkspaceIcon name="people"/>{en?"Users & access":"Участники и доступ"}</a>}
      </nav>}
      <div className="genesis-nav-footer">
        {returnTo&&<a className="genesis-return" href={returnTo} onClick={guardedLink}>{en?"Return to your case":"Вернуться к делу"}</a>}
        <details className="genesis-nav-group" key={`help-${active === "help" || active === "/help/studio-demo"}`} open={active === "help" || active === "/help/studio-demo"}>
          <summary><WorkspaceIcon name="help"/><span>{en ? "Help & training" : "Помощь и обучение"}</span><span className="nav-chevron" aria-hidden="true">⌄</span></summary>
          <div className="genesis-nav-children"><a href={href("/studio?view=help")} onClick={event=>follow(event,"help")} aria-current={active === "help" ? "page" : undefined}>{en ? "Help & guides" : "Инструкции"}</a><a href={href("/help/studio-demo")} target="_blank" rel="noreferrer" aria-current={active === "/help/studio-demo" ? "page" : undefined}>{en ? "Earlier training · 10 min ↗" : "Ранняя запись · 10 минут ↗"}</a></div>
        </details>
        {session.phase==="ready"&&session.identity?<>
          <a href={href("/account")} onClick={guardedLink} aria-current={active==="/account"?"page":undefined}><WorkspaceIcon name="account"/><span>{en?"Account":"Аккаунт"}<small className="genesis-account-name">{session.identity.displayName}</small></span></a>
          <button type="button" className="genesis-nav-action" onClick={()=>void depart("signout")}><WorkspaceIcon name="exit"/>{en?"Sign out":"Выйти"}</button>
        </>:session.phase!=="leaving"&&!session.endingSession&&<a href={workspaceSignInPath(location)} target="_top" onClick={guardedLink}><WorkspaceIcon name="account"/>{en?"Sign in":"Войти"}</a>}
        {session.phase!=="ready"&&!session.endingSession&&navigation.canSignOut&&<button type="button" className="genesis-nav-action" onClick={()=>void depart("signout")}>{en?"Sign out":"Выйти"}</button>}
        {session.issue&&<div className="genesis-nav-issue" role="alert"><p id="navigation-access-status">{session.signOutPending ? pendingSignOutMessage(en ? "en" : "ru") : en?session.issue:"Не удалось проверить доступ. Обновите данные или повторите действие."}</p><button type="button" disabled={session.busy || session.signOutPending} aria-describedby="navigation-access-status" onClick={()=>void navigation.refresh(new URL(location,"https://workspace.invalid").searchParams.get("organization")??undefined)} hidden={session.endingSession}>{en?"Refresh access":"Обновить доступ"}</button>{navigation.canRetrySignOut&&<button type="button" disabled={session.busy} onClick={()=>void depart("signout")}>{en?"Retry sign out":"Повторить выход"}</button>}</div>}
        <div className="genesis-nav-utilities">
          <button type="button" onClick={onLanguage} aria-label={en?"Switch language":"Сменить язык"}>{locale.toUpperCase()}</button>
          <details ref={moreRef} className="genesis-nav-more"><summary>{en?"More":"Ещё"}<span aria-hidden="true">⌄</span></summary>
            <div className="genesis-nav-menu" onClick={closeMore}><a href={href("/?view=community")} onClick={guardedLink}>{en?"Community & reviews":"Сообщество и рецензии"}</a>{menu}</div>
          </details>
        </div>
      </div>
    </div>
  </>;
  return <><header className="genesis-navigation">
    <a className="genesis-brand" href={href("/studio")} onClick={(event) => follow(event, "studio")} aria-label="CaseVant — Case Studio">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/casevant-mark.png" alt="" width="48" height="52"/>
      <span><b>CaseVant</b><small>by Falcon-Merlin Group</small></span>
    </a>
    {mobile?<><button type="button" className="genesis-menu-toggle" ref={menuButton} aria-label={en?"Open navigation":"Открыть навигацию"} aria-expanded={drawerOpen} aria-controls="genesis-navigation-drawer" onClick={()=>{drawerRef.current?.showModal();setDrawerOpen(true);}}>{en?"Menu":"Меню"}</button><dialog id="genesis-navigation-drawer" className="genesis-navigation-drawer" ref={drawerRef} aria-label={en?"Workspace menu":"Меню рабочего пространства"} onClose={()=>setDrawerOpen(false)} onClick={event=>{if(event.target===event.currentTarget)closeDrawer(true);}}><div className="genesis-drawer-inner"><button type="button" className="genesis-drawer-close" onClick={()=>closeDrawer(true)}>{en?"Close menu":"Закрыть меню"}</button>{contents}</div></dialog></>:<div className="genesis-nav-body">{contents}</div>}
  </header>
  <dialog className="genesis-navigation-confirm" ref={confirmRef} onCancel={cancelPending} aria-labelledby="navigation-confirm-title">
    <h2 id="navigation-confirm-title">{pending?.risk==="pending"?(en?"Check the pending save first":"Сначала проверьте сохранение"):(en?"Leave unsaved changes?":"Покинуть несохранённые изменения?")}</h2>
    <p>{pending?.risk==="pending"?(en?"A save could not be confirmed. Check the pending action before switching. You can always sign out; signing out closes this recovery view. Check the record before trying again.":"Сохранение не подтверждено. Перед переключением проверьте текущее действие. Вы можете выйти; выход закроет это окно восстановления. Проверьте запись перед повторной попыткой."):(en?"Your unsaved input will be discarded. Stay here to save your work or use an available export first. Saved workspace work remains available to your authorized account.":"Несохранённый ввод будет удалён. Останьтесь, чтобы сохранить работу или сначала выполнить доступный экспорт. Сохранённая работа останется доступна авторизованному аккаунту.")}</p>
    <div><button type="button" onClick={cancelPending} autoFocus>{en?"Stay here":"Остаться"}</button>{pending?.risk==="pending"?<button type="button" onClick={()=>{cancelPending();closeDrawer();navigation.reviewPending();}}>{en?"Return to current work":"Вернуться к работе"}</button>:<button type="button" onClick={()=>{if(pending&&pending.authority===navigation.authorityVersion)void depart(pending.kind,pending.id,true,pending.target,pending.plan);else setPending(null);}}>{en?"Discard and continue":"Отменить изменения и продолжить"}</button>}{pending?.risk==="pending"&&navigation.canSignOut&&<button type="button" onClick={()=>void depart("signout")}>{en?"Sign out now":"Выйти сейчас"}</button>}</div>
  </dialog></>;
}
