"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CANOPY_DISCLOSURE, CANOPY_QUESTION, CANOPY_TITLE, CANOPY_SCENARIOS, CANOPY_SOURCES, canopySourceText, type CanopyScenarioId } from "../canopy-fixture";
import { CanopyWorkingCopy, type CanopyTransport } from "../canopy-workflow";
import { organizationWorkspaceUrl, scopedOrganizationHeaders } from "../organization-client";
import styles from "./canopy.module.css";
import CanopyWorkspace from "./CanopyWorkspace";
import { canopySemanticInputDiff } from "../canopy-inputs";

const transport: CanopyTransport = (path, init = {}) => fetch(path, {
  ...init, credentials: "same-origin", cache: "no-store",
  headers: { ...scopedOrganizationHeaders(), ...init.headers },
});

export default function CanopyClient() {
  const [selected, setSelected] = useState<CanopyScenarioId>("base");
  const [copies, setCopies] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [opened,setOpened]=useState<{id:string;scenario:CanopyScenarioId}|null>(null);
  const [existing,setExisting]=useState<Array<{dossier_id:string;title:string;updated_at:string}>>([]);
  const creating=useRef(false);
  useEffect(()=>{let cancelled=false;void(async()=>{
    const response=await transport("/api/dossiers");if(response.ok&&!cancelled)setExisting(((await response.json()) as {dossiers:Array<{dossier_id:string;title:string;updated_at:string}>}).dossiers.filter(d=>d.title.startsWith(CANOPY_TITLE)));
    const url=new URL(window.location.href),id=url.searchParams.get("dossier"),scenario=url.searchParams.get("scenario");
    if(id&&!cancelled)setOpened({id,scenario:CANOPY_SCENARIOS.some(s=>s.id===scenario)?scenario as CanopyScenarioId:"base"});
  })().catch(()=>{if(!cancelled)setIssue("Existing demos could not be listed. Open My cases to resume normally.");});return()=>{cancelled=true;};},[]);
  const scenario = CANOPY_SCENARIOS.find(item => item.id === selected)!;
  async function createCopy() {
    if(creating.current)return;creating.current=true;
    setBusy(true); setIssue("");
    try {
      const copy = await CanopyWorkingCopy.create(transport, id => {setCopies(current => [...current, id]);openCopy(id,selected);}, selected);
      await copy.prepareScenario(selected);
      await copy.prepareDemoProposals(selected);
      openCopy(copy.dossierId,selected);
    } catch {
      setIssue("Preparation stopped. The partial copy is retained; refresh it and use Resume missing preparation. Reviews remain explicit.");
    } finally { creating.current=false;setBusy(false); }
  }
  function openCopy(id:string,scenario:CanopyScenarioId="base"){
    setOpened({id,scenario});const url=new URL(window.location.href);url.searchParams.set("dossier",id);url.searchParams.set("scenario",scenario);url.searchParams.delete("run");window.history.replaceState(null,"",url);
  }
  return <main className={styles.page}>
    <nav><Link href={organizationWorkspaceUrl("/matters")}>My cases</Link><span>Featured demo · Synthetic demonstration</span></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>INVESTMENT AND OPERATING COMMITTEE</p><h1>{CANOPY_TITLE}</h1><p>{CANOPY_QUESTION}</p></div>
      <div className={styles.start}><button disabled={busy} onClick={() => void createCopy()}>{busy ? "Preparing sources and pending proposals…" : "Create clean copy · "+scenario.label}</button><p>A new private Matter contains sources for the selected pinned scenario, exact anchors, three open release questions and pending proposals. Each copy keeps its own review and approvals.</p><label>Open existing demo<select defaultValue="" onChange={e=>{if(e.target.value)openCopy(e.target.value);}}><option value="">Select a retained copy</option>{existing.map((d,i)=><option key={d.dossier_id} value={d.dossier_id}>Copy {i+1} · {d.updated_at}</option>)}</select></label></div>
    </header>
    <p className={styles.disclosure}>{CANOPY_DISCLOSURE}</p>
    {issue && <p role="alert" className={styles.issue}>{issue} <Link href={organizationWorkspaceUrl("/matters")}>Inspect My cases</Link></p>}
    <div aria-live="polite">{copies.map((id, index) => <p key={id}>Working copy {index + 1} retained. <Link href={organizationWorkspaceUrl("/matters?dossier=" + encodeURIComponent(id))}>Open sources, pending proposals and release questions</Link></p>)}</div>
    {opened&&!busy&&<CanopyWorkspace key={opened.id} dossierId={opened.id} initialScenario={opened.scenario}/>}
    <section aria-labelledby="comparison-title"><h2 id="comparison-title">Compare the prepared scenarios</h2><p>These are expected outcomes of the declared assumptions. The selected card does not run a simulation, accept evidence or approve an output.</p>
      <div className={styles.tabs} role="group" aria-label="Prepared scenario">{CANOPY_SCENARIOS.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div>
      <article className={styles.comparison}><p>Expected outcome — not run</p><h3>{scenario.recommendation}</h3><dl><div><dt>What changed</dt><dd>{scenario.changed}</dd></div><div><dt>Why the recommendation changes</dt><dd>{scenario.why}</dd></div><div><dt>Controlling evidence</dt><dd>{scenario.controls.map(control => <a key={control.document + control.section} href={"#" + control.document + "-v" + control.version}>{control.document} v{control.version} § {control.section}</a>)}</dd></div></dl><details><summary>Verification details · pinned inputs and difference from Upside</summary><pre>{JSON.stringify({inputs:scenario.inputs,diff:canopySemanticInputDiff(CANOPY_SCENARIOS.find(s=>s.id==="upside")!.inputs,scenario.inputs)},null,2)}</pre></details></article>
    </section>
    <section aria-labelledby="source-title"><h2 id="source-title">Immutable source packet</h2><p>Historical versions are retained alongside the staffing, clearance and assumption addenda. All figures are illustrative; the economic sheet shows the arithmetic and assumptions.</p><div className={styles.sources}>{CANOPY_SOURCES.map(source => <details key={source.id + source.version} id={source.id + "-v" + source.version}><summary>{source.id} v{source.version} — {source.title}</summary>{Object.entries(source.sections).map(([section, text]) => <div key={section}><h3>§ {section}</h3><p>{text}</p></div>)}<a download={source.id + "-v" + source.version + ".md"} href={"data:text/markdown;charset=utf-8," + encodeURIComponent(canopySourceText(source))}>Download this exact source</a></details>)}</div></section>
    <section className={styles.notes}><h2>Review and continue</h2><p>Reject the claim that all indicated demand is signed; edit the demand/capacity claim before accepting it. Prepared demo proposals have no live-model provenance. Initial production-release questions remain open until supporting evidence is reviewed.</p><p>Follow Base → Upside → Hard stop in the walkthrough. Downside is an independently initialized stress copy. Each run requires the exact normally published Studio package. Completed server sessions supply Actual outcomes; expected cards never execute a run.</p><p>Snapshot PDF and JSON, independent exact-output approval and current/stale status remain in the Matter output register. The shorter presentation memo is a distinct, unapproved extract.</p></section>
  </main>;
}
