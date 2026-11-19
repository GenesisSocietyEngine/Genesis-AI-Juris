# CV-032 regression audit — 19 November 2026

## Scope and source

Audit the latest iOS orchestration, stable-install proof, failure capture and CI stage budgets; rerun the relevant tests and the full hosted pipeline. Starting checkout `286f3fc` is clean and contains #331's verification notes; canonical main is `bdb40fcc`, containing the green #330 repair. The task branch was reconciled with main before editing. This is a CI/source audit, not a new signed-in UI or production acceptance run. Public v228 stays unchanged. Active-client and EU infrastructure gates remain open.

## Findings and implementation

- **CV-032 · P2 · Editor boot stage lacks its own deadline.** The job has a 75-minute overall limit, but `Create a fresh isolated iPhone Simulator` has no step timeout and waits synchronously for boot. A stalled boot can consume the job budget instead of reaching bounded diagnostics promptly. Native smoke already uses ten minutes. Add the same ten-minute stage limit; preserve the existing 900-second preparation and six 300-second application phases, 120-second collector and three-minute diagnostic step.
- **CV-032 · Diagnostic consistency.** Editor boot inventory is retained, but boot output is only in the workflow log. Record the selected simulator before boot and tee boot/bootstatus output into `boot.log` inside the existing artifact directory. `set -euo pipefail` preserves command failure. A timeout remains a failure, not a retry or success. This repairs a confirmed containment/evidence gap; it does not establish the underlying cause of earlier boot stalls or first-launch timeouts.
- **Stable-install/acceptance review:** one real install proof remains required; later phases require completed scoped receipts and unchanged container/full-bundle identity. Fresh process, authenticated VM, strict log paths, prior termination and six-phase semantic verification remain intact. No additional defect was confirmed in this review.

## Test rerun

| Suite | Result |
| --- | --- |
| `test_run_ios_tax_phase.py` | 67 pass |
| `test_collect_ios_tax_diagnostics.py` | 15 pass |
| `test_run_with_deadline.py` | 9 pass; 2 Windows-inapplicable skips |
| `test_ios_native_lifecycle.sh` | 14 groups / 20 isolated cases pass |
| Diff whitespace review | Pass |

The checkout has no installed web dependencies, and the locked install harness requires Linux utilities. The normal hosted pipeline therefore supplied the full web/native validation recorded below. Local shell tests do not prove macOS boot behavior.

## Remaining follow-up

The confirmed budget/evidence gap is closed. Preserve any future failed-run evidence before retrying; keep first-launch and boot-stall root causes open unless new evidence establishes them. Active-client, EU hosting and provider-dependent acceptance gates remain unchanged. This iteration does not claim a live UI audit or a new website release.

## Hosted rerun evidence

#331 merged as `40a3fa699de94f4453fbd41edc44aa30ba84af28` after all 18 checks passed. The audit candidate is #332, source `195d4a02b8b130c8b7ea12400b0f07ab8438978d`.

[Web/PDF run 44423927044](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44423927044) passed on attempt 1. Downloaded `source.json` matches the candidate. The complete suite reports 2,110 passes, zero failures and three existing skips (2,113 tests total). Full-tree and production dependency audits both report zero vulnerabilities. Strict typecheck/lint, migration/contract checks, packaged browser/Worker checks and PDF gates passed in the hosted workflow. This is test-suite evidence, not fresh signed-in production acceptance.

All 18 #332 checks passed on the candidate, and the PR merged as `f7c4dd16f97b81bb1dffe53acaf39a72b60f4bd7`. Both editor workflows passed on attempt 1. The downloaded [44423927110 artifact](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44423927110) retains `simulator-inventory.json`, `boot-simulator.log` matching the verified launch simulator and a 4,791-byte `boot.log` ending in successful completion after 75 seconds. The committed six-process verifier was rerun against this exact-source artifact and passed. The ten-minute timeout is configured; an actual forced ten-minute stall was not injected. The local boot pipeline returned a failure for an injected failing command without running the following success command, confirming that log piping does not mask that failure. Public v228 is unchanged.
