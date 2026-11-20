# CV-032: recovered Runner crash and recovery boot evidence

20 November 2026. #350 merged as d77267b3ea74344fc61a55911bb04a63328f49b9 after all 18 checks passed on 06d63304f0914f07b42f9ed44200a68757033e34. Candidate #351 fixes missing exact Runner/recovery evidence. The immediate Runner abort cause is now established; the initiating host graphics defect and later System App wait remain open. Public v229 unchanged.

## Exact recovered report and cause

Forensic run https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44669406550 successfully exports retained native run 44654237016 attempt 1 on macOS (implementation ba690d3). It does not rerun that test. Runner-2026-11-20-015653.ips has SHA256 `8f5cf7e9432079fd4c34b043a05493abc724995b97cb37c72422a5656dece8d7`. Exported scheduling.log independently identifies Runner PID 31592 on XCTest clone ADE917C3-DB96-4DEC-B757-C00CE1FAEC63. Launch 01:55:28.9715 and capture 01:55:57.8131 UTC fall within the recorded attempt.

The Runner termination is METAL code 102: its SimMetalHost PID 32060 connection was interrupted. The main-thread stack enters MTLSimulator_encountered_XPC_error from MTLSimDevice newCommandQueueWithDescriptor during Flutter Impeller ContextMTL creation. The matching service report records SIGSEGV / EXC_BAD_ACCESS at address zero, with MTLSimApplicationContext::deleteObject at the top of the faulting stack. A prior SimMetalHost report records backboardd GPU execution failure at 01:55:12, before Runner launched; WidgetRenderer and another SimMetalHost also failed. This establishes a host graphics failure preceding app startup, not an identified CaseVant shader defect.

Recovery subsequently targeted original simulator 08AEF2F6-6BFD-48DC-9538-9B3FB7DE50B9. It progressed past shutdown and data migration, then waited on System App until the deadline. The exported test diagnostics end before this recovery interval. The same host graphics condition is a plausible contributor, not a proven cause of the later wait. Do not relabel the original recovery simulator as the crashed clone.

## Implemented repair

CI attempts exact Runner IPS retention before recovery; the failure-only step supplies a receipt if the first capture never ran. Require the latest completed exit-65 attempt with successful log capture, one explicit pre-test-abort Runner PID, exact process/time window, and the expected simulator app path. Signed reports require the CaseVant bundle ID. The actual unsigned XCTest report omits bundleInfo and uses XCTestDevices: the corrected matcher instead requires the clone coalition UUID to agree with its executable path, in addition to PID/time/process identity. The real recovered report now passes this matcher.

Reuse bounded scanning: 64 names, four MiB/report, eight MiB total reads, ten-second deadline. Copy only one match; missing, malformed, unrelated or ambiguous reports are refused. An early receipt is retained rather than overwritten, so delayed reports can still be unavailable. Diagnostic results never constitute test acceptance.

Recovery bootstatus gains wait/ready markers. A separate selector requires the prepared original destination and exactly one unfinished first-attempt recovery wait, with no ready marker or later attempt. Reuse bounded device diagnostics, explicitly labelled recovery_destination, in a separate artifact directory from worker evidence. Existing lifecycle acceptance, retry classifier/count, test deadline and overall job deadline remain unchanged; diagnostics can use only remaining job time.

A manual-only forensic job downloads one explicitly requested same-repository native artifact and exports its at-most-two lifecycle results with xcresulttool on macOS. It retains scoped result diagnostics with run/attempt provenance and acceptance:false. Numeric inputs and subprocess/job limits constrain execution. An initial shared concurrency group was corrected immediately: forensic dispatches now have independent run-ID groups, and cannot cancel normal native CI. The historical export succeeded; it is separate from live automatic capture.

## Verification and integration

#350 native push 44666477799 and PR 44666485676 pass the selected lifecycle on attempt 1 (Runner PIDs 47739 and 24369). Editor PR 44666485695-1 independently verifies six processes: 19786, 22202, 24400, 27344, 29282, 31853; bundle SHA256 f97aa6a8dbb79baef5fd7a45f09666749de76065483dae16936d3f2c3e1e8077. Editor push 44666477695-2 independently verifies 18106, 21972, 23709, 26622, 28710, 30964; bundle f1989d117648b9ff57b8f265caef52ff52676ea7c714ba56fd13114abf7fa070. Attempt 1's launch timeout and RunningBoard submitAndStart evidence were retained before its unchanged retry; a passing retry is not a cure.

Candidate implementation 5aa028cf1796e19e6c602fba1d86562818801c2c passes all 18 regular checks; the two manual-only forensic jobs correctly skip on push/PR events:

- Seven new identity tests, six abort-selector tests, nine worker-selector tests and 22 shell cases pass locally and in both hosted native regression steps. Cases cover exact/unrelated/ambiguous/unsigned identity, stale attempts, recovery attribution/refusal, capture before recovery and tolerated diagnostic failure without changed test acceptance.
- Native push 44669782048 passes the selected lifecycle on attempt 1 at 04:00:44 UTC, Runner PID 23231. Native PR 44669787327 passes the selected lifecycle on attempt 1 at 04:14:14 UTC, Runner PID 47061.
- Editor push 44669782011-1 independently verifies PIDs 19658, 22966, 24989, 27326, 29208, 31997; bundle 0ae126884f010ec7bde9128acf861cd7aa436b584ebd5c5a9ea6cc69ef893bb5.
- Editor PR 44669787329-1 independently verifies PIDs 18839, 22736, 24845, 27802, 30427, 33287; bundle f3983e98370521acc38858fb27f69fa627f5facae48b60dd3eaafbcdd45ca00c.
- Both editor proofs bind the exact source/run nonce and pass complete-pair equality, fresh native reopen, incomplete native error and legacy preservation.

Reconciliation with merged main and final audit notes require fresh CI; the above checks apply to the explicitly named source. Actual automatic before-recovery capture and capture of a live unfinished recovery wait still need a hosted recurrence. Historical extraction/matching is verified separately. No deployment.

## Remaining limits and next action

A software-rendering workaround was evaluated and rejected: pinned Flutter 3.44.8 returns IOSContextNoop for iOS software rendering and forbids Impeller opt-out. Source: https://raw.githubusercontent.com/flutter/flutter/3.44.8/engine/src/flutter/shell/platform/darwin/ios/ios_context.mm . That would weaken rendering coverage rather than repair the host GPU fault. No runner replacement, runtime upgrade or retry expansion is established as a cure. A similar runner-image report supplies no confirmed remedy: https://github.com/actions/runner-images/issues/10592 .

The evidence matcher defect is fixed; the underlying SimMetalHost fault remains unresolved. Next correlate the exact recovery destination's graphics/service state with an actual System App wait, retain a matching host service report, and evaluate a supported runner/runtime remedy with unchanged lifecycle and rendering acceptance. Keep CV-032 open. Crash-report interpretation follows Apple's guidance: https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs .
