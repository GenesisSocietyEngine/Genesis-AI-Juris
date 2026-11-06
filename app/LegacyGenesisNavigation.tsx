"use client";

import { WorkspaceIcon } from "./CaseVantIcon";
import { useStudioActionsNavigation } from "./StudioActionsNavigation";
import { pendingSignOutMessage } from "./session-boundary";

import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { workspaceDestination, workspaceSignInPath, resumeWorkspaceDestination } from "./workspace-navigation";
import { useNavigationController, useNavigationSession } from "./NavigationSession";
import { isWorkspaceDepartureClick } from "./departure-click";
import type { DepartureRisk, DeparturePlan, DepartureChange } from "./navigation-controller";
import { organizationDisplayLabel } from "./organization-label";
import { departureChangeLabel } from "./departure-presentation";

export const WORKSPACE_PAGES = [
  { path: "/work?view=home", view: "home", en: "Home", ru: "Главная", icon: "home" },
  { path: "/work?view=calendar", view: "calendar", en: "Calendar", ru: "Календарь", icon: "calendar" },
  { path: "/work?view=tasks", view: "tasks", en: "Tasks", ru: "Задачи", icon: "tasks" },
  { path: "/matters", view: "matters", en: "Cases", ru: "Дела", icon: "cases" },
  { path: "/studio?studio_panel=workbench", view: "studio", en: "AI Studio", ru: "ИИ Студия", icon: "studio" },
  { path: "/work?view=people", view: "people", en: "People", ru: "Участники", icon: "people" },
  { path: "/work?view=workflows", view: "workflows", en: "Workflows", ru: "Процессы", icon: "flow" },
] as const;
const SECONDARY_PAGES = [
  {path:"/studio?view=community",view:"community",en:"Saved Studio drafts",ru:"Черновики Studio",icon:"document"},
  {path:"/studio?view=demos",view:"demos",en:"Demo",ru:"Демо",icon:"demo"},
  {path:"/templates",view:"templates",en:"Templates",ru:"Шаблоны",icon:"template"},
  {path:"/studio?view=play",view:"play",en:"Simulations",ru:"Симуляции",icon:"tasks"},
] as const;

export { WorkspaceIcon } from "./CaseVantIcon";

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

