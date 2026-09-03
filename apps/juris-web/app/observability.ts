export const OBSERVABILITY_SCHEMA = "genesis.juris.observability.v1" as const;
export const OBSERVABILITY_REQUEST_HEADER = "X-Request-ID";
export const OBSERVABILITY_RETENTION_DAYS = 14 as const;

export const OBSERVABILITY_EVENT_NAMES = [
  "worker.request",
  "worker.exception",
  "d1.operation",
  "replay.start",
  "replay.success",
  "replay.expected_rejection",
  "replay.internal_failure",
  "played_case.revision_mismatch",
  "played_case.fingerprint_mismatch",
  "historical_bundle.lookup_miss",
  "session.import",
  "session.load",
  "session.save",
] as const;

export const OBSERVABILITY_ROUTES = [
  "root",
  "studio",
  "catalog",
  "play_sessions",
  "auth",
  "admin",
  "assets",
  "image",
  "other_api",
  "other",
] as const;

export const OBSERVABILITY_OUTCOMES = ["started", "success", "expected_rejection", "internal_failure"] as const;
export const OBSERVABILITY_RESPONSE_CLASSES = ["none", "2xx", "3xx", "4xx", "5xx", "exception"] as const;
export const OBSERVABILITY_OPERATIONS = [
  "request",
  "read",
  "insert",
  "purge",
  "start",
  "decision",
  "advance_time",
  "abandon",
  "import",
  "load",
  "save",
  "replay",
] as const;
export const OBSERVABILITY_REPOSITORIES = ["none", "operational_events", "play_sessions", "play_events", "cases", "case_versions"] as const;

export const OBSERVABILITY_REASONS = [
  "completed",
  "client_response",
  "server_error",
  "handler_exception",
  "state_validation",
  "state_matches",
  "idempotent_repeat",
  "idempotency_conflict",
  "stale_revision",
  "blocked_action",
  "stored_state_divergence",
  "stored_revision_divergence",
  "stored_fingerprint_divergence",
  "runtime_exception",
  "stale_client",
  "requested_identity_mismatch",
  "stored_identity_mismatch",
  "canonical_source_mismatch",
  "manifest_integrity",
  "case_unavailable",
  "version_unavailable",
  "stored_version_unavailable",
  "auth_required",
  "invalid_request",
  "not_found",
  "persistence_failure",
  "constraint_conflict",
  "busy",
  "timeout",
  "unavailable",
  "unexpected_error",
] as const;

export type ObservabilityEventName = typeof OBSERVABILITY_EVENT_NAMES[number];
export type ObservabilityRoute = typeof OBSERVABILITY_ROUTES[number];
export type ObservabilityOutcome = typeof OBSERVABILITY_OUTCOMES[number];
export type ObservabilityResponseClass = typeof OBSERVABILITY_RESPONSE_CLASSES[number];
export type ObservabilityOperation = typeof OBSERVABILITY_OPERATIONS[number];
export type ObservabilityRepository = typeof OBSERVABILITY_REPOSITORIES[number];
export type ObservabilityReason = typeof OBSERVABILITY_REASONS[number];

export interface ObservabilityReleaseIdentity {
  deploymentVersion: string;
  webCommit: string;
  bundleRevision: number;
  runtimeRevision: string;
  playedCaseSchemaRevision: number;
}

export interface ObservabilityEventInput {
  requestId: string;
  eventName: ObservabilityEventName;
  route: ObservabilityRoute;
  outcome: ObservabilityOutcome;
  reason: ObservabilityReason;
  responseClass?: ObservabilityResponseClass;
  latencyMs?: number | null;
  operation?: ObservabilityOperation | null;
  logicalRepository?: ObservabilityRepository | null;
  commandCount?: number | null;
  occurredAt?: string;
}

