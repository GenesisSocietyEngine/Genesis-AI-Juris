import { legacyScenarios } from "../../legacy-scenarios";
import { normalizePlayableScenario, playableFingerprint } from "../../playable-integrity";
import { scenarios } from "../../scenarios";

/**
 * Early catalogue rows store a compact pointer instead of duplicating the
 * canonical scenario JSON in D1. Resolve that pointer on the server so the
 * client still receives one version-pinned playable manifest on demand.
 */
export function resolveBundledManifest(payload: Record<string, unknown>, caseId: string, version: string, fingerprint: string) {
  if (payload.kind === "playable-scenario-v1") {
    try {
      const scenario = normalizePlayableScenario(payload.scenario);
      return scenario.caseId === caseId && scenario.version === version && scenario.fingerprint === fingerprint && playableFingerprint(scenario) === fingerprint
        ? { kind: "playable-scenario-v1", scenario }
        : null;
    } catch {
      return null;
    }
  }
  if (payload.bundle !== "canonical-case-bundle.json") return null;
  if (payload.runtime === "bundled") {
    const current = scenarios.find((item) => item.caseId === caseId && item.version === version && item.fingerprint === fingerprint);
    return current && playableFingerprint(current) === fingerprint ? { kind: "playable-scenario-v1", scenario: current } : null;
  }

  // Retained beta exports predate the `sha256-` identity prefix and the current
  // canonical runtime shape. Their exact immutable identities are pinned in
  // legacy-scenarios.ts and validated by the legacy compatibility suite.
  if (payload.runtime !== "legacy-bundled") return null;
  const legacy = legacyScenarios.find((item) => item.caseId === caseId && item.version === version && item.fingerprint === fingerprint);
  return legacy ? { kind: "playable-scenario-v1", scenario: legacy } : null;
}
