# Build the selected Simulator application

The first application build now passes the already selected, isolated Simulator UUID to Flutter with `-d`. The intended outcome is a build for the same destination used for installation and all six application phases, within the existing time limits. This is a source correction awaiting macOS execution; no build-time or architecture improvement is claimed from local controls.

## Observed failure and retained success

At source `60c62862f72449e3d87d23ff85935a1b621f77b7`, push run `36772414350`, job `110081843927`, passed all six phases. Artifact `11126140650` has ZIP SHA-256 `bee8670e08a358f156313ea0d8a8ee6509fda63812bcc2d6d5d0587dc1c6ce34`. The exact committed offline verifier passed the complete native exchanges, saved pairs, process changes, incomplete draft, and retained legacy record. Its first phase took about 820 seconds, including the build, installation, and application test.

PR run `36772419405` failed during the initial build twice, before any installation, Runner launch, VM connection, or selected test. Attempt 1 job `110081861356` retained artifact `11125443230`, ZIP SHA-256 `2d0356ff3db8ab939de20c8bb5ecb364ebc5baf38256bf9a2bc31b6be2acbeec`. Attempt 2 job `110096152290` retained artifact `11127388295`, ZIP SHA-256 `4d3afe0af858de301bc590d2061f0a7a41a5c3aab68a22c693203590e0f7cecb`. Both reached the 900-second first-phase deadline; neither produced a completed build or phase receipt. The initiating reason for the slower PR builds is unproved.

All three verbose builds selected a generic Simulator destination and reported `ARCHS=arm64 x86_64` and `ONLY_ACTIVE_ARCH=NO`. Each performed one package-resolution invocation, taking about 160–165 seconds. The logs do not establish repeated package fetching. The successful build produced and audited both architectures; the failed builds did not reach an auditable final application bundle.

The source-specific captures remain under the repository's ignored evidence directory:

- `.artifacts/pr68-ios-2026-09-30/ios-application-v2-stable-vm60-push-verified-36772414350-attempt-1/`
- `.artifacts/pr68-ios-2026-09-30/ios-application-v2-stable-vm60-pr-36772419405-attempt-1/`
- `.artifacts/pr68-ios-2026-09-30/ios-application-v2-stable-vm60-pr-retry-36772419405-attempt-2/`

## Supported correction

Pinned Flutter `3.44.8`, commit `058e0af2c2b57e369d905a03ac9748b0ebf543c6`, forwards the global device ID from [`BuildIOSCommand`](https://github.com/flutter/flutter/blob/058e0af2c2b57e369d905a03ac9748b0ebf543c6/packages/flutter_tools/lib/src/commands/build_ios.dart#L986) to the [Xcode destination](https://github.com/flutter/flutter/blob/058e0af2c2b57e369d905a03ac9748b0ebf543c6/packages/flutter_tools/lib/src/ios/mac.dart#L425). The project Debug configuration already sets `ONLY_ACTIVE_ARCH=YES`. Apple's [build settings reference](https://help.apple.com/xcode/mac/current/en.lproj/itcaec37c2a6.html) explains that a generic destination causes that setting to be ignored. Selecting the specific UUID therefore permits Xcode to apply the existing destination-specific configuration. The next hosted log and actual archive audit must establish the resulting architecture and timing.

The correction adds only `-d <selected UUID>` to the initial normal Flutter build. It preserves the debug Simulator mode, target, source/nonce defines, Flutter preparation and Rust build pipeline, first-phase 900-second limit, subsequent 300-second limits, 30-minute exercise limit, and 45-minute job limit. Later phases still reuse the complete compiled bundle. No architecture override, timeout increase, assertion removal, or independent native-workflow change is included. Every architecture actually present in the application archive remains audited, and the separate native workflow retains its universal and prepared archive audits and selected XCTest.

## Review and validation

Portable controls pass: 42/42 tests in `test_run_ios_tax_phase.py`. The lifecycle controls require the exact selected UUID in both build and drive commands, retain target/source/nonce arguments, prove a failed initial build cannot install or launch, and exercise all five later phases without another build while comparing their bundle to the first bundle. The exact-destination control fails against the previous production source. Related diagnostics controls pass 13/13; deadline controls pass 9 with 2 POSIX-only cases explicitly skipped on Windows. These controls simulate tools and do not establish macOS behavior.

Root and independent peer source reviews passed, each independently rerunning all 42 phase controls. Fresh hosted gates remain pending. Acceptance still requires all applicable checks and terminal executed success for all six application phases on the corrected source. Physical-device, spoken screen-reader, and iOS future-format/interrupted-write application acceptance remain separate.
