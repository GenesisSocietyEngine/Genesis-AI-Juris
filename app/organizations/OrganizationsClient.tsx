"use client";

import Link from "next/link";
import WorkspaceNavigation from "../WorkspaceNavigation";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useNavigationFormGuard } from "../use-navigation-form-guard";
import { useInterfaceLocale, useWorkspaceLocation } from "../use-interface-locale";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ClientOrganization } from "../organization-client";
import { workspaceDestination } from "../workspace-navigation";
import { invitationRecipientIssue, organizationIssue, validOrganizationReceipt, type AdminIssue } from "./organization-admin-model";
import { readWithTimeout, ReadTimeoutError } from "../read-with-timeout";
import styles from "./organizations.module.css";

type Member = { actorId: string; name: string; role: string; status: string; revision: number };
type LifecycleRequest = { id: string; command: string; requestedByActorId: string; expiresAt: string };
type Workspace = { organizations: ClientOrganization[]; selected: ClientOrganization | null; actorId: string;
  selectionIssue?: string | null; invitations?: Array<{id:string;recipientActorId:string;role:string;status:string;expiresAt:string}>; members: Member[]; requests: LifecycleRequest[]; events: Array<{ id: string; action: string; occurredAt: string }> };

export default function OrganizationsClient({ signedIn, signInUrl }: { signedIn: boolean; signInUrl: string }) {
  const navigation=useNavigationController(),session=useNavigationSession();
  const [verifiedEpoch,setVerifiedEpoch]=useState(-1);
  const [locale] = useInterfaceLocale();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const location = useWorkspaceLocation();
  const [issue, setIssue] = useState<AdminIssue | null>(signedIn ? null : {code:"signin_required",status:401,scope:"page"});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const {root: formRef, committed: formCommitted}=useNavigationFormGuard(busy);
  const mounted = useRef(true);
  const [invitation, setInvitation] = useState<{token:string;organizationId:string;expiresAt:string}|null>(null);
  const [notice, setNotice] = useState("");
  const [recipient, setRecipient] = useState("");
  const refreshSelection = useRef<string | undefined>(undefined);
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const selected = workspace?.selected;
  const owner = selected?.role === "org_owner";
  const accountUrl = workspaceDestination("/account", location);
  const orgHref = (id:string) => "/organizations?organization="+encodeURIComponent(id)+"&lang="+locale;
  const load = useCallback(async (signal?: AbortSignal, selection?: string) => {
    const ticket=navigation.authorityVersion;
    const query = selection ?? new URL(window.location.href).searchParams.get("organization");
    const { response, data } = await readWithTimeout(async requestSignal => {
      const response = await fetch("/api/organizations" + (query ? "?organization=" + encodeURIComponent(query) : ""), { credentials:"same-origin", cache: "no-store", signal: requestSignal });
      const data = await response.json().catch(()=>null) as (Workspace & {code?:string}) | null;
      requestSignal.throwIfAborted();
      return { response, data };
    }, { signal }).catch(error => { if(error instanceof ReadTimeoutError) throw {code:"read_timeout",status:0,scope:"page"}; throw error; });
    if(navigation.authorityVersion!==ticket)throw {code:"obsolete",status:0,scope:"page"};
    if(response.status===401)navigation.invalidate("expired");
    else if([403,404].includes(response.status)&&data?.code!=="profile_required")navigation.invalidate("denied");
    if (!response.ok) throw {code:data?.code??"organization_unavailable",status:response.status,scope:"page"};
    if (!data || !Array.isArray(data.organizations) || typeof data.actorId!=="string" || !Array.isArray(data.members) || !Array.isArray(data.requests) || !Array.isArray(data.events)) throw {code:"invalid_receipt",status:503,scope:"page"};
    return data;
  }, [navigation]);
  useEffect(() => {
    mounted.current=true;
    if (!signedIn || session.phase!=="ready" || session.profileRequired || session.busy) return () => {mounted.current=false;};
    const ticket=navigation.authorityVersion;
    const controller = new AbortController();
    void load(controller.signal).then((data) => { if (!controller.signal.aborted&&navigation.authorityVersion===ticket) {setWorkspace(data);setVerifiedEpoch(navigation.authorityVersion);setIssue(null);} })
      .catch((error: AdminIssue) => { if (!controller.signal.aborted && navigation.authorityVersion===ticket) setIssue({code:error.code??"network",status:error.status??0,scope:"page"}); });
    return () => { mounted.current=false;controller.abort(); };
  }, [load, signedIn, session, navigation]);
  useEffect(()=>navigation.subscribe(()=>{if(navigation.getSnapshot().phase==="denied"){setWorkspace(null);setInvitation(null);setRecipient("");}}),[navigation]);
  useEffect(()=>{if(workspace&&verifiedEpoch===navigation.authorityVersion&&window.location.hash==="#organization-users"){const target=document.getElementById("organization-users");target?.scrollIntoView({block:"start"});target?.focus();}},[workspace,verifiedEpoch,navigation]);
  async function refresh() {
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);
    try {
      const access=navigation.getSnapshot();
      if(access.phase!=="ready" || access.profileRequired){await navigation.refresh(new URL(window.location.href).searchParams.get("organization")??undefined);return;}
      const next=await load(undefined,refreshSelection.current??selected?.id);
      if(!mounted.current)return;
      if(workspace&&next.actorId!==workspace.actorId){window.location.reload();return;}
      setWorkspace(next);setVerifiedEpoch(navigation.authorityVersion);setIssue(null);
      // A refreshed organization hint never grants authority; every write is checked on the server.
      if(next.selected){const url=new URL(window.location.href);url.searchParams.set("organization",next.selected.id);window.history.replaceState(window.history.state,"",url);window.dispatchEvent(new Event("genesis-interface-change"));}
    } catch(error){if(mounted.current){const e=error as AdminIssue;setIssue({code:e.code??"network",status:e.status??0,scope:"page",refreshOnly:issue?.refreshOnly});}}
    finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  }
  async function action(payload: Record<string, unknown>, form?: HTMLFormElement) {
    if(busyRef.current||!workspace)return;
    const scope=String(payload.action);const actorId=workspace.actorId;
    const ticket=navigation.authorityVersion;
    if(scope==="invite"){
      payload.recipientActorId=String(payload.recipientActorId??"").trim();
      const code=invitationRecipientIssue(String(payload.recipientActorId),actorId,workspace.members);
      if(code){setIssue({code,status:400,scope});(form?.elements.namedItem("recipientActorId") as HTMLInputElement|null)?.focus();return;}
    }
    if(scope==="accept")payload.token=String(payload.token??"").trim();
    busyRef.current=true;setBusy(true);setIssue(null);setNotice("");
    let confirmed=false;
    try {
      const response = await fetch("/api/organizations", { method: "POST", credentials:"same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(()=>null) as { code?:string;token?:string;expiresAt?:string;organization?:ClientOrganization;id?:string;ok?:boolean } | null;
      if(!mounted.current||navigation.authorityVersion!==ticket)return;
      if(response.status===401)navigation.invalidate("expired");
      else if([403,404].includes(response.status)&&result?.code!=="profile_required")navigation.invalidate("denied");
      if (!response.ok) throw {code:result?.code??"organization_unavailable",status:response.status,scope};
      if (!result) throw {code:"invalid_receipt",status:503,scope};
      if(["create","accept","select"].includes(scope)&&!validOrganizationReceipt(result.organization,actorId,scope==="select"?String(payload.organizationId):undefined))throw {code:"invalid_receipt",status:503,scope};
      if(scope==="invite"&&(!result.token||!result.id||!result.expiresAt))throw {code:"invalid_receipt",status:503,scope};
      if(["member","lifecycle_approve"].includes(scope)&&result.ok!==true)throw {code:"invalid_receipt",status:503,scope};
      if(scope==="lifecycle_request"&&!result.id)throw {code:"invalid_receipt",status:503,scope};
      confirmed=true;
      if(scope==="select"&&result.organization){
        // Full navigation discards previous organization state; successful selection does not depend on a second GET.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Tenant switching must discard client caches and in-flight case closures.
        window.location.assign("/matters?organization="+encodeURIComponent(result.organization.selection)+"&lang="+locale);return;
      }
      if (scope==="invite"&&result.token) {setInvitation({token:result.token,organizationId:String(payload.organizationId),expiresAt:result.expiresAt!});setRecipient("");}
      form?.reset();formCommitted(form);
      setNotice(scope==="invite"?t("Invitation created. Copy the code below for its recipient.","Приглашение создано. Скопируйте код для получателя."):scope==="create"?t("Organization created. You are its owner.","Организация создана. Вы — её владелец."):scope==="accept"?t("Invitation accepted. Your organization is ready to open.","Приглашение принято. Организация доступна."):t("Change saved.","Изменение сохранено."));
      const nextId=result.organization?.id??selected?.id;
      refreshSelection.current=nextId;
      const next=await load(undefined,nextId);
      if(!mounted.current||navigation.authorityVersion!==ticket)return;
      if(next.actorId!==actorId){window.location.reload();return;}
      setWorkspace(next);setVerifiedEpoch(navigation.authorityVersion);
      if(result.organization){setRecipient("");const url=new URL(window.location.href);url.searchParams.set("organization",result.organization.id);window.history.replaceState(window.history.state,"",url);window.dispatchEvent(new Event("genesis-interface-change"));}
    } catch (error) {
      if(!mounted.current)return;
      const e=error as AdminIssue;
      setIssue({code:e.code??"network",status:e.status??0,scope:confirmed?"page":scope,refreshOnly:confirmed});
    } finally {busyRef.current=false;if(mounted.current)setBusy(false);}
  }
  function submit(event: FormEvent<HTMLFormElement>, base: Record<string, unknown>) {
    event.preventDefault();
    const form = event.currentTarget;
    void action({ ...base, ...Object.fromEntries(new FormData(form).entries()) }, form);
  }
  function feedback(scope:string){
    if(!issue||issue.scope!==scope)return null;
    const {message,recovery}=organizationIssue(issue,locale);
    return <div className={styles.issue} role="alert" id={"admin-issue-"+scope}><p>{message}</p>
      {recovery==="signin"?<><a href={signInUrl} target="_blank" rel="noopener">{t("Sign in in a new tab","Войти в новой вкладке")}</a><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void refresh()}>{t("I've signed in — refresh","Вход выполнен — обновить")}</button></>
      :recovery==="profile"?<><a href={accountUrl} target="_blank" rel="noopener">{t("Complete profile in a new tab","Заполнить профиль в новой вкладке")}</a><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void refresh()}>{t("Profile completed — refresh","Профиль заполнен — обновить")}</button></>
      :recovery==="refresh"?<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void refresh()}>{t("Refresh organization details","Обновить данные организации")}</button>:null}
    </div>;
  }
  const roleLabel = (role: string) => ({ org_owner: t("Organization owner", "Владелец организации"), org_admin: t("Administrator", "Администратор"),
    member: t("Member", "Участник"), auditor: t("Auditor", "Аудитор") }[role] ?? role);
  // Administration may inspect inactive organizations using the server's
  // dedicated allowInactive policy; the rail only selects active case workspaces.
  const needsProfile = session.phase==="ready" && session.profileRequired;
  const canLoad = session.phase==="ready" && !session.profileRequired && !session.busy;
  const visible = canLoad && workspace?.actorId===session.actorId && verifiedEpoch===navigation.authorityVersion;
  return <><WorkspaceNavigation active="/organizations"/><main className={styles.page} lang={locale} ref={formRef}>
    <div className={styles.heading}><div><h1>{t("Organization administration", "Управление организациями")}</h1><p>{t("Organization membership and case access are managed separately.","Членство в организации и доступ к делам управляются отдельно.")}</p></div><Link href={accountUrl}>{t("Your account", "Ваш аккаунт")}</Link></div>
    <p className={styles.pilot}>{t("Pilot workspace · synthetic or de-identified files only", "Пилотная версия · только синтетические или обезличенные файлы")}</p>
    {needsProfile ? <section className={styles.panel} aria-labelledby="complete-profile-title">
      <h2 id="complete-profile-title">{t("Complete your profile", "Заполните профиль")}</h2>
      <p>{t("You are signed in. Confirm your name and professional role to create your personal workspace and manage organizations.", "Вы вошли в аккаунт. Подтвердите имя и профессиональную роль, чтобы создать личное рабочее пространство и управлять организациями.")}</p>
      <p className={styles.help}>{t("After saving your profile, you will return here. No separate password is needed.", "После сохранения профиля вы вернётесь сюда. Отдельный пароль не нужен.")}</p>
      <div className={styles.actions}><a className={styles.primaryLink} href={accountUrl}>{t("Complete profile", "Заполнить профиль")}</a>
      <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void refresh()}>{t("I've completed my profile — check again", "Профиль заполнен — проверить снова")}</button></div>
    </section> : feedback("page")}
    {notice && visible && <p className={styles.notice} role="status">{notice}</p>}
    {!needsProfile && !visible && workspace && <p role="status">{t("Private organization details are hidden while access is checked. Use Refresh access in the sidebar.","Данные организации скрыты до проверки доступа. Используйте «Обновить доступ» в боковом меню.")}</p>}
    {!workspace && !issue && canLoad && <p role="status">{t("Loading organizations…", "Загрузка организаций…")}</p>}
    {!workspace && !issue && session.phase==="checking" && <p role="status">{t("Checking account access…", "Проверка доступа к аккаунту…")}</p>}
    {!needsProfile && !canLoad && session.phase!=="checking" && <section className={styles.panel}><p role="status">{t("Verify your account access to load organizations. Your private organization details remain hidden.", "Подтвердите доступ к аккаунту, чтобы загрузить организации. Приватные данные организации скрыты.")}</p><button type="button" disabled={busy||session.busy} onClick={()=>void refresh()}>{t("Refresh access", "Обновить доступ")}</button></section>}
    {workspace && visible && <>
      {workspace.selectionIssue&&<div className={styles.issue} role="alert">{t("Your previous organization selection is no longer current. Choose an available organization below.","Предыдущий выбор организации устарел. Выберите доступную организацию ниже.")}</div>}
      <div className={styles.sessionContext}><span>{issue?.status===401?t("Session expired", "Сеанс истёк"):t("Account connected", "Аккаунт подключён")}</span><span>{selected?t("Managing: ","Управление: ")+selected.name:t("Choose an organization","Выберите организацию")}</span></div>
      <div className={styles.grid}>
        <section className={styles.panel}><h2>{t("Your organizations", "Ваши организации")}</h2>
          {feedback("select")}
          <ul className={styles.organizations}>{workspace.organizations.map((o) => <li key={o.id}>
            <a href={orgHref(o.id)} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigation.requestDeparture("link",orgHref(o.id));}}} aria-current={selected?.id === o.id ? "page" : undefined}>{o.name}</a>
            <span>{roleLabel(o.role)} · {t(o.status, { active: "Активна", suspended: "Приостановлена", closed: "Закрыта" }[o.status] ?? o.status)}</span>
            <span className={styles.actions}><a className={styles.manageLink} href={orgHref(o.id)} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigation.requestDeparture("link",orgHref(o.id));}}}>{selected?.id===o.id?t("Selected", "Выбрана"):t("Manage", "Управлять")}</a>
            {o.status === "active" && <button disabled={busy} onClick={()=>navigation.requestDeparture(selected?.id===o.id?"link":"organization",selected?.id===o.id?"/matters?organization="+encodeURIComponent(o.selection)+"&lang="+locale:o.id)}>{t("Open cases", "Открыть дела")}</button>}</span>
          </li>)}</ul>
          <details><summary>{t("Create an organization", "Создать организацию")}</summary><form onSubmit={(event) => submit(event, { action: "create" })}><fieldset disabled={busy}><h3>{t("New organization", "Новая организация")}</h3>
            <label>{t("Organization name", "Название организации")}<input name="name" minLength={2} maxLength={120} required /></label>
            <button disabled={busy}>{t("Create organization", "Создать организацию")}</button>{feedback("create")}
          </fieldset></form></details>
        </section>
        <section className={styles.panel}><h2>{t("Join an organization", "Вступить в организацию")}</h2>
          <p>{t("Share your member ID with the organization owner to receive an invitation.", "Передайте свой идентификатор владельцу организации для получения приглашения.")}</p>
          <label>{t("Your member ID — share with an owner", "Ваш идентификатор — передайте владельцу")}<input readOnly value={workspace.actorId} onFocus={(event) => event.target.select()} /></label>
          <form onSubmit={(event) => submit(event, { action: "accept" })}><fieldset disabled={busy}><label>{t("Invitation code", "Код приглашения")}<input name="token" autoComplete="off" required maxLength={200} /></label>
            <button disabled={busy}>{t("Accept invitation", "Принять приглашение")}</button>{feedback("accept")}</fieldset></form>
        </section>
      </div>
      {selected && <section className={styles.panel} id="organization-users" tabIndex={-1} key={workspace.actorId+":"+selected.id}><h2>{selected.name}</h2>
        <p>{t("Organization roles control team administration. Access to each case is assigned separately. Review the person's role and status before changing access.", "Роли организации управляют командой. Доступ к каждому делу назначается отдельно. Перед изменением доступа проверьте роль и статус участника.")}</p>
        {workspace.members.length > 0 && <div className={styles.tableWrap}><table><caption>{t("Members and organization access", "Участники и доступ к организации")}</caption><thead><tr><th>{t("Name", "Имя")}</th><th>{t("Role", "Роль")}</th><th>{t("Status", "Статус")}</th><th>{t("Access", "Доступ")}</th></tr></thead><tbody>
          {workspace.members.map((m) => <tr key={m.actorId}><td>{m.name}{m.actorId===workspace.actorId&&<small className={styles.you}>{t("You", "Вы")}</small>}</td><td>{roleLabel(m.role)}</td><td>{t(m.status, { active: "Активен", suspended: "Приостановлен", removed: "Удалён" }[m.status] ?? m.status)}</td><td>
            {owner && m.role !== "org_owner" && m.status !== "removed" && <button disabled={busy || selected.status !== "active"} onClick={() => void action({ action: "member", organizationId: selected.id, actorId: m.actorId, role: m.role,
              status: m.status === "active" ? "suspended" : "active", expectedRevision: m.revision })}>{m.status === "active" ? t("Suspend access", "Приостановить доступ") : t("Restore access", "Восстановить доступ")}</button>}
            {m.role==="org_owner"&&<span className={styles.help}>{t("Owner access is protected", "Доступ владельца защищён")}</span>}
          </td></tr>)}</tbody></table></div>}
        {feedback("member")}
        {!owner&&<p className={styles.help}>{t("Only the organization owner can invite members and change their access. Administrator, auditor and case roles have separate permissions.","Только владелец организации может приглашать участников и менять их доступ. Администратор, аудитор и роли в делах имеют отдельные полномочия.")}</p>}
        {owner && selected.status === "active" && <form className={styles.invite} onSubmit={(event) => submit(event, { action: "invite", organizationId: selected.id })}>
          <fieldset disabled={busy}><h3>{t("Invite another person", "Пригласить другого человека")}</h3><p className={styles.help}>{t("Ask the recipient to sign in and share their member ID from this page. Your own account already has access.","Попросите получателя войти и передать свой идентификатор с этой страницы. У вашего аккаунта уже есть доступ.")}</p>
          <label>{t("Recipient member ID", "Идентификатор получателя")}<input name="recipientActorId" value={recipient} onChange={e=>{setRecipient(e.target.value);if(issue?.scope==="invite")setIssue(null);}} aria-invalid={issue?.scope==="invite"||undefined} aria-describedby={issue?.scope==="invite"?"admin-issue-invite":undefined} autoComplete="off" spellCheck={false} required minLength={20} maxLength={128} /></label>
          <label>{t("Organization role", "Роль в организации")}<select name="role"><option value="member">{roleLabel("member")}</option><option value="org_admin">{roleLabel("org_admin")}</option><option value="auditor">{roleLabel("auditor")}</option></select></label>
          <button disabled={busy}>{t("Create invitation", "Создать приглашение")}</button>{feedback("invite")}</fieldset>
        </form>}
        {invitation?.organizationId===selected.id && <div className={styles.token} role="status"><p>{t("Copy this code for the recipient. It expires in 24 hours and can be used once.", "Скопируйте код для получателя. Он действует 24 часа и может быть использован один раз.")}</p><input aria-label={t("Invitation code to share", "Код для передачи получателю")} readOnly value={invitation.token} onFocus={(e) => e.target.select()} /><button type="button" className={styles.secondary} onClick={()=>setInvitation(null)}>{t("I have copied the code — dismiss", "Код скопирован — скрыть")}</button></div>}
        {selected.kind === "team" && <details><summary>{t("Organization lifecycle", "Статус организации")}</summary>
          <p>{t("Suspension, resumption and closure require a request from the owner and approval by a different administrator.", "Приостановка, возобновление и закрытие требуют запроса владельца и подтверждения другим администратором.")}</p>
          {owner && <div className={styles.actions}><button disabled={busy} onClick={() => void action({ action: "lifecycle_request", organizationId: selected.id, command: selected.status === "suspended" ? "resume" : "suspend" })}>{selected.status === "suspended" ? t("Request resumption", "Запросить возобновление") : t("Request suspension", "Запросить приостановку")}</button>
            <button disabled={busy} onClick={() => void action({ action: "lifecycle_request", organizationId: selected.id, command: "close" })}>{t("Request closure", "Запросить закрытие")}</button></div>}
          {workspace.requests.filter((r) => r.expiresAt > new Date().toISOString()).map((r) => <p key={r.id}>{t(r.command, { suspend: "Приостановка", resume: "Возобновление", close: "Закрытие" }[r.command] ?? r.command)}
            {r.requestedByActorId !== workspace.actorId && ["org_owner", "org_admin"].includes(selected.role) && <button disabled={busy} onClick={() => void action({ action: "lifecycle_approve", organizationId: selected.id, requestId: r.id })}>{t("Approve request", "Подтвердить запрос")}</button>}</p>)}
        </details>}
        {feedback("lifecycle_request")}{feedback("lifecycle_approve")}
        <details><summary>{t("Organization activity", "История организации")}</summary><ul>{workspace.events.map((e) => <li key={e.id}>{e.occurredAt.slice(0,16).replace("T"," ")} · {e.action.replaceAll("_"," ")}</li>)}</ul></details>
      </section>}
    </>}
  </main></>;
}
