import type { Metadata } from "next";
import OrganizationsClient from "./OrganizationsClient";
export const metadata: Metadata = { title: "Organizations · GENESIS: JURIS", robots: { index: false, follow: false } };
export default function OrganizationsPage() { return <OrganizationsClient />; }
