const COUNTERS = ["replayInternalFailures", "expectedRevisionMismatches", "expectedFingerprintMismatches", "internalRevisionMismatches", "internalFingerprintMismatches", "historicalMisses", "internalHistoricalMisses"] as const;

type Snapshot = {
  schema: string;
  state: "current" | "no_data" | "partial" | "stale";
  generatedAt: string;
  fromInclusive: string;
  toExclusive: string;
  aggregate: Record<typeof COUNTERS[number], number>;
  release: { deploymentVersion: string; webCommit: string; bundleRevision: number; runtimeRevision: string; playedCaseSchemaRevision: number } | null;
  alerts: Array<{ severity: string; window: string; count: number; ratio: number | null }>;
};

function safeDate(value: string) { return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function count(value: number) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function identifier(value: string) { return /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? value : null; }

/** Explicit projection: never download raw API responses, case data or identities. */
export function createOperationsDiagnostic(snapshot: Snapshot, receivedAt: string, refreshFailed: boolean) {
  return {
    schema: "casevant-operations-diagnostic-v1",
    scope: "Retained product anomalies only. Request health and external notifications are not connected.",
    snapshotSchema: identifier(snapshot.schema),
    snapshotState: snapshot.state,
    generatedAt: safeDate(snapshot.generatedAt),
    lastSuccessfulReadAt: safeDate(receivedAt),
    refreshFailed,
    window: { fromInclusive: safeDate(snapshot.fromInclusive), toExclusive: safeDate(snapshot.toExclusive) },
    aggregate: Object.fromEntries(COUNTERS.map(key => [key, count(snapshot.aggregate[key])])),
    release: snapshot.release ? {
      deploymentVersion: identifier(snapshot.release.deploymentVersion),
      webCommit: /^[a-f0-9]{40}$/.test(snapshot.release.webCommit) ? snapshot.release.webCommit : null,
      bundleRevision: count(snapshot.release.bundleRevision),
      runtimeRevision: identifier(snapshot.release.runtimeRevision),
      playedCaseSchemaRevision: count(snapshot.release.playedCaseSchemaRevision),
    } : null,
    alerts: snapshot.alerts.map(alert => ({
      severity: ["diagnostic", "warning", "critical"].includes(alert.severity) ? alert.severity : "unknown",
      window: ["5m", "10m", "15m"].includes(alert.window) ? alert.window : null,
      count: count(alert.count),
      ratio: alert.ratio !== null && Number.isFinite(alert.ratio) && alert.ratio >= 0 && alert.ratio <= 1 ? alert.ratio : null,
    })),
    externalNotification: "unavailable",
  };
}
