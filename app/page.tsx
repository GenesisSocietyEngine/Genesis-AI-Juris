import type { Metadata } from "next";
import { headers } from "next/headers";
import JurisApp from "./JurisApp";
import { isFalconStudioHost } from "./host-mode";

async function requestIsFalconStudio(): Promise<boolean> {
  const requestHeaders = await headers();
  return isFalconStudioHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
}

export async function generateMetadata(): Promise<Metadata> {
  if (!await requestIsFalconStudio()) return {};
  return {
    title: "Falcon-Merlin Case Studio",
    description: "A professional workbench for tax and legal advisers to structure cases, compare scenarios and preserve a canonical methodology.",
    openGraph: {
      title: "Falcon-Merlin Case Studio",
      description: "Build, review and document professional tax and legal cases in one auditable workspace.",
      type: "website",
      images: [],
    },
    twitter: {
      card: "summary",
      title: "Falcon-Merlin Case Studio",
      description: "A professional workbench for auditable tax and legal case engineering.",
      images: [],
    },
  };
}

export default async function Home() {
  return <JurisApp studioOnly={await requestIsFalconStudio()} />;
}
