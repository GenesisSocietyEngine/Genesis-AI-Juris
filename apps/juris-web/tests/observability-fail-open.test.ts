import assert from "node:assert/strict";
import test from "node:test";
import {
  type ObservabilityEventInput,
  type ObservabilityEventV1,
  type ObservabilityReleaseIdentity,
} from "../app/observability";
import {
  MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH,
  type OperationalEventDatabase,
} from "../app/operational-events";
import {
  createOperationalTelemetryCircuitBreaker,
  createOperationalTelemetryScope,
  flushOperationalTelemetryScope,
  observeOperationalEventCore,
} from "../app/server-observability-core";

const requestId = "550e8400-e29b-41d4-a716-446655440000";
const identity: ObservabilityReleaseIdentity = {
  deploymentVersion: "v53-production",
  webCommit: "a".repeat(40),
  bundleRevision: 14,
  runtimeRevision: "canonical-v14",
  playedCaseSchemaRevision: 2,
};

const replayFailure: ObservabilityEventInput = {
  requestId,
  eventName: "replay.internal_failure",
  route: "play_sessions",
  outcome: "internal_failure",
  reason: "stored_revision_divergence",
  responseClass: "4xx",
  operation: "replay",
  logicalRepository: "play_sessions",
  occurredAt: "2026-08-30T12:00:00.000Z",
};

interface DatabaseOptions {
  prepareThrows?: boolean;
  batchRejects?: boolean;
}

function recordingDatabase(options: DatabaseOptions = {}) {
  const prepared: Array<{ query: string; values: unknown[] }> = [];
  const batchSizes: number[] = [];
  const database = {
    prepare(query: string) {
      if (options.prepareThrows) throw new Error("D1 prepare unavailable");
      const record = { query, values: [] as unknown[] };
      const statement = {
        bind(...values: unknown[]) {
          record.values = values;
          return statement;
        },
      };
      prepared.push(record);
      return statement;
    },
    async batch(statements: D1PreparedStatement[]) {
      batchSizes.push(statements.length);
      if (options.batchRejects) throw new Error("D1 batch rejected");
      return [];
    },
  } as unknown as OperationalEventDatabase;
  return { database, prepared, batchSizes };
}

function parsedSink(target: ObservabilityEventV1[]) {
  return (serialized: string) => {
    target.push(JSON.parse(serialized) as ObservabilityEventV1);
  };
}

test("one logical replay operation schedules one bounded anomaly batch", async () => {
  const recorder = recordingDatabase();
  const deferred: Promise<unknown>[] = [];
  const emitted: ObservabilityEventV1[] = [];
  const scope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: createOperationalTelemetryCircuitBreaker(),
    defer(promise) { deferred.push(promise); },
  });

  observeOperationalEventCore(replayFailure, { identity, scope, sink: parsedSink(emitted) });
  observeOperationalEventCore({
    ...replayFailure,
    eventName: "played_case.revision_mismatch",
    reason: "stored_revision_divergence",
    operation: "decision",
  }, { identity, scope, sink: parsedSink(emitted) });
  observeOperationalEventCore({
    ...replayFailure,
    eventName: "session.save",
    reason: "persistence_failure",
    operation: "save",
  }, { identity, scope, sink: parsedSink(emitted) });

  assert.equal(scope.queuedEvents.length, MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH);
  assert.deepEqual(scope.queuedEvents.map(({ eventName }) => eventName), [
    "replay.internal_failure",
    "played_case.revision_mismatch",
  ]);
  flushOperationalTelemetryScope(scope);
  flushOperationalTelemetryScope(scope);
  await Promise.all(deferred);

  assert.deepEqual(emitted.map(({ eventName }) => eventName), [
    "replay.internal_failure",
    "played_case.revision_mismatch",
    "session.save",
  ]);
  assert.equal(recorder.batchSizes.length, 1);
  assert.deepEqual(recorder.batchSizes, [1 + MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH]);
  assert.equal(recorder.prepared.length, 1 + MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH);
});

test("structured sink failure is fail-open and never creates recursive telemetry", async () => {
  const recorder = recordingDatabase();
  const deferred: Promise<unknown>[] = [];
  let sinkCalls = 0;
  const scope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: createOperationalTelemetryCircuitBreaker(),
    defer(promise) { deferred.push(promise); },
  });
  const productResponse = new Response("valid product response", { status: 200 });

  const observed = observeOperationalEventCore(replayFailure, {
    identity,
    scope,
    sink() {
      sinkCalls += 1;
      throw new Error("structured sink unavailable");
    },
  });
  flushOperationalTelemetryScope(scope);
  await Promise.all(deferred);

  assert.equal(observed?.eventName, "replay.internal_failure");
  assert.equal(productResponse.status, 200);
  assert.equal(await productResponse.text(), "valid product response");
  assert.equal(sinkCalls, 1);
  assert.equal(recorder.batchSizes.length, 1);
});

test("D1 prepare failure opens the circuit without recursive logging or product impact", async () => {
  const recorder = recordingDatabase({ prepareThrows: true });
  const deferred: Promise<unknown>[] = [];
  const emitted: ObservabilityEventV1[] = [];
  const breaker = createOperationalTelemetryCircuitBreaker();
  const scope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer(promise) { deferred.push(promise); },
  });

  observeOperationalEventCore(replayFailure, { identity, scope, sink: parsedSink(emitted) });
  assert.doesNotThrow(() => flushOperationalTelemetryScope(scope));
  await Promise.all(deferred);
  assert.equal(breaker.isOpen(), true);

  const blockedScope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer(promise) { deferred.push(promise); },
  });
  observeOperationalEventCore({
    ...replayFailure,
    requestId: "550e8400-e29b-41d4-a716-446655440001",
  }, { identity, scope: blockedScope, sink: parsedSink(emitted) });
  flushOperationalTelemetryScope(blockedScope);

  assert.deepEqual(emitted.map(({ eventName }) => eventName), [
    "replay.internal_failure",
    "replay.internal_failure",
  ]);
  assert.equal(recorder.batchSizes.length, 0);
});

