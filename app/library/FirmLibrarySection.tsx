"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import type { LibraryController } from "./library-controller";
import type { FirmDocument } from "./firm-document-model";
import styles from "./library.module.css";
type Props = {
  controller: LibraryController;
  state: ReturnType<LibraryController["getSnapshot"]>;
  locale: "en" | "ru";
  download: (doc: FirmDocument) => Promise<void>;
};
export default function FirmLibrarySection({ controller, state, locale, download }: Props) {
  const [folder, setFolder] = useState(""),
    [query, setQuery] = useState(""),
    [picked, setPicked] = useState(""),
    [limit, setLimit] = useState(30);
  const pane = useRef<HTMLElement>(null);
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en),
    blocked = state.locked || state.saving || Boolean(state.draft) || Boolean(state.pending);
  const visible = state.documents
    .filter(
      (d) =>
        (!folder || d.folder === folder) &&
        `${d.title} ${d.filename} ${d.folder}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.title.localeCompare(b.title));
  const selected = visible.find((v) => v.id === picked),
    history = selected && state.history[0]?.id === selected.id ? state.history : [];
  const dated = (v: string) => new Date(v).toLocaleDateString(locale, { dateStyle: "medium" });
  useEffect(() => {
    if (picked) pane.current?.focus();
  }, [picked]);
  const chooseFolder = (value: string) => {
    setFolder(value);
    setPicked("");
    setLimit(30);
  };
  return (
    <section className={styles.firm} aria-label={t("Firm documents", "Документы фирмы")}>
      {state.incomplete.length > 0 && (
        <section className={styles.recovery}>
          <h3>{t("Your incomplete uploads", "Ваши незавершённые загрузки")}</h3>
          <p>
            {t(
              "Resume with the same original file, or cancel without publishing a version.",
              "Для продолжения выберите тот же файл или отмените загрузку без публикации версии.",
            )}
          </p>
          {state.incomplete.map((v) => (
            <div className={styles.commandRow} key={v.key}>
              <span>
                <strong>{v.title}</strong>
                <small>{v.filename}</small>
              </span>
              <button disabled={blocked || !state.canWrite} onClick={() => controller.resume(v)}>
                {t("Resume upload", "Продолжить загрузку")}
              </button>
              <button
                disabled={blocked || !state.canWrite}
                onClick={() => void controller.cancelIncomplete(v.key)}
              >
                {t("Cancel incomplete upload", "Отменить незавершённую загрузку")}
              </button>
            </div>
          ))}
        </section>
      )}
      <div className={styles.panes}>
        <aside className={styles.folders} aria-label={t("Folders", "Папки")}>
          <h3>{t("Folders", "Папки")}</h3>
          <button aria-pressed={!folder} onClick={() => chooseFolder("")}>
            <WorkspaceIcon name="document" />
            {t("All firm documents", "Все документы фирмы")}
          </button>
          {state.folders.map((f) => (
            <button key={f} aria-pressed={folder === f} onClick={() => chooseFolder(f)}>
              <WorkspaceIcon name="cases" />
              {f}
            </button>
          ))}
          {state.canWrite && (
            <button disabled={blocked} onClick={() => controller.editFolder()}>
              <WorkspaceIcon name="plus" />
              {t("New folder", "Новая папка")}
            </button>
          )}
        </aside>
        <section className={styles.list}>
          <div className={styles.commandRow}>
            <div>
              <h2>{folder || t("Firm documents", "Документы фирмы")}</h2>
              <p>
                {t(
                  "Shared with active organization members. Case evidence is stored in its case.",
                  "Доступно активным участникам организации. Доказательства хранятся в деле.",
                )}
              </p>
            </div>
            {state.canWrite && (
              <button
                className={styles.primary}
                disabled={blocked || !state.loaded}
                onClick={() => controller.edit(undefined, folder)}
              >
                <WorkspaceIcon name="upload" />
                {t("Upload document", "Загрузить документ")}
              </button>
            )}
          </div>
          <label className={styles.search}>
            <WorkspaceIcon name="search" />
            <input
              aria-label={t("Search documents", "Поиск документов")}
              type="search"
              placeholder={t("Search title, file or folder…", "Название, файл или папка…")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(30);
                setPicked("");
              }}
            />
          </label>
          {!state.loaded ? (
            <p role="status">
              {state.issue
                ? t("Documents unavailable. Refresh to retry.", "Документы недоступны. Обновите библиотеку.")
                : t("Loading documents…", "Загрузка документов…")}
            </p>
          ) : (
            <>
              <small>
                {t("Documents", "Документы")}: {visible.length}
                {!state.canWrite ? ` · ${t("Read-only", "Только чтение")}` : ""}
              </small>
              <ul className={styles.rows}>
                {visible.slice(0, limit).map((v) => (
                  <li key={v.id}>
                    <button
                      className={styles.documentRow}
                      aria-pressed={picked === v.id}
                      onClick={() => {
                        setPicked(v.id);
                        void controller.versions(v.id);
                      }}
                    >
                      <span className={styles.glyph}>
                        <WorkspaceIcon name="document" />
                      </span>
                      <span>
                        <strong>{v.title}</strong>
                        <small>{v.filename}</small>
                        <StatusBadge tone="completed">{t("Saved", "Сохранено")}</StatusBadge>
                      </span>
                      <span className={styles.meta}>
                        {t("Version", "Версия")} {v.version}
                        <small>{dated(v.occurredAt)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {visible.length > limit && (
                <button onClick={() => setLimit((n) => n + 30)}>
                  {t("Show more documents", "Показать ещё")}
                </button>
              )}
              {!visible.length && (
                <div className={styles.empty}>
                  <WorkspaceIcon name={query ? "search" : "document"} />
                  <h3>
                    {query
                      ? t("No matching documents", "Документы не найдены")
                      : t("No documents here yet", "Здесь пока нет документов")}
                  </h3>
                  <p>
                    {query
                      ? t(
                          "Try another title, file name or folder.",
                          "Попробуйте другое название, имя файла или папку.",
                        )
                      : state.canWrite
                        ? t(
                            "Upload an original or create a folder to organize firm files.",
                            "Загрузите оригинал или создайте папку для документов фирмы.",
                          )
                        : t(
                            "Shared firm documents will appear here.",
                            "Здесь появятся общие документы фирмы.",
                          )}
                  </p>
                  {query && (
                    <button onClick={() => setQuery("")}>{t("Clear search", "Очистить поиск")}</button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <aside
          className={styles.reading}
          ref={pane}
          tabIndex={-1}
          aria-label={t("Document details", "Сведения о документе")}
        >
          {selected ? (
            <>
              <h3>{selected.title}</h3>
              <StatusBadge tone="completed">
                {t("Saved to firm Library", "Сохранено в библиотеке фирмы")}
              </StatusBadge>
              <p>{selected.folder || t("Firm documents · no folder", "Документы фирмы · без папки")}</p>
              <div className={styles.actions}>
                <button onClick={() => void download(selected)}>
                  {t("Download current version", "Скачать текущую версию")}
                </button>
                {state.canWrite && (
                  <button disabled={blocked} onClick={() => controller.edit(selected)}>
                    <WorkspaceIcon name="upload" />
                    {t("New version", "Новая версия")}
                  </button>
                )}
              </div>
              <h3>{t("Version history", "История версий")}</h3>
              {history.length ? (
                <ol className={styles.history}>
                  {history.map((v) => (
                    <li key={v.version}>
                      <strong>
                        {t("Version", "Версия")} {v.version}
                        {v.version === selected.version
                          ? ` · ${t("Current", "Текущая")}`
                          : v.version === 1
                            ? ` · ${t("Original", "Исходная")}`
                            : ""}
                      </strong>
                      <span>{v.filename}</span>
                      <small>
                        {dated(v.occurredAt)} · {Math.max(1, Math.ceil(v.bytes / 1024))} KB
                      </small>
                      <button onClick={() => void download(v)}>
                        {t("Download version", "Скачать версию")} {v.version}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <button onClick={() => void controller.versions(selected.id)}>
                  {t("Load version history", "Загрузить историю версий")}
                </button>
              )}
              {state.nextVersion && history.length > 0 && (
                <button onClick={() => void controller.versions(selected.id, true)}>
                  {t("Load older versions", "Загрузить ранние версии")}
                </button>
              )}
              <details>
                <summary>{t("Technical details", "Технические сведения")}</summary>
                <small>
                  {selected.mediaType} · {selected.bytes} B
                </small>
              </details>
            </>
          ) : (
            <div className={styles.empty}>
              <WorkspaceIcon name="document" />
              <h3>{t("Document details", "Сведения о документе")}</h3>
              <p>
                {t(
                  "Select a file to see its versions and download an original.",
                  "Выберите файл для просмотра версий и загрузки оригинала.",
                )}
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
