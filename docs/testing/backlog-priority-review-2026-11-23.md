# Backlog priority review and implementation · 23 November 2026

## Baseline and prioritization

Started clean on `a803131`, with canonical main `099144c2` and public v231. PR #354 had all 18 checks successful on that exact head and was ordinarily squash-merged as `5acb87af107be0bc3936b70be42cc7492b2505fe`. Main was synchronized before the next slice. No production deployment in this iteration; CV-046 live acceptance remains pending release.

The highest ready implementation is CV-032 release reliability. PR #351's previous head `6473dac0` had 18 successful regular checks and two correctly skipped manual forensic jobs, but conflicted with newer main in three progress/backlog documents. Merge `1363573` reconciles main, retaining both histories and the current application changes. The new priority file replaces contradictory historical checkpoint ordering with a single current plan.

Execution order: complete CV-032 integration; release/accept merged CV-046; extend authenticated example-package coverage as CV-048; then investigate remaining localization/readability as CV-049. P1 EU uploads and client intake receipts retain their severity but require external infrastructure evidence or an active independent client. Calendar provider, upload recovery, portal notices and Billing role acceptance retain explicit dependencies. This ordering does not authorize broad provider integration or claim complete MyCase parity.

CV-048 formalizes existing incomplete package acceptance, not a new confirmed defect. CV-049 records source-inspected gaps for future user-visible confirmation: the hydrated-title map omits `/activity`, and filtered work summaries remain 12px. Neither is claimed fixed this iteration.

## Confirmed CV-032 capture gap and fix

The early Runner collector creates `Runner-abort/manifest.json` even when no crash report exists yet. The final workflow step previously skipped whenever that file existed. Thus a delayed report could never be captured by the final step. The collected manifest was not proof that a report had been retained.

The final failure step now always invokes a separate bounded `--final` pass into `Runner-abort-final/`. Early before-recovery evidence remains immutable. Both passes use the existing exact PID/process/path/attempt/time checks and bounded scan budget; the final pass reads the current attempt identity rather than falling back to an earlier Runner. Artifacts retain both directories. No retry, timeout, rendering, test-selection or assertion changes.

## Verification and review

- Nine Runner/recovery identity tests pass, including late report arrival after an early miss and refusal to reuse a first-attempt report for the final second attempt while preserving the first report bytes.
- Six xcodebuild abort-selection tests and nine native worker-selection tests pass: **24 Python tests** total.
- All **22 isolated lifecycle cases** pass under Git Bash, including no third attempt, failure/capture exit preservation and capture-before-recovery ordering. This is orchestration verification; Windows cannot execute the actual iOS simulator.
- Diff reviewed against current main: application runtime changes match merged main; new changes are scoped to CI evidence collection, workflow retention and documents. No application rebuild or EN/RU browser pass is claimed or needed for this diagnostic-only amendment.
- PR #351 needs fresh exact-head hosted CI after reconciliation and this fix. Actual automatic capture during a hosted failure remains unverified until recurrence. Passing synthetic collectors or normal native runs does not establish a cure for the underlying SimMetalHost/System App fault.

Progress and backlog updated together; existing provider/client gates remain open. Next action is fresh PR #351 CI and ordinary integration when green, then the explicitly pending CV-046 release/acceptance.
