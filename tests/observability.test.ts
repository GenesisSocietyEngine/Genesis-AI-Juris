import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  OBSERVABILITY_EVENT_NAMES,
  OBSERVABILITY_REQUEST_HEADER,
  OBSERVABILITY_RETENTION_DAYS,
  OBSERVABILITY_SCHEMA,
  aggregateObservability,
  aggregateObservabilityBuckets,
  classifyD1Failure,
  createObservabilityEvent,
  createRequestId,
  emitStructuredObservability,
  evaluateObservabilityAlerts,
  normalizeObservabilityEvent,
  normalizeObservabilityRoute,
  observabilityExpiry,
  requestIdFromRequest,
  responseClassForStatus,
  withRequestId,
  type ObservabilityAggregate,
  type ObservabilityAggregateBucket,
  type ObservabilityEventInput,
  type ObservabilityReleaseIdentity,
} from "../app/observability";
import {
  OBSERVABILITY_PURGE_BATCH_SIZE,
  OBSERVABILITY_STALE_AFTER_MS,
  persistOperationalEvents,
  purgeExpiredOperationalEvents,
  readOperationalAggregateSnapshot,
  type OperationalEventDatabase,
} from "../app/operational-events";
import {
  shouldEmitOperationalAnomaly,
  shouldPersistOperationalAnomaly,
} from "../app/observability-persistence";

const requestId = "550e8400-e29b-41d4-a716-446655440000";
const release: ObservabilityReleaseIdentity = {
  deploymentVersion: "v53-production",
  webCommit: "a".repeat(40),
  bundleRevision: 14,
  runtimeRevision: "canonical-v14",
  playedCaseSchemaRevision: 2,
};

function event(input: Omit<ObservabilityEventInput, "requestId" | "route"> & Partial<Pick<ObservabilityEventInput, "requestId" | "route">>) {
  return createObservabilityEvent({ requestId, route: "play_sessions", ...input }, release);
}

function emptyAggregate(): ObservabilityAggregate {
  return aggregateObservability([]);
}

test("v1 event contract is exact, allowlisted and strips sensitive extra input", () => {
  assert.equal(OBSERVABILITY_SCHEMA, "genesis.juris.observability.v1");
  assert.deepEqual(OBSERVABILITY_EVENT_NAMES, [
    "worker.request", "worker.exception", "d1.operation", "replay.start", "replay.success",
    "replay.expected_rejection", "replay.internal_failure", "played_case.revision_mismatch",
    "played_case.fingerprint_mismatch", "historical_bundle.lookup_miss", "session.import",
    "session.load", "session.save",
  ]);
  const sensitive = {
    email: "private@example.test",
    sessionKey: "session-secret",
    caseId: "case-secret",
    fingerprint: `sha256-${"f".repeat(64)}`,
    rawUrl: "https://example.test/api?token=secret",
    query: "token=secret",
    contentId: "content-secret",
  };
  const observed = createObservabilityEvent({
    requestId,
    eventName: "session.load",
    route: "play_sessions",
    outcome: "success",
    reason: "completed",
    responseClass: "2xx",
    operation: "load",
    logicalRepository: "play_sessions",
    commandCount: 3,
    occurredAt: "2026-08-30T12:00:00.000Z",
    ...sensitive,
  } as ObservabilityEventInput & typeof sensitive, release);
  assert.deepEqual(Object.keys(observed), [
    "schema", "occurredAt", "requestId", "eventName", "route", "outcome", "reason", "responseClass",
    "latencyMs", "operation", "logicalRepository", "commandCount", "deploymentVersion", "webCommit",
    "bundleRevision", "runtimeRevision", "playedCaseSchemaRevision",
  ]);
  const serialized = JSON.stringify(observed);
  for (const value of Object.values(sensitive)) assert.ok(!serialized.includes(value));
  assert.deepEqual(normalizeObservabilityEvent(observed), observed);
  assert.equal(normalizeObservabilityEvent({ ...observed, email: sensitive.email }), null);
  assert.throws(() => event({ eventName: "replay.success", outcome: "success", reason: "timeout" }), /contract/i);
});

