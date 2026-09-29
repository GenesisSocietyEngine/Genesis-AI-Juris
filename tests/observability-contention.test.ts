import assert from "node:assert/strict";
import test from "node:test";
import {
  type ObservabilityEventInput,
  type ObservabilityReleaseIdentity,
} from "../app/observability";
import { runObservedD1Operation } from "../app/observed-d1-operation";
import { type OperationalEventDatabase } from "../app/operational-events";
import {
  createOperationalTelemetryCircuitBreaker,
  createOperationalTelemetryScope,
  flushOperationalTelemetryScope,
  observeOperationalEventCore,
  observeWorkerRequestEventCore,
} from "../app/server-observability-core";
import {
  runObservedWorkerRequest,
  type WorkerRequestLifecycleTelemetry,
} from "../worker/request-lifecycle";

const identity: ObservabilityReleaseIdentity = {
  deploymentVersion: "v53-production",
  webCommit: "a".repeat(40),
  bundleRevision: 14,
  runtimeRevision: "canonical-v14",
  playedCaseSchemaRevision: 2,
};

function syntheticRequestId(index: number) {
  return `${index.toString(16).padStart(8, "0")}-e29b-41d4-a716-${index.toString(16).padStart(12, "0")}`;
}

function forbiddenTelemetryDatabase() {
  let prepareCalls = 0;
  let batchCalls = 0;
  const database = {
    prepare() {
      prepareCalls += 1;
      throw new Error("Request telemetry must never prepare a product-D1 statement.");
    },
    async batch() {
      batchCalls += 1;
      throw new Error("Request telemetry must never batch a product-D1 mutation.");
    },
  } as unknown as OperationalEventDatabase;
  return {
    database,
    counts: () => ({ prepareCalls, batchCalls }),
  };
}

test("10,000 production-lifecycle public, asset, 404, and anonymous requests perform zero product-D1 work", async () => {
  const forbidden = forbiddenTelemetryDatabase();
  const breaker = createOperationalTelemetryCircuitBreaker();
  const scopes = new Map<string, ReturnType<typeof createOperationalTelemetryScope>>();
  let platformLogCount = 0;
  const variants: Array<{
    url: string;
    status: 200 | 401 | 404;
    anonymousSession: boolean;
  }> = [
    { url: "https://juris.test/", status: 200, anonymousSession: false },
    { url: "https://juris.test/assets/app.js", status: 200, anonymousSession: false },
    { url: "https://juris.test/missing", status: 404, anonymousSession: false },
    { url: "https://juris.test/api/play-sessions", status: 401, anonymousSession: true },
  ];
  const telemetry: WorkerRequestLifecycleTelemetry = {
    begin(requestId) {
      scopes.set(requestId, createOperationalTelemetryScope({
        database: forbidden.database,
        circuitBreaker: breaker,
        defer() {
          throw new Error("An empty request scope must not call waitUntil.");
        },
      }));
    },
    finish(requestId) {
      const scope = scopes.get(requestId);
      if (scope) flushOperationalTelemetryScope(scope);
      scopes.delete(requestId);
    },
    emit(input) {
      observeWorkerRequestEventCore(input, {
        identity,
        sink() { platformLogCount += 1; },
      });
    },
  };

  for (let index = 0; index < 10_000; index += 1) {
    const requestId = syntheticRequestId(index);
    const variant = variants[index % variants.length];
    const response = await runObservedWorkerRequest(new Request(variant.url), {
      telemetry,
      uuid: () => requestId,
      async dispatch(observedRequest) {
        if (variant.anonymousSession) {
          const scope = scopes.get(observedRequest.headers.get("X-Request-ID") ?? "");
          assert.ok(scope);
          observeOperationalEventCore({
            requestId,
            eventName: "session.load",
            route: "play_sessions",
            outcome: "expected_rejection",
            reason: "auth_required",
            responseClass: "4xx",
            operation: "load",
            logicalRepository: "play_sessions",
          }, { identity, scope, sink() { throw new Error("Anonymous session outcomes are not product anomaly logs."); } });
        }
        return new Response(null, { status: variant.status });
      },
    });
    assert.equal(response.status, variant.status);
  }

  assert.equal(platformLogCount, 10_000);
  assert.equal(scopes.size, 0);
  assert.deepEqual(forbidden.counts(), { prepareCalls: 0, batchCalls: 0 });
});

