"use client";
import { useEffect, useRef } from "react";
import StatusBadge from "../StatusBadge";
import { WorkspaceIcon } from "../CaseVantIcon";
import { IntakeController } from "./intake-controller";
import { ANSWER_LIMIT, MAX_QUESTIONS, QUESTION_LIMIT, TITLE_LIMIT } from "./intake-model";
import { intakeMessage, words, type Locale } from "./intake-copy";
import lib from "../library/library.module.css";
import styles from "./intake.module.css";
export default function IntakeEditor({
  controller,
  locale,
  organization,
}: {
  controller: IntakeController;
  locale: Locale;
  organization: string;
}) {
  const s = controller.getSnapshot(),
    d = s.draft!,
    t = words(locale),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current,
      opener = document.activeElement;
    node?.showModal();
    node?.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => {
      node?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const design = d.kind === "design",
    dirty = controller.dirty(),
    blocked = !s.loaded || s.saving || s.loading || s.locked || !!s.pending;
  const latest = s.records.find((r) => r.id === d.id),
    stale = !!d.revision && latest?.revision !== d.revision;
  const source = s.records.find((r) => r.id === d.templateId),
    replaced =
      !design && !d.revision && (source?.status !== "available" || source.revision !== d.templateRevision);
  const missing = d.questions.filter((q, i) => q.required && !d.answers[i]?.trim()).length;
  const changeQ = (index: number, patch: { label?: string; required?: boolean }) =>
    controller.update({ questions: d.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) });
  const duplicate =
    design &&
    new Set(d.questions.map((q) => q.label.trim().toLowerCase()).filter(Boolean)).size <
      d.questions.filter((q) => q.label.trim()).length;
  return (
    <dialog
      ref={dialog}
      className={lib.dialog}
      aria-labelledby="intake-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!dirty && !blocked) controller.discard();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (controller.command()) void controller.save();
        }}
      >
        <div className={lib.dialogHeading}>
          <h2 id="intake-editor-title">
            {design
              ? d.revision
                ? t("Edit questionnaire", "Изменить анкету")
                : t("New questionnaire", "Новая анкета")
              : d.title}
          </h2>
          <StatusBadge tone={dirty || s.pending ? "open" : "neutral"}>
            {s.saving
              ? t("Saving…", "Сохранение…")
              : s.pending
                ? t("Not confirmed", "Не подтверждено")
                : dirty
                  ? t("Unsaved changes", "Есть изменения")
                  : d.revision
                    ? t("Saved", "Сохранено")
                    : t("Not saved yet", "Ещё не сохранено")}
          </StatusBadge>
        </div>
        <p className={lib.destination}>
          {design
            ? t("Save to firm questionnaires", "Сохранить в анкеты фирмы") + " · " + organization
            : t("Save to case", "Сохранить в дело") +
              " · " +
              (s.cases.find((c) => c.id === d.caseId)?.title ?? t("Choose below", "Выберите ниже"))}
        </p>
        <fieldset disabled={blocked}>
          <legend className={styles.legend}>
            {design ? t("Questionnaire details", "Параметры анкеты") : t("Case responses", "Ответы по делу")}
          </legend>
          {design ? (
            <>
              <label>
                {t("Questionnaire name", "Название анкеты")}
                <input
                  data-first
                  maxLength={TITLE_LIMIT}
                  value={d.title}
                  onChange={(e) => controller.update({ title: e.target.value })}
                />
              </label>
              {d.questions.map((q, i) => (
                <div className={styles.question} key={i}>
                  <label>
                    {t("Question", "Вопрос")} {i + 1}
                    <input
                      maxLength={QUESTION_LIMIT}
                      value={q.label}
                      onChange={(e) => changeQ(i, { label: e.target.value })}
                    />
                  </label>
                  <div className={lib.actions}>
                    <label className={lib.check}>
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => changeQ(i, { required: e.target.checked })}
                      />
                      {t("Required", "Обязательный")}
                    </label>
                    {d.questions.length > 1 && (
                      <button
                        type="button"
                        aria-label={t("Remove question", "Убрать вопрос") + " " + (i + 1)}
                        onClick={() =>
                          controller.update({ questions: d.questions.filter((_, n) => n !== i) })
                        }
                      >
                        {t("Remove", "Убрать")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {d.questions.length < MAX_QUESTIONS && (
                <button
                  type="button"
                  onClick={() =>
                    controller.update({ questions: [...d.questions, { label: "", required: false }] })
                  }
                >
                  <WorkspaceIcon name="plus" />
                  {t("Add question", "Добавить вопрос")}
                </button>
              )}
              {duplicate && <p role="alert">{intakeMessage("duplicateQuestion", locale)}</p>}
            </>
          ) : (
            <>
              {!d.revision && (
                <label>
                  {t("Case", "Дело")}
                  <select
                    data-first
                    value={d.caseId}
                    onChange={(e) => controller.update({ caseId: e.target.value })}
                  >
                    <option value="">{t("Choose a case", "Выберите дело")}</option>
                    {s.cases
                      .filter((c) => c.canEdit)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {d.questions.map((q, i) => (
                <label key={i}>
                  <span>
                    {q.label}{" "}
                    <small>
                      {q.required ? t("Required", "Обязательно") : t("Optional", "Необязательно")}
                    </small>
                  </span>
                  <textarea
                    data-first={d.revision && i === 0 ? "" : undefined}
                    rows={2}
                    maxLength={ANSWER_LIMIT}
                    value={d.answers[i]}
                    onChange={(e) =>
                      controller.update({ answers: d.answers.map((v, n) => (n === i ? e.target.value : v)) })
                    }
                  />
                </label>
              ))}
              <label className={lib.check}>
                <input
                  type="checkbox"
                  checked={d.confirmed}
                  onChange={(e) => controller.update({ confirmed: e.target.checked })}
                />
                {t(
                  "I used only synthetic or de-identified information.",
                  "Использованы только синтетические или обезличенные сведения.",
                )}
              </label>
              <p className={lib.meta}>
                {missing
                  ? t("Required answers remaining", "Осталось обязательных ответов") +
                    ": " +
                    missing +
                    ". " +
                    t("You can save a draft.", "Можно сохранить черновик.")
                  : t("All required questions are answered.", "На все обязательные вопросы даны ответы.")}
              </p>
            </>
          )}
        </fieldset>
        {(stale || replaced) && s.loaded && (
          <div className={lib.recovery}>
            <p>{intakeMessage(replaced ? "templateChanged" : "changed", locale)}</p>
            {latest && (
              <details>
                <summary>{t("Compare with saved version", "Сверить с сохранённой версией")}</summary>
                <strong>{latest.title}</strong>
                {latest.questions.map((q, i) => (
                  <p key={i}>
                    {q.label}
                    {latest.caseId ? ": " + (latest.answers[i] || "—") : ""}
                  </p>
                ))}
              </details>
            )}
          </div>
        )}
        {s.issue && (
          <p role="alert" className={lib.message}>
            {intakeMessage(s.issue, locale)}
          </p>
        )}
        <div className={lib.actions}>
          {s.pending ? (
            <button
              type="button"
              className={lib.primary}
              disabled={s.saving || !s.loaded}
              onClick={() => void controller.save()}
            >
              {t("Check original save", "Проверить сохранение")}
            </button>
          ) : (
            <>
              <button type="submit" className={lib.primary} disabled={!controller.command()}>
                <WorkspaceIcon name="save" />
                {design ? t("Save questionnaire", "Сохранить анкету") : t("Save draft", "Сохранить черновик")}
              </button>
              {!design && (
                <button
                  type="button"
                  disabled={!controller.command(true)}
                  onClick={() => {
                    const cmd = controller.command(true);
                    if (cmd) void controller.save(cmd);
                  }}
                >
                  <WorkspaceIcon name="check" />
                  {t("Mark complete", "Завершить")}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            disabled={s.saving || !!s.pending || s.locked}
            onClick={() => controller.discard()}
          >
            {dirty ? t("Discard changes", "Отменить изменения") : t("Cancel", "Отмена")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
