"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Icon, readJsonResponse } from "./JurisViewShared";
import { caseFingerprint, isRecord, isTaxDraft, normalizeStudioDraft } from "./case-integrity";
import { compileStudioDraft } from "./studio-compiler";
import { workspaceSignInPath } from "./workspace-navigation";
import type { Locale, PublishedCaseSummary } from "./JurisApp";
import type { Scenario, StudioDraft } from "./types";

const OperationsDashboard = lazy(() => import("./OperationsDashboard"));

const taxPublicationChecklist = [
  "lawfulPurposeConfirmed",
  "complianceOnlyConfirmed",
  "legalAsOfVerified",
  "sourceAuthorityVerified",
  "antiAbuseRulesReviewed",
  "reportingObligationsReviewed",
  "noEvasionFacilitationConfirmed",
] as const;

type TaxPublicationChecklistKey = typeof taxPublicationChecklist[number];

type PromotionCandidate = { item: CommunityCustomCase; draft: StudioDraft; scenario: Scenario };

type CommunityProfile = {
  displayName: string; professionalRole: string; organisation: string; jurisdiction: string;
  practiceAreas: string[]; experienceLevel: string; locale: Locale;
  productUpdates: boolean; caseUpdates: boolean; researchInvites: boolean; verifiedPractitioner: boolean; licenseTier: "community" | "professional" | "enterprise";
};

type CommunityUpdate = { id: number; title: string; body: string; kind: string; caseId: string | null; publishedAt: string | null; read: boolean };

type CommunitySubmission = { id: number; customCaseId?: number | null; caseId: string; version: string; title: string; status: string; reviewerNote: string; updatedAt: string; isPrivate?: boolean | null };

type CommunityCustomCase = { id: number; caseId: string; title: string; currentVersion: string; fingerprint: string; isPrivate: boolean; copyProtected: boolean; status: string; access: "owner" | "admin" | "shared"; canShare: boolean; canManagePrivacy: boolean; shareCount: number; updatedAt: string; promotedAt?: string | null; ownerDisplayName?: string };

type CommunityCustomCaseShare = { recipientEmail: string; canReshare: boolean; grantedByEmail: string; createdAt: string };

type CommunityCustomCaseFeedback = { id: number; category: string; rating: number; comment: string; severity: string; suggestedCorrection: string; citationUrl: string | null; contextType: string; contextId: string | null; audience: string; status: string; createdAt: string };

type AdminCommunityUser = { id: number; email: string; displayName: string; organisation: string; licenseTier: "community" | "professional" | "enterprise"; verifiedPractitioner: boolean; hasLocalAccount: boolean; localAccountStatus: string | null };

