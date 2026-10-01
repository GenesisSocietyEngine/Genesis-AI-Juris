# Bound preparation and application execution separately

The application harness now gives its once-only Flutter build a 900-second preparation limit and each of its six runtime phases a separate 300-second limit. The overall exercise remains limited to 30 minutes and the job to 45 minutes. This explicitly changes the first phase's accounting: preparation no longer consumes the first application's runtime allocation. Exhausting the overall exercise limit still fails the run; the individual maximums are not a promise that all maximums can be consumed.

## Observed trigger

At source `040c5805e09531eed45baee4198669b0e2d5c9d4`, PR application run `36781641581` / job `110113073766` completed its build, installation, structured-log discovery and `getVM` identity checks. The selected destination produced effective Simulator settings `ARCHS=x86_64` and `ONLY_ACTIVE_ARCH=YES`. Xcode reported 526.3 seconds; the complete Flutter build reported 789.380 seconds. This establishes the selected architecture in the build settings, not a general performance improvement.

The retained install record proves exit zero in 27.615 seconds. Runner PID 49560, its exact executable, authenticated announcement and returned VM PID agree. Built and installed full manifests match SHA-256 `8afead7b10436fbcae9ac819b53e8a80eac29801ed834d7df7cd14352b3ea4ef`.

The combined first-phase deadline began at 21:54:16.101540Z. Hosted log arrival records the Dart driver invocation at 22:08:41.882805Z, about 34 seconds before its nominal deadline. Hosted output can be buffered, so this is an approximate remaining-time observation rather than an exact driver-start measurement. The outer timeout returned 124 and retained `cleanup_incomplete` / unknown process-group state; successful cleanup is not inferred. No selected-test output or completed phase receipt exists. Driver compilation, connection and request progress cannot be distinguished from this evidence, and its own four-minute timeout could not mature within the remaining outer time.

The terminal failure at 22:10:59Z is retained under `.artifacts/pr68-ios-2026-09-30/ios-application-v2-destination040-pr-36781641581-attempt-1/`. Artifact `11128866088` contains 253,535 bytes, ZIP SHA-256 `802cf6a7d2963ae54a6f667c95584faf22e861311ffbdc1a54c91b5f99a84a75`. Complete job-log SHA-256 is `9657851091f6df6d940e39bb88b470b496406c6c9dfa33f80e2d2c85636f6aa2`. The same head's separate native jobs passed both export audits and the selected XCTest; they do not replace this failed application gate. The push application's earlier readiness-fixture failure is recorded in `DEADLINES.md` and corrected by its separate reviewed precursor commit.

## Preparation and runtime contract

The host runs `prepare` once under the dedicated 900-second process-group deadline. The normal Flutter build command retains debug Simulator mode, target, exact selected UUID, source/nonce defines and ordinary Rust build integration. A retained start record precedes the command. Only actual exit zero and a complete application manifest can produce the completed preparation proof. Timeout, failure, a missing application, or existing preparation evidence cannot be treated as a completed build.

Every runtime phase verifies the preparation source, nonce, Simulator, target, exact command, actual exit status, timestamps and full manifest before any installation or launch. Its launch record binds the exact preparation proof hash. Changed, missing, failed or stale preparation fails closed. Runtime execution never invokes a build.

The current same-bundle installation before each phase is preserved, including its explicit 120-second command limit and command-exit proof. This correction does not introduce first-only installation or change application data-container lifecycle. All six complete input/native response comparisons, saved-pair checks, incomplete-draft errors, retained legacy object checks, selected-test markers, distinct process/termination proofs, full bundle comparisons and per-architecture export audits remain mandatory. The independent universal/prepared archive and native XCTest workflow is unchanged.

The offline verifier additionally requires the completed 900-second preparation invocation, its frozen proof, and a separate completed 300-second invocation for every phase. An uploaded artifact, completed build or partial phase sequence cannot pass.

## Validation and remaining evidence

All 48 portable phase controls pass locally. They include actual Bash orchestration with fake tools proving preparation failure prevents every runtime phase and the first runtime receives its own 300-second wrapper, without simulating a passing application assertion. Additional controls cover failed/aborted builds, missing application, stale source/nonce/Simulator/target/command, changed manifest/application, duplicate proof keys and nonfinite elapsed values; each prevents installation/launch. The existing five-later-phase control still proves bundle reuse without rebuilding. No macOS application execution is claimed by these controls.

Root and independent peer source reviews passed, each independently rerunning all 48 controls. Bash syntax and whitespace checks pass. Fresh CI must pass all applicable gates and explicitly execute all six application phases. Physical-device, spoken accessibility, iOS future-format and genuine interrupted-write acceptance remain separate.
