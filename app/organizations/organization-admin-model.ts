import type { ClientOrganization } from "../organization-client";

export type AdminIssue = { code: string; status: number; scope: string; refreshOnly?: boolean };
export type AdminRecovery = "signin" | "profile" | "refresh" | "edit";

/** Translate known outcomes only. Never expose arbitrary server errors or infer lost authentication from validation. */
export function organizationIssue(issue: AdminIssue, locale: "en" | "ru") {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  let recovery: AdminRecovery = "edit";
  let message: string;
  if (issue.status === 401) {
    recovery = "signin";
    message = issue.code === "signin_required" ? t("Sign in to manage organizations. Then return here and refresh to continue.", "Войдите для управления организациями. Затем вернитесь сюда и обновите данные.") : t("Your session has expired. Sign in again, then refresh this page. Your entered information remains here.", "Сеанс истёк. Войдите снова и обновите данные на этой странице. Введённая информация сохранена здесь.");
  } else if (issue.code === "profile_required") {
    recovery = "profile";
    message = t("Complete your account profile before managing organizations.", "Заполните профиль аккаунта перед управлением организациями.");
  } else if (issue.refreshOnly) {
    recovery = "refresh";
    message = t("The change was saved, but the updated organization could not be loaded. Refresh the details; do not submit the change again.", "Изменение сохранено, но обновлённые данные не загрузились. Обновите данные; не отправляйте изменение повторно.");
  } else if (issue.code === "read_timeout") {
    recovery = "refresh";
    message = t("Loading organizations took too long. Check your connection and refresh the details. Your entered information is retained.", "Загрузка организаций заняла слишком много времени. Проверьте соединение и обновите данные. Введённая информация сохранена.");
  } else if (issue.code === "invitation_self") {
    message = t("This is your own member ID. You already have access. Enter the other person's member ID.", "Это ваш идентификатор. У вас уже есть доступ. Введите идентификатор другого человека.");
  } else if (issue.code === "invitation_unavailable" || issue.code === "invitation_member_exists") {
    message = t("This person already has active membership. Manage their access in the members list.", "У этого человека уже есть активное членство. Измените его доступ в списке участников.");
  } else if (issue.code === "invitation_member_suspended") {
    message = t("This person's access is suspended. Use Restore access in the members list instead of creating an invitation.", "Доступ этого человека приостановлен. Используйте «Восстановить доступ» в списке участников вместо нового приглашения.");
  } else if (issue.code === "invitation_member_removed") {
    message = t("This membership was removed and cannot be reopened by invitation. Review its history with the organization owner.", "Это членство удалено; новое приглашение не может его восстановить. Обсудите историю доступа с владельцем организации.");
  } else if (issue.code === "invitation_fields_invalid") {
    message = t("Enter the recipient's complete member ID, not an email address or your own ID.", "Введите полный идентификатор получателя, а не email или собственный идентификатор.");
  } else if (issue.scope === "accept" && issue.status === 404) {
    message = t("This invitation cannot be accepted by the current account. Check the code and account, or ask the owner for a new invitation.", "Текущий аккаунт не может принять это приглашение. Проверьте код и аккаунт или попросите владельца выдать новое приглашение.");
  } else if (["membership_changed", "organization_context_changed"].includes(issue.code)) {
    recovery = "refresh";
    message = t("Access changed since this page was opened. Refresh the current details before trying again.", "Доступ изменился после открытия страницы. Обновите данные перед повторной попыткой.");
  } else if (issue.code === "organization_name_invalid") {
    message = t("Use an organization name containing 2–120 characters.", "Название организации должно содержать 2–120 символов.");
  } else if (issue.code === "organization_limit") {
    message = t("The organization limit has been reached. Choose an existing organization.", "Достигнут лимит организаций. Выберите существующую организацию.");
  } else if (issue.status === 403 || issue.status === 404) {
    recovery = "refresh";
    message = t("Your current access does not allow this action. Refresh your organizations or ask the organization owner.", "Текущий доступ не позволяет выполнить это действие. Обновите список организаций или обратитесь к владельцу.");
  } else if (issue.status === 409) {
    recovery = "refresh";
    message = t("This action conflicts with the current organization state. Refresh and review the available action.", "Действие не соответствует текущему состоянию организации. Обновите данные и проверьте доступное действие.");
  } else {
    recovery = "refresh";
    message = t("The request could not be confirmed. Your inputs are retained. Refresh the current state before submitting again.", "Запрос не подтверждён. Введённые данные сохранены. Обновите текущее состояние перед повторной отправкой.");
  }
  if (issue.refreshOnly && (recovery === "signin" || recovery === "profile")) {
    message = t("Your change was saved. Do not submit it again. ", "Изменение сохранено. Не отправляйте его повторно. ") + message;
  }
  return { message, recovery };
}

export function invitationRecipientIssue(value: string, actorId: string, members: Array<{ actorId: string; status: string }>) {
  const recipient = value.trim();
  if (recipient === actorId) return "invitation_self";
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(recipient)) return "invitation_fields_invalid";
  const existing = members.find(member => member.actorId === recipient);
  if (existing) return existing.status === "suspended" ? "invitation_member_suspended" : existing.status === "removed" ? "invitation_member_removed" : "invitation_member_exists";
  return null;
}

export function validOrganizationReceipt(value: unknown, actorId: string, expectedId?: string): value is ClientOrganization {
  if (!value || typeof value !== "object") return false;
  const o = value as Partial<ClientOrganization>;
  return typeof o.id === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(o.id)
    && (!expectedId || o.id === expectedId) && o.actorId === actorId
    && typeof o.name === "string" && o.status === "active"
    && ["org_owner","org_admin","member","auditor"].includes(String(o.role))
    && Number.isSafeInteger(o.revision) && o.revision! >= 1 && Number.isSafeInteger(o.membershipRevision) && o.membershipRevision! >= 1
    && o.selection === `${o.id}.${o.revision}.${o.membershipRevision}.${o.actorId}`;
}
