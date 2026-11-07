import type { RefObject } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import type { PracticeItem } from "../matters/practice-plan";
import { scheduleLabel } from "../matters/practice-scheduling";
import { workState, workStateLabel } from "./work-presentation";
import styles from "./work.module.css";

export type WorkRow = PracticeItem & { caseId: string; caseTitle: string; participant?: { name: string } };

export default function WorkReadingPane({ item, paneRef, locale, today, zone, href, onClose }: {
  item?: WorkRow; paneRef: RefObject<HTMLElement | null>; locale: "en" | "ru"; today: string; zone: string; href?: string; onClose: () => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const state = item ? workState(item, today, zone) : "open";
  return <section ref={paneRef} tabIndex={-1} data-empty={!item} className={styles.readingPane} aria-label={t("Work reading pane", "Область чтения задачи")}>
    {item ? <>
      <div className={styles.actions}>{href&&<a className={styles.primary} href={href}><WorkspaceIcon name="arrow" />{t("Open in case", "Открыть в деле")}</a>}<button type="button" onClick={onClose}><WorkspaceIcon name="close" />{t("Close preview", "Закрыть просмотр")}</button></div>
      <p className={styles.eyebrow}>{item.caseTitle}</p><h2>{item.title}</h2>
      <div className="cv-badges"><StatusBadge tone={state}>{workStateLabel(state, locale)}</StatusBadge>{item.priority === "high" && <StatusBadge tone="overdue">{t("High priority", "Высокий приоритет")}</StatusBadge>}</div>
      <dl className={styles.detailFields}>
        <div><dt><WorkspaceIcon name="calendar" />{t("Date", "Дата")}</dt><dd>{scheduleLabel(item, zone) || t("No date", "Без даты")}</dd></div>
        <div><dt><WorkspaceIcon name="people" />{t("Assigned to", "Исполнитель")}</dt><dd>{item.participant?.name ?? (item.assignee ? t("Former participant", "Бывший участник") : t("Unassigned", "Не назначено"))}</dd></div>
        <div><dt><WorkspaceIcon name="tasks" />{t("Priority", "Приоритет")}</dt><dd>{item.priority === "high" ? t("High", "Высокий") : item.priority === "low" ? t("Low", "Низкий") : t("Normal", "Обычный")}</dd></div>
      </dl>
      {item.description && <p className={styles.description}>{item.description}</p>}
      {item.series && <p>{t("Recurring task", "Повторяемая задача")} {item.series.index}/{item.series.count}</p>}
      {item.reminder && <p><WorkspaceIcon name="reminder" /> {t("Reminder", "Напоминание")}: {item.reminder.local.replace("T", " ")} ({item.reminder.timeZone}) · {item.reminder.state === "active" ? t("Active", "Активно") : t("Dismissed", "Отключено")}</p>}
      {item.checklist.length > 0 && <><h3>{t("Checklist", "Список действий")}</h3><ul className={styles.checklist}>{item.checklist.map((entry, index) => <li key={index}><WorkspaceIcon name={entry.done ? "check" : "tasks"} /><span>{entry.title}</span><StatusBadge tone={entry.done ? "completed" : "open"}>{entry.done ? t("Done", "Готово") : t("Open", "Открыто")}</StatusBadge></li>)}</ul></>}
      <details className="cv-technical"><summary>{t("Technical details", "Технические сведения")}</summary><p>{t("Case reference", "Идентификатор дела")}: {item.caseId}</p><p>{t("Work reference", "Идентификатор записи")}: {item.id}</p></details>
    </> : <div className={styles.emptyPane}><WorkspaceIcon name="document" /><h2>{t("Your work, in focus", "Работа в фокусе")}</h2><p>{t("Select a task or event to read its details.", "Выберите задачу или событие для просмотра.")}</p></div>}
  </section>;
}
