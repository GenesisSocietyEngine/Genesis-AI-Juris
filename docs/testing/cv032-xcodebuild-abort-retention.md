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
