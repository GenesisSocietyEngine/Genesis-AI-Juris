"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import WorkTabs from "../work/WorkTabs";
import WorkspaceCaseContext from "../WorkspaceCaseContext";
import { workspaceDestination, verifiedWorkspaceCaseReturn } from "../workspace-navigation";
import { useNavigationSession } from "../NavigationSession";
import {
  defaultFilter,
  filterCases,
  label,
  stages,
  statusChoices,
  type Locale,
  type RegisterFilter,
} from "./model";
import { Feedback, useCasework } from "./Host";
import { words, when } from "./presentation";
import styles from "../work/work.module.css";
import lib from "../library/library.module.css";
import css from "./casework.module.css";
export default function Register({ locale, location: loc }: { locale: Locale; location: string }) {
  const { controller: c, s } = useCasework(),
    nav = useNavigationSession(),
    t = words(locale),
    [filter, set] = useState<RegisterFilter>({ ...defaultFilter }),
    [picked, select] = useState(""),
    [viewId, setView] = useState(""),
    [archived, setArchived] = useState(false),
    pane = useRef<HTMLElement>(null);
  const location = verifiedWorkspaceCaseReturn(loc, nav.selected?.selection, s.cases),
    href = (p: string) => workspaceDestination(p, location),
    current = new URL(href("/matters"), "https://workspace.invalid").searchParams.get("dossier") ?? "";
  const all = filterCases(s.cases, s.records, filter),
    matter = all.find((v) => v.id === (picked || current)),
    update = s.records.find((v) => v.id === "progress_" + matter?.id),
    views = s.records
      .filter((r) => r.kind === "view" && r.archived === archived)
      .sort((a, b) => a.title.localeCompare(b.title, locale)),
    view = views.find((r) => r.id === viewId);
  useEffect(() => {
    if (picked) pane.current?.focus({ preventScroll: !window.matchMedia("(max-width:680px)").matches });
  }, [picked]);
  const patch = (p: Partial<RegisterFilter>) => set((f) => ({ ...f, ...p }));
  const apply = (id: string) => {
    setView(id);
    const v = views.find((r) => r.id === id);
    if (v) set({ query: v.body, stage: v.stage, status: v.statusFilter });
    else set({ ...defaultFilter });
  };
  return (
    <main className={styles.workspace}>
      <WorkTabs locale={locale} active="progress" location={location} />
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{nav.selected?.name}</p>
          <h1>
            <WorkspaceIcon name="cases" />
            {t("Case register", "Реестр дел")}
          </h1>
        </div>
        <button disabled={s.saving || s.loading || s.locked} onClick={() => void c.refresh()}>
          {t("Refresh", "Обновить")}
        </button>
      </header>
      <WorkspaceCaseContext
        location={location}
        locale={locale}
        name={s.cases.find((v) => v.id === current)?.title}
      />
      <section className={lib.firm}>
        <p>
          {t(
            "Track the stage and latest update for each case you can access.",
            "Следите за этапами и последними сообщениями по доступным делам.",
          )}
        </p>
        <Feedback locale={locale} />
        <div className={css.filters}>
          <label>
            {t("Find a case or update", "Найти дело или сообщение")}
            <input
              type="search"
              maxLength={120}
              value={filter.query}
              onChange={(e) => patch({ query: e.target.value })}
            />
          </label>
          <label>
            {t("Case stage", "Этап дела")}
            <select value={filter.stage} onChange={(e) => patch({ stage: e.target.value })}>
              <option value="">{t("All stages", "Все этапы")}</option>
              {["unset", ...stages].map((k) => (
                <option key={k} value={k}>
                  {label(k, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Formal case status", "Официальный статус дела")}
            <select value={filter.status} onChange={(e) => patch({ status: e.target.value })}>
              <option value="">{t("All statuses", "Все статусы")}</option>
              {statusChoices.map((k) => (
                <option value={k} key={k}>
                  {label(k, locale)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              set({ ...defaultFilter });
              setView("");
            }}
          >
            {t("Clear filters", "Очистить фильтры")}
          </button>
        </div>
        <div className={css.filters}>
          <label>
            {archived
              ? t("Archived personal views", "Архив личных представлений")
              : t("My saved views", "Мои представления")}
            <select value={view?.id ?? ""} onChange={(e) => apply(e.target.value)}>
              <option value="">{t("Choose a view", "Выберите представление")}</option>
              {views.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!c.editable()} onClick={() => c.view(filter)}>
            {t("Save current filters", "Сохранить фильтры")}
          </button>
          {view && !archived && (
            <button disabled={!c.editable()} onClick={() => c.view(filter, view)}>
              {t("Update saved view", "Обновить представление")}
            </button>
          )}
          {view && (
            <button
              disabled={!c.editable()}
              onClick={() =>
                void c.save({
                  id: view.id,
                  revision: view.revision,
                  action: archived ? "restore" : "archive",
                })
              }
            >
              {archived ? t("Restore view", "Восстановить") : t("Archive view", "В архив")}
            </button>
          )}
          <button
            aria-pressed={archived}
            onClick={() => {
              setArchived(!archived);
              setView("");
            }}
          >
            {archived
              ? t("Show active views", "Активные представления")
              : t("Archived views", "Архив представлений")}
          </button>
        </div>
        {s.loaded && (
          <div className={css.layout}>
            <section>
              <h2>
                {t("Cases", "Дела")} · {all.length}
              </h2>
              {!all.length ? (
                <p>{t("No cases match these filters.", "Нет дел, соответствующих фильтрам.")}</p>
              ) : (
                <ul className={lib.rows}>
                  {all.map((v) => {
                    const p = s.records.find((r) => r.id === "progress_" + v.id);
                    return (
                      <li key={v.id}>
                        <button
                          className={lib.documentRow}
                          aria-pressed={matter?.id === v.id}
                          onClick={() => select(v.id)}
                        >
                          <span className={css.rowTitle}>
                            <WorkspaceIcon name="cases" />
                            <span>
                              <strong>{v.title}</strong>
                              <small>
                                {[v.reference, label(p?.stage ?? "unset", locale)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section ref={pane} tabIndex={-1} aria-label={t("Selected case", "Выбранное дело")}>
              {matter ? (
                <>
                  <h2>{matter.title}</h2>
                  <small>{matter.reference}</small>
                  <p>
                    {t("Formal status: ", "Официальный статус: ")}
                    <StatusBadge tone="neutral">{label(matter.status, locale)}</StatusBadge>
                  </p>
                  <p>
                    {t("Case stage: ", "Этап дела: ")}
                    <StatusBadge tone={update ? "scheduled" : "neutral"}>
                      {label(update?.stage ?? "unset", locale)}
                    </StatusBadge>
                  </p>
                  <h3>{t("Latest status update", "Последнее сообщение")}</h3>
                  {update ? (
                    <>
                      <p className={css.paper}>{update.body}</p>
                      <small>{when(update.savedAt, locale)}</small>
                    </>
                  ) : (
                    <p>{t("No status update recorded.", "Сообщений пока нет.")}</p>
                  )}
                  <div className={css.commands}>
                    {matter.canEdit && (
                      <button
                        className={lib.primary}
                        disabled={!c.editable()}
                        onClick={() => c.progress(matter)}
                      >
                        {t("Update case progress", "Обновить ход дела")}
                      </button>
                    )}
                    {update && (
                      <button disabled={s.historyBusy || s.loading} onClick={() => void c.history(matter.id)}>
                        {t("View update history", "История сообщений")}
                      </button>
                    )}
                    <a href={href("/matters?collection=team&dossier=" + encodeURIComponent(matter.id))}>
                      {t("Open case overview", "Открыть обзор дела")}
                    </a>
                  </div>
                  {s.historyCase === matter.id && (
                    <section>
                      <h3>{t("Update history", "История сообщений")}</h3>
                      {s.historyBusy && <p role="status">{t("Loading…", "Загрузка…")}</p>}
                      <ol className={css.dates}>
                        {s.history.map((r) => (
                          <li key={r.revision}>
                            <strong>{label(r.stage, locale)}</strong>
                            <small>{when(r.savedAt, locale)}</small>
                            <p>{r.body}</p>
                          </li>
                        ))}
                      </ol>
                      {s.before !== null && (
                        <button disabled={s.historyBusy} onClick={() => void c.history(matter.id, true)}>
                          {t("Earlier updates", "Предыдущие сообщения")}
                        </button>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <p>{t("Select a case to see its progress.", "Выберите дело, чтобы посмотреть его ход.")}</p>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
