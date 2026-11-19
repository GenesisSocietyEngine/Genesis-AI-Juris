# CV-032 — RunningBoard reply investigation

## Scope and starting state

Clean local HEAD `7d16a10bf9a9d72246d3dc40d4e30def2ebb17ef`, remote main `428712200e8cc6970aabaa4486de406e17a837cf`; this task owns `codex/cv032-runningboard-investigation` in the isolated CV-032 checkout. #337 merged after all 18 checks passed as `136574ed3bc79c1f92c27d1c96a9918f838e13d6`, incorporated before edits. No product or production-data changes; public v229 remains unchanged.

## Investigation

Reinspect [44486393457 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44486393457/attempts/1): bridge sends the open request at 08:27:25.893; the 08:29:41.668 SpringBoard sample has five synchronous RBSConnection executeLaunchRequest waits, including the FrontBoard openApplication path. Separate LaunchServices work waits in notify_check. SpringBoard subsequently receives unrelated process-state updates through 08:31:06.737. This supports an unresolved launch-request wait, not a proven global RunningBoard deadlock, notifyd fault, or app/signing cause.

The application log ends at 08:27:29 with a terminated-query marker. Its process-Runner / bundle-ID predicate excludes backend service activity without that ID. The per-device downstream samples added in #336 were absent in this earlier failure. Latest [#337 PR editor run 44492930375](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44492930375) passes independent six-process verification on source `7d16a10b`; retained healthy samples contain none of the executeLaunchRequest/notify_check/host_support failing wait chains. Healthy notifyd is in signal/work-queue waits. Passing runs cannot prove the earlier cause.

## Confirmed diagnostic repair and acceptance

Retain a five-minute structured log of runningboardd and notifyd using `simctl spawn <exact UUID> log show`, before broader app history. Keep app-bundle filtering out of this service query, so unrelated service operations and timestamps can explain the stalled reply. Device-scoped log history is diagnostic only, separate from fresh exact PID/parent/path checks for live sampling. Keep all existing 120-second total, 20-second command and 4 MiB output budgets; no new service restart, launch retry, acceptance path or timeout change.

Acceptance: exact device selector, structured service metadata, service records without app ID, priority over broad app history, shared bounds, and continued evidence collection on query timeout/output limit/exhausted budget. Local 28 diagnostic tests and 67 lifecycle tests pass; diff check passes. Hosted verification is pending. The initiating launch-stall cause remains open and must not be described as fixed by this evidence repair.
