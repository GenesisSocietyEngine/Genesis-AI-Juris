"use client";

import { useMemo } from "react";
import { describeStudioPromptOperation, type StudioPromptOperation, type StudioPromptPlan } from "./studio-editing";
import { previewValidatedAIStudioPlan } from "./studio-ai-plan";
import type { StudioDraft, StudioNodeType } from "./types";

const previewColors: Record<StudioNodeType, string> = {
  trigger: "#d2a85e",
  actor: "#5bb8c4",
  fact: "#8396a5",
  evidence: "#72c6a4",
  deadline: "#e4634d",
  decision: "#a594d8",
  outcome: "#d7c8a6",
  entity: "#78a7c8",
  tax_rule: "#d9a85f",
  cash_flow: "#6fb7a3",
};

type Props = {
  locale: "en" | "ru";
  draft: StudioDraft;
  plan: StudioPromptPlan;
  nodeTitles: ReadonlyMap<string, string>;
  linkEndpoints: ReadonlyMap<string, { from: string; to: string }>;
  nodeLabels: Record<StudioNodeType, string>;
  applyEnabled: boolean;
  showTechnicalIds: boolean;
  onApply: () => void;
};

export default function StudioAIReview({ locale, draft, plan, nodeTitles, linkEndpoints, nodeLabels, applyEnabled, showTechnicalIds, onApply }: Props) {
  const preview = useMemo(() => {
    if (!plan.canApply) return { candidate: null, error: null };
    try { return { candidate: previewValidatedAIStudioPlan(draft, { plan, locale }), error: null }; }
    catch { return { candidate: null, error: locale === "en" ? "The proposal no longer passes the final graph safety check. Analyse the current graph again." : "Предложение больше не проходит итоговую проверку безопасности схемы. Повторите AI-анализ текущего графа." }; }
  }, [draft, locale, plan]);
  const candidate = preview.candidate;
  const groups = operationGroups(plan.operations, locale);
  const addedNodes = plan.operations.filter((operation) => operation.kind === "add_node").length;
  const updatedNodes = plan.operations.filter((operation) => operation.kind === "update_node").length;
  const addedLinks = plan.operations.filter((operation) => operation.kind === "add_link").length;
  const updatedLinks = plan.operations.filter((operation) => operation.kind === "update_link").length;
  const previewReady = Boolean(candidate && plan.canApply);

  return <section id="ai-plan-review" className={`prompt-plan ai-plan page-width ${previewReady ? "ready" : "blocked"}`}>
    <p className="visually-hidden" role="status" aria-live="polite">{previewReady ? (locale === "en" ? `AI proposal ready: ${plan.operations.length} changes to review.` : `AI-предложение готово: изменений для проверки — ${plan.operations.length}.`) : (locale === "en" ? "AI proposal needs clarification." : "AI-предложение требует уточнения.")}</p>
    <header><div><span>{locale === "en" ? "AI-assisted graph proposal" : "AI-предложение схемы"}</span><h2>{plan.summary || (locale === "en" ? `${plan.operations.length} proposed changes` : `Предложено изменений: ${plan.operations.length}`)}</h2></div><b>{previewReady ? (locale === "en" ? "REVIEW" : "ПРОВЕРЬТЕ") : (locale === "en" ? "CLARIFY" : "УТОЧНИТЕ")}</b></header>

    <div className="ai-change-summary" aria-label={locale === "en" ? "Proposed change counts" : "Количество предложенных изменений"}>
      <div><b>+{addedNodes}</b><span>{locale === "en" ? "new nodes" : "новых узлов"}</span></div>
      <div><b>Δ{updatedNodes}</b><span>{locale === "en" ? "updated nodes" : "изменённых узлов"}</span></div>
      <div><b>+{addedLinks}</b><span>{locale === "en" ? "new relations" : "новых связей"}</span></div>
      <div><b>Δ{updatedLinks}</b><span>{locale === "en" ? "updated relations" : "изменённых связей"}</span></div>
    </div>

    {candidate && <AIProposalMap locale={locale} base={draft} candidate={candidate} nodeLabels={nodeLabels}/>} 
    {preview.error && <div className="prompt-ai-status error" role="alert"><IconMark/><div><b>{locale === "en" ? "The proposed scheme cannot be applied safely" : "Предлагаемую схему нельзя безопасно применить"}</b><p>{preview.error}</p></div></div>}

    <div className="ai-review-disclosure"><IconMark/>
      <p>{locale === "en"
        ? "Every field that will be applied is displayed in full below. The proposal is applied atomically only after your review."
        : "Ниже полностью показано каждое поле, которое будет применено. После проверки предложение применяется целиком одной обратимой операцией."}</p>
    </div>

    <div className="ai-operation-groups">
      {groups.map((group) => <section className="ai-operation-group" key={group.key}>
        <h3><span>{group.label}</span><b>{group.operations.length}</b></h3>
        <ol>{group.operations.map(({ operation, index }) => <li key={`${operation.kind}-${index}`}>
          <code>{String(index + 1).padStart(2, "0")}</code>
          <span>{describeStudioPromptOperation(operation, locale, nodeTitles, { showIds: showTechnicalIds, linkEndpoints })}</span>
        </li>)}</ol>
      </section>)}
    </div>

    {(plan.assumptions?.length ?? 0) > 0 && <div className="ai-plan-notes assumptions"><b>{locale === "en" ? "Assumptions to verify" : "Допущения для проверки"}</b><ul>{plan.assumptions!.map((item, index) => <li key={`assumption-${index}`}>{item}</li>)}</ul></div>}
    {(plan.warnings?.length ?? 0) > 0 && <div className="ai-plan-notes warnings"><b>{locale === "en" ? "Review warnings" : "Предупреждения"}</b><ul>{plan.warnings!.map((item, index) => <li key={`warning-${index}`}>{item}</li>)}</ul></div>}
    {plan.diagnostics.length > 0 && <ul className="ai-plan-diagnostics">{plan.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.level}-${index}`} className={diagnostic.level}><span aria-hidden="true">{diagnostic.level === "error" ? "!" : "✓"}</span>{diagnostic.message}</li>)}</ul>}
    <p className="ai-plan-footnote">{locale === "en" ? "AI proposes structure; it does not verify law, evidence or tax conclusions. Check every node, relation, assumption and consequence." : "AI предлагает структуру, но не проверяет право, доказательства и налоговые выводы. Проверьте каждый узел, связь, допущение и последствие."}</p>
    <div className="ai-plan-actions"><button className="primary-cta" disabled={!previewReady || !applyEnabled} onClick={onApply}><span aria-hidden="true">✓</span>{locale === "en" ? `Apply all ${plan.operations.length} reviewed changes` : `Применить все проверенные изменения: ${plan.operations.length}`}</button><small>{locale === "en" ? "One undoable revision; lineage and the current graph are preserved." : "Одна отменяемая ревизия; линия версий и текущая схема сохраняются."}</small></div>
  </section>;
}

function operationGroups(operations: StudioPromptOperation[], locale: "en" | "ru") {
  const definitions = [
    { key: "case", label: locale === "en" ? "Case context & classification" : "Контекст и классификация", kinds: new Set(["append_context", "set_case_field", "set_classification"]) },
    { key: "nodes", label: locale === "en" ? "Nodes" : "Узлы", kinds: new Set(["add_node", "update_node"]) },
    { key: "relations", label: locale === "en" ? "Relations & consequences" : "Связи и последствия", kinds: new Set(["add_link", "update_link"]) },
  ];
  return definitions.map((definition) => ({
    ...definition,
    operations: operations.map((operation, index) => ({ operation, index })).filter(({ operation }) => definition.kinds.has(operation.kind)),
  })).filter((group) => group.operations.length > 0);
}

function AIProposalMap({ locale, base, candidate, nodeLabels }: { locale: "en" | "ru"; base: StudioDraft; candidate: StudioDraft; nodeLabels: Record<StudioNodeType, string> }) {
  const baseNodes = new Map(base.nodes.map((node) => [node.id, node]));
  const baseLinks = new Map(base.links.map((link) => [link.id, link]));
  const candidateNodes = new Map(candidate.nodes.map((node) => [node.id, node]));
  const width = Math.max(720, ...candidate.nodes.map((node) => node.x + 190));
  const height = Math.max(360, ...candidate.nodes.map((node) => node.y + 95));
  return <figure className="ai-scheme-preview">
    <figcaption><div><span>{locale === "en" ? "Proposed scheme · before apply" : "Предлагаемая схема · до применения"}</span><b>{candidate.nodes.length} {locale === "en" ? "nodes" : "узлов"} · {candidate.links.length} {locale === "en" ? "relations" : "связей"}</b></div><p><i className="added"/>{locale === "en" ? "Added" : "Добавлено"}<i className="changed"/>{locale === "en" ? "Changed" : "Изменено"}<i/>{locale === "en" ? "Unchanged" : "Без изменений"}</p></figcaption>
    <div className="ai-scheme-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={locale === "en" ? "Read-only preview of the proposed case graph" : "Предпросмотр предлагаемой схемы кейса только для чтения"}>
      {candidate.links.map((link) => {
        const from = candidateNodes.get(link.from);
        const to = candidateNodes.get(link.to);
        if (!from || !to) return null;
        const previous = baseLinks.get(link.id);
        const changed = !previous || JSON.stringify(previous) !== JSON.stringify(link);
        const path = `M ${from.x + 165} ${from.y + 34} C ${from.x + 205} ${from.y + 34}, ${to.x - 38} ${to.y + 34}, ${to.x} ${to.y + 34}`;
        return <g key={link.id} className={previous ? (changed ? "changed" : "") : "added"}><title>{from.title} → {to.title}</title><path d={path}/><circle cx={to.x} cy={to.y + 34} r="3"/></g>;
      })}
      {candidate.nodes.map((node) => {
        const previous = baseNodes.get(node.id);
        const state = previous ? (JSON.stringify(previous) === JSON.stringify(node) ? "" : "changed") : "added";
        const title = node.title.length > 28 ? `${node.title.slice(0, 27)}…` : node.title;
        return <g key={node.id} className={`ai-map-node ${state}`} transform={`translate(${node.x} ${node.y})`} style={{ "--ai-node-color": previewColors[node.type] } as React.CSSProperties}>
          <title>{nodeLabels[node.type]}: {node.title}</title><rect width="165" height="68"/><rect className="type-stripe" width="4" height="68"/><text className="type" x="13" y="19">{nodeLabels[node.type].toUpperCase()}</text><text className="title" x="13" y="44">{title}</text>
        </g>;
      })}
    </svg></div>
  </figure>;
}

function IconMark() {
  return <span className="ai-review-mark" aria-hidden="true">✓</span>;
}
