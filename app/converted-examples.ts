import canonicalBundle from "./canonical-case-bundle.json";
import { applyCaseType } from "./case-type-registry";
import { caseTypePlaybook } from "./case-type-playbooks";
import { caseTypeReference } from "./case-type-reference";
import type { CaseTypeId, StudioDraft, StudioNodeType, StudioLink } from "./types";

export const CONVERTED_EXAMPLES: Record<string, { category: CaseTypeId; title: string; description: string; topics: string[] }> = {
  be_commercial_failed_erp_001: { category: "litigation_strategy", title: "Failed ERP Implementation", description: "Assess Asteron Systems' ERP supplier dispute. Review scope changes, acceptance records and causation evidence; compare settlement and a claim, then prepare a strategy and risk report.", topics: ["ERP", "Commercial dispute", "Contract interpretation"] },
  be_commercial_logistics_001: { category: "litigation_strategy", title: "Unpaid Logistics Invoices", description: "Review Velmont Logistics' unpaid freight and warehousing invoices. Separate supported amounts from disputed service charges, compare negotiated recovery with a claim, and identify missing delivery evidence.", topics: ["Commercial recovery", "Logistics", "Disputed invoices"] },
  greenfire_first_72_hours: { category: "investigation", title: "GreenFire — The First 72 Hours", description: "Investigate an industrial fire. Build a sourced chronology, preserve evidence, distinguish findings from hypotheses, and assign the urgent regulatory, insurance and operational follow-up actions.", topics: ["Industrial fire", "Insurance", "Regulatory response"] },
  nl_food_safety_goldenshell_001: { category: "compliance", title: "GoldenShell — Recall at Dawn", description: "Assess GoldenShell's food-safety response. Trace affected products, review containment and recall options, and build a remediation plan with owners, evidence requirements and release conditions.", topics: ["Food safety", "Product recall", "Regulatory response"] },
  us_environmental_desert_water_001: { category: "litigation_strategy", title: "Desert Water", description: "Assess a potential groundwater contamination claim. Separate suspected exposure from proven causation, identify sampling and expert-evidence gaps, and compare investigation, negotiated resolution and litigation routes.", topics: ["Environmental claims", "Investigation", "Groundwater"] },
};
export const CONVERTED_EXAMPLE_VERSION = "2.1.0";

