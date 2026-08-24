import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Studio guided demo | GENESIS: JURIS",
  description: "A three-minute Studio-only walkthrough of Five Flats, Three Countries: shortest brief, canonical prompt, reviewed parameters, graph, outcome and PDF.",
  openGraph: {
    title: "GENESIS: JURIS Studio — Five Flats, Three Countries",
    description: "One complete Studio workflow from compact instruction to auditable PDF report.",
    images: ["/help/studio-ai-guided-demo-poster.jpg"],
  },
};

const steps = [
  "Shortest useful instruction in User view",
  "Generated canonical case prompt",
  "Reviewed financing and operating parameters",
  "27-node, 31-connection graph generation",
  "Node, relationship and validation review",
  "Transparent Studio outcome calculation",
  "Client-facing PDF from the reviewed graph",
];

export default function StudioDemoPage() {
  return <main className="standalone-demo-page">
    <nav className="standalone-demo-nav" aria-label="Demo navigation">
      <Link href="/" className="standalone-demo-brand"><Image src="/brand/genesis-juris-codex-mark.svg" width={46} height={46} alt=""/><span><b>GENESIS: JURIS</b><small>PROFESSIONAL LEGAL SIMULATIONS</small></span></Link>
      <a href="/help/studio-ai-guided-demo.en.mp4" className="secondary-cta">Open MP4</a>
    </nav>
    <section className="standalone-demo-hero">
      <div><span>STUDIO · END-TO-END DEMO · 03:00</span><h1>Five Flats, Three Countries</h1><p>One Studio-only walkthrough of the canonical Five Flats, Three Countries case. Every scene follows the same facts from the compact brief through reviewed parameters, graph, outcome and PDF.</p></div>
      <aside><b>EXPERT REVIEW CUT</b><small>English narration · No subtitles · Studio only</small></aside>
    </section>
    <section className="standalone-demo-player" aria-labelledby="studio-demo-title">
      <h2 id="studio-demo-title" className="visually-hidden">GENESIS: JURIS Studio guided demonstration</h2>
      <video controls preload="metadata" playsInline poster="/help/studio-ai-guided-demo-poster.jpg">
        <source src="/help/studio-ai-guided-demo.en.mp4" type="video/mp4"/>
        Your browser does not support HTML video.
      </video>
    </section>
    <section className="standalone-demo-outline" aria-labelledby="demo-outline-title">
      <header><span>WHAT THE DEMO COVERS</span><h2 id="demo-outline-title">One case, one Studio, one auditable chain</h2></header>
      <ol>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b></li>)}</ol>
    </section>
    <footer className="standalone-demo-footer"><p>GENESIS: JURIS CODEX · Professional beta · August 2026</p><Link href="/" className="primary-cta">Open GENESIS: JURIS</Link></footer>
  </main>;
}
