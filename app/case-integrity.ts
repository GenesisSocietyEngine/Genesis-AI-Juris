import type { MetricGuard, MetricKey, RuleComparison, StudioDraft, StudioEditAction, StudioEditEntry, StudioLink, StudioNode, StudioNodeType, TaxCasePurpose } from "./types";
import { normalizeUntrustedCaseProtection } from "./case-protection";
import { STUDIO_HISTORY_LIMIT } from "./studio-editing";
import { STUDIO_DRAFT_SERIALIZED_LIMIT, studioJsonBytes } from "./studio-envelope";
import { normalizeTaxEconomics } from "./tax-economics";
import { normalizeDealEconomics } from "./deal-economics";
import { normalizeCaseTypeReference } from "./case-type-reference";

const nodeTypes = new Set<StudioNodeType>([
  "trigger", "actor", "fact", "evidence", "deadline", "decision", "outcome", "entity", "tax_rule", "cash_flow",
]);
const taxPurposes = new Set<TaxCasePurpose>(["lawful_planning", "compliance_review", "audit_defence", "evasion_detection"]);
const metricKeys = new Set<MetricKey>(["position", "evidence", "trust", "exposure"]);
const ruleComparisons = new Set<RuleComparison>(["gte", "lte", "eq"]);
const editActions = new Set<StudioEditAction>([
  "prompt_submitted", "prompt_applied", "graph_rebuilt", "case_updated", "node_added", "node_updated",
  "node_moved", "node_deleted", "link_added", "link_relinked", "link_deleted",
  "undo_applied", "redo_applied", "revision_restored", "compiled_for_play",
  "history_compacted",
]);
const taxPracticePattern = /tax|налог|transfer\s*pricing|трансферт|offshore|офшор|treaty|cfc|beps|dac6|pillar\s*(?:two|2)|withholding|permanent\s+establishment/i;

export function isTaxClassification(classification: StudioDraft["classification"]) {
  if (!classification) return false;
  return classification.domain === "tax" || classification.taxTopics.length > 0 || taxPracticePattern.test(classification.practiceArea);
}