type RecordItem = { id: string; title?: string; name?: string; description?: string; statement?: string; summary?: string; initial_status?: string; initially_available?: boolean; initially_visible?: boolean; supports_facts?: string[]; related_actors?: string[]; role?: string; body?: string; sender?: string; subject?: string; exit_actions?: string[]; terminal_stage?: string; effects?: Effect[]; trigger?: Condition; condition?: Condition; available_when?: Condition; due_at?: { day: number; minute_of_day: number }; completion_actions?: string[]; start_action?: string; completion_event?: string; usable_until_event?: string; duration_minutes?: number; time_cost_minutes?: number; cost_eur?: number; branches?: RecordItem[] };
type ResponseWindow = { id: string; source_actor_id: string; activation_event_id: string; response_deadline_id: string; response_action_ids: string[]; countermove_event_id: string };
type Effect = { type: string; resource?: string; amount?: number; stage?: string; event?: string; decision?: string; outcome?: string; evidence?: string; fact?: string; flag?: string; item?: string; task?: string; deadline?: string; result?: string; status?: string; value?: unknown };
type Condition = { type?: string; stage?: string; action?: string; event?: string; evidence?: string; fact?: string; flag?: string; deadline?: string; task?: string; result?: string; value?: unknown; status?: string; conditions?: Condition[]; condition?: Condition; at?: { day: number; minute_of_day: number } };
type SourceCase = {
  case_id: string; scenario_fingerprint: string; jurisdiction: string;
  localizations: Record<string, { player_client_name?: string; player_client_role?: string; synopsis?: string }>;
  scenario_localizations?: Record<string, Record<string, Record<string, Record<string, string>>>>;
  scenario: {
    initial_resources?: Record<string, number>; metadata: { content_version: string }; initial_stage: string;
    actors: RecordItem[]; facts: RecordItem[]; evidence: RecordItem[]; stages: RecordItem[]; actions: RecordItem[];
    deadlines: RecordItem[]; async_tasks: RecordItem[]; pressure_windows?: ResponseWindow[];
    inbox_items: RecordItem[]; events: RecordItem[]; outcomes: RecordItem[]; deterministic_decisions?: RecordItem[];
  };
};
const sources = canonicalBundle.cases as unknown as SourceCase[];
const gameOnly = (id: string) => /^(rest|rest_completed|rest_recovery_applied)$/.test(id) || /inactivity|client_warning|fatigue|stamina|strain/.test(id);
const human = (id = "") => id.replace(/[_-]/g, " ");
const judgments: Record<string, string> = { won: 'favorable judgment', lost: 'adverse judgment', partially_won: 'partial relief', dismissed: 'dismissal', none: 'no judgment' };
function conditionText(c?: Condition): string {
  if (!c) return "";
  if (c.conditions) {
    const items = c.conditions.map(conditionText).filter(Boolean);
    return items.length ? "(" + items.join(c.type === "any" ? " OR " : " AND ") + ")" : "Scenario conditions require independent review.";
  }
  if (c.condition) return (c.type === "not" ? "NOT (" + conditionText(c.condition) + ")" : conditionText(c.condition));
  if (c.type === 'integer_compare' || c.type?.includes("metric") || c.type?.includes("resource")) return "Source support requires review; game thresholds excluded.";
  if (c.deadline) return "Deadline condition: " + c.deadline + " = " + (c.status ?? (c.type === 'deadline_missed' ? 'missed' : 'unresolved')) + " (unverified)";
  if (c.task) return "Hypothetical task: " + c.task + " = " + (c.status ?? (c.type === 'async_task_completed' ? 'completed' : 'unresolved')) + " (unverified)";
  if (c.type === 'judicial_result_is') {
    const result = judgments[c.result ?? ''] ?? human(c.result);
    return "Hypothetical judgment: " + result + " (unrecorded)";
  }
  if (c.stage) return "Optional phase: " + human(c.stage);
  if (c.fact) return "Fact to verify: " + c.fact + " (" + (c.status ?? c.value ?? "unresolved") + ")";
  if (c.evidence) return "Evidence to verify: " + c.evidence;
  if (c.flag) return "Assumption: " + human(c.flag) + " = " + String(c.value);
  if (c.action) return "If option considered: " + c.action;
  if (c.event) return "If hypothetical event occurs: " + c.event;
  if (c.at) return "Illustrative relative date: day " + c.at.day + ", minute " + c.at.minute_of_day;
  if (c.type === 'by_effect') return 'Hypothetical consequence of an authored option; occurrence is not recorded.';
  return 'Scenario condition requires independent review: ' + human(c.type ?? 'unspecified condition') + '.';
}
function consequence(e: Effect): string {
  if (e.resource?.endsWith("_eur") && typeof (e.value ?? e.amount) === "number") return "Hypothetical monetary assumption: " + human(e.resource) + " " + (e.type === "add_resource" ? "change " : "estimate ") + "EUR " + String(e.value ?? e.amount) + " (legacy branch; not a recorded award/payment/cost).";
  if (e.type === "set_stage") return "Optional next phase: " + e.stage;
  if (e.type === "trigger_event") return "Hypothetical event: " + e.event;
  if (e.type === "resolve_decision" || e.type === "resolve_deterministic_decision") return "Hypothetical scenario comparison: " + e.decision + "; no branch is selected or recorded as completed.";
  if (e.type === "set_judicial_result") return "Hypothetical judgment: " + (judgments[e.result ?? ''] ?? human(e.result)) + " (unrecorded).";
  if (e.task) {
    const taskChanges: Record<string, string> = { start_async_task: 'start', review_async_task: 'review', mark_async_task_ready: 'ready for review', expire_async_task: 'expiry' };
    if (taskChanges[e.type]) return "Hypothetical task " + taskChanges[e.type] + ": " + e.task + " (timing/completion unverified; status unchanged).";
  }
  if (e.deadline && (e.type === "complete_deadline" || e.type === "miss_deadline")) return "Hypothetical deadline " + (e.type === "complete_deadline" ? "completion" : "miss") + ": " + e.deadline + " (law/date/completion unverified; not recorded).";
  if (e.type.includes("outcome")) return "Hypothetical outcome: " + e.outcome;
  if (e.type.includes("evidence") && e.evidence) return "Evidence requirement: " + e.evidence + "; obtain and review before relying on it.";
  if (e.type.includes("fact") && e.fact) return "Hypothetical fact change: " + e.fact + " — " + (e.status ?? e.value ?? "review required");
  if (e.type === "set_flag" && e.flag && !gameOnly(e.flag)) return "Scenario assumption: " + human(e.flag) + " = " + String(e.value);
  if (e.type.includes("inbox") && e.item) return "Hypothetical correspondence " + (e.type === "resolve_inbox_item" ? "resolution" : "creation") + ": " + e.item + " (unrecorded).";
  return "";
}
function consequences(effects: Effect[]): string[] {
  const texts: string[] = [];
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index];
    if (effect.item && (effect.type === "create_inbox_item" || effect.type === "resolve_inbox_item")) {
      const items = [effect.item];
      while (effects[index + 1]?.type === effect.type && effects[index + 1]?.item) items.push(effects[++index].item!);
      texts.push("Hypothetical correspondence " + (effect.type === "resolve_inbox_item" ? "resolution" : "creation") + " (unrecorded): " + items.join(", "));
    } else {
      const text = consequence(effect);
      if (text) texts.push(text);
    }
  }
  return texts;
}

