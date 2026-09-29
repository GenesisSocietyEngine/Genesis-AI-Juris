# GENESIS: JURIS - Codex Progress Report

**Milestone:** v53 - 18-Route Mobile Parity and Privacy-Minimal Operations Observability
**Report date:** 2026-08-31 (Europe/Paris)
**Overall status:** **GO - all mandatory v53 pre-commit gates are green. One coherent commit, push, exact Site v53 save/deployment, and production smoke/log verification remain pending; production remains on verified Site v52.**

## Release decision

The production-safety blocker is resolved. Worker request/exception events and
D1 busy, timeout, or internal-failure signals are emitted only to structured
platform logs and perform zero product-D1 telemetry work. A D1 capacity signal
clears queued anomaly rows, opens the 60-second circuit, and causes zero
telemetry prepares or batches in the triggering request.

Product D1 retains only bounded replay-internal, historical-version, and
revision/fingerprint anomalies from `play_sessions` or `admin`. The lowest
persistence boundary re-normalizes the complete one-or-two-event batch and
rejects every non-retained or extra-field event before the first D1 `prepare`.
One accepted request-operation can issue at most one batch containing one
bounded purge and no more than two inserts.

Routine successes, total-request denominators, rates, and success latency are
not collected or represented as zero. The administrator API exposes only seven
retained-anomaly counters. Platform-log notification remains truthfully
`unavailable` with exact manual configuration documented; this is non-blocking
under the adjusted acceptance criteria. D1 log coverage is explicitly limited
to the instrumented `catalog`, `play_sessions`, and `admin` routes and the
`cases`, `case_versions`, `play_sessions`, `play_events`, and
`operational_events` logical repositories; it does not claim platform-wide D1
coverage.

## Exact source and production identities

| Item | Verified state |
|---|---|
| Web base | `dddef958b97b8b5c28621abaaf1253ec9b5de86d` |
| Web v53 commit / remote SHA | Pending one coherent commit and push |
| Web branch | `codex/v53-parity-observability` |
| Mobile SHA | `39b856320ed5dc397562068706c4cea7d703899c` |
| Mobile checkout | Detached at the exact SHA; no mobile source change |
| Mobile version | Flutter `0.6.0+13`; Rust workspace `0.5.0` |
| Mobile release | Not produced; compatibility evidence requires no mobile product release |
| Site project | `genesis-juris-web` / `appgprj_6a88a26d2f808191aa076b9fcd8dbce6` |
| Current production | Site version 52 (`appgver_a27f6a6c80748191a05ab19f32383fc6`) |
| Current deployment | `appgdep_6a94900fa9c88191be23402b560202a2` |
| Production URL | <https://studio.falcon-merlin.com> |
| Site v53 / deployment | Pending; v52 has not been displaced |
| Rollback | Not invoked |

The eventual commit cannot embed its own resolved SHA. The final pushed SHA,
Site v53 version/deployment identifiers, and production receipts will therefore
be recorded in the external workspace report after deployment without
modifying the exact deployed commit.

## Exact parity and compatibility receipts

The v53 matrix contains exactly 18 unique command paths across all five
canonical cases: 290 initial/command checkpoints, 45 non-null judicial-result
checkpoints, all 17 terminal outcomes, and the explicit-null ERP remittal
state. Every route passes normalization, Rust inspection/load, restored
snapshot equality, byte-identical re-save, and locked final-digest checks.

| Receipt | Value |
|---|---|
| Canonical bundle SHA-256 | `e90f856cbb0f4625f7612a99db2f527ac3b090619019b7a83c21140f78f1984a` |
| Canonical bundle / catalog version | `5` / `1` |
| Fixture schema / SHA-256 | `2` / `f7e6b4edf2c01bfdb0ba7f0b0e8099d22199d2166c710cb98e80580294a872ad` |
| Rust probe SHA-256 | `322a2e3b9d4e730a14ef05cdc974c67fcdb9d8a493773c6a9f0c2a57f94c57ec` |
| Mobile canonical Git blob | `464d88b02f6cf6101dc86c04abfc3505abcfb0a6` |
| Runtime / played-case schema | `canonical-runtime-v1` / `3` |
| Mobile save/runtime/ABI | `genesis.ai-juris.command-log@1` / `scenario-runtime-v2` / ABI `1` |
| iOS evidence | Workflow `31441634496`, attempt 2, success at the exact mobile SHA |

The per-route commands, clocks, outcomes, judicial results, route hashes, and
mobile save digests are in `docs/V53-PARITY-MATRIX.md`. The canonical bundle is
byte-identical to the web base and is absent from the semantic diff.

## Final observability boundary

- `worker.request` and `worker.exception`: structured platform logs only; never
  product D1.
- D1 busy, timeout, and internal-failure signals: structured platform logs only;
  queued anomaly rows are cleared and the circuit opens for 60 seconds.
