# CV-032: native XCTest worker diagnostics

19 November 2026. Started clean at #344 `1bd0fe71`; remote main `71d8093f`. Candidate branch `codex/cv032-native-clone-diagnostics` starts from remote main so #344 can finish its own checks without cancellation.

## Confirmed finding

Retained main native run 44596411027 (source `a7f45809`) failed during test execution, not preparation. The prepared plan checksum passes; lifecycle attempt 1 starts at 19:35:38 UTC. XCTest scheduling records original destination 08AEF2F6-6BFD-48DC-9538-9B3FB7DE50B9's worker as Clone 1, UUID 47C09D31-E4A3-48AD-B8C9-87900279957D. Its session log confirms installation then starts app launch at 19:37:28; no launch completion or selected-test receipt precedes the 15-minute step timeout. The original logs and xcresult are retained outside git under `evidence/342-main-native-failure`.

There are no kernel reports for this native worker. Existing editor kernel baselines cannot establish the native stall's cause, and collecting from the original destination would target the wrong simulator. No behavior, service-reset, retry or timeout change is justified by this evidence.

## Candidate and acceptance

On native workflow failure (unless cancelled), read the prepared simulator identity and the latest attempt marker, then the staged XCTest scheduling records for that attempt. Require exactly one valid worker UUID. Reject missing, malformed, oversized, linked, ambiguous or unknown-attempt evidence; never fall back to a prior attempt or the original destination. Persist a selection receipt with `acceptance: false`; reuse the existing exact-device PID/parent/executable checks and target-only kernel capture. Preserve the 120-second total collector budget, 20-second per-command budget, output limits, three-minute wrapper step and all existing workflow/test deadlines. Upload the separate native-diagnostics directory even when capture skips. Finalized result bundles without staged scheduling records skip rather than guessing a target. Job-level cancellation may still prevent post-failure diagnostics.

Review: no application code, acceptance criterion, launch command, retry classifier or reset path changes. Seven selector tests pass, including current-versus-stale attempt selection and refusal paths; all 33 existing collector tests pass. The real retained artifact selects exactly clone 47C09D31-E4A3-48AD-B8C9-87900279957D on attempt 1. Workflow runs the selector tests and retains its selection report. Hosted execution and actual failing-worker kernel capture remain pending; the initiating hang remains open. #344 CI is still pending at this checkpoint. Public v229 unchanged.