export function isTaxDraft(draft: Pick<StudioDraft, "classification" | "nodes">) {
  return isTaxClassification(draft.classification) || draft.nodes.some((node) => node.type === "entity" || node.type === "tax_rule" || node.type === "cash_flow");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function slugifyCaseId(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "custom_case";
}

export function caseFingerprint(draft: StudioDraft) {
  return canonicalFingerprint(caseFingerprintContent(draft, true));
}

export const CASE_PUBLICATION_FINGERPRINT_KIND = "genesis-juris-case-publication-safety-v1" as const;

/**
 * A separate safety receipt preserves the released semantic case fingerprint
 * while binding the professional-review state that controls whether premise
 * text may enter a report or published payload.
 */
export function casePublicationFingerprint(draft: StudioDraft) {
  return canonicalFingerprint({
    kind: CASE_PUBLICATION_FINGERPRINT_KIND,
    caseFingerprint: caseFingerprint(draft),
    premiseReview: casePremiseReviewState(draft),
  });
}

export function casePremiseReviewState(draft: Pick<StudioDraft, "premisePublication">) {
  return draft.premisePublication === "author-reviewed" ? "author-reviewed" as const : "unreviewed" as const;
}

/**
 * Read-only compatibility fingerprint for artifacts exported before v16.
 * New saves and seals must always use caseFingerprint(), which binds the
 * relationship IDs compiled into playable option IDs.
 */
export function legacyCaseFingerprintV15(draft: StudioDraft) {
  return canonicalFingerprint(caseFingerprintContent(draft, false));
}

function caseFingerprintContent(draft: StudioDraft, includeRelationshipIds: boolean) {
  const rawClassification = draft.classification ?? { practiceArea: "General legal", difficulty: "Intermediate", tags: [], taxTopics: [], complianceOnly: true };
  const practiceArea = rawClassification.practiceArea.trim() || "General legal";
  const taxTopics = cleanList(rawClassification.taxTopics, 30, 100);
  const isTax = rawClassification.domain === "tax" || taxTopics.length > 0 || taxPracticePattern.test(practiceArea)
    || draft.nodes.some((node) => node.type === "entity" || node.type === "tax_rule" || node.type === "cash_flow");
  const classification = {
    domain: isTax ? "tax" as const : "general" as const,
    practiceArea,
    difficulty: rawClassification.difficulty.trim().slice(0, 40) || "Intermediate",
    tags: cleanList(rawClassification.tags, 30, 100),
    taxTopics,
    purpose: rawClassification.purpose ?? (isTax ? "lawful_planning" : "compliance_review"),
    complianceOnly: isTax ? true : rawClassification.complianceOnly !== false,
    legalAsOf: isoDate(rawClassification.legalAsOf),
    sourceUrls: urlList(rawClassification.sourceUrls, 30),
  };
  return {
    caseId: draft.caseId.trim(),
    ...(draft.caseType ? { caseType: normalizeCaseTypeReference(draft.caseType) } : {}),
    parent: draft.parent,
    title: draft.title.trim(),
    jurisdiction: draft.jurisdiction.trim().slice(0, 160),
    role: draft.role.trim().slice(0, 160),
    premise: draft.premise.trim().slice(0, 8_000),
    classification,
    taxEconomics: isTax ? normalizeTaxEconomics(draft.taxEconomics) : undefined,
    dealEconomics: normalizeDealEconomics(draft.dealEconomics),
    nodes: draft.nodes.map((node) => ({ ...node, title: node.title.trim(), detail: node.detail.trim().slice(0, 4_000) })),
    // Relationship IDs become playable option IDs in studio-compiler. v16
    // therefore treats them as runnable content. The ID-free shape exists only
    // to recognize a v15 export before authoritative server comparison.
    links: draft.links.map((link) => includeRelationshipIds
      ? { id: link.id, from: link.from, to: link.to, rule: link.rule }
      : { from: link.from, to: link.to, rule: link.rule }),
  };
}

export function canonicalFingerprint(value: unknown) { return `sha256-${sha256(canonicalJson(value))}`; }

export function normalizeStudioDraft(value: unknown): StudioDraft {
  if (!isRecord(value)) throw new Error("Invalid custom case draft");
  const title = boundedString(value.title, "title", 1, 200);
  const caseId = typeof value.caseId === "string" && value.caseId.trim() ? value.caseId.trim() : slugifyCaseId(title);
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(caseId) || caseId.length > 140) throw new Error("Invalid case ID");
  const version = typeof value.version === "string" && value.version.trim() ? value.version.trim() : "1.0.0";
  if (!/^\d+\.\d+\.\d+$/.test(version) || version.length > 40) throw new Error("Invalid case version");
  if (!Array.isArray(value.nodes) || value.nodes.length === 0 || value.nodes.length > 200) throw new Error("Invalid node collection");
  if (!Array.isArray(value.links) || value.links.length > 500) throw new Error("Invalid link collection");

  const nodes = value.nodes.map(normalizeNode);
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) throw new Error("Duplicate node IDs");
  if (nodes.some((node) => node.runtime?.missedOutcomeNodeId && !ids.has(node.runtime.missedOutcomeNodeId))) throw new Error("Studio deadline fallback is not in the graph");
  const links = value.links.map((item, index) => normalizeLink(item, ids, index));
  if (new Set(links.map((link) => link.id)).size !== links.length) throw new Error("Duplicate node relationship ID");
  if (new Set(links.map((link) => `${link.from}\u0000${link.to}`)).size !== links.length) throw new Error("Duplicate node relationship");
  if (Array.isArray(value.editHistory) && value.editHistory.length > STUDIO_HISTORY_LIMIT) throw new Error("Studio edit history limit exceeded");
  const editHistory = Array.isArray(value.editHistory) ? value.editHistory.map(normalizeEditEntry) : [];
  if (new Set(editHistory.map((entry) => entry.id)).size !== editHistory.length) throw new Error("Duplicate Studio edit history ID");

  const rawClassification = isRecord(value.classification) ? value.classification : {};
  const practiceArea = safeString(rawClassification.practiceArea, "General legal", 100);
  const taxTopics = stringList(rawClassification.taxTopics, 30, 100);
  const isTax = rawClassification.domain === "tax" || taxTopics.length > 0 || taxPracticePattern.test(practiceArea)
    || nodes.some((node) => node.type === "entity" || node.type === "tax_rule" || node.type === "cash_flow");
  const purpose = typeof rawClassification.purpose === "string" && taxPurposes.has(rawClassification.purpose as TaxCasePurpose)
    ? rawClassification.purpose as TaxCasePurpose
    : isTax ? "lawful_planning" : "compliance_review";
  const parent = isRecord(value.parent)
    && typeof value.parent.caseId === "string"
    && typeof value.parent.version === "string"
    && typeof value.parent.fingerprint === "string"
    && value.parent.caseId.length <= 140
    && /^\d+\.\d+\.\d+$/.test(value.parent.version)
    && /^sha256-[a-f0-9]{64}$/.test(value.parent.fingerprint)
      ? { caseId: value.parent.caseId, version: value.parent.version, fingerprint: value.parent.fingerprint }
      : null;
  const protection = normalizeUntrustedCaseProtection(value.protection);
  const caseType = normalizeCaseTypeReference(value.caseType);
  const taxEconomics = isTax ? normalizeTaxEconomics(value.taxEconomics) : undefined;
  const dealEconomics = normalizeDealEconomics(value.dealEconomics);
  const premisePublication = value.premisePublication === "prompt-derived" || value.premisePublication === "author-reviewed"
    ? value.premisePublication
    : undefined;

  const normalized: StudioDraft = {
    caseId,
    version,
    ...(caseType ? { caseType } : {}),
    parent,
    ...(protection ? { protection } : {}),
    title,
    jurisdiction: safeString(value.jurisdiction, "", 160),
    role: safeString(value.role, "", 160),
    premise: safeString(value.premise, "", 8_000),
    ...(premisePublication ? { premisePublication } : {}),
    classification: {
      domain: isTax ? "tax" : "general",
      practiceArea,
      difficulty: safeString(rawClassification.difficulty, "Intermediate", 40),
      tags: stringList(rawClassification.tags, 30, 100),
      taxTopics,
      purpose,
      complianceOnly: isTax ? true : rawClassification.complianceOnly !== false,
      legalAsOf: isoDate(rawClassification.legalAsOf),
      sourceUrls: urlList(rawClassification.sourceUrls, 30),
    },
    ...(taxEconomics ? { taxEconomics } : {}),
    ...(dealEconomics ? { dealEconomics } : {}),
    nodes,
    links,
    editHistory,
    updatedAt: typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt))
      ? new Date(value.updatedAt).toISOString()
      : new Date().toISOString(),
  };
  if (studioJsonBytes(normalized) > STUDIO_DRAFT_SERIALIZED_LIMIT) throw new Error("Studio draft exceeds the aggregate JSON size limit");
  return normalized;
}

