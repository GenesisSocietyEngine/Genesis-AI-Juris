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

export function applyStudioPromptIteration(draft: StudioDraft, options: {
  instruction: string;
  locale: "en" | "ru";
  nodeLabels: Record<StudioNodeType, string>;
  selectedNodeId?: string | null;
  createdAt: string;
}) {
  const clean = options.instruction.trim();
  if (!clean) return { draft, changed: false, addedNodeIds: [] as string[], addedLinkIds: [] as string[] };
  const nodeMatchers: Array<[StudioNodeType, RegExp]> = [
    ["trigger", /trigger|incident|триггер|событи/i], ["actor", /actor|party|stakeholder|актор|сторон|участник/i],
    ["fact", /fact|факт/i], ["evidence", /evidence|document|proof|доказательств|документ/i],
    ["deadline", /deadline|time limit|срок|дедлайн/i], ["decision", /decision|choice|решени|выбор/i],
    ["outcome", /outcome|consequence|исход|последств/i], ["entity", /entity|company|jurisdiction|компани|юрисдикци/i],
    ["tax_rule", /tax rule|treaty|cfc|withholding|налогов.*прав|соглашени/i], ["cash_flow", /cash flow|payment flow|денежн.*поток|плат[её]ж/i],
  ];
  const additionPattern = /(?:add|create|include|introduce|insert|добав(?:ь|ьте)?|созда(?:й|йте)?|включ(?:и|ите)?|встав(?:ь|ьте)?)\s+([^.;\n]*?)(?=(?:\bconnect\b|\blink\b|свяж)|[.;\n]|$)/gi;
  const additionText = Array.from(clean.matchAll(additionPattern), (match) => match[1]).join(" ");
  const requestedTypes = nodeMatchers.filter(([, matcher]) => matcher.test(additionText)).map(([type]) => type);
  const joinedPremise = `${draft.premise.trim()}\n\n${clean}`.trim();
  let next = { ...draft, premise: joinedPremise.length <= 8_000 ? joinedPremise : `${draft.premise.trim().slice(0, Math.max(0, 7_996 - clean.length))}\n\n${clean}`.slice(0, 8_000) };
  next = appendStudioHistory(next, { role: "author", source: "prompt", action: "prompt_submitted", message: clean }, options.createdAt);
  const addedNodeIds: string[] = [];
  for (const type of requestedTypes) {
    if (next.nodes.length >= 200) break;
    const id = nextStudioNodeId(next.nodes, type);
    const position = nextStudioNodePosition(next.nodes, next.nodes.find((node) => node.id === options.selectedNodeId));
    const node: StudioNode = { id, type, title: options.nodeLabels[type], detail: clean.slice(0, 4_000), ...position };
    addedNodeIds.push(id);
    next = { ...next, nodes: [...next.nodes, node] };
  }
  const addedLinkIds: string[] = [];
  const connectionPattern = /(?:connect|link|свяж(?:и|ите)?)\s+([a-z0-9][a-z0-9_-]{0,79})\s+(?:to|with|->|→|с)\s+([a-z0-9][a-z0-9_-]{0,79})/gi;
  for (const match of clean.matchAll(connectionPattern)) {
    const [, from, to] = match;
    if (next.links.length >= 500 || from === to || !next.nodes.some((node) => node.id === from) || !next.nodes.some((node) => node.id === to) || next.links.some((link) => link.from === from && link.to === to)) continue;
    const link = { id: nextStudioLinkId(next.links), from, to };
    addedLinkIds.push(link.id);
    next = { ...next, links: [...next.links, link] };
  }
  const structuralSummary = [
    addedNodeIds.length ? (options.locale === "en" ? `added ${addedNodeIds.length} node(s)` : `добавлено узлов: ${addedNodeIds.length}`) : "",
    addedLinkIds.length ? (options.locale === "en" ? `created ${addedLinkIds.length} relation(s)` : `добавлено связей: ${addedLinkIds.length}`) : "",
  ].filter(Boolean).join(options.locale === "en" ? " and " : ", ");
  next = appendStudioHistory(next, {
    role: "studio", source: "prompt", action: "prompt_applied",
    message: structuralSummary
      ? (options.locale === "en" ? `Applied the iteration without replacing the existing graph: ${structuralSummary}.` : `Итерация применена без замены существующего графа: ${structuralSummary}.`)
      : (options.locale === "en" ? "Added this instruction to the case context; the existing graph and manual edits were preserved." : "Инструкция добавлена в контекст кейса; существующий граф и ручные правки сохранены."),
  }, options.createdAt);
  return { draft: next, changed: true, addedNodeIds, addedLinkIds };
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
