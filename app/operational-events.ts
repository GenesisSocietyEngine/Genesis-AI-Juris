import {
  OBSERVABILITY_EVENT_NAMES,
  OBSERVABILITY_OUTCOMES,
  OBSERVABILITY_REASONS,
  OBSERVABILITY_RESPONSE_CLASSES,
  OBSERVABILITY_ROUTES,
  OBSERVABILITY_SCHEMA,
  aggregateObservabilityBuckets,
  normalizeObservabilityEvent,
  observabilityExpiry,
  type ObservabilityAggregate,
  type ObservabilityAggregateBucket,
  type ObservabilityEventName,
  type ObservabilityEventV1,
  type ObservabilityOutcome,
  type ObservabilityResponseClass,
  type ObservabilityRoute,
} from "./observability";
import { shouldPersistOperationalAnomaly } from "./observability-persistence";

export interface OperationalEventDatabase {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface AggregateRow {
  event_name: string;
  route: string;
  outcome: string;
  reason: string;
  response_class: string;
  latency_ms: number | null;
  event_count: number;
}

interface LatestRow {
  event_name: string;
  route: string;
  outcome: string;
  occurred_at: string;
  deployment_version: string;
  web_commit: string;
  bundle_revision: number;
  runtime_revision: string;
  played_case_schema_revision: number;
}

interface ReleaseRow {
  deployment_version: string;
  web_commit: string;
  bundle_revision: number;
  runtime_revision: string;
  played_case_schema_revision: number;
}

export const OBSERVABILITY_STALE_AFTER_MS = 15 * 60 * 1_000;
export const OBSERVABILITY_PURGE_BATCH_SIZE = 250;
export const MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH = 2;

export interface OperationalAggregateSnapshot {
  state: "current" | "no_data" | "partial" | "stale";
  fromInclusive: string;
  toExclusive: string;
  aggregate: ObservabilityAggregate;
  latestEvent: Pick<LatestRow, "event_name" | "route" | "outcome" | "occurred_at"> | null;
  release: {
    deploymentVersion: string;
    webCommit: string;
    bundleRevision: number;
    runtimeRevision: string;
    playedCaseSchemaRevision: number;
  } | null;
}

function included<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function prepareOperationalEventInsert(
  database: OperationalEventDatabase,
  event: ObservabilityEventV1,
) {
  const expiresAt = observabilityExpiry(event.occurredAt);
  return database.prepare(`
    INSERT INTO operational_events (
      schema, occurred_at, expires_at, request_id, event_name, route, outcome, reason,
      response_class, latency_ms, operation, logical_repository, command_count, sample_weight,
      deployment_version, web_commit, bundle_revision, runtime_revision, played_case_schema_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.schema,
    event.occurredAt,
    expiresAt,
    event.requestId,
    event.eventName,
    event.route,
    event.outcome,
    event.reason,
    event.responseClass,
    event.latencyMs,
    event.operation,
    event.logicalRepository,
    event.commandCount,
    1,
    event.deploymentVersion,
    event.webCommit,
    event.bundleRevision,
    event.runtimeRevision,
    event.playedCaseSchemaRevision,
  );
}

async function persistOperationalEventBatch(
  database: OperationalEventDatabase,
  events: readonly ObservabilityEventV1[],
): Promise<void> {
  if (events.length === 0 || events.length > MAX_OPERATIONAL_EVENT_INSERTS_PER_BATCH) {
    throw new Error("Operational telemetry batches must contain one or two anomaly events.");
  }
  const retainedEvents: ObservabilityEventV1[] = [];
  for (const candidate of events) {
    const event = normalizeObservabilityEvent(candidate);
    if (!event || !shouldPersistOperationalAnomaly(event)) {
      throw new Error("Product D1 may persist only exact retained operational anomalies.");
    }
    retainedEvents.push(event);
  }
  const purge = database.prepare(`
    DELETE FROM operational_events
    WHERE id IN (
      SELECT id FROM operational_events
      WHERE expires_at <= ?
      ORDER BY expires_at, id
      LIMIT ?
    )
  `).bind(retainedEvents[0].occurredAt, OBSERVABILITY_PURGE_BATCH_SIZE);
  const statements = [
    purge,
    ...retainedEvents.map((event) => prepareOperationalEventInsert(database, event)),
  ];
  await database.batch(statements);
}

export async function persistOperationalEvents(
  database: OperationalEventDatabase,
  events: readonly ObservabilityEventV1[],
): Promise<void> {
  await persistOperationalEventBatch(database, events);
}

export async function purgeExpiredOperationalEvents(database: Pick<OperationalEventDatabase, "prepare">, now = new Date().toISOString()): Promise<number> {
  const result = await database.prepare(`
    DELETE FROM operational_events
    WHERE id IN (
      SELECT id FROM operational_events
      WHERE expires_at <= ?
      ORDER BY expires_at, id
      LIMIT ?
    )
  `).bind(now, OBSERVABILITY_PURGE_BATCH_SIZE).run();
  return Number(result.meta.changes ?? 0);
}

export async function readOperationalAggregate(
  database: Pick<OperationalEventDatabase, "prepare">,
  fromInclusive: string,
  toExclusive: string,
): Promise<ObservabilityAggregate> {
  const result = await database.prepare(`
    SELECT event_name, route, outcome, reason, response_class, latency_ms, SUM(sample_weight) AS event_count
    FROM operational_events
    WHERE schema = ? AND occurred_at >= ? AND occurred_at < ? AND expires_at > ?
    GROUP BY event_name, route, outcome, reason, response_class, latency_ms
    ORDER BY event_name, route, outcome, reason, response_class, latency_ms
  `).bind(OBSERVABILITY_SCHEMA, fromInclusive, toExclusive, toExclusive).all<AggregateRow>();
  const buckets: ObservabilityAggregateBucket[] = [];
  for (const row of result.results ?? []) {
    if (!included(OBSERVABILITY_EVENT_NAMES, row.event_name)
      || !included(OBSERVABILITY_ROUTES, row.route)
      || !included(OBSERVABILITY_OUTCOMES, row.outcome)
      || !included(OBSERVABILITY_REASONS, row.reason)
      || !included(OBSERVABILITY_RESPONSE_CLASSES, row.response_class)
      || !Number.isSafeInteger(row.event_count)
      || row.event_count < 0) continue;
    buckets.push({
      eventName: row.event_name as ObservabilityEventName,
      route: row.route as ObservabilityRoute,
      outcome: row.outcome as ObservabilityOutcome,
      reason: row.reason as ObservabilityAggregateBucket["reason"],
      responseClass: row.response_class as ObservabilityResponseClass,
      latencyMs: row.latency_ms,
      count: row.event_count,
    });
  }
  return aggregateObservabilityBuckets(buckets);
}

function safeRelease(row: ReleaseRow | LatestRow) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u.test(row.deployment_version)
    || !/^(?:[a-f0-9]{40}|unknown)$/u.test(row.web_commit)
    || !Number.isSafeInteger(row.bundle_revision)
    || row.bundle_revision < 0
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u.test(row.runtime_revision)
    || !Number.isSafeInteger(row.played_case_schema_revision)
    || row.played_case_schema_revision < 0) return null;
  return {
    deploymentVersion: row.deployment_version,
    webCommit: row.web_commit,
    bundleRevision: row.bundle_revision,
    runtimeRevision: row.runtime_revision,
    playedCaseSchemaRevision: row.played_case_schema_revision,
  };
}

function isNonProductionDeployment(value: string): boolean {
  return value === "local" || value === "unknown" || value === "unassigned";
}

export async function readOperationalAggregateSnapshot(
  database: Pick<OperationalEventDatabase, "prepare">,
  fromInclusive: string,
  toExclusive: string,
): Promise<OperationalAggregateSnapshot> {
  const [aggregate, latestResult, releaseResult] = await Promise.all([
    readOperationalAggregate(database, fromInclusive, toExclusive),
    database.prepare(`
      SELECT event_name, route, outcome, occurred_at, deployment_version, web_commit,
        bundle_revision, runtime_revision, played_case_schema_revision
      FROM operational_events
      WHERE schema = ? AND occurred_at >= ? AND occurred_at < ? AND expires_at > ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT 1
    `).bind(OBSERVABILITY_SCHEMA, fromInclusive, toExclusive, toExclusive).all<LatestRow>(),
    database.prepare(`
      SELECT deployment_version, web_commit, bundle_revision, runtime_revision, played_case_schema_revision
      FROM operational_events
      WHERE schema = ? AND occurred_at >= ? AND occurred_at < ? AND expires_at > ?
      GROUP BY deployment_version, web_commit, bundle_revision, runtime_revision, played_case_schema_revision
      ORDER BY deployment_version, web_commit, bundle_revision, runtime_revision, played_case_schema_revision
      LIMIT 2
    `).bind(OBSERVABILITY_SCHEMA, fromInclusive, toExclusive, toExclusive).all<ReleaseRow>(),
  ]);
  const latest = latestResult.results?.[0] ?? null;
  const releases = releaseResult.results ?? [];
  const release = latest ? safeRelease(latest) : null;
  let state: OperationalAggregateSnapshot["state"];
  if (!latest) state = "no_data";
  else if (Date.parse(latest.occurred_at) < Date.parse(toExclusive) - OBSERVABILITY_STALE_AFTER_MS) state = "stale";
  else if (!release || release.webCommit === "unknown" || isNonProductionDeployment(release.deploymentVersion) || releases.length !== 1 || releases.some((item) => !safeRelease(item))) state = "partial";
  else state = "current";
  return {
    state,
    fromInclusive,
    toExclusive,
    aggregate,
    latestEvent: latest ? { event_name: latest.event_name, route: latest.route, outcome: latest.outcome, occurred_at: latest.occurred_at } : null,
    release,
  };
}
