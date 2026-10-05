import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { localAccounts, users } from "../../db/schema";
import { normalizeEmail } from "../auth-crypto";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";
import { passwordResetMailAvailable } from "../reset-mail";
import { isPlatformAdmin } from "../server-authorization";
import AccountClient, { type AccountProfile } from "./AccountClient";
import { safeWorkspaceReturn, workspacePagePath } from "../workspace-navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account access · CaseVant",
  description: "Enroll, use or recover local CaseVant credentials.",
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const returnTo = safeWorkspaceReturn(params.return_to);
  const identity = await getChatGPTUser();
  const email = identity ? normalizeEmail(identity.email) : null;
  let hasLocalAccount = identity?.authSource === "local";
  let initialProfile: AccountProfile | null = null;
  let profileKnown = !identity;
  if (email) {
    try {
      const [profile] = await getDb().select({
        displayName: users.displayName, professionalRole: users.professionalRole,
        organisation: users.organisation, jurisdiction: users.jurisdiction,
        practiceAreas: users.practiceAreas, experienceLevel: users.experienceLevel,
        locale: users.locale, productUpdates: users.productUpdates,
        caseUpdates: users.caseUpdates, researchInvites: users.researchInvites,
      }).from(users).where(eq(users.email, email)).limit(1);
      initialProfile = profile ?? null;
      profileKnown = true;
    } catch { /* Keep profile editing closed until its current state is known. */ }
  }
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
    initialProfile={initialProfile}
    profileKnown={profileKnown}
    returnTo={returnTo}
    chatGPTSignInUrl={chatGPTSignInPath(workspacePagePath("/account", { ...params, return_to: returnTo }))}
    chatGPTSignOutUrl={chatGPTSignOutPath(workspacePagePath("/account", { lang: params.lang, return_to: returnTo }))}
  />;
}
