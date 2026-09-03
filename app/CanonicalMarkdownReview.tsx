"use client";

import type { StudioDraft } from "./types";

export default function CanonicalMarkdownReview({locale,draft,fingerprint,status,apply}:{locale:"en"|"ru";draft:StudioDraft;fingerprint:string;status:"amended"|"final";apply:()=>void}){
  return <section id="canonical-case-review" className="canonical-case-review page-width" aria-labelledby="canonical-case-title">
    <header><div><span>{locale==="en"?"VERIFIED CANONICAL CASE":"ПРОВЕРЕННЫЙ КАНОНИЧЕСКИЙ КЕЙС"}</span><h2 id="canonical-case-title">{draft.title}</h2></div><b>{status.toUpperCase()}</b></header>
    <p>{locale==="en"?"The compressed manifest passed structural validation and its fingerprint matches. Applying it reconstructs the exact graph; no AI interpretation is used.":"Сжатый манифест прошёл структурную проверку, отпечаток совпадает. При применении восстанавливается точная схема без AI-интерпретации."}</p>
    <dl><div><dt>{locale==="en"?"Nodes":"Узлы"}</dt><dd>{draft.nodes.length}</dd></div><div><dt>{locale==="en"?"Relations":"Связи"}</dt><dd>{draft.links.length}</dd></div><div><dt>{locale==="en"?"Version":"Версия"}</dt><dd>{draft.version}</dd></div></dl>
    <code>{fingerprint}</code>
    <button className="primary-cta" type="button" onClick={apply}>{locale==="en"?"Apply exact case":"Применить точный кейс"}</button>
  </section>;
}
