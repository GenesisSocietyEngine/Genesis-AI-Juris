import { caseFingerprint } from "./case-integrity";
import { stageClockMinute } from "./game-engine";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import type { LocalText, MetricKey, Scenario, StudioDraft, StudioNode, StudioNodeType } from "./types";

export type StudioCompileIssue = {
  code: "missing_start" | "missing_outcome" | "dead_end" | "cycle" | "unreachable" | "invalid_metadata";
  message: string;
  nodeIds: string[];
};

export type StudioCompileResult = {
  scenario: Scenario | null;
  issues: StudioCompileIssue[];
  warnings: string[];
};

const typeLabels: Record<StudioNodeType, LocalText> = {
  trigger: { en: "Trigger", ru: "Триггер" }, actor: { en: "Actor", ru: "Участник" }, fact: { en: "Fact", ru: "Факт" },
  evidence: { en: "Evidence", ru: "Доказательство" }, deadline: { en: "Deadline", ru: "Срок" }, decision: { en: "Decision", ru: "Решение" },
  outcome: { en: "Outcome", ru: "Исход" }, entity: { en: "Entity", ru: "Организация" }, tax_rule: { en: "Tax rule", ru: "Налоговое правило" },
  cash_flow: { en: "Cash flow", ru: "Денежный поток" },
};

