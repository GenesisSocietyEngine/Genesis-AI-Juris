"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import { workspaceDestination } from "../workspace-navigation";
import { scheduleLabel } from "../matters/practice-scheduling";
import type { FirmCase } from "./work-controller";
import { homeDashboard } from "./home-dashboard";
import { distinctLabels, readableDate, workState, workStateLabel } from "./work-presentation";
import styles from "./work.module.css";

export default function HomeDashboard({ cases, loaded, loadFailed, now, zone, locale, location, name, onView }: {
  cases: FirmCase[]; loaded: boolean; loadFailed: boolean; now: number | null; zone: string; locale: "en" | "ru"; location: string; name: string; onView: (view: string, due?: "all" | "overdue" | "today") => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [action, setAction] = useState<"task" | "event" | "document" | null>(null);
  const [caseId, setCaseId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), select = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (action) { dialog.current?.showModal(); select.current?.focus(); } else dialog.current?.close(); }, [action]);
  const close = () => { setAction(null); trigger.current?.focus(); };
  const link = (path: string) => workspaceDestination(path, location);
  const names = distinctLabels(cases.map(c => ({ id: c.id, name: c.title })));
  const quick = (kind: NonNullable<typeof action>, button: HTMLButtonElement) => { trigger.current = button; setCaseId(""); setAction(kind); };
  const openCase = (id: string, section: string) => link(`/matters?collection=team&dossier=${encodeURIComponent(id)}&section=${section}`);
  const model = loaded && now !== null ? homeDashboard(cases, now, zone) : null;
  const rows = (items: NonNullable<typeof model>["open"]) => <ul className={styles.dashboardList}>{items.slice(0, 5).map(item => {
    const state = workState(item, model!.today, zone);
    return <li key={`${item.caseId}:${item.id}`}><a href={openCase(item.caseId, item.kind === "event" ? "calendar" : "tasks")}><span className={styles.itemGlyph} data-kind={item.kind}><WorkspaceIcon name={item.kind === "event" ? "calendar" : "tasks"} /></span><span><strong>{item.title}</strong><small>{item.caseTitle}</small><small>{scheduleLabel(item, zone) || t("No date", "Без даты")}</small></span><StatusBadge tone={state}>{workStateLabel(state, locale)}</StatusBadge></a></li>;
  })}</ul>;

  return <section aria-label={t("Home dashboard", "Главная панель")}>
    <div className={styles.welcome}><div><p className={styles.eyebrow}>{model ? readableDate(model.today, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : t("Your workspace", "Ваше рабочее пространство")}</p><h2>{t("Welcome back", "Добро пожаловать")}{name ? `, ${name}` : ""}</h2><p>{t("Your cases, your priorities, your day.", "Ваши дела, приоритеты и планы на день.")}</p></div><span className={styles.welcomeIcon} aria-hidden="true"><WorkspaceIcon name="home" /></span></div>
    <nav className={styles.quickActions} aria-label={t("Quick actions", "Быстрые действия")}>
      <a className={styles.primary} href={link("/matters?collection=team&create=case")}><WorkspaceIcon name="plus" />{t("New case", "Новое дело")}</a>
      <button disabled={!loaded} onClick={e => quick("task", e.currentTarget)}><WorkspaceIcon name="tasks" />{t("Add task", "Добавить задачу")}</button>
      <button disabled={!loaded} onClick={e => quick("event", e.currentTarget)}><WorkspaceIcon name="calendar" />{t("Add event", "Добавить событие")}</button>
      <button disabled={!loaded} onClick={e => quick("document", e.currentTarget)}><WorkspaceIcon name="document" />{t("Case documents", "Документы дела")}</button>
      <button onClick={() => onView("workflows")}><WorkspaceIcon name="flow" />{t("Workflows", "Процессы")}</button>
    </nav>
    {!model ? <p role="status">{loadFailed ? t("Your dashboard could not be loaded. Use Refresh to try again.", "Не удалось загрузить главную панель. Нажмите «Обновить», чтобы повторить.") : t("Loading your dashboard…", "Загрузка главной панели…")}</p> : <>
      <div className={styles.summaryStrip} aria-label={t("Work summary", "Сводка работы")}>
        <button data-tone="blue" onClick={() => onView("cases")}><WorkspaceIcon name="cases" /><span><b>{cases.length}</b>{t("Accessible cases", "Доступных дел")}</span></button>
        <button data-tone="amber" onClick={() => onView("tasks", "today")}><WorkspaceIcon name="today" /><span><b>{model.dueToday.length}</b>{t("Due today", "На сегодня")}</span></button>
        <button data-tone="red" onClick={() => onView("tasks", "overdue")}><WorkspaceIcon name="clock" /><span><b>{model.overdue.length}</b>{t("Overdue tasks", "Просроченных задач")}</span></button>
        <button data-tone="teal" onClick={() => onView("tasks", "all")}><WorkspaceIcon name="tasks" /><span><b>{model.open.length}</b>{t("Open work", "Открытых записей")}</span></button>
      </div>
      <div className={styles.dashboardGrid}>
        <section className={styles.dashboardPanel}><header><h3><WorkspaceIcon name="today" />{t("Today’s work", "Работа на сегодня")}</h3><button onClick={() => onView("tasks", "today")}>{t("View all", "Показать все")}<WorkspaceIcon name="next" /></button></header>{model.dueToday.length ? rows(model.dueToday) : <p className={styles.dashboardEmpty}>{t("Nothing scheduled for today. Add a task or event to plan your day.", "На сегодня ничего не запланировано. Добавьте задачу или событие.")}</p>}</section>
        <section className={styles.dashboardPanel}><header><h3><WorkspaceIcon name="calendar" />{t("Upcoming events", "Ближайшие события")}</h3><button onClick={() => onView("calendar")}>{t("Calendar", "Календарь")}<WorkspaceIcon name="next" /></button></header>{model.upcoming.length ? rows(model.upcoming) : <p className={styles.dashboardEmpty}>{t("No upcoming events. Your next meeting will appear here.", "Ближайших событий нет. Здесь появится ваша следующая встреча.")}</p>}</section>
        <section className={styles.dashboardPanel}><header><h3><WorkspaceIcon name="clock" />{t("Needs attention", "Требует внимания")}</h3><button onClick={() => onView("tasks", "overdue")}>{t("View all", "Показать все")}<WorkspaceIcon name="next" /></button></header>{model.overdue.length ? rows(model.overdue) : <p className={styles.dashboardEmpty}><WorkspaceIcon name="check" />{t("No overdue tasks in your accessible cases.", "В доступных делах нет просроченных задач.")}</p>}</section>
        <section className={styles.dashboardPanel}><header><h3><WorkspaceIcon name="cases" />{t("Case overview", "Обзор дел")}</h3><button onClick={() => onView("cases")}>{t("All cases", "Все дела")}<WorkspaceIcon name="next" /></button></header><ul className={styles.dashboardList}>{model.cases.slice(0, 5).map(c => <li key={c.id}><a href={openCase(c.id, "overview")}><span className={styles.itemGlyph}><WorkspaceIcon name="cases" /></span><span><strong>{c.title}</strong><small>{c.open} {t("open", "открыто")} · {c.completed} {t("completed", "завершено")}</small></span><StatusBadge tone={c.needsAttention ? "today" : "neutral"}>{c.needsAttention ? t("Needs attention", "Требует внимания") : t("No alerts", "Без замечаний")}</StatusBadge></a></li>)}</ul>{!cases.length && <p className={styles.dashboardEmpty}>{t("Create your first case to bring tasks, dates and documents together.", "Создайте первое дело, чтобы объединить задачи, даты и документы.")}</p>}</section>
      </div><p className={styles.hint}>{t("Based on saved work in cases you can access.", "По сохранённой работе в доступных вам делах.")} {t("Timezone", "Часовой пояс")}: {zone}</p>
    </>}
    <dialog className={styles.quickDialog} ref={dialog} onCancel={close} onClose={() => setAction(null)} aria-labelledby="home-quick-action-title"><h2 id="home-quick-action-title">{action === "event" ? t("Add event", "Добавить событие") : action === "task" ? t("Add task", "Добавить задачу") : t("Case documents", "Документы дела")}</h2><p>{t("Choose the case for this work.", "Выберите дело для этой работы.")}</p><label>{t("Case", "Дело")}<select ref={select} value={caseId} onChange={e => setCaseId(e.target.value)}><option value="">{t("Choose a case", "Выберите дело")}</option>{cases.map(c => <option key={c.id} value={c.id}>{names.get(c.id)}</option>)}</select></label>{!cases.length && <p>{t("Create a case first.", "Сначала создайте дело.")}</p>}<div className={styles.actions}><button onClick={close}>{t("Cancel", "Отмена")}</button>{caseId && cases.some(c => c.id === caseId) && <a className={styles.primary} href={link(`/matters?collection=team&dossier=${encodeURIComponent(caseId)}&section=${action === "event" ? "calendar" : action === "task" ? "tasks" : "documents"}${action !== "document" ? `&workAction=${action}` : ""}`)}>{t("Continue", "Продолжить")}<WorkspaceIcon name="arrow" /></a>}</div></dialog>
  </section>;
}