test("the defensive product observer also refuses Worker events any D1 path", () => {
  const forbidden = forbiddenTelemetryDatabase();
  const scope = createOperationalTelemetryScope({
    database: forbidden.database,
    circuitBreaker: createOperationalTelemetryCircuitBreaker(),
  });
  const observed = observeOperationalEventCore({
    requestId: syntheticRequestId(20_000),
    eventName: "worker.exception",
    route: "other",
    outcome: "internal_failure",
    reason: "handler_exception",
    responseClass: "exception",
    operation: "request",
    logicalRepository: "none",
    occurredAt: "2026-08-30T12:00:00.000Z",
  }, { identity, scope, sink() {} });
  flushOperationalTelemetryScope(scope);

  assert.equal(observed?.eventName, "worker.exception");
  assert.deepEqual(forbidden.counts(), { prepareCalls: 0, batchCalls: 0 });
});

test("public catalog misses, mismatches, and internal anomalies are log-only", () => {
  const forbidden = forbiddenTelemetryDatabase();
  const breaker = createOperationalTelemetryCircuitBreaker();
  let anomalyLogs = 0;
  let requestLogs = 0;
  const anomalies: Array<Omit<ObservabilityEventInput, "requestId">> = [
    {
      eventName: "historical_bundle.lookup_miss",
      route: "catalog",
      outcome: "expected_rejection",
      reason: "case_unavailable",
      responseClass: "4xx",
      operation: "read",
      logicalRepository: "case_versions",
    },
    {
      eventName: "historical_bundle.lookup_miss",
      route: "catalog",
      outcome: "expected_rejection",
      reason: "version_unavailable",
      responseClass: "4xx",
      operation: "read",
      logicalRepository: "case_versions",
    },
    {
      eventName: "historical_bundle.lookup_miss",
      route: "catalog",
      outcome: "internal_failure",
      reason: "stored_version_unavailable",
      responseClass: "4xx",
      operation: "read",
      logicalRepository: "case_versions",
    },
    {
      eventName: "historical_bundle.lookup_miss",
      route: "catalog",
      outcome: "internal_failure",
      reason: "manifest_integrity",
      responseClass: "4xx",
      operation: "read",
      logicalRepository: "case_versions",
    },
    {
      eventName: "played_case.fingerprint_mismatch",
      route: "catalog",
      outcome: "expected_rejection",
      reason: "requested_identity_mismatch",
      responseClass: "2xx",
      operation: "read",
      logicalRepository: "case_versions",
    },
  ];

  for (const [index, anomaly] of anomalies.entries()) {
    const requestId = syntheticRequestId(21_000 + index);
    const scope = createOperationalTelemetryScope({
      database: forbidden.database,
      circuitBreaker: breaker,
    });
    observeOperationalEventCore({
      ...anomaly,
      requestId,
      occurredAt: "2026-08-30T12:00:00.000Z",
    }, { identity, scope, sink() { anomalyLogs += 1; } });
    observeWorkerRequestEventCore({
      requestId,
      eventName: "worker.request",
      route: "catalog",
      outcome: anomaly.responseClass === "2xx" ? "success" : "expected_rejection",
      reason: anomaly.responseClass === "2xx" ? "completed" : "client_response",
      responseClass: anomaly.responseClass === "2xx" ? "2xx" : "4xx",
      operation: "request",
      logicalRepository: "none",
      occurredAt: "2026-08-30T12:00:00.000Z",
    }, { identity, sink() { requestLogs += 1; } });
    flushOperationalTelemetryScope(scope);
    assert.equal(scope.queuedEvents.length, 0);
  }

  assert.equal(anomalyLogs, anomalies.length);
  assert.equal(requestLogs, anomalies.length);
  assert.deepEqual(forbidden.counts(), { prepareCalls: 0, batchCalls: 0 });
});