export function studioStructuralIssues(draft: StudioDraft) {
  const count = (type: StudioNodeType) => draft.nodes.filter((node) => node.type === type).length;
  const issues: string[] = [];
  if (!draft.jurisdiction || !draft.role || !draft.premise) issues.push("jurisdiction_role_premise_required");
  if (count("trigger") < 1 || count("actor") < 1 || count("evidence") < 1 || count("decision") < 1 || count("outcome") < 2) issues.push("core_graph_nodes_required");
  const nodeIds = new Set(draft.nodes.map((node) => node.id));
  if (draft.links.some((link) => !nodeIds.has(link.from) || !nodeIds.has(link.to))) issues.push("invalid_relationship");
  const outgoing = new Map<string, string[]>();
  for (const link of draft.links) outgoing.set(link.from, [...(outgoing.get(link.from) ?? []), link.to]);
  const reachableFrom = (starts: string[]) => {
    const reachable = new Set<string>();
    const pending = [...starts];
    while (pending.length) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const next of outgoing.get(id) ?? []) pending.push(next);
    }
    return reachable;
  };
  const triggerIds = draft.nodes.filter((node) => node.type === "trigger").map((node) => node.id);
  const triggerReachable = reachableFrom(triggerIds);
  if (draft.nodes.some((node) => !triggerReachable.has(node.id))) issues.push("disconnected_graph");
  const decisionReachable = reachableFrom(draft.nodes.filter((node) => node.type === "decision").map((node) => node.id));
  if (draft.nodes.some((node) => node.type === "outcome" && !decisionReachable.has(node.id))) issues.push("outcome_not_reachable_from_decision");
  if (draft.nodes.some((node) => node.type === "decision" && !(outgoing.get(node.id)?.length))) issues.push("decision_branch_required");
  const classification = draft.classification!;
  const isTax = isTaxDraft(draft);
  if (isTax) {
    if (count("entity") < 1 || count("cash_flow") < 1 || count("tax_rule") < 1) issues.push("tax_graph_nodes_required");
    if (!classification.complianceOnly || !classification.purpose || !classification.legalAsOf || (classification.sourceUrls ?? []).length === 0) issues.push("tax_publication_metadata_required");
  }
  return issues;
}

