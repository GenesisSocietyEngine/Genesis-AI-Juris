# Mobile application acceptance continuation

## Outcome and boundaries

Base: canonical main `bc093010bef5ffa9476aac2d68e7b2b19ebf39d5`, after ordinary merge of PR #68. The root checkout's unrelated changes remain untouched. This slice adds application-level evidence alongside the existing native XCTest gate. It must not replace that gate or treat a build/upload as an executed test.

The intended user outcome is edit → calculate through Rust → save → terminate the application process → relaunch → reopen, with identical saved inputs and freshly recomputed results. The new `iOS Tax Application` workflow uses a freshly created simulator, the production `JurisApp.catalog`, real `NativeScenarioBridgeClient` and actual application-support stores. Pass-through observers retain native exchanges and await real workspace writes; no financial calculation or storage is mocked.

The selected integration test enters EUR 250,000.00 and 200,000.00 in the real editor. Each phase must execute exactly one successful native calculation, yielding annual saving EUR 50,000.00 and lifecycle benefit EUR 500,000.00. It saves twice and compares the complete revision-bound sidecar, scenario, workspace progress and native request/response across the two processes. The write phase refuses an existing workspace instead of clearing it. The read phase requires the same source SHA and run nonce, retained proof and a different OS PID.

The driver requires the selected test to pass and validates one nonempty PNG plus source-bound JSON for each phase. The orchestration records tool versions, simulator/runtime, archive and Runner hashes, verifies the exact native exports after each build, checks the live PID belongs to Runner, explicitly terminates it with `simctl`, and proves process absence before the next phase. `--keep-app-running` prevents Flutter Driver cleanup from uninstalling the app. A second installation updates the same simulator application without explicitly clearing its data; the required persisted proof and equality checks fail if persistence is lost.

The existing `iOS Native FFI` workflow remains enabled with both archive audits and `RunnerTests.testNativeLogisticsLifecycle()`. CI artifacts are retained for 14 days and must be downloaded with source/run/job/digest receipts after execution.

## Review and current evidence

- Before promotion, independent static review checked the observer boundary, awaited Save completion, actual storage/native calls, cross-process assertions and driver evidence requirements.
- Tracked test and driver: Dart formatting passed with zero changes; focused analysis passed.
- Workflow YAML and every embedded Bash step parsed successfully; runner `bash -n` passed. These are static checks, not iOS execution evidence.
- The actual macOS application run is pending. Its executed result, source SHA, run/job IDs and retained artifact will be recorded after terminal completion.

Programmatic field entry exercises application behavior but does not establish mobile keyboard typing, clipboard or accessibility acceptance. Incomplete drafts, legacy/future imports, interrupted workspace and sidecar writes, enlarged text and screen-reader journeys require their own explicit receipts. Physical-device checks remain open per the user's instruction to use CI and emulators. No mobile distribution or product-release acceptance is claimed.
