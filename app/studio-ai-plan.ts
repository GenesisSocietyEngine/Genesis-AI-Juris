import { canonicalFingerprint, caseFingerprint, isRecord, normalizeStudioDraft, slugifyCaseId, studioStructuralIssues } from "./case-integrity";
import { applyStudioPromptPlan, nextStudioLinkId, nextStudioNodeId, nextStudioNodePosition, type StudioPromptDiagnostic, type StudioPromptOperation, type StudioPromptPlan } from "./studio-editing";
import { compileStudioDraft } from "./studio-compiler";
import type { MetricKey, StudioDraft, StudioLink, StudioNode, StudioNodeType } from "./types";

const nodeTypes = new Set<StudioNodeType>([
  "trigger", "actor", "fact", "evidence", "deadline", "decision", "outcome", "entity", "tax_rule", "cash_flow",
]);
const metrics = new Set<MetricKey>(["position", "evidence", "trust", "exposure"]);
const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const refPattern = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;

export const STUDIO_AI_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    compatible: { type: "boolean", description: "False only when the input cannot be represented as a legal scenario graph." },
    clarification: { type: ["string", "null"], description: "A concise question or reason when the input is incompatible." },
    summary: { type: "string", description: "Plain-language summary of the proposed graph changes." },
    assumptions: { type: "array", maxItems: 10, items: { type: "string" } },
    warnings: { type: "array", maxItems: 10, items: { type: "string" } },
    case: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: ["string", "null"] },
        jurisdiction: { type: ["string", "null"] },
        role: { type: ["string", "null"] },
        context: { type: ["string", "null"], description: "A factual case-premise summary, not instructions to the player." },
        domain: { type: ["string", "null"], enum: ["general", "tax", null] },
        practiceArea: { type: ["string", "null"] },
        tags: { type: "array", maxItems: 20, items: { type: "string" } },
        taxTopics: { type: "array", maxItems: 20, items: { type: "string" } },
      },
      required: ["title", "jurisdiction", "role", "context", "domain", "practiceArea", "tags", "taxTopics"],
    },
    nodes: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["add", "update"] },
          ref: { type: "string", description: "Temporary unique reference for a new node or a reference alias for an existing node." },
          existingNodeId: { type: ["string", "null"] },
          type: { type: "string", enum: [...nodeTypes] },
          title: { type: "string" },
          detail: { type: "string" },
          runtime: {
            type: "object",
            additionalProperties: false,
            properties: {
              day: { type: ["integer", "null"], minimum: 1, maximum: 10000 },
              time: { type: ["string", "null"] },
              pressure: { type: ["string", "null"] },
              terminalOutcome: { type: ["string", "null"], enum: ["strong", "mixed", "weak", null] },
              deadlineDay: { type: ["integer", "null"], minimum: 1, maximum: 10000 },
              deadlineTime: { type: ["string", "null"] },
              budgetCostEur: { type: ["integer", "null"], minimum: 0, maximum: 1000000000 },
              durationMinutes: { type: ["integer", "null"], minimum: 0, maximum: 100000000 },
            },
            required: ["day", "time", "pressure", "terminalOutcome", "deadlineDay", "deadlineTime", "budgetCostEur", "durationMinutes"],
          },
        },
        required: ["action", "ref", "existingNodeId", "type", "title", "detail", "runtime"],
      },
    },
    links: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["add", "update"] },
          existingLinkId: { type: ["string", "null"] },
          fromRef: { type: "string" },
          toRef: { type: "string" },
          label: { type: ["string", "null"] },
          detail: { type: ["string", "null"] },
          result: { type: ["string", "null"] },
          cost: { type: ["integer", "null"], minimum: 0, maximum: 1000000000 },
          minutes: { type: ["integer", "null"], minimum: 0, maximum: 100000000 },
          effects: {
            type: "object",
            additionalProperties: false,
            properties: {
              position: { type: ["integer", "null"], minimum: -100, maximum: 100 },
              evidence: { type: ["integer", "null"], minimum: -100, maximum: 100 },
              trust: { type: ["integer", "null"], minimum: -100, maximum: 100 },
              exposure: { type: ["integer", "null"], minimum: -100, maximum: 100 },
            },
            required: ["position", "evidence", "trust", "exposure"],
          },
          repeatability: { type: ["string", "null"], enum: ["once", "repeatable", "limited", null] },
          maxUses: { type: ["integer", "null"], minimum: 1, maximum: 10000 },
        },
        required: ["action", "existingLinkId", "fromRef", "toRef", "label", "detail", "result", "cost", "minutes", "effects", "repeatability", "maxUses"],
      },
    },
  },
  required: ["compatible", "clarification", "summary", "assumptions", "warnings", "case", "nodes", "links"],
} as const;

