import { canonicalFingerprint, caseFingerprint, normalizeStudioDraft } from "./case-integrity";
import { EXAMPLE_REGISTRY, prepareExampleVersion } from "./example-registry";
import { buildConvertedProjectionAudit } from "./converted-projection-audit";
import { CATEGORY_DEMOS } from "./category-demos";
import { CANOPY_SOURCES, canopyDeclaration } from "./canopy-fixture";
import type { ProjectionEntry, ProjectionDisposition } from "./projection-audit";
import type { StudioDraft, StudioNode } from "./types";

export type ExampleProvenance = {
  format: "casevant-example-provenance"; schemaVersion: 1;
  case: { caseId: string; version: string; fingerprint: string };
  source: { packageId: string; caseId: string; version: string; fingerprint: string; language: "en" | "ru" };
  projectionSource: { version: string; fingerprint: string; contentFingerprint: string } | null;
  status: { professionalReview: "not_recorded"; synthetic: true; integrityIssues: string[]; requiresReview: number; workingChanges: number; workingContentChanged: boolean };
  entries: Array<ProjectionEntry & { workingTargets: Array<{ id: string; state: "unchanged" | "changed" | "missing"; statementStatus: string | null }> }>;
  workingOnlyNodeIds: string[];
};
const semanticNode = (node: StudioNode) => ({ ...node, x: undefined, y: undefined });

