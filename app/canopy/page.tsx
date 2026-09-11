import { workspacePagePath } from "../workspace-navigation";
import type { Metadata } from "next";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import CanopyClient from "./CanopyClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project Canopy · GENESIS: JURIS", robots: { index: false, follow: false } };
export default async function CanopyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getChatGPTUser();
  return <OrganizationBoundary signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath(workspacePagePath("/canopy", await searchParams))}><CanopyClient /></OrganizationBoundary>;
}
