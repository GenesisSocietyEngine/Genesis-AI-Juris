import type { Metadata } from "next";
import Link from "next/link";
import TrainingVideo from "../../TrainingVideo";

export const metadata: Metadata = {
  title: "10-minute Studio training | CaseVant",
  description: "Current CaseVant training: narrated workflow, workspace sections, Personal and Team cases, captions and transcript. Updated 5 October 2026.",
  alternates: { canonical: "/help/studio-demo" },
  openGraph: { title: "CaseVant — Make your case.", url: "https://casevant.pro/help/studio-demo", siteName: "CaseVant" },
};

export default function StudioDemoPage() {
  return <div className="app-shell theme-office"><main className="standalone-demo-page learning-page"><nav className="standalone-demo-nav" aria-label="Training navigation"><Link href="/studio?view=help">← Help & guides</Link><Link href="/studio" className="secondary-cta">Open Case Studio</Link></nav><TrainingVideo/></main></div>;
}
