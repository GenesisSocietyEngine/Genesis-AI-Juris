import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { caseVersions, playEvents, playSessions } from "../../../db/schema";
import { decisionAvailability, resolveDecisionTiming } from "../../game-engine";
import { isRecord } from "../../case-integrity";
import { getChatGPTUser } from "../../chatgpt-auth";
import { normalizePlayableScenario, playableFingerprint } from "../../playable-integrity";
import { isSameOriginMutation, readJsonObject } from "../../request-security";
import { initialMetrics } from "../../runtime-constants";
import { scenarios } from "../../scenarios";
import type { MetricKey, Scenario } from "../../types";

export const dynamic = "force-dynamic";

const MAX_SESSION_REVISION = 1_000;

type SessionState = {
  currentStageId: string;
  clockMinute: number;
  metrics: Record<MetricKey, number>;
  actionUseCounts: Record<string, number>;
  completedDeadlineIds: string[];
  missedDeadlineIds: string[];
  decisions: Array<{ sequence: number; stageId: string; optionId: string }>;
  outcome: "strong" | "mixed" | "weak" | null;
};

export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const email = identity.email.trim().toLowerCase();
  const sessionKey = new URL(request.url).searchParams.get("sessionKey");
  const db = getDb();
  if (sessionKey) {
    if (!validSessionKey(sessionKey)) return privateJson({ error: "Invalid play-session key." }, 400);
    const [session] = await db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1);
    return session ? privateJson({ session: publicSession(session) }) : privateJson({ error: "Play session not found." }, 404);
  }
  const sessions = await db.select().from(playSessions).where(eq(playSessions.userEmail, email)).orderBy(desc(playSessions.updatedAt)).limit(20);
  return privateJson({ sessions: sessions.map(publicSession) });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return privateJson({ error: "Cross-site mutation rejected." }, 403);
  const identity = await getChatGPTUser();
  if (!identity) return privateJson({ error: "Sign in is required." }, 401);
  const payload = await readJsonObject(request, 16_384);
  if (!payload || (payload.action !== "start" && payload.action !== "decision" && payload.action !== "abandon")) return privateJson({ error: "A valid play-session action is required." }, 400);
  const email = identity.email.trim().toLowerCase();
  if (payload.action === "start") return startSession(email, payload);
  if (payload.action === "decision") return applyDecision(email, payload);
  return abandonSession(email, payload);
}

