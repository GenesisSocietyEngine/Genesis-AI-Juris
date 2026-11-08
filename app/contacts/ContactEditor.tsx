"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import { contactMessage, relationshipLabel } from "./contact-copy";
import { leadStages, label as stageName } from "../casework/model";
import { contactProfile, limits, relationships } from "./contact-model";
import { csvHeader, reviewContactCsv } from "./contact-import";
import { ContactController } from "./contact-controller";
import lib from "../library/library.module.css";
import styles from "./contacts.module.css";

export default function ContactEditor({
  controller,
  locale,
  organization,
}: {
  controller: ContactController;
  locale: "en" | "ru";
  organization: string;
}) {
  const state = controller.getSnapshot(),
    d = state.draft!;
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  const dialog = useRef<HTMLDialogElement>(null);
  const [fileIssue, setFileIssue] = useState("");
  useEffect(() => {
    const element = dialog.current,
      opener = document.activeElement;
    element?.showModal();
    element?.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const disabled = state.saving || Boolean(state.pending) || state.locked || !state.loaded;
  const dirty = controller.dirty(),
    matches = controller.duplicates();
  const title =
    d.type === "csv"
      ? t("Import contacts", "Импорт контактов")
      : d.id
        ? t("Edit contact", "Изменить контакт")
        : d.profile.kind === "person"
          ? t("Add person", "Добавить человека")
          : t("Add company", "Добавить компанию");
  const csv = d.type === "csv" && d.reviewed ? reviewContactCsv(d.text, state.entries) : null;
  const accepted = csv?.filter((row) => row.profile).length ?? 0;
  const latest = d.type === "profile" && d.id ? state.entries.find((c) => c.id === d.id) : null;
  const stale = d.type === "profile" && Boolean(latest && latest.revision !== d.revision);
  let fieldIssue = "";
  if (d.type === "profile" && dirty) {
    try {
      contactProfile(d.profile);
    } catch (e) {
      fieldIssue = e instanceof Error ? e.message : "invalid";
    }
  }
  const field = (key: keyof typeof limits, label: string, type = "text") =>
    d.type === "profile" && (
      <label>
        {label}
        <input
          data-first={key === "name" ? "" : undefined}
          type={type}
          required={key === "name"}
          maxLength={limits[key]}
          autoComplete="off"
          value={d.profile[key]}
          onChange={(e) => controller.setProfile(key, e.target.value)}
        />
      </label>
    );
  const companies = state.entries
    .filter(
      (c) =>
        c.kind === "company" &&
        (c.status === "active" || (d.type === "profile" && c.id === d.profile.companyId)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const issue = state.issue || fileIssue || fieldIssue;
  return (
    <dialog
      ref={dialog}
      className={`${lib.dialog} ${styles.editor}`}
      aria-labelledby="contact-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!dirty && !disabled) controller.close();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (d.type === "csv" && !d.reviewed) controller.previewCsv();
          else if (controller.draftCommand()) void controller.save();
        }}
      >
        <div className={lib.dialogHeading}>
          <h2 id="contact-editor-title">{title}</h2>
          <StatusBadge tone={state.pending ? "overdue" : dirty ? "open" : "neutral"}>
            {state.saving
              ? t("Saving…", "Сохранение…")
              : state.pending
                ? t("Save unconfirmed", "Сохранение не подтверждено")
                : dirty
                  ? t("Unsaved changes", "Есть изменения")
                  : t("No changes", "Без изменений")}
          </StatusBadge>
        </div>
        <p>
          {t("Firm directory", "Справочник фирмы")} · <strong>{organization}</strong>
        </p>
        <p className={styles.muted}>
          {t(
            "Use synthetic or de-identified contact details in this workspace.",
            "Используйте вымышленные или обезличенные контактные данные.",
          )}
        </p>
        <fieldset disabled={disabled} className={styles.fields}>
          {d.type === "profile" ? (
            <>
              {field(
                "name",
                d.profile.kind === "person"
                  ? t("Full name", "Полное имя")
                  : t("Company name", "Название компании"),
              )}
              <label>
                {t("Relationship", "Отношения")}
                <select
                  value={d.profile.relationship}
                  onChange={(e) => controller.setProfile("relationship", e.target.value)}
                >
                  <option value="">{t("Unspecified", "Не указаны")}</option>
                  {relationships.map((value) => (
                    <option key={value} value={value}>
                      {relationshipLabel(value, locale)}
                    </option>
                  ))}
                </select>
              </label>
              {d.profile.relationship === "prospect" && (
                <label>
                  {t("Prospect stage", "Этап обращения")}
                  <select
                    value={d.profile.leadStage ?? ""}
                    onChange={(e) => controller.setProfile("leadStage", e.target.value)}
                  >
                    <option value="">{stageName("unset", locale)}</option>
                    {leadStages.map((k) => (
                      <option key={k} value={k}>
                        {stageName(k, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {field("group", t("Group", "Группа"))}
              {field("email", t("Email", "Эл. почта"), "email")}
              {field("phone", t("Phone", "Телефон"), "tel")}
              {d.profile.kind === "person" && (
                <label>
                  {t("Company", "Компания")}
                  <select
                    value={d.profile.companyId}
                    onChange={(e) => controller.setProfile("companyId", e.target.value)}
                  >
                    <option value="">{t("No company", "Без компании")}</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {companies.some((other) => other.id !== c.id && other.name === c.name) &&
                        (c.email || c.phone || c.group)
                          ? " · " + (c.email || c.phone || c.group)
                          : ""}
                        {c.status === "archived" ? t(" (archived)", " (в архиве)") : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {field("website", t("Website", "Сайт"), "url")}
              {field("address", t("Address", "Адрес"))}
              {matches.length > 0 && (
                <div className={styles.review}>
                  <strong>{t("Possible matches", "Возможные совпадения")}</strong>
                  <ul>
                    {matches.map((c) => (
                      <li key={c.id}>
                        {c.name} ·{" "}
                        {c.email || (c.kind === "person" ? t("Person", "Человек") : t("Company", "Компания"))}
                        {c.status === "archived" && t(" · Archived", " · В архиве")}
                      </li>
                    ))}
                  </ul>
                  <label className={lib.check}>
                    <input
                      type="checkbox"
                      checked={matches.every((c) => d.reviewed.includes(c.id))}
                      onChange={(e) => controller.reviewMatches(e.target.checked)}
                    />
                    {t(
                      "I reviewed these matches. Keep this contact separate.",
                      "Совпадения проверены. Сохранить этот контакт отдельно.",
                    )}
                  </label>
                </div>
              )}
            </>
          ) : (
            <>
              <label>
                {t("Choose CSV file", "Выберите CSV-файл")}
                <input
                  data-first=""
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileIssue("");
                    if (file.size > 65536) {
                      setFileIssue("csvSize");
                      return;
                    }
                    try {
                      const text = await file.text();
                      if (controller.getSnapshot().draft === d) controller.setCsv(text);
                    } catch {
                      if (controller.getSnapshot().draft === d) setFileIssue("csvSize");
                    }
                  }}
                />
              </label>
              <label>
                {t("CSV contents", "Содержимое CSV")}
                <textarea
                  value={d.text}
                  maxLength={65536}
                  rows={5}
                  placeholder={csvHeader}
                  onChange={(e) => {
                    setFileIssue("");
                    controller.setCsv(e.target.value);
                  }}
                />
              </label>
              <p className={styles.muted}>
                {t(
                  "Use person or company in the kind column. Preview up to 25 rows before saving.",
                  "В столбце kind укажите person или company. Перед сохранением проверьте до 25 строк.",
                )}
              </p>
              {csv && (
                <div className={styles.review}>
                  <strong>
                    {t("Ready to import", "Готово к импорту")} · {accepted} / {csv.length}
                  </strong>
                  <ol>
                    {csv.map((row) => (
                      <li key={row.row}>
                        <strong>
                          {row.row}. {row.name || "—"}
                        </strong>{" "}
                        · {row.issue ? contactMessage(row.issue, locale) : t("Ready", "Готово")}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </fieldset>
        {issue && (
          <p className={styles.problem} role="alert">
            {contactMessage(issue, locale)}
          </p>
        )}
        {stale && (
          <div className={styles.review}>
            <p>
              {t(
                "The saved record changed. Compare your input with the latest saved record.",
                "Сохранённая запись изменилась. Сравните введённые значения с последней версией.",
              )}
            </p>
            <details>
              <summary>{t("Latest saved details", "Последняя сохранённая запись")}</summary>
              <p>
                {[latest!.name, latest!.email, latest!.phone, latest!.group, latest!.website, latest!.address]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </details>
            <button type="button" disabled={disabled} onClick={() => controller.useSaved()}>
              {t("Replace my input with saved record", "Заменить ввод сохранённой записью")}
            </button>
          </div>
        )}
        <div className={lib.actions}>
          {!state.loaded && (
            <button type="button" disabled={state.loading} onClick={() => void controller.refresh()}>
              {t("Refresh contacts", "Обновить контакты")}
            </button>
          )}
          {state.pending ? (
            <button
              className={lib.primary}
              type="button"
              disabled={state.saving || !state.loaded}
              onClick={() => void controller.save()}
            >
              {t("Check original save", "Проверить сохранение")}
            </button>
          ) : (
            <button
              className={lib.primary}
              type="submit"
              disabled={
                disabled || (d.type === "csv" && !d.reviewed ? !d.text.trim() : !controller.draftCommand())
              }
            >
              <WorkspaceIcon name="save" />
              {d.type === "csv"
                ? d.reviewed
                  ? t("Import ready contacts", "Импортировать готовые контакты")
                  : t("Preview import", "Проверить импорт")
                : t("Save contact", "Сохранить контакт")}
            </button>
          )}
          <button
            type="button"
            disabled={Boolean(state.pending) || state.saving || state.locked}
            onClick={() => controller.close()}
          >
            {dirty ? t("Discard changes", "Отменить изменения") : t("Cancel", "Отмена")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
