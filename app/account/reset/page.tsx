import type { Metadata } from "next";
import Link from "next/link";
import ResetPasswordClient from "./ResetPasswordClient";
import styles from "../account.module.css";

export const metadata: Metadata = {
  title: "Reset password · GENESIS: JURIS",
  description: "Complete a single-use GENESIS: JURIS password reset.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <main className={styles.shell}>
    <nav className={styles.nav} aria-label="Password reset navigation"><Link href="/" className={styles.brand}>GENESIS: JURIS</Link><Link href="/account">Account security</Link></nav>
    <header className={styles.hero}><p>ONE-TIME PASSWORD RESET</p><h1>Choose a new local password.</h1><p>The token is read from the URL fragment, removed from browser history and never sent in a page request. Completing the reset revokes existing local sessions; it does not sign you in automatically.</p></header>
    <ResetPasswordClient/>
  </main>;
}
