"use client";
import { useState } from "react";
import { milestoneNames } from "./workflow-milestones";
import { previewTemplate, type WorkflowStep } from "./workflow-templates";
import { readableDate } from "./work-presentation";
import styles from "./work.module.css";

export default function TemplateDatePreview({
  steps,
  locale,
}: {
  steps: WorkflowStep[];
  locale: "en" | "ru";
}) {
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  const [values, setValues] = useState(new Map<string, string>());
  let names: string[];
  try {
    names = milestoneNames(steps);
  } catch {
    return <p role="alert">{t("Check the milestone names.", "Проверьте названия этапов.")}</p>;
  }
  const dates = names.map((name) => ({ name, date: values.get(name) ?? "" }));
  let rows: ReturnType<typeof previewTemplate> = [],
    issue = "";
  if (dates.every((d) => d.date)) {
    try {
      rows = previewTemplate({ steps }, dates);
    } catch {
      issue = t("Check each date and day offset.", "Проверьте даты и смещения в днях.");
    }
  }
  return (
    <section>
      <h3>{t("Preview step dates", "Предпросмотр дат")}</h3>
      <div className={styles.filters}>
        {dates.map((d) => (
          <label key={d.name}>
            {d.name || t("Workflow start", "Начало процесса")}
            <input
              type="date"
              value={d.date}
              onChange={(e) => setValues(new Map(values).set(d.name, e.target.value))}
            />
          </label>
        ))}
      </div>
      {issue && <p role="alert">{issue}</p>}
      {rows.length > 0 && (
        <ol>
          {rows.map((row, i) => (
            <li key={i}>
              {row.title} · {readableDate(row.dueDate, locale, { dateStyle: "medium" })}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
