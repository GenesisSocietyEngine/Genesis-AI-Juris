# CV-032 — launchd reply investigation

19 November 2026. Started clean on #340 source `7c38e0c4c27a3668a2f87edae13ae9fd9efa6c03`, remote main `31a5757b`. Task branch: `codex/cv032-launchd-reply-investigation`. #340 has 17 passing checks and a failed push editor run; no merge bypass. Retained both first-failure artifacts before rerunning the unchanged failed #340 workflow.

## New evidence

[44528461570 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44528461570/attempts/1) and [44528132580 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44528132580/attempts/1) repeat the first-launch timeout at 120 seconds. The #340 failure samples verified runningboardd 2850 under manager 2822. All 238 samples on the Spotlight process-manager queue run through RBLaunchdJobManager createAndLaunchWithIdentity, OSLaunchdJob submitAndStart, _xpc_pipe_routine and mach_msg2_trap. The main failure also has submitAndStart / launchd IPC waits. These are downstream of the previously observed SpringBoard synchronous reply wait, not proof that app code or notifyd initiated the failure.

The #340 failed service log completed: 751 records, 963,689 bytes, 4.347 seconds; app records show installation termination requests but no accepted Runner launch. The main failed history hit the existing 4 MiB output cap after 3.283 seconds and is explicitly partial; it must not be parsed or described as a complete JSON array. Preserve raw artifacts and keep the cap. The #340 paired PR editor run 44528473143 succeeded, allowing unchanged-source comparison.

## Bounded diagnostic repair

Capture the selected device's own launchd_sim before its downstream children. Reuse the manager PID obtained through simctl spawn of the exact UUID and require the host inventory to identify that PID as launchd_sim with parent 1. Immediately before sampling, query that device's manager again and require the exact PID/parent/executable identity. Never choose host launchd, a different simulator or a name-only process match. Changed, partial or unavailable identities skip sampling; sample refusal is retained and downstream evidence continues.

Acceptance: cross-simulator isolation, rejection of host PID 1, changed manager/parent/path and partial identity, unchanged shared budget, refusal continuation, and no diagnostic-to-acceptance path. All 30 diagnostic tests and 67 lifecycle tests pass locally; whitespace review passes. Existing 120-second total, 20-second command and 4 MiB capture limits, launch deadlines and retry policy are unchanged. Hosted launchd sample and workflow verification remain pending. The initiating cause remains open; no reset, timeout increase or speculative app change is justified. Public v229 unchanged.

## Hosted failure/success comparison and handoff

#340's unchanged [attempt 2](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44528461570/attempts/2) repeats the first-launch timeout. That artifact was retained separately. #340 remains open with 17 passing checks and one failed editor check; no further blind retry or merge was performed.

Candidate source `8efbbc6cf707a94655e12a6eaa8a48d2eb8a97b8` has a real failed [push run 44537306213](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44537306213) and a successful [PR run 44537365829](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44537365829), both attempt 1. Failed exact-device manager 3775 (parent 1) sampled successfully: 4,310 bytes, 4.726 seconds, total diagnostic command time 117.214 seconds. RunningBoard's Spotlight queue remains in submitAndStart / launchd IPC for 230 samples. launchd_sim is mostly in signal/work-queue waits; it also has a managedappdistributiond throttling thread. The healthy manager 3924 also shows those broad idle/throttling patterns, so neither proves a deadlock or identifies the initiating cause. The samples are sequential, not a synchronized kernel IPC dependency trace; the outstanding request's destination/state is not established by idle stacks alone.

Healthy exact-device launchd capture: 3,392 bytes in 4.248 seconds; total diagnostic command time 97.049 seconds. The downloaded six-process proof passes on exact source/nonce, PIDs 20182, 22893, 25418, 28345, 29728, 32313, bundle SHA-256 `21857db03d1bea63d0952da9b9f5dba82003bbf0eb5d6db66b3fc60f0c9cc327`. Complete pairs, fresh native reopen, incomplete native error and legacy record preservation pass. The earlier #340 successful paired artifact 44528473143 also passes its exact-source verifier.