test("correlation IDs, normalized routes and response classes never retain URL identifiers", () => {
  assert.equal(createRequestId(() => requestId.toUpperCase()), requestId);
  assert.throws(() => createRequestId(() => "not-a-uuid"), /UUID/i);
  assert.equal(requestIdFromRequest(new Request("https://juris.test/studio", { headers: { [OBSERVABILITY_REQUEST_HEADER]: requestId.toUpperCase() } })), requestId);
  assert.match(requestIdFromRequest(new Request("https://juris.test/")), /^[0-9a-f-]{36}$/u);
  assert.equal(normalizeObservabilityRoute("https://juris.test/api/catalog/private_case?version=secret"), "catalog");
  assert.equal(normalizeObservabilityRoute("https://juris.test/api/play-sessions?sessionKey=secret"), "play_sessions");
  assert.equal(normalizeObservabilityRoute("https://juris.test/studio/private-draft"), "studio");
  assert.equal(responseClassForStatus(204), "2xx");
  assert.equal(responseClassForStatus(503), "5xx");
  assert.equal(responseClassForStatus(999), "none");
  const response = withRequestId(new Response("ok", { status: 200 }), requestId);
  assert.equal(response.headers.get(OBSERVABILITY_REQUEST_HEADER), requestId);
});

test("structured emission and D1 error classification are fail-open and coarse", () => {
  const observed = event({ eventName: "d1.operation", outcome: "success", reason: "completed", operation: "read", logicalRepository: "play_sessions" });
  assert.equal(emitStructuredObservability(observed, () => { throw new Error("sink unavailable"); }), false);
  assert.deepEqual(classifyD1Failure(new Error("database is locked")), { outcome: "expected_rejection", reason: "busy" });
  assert.deepEqual(classifyD1Failure(new Error("D1 request timed out")), { outcome: "internal_failure", reason: "timeout" });
  assert.deepEqual(classifyD1Failure(new Error("UNIQUE constraint failed")), { outcome: "expected_rejection", reason: "constraint_conflict" });
  assert.deepEqual(classifyD1Failure(new Error("network failed")), { outcome: "internal_failure", reason: "unexpected_error" });
});

test("product-D1 persistence selects only exact low-volume anomalies", () => {
  const worker = event({ eventName: "worker.request", outcome: "success", reason: "completed", responseClass: "2xx", route: "root" });
  const successfulD1 = event({ eventName: "d1.operation", outcome: "success", reason: "completed", operation: "read", logicalRepository: "case_versions" });
  const criticalD1 = event({ eventName: "d1.operation", outcome: "internal_failure", reason: "timeout", operation: "read", logicalRepository: "case_versions" });
  const busyD1 = event({ eventName: "d1.operation", outcome: "expected_rejection", reason: "busy", operation: "read", logicalRepository: "case_versions" });
  const replaySuccess = event({ eventName: "replay.success", outcome: "success", reason: "state_matches", operation: "replay", logicalRepository: "play_sessions" });
  const replayFailure = event({ eventName: "replay.internal_failure", outcome: "internal_failure", reason: "stored_state_divergence", operation: "replay", logicalRepository: "play_sessions" });
  const mismatch = event({ eventName: "played_case.fingerprint_mismatch", outcome: "expected_rejection", reason: "requested_identity_mismatch", operation: "read", logicalRepository: "case_versions" });
  const publicMismatch = createObservabilityEvent({ ...mismatch, route: "catalog" }, release);
  const sessionFailure = event({ eventName: "session.save", outcome: "internal_failure", reason: "persistence_failure", operation: "save", logicalRepository: "play_sessions" });
  const serverFailure = event({ eventName: "worker.request", outcome: "internal_failure", reason: "server_error", responseClass: "5xx", route: "root" });
  assert.equal(shouldPersistOperationalAnomaly(worker), false);
  assert.equal(shouldPersistOperationalAnomaly(successfulD1), false);
  assert.equal(shouldEmitOperationalAnomaly(criticalD1), true);
  assert.equal(shouldPersistOperationalAnomaly(criticalD1), false);
  assert.equal(shouldEmitOperationalAnomaly(busyD1), true);
  assert.equal(shouldPersistOperationalAnomaly(busyD1), false);
  assert.equal(shouldPersistOperationalAnomaly(replaySuccess), false);
  assert.equal(shouldPersistOperationalAnomaly(replayFailure), true);
  assert.equal(shouldPersistOperationalAnomaly(mismatch), true);
  assert.equal(shouldEmitOperationalAnomaly(publicMismatch), true);
  assert.equal(shouldPersistOperationalAnomaly(publicMismatch), false);
  assert.equal(shouldEmitOperationalAnomaly(sessionFailure), true);
  assert.equal(shouldPersistOperationalAnomaly(sessionFailure), false);
  assert.equal(shouldPersistOperationalAnomaly(serverFailure), false);
});

