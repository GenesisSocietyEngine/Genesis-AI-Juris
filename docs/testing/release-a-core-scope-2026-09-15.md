# Release A — no-migration reliability amendment

## Why the scope changed

The original bounded candidate was saved as v87 from `4daef3112e16748fd5fb30857be2cdd2f85cc96e`. Deployment `appgdep_6aa94cfa27e48191a68d632c40f186dd` failed at 2026-09-15T13:49:54.717610Z with `incomplete input: SQLITE_ERROR`. No terminal success or live URL was returned for this attempt.

Supported DB overview returned the same bounded table names before and after failure and did not expose a migration ledger. The failing statement and applied/unapplied boundary are not identifiable from these records. The complete migration parses and applies in local isolated SQLite/D1 tests; the installed Wrangler splitter also accepts all 31 statements. This does not explain the hosted failure. Do not attribute a proven parser bug, rewrite0022, rerun the failed archive, or claim the migration succeeded.

The safer successor excludes every dependency on0022 and carries the exact v86 schema and migration journal/files. It does not execute corrective production SQL, remove production tables or reverse applied migrations. This is an application-scope reduction, not a retry of0022. The failed full candidate and its tested code remain preserved at `4daef3112e16748fd5fb30857be2cdd2f85cc96e` on `codex/release-a-2026-09-15`; original Phase2 UI work remains on `codex/next-stage-review-2026-09-15`.

## Exact included scope

| Surface | Change |
|---|---|
| Disposition GET | Original actor-owned operation lookup by exact record and key; returns original immutable receipt revision after subsequent case changes. |
| Disposition validation | Reject whitespace-altered keys; distinguish reused-key/different-proposal conflicts; identify the reason field on validation errors. |
| Audit GET | Resolve one exact authorized event without paging through unrelated history. |
| Assertion GET | Resolve one exact same-case assertion, reject incompatible paging, and return missing/foreign targets without fallback. |
| Existing citation confirmation | Says “Review outcome saved.” instead of prematurely claiming readiness already refreshed. |
| Existing application interface | Otherwise remains the v86 interface; no new editor, queue or recovery panel is exposed. |

Request receipts, exact-request API, notes API/schema and notebook editor are **not included**. Canonical collection, receipt and recovery helper files remain unconnected foundations; their tests do not establish delivered UI.

## Verification and recovery

Rerun focused real-handler tests on the final split, covering case persistence, organization boundaries, source history, accepted evidence, disposition replay/conflicts, exact lookups, current dependencies, snapshot/report generation and preservation of old sealed PDF bytes. Separately rerun the39 model/source/render checks and exact-source build/typecheck/mobile contract. Final results and source SHA belong in the publication report; the earlier15-check run stays attributed to the larger v87 candidate.

The migration package is byte-for-byte v86 (0000–0021). No new migration is requested. The exact v86 artifact remains the recovery target: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_56f9e3f806008191823f659b14e76b57`. Use native deployment recovery if a severe included-scope regression appears; never perform a destructive down migration. The earlier upgrade/old-code test demonstrates compatibility with full0022 locally, but does not establish the actual hosted partial state.

Browser controller retry timed out after20000ms. The new UI is excluded because there is no actual desktop/narrow-screen/authenticated acceptance route in this session. Native publication can succeed independently. Real sign-in/save/reopen, org switching, browser PDF retest and physical mobile remain pending.

## Next bounded increments

1. Resolve the hosted migration statement/ledger uncertainty through supported Sites deployment diagnostics or the Site owner's Settings/support route. Do not edit migration history without this evidence. Then publish the receipt/notes backend increment with its exact compatibility record.
2. Release B: correct the two retained form findings, integrate canonical tiles/counts/filters/exact requests, parent-owned request receipt recovery and queue return; exercise the required real browser journey and publish.
3. Release C: focused note editor, exact-version link/open/download/backlink/unlink/history and authenticated reopening; exercise the specified Canopy copy and publish.

Do not mark Releases B/C accepted or published from headless model tests. Full self-service readiness remains an evidence-based later milestone.