export type StudioAIContext = ReturnType<typeof toStudioAIContext>;

export function toStudioAIContext(draft: StudioDraft) {
  return {
    caseId: draft.caseId,
    version: draft.version,
    parent: draft.parent,
    title: draft.title,
    jurisdiction: draft.jurisdiction,
    role: draft.role,
    premise: draft.premise,
    classification: draft.classification,
    taxEconomics: draft.taxEconomics,
    nodes: draft.nodes,
    links: draft.links,
    updatedAt: draft.updatedAt,
  };
}

export function studioAIBaseFingerprint(draft: StudioDraft | StudioAIContext) {
  const normalized = normalizeStudioAIContext(toStudioAIContext(draft as StudioDraft));
  return canonicalFingerprint({ kind: "studio-ai-context-v1", context: toStudioAIContext(normalized) });
}

export function normalizeStudioAIContext(value: unknown): StudioDraft {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.links)) throw new Error("Invalid Studio AI context");
  const empty = value.nodes.length === 0;
  if (empty && value.links.length !== 0) throw new Error("An empty Studio AI context cannot contain relations");
  const rawTitle = boundedString(value.title, 200, true);
  const candidate = {
    caseId: value.caseId,
    version: value.version,
    parent: value.parent,
    title: rawTitle || "Untitled case",
    jurisdiction: value.jurisdiction,
    role: value.role,
    premise: value.premise,
    classification: value.classification,
    taxEconomics: value.taxEconomics,
    nodes: empty ? [{ id: "trigger-ai-validation", type: "trigger", title: "Validation placeholder", detail: "", x: 0, y: 0 }] : value.nodes,
    links: empty ? [] : value.links,
    editHistory: [],
    updatedAt: value.updatedAt,
  };
  const normalized = normalizeStudioDraft(candidate);
  return {
    ...normalized,
    title: rawTitle,
    nodes: empty ? [] : normalized.nodes,
    links: empty ? [] : normalized.links,
    editHistory: [],
  };
}

