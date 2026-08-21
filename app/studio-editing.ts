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
  | { kind: "update_node"; nodeId: string; change: Partial<Pick<StudioNode, "title" | "detail" | "type">> }
  | { kind: "delete_node"; nodeId: string }
  | { kind: "add_link"; link: StudioLink }
  | { kind: "relink_link"; linkId: string; from: string; to: string }
  | { kind: "delete_link"; linkId: string }
  | { kind: "append_context"; value: string }
  | { kind: "set_case_field"; field: "title" | "jurisdiction" | "role"; value: string };

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
  if (!clean) return { instruction: "", operations: [], diagnostics: [], canApply: false, contextOnly: false };
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
  return { instruction: clean, operations, diagnostics, canApply: !hasError, contextOnly: operations.length === 0 };
}

export function describeStudioPromptOperation(operation: StudioPromptOperation, locale: "en" | "ru") {
  const en = locale === "en";
  if (operation.kind === "add_node") return en ? `Add ${operation.node.type}: ${operation.node.title}` : `Добавить узел ${operation.node.type}: ${operation.node.title}`;
  if (operation.kind === "update_node") return en ? `Update ${operation.nodeId}` : `Изменить ${operation.nodeId}`;
  if (operation.kind === "delete_node") return en ? `Delete ${operation.nodeId} and its relations` : `Удалить ${operation.nodeId} и его связи`;
  if (operation.kind === "add_link") return en ? `Connect ${operation.link.from} → ${operation.link.to}` : `Связать ${operation.link.from} → ${operation.link.to}`;
  if (operation.kind === "relink_link") return en ? `Relink ${operation.linkId}: ${operation.from} → ${operation.to}` : `Перепривязать ${operation.linkId}: ${operation.from} → ${operation.to}`;
  if (operation.kind === "delete_link") return en ? `Delete ${operation.linkId}` : `Удалить ${operation.linkId}`;
  if (operation.kind === "append_context") return en ? "Append text to the case context" : "Дополнить контекст кейса";
  return en ? `Set case ${operation.field}: ${operation.value}` : `Изменить ${operation.field}: ${operation.value}`;
}

export function applyStudioPromptIteration(draft: StudioDraft, options: {
  instruction: string;
  locale: "en" | "ru";
  nodeLabels: Record<StudioNodeType, string>;
  selectedNodeId?: string | null;
  createdAt: string;
}) {
  const plan = planStudioPromptIteration(draft, options);
  if (!plan.instruction || !plan.canApply) return { draft, changed: false, addedNodeIds: [] as string[], addedLinkIds: [] as string[], plan };
  let next = draft;
  if (plan.contextOnly) {
    const joinedPremise = `${draft.premise.trim()}\n\n${plan.instruction}`.trim();
    next = { ...draft, premise: joinedPremise.slice(0, 8_000) };
  }
  next = appendStudioHistory(next, { role: "author", source: "prompt", action: "prompt_submitted", message: plan.instruction }, options.createdAt);
  for (const operation of plan.operations) next = executePromptOperation(next, operation);
  const addedNodeIds = plan.operations.filter((operation): operation is Extract<StudioPromptOperation, { kind: "add_node" }> => operation.kind === "add_node").map((operation) => operation.node.id);
  const addedLinkIds = plan.operations.filter((operation): operation is Extract<StudioPromptOperation, { kind: "add_link" }> => operation.kind === "add_link").map((operation) => operation.link.id);
  const structuralSummary = [
    plan.operations.length ? (options.locale === "en" ? `executed ${plan.operations.length} planned operation(s)` : `выполнено операций: ${plan.operations.length}`) : "",
    addedNodeIds.length ? (options.locale === "en" ? `added ${addedNodeIds.length} node(s)` : `добавлено узлов: ${addedNodeIds.length}`) : "",
    addedLinkIds.length ? (options.locale === "en" ? `created ${addedLinkIds.length} relation(s)` : `добавлено связей: ${addedLinkIds.length}`) : "",
  ].filter(Boolean).join(options.locale === "en" ? " and " : ", ");
  next = appendStudioHistory(next, {
    role: "studio", source: "prompt", action: "prompt_applied",
    message: structuralSummary
      ? (options.locale === "en" ? `Applied the iteration without replacing the existing graph: ${structuralSummary}.` : `Итерация применена без замены существующего графа: ${structuralSummary}.`)
      : (options.locale === "en" ? "Added this instruction to the case context; the existing graph and manual edits were preserved." : "Инструкция добавлена в контекст кейса; существующий граф и ручные правки сохранены."),
  }, options.createdAt);
  return { draft: next, changed: true, addedNodeIds, addedLinkIds, plan };
}

function executePromptOperation(draft: StudioDraft, operation: StudioPromptOperation): StudioDraft {
  if (operation.kind === "add_node") return { ...draft, nodes: [...draft.nodes, operation.node] };
  if (operation.kind === "update_node") return { ...draft, nodes: draft.nodes.map((node) => node.id === operation.nodeId ? { ...node, ...operation.change } : node) };
  if (operation.kind === "delete_node") return { ...draft, nodes: draft.nodes.filter((node) => node.id !== operation.nodeId), links: draft.links.filter((link) => link.from !== operation.nodeId && link.to !== operation.nodeId) };
  if (operation.kind === "add_link") return { ...draft, links: [...draft.links, operation.link] };
  if (operation.kind === "relink_link") return { ...draft, links: draft.links.map((link) => link.id === operation.linkId ? { ...link, from: operation.from, to: operation.to } : link) };
  if (operation.kind === "delete_link") return { ...draft, links: draft.links.filter((link) => link.id !== operation.linkId) };
  if (operation.kind === "append_context") return { ...draft, premise: `${draft.premise.trim()}\n\n${operation.value}`.trim().slice(0, 8_000) };
  return { ...draft, [operation.field]: operation.value };
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
