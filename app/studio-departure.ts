import { canonicalFingerprint, caseFingerprint, casePublicationFingerprint, legacyCaseFingerprintV15 } from "./case-integrity";
import type { DepartureRisk, NavigationController } from "./navigation-controller";
import type { StudioDraft } from "./types";

export type StudioSavedBaseline = { kind: "workspace" | "device"; scope: string | null; customCaseId: number | null; fingerprint: string };
export type StudioDepartureInput = { draft: StudioDraft; blank: StudioDraft; prompt: string; evidencePending?: boolean; operationPending: boolean; deviceEligible: boolean; scope: string | null; customCaseId: number | null; serverFingerprint: string | null; serverPublicationFingerprint: string | null; saved: StudioSavedBaseline | null };

/** Memory-only authoring comparison, not a new save receipt or approval. */
export function studioDepartureFingerprint(draft: StudioDraft) {
  const { updatedAt: _updatedAt, protection, ...content } = draft;
  void _updatedAt; // Saving a timestamp alone does not change authored content.
  return canonicalFingerprint({ ...content, copyProtected: protection?.copyProtected === true, copyPolicy: protection?.copyPolicy ?? "fork_allowed" });
}

export function studioDepartureRisk(input: StudioDepartureInput): DepartureRisk {
  if (input.operationPending) return "pending";
  if (input.prompt.trim() || input.evidencePending) return "dirty"; // Neither ordinary workspace nor device save stores unadded form/prompt input.
  const fingerprint = studioDepartureFingerprint(input.draft);
  if (fingerprint === studioDepartureFingerprint(input.blank)) return "clear";
  const saved = input.saved;
  if (!saved || saved.scope !== input.scope || saved.customCaseId !== input.customCaseId || saved.fingerprint !== fingerprint) return "dirty";
  if (saved.kind === "device") return input.deviceEligible && input.scope && input.customCaseId === null ? "clear" : "dirty";
  if (input.customCaseId === null || !input.serverFingerprint || !input.serverPublicationFingerprint) return "dirty";
  return (caseFingerprint(input.draft) === input.serverFingerprint || legacyCaseFingerprintV15(input.draft) === input.serverFingerprint)
    && casePublicationFingerprint(input.draft) === input.serverPublicationFingerprint ? "clear" : "dirty";
}

/** The existing controller owns the dialog, history, unload and logout policy.
 * StudioSessionAuthority remains responsible for hiding/discarding private work. */
export function registerStudioDeparture(navigation: NavigationController, current: () => StudioDepartureInput) {
  return navigation.register({}, { risk: () => studioDepartureRisk(current()), suspend: () => {}, deny: () => {} });
}
