import type { Metadata } from "next";
import InvitationClient from "./InvitationClient";
export const metadata: Metadata = { title: "Accept invitation · CaseVant", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default function InvitationPage() { return <InvitationClient />; }
