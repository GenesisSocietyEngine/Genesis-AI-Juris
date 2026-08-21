import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://genesis-juris-web.maxim-hayan.chatgpt.site"),
  title: "GENESIS: JURIS Web",
  description:
    "Play five institutional legal scenarios and create new cases with a visual, prompt-driven authoring studio.",
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
