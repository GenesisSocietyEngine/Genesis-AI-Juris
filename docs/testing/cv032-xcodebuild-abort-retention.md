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

The lifecycle step reached its 15-minute limit. Its retained phase log records preparation success, then attempt 1 ending at 01:57:10 UTC with xcodebuild exit 65/capture exit 0. xcodebuild PID 29402 reported Runner PID 31592 crashing with signal abrt before test execution, followed by the recognized pre-test bootstrap failure. Recovery begins at 01:57:10 but no attempt-2 start is recorded before the deadline. This is not the original xcodebuild exit-134 abort. The completed workflow log identifies recovery bootstatus for simulator 08AEF2F6-6BFD-48DC-9538-9B3FB7DE50B9 beginning at 01:57:51 and repeatedly reporting Waiting on System App from 01:59:14 until the 02:08:04 timeout. The initiating Runner crash and System App wait causes remain unconfirmed. The complete workflow log is retained beside the artifact as 349-native-pr-failure.log.

The new failure-only collector executed successfully and returned `acceptance:false`, `identity_not_verified`, reason `Current attempt is not a recorded xcodebuild abort`; no unrelated crash report was copied. The existing worker selector returned `identity_not_verified` for missing/excessive worker records and sampled no guessed device. The complete artifact is retained locally under `cv032-followup/evidence/349-native-pr-failure`. No passing retry or behavioral cure is claimed. Candidate CI is not all green; a new reconciled-head run is required before merge. Preserve this failure when comparing subsequent runs. CV-032 remains open.

## #349 final integration and Runner recovery audit

20 November 2026. Clean checkout began on 70c72e767e1b6618e8d54005e8ba0a50c2d07081; canonical main was 203edc27. All 18 checks passed on #349, which merged as baefbb6098c78d1fb8895b7a5bdb67bc532f67b0. Follow-up branch codex/cv032-runner-bootstrap-audit starts from that merged main. This iteration changes audit records only; no product or workflow behavior changes.

### Exact-source hosted acceptance

- Native PR 44658970989: selected test passes on attempt 1 at 02:24:22 UTC, Runner PID 28255.
- Native push 44658966954: selected test passes on attempt 1 at 02:26:04 UTC, Runner PID 29604.
- Both native regression steps pass 22 orchestration cases, nine worker-selector tests and six crash-selector tests. These macOS checks cover the final source, including the added abort-status regression.
- Editor PR 44658970918: independently verified six-process PIDs 17664, 20304, 23618, 26297, 27662, 30302; bundle SHA256 2a2a17e820393420d4303bc0763f68bbedbdf8db95da10a45e597b95450c0dc6.
- Editor push 44658966979: independently verified six-process PIDs 20731, 25926, 28590, 30553, 33185, 35818; bundle SHA256 ea85396810f6a87803f991664a45a503aade45e1df59ba165acb9f0cd93fbcc3.
- Both editor verifications bind source 70c72e767e1b6618e8d54005e8ba0a50c2d07081 and their exact run nonce, and pass complete-pair equality, fresh native reopen, incomplete native error and legacy preservation. Initial local verifier invocation used the download parent instead of the artifact directory; rerunning against the actual artifact directory produced these valid results.

### Further analysis of retained failure 44654237016-1

At 01:57:12 recovery shutdown reported SimError 405, already Shutdown. The existing intentional shutdown tolerance permits progress; this was not where recovery stalled. At 01:57:51 bootstatus monitored the explicitly requested original simulator 08AEF2F6-6BFD-48DC-9538-9B3FB7DE50B9 and reported Data Migration / LaunchServicesMigrator. At 01:59:14 it advanced to Waiting on System App, persisting until the lifecycle deadline at 02:08:04. No attempt 2 was launched. This locates the recovery timeout in boot readiness after migration, without identifying a failing system process or proving why readiness never completed.

The preceding Runner PID 31592 abort is reported by xcodebuild PID 29402 (exit 65); it is not a crash of xcodebuild itself. The result bundle has finalized Data objects rather than the staging scheduling logs required by the worker selector. Retained evidence includes no readable Runner crash stack. This Windows environment cannot decode the xcresult with Apple's macOS-only xcresulttool. Therefore the initiating Runner exception/termination detail and exact clone state remain unverified. The selector's refusal is evidence unavailability, not proof that no worker existed. Recovery targets the original simulator; it must not be silently relabelled as the crashed clone.

The passing final-source runs establish acceptance for those executions only. They do not cure the retained intermittent failure. No speculative erase/boot bypass, increased timeout, broad crash-report upload or retry expansion is justified. No further confirmed behavioral cause was found this iteration. Next investigation needs the exact failed Runner report from exported xcresult diagnostics and separate, explicitly attributed recovery-simulator state before its runner is disposed. Existing failures remain retained; do not retry away evidence. CV-032 remains open, including actual hosted matching xcodebuild IPS capture. Merged-main and audit-follow-up CI are distinct pending checks at publication. No deployment; public v229 unchanged.
