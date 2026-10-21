"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { workspaceDestination } from "../workspace-navigation";
import MattersClient from "./MattersClient";
import { myCasesHref, myCasesView, StudioCaseCatalogue, type SavedStudioCase } from "./studio-case-catalogue";
import styles from "./my-cases.module.css";
import { selectStudioCases, studioUpdatedLabel, studioUpdatedTimestamp, type StudioCaseSort } from "./studio-case-list";
import { readStudioSearchReturn, readStudioTabSearch, writeStudioTabSearch, studioSearchBoundary, withStudioSearchReturn } from "./studio-search-return";

export default function MyCasesClient({ initialLocation }: { initialLocation: string }) {
  const current = useWorkspaceLocation(), location = current === "/" ? initialLocation : current;
  const [locale] = useInterfaceLocale();
  const session = useNavigationSession();
  const en = locale === "en", view = myCasesView(location);
  return <>
    <section className={styles.switcher} aria-label={en ? "My cases storage" : "Хранилище моих кейсов"}>
      <h1>{en ? "My cases" : "Мои кейсы"}</h1>
      <nav aria-label={en ? "Personal or Team cases" : "Личные или командные кейсы"}>
        <a href={myCasesHref("personal", location)} aria-current={view === "personal" ? "page" : undefined}>{en ? "Personal" : "Личные"}<small>{en ? "Saved Studio drafts" : "Черновики Studio"}</small></a>
        <a href={myCasesHref("team", location)} aria-current={view === "team" ? "page" : undefined}>{en ? "Team" : "Команда"}<small>{en ? "Organization cases" : "Дела организации"}</small></a>
      </nav>
      <p>{view === "personal" ? (en ? "Saved with your account. Shared Studio drafts are listed separately below; they are not organization cases." : "Сохранены в вашем аккаунте. Доступные вам черновики Studio показаны отдельно; это не дела организации.") : (en ? "Governed cases in the selected organization, including organizations named Personal workspace. Studio drafts stay in Personal." : "Дела выбранной организации, в том числе Personal workspace. Черновики Studio остаются в разделе «Личные». ")}</p>
      {view === "team" && session.phase === "ready" && session.selected && <p><strong>{session.selected.name}</strong> · {en ? "Your organization role" : "Ваша роль в организации"}: {session.selected.role.replaceAll("_", " ")} · {en ? "Use the sidebar to choose another organization. Each case has its own role." : "Выберите другую организацию в боковом меню. Для каждого дела действует своя роль."}</p>}
    </section>
    {view === "team" ? <MattersClient /> : <SavedStudioCases locale={locale} location={location} />}
  </>;
}