export function materializeAIStudioPlan(draft: StudioDraft, instruction: string, rawProposal: unknown, locale: "en" | "ru", selectedNodeId?: string | null): StudioPromptPlan {
  const clean = instruction.trim().slice(0, 8_000);
  if (!clean || !isRecord(rawProposal)) throw new Error("Invalid AI Studio proposal");
  const compatible = rawProposal.compatible === true;
  if (rawProposal.compatible !== true && rawProposal.compatible !== false) throw new Error("Invalid AI compatibility result");
  const summary = boundedString(rawProposal.summary, 800);
  const clarification = nullableString(rawProposal.clarification, 800);
  const assumptions = boundedList(rawProposal.assumptions, 10, 500);
  const warnings = boundedList(rawProposal.warnings, 10, 500);
  const caseProposal = requireRecord(rawProposal.case, "case proposal");
  const nodeProposals = requireArray(rawProposal.nodes, 30, "node proposals");
  const linkProposals = requireArray(rawProposal.links, 60, "link proposals");
  const operations: StudioPromptOperation[] = [];
  const diagnostics: StudioPromptDiagnostic[] = [];
  if (!compatible) {
    diagnostics.push({ level: "error", message: clarification || (locale === "en" ? "The prompt needs a clearer legal situation, decision or intended outcome." : "Уточните юридическую ситуацию, решение или ожидаемый исход.") });
    return { instruction: clean, operations, diagnostics, canApply: false, contextOnly: false, planner: "ai", summary, assumptions, warnings };
  }

  const proposedTitle = nullableString(caseProposal.title, 200);
  const proposedJurisdiction = nullableString(caseProposal.jurisdiction, 160);
  const proposedRole = nullableString(caseProposal.role, 160);
  const proposedContext = nullableString(caseProposal.context, 4_000);
  if (proposedTitle && proposedTitle !== draft.title) {
    operations.push({ kind: "set_case_field", field: "title", value: proposedTitle });
    if (draft.caseId === "untitled_case") operations.push({ kind: "set_case_field", field: "caseId", value: slugifyCaseId(proposedTitle).slice(0, 140) });
  }
  if (proposedJurisdiction && proposedJurisdiction !== draft.jurisdiction) operations.push({ kind: "set_case_field", field: "jurisdiction", value: proposedJurisdiction });
  if (proposedRole && proposedRole !== draft.role) operations.push({ kind: "set_case_field", field: "role", value: proposedRole });
  // The publishable case premise is always the separately proposed, bounded
  // context. The raw author source remains in private authoring history and is
  // stripped from published artifacts; it must never silently become public
  // catalogue copy merely because the draft was blank.
  const contextValue = proposedContext;
  if (contextValue && !draft.premise.includes(contextValue)) operations.push({ kind: "append_context", value: contextValue.slice(0, 8_000) });
  if (!draft.premise.trim() && !contextValue) diagnostics.push({
    level: "error",
    message: locale === "en"
      ? "AI did not provide a publishable case context. Add or request a concise factual context before applying."
      : "AI не предложил публикуемый контекст кейса. Добавьте или запросите краткое фактическое описание перед применением.",
  });

  const proposedDomain = caseProposal.domain === "general" || caseProposal.domain === "tax" ? caseProposal.domain : null;
  if (caseProposal.domain !== null && !proposedDomain) throw new Error("Invalid AI case domain");
  const practiceArea = nullableString(caseProposal.practiceArea, 100);
  const tags = boundedList(caseProposal.tags, 20, 100);
  const taxTopics = boundedList(caseProposal.taxTopics, 20, 100);
  const classificationChange: Partial<NonNullable<StudioDraft["classification"]>> = {};
  if (proposedDomain && proposedDomain !== draft.classification?.domain) classificationChange.domain = proposedDomain;
  if (practiceArea && practiceArea !== draft.classification?.practiceArea) classificationChange.practiceArea = practiceArea;
  if (tags.length && JSON.stringify(tags) !== JSON.stringify(draft.classification?.tags ?? [])) classificationChange.tags = tags;
  if (taxTopics.length && JSON.stringify(taxTopics) !== JSON.stringify(draft.classification?.taxTopics ?? [])) classificationChange.taxTopics = taxTopics;
  if (Object.keys(classificationChange).length) operations.push({ kind: "set_classification", change: classificationChange });

  let workingNodes = structuredClone(draft.nodes);
  let workingLinks = structuredClone(draft.links);
  const references = new Map(workingNodes.map((node) => [node.id, node.id]));
  for (const item of nodeProposals) {
    const proposal = requireRecord(item, "node proposal");
    const action = proposal.action;
    if (action !== "add" && action !== "update") throw new Error("Invalid AI node action");
    const ref = boundedString(proposal.ref, 80);
    if (!refPattern.test(ref)) throw new Error("Invalid AI node reference");
    const type = proposal.type;
    if (typeof type !== "string" || !nodeTypes.has(type as StudioNodeType)) throw new Error("Invalid AI node type");
    const title = boundedString(proposal.title, 200);
    if (!title) throw new Error("AI node titles cannot be empty");
    const detail = boundedString(proposal.detail, 4_000, true);
    const runtime = normalizeRuntimeProposal(proposal.runtime, type as StudioNodeType);
    if (action === "add") {
      if (references.has(ref) || proposal.existingNodeId !== null || workingNodes.length >= 200) throw new Error("Invalid AI node addition");
      const id = nextStudioNodeId(workingNodes, type as StudioNodeType);
      const anchor = workingNodes.find((node) => node.id === selectedNodeId) ?? workingNodes.at(-1) ?? null;
      const node: StudioNode = { id, type: type as StudioNodeType, title, detail, ...nextStudioNodePosition(workingNodes, anchor), ...(runtime ? { runtime } : {}) };
      operations.push({ kind: "add_node", node });
      workingNodes.push(node);
      references.set(ref, id);
    } else {
      const existingNodeId = boundedString(proposal.existingNodeId, 80);
      const existing = workingNodes.find((node) => node.id === existingNodeId);
      if (!existing || (references.has(ref) && references.get(ref) !== existing.id)) throw new Error("AI node update references a missing or conflicting node");
      const nextType = type as StudioNodeType;
      if (nextType !== existing.type) throw new Error("AI cannot change an existing node type");
      const change: Extract<StudioPromptOperation, { kind: "update_node" }>["change"] = { title, detail };
      if (runtime) change.runtime = { ...(existing.runtime ?? {}), ...runtime };
      operations.push({ kind: "update_node", nodeId: existing.id, change });
      const { runtime: changedRuntime, ...changedFields } = change;
      workingNodes = workingNodes.map((node) => node.id === existing.id ? { ...node, ...changedFields, ...(Object.hasOwn(change, "runtime") ? { runtime: changedRuntime ?? undefined } : {}) } : node);
      references.set(ref, existing.id);
    }
  }

  for (const item of linkProposals) {
    const proposal = requireRecord(item, "link proposal");
    const action = proposal.action;
    if (action !== "add" && action !== "update") throw new Error("Invalid AI relation action");
    const fromRef = boundedString(proposal.fromRef, 80);
    const toRef = boundedString(proposal.toRef, 80);
    const from = references.get(fromRef);
    const to = references.get(toRef);
    if (!from || !to || from === to) throw new Error("AI relation has an invalid endpoint");
    const rule = normalizeRuleProposal(proposal);
    if (action === "add") {
      if (proposal.existingLinkId !== null) throw new Error("Invalid AI relation addition");
      const duplicate = workingLinks.find((link) => link.from === from && link.to === to);
      if (duplicate) {
        if (rule) operations.push({ kind: "update_link", linkId: duplicate.id, change: rule });
        else diagnostics.push({ level: "info", message: locale === "en" ? `Skipped an existing relation: ${from} → ${to}.` : `Существующая связь пропущена: ${from} → ${to}.` });
        continue;
      }
      if (workingLinks.length >= 500) throw new Error("The AI relation plan exceeds the 500-relation limit");
      const link: StudioLink = { id: nextStudioLinkId(workingLinks), from, to, ...(rule ? { rule } : {}) };
      operations.push({ kind: "add_link", link });
      workingLinks.push(link);
    } else {
      const existingLinkId = boundedString(proposal.existingLinkId, 80);
      const existing = workingLinks.find((link) => link.id === existingLinkId);
      if (!existing || existing.from !== from || existing.to !== to || !rule) throw new Error("AI relation update is invalid");
      operations.push({ kind: "update_link", linkId: existing.id, change: rule });
      workingLinks = workingLinks.map((link) => link.id === existing.id ? { ...link, rule: { ...(link.rule ?? {}), ...rule } } : link);
    }
  }

  let canApply = operations.length > 0 && !diagnostics.some((item) => item.level === "error");
  if (!canApply) diagnostics.push({ level: "error", message: locale === "en" ? "The AI proposal contains no safe changes to apply." : "AI-предложение не содержит безопасных изменений для применения." });
  const plan: StudioPromptPlan = { instruction: clean, operations, diagnostics, canApply, contextOnly: false, planner: "ai", summary, assumptions, warnings };
  if (canApply) {
    const candidate = applyStudioPromptPlan(draft, { plan, locale, createdAt: "2000-01-01T00:00:00.000Z" }).draft;
    if (candidate.nodes.length === 0) throw new Error("AI plan must leave at least one node in the graph");
    normalizeStudioDraft({ ...candidate, title: candidate.title.trim() || "Untitled case" });
    const issueMessages: Record<string, [string, string]> = {
      jurisdiction_role_premise_required: ["Complete the jurisdiction, player role and case context before testing.", "До тестирования заполните юрисдикцию, роль игрока и контекст кейса."],
      core_graph_nodes_required: ["The proposed graph still needs a trigger, actor, evidence, decision and at least two outcomes.", "В предложенной схеме ещё нужны триггер, участник, доказательство, решение и минимум два исхода."],
      invalid_relationship: ["At least one proposed relationship has an unavailable endpoint.", "Как минимум одна предложенная связь ведёт к отсутствующему узлу."],
      disconnected_graph: ["Some proposed nodes are not connected to the case trigger.", "Некоторые предложенные узлы не связаны с триггером кейса."],
      outcome_not_reachable_from_decision: ["Every proposed outcome must be reachable from a decision.", "Каждый предложенный исход должен быть достижим из узла решения."],
      decision_branch_required: ["Every proposed decision needs at least one outgoing choice.", "Для каждого предложенного решения нужен хотя бы один исходящий вариант."],
      tax_graph_nodes_required: ["A tax case still needs entity, cash-flow and tax-rule nodes.", "Для налогового кейса ещё нужны узлы компании, денежного потока и налогового правила."],
      tax_publication_metadata_required: ["Tax publication will remain blocked until the legal-as-of date and verified HTTPS sources are supplied.", "Публикация налогового кейса останется заблокированной до указания даты актуальности права и проверенных HTTPS-источников."],
    };
    for (const issue of studioStructuralIssues(candidate)) {
      const message = issueMessages[issue];
      if (message) warnings.push(message[locale === "en" ? 0 : 1]);
    }
    plan.warnings = [...new Set(warnings)];
    const blocking = newlyIntroducedCompileIssues(draft, candidate);
    if (blocking.length) {
      canApply = false;
      plan.canApply = false;
      diagnostics.push({ level: "error", message: locale === "en"
        ? `The proposal would introduce an invalid playable path (${blocking.map((issue) => issue.code).join(", ")}). Ask AI to revise it or edit the graph manually.`
        : `Предложение создаёт некорректный игровой путь (${blocking.map((issue) => issue.code).join(", ")}). Попросите AI пересобрать план или исправьте схему вручную.` });
    }
  }
  return plan;
}

