import bundle from "./canonical-case-bundle.json";
import { canonicalFingerprint, isRecord } from "./case-integrity";
import { isConvertedGameplayId, convertedEffectText } from "./converted-examples";
import { projectionInventory, validateProjectionAudit, type ProjectionAudit, type ProjectionDisposition } from "./projection-audit";
import type { StudioDraft } from "./types";

const metricEffects = new Set(["add_metric", "subtract_metric", "clamp_metric", "set_metric"]);
const trainingMetrics = new Set(["ai_damages_model_revision", "ai_legal_research_revision", "ai_request_limit", "ai_requests_used",
  "appeal_record_scaled", "case_strength", "cassation_record_scaled", "client_trust", "client_warning_level", "cumulative_strain",
  "ethics", "evidence", "fatigue", "inactivity_minutes", "judgment_score_scaled", "known_facts_revision", "leverage", "merits", "procedure"]);
const trainingIds = new Set(["rest", "rest_completed", "rest_recovery_applied", "inactivity_consequence", "client_inactivity_warning",
  "client_final_inactivity_warning", "client_terminated_engagement", "inactivity_first_warning_reached", "inactivity_final_warning_reached",
  "inactivity_termination_reached", "client_engagement_terminated"]);
const semanticEffects = new Set(["set_stage", "trigger_event", "resolve_decision", "resolve_deterministic_decision",
  "set_judicial_result", "start_async_task", "review_async_task", "mark_async_task_ready", "expire_async_task",
  "complete_deadline", "miss_deadline", "resolve_outcome", "make_evidence_available", "set_fact_status",
  "set_flag", "create_inbox_item", "resolve_inbox_item"]);
const semanticConditions = new Set(["all", "any", "not", "after_action", "after_event", "async_task_completed",
  "async_task_status_is", "at_time", "by_effect", "deadline_missed", "deadline_status_is", "flag_equals",
  "judicial_result_is", "stage_is"]);
const prefixes: Record<string, string> = { actors: "actor-", facts: "fact-", evidence: "evidence-", stages: "stage-",
  actions: "action-", deadlines: "deadline-", async_tasks: "task-", inbox_items: "inbox-", outcomes: "outcome-" };
const contextFields = new Set(["schema_version", "metadata", "jurisdiction", "initial_stage", "clock", "initial_clock"]);

