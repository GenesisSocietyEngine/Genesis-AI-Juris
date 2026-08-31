import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  D1_FAILURE_LOG_CONFIGURATION,
  OPERATIONAL_ALERT_RUNBOOK,
  REQUEST_HEALTH_CONFIGURATION,
} from "../app/operations-runbook";
import {
  OBSERVABILITY_RESPONSE_CLASSES,
  OBSERVABILITY_ROUTES,
  aggregateObservabilityBuckets,
  evaluatePersistedProductAlerts,
  type ObservabilityAggregateBucket,
} from "../app/observability";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("the admin operations endpoint separates platform logs from D1-backed anomaly health", () => {
  const route = source("app/api/admin/operations/route.ts");
  assert.match(route, /getChatGPTUser\(\)/);
  assert.match(route, /isPlatformAdmin\(identity\)/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(route, /readOperationalAggregateSnapshot/);
  assert.match(route, /readOperationalAggregate/);
  assert.match(route, /evaluatePersistedProductAlerts/);
  assert.doesNotMatch(route, /evaluateObservabilityAlerts/);
  assert.match(route, /REQUEST_HEALTH_CONFIGURATION/);
  assert.match(route, /requestHealth: REQUEST_HEALTH_CONFIGURATION/);
  assert.match(route, /d1FailureHealth: D1_FAILURE_LOG_CONFIGURATION/);
  assert.match(route, /state: "exact_anomalies_only"/);
  assert.match(route, /successMetrics: "not_collected"/);
  assert.doesNotMatch(route, /aggregate:\s*overview\.aggregate/u);
  assert.match(route, /aggregate:\s*projectRetainedAnomalyAggregate\(overview\.aggregate\)/u);
  const aggregateProjection = route.match(
    /function projectRetainedAnomalyAggregate[\s\S]*?return \{([\s\S]*?)\n\s*\};\s*\}/u,
  );
  assert.ok(aggregateProjection);
  const projectedAggregateFields = [...aggregateProjection[1].matchAll(
    /^\s+([A-Za-z][A-Za-z0-9]*):\s*aggregate\.\1,\s*$/gmu,
  )].map((match) => match[1]);
  assert.deepEqual(projectedAggregateFields, [
    "replayInternalFailures",
    "expectedRevisionMismatches",
    "expectedFingerprintMismatches",
    "internalRevisionMismatches",
    "internalFingerprintMismatches",
    "historicalMisses",
    "internalHistoricalMisses",
  ]);
  assert.deepEqual(projectedAggregateFields.filter((field) => (
    /^(?:worker|d1|replay(?:Attempts|Successes|ExpectedRejections|Latency))/u.test(field)
  )), []);
  const d1Scope = route.match(/const D1_BACKED_SIGNAL_SCOPE = \[([\s\S]*?)\] as const;/);
  const logScope = route.match(/const PLATFORM_LOG_SIGNAL_SCOPE = \[([\s\S]*?)\] as const;/);
  assert.ok(d1Scope);
  assert.ok(logScope);
  for (const signal of ["replay_internal_failure", "historical_bundle_lookup_miss", "revision_fingerprint_rejection"]) {
    assert.match(d1Scope[1], new RegExp(`"${signal}"`));
  }
  for (const signal of ["worker_request_outcome_latency_route_response_class", "worker_exception", "d1_busy_timeout_failure", "product_anomaly_mirror"]) {
    assert.match(logScope[1], new RegExp(`"${signal}"`));
  }
  assert.doesNotMatch(route, /SELECT\s+\*/i);
  assert.doesNotMatch(route, /requestId:\s*overview/i);
});

