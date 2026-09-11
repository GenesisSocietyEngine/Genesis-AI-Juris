import { workspacePagePath } from "../workspace-navigation";
import type { Metadata } from "next";
import MattersClient from "./MattersClient";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export const metadata: Metadata = {
  title: "Matter workspace · GENESIS: JURIS",
  description: "A governed workspace for professional evidence, decisions, requests, and approved outputs.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MattersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getChatGPTUser();
  return <OrganizationBoundary signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath(workspacePagePath("/matters", await searchParams))}><MattersClient /></OrganizationBoundary>;
}