export function SavedStudioCases({ locale, location }: { locale: "en" | "ru"; location: string }) {
  const navigation = useNavigationController(), session = useNavigationSession();
  const [catalogue] = useState(() => new StudioCaseCatalogue(navigation, (path, init) => fetch(path, init)));
  const state = useSyncExternalStore(catalogue.subscribe, catalogue.getSnapshot, catalogue.getSnapshot);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StudioCaseSort>("updated");
  const scope = session.phase === "ready" && !session.endingSession && session.actorId ? JSON.stringify([session.actorId, session.selected?.selection]) : "";
  const [restoredScope, setRestoredScope] = useState("");
  const listRoot = useRef<HTMLElement | null>(null);
  const pageFocus = useRef<{ button: HTMLButtonElement; known: Set<number>; context: string } | null>(null);
  const focusContext = JSON.stringify([scope, navigation.authorityVersion, state.query, sort]);
  useEffect(() => {
    // A later user action owns focus, even when the page read is still pending.
    const cancel = (event: Event) => {
      if (pageFocus.current && event.target !== pageFocus.current.button) pageFocus.current = null;
    };
    const hide = () => { if (document.visibilityState !== "visible") pageFocus.current = null; };
    document.addEventListener("pointerdown", cancel, true);
    document.addEventListener("focusin", cancel, true);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("pointerdown", cancel, true); document.removeEventListener("focusin", cancel, true); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", hide); pageFocus.current = null; };
  }, []);
  useLayoutEffect(() => {
    const pending = pageFocus.current;
    if (!pending) return;
    if (pending.context !== focusContext || session.phase !== "ready" || session.endingSession || ["idle", "error"].includes(state.phase)) { pageFocus.current = null; return; }
    if (state.phase !== "ready") return;
    pageFocus.current = null;
    // The completed final page removes More. Continue at the first newly
    // rendered row instead of leaving the reader at BODY or jumping to the top.
    // Never take focus back from another control during an asynchronous read.
    if (document.activeElement !== pending.button && document.activeElement !== document.body) return;
    const next = Array.from(listRoot.current?.querySelectorAll<HTMLAnchorElement>("a[data-saved-case-title]") ?? [])
      .find(link => !pending.known.has(Number(link.dataset.savedCaseTitle)));
    next?.focus();
  }, [focusContext, session.phase, session.endingSession, state]);
  useEffect(() => {
    let active = true;
    const boundary = studioSearchBoundary(() => window.localStorage);
    const saved = readStudioSearchReturn(window.history.state, scope, boundary) ?? readStudioTabSearch(() => window.sessionStorage, scope, boundary);
    const stop = catalogue.attach();
    const pending = saved ? catalogue.restore(saved.query, saved.pages) : Promise.resolve();
    void pending.then(() => { if (active) { setSearch(saved?.input ?? ""); setSort(saved?.sort ?? "updated"); setRestoredScope(scope); } });
    if (!scope && ["anonymous", "expired", "denied", "error"].includes(session.phase)) {
      window.history.replaceState(withStudioSearchReturn(window.history.state, null), "");
      writeStudioTabSearch(() => window.sessionStorage, null);
    }
    return () => { active = false; stop(); };
  }, [catalogue, scope, session.phase]);
  useEffect(() => {
    const boundary = studioSearchBoundary(() => window.localStorage);
    if (!scope || restoredScope !== scope || boundary === null || state.phase !== "ready") return;
    const value = { version: 1 as const, scope, boundary, input: search, query: state.query, sort, pages: Math.min(40, state.pages) };
    const persist = () => {
      const current = navigation.getSnapshot();
      if (current.phase !== "ready" || current.endingSession || JSON.stringify([current.actorId, current.selected?.selection]) !== scope || studioSearchBoundary(() => window.localStorage) !== boundary) return;
      writeStudioTabSearch(() => window.sessionStorage, value);
      try { window.history.replaceState(withStudioSearchReturn(window.history.state, value), ""); } catch { /* A throttled history write must not break the catalogue. */ }
    };
    const timer = window.setTimeout(persist, 150);
    window.addEventListener("pagehide", persist);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", persist); };
  }, [navigation, scope, restoredScope, search, sort, state]);
  const en = locale === "en";
  const visible = useMemo(() => selectStudioCases(state.cases, "", sort, locale), [state.cases, sort, locale]);
  // Render authority is checked synchronously as well as fencing async reads.
  if (session.phase !== "ready" || session.endingSession) return <main className={styles.personal} data-saved-case-actions><p role="status">{en ? "Verify your access to view saved Studio drafts." : "Подтвердите доступ для просмотра сохранённых черновиков Studio."}</p></main>;
  return <main ref={listRoot} className={styles.personal} data-saved-case-actions>
    <header><h2>{en ? "Saved Studio drafts" : "Сохранённые черновики Studio"}</h2><p>{en ? "Open a saved draft to continue your work. Review and approval are tracked separately." : "Откройте сохранённый черновик, чтобы продолжить работу. Проверка и одобрение учитываются отдельно."}</p></header>
    <form className={styles.tools} role="search" aria-label={en ? "Search saved Studio drafts" : "Поиск сохранённых черновиков Studio"} onSubmit={event => { event.preventDefault(); void catalogue.search(search); }}>
      <label className={styles.search}>{en ? "Search all authorized drafts" : "Поиск во всех доступных черновиках"}<input type="search" maxLength={120} placeholder={en ? "Title, author or #saved ID" : "Название, автор или #ID копии"} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button type="submit">{en ? "Search" : "Найти"}</button>
      {(search || state.query) && <button type="button" onClick={() => { setSearch(""); void catalogue.search(""); }}>{en ? "Clear search" : "Сбросить поиск"}</button>}
      <label>{en ? "Sort loaded drafts" : "Сортировка загруженных черновиков"}<select value={sort} onChange={event => setSort(event.target.value as StudioCaseSort)}><option value="updated">{en ? "Recently updated" : "Недавно обновлённые"}</option><option value="oldest">{en ? "Oldest update first" : "Давно обновлённые"}</option><option value="title">{en ? "Title A–Z" : "По названию А–Я"}</option></select></label>
    </form>
    {state.query && <p>{en ? `Results for “${state.query}” across authorized saved drafts. Sorting applies to loaded results.` : `Результаты для «${state.query}» среди всех доступных сохранённых черновиков. Сортировка применяется к загруженным результатам.`}</p>}
    <div className={styles.actions}>
      <button type="button" onClick={() => void catalogue.load()} disabled={state.phase === "loading"}>{en ? "Refresh drafts" : "Обновить черновики"}</button>
      <a href={workspaceDestination("/studio", location)}>{en ? "Open Case Studio" : "Открыть Case Studio"}</a>
      <a href={workspaceDestination("/studio?view=community", location)}>{en ? "Manage Studio sharing" : "Настроить доступ к черновикам Studio"}</a>
    </div>
    <p role="status" className={styles.readStatus}>{state.phase === "loading" ? (state.refreshing ? (en ? "Updating…" : "Обновление…") : (en ? "Loading authorized drafts…" : "Загрузка доступных черновиков…")) : null}</p>
    {state.phase === "error" && <p role="alert">{state.issue === "invalid-search" ? (en ? "Use up to 120 characters without line breaks or control characters." : "Введите до 120 символов без переносов строк и управляющих символов.") : (en ? "Saved drafts could not be read. Refresh drafts to retry; check your access if the problem continues." : "Не удалось прочитать черновики. Нажмите «Обновить черновики»; если ошибка повторяется, проверьте доступ.")}</p>}
    {state.phase === "ready" && !state.cases.length && <p role="status">{state.query ? (en ? "No authorized drafts match this search. Try another title, author or case ID, or clear search." : "Среди доступных черновиков совпадений нет. Измените название, автора или ID кейса либо сбросьте поиск.") : (en ? "No saved Studio drafts are available to this account. Open Case Studio to create or import a draft, then save it to your account." : "Для аккаунта нет доступных сохранённых черновиков Studio. Создайте или импортируйте черновик в Case Studio и сохраните его в аккаунте.")}</p>}
    {state.cases.length > 0 && <><p role="status">{en ? `${visible.length} matching loaded drafts` : `Найдено загруженных черновиков: ${visible.length}`}{state.nextCursor ? (en ? " · More drafts are available below." : " · Ниже можно загрузить ещё.") : ""}</p>
      <StudioCaseGroup title={en ? "Owned by me" : "Мои черновики"} cases={visible.filter(item => item.access === "owner")} locale={locale} location={location}/>
      <StudioCaseGroup title={en ? "Other authorized Studio drafts" : "Другие доступные черновики Studio"} cases={visible.filter(item => item.access !== "owner")} locale={locale} location={location}/>
    </>}
    {state.nextCursor && <button type="button" onClick={event => {
      if (document.activeElement === event.currentTarget) pageFocus.current = { button: event.currentTarget, known: new Set(state.cases.map(item => item.id)), context: focusContext };
      void catalogue.load(true);
    }} disabled={state.phase === "loading" && !state.refreshing}>{en ? "Load more authorized drafts" : "Загрузить ещё доступные черновики"}</button>}
  </main>;
}