test("the operations dashboard never presents missing request-log data as zero health", () => {
  const dashboard = source("app/OperationsDashboard.tsx");
  for (const state of ["current", "no_data", "partial", "stale"]) assert.match(dashboard, new RegExp(state));
  for (const field of [
    "replayInternalFailures", "expectedRevisionMismatches", "expectedFingerprintMismatches", "internalRevisionMismatches",
    "internalFingerprintMismatches", "historicalMisses", "internalHistoricalMisses",
  ]) assert.match(dashboard, new RegExp(field));
  assert.match(dashboard, /\/api\/admin\/operations/);
  assert.match(dashboard, /credentials: "same-origin"/);
  assert.match(dashboard, /cache: "no-store"/);
  assert.match(dashboard, /External notification unavailable/);
  assert.match(dashboard, /never create a product-D1 telemetry write/);
  assert.match(dashboard, /does not fabricate request totals, rates, latency, 4xx classifications, 5xx counts, or exception counts/);
  assert.match(dashboard, /never written back to product D1/);
  assert.match(dashboard, /Instrumented D1 operation failures/);
  assert.match(dashboard, /not platform-wide and does not cover auth, users, or all D1 operations/);
  assert.match(dashboard, /d1FailureHealth\.instrumentedRoutes\.join\(", "\)/);
  assert.match(dashboard, /d1FailureHealth\.instrumentedLogicalRepositories\.join\(", "\)/);
  assert.match(dashboard, /d1FailureHealth\.platformWideCoverage \? "Yes" : "No"/);
  assert.doesNotMatch(dashboard, /provides platform-wide D1 coverage|all D1 operations are instrumented/u);
  assert.match(
    dashboard,
    /Attempt-rate and success-latency metrics are intentionally not collected/,
  );
  assert.match(dashboard, /Manual platform configuration required/);
  assert.match(dashboard, /Exact persisted-anomaly thresholds/);
  assert.doesNotMatch(dashboard, /aggregate\.worker/u);
  assert.doesNotMatch(dashboard, /Request volume|Auth 4xx|Asset 4xx|Application 4xx/u);
});

test("Worker route-by-response-class aggregation remains fixed and privacy-safe for platform-log fixtures", () => {
  const buckets: ObservabilityAggregateBucket[] = [
    { eventName: "worker.request", route: "auth", outcome: "expected_rejection", reason: "client_response", responseClass: "4xx", latencyMs: 20, count: 7 },
    { eventName: "worker.request", route: "assets", outcome: "expected_rejection", reason: "client_response", responseClass: "4xx", latencyMs: 15, count: 4 },
    { eventName: "worker.request", route: "catalog", outcome: "expected_rejection", reason: "client_response", responseClass: "4xx", latencyMs: 30, count: 3 },
    { eventName: "worker.request", route: "root", outcome: "success", reason: "completed", responseClass: "2xx", latencyMs: 10, count: 10 },
    { eventName: "d1.operation", route: "auth", outcome: "internal_failure", reason: "timeout", responseClass: "4xx", latencyMs: 50, count: 99 },
    { eventName: "worker.request", route: "auth/private?email=secret", outcome: "expected_rejection", reason: "client_response", responseClass: "4xx", latencyMs: 1, count: 100 } as unknown as ObservabilityAggregateBucket,
  ];
  const aggregate = aggregateObservabilityBuckets(buckets);
  assert.deepEqual(Object.keys(aggregate.workerByRouteAndResponseClass), [...OBSERVABILITY_ROUTES]);
  for (const route of OBSERVABILITY_ROUTES) {
    assert.deepEqual(Object.keys(aggregate.workerByRouteAndResponseClass[route]), [...OBSERVABILITY_RESPONSE_CLASSES]);
  }
  assert.equal(aggregate.workerByRouteAndResponseClass.auth["4xx"], 7);
  assert.equal(aggregate.workerByRouteAndResponseClass.assets["4xx"], 4);
  assert.equal(aggregate.workerByRouteAndResponseClass.catalog["4xx"], 3);
  assert.equal(aggregate.worker4xx, 14);
  assert.equal(aggregate.workerRequests, 24);
  assert.doesNotMatch(JSON.stringify(aggregate.workerByRouteAndResponseClass), /private|email|secret/u);
});