export interface ObservabilityEventV1 {
  schema: typeof OBSERVABILITY_SCHEMA;
  occurredAt: string;
  requestId: string;
  eventName: ObservabilityEventName;
  route: ObservabilityRoute;
  outcome: ObservabilityOutcome;
  reason: ObservabilityReason;
  responseClass: ObservabilityResponseClass;
  latencyMs: number | null;
  operation: ObservabilityOperation | null;
  logicalRepository: ObservabilityRepository | null;
  commandCount: number | null;
  deploymentVersion: string;
  webCommit: string;
  bundleRevision: number;
  runtimeRevision: string;
  playedCaseSchemaRevision: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const RELEASE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;
const WEB_COMMIT_PATTERN = /^(?:[a-f0-9]{40}|unknown)$/u;

const EVENT_RULES: Record<ObservabilityEventName, Partial<Record<ObservabilityOutcome, readonly ObservabilityReason[]>>> = {
  "worker.request": {
    success: ["completed"],
    expected_rejection: ["client_response"],
    internal_failure: ["server_error"],
  },
  "worker.exception": { internal_failure: ["handler_exception"] },
  "d1.operation": {
    success: ["completed"],
    expected_rejection: ["constraint_conflict", "busy"],
    internal_failure: ["timeout", "unavailable", "unexpected_error", "persistence_failure"],
  },
  "replay.start": { started: ["state_validation"] },
  "replay.success": { success: ["state_matches", "idempotent_repeat"] },
  "replay.expected_rejection": { expected_rejection: ["idempotency_conflict", "stale_revision", "blocked_action"] },
  "replay.internal_failure": {
    internal_failure: ["stored_state_divergence", "stored_revision_divergence", "stored_fingerprint_divergence", "runtime_exception"],
  },
  "played_case.revision_mismatch": {
    expected_rejection: ["stale_client"],
    internal_failure: ["stored_revision_divergence"],
  },
  "played_case.fingerprint_mismatch": {
    expected_rejection: ["requested_identity_mismatch"],
    internal_failure: ["stored_identity_mismatch", "canonical_source_mismatch", "manifest_integrity"],
  },
  "historical_bundle.lookup_miss": {
    expected_rejection: ["case_unavailable", "version_unavailable"],
    internal_failure: ["stored_version_unavailable", "manifest_integrity"],
  },
  "session.import": {
    success: ["completed"],
    expected_rejection: ["auth_required", "invalid_request", "not_found", "requested_identity_mismatch", "stale_revision"],
    internal_failure: ["persistence_failure", "unexpected_error"],
  },
  "session.load": {
    success: ["completed"],
    expected_rejection: ["auth_required", "invalid_request", "not_found"],
    internal_failure: ["unexpected_error"],
  },
  "session.save": {
    success: ["completed"],
    expected_rejection: ["auth_required", "invalid_request", "constraint_conflict", "stale_revision"],
    internal_failure: ["persistence_failure", "unexpected_error"],
  },
};

const EVENT_KEYS = new Set<keyof ObservabilityEventV1>([
  "schema", "occurredAt", "requestId", "eventName", "route", "outcome", "reason", "responseClass", "latencyMs",
  "operation", "logicalRepository", "commandCount", "deploymentVersion", "webCommit", "bundleRevision", "runtimeRevision",
  "playedCaseSchemaRevision",
]);

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function validIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value));
}

function boundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validReleaseIdentity(identity: ObservabilityReleaseIdentity) {
  return RELEASE_TOKEN_PATTERN.test(identity.deploymentVersion)
    && WEB_COMMIT_PATTERN.test(identity.webCommit)
    && boundedInteger(identity.bundleRevision, 0, 1_000_000)
    && RELEASE_TOKEN_PATTERN.test(identity.runtimeRevision)
    && boundedInteger(identity.playedCaseSchemaRevision, 0, 1_000_000);
}

function validEventRule(eventName: ObservabilityEventName, outcome: ObservabilityOutcome, reason: ObservabilityReason) {
  return EVENT_RULES[eventName][outcome]?.includes(reason) ?? false;
}

export function createRequestId(uuid: () => string = () => crypto.randomUUID()): string {
  const value = uuid().toLowerCase();
  if (!UUID_PATTERN.test(value)) throw new Error("Observability request IDs must be UUIDs.");
  return value;
}

