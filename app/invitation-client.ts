export const INVITATION_CONTINUATION_KEY = "genesis-invitation-continuation-v1";
export type InvitationContinuation = { token: string; proof: string; expiresAt: number };
export function invitationRoleText(role: string, locale: "en" | "ru") {
  return ({ org_owner: ["Owner", "Владелец"], org_admin: ["Administrator", "Администратор"], auditor: ["Auditor", "Аудитор"], member: ["Member", "Участник"] } as Record<string, string[]>)[role]?.[locale === "ru" ? 1 : 0] ?? role;
}
/** Timeout means unknown outcome. This helper never retries a mutation. */
export async function postInvitation(payload: Record<string, unknown>, timeoutMs = 20_000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("invitation_outcome_unknown")); }, timeoutMs); });
  try {
    return await Promise.race([timedOut, (async () => {
      const response = await fetch("/api/invitations", { method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { code?: string; delivery?: string; organization?: unknown; token?: string; id?: string; expiresAt?: string; ok?: boolean };
      return { response, data };
    })()]);
  } finally { clearTimeout(timer!); }
}
const valid = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export function parseInvitationContinuation(value: unknown, now = Date.now()): InvitationContinuation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<InvitationContinuation>;
  return valid(record.token) && (record.proof === "" || valid(record.proof)) && typeof record.expiresAt === "number"
    && record.expiresAt > now && record.expiresAt <= now + 86_400_000
    ? { token: record.token, proof: record.proof, expiresAt: record.expiresAt } : null;
}
export function invitationFromFragment(hash: string): InvitationContinuation | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!valid(params.get("invite")) || params.getAll("invite").length !== 1 || params.getAll("proof").length > 1) return null;
  return parseInvitationContinuation({ token: params.get("invite"), proof: params.get("proof") ?? "", expiresAt: Date.now() + 86_400_000 });
}
export function invitationDeliveryText(delivery: string, locale: "en" | "ru") {
  const messages: Record<string, [string, string]> = {
    not_configured: ["Email was not sent: invitation email is not configured. Acceptance still requires mailbox verification.", "Письмо не отправлено: отправка приглашений не настроена. Для вступления требуется подтверждение почты."],
    provider_accepted: ["Submitted to the email provider. Delivery has not been confirmed.", "Передано почтовому сервису. Доставка не подтверждена."],
    failed: ["The email provider rejected this message. Retry after the sender configuration is corrected.", "Почтовый сервис отклонил письмо. Повторите после исправления настроек отправителя."],
    unknown: ["Email submission could not be confirmed. A retry creates a new link and replaces the previous one.", "Отправка письма не подтверждена. Повторная отправка создаст новую ссылку и заменит предыдущую."],
  };
  return (messages[delivery] ?? messages.unknown)[locale === "ru" ? 1 : 0];
}
export function invitationErrorText(code: string, locale: "en" | "ru") {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  if (code === "invitation_history_refresh") return t("Your change was saved, but invitation history did not refresh. Refresh invitations; do not submit the change again.", "Изменение сохранено, но история не обновилась. Обновите приглашения; не отправляйте изменение повторно.");
  if (code === "invitation_pending_exists") return t("A pending invitation already exists for this email in this organization. Use Resend or Revoke below.", "Для этого email уже есть приглашение в организацию. Используйте повторную отправку или отзыв ниже.");
  if (code === "invitation_member_exists") return t("This person is already a member of this organization. Manage their existing access.", "Этот человек уже состоит в организации. Измените существующий доступ.");
  if (code === "invitation_member_suspended" || code === "invitation_member_removed") return t("An existing membership prevents a new invitation. Review the person's access with the organization owner.", "Существующее членство препятствует новому приглашению. Проверьте доступ с владельцем организации.");
  if (code === "invitation_email_invalid") return t("Enter a valid recipient email and a permitted organization role.", "Введите корректный email получателя и разрешённую роль.");
  if (code === "invitation_rate_limited") return t("Too many invitation attempts. Wait one hour before retrying.", "Слишком много попыток. Повторите через час.");
  if (code === "invitation_verification_required") return t("Mailbox verification is required or has expired. Request a fresh verification email, then open its link.", "Подтверждение почты отсутствует или истекло. Запросите новое письмо и откройте ссылку из него.");
  if (code === "invitation_unavailable") return t("This link is unavailable for the current account. Use the invited email; the link may also have expired, been revoked or been replaced.", "Ссылка недоступна для текущего аккаунта. Используйте приглашённый email; ссылка также могла истечь, быть отозвана или заменена.");
  return t("The request could not be confirmed. Your inputs are retained. Refresh the current state before retrying.", "Запрос не подтверждён. Введённые данные сохранены. Обновите состояние перед повтором.");
}
