import assert from "node:assert/strict";
import test from "node:test";
import {
  type ObservabilityEventInput,
  type ObservabilityReleaseIdentity,
} from "../app/observability";
import { type OperationalEventDatabase } from "../app/operational-events";
import {
  createOperationalTelemetryCircuitBreaker,
  createOperationalTelemetryScope,
  flushOperationalTelemetryScope,
  observeOperationalEventCore,
  observeWorkerRequestEventCore,
  type OperationalTelemetryScope,
} from "../app/server-observability-core";
import {
  runObservedWorkerRequest,
  type WorkerRequestLifecycleTelemetry,
} from "../worker/request-lifecycle";

const requestId = "550e8400-e29b-41d4-a716-446655440000";
const identity: ObservabilityReleaseIdentity = {
  deploymentVersion: "v53-production",
  webCommit: "a".repeat(40),
  bundleRevision: 14,
  runtimeRevision: "canonical-v14",
  playedCaseSchemaRevision: 2,
};

const faults = [
  "structured_sink_throw",
  "prepare_throw",
  "batch_reject",
  "d1_busy",
  "defer_throw",
] as const;
type LifecycleFault = typeof faults[number];

function lifecycleDatabase(fault: LifecycleFault) {
  let prepareCalls = 0;
  let batchCalls = 0;
  const database = {
    prepare() {
      prepareCalls += 1;
      if (fault === "prepare_throw") throw new Error("telemetry prepare failed");
      const statement = {
        bind() { return statement; },
      };
      return statement;
    },
    async batch() {
      batchCalls += 1;
      if (fault === "batch_reject") throw new Error("telemetry batch rejected");
      return [];
    },
  } as unknown as OperationalEventDatabase;
  return {
    database,
    counts: () => ({ prepareCalls, batchCalls }),
  };
}

function expectedDatabaseCounts(fault: LifecycleFault) {
  if (fault === "prepare_throw") return { prepareCalls: 1, batchCalls: 0 };
  if (fault === "batch_reject") return { prepareCalls: 2, batchCalls: 1 };
  if (fault === "d1_busy") return { prepareCalls: 0, batchCalls: 0 };
  return { prepareCalls: 2, batchCalls: 1 };
}

