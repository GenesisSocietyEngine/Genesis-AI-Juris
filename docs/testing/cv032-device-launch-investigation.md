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
