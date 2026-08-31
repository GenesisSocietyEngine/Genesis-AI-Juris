import type { CaseTypeId, CaseTypeReference, CaseWorkflowMode, StudioDraft } from "./types";
import { defaultTaxEconomics } from "./tax-economics";
import { caseTypeReference, CASE_TYPE_VERSION, DEFAULT_CASE_TYPE } from "./case-type-reference";
export { caseTypeReference, CASE_TYPE_REGISTRY_ID, CASE_TYPE_REGISTRY_SCHEMA_VERSION, CASE_TYPE_VERSION, DEFAULT_CASE_TYPE, normalizeCaseTypeReference } from "./case-type-reference";

export type CaseViewId = "issue_map" | "evidence_map" | "decision_table" | "task_plan" | "timeline" | "economics" | "simulation";

export type CaseTypeDefinition = {
  id: CaseTypeId;
  version: typeof CASE_TYPE_VERSION;
  workflowMode: CaseWorkflowMode;
  practiceArea: string;
  domain: "general" | "tax";
  views: readonly CaseViewId[];
  requiredReview: "professional" | "tax_governance" | "runtime_parity";
};

export const CASE_TYPE_REGISTRY: readonly CaseTypeDefinition[] = [
  {
    id: "general_advisory",
    version: CASE_TYPE_VERSION,
    workflowMode: "hybrid",
    practiceArea: "General legal",
    domain: "general",
    views: ["issue_map", "evidence_map", "decision_table", "timeline"],
    requiredReview: "professional",
  },
  {
    id: "tax_compliance",
    version: CASE_TYPE_VERSION,
    workflowMode: "hybrid",
    practiceArea: "International tax planning",
    domain: "tax",
    views: ["issue_map", "decision_table", "economics", "timeline"],
    requiredReview: "tax_governance",
  },
  {
    id: "erp_incident",
    version: CASE_TYPE_VERSION,
    workflowMode: "process",
    practiceArea: "ERP incident & solution design",
    domain: "general",
    views: ["task_plan", "evidence_map", "decision_table", "timeline"],
    requiredReview: "professional",
  },
  {
    id: "training_simulation",
    version: CASE_TYPE_VERSION,
    workflowMode: "simulation",
    practiceArea: "Professional training",
    domain: "general",
    views: ["simulation", "timeline", "evidence_map"],
    requiredReview: "runtime_parity",
  },
] as const;

const byId = new Map(CASE_TYPE_REGISTRY.map((definition) => [definition.id, definition]));

export function caseTypeDefinition(reference?: CaseTypeReference | null) {
  return byId.get(reference?.id ?? DEFAULT_CASE_TYPE.id) ?? byId.get(DEFAULT_CASE_TYPE.id)!;
}

export function applyCaseType(draft: StudioDraft, id: CaseTypeId): StudioDraft {
  const definition = byId.get(id);
  if (!definition) throw new Error("Unknown case type");
  const classification = draft.classification ?? {
    practiceArea: definition.practiceArea,
    difficulty: "Intermediate",
    tags: [],
    taxTopics: [],
    complianceOnly: true,
  };
  const nextClassification = {
    ...classification,
    domain: definition.domain,
    practiceArea: definition.practiceArea,
    complianceOnly: true,
    ...(definition.domain === "tax"
      ? { purpose: classification.purpose ?? "compliance_review" as const }
      : { taxTopics: [], purpose: "compliance_review" as const }),
  };
  return {
    ...draft,
    caseType: caseTypeReference(id),
    classification: nextClassification,
    ...(definition.domain === "tax"
      ? { taxEconomics: draft.taxEconomics ?? defaultTaxEconomics(draft.dealEconomics?.currency ?? "EUR") }
      : { taxEconomics: undefined }),
  };
}

export function caseTypeRegistrySignature() {
  return CASE_TYPE_REGISTRY.map(({ id, version, workflowMode, views, requiredReview }) => ({ id, version, workflowMode, views: [...views], requiredReview }));
}
