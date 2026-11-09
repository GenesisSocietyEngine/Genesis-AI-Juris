"use client";
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WorkspaceIcon } from "../CaseVantIcon";
import StatusBadge from "../StatusBadge";
import { useNavigationController } from "../NavigationSession";
import { useInterfaceLocale } from "../use-interface-locale";
import { portalFormGuard, fileLimit, type PortalView } from "./contracts";
import { editPortalField, portalDraftReview, type PortalField } from "./departure";
import PortalDepartureDialog from "./PortalDepartureDialog";
import s from "./portal.module.css";
type Props = {
  caseId?: string;
  selection?: string;
  caseName?: string;
  signedIn?: boolean;
  account?: string;
};
type Tab = "shared" | "uploads" | "messages";
type Draft = { action: string; id: string; grant?: string; [key: string]: unknown };
type Job = { body: Draft; file?: File };
type Visit = { scope: string; epoch: number };
const signOutHref = "/signout-with-chatgpt?return_to=%2Fportal";
const label: Record<string, [string, string]> = {
  active: ["Active", "Активен"],
  invited: ["Invited", "Приглашён"],
  revoked: ["Access revoked", "Доступ отозван"],
  expired: ["Invitation expired", "Приглашение истекло"],
  shared: ["Shared", "Открыт доступ"],
  withdrawn: ["Withdrawn", "Доступ закрыт"],
  replaced: ["Replaced", "Заменено"],
  changed: ["Needs review", "Нужна проверка"],
};
export default function Portal({ caseId, selection, caseName = "", signedIn = true, account }: Props) {
  const [locale, setLocale] = useInterfaceLocale(),
    ru = locale === "ru",
    t = (en: string, ruText: string) => (ru ? ruText : en),
    team = !!caseId,
    nav = useNavigationController();
  const [view, setView] = useState<PortalView | null>(null),
    [access, setAccess] = useState("loading"),
    [wanted, setWanted] = useState(""),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<Tab>("shared");
  const [invite, setInvite] = useState(""),
    [link, setLink] = useState(""),
    [composeInvite, setComposeInvite] = useState(false),
    [email, setEmail] = useState(""),
    [name, setName] = useState(caseName),
    [message, setMessage] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [ack, setAck] = useState(false),
    [choice, setChoice] = useState("");
  const [notice, setNotice] = useState(""),
    [issue, setIssue] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Job | null>(null),
    [locked, setLocked] = useState(false);
  const [recent, setRecent] = useState<PortalField[]>([]),
    [focusRequest, requestFocus] = useState<(Visit & { field: PortalField }) | null>(null),
    [departure, setDeparture] = useState<(Visit & { to: string | null }) | null>(null);
  const appliedFocus = useRef<typeof focusRequest>(null), leaving = useRef(false);
  const signOutLink = useRef<HTMLAnchorElement>(null);
  const emailInput = useRef<HTMLInputElement>(null), labelInput = useRef<HTMLInputElement>(null),
    replyInput = useRef<HTMLTextAreaElement>(null);
  const epoch = useRef(0),
    alive = useRef(false),
    work = useRef(false),
    request = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    panel = useRef<HTMLElement>(null);
  const base = new URLSearchParams();
  if (caseId) base.set("case", caseId);
  if (selection) base.set("organization", selection);
  const query = base.toString(),
    api = "/api/portal/" + (team ? "staff" : "client") + "?" + query;
  const selected = view?.grants.find((g) => g.id === view.selected),
    id = selected?.id || "",
    write = !!selected && !!view?.canWrite && ["active", "invited"].includes(selected.status);
  const scope = JSON.stringify([caseId, selection, account, id]);
  const emailDirty = !!email, labelDirty = recent.includes("label") && name !== caseName;
  const replyDirty = !!message.trim(), uploadDirty = !!file;
  const draftReview = useMemo(() => portalDraftReview(
    { email: team && emailDirty, label: team && labelDirty, reply: replyDirty, upload: uploadDirty }, recent,
  ), [team, emailDirty, labelDirty, replyDirty, uploadDirty, recent]);
  const risk = pending || busy ? "pending" : draftReview.changes.length ? "dirty" : "clear";
  function edited(field: PortalField) {
    leaving.current = false;
    setRecent(old => old[0] === field ? old : editPortalField(old, field));
  }
  function reviewDraft() {
    const field = draftReview.field;
    if (!field || risk !== "dirty" || !view || locked) { panel.current?.focus(); return; }
    if (field === "email" || field === "label") setComposeInvite(true);
    else {
      if (field === "reply") setComposeInvite(false);
      setTab(field === "reply" ? "messages" : "uploads");
    }
    requestFocus({ field, scope, epoch: epoch.current });
  }
  // Focus the actual input after its panel is visible and the native dialog has closed.
  // Do not replay a delayed focus into a new recipient, case or revoked form.
  useLayoutEffect(() => {
    if (!focusRequest || appliedFocus.current === focusRequest) return;
    appliedFocus.current = focusRequest;
    if (focusRequest.scope !== scope || focusRequest.epoch !== epoch.current || !view || locked || risk !== "dirty") return;
    const node = { email: emailInput, label: labelInput, reply: replyInput, upload: fileInput }[focusRequest.field].current;
    if (node && !node.disabled) node.focus();
    else panel.current?.focus();
  }, [focusRequest, scope, view, locked, risk]);
  const reset = useCallback(() => {
    setRecent([]); requestFocus(null); setDeparture(null);
    setLink("");
    setMessage("");
    setFile(null);
    setAck(false);
    setChoice("");
    setEmail("");
    setName(caseName);
    setComposeInvite(false);
    setPending(null);
    setConfirm("");
    if (fileInput.current) fileInput.current.value = "";
  }, [caseName]);
  const hide = useCallback(() => {
    ++epoch.current;
    ++request.current;
    setView(null);
    reset();
    setNotice("");
    setIssue("");
  }, [reset]);
  useEffect(() => {
    alive.current = true;
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      const url = new URL(location.href);
      if (!team) {
        setWanted(url.searchParams.get("access") || "");
        let value = new URLSearchParams(url.hash.slice(1)).get("invite");
        try {
          const saved = sessionStorage.getItem("casevant-portal-signin");
          if (signedIn) {
            sessionStorage.removeItem("casevant-portal-signin");
            if (!value && saved) {
              const obj = JSON.parse(saved);
              if (
                typeof obj.invite === "string" &&
                obj.until > Date.now() &&
                obj.until <= Date.now() + 600000
              )
                value = obj.invite;
            }
          }
        } catch {
          /* The original invitation still works if storage is unavailable. */
        }
        if (value && /^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(value)) {
          setInvite(value);
          if (signedIn && !url.hash) {
            url.hash = "invite=" + value;
            history.replaceState(history.state, "", url);
          }
        }
      }
      setReady(true);
    });
    return () => {
      mounted = false;
      alive.current = false;
    };
  }, [team, signedIn]);
  const refresh = useCallback(
    async (grant: string, before?: number) => {
      const tag = ++request.current;
      try {
        const res = await fetch(
          api + "&grant=" + encodeURIComponent(grant) + (before ? "&before=" + before : ""),
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!alive.current || tag !== request.current) return;
        if (!res.ok) {
          hide();
          setAccess(res.status === 401 ? "signin" : [403, 404].includes(res.status) ? "denied" : "failed");
          return;
        }
        const data = (await res.json()) as PortalView;
        if (!alive.current || tag !== request.current) return;
        // Returning to a used invitation may reopen an existing grant, never redeem it twice.
        if (!team) {
          const u = new URL(location.href),
            invitationId = new URLSearchParams(u.hash.slice(1)).get("invite")?.split(".")[0];
          if (invitationId && data.grants.some((g) => g.id === invitationId && g.status === "active")) {
            u.hash = "";
            u.searchParams.set("access", invitationId);
            history.replaceState(history.state, "", u);
            setInvite("");
            setIssue("");
            setPending((p) => (p?.body.action === "accept" && p.body.id === invitationId ? null : p));
            if (data.selected !== invitationId) {
              setView(null);
              setAccess("loading");
              setWanted(invitationId);
              return;
            }
          }
        }
        setView((old) =>
          before && old?.selected === data.selected && old?.thread && data.thread
            ? {
                ...data,
                thread: {
                  ...data.thread,
                  messages: [
                    ...data.thread.messages,
                    ...old.thread.messages.filter(
                      (m) => !data.thread!.messages.some((n) => n.seq === m.seq),
                    ),
                  ],
                },
              }
            : data,
        );
        setAccess("ready");
        // Pin the first server-selected thread on both sides. Later invitations cannot retarget a draft.
        if (data.selected && !grant) {
          if (!team) {
            const u = new URL(location.href);
            u.searchParams.set("access", data.selected);
            history.replaceState(history.state, "", u);
          }
          setWanted(data.selected);
        }
      } catch {
        if (alive.current && tag === request.current) {
          setView(null);
          setLink("");
          setAccess("failed");
        }
      }
    },
    [api, team, hide],
  );
  useEffect(() => {
    if (!ready || !signedIn) return;
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void refresh(wanted);
    });
    const current = () => {
        if (!document.hidden && !work.current) void refresh(wanted);
      },
      suspend = () => {
        ++request.current;
        setView(null);
        setLink("");
      },
      restore = () => { leaving.current = false; current(); };
    window.addEventListener("focus", current);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", current);
    const timer = setInterval(current, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("focus", current);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", current);
    };
  }, [wanted, ready, signedIn, refresh]);
  const reviewGuard = useEffectEvent(reviewDraft);
  // Keep the registered review action bound to the current field and recipient.
  useLayoutEffect(() => {
    if (!team) return;
    return nav.register(portalFormGuard, {
      risk: () => risk,
      changes: () => draftReview.changes,
      lock: setLocked,
      suspend: () => {
        ++request.current;
        setView(null);
        setLink("");
      },
      deny: hide,
      review: () => reviewGuard(),
    });
  }, [team, nav, risk, hide, draftReview.changes]);
  useEffect(() => {
    if (team) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (risk !== "clear" && !leaving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [team, risk]);
  function attemptSwitch(next: string) {
    if (next === id || work.current || risk === "pending") return;
    if (risk === "dirty") setDeparture({ to: next, scope, epoch: epoch.current });
    else select(next);
  }
  function discardDeparture() {
    setDeparture(null);
    if (!departure || departure.scope !== scope || departure.epoch !== epoch.current || work.current || risk === "pending" || locked) return;
    if (departure.to === null) {
      leaving.current = true;
      signOutLink.current?.click();
    } else if (view?.grants.some(grant => grant.id === departure.to)) select(departure.to);
  }
  function select(next: string) {
    hide();
    setAccess("loading");
    setTab("shared");
    setWanted(next);
    if (!team) {
      const u = new URL(location.href);
      u.searchParams.set("access", next);
      history.replaceState(history.state, "", u);
    }
  }
  async function run(job: Job) {
    if (work.current || locked) return;
    const { body, file: bytes } = job,
      mark = epoch.current;
    work.current = true;
    setBusy(true);
    setPending(job);
    setIssue("");
    setNotice("");
    setConfirm("");
    try {
      const res = await fetch(
        bytes ? "/api/portal/file?grant=" + encodeURIComponent(body.grant || "") : api,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: bytes
            ? {
                "content-type": bytes.type || "application/octet-stream",
                "x-upload-id": body.id,
                "x-portal-pilot": "confirmed",
                "x-file-name": encodeURIComponent(bytes.name),
              }
            : { "content-type": "application/json" },
          body: bytes || JSON.stringify(body),
        },
      );
      if (!alive.current || mark !== epoch.current) return;
      if (!res.ok) {
        if (res.status >= 500) throw Error();
        setPending(null);
        if (body.action === "accept" && res.status === 404) {
          const current = await fetch(api + "&grant=" + encodeURIComponent(body.id), {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!alive.current || mark !== epoch.current) return;
          if (current.ok) {
            await refresh(body.id);
            setWanted(body.id);
            return;
          }
        }
        if ([401, 403, 404].includes(res.status) && body.action !== "accept") {
          hide();
          setAccess(res.status === 401 ? "signin" : "denied");
          return;
        }
        setIssue(
          body.action === "accept"
            ? t(
                "This invitation is unavailable for this account. Check your sign-in or ask the team for a new link.",
                "Приглашение недоступно для этой учётной записи. Проверьте адрес или запросите новую ссылку.",
              )
            : res.status === 415
              ? t(
                  "File type or contents not supported. Choose PDF, TXT, PNG or JPEG.",
                  "Выберите PDF, TXT, PNG или JPEG с подходящим содержимым.",
                )
              : res.status === 413
                ? t(
                    "Choose a nonempty file no larger than 5 MB.",
                    "Выберите непустой файл размером до 5 МБ.",
                  )
                : res.status === 409
                  ? t(
                      "Could not save this change. Refresh and check for an existing invitation, share or upload.",
                      "Не удалось сохранить. Обновите портал и проверьте приглашения, публикации и файлы.",
                    )
                  : t("Check the fields and try again.", "Проверьте поля и повторите."),
        );
        return;
      }
      const data = (await res.json()) as { path?: string };
      if (!alive.current || mark !== epoch.current) return;
      setPending(null);
      let next = id;
      if (body.action === "accept" || body.action === "invite") {
        next = body.id;
        reset();
        setWanted(next);
        setView(null);
        if (!team) {
          setInvite("");
          const u = new URL(location.href);
          u.hash = "";
          u.searchParams.set("access", next);
          history.replaceState(history.state, "", u);
        }
      }
      if (data.path) setLink(new URL(data.path, location.origin).href);
      if (body.action === "message") setMessage("");
      if (bytes) {
        setFile(null);
        setAck(false);
        if (fileInput.current) fileInput.current.value = "";
      }
      if (body.action === "share") setChoice("");
      if (body.action === "revoke") setLink("");
      const notes: Record<string, string> = {
        invite: t(
          "Invitation ready. Send the private link to this client.",
          "Приглашение готово. Передайте личную ссылку клиенту.",
        ),
        accept: t("Invitation accepted.", "Приглашение принято."),
        message: t("Message posted to this conversation.", "Сообщение опубликовано."),
        share: t("Shared with this client.", "Открыт доступ этому клиенту."),
        withdraw: t("Sharing stopped.", "Доступ к записи закрыт."),
        revoke: t("Client access revoked.", "Доступ клиента отозван."),
        upload: t("File received by the case team.", "Файл получен командой дела."),
      };
      setNotice(notes[body.action] || "");
      await refresh(next);
    } catch {
      if (alive.current && mark === epoch.current)
        setIssue(
          t(
            "Save not confirmed. Retry the same action to check its receipt.",
            "Сохранение не подтверждено. Повторите ту же операцию.",
          ),
        );
    } finally {
      work.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const act = (action: string, extra: Record<string, unknown> = {}, bytes?: File) =>
    void run({ body: { action, id: crypto.randomUUID(), grant: id, ...extra }, file: bytes });
  const disabled = busy || locked || !!pending;
  const dateTime = (stamp: string, zone?: string) =>
    new Intl.DateTimeFormat(ru ? "ru" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(zone ? { timeZone: zone } : {}),
    }).format(new Date(stamp));
  const detail = (kind: string, value: string) => {
    if (kind === "document") return t("Version ", "Версия ") + value;
    const e = JSON.parse(value);
    return e.start
      ? dateTime(e.start, e.zone) + " – " + dateTime(e.end, e.zone) + " · " + e.zone
      : new Intl.DateTimeFormat(ru ? "ru" : "en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(e.date + "T12:00:00Z")) +
          " · " +
          t("Time not set", "Время не указано");
  };
  const fileHref = (item: string, kind: string) =>
    "/api/portal/file?" +
    query +
    "&mode=" +
    (team ? "staff" : "client") +
    "&grant=" +
    encodeURIComponent(id) +
    "&kind=" +
    kind +
    "&item=" +
    encodeURIComponent(item);
  const Title = team ? "h2" : "h1";
  const tone = (status: string) =>
    status === "active" || status === "shared"
      ? "completed"
      : status === "invited"
        ? "scheduled"
        : status === "changed" || status === "expired"
          ? "today"
          : "past";
  const badge = (status: string) => (
    <StatusBadge tone={tone(status)}>{label[status]?.[ru ? 1 : 0] || status}</StatusBadge>
  );
  const picker = view?.choices.find((c) => c.kind + ":" + c.id === choice),
    thread = view?.thread;
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className={team ? s.portal : s.portal + " " + s.external}
      aria-label={t("Client portal", "Клиентский портал")}
    >
      <header className={s.hero}>
        <span className={s.mark}>
          <WorkspaceIcon name="people" />
        </span>
        <div>
          <small>{team ? t("CASE WORKSPACE", "РАБОЧАЯ ОБЛАСТЬ ДЕЛА") : "CaseVant"}</small>
          <Title>{t("Client portal", "Клиентский портал")}</Title>
          <p>
            {team
              ? t(
                  "Choose what each client can see in this case.",
                  "Выберите, что будет доступно каждому клиенту дела.",
                )
              : t(
                  "Your shared documents, appointments and conversation with the case team.",
                  "Ваши документы, встречи и переписка с командой дела.",
                )}
          </p>
        </div>
        {!team && (
          <div className={s.clientTools}>
            {account && signedIn && <small>{account}</small>}
            <button onClick={() => setLocale(ru ? "en" : "ru")}>{ru ? "English" : "Русский"}</button>
            {signedIn && <a ref={signOutLink} href={signOutHref} onClick={event => {
              if (leaving.current || risk !== "dirty" || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
              event.preventDefault();
              setDeparture({ to: null, scope, epoch: epoch.current });
            }}>{t("Sign out", "Выйти")}</a>}
          </div>
        )}
      </header>
      <p className={s.pilot}>
        {t(
          "Pilot workspace · Use synthetic or de-identified material only.",
          "Пилотная версия · Используйте только синтетические или обезличенные материалы.",
        )}
      </p>
      {!signedIn || access === "signin" ? (
        <div className={s.card}>
          <h3>{t("Sign in to your portal", "Войти в портал")}</h3>
          <p>
            {t(
              "Use ChatGPT with the email address your case team invited. Your invitation will open after sign-in. If it does not, reopen the private link.",
              "Войдите через ChatGPT с приглашённым адресом. После входа откроется приглашение. Если его нет, откройте личную ссылку ещё раз.",
            )}
          </p>
          <a
            className={s.primary}
            onClick={() => {
              try {
                if (invite)
                  sessionStorage.setItem(
                    "casevant-portal-signin",
                    JSON.stringify({ invite, until: Date.now() + 600000 }),
                  );
                else sessionStorage.removeItem("casevant-portal-signin");
              } catch {
                /* Reopen the original link after sign-in. */
              }
            }}
            href={
              "/signin-with-chatgpt?return_to=" + encodeURIComponent("/portal" + (ru ? "?lang=ru" : ""))
            }
          >
            {t("Sign in with ChatGPT", "Войти через ChatGPT")}
          </a>
        </div>
      ) : (
        <>
          {!team && invite && (
            <div className={s.card}>
              <h3>{t("Private invitation", "Личное приглашение")}</h3>
              <p>
                {t(
                  "Accept to open the case shared with your signed-in account.",
                  "Примите приглашение, чтобы открыть дело для вашей учётной записи.",
                )}
              </p>
              <button
                className={s.primary}
                disabled={disabled}
                onClick={() => act("accept", { id: invite.split(".")[0], proof: invite.split(".")[1] })}
              >
                {t("Accept invitation", "Принять приглашение")}
              </button>
            </div>
          )}
          {issue && (
            <p role="alert" className={s.error}>
              {issue}{" "}
              {pending && !busy && (
                <button onClick={() => void run(pending)}>
                  {t("Retry same action", "Повторить операцию")}
                </button>
              )}
            </p>
          )}
          {notice && (
            <p role="status" className={s.note}>
              {notice}
            </p>
          )}
          {access === "loading" && !view && (
            <p role="status">{t("Opening portal…", "Открытие портала…")}</p>
          )}
          {(access === "failed" || access === "denied") && (
            <div className={s.card}>
              <p role="alert">
                {access === "denied"
                  ? t("You no longer have access to this portal.", "У вас нет доступа к этому порталу.")
                  : t("Could not load the portal.", "Не удалось открыть портал.")}
              </p>
              <button onClick={() => void refresh(wanted)}>{t("Refresh", "Обновить")}</button>
              {!team && wanted && (
                <button onClick={() => select("")}>{t("My available cases", "Мои доступные дела")}</button>
              )}
            </div>
          )}
          {view && (
            <>
              <div className={s.toolbar}>
                {!team && selected && view.grants.length === 1 ? (
                  <div className={s.current}>
                    <small>{t("Current case", "Текущее дело")}</small>
                    <strong>{selected.label}</strong>
                  </div>
                ) : view.grants.length > 0 ? (
                  <label>
                    {team ? t("Client", "Клиент") : t("Current case", "Текущее дело")}
                    <select
                      aria-label={team ? t("Client", "Клиент") : t("Current case", "Текущее дело")}
                      value={id}
                      disabled={disabled}
                      onChange={(e) => attemptSwitch(e.target.value)}
                    >
                      {view.grants.map((g) => (
                        <option key={g.id} value={g.id}>
                          {team ? g.email : g.label}
                          {team ? " · " + label[g.status][ru ? 1 : 0] : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>
                    {team
                      ? t("No clients invited to this case.", "В это дело ещё не приглашали клиентов.")
                      : t(
                          "No shared cases yet. Open your private invitation to get started.",
                          "Нет доступных дел. Откройте своё личное приглашение.",
                        )}
                  </p>
                )}
                {!team && selected && badge(selected.status)}
                {view.canInvite && view.canWrite && (
                  <button
                    disabled={disabled || !!message.trim()}
                    onClick={() => setComposeInvite(!composeInvite)}
                    aria-expanded={composeInvite}
                  >
                    <WorkspaceIcon name="plus" />
                    {t("Invite a client", "Пригласить клиента")}
                  </button>
                )}
                <button disabled={disabled} onClick={() => void refresh(wanted)}>
                  <WorkspaceIcon name="refresh" />
                  {t("Refresh", "Обновить")}
                </button>
              </div>
              {composeInvite && team && view.canInvite && view.canWrite && (
                <form
                  className={s.card}
                  onSubmit={(e) => {
                    e.preventDefault();
                    act("invite", { email, label: name });
                  }}
                >
                  <h3>{t("Invite one client", "Приглашение клиента")}</h3>
                  <p>
                    {t(
                      "The client sees this case name. Documents and events stay private until shared. The link expires in seven days.",
                      "Клиент увидит это название дела. Доступ к документам и встречам открывается отдельно. Ссылка действует семь дней.",
                    )}
                  </p>
                  <div className={s.fields}>
                    <label>
                      {t("Client email", "Эл. почта клиента")}
                      <input
                        required
                        type="email"
                        maxLength={254}
                        ref={emailInput}
                        value={email}
                        onChange={(e) => { edited("email"); setEmail(e.target.value); }}
                        disabled={disabled}
                      />
                    </label>
                    <label>
                      {t("Case name shown to client", "Название дела для клиента")}
                      <input
                        required
                        maxLength={150}
                        ref={labelInput}
                        value={name}
                        onChange={(e) => { edited("label"); setName(e.target.value); }}
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <button className={s.primary} disabled={disabled}>
                    {t("Create invitation", "Создать приглашение")}
                  </button>
                </form>
              )}
              {selected && (
                <>
                  {team && (
                    <div className={s.identity}>
                      <div>
                        <strong>{selected.label}</strong> {badge(selected.status)}
                      </div>
                      {team && view.canInvite && (
                        <div className={s.actions}>
                          {selected.status === "invited" && (
                            <button disabled={disabled} onClick={() => act("invitation", { id })}>
                              {t("Get invitation link", "Получить ссылку")}
                            </button>
                          )}
                          {selected.status !== "revoked" && (
                            <button
                              disabled={disabled || risk !== "clear"}
                              onClick={() => setConfirm("revoke")}
                            >
                              {t("Revoke access", "Отозвать доступ")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {link && (
                    <div className={s.card}>
                      <label>
                        {t(
                          "Private invitation · send only to this client",
                          "Личная ссылка · только для этого клиента",
                        )}
                        <input readOnly value={link} onFocus={(e) => e.target.select()} />
                      </label>
                      <div className={s.actions}>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(link);
                              setNotice(t("Invitation link copied.", "Ссылка скопирована."));
                            } catch {
                              setNotice(t("Select the link and copy it.", "Выделите и скопируйте ссылку."));
                            }
                          }}
                        >
                          {t("Copy link", "Скопировать")}
                        </button>
                        <button onClick={() => setLink("")}>{t("Hide link", "Скрыть ссылку")}</button>
                      </div>
                    </div>
                  )}
                  {confirm === "revoke" && (
                    <div className={s.card} role="alert">
                      <p>{t("Revoke this client’s access to all shared items and messages? The team keeps the history.",
                        "Закрыть клиенту доступ ко всем материалам и сообщениям? История сохранится у команды.")}</p>
                      <div className={s.actions}>
                        <button onClick={() => setConfirm("")}>{t("Stay here", "Остаться")}</button>
                        <button disabled={disabled} onClick={() => act("revoke", { id })}>{t("Confirm revocation", "Подтвердить отзыв")}</button>
                      </div>
                    </div>
                  )}
                  <nav aria-label={t("Portal views", "Разделы портала")} className={s.tabs}>
                    {(["shared", "uploads", "messages"] as const).map((k) => (
                      <button type="button" key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
                        <WorkspaceIcon
                          name={k === "shared" ? "document" : k === "uploads" ? "upload" : "list"}
                        />
                        {k === "shared"
                          ? t("Shared items", "Общие материалы")
                          : k === "uploads"
                            ? t("Client uploads", "Файлы клиента")
                            : t("Messages", "Сообщения")}
                      </button>
                    ))}
                  </nav>
                  {thread && tab === "shared" && (
                    <section className={s.card}>
                      <h3>{t("Shared documents and events", "Общие документы и встречи")}</h3>
                      {team && write && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (picker)
                              act("share", {
                                kind: picker.kind,
                                target: picker.id,
                                revision: picker.revision,
                              });
                          }}
                        >
                          <label>
                            {t("Choose an item to share", "Выберите материал")}
                            <select
                              value={choice}
                              onChange={(e) => setChoice(e.target.value)}
                              disabled={disabled}
                            >
                              <option value="">
                                {t(
                                  "Select a document version or event",
                                  "Выберите версию документа или встречу",
                                )}
                              </option>
                              {view.choices.map((c) => (
                                <option
                                  disabled={!!c.published}
                                  key={c.kind + c.id}
                                  value={c.kind + ":" + c.id}
                                >
                                  {c.title} · {detail(c.kind, c.detail)}
                                  {c.published ? t(" · Already shared", " · Уже опубликовано") : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          {picker && (
                            <p>
                              {t("Visible to ", "Будет видно ")}
                              <strong>{selected.email}</strong>: {picker.title} ·{" "}
                              {detail(picker.kind, picker.detail)}
                            </p>
                          )}
                          <button
                            className={s.primary}
                            disabled={!picker || !!picker.published || disabled}
                          >
                            {t("Share with client", "Открыть доступ")}
                          </button>
                        </form>
                      )}
                      {!thread.shared.length && (
                        <p>
                          {t("No documents or events shared yet.", "Пока нет общих документов и встреч.")}
                        </p>
                      )}
                      <ul className={s.rows}>
                        {thread.shared.map((a) => (
                          <li key={a.id}>
                            <span className={s.icon} data-kind={a.kind}>
                              <WorkspaceIcon name={a.kind === "document" ? "document" : "calendar"} />
                            </span>
                            <div>
                              <strong>{a.title}</strong>
                              <small>{detail(a.kind, a.detail)}</small>
                            </div>
                            {badge(a.state)}
                            <div className={s.actions}>
                              {a.kind === "document" && a.state === "shared" && (
                                <a href={fileHref(a.id, "document")} download>
                                  {t("Download", "Скачать")}
                                </a>
                              )}
                              {team && write && ["shared", "changed"].includes(a.state) && (
                                <button
                                  disabled={disabled}
                                  onClick={() => act("withdraw", { target: a.id })}
                                >
                                  {t("Stop sharing", "Закрыть доступ")}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {thread && (tab === "uploads" || !!file) && (
                    <section className={s.card} hidden={tab !== "uploads"}>
                      <h3>{t("Client uploads", "Файлы клиента")}</h3>
                      <p>
                        {t(
                          "Received files are private to this client and the case team.",
                          "Полученные файлы доступны только этому клиенту и команде дела.",
                        )}
                      </p>
                      {!team && write && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (file && ack) act("upload", {}, file);
                          }}
                        >
                          <label>
                            {t(
                              "Choose a file · PDF, TXT, PNG or JPEG · up to 5 MB",
                              "Выберите файл · PDF, TXT, PNG или JPEG · до 5 МБ",
                            )}
                            <input
                              type="file"
                              accept=".pdf,.txt,.png,.jpg,.jpeg"
                              ref={fileInput}
                              disabled={disabled}
                              onChange={(e) => {
                                edited("upload");
                                const f = e.target.files?.[0];
                                setAck(false);
                                if (f && (!f.size || f.size > fileLimit)) {
                                  setIssue(
                                    t(
                                      "Choose a nonempty file no larger than 5 MB.",
                                      "Выберите непустой файл размером до 5 МБ.",
                                    ),
                                  );
                                  e.target.value = "";
                                  setFile(null);
                                } else {
                                  setIssue("");
                                  setFile(f || null);
                                }
                              }}
                            />
                          </label>
                          {file && <p className={s.pendingFile} role="status">{t("Selected for upload: ", "Выбран для загрузки: ")}<strong>{file.name}</strong>{" "}
                            <button type="button" disabled={disabled} onClick={() => {
                              setFile(null); setAck(false); if (fileInput.current) fileInput.current.value = "";
                            }}>{t("Clear selection", "Снять выбор")}</button></p>}
                          <label className={s.check}>
                            <input
                              type="checkbox"
                              checked={ack}
                              disabled={!file || disabled}
                              onChange={(e) => { edited("upload"); setAck(e.target.checked); }}
                            />
                            {t(
                              "This file is synthetic or de-identified.",
                              "Файл содержит только синтетические или обезличенные материалы.",
                            )}
                          </label>
                          <button disabled={!file || !ack || disabled} className={s.primary}>
                            <WorkspaceIcon name="upload" />
                            {t("Upload file", "Загрузить файл")}
                          </button>
                        </form>
                      )}
                      {!thread.uploads.length && (
                        <p>{t("No files received yet.", "Пока нет полученных файлов.")}</p>
                      )}
                      <ul className={s.rows}>
                        {thread.uploads.map((f) => (
                          <li key={f.id}>
                            <span className={s.icon}>
                              <WorkspaceIcon name="document" />
                            </span>
                            <div>
                              <strong>{f.name}</strong>
                              <small>
                                {Math.ceil(f.size / 1024)} KB · {dateTime(f.stamp)}
                              </small>
                            </div>
                            <StatusBadge tone="completed">{t("Received", "Получен")}</StatusBadge>
                            <a download href={fileHref(f.id, "upload")}>
                              {t("Download", "Скачать")}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {thread && tab === "messages" && (
                    <section className={s.card}>
                      <h3>{t("Message history", "История сообщений")}</h3>
                      <p>
                        {t(
                          "Only this client and the case team can read this conversation.",
                          "Переписка доступна только этому клиенту и команде дела.",
                        )}
                      </p>
                      {thread.older && (
                        <button disabled={disabled} onClick={() => void refresh(id, thread.older!)}>
                          {t("Load earlier messages", "Предыдущие сообщения")}
                        </button>
                      )}
                      {!thread.messages.length && <p>{t("No messages yet.", "Пока нет сообщений.")}</p>}
                      <ol className={s.messages}>
                        {thread.messages.map((m) => (
                          <li key={m.seq} data-side={m.author}>
                            <div>
                              <strong>
                                {m.author === "team"
                                  ? t("Case team", "Команда дела")
                                  : t("Client", "Клиент")}
                              </strong>
                              <time dateTime={m.stamp}>{dateTime(m.stamp)}</time>
                            </div>
                            <p>{m.text}</p>
                          </li>
                        ))}
                      </ol>
                      {write && !composeInvite && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (message.trim()) act("message", { text: message.trim() });
                          }}
                        >
                          <label>
                            {t("New message", "Новое сообщение")}
                            <textarea
                              maxLength={4000}
                              rows={3}
                              ref={replyInput}
                              value={message}
                              disabled={disabled}
                              onChange={(e) => { edited("reply"); setMessage(e.target.value); }}
                            />
                          </label>
                          <button className={s.primary} disabled={!message.trim() || disabled}>
                            {t("Post message", "Отправить сообщение")}
                          </button>
                        </form>
                      )}
                    </section>
                  )}
                </>
              )}
              {busy && <p role="status">{t("Saving…", "Сохранение…")}</p>}
            </>
          )}
        </>
      )}
      {departure && departure.scope === scope && risk === "dirty" && view && !locked &&
        <PortalDepartureDialog locale={locale} changes={draftReview.changes} signOut={departure.to === null}
          stay={() => setDeparture(null)} review={() => { setDeparture(null); reviewDraft(); }} discard={discardDeparture}/>}
    </section>
  );
}
