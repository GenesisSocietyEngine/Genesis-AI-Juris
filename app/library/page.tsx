import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import LibraryClient from "./LibraryClient";
import { workspacePagePath } from "../workspace-navigation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Library · CaseVant", robots: { index: false, follow: false } };
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [identity, params] = await Promise.all([getChatGPTUser(), searchParams]);
  return (
    <OrganizationBoundary
      signedIn={Boolean(identity)}
      signInUrl={chatGPTSignInPath(workspacePagePath("/library", params))}
    >
      <LibraryClient />
    </OrganizationBoundary>
  );
}