export default function GenesisNavigation({ locale, location, active, onNavigate, onLanguage, menu, returnTo, allowDeparture, operationsActions }: GenesisNavigationProps) {
  const { setTarget } = useStudioActionsNavigation();
  const moreRef = useRef<HTMLDetailsElement>(null);
  const organizationRef = useRef<HTMLDetailsElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingDeparture, setSavingDeparture] = useState(false);
  const [saveDepartureIssue, setSaveDepartureIssue] = useState<object | null>(null);
  const [pending, setPending] = useState<{kind:"organization"|"signout"|"link";id:string;risk:DepartureRisk;changes:DepartureChange[];authority:number;target:string;plan?:DeparturePlan} | null>(null);
  const navigation = useNavigationController();
  const session = useNavigationSession();
  const en = locale === "en";
  const organizationLabel = session.selected ? organizationDisplayLabel(session.selected, session.organizations, locale) : (en ? "No organization selected" : "Организация не выбрана");
  const href = (path: string) => workspaceDestination(path, location);
  function closeMore() { if (moreRef.current) moreRef.current.open = false; }
  const closeDrawer = useCallback((focus = false) => { drawerRef.current?.close();setDrawerOpen(false);if(focus)menuButton.current?.focus(); }, []);
  const studioActionsSlot = useCallback((node: HTMLDivElement | null) => {
    setTarget(node);
    if (!node) return;
    // Portal events follow the editor's React tree. Listen on this owned DOM
    // slot so mobile navigation closes before the original action opens a dialog.
    const dismiss = (event: Event) => { if (event.target instanceof Element && event.target.closest("button,a")) closeDrawer(); };
    node.addEventListener("click", dismiss, true);
    return () => { node.removeEventListener("click", dismiss, true); setTarget(null); };
  }, [setTarget, closeDrawer]);
  useEffect(()=>{const media=window.matchMedia("(max-width: 800px)");const update=()=>{setMobile(media.matches);setDrawerOpen(false);};update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  useEffect(()=>{if(pending)confirmRef.current?.showModal();else confirmRef.current?.close();},[pending]);
  function cancelPending() { navigation.beginIntent(); pending?.plan?.cancel?.(); setPending(null); }
  async function saveAndContinue() {
    if (!pending || savingDeparture) return;
    const requested = pending, authority = navigation.authorityVersion;
    const current = () => requested.authority === authority && authority === navigation.authorityVersion && (!requested.plan || requested.plan.current());
    setSavingDeparture(true); setSaveDepartureIssue(null);
    const confirmed = await navigation.saveBeforeDeparture(current);
    setSavingDeparture(false);
    if (confirmed && current()) await depart(requested.kind, requested.kind === "link" ? resumeWorkspaceDestination(requested.id, window.location.href) : requested.id, false, requested.target, requested.plan);
    else setSaveDepartureIssue(requested);
  }
  async function depart(kind:"organization"|"signout"|"link",id="",discard=false,target="",plan?:DeparturePlan) {
    if(plan&&!plan.current()){plan.cancel?.();setPending(null);return;}
    if(kind==="signout"){setPending(null);closeDrawer();await navigation.signOut(locale);return;}
    if(allowDeparture&&!allowDeparture()){plan?.cancel?.();setPending(null);return;}
    const risk=kind==="organization"?await navigation.select(id,locale,discard,plan):navigation.risk();
    if(risk!=="clear"&&!(risk==="dirty"&&discard)){setPending({kind,id,risk,changes:navigation.departureChanges(),authority:navigation.authorityVersion,target,plan});return;}
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
    if (!onNavigate || ["matters", "work", "home", "calendar", "tasks", "people", "workflows"].includes(view)) { guardedLink(event);return; }
    if(event.defaultPrevented)return;
    if(allowDeparture&&!allowDeparture()){event.preventDefault();return;}
    if(navigation.risk()!=="clear"){event.preventDefault();navigation.requestDeparture("link",event.currentTarget.href);return;}
    event.preventDefault(); closeDrawer();onNavigate(view);
    requestAnimationFrame(()=>{const main=document.querySelector<HTMLElement>("main h1, main");if(main){main.tabIndex=-1;main.focus();}});
  }
  const liveChanges = navigation.departureChanges();
  const pendingChanges = liveChanges.length ? liveChanges : pending?.changes ?? [];
  const contents=<>
    <span className="genesis-nav-label">{en ? "Workspace" : "Рабочее пространство"}</span>
    <nav className="genesis-nav-pages" aria-label={en ? "Workspace navigation" : "Навигация по рабочему пространству"}>
      {WORKSPACE_PAGES.map(item => {
        const isWork = active === "/work" || active === "work" || active === "/";
        const workView = new URL(location,"https://workspace.invalid").searchParams.get("view") ?? "home";
        const selected = isWork ? item.view === (workView === "cases" ? "home" : workView) : active === item.view || active === item.path;
        const label = <><WorkspaceIcon name={item.icon}/><span>{en?item.en:item.ru}</span></>;
        return <Fragment key={item.view}>{item.view === "studio" && active === "studio" && onNavigate
          ? <button type="button" className="casevant-primary-link" aria-current="page" onClick={()=>{closeDrawer();onNavigate("studio");}}>{label}</button>
          : <a className="casevant-primary-link" href={href(item.path)} aria-current={selected?"page":undefined} onClick={event=>follow(event,item.view)}>{label}</a>}{item.view==="studio"&&selected&&<div className="studio-sidebar-actions" ref={studioActionsSlot}/>}</Fragment>;
      })}
      <details className="genesis-nav-group" open={SECONDARY_PAGES.some(item=>item.view===active||item.path===active)||active==="library"||active==="/canopy"}>
        <summary><WorkspaceIcon name="grid"/><span>{en?"Tools & library":"Инструменты и библиотека"}</span><span aria-hidden="true">⌄</span></summary>
        <div className="genesis-nav-children">{SECONDARY_PAGES.map(item=>{
          const selected=active===item.view||active===item.path||((active==="library"||active==="/canopy")&&item.view==="demos");
          return <Fragment key={item.view}><a href={href(item.path)} aria-current={selected?"page":undefined} onClick={event=>follow(event,item.view)}><WorkspaceIcon name={item.icon}/><span>{en?item.en:item.ru}</span></a>{item.view==="play"&&operationsActions}</Fragment>;
        })}</div>
      </details>
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
        {returnTo&&<a className="genesis-return" href={href(returnTo)} onClick={guardedLink}>{en?"Return to your case":"Вернуться к делу"}</a>}
        <details className="genesis-nav-group" key={`help-${active === "help" || active === "/help/studio-demo"}`} open={active === "help" || active === "/help/studio-demo"}>
          <summary><WorkspaceIcon name="help"/><span>{en ? "Help & training" : "Помощь и обучение"}</span><span className="nav-chevron" aria-hidden="true">⌄</span></summary>
          <div className="genesis-nav-children"><a href={href("/studio?view=help")} onClick={event=>follow(event,"help")} aria-current={active === "help" ? "page" : undefined}>{en ? "Help & guides" : "Инструкции"}</a><a href={href("/studio?view=help#recordings")} target="_blank" rel="noopener noreferrer" aria-label={en ? "Scenario recordings (opens in a new tab)" : "Записи сценариев (в новой вкладке)"}>{en ? "Scenario recordings" : "Записи сценариев"}</a><a href={href("/help/studio-demo")} target="_blank" rel="noreferrer" aria-current={active === "/help/studio-demo" ? "page" : undefined}>{en ? "Workflow video · CaseVant ↗" : "Учебное видео CaseVant ↗"}</a></div>
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
    <a className="genesis-brand" href={href("/work?view=home")} onClick={(event) => follow(event, "home")} aria-label="CaseVant — Home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/casevant-mark.png" alt="" width="48" height="52"/>
      <span><b>CaseVant</b><small>by Falcon-Merlin Group</small></span>
    </a>
    {mobile?<><button type="button" className="genesis-menu-toggle" ref={menuButton} aria-label={en?"Open navigation":"Открыть навигацию"} aria-expanded={drawerOpen} aria-controls="genesis-navigation-drawer" onClick={()=>{drawerRef.current?.showModal();setDrawerOpen(true);}}>{en?"Menu":"Меню"}</button><dialog id="genesis-navigation-drawer" className="genesis-navigation-drawer" ref={drawerRef} aria-label={en?"Workspace menu":"Меню рабочего пространства"} onClose={()=>setDrawerOpen(false)} onClick={event=>{if(event.target===event.currentTarget)closeDrawer(true);}}><div className="genesis-drawer-inner"><button type="button" className="genesis-drawer-close" onClick={()=>closeDrawer(true)}>{en?"Close menu":"Закрыть меню"}</button>{contents}</div></dialog></>:<div className="genesis-nav-body">{contents}</div>}
  </header>
  <dialog className="genesis-navigation-confirm" ref={confirmRef} onCancel={cancelPending} aria-labelledby="navigation-confirm-title">
    <h2 id="navigation-confirm-title">{pending?.risk==="pending"?(en?"Check the pending save first":"Сначала проверьте сохранение"):(en?"Keep your changes before leaving":"Сохраните изменения перед выходом")}</h2>
    {pending?.risk==="pending"?<p>{en?"An operation is still running or its save is unconfirmed. Return to the current work to check it before switching.":"Операция ещё выполняется или сохранение не подтверждено. Вернитесь к работе и проверьте результат перед переходом."}</p>:<>
      <ul>{pendingChanges.map(change=><li key={change}>{departureChangeLabel(change,locale)}</li>)}</ul>
      <p>{en?"Previously saved case versions remain available. Only the unsaved work listed above would be discarded.":"Ранее сохранённые версии кейса останутся доступны. Будет удалена только перечисленная выше несохранённая работа."}</p>
    </>}
    {pending && saveDepartureIssue === pending && <p role="alert">{en?"Some work is still unsaved, or saving could not be confirmed. Review it before leaving.":"Часть работы не сохранена либо сохранение не подтверждено. Проверьте её перед выходом."}</p>}
    {savingDeparture&&<p role="status">{en?"Saving your case…":"Сохранение кейса…"}</p>}
    <div><button type="button" onClick={cancelPending} autoFocus>{en?"Stay here":"Остаться"}</button>
      {pending?.risk==="pending"?<button type="button" onClick={()=>{cancelPending();closeDrawer();navigation.reviewPending();}}>{en?"Return to current work":"Вернуться к работе"}</button>:<>
        {navigation.canSaveBeforeDeparture()||savingDeparture?<button type="button" className="departure-save" disabled={savingDeparture} onClick={()=>void saveAndContinue()}>{savingDeparture?(en?"Saving…":"Сохранение…"):(en?"Save and continue":"Сохранить и продолжить")}</button>:<button type="button" className="departure-save" onClick={()=>{cancelPending();closeDrawer();navigation.reviewUnsaved();}}>{en?"Review unsaved work":"Проверить несохранённую работу"}</button>}
        <button type="button" className="departure-discard" disabled={savingDeparture} onClick={()=>{if(pending&&pending.authority===navigation.authorityVersion)void depart(pending.kind,pending.id,true,pending.target,pending.plan);else setPending(null);}}>{en?"Discard unsaved work and continue":"Отменить несохранённое и продолжить"}</button>
      </>}{pending?.risk==="pending"&&navigation.canSignOut&&<button type="button" onClick={()=>void depart("signout")}>{en?"Sign out now":"Выйти сейчас"}</button>}</div>
  </dialog></>;
}
