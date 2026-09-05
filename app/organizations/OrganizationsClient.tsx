"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ClientOrganization } from "../organization-client";
import { PRODUCT_RELEASE } from "../runtime-constants";
import styles from "./organizations.module.css";

type Member = { actorId: string; name: string; role: string; status: string; revision: number };
type LifecycleRequest = { id: string; command: string; requestedByActorId: string; expiresAt: string };
type Workspace = { organizations: ClientOrganization[]; selected: ClientOrganization | null; actorId: string;
  members: Member[]; requests: LifecycleRequest[]; events: Array<{ id: string; action: string; occurredAt: string }> };

export default function OrganizationsClient({ signedIn, signInUrl }: { signedIn: boolean; signInUrl: string }) {
  const [locale, setLocale] = useState("en");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [issue, setIssue] = useState(signedIn ? "" : "Sign in to manage organizations. / Войдите для управления организациями.");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const selected = workspace?.selected;
  const owner = selected?.role === "org_owner";
  const load = useCallback(async (signal?: AbortSignal) => {
    const query = new URL(window.location.href).searchParams.get("organization");
    const response = await fetch("/api/organizations" + (query ? "?organization=" + encodeURIComponent(query) : ""), { cache: "no-store", signal });
    if (!response.ok) throw new Error(response.status === 401 ? "Sign in to manage organizations. / Войдите для управления организациями." : "Organizations are unavailable. / Организации недоступны.");
    return await response.json() as Workspace;
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    void load(controller.signal).then((data) => { if (!controller.signal.aborted) setWorkspace(data); })
      .catch((error: Error) => { if (!controller.signal.aborted) setIssue(error.message); });
    return () => controller.abort();
  }, [load, signedIn]);
  async function action(payload: Record<string, unknown>, form?: HTMLFormElement) {
    setBusy(true); setIssue(""); setNotice(""); setToken("");
    try {
      const response = await fetch("/api/organizations", { method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { token?: string };
      if (!response.ok) throw new Error(t("Action unavailable. Check your role, invitation and current membership, then refresh.", "Действие недоступно. Проверьте роль, приглашение и актуальный доступ, затем обновите страницу."));
      if (result.token) setToken(result.token);
      form?.reset();
      setNotice(t("Saved.", "Сохранено."));
      setWorkspace(await load());
      return result;
    } catch (error) { setIssue((error as Error).message); return null; }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>, base: Record<string, unknown>) {
    event.preventDefault();
    const form = event.currentTarget;
    void action({ ...base, ...Object.fromEntries(new FormData(form).entries()) }, form);
  }
  const roleLabel = (role: string) => ({ org_owner: t("Organization owner", "Владелец организации"), org_admin: t("Administrator", "Администратор"),
    member: t("Member", "Участник"), auditor: t("Auditor", "Аудитор") }[role] ?? role);
  return <main className={styles.page} lang={locale}>
    <nav className={styles.navigation} aria-label={t("Product navigation", "Навигация")}>
      <Link href="/matters">GENESIS: JURIS <small>{PRODUCT_RELEASE}</small></Link>
      <Link href="/matters">{t("My cases", "Мои дела")}</Link><Link href="/account">{t("Account", "Аккаунт")}</Link>
      <label className={styles.language}>{t("Language", "Язык")} <select value={locale} onChange={(e) => setLocale(e.target.value)}><option value="en">English</option><option value="ru">Русский</option></select></label>
    </nav>
    <h1>{t("Organizations", "Организации")}</h1>
    <p>{t("Choose the team you are working with. Access to each case is assigned separately.", "Выберите команду для работы. Доступ к каждому делу назначается отдельно.")}</p>
    <p className={styles.pilot}>{t("Pilot workspace · synthetic or de-identified files only", "Пилотная версия · только синтетические или обезличенные файлы")}</p>
    {issue && <p className={styles.issue} role="alert">{issue} <a href={signInUrl} target="_top">{t("Sign in", "Войти")}</a> · <Link href="/account">{t("Account", "Аккаунт")}</Link></p>}
    {notice && <p role="status">{notice}</p>}
    {!workspace && !issue && <p role="status">{t("Loading organizations…", "Загрузка организаций…")}</p>}
    {workspace && <>
      <div className={styles.grid}>
        <section className={styles.panel}><h2>{t("Your organizations", "Ваши организации")}</h2>
          <ul className={styles.organizations}>{workspace.organizations.map((o) => <li key={o.id}>
            <a href={"/organizations?organization=" + encodeURIComponent(o.id)} aria-current={selected?.id === o.id ? "page" : undefined}>{o.name}</a>
            <span>{roleLabel(o.role)} · {t(o.status, { active: "Активна", suspended: "Приостановлена", closed: "Закрыта" }[o.status] ?? o.status)}</span>
            {o.status === "active" && <button disabled={busy} onClick={async () => {
              const result = await action({ action: "select", organizationId: o.id });
              // A full navigation discards private state and pending requests from the previous organization.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              if (result) window.location.assign("/matters?organization=" + encodeURIComponent(o.id));
            }}>{t("Open cases", "Открыть дела")}</button>}
          </li>)}</ul>
          <form onSubmit={(event) => submit(event, { action: "create" })}><h3>{t("New organization", "Новая организация")}</h3>
            <label>{t("Organization name", "Название организации")}<input name="name" minLength={2} maxLength={120} required /></label>
            <button disabled={busy}>{t("Create organization", "Создать организацию")}</button>
          </form>
        </section>
        <section className={styles.panel}><h2>{t("Join an organization", "Вступить в организацию")}</h2>
          <p>{t("Share your member ID with the organization owner to receive an invitation.", "Передайте свой идентификатор владельцу организации для получения приглашения.")}</p>
          <label>{t("Your member ID", "Ваш идентификатор")}<input readOnly value={workspace.actorId} onFocus={(event) => event.target.select()} /></label>
          <form onSubmit={(event) => submit(event, { action: "accept" })}><label>{t("Invitation code", "Код приглашения")}<input name="token" autoComplete="off" required maxLength={200} /></label>
            <button disabled={busy}>{t("Accept invitation", "Принять приглашение")}</button></form>
        </section>
      </div>
      {selected && <section className={styles.panel}><h2>{selected.name}</h2>
        {workspace.members.length > 0 && <div className={styles.tableWrap}><table><caption>{t("Members and organization access", "Участники и доступ к организации")}</caption><thead><tr><th>{t("Name", "Имя")}</th><th>{t("Role", "Роль")}</th><th>{t("Status", "Статус")}</th><th>{t("Access", "Доступ")}</th></tr></thead><tbody>
          {workspace.members.map((m) => <tr key={m.actorId}><td>{m.name}</td><td>{roleLabel(m.role)}</td><td>{t(m.status, { active: "Активен", suspended: "Приостановлен", removed: "Удалён" }[m.status] ?? m.status)}</td><td>
            {owner && m.role !== "org_owner" && m.status !== "removed" && <button disabled={busy || selected.status !== "active"} onClick={() => void action({ action: "member", organizationId: selected.id, actorId: m.actorId, role: m.role,
              status: m.status === "active" ? "suspended" : "active", expectedRevision: m.revision })}>{m.status === "active" ? t("Suspend access", "Приостановить доступ") : t("Restore access", "Восстановить доступ")}</button>}
          </td></tr>)}</tbody></table></div>}
        {owner && selected.status === "active" && <form className={styles.invite} onSubmit={(event) => submit(event, { action: "invite", organizationId: selected.id })}>
          <h3>{t("Invite a member", "Пригласить участника")}</h3>
          <label>{t("Recipient member ID", "Идентификатор получателя")}<input name="recipientActorId" required minLength={20} maxLength={128} /></label>
          <label>{t("Organization role", "Роль в организации")}<select name="role"><option value="member">{roleLabel("member")}</option><option value="org_admin">{roleLabel("org_admin")}</option><option value="auditor">{roleLabel("auditor")}</option></select></label>
          <button disabled={busy}>{t("Create invitation", "Создать приглашение")}</button>
        </form>}
        {token && <div className={styles.token} role="status"><p>{t("Copy this code for the recipient. It expires in 24 hours and can be used once.", "Скопируйте код для получателя. Он действует 24 часа и может быть использован один раз.")}</p><input aria-label={t("Invitation code to share", "Код для передачи получателю")} readOnly value={token} onFocus={(e) => e.target.select()} /></div>}
        {selected.kind === "team" && <details><summary>{t("Organization lifecycle", "Статус организации")}</summary>
          <p>{t("Suspension, resumption and closure require a request from the owner and approval by a different administrator.", "Приостановка, возобновление и закрытие требуют запроса владельца и подтверждения другим администратором.")}</p>
          {owner && <div className={styles.actions}><button disabled={busy} onClick={() => void action({ action: "lifecycle_request", organizationId: selected.id, command: selected.status === "suspended" ? "resume" : "suspend" })}>{selected.status === "suspended" ? t("Request resumption", "Запросить возобновление") : t("Request suspension", "Запросить приостановку")}</button>
            <button disabled={busy} onClick={() => void action({ action: "lifecycle_request", organizationId: selected.id, command: "close" })}>{t("Request closure", "Запросить закрытие")}</button></div>}
          {workspace.requests.filter((r) => r.expiresAt > new Date().toISOString()).map((r) => <p key={r.id}>{t(r.command, { suspend: "Приостановка", resume: "Возобновление", close: "Закрытие" }[r.command] ?? r.command)}
            {r.requestedByActorId !== workspace.actorId && ["org_owner", "org_admin"].includes(selected.role) && <button disabled={busy} onClick={() => void action({ action: "lifecycle_approve", organizationId: selected.id, requestId: r.id })}>{t("Approve request", "Подтвердить запрос")}</button>}</p>)}
        </details>}
        <details><summary>{t("Organization activity", "История организации")}</summary><ul>{workspace.events.map((e) => <li key={e.id}>{e.occurredAt.slice(0,16).replace("T"," ")} · {e.action.replaceAll("_"," ")}</li>)}</ul></details>
      </section>}
    </>}
  </main>;
}
