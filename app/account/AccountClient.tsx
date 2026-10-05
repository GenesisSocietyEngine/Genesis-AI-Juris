"use client";

import { pendingSignOutMessage } from "../session-boundary";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationController, useNavigationSession } from "../NavigationSession";
import { useNavigationFormGuard } from "../use-navigation-form-guard";
import styles from "./account.module.css";
import WorkspaceNavigation from "../WorkspaceNavigation";
import { workspaceDestination } from "../workspace-navigation";
import { useInterfaceLocale } from "../use-interface-locale";

export type AccountProfile = {
  displayName: string; professionalRole: string; organisation: string; jurisdiction: string;
  practiceAreas: string[]; experienceLevel: string; locale: string;
  productUpdates: boolean; caseUpdates: boolean; researchInvites: boolean;
};

type Identity = { email: string; displayName: string; authSource: "chatgpt" | "local" };
type AuthAction = "login" | "register" | "recover" | "reset" | "forgot" | "logout" | "profile";

export default function AccountClient({
  identity,
  hasLocalAccount,
  isAdmin,
  emailResetAvailable,
  chatGPTSignInUrl,
  initialProfile, profileKnown, returnTo,
}: {
  identity: Identity | null;
  hasLocalAccount: boolean;
  isAdmin: boolean;
  emailResetAvailable: boolean;
  chatGPTSignInUrl: string;
  chatGPTSignOutUrl: string;
  initialProfile: AccountProfile | null; profileKnown: boolean; returnTo: string;
}) {
  const router = useRouter();
  const navigation = useNavigationController(), session = useNavigationSession();
  const [locale] = useInterfaceLocale();
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  const [busy, setBusy] = useState<AuthAction | null>(null);
  const {root: formRef, committed: formCommitted} = useNavigationFormGuard(busy !== null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  function returnToWorkspace(authority: number) {
    if (navigation.authorityVersion !== authority) return;
    // The server confirmed this operation, but busy remains true until finally
    // commits. Approve only this intentional return before beforeunload runs.
    navigation.approvePageDeparture();
    try {
      window.location.assign(returnTo);
    } catch (caught) {
      navigation.cancelPageDeparture();
      throw caught;
    }
  }

  async function submit(action: "login" | "register" | "recover" | "reset", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy !== null) return;
    if (identity && action === "login") { setError(t("Sign out before signing in to another account.", "Выйдите перед входом в другой аккаунт.")); return; }
    setBusy(action); setError(""); setMessage(""); setRecoveryCode("");
    const element = event.currentTarget;
    const authority = navigation.authorityVersion;
    const form = new FormData(element);
    const passwordField = action === "login" ? "password" : "newPassword";
    const password = String(form.get(passwordField) ?? "");
    const confirmation = action === "login" ? password : String(form.get("confirmPassword") ?? "");
    if (password !== confirmation) {
      setError(t("Passwords do not match.", "Пароли не совпадают.")); setBusy(null); return;
    }
    const body: Record<string, string> = action === "register"
      ? { password }
      : action === "login"
        ? { email: String(form.get("email") ?? ""), password }
        : action === "recover"
          ? { email: String(form.get("email") ?? ""), recoveryCode: String(form.get("recoveryCode") ?? ""), newPassword: password }
          : { newPassword: password };
    try {
      const response = await accountRequest(`/api/auth/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { code?: string; error?: string; recoveryCode?: string; recoveryNotice?: string };
      if (navigation.authorityVersion!==authority) return;
      if (response.status === 409 && result.code === "already_authenticated") {
        // Another tab signed in: refresh the verified identity so sign-out is available.
        router.refresh();
      }
      if (!response.ok) throw new Error(result.error || "The credential request could not be completed.");
      element.reset(); formCommitted(element);
      if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
      setMessage(result.recoveryNotice || (action === "login" ? "Local sign-in completed." : "Credentials updated."));
      if (action === "login") {
        // Start a new shared session from the confirmed cookie. A retained layout
        // can otherwise keep the pre-login anonymous authority after navigation.
        returnToWorkspace(authority);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("The credential request could not be completed.", "Не удалось выполнить запрос. Проверьте соединение и повторите."));
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy !== null || !identity || !profileKnown) return;
    setBusy("profile"); setError("");
    const element = event.currentTarget;
    const authority = navigation.authorityVersion;
    const form = new FormData(element);
    try {
      const response = await accountRequest("/api/me", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({
        ...initialProfile, displayName: String(form.get("displayName") ?? identity.displayName),
        professionalRole: String(form.get("professionalRole") ?? "practitioner"), locale,
        productUpdates: initialProfile?.productUpdates ?? false,
        caseUpdates: initialProfile?.caseUpdates ?? false,
        researchInvites: initialProfile?.researchInvites ?? false,
      }) });
      const result = await response.json() as { error?: string };
      if (navigation.authorityVersion!==authority) return;
      if (!response.ok) throw new Error(result.error || t("The profile could not be saved.", "Не удалось сохранить профиль."));
      formCommitted(element);
      // Recreate the shared session after profile creation; a retained layout can
      // otherwise keep profileRequired=true after a successful client-side return.
      returnToWorkspace(authority);
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Check your connection and retry.", "Проверьте соединение и повторите.")); }
    finally { setBusy(null); }
  }

  async function requestEmailReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy !== null) return;
    setBusy("forgot"); setError(""); setMessage(""); setRecoveryCode("");
    const element = event.currentTarget;
    const authority = navigation.authorityVersion;
    const form = new FormData(element);
    try {
      const response = await accountRequest("/api/auth/forgot-password", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: String(form.get("email") ?? "") }) });
      const result = await response.json() as { error?: string; message?: string };
      if (navigation.authorityVersion!==authority) return;
      if (!response.ok) throw new Error(result.error || "The reset request could not be accepted.");
      formCommitted(element);
      setMessage(result.message || "If an account exists, a password-reset link has been sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reset request could not be accepted.");
    } finally { setBusy(null); }
  }

  async function accountRequest(path: string, init: RequestInit) {
    const ticket = navigation.authorityVersion;
    const response = await fetch(path, init);
    if (navigation.authorityVersion!==ticket) throw new Error("Access changed. Check your session before continuing.");
    if (identity && response.status === 401) navigation.invalidate("expired");
    return response;
  }
  if (identity && (session.phase !== "ready" || session.identity?.email.toLowerCase() !== identity.email.toLowerCase())) return <><WorkspaceNavigation active="/account"/><main className={styles.shell}><h1>{t("Check account access", "Проверить доступ к аккаунту")}</h1><p id="account-access-status" role="status">{session.signOutPending ? pendingSignOutMessage(locale) : t("Private account details are hidden until your session is verified.", "Данные аккаунта скрыты до подтверждения сеанса.")}</p><button type="button" disabled={session.signOutPending} aria-describedby="account-access-status" onClick={() => void navigation.refresh()}>{t("Refresh access", "Обновить доступ")}</button></main></>;

  return <><WorkspaceNavigation active="/account"/><main className={styles.shell} ref={formRef}>
    <header className={styles.hero}>
      <h1>{identity ? t("Your account", "Ваш аккаунт") : t("Sign in and start your case", "Войдите и начните работу")}</h1>
      <p>{t("Use your ChatGPT account. A separate password is optional. After sign-in you can return to your task.", "Используйте аккаунт ChatGPT. Отдельный пароль необязателен. После входа вы сможете вернуться к своей задаче.")}</p>
    </header>

    {!identity && <section className={styles.startCard}>
      <h2>{t("Start with ChatGPT", "Начать через ChatGPT")}</h2>
      <p>{t("Then open an example, import a case or describe your task.", "Затем откройте пример, загрузите кейс или опишите задачу.")}</p>
      <a className={styles.primaryLink} href={chatGPTSignInUrl} target="_top">{t("Continue with ChatGPT", "Продолжить через ChatGPT")}</a>
      <a className={styles.secondaryLink} href={returnTo}>{t("Return to your task without signing in", "Вернуться к задаче без входа")}</a>
    </section>}

    {identity && <section className={styles.identity} aria-label="Current identity">
      <div><span>{t("Current session", "Текущий сеанс")}</span><strong>{identity.displayName}</strong><small>{identity.email}</small></div>
      {initialProfile && <a className={styles.primaryLink} href={returnTo}>{t("Continue to your work", "Продолжить работу")}</a>}
      <p>{t("To use a different account, sign out first. Organization administration and access to individual cases are managed separately.", "Для входа в другой аккаунт сначала выйдите. Управление организацией и доступ к отдельным делам назначаются отдельно.")}</p>
    </section>}

    {(message || error) && <div className={error ? styles.error : styles.success} role={error ? "alert" : "status"}>{error || message}</div>}
    {identity && !initialProfile && <section className={styles.startCard}>
      <h2>{t("Confirm your profile for AI and saved cases", "Подтвердите профиль для AI и сохранённых кейсов")}</h2>
      <p>{t("Your name attributes your work. Organization details, preferences and a local password can be added later.", "Имя указывается как автор работы. Организацию, предпочтения и локальный пароль можно добавить позже.")}</p>
      {profileKnown ? <form onSubmit={saveProfile}>
        <Field label={t("Display name", "Имя")}><input name="displayName" defaultValue={identity.displayName} maxLength={120} autoComplete="name" required/></Field>
        <Field label={t("Professional role", "Профессиональная роль")}><select name="professionalRole" defaultValue="practitioner"><option value="practitioner">{t("Lawyer / adviser", "Юрист / консультант")}</option><option value="in_house">{t("In-house counsel", "Корпоративный юрист")}</option><option value="academic">{t("Educator / researcher", "Преподаватель / исследователь")}</option><option value="student">{t("Student / trainee", "Студент / стажёр")}</option><option value="product">{t("Technology / process professional", "Специалист по технологиям / процессам")}</option></select></Field>
        <p>{t("No update subscriptions are enabled. You can edit your profile in Workspace.", "Подписки на обновления не включаются. Профиль можно изменить в рабочем пространстве.")}</p>
        <button className={styles.primaryLink} disabled={busy !== null}>{busy === "profile" ? t("Saving…", "Сохранение…") : t("Save profile and continue", "Сохранить профиль и продолжить")}</button>
      </form> : <p role="alert">{t("Your profile could not be loaded. Refresh before changing it.", "Не удалось загрузить профиль. Обновите страницу перед изменением.")}</p>}
      <a className={styles.secondaryLink} href={workspaceDestination("/studio", "/account?lang=" + locale + "&return_to=" + encodeURIComponent(returnTo))}>{t("Explore Studio without completing registration", "Открыть Студию без завершения регистрации")}</a>
    </section>}
    {recoveryCode && <section className={styles.recoveryReveal} aria-live="polite">
      <span>{t("DISPLAYED ONCE", "ПОКАЗЫВАЕТСЯ ОДИН РАЗ")}</span><h2>{t("Save your replacement recovery code", "Сохраните новый код восстановления")}</h2>
      <code>{recoveryCode}</code>
      <button type="button" onClick={() => void navigator.clipboard.writeText(recoveryCode).catch(() => setError(t("Copy the code manually.", "Скопируйте код вручную.")))}>{t("Copy recovery code", "Скопировать код восстановления")}</button>
      <p>{t("Store it in a password manager. CaseVant stores only its hash and cannot show this value again.", "Сохраните код в менеджере паролей. CaseVant хранит только хеш и не может показать код повторно.")}</p>
    </section>}

    <details className={styles.optional}>
    <summary>{t("Password and recovery · optional", "Пароль и восстановление · необязательно")}</summary>
    <section className={styles.grid}>
      {!identity && <article className={styles.card}>
        <span>{t("01 · RETURNING USER", "01 · ВХОД С ПАРОЛЕМ")}</span><h2>{t("Sign in with password", "Войти с паролем")}</h2>
        <p>{t("Use credentials enrolled after ChatGPT identity confirmation.", "Для аккаунтов, в которых пароль создан после подтверждения входа через ChatGPT.")}</p>
        <form onSubmit={(event) => submit("login", event)}>
          <Field label={t("Account email", "Email аккаунта")}><input name="email" type="email" autoComplete="username" required/></Field>
          <Field label={t("Password", "Пароль")}><input name="password" type="password" autoComplete="current-password" minLength={10} maxLength={128} required/></Field>
          <button disabled={busy !== null}>{busy === "login" ? t("Checking…", "Проверка…") : t("Sign in locally", "Войти с паролем")}</button>
        </form>
        <div className={styles.emailReset}>
          <h3>{t("Forgot the password?", "Забыли пароль?")}</h3>
          <p>{emailResetAvailable ? t("Request a 15-minute, single-use link. The response never reveals whether an account exists.", "Запросите одноразовую ссылку на 15 минут. Ответ не раскрывает наличие аккаунта.") : t("Email recovery is currently unavailable. Use ChatGPT sign-in or your recovery code.", "Отправка email недоступна. Используйте вход через ChatGPT или код восстановления.")}</p>
          <form onSubmit={requestEmailReset}>
            <Field label={t("Account email", "Email аккаунта")}><input name="email" type="email" autoComplete="username" required/></Field>
            <button disabled={busy !== null || !emailResetAvailable}>{busy === "forgot" ? t("Requesting…", "Отправка запроса…") : t("Email reset link", "Отправить ссылку сброса")}</button>
          </form>
        </div>
      </article>}

      <article className={styles.card}>
        <span>{t("02 · FIRST-TIME ENROLLMENT", "02 · ДОПОЛНИТЕЛЬНЫЙ ПАРОЛЬ")}</span><h2>{hasLocalAccount ? t("Reset through ChatGPT", "Сбросить через ChatGPT") : t("Create local credentials", "Создать локальный пароль")}</h2>
        {identity?.authSource === "chatgpt" ? <>
          <p>{t("This password belongs to your signed-in ChatGPT account. It does not create a separate account.", "Используется email подтверждённого аккаунта ChatGPT. Его нельзя заменить в этой форме.")}</p>
          <form onSubmit={(event) => submit(hasLocalAccount ? "reset" : "register", event)}>
            <PasswordFields locale={locale}/>
            <button disabled={busy !== null}>{busy === "register" || busy === "reset" ? t("Protecting credentials…", "Сохранение пароля…") : hasLocalAccount ? t("Reset password and sessions", "Сбросить пароль и сеансы") : t("Enroll local password", "Создать локальный пароль")}</button>
          </form>
        </> : <>
          <p>{t("Confirm control of the account once through ChatGPT before adding a password. This prevents someone from claiming another practitioner’s email and case permissions.", "Перед созданием пароля подтвердите аккаунт через ChatGPT. Это защищает email и доступ к делам от присвоения другим пользователем.")}</p>
          <a className={styles.primaryLink} href={chatGPTSignInUrl} target="_top">{t("Continue with trusted ChatGPT identity", "Продолжить через ChatGPT")}</a>
        </>}
      </article>

      {!identity && <article className={styles.card}>
        <span>{t("03 · OFFLINE RECOVERY", "03 · КОД ВОССТАНОВЛЕНИЯ")}</span><h2>{t("Use your recovery code", "Использовать код восстановления")}</h2>
        <p>{t("The offline code remains an independent fallback if email is unavailable. Using it revokes prior sessions and rotates the code.", "Код работает и без email. Его использование отзывает прежние сеансы и заменяет код.")}</p>
        <form onSubmit={(event) => submit("recover", event)}>
          <Field label={t("Account email", "Email аккаунта")}><input name="email" type="email" autoComplete="username" required/></Field>
          <Field label={t("Offline recovery code", "Код восстановления")}><input name="recoveryCode" type="text" autoComplete="one-time-code" spellCheck={false} required/></Field>
          <PasswordFields locale={locale}/>
          <button disabled={busy !== null}>{busy === "recover" ? t("Rotating credentials…", "Обновление данных входа…") : t("Recover and revoke old sessions", "Восстановить и отозвать старые сеансы")}</button>
        </form>
      </article>}
    </section>
    </details>

    <details className={styles.securityNote}>
      <summary>{t("How access and recovery work", "Как устроены доступ и восстановление")}</summary>
      <p>{t("ChatGPT confirms identity. Organization membership, case roles and application administrator rights are checked separately.", "ChatGPT подтверждает личность. Членство в организации, роли в деле и права администратора приложения проверяются отдельно.")}</p>
      <p>{isAdmin ? "ADMIN VERIFIED · CHATGPT ALLOWLIST" : identity?.authSource === "local" ? "LOCAL SESSION · ADMIN RIGHTS DISABLED" : t("Signed-in identity does not automatically grant administration rights.", "Вход в аккаунт не даёт автоматически прав администратора.")}</p>
      <ul><li>{t("Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations and a unique random salt.", "Пароли защищены PBKDF2-HMAC-SHA256 с 600 000 итераций и уникальной случайной солью.")}</li><li>{t("Session, reset and recovery secrets are never stored in plaintext.", "Секреты сеансов, сброса и восстановления не хранятся открытым текстом.")}</li><li>{t("Password recovery revokes prior sessions and rotates the offline code.", "Восстановление пароля отзывает прежние сеансы и заменяет код.")}</li><li>{t("Local password identity never grants platform-administrator rights.", "Локальный пароль не даёт прав администратора приложения.")}</li></ul>
      <div className={styles.russianNote} lang="ru" hidden={locale !== "ru"}>
        <h3>Кратко по-русски</h3>
        <p>Пароль: 10–128 символов, минимум одна заглавная буква, цифра и специальный символ. Первичная привязка возможна только через доверенную идентификацию ChatGPT.</p>
        <p>Сброс по email использует одноразовую ссылку на 15 минут и не выполняет автоматический вход. Администратор может только инициировать письмо на сохранённый адрес; пароль и токен ему не показываются. Офлайн-код и доверенный вход ChatGPT остаются резервными способами.</p>
      </div>
    </details>
  </main></>;
}

function PasswordFields({ locale }: { locale: "en" | "ru" }) {
  const id = useId();
  const t = (en: string, ru: string) => locale === "en" ? en : ru;
  return <>
    <Field label={t("New password", "Новый пароль")}><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} aria-describedby={id} required/></Field>
    <small id={id} className={styles.rules}>{t("10–128 characters with an uppercase letter, digit and special character.", "10–128 символов, включая заглавную букву, цифру и специальный символ.")}</small>
    <Field label={t("Confirm password", "Повторите пароль")}><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></Field>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
