# Native padding cause: retained evidence and remaining boundary

The original failure is real: application run39559539193 on287d086e0f44888770c6fe849351b2f60fcf6529 passes the initial restart phases and fails legacy-write on AnimatedPadding's `padding.isNonNegative` assertion during normal Import. The retained matcher stack does not identify the original construction stack or inset values. It is not a VM-discovery timeout. No speculative application padding clamp is delivered.

Pinned Flutter3.44.8 material dialogs derive padding from MediaQuery viewInsets plus default positive dialog margins. The application TaxImportDialog uses that default AlertDialog; no application negative inset override was found. Non-finite/negative transient geometry is a hypothesis requiring original geometry, not an established root cause. Nearby native keyboard-hide logs do not establish Dart inset values.

Exact-main4d981566c4a43200d4ddeefb29396c31761cc10e run39577989927 passes all six phases. The committed verifier was independently rerun against its raw artifact and reproduces verification.json byte content; receipt SHA256 is80e70d58dccaede2661e6093f3f69e4a8be592b97815523b75a503a8f90a36d5. No framework_failure record is present. This pass does not resolve the earlier assertion.

PR174 candidate aeab808b25d7c64feb422c1e51d4aea0b0bab702 fixes a proven diagnostic defect: NaN/infinite geometry could prevent JSON encoding and lose the failure evidence. It serializes these numbers as explicit strings, retains finite negative values and bounded containers, forwards identical original framework error details and never marks a failure accepted. Twenty focused diagnostic/import/driver tests and static analysis pass. Three additional synthetic focus/Cancel probes precede the original legacy Import and assert no import/calculation from cancellation; they are test-only changes, not a runtime inset correction.

Both candidate native application runs fail before reaching those probes:

| Run | Outcome | Observed boundary |
| --- | --- | --- |
|39580042533 | failure25m35s | prepare/write pass; read VM discovery expires after60s |
|39580048829 | failure24m1s | prepare/write pass; read VM discovery expires after60s |

Each retains three completed empty backfill queries, no authenticated VM announcement and no Dart phase/framework-failure record for the failed read. Exact verified Runner PID/container checks succeed; loopback listeners are present. Those ports are diagnostic evidence only; no URI or authentication token is inferred or queried. The launch includes `--start-paused`, so the blank application image before attachment cannot establish an engine hang. The broad post-failure application-history command itself times out; absence of its output is not absence of application logs.

The read-only native sampler completes sampling then stalls at symbol processing until the existing20-second command bound. It retains no usable stacks. Failure artifacts are `.artifacts/geometry-probe-39580042533/` and `.artifacts/geometry-probe-39580048829/`, with original workflow logs beside them. All records remain labelled non-acceptance. The candidate is left independently reviewable in PR174; its failed startup gates are not waived or renamed as padding reproduction.

Next evidence must preserve pinned binaries, bundle manifests, complete original files and all deadline/identity/authentication checks. Compare the passing and failed startup channels first; supplement diagnostics without using unauthenticated discovery or guessed ports. Require actual original Import geometry/stack before an application correction and all six original native phase receipts before native closure. Keep the separate web pagination rollout and its browser observations distinct.