test("the D1-backed evaluator excludes thresholds whose complete input exists only in platform logs", () => {
  const empty = aggregateObservabilityBuckets([]);
  const platformOnly = aggregateObservabilityBuckets([
    { eventName: "worker.exception", route: "root", outcome: "internal_failure", reason: "handler_exception", responseClass: "exception", latencyMs: 10, count: 1 },
    { eventName: "worker.request", route: "root", outcome: "internal_failure", reason: "server_error", responseClass: "5xx", latencyMs: 10, count: 3 },
    { eventName: "d1.operation", route: "play_sessions", outcome: "success", reason: "completed", responseClass: "none", latencyMs: 900, count: 20 },
    { eventName: "replay.start", route: "play_sessions", outcome: "started", reason: "state_validation", responseClass: "none", latencyMs: 0, count: 20 },
    { eventName: "replay.internal_failure", route: "play_sessions", outcome: "internal_failure", reason: "runtime_exception", responseClass: "none", latencyMs: 10, count: 1 },
  ]);
  assert.deepEqual(evaluatePersistedProductAlerts({
    fiveMinutes: platformOnly,
    tenMinutes: platformOnly,
    fifteenMinutes: platformOnly,
  }), []);

  const exactAnomalies = aggregateObservabilityBuckets([
    { eventName: "d1.operation", route: "play_sessions", outcome: "internal_failure", reason: "timeout", responseClass: "none", latencyMs: 10, count: 3 },
    { eventName: "replay.internal_failure", route: "play_sessions", outcome: "internal_failure", reason: "runtime_exception", responseClass: "none", latencyMs: 10, count: 3 },
    { eventName: "historical_bundle.lookup_miss", route: "play_sessions", outcome: "internal_failure", reason: "stored_version_unavailable", responseClass: "4xx", latencyMs: null, count: 1 },
  ]);
  assert.deepEqual(evaluatePersistedProductAlerts({
    fiveMinutes: exactAnomalies,
    tenMinutes: empty,
    fifteenMinutes: exactAnomalies,
  }).map((alert) => alert.id), ["historical_lookup_miss", "replay_internal_failure"]);
});

test("alert ownership and unavailable external notification are explicit", () => {
  assert.deepEqual(Object.keys(OPERATIONAL_ALERT_RUNBOOK).sort(), [
    "d1_failures",
    "d1_latency_p95",
    "expected_identity_rejections",
    "historical_lookup_miss",
    "replay_internal_failure",
    "worker_5xx",
    "worker_exception",
  ]);
  for (const entry of Object.values(OPERATIONAL_ALERT_RUNBOOK)) {
    assert.ok(entry.threshold.length >= 20);
    assert.ok(entry.owner.length >= 10);
    assert.ok(entry.action.length >= 30);
    assert.match(entry.rollbackCriterion, /Site version 52|No automatic rollback/);
    assert.equal(entry.externalNotification, "unavailable");
  }
  assert.equal(OPERATIONAL_ALERT_RUNBOOK.worker_exception.source, "platform_logs");
  assert.equal(OPERATIONAL_ALERT_RUNBOOK.worker_5xx.evaluation, "manual_platform_configuration_required");
  assert.equal(OPERATIONAL_ALERT_RUNBOOK.d1_latency_p95.source, "not_collected");
  assert.equal(OPERATIONAL_ALERT_RUNBOOK.d1_latency_p95.evaluation, "not_collected");
  assert.equal(OPERATIONAL_ALERT_RUNBOOK.d1_failures.evaluation, "manual_platform_configuration_required");
  assert.equal(OPERATIONAL_ALERT_RUNBOOK.replay_internal_failure.source, "split");
  assert.equal(REQUEST_HEALTH_CONFIGURATION.productD1Persistence, false);
  assert.equal(REQUEST_HEALTH_CONFIGURATION.state, "external_unavailable");
  assert.equal(REQUEST_HEALTH_CONFIGURATION.manualConfiguration.length, 6);
  assert.match(REQUEST_HEALTH_CONFIGURATION.manualConfiguration.join("\n"), /eventName=worker\.request/);
  assert.match(REQUEST_HEALTH_CONFIGURATION.manualConfiguration.join("\n"), /at least 20 requests/);
  assert.equal(D1_FAILURE_LOG_CONFIGURATION.productD1Persistence, false);
  assert.equal(D1_FAILURE_LOG_CONFIGURATION.coverage, "instrumented_operations_only");
  assert.equal(D1_FAILURE_LOG_CONFIGURATION.platformWideCoverage, false);
  assert.deepEqual(D1_FAILURE_LOG_CONFIGURATION.instrumentedRoutes, [
    "catalog",
    "play_sessions",
    "admin",
  ]);
  assert.deepEqual(D1_FAILURE_LOG_CONFIGURATION.instrumentedLogicalRepositories, [
    "cases",
    "case_versions",
    "play_sessions",
    "play_events",
    "operational_events",
  ]);
  assert.equal(D1_FAILURE_LOG_CONFIGURATION.manualConfiguration.length, 3);
  assert.match(D1_FAILURE_LOG_CONFIGURATION.manualConfiguration.join("\n"), /eventName=d1\.operation/);
  assert.match(D1_FAILURE_LOG_CONFIGURATION.manualConfiguration.join("\n"), /instrumented-operation coverage rather than platform-wide D1 health/);
});
