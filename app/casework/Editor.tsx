"use client";
import { useEffect, useRef, useState } from "react";
import { CaseworkController } from "./controller";
import { fields, label, stages, tokens, tokenLabel, type Locale } from "./model";
import { words, message } from "./presentation";
import StatusBadge from "../StatusBadge";
import { WorkspaceIcon } from "../CaseVantIcon";
import lib from "../library/library.module.css";
import css from "./casework.module.css";
export default function CaseworkEditor({
  controller: c,
  locale,
}: {
  controller: CaseworkController;
  locale: Locale;
}) {
  const s = c.getSnapshot(),
    d = s.draft!,
    t = words(locale),
    modal = useRef<HTMLDialogElement>(null),
    area = useRef<HTMLTextAreaElement>(null),
    [discard, setDiscard] = useState(false);
  useEffect(() => {
    const n = modal.current,
      o = document.activeElement;
    n?.showModal();
    n?.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => {
      n?.close();
      if (o instanceof HTMLElement && o.isConnected) o.focus();
    };
  }, []);
  const close = () => {
      if (!c.dirty()) c.discard();
      else setDiscard(true);
    },
    locked = !c.editable(),
    matter = s.cases.find((v) => v.id === d.caseId),
    source = s.records.find((v) => v.id === d.sourceId),
    pr = c.projection(),
    latest = s.records.find((v) => v.id === d.id),
    stale = (latest?.revision ?? 0) !== d.revision || latest?.archived;
  const destination =
    d.action === "template"
      ? s.firm
      : d.action === "view"
        ? t("Only me", "Только для меня")
        : (matter?.title ?? t("Choose a case", "Выберите дело"));
  const title =
    d.action === "template"
      ? d.revision
        ? t("Edit document template", "Изменить шаблон документа")
        : t("New document template", "Новый шаблон документа")
      : d.action === "generate"
        ? t("Create case document", "Создать документ дела")
        : d.action === "progress"
          ? t("Update case progress", "Обновить ход дела")
          : t("Save personal view", "Сохранить личное представление");
  let invalidFields = false;
  if (d.action === "template") {
    try {
      fields(d.body);
    } catch {
      invalidFields = true;
    }
  }
  const proof =
    !!pr &&
    d.proof === pr.text &&
    d.caseRevision === pr.caseRevision &&
    d.sourceRevision === pr.sourceRevision;
  const add = (k: string) => {
    const a = area.current,
      start = a?.selectionStart ?? d.body.length,
      end = a?.selectionEnd ?? start,
      token = "{{" + k + "}}";
    c.update({ body: d.body.slice(0, start) + token + d.body.slice(end) });
    requestAnimationFrame(() => {
      a?.focus();
      a?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <dialog
      ref={modal}
      className={lib.dialog}
      aria-labelledby="casework-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (c.command()) void c.save();
        }}
      >
        <div className={lib.dialogHeading}>
          <h2 id="casework-title">{title}</h2>
          <StatusBadge tone={s.pending || c.dirty() ? "open" : "neutral"}>
            {s.saving
              ? t("Saving…", "Сохранение…")
              : s.pending
                ? t("Not confirmed", "Не подтверждено")
                : c.dirty()
                  ? t("Unsaved changes", "Есть изменения")
                  : t("No changes", "Без изменений")}
          </StatusBadge>
        </div>
        <p className={lib.destination}>
          <WorkspaceIcon
            name={d.action === "view" ? "people" : d.action === "template" ? "template" : "cases"}
          />
          {t("Save to: ", "Место сохранения: ")}
          <strong>{destination}</strong>
        </p>
        <fieldset disabled={locked} className={css.fields}>
          {d.action === "generate" && (
            <label>
              {t("Destination case", "Дело для документа")}
              <select data-first value={d.caseId} onChange={(e) => c.update({ caseId: e.target.value })}>
                <option value="">{t("Choose a case", "Выберите дело")}</option>
                {s.cases
                  .filter((v) => v.canEdit)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                      {v.reference ? " · " + v.reference : ""}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {d.action !== "progress" && (
            <label>
              {d.action === "view"
                ? t("View name", "Название представления")
                : d.action === "template"
                  ? t("Template name", "Название шаблона")
                  : t("Document name", "Название документа")}
              <input
                data-first={d.action === "generate" ? undefined : true}
                value={d.title}
                maxLength={d.action === "view" ? 80 : 120}
                required
                onChange={(e) => c.update({ title: e.target.value })}
              />
            </label>
          )}
          {d.action === "view" && (
            <p>
              {t("Filters to save: ", "Сохраняемые фильтры: ")}
              {[
                d.filter.query,
                d.filter.stage && label(d.filter.stage, locale),
                d.filter.status && label(d.filter.status, locale),
              ]
                .filter(Boolean)
                .join(" · ") || t("All accessible cases", "Все доступные дела")}
            </p>
          )}
          {d.action === "template" && (
            <>
              <label>
                {t("Template text", "Текст шаблона")}
                <textarea
                  rows={7}
                  value={d.body}
                  ref={area}
                  maxLength={16000}
                  required
                  onChange={(e) => c.update({ body: e.target.value })}
                />
              </label>
              <details>
                <summary>{t("Insert a merge field", "Вставить поле подстановки")}</summary>
                <div className={lib.actions}>
                  {(Object.keys(tokens) as (keyof typeof tokens)[]).map((k) => (
                    <button type="button" key={k} onClick={() => add(k)}>
                      {tokenLabel(k, locale)}
                    </button>
                  ))}
                </div>
              </details>
              {invalidFields && <p role="alert">{message("unknownField", locale)}</p>}
            </>
          )}
          {d.action === "progress" && (
            <>
              <p>
                {t(
                  "This adds a dated update. The formal case status stays unchanged.",
                  "Будет добавлено сообщение с датой. Официальный статус дела не изменится.",
                )}
              </p>
              <label>
                {t("Case stage", "Этап дела")}
                <select
                  data-first
                  value={d.stage}
                  required
                  onChange={(e) => c.update({ stage: e.target.value })}
                >
                  <option value="">{t("Choose a stage", "Выберите этап")}</option>
                  {stages.map((k) => (
                    <option key={k} value={k}>
                      {label(k, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Status update", "Сообщение о ходе дела")}
                <textarea
                  rows={4}
                  value={d.body}
                  maxLength={1200}
                  required
                  onChange={(e) => c.update({ body: e.target.value })}
                />
              </label>
            </>
          )}
          {d.action === "generate" && (
            <>
              <p>
                {t("Template: ", "Шаблон: ")}
                {source?.title} · {t("Version", "Версия")} {source?.revision}
              </p>
              {pr && (
                <>
                  <h3>{t("Merged preview", "Предпросмотр документа")}</h3>
                  <div className={css.paper}>{pr.text}</div>
                  {pr.missing.length > 0 ? (
                    <p role="status">
                      {t("Missing case information: ", "Не хватает сведений: ")}
                      {pr.missing.map((k) => tokenLabel(k, locale)).join(", ")}.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={proof || pr.text.length > 36000}
                      onClick={() => c.reviewPreview()}
                    >
                      {proof
                        ? t("Preview reviewed", "Текст проверен")
                        : t("Review this text", "Подтвердить текст")}
                    </button>
                  )}
                </>
              )}
              {!pr && d.caseId && <p role="alert">{message("previewChanged", locale)}</p>}
            </>
          )}
          {(d.action === "progress" || d.action === "generate") && (
            <label className={lib.check}>
              <input
                type="checkbox"
                checked={d.confirmed}
                disabled={d.action === "generate" && !proof}
                onChange={(e) => c.update({ confirmed: e.target.checked })}
              />
              {t(
                "I checked that the content is synthetic or de-identified.",
                "Я проверил(а), что сведения вымышлены или обезличены.",
              )}
            </label>
          )}
        </fieldset>
        {stale && (
          <div className={lib.recovery}>
            <p>{message("changed", locale)}</p>
            {latest && (
              <details>
                <summary>{t("See saved version", "Посмотреть сохранённую версию")}</summary>
                <p className={css.paper}>{latest.body || latest.title}</p>
              </details>
            )}
          </div>
        )}
        {s.issue && (
          <p role="alert" className={lib.recovery}>
            {message(s.issue, locale)}
          </p>
        )}
        {discard && !locked ? (
          <div className={lib.recovery}>
            <p>
              {t(
                "Discard the changes made in this editor? Saved work will stay available.",
                "Отменить изменения в редакторе? Сохранённая работа останется доступной.",
              )}
            </p>
            <div className={lib.actions}>
              <button type="button" onClick={() => setDiscard(false)}>
                {t("Keep editing", "Продолжить")}
              </button>
              <button type="button" onClick={() => c.discard()}>
                {t("Discard changes", "Отменить изменения")}
              </button>
            </div>
          </div>
        ) : (
          <div className={lib.actions}>
            {s.pending ? (
              <button type="button" disabled={s.saving || s.locked} onClick={() => void c.save()}>
                {t("Check save", "Проверить сохранение")}
              </button>
            ) : (
              <button className={lib.primary} type="submit" disabled={!c.command()}>
                {d.action === "generate"
                  ? t("Save document to case", "Сохранить документ в деле")
                  : d.action === "template"
                    ? t("Save template", "Сохранить шаблон")
                    : d.action === "view"
                      ? t("Save view", "Сохранить представление")
                      : t("Save update", "Сохранить сообщение")}
              </button>
            )}
            <button type="button" disabled={locked} onClick={close}>
              {t("Close", "Закрыть")}
            </button>
          </div>
        )}
      </form>
    </dialog>
  );
}
