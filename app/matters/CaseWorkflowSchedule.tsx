"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import { useWorkspaceLocation } from "../use-interface-locale";
import { workspaceDestination } from "../workspace-navigation";
import {
  milestoneNames,
  previewSteps,
  reviewSchedule,
  type DateDisposition,
  type MilestoneDate,
  type ReviewRow,
} from "../work/workflow-milestones";
import { workflowLabel } from "../work/workflow-labels";
import { readableDate } from "../work/work-presentation";
import { validDate } from "./practice-scheduling";
import { PRACTICE_WORKFLOWS, practiceWorkflowLabel } from "./practice-plan";
import { useWorkspaceDraft } from "./WorkspaceDrafts";
import type { WorkspaceController } from "./workspace-controller";
import styles from "./practice.module.css";

type Draft = { application: string; template: string; dates: MilestoneDate[]; assignee: string };
type Locale = "en" | "ru";
const labels: Record<DateDisposition, [string, string]> = {
  add: ["Will add", "Будет добавлено"],
  move: ["Will move", "Будет перенесено"],
  unchanged: ["Same date", "Та же дата"],
  manual: ["Kept · manual date", "Сохранено · ручная дата"],
  completed: ["Kept · completed", "Сохранено · завершено"],
  scheduled: ["Kept · individual schedule", "Сохранено · своё расписание"],
  missing: ["Unavailable", "Недоступно"],
};
function stamp(date: string | null, locale: Locale) {
  return validDate(date)
    ? readableDate(date, locale, { year: "numeric", month: "short", day: "numeric" })
    : "—";
}

