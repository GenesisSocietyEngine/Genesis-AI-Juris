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

The checkout has no installed web dependencies, and the locked install harness requires Linux utilities. The candidate's normal hosted pipeline reruns strict types/lint, full web/build tests, packaged browser/Worker checks, PDF gates and both dependency audits, alongside native/mobile/Rust checks. Hosted results and new boot artifacts remain pending at this checkpoint. Local shell tests do not prove macOS boot behavior.

## Next acceptance

Merge #331 only after all checks pass. Verify the candidate's editor workflows retain `boot-simulator.log` and completed `boot.log`, and that the six-phase stable-install proof still passes. Preserve any failed-run evidence before retrying; keep first-launch and boot-stall root causes open unless new evidence establishes them. Update progress and backlog together after hosted verification.
