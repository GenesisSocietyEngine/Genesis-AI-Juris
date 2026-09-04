import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { caseVersions, playEvents, playSessions } from "../../../db/schema";
import { actionUseKey, decisionAvailability, resolveDecisionTiming } from "../../game-engine";
import { isRecord } from "../../case-integrity";
import { getChatGPTUser } from "../../chatgpt-auth";
import { normalizePlayableScenario, playableFingerprint } from "../../playable-integrity";
import { classifyD1Failure, type ObservabilityEventInput, type ObservabilityOperation, type ObservabilityReason } from "../../observability";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { initialMetrics } from "../../runtime-constants";
import type { DecisionOption, MetricKey, Scenario } from "../../types";
import { observabilityRequestId, observeOperationalEvent } from "../../server-observability";
import { runObservedD1Operation } from "../../observed-d1-operation";
import { resolveBundledManifest } from "../catalog/bundled-manifest";
import {
  advanceCanonicalTime,
  canonicalOutcomeClass,
  canonicalOutcomePresentation,
  canonicalPresentationState,
  createCanonicalRuntime,
  dispatchCanonicalAction,
  normalizeCanonicalRuntimeState,
  type CanonicalRuntimeState,
} from "../../canonical-runtime";

export const dynamic = "force-dynamic";

const MAX_SESSION_REVISION = 1_000;

type SessionObserver = (input: Omit<ObservabilityEventInput, "requestId" | "route">) => void;

function observerFor(request: Request): SessionObserver {
  const requestId = observabilityRequestId(request);
  return (input) => { observeOperationalEvent({ requestId, route: "play_sessions", ...input }); };
}

type SessionState = {
  currentStageId: string;
  clockMinute: number;
  metrics: Record<MetricKey, number>;
  actionUseCounts: Record<string, number>;
  completedDeadlineIds: string[];
  missedDeadlineIds: string[];
  decisions: Array<{ sequence: number; stageId: string; optionId: string }>;
  timeAdvances: Array<{ sequence: number; minutes: number }>;
  outcome: "strong" | "mixed" | "weak" | null;
  outcomeId?: string | null;
  availableActionIds?: string[];
  activeDeadlineIds?: string[];
  visibleInboxIds?: string[];
  resolvedInboxIds?: string[];
  availableEvidenceIds?: string[];
  deadlineDueMinutes?: Record<string, number>;
  canonicalResources?: Record<string, number>;
  canonicalNumericMetrics?: Record<string, number>;
  canonicalRuntime?: CanonicalRuntimeState;
  canonicalOutcome?: NonNullable<DecisionOption["resolvedOutcome"]>;
};

