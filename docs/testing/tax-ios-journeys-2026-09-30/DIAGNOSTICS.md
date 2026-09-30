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

The unchanged-source push run `36729748124` / job `109935886713` also failed,
at `2026-09-30T15:45:08Z`. Its selected tests passed for write, read and
incomplete-write, with PIDs 37135, 40662 and 43609 each proved absent afterward.
All three phases used bundle manifest SHA-256
`c4868e0418f2370a153f14118f600de4a389c21ce1a327d6a2d29ac5a0e22c63`.
The incomplete draft exercised Rust `missing_tax_base`, retained the exact blank
rate and saved no calculation. Incomplete-read launched at `15:33:10.464500Z`
but its phase log remained empty through the `15:44:50.584400Z` timeout.
Retained artifact `11109161778` (536,446 bytes), SHA-256
`8f8f87a9d68a28fd0ef6e62fc85a076afbade80c8cdba3abbaa48fb4549b97f0`,
and independent prefix verification establish three phases only. The reason
the fourth launch stalled is unknown. No six-phase acceptance is claimed.

The diagnostic candidate reconciles canonical main
`33c5c7867acf70add458ebee926db17d89b69711`, which includes accepted PR #69.
These receipts describe the older PR head, not that main commit or the new
diagnostic candidate. Both older application runs finished before publication.

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
