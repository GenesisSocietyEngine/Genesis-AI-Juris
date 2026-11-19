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

## Service-log audit after #339

19 November 2026. Started clean on `ebf8bc7187906c0dc2c8c20f54d3d8cb66cd78c9`, remote main `6c025ecc`; #339 merged as `31a5757bba2e0bab0e5c4102c3416be1726e6fe9` after all 18 checks passed. The task-owned branch `codex/cv032-runningboard-log-audit` includes that merge. This is an evidence audit and documentation update only.

| Downloaded editor artifact | Source | Service records / without bundle ID | Query seconds / total diagnostic command seconds |
| --- | --- | --- | --- |
| [44515005870 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44515005870) | `ebf8bc71` | 2,571 / 2,043 | 3.699 / 76.237 |
| [44514995720 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44514995720) | `ebf8bc71` | 2,651 / 2,128 | 4.511 / 82.557 |
| [44514833279 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44514833279) | `6c025ecc` | 2,268 / 1,836 | 6.442 / 100.350 |

All three exact-source/nonce six-process proofs pass the committed verifier, including same bundle across phases, complete pairs, fresh native reopen, incomplete native error and preserved legacy records. All service queries and all four device-scoped plus shared-service stack commands completed successfully. Service output sizes are 3,418,209 / 3,525,516 / 3,018,538 bytes, below the unchanged cap. Raw diagnostic preambles remain preserved; the following complete JSON arrays were inspected offline.

#339 PR proof PIDs: 20072, 22479, 25101, 28409, 30426, 33692; bundle SHA-256 `fc52c8d1a673b2336240181e41659b76665b9a9056795238e6fe082939c1cb81`. Push PIDs: 19452, 23876, 26631, 28678, 30789, 33652; bundle SHA-256 `61078c3cb43dc3109b965f495bf6bdf5c1ca487e7a9706e82c9f3010ffa2b840`. Prior main PIDs: 19826, 23331, 25343, 29131, 31698, 34282; bundle SHA-256 `ac14e3c215a42023f7995aad67c08e6cd4a78982f1dfd7da4ba4ab1db1da8a4a`.

Both #339 native lifecycle logs explicitly record `event=passed attempt=1`: [44515006065](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44515006065) and [44514995546](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44514995546). No rerun was requested in this audit.

### Findings and rejected shortcuts

- In the healthy PR log, Runner 33692 has memory-status errors 1/22 and a CarPlay permission warning at 11:56:10, followed by RunningBoard marking the client ready at 11:56:11.297. It later exits under the test's SIGTERM at 11:56:53 after successful acceptance. Equivalent warnings appear in the other healthy histories. Those messages alone do not identify the earlier missing-PID launch cause.
- The healthy PR SpringBoard sample contains 166 samples in notify_check, reached through background XPC activity / syslog. This is a different caller path from the earlier failure's LaunchServices/icon path. The symbol alone, even persistent over a short sample, is not a failure classifier or justification for restarting notifyd.
- None of these three samples contains the earlier bridge host_support / SpringBoard executeLaunchRequest combination. These are successful baselines, not a reproduced RunningBoard launch-reply failure.

CV-032 remains open with no newly confirmed behavioral cause. Existing diagnostic capture works; adding another layer or modifying timeouts, signing, service state or retries would be speculative. Preserve the next first-attempt failure's exact-device identities, launch-service history and RunningBoard/notifyd stacks, then correlate the specific bridge request and service response before selecting a fix. This audit changes no runtime code and requires no new runtime regression suite; downloaded application proofs, native logs and all-green #339 CI provide the stated verification. Documentation diff review passes. Public v229 remains unchanged.
