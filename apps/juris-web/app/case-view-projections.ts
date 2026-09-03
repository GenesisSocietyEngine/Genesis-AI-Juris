import { calculateTaxEconomics } from "./tax-economics";
import type { CaseViewId } from "./case-type-registry";
import type { StudioDraft, StudioLink, StudioNode } from "./types";

export type CaseViewItemStatus = "ready" | "attention" | "neutral";

export type CaseViewItem = {
  id: string;
  title: string;
  detail: string;
  kind: string;
  primaryMeta?: string;
  secondaryMeta?: string;
  relatedNodeIds: string[];
  status: CaseViewItemStatus;
};

export type CaseViewProjection = {
  id: CaseViewId;
  items: CaseViewItem[];
  sourceNodeCount: number;
  sourceLinkCount: number;
};

function connectedLinks(draft: StudioDraft, nodeId: string) {
  return draft.links.filter((link) => link.from === nodeId || link.to === nodeId);
}

function relatedNodes(draft: StudioDraft, links: StudioLink[], nodeId: string) {
  const byId = new Map(draft.nodes.map((node) => [node.id, node]));
  return links
    .map((link) => byId.get(link.from === nodeId ? link.to : link.from))
    .filter((node): node is StudioNode => Boolean(node));
}

function euro(value: number) {
  return `EUR ${Math.round(value).toLocaleString("en-US")}`;
}

function issueMap(draft: StudioDraft): CaseViewItem[] {
  return draft.nodes.filter((node) => node.type === "decision").map((node) => {
    const links = connectedLinks(draft, node.id);
    const related = relatedNodes(draft, links, node.id);
    const record = related.filter((item) => item.type === "fact" || item.type === "evidence" || item.type === "tax_rule");
    const outcomes = related.filter((item) => item.type === "outcome");
    return {
      id: node.id,
      title: node.title,
      detail: node.detail,
      kind: "issue",
      primaryMeta: `${record.length} record item${record.length === 1 ? "" : "s"}`,
      secondaryMeta: `${outcomes.length} linked outcome${outcomes.length === 1 ? "" : "s"}`,
      relatedNodeIds: related.map((item) => item.id),
      status: links.length > 0 ? "ready" : "attention",
    };
  });
}

function evidenceMap(draft: StudioDraft): CaseViewItem[] {
  return draft.nodes.filter((node) => node.type === "evidence" || node.type === "fact" || node.type === "tax_rule").map((node) => {
    const links = connectedLinks(draft, node.id);
    const related = relatedNodes(draft, links, node.id);
    return {
      id: node.id,
      title: node.title,
      detail: node.detail,
      kind: node.type,
      primaryMeta: links.length ? `${links.length} connection${links.length === 1 ? "" : "s"}` : "Unlinked",
      secondaryMeta: related.map((item) => item.title).slice(0, 2).join(" · "),
      relatedNodeIds: related.map((item) => item.id),
      status: links.length > 0 ? "ready" : "attention",
    };
  });
}

function decisionTable(draft: StudioDraft): CaseViewItem[] {
  const byId = new Map(draft.nodes.map((node) => [node.id, node]));
  return draft.nodes.filter((node) => node.type === "decision").flatMap((node): CaseViewItem[] => {
    const outgoing = draft.links.filter((link) => link.from === node.id);
    if (!outgoing.length) return [{
      id: node.id,
      title: node.title,
      detail: node.detail,
      kind: "decision",
      primaryMeta: "No option",
      relatedNodeIds: [],
      status: "attention" as const,
    }];
    return outgoing.map((link) => {
      const destination = byId.get(link.to);
      const guard = link.rule?.guards?.[0];
      const cost = link.rule?.cost ?? destination?.runtime?.budgetCostEur;
      const duration = link.rule?.minutes ?? destination?.runtime?.durationMinutes;
      const constraint = guard ? `${guard.metric} ${guard.comparison} ${guard.value}` : "Always available";
      const economics = [cost === undefined ? "" : euro(cost), duration === undefined ? "" : `${duration} min`].filter(Boolean).join(" · ");
      return {
        id: link.id,
        title: link.rule?.label || destination?.title || link.id,
        detail: link.rule?.result || destination?.detail || node.detail,
        kind: node.title,
        primaryMeta: constraint,
        secondaryMeta: economics,
        relatedNodeIds: [node.id, link.to],
        status: destination ? "ready" as const : "attention" as const,
      };
    });
  });
}

function taskPlan(draft: StudioDraft): CaseViewItem[] {
  const taskTypes = new Set(["trigger", "deadline", "decision", "cash_flow"]);
  return draft.nodes.filter((node) => taskTypes.has(node.type)).sort(compareTimelineNodes).map((node, index) => {
    const day = node.type === "deadline" ? node.runtime?.deadlineDay : node.runtime?.day;
    const time = node.type === "deadline" ? node.runtime?.deadlineTime : node.runtime?.time;
    const scheduled = day !== undefined || Boolean(time);
    return {
      id: node.id,
      title: node.title,
      detail: node.detail,
      kind: node.type,
      primaryMeta: scheduled ? `Day ${day ?? "?"}${time ? ` · ${time}` : ""}` : `Sequence ${index + 1}`,
      secondaryMeta: [node.runtime?.budgetCostEur === undefined ? "" : euro(node.runtime.budgetCostEur), node.runtime?.durationMinutes === undefined ? "" : `${node.runtime.durationMinutes} min`].filter(Boolean).join(" · "),
      relatedNodeIds: relatedNodes(draft, connectedLinks(draft, node.id), node.id).map((item) => item.id),
      status: node.type === "deadline" && node.runtime?.deadlineDay === undefined ? "attention" : "neutral",
    };
  });
}

