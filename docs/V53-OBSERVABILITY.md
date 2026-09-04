# v53 safe request and product-operation observability

## Scope and ownership

Version 53 observes the existing Worker, D1, replay, played-case, and session
paths without changing their business outcomes. The operational owner is the
GENESIS: JURIS platform administrator. The event schema is
`genesis.juris.observability.v1`.

The v53 `d1.operation` platform-log instrumentation is operation-scoped. Its
normalized routes are exactly `catalog`, `play_sessions`, and `admin`; its
logical repositories are exactly `cases`, `case_versions`, `play_sessions`,
`play_events`, and `operational_events`. This is instrumented-operation
coverage, not platform-wide, auth, users, or all-D1 coverage. Absence of a
signal makes no claim about an uninstrumented D1 operation.

Collection is fail-open: validation, structured-log emission, D1 persistence,
retention, aggregation, circuit-breaker, and deferred-work failures must never
change a valid product response. Telemetry never recursively reports a failure
of its own sink.

The lazy Admin Desk panel calls `GET /api/admin/operations`. That endpoint is
aggregate-only and remains behind the existing server-side platform-
administrator authorization check.

## Capacity separation

v53 uses three deliberately different observability paths:

| Path | Signals | Destination | Product-D1 telemetry writes |
|---|---|---|---|
| Request health | `worker.request` and `worker.exception`, including normalized route, response class, latency, and release identity | Structured Worker/platform logs only | **Zero** |
| Product anomaly log | Allowlisted D1 failures, replay internal failures, historical-version misses, identity mismatches, and session internal failures | Structured Worker/platform logs | Zero from logging itself |
| Authenticated anomaly retention | Precise replay-internal, historical-version, and revision/fingerprint anomalies whose normalized route is `play_sessions` or `admin` | Bounded best-effort batch in `operational_events` when its circuit is closed | At most one bounded batch per request-operation |

A public request, asset request, anonymous `401`, or `404` never prepares,
batches, or mutates a telemetry statement in product D1. Request logging does
not depend on the `DB` binding. The application does not copy request rows into
`operational_events` to manufacture an exact denominator. Public catalog
history/fingerprint/miss signals, including catalog `404` outcomes, remain
structured platform logs only and are never D1-eligible.

Routine successful D1 reads, replay starts/successes, replay expected
rejections, and successful or expected-rejection session outcomes are
intentionally not collected. They are neither persisted nor represented as
zero, sampled, or estimated metrics. v53 adds no sampled success metric whose
cost could compete with product traffic.

## Allowlisted event contract and disposition

| Event | Purpose | v53 disposition |
|---|---|---|
| `worker.request` | Completed request, normalized route, response class, and latency | Platform log only; never D1 |
| `worker.exception` | Uncaught Worker exception before the original failure is rethrown | Platform log only; never D1 |
| `d1.operation` | Logical repository operation and failure classification | Busy, timeout, and internal-failure anomalies are platform-log only, clear queued anomaly rows, open the circuit, and are never D1-eligible; routine outcomes are not collected |
| `replay.start` | Replay attempt began | Not collected in v53 |
| `replay.success` | Replay completed with a valid state | Not collected in v53 |
| `replay.expected_rejection` | Safe domain rejection such as stale revision or idempotency conflict | Not collected in v53; separately allowlisted revision/fingerprint anomaly events remain eligible |
| `replay.internal_failure` | Invalid stored state or runtime failure | Logged; only `play_sessions`/`admin` routes are D1-eligible |
| `played_case.revision_mismatch` | Imported or stored revision differs from the expected session revision | Logged; only `play_sessions`/`admin` routes are D1-eligible |
| `played_case.fingerprint_mismatch` | Imported or stored identity differs from the exact version | Logged; only `play_sessions`/`admin` routes are D1-eligible |
| `historical_bundle.lookup_miss` | Exact historical case version is unavailable or invalid | Logged; only `play_sessions`/`admin` routes are D1-eligible, so public catalog misses stay log-only |
| `session.import` | Played-case import outcome | Internal failure is logged only; never D1-eligible |
| `session.load` | Session restoration outcome | Internal failure is logged only; never D1-eligible |
| `session.save` | Session persistence outcome | Internal failure is logged only; never D1-eligible |

