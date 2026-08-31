import type { ObservabilityAlert } from "./observability";

export type OperationalAlertSource = "platform_logs" | "product_d1" | "split" | "not_collected";
export type OperationalAlertEvaluation = "active_in_admin_dashboard"
  | "manual_platform_configuration_required"
  | "dashboard_with_platform_fallback"
  | "dashboard_absolute_rate_not_collected"
  | "not_collected";

export interface OperationalAlertRunbookEntry {
  label: string;
  threshold: string;
  owner: string;
  action: string;
  rollbackCriterion: string;
  source: OperationalAlertSource;
  evaluation: OperationalAlertEvaluation;
  externalNotification: "unavailable";
}

export const REQUEST_HEALTH_CONFIGURATION = Object.freeze({
  source: "worker_platform_logs" as const,
  state: "external_unavailable" as const,
  exactQueryAvailable: false,
  externalNotification: "unavailable" as const,
  productD1Persistence: false,
  manualConfiguration: [
    "Enable Workers Logs for the deployed Site Worker and retain invocation plus structured console events.",
    "Query eventName=worker.exception over a rolling 5-minute window and alert on any matching event.",
    "Query eventName=worker.request with responseClass=5xx and alert at 3 or more matches in 5 minutes.",
    "For the rate leg, count every worker.request over 10 minutes, require at least 20 requests, and alert when responseClass=5xx is at least 2% of that exact count.",
    "Break down responseClass=4xx by normalized route auth, assets, and all remaining application routes; never query raw URLs or request content.",
    "Route notifications to Platform on-call and verify the queries in a non-production deployment before marking external notification active.",
  ] as const,
});

export const D1_FAILURE_LOG_CONFIGURATION = Object.freeze({
  source: "worker_platform_logs" as const,
  state: "external_unavailable" as const,
  externalNotification: "unavailable" as const,
  productD1Persistence: false,
  coverage: "instrumented_operations_only" as const,
  platformWideCoverage: false,
  instrumentedRoutes: ["catalog", "play_sessions", "admin"] as const,
  instrumentedLogicalRepositories: [
    "cases",
    "case_versions",
    "play_sessions",
    "play_events",
    "operational_events",
  ] as const,
  manualConfiguration: [
    "Query eventName=d1.operation over a rolling 5-minute window for instrumented routes catalog, play_sessions, or admin and logicalRepository cases, case_versions, play_sessions, play_events, or operational_events; include outcome=internal_failure, reason=busy, or reason=timeout.",
    "Alert when the exact matching count reaches 3; group only by normalized route and allowlisted logicalRepository, and label it instrumented-operation coverage rather than platform-wide D1 health.",
    "Route notifications to Platform on-call and verify the query in a non-production deployment before marking external notification active.",
  ] as const,
});

export const OPERATIONAL_ALERT_RUNBOOK: Record<ObservabilityAlert["id"], OperationalAlertRunbookEntry> = {
  worker_exception: {
    label: "Worker exception",
    threshold: "Any worker exception in 5 minutes",
    owner: "Platform on-call",
    action: "Inspect the correlated Worker event and deployment logs, then reproduce the affected coarse route.",
    rollbackCriterion: "Roll back to Site version 52 when the exception is attributable to v53 or the route cannot be stabilized promptly.",
    source: "platform_logs",
    evaluation: "manual_platform_configuration_required",
    externalNotification: "unavailable",
  },
  worker_5xx: {
    label: "Worker 5xx rate",
    threshold: "3 responses in 5 minutes, or at least 2% of 20+ requests in 10 minutes",
    owner: "Platform on-call",
    action: "Compare failing route classes with deployment logs and verify the database and upstream dependencies.",
    rollbackCriterion: "Roll back to Site version 52 when v53 causes sustained or unexplained 5xx responses.",
    source: "platform_logs",
    evaluation: "manual_platform_configuration_required",
    externalNotification: "unavailable",
  },
  d1_failures: {
    label: "D1 failures or timeouts",
    threshold: "3 D1 failures, including busy/locked or timeouts, in 5 minutes",
    owner: "Platform on-call",
    action: "Check D1 availability, busy/timeout reasons and the logical repository before retrying a safe read.",
    rollbackCriterion: "Roll back to Site version 52 if v53 query behavior is responsible; otherwise follow the D1 incident path.",
    source: "platform_logs",
    evaluation: "manual_platform_configuration_required",
    externalNotification: "unavailable",
  },
  d1_latency_p95: {
    label: "D1 latency p95",
    threshold: "Policy fixture: p95 greater than 500 ms over 15 minutes; routine success latency is not collected in v53",
    owner: "Platform on-call",
    action: "No application alert is active for this metric; inspect D1 platform service health manually without exposing SQL or record identifiers.",
    rollbackCriterion: "Roll back to Site version 52 when the latency regression is isolated to v53.",
    source: "not_collected",
    evaluation: "not_collected",
    externalNotification: "unavailable",
  },
  replay_internal_failure: {
    label: "Replay internal failures",
    threshold: "3 failures from exact retained rows in 15 minutes; the 2% of 20+ attempts rate leg is not collected in v53",
    owner: "JURIS runtime owner",
    action: "Compare the deployed runtime identity with the canonical bundle and replay a fixture-equivalent route in a non-production environment.",
    rollbackCriterion: "Roll back to Site version 52 for a v53 replay regression or any canonical-state uncertainty.",
    source: "split",
    evaluation: "dashboard_absolute_rate_not_collected",
    externalNotification: "unavailable",
  },
  historical_lookup_miss: {
    label: "Historical bundle lookup miss",
    threshold: "Any lookup miss in 15 minutes",
    owner: "JURIS release owner",
    action: "Verify the immutable catalog version and release manifest; do not substitute the current bundle for a missing historical version.",
    rollbackCriterion: "Stop the release and roll back to Site version 52 if a v53 manifest or catalog reference is missing.",
    source: "split",
    evaluation: "active_in_admin_dashboard",
    externalNotification: "unavailable",
  },
  expected_identity_rejections: {
    label: "Expected identity rejections",
    threshold: "10 revision or fingerprint rejections in 15 minutes",
    owner: "JURIS product operations",
    action: "Confirm that clients are using the current release and that expected stale-client guidance is visible.",
    rollbackCriterion: "No automatic rollback; escalate if the rejections indicate an incorrect v53 release identity.",
    source: "split",
    evaluation: "active_in_admin_dashboard",
    externalNotification: "unavailable",
  },
};
