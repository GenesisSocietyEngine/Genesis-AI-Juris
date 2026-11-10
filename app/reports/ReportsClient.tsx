"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigationSession } from "../NavigationSession";
import { useInterfaceLocale } from "../use-interface-locale";
import {
  categories,
  fields,
  reports,
  type Field,
  type Report,
  type Row,
} from "./model";
import {
  csv,
  defaults,
  numeric,
  present,
  validConfig,
  type Config,
  type Saved,
} from "./config";
import { readReport } from "./read-report";
import styles from "./reports.module.css";

export default function ReportsClient() {
  const session = useNavigationSession(),
    [locale] = useInterfaceLocale();
  if (
    session.phase !== "ready" ||
    session.busy ||
    session.endingSession ||
    !session.selected
  )
    return null;
  return (
    <ReportsWorkspace
      key={session.actorId + ":" + session.selected.selection}
      scope={session.selected.selection}
      locale={locale}
    />
  );
}
export function ReportsWorkspace({
  scope,
  locale,
}: {
  scope: string;
  locale: "en" | "ru";
}) {
  const lang = locale === "en" ? 0 : 1,
    t = (en: string, ru: string) => (lang === 0 ? en : ru);
  const [config, setConfig] = useState<Config | null>(null),
    [output, setOutput] = useState<{ config: Config; rows: Row[] } | null>(
      null,
    );
  const [saved, setSaved] = useState<Saved[]>([]),
    [revision, refreshSaved] = useState(0),
    [savedError, setSavedError] = useState(false);
  const [issue, setIssue] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [name, setName] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/reports", {
          headers: { "x-genesis-organization": scope },
          cache: "no-store",
          signal: abort.signal,
        });
        const data = (await res.json()) as { scope: string; saved: Saved[] };
        if (
          !res.ok ||
          data.scope !== scope ||
          !Array.isArray(data.saved) ||
          !data.saved.every((s: Saved) => validConfig(s.config))
        )
          throw Error();
        if (!abort.signal.aborted) {
          setSaved(data.saved);
          setSavedError(false);
        }
      } catch {
        if (!abort.signal.aborted) {
          setSaved([]);
          setSavedError(true);
        }
      }
    }
    void load();
    return () => abort.abort();
  }, [scope, revision]);
  function open(next: Config | null) {
    pending.current?.abort();
    setConfig(next);
    setNotice("");
    setOutput(null);
    setIssue("");
    setBusy(false);
    setName("");
  }
  async function run(c: Config) {
    if (!validConfig(c)) {
      setIssue(
        t(
          "Choose at least one column and a valid date range.",
          "Выберите столбцы и корректный период.",
        ),
      );
      return;
    }
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    setBusy(true);
    setOutput(null);
    setIssue("");
    try {
      const rows = await readReport(
        c.report,
        scope,
        c,
        abort.signal,
        t("Firm calendar", "Календарь фирмы"),
      );
      if (!abort.signal.aborted) setOutput({ config: c, rows });
    } catch {
      if (!abort.signal.aborted)
        setIssue(
          t(
            "The complete report could not be loaded. Run it again.",
            "Не удалось загрузить полный отчёт. Запустите его снова.",
          ),
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function changeSaved(body: Record<string, unknown>) {
    setSaving(true);
    setIssue("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-genesis-organization": scope,
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { scope: string; saved: Saved[] };
      if (!res.ok || data.scope !== scope) throw Error();
      setNotice(
        body.action === "save"
          ? t("Report configuration saved.", "Настройки отчёта сохранены.")
          : t("Saved report removed.", "Отчёт удалён."),
      );
      setName("");
      refreshSaved((n) => n + 1);
    } catch {
      setIssue(
        t(
          "Could not confirm the saved report change.",
          "Не удалось подтвердить изменение сохранённого отчёта.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  const update = (patch: Partial<Config>) =>
    config && setConfig({ ...config, ...patch });
  const result = useMemo(
    () => (output ? present(output.rows, output.config, locale) : null),
    [output, locale],
  );
  const choices: Field[] = config ? reports[config.report].columns : [];
  function exportCsv() {
    if (!result || !output) return;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv(result.rows, result.columns, lang)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = output.config.report + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className={styles.page}>
      {config && (
        <button className={styles.screen} onClick={() => open(null)}>
          ← {t("Reports", "Отчёты")}
        </button>
      )}
      <h1>
        {config ? reports[config.report].title[lang] : t("Reports", "Отчёты")}
      </h1>
      {notice && <p role="status">{notice}</p>}
      {issue && <p role="alert">{issue}</p>}
      {!config ? (
        <>
          <section>
            <h2>{t("Saved reports", "Сохранённые отчёты")}</h2>
            {savedError ? (
              <button onClick={() => refreshSaved((n) => n + 1)}>
                {t(
                  "Retry loading saved reports",
                  "Загрузить сохранённые отчёты снова",
                )}
              </button>
            ) : saved.length === 0 ? (
              <p>
                {t(
                  "Run a report and save its configuration here.",
                  "Запустите отчёт и сохраните его настройки.",
                )}
              </p>
            ) : (
              saved.map((s) => (
                <div key={s.id} className={styles.actions}>
                  <button
                    onClick={() => {
                      open(s.config);
                      void run(s.config);
                    }}
                  >
                    {s.name}
                  </button>
                  <button
                    disabled={saving}
                    aria-label={t("Remove", "Удалить") + " " + s.name}
                    onClick={() =>
                      void changeSaved({ id: s.id, action: "remove" })
                    }
                  >
                    {t("Remove", "Удалить")}
                  </button>
                </div>
              ))
            )}
          </section>
          {Object.entries(categories).map(([id, labels]) => (
            <section key={id}>
              <h2>{labels[lang]}</h2>
              <div className={styles.grid}>
                {(Object.keys(reports) as Report[])
                  .filter((k) => reports[k].group === id)
                  .map((k) => (
                    <button key={k} onClick={() => open(defaults(k))}>
                      {reports[k].title[lang]} →
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <>
          <p>
            {t(
              "Includes records you can access in this organization.",
              "Включены доступные вам записи этой организации.",
            )}
          </p>
          {config.report === "limitations" && (
            <p>
              {t(
                "Includes dated case tasks and events marked as a statute of limitations date.",
                "Включены задачи и события дел с отметкой срока исковой давности.",
              )}
            </p>
          )}
          {config.report === "fees" && (
            <p>
              {t(
                "Collected fees are allocated by the value of each time entry on the invoice. Expense shares are excluded.",
                "Полученные гонорары распределяются по стоимости записей времени в счёте. Доли расходов исключены.",
              )}
            </p>
          )}
          {config.report === "consultations" && (
            <p>
              {t(
                "Includes invoices marked as consultation fees.",
                "Включены счета с отметкой оплаты консультации.",
              )}
            </p>
          )}
          <form
            className={styles.screen}
            onSubmit={(e) => {
              e.preventDefault();
              void run(config);
            }}
          >
            <details>
              <summary>{t("Customize report", "Настроить отчёт")}</summary>
              <fieldset>
                <legend>{t("Filters", "Фильтры")}</legend>
                <div className={styles.grid}>
                  {reports[config.report].source !== "contacts" && (
                    <>
                      {!["balances", "trustSummary"].includes(
                        config.report,
                      ) && (
                        <label>
                          {t("From", "С даты")}
                          <input
                            type="date"
                            value={config.from}
                            onChange={(e) => update({ from: e.target.value })}
                          />
                        </label>
                      )}
                      <label>
                        {t("Through", "По дату")}
                        <input
                          type="date"
                          value={config.to}
                          min={config.from}
                          onChange={(e) => update({ to: e.target.value })}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    {t("Filter column", "Столбец фильтра")}
                    <select
                      value={config.filter}
                      onChange={(e) =>
                        update({ filter: e.target.value as Field | "" })
                      }
                    >
                      <option value="">
                        {t("All columns", "Все столбцы")}
                      </option>
                      {choices.map((f) => (
                        <option key={f} value={f}>
                          {fields[f][lang]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Contains text", "Содержит текст")}
                    <input
                      value={config.query}
                      maxLength={150}
                      onChange={(e) => update({ query: e.target.value })}
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>{t("Columns", "Столбцы")}</legend>
                <div className={styles.grid}>
                  {choices.map((f) => (
                    <label key={f}>
                      <input
                        type="checkbox"
                        checked={config.columns.includes(f)}
                        onChange={(e) =>
                          update({
                            columns: e.target.checked
                              ? [...config.columns, f]
                              : config.columns.filter((k) => k !== f),
                          })
                        }
                      />
                      {fields[f][lang]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className={styles.grid}>
                {(["sort", "group", "calculate"] as const).map((key) => (
                  <label key={key}>
                    {
                      {
                        sort: t("Sort by", "Сортировать по"),
                        group: t("Group by", "Группировать по"),
                        calculate: t("Sum", "Сумма"),
                      }[key]
                    }
                    <select
                      value={config[key]}
                      onChange={(e) => update({ [key]: e.target.value })}
                    >
                      {key !== "sort" && (
                        <option value="">{t("None", "Нет")}</option>
                      )}
                      {choices
                        .filter(
                          (f) => key !== "calculate" || numeric.includes(f),
                        )
                        .map((f) => (
                          <option key={f} value={f}>
                            {fields[f][lang]}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={config.descending}
                    onChange={(e) => update({ descending: e.target.checked })}
                  />
                  {t("Descending", "По убыванию")}
                </label>
              </div>
            </details>
            <button disabled={busy}>
              {busy
                ? t("Running…", "Выполняется…")
                : t("Run report", "Запустить отчёт")}
            </button>
          </form>
          {result && output && (
            <section aria-live="polite">
              <h2>
                {t("Results", "Результаты")} · {result.rows.length}
              </h2>
              {result.total !== null && output.config.calculate && (
                <p>
                  {fields[output.config.calculate][lang]} ·{" "}
                  {new Intl.NumberFormat(locale).format(result.total)}
                </p>
              )}
              {result.rows.length === 0 ? (
                <p>
                  {t(
                    "No records match these settings.",
                    "Нет записей, соответствующих настройкам.",
                  )}
                </p>
              ) : (
                <div className={styles.table}>
                  <table>
                    <thead>
                      <tr>
                        {result.columns.map((f) => (
                          <th scope="col" key={f}>
                            {fields[f][lang]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>
                          {result.columns.map((f) => (
                            <td key={f}>
                              {typeof row[f] === "number"
                                ? new Intl.NumberFormat(locale, {
                                    maximumFractionDigits: 2,
                                  }).format(Number(row[f]))
                                : row[f] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className={styles.actions}>
                <button onClick={() => void run(output.config)}>
                  {t("Refresh data", "Обновить данные")}
                </button>
                <button onClick={exportCsv}>
                  {t("Export CSV", "Экспорт CSV")}
                </button>
                <button onClick={() => window.print()}>
                  {t("Print", "Печать")}
                </button>
              </div>
              <form
                className={styles.screen}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim())
                    void changeSaved({
                      action: "save",
                      id: "report_" + crypto.randomUUID().replaceAll("-", ""),
                      name,
                      config: output.config,
                    });
                }}
              >
                <label>
                  {t("Report name", "Название отчёта")}
                  <input
                    required
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button disabled={saving}>
                  {t("Save report configuration", "Сохранить настройки отчёта")}
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </main>
  );
}