export function StudioCaseGroup({ title, cases, locale, location }: { title: string; cases: SavedStudioCase[]; locale: "en" | "ru"; location: string }) {
  if (!cases.length) return null;
  const en = locale === "en";
  return <section className={styles.group} aria-label={title}><h3>{title} <span>{cases.length}</span></h3><ul className={styles.rows}>{cases.map(item => {
    const href = workspaceDestination(`/studio?custom_case=${item.id}&studio_step=case_map`, location);
    const updatedAt = studioUpdatedTimestamp(item.updatedAt);
    return <li key={item.id} className={styles.row}>
      <div className={styles.identity}><h4><a data-saved-case-title={item.id} href={href}>{item.title}</a></h4><p><span className={styles.badge}>{en ? "Draft" : "Черновик"}</span> <span>#{item.id} · v{item.currentVersion}</span></p></div>
      <div className={styles.access}><p>{item.ownerDisplayName}</p><small>{item.access === "owner" ? (en ? "Owner" : "Владелец") : item.access === "shared" ? (en ? "Shared access" : "Предоставлен доступ") : (en ? "Administrator access" : "Доступ администратора")}</small><small>{item.isPrivate ? (en ? "Private" : "Приватный") : (en ? "Restricted sharing" : "Ограниченный доступ")}</small></div>
      <div className={styles.updated}><small>{en ? "Updated · UTC" : "Обновлён · UTC"}</small>{updatedAt !== null ? <time dateTime={new Date(updatedAt).toISOString()} title={item.updatedAt}>{studioUpdatedLabel(item.updatedAt, locale)}</time> : <span>{en ? "Date unavailable" : "Дата недоступна"}</span>}</div>
      <a className={styles.open} href={href}><span>{item.access === "owner" ? (en ? "Edit in Studio" : "Редактировать в Studio") : (en ? "Open in Studio" : "Открыть в Studio")}</span><span className={styles.srOnly}>: {item.title} · #{item.id}</span><span aria-hidden="true"> →</span></a>
    </li>;
  })}</ul></section>;
}