function CommunityView({ locale, cases, openCustomCase, refreshCatalogue, clearDeviceDraft }: { locale: Locale; cases: PublishedCaseSummary[]; openCustomCase: (id: number) => void; refreshCatalogue: () => Promise<void>; clearDeviceDraft: () => void }) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [updates, setUpdates] = useState<CommunityUpdate[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [customCases, setCustomCases] = useState<CommunityCustomCase[]>([]);
  const [customCasesNextCursor, setCustomCasesNextCursor] = useState<string | null>(null);
  const [customCasesLoadingMore, setCustomCasesLoadingMore] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [formError, setFormError] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [shareEmails, setShareEmails] = useState<Record<number, string>>({});
  const [shareReshare, setShareReshare] = useState<Record<number, boolean>>({});
  const [caseShares, setCaseShares] = useState<Record<number, CommunityCustomCaseShare[]>>({});
  const [caseFeedback, setCaseFeedback] = useState<Record<number, CommunityCustomCaseFeedback[]>>({});
  const [busyCaseId, setBusyCaseId] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "anonymous" | "ready" | "saving">("loading");
  useEffect(() => {
    fetch("/api/me").then((response) => readJsonResponse<{ profile?: CommunityProfile; isAdmin?: boolean; registered?: boolean }>(response)).then(async (me) => {
      if (!me?.profile) { setStatus("anonymous"); return; }
      setProfile(me.profile); setIsAdmin(me.isAdmin === true); setRegistered(me.registered === true);
      const [feed, workspace, custom] = await Promise.all([
        fetch("/api/updates").then((response) => readJsonResponse<{ updates?: CommunityUpdate[]; subscriptions?: string[] }>(response)),
        fetch("/api/submissions").then((response) => readJsonResponse<{ submissions?: CommunitySubmission[] }>(response)),
        fetch("/api/custom-cases?limit=25").then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[]; nextCursor?: string | null }>(response)),
      ]);
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? []); setSubmissions(workspace?.submissions ?? []); setCustomCases(custom?.customCases ?? []); setCustomCasesNextCursor(custom?.nextCursor ?? null); setStatus("ready");
    }).catch(() => setStatus("anonymous"));
  }, []);
  async function reloadCustomCases() {
    const payload = await fetch("/api/custom-cases?limit=25").then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[]; nextCursor?: string | null }>(response));
    setCustomCases(payload?.customCases ?? []);
    setCustomCasesNextCursor(payload?.nextCursor ?? null);
  }
  async function loadMoreCustomCases() {
    if (!customCasesNextCursor || customCasesLoadingMore) return;
    setCustomCasesLoadingMore(true);
    try {
      const payload = await fetch(`/api/custom-cases?limit=25&cursor=${encodeURIComponent(customCasesNextCursor)}`).then((response) => readJsonResponse<{ customCases?: CommunityCustomCase[]; nextCursor?: string | null }>(response));
      const incoming = payload?.customCases ?? [];
      setCustomCases((current) => [...current, ...incoming.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setCustomCasesNextCursor(payload?.nextCursor ?? null);
    } finally {
      setCustomCasesLoadingMore(false);
    }
  }
  async function setCustomPrivacy(item: CommunityCustomCase, isPrivate: boolean) {
    if (isPrivate && !window.confirm(locale === "en" ? "Make this case owner-only? Existing shares will be revoked and Maxim will no longer see the case or its metadata." : "Сделать кейс доступным только владельцу? Все приглашения будут отозваны, а Максим больше не увидит кейс и его метаданные.")) return;
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_privacy", id: item.id, caseId: item.caseId, isPrivate }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setCaseShares((current) => ({ ...current, [item.id]: [] }));
      await reloadCustomCases();
      setCustomMessage(isPrivate ? (locale === "en" ? "Private mode enabled; every share was revoked." : "Приватный режим включён; все приглашения отозваны.") : (locale === "en" ? "The case is restricted again: visible to you and Maxim." : "Кейс снова ограниченный: он виден вам и Максиму."));
    } else setCustomMessage(result?.error ?? (locale === "en" ? "Visibility could not be changed." : "Не удалось изменить видимость."));
    setBusyCaseId(null);
  }
  async function loadCaseShares(item: CommunityCustomCase) {
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch(`/api/custom-cases?id=${item.id}`);
    const result = await response.json().catch(() => null) as { shares?: CommunityCustomCaseShare[]; feedback?: CommunityCustomCaseFeedback[]; error?: string } | null;
    if (response.ok) {
      setCaseShares((current) => ({ ...current, [item.id]: result?.shares ?? [] }));
      if (item.access === "owner") setCaseFeedback((current) => ({ ...current, [item.id]: result?.feedback ?? [] }));
    }
    else setCustomMessage(result?.error ?? (locale === "en" ? "Access list could not be loaded." : "Не удалось загрузить список доступа."));
    setBusyCaseId(null);
  }
  async function shareCustomCase(item: CommunityCustomCase) {
    const recipientEmail = (shareEmails[item.id] ?? "").trim();
    if (!recipientEmail) return;
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "share", id: item.id, recipientEmail, canReshare: shareReshare[item.id] === true }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setShareEmails((current) => ({ ...current, [item.id]: "" }));
      await Promise.all([reloadCustomCases(), loadCaseShares(item)]);
      setCustomMessage(locale === "en" ? "Case access granted." : "Доступ к кейсу предоставлен.");
    } else {
      setCustomMessage(result?.error ?? (locale === "en" ? "Case access could not be granted." : "Не удалось предоставить доступ."));
      setBusyCaseId(null);
    }
  }
  async function revokeCustomShare(item: CommunityCustomCase, recipientEmail: string) {
    setBusyCaseId(item.id); setCustomMessage("");
    const response = await fetch("/api/custom-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", id: item.id, recipientEmail }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      await Promise.all([reloadCustomCases(), loadCaseShares(item)]);
      setCustomMessage(locale === "en" ? "Case access revoked." : "Доступ к кейсу отозван.");
    } else {
      setCustomMessage(result?.error ?? (locale === "en" ? "Access could not be revoked." : "Не удалось отозвать доступ."));
      setBusyCaseId(null);
    }
  }
  async function saveProfile() {
    if (!profile) return; setStatus("saving"); setFormError("");
    const response = await fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...profile, locale }) });
    if (response.ok) {
      const saved = await readJsonResponse<{ profile: CommunityProfile }>(response);
      if (saved) setProfile(saved.profile); setRegistered(true);
      const feed = await fetch("/api/updates").then((result) => readJsonResponse<{ updates?: CommunityUpdate[]; subscriptions?: string[] }>(result));
      setUpdates(feed?.updates ?? []); setSubscriptions(feed?.subscriptions ?? subscriptions);
    } else setFormError(locale === "en" ? "Profile could not be saved." : "Не удалось сохранить профиль.");
    setStatus("ready");
  }
  async function toggleSubscription(caseId: string) {
    const subscribed = subscriptions.includes(caseId);
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: subscribed ? "unsubscribe" : "subscribe", caseId }) });
    if (response.ok) {
      setSubscriptions((current) => subscribed ? current.filter((id) => id !== caseId) : [...current, caseId]);
      const feed = await fetch("/api/updates").then((result) => readJsonResponse<{ updates?: CommunityUpdate[] }>(result));
      setUpdates(feed?.updates ?? []);
    }
  }
  async function markRead(updateId: number) {
    const response = await fetch("/api/updates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read", updateId }) });
    if (response.ok) setUpdates((current) => current.map((item) => item.id === updateId ? { ...item, read: true } : item));
  }
  async function deleteProfile() {
    if (!window.confirm(locale === "en" ? "Delete your profile, subscriptions, workspace drafts and private feedback? This cannot be undone. Immutable versions already published to the General Library and their editorial attribution may remain as part of the public record." : "Удалить профиль, подписки, workspace-черновики и приватные отзывы? Это действие необратимо. Уже опубликованные в Общей библиотеке неизменяемые версии и их редакционная атрибуция могут сохраниться как часть публичного реестра.")) return;
    const response = await fetch("/api/me", { method: "DELETE" });
    if (response.ok) { clearDeviceDraft(); setRegistered(false); setUpdates([]); setSubscriptions([]); setSubmissions([]); setCustomCases([]); setCustomCasesNextCursor(null); setCaseShares({}); setCaseFeedback({}); setFormError(locale === "en" ? "Stored community and device-draft data deleted." : "Данные сообщества и локальный черновик удалены."); }
  }
  if (status === "loading") return <main className="community-view page-width"><div className="community-loading">Loading professional workspace…</div></main>;
  if (status === "anonymous") return <main className="community-view page-width"><section className="community-hero"><div><span>PRACTITIONER COMMUNITY</span><h1>{locale === "en" ? "Register your professional profile" : "Зарегистрируйте профессиональный профиль"}</h1><p>{locale === "en" ? "Sign in to submit attributed case feedback, follow selected cases and receive updates matched to your jurisdiction, practice area and role." : "Войдите, чтобы отправлять авторизованные отзывы, подписываться на кейсы и получать обновления с учётом юрисдикции, практики и роли."}</p><div className="featured-actions"><a className="primary-cta" href={workspaceSignInPath("/?view=community")} target="_top">{locale === "en" ? "Sign in with ChatGPT" : "Войти через ChatGPT"}<Icon name="arrow"/></a><a className="secondary-cta" href="/account">{locale === "en" ? "Email & password" : "Email и пароль"}</a></div></div></section></main>;
  if (!profile) return null;
  return <main className="community-view page-width">
    <section className="community-hero"><div><span>PRACTITIONER COMMUNITY</span><h1>{locale === "en" ? "Professional profile & update centre" : "Профессиональный профиль и центр обновлений"}</h1><p>{locale === "en" ? "Your profile controls attribution, relevant invitations and addressed case releases." : "Профиль определяет авторство, релевантные приглашения и адресные обновления кейсов."}</p></div>{profile.verifiedPractitioner && <b className="verified-badge"><Icon name="check"/>VERIFIED PRACTITIONER</b>}</section>
    <section className="community-grid"><form className="profile-panel" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}><div className="panel-title"><span>{locale === "en" ? "Registration profile" : "Регистрационный профиль"}</span><b>01</b></div>
      <label><span>{locale === "en" ? "Display name" : "Имя"}</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}/></label>
      <label><span>{locale === "en" ? "Professional role" : "Профессиональная роль"}</span><select value={profile.professionalRole} onChange={(event) => setProfile({ ...profile, professionalRole: event.target.value })}><option value="practitioner">Practising lawyer / tax adviser</option><option value="in_house">In-house counsel</option><option value="academic">Academic / educator</option><option value="student">Student / trainee</option><option value="product">LegalTech professional</option></select></label>
      <label><span>{locale === "en" ? "Organisation" : "Организация"}</span><input value={profile.organisation} onChange={(event) => setProfile({ ...profile, organisation: event.target.value })}/></label>
      <label><span>{locale === "en" ? "Primary jurisdiction" : "Основная юрисдикция"}</span><input value={profile.jurisdiction} onChange={(event) => setProfile({ ...profile, jurisdiction: event.target.value })} placeholder="Belgium / EU"/></label>
      <label><span>{locale === "en" ? "Practice areas · comma separated" : "Области практики · через запятую"}</span><input value={profile.practiceAreas.join(", ")} onChange={(event) => setProfile({ ...profile, practiceAreas: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="International tax, Commercial, AI regulation"/></label>
      <label><span>{locale === "en" ? "Experience" : "Опыт"}</span><select value={profile.experienceLevel} onChange={(event) => setProfile({ ...profile, experienceLevel: event.target.value })}><option value="early">0–3 years</option><option value="mid">4–9 years</option><option value="senior">10+ years</option></select></label>
      <fieldset><legend>{locale === "en" ? "Addressed communications" : "Адресные сообщения"}</legend><label><input type="checkbox" checked={profile.productUpdates} onChange={(event) => setProfile({ ...profile, productUpdates: event.target.checked })}/><span>{locale === "en" ? "Product releases" : "Обновления продукта"}</span></label><label><input type="checkbox" checked={profile.caseUpdates} onChange={(event) => setProfile({ ...profile, caseUpdates: event.target.checked })}/><span>{locale === "en" ? "Followed case updates" : "Обновления отслеживаемых кейсов"}</span></label><label><input type="checkbox" checked={profile.researchInvites} onChange={(event) => setProfile({ ...profile, researchInvites: event.target.checked })}/><span>{locale === "en" ? "Research and pilot invitations" : "Приглашения к исследованиям и пилотам"}</span></label></fieldset>
      <p className="privacy-note">{locale === "en" ? "All communications are opt-in and appear in this in-product inbox. Your authenticated email is used for attribution and routing but is not shown publicly. Privacy notice v2026-08-21." : "Все сообщения включаются только по согласию и появляются во внутреннем центре обновлений. Email используется для авторства и маршрутизации, но не показывается публично. Privacy notice v2026-08-21."}</p>
      {formError && <p className="form-error" role="status">{formError}</p>}
      <button className="primary-cta" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : locale === "en" ? "Save profile" : "Сохранить профиль"}<Icon name="check"/></button>
      <div className="profile-data-actions"><a className="secondary-cta" href="/account">{locale === "en" ? "Account & sign-out" : "Аккаунт и выход"}</a>{registered && <button type="button" className="danger-button" onClick={deleteProfile}>{locale === "en" ? "Delete private account data" : "Удалить приватные данные аккаунта"}</button>}</div>
      {registered && <p className="privacy-note">{locale === "en" ? "Deletion removes your account profile, subscriptions, workspace drafts, access grants and private feedback. Immutable General Library versions already published after review—and the attribution embedded in that public editorial record—are not silently rewritten; contact the operator to request correction or pseudonymisation." : "Удаление убирает профиль аккаунта, подписки, workspace-черновики, права доступа и приватные отзывы. Уже опубликованные после рецензии неизменяемые версии Общей библиотеки и атрибуция в этом публичном редакционном реестре не переписываются автоматически; для исправления или псевдонимизации обратитесь к оператору."}</p>}
    </form>
    <section className="update-panel"><div className="panel-title"><span>{locale === "en" ? "Addressed update inbox" : "Адресный центр обновлений"}</span><b>{updates.filter((item) => !item.read).length.toString().padStart(2, "0")}</b></div>{updates.length ? updates.map((item) => <article key={item.id} className={item.read ? "" : "unread"}><span>{item.kind}</span><h3>{item.title}</h3><p>{item.body}</p><footer><small>{item.publishedAt?.slice(0, 10)}</small>{!item.read && <button onClick={() => markRead(item.id)}>{locale === "en" ? "Mark read" : "Прочитано"}</button>}</footer></article>) : <div className="empty-updates"><Icon name="check"/><b>{locale === "en" ? "You are up to date" : "У вас всё актуально"}</b><p>{locale === "en" ? "New releases matching your profile and explicit preferences will appear here." : "Здесь появятся релизы, соответствующие профилю и явным настройкам согласия."}</p></div>}</section>
    </section>
    <section className="subscription-panel"><div className="panel-title"><span>{locale === "en" ? "Follow individual cases" : "Подписки на отдельные кейсы"}</span><b>{subscriptions.length.toString().padStart(2, "0")}</b></div><div>{cases.map((item) => <button key={item.id} className={subscriptions.includes(item.id) ? "subscribed" : ""} onClick={() => toggleSubscription(item.id)}><span><b>{item.title}</b><small>{item.jurisdiction} · v{item.currentVersion}</small></span><em>{subscriptions.includes(item.id) ? (locale === "en" ? "Following" : "Подписка") : (locale === "en" ? "Follow" : "Подписаться")}</em></button>)}</div></section>
    <section className="workspace-panel"><div className="panel-title"><span>{locale === "en" ? "My Studio review workspace" : "Мои кейсы на рецензии"}</span><b>{submissions.length.toString().padStart(2, "0")}</b></div>{submissions.length ? <div className="workspace-list">{submissions.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.caseId} · v{item.version}</small></div><span>{item.status.replaceAll("_", " ")}</span>{item.reviewerNote && <p>{item.reviewerNote}</p>}</article>)}</div> : <p>{locale === "en" ? "Save or submit a Studio draft to start the moderated practitioner workflow." : "Сохраните или отправьте черновик Studio, чтобы начать модерируемый рабочий процесс."}</p>}</section>
    <section className="custom-access-panel" aria-labelledby="custom-access-title">
      <div className="panel-title"><span id="custom-access-title">{isAdmin ? (locale === "en" ? "Visible custom-case register" : "Реестр видимых custom-кейсов") : (locale === "en" ? "My & shared custom cases" : "Мои и доступные custom-кейсы")}</span><b>{customCases.length.toString().padStart(2, "0")}</b></div>
      <p className="custom-access-explainer">{locale === "en" ? "Workspace cases are never public by default. Restricted cases are visible to the owner, Maxim and invited registered users; Private cases are owner-only. Device-only saves do not appear here." : "Workspace-кейсы по умолчанию не публичны. Ограниченные кейсы видны владельцу, Максиму и приглашённым зарегистрированным пользователям; приватные — только владельцу. Локальные сохранения с устройства здесь не отображаются."}</p>
      {customMessage && <p className="custom-access-message" role="status">{customMessage}</p>}
      {customCases.length ? <><div className="custom-case-grid">{customCases.map((item) => {
        const shares = caseShares[item.id];
        const feedback = caseFeedback[item.id];
        const mayDelegateReshare = item.access === "owner" || item.access === "admin";
        return <article className={`custom-case-card ${item.isPrivate ? "private" : "restricted"}`} key={item.id}>
          <header><div className="custom-case-badges"><span>{item.isPrivate ? "PRIVATE · OWNER ONLY" : item.access === "shared" ? "SHARED CUSTOM" : "RESTRICTED CUSTOM"}</span>{item.copyProtected && <span className="copy-lock-badge">LINEAGE LOCKED</span>}{item.status === "promoted" && <span className="library-badge">GENERAL LIBRARY SNAPSHOT</span>}</div><small>{item.access === "owner" ? (locale === "en" ? "You own this case" : "Вы владелец") : item.access === "admin" ? (locale === "en" ? `Admin view · ${item.ownerDisplayName ?? "Case author"}` : `Вид администратора · ${item.ownerDisplayName ?? "Автор кейса"}`) : (locale === "en" ? `Shared by ${item.ownerDisplayName ?? "case author"}` : `Предоставил доступ: ${item.ownerDisplayName ?? "автор кейса"}`)}</small></header>
          <h3>{item.title}</h3><code>{item.caseId} · v{item.currentVersion}</code>
          <p>{item.isPrivate ? (locale === "en" ? "No administrator, reviewer or previous recipient can discover this case." : "Администратор, рецензент и прежние получатели не могут обнаружить этот кейс.") : item.access === "shared" ? (locale === "en" ? "Shared with you · other recipients are not disclosed" : "Доступ предоставлен вам · другие получатели не раскрываются") : (locale === "en" ? `${item.shareCount} explicit share(s) · not in the public catalogue` : `Явных приглашений: ${item.shareCount} · не в публичном каталоге`)}</p>
          {item.status === "promoted" && <p className="promotion-note">{locale === "en" ? "An immutable copy is public. Changing this workspace source does not rewrite that published version." : "Неизменяемая копия опубликована. Изменения этого workspace-источника не переписывают опубликованную версию."}</p>}
          <div className="custom-case-actions"><button type="button" className="secondary-cta" onClick={() => openCustomCase(item.id)}><Icon name="studio"/>{locale === "en" ? "Open in Studio" : "Открыть в Studio"}</button>{item.canManagePrivacy && <label className="privacy-toggle compact"><input type="checkbox" checked={item.isPrivate} disabled={busyCaseId === item.id} onChange={(event) => setCustomPrivacy(item, event.target.checked)}/><span>{locale === "en" ? "Private" : "Приватно"}</span><i aria-hidden="true"/></label>}</div>
          {!item.isPrivate && item.canShare && <form className="custom-share-form" onSubmit={(event) => { event.preventDefault(); shareCustomCase(item); }}><label><span>{locale === "en" ? "Registered recipient email" : "Email зарегистрированного получателя"}</span><input type="email" value={shareEmails[item.id] ?? ""} onChange={(event) => setShareEmails((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="colleague@example.com"/></label>{mayDelegateReshare && <label className="reshare-check"><input type="checkbox" checked={shareReshare[item.id] === true} onChange={(event) => setShareReshare((current) => ({ ...current, [item.id]: event.target.checked }))}/><span>{locale === "en" ? "Allow forwarding (recipient still needs Professional or Enterprise)" : "Разрешить пересылку (получателю всё равно нужна лицензия Professional или Enterprise)"}</span></label>}<button className="primary-cta" disabled={busyCaseId === item.id || !(shareEmails[item.id] ?? "").trim()}>{locale === "en" ? "Grant access" : "Предоставить доступ"}<Icon name="arrow"/></button></form>}
          {!item.isPrivate && !item.canShare && <p className="license-hint">{item.access === "owner" ? (locale === "en" ? `Sharing requires Professional or Enterprise; current tier: ${profile.licenseTier}.` : `Для предоставления доступа нужна лицензия Professional или Enterprise; текущая: ${profile.licenseTier}.`) : (locale === "en" ? "Forwarding requires Professional or Enterprise plus an explicit reshare grant." : "Для пересылки нужна лицензия Professional или Enterprise и отдельное право на дальнейший доступ.")}</p>}
          {!item.isPrivate && (item.access === "owner" || item.access === "admin") && <div className="custom-share-register"><button type="button" onClick={() => loadCaseShares(item)} disabled={busyCaseId === item.id}>{shares ? (locale === "en" ? "Refresh access list" : "Обновить список доступа") : (locale === "en" ? `Manage access (${item.shareCount})` : `Управлять доступом (${item.shareCount})`)}</button>{shares?.map((share) => <div key={share.recipientEmail}><span><b>{share.recipientEmail}</b><small>{share.canReshare ? (locale === "en" ? "may forward with licence" : "может пересылать при наличии лицензии") : (locale === "en" ? "view only" : "только просмотр")}</small></span><button type="button" onClick={() => revokeCustomShare(item, share.recipientEmail)} disabled={busyCaseId === item.id}>{locale === "en" ? "Revoke" : "Отозвать"}</button></div>)}</div>}
          {item.access === "owner" && <div className="custom-feedback-register"><button type="button" onClick={() => loadCaseShares(item)} disabled={busyCaseId === item.id}>{feedback ? (locale === "en" ? "Refresh my case notes" : "Обновить мои заметки") : (locale === "en" ? "View my case notes" : "Мои заметки по кейсу")}</button>{feedback && (feedback.length ? feedback.map((entry) => <article key={entry.id}><span><b>{entry.audience === "owner_private" ? (locale === "en" ? "PRIVATE · OWNER ONLY" : "ПРИВАТНО · ТОЛЬКО ВЛАДЕЛЕЦ") : entry.category.replaceAll("_", " ")}</b><small>{entry.createdAt.slice(0, 10)} · {entry.rating}/5 · {entry.severity}</small></span><p>{entry.comment}</p>{entry.suggestedCorrection && <p><b>{locale === "en" ? "Suggested correction:" : "Предлагаемое исправление:"}</b> {entry.suggestedCorrection}</p>}{entry.citationUrl && <a href={entry.citationUrl} target="_blank" rel="noreferrer">{locale === "en" ? "Supporting source" : "Подтверждающий источник"}</a>}</article>) : <p>{locale === "en" ? "No notes for this case yet." : "Заметок по этому кейсу пока нет."}</p>)}</div>}
        </article>;
      })}</div>{customCasesNextCursor && <button type="button" className="secondary-cta custom-cases-more" onClick={loadMoreCustomCases} disabled={customCasesLoadingMore}>{customCasesLoadingMore ? (locale === "en" ? "Loading…" : "Загрузка…") : (locale === "en" ? "Load more cases" : "Показать ещё кейсы")}</button>}</> : <p>{locale === "en" ? "No workspace custom cases are visible to this account yet. Save a Studio case to the workspace first." : "Для аккаунта пока нет видимых workspace custom-кейсов. Сначала сохраните кейс из Studio в workspace."}</p>}
    </section>
    {isAdmin && <AdminDesk locale={locale} cases={cases} customCases={customCases} reloadCustomCases={reloadCustomCases} openCustomCase={openCustomCase} refreshCatalogue={refreshCatalogue}/>}
  </main>;
}

function AdminDesk({ locale, cases, customCases, reloadCustomCases, openCustomCase, refreshCatalogue }: { locale: Locale; cases: PublishedCaseSummary[]; customCases: CommunityCustomCase[]; reloadCustomCases: () => Promise<void>; openCustomCase: (id: number) => void; refreshCatalogue: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("product");
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [jurisdictions, setJurisdictions] = useState("");
  const [practices, setPractices] = useState("");
  const [roles, setRoles] = useState("");
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [feedbackQueue, setFeedbackQueue] = useState<Array<Record<string, unknown>>>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Record<string, unknown> | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [message, setMessage] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminCommunityUser[]>([]);
  const [emailResetAvailable, setEmailResetAvailable] = useState(false);
  const [adminBusy, setAdminBusy] = useState("");
  const [pendingPromotion, setPendingPromotion] = useState<PromotionCandidate | null>(null);
  const publicationInFlight = useRef(false);
  const publicationReviewRef = useRef<HTMLElement>(null);
  const publicationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [taxReviewNote, setTaxReviewNote] = useState("");
  const [taxReviewChecks, setTaxReviewChecks] = useState<Record<TaxPublicationChecklistKey, boolean>>(() => Object.fromEntries(taxPublicationChecklist.map((key) => [key, false])) as Record<TaxPublicationChecklistKey, boolean>);
  useEffect(() => {
    if (pendingPromotion && !isTaxDraft(pendingPromotion.draft)) publicationReviewRef.current?.focus();
  }, [pendingPromotion]);
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/submissions").then((response) => readJsonResponse<{ submissions?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/feedback").then((response) => readJsonResponse<{ feedback?: Array<Record<string, unknown>> }>(response)),
      fetch("/api/admin/users").then((response) => readJsonResponse<{ users?: AdminCommunityUser[]; emailResetAvailable?: boolean }>(response)),
    ]).then(([submissionsPayload, feedbackPayload, usersPayload]) => {
      setQueue(submissionsPayload?.submissions ?? []);
      setFeedbackQueue(feedbackPayload?.feedback ?? []);
      setAdminUsers(usersPayload?.users ?? []);
      setEmailResetAvailable(usersPayload?.emailResetAvailable === true);
    });
  }, []);
  async function publishRelease(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/releases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, kind, caseId: kind === "case" ? caseId : null, targetJurisdictions: commaList(jurisdictions), targetPracticeAreas: commaList(practices), targetRoles: commaList(roles) }) });
    if (response.ok) { setTitle(""); setBody(""); setMessage(locale === "en" ? "Addressed release published." : "Адресный релиз опубликован."); }
    else setMessage(locale === "en" ? "Release validation failed." : "Релиз не прошёл проверку.");
  }
  async function inspectSubmission(id: number) {
    const detail = await fetch(`/api/admin/submissions?id=${id}`).then((response) => readJsonResponse<{ submission?: Record<string, unknown> }>(response));
    if (detail?.submission) { setSelectedSubmission(detail.submission); setReviewerNote(String(detail.submission.reviewerNote ?? "")); }
  }
  async function reviewSubmission(id: number, status: "accepted" | "changes_requested") {
    const response = await fetch("/api/admin/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, reviewerNote }) });
    if (response.ok) {
      setQueue((current) => current.map((item) => Number(item.id) === id ? { ...item, status } : item));
      setSelectedSubmission(null); setReviewerNote("");
    }
  }
  async function resolveFeedback(id: number) {
    const response = await fetch("/api/admin/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: "resolved", moderatorNote: "Reviewed by the editorial queue." }) });
    if (response.ok) setFeedbackQueue((current) => current.map((item) => Number(item.id) === id ? { ...item, status: "resolved" } : item));
  }
  async function changeLicense(email: string, licenseTier: AdminCommunityUser["licenseTier"]) {
    setAdminBusy(`license:${email}`); setMessage("");
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, licenseTier }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setAdminUsers((current) => current.map((user) => user.email === email ? { ...user, licenseTier } : user));
      setMessage(locale === "en" ? "Licence entitlement updated." : "Уровень лицензии обновлён.");
    } else setMessage(result?.error ?? (locale === "en" ? "Licence could not be updated." : "Не удалось обновить лицензию."));
    setAdminBusy("");
  }
  async function sendPasswordReset(user: AdminCommunityUser) {
    if (!user.hasLocalAccount || !emailResetAvailable) return;
    if (!window.confirm(locale === "en" ? `Send a single-use password-reset link to the stored address ${user.email}? You will not see the link or password.` : `Отправить одноразовую ссылку для сброса на сохранённый адрес ${user.email}? Ссылка и пароль вам показаны не будут.`)) return;
    setAdminBusy(`reset:${user.id}`); setMessage("");
    const response = await fetch("/api/admin/users/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const result = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    setMessage(response.ok ? (result?.message ?? (locale === "en" ? "Password-reset email sent." : "Письмо для сброса пароля отправлено.")) : (result?.error ?? (locale === "en" ? "The reset email could not be sent." : "Не удалось отправить письмо для сброса.")));
    setAdminBusy("");
  }
  async function promoteCustomCase(item: CommunityCustomCase, trigger: HTMLButtonElement) {
    if (publicationInFlight.current || pendingPromotion) return;
    publicationInFlight.current = true;
    publicationTriggerRef.current = trigger;
    setAdminBusy(`promote:${item.id}`); setMessage("");
    try {
      const detailResponse = await fetch(`/api/custom-cases?id=${item.id}`, { signal: AbortSignal.timeout(15_000) });
      const detail = await detailResponse.json().catch(() => null) as { draft?: unknown; error?: string } | null;
      if (!detailResponse.ok || detail?.draft === undefined) {
        setMessage(detail?.error ?? (locale === "en" ? "The exact custom-case version could not be loaded." : "Не удалось загрузить точную версию custom-кейса.")); return;
      }
      let sourceDraft: StudioDraft;
      try { sourceDraft = normalizeStudioDraft(detail.draft); }
      catch { setMessage(locale === "en" ? "The custom-case draft is structurally invalid." : "Структура черновика custom-кейса некорректна."); return; }
      const compiled = compileStudioDraft(sourceDraft);
      if (!compiled.scenario) {
        setMessage((locale === "en" ? "Promotion blocked: " : "Публикация заблокирована: ") + compiled.issues.map((issue) => issue.message).join(" ")); return;
      }
      // Stage the exact fetched source for an explicit in-page confirmation.
      // Publication still goes through the server's authorization and immutable-version checks.
      setPendingPromotion({ item, draft: sourceDraft, scenario: compiled.scenario });
      setTaxReviewNote("");
      setTaxReviewChecks(Object.fromEntries(taxPublicationChecklist.map((key) => [key, false])) as Record<TaxPublicationChecklistKey, boolean>);
    } catch {
      setMessage(locale === "en" ? "The publication source could not be loaded. Please try again." : "Не удалось загрузить источник для публикации. Попробуйте ещё раз.");
    } finally {
      publicationInFlight.current = false;
      setAdminBusy("");
    }
  }
  function cancelPromotion() {
    if (publicationInFlight.current) return;
    setPendingPromotion(null);
    requestAnimationFrame(() => publicationTriggerRef.current?.focus());
  }
  async function publishPromotion(candidate: PromotionCandidate, taxSafetyAttestation?: Record<string, unknown>) {
    if (publicationInFlight.current) return;
    publicationInFlight.current = true;
    setAdminBusy(`promote:${candidate.item.id}`); setMessage("");
    try {
    const response = await fetch("/api/admin/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customCaseId: candidate.item.id, draft: candidate.draft, authorName: candidate.item.ownerDisplayName ?? "Custom case author", reviewerName: "Maxim Hayan · platform administrator", reviewLevel: "community_beta", changeSummary: "Promoted from a restricted custom workspace to the General Library as an immutable snapshot.", durationMinutes: 45, sector: candidate.draft.classification?.practiceArea ?? "General legal", ...(taxSafetyAttestation ? { taxSafetyAttestation } : {}) }) });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.ok) {
      setPendingPromotion(null); setTaxReviewNote("");
      setMessage(locale === "en" ? "Immutable case version published to the General Library." : "Неизменяемая версия опубликована в Общей библиотеке.");
      const refreshed = await Promise.allSettled([reloadCustomCases(), refreshCatalogue()]);
      if (refreshed.some((result) => result.status === "rejected")) setMessage(locale === "en" ? "The version was published. Refresh the page to update the catalogue." : "Версия опубликована. Обновите страницу, чтобы увидеть её в каталоге.");
    } else setMessage(result?.error ?? (locale === "en" ? "Promotion failed validation." : "Кейс не прошёл проверки публикации."));
    } catch {
      setMessage(locale === "en" ? "The publication result could not be confirmed. Refresh the catalogue before trying again." : "Не удалось подтвердить результат публикации. Обновите каталог перед повторной попыткой.");
    } finally {
      publicationInFlight.current = false;
      setAdminBusy("");
    }
  }
  async function confirmTaxPromotion() {
    if (!pendingPromotion || !pendingPromotion.draft.classification || !isTaxDraft(pendingPromotion.draft)) return;
    const classification = pendingPromotion.draft.classification;
    const allConfirmed = taxPublicationChecklist.every((key) => taxReviewChecks[key]);
    if (!allConfirmed || taxReviewNote.trim().length < 20 || !classification.legalAsOf || !(classification.sourceUrls?.length)) return;
    await publishPromotion(pendingPromotion, {
      kind: "tax-publication-attestation-v1",
      reviewerName: "Maxim Hayan · platform administrator",
      reviewedAt: new Date().toISOString(),
      legalAsOf: classification.legalAsOf,
      sourceCount: classification.sourceUrls.length,
      note: taxReviewNote.trim(),
      studioFingerprint: caseFingerprint(pendingPromotion.draft),
      playableFingerprint: pendingPromotion.scenario.fingerprint,
      checklist: Object.fromEntries(taxPublicationChecklist.map((key) => [key, true])),
    });
  }
  const selectedDraft = isRecord(selectedSubmission?.payload) ? selectedSubmission.payload : null;
  const selectedClassification = isRecord(selectedDraft?.classification) ? selectedDraft.classification : null;
  const selectedNodes = Array.isArray(selectedDraft?.nodes) ? selectedDraft.nodes : [];
  const selectedLinks = Array.isArray(selectedDraft?.links) ? selectedDraft.links : [];
  const pendingTaxClassification = pendingPromotion && isTaxDraft(pendingPromotion.draft) ? pendingPromotion.draft.classification : null;
  const taxReviewLabels: Record<TaxPublicationChecklistKey, { en: string; ru: string }> = {
    lawfulPurposeConfirmed: { en: "The scenario has a documented lawful commercial purpose.", ru: "У сценария зафиксирована законная деловая цель." },
    complianceOnlyConfirmed: { en: "The case is limited to compliant planning and risk control.", ru: "Кейс ограничен законным планированием и контролем рисков." },
    legalAsOfVerified: { en: "The legal as-of date has been checked against the sources.", ru: "Дата актуальности права сверена с источниками." },
    sourceAuthorityVerified: { en: "Each cited source is authoritative, current and HTTPS-accessible.", ru: "Каждый источник авторитетен, актуален и доступен по HTTPS." },
    antiAbuseRulesReviewed: { en: "Applicable anti-abuse, substance and beneficial-ownership rules were reviewed.", ru: "Проверены применимые anti-abuse, substance и beneficial-ownership правила." },
    reportingObligationsReviewed: { en: "Disclosure, reporting and exchange-of-information obligations were reviewed.", ru: "Проверены обязанности по раскрытию, отчётности и обмену информацией." },
    noEvasionFacilitationConfirmed: { en: "The playable paths do not facilitate concealment, evasion or false reporting.", ru: "Игровые ветви не способствуют сокрытию, уклонению или ложной отчётности." },
  };
  const taxReviewReady = Boolean(pendingTaxClassification?.legalAsOf && pendingTaxClassification.sourceUrls?.length && taxReviewNote.trim().length >= 20 && taxPublicationChecklist.every((key) => taxReviewChecks[key]));
  return <section className="admin-desk">
    <div className="panel-title"><span>PLATFORM ADMIN · MODERATION & RELEASES</span><b>ADMIN</b></div>
    <Suspense fallback={<section className="operations-dashboard operations-dashboard-loading"><p>{locale === "en" ? "Loading aggregated telemetry…" : "Загрузка агрегированной телеметрии…"}</p></section>}><OperationsDashboard locale={locale}/></Suspense>
    <section className="admin-guidance" aria-labelledby="admin-guide-title">
      <h2 id="admin-guide-title">{locale === "en" ? "Administration guide" : "Как пользоваться администрированием"}</h2>
      <p>{locale === "en" ? "Licence controls sharing features. Organization membership controls team access. A case role controls actions in that case; none of these grants the other automatically." : "Лицензия определяет функции пересылки. Членство даёт доступ к команде. Роль в деле определяет действия в нём; одно право не выдаёт остальные автоматически."}</p>
      <p>{locale === "en" ? "An invitation grants only its stated scope and can be revoked. Publishing a case creates a public immutable snapshot; later edits require a new version. A release announcement is a separate message and does not publish the case." : "Приглашение даёт только указанный доступ и может быть отозвано. Публикация кейса создаёт публичную неизменяемую копию; для правок нужна новая версия. Объявление о релизе — отдельное сообщение, которое не публикует кейс."}</p>
      <nav aria-label={locale === "en" ? "Administration sections" : "Разделы администрирования"}>
        <a href="#admin-versions">{locale === "en" ? "Publish a case" : "Публикация кейса"}</a>
        <a href="#admin-announcements">{locale === "en" ? "Announcements and reviews" : "Объявления и рецензии"}</a>
        <a href="#admin-access">{locale === "en" ? "Licences and account recovery" : "Лицензии и восстановление доступа"}</a>
      </nav>
      <p>{locale === "en" ? "To make a scenario available for recorded runs: open its source, review the starting context, save it, then publish that exact version in Custom case inventory. An announcement is a separate update for subscribers; it does not publish a playable scenario." : "Чтобы сценарий стал доступен для прохождения: откройте источник, проверьте исходную ситуацию, сохраните его и опубликуйте эту версию в реестре кейсов. Объявление — отдельная новость для подписчиков; оно не публикует игровой сценарий."}</p>
    </section>
    <div className="admin-grid" id="admin-announcements">
      <form onSubmit={publishRelease}><h2>{locale === "en" ? "Publish an announcement" : "Опубликовать объявление"}</h2><p className="admin-field-help">{locale === "en" ? "Enter a title of at least 4 characters and a message of at least 10 characters. Optional audience filters accept comma-separated values." : "Введите заголовок от 4 символов и сообщение от 10 символов. В необязательных фильтрах аудитории разделяйте значения запятыми."}</p><label><span>Kind</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="product">Product</option><option value="case">Case</option><option value="research">Research</option></select></label>{kind === "case" && <label><span>Case</span><select value={caseId} onChange={(event) => setCaseId(event.target.value)}>{cases.map((item) => <option value={item.id} key={item.id}>{item.title} · v{item.currentVersion}</option>)}</select></label>}<label><span>Title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)}/></label><label><span>Message</span><textarea value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)}/></label><label><span>Target jurisdictions · comma separated</span><input value={jurisdictions} onChange={(event) => setJurisdictions(event.target.value)}/></label><label><span>Target practices · comma separated</span><input value={practices} onChange={(event) => setPractices(event.target.value)}/></label><label><span>Target roles · comma separated</span><input value={roles} onChange={(event) => setRoles(event.target.value)}/></label><button className="primary-cta" disabled={title.trim().length < 4 || body.trim().length < 10}>{locale === "en" ? "Publish announcement" : "Опубликовать объявление"}<Icon name="arrow"/></button>{message && <p role="status">{message}</p>}</form>
      <div className="moderation-queues">
        <section><h2>{locale === "en" ? "Case submissions" : "Кейсы на рецензии"}</h2>{queue.filter((item) => item.status === "submitted").slice(0, 8).map((item) => <article key={String(item.id)}><b>{String(item.title)}</b><small>{String(item.caseId)} · v{String(item.version)}</small><button onClick={() => inspectSubmission(Number(item.id))}>{locale === "en" ? "Inspect draft" : "Открыть черновик"}</button></article>)}</section>
        <section><h2>{locale === "en" ? "Feedback queue" : "Очередь отзывов"}</h2>{feedbackQueue.filter((item) => item.status !== "resolved" && item.status !== "declined").slice(0, 8).map((item) => <article key={String(item.id)}><b>{String(item.caseId)} · {String(item.category)}</b><small>{String(item.severity)} · {String(item.contextType)} {String(item.contextId ?? "")}</small><p>{String(item.comment)}</p><button onClick={() => resolveFeedback(Number(item.id))}>Resolve</button></article>)}</section>
      </div>
    </div>
    <section className="admin-custom-register" id="admin-versions"><div className="admin-section-heading"><div><span>CUSTOM → GENERAL LIBRARY</span><h2>{locale === "en" ? "Custom case inventory" : "Реестр custom-кейсов"}</h2></div><b>{customCases.filter((item) => !item.isPrivate).length.toString().padStart(2, "0")}</b></div><p>{locale === "en" ? "Private cases are omitted at the API boundary: Maxim receives neither their content nor their metadata. Promotion creates a new immutable public snapshot and keeps the custom source." : "Приватные кейсы исключаются на границе API: Максим не получает ни содержание, ни метаданные. Продвижение создаёт новую неизменяемую публичную копию и сохраняет custom-источник."}</p><div>{customCases.filter((item) => !item.isPrivate).map((item) => <article key={item.id}><div><span>{item.status === "promoted" ? "LIBRARY SNAPSHOT CREATED" : "RESTRICTED CUSTOM"}</span><h3>{item.title}</h3><small>{item.ownerDisplayName ?? "Case author"} · {item.caseId} · v{item.currentVersion} · {item.shareCount} share(s)</small></div><div><button type="button" className="secondary-cta" onClick={() => openCustomCase(item.id)}>{locale === "en" ? "Open source" : "Открыть источник"}</button><button type="button" className="primary-cta" disabled={Boolean(adminBusy) || Boolean(pendingPromotion)} onClick={(event) => void promoteCustomCase(item, event.currentTarget)}>{item.status === "promoted" ? (locale === "en" ? "Publish next version" : "Опубликовать новую версию") : (locale === "en" ? "Promote to library" : "Перевести в библиотеку")}<Icon name="arrow"/></button></div></article>)}</div></section>
    {pendingPromotion && !isTaxDraft(pendingPromotion.draft) && <section
      className="tax-publication-review publication-confirmation"
      ref={publicationReviewRef} tabIndex={-1} aria-labelledby="publication-confirmation-title"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); cancelPromotion(); } }}
    >
      <header><h2 id="publication-confirmation-title">{locale === "en" ? "Publish this case version?" : "Опубликовать эту версию кейса?"}</h2></header>
      <p><strong>{pendingPromotion.draft.title}</strong> · {locale === "en" ? "Version" : "Версия"} {pendingPromotion.draft.version}</p>
      <p>{locale === "en" ? "This creates a fixed copy in the General Library for people who can access this site. Your workspace source remains editable. Later changes require a new published version." : "В Общей библиотеке появится неизменяемая копия для пользователей, имеющих доступ к сайту. Источник в вашем рабочем пространстве останется доступен для редактирования. Последующие изменения нужно публиковать новой версией."}</p>
      <details><summary>{locale === "en" ? "Verify the exact version" : "Проверить точную версию"}</summary><dl><div><dt>{locale === "en" ? "Case ID" : "ID кейса"}</dt><dd>{pendingPromotion.draft.caseId}</dd></div><div><dt>{locale === "en" ? "Content fingerprint" : "Контрольная сумма содержания"}</dt><dd><code>{caseFingerprint(pendingPromotion.draft)}</code></dd></div></dl></details>
      {message && <p role="status">{message}</p>}
      <footer>
        <button type="button" className="secondary-cta" disabled={adminBusy === `promote:${pendingPromotion.item.id}`} onClick={cancelPromotion}>{locale === "en" ? "Cancel" : "Отмена"}</button>
        <button type="button" className="primary-cta" disabled={adminBusy === `promote:${pendingPromotion.item.id}`} onClick={() => void publishPromotion(pendingPromotion)}>{adminBusy === `promote:${pendingPromotion.item.id}` ? (locale === "en" ? "Publishing…" : "Публикация…") : (locale === "en" ? "Publish this version" : "Опубликовать эту версию")}</button>
      </footer>
    </section>}
    {pendingPromotion && pendingTaxClassification && <section className="tax-publication-review" aria-labelledby="tax-publication-review-title">
      <header><div><span>TAX / OFFSHORE PUBLICATION GATE</span><h2 id="tax-publication-review-title">{locale === "en" ? "Exact-artifact compliance attestation" : "Compliance-аттестация точного артефакта"}</h2></div><button type="button" onClick={() => setPendingPromotion(null)} disabled={adminBusy === `promote:${pendingPromotion.item.id}`} aria-label={locale === "en" ? "Close tax review" : "Закрыть налоговую проверку"}><Icon name="close"/></button></header>
      <p>{locale === "en" ? "Publication remains blocked until the administrator reviews the legal basis, sources and every playable path. Each confirmation is recorded against the exact Studio and compiled-playable fingerprints." : "Публикация заблокирована, пока администратор не проверит правовую основу, источники и каждую игровую ветвь. Подтверждения привязываются к точным fingerprints Studio и собранного playable-артефакта."}</p>
      <dl><div><dt>CASE / VERSION</dt><dd>{pendingPromotion.draft.caseId} · v{pendingPromotion.draft.version}</dd></div><div><dt>LEGAL AS OF</dt><dd>{pendingTaxClassification.legalAsOf ?? "MISSING"}</dd></div><div><dt>VERIFIED SOURCES</dt><dd>{pendingTaxClassification.sourceUrls?.length ?? 0}</dd></div><div><dt>REVIEWER</dt><dd>Maxim Hayan · platform administrator</dd></div><div><dt>STUDIO FINGERPRINT</dt><dd><code>{caseFingerprint(pendingPromotion.draft)}</code></dd></div><div><dt>PLAYABLE FINGERPRINT</dt><dd><code>{pendingPromotion.scenario.fingerprint}</code></dd></div></dl>
      <div className="tax-source-register">{(pendingTaxClassification.sourceUrls ?? []).map((source) => <a key={source} href={source} target="_blank" rel="noreferrer">{source}</a>)}</div>
      <fieldset><legend>{locale === "en" ? "Confirm each reviewed control" : "Подтвердите каждый проверенный контроль"}</legend>{taxPublicationChecklist.map((key) => <label key={key}><input type="checkbox" checked={taxReviewChecks[key]} onChange={(event) => setTaxReviewChecks((current) => ({ ...current, [key]: event.target.checked }))}/><span>{taxReviewLabels[key][locale]}</span></label>)}</fieldset>
      <label className="tax-review-note"><span>{locale === "en" ? "Substantive reviewer note · minimum 20 characters" : "Содержательная заметка рецензента · минимум 20 символов"}</span><textarea minLength={20} maxLength={2000} value={taxReviewNote} onChange={(event) => setTaxReviewNote(event.target.value)} placeholder={locale === "en" ? "Record the reviewed rules, source dates and any assumptions or limitations…" : "Зафиксируйте проверенные правила, даты источников, допущения и ограничения…"}/></label>
      <footer><button type="button" className="secondary-cta" onClick={() => setPendingPromotion(null)} disabled={adminBusy === `promote:${pendingPromotion.item.id}`}>{locale === "en" ? "Cancel" : "Отмена"}</button><button type="button" className="primary-cta" onClick={() => void confirmTaxPromotion()} disabled={!taxReviewReady || adminBusy === `promote:${pendingPromotion.item.id}`}>{adminBusy === `promote:${pendingPromotion.item.id}` ? (locale === "en" ? "Publishing…" : "Публикация…") : (locale === "en" ? "Attest & publish immutable version" : "Подтвердить и опубликовать версию")}<Icon name="check"/></button></footer>
    </section>}
    <section className="admin-license-register" id="admin-access"><div className="admin-section-heading"><div><span>SERVER ENTITLEMENTS & ACCOUNT RECOVERY</span><h2>{locale === "en" ? "Users, licences and safe reset" : "Пользователи, лицензии и безопасный сброс"}</h2></div><b>{adminUsers.length.toString().padStart(2, "0")}</b></div><p>{locale === "en" ? "Change sharing entitlements or send a one-time reset email to the address already stored for a local account. The administrator never receives or sets the user’s password, token or reset link." : "Изменяйте права на пересылку или отправляйте одноразовое письмо на уже сохранённый адрес локального аккаунта. Администратор никогда не получает и не задаёт пароль, токен или ссылку пользователя."} {!emailResetAvailable && (locale === "en" ? " Email delivery is disabled until the server sender is configured." : " Отправка писем отключена до настройки серверного отправителя.")}</p><div>{adminUsers.map((user) => <article key={user.id}><span className="admin-user-identity"><b>{user.displayName || user.email}</b><small>{user.email}{user.organisation ? ` · ${user.organisation}` : ""} · {user.hasLocalAccount ? (locale === "en" ? "local password active" : "локальный пароль активен") : (locale === "en" ? "no local password" : "нет локального пароля")}</small></span><div className="admin-user-actions"><select aria-label={locale === "en" ? `Licence for ${user.email}` : `Лицензия для ${user.email}`} value={user.licenseTier} disabled={adminBusy === `license:${user.email}`} onChange={(event) => changeLicense(user.email, event.target.value as AdminCommunityUser["licenseTier"])}><option value="community">Community</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select><button type="button" aria-describedby={`reset-help-${user.id}`} disabled={!emailResetAvailable || !user.hasLocalAccount || user.localAccountStatus !== "active" || adminBusy === `reset:${user.id}`} onClick={() => void sendPasswordReset(user)}>{adminBusy === `reset:${user.id}` ? (locale === "en" ? "Sending…" : "Отправка…") : (locale === "en" ? "Send reset email" : "Отправить сброс")}</button><small id={`reset-help-${user.id}`} className="admin-reset-help">{!user.hasLocalAccount ? (locale === "en" ? "This user signs in through ChatGPT; there is no local password to reset." : "Пользователь входит через ChatGPT; локального пароля для сброса нет.") : !emailResetAvailable ? (locale === "en" ? "Password emails are unavailable until the email sender is configured." : "Письма для сброса недоступны до настройки отправителя.") : user.localAccountStatus !== "active" ? (locale === "en" ? "Password reset requires an active local account." : "Для сброса нужен активный локальный аккаунт.") : (locale === "en" ? "Sends a one-time recovery email to this user's stored address." : "Отправит одноразовое письмо восстановления на сохранённый адрес пользователя.")}</small></div></article>)}</div></section>
    {selectedSubmission && selectedDraft && <section className="review-detail"><div><span>REVIEW RECORD</span><button onClick={() => setSelectedSubmission(null)} aria-label={locale === "en" ? "Close review record" : "Закрыть рецензию"}><Icon name="close"/></button></div><h2>{String(selectedSubmission.title)}</h2><dl><div><dt>CASE / VERSION</dt><dd>{String(selectedSubmission.caseId)} · v{String(selectedSubmission.version)}</dd></div><div><dt>FINGERPRINT</dt><dd><code>{String(selectedSubmission.fingerprint)}</code></dd></div><div><dt>DOMAIN / PRACTICE</dt><dd>{String(selectedClassification?.domain ?? "general")} · {String(selectedClassification?.practiceArea ?? "")}</dd></div><div><dt>GRAPH</dt><dd>{selectedNodes.length} nodes · {selectedLinks.length} links</dd></div></dl><p>{String(selectedDraft.premise ?? "")}</p><label><span>{locale === "en" ? "Substantive reviewer note" : "Содержательное замечание рецензента"}</span><textarea value={reviewerNote} minLength={10} maxLength={4000} onChange={(event) => setReviewerNote(event.target.value)}/></label><div><button className="secondary-cta" disabled={reviewerNote.trim().length < 10} onClick={() => reviewSubmission(Number(selectedSubmission.id), "changes_requested")}>{locale === "en" ? "Request changes" : "Запросить изменения"}</button><button className="primary-cta" disabled={reviewerNote.trim().length < 10} onClick={() => reviewSubmission(Number(selectedSubmission.id), "accepted")}>{locale === "en" ? "Accept for compilation" : "Принять для сборки"}<Icon name="check"/></button></div></section>}
    <p className="admin-publication-note">{locale === "en" ? "Accepted drafts remain non-public until an administrator compiles a playable-scenario-v1 manifest and publishes it through the immutable case-version API." : "Принятые черновики остаются непубличными, пока администратор не соберёт playable-scenario-v1 и не опубликует неизменяемую версию через API."}</p>
  </section>;
}

function commaList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

export default CommunityView;
