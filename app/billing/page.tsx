import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import { workspacePagePath } from "../workspace-navigation";
import BillingClient from "./BillingClient";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Billing · CaseVant",
  robots: { index: false, follow: false },
};
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [identity, params] = await Promise.all([
    getChatGPTUser(),
    searchParams,
  ]);
  return (
    <OrganizationBoundary
      signedIn={Boolean(identity)}
      signInUrl={chatGPTSignInPath(workspacePagePath("/billing", params))}
    >
      <BillingClient />
    </OrganizationBoundary>
  );
}