function normalizeNode(value: unknown): StudioNode {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value.id)) throw new Error("Invalid node ID");
  if (typeof value.type !== "string" || !nodeTypes.has(value.type as StudioNodeType)) throw new Error("Invalid node type");
  if (typeof value.x !== "number" || !Number.isFinite(value.x) || value.x < 0 || value.x > 5_000) throw new Error("Invalid node coordinate");
  if (typeof value.y !== "number" || !Number.isFinite(value.y) || value.y < 0 || value.y > 5_000) throw new Error("Invalid node coordinate");
  return {
    id: value.id,
    type: value.type as StudioNodeType,
    title: boundedString(value.title, "node title", 1, 200),
    detail: safeString(value.detail, "", 4_000),
    x: value.x,
    y: value.y,
    runtime: normalizeNodeRuntime(value.runtime, value.type as StudioNodeType),
  };
}

function normalizeLink(value: unknown, ids: Set<string>, index: number): StudioLink {
  if (!isRecord(value) || typeof value.from !== "string" || typeof value.to !== "string" || value.from === value.to || !ids.has(value.from) || !ids.has(value.to)) {
    throw new Error("Invalid node relationship");
  }
  const id = typeof value.id === "string" ? value.id : `link-${index + 1}`;
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id)) throw new Error("Invalid node relationship ID");
  const rule = normalizeLinkRule(value.rule);
  return rule ? { id, from: value.from, to: value.to, rule } : { id, from: value.from, to: value.to };
}

function normalizeNodeRuntime(value: unknown, type: StudioNodeType) {
  if (!isRecord(value)) return undefined;
  const day = optionalInteger(value.day, 1, 10_000);
  const time = optionalClock(value.time);
  const pressure = optionalSafeString(value.pressure, 2_000);
  const terminalOutcome: NonNullable<StudioNode["runtime"]>["terminalOutcome"] = type === "outcome" && (value.terminalOutcome === "strong" || value.terminalOutcome === "mixed" || value.terminalOutcome === "weak")
    ? value.terminalOutcome
    : undefined;
  const deadlineDay = type === "deadline" ? optionalInteger(value.deadlineDay, 1, 10_000) : undefined;
  const deadlineTime = type === "deadline" ? optionalClock(value.deadlineTime) : undefined;
  if ((deadlineDay === undefined) !== (deadlineTime === undefined)) throw new Error("A Studio deadline requires both day and time");
  const missedOutcomeNodeId = type === "deadline" && typeof value.missedOutcomeNodeId === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value.missedOutcomeNodeId)
    ? value.missedOutcomeNodeId
    : undefined;
  const budgetCostEur = optionalInteger(value.budgetCostEur, 0, 1_000_000_000);
  const durationMinutes = optionalInteger(value.durationMinutes, 0, 100_000_000);
  const runtime = { day, time, pressure, terminalOutcome, deadlineDay, deadlineTime, missedOutcomeNodeId, budgetCostEur, durationMinutes };
  return Object.values(runtime).some((item) => item !== undefined) ? runtime : undefined;
}

