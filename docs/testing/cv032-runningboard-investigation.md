# CV-032 — RunningBoard reply investigation

## Scope and starting state

Clean local HEAD `7d16a10bf9a9d72246d3dc40d4e30def2ebb17ef`, remote main `428712200e8cc6970aabaa4486de406e17a837cf`; this task owns `codex/cv032-runningboard-investigation` in the isolated CV-032 checkout. #337 merged after all 18 checks passed as `136574ed3bc79c1f92c27d1c96a9918f838e13d6`, incorporated before edits. No product or production-data changes; public v229 remains unchanged.

## Investigation

Reinspect [44486393457 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44486393457/attempts/1): bridge sends the open request at 08:27:25.893; the 08:29:41.668 SpringBoard sample has five synchronous RBSConnection executeLaunchRequest waits, including the FrontBoard openApplication path. Separate LaunchServices work waits in notify_check. SpringBoard subsequently receives unrelated process-state updates through 08:31:06.737. This supports an unresolved launch-request wait, not a proven global RunningBoard deadlock, notifyd fault, or app/signing cause.

The application log ends at 08:27:29 with a terminated-query marker. Its process-Runner / bundle-ID predicate excludes backend service activity without that ID. The per-device downstream samples added in #336 were absent in this earlier failure. Latest [#337 PR editor run 44492930375](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44492930375) passes independent six-process verification on source `7d16a10b`; retained healthy samples contain none of the executeLaunchRequest/notify_check/host_support failing wait chains. Healthy notifyd is in signal/work-queue waits. Passing runs cannot prove the earlier cause.

## Confirmed diagnostic repair and acceptance

Retain a five-minute structured log of runningboardd and notifyd using `simctl spawn <exact UUID> log show`, before broader app history. Keep app-bundle filtering out of this service query, so unrelated service operations and timestamps can explain the stalled reply. Device-scoped log history is diagnostic only, separate from fresh exact PID/parent/path checks for live sampling. Keep all existing 120-second total, 20-second command and 4 MiB output budgets; no new service restart, launch retry, acceptance path or timeout change.

Acceptance: exact device selector, structured service metadata, service records without app ID, priority over broad app history, shared bounds, and continued evidence collection on query timeout/output limit/exhausted budget. Local 28 diagnostic tests and 67 lifecycle tests pass; diff check passes. Hosted verification is pending. The initiating launch-stall cause remains open and must not be described as fixed by this evidence repair.

## Hosted verification and integration

#338 merged as `6c025eccb8c7153615365f1b7f919df9273b9431` after all 18 checks passed on source `de8679412a1aa34668016128a38785270ffe7862`. No workflow retry was requested. The clean task branch includes canonical main before this documentation follow-up.

| Evidence | Push | PR |
| --- | --- | --- |
| Editor, attempt 1 | [44509952907](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44509952907) | [44509965666](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44509965666) |
| Native lifecycle, attempt 1 | [44509952332](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44509952332) | [44509965967](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44509965967) |
| Service query bytes / seconds | 3,402,376 / 3.411 | 3,061,344 / 5.141 |
| Records / records without app bundle ID | 2,560 / 2,025 | 2,297 / 1,815 |
| Summed diagnostic command seconds | 68.171 | 94.848 |

Both downloaded six-process proofs pass the committed verifier with exact source and run nonce. Push PIDs: 22171, 24766, 26398, 29208, 31731, 33919; bundle SHA-256 `09d6eecb55e4d3d97fbf843af999780abd250188fc1593a0a0c29f44adc65e66`. PR PIDs: 19196, 22543, 24220, 26868, 30476, 33763; bundle SHA-256 `e230d75c7ba7052655f20d6985d6f80163275506e91362ddf0d9ebe07da18748`. Each run keeps its own bundle unchanged across phases; complete pairs, fresh native reopen, incomplete native error and legacy record preservation pass.

Both exact-device service commands completed with exit 0 and retained full arrays beneath the raw `getpwuid_r did not find a match for uid 501` diagnostic preamble. For offline inspection, that exact preamble was identified before parsing the following JSON array; raw evidence was preserved unchanged. The `.log` file is deliberately raw combined output, not an application input or guaranteed standalone JSON file. Returned event paths belong to the runtime runningboardd; these healthy windows contain no notifyd events. All four per-device stack captures and the shared-service sample completed. Both manifests retain `acceptance: false`.

The prior #337 push and PR artifacts (44492882869 / 44492930375) and exact merged-main artifact (44509512285, source `136574ed`) also pass independent six-process verification. These are additional healthy baselines, not reproductions of the stalled reply. [Web PR CI 44509965688](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44509965688) retains 2,110 passes, zero failures, three existing skips and both dependency audits at zero vulnerabilities. Final local review: 28 diagnostic tests / 67 lifecycle tests pass and diff check is clean.

## Handoff and remaining limitation

The confirmed diagnostic filtering gap is repaired, merged and hosted-verified. CV-032 itself stays open: the initiating RunningBoard reply-wait cause remains unconfirmed, and this iteration produced no failed downstream capture. Do not reset services, increase timeouts or change app/signing behavior based on the current healthy results. On recurrence, preserve the first failed service history, manager/PID identities and RunningBoard/notifyd stacks; correlate timestamps with the bridge request and compare with these healthy baselines before proposing a behavioral fix. Public v229 remains unchanged; no site release or signed-in product check applies to this CI-only change.
