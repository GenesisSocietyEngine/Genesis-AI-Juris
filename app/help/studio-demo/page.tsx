import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Studio guided demo | GENESIS: JURIS",
  description: "A two-minute expert walkthrough from a five-line legal case brief to a reviewable AI proposal, playable case, financial result and PDF report.",
  openGraph: {
    title: "GENESIS: JURIS Studio — two-minute guided demo",
    description: "Build, review, refine, play and report a professional legal simulation.",
    images: ["/help/studio-ai-guided-demo-poster.jpg"],
  },
};

const steps = [
  "User view and a five-line case brief",
  "Reviewable AI candidate scheme",
  "Reviewed apply and a manual node edit",
  "Add, relink, delete and undo a relationship",
  "Deterministic case player",
  "Financial result and economics",
  "Professional PDF report",
];

export default function StudioDemoPage() {
  return <main className="standalone-demo-page">
    <nav className="standalone-demo-nav" aria-label="Demo navigation">
      <Link href="/" className="standalone-demo-brand"><Image src="/brand/genesis-juris-codex-mark.svg" width={46} height={46} alt=""/><span><b>GENESIS: JURIS</b><small>PROFESSIONAL LEGAL SIMULATIONS</small></span></Link>
      <a href="/help/studio-ai-guided-demo.mp4" className="secondary-cta">Open MP4</a>
    </nav>
    <section className="standalone-demo-hero">
      <div><span>STUDIO · GUIDED DEMO · 02:00</span><h1>From five-line brief to professional report</h1><p>A concise expert walkthrough of a controllable AI-assisted authoring workflow. AI proposes; the professional reviews, edits and decides. The runtime and financial outcome remain deterministic.</p></div>
      <aside><b>EXPERT REVIEW CUT</b><small>English narration · English and Russian captions</small></aside>
    </section>
    <section className="standalone-demo-player" aria-labelledby="studio-demo-title">
      <h2 id="studio-demo-title" className="visually-hidden">GENESIS: JURIS Studio guided demonstration</h2>
      <video controls preload="metadata" playsInline poster="/help/studio-ai-guided-demo-poster.jpg">
        <source src="/help/studio-ai-guided-demo.mp4" type="video/mp4"/>
        <track kind="captions" src="/help/studio-ai-guided-demo.en.vtt" srcLang="en" label="English" default/>
        <track kind="captions" src="/help/studio-ai-guided-demo.ru.vtt" srcLang="ru" label="Русский"/>
        Your browser does not support HTML video.
      </video>
    </section>
    <section className="standalone-demo-outline" aria-labelledby="demo-outline-title">
      <header><span>WHAT THE DEMO COVERS</span><h2 id="demo-outline-title">One complete, auditable workflow</h2></header>
      <ol>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b></li>)}</ol>
    </section>
    <footer className="standalone-demo-footer"><p>GENESIS: JURIS CODEX · Professional beta · August 2026</p><Link href="/" className="primary-cta">Open GENESIS: JURIS</Link></footer>
  </main>;
}
