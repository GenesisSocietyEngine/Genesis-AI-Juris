"use client";
import { useEffect, useRef, useState } from "react";
import WorkspaceNavigation from "../WorkspaceNavigation";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useNavigationFormGuard } from "../use-navigation-form-guard";
import { useInterfaceLocale } from "../use-interface-locale";
import { INVITATION_CONTINUATION_KEY, invitationFromFragment, parseInvitationContinuation, invitationDeliveryText, invitationErrorText, invitationRoleText, postInvitation, type InvitationContinuation } from "../invitation-client";
import { readWithTimeout } from "../read-with-timeout";
import { pendingSignOutMessage } from "../session-boundary";
import { validOrganizationReceipt } from "../organizations/organization-admin-model";
import styles from "../organizations/organizations.module.css";

type Preview = { organizationId: string; organizationName: string; recipientEmail: string; role: string; expiresAt: string; status: string; selection?: string };
export default function InvitationClient() {
  const navigation = useNavigationController(), session = useNavigationSession();
  const [locale] = useInterfaceLocale();
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [continuation, setContinuation] = useState<InvitationContinuation | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null), [previewEpoch, setPreviewEpoch] = useState(-1);
  const [issue, setIssue] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [consent, setConsent] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null), [storageUnavailable, setStorageUnavailable] = useState(false);
  const active = useRef(true), pending = useRef(false), title = useRef<HTMLHeadingElement>(null);
  const continuationGeneration = useRef(0);
  const { root } = useNavigationFormGuard(busy);
  useEffect(() => {
    active.current = true;
    const install = () => {
    continuationGeneration.current++;
    const hadFragment = Boolean(window.location.hash);
    const fromLink = invitationFromFragment(window.location.hash);
    // A fragment never belongs in a server request, auth return URL or referrer.
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    let value = fromLink;
    try {
      if (!value && !hadFragment) value = parseInvitationContinuation(JSON.parse(window.sessionStorage.getItem(INVITATION_CONTINUATION_KEY) ?? "null"));
      if (value) window.sessionStorage.setItem(INVITATION_CONTINUATION_KEY, JSON.stringify(value));
      else window.sessionStorage.removeItem(INVITATION_CONTINUATION_KEY);
    } catch { setStorageUnavailable(true); }
    setContinuation(value); setReady(true);
    setPreview(null); setConsent(false); setAccepted(null); setNotice(""); setIssue("");
    };
    install();
    window.addEventListener("hashchange", install);
    return () => { active.current = false; window.removeEventListener("hashchange", install); };
  }, []);
  useEffect(() => navigation.subscribe(() => {
    const state = navigation.getSnapshot();
    if (state.phase === "denied" || state.phase === "leaving") {
      continuationGeneration.current++;
      setPreview(null); setConsent(false); setAccepted(null); setNotice("");
      if (state.phase === "denied" || state.endingSession) {
        setContinuation(null);
        try { window.sessionStorage.removeItem(INVITATION_CONTINUATION_KEY); } catch { /* Server checks remain authoritative. */ }
      }
    }
  }), [navigation]);
  useEffect(() => {
    if (!continuation || session.phase !== "ready" || session.profileRequired || session.busy || accepted) return;
    const ticket = navigation.authorityVersion, generation = continuationGeneration.current;
    const controller = new AbortController();
    void readWithTimeout(async signal => {
      const response = await fetch("/api/invitations", { method: "POST", cache: "no-store", credentials: "same-origin", signal,
        headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", token: continuation.token }) });
      const data = await response.json() as { code?: string; invitation?: Preview };
      if (!response.ok) throw new Error(data.code ?? "network");
      if (!data.invitation || typeof data.invitation.organizationId !== "string" || typeof data.invitation.recipientEmail !== "string") throw new Error("invalid_receipt");
      return data.invitation as Preview;
    }, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted && ticket === navigation.authorityVersion && generation === continuationGeneration.current) { setPreview(value); setPreviewEpoch(ticket); setIssue(""); setConsent(false); title.current?.focus(); }
    }).catch(error => { if (!controller.signal.aborted && ticket === navigation.authorityVersion && generation === continuationGeneration.current) { setPreview(null); setIssue(error instanceof Error ? error.message : "network"); } });
    return () => controller.abort();
  }, [continuation, session, navigation, accepted]);
  async function act(action: "verify" | "accept") {
    if (pending.current || !continuation || !preview || previewEpoch !== navigation.authorityVersion || action === "accept" && !consent) return;
    const ticket = navigation.authorityVersion, generation = continuationGeneration.current;
    pending.current = true; setBusy(true); setIssue(""); setNotice("");
    try {
      const { response, data } = await postInvitation({ action, token: continuation.token, ...(action === "accept" ? { proof: continuation.proof, organizationId: preview.organizationId } : {}) });
      if (!active.current || ticket !== navigation.authorityVersion || generation !== continuationGeneration.current) return;
      if (!response.ok) { if (response.status === 401) navigation.invalidate("expired"); throw new Error(data.code ?? "network"); }
      if (action === "verify") setNotice(invitationDeliveryText(String(data.delivery), locale) + (data.delivery === "provider_accepted" ? " " + t("If it arrives, open the newest verification link from your mailbox, then accept.", "Если письмо придёт, откройте последнюю ссылку подтверждения из почты и примите приглашение.") : ""));
      else {
        if (!validOrganizationReceipt(data.organization, session.actorId ?? "", preview.organizationId)) throw new Error("invalid_receipt");
        setAccepted(data.organization.selection); setConsent(false);
        try { window.sessionStorage.removeItem(INVITATION_CONTINUATION_KEY); } catch { /* No persistent membership credential. */ }
        setNotice(t("Invitation accepted. You are now a member of this organization. Case access is assigned separately.", "Приглашение принято. Вы стали участником организации. Доступ к делам назначается отдельно."));
        title.current?.focus();
      }
    } catch (error) { if (active.current && ticket === navigation.authorityVersion && generation === continuationGeneration.current) setIssue(error instanceof Error ? error.message : "network"); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }
  const current = session.phase === "ready" && !session.profileRequired && !session.busy && previewEpoch === navigation.authorityVersion;
  const membership = accepted ?? (current && preview?.status === "accepted" ? preview.selection : null);
  const account = `/account?return_to=${encodeURIComponent("/invitations?lang=" + locale)}&lang=${locale}`;
  return <><WorkspaceNavigation active="/organizations" /><main className={styles.page} ref={root} lang={locale}>
    <section className={styles.panel}><h1 ref={title} tabIndex={-1}>{t("Organization invitation", "Приглашение в организацию")}</h1>
      {!ready && <p role="status">{t("Opening invitation…", "Открытие приглашения…")}</p>}
      {storageUnavailable && <p role="alert">{t("This browser cannot retain the invitation through sign-in. After signing in, reopen the original invitation link.", "Браузер не может сохранить приглашение на время входа. После входа снова откройте исходную ссылку.")}</p>}
      {ready && !continuation && <p>{t("Open your invitation link to continue. If you signed out or changed accounts, reopen the original link using the invited email.", "Откройте ссылку приглашения. Если вы вышли или сменили аккаунт, повторно откройте исходную ссылку с приглашённым email.")}</p>}
      {session.signOutPending && <p id="invitation-access-status" role="status">{pendingSignOutMessage(locale)}</p>}
      {continuation && session.phase !== "ready" && !session.signOutPending && <><p>{t("Sign in or register with the email that received this invitation. The link will be retained in this tab while you sign in. Joining requires your explicit acceptance.", "Войдите или зарегистрируйтесь с email получателя приглашения. Ссылка сохранится в этой вкладке на время входа. Вступление требует явного согласия.")}</p><a href={account}>{t("Sign in or register", "Войти или зарегистрироваться")}</a></>}
      {continuation && session.phase === "ready" && <p>{t("Signed in as", "Вы вошли как")}: {session.identity?.email}. <a href={account}>{t("Manage or change account", "Управлять или сменить аккаунт")}</a></p>}
      {continuation && session.profileRequired && <a href={account}>{t("Complete your profile to continue", "Заполнить профиль для продолжения")}</a>}
      {issue && <p className={styles.issue} role="alert">{invitationErrorText(issue, locale)}</p>}
      {notice && <p role="status">{notice}</p>}
      {current && preview && <>
        <h2>{preview.organizationName}</h2>
        <p>{t("Organization reference", "Код организации")}: {preview.organizationId.slice(-8).toUpperCase()}</p>
        <p>{t("Organization role", "Роль в организации")}: {invitationRoleText(preview.role, locale)}</p>
        <p>{t("Invited email", "Приглашённый email")}: {preview.recipientEmail}</p>
        {!membership && <><p>{t("First verify access to this mailbox. A copied invitation link alone does not verify your email.", "Сначала подтвердите доступ к этой почте. Скопированная ссылка приглашения сама по себе не подтверждает email.")}</p>
          <button disabled={busy} onClick={() => void act("verify")}>{t("Send verification email", "Отправить письмо подтверждения")}</button>
          {continuation?.proof && <p>{t("Verification link loaded. Your identity and the invitation will be checked when you accept.", "Ссылка подтверждения открыта. Личность и приглашение будут проверены при принятии.")}</p>}
          <label><span><input style={{ width: "auto", minHeight: "auto" }} type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} /> {t("I accept the stated role in this organization.", "Я принимаю указанную роль в этой организации.")}</span></label>
          <button disabled={busy || !consent || !continuation?.proof} onClick={() => void act("accept")}>{busy ? t("Checking…", "Проверка…") : t("Accept invitation", "Принять приглашение")}</button>
        </>}
        {membership && <><p role="status">{t("This invitation has been accepted. Your current membership was checked.", "Приглашение принято. Ваше текущее членство проверено.")}</p><a href={`/organizations?organization=${encodeURIComponent(membership)}&lang=${locale}`}>{t("Open organization", "Открыть организацию")}</a></>}
      </>}
      {continuation && !accepted && <button disabled={busy || session.signOutPending} aria-describedby={session.signOutPending ? "invitation-access-status" : undefined} onClick={() => void navigation.refresh()}>{t("Refresh invitation access", "Обновить доступ к приглашению")}</button>}
      <p><a href={`/organizations?lang=${locale}`}>{t("Back to organizations", "К организациям")}</a></p>
    </section>
  </main></>;
}
