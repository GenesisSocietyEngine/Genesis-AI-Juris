# Saved Studio case: preserve the requested working step

2026-09-27. Bounded fix in `app/JurisApp.tsx` and new regression file `tests/saved-case-navigation-restore.test.ts`. No build, deployment, saved case write, permission change or fixture change was performed by this slice.

## Outcome and acceptance

Opening a saved Studio case from My cases with `studio_step=case_map` should install the exact authorized saved draft and keep its decision-map destination. An explicit Overview panel should survive as well. The initial blank placeholder must not rewrite that incoming route while the saved read is pending. A newer tab selection within the same case should win; a late read must not pull the user back from another page, view or case. Failed, superseded and identity-invalidated reads must release their own pending state. A genuinely empty untitled draft still starts at Brief.

## Root cause and red evidence

The device restoration effect skipped its work when `custom_case` was present, but still set `studioRestoreReady=true` in `finally`. The saved-case network read was independent and could still be pending. Guided restoration then interpreted the empty placeholder as a genuinely new draft and rewrote `case_map` to `describe`. The saved-case loader read the URL only after its awaited response, so it installed the correct case together with the already-clobbered `describe` route.

The [red receipt](evidence/saved-case-step-race-red.log) records this exact sequence: requested map → pending-fetch Brief rewrite → correct Canopy identity installed at Brief. The probe exited 1 intentionally because `case_map` was expected. `.artifacts/saved-case-step-race-probe.cjs` extracted the actual handler and restoration callback from the pre-fix source with TypeScript AST and used the real Canopy, normalization, fingerprint, workflow and saved-path helpers. Browser transport/history, state setters and effect scheduling were modeled. The coordinator separately reports a browser reproduction; this document does not substitute the probe for that observation.

## Narrow implementation

- One request-ID state marks the saved-case read as pending. The existing `restorePending` prop incorporates it only while that ID remains the latest request.
- `finally` clears only that request's own pending value. Completion of an older request cannot release a newer request's guard.
- Guided restoration clears its restored marker before checking pending state. Both automatic URL writers and the history-restoration listener wait while restoration is pending.
- The successful loader reads the current step and panel at completion. It does not freeze an old tab selection before the network request.
- Existing request-ID, source-draft and account-scope checks remain. A matching pathname/view/custom-case target additionally prevents a late response from undoing newer navigation. Changing only the working step/panel is allowed.
- The read uses a 15-second AbortSignal timeout so a failed network request cannot leave the pending guard unresolved indefinitely. Failure retains the current draft and existing error notice.

The renderer, receipt validation, server access boundary, copy-protection decisions, saved baseline and actual empty-draft rule remain unchanged. This fix does not add a new route model or persistent state.

## Verification

- **PASS: 27/27**, zero skipped: new saved-case navigation regression plus existing guided workflow, saved receipt and My cases selections. [TAP receipt](evidence/saved-case-step-regression.log).
- The seven new tests execute actual AST-extracted parent handler/effects and the actual `restorePending` JSX expression. They cover delayed map/Overview, latest same-case tab, newer page/view/case navigation, network/403/fingerprint failures, old completion versus a new request, draft/account/request invalidation, and anonymous/unavailable identity without a request. The case normalizer, fingerprints, Canopy model and workflow/path helpers are real; React scheduling, network and browser facilities remain modeled.
- **PASS:** scoped ESLint on the changed application/test files, exit 0. [Empty success log](evidence/saved-case-step-lint.log).
- **PASS:** full strict TypeScript `--noEmit --incremental false`, exit 0. [Empty success log](evidence/saved-case-step-typecheck.log).
- **PASS:** scoped `git diff --check` (only the existing CRLF normalization notice).

**Pending independent verification:** coordinator source review and an actual browser reopen on a build containing this fix. No new-build browser pass, production pass, or full-suite rerun is claimed here.