/** Audits the existing projection; never repairs or rewrites it on case open. */
export function buildConvertedProjectionAudit(caseId: string, template: StudioDraft) {
  const source = bundle.cases.find(item => item.case_id === caseId);
  if (!source) throw new Error("Unknown canonical projection source");
  const scenario = source.scenario as unknown as Record<string, unknown>;
  const inventory = projectionInventory(scenario);
  const nodeIds = new Set(template.nodes.map(node => node.id));
  const projectedTargets = (item: typeof inventory[number]): string[] => {
    if (prefixes[item.kind]) return [prefixes[item.kind] + item.sourceId].filter(id => nodeIds.has(id));
    if (item.kind === "pressure_windows" && isRecord(item.original)) return ["deadline-" + item.original.response_deadline_id].filter(id => nodeIds.has(id));
    if (item.kind === "events") return template.nodes.filter(node => node.detail.includes("Hypothetical event " + item.sourceId + ":")).map(node => node.id);
    if (item.kind === "deterministic_decisions") return template.nodes.filter(node => node.id.startsWith("branch-" + item.sourceId + "-")).map(node => node.id);
    if (item.kind === "branch") {
      const parent = inventory.find(owner => owner.path === item.path.split("/branches/")[0]);
      return ["branch-" + parent?.sourceId + "-" + item.sourceId].filter(id => nodeIds.has(id));
    }
    if (item.kind === "initial_resources" && (item.sourceId === "authorized_budget_eur" || template.version !== "2.2.0" && ["award_eur", "billable_minutes", "outcome_costs_eur", "spend_eur"].includes(item.sourceId))) return ["review-assumptions"];
    if (item.kind === "action_reference") return ["action-" + item.sourceId].filter(id => nodeIds.has(id));
    return [];
  };
  const entries: ProjectionAudit["entries"] = [];
  for (const item of inventory) {
    const parent = [...entries].reverse().find(owner => item.path.startsWith(owner.path + "/") && owner.kind !== "condition");
    let targets = ["effect", "condition"].includes(item.kind) ? [...(parent?.targets ?? [])] : projectedTargets(item);
    let disposition: ProjectionDisposition = "requires_review";
    let reason = "Source material is retained in this audit, but no complete professional projection is established. Inspect it before relying on the conversion.";
    const original = isRecord(item.original) ? item.original : {};
    const type = typeof original.type === "string" ? original.type : "";
    const excludedOwner = parent?.disposition === "excluded_gameplay";
    if ((!(["effect", "condition", "configuration"].includes(item.kind)) && trainingIds.has(item.sourceId)) || excludedOwner) {
      disposition = "excluded_gameplay"; targets = [];
      reason = excludedOwner ? "Excluded with its explicitly training-only parent record, not because this nested value is adverse or monetary. Original value and operands remain intact in the simulation and audit."
        : "Training rest/recovery, stamina, inactivity warning/termination or training-eligibility record. Original source remains intact; it is excluded from the professional workflow.";
    } else if (item.kind === "initial_metrics" || item.kind === "configuration" && ["foreground_metric_rates", "numeric_metrics"].includes(item.sourceId)) {
      if (item.kind === "initial_metrics" ? trainingMetrics.has(item.sourceId) : isRecord(item.original) && Object.keys(item.original).every(id => trainingMetrics.has(id))) {
        disposition = "excluded_gameplay"; targets = [];
        reason = "Initial numeric gameplay scores or score-rate configuration. Retained in the original simulation and this audit, not professional evidence confidence.";
      }
    } else if (item.kind === "configuration" && contextFields.has(item.sourceId)) {
      disposition = "reference_only"; targets = [];
      reason = "Original scenario metadata, jurisdiction, opening phase or relative clock retained as source context only. Not an operational schedule or verified jurisdiction-specific rule.";
    } else if (item.kind === "effect") {
      if (metricEffects.has(type) && typeof original.metric === "string" && trainingMetrics.has(original.metric)
        || ["item", "outcome", "flag"].some(field => typeof original[field] === "string" && trainingIds.has(original[field]))) {
        disposition = "excluded_gameplay"; targets = [];
        reason = "Numeric gameplay score/strain mutation or explicitly excluded training correspondence/outcome/eligibility effect. It does not establish evidence support or a professional result.";
      } else if ((semanticEffects.has(type) || ["set_resource", "add_resource"].includes(type) && typeof original.resource === "string" && original.resource.endsWith("_eur"))
        && convertedEffectText(original as Parameters<typeof convertedEffectText>[0])) {
        disposition = targets.length ? "hypothetical" : "requires_review";
        reason = "Authored consequence retained as an unrecorded hypothetical requirement or monetary assumption, not completed work, acquired evidence or an actual award/payment. Inspect original operands.";
      }
    } else if (item.kind === "condition") {
      const metricOperand = (value: unknown) => isRecord(value) && value.source === "metric" && typeof value.metric === "string" && trainingMetrics.has(value.metric);
      if (type === "metric_threshold_reached" && typeof original.metric === "string" && trainingMetrics.has(original.metric)
        || type === "integer_compare" && metricOperand(original.left) && (metricOperand(original.right) || isRecord(original.right) && original.right.source === "constant")
        || typeof original.flag === "string" && trainingIds.has(original.flag)) {
        disposition = "excluded_gameplay"; targets = [];
        reason = "Gameplay score or training-eligibility threshold; original comparison operands and nested logical position remain inspectable here. It is not source confidence or a professional criterion.";
      } else if (semanticConditions.has(type)) {
        disposition = targets.length ? "hypothetical" : "requires_review";
        reason = "Unverified optional condition retained with all/any/not structure and original operands. It does not record the event, legal deadline, task completion or evidence acceptance.";
      }
    } else if (isConvertedGameplayId(item.sourceId) && !trainingIds.has(item.sourceId)) {
      reason = "The projector's training ID pattern is not a reviewed exclusion for this source identity. Inspect the substance; a name alone cannot establish gameplay semantics.";
    } else if (targets.length) {
      disposition = item.kind === "initial_resources" ? "hypothetical" : ["stages", "deadlines", "async_tasks", "pressure_windows"].includes(item.kind) ? "task"
        : ["actions", "outcomes", "events", "deterministic_decisions", "branch"].includes(item.kind) || item.kind === "inbox_items" && !original.initially_visible ? "hypothetical" : "retained";
      reason = item.kind === "initial_resources" ? "Fictional opening budget or financial/time initialization assumption. Original units and values are retained; this is not an actual award, payment, invoice, cost, time entry or running workflow counter. Verify a separate sourced budget and billing record."
        : disposition === "task" ? "Converted to undated review/planning work. Confirm actual owners, dates and jurisdiction-specific obligations."
        : disposition === "hypothetical" ? "Authored option, branch or later event/correspondence retained as an unrecorded hypothetical scenario; not an actual finding or completed decision."
        : item.kind === "evidence" ? "Original fictional source-register identity/description retained. Document bodies were not supplied; availability and supporting links require review."
        : item.kind === "facts" ? "Authored statement and initial fictional status retained. Asserted/assumed in the graph is not independent verification."
        : item.kind === "configuration" ? "Original scenario configuration retained here for context; the professional brief records limitations, not runnable training rules. Inspect original fields."
        : "Authored source context retained. Presence or editorial authorship does not establish professional approval.";
    }
    entries.push({ ...item, disposition, reason, targets, original: structuredClone(item.original), sourceFingerprint: canonicalFingerprint(item.original) });
  }
  const audit: ProjectionAudit = { format: "casevant-projection-audit", schemaVersion: 1,
    source: { caseId, version: source.scenario.metadata.content_version, scenarioFingerprint: source.scenario_fingerprint, contentFingerprint: canonicalFingerprint(scenario) }, entries };
  return { audit, issues: validateProjectionAudit(audit, scenario, template, source.scenario_fingerprint) };
}