test("D1 batch rejection opens the circuit and is swallowed once", async () => {
  const recorder = recordingDatabase({ batchRejects: true });
  const deferred: Promise<unknown>[] = [];
  const emitted: ObservabilityEventV1[] = [];
  const breaker = createOperationalTelemetryCircuitBreaker();
  const scope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer(promise) { deferred.push(promise); },
  });

  observeOperationalEventCore(replayFailure, { identity, scope, sink: parsedSink(emitted) });
  flushOperationalTelemetryScope(scope);
  await Promise.all(deferred);

  assert.equal(breaker.isOpen(), true);
  assert.equal(recorder.batchSizes.length, 1);
  assert.deepEqual(emitted.map(({ eventName }) => eventName), ["replay.internal_failure"]);
});

test("waitUntil/defer failure cannot change the response or retry telemetry", async () => {
  const recorder = recordingDatabase();
  const emitted: ObservabilityEventV1[] = [];
  const breaker = createOperationalTelemetryCircuitBreaker();
  const scope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer() {
      throw new Error("waitUntil unavailable");
    },
  });
  const productResponse = new Response("accepted", { status: 202 });

  observeOperationalEventCore(replayFailure, { identity, scope, sink: parsedSink(emitted) });
  assert.doesNotThrow(() => flushOperationalTelemetryScope(scope));
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(productResponse.status, 202);
  assert.equal(await productResponse.text(), "accepted");
  assert.equal(recorder.batchSizes.length, 1);
  assert.equal(breaker.isOpen(), false);
  assert.deepEqual(emitted.map(({ eventName }) => eventName), ["replay.internal_failure"]);
});

test("a D1 busy signal clears queued anomalies, performs zero D1 work, and recovers after cooldown", async () => {
  let now = 10_000;
  const recorder = recordingDatabase();
  const deferred: Promise<unknown>[] = [];
  const emitted: ObservabilityEventV1[] = [];
  const breaker = createOperationalTelemetryCircuitBreaker({
    cooldownMs: 1_000,
    now: () => now,
  });
  const busyScope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer(promise) { deferred.push(promise); },
  });

  observeOperationalEventCore({
    requestId,
    eventName: "d1.operation",
    route: "play_sessions",
    outcome: "expected_rejection",
    reason: "busy",
    operation: "read",
    logicalRepository: "play_sessions",
    occurredAt: "2026-08-30T12:00:00.000Z",
  }, { identity, scope: busyScope, sink: parsedSink(emitted) });
  observeOperationalEventCore(replayFailure, { identity, scope: busyScope, sink: parsedSink(emitted) });
  assert.equal(breaker.isOpen(), true);
  assert.equal(breaker.openUntil(), 11_000);
  assert.equal(busyScope.queuedEvents.length, 0);
  flushOperationalTelemetryScope(busyScope);
  await Promise.all(deferred);
  assert.equal(recorder.prepared.length, 0);
  assert.deepEqual(recorder.batchSizes, []);

  now = 10_999;
  const blockedScope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
  });
  observeOperationalEventCore({
    ...replayFailure,
    requestId: "550e8400-e29b-41d4-a716-446655440001",
  }, { identity, scope: blockedScope, sink: parsedSink(emitted) });
  flushOperationalTelemetryScope(blockedScope);
  assert.equal(recorder.prepared.length, 0);
  assert.deepEqual(recorder.batchSizes, []);

  now = 11_000;
  const recoveredDeferred: Promise<unknown>[] = [];
  const recoveredScope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer(promise) { recoveredDeferred.push(promise); },
  });
  observeOperationalEventCore({
    ...replayFailure,
    requestId: "550e8400-e29b-41d4-a716-446655440002",
  }, { identity, scope: recoveredScope, sink: parsedSink(emitted) });
  flushOperationalTelemetryScope(recoveredScope);
  await Promise.all(recoveredDeferred);

  assert.equal(breaker.isOpen(), false);
  assert.deepEqual(recorder.batchSizes, [2]);
});

test("a late D1 capacity failure clears every queued signal and performs zero telemetry D1 work", async () => {
  const recorder = recordingDatabase();
  const deferred: Promise<unknown>[] = [];
  const emitted: ObservabilityEventV1[] = [];
  const breaker = createOperationalTelemetryCircuitBreaker();
  const scope = createOperationalTelemetryScope({
    database: recorder.database,
    circuitBreaker: breaker,
    defer(promise) { deferred.push(promise); },
  });

  observeOperationalEventCore(replayFailure, { identity, scope, sink: parsedSink(emitted) });
  observeOperationalEventCore({
    ...replayFailure,
    eventName: "played_case.fingerprint_mismatch",
    reason: "stored_identity_mismatch",
    operation: "decision",
  }, { identity, scope, sink: parsedSink(emitted) });
  observeOperationalEventCore({
    ...replayFailure,
    eventName: "d1.operation",
    reason: "timeout",
    operation: "read",
  }, { identity, scope, sink: parsedSink(emitted) });

  assert.equal(breaker.isOpen(), true);
  assert.deepEqual(scope.queuedEvents, []);
  flushOperationalTelemetryScope(scope);
  await Promise.all(deferred);

  assert.equal(recorder.prepared.length, 0);
  assert.deepEqual(recorder.batchSizes, []);
  assert.deepEqual(emitted.map(({ eventName }) => eventName), [
    "replay.internal_failure",
    "played_case.fingerprint_mismatch",
    "d1.operation",
  ]);
});