function compareTimelineNodes(left: StudioNode, right: StudioNode) {
  const leftDay = left.type === "deadline" ? left.runtime?.deadlineDay : left.runtime?.day;
  const rightDay = right.type === "deadline" ? right.runtime?.deadlineDay : right.runtime?.day;
  const dayDifference = (leftDay ?? Number.MAX_SAFE_INTEGER) - (rightDay ?? Number.MAX_SAFE_INTEGER);
  if (dayDifference) return dayDifference;
  const leftTime = left.type === "deadline" ? left.runtime?.deadlineTime : left.runtime?.time;
  const rightTime = right.type === "deadline" ? right.runtime?.deadlineTime : right.runtime?.time;
  const timeDifference = (leftTime ?? "99:99").localeCompare(rightTime ?? "99:99");
  if (timeDifference) return timeDifference;
  return left.y - right.y || left.x - right.x || left.id.localeCompare(right.id);
}

function timeline(draft: StudioDraft): CaseViewItem[] {
  return [...draft.nodes].sort(compareTimelineNodes).map((node, index) => {
    const day = node.type === "deadline" ? node.runtime?.deadlineDay : node.runtime?.day;
    const time = node.type === "deadline" ? node.runtime?.deadlineTime : node.runtime?.time;
    return {
      id: node.id,
      title: node.title,
      detail: node.detail,
      kind: node.type,
      primaryMeta: day === undefined && !time ? `Unscheduled · ${index + 1}` : `Day ${day ?? "?"}${time ? ` · ${time}` : ""}`,
      secondaryMeta: node.runtime?.durationMinutes === undefined ? undefined : `${node.runtime.durationMinutes} min`,
      relatedNodeIds: relatedNodes(draft, connectedLinks(draft, node.id), node.id).map((item) => item.id),
      status: day === undefined && !time ? "neutral" : "ready",
    };
  });
}

function economics(draft: StudioDraft): CaseViewItem[] {
  const items: CaseViewItem[] = [];
  if (draft.taxEconomics) {
    const result = calculateTaxEconomics(draft.taxEconomics);
    items.push({
      id: "tax-economics",
      title: "Tax position economics",
      detail: draft.taxEconomics.assumptions,
      kind: "tax",
      primaryMeta: `NPV ${euro(result.npv)}`,
      secondaryMeta: result.paybackMonths === null ? "No positive payback" : `Payback ${result.paybackMonths.toFixed(1)} months`,
      relatedNodeIds: draft.nodes.filter((node) => node.type === "tax_rule" || node.type === "cash_flow").map((node) => node.id),
      status: result.netAnnualBenefit >= 0 ? "ready" : "attention",
    });
  }
  return [...items, ...draft.nodes.filter((node) => node.type === "cash_flow").map((node) => ({
    id: node.id,
    title: node.title,
    detail: node.detail,
    kind: "cash flow",
    primaryMeta: node.runtime?.budgetCostEur === undefined ? "Open model" : euro(node.runtime.budgetCostEur),
    secondaryMeta: node.runtime?.durationMinutes === undefined ? undefined : `${node.runtime.durationMinutes} min`,
    relatedNodeIds: relatedNodes(draft, connectedLinks(draft, node.id), node.id).map((item) => item.id),
    status: "neutral" as const,
  }))];
}

function simulation(draft: StudioDraft): CaseViewItem[] {
  const decisions = draft.nodes.filter((node) => node.type === "decision");
  const outcomes = draft.nodes.filter((node) => node.type === "outcome");
  return [...decisions, ...outcomes].map((node) => ({
    id: node.id,
    title: node.title,
    detail: node.detail,
    kind: node.type,
    primaryMeta: node.type === "decision"
      ? `${draft.links.filter((link) => link.from === node.id).length} route option${draft.links.filter((link) => link.from === node.id).length === 1 ? "" : "s"}`
      : node.runtime?.terminalOutcome ?? "Outcome",
    secondaryMeta: node.type === "decision" ? "Rust-tested at Step 5" : undefined,
    relatedNodeIds: relatedNodes(draft, connectedLinks(draft, node.id), node.id).map((item) => item.id),
    status: connectedLinks(draft, node.id).length ? "ready" as const : "attention" as const,
  }));
}

export function projectCaseView(draft: StudioDraft, id: CaseViewId): CaseViewProjection {
  const items = id === "issue_map" ? issueMap(draft)
    : id === "evidence_map" ? evidenceMap(draft)
      : id === "decision_table" ? decisionTable(draft)
        : id === "task_plan" ? taskPlan(draft)
          : id === "timeline" ? timeline(draft)
            : id === "economics" ? economics(draft)
              : simulation(draft);
  return { id, items, sourceNodeCount: draft.nodes.length, sourceLinkCount: draft.links.length };
}
