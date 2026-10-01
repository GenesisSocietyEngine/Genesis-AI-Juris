# Owned live system-log replay

The intended outcome is to replay complete records from the deliberately closed
macOS live log reader, while continuing to refuse malformed records or an
unverified VM identity. This changes the future-data evidence verifier only.
Application assertions, source/nonce/PID binding, authenticated VM URLs, finite
backfill validation, deadlines and cleanup requirements remain unchanged.

## Retained exact-source failures

Both executions used `7a9709bc59561ab6ddb299e6fb3f5d8f7f0876fb`, tree
`9a92e22d6bdf005ffdae9b3610e377d47c62d586`, attempt 1. Both ran 229 macOS
controls: 226 passed and three expected platform-negative controls skipped.
The actual POSIX controls and all 16 Dart protocol controls passed.

| Event | Run / job | Diagnostic artifact | SHA-256 |
| --- | --- | --- | --- |
| Push | `36792796325` / `110149325459` | `11132681530`, 3,405,401 bytes | `bba19ed2d177141c4801efaa7d9a71db7af35a2c8338a4fe980416079f63ea62` |
| Pull request | `36792801113` / `110149346332` | `11133417511`, 4,430,085 bytes | `3705b0f6326c42c806f1123d064fd4d7b89d276139cfa46055869d661184b1ff` |

The push inventory selection succeeded in 46.448 seconds within its 120-second
allowance. Creation, boot and boot-status commands completed successfully. The
subsequent `after_boot` device-list query failed with exit -9, `timed_out: true`
and no output. Its recorded allowance was 30 seconds; start-to-terminal wall
time was 45.258 seconds. The reason for this delay remains unknown. No build or
application phase started. This correction does not change that deadline or
claim to resolve that failure.

The pull-request inventory query completed in 8.833 seconds. Preparation built
the application successfully in 467.657 seconds. The selected test
`production application future data preservation` executed the `baseline-write`
phase in Runner PID `66943`; its direct Dart driver exited 0 and the host recorded
process absence. The phase then failed during host ledger validation with
`System log truncated`. Its outer process exited 1, no phase ledger was committed,
and none of the following nine phases executed. It is not accepted ten-phase
evidence.

Both failure paths retained successful scoped shutdown and deletion of their
newly owned Simulator. Independent review found each final full device inventory
byte-identical to its original 127-device inventory. Cleanup success does not
convert either application failure into acceptance. API source/size/digest, ZIP
CRC and all extracted bytes were checked (55 push files, 160 PR files). Local
receipts remain under `.artifacts/pr68-ios-2026-09-30/pr80-7a9709b-future/`.

## Grammar and bounded correction

The PR's 894,913-byte live stream contains the normal filtering header, an opening
array and 597 complete event objects. It ends after the complete final test event
without a closing array bracket. The owned reader's stderr records termination
with signal 15. This matches its deliberate host shutdown after the driver and
Runner checks. The pinned `JsonLogObjects.feed(..., final=True)` accepts this
complete-record boundary and still rejects incomplete objects, a dangling comma,
or trailing garbage. The existing six-phase verifier uses that same live-stream
rule; only a successful finite `log show` backfill must close its array.

The future replay had added an extra outer-array closure check to the live
stream. Removing that check leaves strict UTF-8 parsing, complete-record parsing,
exact raw-to-wrapped event equality and all authenticated VM PID/path/time/source
checks in place. It does not append bytes to retained evidence or ignore invalid
records. Finite successful backfill still requires its closing bracket.

The reduced fixture retains the observed header/open-array/complete-record shape
with entirely synthetic process and VM identities. Its positive ledger-commit
and resume control failed on the original code with the same hosted exception.
Five focused control groups then passed with the correction, including malformed
tails, identity mutations, missing wrapped events and unclosed finite backfill.
The complete host-bindings suite passed: 34 controls, 32 passed and two actual
POSIX filesystem controls explicitly skipped on Windows (134.348 seconds).
Its retained local log is `.artifacts/stream-replay-bindings-tests.log`.
All 20 final-verifier controls also passed (12.161 seconds); `git diff --check`
passed. These local controls do not substitute for a successful macOS journey.

A read-only diagnostic replay of the actual retained PR transport now passes
all existing transport assertions with the correction. The original ZIP, logs
and receipts were not changed. This local replay does not replace the failed
outer exit or manufacture a missing ledger. Fresh exact-source ten-phase CI,
native export audits, restoration, owned-device deletion and independent final
verification remain required.