test("aggregation exposes Worker, D1 and replay counts plus weighted p50/p95 latency", () => {
  const buckets: ObservabilityAggregateBucket[] = [
    { eventName: "worker.request", route: "root", outcome: "success", reason: "completed", responseClass: "2xx", latencyMs: 100, count: 18 },
    { eventName: "worker.request", route: "root", outcome: "expected_rejection", reason: "client_response", responseClass: "4xx", latencyMs: 200, count: 1 },
    { eventName: "worker.request", route: "root", outcome: "internal_failure", reason: "server_error", responseClass: "5xx", latencyMs: 1_000, count: 1 },
    { eventName: "d1.operation", route: "play_sessions", outcome: "success", reason: "completed", responseClass: "none", latencyMs: 100, count: 2 },
    { eventName: "d1.operation", route: "play_sessions", outcome: "expected_rejection", reason: "busy", responseClass: "none", latencyMs: 600, count: 2 },
    { eventName: "d1.operation", route: "play_sessions", outcome: "internal_failure", reason: "timeout", responseClass: "none", latencyMs: 900, count: 1 },
    { eventName: "replay.start", route: "play_sessions", outcome: "started", reason: "state_validation", responseClass: "none", latencyMs: 0, count: 20 },
    { eventName: "replay.success", route: "play_sessions", outcome: "success", reason: "state_matches", responseClass: "none", latencyMs: 20, count: 18 },
    { eventName: "replay.expected_rejection", route: "play_sessions", outcome: "expected_rejection", reason: "stale_revision", responseClass: "4xx", latencyMs: 40, count: 1 },
    { eventName: "replay.internal_failure", route: "play_sessions", outcome: "internal_failure", reason: "stored_state_divergence", responseClass: "4xx", latencyMs: 100, count: 1 },
  ];
  const aggregate = aggregateObservabilityBuckets(buckets);
  assert.deepEqual({ requests: aggregate.workerRequests, ok: aggregate.worker2xx, client: aggregate.worker4xx, server: aggregate.worker5xx }, { requests: 20, ok: 18, client: 1, server: 1 });
  assert.deepEqual({ samples: aggregate.workerLatencySamples, p50: aggregate.workerLatencyP50Ms, p95: aggregate.workerLatencyP95Ms }, { samples: 20, p50: 100, p95: 200 });
  assert.deepEqual({ success: aggregate.d1Successes, failures: aggregate.d1Failures, internal: aggregate.d1InternalFailures, timeout: aggregate.d1Timeouts, busy: aggregate.d1Busy }, { success: 2, failures: 3, internal: 1, timeout: 1, busy: 2 });
  assert.deepEqual({ samples: aggregate.d1LatencySamples, p50: aggregate.d1LatencyP50Ms, p95: aggregate.d1LatencyP95Ms }, { samples: 5, p50: 600, p95: 900 });
  assert.deepEqual({ attempts: aggregate.replayAttempts, success: aggregate.replaySuccesses, expected: aggregate.replayExpectedRejections, internal: aggregate.replayInternalFailures }, { attempts: 20, success: 18, expected: 1, internal: 1 });
  assert.equal(aggregate.replayAttempts, aggregate.replaySuccesses + aggregate.replayExpectedRejections + aggregate.replayInternalFailures);
  assert.deepEqual({ samples: aggregate.replayLatencySamples, p50: aggregate.replayLatencyP50Ms, p95: aggregate.replayLatencyP95Ms }, { samples: 20, p50: 20, p95: 40 });
  assert.equal(aggregate.byResponseClass["5xx"], 1);
});

