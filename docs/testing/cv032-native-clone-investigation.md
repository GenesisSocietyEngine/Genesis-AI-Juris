# CV-032: native XCTest worker diagnostics

19 November 2026. Started clean at #344 `1bd0fe71`; remote main `71d8093f`. Candidate branch `codex/cv032-native-clone-diagnostics` starts from remote main so #344 can finish its own checks without cancellation.

## Confirmed finding

Retained main native run 44596411027 (source `a7f45809`) failed during test execution, not preparation. The prepared plan checksum passes; lifecycle attempt 1 starts at 19:35:38 UTC. XCTest scheduling records original destination 08AEF2F6-6BFD-48DC-9538-9B3FB7DE50B9's worker as Clone 1, UUID 47C09D31-E4A3-48AD-B8C9-87900279957D. Its session log confirms installation then starts app launch at 19:37:28; no launch completion or selected-test receipt precedes the 15-minute step timeout. The original logs and xcresult are retained outside git under `evidence/342-main-native-failure`.

There are no kernel reports for this native worker. Existing editor kernel baselines cannot establish the native stall's cause, and collecting from the original destination would target the wrong simulator. No behavior, service-reset, retry or timeout change is justified by this evidence.

## Candidate and acceptance

On native workflow failure (unless cancelled), read the prepared simulator identity and the latest attempt marker, then the staged XCTest scheduling records for that attempt. Require exactly one valid worker UUID. Reject missing, malformed, oversized, linked, ambiguous or unknown-attempt evidence; never fall back to a prior attempt or the original destination. Persist a selection receipt with `acceptance: false`; reuse the existing exact-device PID/parent/executable checks and target-only kernel capture. Preserve the 120-second total collector budget, 20-second per-command budget, output limits, three-minute wrapper step and all existing workflow/test deadlines. Upload the separate native-diagnostics directory even when capture skips. Finalized result bundles without staged scheduling records skip rather than guessing a target. Job-level cancellation may still prevent post-failure diagnostics.

Review: no application code, acceptance criterion, launch command, retry classifier or reset path changes. Seven selector tests pass, including current-versus-stale attempt selection and refusal paths; all 33 existing collector tests pass. The real retained artifact selects exactly clone 47C09D31-E4A3-48AD-B8C9-87900279957D on attempt 1. Workflow runs the selector tests and retains its selection report. Hosted execution and actual failing-worker kernel capture remain pending; the initiating hang remains open. #344 CI is still pending at this checkpoint. Public v229 unchanged.

## Retained editor recurrence and selector portability correction

#344 push editor 44604004739-1 repeats the 120-second first-launch timeout. The kernel report successfully captures RunningBoard 3665: 36,353 bytes in 6.730 seconds. All 302 samples of thread 0x3c56 (queue 644) remain in OSLaunchdJob submitAndStart / Mach IPC, ending in an unsymbolicated kernel frame; no reply-owner metadata is provided for this wait. The sampled launchd is largely idle and also has throttling threads, as seen in healthy runs. The service history retains 597 records; it does not identify the outstanding launch request's reply owner. Total recorded command durations are 120.228 seconds including timeout cleanup: application-log, application-container and launch-services timed out, and flutter-cache-lock skipped after budget exhaustion. No new behavioral fix is established. The failure artifact is retained before one unchanged editor retry.

The paired PR editor 44604057316-1 independently passes all six-process assertions at source 1bd0fe71, with PIDs 13304/16053/17469/20347/22815/25406 and bundle SHA-256 3189e5a368432364a3a17ebe9da366535f36e331f2d078182a1260108321f125. #344 web run 44604057151 failed with missing Chrome DevToolsActivePort during browser startup; its log is retained before one unchanged retry. This is separate from iOS.

Candidate native run 44605650553 exposed a portability defect in the new selector tests: checking every filesystem ancestor rejected macOS's system temporary-directory alias above the owned evidence root. Commit fef0d46 restricts link rejection to the owned result tree, retaining refusal of linked identities or result-bundle paths. Nine selector tests pass locally, including an allowed external system alias and rejected internal link; hosted verification is pending. This is a confirmed selector correction, not an explanation for the original launch hang.

