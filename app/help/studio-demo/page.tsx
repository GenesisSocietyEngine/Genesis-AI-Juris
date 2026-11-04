import type { Metadata } from "next";
import Link from "next/link";
import TrainingVideo from "../../TrainingVideo";

export const metadata: Metadata = {
  title: "Current workflow training | CaseVant",
  description: "Updated 3 November 2026: a four-minute narrated workflow guide, no subtitles, full English/Russian transcripts and current evidence actions.",
  alternates: { canonical: "/help/studio-demo" },
  openGraph: { title: "CaseVant — Make your case.", url: "https://casevant.pro/help/studio-demo", siteName: "CaseVant" },
};

export default function StudioDemoPage() {
  return <div className="app-shell theme-office"><main className="standalone-demo-page learning-page"><nav className="standalone-demo-nav" aria-label="Training navigation"><Link href="/studio?view=help">← Help & guides</Link><Link href="/studio" className="secondary-cta">Open Case Studio</Link></nav><TrainingVideo/></main></div>;
}
