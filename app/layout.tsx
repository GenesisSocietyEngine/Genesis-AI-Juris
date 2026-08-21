import type { Metadata } from "next";
import "./globals.css";

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
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GENESIS: JURIS — Cases, Evidence, Consequences",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GENESIS: JURIS",
    description: "Cases. Evidence. Consequences.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
