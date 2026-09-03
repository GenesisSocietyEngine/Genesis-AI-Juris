import type { ObservabilityEventV1 } from "./observability";

// These low-volume anomaly classes are emitted to structured platform logs.
// Routine request, D1, replay, and session success events are intentionally
// not collected by this product-operation path.
function isPreciseOperationalAnomaly(event: ObservabilityEventV1): boolean {
  if (event.eventName === "d1.operation") {
    return event.outcome === "internal_failure" || event.reason === "busy" || event.reason === "timeout";
  }
  return event.eventName === "replay.internal_failure"
    || event.eventName === "historical_bundle.lookup_miss"
    || event.eventName === "played_case.revision_mismatch"
    || event.eventName === "played_case.fingerprint_mismatch";
}

function isD1CapacityAnomaly(event: ObservabilityEventV1): boolean {
  return event.eventName === "d1.operation"
    && (event.outcome === "internal_failure" || event.reason === "busy" || event.reason === "timeout");
}

export function shouldEmitOperationalAnomaly(event: ObservabilityEventV1): boolean {
  return isPreciseOperationalAnomaly(event)
    || ((event.eventName === "session.import"
        || event.eventName === "session.load"
        || event.eventName === "session.save")
      && event.outcome === "internal_failure");
}

// Product-D1 persistence is narrower than platform logging. Public catalog
// misses/mismatches and other public-route anomalies must never create a
// telemetry mutation in the product database.
export function shouldPersistOperationalAnomaly(event: ObservabilityEventV1): boolean {
  return (event.route === "play_sessions" || event.route === "admin")
    && !isD1CapacityAnomaly(event)
    && isPreciseOperationalAnomaly(event);
}
