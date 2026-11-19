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
