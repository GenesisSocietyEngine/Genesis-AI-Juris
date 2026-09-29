# Aggregate baseline receipt independent review

2026-09-27. Read-only review of `scripts/verify-release.sh`, the ignored aggregate wrapper/parser, baseline receipt/source receipts, and the complete aggregate log's stage markers/summaries. No gate rerun or source mutation.

**Result: the retained baseline receipt accurately describes the observed completed gate scope.** It is pre-P1-fix evidence, not approval to publish and not a pass for the separately reproduced authorization race or incomplete acceptance journeys.

The raw log is `.artifacts/amendment-release-gate/aggregate-6ab091d830ccfd9d6b76c0adc177341bca96e081-20260927T203936Z.log`: independently read length **343,947 bytes**, SHA-256 **aa108160d57728302601dc1ec305cc2df9154fb5ebf50baf0413f2707dab1b18**, both equal the receipt. It begins with the exact clean web HEAD `6ab091d830ccfd9d6b76c0adc177341bca96e081`, tree `304691141ac66bf456e02aed1a21b4d6596fc05d`, 1,538 tracked files and tracked-byte digest `00086da019493d75ce259c4601e40f8f204b81be1edc7e451bd00fbaa04d9d3b`.

All ten web, nine mobile and three native stage markers occur. The final mobile tracked-byte guard reports exact `5200b30cc50c77393c6f48b52ce91c0f30e70c64`; the final web guard is followed by the terminal release-verification PASS. The gate uses `set -euo pipefail`, runs its commands without suppressing failures, and compares the complete before/after web checkout receipt. Its wrapper also uses `pipefail` around `tee`. Exit 0 is the root agent's observed tool completion supplied to the receipt parser; this reviewer did not independently observe that historical tool invocation, but the terminal log/unchanged gate structure corroborate completion.

| Scope | Independently reconciled raw result | Limit |
| --- | --- | --- |
| Web test suite, web stage 4 | 915 total, **912 pass, 3 skip, 0 fail/cancel/todo** | The earlier 2/2 build-entry summary inside this stage is not substituted for the final suite or added to it. |
| Dossier E2E, web stage 5 | **5/5 pass** | Separate repeated required scenario run; not five new browser/hosted checks. |
| PDF verifier, web stage 6 | **47 PDFs, 758 pages and 758 rendered PNGs**; **55 golden PNGs**, baseline digest `bac3a7bdebd662edd043a297e39c1c4000716327ac110b0db7453b1d8a3323c8` | Automated structural/text/render/golden checks. No claim of fresh visual human inspection of all 758 pages. |
| Production audit, web stage 7 | **0 vulnerabilities** | The stage is `npm audit --omit=dev`; do not relabel this as the separate full dependency audit. |
| Flutter tests, mobile stage 6 | **275 tests passed** | Parsed from the final `+275: All tests passed!` inside that stage. |
| Rust workspace tests, mobile stage 9 | **359 passed, 0 failed/ignored across 73 result groups** | Independently summed result lines within the Rust stage; zero-test/doc-test groups remain groups, not extra tests. |
| Android native integration, native stage 1 | **12 passed** | Local x86_64 debug emulator/FFI smoke, separate from the 275 Flutter tests; no hardware/release-APK claim. |
| Hosted evidence lock, native stage 2 | Four stored successful workflow entries match mobile `5200b30` | The gate validates committed evidence fields, not fresh hosted execution or an iOS run on this computer. |

The three skipped web tests are the retained migration-rehearsal cases: exact v91 on C1 schema; legacy request-operation receipt SQL guards; and current B1 write/recovery after C1/v91 writes. Keep them as SKIP. Lint has **0 errors and 3 warnings**, including the archived viewer-suspension script's unused readiness binding; this run must not be described as warning-free or as having only the two earlier warnings.

The post-gate source-bound receipt at `21:37:34.648Z` binds commit `6ab091d` to application digest `25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec`, hosting-config digest `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`, and 385 inputs matching the built input digest. The earlier `21:37:22.003Z` source receipt reported `sourceCommit: unknown`; preserve that historical receipt and use the separately bound one for the explicit commit claim. The log's checkout guard independently identifies the actual tested HEAD.

`seal-aggregate.mjs` is an observation parser, not an independent gate: it takes exit code and HEAD as arguments, accepts terminal PASS plus exit zero, scopes TAP/Flutter/Rust counts by stage, and writes with exclusive creation (`wx`). Its PDF numeric fields are fixed constants, gated by matching verifier log strings; they happen to match this raw log exactly. It does not assert every count/stage as a reusable acceptance contract. Therefore future runs must still retain and review their raw log, not rely on this JSON alone. No unsupported count in the present receipt was found.

This baseline predates the new Matter read-fence patch. A new source/build identity and appropriate rerun are required for the changed candidate. The baseline aggregate does not close source-v2 browser selection, reassessment/new reviewed PDF journey, hosted candidate verification, accessibility, human comprehension or release authorization.