function normalizeLinkRule(value: unknown): StudioLink["rule"] {
  if (!isRecord(value)) return undefined;
  const repeatability: NonNullable<StudioLink["rule"]>["repeatability"] = value.repeatability === "once" || value.repeatability === "repeatable" || value.repeatability === "limited" ? value.repeatability : undefined;
  const maxUses = optionalInteger(value.maxUses, 1, 10_000);
  if ((repeatability === "limited") !== (maxUses !== undefined)) throw new Error("Limited Studio actions require an explicit use limit");
  const rawEffects = isRecord(value.effects) ? value.effects : {};
  const effects = Object.fromEntries([...metricKeys].flatMap((metric) => {
    const effect = rawEffects[metric];
    return typeof effect === "number" && Number.isFinite(effect) && effect >= -100 && effect <= 100 ? [[metric, effect]] : [];
  })) as Partial<Record<MetricKey, number>>;
  const guards = Array.isArray(value.guards) ? value.guards.slice(0, 8).map(normalizeMetricGuard) : [];
  const rule = {
    label: optionalSafeString(value.label, 200),
    detail: optionalSafeString(value.detail, 4_000),
    result: optionalSafeString(value.result, 4_000),
    cost: optionalInteger(value.cost, 0, 1_000_000_000),
    minutes: optionalInteger(value.minutes, 0, 100_000_000),
    effects: Object.keys(effects).length ? effects : undefined,
    guards: guards.length ? guards : undefined,
    repeatability,
    maxUses,
  };
  return Object.values(rule).some((item) => item !== undefined) ? rule : undefined;
}

function normalizeMetricGuard(value: unknown): MetricGuard {
  if (!isRecord(value) || typeof value.metric !== "string" || !metricKeys.has(value.metric as MetricKey)) throw new Error("Invalid Studio metric guard");
  if (typeof value.comparison !== "string" || !ruleComparisons.has(value.comparison as RuleComparison)) throw new Error("Invalid Studio guard comparison");
  if (typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0 || value.value > 100) throw new Error("Invalid Studio guard threshold");
  return { metric: value.metric as MetricKey, comparison: value.comparison as RuleComparison, value: value.value };
}

function normalizeEditEntry(value: unknown): StudioEditEntry {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,119}$/.test(value.id)) throw new Error("Invalid Studio edit history ID");
  if (value.role !== "author" && value.role !== "studio") throw new Error("Invalid Studio edit history role");
  if (value.source !== "prompt" && value.source !== "visual") throw new Error("Invalid Studio edit history source");
  if (typeof value.action !== "string" || !editActions.has(value.action as StudioEditAction)) throw new Error("Invalid Studio edit history action");
  if (typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) throw new Error("Invalid Studio edit history timestamp");
  return {
    id: value.id,
    role: value.role,
    source: value.source,
    action: value.action as StudioEditAction,
    message: boundedString(value.message, "Studio edit history message", 1, 2_000),
    createdAt: new Date(value.createdAt).toISOString(),
  };
}

function boundedString(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new Error(`Invalid ${label}`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new Error(`Invalid ${label}`);
  return result;
}
function safeString(value: unknown, fallback: string, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}
function optionalSafeString(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().slice(0, max);
  return clean || undefined;
}
function optionalInteger(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error("Invalid Studio runtime integer");
  return value;
}
function optionalClock(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Invalid Studio runtime clock");
  return value;
}
function stringList(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}
function cleanList(value: string[] | undefined, maxItems: number, maxLength: number) { return stringList(value, maxItems, maxLength); }
function isoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}
function urlList(value: unknown, maxItems: number) {
  return stringList(value, maxItems, 500).filter((item) => {
    try {
      const parsed = new URL(item);
      return parsed.protocol === "https:"
        && parsed.username === ""
        && parsed.password === ""
        && parsed.hostname !== ""
        && parsed.origin !== "null";
    } catch { return false; }
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

function sha256(input: string) {
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const words = new Array<number>(64);
  const rotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] = ((bytes[position] << 24) | (bytes[position + 1] << 16) | (bytes[position + 2] << 8) | bytes[position + 3]) | 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + constants[index] + words[index]) | 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) | 0;
      h=g; g=f; f=e; e=(d+temp1)|0; d=c; c=b; b=a; a=(temp1+temp2)|0;
    }
    hash[0]=(hash[0]+a)|0; hash[1]=(hash[1]+b)|0; hash[2]=(hash[2]+c)|0; hash[3]=(hash[3]+d)|0;
    hash[4]=(hash[4]+e)|0; hash[5]=(hash[5]+f)|0; hash[6]=(hash[6]+g)|0; hash[7]=(hash[7]+h)|0;
  }
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}
