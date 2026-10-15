"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioDraft } from "./types";
import { studioRecordScope, type RecordScope } from "./studio-record-search";
import StudioRecordNavigator from "./StudioRecordNavigator";
import styles from "./studio-overview.module.css";

export default function StudioWorkspaceRecords({ draft, locale, onNode }: { draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void }) {
  const [scope, setScope] = useState<RecordScope>("all"), [open, setOpen] = useState(false);
  const browser = useRef<HTMLDetailsElement>(null);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const counts = useMemo(() => {
    const result = { evidence: 0, options: 0, planning: 0, scenarios: 0, context: 0 };
    for (const node of draft.nodes) result[studioRecordScope(node, Boolean(draft.classification?.tags.includes("converted-example")))]++;
    return result;
  }, [draft]);
  useEffect(() => {
    if (!open) return;
    browser.current?.scrollIntoView({ block: "nearest" });
    browser.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [open, scope]);
  const groups = [
    { id: "evidence", title: t("Evidence & assumptions", "Материалы и допущения"), detail: t("Authored records; human acceptance is separate.", "Авторские записи; принятие человеком проверяется отдельно.") },
    { id: "options", title: t("Questions & options", "Вопросы и варианты"), detail: t("Review choices; no route is automatically selected.", "Вопросы для проверки; маршрут не выбирается автоматически.") },
    { id: "planning", title: t("Tasks & follow-up", "Задачи и дальнейшие действия"), detail: t("Proposed phases and dates; completion is unverified.", "Предлагаемые этапы и даты; выполнение не подтверждено.") },
    { id: "scenarios", title: t("Outcomes & scenarios", "Исходы и сценарии"), detail: t("Recorded possibilities, not predicted or completed results.", "Записанные возможности, не прогнозы или завершённые результаты.") },
  ] as const;
  return <section className={styles.block} aria-labelledby="studio-file-title">
    <h3 id="studio-file-title">{t("Explore the case file", "Изучить материалы дела")}</h3>
    <div className={styles.fileGrid}>{groups.map(group => <button key={group.id} type="button" className={styles.fileCard} aria-controls="studio-case-records" onClick={() => { setScope(group.id); setOpen(true); }}>
      <span className={styles.fileCount}>{counts[group.id]}</span><strong>{group.title}</strong><span>{group.detail}</span><span className={styles.fileAction}>{t("Browse records", "Открыть записи")} →</span>
    </button>)}</div>
    <p className={styles.muted}>{t(`${draft.nodes.length} total graph records. Counts describe authored structure, not source coverage, review or approval.`, `Всего записей графа: ${draft.nodes.length}. Числа описывают авторскую структуру, а не полноту источников, проверку или утверждение.`)}</p>
    <details ref={browser} id="studio-case-records" className={styles.recordBrowser} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{t("Search and inspect all case records", "Поиск и проверка всех записей дела")}</summary>
      <h3 id="studio-planning-title">{t("Chronology and follow-up planning", "Хронология и план дальнейших действий")}</h3>
      <p>{t("These are authored planning records, not events that have occurred. Their order is not an execution route. Confirm owners, actual dates and completion against the sources before relying on them.", "Это авторские записи планирования, а не произошедшие события. Порядок записей не задаёт маршрут выполнения. Сверьте ответственных, фактические даты и выполнение с источниками перед использованием.")}</p>
      <StudioRecordNavigator key={`${draft.caseId}:${scope}`} draft={draft} locale={locale} onNode={onNode} initialScope={scope}/>
    </details>
  </section>;
}