/** Pure, additive migration. Canonical simulation payloads and session fingerprints stay untouched.
 * Case/source IDs are retained; server save identity is cleared by the standard launch workflow.
 * Evidence descriptions are the retained source register, not fabricated document contents.
 */
export function buildConvertedExample(caseId: string, locale: "en" | "ru", updatedAt = new Date().toISOString()): StudioDraft {
  const spec = CONVERTED_EXAMPLES[caseId], source = sources.find(c => c.case_id === caseId);
  if (!spec || !source) throw new Error("Unknown converted example");
  const s = source.scenario, nodes: StudioDraft["nodes"] = [], links: StudioLink[] = [];
  const local = source.localizations[locale] ?? source.localizations.en;
  const translated = (group: string, item: RecordItem, field: string, fallback: string) => source.scenario_localizations?.[locale]?.[group]?.[item.id]?.[field] ?? fallback;
  const add = (id: string, type: StudioNodeType, title: string, detail: string) => {
    const index = nodes.length;
    nodes.push({ id, type, title: title.slice(0, 200), detail: detail.trim(), x: 30 + index % 10 * 260, y: 30 + Math.floor(index / 10) * 210 });
  };
  const edge = (from: string, to: string, label: string) => {
    if (from !== to && nodes.some(n => n.id === from) && nodes.some(n => n.id === to)) links.push({ id: "reference-" + links.length, from, to, rule: { label } });
  };
  const owner = local.player_client_name ?? source.localizations.en.player_client_name ?? "Decision owner to confirm";
  const output = caseTypePlaybook(caseTypeReference(spec.category)).primaryOutcome[locale];
  add("brief", "trigger", spec.title, spec.description + "\nDecision owner / client: " + owner + "\n" + (local.synopsis ?? "") + "\nOutput: " + output);
  add("review-assumptions", "fact", "Assumptions and evidence gaps", "Legacy source package: " + caseId + " @ " + s.metadata.content_version + "; original simulation fingerprint: " + source.scenario_fingerprint + "\nAll organisations, records and events are fictional. Source register descriptions are retained exactly; full document bodies were not supplied by the legacy package. Initially unavailable evidence remains missing. Allegations, expert conclusions, notifications and branch outcomes require review. Relative dates and costs are illustrative legacy estimates, not verified legal deadlines or market prices. Confirm jurisdiction, actual dates, owners and provenance before relying on them. No gameplay scores establish source support.");
  add("report-outline", "outcome", output + " — outline", "Mandate and decision owner; source register and exact identifiers; supported facts, disputed allegations and confidence explanations; chronology; evidence and causation gaps; competing options and hypothetical scenarios; rationale, conditions and release criteria; actions, owners and dates subject to verification; decision map and source links. This is an analytical draft, not an approved conclusion.");
  for (const actor of s.actors) add("actor-" + actor.id, "actor", actor.role === "player" ? "Responsible counsel" : actor.name ?? actor.id, "Canonical actor: " + actor.id + "\nRole: " + (actor.role === "player" ? "Responsible counsel" : actor.role ?? "reviewer") + "\n" + translated("actors", actor, "description", actor.description ?? "") + "\nReview owner: " + owner);
  for (const fact of s.facts) add("fact-" + fact.id, "fact", human(fact.id), translated("facts", fact, "statement", fact.statement ?? "") + "\nCanonical fact: " + fact.id + "\nFictional source status: " + (fact.initial_status ?? "unknown") + ". This records the authored status, not independent verification.\nConfidence: assess each supporting source, contradictions and missing records before accepting this statement.");
  nodes.find(n => n.id === "review-assumptions")!.factStatus = "assumed";
  if (s.initial_resources?.authorized_budget_eur !== undefined) nodes.find(n => n.id === "review-assumptions")!.detail += "\nIllustrative authorised-budget estimate: EUR " + s.initial_resources.authorized_budget_eur + "; provenance: legacy opening resource. Confirm with decision owner; this is not an enforced action quota or actual spending history.";
  for (const fact of s.facts) nodes.find(n => n.id === "fact-" + fact.id)!.factStatus = ["proven", "admitted"].includes(fact.initial_status ?? "") ? "asserted" : "assumed";
  for (const evidence of s.evidence) {
    add("evidence-" + evidence.id, "evidence", translated("evidence", evidence, "title", evidence.title ?? evidence.id), "Source ID: " + evidence.id + "\nSource package: " + caseId + " @ " + s.metadata.content_version + "\n" + translated("evidence", evidence, "description", evidence.description ?? "Only the source title and links were supplied; document contents remain unavailable.") + "\nAvailability: " + (evidence.initially_available ? "listed as initially available in the fictional source register; original contents require inspection" : "missing / obtain and review; no branch-generated acquisition is treated as fact") + "\nSupports fact IDs: " + (evidence.supports_facts?.join(", ") || "not specified") + "\nReview: provenance, authenticity, limitations and contradictions unresolved.");
  }
  for (const stage of s.stages) add("stage-" + stage.id, "decision", translated("stages", stage, "title", stage.title ?? stage.id), "Canonical phase: " + stage.id + "\n" + (stage.id === s.initial_stage ? "Opening review task." : "Optional procedural / chronology task, not an event that has occurred.") + "\nOwner: " + owner + "\nDate: unresolved; verify before scheduling.\nOptions: " + (stage.exit_actions?.filter(id => !gameOnly(id)).join(", ") || "Review source evidence and determine next actions.") + "\nNo mandatory route, action quota or score threshold applies.");
  for (const action of s.actions.filter(a => !gameOnly(a.id))) {
    const conditions = conditionText(action.available_when);
    const conditionId = "conditions-" + action.id;
    const separateConditions = conditions.length > 850;
    if (separateConditions) {
      add(conditionId, "fact", "Hypothetical conditions: " + translated("actions", action, "title", action.title ?? action.id), "Canonical option: " + action.id + "\nUnverified optional conditions:\n" + conditions + "\nNo completion or source verification is recorded.");
      nodes[nodes.length - 1].factStatus = "assumed";
    }
    const detail = [translated("actions", action, "description", action.description ?? ""),
      "Canonical option: " + action.id, "Owner: " + owner, separateConditions ? "Unverified option conditions: " + conditionId + "; inspect the linked assumptions record." : conditions,
      ...consequences(action.effects ?? []),
      action.cost_eur !== undefined ? "Illustrative cost: EUR " + action.cost_eur + " (legacy option " + action.id + "; unverified)." : "",
      action.time_cost_minutes !== undefined ? "Illustrative duration: " + action.time_cost_minutes + " minutes (unverified)." : "",
      "Hypothetical only; no completion or source verification is recorded."].filter(Boolean).join("\n");
    add("action-" + action.id, "decision", translated("actions", action, "title", action.title ?? action.id), detail);
    if (separateConditions) edge(conditionId, "action-" + action.id, "Hypothetical option conditions");
  }
  for (const deadline of s.deadlines) add("deadline-" + deadline.id, "deadline", deadline.title ?? deadline.id, "Task ID: " + deadline.id + "\nOwner: " + owner + "\nIllustrative relative date: day " + deadline.due_at?.day + ", minute " + deadline.due_at?.minute_of_day + "; provenance: legacy scenario deadline. Not a verified jurisdiction-specific deadline. Anchor to a confirmed incident / procedural date before use.\nCandidate actions: " + deadline.completion_actions?.join(", ") + "\nStatus: not completed; verify applicable law and actual due date.");
  for (const task of s.async_tasks) add("task-" + task.id, "deadline", task.title ?? task.id, "Task ID: " + task.id + "\nOwner: " + owner + "\nStart option: " + task.start_action + "\nIllustrative duration: " + task.duration_minutes + " minutes; provenance: legacy task estimate. Actual start/date unresolved.\nHypothetical follow-up: " + task.completion_event + ". No expert result is established by this estimate." + (task.usable_until_event ? "\nIllustrative review window ends at scenario event: " + task.usable_until_event + " (legacy task assumption; actual availability/expiry unverified)." : ""));
  for (const window of s.pressure_windows ?? []) {
    const deadline = nodes.find(node => node.id === "deadline-" + window.response_deadline_id);
    if (deadline) deadline.detail += "\nHypothetical response window: " + window.id + "\nSource actor: " + window.source_actor_id + "\nActivation scenario: " + window.activation_event_id + "\nCandidate responses: " + window.response_action_ids.join(", ") + "\nMissed-response scenario: " + window.countermove_event_id + " (legacy scenario context; no notice, response or deadline status is recorded).";
  }
  for (const item of s.inbox_items) add("inbox-" + item.id, item.initially_visible ? "evidence" : "outcome", item.subject ?? item.id, "Correspondence ID: " + item.id + "\nSender: " + (item.sender ?? "not specified") + "\n" + (item.initially_visible ? "Fictional opening correspondence, not independently verified." : "Hypothetical later correspondence; not received.") + "\n" + (item.body ?? "") + "\nOwner: " + owner);
  for (const outcome of s.outcomes) add("outcome-" + outcome.id, "outcome", "Hypothetical: " + translated("outcomes", outcome, "title", outcome.title ?? outcome.id), translated("outcomes", outcome, "summary", outcome.summary ?? "") + "\nCanonical outcome: " + outcome.id + "\nAssumptions: " + conditionText(outcome.condition) + "\nThis is an optional hypothetical scenario, not a judgment, notification, finding or event that has occurred.");
  // Keep branch records and their authored semantic consequences; omit numeric roll / score mechanics.
  for (const decision of (s.deterministic_decisions ?? []).filter(item => !gameOnly(item.id))) for (const branch of decision.branches ?? []) {
    add("branch-" + decision.id + "-" + branch.id, "outcome", "Hypothetical: " + human(branch.id), "Decision branch: " + decision.id + " / " + branch.id + "\n" + conditionText(branch.condition) + "\n" + consequences(branch.effects ?? []).join("\n") + "\nNo judgment or success probability is asserted. Reassess sources and procedural requirements independently.");
  }
  // Event consequences are explicit hypotheses, never source-level facts.
  for (const event of s.events.filter(e => !gameOnly(e.id))) {
    const effects = consequences(event.effects ?? []);
    if (!effects.length) continue;
    const target = s.actions.find(a => (a.effects ?? []).some(e => e.event === event.id) || event.trigger?.action === a.id);
    const planningEffect = event.effects?.find(effect => effect.task || effect.deadline);
    const option = nodes.find(n => n.id === "action-" + target?.id);
    const destination = option ?? nodes.find(n => n.id === (planningEffect?.task ? "task-" + planningEffect.task : "deadline-" + planningEffect?.deadline));
    const text = "\nHypothetical event " + event.id + ": " + (event.title ?? "") + "\n" + conditionText(event.trigger) + "\n" + conditionText(event.condition) + "\n" + effects.join("\n");
    // Keep the full event as its own hypothetical record when embedding would
    // overfill a printable planning card. Never truncate its source semantics.
    if (destination && destination.detail.length + text.length <= (option ? 4000 : 900)) destination.detail += text;
    else add("event-" + event.id, "outcome", "Hypothetical: " + (event.title ?? human(event.id)), text + "\nNot established evidence; verify independently.");
  }
  for (const evidence of s.evidence) for (const factId of evidence.supports_facts ?? []) edge("evidence-" + evidence.id, "fact-" + factId, "Source register support — review required");
  for (const stage of s.stages) for (const actionId of stage.exit_actions ?? []) edge("stage-" + stage.id, "action-" + actionId, "Optional task / option");
  const effectLinks = (from: string, effects: Effect[]) => {
    for (const effect of effects) {
      if (effect.stage) edge(from, "stage-" + effect.stage, "Hypothetical next phase");
      if (effect.evidence) edge(from, "evidence-" + effect.evidence, "Evidence requirement");
      if (effect.outcome) edge(from, "outcome-" + effect.outcome, "Hypothetical outcome");
      if (effect.task) edge(from, "task-" + effect.task, "Optional task reference");
      if (effect.deadline) edge(from, "deadline-" + effect.deadline, "Optional deadline reference");
      if (effect.decision) for (const branch of s.deterministic_decisions?.find(item => item.id === effect.decision)?.branches ?? []) edge(from, "branch-" + effect.decision + "-" + branch.id, "Compare hypothetical branch");
    }
  };
  for (const action of s.actions) effectLinks("action-" + action.id, action.effects ?? []);
  const groupTail = new Map<StudioNodeType, string>();
  for (const node of nodes) {
    if (node.id === "brief") continue;
    edge(groupTail.get(node.type) ?? "brief", node.id, "Related review record / optional scenario, not execution order");
    groupTail.set(node.type, node.id);
  }
  if (groupTail.get("decision")) edge(groupTail.get("decision")!, "report-outline", "Compare hypothetical scenarios and prepare report");
  return applyCaseType({
    caseId, version: CONVERTED_EXAMPLE_VERSION, parent: { caseId, version: s.metadata.content_version, fingerprint: source.scenario_fingerprint },
    title: spec.title, jurisdiction: source.jurisdiction, role: local.player_client_role ?? "Responsible counsel",
    premise: spec.description + "\nDecision owner: " + owner + "\n" + (local.synopsis ?? "") + "\nFictional example. Branch-generated results are hypothetical. Legacy source IDs and original simulation fingerprint are retained in lineage.\nExpected output: " + output,
    premisePublication: "author-reviewed", nodes, links, editHistory: [], updatedAt,
    classification: { practiceArea: "", difficulty: "Intermediate", tags: [...spec.topics, "fictional", "converted-example"], taxTopics: [], complianceOnly: true },
  }, spec.category);
}
