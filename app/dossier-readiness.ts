import {
  DOSSIER_READINESS_DIMENSIONS,
  DOSSIER_READINESS_REASON_CODES,
  readinessReasonDefinition,
  type DossierObjectType,
  type DossierReadinessDimension,
  type DossierReadinessReasonCode,
  type DossierReadinessV1,
} from "./dossier-contract";
import { parseDossierOpaqueId } from "./dossier-security";

export interface DossierReadinessFinding {
  code: DossierReadinessReasonCode;
  relatedObjectType: DossierObjectType | null;
  relatedObjectId: string | null;
}

export interface ComputeDossierReadinessInput {
  dossierId: string;
  revision: number;
  evaluatedAt: string;
  findings: readonly DossierReadinessFinding[];
  notApplicableDimensions?: readonly DossierReadinessDimension[];
}

export class DossierReadinessError extends Error {
  constructor(readonly code: "INVALID_INPUT" | "DUPLICATE_FINDING" | "CONFLICTING_DIMENSION", message: string) {
    super(message);
    this.name = "DossierReadinessError";
  }
}

/**
 * Produces the complete ten-dimension readiness projection from authoritative
 * findings. Status is deliberately absent: lifecycle and readiness remain
 * separate concepts. Callers must pass an explicit timestamp so a stored
 * snapshot can be reproduced byte-for-byte.
 */
export function computeDossierReadiness(input: ComputeDossierReadinessInput): DossierReadinessV1 {
  const dossierId = parseDossierOpaqueId(input.dossierId, "readiness dossier ID");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new DossierReadinessError("INVALID_INPUT", "Readiness requires a positive dossier revision.");
  }
  if (!isCanonicalTimestamp(input.evaluatedAt)) {
    throw new DossierReadinessError("INVALID_INPUT", "Readiness requires a canonical ISO timestamp.");
  }
  if (!Array.isArray(input.findings) || input.findings.length > 10_000) {
    throw new DossierReadinessError("INVALID_INPUT", "Readiness findings exceed the bounded input.");
  }

  const notApplicable = new Set<DossierReadinessDimension>();
  for (const dimension of input.notApplicableDimensions ?? []) {
    if (!DOSSIER_READINESS_DIMENSIONS.includes(dimension)) {
      throw new DossierReadinessError("INVALID_INPUT", "Readiness contains an unknown dimension.");
    }
    notApplicable.add(dimension);
  }

  const reasonOrder = new Map(DOSSIER_READINESS_REASON_CODES.map((code, index) => [code, index]));
  const grouped = new Map<DossierReadinessDimension, DossierReadinessFinding[]>();
  const seen = new Set<string>();
  for (const finding of input.findings) {
    if (!finding || !DOSSIER_READINESS_REASON_CODES.includes(finding.code)) {
      throw new DossierReadinessError("INVALID_INPUT", "Readiness contains an unknown reason code.");
    }
    if ((finding.relatedObjectType === null) !== (finding.relatedObjectId === null)) {
      throw new DossierReadinessError("INVALID_INPUT", "Readiness related-object fields must be paired.");
    }
    const relatedObjectId = finding.relatedObjectId === null
      ? null
      : parseDossierOpaqueId(finding.relatedObjectId, "readiness related-object ID");
    const definition = readinessReasonDefinition(finding.code);
    if (notApplicable.has(definition.dimension)) {
      throw new DossierReadinessError("CONFLICTING_DIMENSION", "A not-applicable readiness dimension cannot contain blockers.");
    }
    const key = `${finding.code}\u0000${finding.relatedObjectType ?? ""}\u0000${relatedObjectId ?? ""}`;
    if (seen.has(key)) {
      throw new DossierReadinessError("DUPLICATE_FINDING", "Readiness contains a duplicate finding.");
    }
    seen.add(key);
    const canonical = { ...finding, relatedObjectId };
    grouped.set(definition.dimension, [...(grouped.get(definition.dimension) ?? []), canonical]);
  }

  const dimensions = DOSSIER_READINESS_DIMENSIONS.map((dimension) => {
    const findings = [...(grouped.get(dimension) ?? [])].sort((left, right) => (
      (reasonOrder.get(left.code) ?? Number.MAX_SAFE_INTEGER) - (reasonOrder.get(right.code) ?? Number.MAX_SAFE_INTEGER)
      || (left.relatedObjectType ?? "").localeCompare(right.relatedObjectType ?? "")
      || (left.relatedObjectId ?? "").localeCompare(right.relatedObjectId ?? "")
    ));
    if (findings.length === 0) {
      return {
        dimension,
        state: notApplicable.has(dimension) ? "not_applicable" as const : "ready" as const,
        reasons: [],
      };
    }
    return {
      dimension,
      state: "blocked" as const,
      reasons: findings.map((finding) => {
        const definition = readinessReasonDefinition(finding.code);
        return {
          code: finding.code,
          explanation: definition.explanation,
          deep_link: finding.relatedObjectId === null
            ? definition.deep_link_prefix
            : `${definition.deep_link_prefix}/${finding.relatedObjectId}`,
          related_object_type: finding.relatedObjectType,
          related_object_id: finding.relatedObjectId,
        };
      }),
    };
  });

  return {
    schema_version: 1,
    dossier_id: dossierId,
    computed_from_revision: input.revision,
    evaluated_at: input.evaluatedAt,
    ready: dimensions.every(({ state }) => state !== "blocked"),
    dimensions,
  };
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 35) return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}
