# v53 operations runbook

## Ownership and first response

The GENESIS: JURIS platform administrator owns the dashboard and incident
queue. For an incident, preserve only the generated request UUID, deployment
identity, event time, normalized route, and allowlisted outcome/reason. Never
copy user payloads, raw URLs, SQL, persistent identifiers, or secrets into an
incident record.

Request health and product anomalies have different sources:

- `worker.request` and `worker.exception` exist only in structured
  Worker/platform logs and create zero product-D1 telemetry writes.
- `operational_events` contains only low-volume, privacy-safe replay-internal,
  history, and revision/fingerprint anomalies from normalized `play_sessions`
  or `admin` operations, eligible while the bounded circuit breaker is closed.
- D1 busy/timeout/internal failures from instrumented operations remain
  structured platform logs only. The exact normalized routes are `catalog`,
  `play_sessions`, and `admin`; the exact logical repositories are `cases`,
  `case_versions`, `play_sessions`, `play_events`, and `operational_events`.
  This is not platform-wide, auth, users, or all-D1 coverage. A covered failure
  clears the current scope's queued rows, opens the 60-second circuit, and
  performs zero telemetry D1 work even on the triggering request.
- public catalog history/fingerprint/miss signals and session internal failures
  remain structured platform logs only and never create a telemetry D1 write.
- routine D1/replay/session successes and replay attempt denominators are not
  collected; missing values must never be displayed as zero or estimated.

## External request-health configuration

**External notification unavailable.** The application cannot provision or
verify a platform-log notification through the current Site runtime contract.
Do not mark a Worker alert active until Platform on-call performs and verifies
all six steps below. This list exactly matches
`REQUEST_HEALTH_CONFIGURATION.manualConfiguration` in
`app/operations-runbook.ts`:

1. Enable Workers Logs for the deployed Site Worker and retain invocation plus structured console events.
2. Query eventName=worker.exception over a rolling 5-minute window and alert on any matching event.
3. Query eventName=worker.request with responseClass=5xx and alert at 3 or more matches in 5 minutes.
4. For the rate leg, count every worker.request over 10 minutes, require at least 20 requests, and alert when responseClass=5xx is at least 2% of that exact count.
5. Break down responseClass=4xx by normalized route auth, assets, and all remaining application routes; never query raw URLs or request content.
6. Route notifications to Platform on-call and verify the queries in a non-production deployment before marking external notification active.

The Admin Desk repeats this configuration but cannot query the platform stream.
It therefore does not display fabricated request volume, rate, latency, 4xx,
5xx, or exception values.

## External instrumented D1-operation failure configuration

**External notification unavailable.** D1 busy, timeout, and internal-failure
signals are never written back to product D1. Do not mark the D1 failure alert
active until Platform on-call performs and verifies all three steps below. This
list exactly matches `D1_FAILURE_LOG_CONFIGURATION.manualConfiguration` in
`app/operations-runbook.ts`:

The exact v53 platform-log scope is normalized routes `catalog`,
`play_sessions`, and `admin` and logical repositories `cases`, `case_versions`,
`play_sessions`, `play_events`, and `operational_events`. Treat the resulting
count as instrumented-operation coverage only. It is not a platform-wide D1,
auth, users, or all-D1 health signal.

1. Query eventName=d1.operation over a rolling 5-minute window for instrumented routes catalog, play_sessions, or admin and logicalRepository cases, case_versions, play_sessions, play_events, or operational_events; include outcome=internal_failure, reason=busy, or reason=timeout.
2. Alert when the exact matching count reaches 3; group only by normalized route and allowlisted logicalRepository, and label it instrumented-operation coverage rather than platform-wide D1 health.
3. Route notifications to Platform on-call and verify the query in a non-production deployment before marking external notification active.

The Admin Desk repeats these instructions but has no connected log-query or
alert-provisioning surface. It reports the D1-capacity count and external
notification as unavailable and never substitutes retained D1 rows.

## Alert actions and source state

Use the owner, action, and rollback criterion versioned in
`app/operations-runbook.ts`. Every external notification remains unavailable
until independently configured and verified.

| Alert | Source and evaluation | Owner | Action | Rollback criterion |
|---|---|---|---|---|
| Worker exception | Platform logs; manual six-step configuration required | Platform on-call | Inspect the correlated Worker event and deployment logs, then reproduce the affected coarse route. | Roll back to Site version 52 when the exception is attributable to v53 or the route cannot be stabilized promptly. |
| Worker 5xx rate | Platform logs; manual exact count/denominator query required | Platform on-call | Compare failing route classes with deployment logs and verify the database and upstream dependencies. | Roll back to Site version 52 when v53 causes sustained or unexplained 5xx responses. |
| Instrumented D1 failures or timeouts | Platform logs only for the fixed three-route/five-repository operation scope; manual exact three-step query required; no Admin Desk count and no platform-wide claim | Platform on-call | Check D1 availability, busy/timeout reasons and the logical repository before retrying a safe read. | Roll back to Site version 52 if v53 query behavior is responsible; otherwise follow the D1 incident path. |
| D1 latency p95 | Unavailable; routine success latency is intentionally not collected | Platform on-call | Inspect platform service health and targeted diagnostics without treating the missing dashboard metric as zero. | Roll back to Site version 52 only when an independently verified latency regression is isolated to v53. |
| Replay internal failures | Split: structured platform anomaly mirror plus retained-row absolute threshold; percentage leg unavailable | JURIS runtime owner | Compare the deployed runtime identity with the canonical bundle and replay a fixture-equivalent route in a non-production environment. | Roll back to Site version 52 for a v53 replay regression or any canonical-state uncertainty. |
| Historical bundle lookup miss | Retained authenticated anomaly: absolute dashboard threshold; public catalog signal: platform log only | JURIS release owner | Verify the immutable catalog version and release manifest; do not substitute the current bundle for a missing historical version. | Stop the release and roll back to Site version 52 if a v53 manifest or catalog reference is missing. |
| Expected identity rejections | Retained authenticated anomalies: absolute dashboard threshold; public catalog signal: platform log only | JURIS product operations | Confirm that clients are using the current release and that expected stale-client guidance is visible. | No automatic rollback; escalate if the rejections indicate an incorrect v53 release identity. |