export function compileStudioDraft(draft: StudioDraft): StudioCompileResult {
  const issues: StudioCompileIssue[] = [];
  const warnings: string[] = [];
  const nodes = new Map(draft.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const link of draft.links) {
    if (!nodes.has(link.from) || !nodes.has(link.to)) continue;
    outgoing.set(link.from, [...(outgoing.get(link.from) ?? []), link.to]);
    incoming.set(link.to, [...(incoming.get(link.to) ?? []), link.from]);
  }

  const outcomes = draft.nodes.filter((node) => node.type === "outcome");
  if (!outcomes.length) issues.push({ code: "missing_outcome", message: "Add at least one outcome node before compiling.", nodeIds: [] });
  const globalIndegree = new Map(draft.nodes.map((node) => [node.id, 0]));
  for (const link of draft.links) if (globalIndegree.has(link.to) && globalIndegree.has(link.from)) globalIndegree.set(link.to, (globalIndegree.get(link.to) ?? 0) + 1);
  const globalQueue = draft.nodes.filter((node) => globalIndegree.get(node.id) === 0).map((node) => node.id);
  const globallyOrdered = new Set<string>();
  while (globalQueue.length) {
    const id = globalQueue.shift()!;
    globallyOrdered.add(id);
    for (const target of outgoing.get(id) ?? []) {
      globalIndegree.set(target, (globalIndegree.get(target) ?? 0) - 1);
      if (globalIndegree.get(target) === 0) globalQueue.push(target);
    }
  }
  const globalCycle = draft.nodes.filter((node) => !globallyOrdered.has(node.id)).map((node) => node.id);
  if (globalCycle.length) issues.push({ code: "cycle", message: "Playable compilation currently requires an acyclic case graph.", nodeIds: globalCycle });
  const triggerRoots = draft.nodes.filter((node) => node.type === "trigger" && !(incoming.get(node.id)?.length));
  const fallbackRoots = draft.nodes.filter((node) => !(incoming.get(node.id)?.length) && node.type !== "outcome");
  const roots = triggerRoots.length ? triggerRoots : fallbackRoots;
  if (!roots.length) issues.push({ code: "missing_start", message: "The graph needs a trigger or another node without incoming relations.", nodeIds: [] });

  const reachable = new Set<string>();
  const pending = roots.map((node) => node.id);
  while (pending.length) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const target of outgoing.get(id) ?? []) pending.push(target);
  }
  const unreachable = draft.nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id);
  if (unreachable.length) issues.push({ code: "unreachable", message: "Every node must be reachable from the compiled start.", nodeIds: unreachable });

  const canReachOutcome = new Set(outcomes.map((node) => node.id));
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const node of draft.nodes) if (!canReachOutcome.has(node.id) && (outgoing.get(node.id) ?? []).some((id) => canReachOutcome.has(id))) {
      canReachOutcome.add(node.id);
      expanded = true;
    }
  }
  const deadEnds = draft.nodes.filter((node) => reachable.has(node.id) && node.type !== "outcome" && !canReachOutcome.has(node.id)).map((node) => node.id);
  if (deadEnds.length) issues.push({ code: "dead_end", message: "Every playable branch must end at an outcome.", nodeIds: deadEnds });

  const relevant = draft.nodes.filter((node) => reachable.has(node.id));
  const indegree = new Map(relevant.map((node) => [node.id, 0]));
  for (const node of relevant) for (const target of outgoing.get(node.id) ?? []) if (indegree.has(target)) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  const queue = relevant.filter((node) => indegree.get(node.id) === 0).sort(positionOrder);
  const ordered: StudioNode[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    ordered.push(node);
    for (const targetId of outgoing.get(node.id) ?? []) {
      if (!indegree.has(targetId)) continue;
      indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
      if (indegree.get(targetId) === 0) {
        queue.push(nodes.get(targetId)!);
        queue.sort(positionOrder);
      }
    }
  }
  const cyclic = relevant.filter((node) => !ordered.some((item) => item.id === node.id)).map((node) => node.id);
  if (cyclic.length && !issues.some((issue) => issue.code === "cycle")) issues.push({ code: "cycle", message: "Playable compilation currently requires an acyclic case graph.", nodeIds: cyclic });
  if (issues.length) return { scenario: null, issues, warnings };

  const materialNodes = ordered.filter((node) => node.type === "evidence" || node.type === "fact" || node.type === "tax_rule");
  const materials = materialNodes.length ? materialNodes.map((node) => ({
    ref: `material-${node.id}`,
    type: typeLabels[node.type],
    title: localNodeText(node.title),
    source: { en: "Case Studio graph", ru: "Граф Case Studio" },
    date: draft.classification?.legalAsOf || "Authoring workspace",
  })) : [{
    ref: "material-case-brief",
    type: { en: "Case brief", ru: "Описание кейса" },
    title: localNodeText(draft.title),
    source: { en: "Case Studio premise", ru: "Фабула Case Studio" },
    date: draft.classification?.legalAsOf || "Authoring workspace",
  }];
  const materialRefs = new Set(materials.map((item) => item.ref));
  const defaultMaterial = materials[0].ref;
  const stageId = (nodeId: string) => `studio-${nodeId}`;
  const optionId = (linkId: string) => `action-${linkId}`;
  const outcomeIndex = new Map(outcomes.map((node, index) => [node.id, index]));

  const stages: Scenario["stages"] = ordered.map((node, index) => {
    const links = draft.links.filter((link) => link.from === node.id && reachable.has(link.to));
    const options = node.type === "outcome" ? [] : links.map((link) => {
      const target = nodes.get(link.to)!;
      const rule = link.rule;
      return {
        id: optionId(link.id),
        label: localNodeText(rule?.label || target.title),
        detail: localNodeText(rule?.detail || target.detail || `Advance from ${node.title} to ${target.title}.`),
        result: localNodeText(rule?.result || target.detail || `${target.title} is now the active part of the matter.`),
        cost: rule?.cost ?? (target.type === "evidence" || target.type === "tax_rule" ? 1_500 : 0),
        minutes: rule?.minutes ?? (target.type === "deadline" ? 30 : 20),
        effects: rule?.effects ?? effectsForTarget(target, outcomeIndex.get(target.id) ?? 0, outcomes.length),
        nextStageId: stageId(target.id),
        repeatability: rule?.repeatability ?? "once" as const,
        maxUses: rule?.repeatability === "limited" ? rule.maxUses : undefined,
        guards: rule?.guards,
      };
    });
    const ownMaterial = `material-${node.id}`;
    return {
      id: stageId(node.id),
      day: node.runtime?.day ?? index + 1,
      time: node.runtime?.time ?? "09:00",
      phase: typeLabels[node.type],
      headline: localNodeText(node.title),
      brief: localNodeText(node.detail || draft.premise),
      source: { en: `Compiled from ${typeLabels[node.type].en.toLowerCase()} node`, ru: `Собрано из узла «${typeLabels[node.type].ru.toLowerCase()}»` },
      pressure: node.runtime?.pressure ? localNodeText(node.runtime.pressure) : node.type === "deadline" ? { en: "A procedural clock is active.", ru: "Идёт процессуальный срок." } : undefined,
      materialRefs: materialRefs.has(ownMaterial) ? [ownMaterial] : [defaultMaterial],
      options,
      terminal: node.type === "outcome",
      terminalOutcome: node.type === "outcome" ? node.runtime?.terminalOutcome ?? outcomeClass(outcomeIndex.get(node.id) ?? 0, outcomes.length) : undefined,
    };
  });

  if (roots.length > 1) {
    warnings.push("Multiple graph roots were compiled into an explicit opening choice.");
    stages.unshift({
      id: "studio-root",
      day: 1,
      time: "08:30",
      phase: { en: "Opening", ru: "Начало" },
      headline: localNodeText(draft.title),
      brief: localNodeText(draft.premise),
      source: { en: "Case Studio compiler", ru: "Компилятор Case Studio" },
      pressure: undefined,
      materialRefs: [defaultMaterial],
      options: roots.map((node, index) => ({
        id: `action-root-${index + 1}`,
        label: localNodeText(node.title),
        detail: localNodeText(node.detail || "Open this branch of the matter."),
        result: localNodeText(`The matter opens at ${node.title}.`),
        cost: 0,
        minutes: 10,
        effects: { position: 1 },
        nextStageId: stageId(node.id),
        repeatability: "once" as const,
      })),
      terminal: false,
    });
  }

  const deadlineNodes = ordered.filter((node) => node.type === "deadline");
  const weakestOutcome = outcomes.at(-1);
  const deadlines = deadlineNodes.map((node) => {
    const stage = stages.find((item) => item.id === stageId(node.id))!;
    const completionActions = stage.options.map((option) => option.id);
    const deadlineDay = node.runtime?.deadlineDay ?? stage.day;
    const deadlineTime = node.runtime?.deadlineTime ?? "12:00";
    const [deadlineHour, deadlineMinute] = deadlineTime.split(":").map(Number);
    const explicitFallback = node.runtime?.missedOutcomeNodeId ? nodes.get(node.runtime.missedOutcomeNodeId) : undefined;
    return {
      id: `deadline-${node.id}`,
      title: localNodeText(node.title),
      dueAtMinute: (deadlineDay - 1) * 1_440 + deadlineHour * 60 + deadlineMinute,
      completionActions,
      missedNextStageId: explicitFallback?.type === "outcome" ? stageId(explicitFallback.id) : weakestOutcome && weakestOutcome.id !== node.id ? stageId(weakestOutcome.id) : undefined,
    };
  });

  const firstOutcome = outcomes[0];
  const middleOutcome = outcomes[Math.floor((outcomes.length - 1) / 2)] ?? firstOutcome;
  const lastOutcome = outcomes.at(-1) ?? firstOutcome;
  const initialStageId = roots.length > 1 ? "studio-root" : stageId(roots[0].id);
  const initialClockMinute = stageClockMinute(stages.find((stage) => stage.id === initialStageId)!);
  const base: Scenario = {
    id: `${draft.caseId}.studio.${draft.version.replaceAll(".", "-")}`,
    caseId: draft.caseId,
    order: 99_999,
    title: localNodeText(draft.title),
    subtitle: { en: "Compiled live from your Case Studio graph", ru: "Собрано из вашего графа Case Studio" },
    jurisdiction: draft.jurisdiction,
    role: localNodeText(draft.role),
    version: draft.version,
    sector: localNodeText(draft.classification?.practiceArea || "General legal"),
    urgency: deadlineNodes.length ? "elevated" : "standard",
    fingerprint: "",
    sourceFingerprint: caseFingerprint(draft),
    accent: "#d2a85e",
    actors: ordered.filter((node) => node.type === "actor" || node.type === "entity").map((node) => localNodeText(node.title)),
    materials,
    stages,
    opening: localNodeText(draft.premise),
    initialStageId,
    initialClockMinute,
    deadlines,
    workflowInbox: [],
    outcomes: {
      strong: localNodeText(firstOutcome.detail || firstOutcome.title),
      mixed: localNodeText(middleOutcome.detail || middleOutcome.title),
      weak: localNodeText(lastOutcome.detail || lastOutcome.title),
    },
  };
  try {
    const normalized = normalizePlayableScenario(base);
    const scenario = { ...normalized, fingerprint: playableFingerprint(normalized) };
    return { scenario, issues: [], warnings };
  } catch (error) {
    return { scenario: null, issues: [{ code: "invalid_metadata", message: error instanceof Error ? error.message : "The compiled scenario failed validation.", nodeIds: [] }], warnings };
  }
}