test("alert evaluation implements the exact 5/10/15-minute thresholds", () => {
  const base = emptyAggregate();
  const all = evaluateObservabilityAlerts({
    fiveMinutes: { ...base, workerExceptions: 1, worker5xx: 3, d1Failures: 3, d1InternalFailures: 3 },
    tenMinutes: base,
    fifteenMinutes: {
      ...base,
      d1LatencySamples: 20,
      d1LatencyP95Ms: 501,
      replayAttempts: 20,
      replayInternalFailures: 3,
      historicalMisses: 1,
      expectedRevisionMismatches: 6,
      expectedFingerprintMismatches: 4,
    },
  });
  assert.deepEqual(all.map(({ id, severity, window }) => [id, severity, window]), [
    ["d1_failures", "critical", "5m"],
    ["d1_latency_p95", "warning", "15m"],
    ["expected_identity_rejections", "diagnostic", "15m"],
    ["historical_lookup_miss", "warning", "15m"],
    ["replay_internal_failure", "critical", "15m"],
    ["worker_5xx", "critical", "5m"],
    ["worker_exception", "critical", "5m"],
  ]);
  const ratioOnly = evaluateObservabilityAlerts({
    fiveMinutes: { ...base, worker5xx: 2, d1Failures: 2, d1InternalFailures: 2 },
    tenMinutes: { ...base, workerRequests: 20, worker5xx: 1 },
    fifteenMinutes: { ...base, d1LatencyP95Ms: 500, replayAttempts: 20, replayInternalFailures: 1, expectedRevisionMismatches: 9 },
  });
  assert.deepEqual(ratioOnly.map(({ id, window }) => [id, window]), [["replay_internal_failure", "15m"], ["worker_5xx", "10m"]]);
  assert.deepEqual(evaluateObservabilityAlerts({
    fiveMinutes: { ...base, worker5xx: 2, d1Failures: 2, d1InternalFailures: 2 },
    tenMinutes: { ...base, workerRequests: 19, worker5xx: 1 },
    fifteenMinutes: { ...base, d1LatencyP95Ms: 500, replayAttempts: 19, replayInternalFailures: 1, expectedRevisionMismatches: 9 },
  }), []);
});

test("retention and persistence bind exactly 14 days and a bounded purge", async () => {
  assert.equal(OBSERVABILITY_RETENTION_DAYS, 14);
  assert.equal(OBSERVABILITY_PURGE_BATCH_SIZE, 250);
  assert.equal(observabilityExpiry("2026-08-01T00:00:00.000Z"), "2026-08-15T00:00:00.000Z");
  const prepared: Array<{ query: string; values: unknown[] }> = [];
  const batches: unknown[][] = [];
  const database = {
    prepare(query: string) {
      const record = { query, values: [] as unknown[] };
      const statement = {
        bind(...values: unknown[]) { record.values = values; return statement; },
      };
      prepared.push(record);
      return statement;
    },
    async batch(statements: unknown[]) { batches.push(statements); return []; },
  } as unknown as OperationalEventDatabase;
  const retainedAnomaly = event({
    eventName: "replay.internal_failure", outcome: "internal_failure", reason: "stored_state_divergence", responseClass: "4xx",
    latencyMs: 750, operation: "replay", logicalRepository: "play_sessions", occurredAt: "2026-08-01T00:00:00.000Z",
  });
  await persistOperationalEvents(database, [retainedAnomaly]);
  assert.equal(batches[0]?.length, 2);
  assert.match(prepared[0]?.query ?? "", /ORDER BY expires_at, id[\s\S]*LIMIT \?/u);
  assert.deepEqual(prepared[0]?.values, ["2026-08-01T00:00:00.000Z", OBSERVABILITY_PURGE_BATCH_SIZE]);
  assert.equal(prepared[1]?.values[2], "2026-08-15T00:00:00.000Z");
  assert.equal(prepared[1]?.values[13], 1);
  const preparedAfterRetainedAnomaly = prepared.length;
  const batchesAfterRetainedAnomaly = batches.length;
  const rejectedFromProductD1 = [
    event({ eventName: "worker.request", outcome: "success", reason: "completed", responseClass: "2xx", route: "root" }),
    event({ eventName: "d1.operation", outcome: "internal_failure", reason: "timeout", responseClass: "none", operation: "read", logicalRepository: "play_sessions" }),
    event({ eventName: "d1.operation", outcome: "expected_rejection", reason: "busy", responseClass: "none", operation: "read", logicalRepository: "play_sessions" }),
    event({ eventName: "historical_bundle.lookup_miss", outcome: "expected_rejection", reason: "version_unavailable", responseClass: "4xx", operation: "read", logicalRepository: "case_versions", route: "catalog" }),
  ];
  const forgedWithSensitiveField = { ...retainedAnomaly, email: "private@example.test" } as typeof retainedAnomaly;
  const rejectedBatches = [
    ...rejectedFromProductD1.map((rejected) => [rejected]),
    [retainedAnomaly, rejectedFromProductD1[0]],
    [forgedWithSensitiveField],
  ];
  for (const rejected of rejectedBatches) {
    await assert.rejects(
      () => persistOperationalEvents(database, rejected),
      /only exact retained operational anomalies/u,
    );
    assert.equal(prepared.length, preparedAfterRetainedAnomaly, "rejected telemetry must not prepare a D1 statement");
    assert.equal(batches.length, batchesAfterRetainedAnomaly, "rejected telemetry must not create a D1 batch");
  }
});

