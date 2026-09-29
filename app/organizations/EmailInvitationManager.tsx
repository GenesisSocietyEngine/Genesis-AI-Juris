"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigationController } from "../NavigationSession";
import { useNavigationFormGuard } from "../use-navigation-form-guard";
import type { ClientOrganization } from "../organization-client";
import { invitationDeliveryText, invitationErrorText, invitationRoleText, postInvitation } from "../invitation-client";
import { readWithTimeout } from "../read-with-timeout";
import styles from "./organizations.module.css";

type Invitation = { id: string; recipientEmail: string; role: string; status: string; expiresAt: string; delivery: string };
export default function EmailInvitationManager({ organization, label, locale }: { organization: ClientOrganization; label: string; locale: "en" | "ru" }) {
  const navigation = useNavigationController();
  const [list, setList] = useState<Invitation[]>([]), [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState(""), [notice, setNotice] = useState("");
  const [share, setShare] = useState<{ id: string; link: string; email: string; role: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const active = useRef(true), pending = useRef(false), readGeneration = useRef(0);
  const { root, committed } = useNavigationFormGuard(busy);
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const refresh = useCallback(async () => {
    const ticket = navigation.authorityVersion, generation = ++readGeneration.current;
    const result = await readWithTimeout(async signal => {
      const response = await fetch(`/api/invitations?organization=${encodeURIComponent(organization.selection)}`, { cache: "no-store", credentials: "same-origin", signal });
      const data = await response.json() as { code?: string; invitations?: Invitation[] };
      if (!response.ok || !Array.isArray(data.invitations)) throw new Error(data.code ?? "network");
      return data.invitations as Invitation[];
    });
    if (active.current && navigation.authorityVersion === ticket && generation === readGeneration.current) { setList(result); setLoaded(true); }
  }, [navigation, organization.selection]);
  useEffect(() => {
    active.current = true;
    void refresh().catch(() => { if (active.current) setIssue("network"); });
    return () => { active.current = false; };
  }, [refresh]);
  async function submit(action: "invite" | "resend" | "revoke", invitationId?: string, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (pending.current) return;
    const form = event?.currentTarget, ticket = navigation.authorityVersion;
    pending.current = true; setBusy(true); setIssue(""); setNotice("");
    const payload: Record<string, unknown> = form ? Object.fromEntries(new FormData(form)) : { invitationId };
    let confirmed = false;
    try {
      const { response, data: result } = await postInvitation({ ...payload, action, organizationId: organization.selection });
      if (!active.current || ticket !== navigation.authorityVersion) return;
      if (!response.ok) {
        if (response.status === 401) navigation.invalidate("expired");
        throw new Error(result.code ?? "network");
      }
      if (action === "revoke") { if (result.ok !== true) throw new Error("invalid_receipt"); if (share?.id === invitationId) setShare(null); setNotice(t("Invitation revoked.", "Приглашение отозвано.")); }
      else {
        if (typeof result.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(result.token) || !result.id || !result.expiresAt) throw new Error("invalid_receipt");
        const previous = list.find(item => item.id === invitationId);
        setShare({ id: result.id, link: `${window.location.origin}/invitations#invite=${result.token}`, email: String(payload.recipientEmail ?? previous?.recipientEmail ?? ""), role: String(payload.role ?? previous?.role ?? "") });
        setNotice(t("Invitation created. Membership is pending acceptance. ", "Приглашение создано. Вступление ожидает принятия. ") + invitationDeliveryText(String(result.delivery), locale));
      }
      confirmed = true;
      if (form) { form.reset(); committed(form); }
      await refresh();
    } catch (error) { if (active.current && ticket === navigation.authorityVersion) setIssue(confirmed ? "invitation_history_refresh" : error instanceof Error ? error.message : "network"); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }
  const statusLabel = (value: string) => ({ pending: t("Pending acceptance", "Ожидает принятия"), accepted: t("Accepted", "Принято"), expired: t("Expired", "Истекло"), revoked: t("Revoked", "Отозвано"), superseded: t("Replaced by a new invitation", "Заменено новым приглашением") }[value] ?? value);
  return <section ref={root} aria-labelledby="email-invitations-title">
    <h3 id="email-invitations-title">{t("Invite a member", "Пригласить участника")}</h3>
    <form id="email-invitation-form" className={styles.invite} onSubmit={event => void submit("invite", undefined, event)}>
      <fieldset disabled={busy}><legend>{t("Invitation to", "Приглашение в")} {label}</legend>
        <p id="email-invitation-help">{t("The recipient signs in with this email, verifies their mailbox and explicitly accepts. Case access is assigned separately.", "Получатель входит с этим email, подтверждает почту и явно принимает приглашение. Доступ к делам назначается отдельно.")}</p>
        <label>{t("Recipient email", "Email получателя")}<input name="recipientEmail" type="email" autoComplete="email" required maxLength={254} aria-describedby="email-invitation-help email-invitation-issue" /></label>
        <label>{t("Organization role", "Роль в организации")}<select name="role"><option value="member">{t("Member", "Участник")}</option><option value="org_admin">{t("Administrator", "Администратор")}</option><option value="auditor">{t("Auditor", "Аудитор")}</option></select></label>
        <button type="submit">{busy ? t("Working…", "Выполнение…") : t("Invite member", "Пригласить участника")}</button>
      </fieldset>
    </form>
    <div id="email-invitation-issue" role="alert">{issue && <p className={styles.issue}>{invitationErrorText(issue, locale)}</p>}</div>
    {notice && <p role="status">{notice}</p>}
    {share && <div className={styles.token}>
      <p>{share.email} · {label}</p>
      <p>{t("Invited role", "Предлагаемая роль")}: {invitationRoleText(share.role, locale)}</p>
      <p>{t("For controlled sharing, this link is bound to the recipient email and expires in 24 hours. It does not replace mailbox verification.", "Для контролируемой передачи: ссылка привязана к email получателя и действует 24 часа. Она не заменяет подтверждение почты.")}</p>
      <label>{t("Invitation link", "Ссылка приглашения")}<input readOnly value={share.link} onFocus={event => event.target.select()} /></label>
      <button type="button" onClick={() => void navigator.clipboard.writeText(share.link).then(() => setNotice(t("Invitation link copied.", "Ссылка скопирована."))).catch(() => setNotice(t("Select and copy the link above.", "Выделите и скопируйте ссылку выше.")))}>{t("Copy invitation link", "Скопировать ссылку приглашения")}</button>
      <button type="button" onClick={() => setShare(null)}>{t("Dismiss link", "Скрыть ссылку")}</button>
    </div>}
    <h3>{t("Invitation history", "История приглашений")}</h3>
    <button type="button" disabled={busy} onClick={() => { setIssue(""); void refresh().catch(() => setIssue("network")); }}>{t("Refresh invitations", "Обновить приглашения")}</button>
    {!loaded && <p role="status">{t("Invitation history has not loaded.", "История приглашений не загружена.")}</p>}
    {loaded && list.length === 0 && <p>{t("No email invitations yet.", "Приглашений по email пока нет.")}</p>}
    <ul className={styles.invitationList}>{list.map(item => <li key={item.id}>
      <strong>{item.recipientEmail}</strong> · {statusLabel(item.status)}
      <p>{t("Invited role", "Предлагаемая роль")}: {invitationRoleText(item.role, locale)}</p>
      <p>{invitationDeliveryText(item.delivery, locale)}</p>
      <p>{t("Link expires", "Ссылка действует до")}: {new Date(item.expiresAt).toLocaleString(locale)}</p>
      {["pending", "expired"].includes(item.status) && <><button disabled={busy} onClick={() => void submit("resend", item.id)}>{t("Resend with a new link", "Отправить новую ссылку")}</button><button disabled={busy} onClick={() => void submit("revoke", item.id)}>{t("Revoke", "Отозвать")}</button></>}
    </li>)}</ul>
  </section>;
}
