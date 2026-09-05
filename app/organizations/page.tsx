import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import OrganizationsClient from "./OrganizationsClient";
export const metadata: Metadata = { title: "Organizations · GENESIS: JURIS", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function OrganizationsPage() {
  const identity = await getChatGPTUser();
  return <OrganizationsClient signedIn={Boolean(identity)} signInUrl={chatGPTSignInPath("/organizations")}/>;
}