test("anonymous play-session 401 records only the Worker request log", () => {
  const forbidden = forbiddenTelemetryDatabase();
  const requestId = syntheticRequestId(22_000);
  const scope = createOperationalTelemetryScope({
    database: forbidden.database,
    circuitBreaker: createOperationalTelemetryCircuitBreaker(),
  });
  let productLogs = 0;
  let requestLogs = 0;

  observeOperationalEventCore({
    requestId,
    eventName: "session.load",
    route: "play_sessions",
    outcome: "expected_rejection",
    reason: "auth_required",
    responseClass: "4xx",
    operation: "load",
    logicalRepository: "play_sessions",
    occurredAt: "2026-08-30T12:00:00.000Z",
  }, { identity, scope, sink() { productLogs += 1; } });
  observeWorkerRequestEventCore({
    requestId,
    eventName: "worker.request",
    route: "play_sessions",
    outcome: "expected_rejection",
    reason: "client_response",
    responseClass: "4xx",
    operation: "request",
    logicalRepository: "none",
    occurredAt: "2026-08-30T12:00:00.000Z",
  }, { identity, sink() { requestLogs += 1; } });
  flushOperationalTelemetryScope(scope);

  assert.equal(productLogs, 0);
  assert.equal(requestLogs, 1);
  assert.deepEqual(forbidden.counts(), { prepareCalls: 0, batchCalls: 0 });
});

interface ProductStatement {
  sql: string;
  values: unknown[];
}

function transcriptDatabase() {
  const statements: ProductStatement[] = [];
  let telemetryPrepareCalls = 0;
  let telemetryBatchCalls = 0;
  const database = {
    prepare(sql: string) {
      if (/operational_events/u.test(sql)) telemetryPrepareCalls += 1;
      const record = { sql: sql.trim().replace(/\s+/gu, " "), values: [] as unknown[] };
      const statement = {
        bind(...values: unknown[]) {
          record.values = values;
          return statement;
        },
        async all() {
          statements.push(record);
          return { results: [{ ok: 1 }] };
        },
      };
      return statement;
    },
    async batch() {
      telemetryBatchCalls += 1;
      throw new Error("Valid product operations must not schedule telemetry mutations.");
    },
  } as unknown as OperationalEventDatabase;
  return {
    database,
    statements,
    counts: () => ({ telemetryPrepareCalls, telemetryBatchCalls }),
  };
}

async function validOperationTranscript(requestTelemetryEnabled: boolean) {
  const recorder = transcriptDatabase();
  const breaker = createOperationalTelemetryCircuitBreaker();
  let requestLogs = 0;
  const operations = [
    { sql: "SELECT email FROM users WHERE email = ?", value: "fixture@example.test", route: "auth" as const, repository: null },
    { sql: "SELECT session_key FROM play_sessions WHERE user_email = ?", value: "fixture@example.test", route: "play_sessions" as const, repository: "play_sessions" as const },
    { sql: "SELECT version FROM case_versions WHERE case_id = ?", value: "fixture_case", route: "catalog" as const, repository: "case_versions" as const },
  ];

  for (const [index, operation] of operations.entries()) {
    const requestId = syntheticRequestId(30_000 + index);
    const scope = createOperationalTelemetryScope({
      database: recorder.database,
      circuitBreaker: breaker,
    });
    const productStatement = () => recorder.database.prepare(operation.sql).bind(operation.value).all();
    if (operation.repository) {
      await runObservedD1Operation(requestTelemetryEnabled
        ? (input) => observeOperationalEventCore({
          requestId,
          route: operation.route,
          ...input,
        }, {
          identity,
          scope,
          sink() { throw new Error("Routine D1 successes are not collected."); },
        })
        : undefined, {
        operation: "read",
        logicalRepository: operation.repository,
      }, productStatement);
    } else {
      await productStatement();
    }
    if (requestTelemetryEnabled) {
      observeWorkerRequestEventCore({
        requestId,
        eventName: "worker.request",
        route: operation.route,
        outcome: "success",
        reason: "completed",
        responseClass: "2xx",
        operation: "request",
        logicalRepository: "none",
        occurredAt: "2026-08-30T12:00:00.000Z",
      }, { identity, sink() { requestLogs += 1; } });
    }
    flushOperationalTelemetryScope(scope);
  }
  return {
    statements: recorder.statements,
    counts: recorder.counts(),
    requestLogs,
  };
}

