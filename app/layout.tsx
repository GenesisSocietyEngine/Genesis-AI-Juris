import type { Metadata } from "next";
import "./globals.css";
import "./workspace-design.css";
import "./demo-catalogue.css";
import "./casevant.css";
import StaleChunkRecovery from "./StaleChunkRecovery";
import NavigationSession from "./NavigationSession";

export const metadata: Metadata = {
  metadataBase: new URL("https://genesis-juris-web.maxim-hayan.chatgpt.site"),
  title: "CaseVant — Make your case.",
  description:
    "Evidence, options and outcomes. Connected. CaseVant by Falcon-Merlin Group.",
  icons: {
    icon: "/brand/casevant-mark.png",
    shortcut: "/brand/casevant-mark.png",
  },
  openGraph: {
    title: "GENESIS: JURIS",
    description:
      "Train professional judgment through versioned legal simulations, practitioner feedback and a visual case-authoring studio.",
    type: "website",
    images: [
      {
        url: "/og-v62.png",
        width: 1200,
        height: 630,
        alt: "GENESIS: JURIS decision-centric dossier workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GENESIS: JURIS",
    description: "Cases. Evidence. Consequences.",
    images: ["/og-v62.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" data-genesis-juris-release="v62"><StaleChunkRecovery/><NavigationSession>{children}</NavigationSession></body>
    </html>
  );
}
