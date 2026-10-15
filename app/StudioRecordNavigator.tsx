"use client";
import { useMemo, useState } from "react";
import { searchStudioRecords, studioRecordScope, type RecordScope } from "./studio-record-search";
import { reportStatementStatus } from "./report-statement-status";
import type { StudioDraft } from "./types";
import styles from "./studio-overview.module.css";

export default function StudioRecordNavigator({ draft, locale, onNode, initialScope = "all" }: { draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void; initialScope?: RecordScope }) {
  const [query, setQuery] = useState(""), [scope, setScope] = useState<RecordScope>(initialScope), [limit, setLimit] = useState(10);
  const matches = useMemo(() => searchStudioRecords(draft, query, scope), [draft, query, scope]);
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const labels: Record<RecordScope | "context", string> = { all: t("All case records", "Все записи дела"), planning: t("Tasks and phases", "Задачи и этапы"), evidence: t("Evidence and assumptions", "Материалы и допущения"), options: t("Options to consider", "Возможные действия"), scenarios: t("Outcomes and scenarios", "Исходы и сценарии"), context: t("Authored context", "Авторский контекст") };
  return <div>
    <div className={styles.auditFilters}>
      <label>{t("Find case record", "Найти запись дела")}<input value={query} onChange={event => { setQuery(event.target.value); setLimit(10); }} placeholder={t("Authorization, evidence gap, owner or action", "Разрешение, пробел, ответственный или действие")}/></label>
      <label>{t("Record group", "Группа записей")}<select value={scope} onChange={event => { setScope(event.target.value as RecordScope); setLimit(10); }}>{(["all", "planning", "evidence", "options", "scenarios"] as const).map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <button type="button" onClick={() => { setQuery(""); setScope("all"); setLimit(10); }}>{t("Reset record search", "Сбросить поиск записей")}</button>
    </div>
    <p role="status">{t(`${Math.min(limit, matches.length)} shown · ${matches.length} matching · ${draft.nodes.length} total records`, `Показано ${Math.min(limit, matches.length)} · найдено ${matches.length} · всего записей ${draft.nodes.length}`)}</p>
    {!matches.length && <p>{t("No records match this search and group. Clear the search or choose All case records.", "Нет записей для этого запроса и группы. Очистите поиск или выберите все записи дела.")}</p>}
    <ul className={styles.records}>{matches.slice(0, limit).map(node => <li key={node.id}>
      <span className={styles.muted}>{labels[studioRecordScope(node, Boolean(draft.classification?.tags.includes("converted-example")))]} · {node.type === "fact" ? reportStatementStatus(node, locale) || t("Review required", "Требуется проверка") : t("Authored record; status requires verification", "Авторская запись; статус требует проверки")}</span>
      <h4><button type="button" aria-label={t("Inspect case record: ", "Открыть запись дела: ") + node.title} onClick={() => onNode(node.id)}>{node.title}</button></h4>
      <details><summary>{t("Read full record, owner and conditions", "Полная запись, ответственный и условия")}</summary><p className={styles.preserve}>{node.detail}</p></details>
    </li>)}</ul>
    {limit < matches.length && <button type="button" onClick={() => setLimit(value => value + 10)}>{t("Show 10 more records", "Показать ещё 10 записей")}</button>}
    <p className={styles.muted}>{t("This index searches recorded text; it does not establish an operational chronology, legal deadline, selected route or completed task. Full records remain in the decision map and Full-analysis export.", "Индекс ищет по записанному тексту; он не устанавливает фактическую хронологию, правовой срок, выбранный путь или выполнение задачи. Полные записи сохранены на карте решений и в полном аналитическом экспорте.")}</p>
  </div>;
}
