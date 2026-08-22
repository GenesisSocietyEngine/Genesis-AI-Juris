import { caseFingerprint, isRecord } from "./case-integrity";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import { compileStudioDraft, type StudioCompileIssue } from "./studio-compiler";
import type { CaseProtectionV1, Scenario, StudioDraft } from "./types";

export const TAX_ATTESTATION_KIND = "tax-publication-attestation-v1" as const;

export const TAX_ATTESTATION_CHECKLIST_KEYS = [
  "lawfulPurposeConfirmed",
  "complianceOnlyConfirmed",
  "legalAsOfVerified",
  "sourceAuthorityVerified",
  "antiAbuseRulesReviewed",
  "reportingObligationsReviewed",
  "noEvasionFacilitationConfirmed",
] as const;

type TaxAttestationChecklistKey = typeof TAX_ATTESTATION_CHECKLIST_KEYS[number];

export type TaxPublicationAttestation = {
  kind: typeof TAX_ATTESTATION_KIND;
  reviewerName: string;
  reviewedAt: string;
  legalAsOf: string;
  sourceCount: number;
  note: string;
  studioFingerprint: string;
  playableFingerprint: string;
  checklist: Record<TaxAttestationChecklistKey, true>;
};

export type PublicationArtifactBinding = {
  compiler: "studio-compiler-v1";
  serverCompiled: true;
  studioFingerprint: string;
  playableFingerprint: string;
  caseProtection?: CaseProtectionV1;
};

export type PublicationCompilationResult =
  | {
      ok: true;
      playable: Scenario;
      binding: PublicationArtifactBinding;
      warnings: string[];
    }
  | {
      ok: false;
      status: 400 | 409 | 422;
      error: string;
      issues?: StudioCompileIssue[];
    };

/**
 * Produces the only playable artifact that may be published. The client payload
 * is a stale-preview guard only: it is never persisted or otherwise trusted.
 */
export function compilePublicationPlayable(draft: StudioDraft, clientPreview?: unknown): PublicationCompilationResult {
  const studioFingerprint = caseFingerprint(draft);
  const compilation = compileStudioDraft(draft);
  if (!compilation.scenario || compilation.issues.length) {
    return {
      ok: false,
      status: 422,
      error: "The reviewed Studio graph could not be compiled for publication.",
      issues: compilation.issues,
    };
  }

  let normalized: Scenario;
  try {
    normalized = normalizePlayableScenario({
      ...compilation.scenario,
      fingerprint: "",
      sourceFingerprint: studioFingerprint,
    });
  } catch {
    return { ok: false, status: 422, error: "The server-compiled scenario failed playable validation." };
  }
  const fingerprint = playableFingerprint(normalized);
  const playable = { ...normalized, fingerprint };
  const binding: PublicationArtifactBinding = {
    compiler: "studio-compiler-v1",
    serverCompiled: true,
    studioFingerprint,
    playableFingerprint: fingerprint,
  };

  if (clientPreview !== undefined) {
    let preview: Scenario;
    try {
      preview = normalizePlayableScenario(clientPreview);
    } catch {
      return { ok: false, status: 400, error: "The client playable preview is invalid. Recompile it from the current Studio draft." };
    }
    const previewFingerprint = playableFingerprint(preview);
    const claimedFingerprintMatches = !preview.fingerprint || preview.fingerprint === previewFingerprint;
    if (
      preview.caseId !== draft.caseId
      || preview.version !== draft.version
      || preview.sourceFingerprint !== studioFingerprint
      || previewFingerprint !== fingerprint
      || !claimedFingerprintMatches
    ) {
      return {
        ok: false,
        status: 409,
        error: "The client playable preview does not match the server compilation of this exact Studio version.",
      };
    }
  }

  return { ok: true, playable, binding, warnings: compilation.warnings };
}

export function normalizeTaxPublicationAttestation(
  value: unknown,
  expected: {
    reviewerName: string;
    legalAsOf: string;
    sourceCount: number;
    studioFingerprint: string;
    playableFingerprint: string;
    now: Date;
  },
): TaxPublicationAttestation {
  if (!isRecord(value) || value.kind !== TAX_ATTESTATION_KIND) throw new Error("A structured tax publication attestation is required.");
  const reviewerName = boundedText(value.reviewerName, "attestation reviewer", 3, 160);
  if (fold(reviewerName) !== fold(expected.reviewerName)) throw new Error("The tax attestation reviewer must match the attributed publication reviewer.");

  if (typeof value.reviewedAt !== "string" || !Number.isFinite(Date.parse(value.reviewedAt))) throw new Error("A valid tax review timestamp is required.");
  const reviewedAt = new Date(value.reviewedAt).toISOString();
  if (Date.parse(reviewedAt) > expected.now.getTime() + 5 * 60_000) throw new Error("The tax review timestamp cannot be in the future.");

  if (value.legalAsOf !== expected.legalAsOf) throw new Error("The tax attestation legal-as-of date does not match the reviewed Studio draft.");
  if (reviewedAt.slice(0, 10) < expected.legalAsOf) throw new Error("The tax review cannot predate the legal-as-of date it attests.");
  if (!Number.isInteger(value.sourceCount) || value.sourceCount !== expected.sourceCount || value.sourceCount < 1) {
    throw new Error("The tax attestation source count does not match the reviewed Studio draft.");
  }
  if (value.studioFingerprint !== expected.studioFingerprint || value.playableFingerprint !== expected.playableFingerprint) {
    throw new Error("The tax attestation is not bound to the exact Studio and playable artifacts being published.");
  }
  const note = boundedText(value.note, "tax review note", 20, 2_000);
  if (!isRecord(value.checklist)) throw new Error("The tax publication checklist is required.");
  for (const key of TAX_ATTESTATION_CHECKLIST_KEYS) if (value.checklist[key] !== true) throw new Error(`Tax publication checklist item ${key} must be explicitly confirmed.`);
  const checklist = Object.fromEntries(TAX_ATTESTATION_CHECKLIST_KEYS.map((key) => [key, true])) as Record<TaxAttestationChecklistKey, true>;

  return {
    kind: TAX_ATTESTATION_KIND,
    reviewerName,
    reviewedAt,
    legalAsOf: expected.legalAsOf,
    sourceCount: expected.sourceCount,
    note,
    studioFingerprint: expected.studioFingerprint,
    playableFingerprint: expected.playableFingerprint,
    checklist,
  };
}

function boundedText(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new Error(`Invalid ${label}.`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new Error(`Invalid ${label}.`);
  return result;
}

function fold(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
