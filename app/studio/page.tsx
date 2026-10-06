import type { Metadata } from "next";
import JurisApp from "../JurisApp";
import { studioEntry } from "../studio-entry";

export const metadata: Metadata = {
  title: "CaseVant — Make your case.",
  description: "A professional workbench for tax and legal advisers to structure cases, compare scenarios and preserve a canonical methodology.",
  alternates: { canonical: "/studio" },
  openGraph: { title: "CaseVant — Make your case.", url: "https://casevant.pro/studio", siteName: "CaseVant" },
};

export default async function FalconMerlinStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <JurisApp {...studioEntry(await searchParams)} studioOnly />;
}
