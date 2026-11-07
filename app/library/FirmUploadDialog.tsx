"use client";
import { useEffect, useRef } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import type { LibraryController } from "./library-controller";
import styles from "./library.module.css";
export function libraryFeedback(value: string, locale: "en" | "ru") {
  const labels: Record<string, string> = {
    "Document saved. Earlier versions remain available.": "Документ сохранён. Предыдущие версии доступны.",
    "Folder saved.": "Папка сохранена.",
    "Save confirmed. No file was resent.": "Сохранение подтверждено без повторной отправки файла.",
    "Incomplete upload storage is full. Contact your workspace administrator.":
      "Хранилище незавершённых загрузок заполнено. Обратитесь к администратору.",
    "The document is empty.": "Файл пуст.",
    "The document exceeds the file limit.": "Размер файла превышает лимит.",
    "The document filename is invalid.": "Недопустимое имя файла.",
    "The filename and document signature do not match an allowed type.":
      "Тип файла не соответствует расширению или не поддерживается.",
    "The declared document metadata does not match its bytes.":
      "Содержимое файла не соответствует указанному типу.",
    "The browser document media type conflicts with the declared type.":
      "Содержимое файла не соответствует указанному типу.",
    "Incomplete upload cancelled. No version was published.": "Загрузка отменена. Версия не опубликована.",
    "Save is not confirmed. Retry the original operation.":
      "Сохранение не подтверждено. Повторите исходную операцию.",
    "Save status unavailable. Retry the status check.": "Статус недоступен. Повторите проверку.",
    "Save status unknown. Check saved status.": "Результат сохранения пока неизвестен. Проверьте статус.",
    "Document changed. Refresh before uploading a version.":
      "Документ изменился. Обновите библиотеку перед загрузкой версии.",
    "Another version was saved. Refresh and start a new version upload.":
      "Сохранена другая версия. Обновите библиотеку перед новой загрузкой.",
    "Folder name unavailable. Refresh the Library.": "Название папки недоступно. Обновите библиотеку.",
    "Enter a valid folder name.": "Введите корректное название папки.",
    "Download unavailable. Refresh access and retry.":
      "Файл недоступен. Обновите доступ и повторите попытку.",
    "Could not load firm documents. Refresh to retry.": "Документы фирмы недоступны. Обновите библиотеку.",
    "This save reference is cancelled or belongs to another file.":
      "Операция отменена или относится к другому файлу.",
    "Cancellation not confirmed. Check saved status or refresh the Library.":
      "Отмена не подтверждена. Проверьте статус или обновите библиотеку.",
    "Version history unavailable.": "История версий недоступна.",
    "Review the retained upload in Library.": "Проверьте сохранённые в форме данные в библиотеке.",
    "Version, storage capacity or access changed. Refresh the Library.":
      "Версия, доступ или свободное место изменились. Обновите библиотеку.",
    "Upload was not confirmed. Retry the original upload.":
      "Загрузка не подтверждена. Повторите исходную загрузку.",
    "Use a folder name of up to 200 characters, without dot segments.":
      "Введите путь папки до 200 знаков, без точек вместо названий.",
    "Save receipt did not match. Check saved status.":
      "Результат не совпадает с запросом. Проверьте статус сохранения.",
  };
  if (labels[value]) return locale === "ru" ? labels[value] : value;
  return locale === "ru"
    ? "Операция не подтверждена. Проверьте файл или название папки и обновите библиотеку."
    : "Action not confirmed. Check the file or folder name and refresh the Library.";
}
export default function FirmUploadDialog({
  controller,
  state,
  locale,
  organization,
}: {
  controller: LibraryController;
  state: ReturnType<LibraryController["getSnapshot"]>;
  locale: "en" | "ru";
  organization: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    title = useRef<HTMLInputElement>(null);
  const d = state.draft!,
    folder = d.kind === "folder",
    t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  useEffect(() => {
    const opener = document.activeElement,
      dialog = ref.current;
    dialog?.showModal();
    title.current?.focus();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const disabled = state.saving || state.locked || Boolean(state.pending) || !state.loaded;
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="library-upload-title"
      onCancel={(e) => {
        e.preventDefault();
        controller.discard();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void controller.upload();
        }}
      >
        <div className={styles.dialogHeading}>
          <h2 id="library-upload-title">
            {folder
              ? t("New folder", "Новая папка")
              : d.restored
                ? t("Resume upload", "Продолжить загрузку")
                : d.id
                  ? t("Upload new version", "Загрузить новую версию")
                  : t("Upload firm document", "Загрузить документ фирмы")}
          </h2>
          <StatusBadge tone={state.saving ? "scheduled" : state.pending ? "overdue" : "open"}>
            {state.saving
              ? t("Saving…", "Сохранение…")
              : state.pending
                ? t("Save unconfirmed", "Не подтверждено")
                : t("Not saved yet", "Пока не сохранено")}
          </StatusBadge>
        </div>
        <div className={styles.destination}>
          <WorkspaceIcon name="organization" />
          <div>
            <strong>
              {organization} · {t("Firm documents", "Документы фирмы")}
            </strong>
            <small>
              {t(
                "Visible to active organization members. Case evidence stays in its case.",
                "Доступно активным участникам организации. Доказательства остаются в деле.",
              )}
            </small>
          </div>
        </div>
        {state.issue && (
          <p role="alert" className={styles.message}>
            {libraryFeedback(state.issue, locale)}
          </p>
        )}
        {d.restored && (
          <p>
            {t("Choose the same original file:", "Выберите тот же исходный файл:")}{" "}
            <strong>{d.restored.filename}</strong>
          </p>
        )}
        <fieldset disabled={disabled}>
          <label>
            {folder ? t("Folder name", "Название папки") : t("Document title", "Название документа")}
            <input
              ref={title}
              required
              maxLength={folder ? 200 : 240}
              readOnly={Boolean(d.restored)}
              value={d.title}
              onChange={(e) => controller.update({ ...d, title: e.target.value })}
            />
          </label>
          {!folder && (
            <>
              <label>
                {t("Folder (optional)", "Папка (необязательно)")}
                <input
                  maxLength={200}
                  list="library-folder-options"
                  readOnly={Boolean(d.restored)}
                  value={d.folder}
                  placeholder={t("No folder", "Без папки")}
                  onChange={(e) => controller.update({ ...d, folder: e.target.value })}
                />
                <datalist id="library-folder-options">
                  {state.folders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </label>
              <label>
                {t("Original file", "Исходный файл")}
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null,
                      extension = file?.name.split(".").pop()?.toLowerCase(),
                      mediaType =
                        extension === "pdf"
                          ? "application/pdf"
                          : extension === "docx"
                            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            : extension === "md"
                              ? "text/markdown"
                              : "text/plain";
                    controller.update({
                      ...d,
                      file,
                      mediaType,
                      acknowledged: false,
                      title: d.title || file?.name || "",
                    });
                  }}
                />
                <small>
                  {t(
                    "PDF and DOCX up to 25 MB; TXT and Markdown up to 5 MB.",
                    "PDF и DOCX до 25 МБ; TXT и Markdown до 5 МБ.",
                  )}
                </small>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  required
                  checked={d.acknowledged}
                  onChange={(e) => controller.update({ ...d, acknowledged: e.target.checked })}
                />
                {t(
                  "This pilot file is synthetic or de-identified and contains no privileged or client-identifying material.",
                  "Это тестовый или обезличенный файл без привилегированных сведений и данных, раскрывающих клиента.",
                )}
              </label>
            </>
          )}
          {controller.stale() && (
            <div className={styles.message}>
              <p>
                {t(
                  "A newer document version exists. Review it before continuing.",
                  "Доступна новая версия документа. Проверьте её перед продолжением.",
                )}
              </p>
              {!d.restored && (
                <button type="button" onClick={() => controller.compare()}>
                  {t("Continue from latest version", "Продолжить от текущей версии")}
                </button>
              )}
            </div>
          )}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={!controller.canSave()}>
              <WorkspaceIcon name="save" />
              {folder
                ? t("Save folder", "Сохранить папку")
                : t("Save to firm Library", "Сохранить в библиотеку")}
            </button>
            <button type="button" onClick={() => controller.discard()}>
              {t("Cancel", "Отмена")}
            </button>
          </div>
        </fieldset>
        {state.pending && !state.saving && (
          <div className={styles.recovery}>
            <p>
              {t(
                "Check whether the original save completed before sending it again.",
                "Проверьте результат исходного сохранения перед повторной отправкой.",
              )}
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => void controller.checkSaved()}>
                {t("Check saved status", "Проверить сохранение")}
              </button>
              <button type="button" onClick={() => void controller.upload()}>
                {t("Retry original save", "Повторить сохранение")}
              </button>
              {!folder && (
                <button
                  type="button"
                  onClick={() => void controller.cancelIncomplete(String(state.pending!.get("operationKey")))}
                >
                  {t("Cancel pending upload", "Отменить загрузку")}
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}