function lifecycleHarness(fault: LifecycleFault) {
  const recorder = lifecycleDatabase(fault);
  const breaker = createOperationalTelemetryCircuitBreaker();
  const deferred: Promise<unknown>[] = [];
  const requestEvents: string[] = [];
  let productSinkCalls = 0;
  let requestSinkCalls = 0;
  let beginCalls = 0;
  let finishCalls = 0;
  let scope: OperationalTelemetryScope | null = null;

  const telemetry: WorkerRequestLifecycleTelemetry = {
    begin() {
      beginCalls += 1;
      scope = createOperationalTelemetryScope({
        database: recorder.database,
        circuitBreaker: breaker,
        defer(promise) {
          if (fault === "defer_throw") throw new Error("waitUntil failed");
          deferred.push(promise);
        },
      });
    },
    finish() {
      finishCalls += 1;
      if (scope) flushOperationalTelemetryScope(scope);
    },
    emit(input) {
      observeWorkerRequestEventCore(input, {
        identity,
        sink(serialized) {
          requestSinkCalls += 1;
          requestEvents.push((JSON.parse(serialized) as { eventName: string }).eventName);
          if (fault === "structured_sink_throw") throw new Error("request sink failed");
        },
      });
    },
  };

  function emitProduct(input: Omit<ObservabilityEventInput, "requestId" | "route">) {
    assert.ok(scope);
    observeOperationalEventCore({
      requestId,
      route: "play_sessions",
      ...input,
    }, {
      identity,
      scope,
      sink() {
        productSinkCalls += 1;
        if (fault === "structured_sink_throw") throw new Error("product sink failed");
      },
    });
  }

  function emitFaultPath() {
    emitProduct({
      eventName: "replay.internal_failure",
      outcome: "internal_failure",
      reason: "stored_state_divergence",
      responseClass: "4xx",
      operation: "replay",
      logicalRepository: "play_sessions",
    });
    if (fault === "d1_busy") {
      emitProduct({
        eventName: "d1.operation",
        outcome: "expected_rejection",
        reason: "busy",
        responseClass: "none",
        operation: "read",
        logicalRepository: "play_sessions",
      });
    }
  }

  async function settle() {
    await Promise.all(deferred);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return {
    telemetry,
    emitFaultPath,
    settle,
    breaker,
    counts: () => ({
      ...recorder.counts(),
      beginCalls,
      finishCalls,
      productSinkCalls,
      requestSinkCalls,
      requestEvents,
    }),
  };
}

for (const fault of faults) {
  test(`production Worker lifecycle preserves the Response when ${fault}`, async () => {
    const harness = lifecycleHarness(fault);
    let observedInboundRequestId: string | null = null;
    let now = 100;
    const response = await runObservedWorkerRequest(
      new Request("https://juris.test/api/play-sessions"),
      {
        telemetry: harness.telemetry,
        uuid: () => requestId,
        now: () => { now += 5; return now; },
        async dispatch(request) {
          observedInboundRequestId = request.headers.get("X-Request-ID");
          harness.emitFaultPath();
          return new Response("unchanged-product-body", {
            status: 201,
            headers: { "X-Product-Result": "unchanged" },
          });
        },
        decorateResponse(productResponse) {
          const headers = new Headers(productResponse.headers);
          headers.set("X-Security-Decoration", "present");
          return new Response(productResponse.body, {
            status: productResponse.status,
            statusText: productResponse.statusText,
            headers,
          });
        },
      },
    );
    await harness.settle();

    assert.equal(response.status, 201);
    assert.equal(await response.text(), "unchanged-product-body");
    assert.equal(response.headers.get("X-Product-Result"), "unchanged");
    assert.equal(response.headers.get("X-Security-Decoration"), "present");
    assert.equal(response.headers.get("X-Request-ID"), requestId);
    assert.equal(observedInboundRequestId, requestId);
    assert.deepEqual(
      { prepareCalls: harness.counts().prepareCalls, batchCalls: harness.counts().batchCalls },
      expectedDatabaseCounts(fault),
    );
    assert.equal(harness.counts().beginCalls, 1);
    assert.equal(harness.counts().finishCalls, 1);
    assert.equal(harness.counts().requestSinkCalls, 1);
    assert.deepEqual(harness.counts().requestEvents, ["worker.request"]);
    assert.equal(harness.counts().productSinkCalls, fault === "d1_busy" ? 2 : 1);
    assert.equal(harness.breaker.isOpen(), fault === "prepare_throw" || fault === "batch_reject" || fault === "d1_busy");
  });

  test(`production Worker lifecycle rethrows the identical product error when ${fault}`, async () => {
    const harness = lifecycleHarness(fault);
    const productError = new Error("identical product failure");
    let caught: unknown;
    try {
      await runObservedWorkerRequest(
        new Request("https://juris.test/api/play-sessions"),
        {
          telemetry: harness.telemetry,
          uuid: () => requestId,
          async dispatch() {
            harness.emitFaultPath();
            throw productError;
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    await harness.settle();

    assert.equal(caught, productError);
    assert.deepEqual(
      { prepareCalls: harness.counts().prepareCalls, batchCalls: harness.counts().batchCalls },
      expectedDatabaseCounts(fault),
    );
    assert.equal(harness.counts().beginCalls, 1);
    assert.equal(harness.counts().finishCalls, 1);
    assert.equal(harness.counts().requestSinkCalls, 1);
    assert.deepEqual(harness.counts().requestEvents, ["worker.exception"]);
    assert.equal(harness.counts().productSinkCalls, fault === "d1_busy" ? 2 : 1);
    assert.equal(harness.breaker.isOpen(), fault === "prepare_throw" || fault === "batch_reject" || fault === "d1_busy");
  });
}
