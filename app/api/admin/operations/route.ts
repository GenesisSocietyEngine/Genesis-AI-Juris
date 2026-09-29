import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  OBSERVABILITY_ALERT_POLICY_REVISION,
  OBSERVABILITY_RETENTION_DAYS,
  OBSERVABILITY_SCHEMA,
  classifyD1Failure,
  evaluatePersistedProductAlerts,
  type ObservabilityAggregate,
} from "../../../observability";
import {
  D1_FAILURE_LOG_CONFIGURATION,
  OPERATIONAL_ALERT_RUNBOOK,
  REQUEST_HEALTH_CONFIGURATION,
} from "../../../operations-runbook";
import {
  OBSERVABILITY_STALE_AFTER_MS,
  readOperationalAggregate,
  readOperationalAggregateSnapshot,
} from "../../../operational-events";
import { observabilityRequestId, observeOperationalEvent } from "../../../server-observability";
import { isPlatformAdmin } from "../../../server-authorization";

export const dynamic = "force-dynamic";

const OVERVIEW_WINDOW_MS = 60 * 60 * 1_000;
const D1_BACKED_SIGNAL_SCOPE = [
  "replay_internal_failure",
  "historical_bundle_lookup_miss",
  "revision_fingerprint_rejection",
] as const;
const PLATFORM_LOG_SIGNAL_SCOPE = [
  "worker_request_outcome_latency_route_response_class",
  "worker_exception",
  "d1_busy_timeout_failure",
  "product_anomaly_mirror",
] as const;
const UNRECORDED_SUCCESS_SCOPE = [
  "successful_d1_reads",
  "successful_replay_and_session_operations",
] as const;

type RetainedAnomalyAggregate = Pick<
  ObservabilityAggregate,
  | "replayInternalFailures"
  | "expectedRevisionMismatches"
  | "expectedFingerprintMismatches"
  | "internalRevisionMismatches"
  | "internalFingerprintMismatches"
  | "historicalMisses"
  | "internalHistoricalMisses"
>;

function projectRetainedAnomalyAggregate(aggregate: ObservabilityAggregate): RetainedAnomalyAggregate {
  return {
    replayInternalFailures: aggregate.replayInternalFailures,
    expectedRevisionMismatches: aggregate.expectedRevisionMismatches,
    expectedFingerprintMismatches: aggregate.expectedFingerprintMismatches,
    internalRevisionMismatches: aggregate.internalRevisionMismatches,
    internalFingerprintMismatches: aggregate.internalFingerprintMismatches,
    historicalMisses: aggregate.historicalMisses,
    internalHistoricalMisses: aggregate.internalHistoricalMisses,
  };
}

function before(now: Date, milliseconds: number) {
  return new Date(now.valueOf() - milliseconds).toISOString();
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Vary: "Cookie",
    },
  });
}

export async function GET(request: Request) {
  const identity = await getChatGPTUser();
  if (!identity || !isPlatformAdmin(identity)) {
    return privateJson({ error: "Administrator access is required." }, 403);
  }

  const requestId = observabilityRequestId(request);
  const bindings = env as unknown as { DB?: D1Database };
  if (!bindings.DB) {
    observeOperationalEvent({
      requestId,
      eventName: "d1.operation",
      route: "admin",
      outcome: "internal_failure",
      reason: "unavailable",
      operation: "read",
      logicalRepository: "operational_events",
    });
    return privateJson({ state: "partial", error: "Operational telemetry is temporarily unavailable." }, 503);
  }

  const now = new Date();
  const generatedAt = now.toISOString();
  const startedAt = performance.now();
  try {
    const [overview, fiveMinutes, tenMinutes, fifteenMinutes] = await Promise.all([
      readOperationalAggregateSnapshot(bindings.DB, before(now, OVERVIEW_WINDOW_MS), generatedAt),
      readOperationalAggregate(bindings.DB, before(now, 5 * 60 * 1_000), generatedAt),
      readOperationalAggregate(bindings.DB, before(now, 10 * 60 * 1_000), generatedAt),
      readOperationalAggregate(bindings.DB, before(now, 15 * 60 * 1_000), generatedAt),
    ]);
    const alertWindows = { fiveMinutes, tenMinutes, fifteenMinutes };
    const alerts = evaluatePersistedProductAlerts(alertWindows).map((alert) => ({
      ...alert,
      ...OPERATIONAL_ALERT_RUNBOOK[alert.id],
    }));
    observeOperationalEvent({
      requestId,
      eventName: "d1.operation",
      route: "admin",
      outcome: "success",
      reason: "completed",
      latencyMs: Math.round(performance.now() - startedAt),
      operation: "read",
      logicalRepository: "operational_events",
    });
    return privateJson({
      schema: OBSERVABILITY_SCHEMA,
      policyRevision: OBSERVABILITY_ALERT_POLICY_REVISION,
      generatedAt,
      overviewWindowMinutes: OVERVIEW_WINDOW_MS / 60_000,
      retentionDays: OBSERVABILITY_RETENTION_DAYS,
      requestHealth: REQUEST_HEALTH_CONFIGURATION,
      productHealth: {
        source: "product_d1",
        state: "exact_anomalies_only",
        externalNotification: "unavailable",
        d1BackedSignalScope: D1_BACKED_SIGNAL_SCOPE,
        platformLogOnlySignalScope: PLATFORM_LOG_SIGNAL_SCOPE,
        d1FailureHealth: D1_FAILURE_LOG_CONFIGURATION,
        unrecordedSuccessScope: UNRECORDED_SUCCESS_SCOPE,
        successMetrics: "not_collected",
      },
      staleAfterMinutes: OBSERVABILITY_STALE_AFTER_MS / 60_000,
      state: overview.state,
      fromInclusive: overview.fromInclusive,
      toExclusive: overview.toExclusive,
      aggregate: projectRetainedAnomalyAggregate(overview.aggregate),
      latestEvent: overview.latestEvent ? {
        eventName: overview.latestEvent.event_name,
        route: overview.latestEvent.route,
        outcome: overview.latestEvent.outcome,
        occurredAt: overview.latestEvent.occurred_at,
      } : null,
      release: overview.release,
      alerts,
      alertPolicy: OPERATIONAL_ALERT_RUNBOOK,
    });
  } catch (error) {
    const failure = classifyD1Failure(error);
    observeOperationalEvent({
      requestId,
      eventName: "d1.operation",
      route: "admin",
      outcome: failure.outcome,
      reason: failure.reason,
      latencyMs: Math.round(performance.now() - startedAt),
      operation: "read",
      logicalRepository: "operational_events",
    });
    return privateJson({ state: "partial", error: "Operational telemetry is temporarily unavailable." }, 503);
  }
}
