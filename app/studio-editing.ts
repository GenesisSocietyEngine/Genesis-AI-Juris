import type { StudioDraft, StudioEditAction, StudioEditEntry, StudioEditSource, StudioLink, StudioNode, StudioNodeType } from "./types";

export const STUDIO_HISTORY_LIMIT = 120;

export type StudioHistoryInput = {
  role: StudioEditEntry["role"];
  source: StudioEditSource;
  action: StudioEditAction;
  message: string;
};

export type StudioGraphEditResult = {
  draft: StudioDraft;
  changed: boolean;
  issue?: "missing_endpoint" | "self_link" | "duplicate_link" | "invalid_link_id" | "link_limit" | "missing_link" | "unchanged";
};

export type StudioPromptOperation =
  | { kind: "add_node"; node: StudioNode }
  | { kind: "update_node"; nodeId: string; change: Partial<Pick<StudioNode, "title" | "detail" | "type">> & { runtime?: StudioNode["runtime"] | null } }
  | { kind: "delete_node"; nodeId: string }
  | { kind: "add_link"; link: StudioLink }
  | { kind: "update_link"; linkId: string; change: NonNullable<StudioLink["rule"]> }
  | { kind: "relink_link"; linkId: string; from: string; to: string }
  | { kind: "delete_link"; linkId: string }
  | { kind: "append_context"; value: string }
  | { kind: "set_case_field"; field: "caseId" | "title" | "jurisdiction" | "role"; value: string }
  | { kind: "set_classification"; change: Partial<NonNullable<StudioDraft["classification"]>> }
  | { kind: "set_deal_economics"; economics: NonNullable<StudioDraft["dealEconomics"]> };

export type StudioPromptDiagnostic = {
  level: "info" | "error";
  message: string;
};

export type StudioPromptPlan = {
  instruction: string;
  operations: StudioPromptOperation[];
  diagnostics: StudioPromptDiagnostic[];
  canApply: boolean;
  contextOnly: boolean;
  planner?: "deterministic" | "ai";
  summary?: string;
  assumptions?: string[];
  warnings?: string[];
  aiProvenance?: { model: string | null; requestId: string | null; baseFingerprint: string; planFingerprint: string };
};

export function toPublicStudioDraft(draft: StudioDraft): Omit<StudioDraft, "editHistory"> {
  const publicDraft: Partial<StudioDraft> = { ...draft };
  delete publicDraft.editHistory;
  return publicDraft as Omit<StudioDraft, "editHistory">;
}

export function nextStudioNodeId(nodes: StudioNode[], type: StudioNodeType) {
  let sequence = 1;
  while (nodes.some((node) => node.id === `${type}-${sequence}`)) sequence += 1;
  return `${type}-${sequence}`;
}

export function nextStudioLinkId(links: StudioLink[]) {
  let sequence = 1;
  while (links.some((link) => link.id === `link-${sequence}`)) sequence += 1;
  return `link-${sequence}`;
}

export function nextStudioNodePosition(nodes: StudioNode[], anchor?: StudioNode | null) {
  const candidates = anchor
    ? Array.from({ length: 18 }, (_, index) => ({ x: Math.min(1_005, Math.max(20, anchor.x + 205 + (index % 3) * 22)), y: Math.min(470, Math.max(20, anchor.y + (Math.floor(index / 3) - 2) * 90)) }))
    : Array.from({ length: 30 }, (_, index) => ({ x: 55 + (index % 5) * 210, y: 55 + (Math.floor(index / 5) % 3) * 170 }));
  return candidates.find((candidate) => nodes.every((node) => Math.abs(node.x - candidate.x) > 150 || Math.abs(node.y - candidate.y) > 68))
    ?? { x: 430 + (nodes.length % 4) * 25, y: 210 + (nodes.length % 5) * 45 };
}

