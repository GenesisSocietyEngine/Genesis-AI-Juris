# CV-032: exact-process xcodebuild abort evidence

20 November 2026. Started clean on #348 ba43d670; candidate branch codex/cv032-xcode-abort-report starts from merged main 4224ed8c. #348's last native gate remains pending; its checks are not modified by this branch.

## Confirmed gap and intended outcome

Retained failure 44628210735-1 reports xcodebuild PID 40932 aborting with signal 6 / exit 134 before worker assignment. Its result bundle contains only an empty scheduling log; the clone collector correctly refuses to guess. No host crash report is retained, so the abort's reason remains unknown. The change addresses that missing evidence, not the abort itself.

Apple documents the IPS two-JSON-object format and process identity/time fields: https://developer.apple.com/documentation/xcode/interpreting-the-json-format-of-a-crash-report . Match procName, pid, procPath, procLaunch and captureTime rather than copying all host crash reports.

## Implementation and acceptance

The existing pipeline invokes xcodebuild through a small exec wrapper that records its PID and UTC start epoch in a new, non-overwritable attempt identity file. exec preserves PID and all original arguments. Pipeline exit/capture handling, selected-test proof, bootstrap retry classification and limits remain unchanged. The shell test checks that the recorded PID equals the executed tool's PID and that an existing identity prevents execution without overwriting evidence.

A failure-only bounded step recognizes only the latest completed attempt with exit 134 and successful log capture. It checks the recorded PID/start against phase completion, then inspects only xcodebuild*.ips under the two standard host DiagnosticReports locations. Require report type 309, xcodebuild executable under an Xcode application, matching PID, launch time within the execution window (two-second recording tolerance) and crash time within that window. Refuse ambiguity; retain only one matching report, never unrelated host reports. Scan limits: ten seconds, 64 candidate names, four MiB per report, eight MiB total reads; outer step limit one minute. Missing, delayed, malformed or over-budget evidence yields an explicit non-acceptance receipt. No report is available retroactively for the disposed failed runner. The overall job limit stays unchanged.

Six selector tests cover exact capture, wrong identity/time/path, absent/non-abort/stale attempt, malformed and oversized files, ambiguity and count-budget exhaustion. Existing lifecycle checks plus the PID-preservation and stale-identity checks verify the wrapper. Hosted macOS execution and actual crash-report availability remain pending. The collector is diagnostic only; it never turns a failed native test into a pass. No production deployment; v229 unchanged.

Local verification: all six report-selection tests and 21 isolated lifecycle cases pass. The latter includes recording the executed tool PID and refusing a pre-existing identity before tool execution. Diff review passes.

## Integration and hosted verification checkpoint

#348 merged as `203edc27e79cafb3674fb58a3f00fa4eef45c984` after all 18 checks passed on `ba43d670d6abb6479430f182c2597c387668bc6d`. Native push 44649898700 and PR 44649934474 pass the selected lifecycle on attempt 1. Both editor artifacts (44649898863 / 44649934497) independently pass the six-process verifier for that source.

Candidate #349 implementation `d34a08ce13b721e3be108db768a8f89bc86db4e7`:

- Push native 44654171516 passes on attempt 1. Identity file records PID 31200/start 1795139464; the hosted completion log independently names xcodebuild[31200:90551]. Selected lifecycle passes at 01:55:23 UTC with Runner PID 33977.
- PR editor 44654236916 independently verifies process PIDs 18746, 22051, 23489, 26774, 29853, 32749; bundle SHA256 `1f36d4f2153c38bfebc5f9dfc17f6a419cba0231580c27649c0f87915d971e64`.
- Push editor 44654171647 independently verifies process PIDs 19621, 22401, 24522, 27549, 30281, 33002; bundle SHA256 `a4cd819df00428eef4b787e87d9cc01365fb45c3db82c9305f195ef44f6b3652`.
- Both native regression steps pass six crash-selector tests, nine existing clone-selector tests and the published 21-case lifecycle suite. PR native 44654237016 failed its lifecycle step; details below.

An additional regression preserves exit 134 as failure with no bootstrap retry: all 22 isolated shell cases and six report-selector tests pass locally. This test and reconciliation with main require fresh CI; prior green checks apply to the source explicitly identified above. No crash cure is inferred from healthy runs. Actual matching hosted IPS capture remains pending. Next action: retain and inspect a matching report on the next pre-worker abort, or inspect clone diagnostics for an assigned-worker stall. No release; public v229 unchanged.

### Retained PR native failure 44654237016-1

The lifecycle step reached its 15-minute limit. Its retained phase log records preparation success, then attempt 1 ending at 01:57:10 UTC with xcodebuild exit 65/capture exit 0. xcodebuild PID 29402 reported Runner PID 31592 crashing with signal abrt before test execution, followed by the recognized pre-test bootstrap failure. Recovery begins at 01:57:10 but no attempt-2 start is recorded before the deadline. This is not the original xcodebuild exit-134 abort. The present evidence narrows the later timeout to simulator recovery but cannot identify the exact shutdown/erase/boot/bootstatus operation or initiating Runner crash cause.

The new failure-only collector executed successfully and returned `acceptance:false`, `identity_not_verified`, reason `Current attempt is not a recorded xcodebuild abort`; no unrelated crash report was copied. The existing worker selector returned `identity_not_verified` for missing/excessive worker records and sampled no guessed device. The complete artifact is retained locally under `cv032-followup/evidence/349-native-pr-failure`. No passing retry or behavioral cure is claimed. Candidate CI is not all green; a new reconciled-head run is required before merge. Preserve this failure when comparing subsequent runs. CV-032 remains open.
