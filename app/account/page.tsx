import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { localAccounts } from "../../db/schema";
import { normalizeEmail } from "../auth-crypto";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { passwordResetMailAvailable } from "../reset-mail";
import { isPlatformAdmin } from "../server-authorization";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "Account access · GENESIS: JURIS",
  description: "Enroll, use or recover local GENESIS: JURIS credentials.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const identity = await getChatGPTUser();
  const email = identity ? normalizeEmail(identity.email) : null;
  let hasLocalAccount = identity?.authSource === "local";
  if (email && !hasLocalAccount) {
    try {
      const [account] = await getDb().select({ id: localAccounts.id }).from(localAccounts).where(eq(localAccounts.userEmail, email)).limit(1);
      hasLocalAccount = Boolean(account);
    } catch {
      hasLocalAccount = false;
    }
  }
  return <AccountClient
    identity={identity ? { email: identity.email, displayName: identity.displayName, authSource: identity.authSource } : null}
    hasLocalAccount={hasLocalAccount}
    isAdmin={identity ? isPlatformAdmin(identity) : false}
    emailResetAvailable={passwordResetMailAvailable()}
    chatGPTSignInUrl={chatGPTSignInPath("/account")}
    chatGPTSignOutUrl={chatGPTSignOutPath("/account")}
  />;
}
