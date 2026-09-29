"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { workspaceDestination } from "../workspace-navigation";
import MattersClient from "./MattersClient";
import { myCasesHref, myCasesView, StudioCaseCatalogue, type SavedStudioCase } from "./studio-case-catalogue";
import styles from "./my-cases.module.css";

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
  useEffect(() => catalogue.attach(), [catalogue]);
  const en = locale === "en";
  const visible = useMemo(() => state.cases.filter(item => [item.title, item.caseId, item.ownerDisplayName].some(value => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))), [state.cases, search]);
  // Render authority is checked synchronously as well as fencing async reads.
  if (session.phase !== "ready" || session.endingSession) return <main className={styles.personal}><p role="status">{en ? "Verify your access to view saved Studio drafts." : "Подтвердите доступ для просмотра сохранённых черновиков Studio."}</p></main>;
  return <main className={styles.personal}>
    <header><h2>{en ? "Saved Studio drafts" : "Сохранённые черновики Studio"}</h2><p>{en ? "A draft opens in Case Studio with its saved identity and version. Saving a draft does not create a Matter, a review or an approval." : "Черновик откроется в Case Studio с сохранённым идентификатором и версией. Сохранение черновика не создаёт дело, рецензию или одобрение."}</p></header>
    <div className={styles.tools}>
      <label>{en ? "Search loaded drafts" : "Поиск в загруженных черновиках"}<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button type="button" onClick={() => void catalogue.load()} disabled={state.phase === "loading"}>{en ? "Refresh drafts" : "Обновить черновики"}</button>
      <a href={workspaceDestination("/studio", location)}>{en ? "Open Case Studio" : "Открыть Case Studio"}</a>
      <a href={workspaceDestination("/studio?view=community", location)}>{en ? "Manage Studio sharing" : "Настроить доступ к черновикам Studio"}</a>
    </div>
    {state.phase === "loading" && <p role="status">{en ? "Loading authorized drafts…" : "Загрузка доступных черновиков…"}</p>}
    {state.phase === "error" && <p role="alert">{en ? "Saved drafts could not be read. Refresh drafts to retry; check your access if the problem continues." : "Не удалось прочитать черновики. Нажмите «Обновить черновики»; если ошибка повторяется, проверьте доступ."}</p>}
    {state.phase === "ready" && !state.cases.length && <p>{en ? "No saved Studio drafts are available to this account. Open Case Studio to create or import a draft, then save it to your account." : "Для аккаунта нет доступных сохранённых черновиков Studio. Создайте или импортируйте черновик в Case Studio и сохраните его в аккаунте."}</p>}
    {state.cases.length > 0 && <><p role="status">{en ? `${visible.length} matching loaded drafts` : `Найдено загруженных черновиков: ${visible.length}`}{state.nextCursor ? (en ? " · More drafts are available below." : " · Ниже можно загрузить ещё.") : ""}</p>
      <StudioCaseGroup title={en ? "Owned by me" : "Мои черновики"} cases={visible.filter(item => item.access === "owner")} locale={locale} location={location}/>
      <StudioCaseGroup title={en ? "Other authorized Studio drafts" : "Другие доступные черновики Studio"} cases={visible.filter(item => item.access !== "owner")} locale={locale} location={location}/>
    </>}
    {state.nextCursor && <button type="button" onClick={() => void catalogue.load(true)} disabled={state.phase === "loading"}>{en ? "Load more authorized drafts" : "Загрузить ещё доступные черновики"}</button>}
  </main>;
}

export function StudioCaseGroup({ title, cases, locale, location }: { title: string; cases: SavedStudioCase[]; locale: "en" | "ru"; location: string }) {
  if (!cases.length) return null;
  const en = locale === "en";
  return <section className={styles.group} aria-label={title}><h3>{title}</h3><div className={styles.cards}>{cases.map(item => <article key={item.id}>
    <h4>{item.title}</h4><p>{item.ownerDisplayName} · {item.access === "owner" ? (en ? "Owner" : "Владелец") : item.access === "shared" ? (en ? "Shared access" : "Предоставлен доступ") : (en ? "Administrator access" : "Доступ администратора")}</p>
    <p>{en ? "Studio draft" : "Черновик Studio"} · v{item.currentVersion} · {item.isPrivate ? (en ? "Private" : "Приватный") : (en ? "Restricted sharing" : "Ограниченный доступ")}</p>
    <p>{en ? "Updated" : "Обновлён"}: <time dateTime={item.updatedAt}>{item.updatedAt}</time></p>
    <a href={workspaceDestination(`/studio?custom_case=${item.id}&studio_step=case_map`, location)}>{en ? "Continue in Studio" : "Продолжить в Studio"}</a>
  </article>)}</div></section>;
}
