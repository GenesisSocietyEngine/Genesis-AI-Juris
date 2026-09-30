# iOS application journey continuation

## Source and intended outcome

This dependent branch starts from PR #69 candidate `2eac66e109d95b14ca303eb6c21de63f3e7538a8`, which includes canonical main `99805a9f7b36d53dffd5aaee282a011efa9e30d1`. The independently tested PR #69 head remains unchanged. This branch is not accepted main evidence and cannot be merged before its prerequisite and its own applicable gates pass. The root checkout's unrelated changes remain untouched.

Users must be able to save and reopen complete or incomplete tax drafts, retain imported originals and converted legacy data, and see a fresh Rust result on a supported completed draft. The previous iOS harness proved the amounts journey across two phase-specific builds. This continuation must run one built application bundle through six separately terminated processes: amounts write/read, incomplete write/read, and legacy rates/FX write/read.

Acceptance requires the selected application tests to execute, exact source/nonce identity, confirmed completed Save, host-verified old-process absence before each new PID, matching whole saved artifacts/scenarios/progress for each pair, fresh real native calculations where applicable, and retained screenshots and native exchanges. The incomplete path must both execute a real native missing-base error and retain a blank rate without inventing a result. Current provenance edits must not mutate the retained converted legacy request or its hashes.

## Implementation under review

The app determines its next phase from a source/nonce-bound proof in its isolated application-support directory. The host driver independently expects a particular phase. The first phase still refuses existing workspace/sidecar data. Subsequent phases use the exact same built `Runner.app` through Flutter's supported prebuilt-app path; Flutter 3.44.8's local `IOSApp.fromPrebuiltApp` explicitly accepts an `.app` directory. No phase is selected by a compile-time Dart define.

The host hashes every bundle file plus symlink identities and requires the full manifest to remain identical after every launch. Hashing Runner alone would not establish an unchanged Dart/assets/framework payload. Each phase retains binary hashes, an exact native export audit, a validated PNG and complete JSON evidence, then explicitly terminates the application and verifies process absence. A separate Python verifier checks the six phase identities, previous PID chain, full pair equality, expected native calls/errors, exact legacy originals and complete converted-record preservation. Uploading an artifact does not establish success.

Programmatic field entry remains programmatic entry. This slice does not claim OS keyboard typing, VoiceOver speech, physical-device acceptance, future-envelope replay, controlled interrupted writes or aggregate transaction recovery. The native XCTest workflow and both of its export audits remain enabled.

## Initial executed failure and correction

Exact initial head `8791bc1c839f66f6a5fd80a1762884135bb5a960` failed [application push run 36726239719 / job 109923723528](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36726239719/job/109923723528). Xcode built successfully in 328.6 seconds and the VM connected, but only `(tearDownAll)` ran. The application then reported `Can't call test() once tests have begun running` at the delayed `testWidgets` registration. The driver rejected missing screenshots and produced no phase receipts. Artifact `11103193846`, ZIP SHA-256 `b57695e629a84c182c894a6f505c8eef83f5cabcaa4539976e09c5b6a5716826`, and the complete job log are retained under root `.artifacts/pr68-ios-2026-09-30/ios-application-v2-pr72-push-36726239719-attempt-1/`.

The earlier static review inspected a Flutter test-loader path that awaits asynchronous main. `flutter drive` launches this harness as an application entrypoint; that review did not establish registration behavior on the actual launch path. This is a harness defect, and no application acceptance is claimed for that source.

The correction registers one constant selected test synchronously: `production application tax journey across process restart`. Source/nonce checks, plugin lookup and phase discovery now run inside that already registered test body. Every proof and host report requires this exact selected-test identity, phase, source and nonce. The host requires the actual test name, `All tests passed.`, and the validated phase-specific completion marker; all previous process, bundle, artifact, native-call and export checks remain. Independent review of the corrected registration and driver found no material issue; actual six-phase execution remains required.

The initial head's PR web run `36726298585` / job `109923925147` separately failed three dossier integration tests: the first expected a governed error code but received none, then two Miniflare synchronous-proxy assertions failed. Same-source push web run `36726239793` / job `109923723825` passed. Failure diagnostics `11103222415`, SHA-256 `51981a243ddca34b98d28a76488f4fda6f23ca3b0a4634e5a7a169782e06413e`, were downloaded and verified. Its root cause is not established; fresh corrected-head CI must pass all applicable checks without weakening them.

## Verification status

- Host-script Bash syntax and Python compilation checks passed. They are static checks only. Python runs in isolated mode so environment optimization cannot disable the verifier's assertions; the host also requires the integration driver's positive test-completion marker.
- Dart analysis and formatting passed; 14 focused import and confirmation regressions passed. Independent read-only reviews of both Dart files and the host script/verifier found no material issue. Local Flutter source confirms the prebuilt path skips Xcode rebuilding and that `--keep-app-running` avoids the normal driver-stop uninstall; the host then terminates the process explicitly.
- Corrected Dart analysis/format, host Bash/Python syntax and independent registration review passed. Actual corrected-source macOS execution remains pending.
- No six-process or unchanged-bundle iOS acceptance is claimed before those execution receipts are retained and verified.

## Separate corrected Android receipt

The prerequisite `2eac66e` correction separately passed actual Android legacy import/edit/save/cold-reopen. APK SHA-256 `011bf8493d4e61dd1c4a4c74c792c5229528518d063b52bf565013c7dbddd74c`, 96,870,459 bytes. PID `18337` was proved absent before `19167`; fresh full native requests/results matched. Saved/reopened artifact SHA-256 `3a4ba3591702e59091bece460c38abb2cd00947ae8b8470bfc229ab35cc2c686`. The complete retained native legacy record remained equal, canonical record SHA-256 `ce94ab5281dd5bcd9c7524e678da8920516ac7b95637fded7e02b07035afbc77`; active owner/date changed while retained owner/date stayed null. The original raw JSON and FX fields also remained exact.

Root receipt `.artifacts/pr68-ios-2026-09-30/android-legacy-copy/journey/journey-result.json`, SHA-256 `26d4b62f48d9c9bbadee538eddedc31704ee3e8ca8e73d1e1f52ac02b39d8866`, was independently checked by its verifier. All synthetic files and secure/system settings were restored. This Android receipt is not iOS execution or controlled interruption evidence.