The diagnostic gap is repaired and sampled on both failure and success, but iOS acceptance is not fully green. Before this documentation checkpoint, #341 had 15 passing checks, one failed editor check and two native checks pending (44537306012 / 44537365381). The documentation update will trigger fresh head checks; results above belong to implementation source `8efbbc6c`. Local 30 diagnostic and 67 lifecycle tests pass; reviewed code preserves budgets, identity guards, retries and application behavior. All raw artifacts stay outside source control; only the six task-owned code/test/documentation files were published. Main remains `31a5757b`; neither #340 nor #341 is merged.

CV-032 stays open. Next work must correlate the specific outstanding launchd IPC request/destination with the retained RunningBoard and launchd state, rather than treating idle samples or the common throttling thread as a root cause. No service reset, disabling Spotlight, timeout widening or app/signing workaround is supported by this evidence. Public v229 unchanged.

## Green integration and current-source verification

19 November 2026. Started clean on `2bcf2990eca0998a1dd008894921c8ce61736bd0`, remote main `31a5757b`. #340 merged as `b01253d186a185dfafa740271163d349ca8bd139`, then #341 as `16304681353669012cd112603310bc0fed42a664`, each after all 18 checks passed. The task-owned documentation branch `codex/cv032-launchd-verified` includes canonical main. Earlier blocked checkpoints above are historical.

#340 [44528461570 attempt 3](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44528461570/attempts/3) passed unchanged after both failed attempts had been retained. Its downloaded six-process proof passes exact source `7c38e0c4`, nonce `44528461570-3`: PIDs 17945, 21066, 24371, 26374, 28332, 30909; bundle SHA-256 `f6374ef69d645ae1a928c6c2f2c26cc98aebf0e43bddff4cd17c3a5040c7d223`. This enables integration but does not resolve the intermittent failure.

Both current #341 editor runs passed on attempt 1, source `2bcf2990`:

| Verification | Push | PR |
| --- | --- | --- |
| Editor run | [44540509914](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44540509914) | [44540520181](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44540520181) |
| Independent six-process proof | PASS | PASS |
| Verified launchd PID | 3524 | 3244 |
| Launchd stack bytes / command seconds | 2,906 / 5.629 | 18,571 / 4.062 |
| Total diagnostic command seconds | 119.991 | 75.539 |
| Native lifecycle, attempt 1 | [44540509922](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44540509922) PASS | [44540519862](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44540519862) PASS |

Push proof PIDs: 17181, 22812, 25483, 27705, 30324, 33072; bundle SHA-256 `de23f70ac57195cfc8525c86827e243feb8fcd7783efe5d0461c9997ed321b61`. PR proof PIDs: 15571, 18331, 20451, 22440, 24527, 26546; bundle SHA-256 `e1d1a78c3d4368b3518e9cbedfd93b7aedfdf94fc3695461db4fb3b7c68273de`. Exact source/nonce, same bundle across each run's phases, complete pairs, fresh native reopen, incomplete native error and legacy record preservation all pass.

Bounded evidence is not unlimited evidence: PR service history hit its output cap and application history timed out; push application history and launch-services listing timed out, with the final optional Flutter lock check marked budget_exhausted. These partial/skipped records were not treated as complete data. Launchd sampling succeeded in both. The healthy PR again contains the managedappdistributiond throttling thread and generic idle waits seen in the failure; this is not a causal classifier. Failing and healthy artifacts retain the same Xcode 16.4 / iOS 18.5 pairing, so toolchain mismatch is not established.

A separate Android [44540509905 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44540509905/attempts/1) failed resolving Kotlin artifacts from plugins.gradle.org. The paired same-source Android job passed. After preserving the failed log, unchanged attempt 2 passed; no dependency or repository configuration was altered. This is separate from the iOS wait investigation.

[Web PR CI 44540520071](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44540520071) records 2,110 passing tests, zero failures, three existing skips and both dependency audits with zero vulnerabilities. The implementation's local 30 diagnostic / 67 lifecycle passes remain applicable; this iteration adds documentation only and diff checks pass.

The diagnostic repair is merged and verified, including a prior failed-state launchd capture. CV-032 remains open because no initiating IPC cause or safe behavioral fix was confirmed. Do not describe passing retries as a cure or infer a deadlock from idle/throttling stacks. The next investigation needs the particular request/destination state correlated with the retained failed service state; generic additional samples or speculative resets/runtime changes are not a demonstrated fix. Public v229 is unchanged; no product release or signed-in EN/RU check applies to this CI-only integration.
