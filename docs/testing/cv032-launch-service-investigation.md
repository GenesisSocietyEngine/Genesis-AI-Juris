# CV-032 — first-launch service investigation

## Scope and base — 19 November 2026

Task began on clean #333 head `6b469a9e06a7ee3090a5fb64545f47a297fff4b1`; canonical main was `f7c4dd16f97b81bb1dffe53acaf39a72b60f4bd7`, already published as v229. #333 subsequently passed all 18 checks and merged as `9db90a230ad9ee0e19d5c8e2c7ef979d15ab96f8` on 19 November 2026. Its downloaded editor proof from run 44472871341 independently verifies six distinct processes, one bundle, exact source/nonce and preserved legacy data. Both editor checks passed on attempt 1. The candidate branch incorporates the new canonical main. The repair is isolated on `codex/cv032-launch-service-diagnostics`. No app, data, release or user-facing localization changes are involved.

## Retained failure and comparison

[Editor run 44427840405 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44427840405/attempts/1), source `8cd1d43942c2bd532220628d61c3a9c28993a127`, booted successfully. Its first installation completed with exit zero in 17.513 seconds, and the harness verified the installed bundle before launch. The first launch then timed out after 120 seconds, with empty stdout/stderr. No accepted Runner PID, VM or completed application phase exists. The failure was retained before any retry; no retry of this historical run was requested.

The diagnostic manifest records container and listapps queries timing out at about 20 seconds each, while simulator state, launchctl and screenshot queries complete. The host inventory lists CoreSimulatorService PID 2323 and no Runner for the verified container. The application log itself times out while still printing installation-time history. These establish partial Simulator service unresponsiveness, not the cause or permission to retry an ambiguous launch.

SpringBoard reports launch-image security error -67056 and bad launch image. The same messages occur in successful editor run 44417994079 (`cv032-stable-pr-success`): these warnings do not independently explain the timeout. No signing, launch flag, deadline or restart change is justified by this evidence.

## Confirmed diagnostic defect and repair

The collector could sample only an identified Runner, requiring a successful get_app_container RPC. In this failure that RPC stalls and Runner has not been identified, so neither app stacks nor host service stacks are available. The repair independently selects exactly one host CoreSimulatorService from the completed host inventory, requiring its full observed Apple executable path and a valid PID. It rechecks the exact PID/path immediately before a three-second read-only sample. Missing/ambiguous paths, failed or partial inventory, changed/reused PID and failed identity checks skip sampling. This shared host service is explicitly not a device or app acceptance identity.

Capture precedes simctl history/container queries and shares the original 120-second collector deadline, 20-second per-command bound and 4 MiB output limit. A timeout, unavailable sample, permission error or output limit remains diagnostic evidence and never changes acceptance. Existing launch retries/deadlines, six-phase journey, single installation, exact app identity and strict VM authentication stay unchanged.

## Verification and next action

Local: 20 diagnostic tests pass, including replay of the failed host-inventory row with stalled container/listapps, ambiguous/foreign service rejection, reused PID/identity failures, partial inventory refusal and sample timeout continuation under one budget. All 67 lifecycle tests pass; nine applicable deadline tests pass with two existing Windows skips. Diff whitespace checks pass. Hosted macOS sampling and workflow verification remain pending.

The underlying first-launch and boot-stall causes remain open. This is an evidence-collection repair, not a claimed cure for an unconfirmed cause. Inspect the exact candidate's hosted service sample and six-phase proof; use stacks from any future stalled run to identify a defensible behavioral fix. No new signed-in EN/RU or production acceptance is claimed; public v229 remains unchanged.

## Hosted verification and integration

Final candidate `b1fe4f1d92bb24b13d0f376894e325aa15b63a0a` incorporated #333. [PR #334](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/334) merged as `ac57a95d48f56e3dbf4a679704473d64c839a10d` after all 18 checks passed. Superseded runs from earlier task commits were canceled; final-candidate checks were preserved. The following results supersede the earlier pending verification checkpoint.

- [Push editor 44476029428 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44476029428/attempts/1): passed. Exact service PID/path 3573 revalidated; sample completed in 4.853 seconds, retaining 104,250 bytes. The whole collector used 38.146 seconds of its existing 120-second budget. The six-process verifier passed independently with PIDs 22526, 27231, 29030, 32361, 34648 and 36663.
- [PR editor 44476036829 attempt 1](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44476036829/attempts/1): repeated the 120-second first-launch timeout with no accepted Runner PID. Container/listapps again timed out, but the new independent service sample succeeded for verified PID 2532 in 5.968 seconds, retaining 105,904 bytes. Evidence was downloaded and inspected before retry. The host stack shows mostly event-loop/workqueue waits at capture time; it does not establish the cause of the earlier launch stall. The completed application log records CoreSimulatorBridge launch attempt #0 without launch completion. No ambiguous PID or diagnostic data was accepted as application success.
- [PR editor 44476036829 attempt 2](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44476036829/attempts/2): unchanged failed-job retry passed. The service sample completed for PID 4266 in 5.226 seconds, retaining 108,960 bytes. Independent six-process verification passed with PIDs 23790, 27172, 30467, 34292, 36482 and 39591. Both passing artifacts verify exact source/nonce, one bundle per journey, complete/incomplete pairs and preserved legacy data.
- Both native workflows passed. Exact-source web/PDF run 44476036744 passed 2,110 web tests with zero failures and three inherited skips, plus two HTML checks; full and production audits each report zero vulnerabilities. PDF, Android/mobile and Rust checks passed.

[Structured success/failure/retry receipt](receipts/cv032/service-diagnostics-verification.json) retains the stack hashes and command outcomes. Stack capture worked in the real failure, establishing the diagnostic repair without claiming a timeout cure. Next evidence should distinguish the per-device bridge/client stall; no service reset, relaxed identity guard or increased timeout is justified yet. First-launch and boot-stall root causes remain open. Public v229 and all production user data remain unchanged.

Upstream comparisons were checked but do not establish this cause: [Flutter #189059](https://github.com/flutter/flutter/issues/189059) describes a VM-discovery hang after a returned app PID; this failure returns no PID. [runner-images #15334](https://github.com/actions/runner-images/issues/15334) concerns a different Xcode 27 runner image and runtime unmount during boot; this run uses macOS 15/iOS 18.5 and completes boot. These are distinctions from the observed evidence, not proof of a specific Apple defect.