/**
 * Final client-side trust boundary for a reviewed AI plan. Provider output is
 * never allowed to delete/relink, mutate lineage, change node identity/type or
 * introduce invalid targets. The returned draft is normalized before commit.
 */
export function applyValidatedAIStudioPlan(draft: StudioDraft, values: { plan: unknown; locale: "en" | "ru"; createdAt: string }) {
  if (!isRecord(values.plan) || values.plan.planner !== "ai" || values.plan.canApply !== true || !Array.isArray(values.plan.operations) || values.plan.operations.length > 100) throw new Error("Invalid AI Studio plan");
  const nodeIds = new Set(draft.nodes.map((node) => node.id));
  const nodeTypesById = new Map(draft.nodes.map((node) => [node.id, node.type]));
  const linkIds = new Set(draft.links.map((link) => link.id));
  const linkPairs = new Set(draft.links.map((link) => `${link.from}\u0000${link.to}`));
  for (const rawOperation of values.plan.operations) {
    if (!isRecord(rawOperation) || typeof rawOperation.kind !== "string") throw new Error("Invalid AI Studio operation");
    if (rawOperation.kind === "add_node") {
      if (!isRecord(rawOperation.node) || typeof rawOperation.node.id !== "string" || nodeIds.has(rawOperation.node.id)) throw new Error("Invalid AI node addition");
      nodeIds.add(rawOperation.node.id);
      if (typeof rawOperation.node.type === "string") nodeTypesById.set(rawOperation.node.id, rawOperation.node.type as StudioNodeType);
      continue;
    }
    if (rawOperation.kind === "update_node") {
      if (typeof rawOperation.nodeId !== "string" || !nodeIds.has(rawOperation.nodeId) || !isRecord(rawOperation.change)) throw new Error("Invalid AI node update");
      if (rawOperation.change.type !== undefined && rawOperation.change.type !== nodeTypesById.get(rawOperation.nodeId)) throw new Error("AI node type changes are not permitted");
      continue;
    }
    if (rawOperation.kind === "add_link") {
      if (!isRecord(rawOperation.link) || typeof rawOperation.link.id !== "string" || typeof rawOperation.link.from !== "string" || typeof rawOperation.link.to !== "string"
        || linkIds.has(rawOperation.link.id) || !nodeIds.has(rawOperation.link.from) || !nodeIds.has(rawOperation.link.to) || rawOperation.link.from === rawOperation.link.to) throw new Error("Invalid AI relation addition");
      const pair = `${rawOperation.link.from}\u0000${rawOperation.link.to}`;
      if (linkPairs.has(pair)) throw new Error("Duplicate AI relation");
      linkIds.add(rawOperation.link.id); linkPairs.add(pair);
      continue;
    }
    if (rawOperation.kind === "update_link") {
      if (typeof rawOperation.linkId !== "string" || !linkIds.has(rawOperation.linkId) || !isRecord(rawOperation.change)) throw new Error("Invalid AI relation update");
      continue;
    }
    if (rawOperation.kind === "append_context") {
      if (typeof rawOperation.value !== "string" || !rawOperation.value.trim() || rawOperation.value.length > 8_000) throw new Error("Invalid AI context update");
      continue;
    }
    if (rawOperation.kind === "set_case_field") {
      if (!(["caseId", "title", "jurisdiction", "role"] as const).includes(rawOperation.field as "caseId") || typeof rawOperation.value !== "string") throw new Error("AI case-field update is not permitted");
      continue;
    }
    if (rawOperation.kind === "set_classification") {
      if (!isRecord(rawOperation.change)) throw new Error("Invalid AI classification update");
      continue;
    }
    throw new Error("Destructive AI Studio operations are not permitted");
  }
  const typedPlan = values.plan as unknown as StudioPromptPlan;
  const result = applyStudioPromptPlan(draft, { plan: typedPlan, locale: values.locale, createdAt: values.createdAt });
  if (!result.changed || JSON.stringify(result.draft.parent) !== JSON.stringify(draft.parent) || JSON.stringify(result.draft.protection) !== JSON.stringify(draft.protection)) throw new Error("AI plan attempted to change protected lineage state");
  const normalized = normalizeStudioDraft({ ...result.draft, ...(draft.protection ? { protection: draft.protection } : {}) });
  if (newlyIntroducedCompileIssues(draft, normalized).length) throw new Error("AI plan no longer passes the graph safety check");
  if (caseFingerprint(normalized) === caseFingerprint(draft)) return { ...result, draft, changed: false };
  return { ...result, draft: { ...normalized, parent: draft.parent, ...(draft.protection ? { protection: draft.protection } : {}) } };
}