test("valid auth, session, and catalog statements are identical with request telemetry on or off", async () => {
  const disabled = await validOperationTranscript(false);
  const enabled = await validOperationTranscript(true);

  assert.deepEqual(enabled.statements, disabled.statements);
  assert.deepEqual(enabled.counts, { telemetryPrepareCalls: 0, telemetryBatchCalls: 0 });
  assert.deepEqual(disabled.counts, { telemetryPrepareCalls: 0, telemetryBatchCalls: 0 });
  assert.equal(enabled.requestLogs, 3);
  assert.equal(disabled.requestLogs, 0);
});

test("production D1 wrapper preserves exact results and errors when its observer throws", async () => {
  const result = { exact: "product-result" };
  let observerCalls = 0;
  let operationCalls = 0;
  const throwingObserver = () => {
    observerCalls += 1;
    throw new Error("observer unavailable");
  };
  const returned = await runObservedD1Operation(throwingObserver, {
    operation: "read",
    logicalRepository: "play_sessions",
  }, async () => {
    operationCalls += 1;
    return result;
  });
  assert.equal(returned, result);

  const productError = new Error("exact product D1 failure");
  let caught: unknown;
  try {
    await runObservedD1Operation(throwingObserver, {
      operation: "read",
      logicalRepository: "case_versions",
    }, async () => {
      operationCalls += 1;
      throw productError;
    });
  } catch (error) {
    caught = error;
  }
  assert.equal(caught, productError);
  assert.equal(observerCalls, 2);
  assert.equal(operationCalls, 2);

  const hostileError = Object.defineProperty(new Error(), "message", {
    get() { throw new Error("classification getter failed"); },
  });
  caught = undefined;
  try {
    await runObservedD1Operation(undefined, {
      operation: "read",
      logicalRepository: "cases",
    }, async () => { throw hostileError; });
  } catch (error) {
    caught = error;
  }
  assert.equal(caught, hostileError);
});

function contentionDatabase(operationCount: number, capacity: number) {
  let arrivals = 0;
  let releaseBarrier!: () => void;
  const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });
  let active = 0;
  let maxActive = 0;
  let telemetryPrepareCalls = 0;
  let telemetryBatchCalls = 0;
  const statements: ProductStatement[] = [];
  const database = {
    prepare(sql: string) {
      if (/operational_events/u.test(sql)) telemetryPrepareCalls += 1;
      const record = { sql: sql.trim().replace(/\s+/gu, " "), values: [] as unknown[] };
      const statement = {
        bind(...values: unknown[]) {
          record.values = values;
          return statement;
        },
        async all() {
          arrivals += 1;
          if (arrivals === operationCount) releaseBarrier();
          await barrier;
          active += 1;
          maxActive = Math.max(maxActive, active);
          const busy = active > capacity;
          await new Promise<void>((resolve) => setImmediate(resolve));
          active -= 1;
          statements.push(record);
          if (busy) throw new Error("deterministic database is busy");
          return { results: [{ ok: 1 }] };
        },
      };
      return statement;
    },
    async batch() {
      telemetryBatchCalls += 1;
      throw new Error("Request logging must not mutate the contention database.");
    },
  } as unknown as OperationalEventDatabase;
  return {
    database,
    statements,
    metrics: () => ({ maxActive, telemetryPrepareCalls, telemetryBatchCalls }),
  };
}

