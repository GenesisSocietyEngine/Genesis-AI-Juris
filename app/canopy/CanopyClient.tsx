"use client";

import Link from "next/link";
import { useState } from "react";
import { CANOPY_DISCLOSURE, CANOPY_QUESTION, CANOPY_TITLE, CANOPY_SCENARIOS, CANOPY_SOURCES, canopySourceText, type CanopyScenarioId } from "../canopy-fixture";
import { CanopyWorkingCopy, type CanopyTransport } from "../canopy-workflow";
import { organizationWorkspaceUrl, scopedOrganizationHeaders } from "../organization-client";
import styles from "./canopy.module.css";

const transport: CanopyTransport = (path, init = {}) => fetch(path, {
  ...init, credentials: "same-origin", cache: "no-store",
  headers: { ...scopedOrganizationHeaders(), ...init.headers },
});

export default function CanopyClient() {
  const [selected, setSelected] = useState<CanopyScenarioId>("base");
  const [copies, setCopies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const scenario = CANOPY_SCENARIOS.find(item => item.id === selected)!;
  async function createCopy() {
    setBusy(true); setIssue("");
    try {
      const copy = await CanopyWorkingCopy.create(transport, id => setCopies(current => [...current, id]));
      await copy.propose("Treat all 600 indicated packs as signed demand.", [{ id: "D03", version: 1, section: "Demand" }]);
      await copy.propose("Demand and capacity are identical.", [{ id: "D03", version: 1, section: "Gap" }, { id: "D04", version: 1, section: "Capacity" }]);
      await copy.proposeScenario("base");
      await copy.proposeMemorandum("base");
    } catch {
      setIssue("The working copy could not be completed. Open My cases to inspect any retained partial copy before retrying.");
    } finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <nav><Link href={organizationWorkspaceUrl("/matters")}>My cases</Link><span>Featured demo · fictional working material</span></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>INVESTMENT AND OPERATING COMMITTEE</p><h1>{CANOPY_TITLE}</h1><p>{CANOPY_QUESTION}</p></div>
      <div className={styles.start}><button disabled={busy} onClick={() => void createCopy()}>{busy ? "Preparing sources and pending proposals…" : copies.length ? "Create a clean working copy" : "Create a working copy"}</button><p>A new private Matter contains nine sources, exact anchors, three open release questions and pending proposals. Review decisions remain yours. Previous copies stay in My cases.</p></div>
    </header>
    <p className={styles.disclosure}>{CANOPY_DISCLOSURE}</p>
    {issue && <p role="alert" className={styles.issue}>{issue} <Link href={organizationWorkspaceUrl("/matters")}>Inspect My cases</Link></p>}
    <div aria-live="polite">{copies.map((id, index) => <p key={id}>Working copy {index + 1} retained. <Link href={organizationWorkspaceUrl("/matters?dossier=" + encodeURIComponent(id))}>Open sources, pending proposals and release questions</Link></p>)}</div>
    <section aria-labelledby="comparison-title"><h2 id="comparison-title">Compare the prepared scenarios</h2><p>These are expected outcomes of the declared assumptions. The selected card does not run a simulation, accept evidence or approve an output.</p>
      <div className={styles.tabs} role="group" aria-label="Prepared scenario">{CANOPY_SCENARIOS.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div>
      <article className={styles.comparison}><h3>{scenario.recommendation}</h3><dl><div><dt>What changed</dt><dd>{scenario.changed}</dd></div><div><dt>Why the recommendation changes</dt><dd>{scenario.why}</dd></div><div><dt>Controlling evidence</dt><dd>{scenario.controls.map(control => <a key={control.document + control.section} href={"#" + control.document + "-v" + control.version}>{control.document} v{control.version} § {control.section}</a>)}</dd></div></dl></article>
    </section>
    <section aria-labelledby="source-title"><h2 id="source-title">Immutable source packet</h2><p>D03 and D06 retain both versions. All figures are illustrative; the economic sheet shows the arithmetic and assumptions.</p><div className={styles.sources}>{CANOPY_SOURCES.map(source => <details key={source.id + source.version} id={source.id + "-v" + source.version}><summary>{source.id} v{source.version} — {source.title}</summary>{Object.entries(source.sections).map(([section, text]) => <div key={section}><h3>§ {section}</h3><p>{text}</p></div>)}<a download={source.id + "-v" + source.version + ".md"} href={"data:text/markdown;charset=utf-8," + encodeURIComponent(canopySourceText(source))}>Download this exact source</a></details>)}</div></section>
    <section className={styles.notes}><h2>Review and continue</h2><p>Open the new Matter to review sources and proposals. Reject the claim that all indicated demand is signed; edit the demand/capacity claim before accepting it. Initial production-release questions remain open until supporting evidence is reviewed.</p><p>Prepared graph publication and recorded simulations use the existing Studio and decision-package workflow. Follow Base → Upside → Downside → Hard stop to preserve package lineage. This page prepares the source packet; it does not publish packages or mark the case ready.</p><p>Snapshot PDF and JSON, exact-output approval and current/stale status remain in the Matter output register. Refresh My cases to reopen a retained copy after leaving this page.</p></section>
  </main>;
}
