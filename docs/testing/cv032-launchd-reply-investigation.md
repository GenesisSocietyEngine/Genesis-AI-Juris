# CV-032 — launchd reply investigation

19 November 2026. Started clean on #340 source `7c38e0c4c27a3668a2f87edae13ae9fd9efa6c03`, remote main `31a5757b`. Task branch: `codex/cv032-launchd-reply-investigation`. #340 has 17 passing checks and a failed push editor run; no merge bypass. Retained both first-failure artifacts before rerunning the unchanged failed #340 workflow.

## New evidence

[44528461570 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44528461570/attempts/1) and [44528132580 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44528132580/attempts/1) repeat the first-launch timeout at 120 seconds. The #340 failure samples verified runningboardd 2850 under manager 2822. All 238 samples on the Spotlight process-manager queue run through RBLaunchdJobManager createAndLaunchWithIdentity, OSLaunchdJob submitAndStart, _xpc_pipe_routine and mach_msg2_trap. The main failure also has submitAndStart / launchd IPC waits. These are downstream of the previously observed SpringBoard synchronous reply wait, not proof that app code or notifyd initiated the failure.

The #340 failed service log completed: 751 records, 963,689 bytes, 4.347 seconds; app records show installation termination requests but no accepted Runner launch. The main failed history hit the existing 4 MiB output cap after 3.283 seconds and is explicitly partial; it must not be parsed or described as a complete JSON array. Preserve raw artifacts and keep the cap. The #340 paired PR editor run 44528473143 succeeded, allowing unchanged-source comparison.

## Bounded diagnostic repair

Capture the selected device's own launchd_sim before its downstream children. Reuse the manager PID obtained through simctl spawn of the exact UUID and require the host inventory to identify that PID as launchd_sim with parent 1. Immediately before sampling, query that device's manager again and require the exact PID/parent/executable identity. Never choose host launchd, a different simulator or a name-only process match. Changed, partial or unavailable identities skip sampling; sample refusal is retained and downstream evidence continues.

Acceptance: cross-simulator isolation, rejection of host PID 1, changed manager/parent/path and partial identity, unchanged shared budget, refusal continuation, and no diagnostic-to-acceptance path. All 30 diagnostic tests and 67 lifecycle tests pass locally; whitespace review passes. Existing 120-second total, 20-second command and 4 MiB capture limits, launch deadlines and retry policy are unchanged. Hosted launchd sample and workflow verification remain pending. The initiating cause remains open; no reset, timeout increase or speculative app change is justified. Public v229 unchanged.
