# Application launch failure diagnostics

Outcome: retain enough bounded, read-only evidence to distinguish Flutter launch,
Simulator/application state and test execution after a failed application journey.
Acceptance requires verbose phase output, isolated-Simulator diagnostics before
artifact upload, explicit command time/output limits, and unchanged test/export
acceptance gates. Diagnostic collection itself never establishes a passing test.

Base: PR #72 head `99148347e414455fca6e607b8842f317080c9f91`, inspected after
PR run `36729752681` / job `109936087926` failed its 30-minute application step.
Write and read executed the selected test and passed, with distinct processes
33485 and 38842 and process-absent proof. The incomplete-write phase launched but
its log was empty. Six-phase acceptance remains false. Retained artifact
`11106746937`, SHA-256
`e6f212c2694db0e8cabc9df6c4c7abe63929f68b7aeb76f3720618688331bd56`.
Earlier two-phase application failures sometimes stopped after a successful
Xcode build without VM-service/test evidence; a successful build is insufficient.

The correction adds Flutter verbose logging and a failure-only collector before
the existing always-upload step. The collector accepts only a specific Simulator
UUID, records tool failures/timeouts without inventing success, and limits each
tool to 20 seconds, the whole collection to 120 seconds, and each retained text
log to 4 MiB. It collects host process names (no command arguments/environment),
Flutter cache lock holders, isolated application/launch-service/log state and a
screenshot. It does not mutate, relaunch or clean application storage. Whole-job
cancellation can still prevent failure steps; the existing upload remains always.

All six selected-test, full-native-exchange, bundle-identity, archive-audit and
process-termination checks remain mandatory. No retry or timeout is converted to
acceptance.

Local verification: six Python controls passed for retained nonzero exits,
terminated hangs, fast excessive output, exhausted overall budgets, missing tools
and rejection of the non-isolated `booted` selector before any write. Bash syntax
and diff whitespace checks passed. Independent mobile-agent review found no
material issue; its separate normal-output, truncation and timeout controls passed
(deadline termination in 0.436 seconds). These local checks do not execute macOS
Simulator commands. The workflow runs the same six controls on its macOS runner;
actual failed-run diagnostics and fresh application acceptance remain pending.
