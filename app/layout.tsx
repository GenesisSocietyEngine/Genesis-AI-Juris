import type { Metadata } from "next";
import "./globals.css";
import StaleChunkRecovery from "./StaleChunkRecovery";

export const metadata: Metadata = {
  metadataBase: new URL("https://genesis-juris-web.maxim-hayan.chatgpt.site"),
  title: "GENESIS: JURIS CODEX",
  description:
    "Build, review and play branching legal simulations for professional judgment, including compliant international tax-planning scenarios.",
  icons: {
    icon: "/brand/genesis-juris-codex-mark.svg",
    shortcut: "/brand/genesis-juris-codex-mark.svg",
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
      <body className="antialiased" data-genesis-juris-release="v62"><StaleChunkRecovery/>{children}</body>
    </html>
  );
}