The retained native testmanagerd log confirms successful clone boot and control-session handshake before app launch. No accepted test-runner launch receipt follows. A collector that cannot identify the current worker deliberately skips; a job-level cancellation or a finalized bundle without staged records may still prevent collection.

Candidate editor 44607108851-1 (fef0d46) also times out at first launch. Its preserved kernel report captures RunningBoard 2270 (54,653 bytes, 8.237 seconds). Unlike the stationary #344 sample, this post-timeout sample shows changing launch queues: OSLaunchdJob start, submitExtension and submitAndStart. Two samples of a separate client-workloop logging call name send owner PID 2311; the contemporaneous process lists identify that PID as this simulator's diagnosticd. That is an activity-stream logging wait, not the launch-reply owner, so it does not establish the initiating cause. The service log hits its existing output limit; retain this partial-record limitation. No additional behavioral change is justified.

Merged main 71d8093f independently passes editor 44603700477-1 (six distinct processes and all assertions; bundle 8b8e83c3401b8099d8df7ab5ec190fd71d868fa24ce38baecfc13bba3ab2222a), and native 44603700657 explicitly passes the selected lifecycle on attempt 1. Candidate fef0d46's native job 44607091873 passes the hosted macOS selector/orchestration step; full workflow remains pending at this checkpoint. #344's web retry passes unchanged. Its failed editor artifact remains retained while the unchanged retry runs.

## Integration and hosted verification

#344 merged as 9e2c3c68b72baa6475f1cc032f20c61b787e1be2 after all 18 checks passed. The editor retry 44604004739-2 independently passes all six-process assertions (PIDs 17624/21775/24715/27918/30609/33707, bundle c0812448be60f853c3d0425e596e7d379b607ce631ac16fb3fc758bb70128d50). Both native runs 44604004400 and 44604057329 record the selected lifecycle passing on attempt 1. Failed editor and web artifacts remain retained; retries do not establish a cure.

Candidate source fef0d46's PR native run 44607091873 passes all nine selector tests on macOS, the existing 20 shell cases and the selected native lifecycle on attempt 1. The failure-only diagnostic step is skipped on this successful run: actual kernel collection from a failed native clone remains unverified. The selector is validated against the real retained failure; existing collector tests pass 33 cases. Candidate editor failure 44607108851 remains retained and is not waived. The follow-up merge reconciliation supersedes any still-running candidate checks and requires fresh CI; it does not inherit a green status from the earlier source.

Documentation conflicts with #344 were reconciled by preserving its audit entry and the new candidate findings. No implementation change is introduced by reconciliation. Progress, backlog and priorities are updated together. CV-032 remains open pending a causal explanation of the original launch stall and hosted native-failure capture. Next: review the reconciled candidate workflows and retain the next native worker report before any retry. No production deployment; v229 unchanged.

## Final #345 integration audit

19 November 2026. Started clean at candidate `3d7a74299087fecbc081104e866cac7fa9fa6d42`, remote main `9e2c3c68`. All 18 checks passed; #345 merged as `051e8806c9d0469302f8364b22d236ea02841f24`. Follow-up branch `codex/cv032-native-diagnostics-audit` starts from that exact merged main; no functional files changed in this audit.

Both final editor artifacts independently verify the exact source and run nonce, all six processes, matching complete pairs, fresh native reopen, incomplete-input error and preserved legacy record:

| Run (attempt 1) | Accepted PIDs | Bundle SHA-256 |
| --- | --- | --- |
| PR 44611182094 | 20013, 22814, 24520, 27055, 29676, 32036 | 2aae9a045798f910cc1b015bc6784cd9947c7aad4dd8bdfcb5cf1fbc5f8db3b8 |
| Push 44611172149 | 20146, 22245, 24740, 27398, 29175, 32076 | 7ae517bb20dc17f0b524f2d3e57b8ddbf8da27d8660aceedf8990286209bb4f9 |

PR kernel capture selects only RunningBoard 5883, exits zero, and retains 26,967 bytes in 6.243 seconds. Push selects only RunningBoard 3636, exits zero, and retains 29,975 bytes in 7.810 seconds. Total diagnostic command durations are 86.268 / 89.344 seconds. Neither report contains submitAndStart or blocked-by metadata. These are healthy comparisons, not a demonstrated cure. The PR service log reaches the output limit and both broad application queries time out; the diagnostic sets are partial.