export function requestIdFromRequest(request: Request): string {
  const candidate = request.headers.get(OBSERVABILITY_REQUEST_HEADER)?.trim().toLowerCase();
  return candidate && UUID_PATTERN.test(candidate) ? candidate : createRequestId();
}

export function withRequestId(response: Response, requestId: string): Response {
  if (!UUID_PATTERN.test(requestId)) return response;
  const headers = new Headers(response.headers);
  headers.set(OBSERVABILITY_REQUEST_HEADER, requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function normalizeObservabilityRoute(urlOrPath: URL | string): ObservabilityRoute {
  let pathname: string;
  try {
    pathname = urlOrPath instanceof URL ? urlOrPath.pathname : new URL(urlOrPath, "https://observability.invalid").pathname;
  } catch {
    return "other";
  }
  if (pathname === "/") return "root";
  if (pathname === "/studio" || pathname.startsWith("/studio/")) return "studio";
  if (pathname === "/api/catalog" || pathname.startsWith("/api/catalog/")) return "catalog";
  if (pathname === "/api/play-sessions") return "play_sessions";
  if (pathname.startsWith("/api/auth/") || pathname === "/api/me") return "auth";
  if (pathname.startsWith("/api/admin/")) return "admin";
  if (pathname.startsWith("/assets/") || pathname === "/favicon.svg" || pathname === "/favicon.ico") return "assets";
  if (pathname === "/_vinext/image") return "image";
  if (pathname.startsWith("/api/")) return "other_api";
  return "other";
}

export function responseClassForStatus(status: number): ObservabilityResponseClass {
  if (!Number.isInteger(status) || status < 100 || status > 599) return "none";
  return `${Math.floor(status / 100)}xx` as ObservabilityResponseClass;
}

export function classifyD1Failure(error: unknown): {
  outcome: "expected_rejection" | "internal_failure";
  reason: "busy" | "constraint_conflict" | "timeout" | "unexpected_error";
} {
  let message = "";
  try {
    message = error instanceof Error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  } catch {
    // A malformed error object cannot replace the original product failure.
  }
  if (message.includes("busy") || message.includes("locked")) return { outcome: "expected_rejection", reason: "busy" };
  if (message.includes("timeout") || message.includes("timed out")) return { outcome: "internal_failure", reason: "timeout" };
  if (message.includes("constraint") || message.includes("unique")) return { outcome: "expected_rejection", reason: "constraint_conflict" };
  return { outcome: "internal_failure", reason: "unexpected_error" };
}

export function createObservabilityEvent(input: ObservabilityEventInput, identity: ObservabilityReleaseIdentity): ObservabilityEventV1 {
  if (!UUID_PATTERN.test(input.requestId)) throw new Error("Invalid observability request ID.");
  if (!oneOf(OBSERVABILITY_EVENT_NAMES, input.eventName)
    || !oneOf(OBSERVABILITY_ROUTES, input.route)
    || !oneOf(OBSERVABILITY_OUTCOMES, input.outcome)
    || !oneOf(OBSERVABILITY_REASONS, input.reason)
    || !validEventRule(input.eventName, input.outcome, input.reason)) {
    throw new Error("Invalid observability event contract.");
  }
  if (!validReleaseIdentity(identity)) throw new Error("Invalid observability release identity.");
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (!validIsoTimestamp(occurredAt)) throw new Error("Invalid observability timestamp.");
  const responseClass = input.responseClass ?? "none";
  const operation = input.operation ?? null;
  const logicalRepository = input.logicalRepository ?? null;
  if (!oneOf(OBSERVABILITY_RESPONSE_CLASSES, responseClass)
    || (operation !== null && !oneOf(OBSERVABILITY_OPERATIONS, operation))
    || (logicalRepository !== null && !oneOf(OBSERVABILITY_REPOSITORIES, logicalRepository))) {
    throw new Error("Invalid observability dimensions.");
  }
  const latencyMs = input.latencyMs === null || input.latencyMs === undefined
    ? null
    : Math.max(0, Math.min(120_000, Math.round(input.latencyMs)));
  const commandCount = input.commandCount === null || input.commandCount === undefined
    ? null
    : Math.max(0, Math.min(1_000, Math.round(input.commandCount)));
  return Object.freeze({
    schema: OBSERVABILITY_SCHEMA,
    occurredAt,
    requestId: input.requestId,
    eventName: input.eventName,
    route: input.route,
    outcome: input.outcome,
    reason: input.reason,
    responseClass,
    latencyMs,
    operation,
    logicalRepository,
    commandCount,
    deploymentVersion: identity.deploymentVersion,
    webCommit: identity.webCommit,
    bundleRevision: identity.bundleRevision,
    runtimeRevision: identity.runtimeRevision,
    playedCaseSchemaRevision: identity.playedCaseSchemaRevision,
  });
}

export function normalizeObservabilityEvent(value: unknown): ObservabilityEventV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !EVENT_KEYS.has(key as keyof ObservabilityEventV1))) return null;
  try {
    return createObservabilityEvent({
      requestId: String(record.requestId ?? ""),
      eventName: record.eventName as ObservabilityEventName,
      route: record.route as ObservabilityRoute,
      outcome: record.outcome as ObservabilityOutcome,
      reason: record.reason as ObservabilityReason,
      responseClass: record.responseClass as ObservabilityResponseClass,
      latencyMs: record.latencyMs as number | null,
      operation: record.operation as ObservabilityOperation | null,
      logicalRepository: record.logicalRepository as ObservabilityRepository | null,
      commandCount: record.commandCount as number | null,
      occurredAt: String(record.occurredAt ?? ""),
    }, {
      deploymentVersion: String(record.deploymentVersion ?? ""),
      webCommit: String(record.webCommit ?? ""),
      bundleRevision: record.bundleRevision as number,
      runtimeRevision: String(record.runtimeRevision ?? ""),
      playedCaseSchemaRevision: record.playedCaseSchemaRevision as number,
    });
  } catch {
    return null;
  }
}