function positionOrder(left: StudioNode, right: StudioNode) {
  return left.x - right.x || left.y - right.y || left.id.localeCompare(right.id);
}

function localNodeText(value: string): LocalText {
  const clean = value.trim() || "Untitled step";
  return { en: clean, ru: clean };
}

function effectsForTarget(target: StudioNode, outcomePosition: number, outcomeCount: number): Partial<Record<MetricKey, number>> {
  if (target.type === "evidence") return { evidence: 10, trust: 3 };
  if (target.type === "deadline") return { position: 4, exposure: -5 };
  if (target.type === "tax_rule") return { evidence: 6, exposure: -4 };
  if (target.type === "fact") return { evidence: 5 };
  if (target.type === "actor" || target.type === "entity") return { trust: 4 };
  if (target.type === "outcome") {
    if (outcomeCount <= 1 || outcomePosition === 0) return { position: 12, evidence: 5, trust: 6, exposure: -8 };
    if (outcomePosition === outcomeCount - 1) return { position: -10, trust: -7, exposure: 12 };
    return { position: 2, evidence: 2, exposure: 1 };
  }
  if (target.type === "cash_flow") return { evidence: 3, exposure: 2 };
  return { position: 3 };
}

function outcomeClass(position: number, count: number): "strong" | "mixed" | "weak" {
  if (count <= 1 || position === 0) return "strong";
  return position === count - 1 ? "weak" : "mixed";
}