The D1 dashboard counts only successfully retained replay/history/mismatch rows
exactly. Structured platform logs are the sole source for D1 capacity failures
and for events skipped during a circuit-breaker cooldown; absence of a D1 row
is not proof that no anomaly occurred.

## Dashboard states

- `no_data`: no retained current-schema anomaly exists in the 60-minute
  overview. This can be the healthy state; do not create a production failure
  just to populate the dashboard. Inspect Worker logs for request health.
- `stale`: the newest retained anomaly is more than 15 minutes old. This is not
  proof of an application failure or of current request health.
- `partial`: verify `GENESIS_DEPLOYMENT_VERSION` and `GENESIS_WEB_COMMIT`, then
  check for invalid identity, more than one release identity, or a failed D1
  aggregate read. HTTP 503 with `partial` means the binding/read is unavailable.
- `current`: fresh retained anomalies have one complete release identity. It
  does not mean that platform request-log queries or notifications are active.

## Circuit breaker and write bound

On D1 busy/timeout/internal failure, the anomaly sink emits the structured log,
immediately clears every queued row in the current request scope, and opens a
60-second process-local cooldown. The triggering request performs zero
telemetry `prepare` and zero telemetry `batch`; later scopes skip anomaly
persistence until cooldown expiry. A telemetry prepare/batch failure also opens
the circuit. The sink never logs its own failure, and sink/prepare/batch/defer
failures cannot change the product response.

When no D1 capacity signal occurs, eligible replay/history/mismatch telemetry
performs at most one D1 `batch` per logical request-operation with one bounded
purge and no more than two anomaly inserts: at most three mutation statements.
Request logging, D1 capacity failures, and routine product successes perform
zero telemetry mutations.

## Contention verification

Run from the exact candidate state:

```text
node --experimental-sqlite --import tsx --test tests/observability.test.ts tests/observability-fail-open.test.ts tests/observability-contention.test.ts tests/request-lifecycle.test.ts tests/operations-dashboard.test.ts
```

Recorded result: **40/40 passed**.

| Verification | Command | Current result |
|---|---|---|
| 10,000 public/asset/404/anonymous request logs; zero D1 prepare/batch/mutation | 10,000 structured logs, 0 D1 prepares, 0 D1 batches | **Passed** |
| Public catalog anomalies and anonymous play-session `401` remain off D1 | Catalog anomaly logs only; anonymous `401` emits only its Worker request log | **Passed** |
| Product D1 statements identical with request logging enabled/disabled | Auth, session, and catalog transcripts compare byte/deep-equal | **Passed** |
| D1 capacity failure clears queued anomalies and performs no triggering-request telemetry D1 work | Structured log emitted, queue empty, circuit open for 60 seconds, 0 prepares/batches | **Passed** |
| Eligible replay/history/mismatch write bound | One request-scoped batch, one bounded purge, at most two inserts | **Passed** |
| Sink failure, D1 busy, batch rejection, and defer failure preserve response and cannot recurse | Targeted failure fixtures included in the 40-test run | **Passed** |
| Concurrent product-operation lock/busy comparison | Barrier-synchronized 1,000-operation model: `maxActive=1000`, capacity `32`, baseline busy `968`; telemetry-on/off statements, outcomes, and busy count identical; 0 telemetry prepares/batches | **Passed** |

Rerun the command after any telemetry, Worker, route, D1, or migration change.

## Retention and privacy audit

Migration `0011` remains justified by the low-volume anomaly rows. It is
additive and idempotent. Rows expire after 14 days, and each anomaly batch
purges at most 250 expired rows. If maintenance is interrupted, an administrator
may execute the same prepared, parameterized statement:

```sql
DELETE FROM operational_events
WHERE id IN (
  SELECT id FROM operational_events
  WHERE expires_at <= ?
  ORDER BY expires_at, id
  LIMIT ?
);
```

Bind parameter 1 to the current UTC ISO-8601 timestamp and parameter 2 to
`250`. Record the affected-row count, recheck D1 health, and repeat only while
expired rows remain. Never replace this with an unbounded delete. Stop the
release if any prompt, legal content, identity, token, payload, raw URL/query,
fingerprint, SQL, or persistent identifier appears.

## Release identity checks

Before deployment, set `GENESIS_DEPLOYMENT_VERSION` to the Site version being
saved and `GENESIS_WEB_COMMIT` to its exact 40-character pushed commit. After
deployment, compare the anomaly payload identity with the active Sites
deployment, canonical bundle, runtime, and played-case schema revisions. Treat
`unknown`, `unassigned`, invalid values, or multiple identities as `partial`.

## Migration rollback guidance

Version 52 does not read `operational_events`, so a Site rollback can leave the
additive migration and indexes in place. Do not drop them during an incident.
Any later removal requires a reviewed migration after retention, privacy, and
evidence-preservation requirements have been resolved.

## Rollback

For a post-deployment P0/P1, use the supported Sites rollback to saved,
identity-verified version 52 at commit
`dddef958b97b8b5c28621abaaf1253ec9b5de86d`. Confirm the custom domain,
audience, SSL, application health, and Worker logs after rollback. Do not create
version 54 as a retry. Preserve v53 logs and record root cause before proposing
another release. Leave additive migration `0011` in place; v52 ignores it.
