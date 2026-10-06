import type { Metadata } from "next";
import { headers } from "next/headers";
import JurisApp from "./JurisApp";
import { isFalconStudioHost } from "./host-mode";
import { studioEntry } from "./studio-entry";

async function requestIsFalconStudio(): Promise<boolean> {
  const requestHeaders = await headers();
  return isFalconStudioHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
}

export async function generateMetadata(): Promise<Metadata> {
  if (!await requestIsFalconStudio()) return {};
  return {
    title: "CaseVant — Make your case.",
    description: "A professional workbench for tax and legal advisers to structure cases, compare scenarios and preserve a canonical methodology.",
    alternates: { canonical: "/" },
    openGraph: {
      title: "CaseVant — Make your case.",
      description: "Build, review and document professional tax and legal cases in one auditable workspace.",
      type: "website",
      url: "https://casevant.pro/",
      images: [],
    },
    twitter: {
      card: "summary",
      title: "CaseVant — Make your case.",
      description: "A professional workbench for auditable tax and legal case engineering.",
      images: [],
    },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { view } = params;
  // The custom domain selects the initial workspace; explicit navigation must
  // still reach the catalogue, saved drafts and help, including old bookmarks.
  const explicitWorkspace = ["library", "community", "help", "play"].includes(view ?? "");
  return <JurisApp {...studioEntry(params)} studioOnly={await requestIsFalconStudio() && !explicitWorkspace} />;
}
