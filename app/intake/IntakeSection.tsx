"use client";
import { useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import { IntakeController } from "./intake-controller";
import { hasAnswers, type IntakeRecord } from "./intake-model";
import { words, statusLabel, intakeMessage, type Locale } from "./intake-copy";
import lib from "../library/library.module.css";
import styles from "./intake.module.css";

function downloadForm(r: IntakeRecord, caseName: string, locale: Locale) {
  const t = words(locale),
    text = [
      r.title,
      t("Case", "Дело") + ": " + caseName,
      t("Status", "Статус") + ": " + statusLabel(r.status, locale),
      ...r.questions.map((q, i) => q.label + "\n" + (r.answers[i] || t("No answer", "Нет ответа"))),
    ].join("\n\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })),
    a = document.createElement("a");
  a.href = url;
  a.download = (r.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 90) || "intake") + ".txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function IntakeSection({
  controller,
  locale,
  currentCase,
}: {
  controller: IntakeController;
  locale: Locale;
  currentCase: string | null;
}) {
  const s = controller.getSnapshot(),
    t = words(locale);
  const [mode, setMode] = useState<"forms" | "designs">("forms"),
    [scope, setScope] = useState(currentCase ?? ""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [starting, setStarting] = useState(false),
    [template, setTemplate] = useState("");
  const records = s.records,
    templates = records.filter((r) => r.status === "available"),
    caseName = (id: string | null) => s.cases.find((c) => c.id === id)?.title ?? "";
  const saved = s.notice && records.find((r) => r.id === s.selected),
    designs = saved ? !saved.caseId : mode === "designs";
  const caseFilter = saved && saved.caseId ? saved.caseId : s.cases.some((c) => c.id === scope) ? scope : "";
  const filtered = records
    .filter(
      (r) =>
        (designs ? !r.caseId : !!r.caseId) &&
        (!caseFilter || designs || r.caseId === caseFilter) &&
        (!status || !!saved || r.status === status) &&
        (!query ||
          !!saved ||
          [r.title, caseName(r.caseId)].some((v) =>
            v.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)),
          )),
    )
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.title.localeCompare(b.title, locale));
  const active = filtered.find((r) => r.id === s.selected) ?? filtered[0],
    busy = s.loading || s.saving || s.locked || !!s.pending;
  function change(view: "forms" | "designs") {
    setMode(view);
    setQuery("");
    setStatus("");
    setStarting(false);
    controller.select("");
  }
  const act = (action: "archive" | "restore" | "reopen") => {
    if (active) void controller.save({ action, id: active.id, revision: active.revision });
  };
  const formCase = caseFilter || currentCase || "",
    writable = s.cases.some((c) => c.canEdit);
  const showBadge = (r: IntakeRecord) => (
    <StatusBadge
      tone={
        r.status === "complete"
          ? "completed"
          : r.status === "archived"
            ? "past"
            : r.status === "available"
              ? "scheduled"
              : "open"
      }
    >
      {statusLabel(r.status, locale)}
    </StatusBadge>
  );
  return (
    <section className={lib.firm} aria-labelledby="intake-heading">
      <div className={lib.commandRow}>
        <div>
          <h2 id="intake-heading">{t("Intake forms", "Приёмные формы")}</h2>
          <p>
            {t(
              "Collect information for a case using your firm’s questionnaires.",
              "Собирайте сведения по делу с помощью анкет фирмы.",
            )}
          </p>
        </div>
        {s.loaded &&
          s.canWrite &&
          (designs ? (
            <button className={lib.primary} disabled={busy} onClick={() => controller.design()}>
              <WorkspaceIcon name="plus" />
              {t("New questionnaire", "Новая анкета")}
            </button>
          ) : templates.length && writable ? (
            <button
              className={lib.primary}
              disabled={busy}
              onClick={() => {
                setStarting(true);
                setTemplate(templates.length === 1 ? templates[0].id : "");
              }}
            >
              <WorkspaceIcon name="plus" />
              {t("New intake form", "Новая форма")}
            </button>
          ) : !templates.length ? (
            <button className={lib.primary} disabled={busy} onClick={() => controller.design()}>
              <WorkspaceIcon name="plus" />
              {t("Create first questionnaire", "Создать первую анкету")}
            </button>
          ) : null)}
      </div>
      {!s.loaded ? (
        <div role="status">
          <p>{s.issue ? intakeMessage(s.issue, locale) : t("Loading intake forms…", "Загрузка форм…")}</p>
          {s.issue && (
            <button disabled={s.loading} onClick={() => void controller.refresh()}>
              {t("Retry", "Повторить")}
            </button>
          )}
        </div>
      ) : (
        <>
          <nav className={styles.modes} aria-label={t("Intake views", "Представления форм")}>
            <button aria-pressed={!designs} disabled={busy} onClick={() => change("forms")}>
              <WorkspaceIcon name="document" />
              {t("Case forms", "Формы дел")}
            </button>
            <button aria-pressed={designs} disabled={busy} onClick={() => change("designs")}>
              <WorkspaceIcon name="template" />
              {t("Questionnaires", "Анкеты")}
            </button>
          </nav>
          {s.notice && (
            <p role="status" className={lib.message}>
              {intakeMessage(s.notice, locale)}
            </p>
          )}
          {s.issue && !s.draft && (
            <div className={lib.recovery} role="alert">
              {intakeMessage(s.issue, locale)}{" "}
              {s.pending && (
                <button disabled={s.saving} onClick={() => void controller.save()}>
                  {t("Check original save", "Проверить сохранение")}
                </button>
              )}
            </div>
          )}
          {starting && !designs && (
            <div className={lib.destination}>
              <label>
                {t("Choose a questionnaire", "Выберите анкету")}
                <select
                  autoFocus
                  className={styles.select}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="">{t("Select…", "Выберите…")}</option>
                  {templates.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className={lib.actions}>
                <button
                  disabled={busy || !templates.some((q) => q.id === template)}
                  onClick={() => {
                    const q = templates.find((v) => v.id === template);
                    if (q) {
                      setStarting(false);
                      controller.answer(q, formCase);
                    }
                  }}
                >
                  {t("Continue to form", "Перейти к форме")}
                </button>
                <button onClick={() => setStarting(false)}>{t("Cancel", "Отмена")}</button>
              </div>
            </div>
          )}
          <div className={styles.filters}>
            {!designs && (
              <label>
                {t("Case", "Дело")}
                <select
                  value={caseFilter}
                  onChange={(e) => {
                    setMode("forms");
                    controller.select("");
                    setScope(e.target.value);
                  }}
                >
                  <option value="">{t("All accessible cases", "Все доступные дела")}</option>
                  {s.cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t("Status", "Статус")}
              <select
                value={saved ? "" : status}
                onChange={(e) => {
                  setMode(designs ? "designs" : "forms");
                  controller.select("");
                  setStatus(e.target.value);
                }}
              >
                <option value="">{t("All statuses", "Все статусы")}</option>
                {(designs ? (["available", "archived"] as const) : (["draft", "complete"] as const)).map(
                  (k) => (
                    <option key={k} value={k}>
                      {statusLabel(k, locale)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              {t("Search", "Поиск")}
              <input
                type="search"
                value={saved ? "" : query}
                onChange={(e) => {
                  setMode(designs ? "designs" : "forms");
                  controller.select("");
                  setQuery(e.target.value);
                }}
              />
            </label>
          </div>
          <div className={styles.panes}>
            <section
              className={lib.list}
              aria-label={
                designs ? t("Questionnaire list", "Список анкет") : t("Case form list", "Список форм")
              }
            >
              <h3>
                {designs ? t("Questionnaires", "Анкеты") : t("Case forms", "Формы дел")}{" "}
                <span className={styles.count}>{filtered.length}</span>
              </h3>
              {filtered.length ? (
                <ul className={lib.rows}>
                  {filtered.map((r) => (
                    <li key={r.id}>
                      <button
                        className={lib.documentRow}
                        aria-pressed={r.id === active?.id}
                        onClick={() => {
                          setMode(designs ? "designs" : "forms");
                          setScope(caseFilter);
                          if (saved) {
                            setQuery("");
                            setStatus("");
                          }
                          controller.select(r.id);
                        }}
                      >
                        <span className={lib.glyph}>
                          <WorkspaceIcon name={r.caseId ? "document" : "template"} />
                        </span>
                        <span>
                          <strong>{r.title}</strong>
                          <small>
                            {r.caseId ? caseName(r.caseId) + " · " : ""}
                            {statusLabel(r.status, locale)}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={lib.empty}>
                  {query || status
                    ? t("No matching results.", "Нет подходящих записей.")
                    : designs
                      ? t("No questionnaires yet.", "Анкет пока нет.")
                      : t("No intake forms for this selection.", "Для выбранных условий форм пока нет.")}
                </p>
              )}
            </section>
            <section className={lib.reading} aria-label={t("Intake details", "Сведения о форме")}>
              {active ? (
                <>
                  <div className={lib.commandRow}>
                    <h3>{active.title}</h3>
                    {showBadge(active)}
                  </div>
                  <p className={lib.meta}>
                    {active.caseId
                      ? caseName(active.caseId) +
                        " · " +
                        t("Answered", "Заполнено") +
                        " " +
                        hasAnswers(active) +
                        " / " +
                        active.questions.length
                      : t("Firm questionnaire", "Анкета фирмы") +
                        " · " +
                        t("Questions", "Вопросы") +
                        ": " +
                        active.questions.length}
                  </p>
                  <dl className={styles.responses}>
                    {active.questions.map((q, i) => (
                      <div key={i}>
                        <dt>{q.label}</dt>
                        <dd>
                          {active.caseId
                            ? active.answers[i] || t("No answer yet", "Ответа пока нет")
                            : q.required
                              ? t("Required", "Обязательный")
                              : t("Optional", "Необязательный")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className={lib.actions}>
                    {active.status === "available" && writable && (
                      <button
                        className={lib.primary}
                        disabled={busy}
                        onClick={() => controller.answer(active, formCase)}
                      >
                        <WorkspaceIcon name="plus" />
                        {t("Start intake", "Начать заполнение")}
                      </button>
                    )}
                    {active.canEdit && (
                      <>
                        {active.status === "available" && (
                          <>
                            <button disabled={busy} onClick={() => controller.design(active)}>
                              {t("Edit questionnaire", "Изменить анкету")}
                            </button>
                            <button disabled={busy} onClick={() => act("archive")}>
                              {t("Archive", "В архив")}
                            </button>
                          </>
                        )}
                        {active.status === "archived" && (
                          <button disabled={busy} onClick={() => act("restore")}>
                            {t("Restore questionnaire", "Восстановить анкету")}
                          </button>
                        )}
                        {active.status === "draft" && (
                          <button
                            className={lib.primary}
                            disabled={busy}
                            onClick={() => controller.answer(active)}
                          >
                            <WorkspaceIcon name="edit" />
                            {t("Continue draft", "Продолжить черновик")}
                          </button>
                        )}
                        {active.status === "complete" && (
                          <button disabled={busy} onClick={() => act("reopen")}>
                            {t("Reopen as draft", "Открыть как черновик")}
                          </button>
                        )}
                      </>
                    )}
                    {active.status === "complete" && (
                      <button onClick={() => downloadForm(active, caseName(active.caseId), locale)}>
                        <WorkspaceIcon name="document" />
                        {t("Download answers (.txt)", "Скачать ответы (.txt)")}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h3>
                    {designs
                      ? t("Reusable questions", "Многоразовые анкеты")
                      : t("Case intake", "Сбор сведений по делу")}
                  </h3>
                  <p>
                    {designs
                      ? t(
                          "Create a questionnaire to reuse the same questions across cases.",
                          "Создайте анкету и используйте её вопросы в разных делах.",
                        )
                      : writable
                        ? t(
                            "Start with a firm questionnaire. Save answers as a draft and complete them when ready.",
                            "Начните с анкеты фирмы. Сохраните ответы в черновике и завершите форму, когда будете готовы.",
                          )
                        : t(
                            "A case you can edit is needed to start a form.",
                            "Чтобы начать форму, нужен доступ к редактированию дела.",
                          )}
                  </p>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