Native runs 44611181949 and 44611169901 both pass on GitHub attempt 1 and record the selected lifecycle passing on lifecycle attempt 1. Each also passes nine selector tests and the existing 20 isolated shell cases. The failure-only clone diagnostic step is explicitly skipped in both successful jobs. No new completed native failure was found in the latest eight-run audit; earlier selector failures and cancelled runs are already accounted for. Actual failed-clone collection remains a hosted acceptance gate, distinct from the real retained-artifact selector test. Local reruns pass nine selector tests and 33 collector tests.

Two non-iOS merge blockers were retained before one unchanged retry each. Android 44611181641 logs explicit HTTP 429 responses from Maven Central for Kotlin dependencies; attempt 2 passes. Web 44611181661 lacks Chrome DevToolsActivePort during startup; attempt 2 passes. This does not establish the reason Chrome failed to start. No dependency changes, timeout increases, launch resets or acceptance bypasses were made.

CV-032 remains open: no new kernel evidence confirms the initiating launch-stall cause, and no further behavioral fix is justified. Next: preserve the next native failure's selection receipt and clone-specific report before retry, then correlate the actual worker's launch request. Evidence is retained outside git. Audit-documentation and post-merge CI require their own checks and are not covered by the prior head's green status. No production deployment; v229 unchanged.

## #346 recurrence audit

19 November 2026. Started clean at a5d1aefd3732c3fdb7a47e7590467a49ba90d36e with remote main 051e8806. #346 merged as 4695bf7204a49f9f08ffa08a40b4da4d9a7659d8 after all 18 checks passed. No retries or functional changes were made in this iteration. Audit branch codex/cv032-recurrence-audit starts from that exact merged main.

Independent editor verification passes all six-process assertions, exact source/run nonce, matching complete pairs, fresh native reopen, incomplete-input error and preserved legacy state:

| Run (attempt 1) | Source | PIDs | Bundle SHA-256 |
| --- | --- | --- | --- |
| Push 44622343140 | a5d1aefd | 18992, 21889, 23330, 26313, 29520, 32483 | 77ae161c1ce82769478f31f1c136e12858db61b01a49784edc09db6f6da355f1 |
| PR 44622389679 | a5d1aefd | 11067, 14592, 15388, 18087, 18873, 21117 | d16d8f21ac90ec1161e80d90b2e531ef1ea14b6fb58204ba62b5c32efa0480de |
| Main 44622243848 | 051e8806 | 19569, 22849, 24305, 27320, 29443, 31841 | 2099c8eec42273b928aa76063ebe17806d29cf8328a8eaff8c54082d2ccd1f5f |

All three kernel captures complete with exit zero and one RunningBoard process header. Push PID 2689: 41,180 bytes / 7.347 seconds; PR PID 2204: 33,581 bytes / 5.721 seconds; main PID 3038: 31,711 bytes / 7.715 seconds. None contains submitAndStart. Push and main broad application logs time out; PR service history reaches the output limit. These are partial diagnostic sets from healthy runs, not proof of a stall cure.

Native runs 44622343309 and 44622389834 explicitly pass the selected lifecycle on attempt 1, plus nine selector tests and 20 isolated shell cases each. Both failure-only clone diagnostic steps are skipped. Main native 44622243796 also passes the selected lifecycle on attempt 1. No new completed native or editor failure occurred in this audit. Existing failed-run evidence remains retained; no new root cause or behavioral fix is established. Actual failure-path clone collection remains unverified until a suitable hosted recurrence.

No local tests were repeated for this documentation-only iteration; current hosted regression results and independently downloaded editor proofs provide the verification. Evidence remains outside git in the task evidence directory. Post-merge native run 44628037049 is in progress at handoff and is not covered by the previous source's green status. The audit-documentation commit needs its own CI.

CV-032 remains open. Next: preserve the next native failure's selection.json and bounded clone-specific kernel report before retry; correlate the actual worker's launch request without treating healthy waits as a cause. Progress, backlog and priorities updated together. No production deployment; v229 unchanged.
