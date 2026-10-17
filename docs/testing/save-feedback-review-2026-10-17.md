# CaseVant save feedback audit — 17 October 2026

## Scope and verified baseline

User outcome: distinguish checking, restoring, pending saving and a confirmed save; recover a failed check in normal Studio; repeated activation must not create overlapping save requests or clear pending feedback. Saved cases, source factories, reports, evidence and tax carriers stay byte-compatible.

Before editing, supported Sites source opening, isolated checkout HEAD and canonical main all resolved to `a3aa4a4914f0728fbe63eb25c3c764c02f942ad7`. Production v137 is saved version `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_dae7a02131748191b45972f486a3a348`, successful deployment `appgdep_6ad1b91e99f0819189c3efc0f3b9f6b4`. Public audience, environment 42 and existing DB/R2 bindings remain unchanged. Canonical main web/PDF run 38856839832 is now completed/successful; this closes its earlier pending audit note.

Root workspace has separately owned Cargo.toml, CURRENT_PROGRESS.md and TAX_ECONOMICS_V2_INTEGRATION_PLAN.md work. This slice uses the clean isolated checkout and does not stage those paths.

## Findings and correction

1. The real save handler grouped pending/checking activations with errors. A second invocation before React renders could also pass the state-only pending guard. Add a synchronous component-local in-flight guard, acquired before tax verification and released in finally, including failures/stale completions. Ignore duplicate/premature activations without a new write or false error. Keep the frozen snapshot, exact verified receipts and context checks.
2. A failed derivation exposed Retry check only in the developer view. Expose the existing retry action next to the primary save controls in both views; distinguish checking, failed checking and saved-case restoration. Retrying checks performs no save.
3. First-case guidance labelled actual saving as checking. Provide distinct bilingual pending labels, never confirmed success before the durable exact-version receipt. Keep pending save status visible even if a later edit is being checked.

This addresses independently reproduced code/handler defects. The original October 15 missed first-click cause remains unconfirmed; do not claim this proves its cause. No automatic retry, queue or auto-save was introduced. No template, schema, report renderer, approval, privacy or authorization contract changes.

## Acceptance and evidence

Required: delayed tax preparation plus overlapping calls sends one request, remains pending and permits explicit retry after failure; restore/check guards perform zero preparation/writes; existing stale-account, receipt, conflict and full-carrier tests remain green. Render both languages and all pending labels; inspect actual normal-view navigation and save/reopen on synthetic work in production after release. Test evidence from actual extracted UI handlers, static render checks and hosted browser checks must remain distinct.

Initial pre-fix overlapping test awaited the blocked second call and was interrupted; it is not a completed failing baseline result. Corrected test observes overlap before releasing both calls in finally so it terminates against either implementation. Final results and release receipt are appended to the status report; no pending step is a claimed pass.

## Review

Native disabled buttons, existing focus/navigation, role=status feedback and explicit Retry check remain available without opening technical controls. The in-flight ref is per mounted Studio, never shared across users. Existing server concurrency, scope/version guards, frozen tax write and exact receipt adoption remain unchanged. Finally releases the local lock after every asynchronous exit. Historical source locks and report locks are not regenerated.


Implementation checkpoint: 87 focused/preservation tests passed (including the 18-check targeted group; do not add overlapping totals). Strict TypeScript passed. Changed-file ESLint exited successfully with seven existing unused-variable warnings in JurisApp; no errors. Normal Chrome preview observed disabled checking controls and explanatory status immediately after an edit, and readiness subsequently settled. A viewport override initially applied to another selected tab; its 1522 px local observation is desktop evidence only, not narrow acceptance. Initial pre-fix hanging test was interrupted as recorded above. Final required gates and hosted acceptance remain separate.