export type ObservabilitySink = (serialized: string) => void;

export function emitStructuredObservability(event: ObservabilityEventV1, sink: ObservabilitySink = (serialized) => console.info(serialized)): boolean {
  try {
    sink(JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

export interface ObservabilityAggregateBucket {
  eventName: ObservabilityEventName;
  route: ObservabilityRoute;
  outcome: ObservabilityOutcome;
  reason: ObservabilityReason;
  responseClass: ObservabilityResponseClass;
  latencyMs: number | null;
  count: number;
}

export interface ObservabilityAggregate {
  schema: typeof OBSERVABILITY_SCHEMA;
  total: number;
  byEvent: Record<ObservabilityEventName, number>;
  byOutcome: Record<ObservabilityOutcome, number>;
  byRoute: Record<ObservabilityRoute, number>;
  byResponseClass: Record<ObservabilityResponseClass, number>;
  workerByRouteAndResponseClass: Record<ObservabilityRoute, Record<ObservabilityResponseClass, number>>;
  workerRequests: number;
  worker2xx: number;
  worker4xx: number;
  worker5xx: number;
  workerExceptions: number;
  workerLatencySamples: number;
  workerLatencyP50Ms: number | null;
  workerLatencyP95Ms: number | null;
  d1Successes: number;
  d1Failures: number;
  d1InternalFailures: number;
  d1Timeouts: number;
  d1Busy: number;
  d1LatencySamples: number;
  d1LatencyP50Ms: number | null;
  d1LatencyP95Ms: number | null;
  replayAttempts: number;
  replaySuccesses: number;
  replayExpectedRejections: number;
  replayInternalFailures: number;
  replayLatencySamples: number;
  replayLatencyP50Ms: number | null;
  replayLatencyP95Ms: number | null;
  expectedRevisionMismatches: number;
  expectedFingerprintMismatches: number;
  internalRevisionMismatches: number;
  internalFingerprintMismatches: number;
  historicalMisses: number;
  internalHistoricalMisses: number;
}

function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function zeroWorkerRouteResponseMatrix(): Record<ObservabilityRoute, Record<ObservabilityResponseClass, number>> {
  return Object.fromEntries(
    OBSERVABILITY_ROUTES.map((route) => [route, zeroRecord(OBSERVABILITY_RESPONSE_CLASSES)]),
  ) as Record<ObservabilityRoute, Record<ObservabilityResponseClass, number>>;
}

export function aggregateObservabilityBuckets(buckets: readonly ObservabilityAggregateBucket[]): ObservabilityAggregate {
  const d1LatencyCounts = new Map<number, number>();
  const replayLatencyCounts = new Map<number, number>();
  const workerLatencyCounts = new Map<number, number>();
  const aggregate: ObservabilityAggregate = {
    schema: OBSERVABILITY_SCHEMA,
    total: 0,
    byEvent: zeroRecord(OBSERVABILITY_EVENT_NAMES),
    byOutcome: zeroRecord(OBSERVABILITY_OUTCOMES),
    byRoute: zeroRecord(OBSERVABILITY_ROUTES),
    byResponseClass: zeroRecord(OBSERVABILITY_RESPONSE_CLASSES),
    workerByRouteAndResponseClass: zeroWorkerRouteResponseMatrix(),
    workerRequests: 0,
    worker2xx: 0,
    worker4xx: 0,
    worker5xx: 0,
    workerExceptions: 0,
    workerLatencySamples: 0,
    workerLatencyP50Ms: null,
    workerLatencyP95Ms: null,
    d1Successes: 0,
    d1Failures: 0,
    d1InternalFailures: 0,
    d1Timeouts: 0,
    d1Busy: 0,
    d1LatencySamples: 0,
    d1LatencyP50Ms: null,
    d1LatencyP95Ms: null,
    replayAttempts: 0,
    replaySuccesses: 0,
    replayExpectedRejections: 0,
    replayInternalFailures: 0,
    replayLatencySamples: 0,
    replayLatencyP50Ms: null,
    replayLatencyP95Ms: null,
    expectedRevisionMismatches: 0,
    expectedFingerprintMismatches: 0,
    internalRevisionMismatches: 0,
    internalFingerprintMismatches: 0,
    historicalMisses: 0,
    internalHistoricalMisses: 0,
  };
  for (const bucket of buckets) {
    if (!oneOf(OBSERVABILITY_EVENT_NAMES, bucket.eventName)
      || !oneOf(OBSERVABILITY_ROUTES, bucket.route)
      || !oneOf(OBSERVABILITY_OUTCOMES, bucket.outcome)
      || !oneOf(OBSERVABILITY_REASONS, bucket.reason)
      || !oneOf(OBSERVABILITY_RESPONSE_CLASSES, bucket.responseClass)
      || !boundedInteger(bucket.count, 0, Number.MAX_SAFE_INTEGER)) continue;
    aggregate.total += bucket.count;
    aggregate.byEvent[bucket.eventName] += bucket.count;
    aggregate.byOutcome[bucket.outcome] += bucket.count;
    aggregate.byRoute[bucket.route] += bucket.count;
    aggregate.byResponseClass[bucket.responseClass] += bucket.count;
    if (bucket.eventName === "worker.request") {
      aggregate.workerRequests += bucket.count;
      aggregate.workerByRouteAndResponseClass[bucket.route][bucket.responseClass] += bucket.count;
      if (bucket.responseClass === "2xx") aggregate.worker2xx += bucket.count;
      if (bucket.responseClass === "4xx") aggregate.worker4xx += bucket.count;
      if (bucket.responseClass === "5xx") aggregate.worker5xx += bucket.count;
      if (bucket.latencyMs !== null && boundedInteger(bucket.latencyMs, 0, 120_000)) {
        aggregate.workerLatencySamples += bucket.count;
        workerLatencyCounts.set(bucket.latencyMs, (workerLatencyCounts.get(bucket.latencyMs) ?? 0) + bucket.count);
      }
    }
    if (bucket.eventName === "worker.exception") aggregate.workerExceptions += bucket.count;
    if (bucket.eventName === "d1.operation") {
      if (bucket.outcome === "success") aggregate.d1Successes += bucket.count;
      if (bucket.outcome === "internal_failure" || bucket.reason === "busy") aggregate.d1Failures += bucket.count;
      if (bucket.outcome === "internal_failure") aggregate.d1InternalFailures += bucket.count;
      if (bucket.reason === "timeout") aggregate.d1Timeouts += bucket.count;
      if (bucket.reason === "busy") aggregate.d1Busy += bucket.count;
      if (bucket.latencyMs !== null && boundedInteger(bucket.latencyMs, 0, 120_000)) {
        aggregate.d1LatencySamples += bucket.count;
        d1LatencyCounts.set(bucket.latencyMs, (d1LatencyCounts.get(bucket.latencyMs) ?? 0) + bucket.count);
      }
    }
    if (bucket.eventName === "replay.start") aggregate.replayAttempts += bucket.count;
    if (bucket.eventName === "replay.success") aggregate.replaySuccesses += bucket.count;
    if (bucket.eventName === "replay.expected_rejection") aggregate.replayExpectedRejections += bucket.count;
    if (bucket.eventName === "replay.internal_failure") aggregate.replayInternalFailures += bucket.count;
    if (bucket.eventName === "replay.success"
      || bucket.eventName === "replay.expected_rejection"
      || bucket.eventName === "replay.internal_failure") {
      if (bucket.latencyMs !== null && boundedInteger(bucket.latencyMs, 0, 120_000)) {
        aggregate.replayLatencySamples += bucket.count;
        replayLatencyCounts.set(bucket.latencyMs, (replayLatencyCounts.get(bucket.latencyMs) ?? 0) + bucket.count);
      }
    }
    if (bucket.eventName === "played_case.revision_mismatch") {
      if (bucket.outcome === "expected_rejection") aggregate.expectedRevisionMismatches += bucket.count;
      if (bucket.outcome === "internal_failure") aggregate.internalRevisionMismatches += bucket.count;
    }
    if (bucket.eventName === "played_case.fingerprint_mismatch") {
      if (bucket.outcome === "expected_rejection") aggregate.expectedFingerprintMismatches += bucket.count;
      if (bucket.outcome === "internal_failure") aggregate.internalFingerprintMismatches += bucket.count;
    }
    if (bucket.eventName === "historical_bundle.lookup_miss") {
      aggregate.historicalMisses += bucket.count;
      if (bucket.outcome === "internal_failure") aggregate.internalHistoricalMisses += bucket.count;
    }
  }
  const percentile = (counts: Map<number, number>, samples: number, ratio: number) => {
    if (!samples) return null;
    const target = Math.ceil(samples * ratio);
    let cumulative = 0;
    for (const [latency, count] of [...counts.entries()].sort((left, right) => left[0] - right[0])) {
      cumulative += count;
      if (cumulative >= target) return latency;
    }
    return null;
  };
  aggregate.d1LatencyP50Ms = percentile(d1LatencyCounts, aggregate.d1LatencySamples, 0.5);
  aggregate.d1LatencyP95Ms = percentile(d1LatencyCounts, aggregate.d1LatencySamples, 0.95);
  aggregate.replayLatencyP50Ms = percentile(replayLatencyCounts, aggregate.replayLatencySamples, 0.5);
  aggregate.replayLatencyP95Ms = percentile(replayLatencyCounts, aggregate.replayLatencySamples, 0.95);
  aggregate.workerLatencyP50Ms = percentile(workerLatencyCounts, aggregate.workerLatencySamples, 0.5);
  aggregate.workerLatencyP95Ms = percentile(workerLatencyCounts, aggregate.workerLatencySamples, 0.95);
  return aggregate;
}

export function aggregateObservability(events: readonly ObservabilityEventV1[]): ObservabilityAggregate {
  return aggregateObservabilityBuckets(events.map((event) => ({
    eventName: event.eventName,
    route: event.route,
    outcome: event.outcome,
    reason: event.reason,
    responseClass: event.responseClass,
    latencyMs: event.latencyMs,
    count: 1,
  })));
}

export const OBSERVABILITY_ALERT_POLICY_REVISION = 1 as const;

export interface ObservabilityAlert {
  id: "d1_failures" | "d1_latency_p95" | "historical_lookup_miss" | "replay_internal_failure" | "worker_exception" | "worker_5xx" | "expected_identity_rejections";
  severity: "diagnostic" | "warning" | "critical";
  window: "5m" | "10m" | "15m";
  count: number;
  ratio: number | null;
}

export interface ObservabilityAlertWindows {
  fiveMinutes: ObservabilityAggregate;
  tenMinutes: ObservabilityAggregate;
  fifteenMinutes: ObservabilityAggregate;
}

export function evaluateObservabilityAlerts(windows: ObservabilityAlertWindows): ObservabilityAlert[] {
  const alerts: ObservabilityAlert[] = [];
  const five = windows.fiveMinutes;
  const ten = windows.tenMinutes;
  const fifteen = windows.fifteenMinutes;
  if (five.workerExceptions >= 1) alerts.push({ id: "worker_exception", severity: "critical", window: "5m", count: five.workerExceptions, ratio: null });
  const tenMinute5xxRatio = ten.workerRequests ? ten.worker5xx / ten.workerRequests : 0;
  if (five.worker5xx >= 3) {
    alerts.push({ id: "worker_5xx", severity: "critical", window: "5m", count: five.worker5xx, ratio: null });
  } else if (ten.workerRequests >= 20 && tenMinute5xxRatio >= 0.02) {
    alerts.push({ id: "worker_5xx", severity: "critical", window: "10m", count: ten.worker5xx, ratio: tenMinute5xxRatio });
  }
  if (five.d1Failures >= 3) alerts.push({ id: "d1_failures", severity: "critical", window: "5m", count: five.d1Failures, ratio: null });
  if ((fifteen.d1LatencyP95Ms ?? 0) > 500) alerts.push({ id: "d1_latency_p95", severity: "warning", window: "15m", count: fifteen.d1LatencySamples, ratio: null });
  const replayRatio = fifteen.replayAttempts ? fifteen.replayInternalFailures / fifteen.replayAttempts : 0;
  if (fifteen.replayInternalFailures >= 3 || (fifteen.replayAttempts >= 20 && replayRatio >= 0.02)) {
    alerts.push({ id: "replay_internal_failure", severity: "critical", window: "15m", count: fifteen.replayInternalFailures, ratio: replayRatio });
  }
  if (fifteen.historicalMisses >= 1) alerts.push({ id: "historical_lookup_miss", severity: "warning", window: "15m", count: fifteen.historicalMisses, ratio: null });
  const expectedIdentityRejections = fifteen.expectedRevisionMismatches + fifteen.expectedFingerprintMismatches;
  if (expectedIdentityRejections >= 10) alerts.push({ id: "expected_identity_rejections", severity: "diagnostic", window: "15m", count: expectedIdentityRejections, ratio: null });
  return alerts.sort((left, right) => left.id.localeCompare(right.id));
}

// The product-D1 dashboard intentionally evaluates only thresholds whose
// complete inputs are retained as low-volume anomaly rows. Worker request
// health, Worker exceptions, D1 success latency, and replay-attempt rate are
// emitted to the platform log stream and must never be inferred from missing
// D1 rows.
export function evaluatePersistedProductAlerts(windows: ObservabilityAlertWindows): ObservabilityAlert[] {
  return evaluateObservabilityAlerts(windows).filter((alert) => {
    if (alert.id === "worker_exception" || alert.id === "worker_5xx" || alert.id === "d1_failures" || alert.id === "d1_latency_p95") return false;
    if (alert.id === "replay_internal_failure") return windows.fifteenMinutes.replayInternalFailures >= 3;
    return true;
  });
}

export function observabilityExpiry(occurredAt: string): string {
  if (!validIsoTimestamp(occurredAt)) throw new Error("Invalid observability timestamp.");
  return new Date(Date.parse(occurredAt) + OBSERVABILITY_RETENTION_DAYS * 24 * 60 * 60 * 1_000).toISOString();
}
