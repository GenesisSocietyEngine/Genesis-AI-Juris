"use client";
import { useEffect } from "react";
import { useInterfaceLocale } from "../use-interface-locale";
import { useWorkspaceDraft } from "./WorkspaceDrafts";
import { enrollmentChoices, memberIdIssue, type EnrollmentRoster } from "./participant-enrollment-model";
import type { ParticipantItem } from "./matter-view-model";
import styles from "./matters.module.css";

export default function ParticipantEnrollment({ roster, participants, mutationKey, onEnroll, onRefresh }: {
  roster: EnrollmentRoster; participants: ParticipantItem[]; mutationKey: string | null;
  onEnroll: (fields: Record<string, unknown>) => void; onRefresh: () => void;
}) {
  const [locale] = useInterfaceLocale();
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [selectedId, setSelectedId] = useWorkspaceDraft("enrollment-selected", "");
  const [manualId, setManualId] = useWorkspaceDraft("enrollment-manual", "");
  const [role, setRole] = useWorkspaceDraft("enrollment-role", "reviewer");
  const { choices, ambiguous } = enrollmentChoices(roster, participants);
  const selected = choices.find(member => member.actorId === selectedId);
  const busy = mutationKey !== null;
  const enrolling = mutationKey === "participant-enroll";
  const manualIssue = manualId ? memberIdIssue(manualId) : null;
  useEffect(() => {
    if (selectedId && (roster.status === "restricted" || roster.status === "ready" && !selected)) setSelectedId("");
  }, [selectedId, selected, roster.status, setSelectedId]);
  const roles = <label className={styles.field}><span>{t("Case role", "Роль в деле")}</span>
    <select value={role} onChange={event => setRole(event.target.value)} disabled={busy}>
      <option value="reviewer">{t("Reviewer", "Рецензент")}</option>
      <option value="contributor">{t("Contributor", "Участник")}</option>
      <option value="viewer">{t("Viewer", "Наблюдатель")}</option>
    </select></label>;
  const consequences = <div className={styles.enrollmentConsequences}>
    <strong>{t("Access changes when you confirm", "Доступ изменится после подтверждения")}</strong>
    <p>{role === "reviewer" ? t("A reviewer can review evidence and approve case outputs.", "Рецензент может проверять доказательства и утверждать результаты дела.")
      : role === "contributor" ? t("A contributor can edit the case and upload sources.", "Участник может редактировать дело и загружать источники.")
      : t("A viewer can read the case and download its available outputs.", "Наблюдатель может читать дело и скачивать доступные результаты.")}</p>
    <p>{t("Adding a person grants this case role immediately and marks current governed outputs as stale. It does not send an invitation or change their organization role.",
      "Добавление сразу предоставляет эту роль в деле и помечает текущие контролируемые результаты как устаревшие. Приглашение не отправляется, роль в организации не изменяется.")}</p>
  </div>;
  return <div className={styles.sectionStack}>
    {roster.status === "ready" ? <>
      <p id="enrollment-roster-help">{t("Choose from the organization members your current access allows you to see. This list shows up to 100 returned memberships; it is not a complete directory.",
        "Выберите участника организации из доступного вам списка. Здесь показаны до 100 полученных записей, а не полный каталог.")}</p>
      {roster.limited && <p>{t("Other organization members may be outside this returned list.", "Другие участники организации могут не попасть в этот список.")}</p>}
      {ambiguous && <p>{t("People with missing or matching names require their exact Member ID below.",
        "Для людей без имени или с совпадающими именами укажите точный идентификатор участника ниже.")}</p>}
      {choices.length ? <form className={styles.actionForm} data-own-drafts onSubmit={event => {
        event.preventDefault(); if (selected && !busy) onEnroll({ actorId: selected.actorId, role });
      }}>
        <label className={styles.field}><span>{t("Organization member", "Участник организации")}</span>
          <select aria-describedby="enrollment-roster-help" value={selected?.actorId ?? ""} onChange={event => setSelectedId(event.target.value)} disabled={busy} required>
            <option value="">{t("Choose a person…", "Выберите человека…")}</option>
            {choices.map(member => <option key={member.actorId} value={member.actorId}>{member.name}</option>)}
          </select></label>
        {selected && <details><summary>{t("Check selected member identity", "Проверить выбранного участника")}</summary>
          <p>{selected.name}</p><code style={{ overflowWrap: "anywhere" }}>{selected.actorId}</code></details>}
        {roles}{consequences}
        <button className={styles.primaryButton} disabled={busy || !selected}>{enrolling ? t("Adding participant…", "Добавление участника…") : t("Add to this case", "Добавить в дело")}</button>
      </form> : <p role="status">{t("No eligible person is available in the returned member list. Existing case participants, inactive memberships and ambiguous names are excluded.",
        "В полученном списке нет подходящих участников. Уже добавленные в дело люди, неактивные участники и неоднозначные имена исключены.")}</p>}
    </> : <p role="status">{roster.status === "loading" ? t("Checking current organization members…", "Проверяем текущих участников организации…")
      : roster.status === "restricted" ? t("Your organization role does not include access to its member list. You can still add an existing member using their exact Member ID.",
        "Ваша роль в организации не даёт доступа к списку участников. Вы можете добавить существующего участника по его точному идентификатору.")
      : t("The member list is unavailable. Refresh it or use an exact Member ID from an authorized source.", "Список участников недоступен. Обновите его или используйте точный идентификатор из разрешённого источника.")}</p>}
    {roster.status !== "restricted" && <button type="button" className={styles.secondaryButton} disabled={busy || roster.status === "loading"} onClick={onRefresh}>{t("Refresh member list", "Обновить список участников")}</button>}
    <details open={roster.status === "restricted"} className={styles.metadataEditor}>
      <summary>{t("Use Member ID (advanced)", "Использовать идентификатор участника")}</summary>
      <form className={styles.actionForm} data-own-drafts onSubmit={event => {
        event.preventDefault(); if (manualId.trim() && !memberIdIssue(manualId) && !busy) onEnroll({ actorId: manualId.trim(), role });
      }}>
        <p id="enrollment-id-help">{t("Use the complete ID of an existing active organization member, provided by an authorized source. An email address or display name is not a Member ID. This does not look up people by email or invite new members.",
          "Используйте полный идентификатор существующего активного участника организации из разрешённого источника. Email или имя не заменяют идентификатор. Поиск по email и приглашение новых участников здесь не выполняются.")}</p>
        <label className={styles.field}><span>{t("Exact Member ID", "Точный идентификатор участника")}</span>
          <input value={manualId} onChange={event => setManualId(event.target.value)} disabled={busy} required minLength={8} maxLength={128}
            autoComplete="off" spellCheck={false} aria-describedby={manualIssue ? "enrollment-id-help enrollment-id-error" : "enrollment-id-help"} aria-invalid={Boolean(manualIssue)}/></label>
        {manualIssue && <p id="enrollment-id-error" role="alert">{manualIssue === "email" ? t("Enter the Member ID, not an email address.", "Введите идентификатор участника, а не email.")
          : t("Enter the complete Member ID using letters, numbers, underscores or hyphens.", "Введите полный идентификатор: буквы, цифры, подчёркивания или дефисы.")}</p>}
        {roles}{consequences}
        <button className={styles.primaryButton} disabled={busy || !manualId.trim() || Boolean(manualIssue)}>{enrolling ? t("Adding participant…", "Добавление участника…") : t("Add to this case", "Добавить в дело")}</button>
      </form>
    </details>
  </div>;
}