Every emitted or retained event contains only allowlisted coarse fields:
event/schema name, UTC occurrence time, correlation/request UUID, normalized
route class, outcome and reason enums, response class, bounded latency,
optional logical D1 repository and operation, optional bounded command count,
deployment version, web commit, canonical bundle revision, canonical runtime
revision, and played-case schema revision.

Runtime/schema values come from executable producers or the authoritative
parity lock. `GENESIS_DEPLOYMENT_VERSION` must identify the saved Site version,
and `GENESIS_WEB_COMMIT` must be the exact 40-character pushed commit saved and
deployed by Sites. Missing or invalid release identity makes the anomaly
dashboard `partial`.

## Privacy and request correlation

Telemetry must never contain prompts, case facts, legal content, evidence,
names, email addresses, authentication material, exports, session payloads,
SQL text, raw URLs/query strings, fingerprints, or full persistent IDs. Routes
come from a fixed template allowlist. Unknown fields or values are rejected
rather than copied into a log or D1.

For every external request, the Worker creates a cryptographically random,
lowercase UUID with `crypto.randomUUID()`. It overwrites any inbound
`X-Request-ID` before application dispatch, correlates coarse events produced
inside that request, and returns the same UUID in the response header. The UUID
is not linked to an identity, session, case, fingerprint, or other persistent
identifier.

## Bounded anomaly persistence and circuit breaker

Migration `0011` is retained because the low-volume anomaly rows support the
administrator-only product-anomaly view and its absolute threshold evaluators.
It is additive and idempotent, retains rows for 14 days, provides time and
event/outcome indexes, and purges at most 250 expired rows per maintenance
statement. Every retained anomaly row is exact and has weight `1`; the current
release does not write weighted 1-in-16 success samples.

One Worker request owns one telemetry scope. When no D1 capacity signal occurs,
the scope queues no more than two eligible replay/history/mismatch rows and
flushes at most once. The resulting D1 call is one `batch` containing one
bounded purge plus one or two inserts: a maximum of one telemetry batch and
three telemetry mutation statements per logical request-operation. Routine
operations and request-only logging produce zero telemetry mutation statements.

A D1 busy/timeout/internal-failure signal is emitted to the structured platform
log, immediately clears every anomaly already queued in that request scope,
opens the process-local circuit for a bounded 60-second cooldown, and returns.
The triggering request therefore performs zero telemetry `prepare` and zero
telemetry `batch`; later scopes skip D1 anomaly persistence while the circuit is
open. An anomaly-persistence prepare/batch failure also opens the cooldown. The
sink never recursively reports its own failure, and a thrown log sink,
synchronous prepare failure, rejected batch, or `waitUntil`/defer failure is
swallowed at the telemetry boundary without altering the product response.

## Dashboard and missing-data semantics

The Admin Desk explicitly separates the two sources:

- **Platform request health:** the application states that request outcomes,
  route/response class, latency, 4xx classification, 5xx counts, and Worker
  exceptions exist only in the Worker log stream. The Site runtime does not
  expose a verified log-query or alert-provisioning API to this dashboard, so
  it displays **external notification unavailable** and the manual setup from
  the runbook. It does not fabricate request totals or rates.
- **Instrumented D1 operation failures:** busy, timeout, and internal-failure
  signals for the fixed route/repository scope exist only in structured
  platform logs. The dashboard renders that scope, marks its exact query and
  external notification unavailable, exposes the exact three-step manual log
  configuration, and does not present it as platform-wide/auth/users/all-D1
  coverage or fabricate counts, rates, or latency from D1.
- **Product-D1 anomalies:** `/api/admin/operations` reads only successfully
  retained `play_sessions`/`admin` replay-internal, history, and
  revision/fingerprint rows. Public catalog, session-internal, and D1-capacity
  log-only anomalies are not represented there. Absence means no retained row
  was observed; it does not prove that request, D1-capacity, or routine
  operation health is zero.

The 60-minute anomaly snapshot uses these states:

- `no_data`: no retained current-schema anomaly exists in the window. This is
  expected in a healthy quiet window and is not a request-health reading.