async function startSession(email: string, payload: Record<string, unknown>) {
  const caseId = safeIdentity(payload.caseId, 140);
  const version = safeVersion(payload.version);
  const fingerprint = safeFingerprint(payload.fingerprint);
  if (!caseId || !version || !fingerprint) return privateJson({ error: "Exact case identity is required." }, 400);
  const scenario = await loadScenario(caseId, version, fingerprint);
  if (!scenario) return privateJson({ error: "This exact published case version is unavailable." }, 404);
  const initialStage = scenario.stages.find((stage) => stage.id === scenario.initialStageId);
  if (!initialStage) return privateJson({ error: "Published case has no valid opening stage." }, 422);
  const now = new Date().toISOString();
  const state: SessionState = {
    currentStageId: scenario.initialStageId,
    clockMinute: scenario.initialClockMinute,
    metrics: { ...initialMetrics },
    actionUseCounts: {}, completedDeadlineIds: [], missedDeadlineIds: [], decisions: [], outcome: null,
  };
  if (payload.sessionKey !== undefined && (typeof payload.sessionKey !== "string" || !validSessionKey(payload.sessionKey))) {
    return privateJson({ error: "The optional start idempotency key must be a UUID." }, 400);
  }
  const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : crypto.randomUUID();
  const startEventId = `start:${sessionKey}`;
  const db = getDb();
  const [prior] = await db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1);
  const insertedSessionId = sql<number>`(
    SELECT ${playSessions.id} FROM ${playSessions}
    WHERE ${playSessions.sessionKey} = ${sessionKey}
      AND ${playSessions.userEmail} = ${email}
      AND ${playSessions.caseId} = ${caseId}
      AND ${playSessions.caseVersion} = ${version}
      AND ${playSessions.caseFingerprint} = ${fingerprint}
    LIMIT 1
  )`;
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
  } catch {
    try {
      const [collision] = await db.select().from(playSessions).where(eq(playSessions.sessionKey, sessionKey)).limit(1);
      const sameStart = collision
        && collision.userEmail === email
        && collision.caseId === caseId
        && collision.caseVersion === version
        && collision.caseFingerprint === fingerprint;
      if (sameStart) {
        const startEvent = await findEvent(db, collision.id, startEventId);
        if (startEvent?.eventType === "session_started" && startEvent.sequence === 0) {
          return privateJson({ session: publicSession(collision), idempotentReplay: true });
        }
        return privateJson({ error: "The play session could not be started. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
      }
      if (collision) return privateJson({ error: "The play-session idempotency key is already bound to another session.", code: "session_key_conflict" }, 409);
      return privateJson({ error: "The play session could not be started. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      return privateJson({ error: "The play session could not be started. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [session] = await db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1);
  if (!session || session.caseId !== caseId || session.caseVersion !== version || session.caseFingerprint !== fingerprint) {
    return privateJson({ error: "The play-session idempotency key is already bound to another session.", code: "session_key_conflict" }, 409);
  }
  return privateJson({ session: publicSession(session), ...(prior ? { idempotentReplay: true } : {}) }, prior ? 200 : 201);
}

async function applyDecision(email: string, payload: Record<string, unknown>) {
  const sessionKey = typeof payload.sessionKey === "string" && validSessionKey(payload.sessionKey) ? payload.sessionKey : "";
  const eventId = typeof payload.eventId === "string" && validEventId(payload.eventId) ? payload.eventId : "";
  const optionId = typeof payload.optionId === "string" && /^[A-Za-z0-9_.:-]{1,160}$/.test(payload.optionId) ? payload.optionId : "";
  const expectedRevision = validRevision(payload.expectedRevision) ? payload.expectedRevision : -1;
  if (!sessionKey || !eventId || !optionId || expectedRevision < 0) return privateJson({ error: "Session, idempotency key, revision and option are required." }, 400);
  const db = getDb();
  const [session] = await db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1);
  if (!session) return privateJson({ error: "Play session not found." }, 404);
  const duplicate = await findEvent(db, session.id, eventId);
  if (duplicate) return duplicateDecisionResponse(duplicate, eventId, optionId, expectedRevision, session);
  if (session.status !== "active" || session.revision !== expectedRevision) return staleSession(session);
  if (expectedRevision >= MAX_SESSION_REVISION) return privateJson({ error: "This play session reached its maximum event count." }, 409);
  const scenario = await loadScenario(session.caseId, session.caseVersion, session.caseFingerprint);
  if (!scenario) return privateJson({ error: "The session case version is no longer available." }, 410);
  const state = normalizeSessionState(session.state, scenario, session.revision);
  if (!state || state.outcome) return privateJson({ error: "Stored play-session state is invalid or complete." }, 409);
  const stage = scenario.stages.find((item) => item.id === state.currentStageId);
  const option = stage?.options.find((item) => item.id === optionId);
  if (!stage || !option) return privateJson({ error: "The selected action is not available at the current stage." }, 409);
  const availability = decisionAvailability(option, state.metrics, state.actionUseCounts[option.id] ?? 0);
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
  const nextRevision = expectedRevision + 1;
  const now = new Date().toISOString();
  const nextState: SessionState = {
    currentStageId: nextStage.id,
    clockMinute: timing.transitionMinute,
    metrics,
    actionUseCounts: { ...state.actionUseCounts, [option.id]: (state.actionUseCounts[option.id] ?? 0) + 1 },
    completedDeadlineIds: timing.completedDeadlineIds,
    missedDeadlineIds: [...new Set([...state.missedDeadlineIds, ...timing.newlyMissedDeadlineIds])],
    decisions: [...state.decisions, { sequence: nextRevision, stageId: stage.id, optionId: option.id }],
    outcome: nextStage.terminal ? nextStage.terminalOutcome ?? classifyMetrics(metrics) : null,
  };
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
  } catch {
    try {
      const [current] = await db.select().from(playSessions).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email))).limit(1);
      const currentEvent = await findEvent(db, session.id, eventId);
      if (currentEvent && current) return duplicateDecisionResponse(currentEvent, eventId, optionId, expectedRevision, current);
      if (!current || current.status !== "active" || current.revision !== expectedRevision) return staleSession(current ?? null);
      return privateJson({ error: "The decision could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      return privateJson({ error: "The decision could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [saved] = await db.select().from(playSessions).where(and(eq(playSessions.id, session.id), eq(playSessions.userEmail, email))).limit(1);
  const savedEvent = await findEvent(db, session.id, eventId);
  if (!saved || !savedEvent) return staleSession(saved ?? null);
  return privateJson({ session: publicSession(saved), event: { eventId, sequence: savedEvent.sequence } });
}

async function abandonSession(email: string, payload: Record<string, unknown>) {
  const sessionKey = typeof payload.sessionKey === "string" && validSessionKey(payload.sessionKey) ? payload.sessionKey : "";
  const eventId = typeof payload.eventId === "string" && validEventId(payload.eventId) ? payload.eventId : "";
  const expectedRevision = validRevision(payload.expectedRevision) ? payload.expectedRevision : -1;
  if (!sessionKey || !eventId || expectedRevision < 0) return privateJson({ error: "Session, idempotency key and revision are required." }, 400);
  const db = getDb();
  const [current] = await db.select().from(playSessions).where(and(eq(playSessions.sessionKey, sessionKey), eq(playSessions.userEmail, email))).limit(1);
  if (!current) return privateJson({ error: "Play session not found." }, 404);
  const duplicate = await findEvent(db, current.id, eventId);
  if (duplicate) return duplicateAbandonResponse(duplicate, eventId, expectedRevision, current);
  if (current.status !== "active" || current.revision !== expectedRevision) return staleSession(current);
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
  try {
    await db.batch([
      db.update(playSessions).set({ status: "abandoned", revision: nextRevision, lastEventAt: now, updatedAt: now }).where(and(
        eq(playSessions.id, current.id), eq(playSessions.userEmail, email), eq(playSessions.status, "active"), eq(playSessions.revision, expectedRevision),
      )),
      db.insert(playEvents).values({ playSessionId: updatedSessionId, eventId, sequence: nextRevision, eventType: "session_abandoned", payload: { expectedRevision, resultingRevision: nextRevision }, occurredAt: now }),
    ]);
  } catch {
    try {
      const [latest] = await db.select().from(playSessions).where(and(eq(playSessions.id, current.id), eq(playSessions.userEmail, email))).limit(1);
      const latestEvent = await findEvent(db, current.id, eventId);
      if (latestEvent && latest) return duplicateAbandonResponse(latestEvent, eventId, expectedRevision, latest);
      if (!latest || latest.status !== "active" || latest.revision !== expectedRevision) return staleSession(latest ?? null);
      return privateJson({ error: "The abandonment could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    } catch {
      return privateJson({ error: "The abandonment could not be persisted. Retry with the same idempotency key.", code: "session_persistence_failed" }, 503);
    }
  }
  const [saved] = await db.select().from(playSessions).where(and(eq(playSessions.id, current.id), eq(playSessions.userEmail, email))).limit(1);
  return saved ? privateJson({ session: publicSession(saved), event: { eventId, sequence: nextRevision } }) : staleSession(null);
}

async function loadScenario(caseId: string, version: string, fingerprint: string): Promise<Scenario | null> {
  const bundled = scenarios.find((scenario) => scenario.caseId === caseId && scenario.version === version && scenario.fingerprint === fingerprint);
  if (bundled) return playableFingerprint(bundled) === fingerprint ? bundled : null;
  const [record] = await getDb().select({ payload: caseVersions.payload, fingerprint: caseVersions.fingerprint }).from(caseVersions).where(and(eq(caseVersions.caseId, caseId), eq(caseVersions.version, version), eq(caseVersions.fingerprint, fingerprint), isNotNull(caseVersions.publishedAt))).limit(1);
  if (!record || !isRecord(record.payload) || record.payload.kind !== "playable-scenario-v1") return null;
  try {
    const scenario = normalizePlayableScenario(record.payload.scenario);
    return scenario.caseId === caseId && scenario.version === version && scenario.fingerprint === fingerprint && playableFingerprint(scenario) === fingerprint ? scenario : null;
  } catch { return null; }
}

function normalizeSessionState(value: unknown, scenario: Scenario, revision: number): SessionState | null {
  if (!isRecord(value)
    || typeof value.currentStageId !== "string"
    || typeof value.clockMinute !== "number"
    || !Number.isInteger(value.clockMinute)
    || value.clockMinute < scenario.initialClockMinute
    || value.clockMinute > 100_000_000
    || !isRecord(value.metrics)
    || !isRecord(value.actionUseCounts)
    || !Array.isArray(value.completedDeadlineIds)
    || !Array.isArray(value.missedDeadlineIds)
    || !Array.isArray(value.decisions)
    || !validRevision(revision)) return null;

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
  const actionEntries = Object.entries(actionCountValues);
  if (actionEntries.length > optionById.size || actionEntries.some(([key, count]) => !optionById.has(key) || typeof count !== "number" || !Number.isInteger(count) || count <= 0 || count > revision)) return null;
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
    derivedUseCounts[item.optionId] = (derivedUseCounts[item.optionId] ?? 0) + 1;
  }
  if (Object.keys(derivedUseCounts).length !== actionEntries.length
    || Object.entries(derivedUseCounts).some(([optionId, count]) => actionUseCounts[optionId] !== count)) return null;

  const outcome = value.outcome === null
    ? null
    : value.outcome === "strong" || value.outcome === "mixed" || value.outcome === "weak"
      ? value.outcome
      : undefined;
  if (outcome === undefined || Boolean(outcome) !== Boolean(stage.terminal)) return null;
  return { currentStageId: value.currentStageId, clockMinute: value.clockMinute, metrics, actionUseCounts, completedDeadlineIds, missedDeadlineIds, decisions, outcome };
}

type StoredPlayEvent = Pick<typeof playEvents.$inferSelect, "eventType" | "payload" | "sequence">;

async function findEvent(db: ReturnType<typeof getDb>, playSessionId: number, eventId: string): Promise<StoredPlayEvent | null> {
  const [event] = await db.select({ eventType: playEvents.eventType, payload: playEvents.payload, sequence: playEvents.sequence }).from(playEvents).where(and(
    eq(playEvents.playSessionId, playSessionId), eq(playEvents.eventId, eventId),
  )).limit(1);
  return event ?? null;
}

function duplicateDecisionResponse(event: StoredPlayEvent, eventId: string, optionId: string, expectedRevision: number, session: typeof playSessions.$inferSelect) {
  if (event.eventType === "decision"
    && event.sequence === expectedRevision + 1
    && isRecord(event.payload)
    && event.payload.optionId === optionId
    && event.payload.expectedRevision === expectedRevision) {
    return privateJson({ session: publicSession(session), event: { eventId, sequence: event.sequence }, idempotentReplay: true });
  }
  return privateJson({ error: "This idempotency key was already used for a different play-session event.", code: "idempotency_conflict" }, 409);
}

function duplicateAbandonResponse(event: StoredPlayEvent, eventId: string, expectedRevision: number, session: typeof playSessions.$inferSelect) {
  if (event.eventType === "session_abandoned"
    && event.sequence === expectedRevision + 1
    && isRecord(event.payload)
    && event.payload.expectedRevision === expectedRevision) {
    return privateJson({ session: publicSession(session), event: { eventId, sequence: event.sequence }, idempotentReplay: true });
  }
  return privateJson({ error: "This idempotency key was already used for a different play-session event.", code: "idempotency_conflict" }, 409);
}

function staleSession(session: typeof playSessions.$inferSelect | null) {
  return privateJson({ error: "The play session changed in another tab.", code: "stale_session", session: session ? publicSession(session) : null }, 409);
}

function publicSession(session: typeof playSessions.$inferSelect) {
  return { sessionKey: session.sessionKey, caseId: session.caseId, version: session.caseVersion, fingerprint: session.caseFingerprint, state: session.state, status: session.status, revision: session.revision, startedAt: session.startedAt, updatedAt: session.updatedAt, lastEventAt: session.lastEventAt, completedAt: session.completedAt };
}
function safeIdentity(value: unknown, max: number) { return typeof value === "string" && value.length <= max && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value) ? value : null; }
function safeVersion(value: unknown) { return typeof value === "string" && value.length <= 40 && /^\d+\.\d+\.\d+$/.test(value) ? value : null; }
function safeFingerprint(value: unknown) { return typeof value === "string" && /^sha256-[a-f0-9]{64}$/.test(value) ? value : null; }
function validSessionKey(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value); }
function validEventId(value: string) { return /^[A-Za-z0-9_.:-]{8,160}$/.test(value); }
function validRevision(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SESSION_REVISION; }
function clampMetric(value: number) { return Math.max(0, Math.min(100, value)); }
function classifyMetrics(metrics: Record<MetricKey, number>) { const score = metrics.position + metrics.evidence + metrics.trust - metrics.exposure; return score >= 150 ? "strong" as const : score >= 112 ? "mixed" as const : "weak" as const; }
function privateJson(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