async function concurrentProductLoad(requestTelemetryEnabled: boolean) {
  const operationCount = 1_000;
  const capacity = 32;
  const recorder = contentionDatabase(operationCount, capacity);
  const breaker = createOperationalTelemetryCircuitBreaker();
  let requestLogs = 0;
  let anomalyLogs = 0;
  const outcomes = new Array<"success" | "busy">(operationCount);

  await Promise.all(Array.from({ length: operationCount }, async (_, index) => {
    const requestId = syntheticRequestId(40_000 + index);
    const scope = createOperationalTelemetryScope({
      database: recorder.database,
      circuitBreaker: breaker,
    });
    try {
      await runObservedD1Operation(requestTelemetryEnabled
        ? (input) => observeOperationalEventCore({
          requestId,
          route: "play_sessions",
          ...input,
        }, {
          identity,
          scope,
          sink() { anomalyLogs += 1; },
        })
        : undefined, {
        operation: "read",
        logicalRepository: "play_sessions",
      }, () => recorder.database.prepare("SELECT session_key FROM play_sessions WHERE user_email = ?")
        .bind(`fixture-${index.toString().padStart(4, "0")}@example.test`)
        .all());
      outcomes[index] = "success";
    } catch (error) {
      if (!/busy|locked/iu.test(error instanceof Error ? error.message : "")) throw error;
      outcomes[index] = "busy";
    }
    if (requestTelemetryEnabled) {
      const busy = outcomes[index] === "busy";
      observeWorkerRequestEventCore({
        requestId,
        eventName: "worker.request",
        route: "play_sessions",
        outcome: busy ? "internal_failure" : "success",
        reason: busy ? "server_error" : "completed",
        responseClass: busy ? "5xx" : "2xx",
        operation: "request",
        logicalRepository: "none",
        occurredAt: "2026-08-30T12:00:00.000Z",
      }, { identity, sink() { requestLogs += 1; } });
    }
    flushOperationalTelemetryScope(scope);
  }));

  const sortedStatements = [...recorder.statements].sort((left, right) => (
    String(left.values[0]).localeCompare(String(right.values[0]))
  ));
  return {
    productStatements: sortedStatements,
    outcomes,
    busyCount: outcomes.filter((outcome) => outcome === "busy").length,
    counts: recorder.metrics(),
    requestLogs,
    anomalyLogs,
  };
}

test("barrier-synchronized 1,000-operation load has no request-telemetry contention regression", async () => {
  const disabled = await concurrentProductLoad(false);
  const enabled = await concurrentProductLoad(true);

  assert.deepEqual(enabled.productStatements, disabled.productStatements);
  assert.deepEqual(enabled.outcomes, disabled.outcomes);
  assert.equal(disabled.productStatements.length, 1_000);
  assert.equal(enabled.busyCount, disabled.busyCount);
  assert.equal(disabled.busyCount, 968);
  assert.equal(disabled.counts.maxActive, 1_000);
  assert.equal(enabled.counts.maxActive, 1_000);
  assert.deepEqual(disabled.counts, {
    maxActive: 1_000,
    telemetryPrepareCalls: 0,
    telemetryBatchCalls: 0,
  });
  assert.deepEqual(enabled.counts, {
    maxActive: 1_000,
    telemetryPrepareCalls: 0,
    telemetryBatchCalls: 0,
  });
  assert.equal(disabled.requestLogs, 0);
  assert.equal(enabled.requestLogs, 1_000);
  assert.equal(disabled.anomalyLogs, 0);
  assert.equal(enabled.anomalyLogs, 968);
});
