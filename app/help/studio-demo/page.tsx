import type { Metadata } from "next";
import Link from "next/link";
import TrainingVideo from "../../TrainingVideo";
export const metadata: Metadata = { title: "10-minute Studio training | CaseVant", description: "Import Five Flats, Three Borders, review evidence and decisions, create an analytical draft, and start your own case." };
export default function StudioDemoPage() { return <div className="app-shell theme-office"><main className="standalone-demo-page learning-page"><nav className="standalone-demo-nav" aria-label="Training navigation"><Link href="/studio?view=help">← Help & guides</Link><Link href="/studio" className="secondary-cta">Open Case Studio</Link></nav><TrainingVideo/></main></div>; }