type LatestFixture = {
  event_name: string;
  route: string;
  outcome: string;
  occurred_at: string;
  deployment_version: string;
  web_commit: string;
  bundle_revision: number;
  runtime_revision: string;
  played_case_schema_revision: number;
};

function snapshotDatabase(latest: LatestFixture | null, releases: LatestFixture[] = latest ? [latest] : []) {
  return {
    prepare(query: string) {
      const statement = {
        bind(...values: unknown[]) { void values; return statement; },
        async all() {
          if (query.includes("GROUP BY event_name")) return { results: [] };
          if (query.includes("GROUP BY deployment_version")) return { results: releases };
          if (query.includes("ORDER BY occurred_at DESC")) return { results: latest ? [latest] : [] };
          throw new Error("Unexpected snapshot query");
        },
      };
      return statement;
    },
  } as unknown as Pick<OperationalEventDatabase, "prepare">;
}

test("aggregate snapshots report no-data, current, stale and partial release state at 15 minutes", async () => {
  assert.equal(OBSERVABILITY_STALE_AFTER_MS, 15 * 60 * 1_000);
  const from = "2026-08-30T12:00:00.000Z";
  const to = "2026-08-30T12:30:00.000Z";
  const latest: LatestFixture = {
    event_name: "replay.internal_failure",
    route: "play_sessions",
    outcome: "internal_failure",
    occurred_at: "2026-08-30T12:20:00.000Z",
    deployment_version: "v53-production",
    web_commit: "b".repeat(40),
    bundle_revision: 14,
    runtime_revision: "canonical-v14",
    played_case_schema_revision: 2,
  };
  const noData = await readOperationalAggregateSnapshot(snapshotDatabase(null), from, to);
  assert.equal(noData.state, "no_data");
  assert.equal(noData.latestEvent, null);
  assert.equal(noData.release, null);

  const current = await readOperationalAggregateSnapshot(snapshotDatabase(latest), from, to);
  assert.equal(current.state, "current");
  assert.deepEqual(current.latestEvent, {
    event_name: latest.event_name,
    route: latest.route,
    outcome: latest.outcome,
    occurred_at: latest.occurred_at,
  });
  assert.deepEqual(current.release, {
    deploymentVersion: latest.deployment_version,
    webCommit: latest.web_commit,
    bundleRevision: 14,
    runtimeRevision: "canonical-v14",
    playedCaseSchemaRevision: 2,
  });

  const stale = await readOperationalAggregateSnapshot(snapshotDatabase({ ...latest, occurred_at: "2026-08-30T12:14:59.999Z" }), from, to);
  assert.equal(stale.state, "stale");
  const partial = await readOperationalAggregateSnapshot(snapshotDatabase(latest, [latest, { ...latest, deployment_version: "v53-canary" }]), from, to);
  assert.equal(partial.state, "partial");
  for (const deploymentVersion of ["local", "unknown", "unassigned"]) {
    const sentinel = await readOperationalAggregateSnapshot(
      snapshotDatabase({ ...latest, deployment_version: deploymentVersion }),
      from,
      to,
    );
    assert.equal(sentinel.state, "partial");
  }
});

const operationalMigration = readFileSync(new URL("../drizzle/0011_operational_events.sql", import.meta.url), "utf8");

type OperationalInsertOverrides = Partial<{
  eventName: string;
  route: string;
  outcome: string;
  reason: string;
  responseClass: string;
  operation: string | null;
  logicalRepository: string | null;
  sampleWeight: number;
  expiresAt: string;
}>;

