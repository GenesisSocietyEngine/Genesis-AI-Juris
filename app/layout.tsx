import type { Metadata } from "next";
import "./globals.css";
import "./workspace-design.css";
import "./demo-catalogue.css";
import "./casevant.css";
import StaleChunkRecovery from "./StaleChunkRecovery";
import NavigationSession from "./NavigationSession";

export const metadata: Metadata = {
  metadataBase: new URL("https://casevant.pro"),
  title: "CaseVant — Make your case.",
  description:
    "Evidence, options and outcomes. Connected. CaseVant by Falcon-Merlin Group.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/brand/casevant-mark.png",
    shortcut: "/brand/casevant-mark.png",
  },
  openGraph: {
    title: "CaseVant — Make your case.",
    description:
      "Evidence, options and outcomes. Connected. Build, review and document professional tax and legal cases in one auditable workspace.",
    type: "website",
    url: "https://casevant.pro/",
    siteName: "CaseVant",
    images: [
      {
        url: "/og-v62.png",
        width: 1200,
        height: 630,
        alt: "CaseVant professional case workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CaseVant — Make your case.",
    description: "Evidence, options and outcomes. Connected.",
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