export function planStudioPromptIteration(draft: StudioDraft, options: {
  instruction: string;
  locale: "en" | "ru";
  nodeLabels: Record<StudioNodeType, string>;
  selectedNodeId?: string | null;
}): StudioPromptPlan {
  const clean = options.instruction.trim();
  if (!clean) return { instruction: "", operations: [], diagnostics: [], canApply: false, contextOnly: false, planner: "deterministic" };
  const nodeMatchers: Array<[StudioNodeType, RegExp]> = [
    ["trigger", /trigger|incident|триггер|событи/i], ["actor", /actor|party|stakeholder|актор|сторон|участник/i],
    ["fact", /fact|факт/i], ["evidence", /evidence|document|proof|доказательств|документ/i],
    ["deadline", /deadline|time limit|срок|дедлайн/i], ["decision", /decision|choice|решени|выбор/i],
    ["outcome", /outcome|consequence|исход|последств/i], ["entity", /entity|company|jurisdiction|компани|юрисдикци/i],
    ["tax_rule", /tax rule|treaty|cfc|withholding|налогов.*прав|соглашени/i], ["cash_flow", /cash flow|payment flow|денежн.*поток|плат[её]ж/i],
  ];
  const operations: StudioPromptOperation[] = [];
  const diagnostics: StudioPromptDiagnostic[] = [];
  let working = structuredClone(draft);
  const error = (message: string) => diagnostics.push({ level: "error", message });
  const info = (message: string) => diagnostics.push({ level: "info", message });
  const resolveNode = (raw: string) => {
    const reference = raw.trim().replace(/^["“]|["”]$/g, "").trim();
    const byId = working.nodes.find((node) => node.id.toLowerCase() === reference.toLowerCase());
    if (byId) return byId;
    const byTitle = working.nodes.filter((node) => node.title.trim().toLowerCase() === reference.toLowerCase());
    if (byTitle.length === 1) return byTitle[0];
    error(byTitle.length > 1 ? `Ambiguous node title: ${reference}` : `Node not found: ${reference}`);
    return null;
  };
  const push = (operation: StudioPromptOperation) => { operations.push(operation); working = executePromptOperation(working, operation); };

  const positiveAddition = /(?:add|create|include|introduce|insert|добав(?:ь|ьте|ить)?|созда(?:й|йте|ть)?|включ(?:и|ите|ить)?|встав(?:ь|ьте|ить)?)\s+([^.;\n]*?)(?=(?:\bconnect\b|\blink\b|\brename\b|\bdelete\b|свяж|переимен|удал)|[.;\n]|$)/gi;
  for (const match of clean.matchAll(positiveAddition)) {
    const clause = match[0];
    const prefix = clean.slice(Math.max(0, (match.index ?? 0) - 16), match.index ?? 0);
    if (/\b(?:do\s+not|don't|never)\s*$/i.test(prefix) || /\bне\s*$/i.test(prefix) || /\b(?:do\s+not|don't|never)\b|\bне\s+(?:добав|созда|включ|встав)/i.test(clause)) continue;
    const body = match[1];
    const requestedTypes = nodeMatchers.filter(([, matcher]) => matcher.test(body)).map(([type]) => type);
    if (!requestedTypes.length) { info(`No supported node type was recognised in “${body.trim()}”.`); continue; }
    const countMatch = body.match(/\b([1-5])\b/);
    const count = countMatch ? Number(countMatch[1]) : 1;
    const named = (body.match(/(?:called|named|titled|с\s+названием|под\s+названием)\s+["“]([^"”]+)["”]/i)?.[1] ?? body.match(/["“]([^"”]+)["”]/)?.[1])?.trim();
    const detail = (body.match(/["”]\s*:\s*(.+)$/)?.[1] ?? body.match(/:\s*(.+)$/)?.[1] ?? "").trim().slice(0, 4_000);
    for (const type of requestedTypes) for (let index = 0; index < count; index += 1) {
      if (working.nodes.length >= 200) { error("The 200-node draft limit would be exceeded."); break; }
      const id = nextStudioNodeId(working.nodes, type);
      const anchor = working.nodes.find((node) => node.id === options.selectedNodeId) ?? working.nodes.at(-1) ?? null;
      const position = nextStudioNodePosition(working.nodes, anchor);
      const title = named ? (count > 1 ? `${named} ${index + 1}` : named) : options.nodeLabels[type];
      push({ kind: "add_node", node: { id, type, title, detail, ...position } });
    }
  }

  const renamePattern = /(?:rename|переимен(?:уй|уйте|овать))\s+(.+?)\s+(?:to|as|в)\s+["“]([^"”]+)["”](?=[.;\n]|$)/gi;
  for (const match of clean.matchAll(renamePattern)) {
    const node = resolveNode(match[1]);
    if (node) push({ kind: "update_node", nodeId: node.id, change: { title: match[2].trim().slice(0, 200) } });
  }

  const selectedDetail = clean.match(/(?:set|update|установ(?:и|ите)|обнов(?:и|ите))\s+(?:the\s+)?selected\s+(?:node\s+)?(?:detail|description)|(?:измени|измените)\s+описание\s+выбранного\s+узла/i);
  const selectedValue = clean.match(/(?:detail|description|описание)[^"“]*["“]([^"”]+)["”]/i)?.[1];
  if (selectedDetail && selectedValue) {
    const selected = working.nodes.find((node) => node.id === options.selectedNodeId);
    if (selected) push({ kind: "update_node", nodeId: selected.id, change: { detail: selectedValue.trim().slice(0, 4_000) } });
    else error("Select a node before updating its description.");
  }

  const caseFieldPattern = /(?:set|change|update|установ(?:и|ите)|измен(?:и|ите))\s+(?:case\s+)?(title|jurisdiction|role|название|юрисдикци[юя]|роль)\s+(?:to|as|на|в)?\s*["“]([^"”]+)["”]/gi;
  for (const match of clean.matchAll(caseFieldPattern)) {
    const key = match[1].toLowerCase();
    const field = key.startsWith("jur") || key.startsWith("юрис") ? "jurisdiction" : key === "role" || key === "роль" ? "role" : "title";
    push({ kind: "set_case_field", field, value: match[2].trim().slice(0, field === "title" ? 200 : 160) });
  }

  const contextPattern = /(?:add|append|добав(?:ь|ьте))\s+(?:this\s+)?(?:to\s+)?(?:the\s+)?(?:case\s+)?context\s*:?\s*["“]([^"”]+)["”]|(?:добав(?:ь|ьте))\s+в\s+контекст\s+кейса\s*:?\s*["“]([^"”]+)["”]/gi;
  for (const match of clean.matchAll(contextPattern)) push({ kind: "append_context", value: (match[1] ?? match[2]).trim().slice(0, 4_000) });

  const relinkPattern = /(?:relink|перепривяж(?:и|ите))\s+(link-[a-z0-9_-]+)\s+(?:from\s+|на\s+)?(.+?)\s+(?:to|->|→|с)\s+(.+?)(?=[.;\n]|$)/gi;
  for (const match of clean.matchAll(relinkPattern)) {
    const link = working.links.find((item) => item.id.toLowerCase() === match[1].toLowerCase());
    if (!link) { error(`Relation not found: ${match[1]}`); continue; }
    const from = resolveNode(match[2]);
    const to = resolveNode(match[3]);
    if (!from || !to) continue;
    if (from.id === to.id || working.links.some((item) => item.id !== link.id && item.from === from.id && item.to === to.id)) { error(`Invalid relation target: ${from.id} → ${to.id}`); continue; }
    push({ kind: "relink_link", linkId: link.id, from: from.id, to: to.id });
  }

  const connectionPattern = /(?:\bconnect\b|\blink\b|свяж(?:и|ите))\s+(.+?)\s+(?:to|with|->|→|с)\s+(.+?)(?=[.;\n]|$)/gi;
  for (const match of clean.matchAll(connectionPattern)) {
    const from = resolveNode(match[1]);
    const to = resolveNode(match[2]);
    if (!from || !to) continue;
    if (working.links.length >= 500) { error("The 500-relation draft limit would be exceeded."); continue; }
    if (from.id === to.id || working.links.some((link) => link.from === from.id && link.to === to.id)) { error(`Invalid or duplicate relation: ${from.id} → ${to.id}`); continue; }
    push({ kind: "add_link", link: { id: nextStudioLinkId(working.links), from: from.id, to: to.id } });
  }

  const deleteLinkPattern = /(?:delete|remove|удал(?:и|ите))\s+(?:relation|link|связь)\s+(link-[a-z0-9_-]+)/gi;
  for (const match of clean.matchAll(deleteLinkPattern)) {
    const link = working.links.find((item) => item.id.toLowerCase() === match[1].toLowerCase());
    if (link) push({ kind: "delete_link", linkId: link.id }); else error(`Relation not found: ${match[1]}`);
  }

  const deleteNodePattern = /(?:delete|remove|удал(?:и|ите))\s+(?:node|узел)\s+(.+?)(?=[.;\n]|$)/gi;
  for (const match of clean.matchAll(deleteNodePattern)) {
    const node = resolveNode(match[1]);
    if (node) push({ kind: "delete_node", nodeId: node.id });
  }

  const hasError = diagnostics.some((item) => item.level === "error");
  if (!operations.length && !hasError) info(options.locale === "en" ? "No graph command recognised; this turn will extend the case context only." : "Команды для графа не распознаны; реплика только дополнит контекст кейса.");
  return { instruction: clean, operations, diagnostics, canApply: !hasError, contextOnly: operations.length === 0, planner: "deterministic" };
}

export function describeStudioPromptOperation(operation: StudioPromptOperation, locale: "en" | "ru", nodeTitles?: ReadonlyMap<string, string>, options: { showIds?: boolean; linkEndpoints?: ReadonlyMap<string, { from: string; to: string }> } = {}) {
  const en = locale === "en";
  const simple = options.showIds === false;
  const nodeTypeName = (type: StudioNodeType) => simple ? ({
    trigger: en ? "starting event" : "начальное событие",
    actor: en ? "participant" : "участник",
    fact: en ? "fact" : "факт",
    evidence: en ? "evidence" : "доказательство",
    deadline: en ? "deadline" : "срок",
    decision: en ? "decision" : "решение",
    outcome: en ? "outcome" : "исход",
    entity: en ? "organisation" : "организация",
    tax_rule: en ? "tax rule" : "налоговое правило",
    cash_flow: en ? "cash flow" : "денежный поток",
  } satisfies Record<StudioNodeType, string>)[type] : type;
  const metricName = (metric: string) => simple ? ({
    position: en ? "legal position" : "правовая позиция",
    evidence: en ? "evidence strength" : "сила доказательств",
    trust: en ? "trust" : "доверие",
    exposure: en ? "risk exposure" : "уровень риска",
  } as Record<string, string>)[metric] ?? metric : metric;
  const comparisonName = (comparison: string) => simple ? ({ gte: "≥", lte: "≤", eq: "=" } as Record<string, string>)[comparison] ?? comparison : comparison;
  const repeatabilityName = (value: string) => simple ? ({
    once: en ? "available once" : "доступно один раз",
    repeatable: en ? "may be repeated" : "можно повторять",
    limited: en ? "limited repetitions" : "ограниченное число повторов",
  } as Record<string, string>)[value] ?? value : value;
  const classificationName = (key: string) => simple ? ({
    domain: en ? "case domain" : "домен кейса",
    practiceArea: en ? "practice area" : "область практики",
    difficulty: en ? "difficulty" : "сложность",
    tags: en ? "tags" : "теги",
    taxTopics: en ? "tax topics" : "налоговые темы",
    purpose: en ? "tax purpose" : "цель налогового кейса",
    complianceOnly: en ? "compliance-only scope" : "только законное применение",
    legalAsOf: en ? "law current as of" : "актуальность права",
    sourceUrls: en ? "legal sources" : "источники права",
  } as Record<string, string>)[key] ?? key : key;
  const nodeName = (id: string) => nodeTitles?.get(id)
    ? options.showIds === false ? `“${nodeTitles.get(id)}”` : `“${nodeTitles.get(id)}” (${id})`
    : options.showIds === false ? (en ? "the selected node" : "выбранный узел") : id;
  const compact = (value: string | undefined) => {
    const clean = value?.replace(/\s+/g, " ").trim() ?? "";
    // Review text is intentionally complete. AI can author thousands of
    // characters in a field, and hiding the tail would let unreviewed legal or
    // tax claims pass behind an innocent-looking preview.
    return clean ? `“${clean}”` : "";
  };
  const runtimeSummary = (runtime: StudioNode["runtime"] | null | undefined) => runtime ? [
    runtime.budgetCostEur !== undefined ? `€${runtime.budgetCostEur.toLocaleString("en")}` : "",
    runtime.durationMinutes !== undefined ? `${runtime.durationMinutes} min` : "",
    runtime.day !== undefined ? `${en ? "day" : "день"} ${runtime.day}` : "",
    runtime.time ?? "",
    runtime.pressure ? `${en ? "pressure" : "давление"}: ${compact(runtime.pressure)}` : "",
    runtime.terminalOutcome ? `${en ? "outcome" : "исход"}: ${simple ? ({ strong: en ? "strong" : "сильный", mixed: en ? "mixed" : "смешанный", weak: en ? "weak" : "слабый" } as Record<string, string>)[runtime.terminalOutcome] : runtime.terminalOutcome}` : "",
    runtime.deadlineDay !== undefined && runtime.deadlineTime
      ? `${en ? "deadline" : "срок"}: ${en ? "day" : "день"} ${runtime.deadlineDay}, ${runtime.deadlineTime}`
      : "",
    runtime.missedOutcomeNodeId ? `${en ? "missed outcome" : "исход при пропуске"}: ${nodeName(runtime.missedOutcomeNodeId)}` : "",
  ].filter(Boolean).join(", ") : "";
  const ruleSummary = (rule: StudioLink["rule"] | undefined) => rule ? [
    rule.label ? `${en ? "action" : "действие"}: ${compact(rule.label)}` : "",
    rule.detail ? `${en ? "detail" : "описание"}: ${compact(rule.detail)}` : "",
    rule.result ? `${en ? "consequence" : "последствие"}: ${compact(rule.result)}` : "",
    rule.cost !== undefined ? `€${rule.cost.toLocaleString("en")}` : "",
    rule.minutes !== undefined ? `${rule.minutes} min` : "",
    rule.effects && Object.keys(rule.effects).length
      ? `${en ? "effects" : "эффекты"}: ${Object.entries(rule.effects).map(([metric, value]) => `${metricName(metric)} ${Number(value) >= 0 ? "+" : ""}${value}`).join(", ")}`
      : "",
    rule.guards?.length
      ? `${en ? "conditions" : "условия"}: ${rule.guards.map((guard) => `${metricName(guard.metric)} ${comparisonName(guard.comparison)} ${guard.value}`).join(", ")}`
      : "",
    rule.repeatability ? `${en ? "repeatability" : "повторяемость"}: ${repeatabilityName(rule.repeatability)}${rule.maxUses !== undefined ? ` (${en ? "max" : "макс."} ${rule.maxUses})` : ""}` : "",
  ].filter(Boolean).join("; ") : "";
  if (operation.kind === "add_node") {
    const detail = compact(operation.node.detail);
    const runtime = runtimeSummary(operation.node.runtime);
    const suffix = [detail, runtime].filter(Boolean).join("; ");
    return `${en ? "Add" : "Добавить"} ${nodeTypeName(operation.node.type)}: “${operation.node.title}”${suffix ? ` — ${suffix}` : ""}`;
  }
  if (operation.kind === "update_node") {
    const changes = [
      operation.change.title ? `${en ? "title" : "название"}: “${operation.change.title}”` : "",
      operation.change.type ? `${en ? "type" : "тип"}: ${nodeTypeName(operation.change.type)}` : "",
      operation.change.detail !== undefined ? `${en ? "detail" : "описание"}: ${compact(operation.change.detail) || (en ? "clear" : "очистить")}` : "",
      Object.hasOwn(operation.change, "runtime") ? `${en ? "runtime" : "параметры"}: ${runtimeSummary(operation.change.runtime) || (en ? "clear" : "очистить")}` : "",
    ].filter(Boolean).join("; ");
    return `${en ? "Update" : "Изменить"} ${nodeName(operation.nodeId)}${changes ? ` — ${changes}` : ""}`;
  }
  if (operation.kind === "delete_node") return simple ? (en ? `Delete the selected node and its connections` : `Удалить выбранный узел и его связи`) : (en ? `Delete ${operation.nodeId} and its relations` : `Удалить ${operation.nodeId} и его связи`);
  if (operation.kind === "add_link") {
    const rule = ruleSummary(operation.link.rule);
    return `${en ? "Connect" : "Связать"} ${nodeName(operation.link.from)} → ${nodeName(operation.link.to)}${rule ? ` — ${rule}` : ""}`;
  }
  if (operation.kind === "update_link") {
    const rule = ruleSummary(operation.change);
    const endpoints = options.linkEndpoints?.get(operation.linkId);
    const relation = endpoints
      ? `${nodeName(endpoints.from)} → ${nodeName(endpoints.to)}${simple ? "" : ` [${operation.linkId}]`}`
      : simple ? (en ? "the selected relationship" : "выбранную связь") : operation.linkId;
    return `${en ? "Update relation" : "Изменить связь"} ${relation}${rule ? ` — ${rule}` : ""}`;
  }
  if (operation.kind === "relink_link") return simple ? (en ? "Reconnect the selected relationship" : "Перепривязать выбранную связь") : (en ? `Relink ${operation.linkId}: ${operation.from} → ${operation.to}` : `Перепривязать ${operation.linkId}: ${operation.from} → ${operation.to}`);
  if (operation.kind === "delete_link") return simple ? (en ? "Delete the selected relationship" : "Удалить выбранную связь") : (en ? `Delete ${operation.linkId}` : `Удалить ${operation.linkId}`);
  if (operation.kind === "append_context") return `${en ? "Add to case context" : "Дополнить контекст кейса"}: ${compact(operation.value)}`;
  if (operation.kind === "set_deal_economics") {
    const model = operation.economics;
    const values = [
      model.purchasePrice !== null ? `${en ? "purchase" : "покупка"} ${model.currency} ${model.purchasePrice.toLocaleString("en")}` : "",
      model.loanToValueBps !== null ? `LTV ${(model.loanToValueBps / 100).toFixed(2)}%` : "",
      model.annualInterestRateBps !== null ? `${en ? "interest" : "ставка"} ${(model.annualInterestRateBps / 100).toFixed(2)}%` : "",
      model.termMonths !== null ? `${model.termMonths} ${en ? "months" : "месяцев"}` : "",
      model.grossAnnualIncome !== null ? `${en ? "gross annual income" : "валовой годовой доход"} ${model.currency} ${model.grossAnnualIncome.toLocaleString("en")}` : "",
      model.targetAnnualReturnBps !== null ? `${en ? "target return" : "целевая доходность"} ${(model.targetAnnualReturnBps / 100).toFixed(2)}%` : "",
    ].filter(Boolean).join("; ");
    return `${en ? "Set case cash-flow assumptions" : "Задать допущения денежного потока"}${values ? ` — ${values}` : ""}`;
  }
  if (operation.kind === "set_classification") {
    const values = Object.entries(operation.change).map(([key, value]) => `${classificationName(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join("; ");
    return `${en ? "Update case classification" : "Уточнить классификацию кейса"}${values ? ` — ${values}` : ""}`;
  }
  const field = simple ? ({ title: en ? "title" : "название", jurisdiction: en ? "jurisdiction" : "юрисдикция", role: en ? "player role" : "роль игрока", premise: en ? "case context" : "контекст кейса" } as Record<string, string>)[operation.field] ?? operation.field : operation.field;
  return en ? `Set case ${field}: ${operation.value}` : `Изменить ${field}: ${operation.value}`;
}

export function applyStudioPromptIteration(draft: StudioDraft, options: {
  instruction: string;
  locale: "en" | "ru";
  nodeLabels: Record<StudioNodeType, string>;
  selectedNodeId?: string | null;
  createdAt: string;
}) {
  const plan = planStudioPromptIteration(draft, options);
  return applyStudioPromptPlan(draft, { plan, locale: options.locale, createdAt: options.createdAt });
}

export function applyStudioPromptPlan(draft: StudioDraft, options: {
  plan: StudioPromptPlan;
  locale: "en" | "ru";
  createdAt: string;
}) {
  const plan = options.plan;
  if (!plan.instruction || !plan.canApply) return { draft, changed: false, addedNodeIds: [] as string[], addedLinkIds: [] as string[], plan };
  let next = draft;
  if (plan.contextOnly) {
    const joinedPremise = `${draft.premise.trim()}\n\n${plan.instruction}`.trim();
    next = { ...draft, premise: joinedPremise.slice(0, 8_000) };
  }
  next = appendPromptSubmissionHistory(next, plan, options.locale, options.createdAt);
  for (const operation of plan.operations) next = executePromptOperation(next, operation);
  const addedNodeIds = plan.operations.filter((operation): operation is Extract<StudioPromptOperation, { kind: "add_node" }> => operation.kind === "add_node").map((operation) => operation.node.id);
  const addedLinkIds = plan.operations.filter((operation): operation is Extract<StudioPromptOperation, { kind: "add_link" }> => operation.kind === "add_link").map((operation) => operation.link.id);
  const structuralSummary = [
    plan.operations.length ? (options.locale === "en" ? `executed ${plan.operations.length} planned operation(s)` : `выполнено операций: ${plan.operations.length}`) : "",
    addedNodeIds.length ? (options.locale === "en" ? `added ${addedNodeIds.length} node(s)` : `добавлено узлов: ${addedNodeIds.length}`) : "",
    addedLinkIds.length ? (options.locale === "en" ? `created ${addedLinkIds.length} relation(s)` : `добавлено связей: ${addedLinkIds.length}`) : "",
  ].filter(Boolean).join(options.locale === "en" ? " and " : ", ");
  const provenance = plan.aiProvenance
    ? ` AI provenance: model=${plan.aiProvenance.model ?? "unreported"}; request=${plan.aiProvenance.requestId ?? "unreported"}; base=${plan.aiProvenance.baseFingerprint}; plan=${plan.aiProvenance.planFingerprint}.`
    : "";
  const reviewNotes = plan.planner === "ai" && ((plan.assumptions?.length ?? 0) || (plan.warnings?.length ?? 0))
    ? ` Reviewed assumptions: ${(plan.assumptions ?? []).join(" | ") || "none"}. Warnings: ${(plan.warnings ?? []).join(" | ") || "none"}.`
    : "";
  next = appendStudioHistory(next, {
    role: "studio", source: "prompt", action: "prompt_applied",
    message: structuralSummary
      ? (plan.planner === "ai"
          ? (options.locale === "en" ? `Applied the reviewed AI-assisted plan without replacing the existing graph: ${structuralSummary}.${provenance}${reviewNotes}` : `Проверенный AI-план применён без замены существующего графа: ${structuralSummary}.${provenance}${reviewNotes}`)
          : (options.locale === "en" ? `Applied the iteration without replacing the existing graph: ${structuralSummary}.` : `Итерация применена без замены существующего графа: ${structuralSummary}.`))
      : (options.locale === "en" ? "Added this instruction to the case context; the existing graph and manual edits were preserved." : "Инструкция добавлена в контекст кейса; существующий граф и ручные правки сохранены."),
  }, options.createdAt);
  return { draft: next, changed: true, addedNodeIds, addedLinkIds, plan };
}

function appendPromptSubmissionHistory(draft: StudioDraft, plan: StudioPromptPlan, locale: "en" | "ru", createdAt: string) {
  if (plan.planner !== "ai" || plan.instruction.length <= 2_000) {
    return appendStudioHistory(draft, { role: "author", source: "prompt", action: "prompt_submitted", message: plan.instruction }, createdAt);
  }
  // AI source prompts can reach 8k. Preserve the complete accepted source in
  // bounded, non-public history records instead of silently retaining only the
  // first 2k or the model's shorter summary.
  const chunkSize = 1_900;
  const chunks = Array.from({ length: Math.ceil(plan.instruction.length / chunkSize) }, (_, index) => plan.instruction.slice(index * chunkSize, (index + 1) * chunkSize));
  return chunks.reduce((next, chunk, index) => appendStudioHistory(next, {
    role: "author",
    source: "prompt",
    action: "prompt_submitted",
    message: `${locale === "en" ? "AI source" : "Источник для ИИ"} ${index + 1}/${chunks.length}:\n${chunk}\n[END AI SOURCE PART]`,
  }, createdAt), draft);
}

function executePromptOperation(draft: StudioDraft, operation: StudioPromptOperation): StudioDraft {
  if (operation.kind === "add_node") return { ...draft, nodes: [...draft.nodes, operation.node] };
  if (operation.kind === "update_node") return { ...draft, nodes: draft.nodes.map((node) => node.id === operation.nodeId ? applyPromptNodeChange(node, operation.change) : node) };
  if (operation.kind === "delete_node") return { ...draft, nodes: draft.nodes.filter((node) => node.id !== operation.nodeId), links: draft.links.filter((link) => link.from !== operation.nodeId && link.to !== operation.nodeId) };
  if (operation.kind === "add_link") return { ...draft, links: [...draft.links, operation.link] };
  if (operation.kind === "update_link") return { ...draft, links: draft.links.map((link) => link.id === operation.linkId ? { ...link, rule: { ...(link.rule ?? {}), ...operation.change } } : link) };
  if (operation.kind === "relink_link") return { ...draft, links: draft.links.map((link) => link.id === operation.linkId ? { ...link, from: operation.from, to: operation.to } : link) };
  if (operation.kind === "delete_link") return { ...draft, links: draft.links.filter((link) => link.id !== operation.linkId) };
  if (operation.kind === "append_context") return { ...draft, premise: `${draft.premise.trim()}\n\n${operation.value}`.trim().slice(0, 8_000) };
  if (operation.kind === "set_deal_economics") return { ...draft, dealEconomics: operation.economics };
  if (operation.kind === "set_classification") return { ...draft, classification: { ...(draft.classification ?? { domain: "general", practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true }), ...operation.change, ...(operation.change.domain === "tax" ? { complianceOnly: true } : {}) } };
  return { ...draft, [operation.field]: operation.value };
}

function applyPromptNodeChange(node: StudioNode, change: Extract<StudioPromptOperation, { kind: "update_node" }>["change"]): StudioNode {
  const { runtime, ...fields } = change;
  return { ...node, ...fields, ...(Object.hasOwn(change, "runtime") ? { runtime: runtime ?? undefined } : {}) };
}

function nextHistoryId(history: StudioEditEntry[], createdAt: string) {
  const stamp = Math.max(0, Date.parse(createdAt)).toString(36);
  const prefix = `edit-${stamp}`;
  let sequence = history.length + 1;
  while (history.some((entry) => entry.id === `${prefix}-${sequence}`)) sequence += 1;
  return `${prefix}-${sequence}`;
}

export function appendStudioHistory(draft: StudioDraft, entry: StudioHistoryInput, createdAt = new Date().toISOString()): StudioDraft {
  const currentHistory = draft.editHistory ?? [];
  const message = entry.message.trim();
  if (!message) throw new Error("Studio edit history messages cannot be empty");
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Studio edit history timestamps must be valid ISO dates");
  if (currentHistory.length > STUDIO_HISTORY_LIMIT) throw new Error("Studio edit history limit exceeded");
  const historyEntry: StudioEditEntry = {
    id: nextHistoryId(currentHistory, createdAt),
    role: entry.role,
    source: entry.source,
    action: entry.action,
    message: message.slice(0, 2_000),
    createdAt: new Date(createdAt).toISOString(),
  };
  const nextHistory = currentHistory.length < STUDIO_HISTORY_LIMIT
    ? [...currentHistory, historyEntry]
    : [
        {
          id: nextHistoryId([...currentHistory, historyEntry], createdAt),
          role: "studio" as const,
          source: "visual" as const,
          action: "history_compacted" as const,
          message: "Earlier edit-history entries were compacted at the workspace limit; exported or submitted earlier versions retain their original history.",
          createdAt,
        },
        ...currentHistory.slice(-(STUDIO_HISTORY_LIMIT - 2)),
        historyEntry,
      ];
  return {
    ...draft,
    editHistory: nextHistory,
    updatedAt: createdAt,
  };
}

function validateLink(draft: StudioDraft, link: StudioLink, ignoredLinkId = "") {
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(link.id)) return "invalid_link_id" as const;
  const ids = new Set(draft.nodes.map((node) => node.id));
  if (!ids.has(link.from) || !ids.has(link.to)) return "missing_endpoint" as const;
  if (link.from === link.to) return "self_link" as const;
  if (draft.links.some((item) => item.id !== ignoredLinkId && (item.id === link.id || (item.from === link.from && item.to === link.to)))) return "duplicate_link" as const;
  return null;
}

export function addStudioLink(draft: StudioDraft, link: StudioLink, history: StudioHistoryInput, createdAt = new Date().toISOString()): StudioGraphEditResult {
  if (draft.links.length >= 500) return { draft, changed: false, issue: "link_limit" };
  const issue = validateLink(draft, link);
  if (issue) return { draft, changed: false, issue };
  return { draft: appendStudioHistory({ ...draft, links: [...draft.links, link] }, history, createdAt), changed: true };
}

export function relinkStudioLink(draft: StudioDraft, previous: StudioLink, link: StudioLink, history: StudioHistoryInput, createdAt = new Date().toISOString()): StudioGraphEditResult {
  const index = draft.links.findIndex((item) => item.id === previous.id);
  if (index < 0) return { draft, changed: false, issue: "missing_link" };
  const existing = draft.links[index];
  const nextLink = { ...link, id: existing.id };
  if (existing.from === nextLink.from && existing.to === nextLink.to) return { draft, changed: false, issue: "unchanged" };
  const issue = validateLink(draft, nextLink, existing.id);
  if (issue) return { draft, changed: false, issue };
  const links = draft.links.map((item, itemIndex) => itemIndex === index ? nextLink : item);
  return { draft: appendStudioHistory({ ...draft, links }, history, createdAt), changed: true };
}

export function deleteStudioLink(draft: StudioDraft, link: StudioLink, history: StudioHistoryInput, createdAt = new Date().toISOString()): StudioGraphEditResult {
  const index = draft.links.findIndex((item) => item.id === link.id);
  if (index < 0) return { draft, changed: false, issue: "missing_link" };
  const links = draft.links.filter((_, itemIndex) => itemIndex !== index);
  return { draft: appendStudioHistory({ ...draft, links }, history, createdAt), changed: true };
}