function operationalInsert(db: DatabaseSync, overrides: OperationalInsertOverrides = {}) {
  const fixture = {
    eventName: "replay.internal_failure",
    route: "play_sessions",
    outcome: "internal_failure",
    reason: "stored_state_divergence",
    responseClass: "4xx",
    operation: "replay",
    logicalRepository: "play_sessions",
    sampleWeight: 1,
    expiresAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
  return db.prepare(`
    INSERT INTO operational_events (
      schema, occurred_at, expires_at, request_id, event_name, route, outcome, reason,
      response_class, latency_ms, operation, logical_repository, command_count, sample_weight,
      deployment_version, web_commit, bundle_revision, runtime_revision, played_case_schema_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    OBSERVABILITY_SCHEMA,
    "2026-08-01T00:00:00.000Z",
    fixture.expiresAt,
    requestId,
    fixture.eventName,
    fixture.route,
    fixture.outcome,
    fixture.reason,
    fixture.responseClass,
    25,
    fixture.operation,
    fixture.logicalRepository,
    null,
    fixture.sampleWeight,
    "v53-production",
    "unknown",
    14,
    "canonical-v14",
    2,
  );
}

test("0011 is additive, repeat-safe, privacy-minimal and accepts only retained anomalies", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(operationalMigration);
  db.exec(operationalMigration);
  const columns = (db.prepare("PRAGMA table_info(operational_events)").all() as Array<{ name: string }>).map(({ name }) => name);
  assert.deepEqual(columns, [
    "id", "schema", "occurred_at", "expires_at", "request_id", "event_name", "route", "outcome", "reason",
    "response_class", "latency_ms", "operation", "logical_repository", "command_count", "sample_weight",
    "deployment_version", "web_commit", "bundle_revision", "runtime_revision", "played_case_schema_revision",
  ]);
  const forbidden = ["email", "user_email", "session_key", "case_id", "case_version", "case_fingerprint", "fingerprint", "raw_url", "query", "content_id", "event_id"];
  for (const name of forbidden) assert.ok(!columns.includes(name), `${name} must not be stored`);
  const indexes = new Set((db.prepare("PRAGMA index_list(operational_events)").all() as Array<{ name: string }>).map(({ name }) => name));
  assert.deepEqual(indexes, new Set([
    "operational_events_expiry_idx",
    "operational_events_occurred_idx",
    "operational_events_event_outcome_occurred_idx",
    "operational_events_route_occurred_idx",
  ]));
  operationalInsert(db);
  operationalInsert(db, {
    eventName: "played_case.revision_mismatch",
    route: "admin",
    outcome: "expected_rejection",
    reason: "stale_client",
    operation: "import",
  });
  operationalInsert(db, {
    eventName: "played_case.fingerprint_mismatch",
    outcome: "internal_failure",
    reason: "stored_identity_mismatch",
    operation: "load",
  });
  operationalInsert(db, {
    eventName: "historical_bundle.lookup_miss",
    outcome: "expected_rejection",
    reason: "version_unavailable",
    operation: "read",
    logicalRepository: "case_versions",
  });
  assert.equal(db.prepare("SELECT count(*) AS count FROM operational_events").get()?.count, 4);
  assert.throws(() => operationalInsert(db, { eventName: "worker.request" }), /operational_events_event_name_check/u);
  assert.throws(() => operationalInsert(db, {
    eventName: "d1.operation",
    outcome: "internal_failure",
    reason: "timeout",
    responseClass: "none",
    operation: "read",
  }), /CHECK/u);
  assert.throws(() => operationalInsert(db, {
    eventName: "d1.operation",
    outcome: "expected_rejection",
    reason: "busy",
    responseClass: "none",
    operation: "read",
  }), /CHECK/u);
  assert.throws(() => operationalInsert(db, { route: "catalog" }), /operational_events_route_check/u);
  assert.throws(() => operationalInsert(db, { outcome: "success" }), /operational_events_outcome_check/u);
  assert.throws(() => operationalInsert(db, { reason: "private@example.test" }), /operational_events_reason_check/u);
  assert.throws(() => operationalInsert(db, { sampleWeight: 2 }), /operational_events_sample_weight_check/u);
  assert.throws(() => operationalInsert(db, { expiresAt: "2026-08-14T00:00:00.000Z" }), /operational_events_retention_check/u);
  assert.equal(db.prepare("SELECT count(*) AS count FROM operational_events").get()?.count, 4);
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
});

test("explicit purge helper deletes at most one indexed batch", async () => {
  let purgeQuery = "";
  let purgeValues: unknown[] = [];
  const database = {
    prepare(query: string) {
      purgeQuery = query;
      const statement = {
        bind(...values: unknown[]) { purgeValues = values; return statement; },
        async run() { return { meta: { changes: OBSERVABILITY_PURGE_BATCH_SIZE } }; },
      };
      return statement;
    },
  } as unknown as Pick<OperationalEventDatabase, "prepare">;
  const now = "2026-08-30T00:00:00.000Z";
  assert.equal(await purgeExpiredOperationalEvents(database, now), OBSERVABILITY_PURGE_BATCH_SIZE);
  assert.match(purgeQuery, /WHERE id IN[\s\S]*ORDER BY expires_at, id[\s\S]*LIMIT \?/u);
  assert.deepEqual(purgeValues, [now, OBSERVABILITY_PURGE_BATCH_SIZE]);

  const db = new DatabaseSync(":memory:");
  db.exec(operationalMigration);
  for (let index = 0; index < 300; index += 1) operationalInsert(db);
  const result = db.prepare(purgeQuery).run(now, OBSERVABILITY_PURGE_BATCH_SIZE);
  assert.equal(result.changes, OBSERVABILITY_PURGE_BATCH_SIZE);
  assert.equal(db.prepare("SELECT count(*) AS count FROM operational_events").get()?.count, 50);
});

test("request/session source instrumentation is fail-open, correlated and pairs replay terminals with attempts", () => {
  const workerSource = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  const requestLifecycleSource = readFileSync(new URL("../worker/request-lifecycle.ts", import.meta.url), "utf8");
  const sessionSource = readFileSync(new URL("../app/api/play-sessions/route.ts", import.meta.url), "utf8");
  const catalogSource = readFileSync(new URL("../app/api/catalog/[caseId]/route.ts", import.meta.url), "utf8");
  assert.match(workerSource, /runObservedWorkerRequest\(request/u);
  assert.match(requestLifecycleSource, /requestHeaders\.set\(OBSERVABILITY_REQUEST_HEADER, requestId\)/u);
  assert.match(requestLifecycleSource, /response = withRequestId\(response, requestId\)/u);
  assert.match(workerSource, /observeWorkerRequestEvent\(input/u);
  assert.doesNotMatch(workerSource, /observeOperationalEvent\(\{/u);
  assert.match(workerSource, /database: route === "play_sessions" \|\| route === "admin" \? env\.DB : null/u);
  assert.match(requestLifecycleSource, /eventName: "worker\.exception"/u);
  assert.match(sessionSource, /runObservedD1Operation\(observe, \{ operation: "read", logicalRepository \}, read\)/u);
  assert.match(catalogSource, /runObservedD1Operation\(observe, \{ operation: "read", logicalRepository \}, read\)/u);
  assert.match(sessionSource, /observedD1Read\(observe, "play_sessions"/u);
  assert.match(sessionSource, /observedD1Read\(observe, "case_versions"/u);
  assert.match(catalogSource, /readD1\("cases", \(\) => db\.select/u);
  assert.match(catalogSource, /readD1\("case_versions", \(\) => db\.select/u);
  assert.equal(catalogSource.match(/eventName: "historical_bundle\.lookup_miss"/gu)?.length, 3);
  assert.match(catalogSource, /if \(requestedVersion !== null\) observe\(\{ eventName: "historical_bundle\.lookup_miss"/u);
  assert.match(catalogSource, /outcome: requestedVersion !== null \? "expected_rejection" : "internal_failure"/u);
  assert.match(catalogSource, /reason: requestedVersion !== null \? "version_unavailable" : "stored_version_unavailable"/u);
  assert.equal(sessionSource.match(/reason: "stored_version_unavailable"/gu)?.length, 2);
  assert.match(sessionSource, /eventName: "played_case\.fingerprint_mismatch"[\s\S]*?reason: "canonical_source_mismatch"/u);
  const replayTerminals = [...sessionSource.matchAll(/observe\(\{ eventName: "replay\.(?:success|expected_rejection|internal_failure)"[\s\S]*?\}\);/gu)];
  assert.equal(replayTerminals.length, 11);
  for (const terminal of replayTerminals) assert.match(terminal[0], /latencyMs:/u);
  for (const helper of ["duplicateDecisionResponse", "duplicateAdvanceTimeResponse", "duplicateAbandonResponse", "staleSession"]) {
    const start = sessionSource.indexOf(`function ${helper}`);
    const end = sessionSource.indexOf("\n}", start);
    assert.ok(start >= 0 && sessionSource.slice(start, end).includes("observeReplayStart("), `${helper} must record a replay attempt`);
  }
});
