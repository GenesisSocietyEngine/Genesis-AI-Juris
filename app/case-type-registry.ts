import type { CaseTypeId, CaseTypeReference, CaseWorkflowMode, StudioDraft } from "./types";
import rawRegistry from "./case-type-registry.v1.json";
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
  requiredReview: "professional" | "evidence_governance" | "tax_governance" | "runtime_parity";
};

const presentation: Record<CaseTypeId, { practiceArea: string; domain: "general" | "tax" }> = {
  general_advisory: { practiceArea: "General advisory", domain: "general" },
  litigation_strategy: { practiceArea: "Litigation strategy", domain: "general" },
  contract_review: { practiceArea: "Contract review", domain: "general" },
  tax_planning: { practiceArea: "Tax planning", domain: "tax" },
  compliance: { practiceArea: "Compliance", domain: "general" },
  tax_compliance: { practiceArea: "International tax planning", domain: "tax" },
  erp_incident: { practiceArea: "ERP incident & solution design", domain: "general" },
  investigation: { practiceArea: "Investigation", domain: "general" },
  training_simulation: { practiceArea: "Professional training", domain: "general" },
};

type RawRegistry = { format: string; schemaVersion: number; registry: string; types: Array<Omit<CaseTypeDefinition, "practiceArea" | "domain">> };

function validatedRegistry(value: unknown): readonly CaseTypeDefinition[] {
  const registry = value as RawRegistry;
  if (!registry || registry.format !== "genesis-juris-case-type-registry" || registry.schemaVersion !== 1 || registry.registry !== "genesis-juris-case-types" || !Array.isArray(registry.types)) throw new Error("Unsupported case-type registry");
  const ids = new Set<CaseTypeId>();
  return registry.types.map((entry) => {
    if (!(entry.id in presentation) || entry.version !== CASE_TYPE_VERSION || ids.has(entry.id)) throw new Error("Invalid immutable case-type package");
    ids.add(entry.id);
    return { ...entry, ...presentation[entry.id] };
  });
}

export const CASE_TYPE_REGISTRY = validatedRegistry(rawRegistry);

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
