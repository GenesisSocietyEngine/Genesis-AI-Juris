import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GENESIS: JURIS — Legal Scenario System",
  description:
    "Play five institutional legal scenarios and create new cases with a visual, prompt-driven authoring studio.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "GENESIS: JURIS",
    description:
      "Cases. Evidence. Consequences. A playable legal-scenario system and visual case studio.",
    type: "website",
    images: [
      {
        url: "/genesis-juris-social.png",
        width: 1200,
        height: 630,
        alt: "GENESIS: JURIS — Cases, Evidence, Consequences",
      },
    ],
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
