"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge, { type StatusTone } from "../StatusBadge";
import { useNavigationController } from "../NavigationSession";
import { zonedMoment, type ClockChoice } from "../matters/practice-scheduling";
import { useWorkClock } from "../matters/use-work-clock";
import { calendarFormGuard, type CalendarReceipt, type CalendarView } from "./contracts";
import styles from "./calendar.module.css";
type Props = {
  selection: string;
  scope: string;
  name: string;
  locale: "ru" | "en";
  mode: "calendar" | "reminders";
  refreshKey?: number;
  onEditing?: (value: boolean) => void;
};
type Command = Record<string, unknown>;
export default function CalendarTools({
  selection,
  scope,
  name,
  locale,
  mode,
  refreshKey,
  onEditing,
}: Props) {
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en),
    nav = useNavigationController(),
    now = useWorkClock();
  const [open, setOpen] = useState(mode === "reminders"),
    [view, setView] = useState<CalendarView | null>(null),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState(""),
    [note, setNote] = useState(""),
    [link, setLink] = useState(""),
    [confirm, setConfirm] = useState(""),
    [pending, setPending] = useState<Command | null>(null);
  const [compose, setCompose] = useState(false),
    [item, setItem] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [local, setLocal] = useState(""),
    [zone, setZone] = useState("UTC"),
    [choice, setChoice] = useState<ClockChoice>("reject"),
    [channel, setChannel] = useState("app"),
    [box, setBox] = useState<"mine" | "sent">("mine");
  const [locked, setLocked] = useState(false),
    live = useRef(true),
    stamp = useRef(0),
    work = useRef(false),
    panel = useRef<HTMLElement>(null),
    field = useRef<HTMLInputElement>(null),
    [draftRevision, setDraftRevision] = useState(0);
  const path = "/api/calendar?scope=" + encodeURIComponent(scope),
    h = { "x-genesis-organization": selection };
  const messages = {
    unavailable: t("Calendar unavailable. Refresh to try again.", "Календарь недоступен. Обновите его."),
    uncertain: t(
      "Save not confirmed. Retry the same change to check it.",
      "Сохранение не подтверждено. Повторите ту же операцию.",
    ),
    changed: t(
      "The calendar or access changed. Refresh and review before saving.",
      "Календарь или права изменились. Обновите данные перед сохранением.",
    ),
  };
  const risk = pending || busy ? "pending" : compose ? "dirty" : "clear";
  const refresh = useCallback(async () => {
    const ticket = ++stamp.current;
    try {
      const r = await fetch(path, {
        headers: { "x-genesis-organization": selection },
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw Error();
      const v = (await r.json()) as CalendarView;
      if (live.current && ticket === stamp.current && v.scope === scope) {
        setView(v);
        setIssue("");
      }
    } catch {
      if (live.current && ticket === stamp.current) {
        setView(null);
        setLink("");
        setIssue(messages.unavailable);
      }
    }
  }, [path, scope, selection, messages.unavailable]);
  useEffect(() => {
    live.current = true;
    stamp.current++;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(refresh);
    const onFocus = () => {
      if (!work.current) void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, refresh, refreshKey]);
  useEffect(() => {
    if (!open || mode !== "reminders") return;
    const tick = window.setInterval(() => {
      if (!document.hidden && !work.current) void refresh();
    }, 60000);
    return () => clearInterval(tick);
  }, [open, mode, refresh]);
  useEffect(() => {
    onEditing?.(busy || !!pending || compose);
    return () => onEditing?.(false);
  }, [busy, pending, compose, onEditing]);
  useEffect(
    () =>
      nav.register(calendarFormGuard, {
        risk: () => risk,
        lock: setLocked,
        suspend: () => {
          ++stamp.current;
          setView(null);
          setLink("");
        },
        deny: () => {
          ++stamp.current;
          setView(null);
          setLink("");
          setCompose(false);
          setPending(null);
          setIds([]);
        },
        review: () => {
          setOpen(true);
          panel.current?.focus();
        },
      }),
    [nav, risk],
  );
  useEffect(() => {
    if (link) field.current?.select();
  }, [link]);
  async function save(cmd: Command) {
    if (work.current || locked) return;
    work.current = true;
    setBusy(true);
    setIssue("");
    setNote("");
    setLink("");
    setPending(cmd);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(cmd),
        signal: AbortSignal.timeout(16000),
      });
      if (!live.current) return;
      if (!r.ok) {
        if (r.status >= 500) throw Error();
        setPending(null);
        setConfirm("");
        await refresh();
        if (live.current) setIssue(messages.changed);
        return;
      }
      setPending(null);
      setConfirm("");
      if (cmd.action === "schedule") {
        setCompose(false);
        setIds([]);
        setBox("sent");
      }
      await refresh();
      if (live.current)
        setNote(
          cmd.action === "schedule"
            ? t("Reminder scheduled.", "Напоминание запланировано.")
            : cmd.action === "dismiss"
              ? t("Dismissed for you.", "Отключено для вас.")
              : cmd.action === "cancel"
                ? t("Reminder cancelled for this recipient.", "Напоминание отменено для этого получателя.")
                : t("Calendar link updated.", "Ссылка обновлена."),
        );
    } catch {
      if (live.current) setIssue(messages.uncertain);
    } finally {
      work.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function copy() {
    if (work.current) return;
    work.current = true;
    setBusy(true);
    setLink("");
    setIssue("");
    setNote("");
    try {
      const r = await fetch(path + "&link=1", {
        headers: h,
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error();
      const { path: p } = (await r.json()) as { path?: unknown };
      if (typeof p !== "string" || !/^\/api\/calendar\/feed\/[a-f0-9.-]+\.ics$/.test(p)) throw Error();
      if (!live.current) return;
      const url = window.location.origin + p;
      try {
        await navigator.clipboard.writeText(url);
        if (live.current) setNote(t("Private link copied.", "Закрытая ссылка скопирована."));
      } catch {
        if (live.current) setLink(url);
      }
    } catch {
      if (live.current) {
        setIssue(messages.unavailable);
        setView(null);
      }
    } finally {
      work.current = false;
      if (live.current) setBusy(false);
    }
  }
  const disabled = locked || busy || !!pending;
  function start() {
    if (!view) return;
    setItem(view.items[0]?.id ?? "");
    setIds([]);
    setLocal("");
    setChoice("reject");
    setChannel("app");
    setIssue("");
    setNote("");
    setDraftRevision(view.revision);
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setCompose(true);
  }
  const schedule = (wall: string) => {
    if (!view || !ids.length || !item) return;
    let when;
    try {
      when = zonedMoment(wall, zone, choice);
      if (Date.parse(when.at) <= Date.now()) throw Error("past");
    } catch (e) {
      setIssue(
        String(e).includes("twice")
          ? t(
              "This time occurs twice. Choose the first or second occurrence.",
              "Это время наступает дважды. Выберите первое или второе.",
            )
          : t(
              "Choose a future time that exists in this time zone.",
              "Выберите существующее будущее время в этом часовом поясе.",
            ),
      );
      return;
    }
    void save({
      action: "schedule",
      operation: crypto.randomUUID(),
      item,
      recipients: ids,
      channel,
      when,
      revision: draftRevision,
    });
  };
  const label = (r: CalendarReceipt): [string, StatusTone] =>
    r.dismissed && r.channel === "app"
      ? [t("Dismissed", "Отключено"), "neutral"]
      : r.state === "ready"
        ? now !== null && Date.parse(r.dueAt) <= now
          ? [t("Due now", "Пора выполнить"), "today"]
          : [t("Scheduled", "Запланировано"), "scheduled"]
        : r.state === "pending"
          ? [t("Email scheduled", "Письмо запланировано"), "scheduled"]
          : r.state === "accepted"
            ? [t("Accepted by email provider", "Принято почтовой службой"), "open"]
            : r.state === "delivered"
              ? [t("Email delivered", "Письмо доставлено"), "completed"]
              : r.state === "cancelled"
                ? [t("Cancelled", "Отменено"), "neutral"]
                : r.state === "failed"
                  ? [t("Delivery failed", "Ошибка доставки"), "overdue"]
                  : [t("Delivery unconfirmed", "Доставка не подтверждена"), "overdue"];
  const receipts = view?.receipts.filter((r) => (box === "mine" ? r.mine : r.sent)) ?? [];
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className={styles.panel}
      aria-label={t("Calendar connections and reminders", "Подписки и напоминания")}
    >
      <div className={styles.bar}>
        <span className={styles.glyph}>
          <WorkspaceIcon name={mode === "calendar" ? "calendar" : "reminder"} />
        </span>
        <div>
          <strong>
            {mode === "calendar"
              ? t("Calendar connections", "Подписки на календарь")
              : t("Personal reminders", "Личные напоминания")}
          </strong>
          <small>{name}</small>
        </div>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          disabled={disabled || compose}
          onClick={() => {
            setOpen(!open);
            setLink("");
            setConfirm("");
          }}
        >
          {open
            ? t("Close", "Закрыть")
            : mode === "calendar"
              ? t("Manage connections", "Управление подпиской")
              : t("Open reminders", "Открыть напоминания")}
        </button>
      </div>
      {open && (
        <div className={styles.body}>
          {!view && !issue && <p role="status">{t("Loading calendar…", "Загрузка календаря…")}</p>}
          {view && mode === "calendar" && (
            <div className={styles.section}>
              <div className={styles.title}>
                <h3>{t("Outlook & Google Calendar", "Outlook и Google Календарь")}</h3>
                <StatusBadge tone={view.feed.active ? "completed" : "neutral"}>
                  {view.feed.active ? t("Link active", "Ссылка активна") : t("Link off", "Ссылка выключена")}
                </StatusBadge>
              </div>
              <p>
                {t(
                  "Publish a read-only calendar of event and task titles and dates. Anyone with your private link can read them. Make changes in CaseVant; Outlook and Google choose when to refresh.",
                  "Публикуются только названия и даты событий и задач. Их видит любой, у кого есть закрытая ссылка. Изменения вносятся в CaseVant; время обновления выбирает Outlook или Google.",
                )}
              </p>
              {view.canWrite && (
                <div className={styles.actions}>
                  {!view.feed.active ? (
                    <button
                      className={styles.primary}
                      disabled={disabled}
                      onClick={() =>
                        void save({
                          action: "enable",
                          operation: crypto.randomUUID(),
                          revision: view.feed.revision,
                        })
                      }
                    >
                      {t("Create private link", "Создать закрытую ссылку")}
                    </button>
                  ) : (
                    <>
                      <button className={styles.primary} disabled={disabled} onClick={() => void copy()}>
                        {t("Copy subscription link", "Копировать ссылку")}
                      </button>
                      <button disabled={disabled} onClick={() => setConfirm("rotate")}>
                        {t("Replace link", "Заменить ссылку")}
                      </button>
                      <button disabled={disabled} onClick={() => setConfirm("revoke")}>
                        {t("Turn off link", "Выключить ссылку")}
                      </button>
                    </>
                  )}
                </div>
              )}
              {confirm && (
                <div className={styles.notice}>
                  <p>
                    {t(
                      "Existing subscriptions will stop receiving updates. Copies already downloaded may remain.",
                      "Существующие подписки перестанут обновляться. Ранее загруженные копии могут сохраниться.",
                    )}
                  </p>
                  <div className={styles.actions}>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        void save({
                          action: confirm,
                          operation: crypto.randomUUID(),
                          revision: view.feed.revision,
                        })
                      }
                    >
                      {confirm === "rotate"
                        ? t("Confirm replacement", "Подтвердить замену")
                        : t("Turn link off", "Подтвердить отключение")}
                    </button>
                    <button disabled={disabled} onClick={() => setConfirm("")}>
                      {t("Keep current link", "Оставить ссылку")}
                    </button>
                  </div>
                </div>
              )}
              {link && (
                <label>
                  {t("Copy this private link", "Скопируйте закрытую ссылку")}
                  <input readOnly ref={field} value={link} />
                </label>
              )}
              <details>
                <summary>{t("How to subscribe", "Как подписаться")}</summary>
                <p>
                  <b>Outlook</b> ·{" "}
                  {t(
                    "Calendar → Add calendar → Subscribe from web. Paste your link and save.",
                    "Календарь → Добавить календарь → Подписаться из Интернета. Вставьте ссылку и сохраните.",
                  )}
                </p>
                <p>
                  <b>Google Calendar</b> ·{" "}
                  {t(
                    "On a computer, open Other calendars → + → From URL. Paste your link and add the calendar.",
                    "На компьютере откройте Другие календари → + → Добавить по URL. Вставьте ссылку и добавьте календарь.",
                  )}
                </p>
              </details>
            </div>
          )}
          {view && (
            <div className={styles.section}>
              <div className={styles.title}>
                <h3>{t("Recipient reminders", "Напоминания для получателей")}</h3>
                {view.canWrite && !compose && (
                  <button disabled={disabled || !view.items.length} onClick={start}>
                    <WorkspaceIcon name="plus" />
                    {t("New reminder", "Создать напоминание")}
                  </button>
                )}
              </div>
              {!view.items.length && view.canWrite && (
                <p>
                  {t(
                    "Add an open task or event to schedule a reminder.",
                    "Добавьте открытую задачу или событие для напоминания.",
                  )}
                </p>
              )}
              {compose && (
                <form
                  data-own-drafts
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    schedule(String(new FormData(e.currentTarget).get("when") ?? ""));
                  }}
                >
                  <fieldset disabled={disabled}>
                    <legend>{t("New reminder", "Новое напоминание")}</legend>
                    <label>
                      {t("Task or event", "Задача или событие")}
                      <select required value={item} onChange={(e) => setItem(e.target.value)}>
                        {view.items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className={styles.people}>
                      <legend>{t("Recipients", "Получатели")}</legend>
                      {view.people.map((p) => (
                        <label key={p.id}>
                          <input
                            type="checkbox"
                            checked={ids.includes(p.id)}
                            onChange={(e) =>
                              setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))
                            }
                          />
                          {p.name}
                        </label>
                      ))}
                    </fieldset>
                    <div className={styles.grid}>
                      <label>
                        {t("Remind at", "Напомнить")}
                        <input
                          name="when"
                          type="datetime-local"
                          required
                          defaultValue={local}
                          onInput={(e) => setLocal(e.currentTarget.value)}
                        />
                      </label>
                      <label>
                        {t("Time zone", "Часовой пояс")}
                        <input
                          required
                          list="cv-timezones"
                          value={zone}
                          onChange={(e) => setZone(e.target.value)}
                        />
                        <datalist id="cv-timezones">
                          {["UTC", "Europe/Brussels", "Europe/London", "America/New_York", "Asia/Tokyo"].map(
                            (z) => (
                              <option key={z}>{z}</option>
                            ),
                          )}
                        </datalist>
                      </label>
                      <label>
                        {t("Delivery", "Способ доставки")}
                        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                          <option value="app">{t("In CaseVant", "В CaseVant")}</option>
                          <option value="email">{t("Email", "Почта")}</option>
                        </select>
                      </label>
                    </div>
                    <details>
                      <summary>{t("Repeated clock times", "Повторяющееся местное время")}</summary>
                      <label>
                        {t("If clocks go back", "При переводе часов назад")}
                        <select value={choice} onChange={(e) => setChoice(e.target.value as ClockChoice)}>
                          <option value="reject">{t("Ask me to choose", "Запросить выбор")}</option>
                          <option value="earlier">{t("First occurrence", "Первое наступление")}</option>
                          <option value="later">{t("Second occurrence", "Второе наступление")}</option>
                        </select>
                      </label>
                    </details>
                    <p>
                      {t(
                        "This reminder uses the time you choose, even if the work date moves. Completing the work cancels pending reminders.",
                        "Напоминание сохраняет выбранное время при переносе задачи. Завершение работы отменяет ожидающие напоминания.",
                      )}
                    </p>
                    <div className={styles.actions}>
                      <button
                        type="submit"
                        className={styles.primary}
                        disabled={!ids.length || ids.length > 20 || view.revision !== draftRevision}
                      >
                        {t("Schedule reminder", "Запланировать")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCompose(false);
                          setIssue("");
                        }}
                      >
                        {t("Cancel", "Отмена")}
                      </button>
                    </div>
                    {view.revision !== draftRevision && (
                      <p role="alert">
                        {t(
                          "Work changed. Cancel and reopen this reminder to review the new dates.",
                          "План изменился. Отмените и откройте форму снова для проверки дат.",
                        )}
                      </p>
                    )}
                  </fieldset>
                </form>
              )}
              <div className={styles.actions} aria-label={t("Reminder lists", "Списки напоминаний")}>
                <button aria-pressed={box === "mine"} onClick={() => setBox("mine")}>
                  {t("For me", "Мне")}
                </button>
                <button aria-pressed={box === "sent"} onClick={() => setBox("sent")}>
                  {t("Scheduled by me", "Назначенные мной")}
                </button>
                <button disabled={disabled} onClick={() => void refresh()}>
                  <WorkspaceIcon name="refresh" />
                  {t("Refresh", "Обновить")}
                </button>
              </div>
              {receipts.length ? (
                <ul className={styles.rows}>
                  {receipts.map((r) => {
                    const [status, tone] = label(r);
                    return (
                      <li key={r.id}>
                        <div>
                          <strong>{r.title || t("Removed work", "Удалённая задача")}</strong>
                          <small>
                            {r.name} ·{" "}
                            {new Date(r.dueAt).toLocaleString(locale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}{" "}
                            · {r.channel === "app" ? t("In CaseVant", "В CaseVant") : t("Email", "Почта")}
                          </small>
                        </div>
                        <StatusBadge tone={tone}>{status}</StatusBadge>
                        {r.dismissed && r.channel === "email" && (
                          <StatusBadge>{t("Dismissed", "Отключено")}</StatusBadge>
                        )}
                        {box === "sent" &&
                          r.sent &&
                          view.canWrite &&
                          !r.dismissed &&
                          ["pending", "ready"].includes(r.state) && (
                            <button
                              disabled={disabled}
                              onClick={() =>
                                void save({ action: "cancel", id: r.id, operation: crypto.randomUUID() })
                              }
                            >
                              {t("Cancel for recipient", "Отменить для получателя")}
                            </button>
                          )}
                        {box === "mine" && r.mine && !r.dismissed && r.state !== "cancelled" && (
                          <button
                            disabled={disabled}
                            onClick={() =>
                              void save({ action: "dismiss", id: r.id, operation: crypto.randomUUID() })
                            }
                          >
                            {t("Dismiss for me", "Отключить для меня")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>
                  {box === "mine"
                    ? t("No reminders for you in this calendar.", "В этом календаре нет напоминаний для вас.")
                    : t(
                        "You haven’t scheduled reminders in this calendar.",
                        "Вы ещё не назначали напоминания в этом календаре.",
                      )}
                </p>
              )}
            </div>
          )}
          {issue && <p role="alert">{issue}</p>}
          {pending && !busy && (
            <button disabled={locked} onClick={() => void save(pending)}>
              {t("Retry original save", "Повторить сохранение")}
            </button>
          )}
          {!view && issue && !pending && (
            <button onClick={() => void refresh()}>{t("Refresh", "Обновить")}</button>
          )}
          {note && <p role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