export default function CaseWorkflowSchedule({
  owner,
  locale,
  disabled,
}: {
  owner: WorkspaceController;
  locale: Locale;
  disabled: boolean;
}) {
  const t = (en: string, ru: string) => (locale === "ru" ? ru : en);
  const { plan, pending } = owner.practice;
  const { matter } = owner.getSnapshot().bundle!;
  const [raw, setRaw] = useWorkspaceDraft("workflow-schedule", "");
  const draft: Draft | null = raw ? JSON.parse(raw) : null;
  const [selected, select] = useState(
    () =>
      draft?.application ||
      (typeof window === "undefined"
        ? ""
        : new URLSearchParams(window.location.search).get("workflow") || ""),
  );
  const [templateId, chooseTemplate] = useState<string>(() => draft?.template || PRACTICE_WORKFLOWS[0].id);
  const [loaded, setLoaded] = useState<{key:string; result:Awaited<ReturnType<typeof owner.loadWorkflowSchedule>>} | null>(null);
  const [reload, retry] = useState(0), [reviewed, setReviewed] = useState("");
  const [notice, setNotice] = useState("");
  const location = useWorkspaceLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const revision = plan.revision;
  const loadKey = JSON.stringify([selected,revision,reload]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("workflow", selected);
    else url.searchParams.delete("workflow");
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new Event("genesis-interface-change"));
    }
  }, [selected]);
  useEffect(() => {
    let current = true;
    if (selected && owner.practice.loaded)
      void owner.loadWorkflowSchedule(selected).then((result) => {
        if (current) setLoaded({key: loadKey, result});
      });
    return () => {
      current = false;
    };
  }, [owner, selected, loadKey, owner.practice.loaded]);
  const reply = loaded?.key === loadKey ? loaded.result : null;
  const schedule = reply?.revision === revision && reply.schedule.workflow === selected ? reply.schedule : null;
  const failed = loaded?.key === loadKey && !schedule;
  const templates = [...PRACTICE_WORKFLOWS, ...owner.workflowTemplates.items];
  const template = templates.find((item) => item.id === templateId);
  const dates = (
    selected
      ? (schedule?.dates ?? [])
      : template
        ? milestoneNames(template.steps).map((name) => ({ name, date: "" }))
        : []
  ).map((d) => draft?.dates.find((value) => value.name === d.name) ?? d);
  const current: Draft = {
    application: selected,
    template: templateId,
    dates,
    assignee: draft?.assignee ?? "",
  };
  const change = (patch: Partial<Draft>) => {
    setRaw(JSON.stringify({ ...current, ...patch }));
    setReviewed("");
    setNotice("");
  };
  const applies = new Map<string, string>();
  plan.items.forEach((item) => {
    if (item.workflow)
      applies.set(item.workflow, item.workflowTitle ?? practiceWorkflowLabel(item.workflow, locale));
  });
  const version = template && "version" in template ? template.version : undefined;
  const signature = JSON.stringify([revision, current, version]);
  const duplicate =
    !selected &&
    dates[0]?.date &&
    applies.has(templateId + (version ? "@" + version : "") + ":" + dates[0].date);
  let rows: ReviewRow[] = [],
    error = "",
    changed = false;
  if (dates.length && dates.every((d) => d.date)) {
    try {
      if (schedule) {
        const preview = reviewSchedule(plan, schedule, dates);
        rows = preview.rows;
        changed = preview.changed;
      } else if (!selected && template) {
        rows = previewSteps(template.steps, dates).map((row, i) => ({
          id: String(i),
          title: row.title,
          kind: row.kind,
          previous: null,
          date: row.dueDate,
          reason: "add",
        }));
        changed = true;
      }
    } catch {
      error = t(
        "Check the milestone dates and their day offsets.",
        "Проверьте даты этапов и смещения в днях.",
      );
    }
  }
  const visible = reviewed === signature && rows.length > 0;
  const canSchedule = matter.permissions.canWrite && owner.practice.canSchedule !== false;
  const editing = canSchedule && !disabled;
  const save = async (recover = false) => {
    const command = recover
      ? pending
      : selected
        ? { action: "reschedule_workflow", workflow: selected, milestones: dates, expectedRevision: revision }
        : {
            action: "apply_workflow",
            templateId,
            ...(version ? { templateVersion: version } : {}),
            milestones: dates,
            assignee: current.assignee || null,
            expectedRevision: revision,
          };
    if (!command || (!recover && (!visible || !changed || duplicate))) return;
    setReviewed("");
    setNotice("");
    if (await owner.savePractice(recover ? undefined : command)) {
      setRaw("");
      const firstDate = (command.milestones as MilestoneDate[] | undefined)?.[0]?.date ?? command.anchor;
      const application = command.action === "reschedule_workflow" ? String(command.workflow) :
        String(command.templateId) + (command.templateVersion ? "@" + command.templateVersion : "") + ":" + firstDate;
      if (owner.practice.plan.items.some(item => item.workflow === application)) select(application);
      retry((v) => v + 1);
      setNotice(t("Workflow dates saved to this case.", "Даты процесса сохранены в этом деле."));
    }
  };
  const recover = pending?.action === "reschedule_workflow" || pending?.action === "apply_workflow";
  return (
    <section
      className={styles.workflowSchedule}
      aria-label={t("Workflow scheduling", "Планирование процессов")}
    >
      <div className={styles.heading}>
        <h3>{t("Case workflows", "Процессы дела")}</h3>
        <a
          href={workspaceDestination(
            "/work?view=templates&organization=" +
              encodeURIComponent(owner.options.identity.organizationId) +
              "&lang=" +
              locale,
            location || "/matters?dossier=" + encodeURIComponent(matter.id),
          )}
        >
          {t("Firm workflow templates", "Шаблоны организации")}
        </a>
      </div>
      <div className={styles.editor}>
        <div className={styles.heading}>
          <h3>
            <WorkspaceIcon name="calendar" />
            {t("Milestone dates", "Даты этапов")}
          </h3>
          <StatusBadge tone={recover ? "today" : raw ? "open" : "neutral"}>
            {recover
              ? t("Save unconfirmed", "Сохранение не подтверждено")
              : raw
                ? t("Unsaved changes", "Есть изменения")
                : selected
                  ? t("Saved dates", "Даты сохранены")
                  : t("New workflow", "Новый процесс")}
          </StatusBadge>
        </div>
        <p className={styles.hint}>
          {matter.title}
          {!canSchedule && " · " + t("Read only", "Только просмотр")}
        </p>
        <label>
          {t("Workflow", "Процесс")}
          <select
            value={selected}
            disabled={Boolean(raw) || Boolean(pending) || owner.busy}
            onChange={(e) => {
              select(e.target.value);
              setReviewed("");
              setNotice("");
            }}
          >
            <option value="">{t("Apply a new workflow", "Применить новый процесс")}</option>
            {Array.from(applies, ([key, title]) => (
              <option key={key} value={key}>
                {title} · {t("original date", "исходная дата")} {stamp(key.split(":").at(-1)!, locale)}
              </option>
            ))}
          </select>
        </label>
        {!selected && (
          <div className={styles.fields}>
            <label>
              {t("Template", "Шаблон")}
              <select
                disabled={Boolean(raw) || disabled}
                value={templateId}
                onChange={(e) => {
                  chooseTemplate(e.target.value);
                  setReviewed("");
                  setNotice("");
                }}
              >
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {"version" in item ? item.title : practiceWorkflowLabel(item.id, locale)}
                  </option>
                ))}
              </select>
            </label>
            {canSchedule && (
              <label>
                {t("Assigned to", "Исполнитель")}
                <select
                  value={current.assignee}
                  disabled={!editing}
                  onChange={(e) => change({ assignee: e.target.value })}
                >
                  <option value="">{t("Unassigned", "Не назначено")}</option>
                  {matter.participants
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        )}
        {owner.workflowTemplates.issue && (
          <div role="alert">
            {owner.workflowTemplates.issue}{" "}
            <button type="button" onClick={() => void owner.loadWorkflowTemplates()}>
              {t("Refresh templates", "Обновить шаблоны")}
            </button>
          </div>
        )}
        {selected && !schedule && (
          <div role="status">
            {failed
              ? t("Dates changed or could not be loaded.", "Даты изменились или недоступны.")
              : t("Loading saved dates…", "Загрузка дат…")}{" "}
            {failed && (
              <button
                type="button"
                onClick={async () => {
                  await owner.loadPractice();
                  retry((v) => v + 1);
                }}
              >
                {t("Refresh dates", "Обновить даты")}
              </button>
            )}
          </div>
        )}
        {dates.length > 0 && (
          <>
            <p className={styles.hint}>
              {selected
                ? t(
                    "Review how a date change affects this case’s tasks and events.",
                    "Проверьте, как изменение дат повлияет на задачи и события дела.",
                  )
                : t(
                    "Choose the milestone dates. Step offsets use calendar days.",
                    "Выберите даты этапов. Смещения шагов считаются в календарных днях.",
                  )}
            </p>
            <div className={styles.fields}>
              {dates.map((d) => (
                <label key={d.name}>
                  {workflowLabel(d.name, selected || templateId, locale)}
                  <input
                    type="date"
                    disabled={!editing}
                    value={d.date}
                    onChange={(e) =>
                      change({
                        dates: dates.map((entry) =>
                          entry.name === d.name ? { ...entry, date: e.target.value } : entry,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {duplicate && (
          <p role="status">
            {t(
              "This template is already applied for that start. Select its saved workflow above.",
              "Процесс на эту дату уже применён. Выберите его в списке выше.",
            )}
          </p>
        )}
        <div className={styles.scheduleActions}>
          {recover ? (
            <button disabled={owner.busy} onClick={() => void save(true)}>
              {t("Recover original save", "Восстановить сохранение")}
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || !rows.length || Boolean(duplicate)}
              onClick={() => {
                setReviewed(signature);
                requestAnimationFrame(() => heading.current?.focus());
              }}
            >
              <WorkspaceIcon name="calendar" />
              {t("Preview dates", "Проверить даты")}
            </button>
          )}
          {raw && !pending && (
            <button
              disabled={owner.busy}
              onClick={() => {
                setRaw("");
                setNotice("");
                setReviewed("");
              }}
            >
              {t("Discard date edits", "Отменить изменения дат")}
            </button>
          )}
        </div>
        {visible && (
          <section className={styles.scheduleReview}>
            <h3 ref={heading} tabIndex={-1}>
              {t("Date preview", "Предпросмотр дат")}
            </h3>
            <ul className={styles.list}>
              {rows.map((row) => (
                <li key={row.id} className={styles.scheduleRow}>
                  <WorkspaceIcon name={row.kind === "event" ? "calendar" : "tasks"} />
                  <div>
                    <strong>{row.title ? workflowLabel(row.title, selected || templateId, locale) : t("Removed work item", "Удалённая запись")}</strong>
                    <small>
                      {row.reason === "move"
                        ? stamp(row.previous, locale) + " → " + stamp(row.date, locale)
                        : stamp(row.date, locale)}
                    </small>
                  </div>
                  <StatusBadge
                    tone={
                      row.reason === "completed"
                        ? "completed"
                        : row.reason === "move" || row.reason === "add"
                          ? "scheduled"
                          : "neutral"
                    }
                  >
                    {labels[row.reason][locale === "ru" ? 1 : 0]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
            {canSchedule && changed && (
              <button className={styles.primary} disabled={!editing} onClick={() => void save()}>
                <WorkspaceIcon name="save" />
                {selected
                  ? t("Save milestone dates", "Сохранить даты этапов")
                  : t("Apply workflow to case", "Применить процесс к делу")}
              </button>
            )}
          </section>
        )}
        {notice && <p role="status">{notice}</p>}
      </div>
      {selected && applies.has(selected) && (
        <div className={styles.progress}>
          <strong>{applies.get(selected)}</strong>
          <span>
            {plan.items.filter((i) => i.workflow === selected && i.status === "completed").length} /{" "}
            {plan.items.filter((i) => i.workflow === selected).length} {t("completed", "завершено")}
          </span>
          <progress
            aria-label={t("Workflow progress", "Выполнение процесса")}
            value={plan.items.filter((i) => i.workflow === selected && i.status === "completed").length}
            max={plan.items.filter((i) => i.workflow === selected).length}
          />
        </div>
      )}
    </section>
  );
}
