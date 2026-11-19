# CV-032 — per-device launch investigation

## Scope and starting state

Task begins on clean #335 head `6efe47ae28f1ba762498b8076280b18d4354387b`; canonical main is `ac57a95d48f56e3dbf4a679704473d64c839a10d`. #335 merged as `6c40f6b66f1c87fa9483eeddfeb9fc0f59a62ab6` after all 18 checks passed; the candidate includes that main revision. The candidate is isolated on `codex/cv032-device-launch-stacks`. This is CI investigation only; public v229 and production data are unchanged.

## Evidence and remaining uncertainty

Reinspection of [44476036829 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44476036829/attempts/1) narrows the log boundary: CoreSimulatorBridge PID 3104 starts launch attempt #0 at 07:19:05, resolves LSBundleProxy, then sends a FrontBoard request to open the app. It records no completion before the 120-second timeout. No accepted Runner PID or VM announcement exists. The shared host CoreSimulator service sample is mostly waiting at capture time and does not explain the per-device request. No timeout increase, reset or speculative app/signing modification is justified.

The retained host inventory lists launchd_sim 3066, its bridge child 3104 and SpringBoard child 3075. Other host and simulator processes can coexist; matching a name alone is insufficient. Existing read-only `simctl spawn <exact UUID> launchctl list` completed during the failed container/listapps RPCs.

## Bounded diagnostic repair

Query `launchctl managerpid` inside the selected UUID, then require that manager to match one host-inventory `launchd_sim` with parent 1. Select only unique bridge/SpringBoard children under that parent and known exact executable path shapes. Re-query the device manager and the candidate PID/parent/executable immediately before each three-second sample. Missing, partial, malformed or ambiguous identity, foreign paths, changed manager/parent and reused PID all skip sampling. The shared service and application acceptance identities remain separate.

The manager query follows the command implemented in [Apple’s launchctl source](https://github.com/apple-oss-distributions/launchd/blob/main/support/launchctl.c). Its availability and actual identity on the hosted Simulator still require live verification; unsupported output fails closed.

The captures precede slow history/container queries and share the existing 120-second total, 20-second per-command and 4 MiB output bounds. Diagnostic status never permits launch retry or app acceptance. Native workflow behavior, six-phase editor journey, strict source/bundle/PID/VM checks and stable-install policy remain unchanged.

## Verification checkpoint

25 diagnostic tests and 67 lifecycle tests pass. Captured process rows exercise exact-device selection in the presence of another simulator, wrong/ambiguous managers and duplicate PIDs, changed parent/path, partial/exhausted identity, stalled container queries and sample timeout continuation. Whitespace checks pass. Hosted per-device capture and iOS workflow verification remain pending. The underlying bridge/FrontBoard launch stall is still an unconfirmed cause, not a resolved CV-032 item.

## First live per-device comparison

Candidate `b02d65ce1bb936d6f9a6f8a6910404b122259cd4`: [PR run 44486393457 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44486393457/attempts/1) reproduced the first-launch timeout. Exact-device managerpid returned 4697; verified child bridge 4739 and SpringBoard 4710 both sampled successfully (88,619 and 261,689 bytes). The bridge host_support dispatch path stays in semaphore_wait_trap for all 239 samples. SpringBoard’s FBSystemService openApplication path runs through FBProcessManager and RBSConnection executeLaunchRequest into synchronous XPC reply wait for all 176 samples. Separate LaunchServices/icon work also waits in notify_check. This identifies a persistent downstream wait, not yet its initiating cause.

[Push run 44486380375 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44486380375/attempts/1) passed; the downloaded six-phase verifier passed with exact source/nonce. Its bridge/SpringBoard sample lacks the failing host_support/RBSConnection launch-request wait chain. A generic SpringBoard semaphore wait exists in both and is not sufficient to classify this failure.

The next diagnostic slice adds only the observed runtime-scoped runningboardd and notifyd child paths, prioritizing them within the same 120-second budget. It excludes same-named host daemons and other simulators and uses the same manager/PID/parent/executable rechecks. All 26 diagnostic tests pass; unchanged lifecycle suite has 67 passes. This evidence-based extension is not a claim that notifyd or RunningBoard is the ultimate cause. Neither service is restarted or modified. The failed artifact was preserved; no retry of this superseded source was requested.

## Final hosted verification and integration

Final implementation `da72e4356f9ef75dc476a3db2f2991ead4118664` merged through #336 as `428712200e8cc6970aabaa4486de406e17a837cf` after all 18 checks passed. No failed-run retry was requested in this iteration. The earlier failure artifact remains retained separately from the successful final-source runs.

| Check | Push run | PR run | Result |
| --- | --- | --- | --- |
| Editor six-process journey | [44488761812](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44488761812) | [44488770876](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44488770876) | Both attempt 1 passed; downloaded artifacts independently verified against exact source and nonce |
| Native lifecycle | [44488762020](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44488762020) | [44488771141](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44488771141) | Both `testNativeLogisticsLifecycle` passed on attempt 1; exact export gates passed |
| Web/PDF | [44488762571](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44488762571) | [44488772268](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44488772268) | Green; PR log retains 2,110 passes, zero failures, three existing skips and both dependency audits at zero vulnerabilities |

Push editor proof: PIDs 18892, 21574, 23526, 26138, 27688, 30775; bundle SHA-256 `5224d75ab3de55997ceaa6034af9b152dfc7311d501425ad02876f9001ef2cb1`. PR editor proof: PIDs 21559, 25044, 27037, 29223, 31872, 34536; bundle SHA-256 `b9315a7b0daf3b2205361925c9bb3412fb974c956612d9108df1256c4ed165c6`. Each run preserves its own exact bundle across all six processes; complete pairs, fresh native reopen, incomplete native error and legacy record preservation all pass.

Both baseline manifests retain `acceptance: false`. Push selected manager 3306 and children RunningBoard 3327, notifyd 3360, bridge 3353, SpringBoard 3324. PR selected manager 3326 and children 3506, 3541, 3534, 3503 respectively. All four exact-device identity rechecks and stack commands completed successfully. Stack sizes respectively: push 53,726 / 1,582 / 87,154 / 238,097 bytes; PR 50,607 / 1,510 / 86,635 / 235,575 bytes. Summed command elapsed times are 83.168 and 86.568 seconds within the existing budget. Healthy notifyd samples show its signal/work-queue wait; these are baselines, not failure classifiers.

Final local rerun: 26 collector tests, 67 phase/lifecycle tests and nine applicable deadline tests pass; two POSIX-only tests are skipped on Windows. Diff review confirms only bounded diagnostics and documentation changed: app behavior, acceptance guards, phase deadlines and retry policy are preserved.

### Remaining gate and next action

CV-032 remains open. The first candidate captured the recurring failure through the bridge and SpringBoard; final-source RunningBoard/notifyd captures have so far been verified on successful runs. A healthy run does not establish why RunningBoard failed to answer in the earlier timeout. Preserve the next failed downstream artifact before any retry, compare its RunningBoard/notifyd stacks with these baselines, and change behavior only for a demonstrated cause. No speculative service reset, timeout increase, signing change or app workaround is justified by this evidence. This CI-only iteration does not change public v229 or require a site release.
