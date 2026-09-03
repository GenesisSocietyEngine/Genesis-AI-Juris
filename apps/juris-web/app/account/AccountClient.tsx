"use client";

import { FormEvent, MouseEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LEGACY_STUDIO_DRAFT_KEY, LEGACY_STUDIO_PRIVATE_KEY, studioDeviceDraftKey, studioDeviceScope } from "../studio-device-storage";
import styles from "./account.module.css";

type Identity = { email: string; displayName: string; authSource: "chatgpt" | "local" };
type AuthAction = "login" | "register" | "recover" | "reset" | "forgot" | "logout";

export default function AccountClient({
  identity,
  hasLocalAccount,
  isAdmin,
  emailResetAvailable,
  chatGPTSignInUrl,
  chatGPTSignOutUrl,
}: {
  identity: Identity | null;
  hasLocalAccount: boolean;
  isAdmin: boolean;
  emailResetAvailable: boolean;
  chatGPTSignInUrl: string;
  chatGPTSignOutUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<AuthAction | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  async function submit(action: Exclude<AuthAction, "logout" | "forgot">, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(action); setError(""); setMessage(""); setRecoveryCode("");
    const form = new FormData(event.currentTarget);
    const passwordField = action === "login" ? "password" : "newPassword";
    const password = String(form.get(passwordField) ?? "");
    const confirmation = action === "login" ? password : String(form.get("confirmPassword") ?? "");
    if (password !== confirmation) {
      setError("Passwords do not match."); setBusy(null); return;
    }
    const body: Record<string, string> = action === "register"
      ? { password }
      : action === "login"
        ? { email: String(form.get("email") ?? ""), password }
        : action === "recover"
          ? { email: String(form.get("email") ?? ""), recoveryCode: String(form.get("recoveryCode") ?? ""), newPassword: password }
          : { newPassword: password };
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string; recoveryCode?: string; recoveryNotice?: string };
      if (!response.ok) throw new Error(result.error || "The credential request could not be completed.");
      if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
      setMessage(result.recoveryNotice || (action === "login" ? "Local sign-in completed." : "Credentials updated."));
      if (action === "login") window.setTimeout(() => { router.replace("/"); router.refresh(); }, 650);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The credential request could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function requestEmailReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("forgot"); setError(""); setMessage(""); setRecoveryCode("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: String(form.get("email") ?? "") }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "The reset request could not be accepted.");
      setMessage(result.message || "If an account exists, a password-reset link has been sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reset request could not be accepted.");
    } finally { setBusy(null); }
  }

  async function logout() {
    setBusy("logout"); setError(""); setMessage(""); setRecoveryCode("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Local sign-out could not be completed.");
      await clearDeviceStudioDraft();
      router.replace("/account");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Local sign-out could not be completed.");
      setBusy(null);
    }
  }

  async function clearDeviceStudioDraft() {
    window.localStorage.removeItem(LEGACY_STUDIO_DRAFT_KEY);
    window.localStorage.removeItem(LEGACY_STUDIO_PRIVATE_KEY);
    const scope = await studioDeviceScope(identity?.email);
    if (scope) window.localStorage.removeItem(studioDeviceDraftKey(scope));
  }

  async function signOutChatGPT(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setBusy("logout");
    try {
      await clearDeviceStudioDraft();
    } finally {
      window.location.assign(chatGPTSignOutUrl);
    }
  }

  return <main className={styles.shell}>
    <nav className={styles.nav} aria-label="Account navigation">
      <Link href="/" className={styles.brand}><Image src="/brand/genesis-juris-codex-mark.svg" width={35} height={35} alt=""/><span>GENESIS: JURIS</span></Link>
      <div className={styles.navLinks}><Link href="/matters">My cases</Link><Link href="/?view=library">Templates</Link><Link href="/studio">Studio</Link><Link href="/account" aria-current="page">Account</Link></div>
    </nav>
    <header className={styles.hero}>
      <p>ACCOUNT SECURITY · v16</p>
      <h1>Professional access without hidden recovery shortcuts.</h1>
      <p>ChatGPT remains the trusted identity source. After one confirmation through ChatGPT, you can use a local password and an offline recovery code independently.</p>
    </header>

    {identity && <section className={styles.identity} aria-label="Current identity">
      <div><span>Current session</span><strong>{identity.displayName}</strong><small>{identity.email}</small></div>
      <b className={isAdmin ? styles.adminBadge : ""}>{isAdmin ? "ADMIN VERIFIED · CHATGPT ALLOWLIST" : identity.authSource === "chatgpt" ? "TRUSTED CHATGPT IDENTITY" : "LOCAL SESSION · ADMIN RIGHTS DISABLED"}</b>
      {identity.authSource === "local" && <button onClick={logout} disabled={busy !== null}>{busy === "logout" ? "Signing out…" : "Sign out locally"}</button>}
      {identity.authSource === "chatgpt" && <a href={chatGPTSignOutUrl} onClick={signOutChatGPT}>Sign out from ChatGPT identity</a>}
    </section>}

    {(message || error) && <div className={error ? styles.error : styles.success} role={error ? "alert" : "status"}>{error || message}</div>}
    {recoveryCode && <section className={styles.recoveryReveal} aria-live="polite">
      <span>DISPLAYED ONCE</span><h2>Save your replacement recovery code</h2>
      <code>{recoveryCode}</code>
      <button type="button" onClick={() => navigator.clipboard.writeText(recoveryCode)}>Copy recovery code</button>
      <p>Store it in a password manager. GENESIS: JURIS stores only its hash and cannot show this value again.</p>
    </section>}

    <section className={styles.grid}>
      <article className={styles.card}>
        <span>01 · RETURNING USER</span><h2>Sign in with password</h2>
        <p>Use credentials enrolled after ChatGPT identity confirmation.</p>
        <form onSubmit={(event) => submit("login", event)}>
          <Field label="Account email"><input name="email" type="email" autoComplete="username" required/></Field>
          <Field label="Password"><input name="password" type="password" autoComplete="current-password" minLength={10} maxLength={128} required/></Field>
          <button disabled={busy !== null}>{busy === "login" ? "Checking…" : "Sign in locally"}</button>
        </form>
        <div className={styles.emailReset}>
          <h3>Forgot the password?</h3>
          <p>{emailResetAvailable ? "Request a 15-minute, single-use link. The response never reveals whether an account exists." : "Email reset is implemented but awaits the server sender configuration. Use ChatGPT identity or the offline code for now."}</p>
          <form onSubmit={requestEmailReset}>
            <Field label="Account email"><input name="email" type="email" autoComplete="username" required/></Field>
            <button disabled={busy !== null || !emailResetAvailable}>{busy === "forgot" ? "Requesting…" : "Email reset link"}</button>
          </form>
        </div>
      </article>

      <article className={styles.card}>
        <span>02 · FIRST-TIME ENROLLMENT</span><h2>{hasLocalAccount ? "Reset through ChatGPT" : "Create local credentials"}</h2>
        {identity?.authSource === "chatgpt" ? <>
          <p>Your account email is taken from the trusted ChatGPT identity header, never from an editable form.</p>
          <form onSubmit={(event) => submit(hasLocalAccount ? "reset" : "register", event)}>
            <PasswordFields/>
            <button disabled={busy !== null}>{busy === "register" || busy === "reset" ? "Protecting credentials…" : hasLocalAccount ? "Reset password and sessions" : "Enroll local password"}</button>
          </form>
        </> : <>
          <p>Confirm control of the account once through ChatGPT before adding a password. This prevents someone from claiming another practitioner’s email and case permissions.</p>
          <a className={styles.primaryLink} href={chatGPTSignInUrl}>Continue with trusted ChatGPT identity</a>
        </>}
      </article>

      <article className={styles.card}>
        <span>03 · OFFLINE RECOVERY</span><h2>Use your recovery code</h2>
        <p>The offline code remains an independent fallback if email is unavailable. Using it revokes prior sessions and rotates the code.</p>
        <form onSubmit={(event) => submit("recover", event)}>
          <Field label="Account email"><input name="email" type="email" autoComplete="username" required/></Field>
          <Field label="Offline recovery code"><input name="recoveryCode" type="text" autoComplete="one-time-code" spellCheck={false} required/></Field>
          <PasswordFields/>
          <button disabled={busy !== null}>{busy === "recover" ? "Rotating credentials…" : "Recover and revoke old sessions"}</button>
        </form>
      </article>
    </section>

    <aside className={styles.securityNote}>
      <h2>Security contract</h2>
      <ul><li>Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations and a unique random salt.</li><li>Session, reset and recovery secrets are never stored in plaintext.</li><li>Password recovery revokes prior sessions and rotates the offline code.</li><li>Local password identity never grants platform-administrator rights.</li></ul>
      <div className={styles.russianNote} lang="ru">
        <h3>Кратко по-русски</h3>
        <p>Пароль: 10–128 символов, минимум одна заглавная буква, цифра и специальный символ. Первичная привязка возможна только через доверенную идентификацию ChatGPT.</p>
        <p>Сброс по email использует одноразовую ссылку на 15 минут и не выполняет автоматический вход. Администратор может только инициировать письмо на сохранённый адрес; пароль и токен ему не показываются. Офлайн-код и доверенный вход ChatGPT остаются резервными способами.</p>
      </div>
    </aside>
  </main>;
}

function PasswordFields() {
  return <>
    <Field label="New password"><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} aria-describedby="password-rules" required/></Field>
    <small id="password-rules" className={styles.rules}>10–128 characters with an uppercase letter, digit and special character.</small>
    <Field label="Confirm password"><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></Field>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
