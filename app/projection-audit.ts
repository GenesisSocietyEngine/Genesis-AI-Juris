import { canonicalFingerprint, isRecord } from "./case-integrity";
import type { StudioDraft } from "./types";

export type ProjectionDisposition = "retained" | "reference_only" | "task" | "hypothetical" | "excluded_gameplay" | "requires_review";
export type ProjectionEntry = {
  path: string; sourceId: string; kind: string;
  disposition: ProjectionDisposition; reason: string;
  targets: string[]; original: unknown; sourceFingerprint: string;
};
export type ProjectionAudit = {
  format: "casevant-projection-audit"; schemaVersion: 1;
  source: { caseId: string; version: string; scenarioFingerprint: string; contentFingerprint: string };
  entries: ProjectionEntry[];
};

/** The inventory is independent of projection policy, so omitted records fail coverage. */
export function projectionInventory(scenario: Record<string, unknown>) {
  const result: Array<{ path: string; sourceId: string; kind: string; original: unknown }> = [];
  function add(path: string, sourceId: string, kind: string, original: unknown) {
    result.push({ path, sourceId, kind, original });
  }
  function condition(value: unknown, path: string, id: string) {
    if (!isRecord(value)) { add(path, id, "condition", value); return; }
    add(path, id, "condition", value);
    if (Array.isArray(value.conditions)) value.conditions.forEach((item, index) => condition(item, `${path}/conditions/${index}`, id));
    if (value.condition !== undefined) condition(value.condition, path + "/condition", id);
  }
  function record(value: unknown, path: string, kind: string, inheritedId = "") {
    const id = isRecord(value) && typeof value.id === "string" ? value.id : inheritedId || path;
    add(path, id, kind, value);
    if (!isRecord(value)) return;
    if (Array.isArray(value.effects)) value.effects.forEach((item, index) => add(`${path}/effects/${index}`, id, "effect", item));
    for (const field of ["exit_actions", "completion_actions", "response_action_ids"]) if (Array.isArray(value[field])) {
      value[field].forEach((item, index) => add(`${path}/${field}/${index}`, typeof item === "string" ? item : id, "action_reference", item));
    }
    for (const field of ["condition", "trigger", "available_when"]) if (value[field] !== undefined) condition(value[field], path + "/" + field, id);
    if (Array.isArray(value.branches)) value.branches.forEach((item, index) => record(item, `${path}/branches/${index}`, "branch", id));
  }
  for (const [group, value] of Object.entries(scenario)) {
    if (Array.isArray(value)) value.forEach((item, index) => record(item, `/scenario/${group}/${index}`, group));
    else if (["initial_resources", "initial_metrics", "initial_flags"].includes(group) && isRecord(value)) {
      for (const [id, field] of Object.entries(value)) add(`/scenario/${group}/${id}`, id, group, field);
    } else add("/scenario/" + group, group, "configuration", value);
  }
  return result;
}

export function validateProjectionAudit(audit: ProjectionAudit, scenario: Record<string, unknown>, template: StudioDraft, originalScenarioFingerprint: string): string[] {
  const issues: string[] = [], inventory = projectionInventory(scenario), paths = new Set<string>();
  const expected = new Map(inventory.map(item => [item.path, item]));
  const nodes = new Set(template.nodes.map(node => node.id));
  if (audit.format !== "casevant-projection-audit" || audit.schemaVersion !== 1) issues.push("unsupported-audit-schema");
  if (audit.source.caseId !== template.caseId || !isRecord(scenario.metadata) || audit.source.version !== scenario.metadata.content_version
    || audit.source.scenarioFingerprint !== originalScenarioFingerprint) issues.push("source-identity-mismatch");
  for (const entry of audit.entries) {
    const source = expected.get(entry.path);
    if (paths.has(entry.path)) issues.push("duplicate-source-path:" + entry.path);
    paths.add(entry.path);
    if (!source) issues.push("unknown-source-path:" + entry.path);
    else if (entry.sourceId !== source.sourceId || entry.kind !== source.kind
      || entry.sourceFingerprint !== canonicalFingerprint(source.original)
      || canonicalFingerprint(entry.original) !== entry.sourceFingerprint) issues.push("source-mismatch:" + entry.path);
    if (!entry.reason.trim()) issues.push("unexplained-disposition:" + entry.path);
    if (!["retained", "reference_only", "task", "hypothetical", "excluded_gameplay", "requires_review"].includes(entry.disposition)) issues.push("unknown-disposition:" + entry.path);
    if (["retained", "task", "hypothetical"].includes(entry.disposition) && !entry.targets.length) issues.push("missing-projection-target:" + entry.path);
    if (entry.disposition === "excluded_gameplay" && entry.targets.length) issues.push("excluded-target:" + entry.path);
    for (const id of entry.targets) if (!nodes.has(id)) issues.push("unknown-projection-target:" + entry.path + ":" + id);
  }
  for (const entry of inventory) if (!paths.has(entry.path)) issues.push("unaccounted-source:" + entry.path);
  if (audit.source.contentFingerprint !== canonicalFingerprint(scenario)) issues.push("source-content-mismatch");
  return issues;
}
