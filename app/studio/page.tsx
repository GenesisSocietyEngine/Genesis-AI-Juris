import type { Metadata } from "next";
import JurisApp from "../JurisApp";
import { studioEntry } from "../studio-entry";

export const metadata: Metadata = {
  title: "GENESIS: JURIS Studio",
  description: "A professional workbench for tax and legal advisers to structure cases, compare scenarios and preserve a canonical methodology.",
};

export default async function FalconMerlinStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <JurisApp {...studioEntry(await searchParams)} studioOnly />;
}
