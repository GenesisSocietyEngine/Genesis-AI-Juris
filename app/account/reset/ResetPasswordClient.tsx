"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import styles from "../account.module.css";

export default function ResetPasswordClient() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const reveal = window.setTimeout(() => {
      setToken(/^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : "");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(reveal);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setRecoveryCode("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/email-reset", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ resetToken: token, newPassword: password }) });
      const result = await response.json() as { error?: string; recoveryCode?: string };
      if (!response.ok || !result.recoveryCode) throw new Error(result.error || "The reset link is invalid or expired.");
      setRecoveryCode(result.recoveryCode); setToken("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The reset could not be completed."); }
    finally { setBusy(false); }
  }

  if (!ready) return <p className={styles.securityNote}>Checking the reset link…</p>;
  if (recoveryCode) return <section className={styles.recoveryReveal} aria-live="polite"><span>DISPLAYED ONCE</span><h2>Password changed</h2><p>Existing local sessions were revoked. Save this replacement offline recovery code before leaving this page.</p><code>{recoveryCode}</code><button type="button" onClick={() => navigator.clipboard.writeText(recoveryCode)}>Copy recovery code</button><Link className={styles.primaryLink} href="/account">Continue to normal sign-in</Link></section>;
  if (!token) return <section className={styles.securityNote}><h2>This reset link is missing or invalid.</h2><p>Request a new email from Account security. Links are single-use and expire after 15 minutes.</p><Link className={styles.primaryLink} href="/account">Request another link</Link></section>;
  return <section className={styles.grid}><article className={styles.card}><span>SECURE RESET</span><h2>Set the replacement password</h2><p>After completion, return to the account page and sign in normally.</p>{error && <div className={styles.error} role="alert">{error}</div>}<form onSubmit={submit}><label className={styles.field}><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></label><small className={styles.rules}>10–128 characters with an uppercase letter, digit and special character.</small><label className={styles.field}><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></label><button disabled={busy}>{busy ? "Changing password…" : "Change password and revoke sessions"}</button></form></article></section>;
}
