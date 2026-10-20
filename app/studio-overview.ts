import { caseFingerprint } from "./case-integrity";
import { CANOPY_QUESTION, CANOPY_SCENARIOS, CANOPY_SOURCES, CANOPY_UNAVAILABLE, buildCanopyPackage, type CanopyScenarioId, type CanopySource } from "./canopy-fixture";
import { caseTypePlaybook } from "./case-type-playbooks";
import { validateStudioDraft } from "./studio-validation";
import type { StudioDraft } from "./types";

type Locale = "en" | "ru";
type Prepared = ReturnType<typeof buildCanopyPackage>;
let preparedCanopy: Prepared[] | undefined;
function canopyPackages() {
  return preparedCanopy ??= [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE].flatMap(({ id }) => [buildCanopyPackage(id), buildCanopyPackage(id, true)]);
}

export type StudioReference = {
  nodeId: string; document: string; version: number; section: string;
  source: CanopySource | null; excerpt: string | null; exactTextPresent: boolean;
};

/** Reading projection only. It never modifies the draft, accepts evidence or selects an outcome. */
export function studioOverview(draft: StudioDraft, locale: Locale) {
  // A familiar title or a D01 reference alone must never attach another case's sources.
  const source = draft.exampleSource;
  const sourceCandidate = source && canopyPackages().find(item => item.draft.caseId === source.caseId && item.draft.version === source.version && item.studioFingerprint === source.fingerprint);
  const sourceId = sourceCandidate ? source!.caseId : draft.caseId;
  const referenceDraft = sourceCandidate ? { ...draft, caseId: sourceId, exampleSource: undefined } : draft;
  const family = sourceId === "project_canopy_managed_site_expansion"
    || [...CANOPY_SCENARIOS, CANOPY_UNAVAILABLE].some(({ id }) => sourceId === `project_canopy_managed_site_expansion_${id}`);
  const candidates = family ? canopyPackages() : [];
  const fingerprint = family ? caseFingerprint(referenceDraft) : null;
  const exact = candidates.find(item => item.draft.caseId === sourceId && item.draft.version === draft.version && item.studioFingerprint === fingerprint);
  const references: StudioReference[] = [];
  if (family) for (const node of draft.nodes) {
    const seen = new Set<string>();
    for (const match of node.detail.matchAll(/\b(D\d{2})\s+v(\d+)\s+§\s+([A-Za-z][A-Za-z0-9_-]*)/g)) {
      const document = match[1], version = Number(match[2]), section = match[3];
      const key = `${document}@${version}:${section}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const source = CANOPY_SOURCES.find(item => item.id === document && item.version === version && Object.hasOwn(item.sections, section)) ?? null;
      const excerpt = source?.sections[section] ?? null;
      references.push({ nodeId: node.id, document, version, section, source, excerpt, exactTextPresent: excerpt !== null && node.detail.includes(excerpt) });
    }
  }
  const checks = validateStudioDraft(draft, locale).checks;
  const facts = draft.nodes.filter(node => node.type === "fact");
  const evidence = draft.nodes.filter(node => node.type === "evidence");
  const recordGroup = caseTypePlaybook(draft.caseType).requiredNodeGroups.find(group => group.types.includes("evidence"));
  return {
    question: exact ? CANOPY_QUESTION : draft.premise.trim(),
    recommendation: exact
      ? { state: "prepared" as const, text: exact.declaration.recommendation, basis: exact.declaration.why, conditions: exact.declaration.changed, scenarioId: exact.declaration.id, version: exact.declaration.version }
      : { state: family ? "reassessment" as const : "missing" as const, text: null, basis: null, conditions: null, scenarioId: null, version: null },
    blockers: checks.filter(check => check.level === "warn"),
    outcomes: draft.nodes.filter(node => node.type === "outcome"),
    // Retained planning records, not a dated history or an inferred execution route.
    planningRecords: draft.nodes.filter(node => node.type === "deadline"
      || (node.type === "decision" && node.id.startsWith("stage-") && draft.classification?.tags.includes("converted-example"))),
    facts, evidence,
    requiredRecordCount: recordGroup?.minimum ?? null,
    recordedCount: recordGroup ? draft.nodes.filter(node => recordGroup.types.includes(node.type)).length : facts.length + evidence.length,
    references,
    // Reference material exists in the fixture, not as uploaded/accepted dossier evidence.
    sourcePacket: sourceCandidate || exact ? CANOPY_SOURCES : [],
    documentCount: sourceCandidate || exact ? new Set(CANOPY_SOURCES.map(source => source.id)).size : null,
    exactScenario: exact?.declaration.id as CanopyScenarioId | undefined,
    referenceScenario: sourceCandidate?.declaration.id ?? exact?.declaration.id,
    publicationContextReviewed: draft.premisePublication === "author-reviewed",
    humanEvidenceReview: "not_recorded_in_studio" as const,
  };
}

/** Reuses validation IDs and existing form destinations; contains no second validation policy. */
export { studioReviewAction as studioOverviewAction } from "./studio-review-action";

export function studioSourceFragmentId(document: string, version: number, section: string) {
  return `studio-reference-${document}-v${version}-${section}`;
}

/** Opens the actual retained section; returns false instead of pretending a missing source opened. */
export function openStudioSourceFragment(root: Pick<HTMLElement, "querySelector">, id: string) {
  if (!/^studio-reference-D\d{2}-v\d+-[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return false;
  const section = root.querySelector<HTMLElement>(`[id="${id}"]`);
  if (!section) return false;
  const details = section.closest("details");
  if (details) details.open = true;
  section.focus();
  section.scrollIntoView({ block: "nearest", behavior: "auto" });
  return true;
}