export async function GET(request: Request) {
  const observe = observerFor(request);
  const searchParams = new URL(request.url).searchParams;
  const importRequest = searchParams.get("purpose") === "import";
  const eventName = importRequest ? "session.import" as const : "session.load" as const;
  const operation = importRequest ? "import" as const : "load" as const;
  const identity = await getChatGPTUser();
  if (!identity) {
    observe({ eventName, outcome: "expected_rejection", reason: "auth_required", responseClass: "4xx", operation, logicalRepository: "play_sessions" });
    return privateJson({ error: "Sign in is required." }, 401);
  }
  const email = identity.email.trim().toLowerCase();
  const sessionKey = searchParams.get("sessionKey");
  const db = getDb();
  if (sessionKey) {
    if (!validSessionKey(sessionKey)) {
      observe({ eventName, outcome: "expected_rejection", reason: "invalid_request", responseClass: "4xx", operation, logicalRepository: "play_sessions" });
      return privateJson({ error: "Invalid play-session key." }, 400);
    }
    const [session] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1));
    const importRevisionValue = importRequest ? searchParams.get("expectedRevision") : null;
    const importRevision = importRevisionValue !== null && /^\d{1,4}$/u.test(importRevisionValue) ? Number(importRevisionValue) : null;
    const revisionMismatch = Boolean(session && importRevision !== null && session.revision !== importRevision);
    const expectedFingerprint = importRequest ? request.headers.get("X-GENESIS-Expected-Fingerprint")?.trim().toLowerCase() : null;
    const fingerprintMismatch = Boolean(session && expectedFingerprint && /^sha256-[a-f0-9]{64}$/u.test(expectedFingerprint) && session.caseFingerprint !== expectedFingerprint);
    if (revisionMismatch) {
      observe({ eventName: "played_case.revision_mismatch", outcome: "expected_rejection", reason: "stale_client", responseClass: "2xx", operation: "import", logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
    }
    if (fingerprintMismatch) {
      observe({ eventName: "played_case.fingerprint_mismatch", outcome: "expected_rejection", reason: "requested_identity_mismatch", responseClass: "2xx", operation: "import", logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
    }
    observe({ eventName, outcome: session && !revisionMismatch && !fingerprintMismatch ? "success" : "expected_rejection", reason: !session ? "not_found" : revisionMismatch ? "stale_revision" : fingerprintMismatch ? "requested_identity_mismatch" : "completed", responseClass: session ? "2xx" : "4xx", operation, logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
    return session ? privateJson({ session: publicSession(session) }) : privateJson({ error: "Play session not found." }, 404);
  }
  const sessions = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(eq(playSessions.userEmail, email)).orderBy(desc(playSessions.updatedAt)).limit(20));
  observe({ eventName, outcome: "success", reason: "completed", responseClass: "2xx", operation, logicalRepository: "play_sessions" });
  return privateJson({ sessions: sessions.map(publicSession) });
}

export async function POST(request: Request) {
  const observe = observerFor(request);
  if (!isSameOriginMutation(request)) {
    observe({ eventName: "session.save", outcome: "expected_rejection", reason: "invalid_request", responseClass: "4xx", operation: "save", logicalRepository: "play_sessions" });
    return privateJson({ error: "Cross-site mutation rejected." }, 403);
  }
  const identity = await getChatGPTUser();
  if (!identity) {
    observe({ eventName: "session.save", outcome: "expected_rejection", reason: "auth_required", responseClass: "4xx", operation: "save", logicalRepository: "play_sessions" });
    return privateJson({ error: "Sign in is required." }, 401);
  }
  const payload = await readJsonObject(request, 16_384);
  if (!payload || (payload.action !== "start" && payload.action !== "decision" && payload.action !== "advance_time" && payload.action !== "abandon")) {
    observe({ eventName: "session.save", outcome: "expected_rejection", reason: "invalid_request", responseClass: "4xx", operation: "save", logicalRepository: "play_sessions" });
    return privateJson({ error: "A valid play-session action is required." }, 400);
  }
  const email = identity.email.trim().toLowerCase();
  if (payload.action === "start") return startSession(email, payload, observe);
  if (payload.action === "decision") return applyDecision(email, payload, observe);
  if (payload.action === "advance_time") return advanceTime(email, payload, observe);
  return abandonSession(email, payload, observe);
}

async function startSession(email: string, payload: Record<string, unknown>, observe: SessionObserver) {
  const caseId = safeIdentity(payload.caseId, 140);
  const version = safeVersion(payload.version);
  const fingerprint = safeFingerprint(payload.fingerprint);
  if (!caseId || !version || !fingerprint) return privateJson({ error: "Exact case identity is required." }, 400);
  const scenario = await loadScenario(caseId, version, fingerprint, observe);
  if (!scenario) {
    observe({ eventName: "session.save", outcome: "expected_rejection", reason: "not_found", responseClass: "4xx", operation: "start", logicalRepository: "case_versions" });
    return privateJson({ error: "This exact published case version is unavailable." }, 404);
  }
  const initialStage = scenario.stages.find((stage) => stage.id === scenario.initialStageId);
  if (!initialStage) return privateJson({ error: "Published case has no valid opening stage." }, 422);
  if (payload.sessionKey !== undefined && (typeof payload.sessionKey !== "string" || !validSessionKey(payload.sessionKey))) {
    return privateJson({ error: "The optional start idempotency key must be a UUID." }, 400);
  }
  const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : crypto.randomUUID();
  const now = new Date().toISOString();
  let state: SessionState;
  try {
    if (scenario.mobileParity) {
      const runtime = createCanonicalRuntime(scenario.caseId, secureRuntimeSeed());
      if (!scenario.sourceFingerprint || runtime.sourceFingerprint !== scenario.sourceFingerprint) {
        observe({ eventName: "played_case.fingerprint_mismatch", outcome: "internal_failure", reason: "canonical_source_mismatch", responseClass: "4xx", operation: "start", logicalRepository: "case_versions" });
        return privateJson({ error: "The canonical case runtime could not be opened." }, 422);
      }
      state = canonicalSessionState(runtime, [], []);
    } else {
      state = {
        currentStageId: scenario.initialStageId,
        clockMinute: scenario.initialClockMinute,
        metrics: { ...initialMetrics },
        actionUseCounts: {}, completedDeadlineIds: [], missedDeadlineIds: [], decisions: [], timeAdvances: [], outcome: null,
      };
    }
  } catch {
    return privateJson({ error: "The canonical case runtime could not be opened." }, 422);
  }
  const startEventId = `start:${sessionKey}`;
  const db = getDb();
  const [prior] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1));
  const insertedSessionId = sql<number>`(
    SELECT ${playSessions.id} FROM ${playSessions}
    WHERE ${playSessions.sessionKey} = ${sessionKey}
      AND ${playSessions.userEmail} = ${email}
      AND ${playSessions.caseId} = ${caseId}
      AND ${playSessions.caseVersion} = ${version}
      AND ${playSessions.caseFingerprint} = ${fingerprint}
    LIMIT 1
  )`;
  const d1StartedAt = Date.now();
  try {
    await db.batch([
      db.insert(playSessions).values({
        sessionKey, userEmail: email, caseId, caseVersion: version, caseFingerprint: fingerprint,
        state, status: "active", revision: 0, startedAt: now, updatedAt: now,
      }).onConflictDoNothing(),
      db.insert(playEvents).values({
        playSessionId: insertedSessionId,
        eventId: startEventId,
        sequence: 0,
        eventType: "session_started",
        payload: { caseId, version, fingerprint },
        occurredAt: now,
      }).onConflictDoNothing(),
    ]);
    observeD1(observe, "start", "success", "completed", Date.now() - d1StartedAt);
  } catch (error) {
    const failure = classifyD1Failure(error);
    observeD1(observe, "start", failure.outcome, failure.reason, Date.now() - d1StartedAt);
    try {
      const [collision] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(eq(playSessions.sessionKey, sessionKey)).limit(1));
      const sameStart = collision
        && collision.userEmail === email
        && collision.caseId === caseId
        && collision.caseVersion === version
        && collision.caseFingerprint === fingerprint;
      if (sameStart) {
        const startEvent = await findEvent(db, collision.id, startEventId, observe);
        if (startEvent?.eventType === "session_started" && startEvent.sequence === 0) {
          const replayStartedAt = Date.now();
          observeReplayStart(observe, "start", "play_events", collision.revision);
          observe({ eventName: "replay.success", outcome: "success", reason: "idempotent_repeat", responseClass: "2xx", latencyMs: Date.now() - replayStartedAt, operation: "start", logicalRepository: "play_events", commandCount: collision.revision });
          observe({ eventName: "session.save", outcome: "success", reason: "completed", responseClass: "2xx", operation: "start", logicalRepository: "play_sessions", commandCount: collision.revision });
          return privateJson({ session: publicSession(collision), idempotentReplay: true });
        }
        observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "start", logicalRepository: "play_sessions" });
        return privateJson({ error: "The play session could not be started. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
      }
      if (collision) {
        observe({ eventName: "session.save", outcome: "expected_rejection", reason: "constraint_conflict", responseClass: "4xx", operation: "start", logicalRepository: "play_sessions" });
        return privateJson({ error: "The play-session idempotency key is already bound to another session.", code: "session_key_conflict" }, 409);
      }
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "start", logicalRepository: "play_sessions" });
      return privateJson({ error: "The play session could not be started. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "start", logicalRepository: "play_sessions" });
      return privateJson({ error: "The play session could not be started. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [session] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1));
  if (!session || session.caseId !== caseId || session.caseVersion !== version || session.caseFingerprint !== fingerprint) {
    observe({ eventName: "session.save", outcome: "expected_rejection", reason: "constraint_conflict", responseClass: "4xx", operation: "start", logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
    return privateJson({ error: "The play-session idempotency key is already bound to another session.", code: "session_key_conflict" }, 409);
  }
  if (prior) {
    const replayStartedAt = Date.now();
    observeReplayStart(observe, "start", "play_events", session.revision);
    observe({ eventName: "replay.success", outcome: "success", reason: "idempotent_repeat", responseClass: "2xx", latencyMs: Date.now() - replayStartedAt, operation: "start", logicalRepository: "play_events", commandCount: session.revision });
  }
  observe({ eventName: "session.save", outcome: "success", reason: "completed", responseClass: "2xx", operation: "start", logicalRepository: "play_sessions", commandCount: session.revision });
  return privateJson({ session: publicSession(session), ...(prior ? { idempotentReplay: true } : {}) }, prior ? 200 : 201);
}

async function applyDecision(email: string, payload: Record<string, unknown>, observe: SessionObserver) {
  const sessionKey = typeof payload.sessionKey === "string" && validSessionKey(payload.sessionKey) ? payload.sessionKey : "";
  const eventId = typeof payload.eventId === "string" && validEventId(payload.eventId) ? payload.eventId : "";
  const optionId = typeof payload.optionId === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(payload.optionId) ? payload.optionId : "";
  const expectedRevision = validRevision(payload.expectedRevision) ? payload.expectedRevision : -1;
  if (!sessionKey || !eventId || !optionId || expectedRevision < 0) return privateJson({ error: "Session, idempotency key, revision and option are required." }, 400);
  const db = getDb();
  const [session] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1));
  if (!session) return privateJson({ error: "Play session not found." }, 404);
  const duplicate = await findEvent(db, session.id, eventId, observe);
  if (duplicate) return duplicateDecisionResponse(duplicate, eventId, optionId, expectedRevision, session, observe);
  if (session.status !== "active" || session.revision !== expectedRevision) return staleSession(session, observe, "decision");
  if (expectedRevision >= MAX_SESSION_REVISION) return privateJson({ error: "This play session reached its maximum event count." }, 409);
  const scenario = await loadScenario(session.caseId, session.caseVersion, session.caseFingerprint, observe);
  if (!scenario) {
    observe({ eventName: "historical_bundle.lookup_miss", outcome: "internal_failure", reason: "stored_version_unavailable", responseClass: "4xx", operation: "read", logicalRepository: "case_versions", commandCount: session.revision });
    return privateJson({ error: "The session case version is no longer available." }, 410);
  }
  const state = observedNormalizeSessionState(session.state, scenario, session.revision, observe, "decision");
  if (!state || state.outcome) return privateJson({ error: "Stored play-session state is invalid or complete." }, 409);
  const stage = scenario.stages.find((item) => item.id === state.currentStageId);
  const option = stage?.options.find((item) => item.id === optionId);
  if (!stage || !option) return privateJson({ error: "The selected action is not available at the current stage." }, 409);
  const useKey = actionUseKey(option);
  const nextRevision = expectedRevision + 1;
  let nextState: SessionState;
  if (state.canonicalRuntime) {
    if (!option.canonicalActionId || !state.availableActionIds?.includes(option.canonicalActionId)) {
      return privateJson({ error: "The selected action is blocked by the canonical mobile rules." }, 409);
    }
    try {
      const runtime = dispatchCanonicalAction(state.canonicalRuntime, option.canonicalActionId);
      nextState = canonicalSessionState(runtime, [...state.decisions, { sequence: nextRevision, stageId: stage.id, optionId: option.id }], state.timeAdvances);
    } catch {
      return privateJson({ error: "The selected action is blocked by the canonical mobile rules." }, 409);
    }
  } else {
    const availability = decisionAvailability(option, state.metrics, state.actionUseCounts[useKey] ?? 0);
    if (!availability.available) return privateJson({ error: "The selected action is blocked by the authored rules.", guards: availability.blockedGuards }, 409);
    const metrics = { ...state.metrics };
    for (const key of Object.keys(option.effects) as MetricKey[]) metrics[key] = clampMetric(metrics[key] + (option.effects[key] ?? 0));
    const timing = resolveDecisionTiming(scenario, state.clockMinute, option, state.completedDeadlineIds, state.missedDeadlineIds);
    if (timing.newlyMissedDeadlineIds.length) {
      metrics.exposure = clampMetric(metrics.exposure + timing.newlyMissedDeadlineIds.length * 8);
      metrics.trust = clampMetric(metrics.trust - timing.newlyMissedDeadlineIds.length * 4);
    }
    const nextStage = timing.nextStageId ? scenario.stages.find((item) => item.id === timing.nextStageId) : undefined;
    if (!nextStage) return privateJson({ error: "The authored action has no valid destination." }, 422);
    nextState = {
      currentStageId: nextStage.id,
      clockMinute: timing.transitionMinute,
      metrics,
      actionUseCounts: { ...state.actionUseCounts, [useKey]: (state.actionUseCounts[useKey] ?? 0) + 1 },
      completedDeadlineIds: timing.completedDeadlineIds,
      missedDeadlineIds: [...new Set([...state.missedDeadlineIds, ...timing.newlyMissedDeadlineIds])],
      decisions: [...state.decisions, { sequence: nextRevision, stageId: stage.id, optionId: option.id }],
      timeAdvances: state.timeAdvances,
      outcome: nextStage.terminal ? option.resolvedOutcome?.classification ?? nextStage.terminalOutcome ?? classifyMetrics(metrics) : null,
    };
  }
  const now = new Date().toISOString();
  const status: "completed" | "active" = nextState.outcome ? "completed" : "active";
  const updatedSessionId = sql<number>`(
    SELECT ${playSessions.id} FROM ${playSessions}
    WHERE ${playSessions.id} = ${session.id}
      AND ${playSessions.userEmail} = ${email}
      AND ${playSessions.status} = ${status}
      AND ${playSessions.revision} = ${nextRevision}
      AND ${playSessions.lastEventAt} = ${now}
    LIMIT 1
  )`;
  const d1StartedAt = Date.now();
  try {
    await db.batch([
      db.update(playSessions).set({ state: nextState, status, revision: nextRevision, lastEventAt: now, completedAt: status === "completed" ? now : null, updatedAt: now }).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email), eq(playSessions.status, "active"), eq(playSessions.revision, expectedRevision))),
      db.insert(playEvents).values({
        playSessionId: updatedSessionId,
        eventId,
        sequence: nextRevision,
        eventType: "decision",
        payload: {
          stageId: stage.id,
          optionId: option.id,
          expectedRevision,
          resultingRevision: nextRevision,
          resultingStageId: nextState.currentStageId,
          resultingClockMinute: nextState.clockMinute,
          outcome: nextState.outcome,
        },
        occurredAt: now,
      }),
    ]);
    observeD1(observe, "decision", "success", "completed", Date.now() - d1StartedAt);
  } catch (error) {
    const failure = classifyD1Failure(error);
    observeD1(observe, "decision", failure.outcome, failure.reason, Date.now() - d1StartedAt);
    try {
      const [current] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email))).limit(1));
      const currentEvent = await findEvent(db, session.id, eventId, observe);
      if (currentEvent && current) return duplicateDecisionResponse(currentEvent, eventId, optionId, expectedRevision, current, observe);
      if (!current || current.status !== "active" || current.revision !== expectedRevision) return staleSession(current ?? null, observe, "decision");
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "decision", logicalRepository: "play_sessions", commandCount: current.revision });
      return privateJson({ error: "The decision could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "decision", logicalRepository: "play_sessions", commandCount: expectedRevision });
      return privateJson({ error: "The decision could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [saved] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email))).limit(1));
  const savedEvent = await findEvent(db, session.id, eventId, observe);
  if (!saved || !savedEvent) return staleSession(saved ?? null, observe, "decision");
  observe({ eventName: "session.save", outcome: "success", reason: "completed", responseClass: "2xx", operation: "decision", logicalRepository: "play_sessions", commandCount: saved.revision });
  return privateJson({ session: publicSession(saved), event: { eventId, sequence: savedEvent.sequence } });
}

async function advanceTime(email: string, payload: Record<string, unknown>, observe: SessionObserver) {
  const sessionKey = typeof payload.sessionKey === "string" && validSessionKey(payload.sessionKey) ? payload.sessionKey : "";
  const eventId = typeof payload.eventId === "string" && validEventId(payload.eventId) ? payload.eventId : "";
  const expectedRevision = validRevision(payload.expectedRevision) ? payload.expectedRevision : -1;
  const minutes = typeof payload.minutes === "number" && Number.isInteger(payload.minutes) && payload.minutes > 0 && payload.minutes <= 1_440 ? payload.minutes : 0;
  if (!sessionKey || !eventId || expectedRevision < 0 || !minutes) return privateJson({ error: "Session, idempotency key, revision and time increment are required." }, 400);
  const db = getDb();
  const [session] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1));
  if (!session) return privateJson({ error: "Play session not found." }, 404);
  const duplicate = await findEvent(db, session.id, eventId, observe);
  if (duplicate) return duplicateAdvanceTimeResponse(duplicate, eventId, minutes, expectedRevision, session, observe);
  if (session.status !== "active" || session.revision !== expectedRevision) return staleSession(session, observe, "advance_time");
  if (expectedRevision >= MAX_SESSION_REVISION) return privateJson({ error: "This play session reached its maximum event count." }, 409);
  const scenario = await loadScenario(session.caseId, session.caseVersion, session.caseFingerprint, observe);
  if (!scenario) {
    observe({ eventName: "historical_bundle.lookup_miss", outcome: "internal_failure", reason: "stored_version_unavailable", responseClass: "4xx", operation: "read", logicalRepository: "case_versions", commandCount: session.revision });
    return privateJson({ error: "The session case version is no longer available." }, 410);
  }
  const state = observedNormalizeSessionState(session.state, scenario, session.revision, observe, "advance_time");
  if (!state?.canonicalRuntime || state.outcome) return privateJson({ error: "Foreground time is unavailable for this play session." }, 409);
  const nextRevision = expectedRevision + 1;
  let nextState: SessionState;
  try {
    const runtime = advanceCanonicalTime(state.canonicalRuntime, minutes);
    nextState = canonicalSessionState(runtime, state.decisions, [...state.timeAdvances, { sequence: nextRevision, minutes }]);
  } catch {
    return privateJson({ error: "This canonical case cannot advance by the requested interval." }, 409);
  }
  const status: "completed" | "active" = nextState.outcome ? "completed" : "active";
  const now = new Date().toISOString();
  const updatedSessionId = sql<number>`(
    SELECT ${playSessions.id} FROM ${playSessions}
    WHERE ${playSessions.id} = ${session.id}
      AND ${playSessions.userEmail} = ${email}
      AND ${playSessions.status} = ${status}
      AND ${playSessions.revision} = ${nextRevision}
      AND ${playSessions.lastEventAt} = ${now}
    LIMIT 1
  )`;
  const d1StartedAt = Date.now();
  try {
    await db.batch([
      db.update(playSessions).set({ state: nextState, status, revision: nextRevision, lastEventAt: now, completedAt: status === "completed" ? now : null, updatedAt: now }).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email), eq(playSessions.status, "active"), eq(playSessions.revision, expectedRevision))),
      db.insert(playEvents).values({
        playSessionId: updatedSessionId,
        eventId,
        sequence: nextRevision,
        eventType: "time_advanced",
        payload: {
          minutes,
          expectedRevision,
          resultingRevision: nextRevision,
          resultingStageId: nextState.currentStageId,
          resultingClockMinute: nextState.clockMinute,
          outcome: nextState.outcome,
        },
        occurredAt: now,
      }),
    ]);
    observeD1(observe, "advance_time", "success", "completed", Date.now() - d1StartedAt);
  } catch (error) {
    const failure = classifyD1Failure(error);
    observeD1(observe, "advance_time", failure.outcome, failure.reason, Date.now() - d1StartedAt);
    try {
      const [current] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email))).limit(1));
      const currentEvent = await findEvent(db, session.id, eventId, observe);
      if (currentEvent && current) return duplicateAdvanceTimeResponse(currentEvent, eventId, minutes, expectedRevision, current, observe);
      if (!current || current.status !== "active" || current.revision !== expectedRevision) return staleSession(current ?? null, observe, "advance_time");
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "advance_time", logicalRepository: "play_sessions", commandCount: current.revision });
      return privateJson({ error: "The time advance could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "advance_time", logicalRepository: "play_sessions", commandCount: expectedRevision });
      return privateJson({ error: "The time advance could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [saved] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email))).limit(1));
  const savedEvent = await findEvent(db, session.id, eventId, observe);
  if (!saved || !savedEvent) return staleSession(saved ?? null, observe, "advance_time");
  observe({ eventName: "session.save", outcome: "success", reason: "completed", responseClass: "2xx", operation: "advance_time", logicalRepository: "play_sessions", commandCount: saved.revision });
  return privateJson({ session: publicSession(saved), event: { eventId, sequence: savedEvent.sequence } });
}

async function abandonSession(email: string, payload: Record<string, unknown>, observe: SessionObserver) {
  const sessionKey = typeof payload.sessionKey === "string" && validSessionKey(payload.sessionKey) ? payload.sessionKey : "";
  const eventId = typeof payload.eventId === "string" && validEventId(payload.eventId) ? payload.eventId : "";
  const expectedRevision = validRevision(payload.expectedRevision) ? payload.expectedRevision : -1;
  if (!sessionKey || !eventId || expectedRevision < 0) return privateJson({ error: "Session, idempotency key and revision are required." }, 400);
  const db = getDb();
  const [current] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1));
  if (!current) return privateJson({ error: "Play session not found." }, 404);
  const duplicate = await findEvent(db, current.id, eventId, observe);
  if (duplicate) return duplicateAbandonResponse(duplicate, eventId, expectedRevision, current, observe);
  if (current.status !== "active" || current.revision !== expectedRevision) return staleSession(current, observe, "abandon");
  if (expectedRevision >= MAX_SESSION_REVISION) return privateJson({ error: "This play session reached its maximum event count." }, 409);
  const now = new Date().toISOString();
  const nextRevision = expectedRevision + 1;
  const updatedSessionId = sql<number>`(
    SELECT ${playSessions.id} FROM ${playSessions}
    WHERE ${playSessions.id} = ${current.id}
      AND ${playSessions.userEmail} = ${email}
      AND ${playSessions.status} = 'abandoned'
      AND ${playSessions.revision} = ${nextRevision}
      AND ${playSessions.lastEventAt} = ${now}
    LIMIT 1
  )`;
  const d1StartedAt = Date.now();
  try {
    await db.batch([
      db.update(playSessions).set({ status: "abandoned", revision: nextRevision, lastEventAt: now, updatedAt: now }).where(and(
        eq(playSessions.id, current.id), eq(playSessions.userEmail, email), eq(playSessions.status, "active"), eq(playSessions.revision, expectedRevision),
      )),
      db.insert(playEvents).values({ playSessionId: updatedSessionId, eventId, sequence: nextRevision, eventType: "session_abandoned", payload: { expectedRevision, resultingRevision: nextRevision }, occurredAt: now }),
    ]);
    observeD1(observe, "abandon", "success", "completed", Date.now() - d1StartedAt);
  } catch (error) {
    const failure = classifyD1Failure(error);
    observeD1(observe, "abandon", failure.outcome, failure.reason, Date.now() - d1StartedAt);
    try {
      const [latest] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.id, current.id), eq(playSessions.userEmail, email))).limit(1));
      const latestEvent = await findEvent(db, current.id, eventId, observe);
      if (latestEvent && latest) return duplicateAbandonResponse(latestEvent, eventId, expectedRevision, latest, observe);
      if (!latest || latest.status !== "active" || latest.revision !== expectedRevision) return staleSession(latest ?? null, observe, "abandon");
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "abandon", logicalRepository: "play_sessions", commandCount: latest.revision });
      return privateJson({ error: "The abandonment could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      observe({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", responseClass: "5xx", operation: "abandon", logicalRepository: "play_sessions", commandCount: expectedRevision });
      return privateJson({ error: "The abandonment could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [saved] = await observedD1Read(observe, "play_sessions", () => db.select().from(playSessions).where(and(eq(playSessions.id, current.id), eq(playSessions.userEmail, email))).limit(1));
  if (!saved) return staleSession(null, observe, "abandon");
  observe({ eventName: "session.save", outcome: "success", reason: "completed", responseClass: "2xx", operation: "abandon", logicalRepository: "play_sessions", commandCount: saved.revision });
  return privateJson({ session: publicSession(saved), event: { eventId, sequence: nextRevision } });
}

async function loadScenario(caseId: string, version: string, fingerprint: string, observe: SessionObserver): Promise<Scenario | null> {
  const [record] = await observedD1Read(observe, "case_versions", () => getDb().select({ payload: caseVersions.payload, fingerprint: caseVersions.fingerprint }).from(caseVersions).where(and(eq(caseVersions.caseId, caseId), eq(caseVersions.version, version), eq(caseVersions.fingerprint, fingerprint), isNotNull(caseVersions.publishedAt))).limit(1));
  if (!record || !isRecord(record.payload)) return null;
  const bundled = resolveBundledManifest(record.payload, caseId, version, fingerprint);
  if (bundled) return bundled.scenario;
  if (record.payload.kind !== "playable-scenario-v1") return null;
  try {
    const scenario = normalizePlayableScenario(record.payload.scenario);
    return scenario.caseId === caseId && scenario.version === version && scenario.fingerprint === fingerprint && playableFingerprint(scenario) === fingerprint ? scenario : null;
  } catch { return null; }
}

function normalizeSessionState(value: unknown, scenario: Scenario, revision: number): SessionState | null {
  if (!isRecord(value) || !validRevision(revision)) return null;

  const canonicalRuntime = normalizeCanonicalRuntimeState(value.canonicalRuntime, scenario.caseId, scenario.sourceFingerprint);
  if (canonicalRuntime) {
    if (!scenario.mobileParity || !Array.isArray(value.decisions) || !Array.isArray(value.timeAdvances)) return null;
    const optionById = new Map(scenario.stages.flatMap((scenarioStage) => scenarioStage.options.map((option) => [option.id, { option, stageId: scenarioStage.id }] as const)));
    const decisions: SessionState["decisions"] = [];
    const derivedUses: Record<string, number> = {};
    for (const item of value.decisions) {
      if (!isRecord(item) || !validCommandSequence(item.sequence, revision) || typeof item.stageId !== "string" || typeof item.optionId !== "string") return null;
      const authored = optionById.get(item.optionId);
      if (!authored || authored.stageId !== item.stageId || !authored.option.canonicalActionId) return null;
      decisions.push({ sequence: item.sequence, stageId: item.stageId, optionId: item.optionId });
      derivedUses[authored.option.canonicalActionId] = (derivedUses[authored.option.canonicalActionId] ?? 0) + 1;
    }
    const timeAdvances: SessionState["timeAdvances"] = [];
    for (const item of value.timeAdvances) {
      if (!isRecord(item) || !validCommandSequence(item.sequence, revision) || typeof item.minutes !== "number" || !Number.isInteger(item.minutes) || item.minutes <= 0 || item.minutes > 1_440) return null;
      timeAdvances.push({ sequence: item.sequence, minutes: item.minutes });
    }
    const commandSequences = [...decisions, ...timeAdvances].map((item) => item.sequence).sort((left, right) => left - right);
    if (commandSequences.length !== revision || commandSequences.some((sequence, index) => sequence !== index + 1)) return null;
    const runtimeUses = Object.entries(canonicalRuntime.actionUses);
    if (runtimeUses.length !== Object.keys(derivedUses).length
      || runtimeUses.some(([actionId, count]) => !Number.isInteger(count) || count <= 0 || derivedUses[actionId] !== count)) return null;
    try {
      let replay = createCanonicalRuntime(scenario.caseId, canonicalRuntime.seed);
      const decisionsBySequence = new Map(decisions.map((item) => [item.sequence, item]));
      const advancesBySequence = new Map(timeAdvances.map((item) => [item.sequence, item]));
      for (let sequence = 1; sequence <= revision; sequence += 1) {
        const decision = decisionsBySequence.get(sequence);
        if (decision) {
          const authored = optionById.get(decision.optionId);
          if (!authored?.option.canonicalActionId || replay.stageId !== decision.stageId) return null;
          replay = dispatchCanonicalAction(replay, authored.option.canonicalActionId);
        } else {
          const advance = advancesBySequence.get(sequence);
          if (!advance) return null;
          replay = advanceCanonicalTime(replay, advance.minutes);
        }
      }
      if (!sameJsonValue(replay, canonicalRuntime)) return null;
    } catch {
      return null;
    }
    const normalized = canonicalSessionState(canonicalRuntime, decisions, timeAdvances);
    return scenario.stages.some((stage) => stage.id === normalized.currentStageId) ? normalized : null;
  }

  if (typeof value.currentStageId !== "string"
    || typeof value.clockMinute !== "number"
    || !Number.isInteger(value.clockMinute)
    || value.clockMinute < scenario.initialClockMinute
    || value.clockMinute > 100_000_000
    || !isRecord(value.metrics)
    || !isRecord(value.actionUseCounts)
    || !Array.isArray(value.completedDeadlineIds)
    || !Array.isArray(value.missedDeadlineIds)
    || !Array.isArray(value.decisions)) return null;

  const stage = scenario.stages.find((item) => item.id === value.currentStageId);
  if (!stage) return null;
  const metricValues = value.metrics;
  const actionCountValues = value.actionUseCounts;
  const metricKeys: MetricKey[] = ["position", "evidence", "trust", "exposure"];
  if (Object.keys(metricValues).length !== metricKeys.length || !metricKeys.every((key) => {
    const metric = metricValues[key];
    return typeof metric === "number" && Number.isFinite(metric) && metric >= 0 && metric <= 100;
  })) return null;
  const metrics = Object.fromEntries(metricKeys.map((key) => [key, Number(metricValues[key])])) as Record<MetricKey, number>;

  const optionById = new Map(scenario.stages.flatMap((scenarioStage) => scenarioStage.options.map((option) => [option.id, { option, stageId: scenarioStage.id }] as const)));
  const actionUseKeys = new Set([...optionById.values()].map(({ option }) => actionUseKey(option)));
  const actionEntries = Object.entries(actionCountValues);
  if (actionEntries.length > actionUseKeys.size || actionEntries.some(([key, count]) => !actionUseKeys.has(key) || typeof count !== "number" || !Number.isInteger(count) || count <= 0 || count > revision)) return null;
  const actionUseCounts = Object.fromEntries(actionEntries) as Record<string, number>;

  const deadlineIds = new Set(scenario.deadlines.map((deadline) => deadline.id));
  const normalizeDeadlineIds = (items: unknown[]) => {
    if (items.length > deadlineIds.size || items.some((item) => typeof item !== "string" || !deadlineIds.has(item))) return null;
    const result = items as string[];
    return new Set(result).size === result.length ? result : null;
  };
  const completedDeadlineIds = normalizeDeadlineIds(value.completedDeadlineIds);
  const missedDeadlineIds = normalizeDeadlineIds(value.missedDeadlineIds);
  if (!completedDeadlineIds || !missedDeadlineIds) return null;

  if (value.decisions.length !== revision) return null;
  const decisions: SessionState["decisions"] = [];
  const derivedUseCounts: Record<string, number> = {};
  for (const [index, item] of value.decisions.entries()) {
    if (!isRecord(item)
      || item.sequence !== index + 1
      || typeof item.stageId !== "string"
      || typeof item.optionId !== "string") return null;
    const authored = optionById.get(item.optionId);
    if (!authored || authored.stageId !== item.stageId) return null;
    decisions.push({ sequence: item.sequence, stageId: item.stageId, optionId: item.optionId });
    const useKey = actionUseKey(authored.option);
    derivedUseCounts[useKey] = (derivedUseCounts[useKey] ?? 0) + 1;
  }
  if (Object.keys(derivedUseCounts).length !== actionEntries.length
    || Object.entries(derivedUseCounts).some(([optionId, count]) => actionUseCounts[optionId] !== count)) return null;

  const outcome = value.outcome === null
    ? null
    : value.outcome === "strong" || value.outcome === "mixed" || value.outcome === "weak"
      ? value.outcome
      : undefined;
  if (outcome === undefined || Boolean(outcome) !== Boolean(stage.terminal)) return null;
  return { currentStageId: value.currentStageId, clockMinute: value.clockMinute, metrics, actionUseCounts, completedDeadlineIds, missedDeadlineIds, decisions, timeAdvances: [], outcome };
}

type StoredPlayEvent = Pick<typeof playEvents.$inferSelect, "eventType" | "payload" | "sequence">;

async function findEvent(db: ReturnType<typeof getDb>, playSessionId: number, eventId: string, observe: SessionObserver): Promise<StoredPlayEvent | null> {
  const [event] = await observedD1Read(observe, "play_events", () => db.select({ eventType: playEvents.eventType, payload: playEvents.payload, sequence: playEvents.sequence }).from(playEvents).where(and(
    eq(playEvents.playSessionId, playSessionId), eq(playEvents.eventId, eventId),
  )).limit(1));
  return event ?? null;
}

function duplicateDecisionResponse(event: StoredPlayEvent, eventId: string, optionId: string, expectedRevision: number, session: typeof playSessions.$inferSelect, observe: SessionObserver) {
  const replayStartedAt = Date.now();
  observeReplayStart(observe, "decision", "play_events", session.revision);
  if (event.eventType === "decision"
    && event.sequence === expectedRevision + 1
    && isRecord(event.payload)
    && event.payload.optionId === optionId
    && event.payload.expectedRevision === expectedRevision) {
    observe({ eventName: "replay.success", outcome: "success", reason: "idempotent_repeat", responseClass: "2xx", latencyMs: Date.now() - replayStartedAt, operation: "decision", logicalRepository: "play_events", commandCount: session.revision });
    return privateJson({ session: publicSession(session), event: { eventId, sequence: event.sequence }, idempotentReplay: true });
  }
  observe({ eventName: "replay.expected_rejection", outcome: "expected_rejection", reason: "idempotency_conflict", responseClass: "4xx", latencyMs: Date.now() - replayStartedAt, operation: "decision", logicalRepository: "play_events", commandCount: session.revision });
  return privateJson({ error: "This idempotency key was already used for a different play-session event.", code: "idempotency_conflict" }, 409);
}

function duplicateAdvanceTimeResponse(event: StoredPlayEvent, eventId: string, minutes: number, expectedRevision: number, session: typeof playSessions.$inferSelect, observe: SessionObserver) {
  const replayStartedAt = Date.now();
  observeReplayStart(observe, "advance_time", "play_events", session.revision);
  if (event.eventType === "time_advanced"
    && event.sequence === expectedRevision + 1
    && isRecord(event.payload)
    && event.payload.minutes === minutes
    && event.payload.expectedRevision === expectedRevision) {
    observe({ eventName: "replay.success", outcome: "success", reason: "idempotent_repeat", responseClass: "2xx", latencyMs: Date.now() - replayStartedAt, operation: "advance_time", logicalRepository: "play_events", commandCount: session.revision });
    return privateJson({ session: publicSession(session), event: { eventId, sequence: event.sequence }, idempotentReplay: true });
  }
  observe({ eventName: "replay.expected_rejection", outcome: "expected_rejection", reason: "idempotency_conflict", responseClass: "4xx", latencyMs: Date.now() - replayStartedAt, operation: "advance_time", logicalRepository: "play_events", commandCount: session.revision });
  return privateJson({ error: "This idempotency key was already used for a different play-session event.", code: "idempotency_conflict" }, 409);
}

function duplicateAbandonResponse(event: StoredPlayEvent, eventId: string, expectedRevision: number, session: typeof playSessions.$inferSelect, observe: SessionObserver) {
  const replayStartedAt = Date.now();
  observeReplayStart(observe, "abandon", "play_events", session.revision);
  if (event.eventType === "session_abandoned"
    && event.sequence === expectedRevision + 1
    && isRecord(event.payload)
    && event.payload.expectedRevision === expectedRevision) {
    observe({ eventName: "replay.success", outcome: "success", reason: "idempotent_repeat", responseClass: "2xx", latencyMs: Date.now() - replayStartedAt, operation: "abandon", logicalRepository: "play_events", commandCount: session.revision });
    return privateJson({ session: publicSession(session), event: { eventId, sequence: event.sequence }, idempotentReplay: true });
  }
  observe({ eventName: "replay.expected_rejection", outcome: "expected_rejection", reason: "idempotency_conflict", responseClass: "4xx", latencyMs: Date.now() - replayStartedAt, operation: "abandon", logicalRepository: "play_events", commandCount: session.revision });
  return privateJson({ error: "This idempotency key was already used for a different play-session event.", code: "idempotency_conflict" }, 409);
}

function staleSession(session: typeof playSessions.$inferSelect | null, observe: SessionObserver, operation: ObservabilityOperation) {
  const replayStartedAt = Date.now();
  observeReplayStart(observe, operation, "play_sessions", session?.revision ?? null);
  observe({ eventName: "replay.expected_rejection", outcome: "expected_rejection", reason: "stale_revision", responseClass: "4xx", latencyMs: Date.now() - replayStartedAt, operation, logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
  observe({ eventName: "played_case.revision_mismatch", outcome: "expected_rejection", reason: "stale_client", responseClass: "4xx", operation, logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
  observe({ eventName: "session.save", outcome: "expected_rejection", reason: "stale_revision", responseClass: "4xx", operation, logicalRepository: "play_sessions", commandCount: session?.revision ?? null });
  return privateJson({ error: "The play session changed in another tab.", code: "stale_session", session: session ? publicSession(session) : null }, 409);
}

function publicSession(session: typeof playSessions.$inferSelect) {
  const state = isRecord(session.state) ? { ...session.state } : session.state;
  if (isRecord(state)) delete state.canonicalRuntime;
  return { sessionKey: session.sessionKey, caseId: session.caseId, version: session.caseVersion, fingerprint: session.caseFingerprint, state, status: session.status, revision: session.revision, startedAt: session.startedAt, updatedAt: session.updatedAt, lastEventAt: session.lastEventAt, completedAt: session.completedAt };
}
function canonicalSessionState(runtime: CanonicalRuntimeState, decisions: SessionState["decisions"], timeAdvances: SessionState["timeAdvances"]): SessionState {
  const presentation = canonicalPresentationState(runtime);
  return {
    currentStageId: presentation.currentStageId,
    clockMinute: presentation.clockMinute,
    metrics: presentation.metrics,
    actionUseCounts: presentation.actionUseCounts,
    completedDeadlineIds: presentation.completedDeadlineIds,
    missedDeadlineIds: presentation.missedDeadlineIds,
    decisions,
    timeAdvances,
    outcome: canonicalOutcomeClass(presentation.outcomeId),
    outcomeId: presentation.outcomeId,
    availableActionIds: presentation.availableActionIds,
    activeDeadlineIds: presentation.activeDeadlineIds,
    visibleInboxIds: presentation.visibleInboxIds,
    resolvedInboxIds: presentation.resolvedInboxIds,
    availableEvidenceIds: presentation.availableEvidenceIds,
    deadlineDueMinutes: presentation.deadlineDueMinutes,
    canonicalResources: { ...runtime.resources },
    canonicalNumericMetrics: { ...runtime.numericMetrics },
    canonicalRuntime: runtime,
    canonicalOutcome: canonicalOutcomePresentation(runtime.caseId, presentation.outcomeId),
  };
}
function secureRuntimeSeed() {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return words[0] * 65_536 + (words[1] & 0xffff);
}
function safeIdentity(value: unknown, max: number) { return typeof value === "string" && value.length <= max && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value) ? value : null; }
function safeVersion(value: unknown) { return typeof value === "string" && value.length <= 40 && /^\d+\.\d+\.\d+$/.test(value) ? value : null; }
function safeFingerprint(value: unknown) { return typeof value === "string" && /^sha256-[a-f0-9]{64}$/.test(value) ? value : null; }
function validSessionKey(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value); }
function validEventId(value: string) { return /^[A-Za-z0-9_.:-]{8,160}$/.test(value); }
function validRevision(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SESSION_REVISION; }
function validCommandSequence(value: unknown, revision: number): value is number { return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= revision; }
function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => sameJsonValue(item, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameJsonValue(left[key], right[key]));
}
function observedNormalizeSessionState(value: unknown, scenario: Scenario, revision: number, observe: SessionObserver, operation: ObservabilityOperation) {
  const startedAt = Date.now();
  observe({ eventName: "replay.start", outcome: "started", reason: "state_validation", responseClass: "none", latencyMs: 0, operation: "replay", logicalRepository: "play_sessions", commandCount: revision });
  const state = normalizeSessionState(value, scenario, revision);
  if (state) {
    observe({ eventName: "replay.success", outcome: "success", reason: "state_matches", responseClass: "none", latencyMs: Date.now() - startedAt, operation: "replay", logicalRepository: "play_sessions", commandCount: revision });
    return state;
  }
  let reason: "stored_state_divergence" | "stored_revision_divergence" | "stored_fingerprint_divergence" = "stored_state_divergence";
  if (isRecord(value) && Array.isArray(value.decisions) && Array.isArray(value.timeAdvances)
    && value.decisions.length + value.timeAdvances.length !== revision) reason = "stored_revision_divergence";
  else if (isRecord(value) && isRecord(value.canonicalRuntime) && typeof scenario.sourceFingerprint === "string"
    && value.canonicalRuntime.sourceFingerprint !== scenario.sourceFingerprint) reason = "stored_fingerprint_divergence";
  observe({ eventName: "replay.internal_failure", outcome: "internal_failure", reason, responseClass: "4xx", latencyMs: Date.now() - startedAt, operation: "replay", logicalRepository: "play_sessions", commandCount: revision });
  if (reason === "stored_revision_divergence") {
    observe({ eventName: "played_case.revision_mismatch", outcome: "internal_failure", reason: "stored_revision_divergence", responseClass: "4xx", operation, logicalRepository: "play_sessions", commandCount: revision });
  } else if (reason === "stored_fingerprint_divergence") {
    observe({ eventName: "played_case.fingerprint_mismatch", outcome: "internal_failure", reason: "stored_identity_mismatch", responseClass: "4xx", operation, logicalRepository: "play_sessions", commandCount: revision });
  }
  return null;
}
function observeReplayStart(observe: SessionObserver, operation: ObservabilityOperation, logicalRepository: "play_sessions" | "play_events", commandCount: number | null) {
  observe({ eventName: "replay.start", outcome: "started", reason: "state_validation", responseClass: "none", latencyMs: 0, operation, logicalRepository, commandCount });
}
function observeD1(observe: SessionObserver, operation: ObservabilityOperation, outcome: "success" | "expected_rejection" | "internal_failure", reason: ObservabilityReason, latencyMs: number) {
  observe({ eventName: "d1.operation", outcome, reason, responseClass: "none", latencyMs, operation, logicalRepository: "play_sessions" });
}
async function observedD1Read<T>(observe: SessionObserver, logicalRepository: "play_sessions" | "play_events" | "case_versions", read: () => Promise<T>): Promise<T> {
  return runObservedD1Operation(observe, { operation: "read", logicalRepository }, read);
}
function clampMetric(value: number) { return Math.max(0, Math.min(100, value)); }
function classifyMetrics(metrics: Record<MetricKey, number>) { const score = metrics.position + metrics.evidence + metrics.trust - metrics.exposure; return score >= 150 ? "strong" as const : score >= 112 ? "mixed" as const : "weak" as const; }
function privateJson(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
