# v53 - 18-route mobile parity and safe D1/replay observability

## Baseline and scope

v53 starts from verified web commit
`dddef958b97b8b5c28621abaaf1253ec9b5de86d` and production Site version 52.
The locked mobile baseline is
`39b856320ed5dc397562068706c4cea7d703899c` (Flutter `0.6.0+13`, Rust
`0.5.0`).

The milestone adds nine deterministic routes to the retained nine, strict
18-route validation, capacity-separated observability, bounded anomaly
retention, an administrator-only anomaly dashboard, truthful alert-source
states, and an incident/rollback runbook. It does not change the canonical
bundle, scenario runtime behavior, Studio features, or mobile product source.

## Observability release contract

- `worker.request` and `worker.exception` are structured platform logs only.
  Public traffic, assets, anonymous `401` responses, and `404` responses create
  zero product-D1 telemetry writes.
- D1 busy/timeout/internal failures are structured platform-log only. They
  immediately clear queued anomaly rows, open the 60-second circuit, and cause
  zero telemetry D1 prepares/batches even on the triggering request.
- Product D1 retains only allowlisted low-volume replay internal failures,
  historical misses, and revision/fingerprint mismatches from normalized
  `play_sessions` or `admin` operations. Public catalog
  history/fingerprint/miss signals and session internal failures remain
  platform-log only.
- Routine successful D1/replay/session operations are not collected. No missing
  success, request, rate, or latency value is displayed as zero or estimated.
- When no D1 capacity signal occurs, each request-operation can flush at most
  one telemetry batch containing one 250-row bounded purge and no more than two
  replay/history/mismatch inserts.
- A process-local circuit breaker disables later anomaly persistence for 60
  seconds after a D1 capacity or telemetry-persistence failure. The sink is
  fail-open and nonrecursive.
- Migration `0011` remains additive and idempotent because the remaining
  anomaly rows support the Admin Desk absolute evaluators; retention stays 14
  days with the existing indexes and purge bound.
- The dashboard separates unavailable platform-log Worker and D1-capacity
  health from D1-backed retained anomalies. It fabricates no missing count,
  rate, or latency. External notification remains unavailable until the exact
  six-step Worker and three-step D1 log configurations in the operations
  runbook have been completed and verified.

## Release gates

- canonical bundle remains byte-identical to v52;
- 18 unique parity routes cover every canonical case and documented outcome/risk;
- web/mobile checkpoints, serialization, load, re-save, and digests match;
- full web, Flutter, Rust, Android, iOS, and exact-SHA parity gates pass;
- request telemetry performs zero product-D1 prepare/batch/mutation work across
  10,000 synthetic public/asset/404/anonymous requests;
- public catalog history/fingerprint/miss signals, including catalog `404`
  responses, remain platform-log only and create zero telemetry D1 writes;
- product D1 statement traces are identical with request logging enabled and
  disabled;
- the anomaly path proves its one-batch, two-insert maximum and 60-second
  nonrecursive fail-open circuit breaker;
- a D1 capacity signal clears queued anomalies and causes zero telemetry
  prepare/batch work in its triggering request;
- concurrent product operations show no telemetry-induced lock/busy regression;
- telemetry allowlist/privacy/retention/aggregation/alert tests pass;
- Admin Desk states and alert sources never represent unavailable data as zero,
  exact, estimated, or externally active;
- administrator authorization protects operations data;
- local, remote, packaged, saved Site, and deployment source identities match.

## Contention evidence status

The candidate-state targeted command was:

```text
node --experimental-sqlite --import tsx --test tests/observability.test.ts tests/observability-fail-open.test.ts tests/observability-contention.test.ts tests/request-lifecycle.test.ts tests/operations-dashboard.test.ts
```

It passed **40/40** tests.

| Evidence | Command | Result |
|---|---|---|
| 10,000-request zero-write proof and no request-path prepare/batch | 10,000 platform logs, 0 D1 prepares, 0 D1 batches | **Passed** |
| Public catalog anomaly and anonymous play-session `401` isolation | Platform-log only; zero telemetry D1 writes | **Passed** |
| Enabled/disabled product statement identity | Auth, session, and catalog transcripts byte/deep-equal | **Passed** |
| Concurrent lock/busy comparison | Barrier-synchronized 1,000-operation model: `maxActive=1000`, capacity `32`, baseline busy `968`; telemetry-on/off statements, outcomes, and busy count identical; 0 telemetry prepares/batches | **Passed** |
| Triggering-request D1 capacity isolation | Structured log emitted, queued rows cleared, 60-second circuit opened, 0 telemetry prepares/batches | **Passed** |
| Eligible retained-anomaly write bound | One request-scoped batch, one bounded purge, at most two replay/history/mismatch inserts | **Passed** |
| Nonrecursive fail-open sink/prepare/batch/defer coverage | Included in focused 40-test run | **Passed** |

Strict TypeScript (`npx tsc --noEmit --incremental false`) passed with zero
errors.

Rerun this command after any relevant candidate change. Do not commit, push,
save, or deploy if the rerun is red or unverifiable.

## Deployment and rollback

After every release gate is green, save exactly Site version 53 from the exact
accepted pushed v53 commit and deploy only that version. Keep version 52
available throughout verification. Smoke checks must avoid intentional
production failures and verify request logging creates no product-D1 telemetry
write. Inspect structured Worker logs for safe request events and the Admin Desk
for expected-rejection/anomaly-source truthfulness; do not require a healthy
operation to create an anomaly row.

If a v53 P0/P1 is found, roll back through Sites to saved version 52. Verify
`https://studio.falcon-merlin.com`, domain/SSL/audience, canonical manifests,
required assets, and Worker logs. Do not opportunistically change source or
create version 54 during rollback.