/**
 * Builds the exact reviewed candidate without mutating the live draft. The
 * same trust boundary used by Apply is reused so the visual preview cannot
 * depict a graph that final application would reject.
 */
export function previewValidatedAIStudioPlan(draft: StudioDraft, values: { plan: unknown; locale: "en" | "ru" }) {
  return applyValidatedAIStudioPlan(draft, {
    plan: values.plan,
    locale: values.locale,
    createdAt: "2000-01-01T00:00:00.000Z",
  }).draft;
}

function newlyIntroducedCompileIssues(base: StudioDraft, candidate: StudioDraft) {
  const issueKey = (issue: ReturnType<typeof compileStudioDraft>["issues"][number]) => `${issue.code}:${[...issue.nodeIds].sort().join(",")}`;
  const existing = new Set(compileStudioDraft(base).issues.map(issueKey));
  return compileStudioDraft(candidate).issues.filter((issue) => issue.code === "cycle" || !existing.has(issueKey(issue)));
}

function normalizeRuntimeProposal(value: unknown, type: StudioNodeType): StudioNode["runtime"] {
  const runtime = requireRecord(value, "node runtime");
  const day = nullableInteger(runtime.day, 1, 10_000);
  const time = nullableClock(runtime.time);
  const pressure = nullableString(runtime.pressure, 2_000);
  const terminalOutcome: NonNullable<StudioNode["runtime"]>["terminalOutcome"] = type === "outcome" && (runtime.terminalOutcome === "strong" || runtime.terminalOutcome === "mixed" || runtime.terminalOutcome === "weak") ? runtime.terminalOutcome : undefined;
  if (runtime.terminalOutcome !== null && !terminalOutcome) throw new Error("Invalid AI terminal outcome");
  const deadlineDay = type === "deadline" ? nullableInteger(runtime.deadlineDay, 1, 10_000) : undefined;
  const deadlineTime = type === "deadline" ? nullableClock(runtime.deadlineTime) : undefined;
  if (runtime.deadlineDay !== null || runtime.deadlineTime !== null) {
    if (type !== "deadline" || deadlineDay === null || deadlineTime === null) throw new Error("AI deadlines require a sourced day and time");
  }
  const budgetCostEur = nullableInteger(runtime.budgetCostEur, 0, 1_000_000_000);
  const durationMinutes = nullableInteger(runtime.durationMinutes, 0, 100_000_000);
  const result: NonNullable<StudioNode["runtime"]> = {
    ...(day !== null ? { day } : {}),
    ...(time !== null ? { time } : {}),
    ...(pressure !== null ? { pressure } : {}),
    ...(terminalOutcome ? { terminalOutcome } : {}),
    ...(deadlineDay !== null && deadlineDay !== undefined ? { deadlineDay } : {}),
    ...(deadlineTime !== null && deadlineTime !== undefined ? { deadlineTime } : {}),
    ...(budgetCostEur !== null ? { budgetCostEur } : {}),
    ...(durationMinutes !== null ? { durationMinutes } : {}),
  };
  return Object.keys(result).length ? result : undefined;
}

