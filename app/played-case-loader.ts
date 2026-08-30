import { isRecord } from "./case-integrity";
import { playedCaseFallbackMode } from "./catalogue-fallback";
import { normalizePlayableScenario, playableFingerprint } from "./playable-integrity";
import type { Scenario } from "./types";

export type PlayedScenarioIdentity = {
  id: unknown;
  caseId: unknown;
  contentVersion: unknown;
  fingerprint: unknown;
};

type ManifestFetch = (url: string) => Promise<Response>;

type PlayedCaseServerSessionIdentity = {
  sessionKey: string;
  caseId: string;
  version: string;
  fingerprint: string;
  status: string;
  revision: number;
};

type PlayedCaseScenarioIdentity = Pick<Scenario, "caseId" | "version" | "fingerprint">;

export function requirePlayedCaseServerSession<T extends PlayedCaseServerSessionIdentity>(
  responseOk: boolean,
  session: T | null,
  scenario: PlayedCaseScenarioIdentity,
  expectedSessionKey: string,
  expectedRevision: number,
): T {
  if (!responseOk || !session || (session.status !== "active" && session.status !== "completed")
    || session.sessionKey !== expectedSessionKey
    || session.caseId !== scenario.caseId
    || session.version !== scenario.version
    || session.fingerprint !== scenario.fingerprint) {
    throw new Error("Canonical server session is unavailable");
  }
  if (session.revision !== expectedRevision) {
    throw new Error("Canonical server session has changed since this file was exported");
  }
  return session;
}

export function commitPlayedCaseServerSession<T extends PlayedCaseServerSessionIdentity>(
  responseOk: boolean,
  session: T | null,
  scenario: PlayedCaseScenarioIdentity,
  expectedSessionKey: string,
  expectedRevision: number,
  commit: (exactSession: T) => void,
): T {
  const exactSession = requirePlayedCaseServerSession(responseOk, session, scenario, expectedSessionKey, expectedRevision);
  commit(exactSession);
  return exactSession;
}

export async function resolvePlayedCaseScenario(identityValue: PlayedScenarioIdentity, cached: Scenario[], fetchManifest: ManifestFetch = (url) => fetch(url)) {
  const identity = playedScenarioIdentity(identityValue);
  const cachedScenario = cached.find((scenario) => matchesPlayedIdentity(scenario, identity));
  if (cachedScenario) return { scenario: cachedScenario, legacyTiming: await isLegacyScenario(cachedScenario) };

  let responseStatus: number | null = null;
  try {
    const response = await fetchManifest(`/api/catalog/${encodeURIComponent(identity.caseId)}?version=${encodeURIComponent(identity.contentVersion)}`);
    responseStatus = response.status;
    if (!response.ok) throw new Error("Published played-case version is unavailable");
    const historical: unknown = await response.json().catch(() => null);
    if (isRecord(historical) && isRecord(historical.payload) && historical.payload.kind === "playable-scenario-v1") {
      const candidate = normalizePlayableScenario(historical.payload.scenario);
      if (matchesPlayedIdentity(candidate, identity) && historical.fingerprint === candidate.fingerprint && playableFingerprint(candidate) === candidate.fingerprint) {
        return { scenario: candidate, legacyTiming: false };
      }
    }
  } catch {
    // A legacy server response can be intentionally incompatible with the
    // current normalizer. The status-aware fallback below handles that exact
    // immutable identity without allowing a 4xx denial to be bypassed.
  }

  const fallbackMode = playedCaseFallbackMode(responseStatus);
  if (fallbackMode === "none") throw new Error("Played-case version is unavailable");
  const { legacyScenarios } = await import("./legacy-scenarios");
  const legacy = legacyScenarios.find((scenario) => matchesPlayedIdentity(scenario, identity));
  if (legacy) return { scenario: legacy, legacyTiming: true };
  if (fallbackMode === "legacy-only") throw new Error("Published manifest failed current-runtime validation");
  const { archivedBundledScenarios, scenarios } = await import("./scenarios");
  const current = [...scenarios, ...archivedBundledScenarios].find((scenario) => matchesPlayedIdentity(scenario, identity));
  if (!current || playableFingerprint(current) !== current.fingerprint) throw new Error("Played-case version is unavailable");
  return { scenario: current, legacyTiming: false };
}

function playedScenarioIdentity(value: PlayedScenarioIdentity) {
  if (typeof value.id !== "string" || typeof value.caseId !== "string" || typeof value.contentVersion !== "string" || typeof value.fingerprint !== "string") {
    throw new Error("Invalid played-case scenario identity");
  }
  return { id: value.id, caseId: value.caseId, contentVersion: value.contentVersion, fingerprint: value.fingerprint };
}

function matchesPlayedIdentity(scenario: Scenario, identity: { id: string; caseId: string; contentVersion: string; fingerprint: string }) {
  return scenario.id === identity.id && scenario.caseId === identity.caseId && scenario.version === identity.contentVersion && scenario.fingerprint === identity.fingerprint;
}

async function isLegacyScenario(scenario: Scenario) {
  const { legacyScenarios } = await import("./legacy-scenarios");
  return legacyScenarios.some((candidate) => matchesPlayedIdentity(candidate, { id: scenario.id, caseId: scenario.caseId, contentVersion: scenario.version, fingerprint: scenario.fingerprint }));
}
