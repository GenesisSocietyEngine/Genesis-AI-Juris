import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import OrganizationBoundary from "../organizations/OrganizationBoundary";
import WorkClient from "./WorkClient";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Firm work · CaseVant", robots: { index: false, follow: false } };
export default async function WorkPage() {
  const identity = await getChatGPTUser();
  return <OrganizationBoundary signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath("/work")}><WorkClient /></OrganizationBoundary>;
}