function normalizeRuleProposal(proposal: Record<string, unknown>): StudioLink["rule"] {
  const label = nullableString(proposal.label, 200);
  const detail = nullableString(proposal.detail, 4_000);
  const result = nullableString(proposal.result, 4_000);
  const cost = nullableInteger(proposal.cost, 0, 1_000_000_000);
  const minutes = nullableInteger(proposal.minutes, 0, 100_000_000);
  const rawEffects = requireRecord(proposal.effects, "relation effects");
  const effects: Partial<Record<MetricKey, number>> = {};
  for (const metric of metrics) {
    const effect = nullableInteger(rawEffects[metric], -100, 100);
    if (effect !== null) effects[metric] = effect;
  }
  const repeatability = proposal.repeatability === "once" || proposal.repeatability === "repeatable" || proposal.repeatability === "limited" ? proposal.repeatability : null;
  if (proposal.repeatability !== null && !repeatability) throw new Error("Invalid AI relation repeatability");
  const maxUses = nullableInteger(proposal.maxUses, 1, 10_000);
  if ((repeatability === "limited") !== (maxUses !== null)) throw new Error("Limited AI relations require maxUses");
  const rule: NonNullable<StudioLink["rule"]> = {
    ...(label !== null ? { label } : {}),
    ...(detail !== null ? { detail } : {}),
    ...(result !== null ? { result } : {}),
    ...(cost !== null ? { cost } : {}),
    ...(minutes !== null ? { minutes } : {}),
    ...(Object.keys(effects).length ? { effects } : {}),
    ...(repeatability ? { repeatability } : {}),
    ...(maxUses !== null ? { maxUses } : {}),
  };
  return Object.keys(rule).length ? rule : undefined;
}

function boundedString(value: unknown, maximum: number, allowEmpty = false) {
  if (typeof value !== "string" || value.length > maximum) throw new Error("Invalid AI text value");
  const clean = value.trim();
  if (!allowEmpty && !clean) throw new Error("AI text value cannot be empty");
  return clean;
}

function nullableString(value: unknown, maximum: number) {
  if (value === null) return null;
  return boundedString(value, maximum);
}

function boundedList(value: unknown, maximumItems: number, maximumLength: number) {
  const values = requireArray(value, maximumItems, "text list").map((item) => boundedString(item, maximumLength)).filter(Boolean);
  return [...new Set(values)];
}

function nullableInteger(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error("Invalid AI integer value");
  return value;
}

function nullableClock(value: unknown) {
  const clock = nullableString(value, 5);
  if (clock !== null && !clockPattern.test(clock)) throw new Error("Invalid AI clock value");
  return clock;
}

function requireRecord(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`Invalid AI ${label}`);
  return value;
}

function requireArray(value: unknown, maximum: number, label: string) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`Invalid AI ${label}`);
  return value;
}
