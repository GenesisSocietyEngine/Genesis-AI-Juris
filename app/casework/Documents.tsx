"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import { Feedback, useCasework } from "./Host";
import { words, when } from "./presentation";
import { describeTemplate, tokens, tokenLabel, type Locale, type WorkRecord } from "./model";
import lib from "../library/library.module.css";
import css from "./casework.module.css";
export default function Documents({
  locale,
  current,
  generated,
}: {
  locale: Locale;
  current: string;
  generated: boolean;
}) {
  const { controller: c, s } = useCasework(),
    t = words(locale),
    [tab, setTab] = useState<"active" | "archived" | "documents">(generated ? "documents" : "active"),
    [q, setQ] = useState(""),
    [caseFilter, setCase] = useState(generated ? current : ""),
    [pick, setPick] = useState(""),
    pane = useRef<HTMLElement>(null);
  const doc = tab === "documents",
    available = s.records.filter((r) =>
      doc
        ? r.kind === "document" && (!caseFilter || r.caseId === caseFilter)
        : r.kind === "template" && r.archived === (tab === "archived"),
    );
  const items = available
    .filter((r) => r.title.toLocaleLowerCase(locale).includes(q.trim().toLocaleLowerCase(locale)))
    .sort((a, b) => a.title.localeCompare(b.title, locale) || a.id.localeCompare(b.id));
  const selected = items.find((r) => r.id === (s.selected || pick));
  const opened = selected?.id;
  useEffect(() => {
    if (opened) pane.current?.focus({ preventScroll: !window.matchMedia("(max-width:680px)").matches });
  }, [opened]);
  const choose = (id: string) => {
      setPick(id);
      c.select(id);
    },
    change = (v: typeof tab) => {
      setTab(v);
      setQ("");
      choose("");
    };
  const download = async (r: WorkRecord) => {
    const b = await c.download(r.id);
    if (!b) return;
    const a = document.createElement("a"),
      u = URL.createObjectURL(b);
    a.href = u;
    a.download = (r.title.replace(/[\\/:*?"<>|]/g, "_") || "Document") + ".docx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  return (
    <section className={lib.firm}>
      <div className={lib.commandRow}>
        <div>
          <h2>{t("Document templates", "Шаблоны документов")}</h2>
          <p>
            {t(
              "Prepare a Word document from a firm template and save the reviewed text to a case.",
              "Подготовьте документ Word по шаблону фирмы и сохраните проверенный текст в деле.",
            )}
          </p>
        </div>
        {s.canWrite && (
          <button className={lib.primary} disabled={!c.editable()} onClick={() => c.template()}>
            <WorkspaceIcon name="template" />
            {t("New template", "Новый шаблон")}
          </button>
        )}
      </div>
      <details><summary>{t("Template merge fields", "Поля подстановки шаблонов")}</summary>
        <dl>{(Object.keys(tokens) as (keyof typeof tokens)[]).map(key =>
          <div key={key}><dt>{tokenLabel(key, locale)}</dt><dd><code>{"{{" + key + "}}"}</code></dd></div>
        )}</dl>
      </details>
      <div className={lib.tabs} aria-label={t("Document collections", "Коллекции документов")}>
        {(["active", "documents", "archived"] as const).map((v, i) => (
          <button key={v} aria-current={tab === v ? "page" : undefined} onClick={() => change(v)}>
            {
              [
                t("Available templates", "Доступные шаблоны"),
                t("Generated documents", "Созданные документы"),
                t("Archived templates", "Архив шаблонов"),
              ][i]
            }
          </button>
        ))}
      </div>
      <Feedback locale={locale} />
      {s.notice === "generate" && !doc && (
        <button
          onClick={() => {
            setTab("documents");
            setQ("");
            setCase("");
          }}
        >
          {t("View saved document", "Открыть сохранённый документ")}
        </button>
      )}
      <div className={css.filters}>
        <label>
          {t("Search by name", "Поиск по названию")}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {doc && (
          <label>
            {t("Case", "Дело")}
            <select value={caseFilter} onChange={(e) => setCase(e.target.value)}>
              <option value="">{t("All accessible cases", "Все доступные дела")}</option>
              {s.cases.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {s.loaded && (
        <div className={css.layout}>
          <section>
            <h3>
              {doc ? t("Documents", "Документы") : t("Templates", "Шаблоны")} · {items.length}
            </h3>
            {items.length ? (
              <ul className={lib.rows}>
                {items.map((r) => (
                  <li key={r.id}>
                    <button
                      className={lib.documentRow}
                      aria-pressed={selected?.id === r.id}
                      onClick={() => choose(r.id)}
                    >
                      <span className={css.rowTitle}>
                        <WorkspaceIcon name={doc ? "document" : "template"} />
                        <span>
                          <strong>{r.title}</strong>
                          <small>
                            {doc
                              ? s.cases.find((v) => v.id === r.caseId)?.title
                              : t("Version", "Версия") + " " + r.revision}
                          </small>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {q
                  ? t("No matches.", "Совпадений нет.")
                  : doc
                    ? t("No generated documents in this selection.", "В выборке нет созданных документов.")
                    : t("No templates in this collection.", "В этой коллекции пока нет шаблонов.")}
              </p>
            )}
          </section>
          <section ref={pane} tabIndex={-1} aria-label={t("Reading pane", "Область чтения")}>
            {selected ? (
              <>
                <h3>{selected.title}</h3>
                <StatusBadge tone={doc ? "completed" : selected.archived ? "neutral" : "scheduled"}>
                  {doc
                    ? t("Saved to case", "Сохранено в деле")
                    : selected.archived
                      ? t("Archived", "В архиве")
                      : t("Available", "Доступен")}
                </StatusBadge>
                {doc && (
                  <p>
                    {t("Case: ", "Дело: ")}
                    <strong>{s.cases.find((v) => v.id === selected.caseId)?.title}</strong>
                  </p>
                )}
                <small>
                  {doc
                    ? t("Template version", "Версия шаблона") + " " + selected.sourceRevision
                    : t("Version", "Версия") + " " + selected.revision}{" "}
                  · {when(selected.savedAt, locale)}
                </small>
                <div className={css.commands}>
                  {doc ? (
                    <button onClick={() => void download(selected)}>
                      {t("Download Word document", "Скачать документ Word")}
                    </button>
                  ) : (
                    s.canWrite && (
                      <>
                        {!selected.archived && (
                          <>
                            <button
                              className={lib.primary}
                              disabled={!c.editable() || !s.cases.some((v) => v.canEdit)}
                              onClick={() => c.generate(selected, current, locale)}
                            >
                              {t("Create case document", "Создать документ дела")}
                            </button>
                            <button disabled={!c.editable()} onClick={() => c.template(selected)}>
                              {t("Edit template", "Изменить шаблон")}
                            </button>
                          </>
                        )}
                        <button
                          disabled={!c.editable()}
                          onClick={() =>
                            void c.save({
                              id: selected.id,
                              revision: selected.revision,
                              action: selected.archived ? "restore" : "archive",
                            })
                          }
                        >
                          {selected.archived
                            ? t("Restore template", "Восстановить шаблон")
                            : t("Archive template", "В архив")}
                        </button>
                      </>
                    )
                  )}
                </div>
                {!doc && !selected.archived && s.canWrite && !s.cases.some((v) => v.canEdit) && (
                  <p>
                    {t(
                      "An editable case is required to generate a document.",
                      "Для создания документа нужен доступ к редактированию дела.",
                    )}
                  </p>
                )}
                <div className={css.paper}>{doc ? selected.body : describeTemplate(selected.body, locale)}</div>
              </>
            ) : (
              <p>
                {doc
                  ? t(
                      "Select a document to read or download it.",
                      "Выберите документ для просмотра или скачивания.",
                    )
                  : t(
                      "Select a template to preview or use it.",
                      "Выберите шаблон для просмотра или использования.",
                    )}
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
