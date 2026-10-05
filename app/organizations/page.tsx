import { workspacePagePath } from "../workspace-navigation";
import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import OrganizationsClient from "./OrganizationsClient";
export const metadata: Metadata = { title: "Organizations · CaseVant", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getChatGPTUser();
  return <OrganizationsClient signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath(workspacePagePath("/organizations", await searchParams))}/>;
}
