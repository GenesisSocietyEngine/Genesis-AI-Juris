"use client";
import { useEffect, useState } from "react";
import { useNavigationSession } from "../NavigationSession";
import {
  useInterfaceLocale,
  useWorkspaceLocation,
} from "../use-interface-locale";
import { WorkspaceIcon } from "../CaseVantIcon";
import type { Entry, Filter } from "./feed";
import styles from "./activity.module.css";

const labels = {
  all: ["All", "Все"],
  invoice: ["Invoices", "Счета"],
  event: ["Events", "События"],
  document: ["Documents", "Документы"],
  task: ["Tasks", "Задачи"],
  deleted: ["Deleted", "Удалённые"],
  fund_request: ["Deposit requests", "Запросы средств"],
  time: ["Time entries", "Учёт времени"],
  expense: ["Expenses", "Расходы"],
} satisfies Record<Filter, string[]>;
const actions: Record<string, string[]> = {
  note_create: ["added a case note", "создание заметки"],
  note_save: ["updated a case note", "изменение заметки"],
  note_link: ["linked a source to a note", "добавление источника заметки"],
  note_unlink: ["unlinked a note source", "отвязка источника заметки"],
  added_task: ["added a task", "добавление задачи"],
  updated_task: ["updated a task", "изменение задачи"],
  deleted_task: ["deleted a task", "удаление задачи"],
  added_event: ["added an event", "добавление события"],
  updated_event: ["updated an event", "изменение события"],
  deleted_event: ["deleted an event", "удаление события"],
  document_created: ["added a document", "добавление документа"],
  document_version_created: [
    "added a document version",
    "новая версия документа",
  ],
  dossier_created: ["created a case", "создание дела"],
  participant_changed: [
    "changed case participants",
    "изменение участников дела",
  ],
  invoice: ["recorded an invoice", "регистрация счёта"],
  time: ["recorded time", "учёт времени"],
  expense: ["recorded an expense", "регистрация расхода"],
  fund_request: ["requested funds", "запрос средств"],
  payment: ["recorded a payment", "регистрация платежа"],
  reconcile: ["reconciled a transaction", "сверка операции"],
  trust_deposit: [
    "recorded a trust deposit",
    "поступление доверительных средств",
  ],
  trust_withdrawal: [
    "recorded a trust withdrawal",
    "списание доверительных средств",
  ],
  void: ["voided a billing entry", "аннулирование финансовой записи"],
  plan: ["recorded a payment plan", "регистрация графика платежей"],
  dossier_status_transitioned: [
    "changed the case status",
    "изменение статуса дела",
  ],
  snapshot_created: ["saved a case snapshot", "сохранение снимка дела"],
  source_anchor_reviewed: ["reviewed a source reference", "проверка ссылки на источник"],
  assertion_reviewed: ["reviewed an assertion", "проверка утверждения"],
  evidence_link_changed: ["changed an evidence link", "изменение связи с доказательством"],
  information_request_changed: ["changed an information request", "изменение запроса сведений"],
  proposal_reviewed: ["reviewed a proposal", "проверка предложения"],
  proposal_generation_completed: ["generated a proposal", "создание предложения"],
  decision_package_linked: ["linked a decision package", "привязка пакета решения"],
  output_generated: ["generated an output", "создание результата"],
  output_approved: ["approved an output", "утверждение результата"],
  output_marked_stale: ["marked an output as outdated", "результат отмечен как устаревший"],
  legacy_case_migration_requested: ["requested case migration", "запрос переноса дела"],
  admin_archive_override: ["changed case archiving", "изменение архивации дела"],
};
const keys = Object.keys(labels) as Filter[];
function relative(stamp: string, locale: string) {
  const seconds = (Date.parse(stamp) - Date.now()) / 1000;
  const unit =
    Math.abs(seconds) >= 86400
      ? "day"
      : Math.abs(seconds) >= 3600
        ? "hour"
        : Math.abs(seconds) >= 60
          ? "minute"
          : "second";
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(
      seconds / { day: 86400, hour: 3600, minute: 60, second: 1 }[unit],
    ),
    unit,
  );
}
export default function RecentActivity({
  history = false,
}: {
  history?: boolean;
}) {
  const session = useNavigationSession(),
    [locale] = useInterfaceLocale(),
    location = useWorkspaceLocation();
  if (
    session.phase !== "ready" ||
    session.busy ||
    session.endingSession ||
    !session.selected
  )
    return null;
  const candidate = new URL(
    location,
    "https://workspace.invalid",
  ).searchParams.get("filter") as Filter;
  return (
    <Feed
      key={
        session.selected.selection +
        ":" +
        session.actorId +
        ":" +
        history +
        ":" +
        candidate
      }
      scope={session.selected.selection}
      locale={locale}
      history={history}
      initial={history && keys.includes(candidate) ? candidate : "all"}
    />
  );
}
function Feed({
  scope,
  locale,
  history,
  initial,
}: {
  scope: string;
  locale: "en" | "ru";
  history: boolean;
  initial: Filter;
}) {
  const lang = Number(locale === "ru"),
    t = (en: string, ru: string) => (lang ? ru : en);
  const [filter, setFilter] = useState(initial),
    [cursor, setCursor] = useState<Entry | null>(null),
    [rows, setRows] = useState<Entry[]>([]);
  const [more, setMore] = useState(false),
    [status, setStatus] = useState<"loading" | "ready" | "error">("loading"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams({ filter, history: history ? "1" : "0" });
    if (cursor) {
      query.set("before", cursor.stamp);
      query.set("id", cursor.id);
    }
    (async () => {
      const response = await fetch("/api/activity?" + query, {
        headers: { "x-genesis-organization": scope },
        cache: "no-store",
        signal: abort.signal,
      });
      if (!response.ok) {
        if (!abort.signal.aborted && [401,403,404].includes(response.status)) {
          setRows([]);
          setMore(false);
        }
        throw Error();
      }
      const data = (await response.json()) as {
        scope: string;
        rows: Entry[];
        more: boolean;
      };
      if (data.scope !== scope || !Array.isArray(data.rows)) throw Error();
      if (!abort.signal.aborted) {
        setRows((old) => (cursor ? [...old, ...data.rows] : data.rows));
        setMore(data.more);
        setStatus("ready");
      }
    })().catch(() => {
      if (!abort.signal.aborted) setStatus("error");
    });
    return () => abort.abort();
  }, [filter, scope, history, cursor, retry]);
  const href = (path: string) => {
    const url = new URL(path, "https://workspace.invalid");
    url.searchParams.set("organization", scope);
    url.searchParams.set("lang", locale);
    return url.pathname + url.search;
  };
  const title = t("Recent activities", "Последние действия");
  return (
    <section className={styles.card} aria-label={title}>
      {history ? (
        <>
          <a href={href("/work?view=home")}>
            {t("Back to Home", "На главную")}
          </a>
          <h1>{title}</h1>
        </>
      ) : (
        <h3>{title}</h3>
      )}
      <div
        className={styles.filters}
        role="group"
        aria-label={t("Activity filters", "Фильтры действий")}
      >
        {(history ? keys : keys.slice(0, 6)).map((k) => (
          <button
            key={k}
            aria-pressed={k === filter}
            onClick={() => {
              if (k !== filter) {
                setRows([]);
                setCursor(null);
                setMore(false);
                setStatus("loading");
                setFilter(k);
              }
            }}
          >
            {labels[k][lang]}
          </button>
        ))}
      </div>
      <ol className={styles.rows}>
        {rows.map((row) => {
          const section = ["document", "note"].includes(row.category)
            ? "documents"
            : row.category === "task"
              ? "tasks"
              : row.category === "event"
                ? "calendar"
                : "overview";
          const casePath =
            "/matters?collection=team&dossier=" +
            encodeURIComponent(row.caseId ?? "");
          const target = row.id.startsWith("bill:")
            ? "/billing?dossier=" + encodeURIComponent(row.caseId!)
            : row.caseId
              ? casePath +
                "&section=" +
                section +
                (row.docId ? "&target=" + encodeURIComponent(row.docId) : "")
              : row.category === "document"
                ? "/library?view=firm"
                : "/work?view=" +
                  (row.category === "event" ? "calendar" : "tasks");
          return (
            <li key={row.id}>
              <WorkspaceIcon
                name={
                  row.category === "document"
                    ? "document"
                    : row.category === "task"
                      ? "tasks"
                      : row.category === "event"
                        ? "calendar"
                        : "clock"
                }
              />
              <div>
                <strong>
                  {row.actor || t("Workspace member", "Участник команды")}
                </strong>
                {" · "}
                {
                  (actions[row.action] ?? [
                    "updated the case record",
                    "изменение записи дела",
                  ])[lang]
                }{" "}
                {row.subject &&
                  (row.category === "deleted" ? (
                    row.subject
                  ) : (
                    <a href={href(target)}>{row.subject}</a>
                  ))}
                <small>
                  <time
                    dateTime={row.stamp}
                    title={new Date(row.stamp).toLocaleString(locale)}
                  >
                    {relative(row.stamp, locale)}
                  </time>
                  {row.caseId && (
                    <>
                      {" "}
                      · <a href={href(casePath)}>{row.caseTitle}</a>
                    </>
                  )}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      {status === "loading" && (
        <p role="status">{t("Loading activity…", "Загрузка действий…")}</p>
      )}
      {status === "error" && (
        <p role="alert">
          {t("Could not load activity.", "Не удалось загрузить действия.")}{" "}
          <button onClick={() => { setStatus("loading"); setRetry((x) => x + 1); }}>
            {t("Retry", "Повторить")}
          </button>
        </p>
      )}
      {status === "ready" && !rows.length && (
        <p role="status">
          {t("No recent activity available.", "Недавних действий нет.")}
        </p>
      )}
      {history ? (
        more &&
        status === "ready" && (
          <button onClick={() => { setStatus("loading"); setCursor(rows[rows.length - 1]); }}>
            {t("Show older activity", "Показать более ранние действия")}
          </button>
        )
      ) : (
        <a href={href("/activity?filter=" + filter)}>
          {t("View all activity", "Все действия")}
        </a>
      )}
    </section>
  );
}
