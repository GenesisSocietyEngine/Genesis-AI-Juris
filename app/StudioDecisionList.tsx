"use client";
import type { StudioDraft } from "./types";
import StudioNodeSummary from "./StudioNodeSummary";

export default function StudioDecisionList({ draft, locale, onNode }: { draft: StudioDraft; locale: "en" | "ru"; onNode: (id: string) => void }) {
  const nodes = new Map(draft.nodes.map(node => [node.id, node]));
  return <section className="studio-decision-list" aria-label={locale === "en" ? "Decision map as a list" : "Карта решений списком"}>
    <p>{locale === "en" ? "Recorded steps and their connections. Their order does not select or approve an outcome." : "Записанные этапы и связи. Порядок не определяет и не утверждает исход."}</p>
    <ol>{draft.nodes.map(node => <li key={node.id}><StudioNodeSummary node={node} locale={locale}/><button type="button" onClick={() => onNode(node.id)}>{locale === "en" ? "Inspect this step" : "Открыть этот этап"}</button><ul>{draft.links.filter(link => link.from === node.id).map(link => <li key={link.id}>{link.rule?.label && <p><strong>{link.rule.label}</strong></p>}<button type="button" onClick={() => onNode(link.to)}>{nodes.get(link.to)?.title ?? (locale === "en" ? "Missing destination" : "Назначение отсутствует")}</button>{link.rule?.detail && <p>{link.rule.detail}</p>}</li>)}</ul></li>)}</ol>
  </section>;
}
