import type { CaseTypeId, CaseTypeReference } from "./types";

export const CASE_TYPE_REGISTRY_ID = "genesis-juris-case-types" as const;
export const CASE_TYPE_REGISTRY_SCHEMA_VERSION = 1 as const;
export const CASE_TYPE_VERSION = "1.0.0" as const;

const supportedCaseTypes = new Set<CaseTypeId>([
  "general_advisory",
  "litigation_strategy",
  "contract_review",
  "tax_planning",
  "compliance",
  "tax_compliance",
  "erp_incident",
  "investigation",
  "training_simulation",
]);

export const DEFAULT_CASE_TYPE: CaseTypeReference = {
  registry: CASE_TYPE_REGISTRY_ID,
  id: "general_advisory",
  version: CASE_TYPE_VERSION,
};

export function caseTypeReference(id: CaseTypeId): CaseTypeReference {
  if (!supportedCaseTypes.has(id)) throw new Error("Unknown case type");
  return { registry: CASE_TYPE_REGISTRY_ID, id, version: CASE_TYPE_VERSION };
}

export function normalizeCaseTypeReference(value: unknown): CaseTypeReference | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid case type reference");
  const candidate = value as Record<string, unknown>;
  if (candidate.registry !== CASE_TYPE_REGISTRY_ID || typeof candidate.id !== "string" || typeof candidate.version !== "string") throw new Error("Invalid case type reference");
  if (!supportedCaseTypes.has(candidate.id as CaseTypeId) || candidate.version !== CASE_TYPE_VERSION) throw new Error("Unsupported case type version");
  return caseTypeReference(candidate.id as CaseTypeId);
}