- Product D1: only `replay.internal_failure`,
  `historical_bundle.lookup_miss`, `played_case.revision_mismatch`, and
  `played_case.fingerprint_mismatch` from `play_sessions` or `admin`.
- Migration `0011`: additive and repeat-safe; four retained event names, two
  routes, retained outcomes/reasons, exact sample weight `1`, 14-day expiry,
  and purge batches capped at 250 rows.
- Retained batch bound: one purge plus one or two inserts, once per logical
  request-operation.
- Forbidden at the persistence boundary and in the database checks: Worker
  request rows, D1 capacity rows, public catalog anomalies, weighted samples,
  forged extra fields, and non-retained routes/outcomes/reasons.
- Privacy contract: no user/email, auth token, session key, case ID/version,
  fingerprint, raw URL/query, payload, evidence, prompt, SQL, or content ID.
- Admin dashboard: only seven exact retained-anomaly fields; `no_data`,
  `current`, `stale`, and `partial` states; `local`, `unknown`, and
  `unassigned` identities are always partial.

## Contention, fail-open, and truthfulness proofs

| Proof | Verified result |
|---|---|
| Production request lifecycle | 10,000 public, asset, 404, and anonymous requests; 0 telemetry prepares and 0 batches |
| Synchronized product load | 1,000 operations, capacity 32, `maxActive=1000`; telemetry-on/off statements and results identical; 968 busy outcomes in both; 0 telemetry prepares/batches |
| D1 capacity signal | Queue cleared, 60-second circuit opened, 0 triggering-request telemetry work |
| Persistence boundary | Worker, D1 timeout/busy, public catalog, mixed valid/invalid, and forged extra-field batches rejected before `prepare`/`batch` |
| Fail-open response path | Response status, body, and headers preserved across sink/prepare/batch/busy/defer failures |
| Fail-open exception path | The identical product error object is rethrown |
| Dashboard API | Only seven retained-anomaly counters; no Worker/D1/replay-denominator or latency zeros |

## Mandatory gate ledger

| Gate | Final result |
|---|---|
| `npm run release:verify` | **PASS**, uninterrupted from the final v53 candidate state |
| Strict TypeScript | PASS, zero errors |
| Full ESLint | PASS, zero warnings |
| Full `npm test` | PASS, 213/213 |
| Focused observability/privacy suite | PASS, 40/40 |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities |
| `git diff --check` | PASS; local LF-to-CRLF conversion notices only |
| Final production build | PASS |
| Exact cross-runtime parity | PASS, 18/18 routes and every checkpoint |
| Flutter analysis | PASS, no issues |
| Flutter tests | PASS, 222/222 |
| Locked Rust workspace | PASS, all unit/integration/doc tests |
| Android native FFI | PASS, 12/12 on `emulator-5554` |
| Locked iOS evidence | PASS, workflow `31441634496`, attempt 2 |

Two Windows portability defects discovered by the release gate were corrected
and regression-tested: WebVTT accepts LF or CRLF headers, and the mobile parity
tar invocation now receives cwd-relative paths instead of Windows drive-letter
paths.

## Candidate diff and exclusions

The coherent v53 candidate is limited to 44 release files covering:

- parity fixtures, lock, Rust probe, verifier/assertions, route matrix, and
  release gate;
- Worker/request lifecycle, observability contract, D1 wrapper, retained
  persistence, admin endpoint/dashboard, and play/catalog instrumentation;
- additive migration `0011`, schema, snapshot, and journal;
- focused contention/fail-open/request-lifecycle/dashboard/migration tests;
- v53 architecture, authentication, release, observability, operations, parity,
  README, environment placeholders, and this report.

Explicitly excluded: `.sites-runtime/`, `.wrangler/`, `dist/`, `node_modules/`,
mobile build outputs, temporary worktrees, credentials, logs, caches, and
archives. There is no dependency, package-lock, hosting-config, canonical-bundle,
or unrelated feature change. `.env.example` contains placeholders only.

## Remaining authorized release sequence

1. Complete the final independent privacy/report/scope freeze audit.
2. Stage the exact 44-file candidate and inspect the staged diff.
3. Create one coherent v53 commit, push normally, and verify the remote SHA.
4. Save exactly Site version 53 from that pushed commit and verify its identity.
5. Deploy only Site v53, poll to success, and confirm production points to it.
6. Smoke the public Studio/session/import/export/revision/replay paths and inspect
   deployment-window logs using available Sites/HTTP tooling. The in-app
   interactive browser is unavailable in this environment, so no signed-in UI
   evidence will be fabricated.
7. Record the final commit, Site version/deployment, smoke, and log receipts in
   the external workspace `CodexReport.md`.

## v54 hold

Do not begin v54 work until the exact pushed v53 commit is saved, deployed, and
verified in production. Production remains on Site v52 until every remaining
release step above succeeds.
