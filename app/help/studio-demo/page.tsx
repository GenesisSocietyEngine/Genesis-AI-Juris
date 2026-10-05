import type { Metadata } from "next";
import Link from "next/link";
import TrainingVideo from "../../TrainingVideo";
export const metadata: Metadata = { title: "10-minute Studio training | CaseVant", description: "Earlier Genesis: Juris training recording with its original captions and transcript. Use Help & Training for current CaseVant instructions." };
export default function StudioDemoPage() { return <div className="app-shell theme-office"><main className="standalone-demo-page learning-page"><nav className="standalone-demo-nav" aria-label="Training navigation"><Link href="/studio?view=help">← Help & guides</Link><Link href="/studio" className="secondary-cta">Open Case Studio</Link></nav><TrainingVideo/></main></div>; }