/** Source identity must match an exact supported template version, never merely its name. */
export async function buildExampleProvenance(draft: StudioDraft): Promise<ExampleProvenance | null> {
  const reference = draft.exampleSource;
  if (reference && reference.format !== "casevant-example-source-v1") return null;
  const sourceId = reference?.caseId ?? draft.caseId, version = reference?.version ?? draft.version;
  const candidates = EXAMPLE_REGISTRY.filter(item => item.source.caseId === sourceId && (item.source.version === version || item.family === "converted" && version === "2.2.0"));
  for (const descriptor of candidates) for (const language of ["en", "ru"] as const) {
    const prepared = await prepareExampleVersion(descriptor.id, language, version);
    const template = normalizeStudioDraft(structuredClone(prepared.draft));
    const fingerprint = caseFingerprint(template);
    if (reference ? reference.fingerprint !== fingerprint : caseFingerprint(normalizeStudioDraft(structuredClone(draft))) !== fingerprint) continue;
    let entries: ProjectionEntry[] = [], issues: string[] = [];
    let projectionSource: ExampleProvenance["projectionSource"] = null;
    const add = (path: string, sourceId: string, kind: string, original: unknown, targets: string[], disposition: ProjectionDisposition, reason: string) => {
      entries.push({ path, sourceId, kind, original: JSON.parse(JSON.stringify(original) ?? "null"), targets, disposition, reason, sourceFingerprint: canonicalFingerprint(original) });
    };
    if (descriptor.family === "converted") {
      const { audit, issues: validation } = buildConvertedProjectionAudit(sourceId, template);
      entries = audit.entries; issues = validation;
      projectionSource = { version: audit.source.version, fingerprint: audit.source.scenarioFingerprint, contentFingerprint: audit.source.contentFingerprint };
    } else if (descriptor.family === "category") {
      const demo = CATEGORY_DEMOS.find(item => item.caseTypeId === descriptor.category)!;
      const targets: Record<string, string[]> = { caseTypeId: [], title: [], question: ["trigger"], owner: ["actor"], facts: ["fact-1", "fact-2", "evidence"], evidence: ["evidence"], decision: ["decision"], proceed: ["outcome-proceed"], pause: ["outcome-pause"] };
      for (const [field, original] of Object.entries(demo)) {
        add(`/category/${descriptor.category}/${field}`, `${descriptor.category}:${field}`, "authored_synthetic", original, targets[field] ?? [], ["proceed", "pause", "decision"].includes(field) ? "hypothetical" : targets[field]?.length ? "retained" : "reference_only",
          "Authored bilingual synthetic fixture material, not external documents, verified law or recorded events. S1/S2 excerpts and assumptions require professional review.");
      }
    } else {
      const scenario = canopyDeclaration(descriptor.id.slice("canopy:".length) as Parameters<typeof canopyDeclaration>[0]);
      const selected: Record<string, number> = { D03: scenario.d03, D06: scenario.d06, D07: 2, D08: scenario.d08 };
      for (const document of CANOPY_SOURCES) for (const [section, text] of Object.entries(document.sections)) {
        const targets = template.nodes.filter(node => node.detail.includes(`${document.id} v${document.version} § ${section}`) && node.detail.includes(text)).map(node => node.id);
        add(`/documents/${document.id}/versions/${document.version}/sections/${section}`, `${document.id}@${document.version}:${section}`, "immutable_synthetic_source", text, targets, targets.length ? "retained" : "reference_only",
          document.version === (selected[document.id] ?? 1) ? "Selected immutable fictional source passage. Uncited material remains reference-only; presence does not record human evidence acceptance."
            : "Retained immutable version history, not substituted for the selected/cited version. Historical reference material is not an accepted working-case fact.");
      }
      add("/canopy/" + scenario.id, scenario.id, "scenario_declaration", scenario, ["opening"], "hypothetical",
        "Authored scenario assumptions, controls and expected recommendation. This does not record an executed outcome, operational release or independent approval.");
    }
    // Generated records are explicitly distinguished from original source bodies.
    for (const node of template.nodes) add("/projection/nodes/" + node.id, node.id, "projection_record", node, [node.id],
      node.type === "outcome" || node.type === "decision" ? "hypothetical" : node.type === "deadline" ? "task" : "retained",
      "Version-bound generated template record. Inspect the original source entries separately. Its graph statement status does not establish truth or professional approval.");
    const sourceNodes = new Map(template.nodes.map(node => [node.id, node]));
    const workingNodes = new Map(draft.nodes.map(node => [node.id, node]));
    const differences = template.nodes.filter(node => !workingNodes.has(node.id) || canonicalFingerprint(semanticNode(workingNodes.get(node.id)!)) !== canonicalFingerprint(semanticNode(node))).length;
    const workingOnlyNodeIds = draft.nodes.filter(node => !sourceNodes.has(node.id)).map(node => node.id);
    return { format: "casevant-example-provenance", schemaVersion: 1,
      case: { caseId: draft.caseId, version: draft.version, fingerprint: caseFingerprint(draft) },
      source: { packageId: descriptor.id, caseId: sourceId, version, fingerprint, language },
      projectionSource,
      status: { professionalReview: "not_recorded", synthetic: true, integrityIssues: issues, requiresReview: entries.filter(entry => entry.disposition === "requires_review").length, workingChanges: differences + workingOnlyNodeIds.length,
        workingContentChanged: caseFingerprint({ ...draft, caseId: template.caseId, version: template.version, exampleSource: undefined, parent: template.parent }) !== fingerprint },
      entries: entries.map(entry => ({ ...entry, workingTargets: entry.targets.map(id => {
        const node = workingNodes.get(id), expected = sourceNodes.get(id);
        return { id, state: !node ? "missing" : expected && canonicalFingerprint(semanticNode(node)) === canonicalFingerprint(semanticNode(expected)) ? "unchanged" : "changed",
          statementStatus: node?.type === "fact" ? node.factStatus ?? "legacy_asserted_default" : null };
      }) })), workingOnlyNodeIds };
  }
  return null;
}

export async function prepareExampleProvenanceDownload(draft: StudioDraft, current: () => boolean) {
  if (!current()) return null;
  const manifest = await buildExampleProvenance(draft);
  if (!current() || !manifest || manifest.status.integrityIssues.length) return null;
  return { filename: draft.caseId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) + "-provenance-audit.json",
    mime: "application/json;charset=utf-8", content: JSON.stringify(manifest, null, 2) + "\n" };
}