- `stale`: an anomaly exists, but the newest retained anomaly is more than 15
  minutes older than the snapshot end.
- `partial`: fresh retained anomalies exist, but release identity is missing or
  invalid, the web commit is `unknown`, the deployment is `unassigned`, the
  window has more than one identity, or the aggregate read/D1 binding failed.
- `current`: fresh retained anomalies have exactly one complete release
  identity.

Routine D1 latency p50/p95 and replay success/attempt-rate metrics are not
available because their success inputs are intentionally not collected. The
dashboard must not render those missing inputs as zero or as estimates.

## Alert-source truthfulness

| Signal | Threshold policy | Executable source in v53 | External notification |
|---|---|---|---|
| Worker exception | Any in 5 minutes | Manual Worker-log query | Unavailable until the six-step platform configuration is verified |
| Worker 5xx | Three in 5 minutes, or at least 2% of 20+ requests in 10 minutes | Manual Worker-log query with the exact request denominator | Unavailable until manually configured |
| Instrumented D1 busy/timeout/internal failure | Three exact platform-log matches in 5 minutes | Manual Worker-log query over only the fixed `catalog`/`play_sessions`/`admin` and five-repository instrumentation scope; never product D1 and not platform-wide | Unavailable until manually configured and verified |
| D1 latency p95 | Greater than 500 ms over 15 minutes | Not evaluable in v53 because routine success latency is not collected | Unavailable |
| Replay internal failure | Three retained anomalies in 15 minutes | Split: structured platform anomaly mirror plus absolute-count D1 evaluator for successfully retained rows; the percentage leg is unavailable without an attempt denominator | Unavailable; dashboard absolute evaluation covers retained rows only |
| Historical bundle miss | Any retained miss in 15 minutes | Administrator D1 evaluator for retained authenticated anomalies; manual platform logs for public catalog signals | Unavailable; dashboard evaluation covers retained rows only |
| Revision/fingerprint rejection spike | Ten retained anomalies in 15 minutes | Administrator D1 evaluator for retained authenticated anomalies; manual platform logs for public catalog signals | Unavailable; dashboard evaluation covers retained rows only |

Threshold fixtures verify the executable absolute evaluators and the platform-
log query policy. They do not prove that an external notification is active.
Production smoke checks use safe successes and expected rejections only; they
must not intentionally create a 5xx, D1 failure, or replay internal failure.

## Contention evidence

The focused candidate-state suite was executed with:

```text
node --experimental-sqlite --import tsx --test tests/observability.test.ts tests/observability-fail-open.test.ts tests/observability-contention.test.ts tests/request-lifecycle.test.ts tests/operations-dashboard.test.ts
```

Result: **40/40 passed**.

| Proof | Command | Result |
|---|---|---|
| 10,000 public/asset/404/anonymous request logs create zero telemetry D1 writes | 10,000 structured platform logs; 0 D1 `prepare`; 0 D1 `batch` | **Passed** |
| Public catalog misses/mismatches/internal anomalies and anonymous play-session `401` responses stay off D1 | Catalog anomalies are platform-log only; anonymous `401` emits only its Worker request log | **Passed** |
| Product D1 statements are identical with request telemetry enabled/disabled | Auth, session, and catalog statement transcripts compare byte/deep-equal | **Passed** |
| D1 busy/timeout/internal failure on the triggering request | Structured log emitted; queued anomaly rows cleared; 60-second circuit opened; 0 telemetry prepares/batches | **Passed** |
| Eligible replay/history/mismatch persistence bound | At most one request-scoped batch with one purge and no more than two inserts | **Passed** |
| Sink/prepare/batch/defer failures preserve responses and do not recurse | Targeted fail-open fixtures included in the 40-test run | **Passed** |
| Concurrent product operations show no telemetry-induced lock/busy regression | Barrier-synchronized 1,000-operation model: `maxActive=1000`, capacity `32`, baseline busy `968`; telemetry-on/off statements, outcomes, and busy count identical; 0 telemetry prepares/batches | **Passed** |

Strict TypeScript (`npx tsc --noEmit --incremental false`) also passed with zero
errors.
