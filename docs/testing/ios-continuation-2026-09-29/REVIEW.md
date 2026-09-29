# iOS lifecycle preparation/execution separation — 2026-09-29

Status: independently reviewed CI amendment; real macOS validation pending.

## Observed failure

- Source: `7d8fe2741a7c1fda45fc23e5be88f6592c7c94c9`.
- Failed push run: [36604391579](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36604391579), job `109529582571`, attempt 1.
- Dependencies, the Flutter simulator build, the universal archive export gate and simulator boot passed.
- The combined `xcodebuild test` step rebuilt Runner and RunnerTests through 17:54:34Z before the timeout at 17:57:18Z. The retained log contains no actual selected XCTest result or assertion failure; it does not establish what happened throughout the final gap.
- The preceding Flutter build took about 7m09s, export verification 14s, simulator boot 3m52s; the timed-out lifecycle step occupied 15m43s including runner cancellation.
- The failed run remains unchanged. Separating preparation and execution isolates their budgets and improves diagnosis; it does not yet prove the compilation or test timeout is resolved.

## Bounded change

The [workflow](../../../.github/workflows/ios-native.yml) calls [one helper](../../../.github/scripts/run_ios_native_lifecycle.sh) for two phases:

1. `build-for-testing` creates a new run/attempt-owned DerivedData directory, explicit result bundle and log.
2. Preparation requires exactly one generated `.xctestrun` plus the RunnerTests bundle. It records the source, simulator and SHA-256 of the plan.
3. `test-without-building` consumes that exact plan and the same simulator, checking identity/hash before each attempt. Global or previous DerivedData is never selected.
4. Success requires Xcode exit zero, successful log capture and the selected lifecycle test's explicit pass line.
5. The existing single bootstrap retry remains restricted to a nonzero pre-test bootstrap failure. Assertion failures, zero-exit runs without a selected test pass, capture/timestamp failures and changed plans cannot authorize a retry.

The job remains bounded to 45 minutes and actual lifecycle execution to 15 minutes. Preparation is separately bounded to 15 minutes; the existing Flutter build/export/boot phases receive explicit 15/5/10-minute caps within the unchanged job ceiling. The overall job and lifecycle-execution limits are unchanged; preparation now has its own budget. Test selection and assertions remain intact.

The full Flutter simulator build and original per-slice universal archive export gate remain unchanged. Destination-specific preparation can produce a thin host-architecture archive, so the unchanged export verifier runs again against that prepared archive. This second check does not replace the original universal coverage.

Logs, phase timestamps, available preparation/attempt result bundles and plan identity/hash are uploaded with `always()` for 14 days. Partial files remain useful after a step timeout; upload is not guaranteed after runner loss or job-level termination.

## Local evidence and independent review

- Bash syntax checks passed for both helper and [orchestration tests](../../../.github/scripts/test_ios_native_lifecycle.sh).
- Primary execution: 13 groups / 17 isolated cases passed, exit 0 (24.34s). Independent execution: the same groups/cases passed, exit 0 (24.79s).
- These tests stub Xcode and simulator commands. The Windows test-only shasum adapter uses real SHA-256 via sha256sum; macOS uses its native shasum. Neither execution proves native lifecycle acceptance.
- Independent review identified and resolved conditional-shell failure handling, log-capture failures, retry eligibility and plan revalidation. Final source review has no blocking findings.
- The pass matcher was checked against actual retained Xcode 16.4 output in [successful run 36579888515](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36579888515), job `109444968071`: selected lifecycle test passed in 0.068s on 2026-09-29 at 14:27:03Z.
- Apple documents this build/test split in [TN2339](https://developer.apple.com/library/archive/technotes/tn2339/_index.html). The helper uses the explicit generated xctestrun form.

Run the local checks from the repository root:

```bash
bash -n .github/scripts/run_ios_native_lifecycle.sh
bash -n .github/scripts/test_ios_native_lifecycle.sh
bash .github/scripts/test_ios_native_lifecycle.sh
git diff --check
```

## Hosted acceptance still required

On the new source, record the run/attempt, source SHA, both export checks, successful fresh preparation, explicit selected XCTest pass, phase timings, and available artifact receipt. Distinguish push and pull-request runs. If preparation times out again, inspect retained compilation evidence within the existing limits; do not increase deadlines or weaken the universal gate.

This amendment changes CI orchestration only. It does not change the app, native ABI, persistence assertions, release version, web deployment, tax integration, migration/recovery acceptance or pilot evidence.

## Initial hosted definition rejection and correction

The first amendment source `3283778ff059dffedb2bd43a7b23a7902fae9571` was rejected before runner execution in [push run 36614503800](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36614503800), attempt 1. The jobs endpoint returned zero jobs, and no corresponding pull-request iOS job was created. No preparation or native test ran.

YAML parsing had missed a GitHub Actions expression-context error: `runner.temp` is unavailable in job-level `env`. This is an amendment defect, separate from the earlier compilation timeout. [GitHub's context reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability) permits it in step-level `env`.

Actionlint v1.7.12 reproduced the original definition error at line 16 and exited 1. The official Windows archive SHA-256 was checked against its release metadata (`6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9`). The correction moves the identical evidence path into the prepare, test and upload steps' supported `env` scopes. It changes no helper behavior, timeout or check. Initial failure history is preserved.

The corrected workflow passes actionlint's GitHub Actions schema/expression validation (exit 0; optional ShellCheck/Pyflakes integrations disabled because this check targets the workflow context). GitHub acceptance of the new workflow and actual native execution remain pending; local validation is not substituted for either.
