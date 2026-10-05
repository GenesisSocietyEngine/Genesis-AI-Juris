import { workspacePagePath } from "../workspace-navigation";
import type { Metadata } from "next";
import MyCasesClient from "./MyCasesClient";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export const metadata: Metadata = {
  title: "My cases · CaseVant",
  description: "Continue personal Studio drafts or governed cases in your selected organization.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MattersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getChatGPTUser();
  const params = await searchParams;
  const location = new URL(workspacePagePath("/matters", params), "https://workspace.invalid");
  if (params.collection === "personal" || params.collection === "team") location.searchParams.set("collection", params.collection);
  const initialLocation = location.pathname + location.search;
  return <OrganizationBoundary signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath(initialLocation)}><MyCasesClient initialLocation={initialLocation}/></OrganizationBoundary>;
}
