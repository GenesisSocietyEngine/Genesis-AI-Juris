# PO/UX status — tax analysis and reports, 1 October 2026

**Web production v105 is deployed** at [Case Studio](https://studio.falcon-merlin.com).
It publishes reviewed source `073a638`, accepted through PR #79 with all 18
checks passing and merged normally into main as `1a8b7ee`. The public audience
and environment revision 40 are preserved. The [deployment receipt](DEPLOYMENT.md)
records the exact build, archive, provider result and verification limits.

## What shipped

The tax editor uses the shared Rust calculation engine and preserves exact decimal
inputs, including unfinished drafts. A source change makes previous results
stale and requires a fresh calculation. Legacy imports retain their original
records; unsupported future documents are preserved rather than silently
rewritten. Missing rates are reported explicitly and prevent unsupported calculation.

Reports provide tax and economic-assessment profiles in English and Russian.
Preview and PDF download each calculate afresh and bind the output to the source,
inputs and calculation/presentation versions. The JSON receipt matches the
delivered report. Successful sign-in returns to the saved case without the
unwanted unsaved-form prompt; failed or stale requests retain that protection.

## Evidence and limits

| Area | Verified | Still open |
| --- | --- | --- |
| Native bridge/export verifier | Supported symbol extraction; 27 negative/positive fixtures and eight real macOS fixtures; executed passing XCTest; PR #68 accepted and merged | This does not establish full mobile product acceptance |
| Web Rust/editor | Shared Rust in browser, RSC and SSR; 49 complete-response parity commands per host; actual local edit/save/reopen and fresh calculation | Remaining hosted/provider journeys and full accessibility matrix |
| Reports | Actual local PDF/JSON delivery and history; separate 22-tax-PDF/164-page cohort plus unchanged 47-PDF/760-page baseline | PDF tagging, reading order and spoken accessibility |
| Account flow | Actual production Worker with synthetic credentials: login, report/history, sign-out, browser termination, new login and history reopen | Production provider identity; browser profile-edit journey |
| Android application | Bounded emulator restart, incomplete/legacy/future preservation and five genuine write-interruption boundaries | Physical devices and complete keyboard/screen-reader/enlarged-text acceptance |
| iOS application | Both accepted PR #79 six-phase runs; newer PR #72 `9f2b733` also passed both complete/incomplete/legacy journeys and native XCTests | Future-format harness, genuine interrupted writes and full accessibility/device acceptance |

The authenticated local browser journey belongs to `53ae4ec`; all 429 application
inputs are byte-identical to deployed `073a638`. Its full local suite passed 1,154
tests with three existing skips. Hosted PR evidence belongs to `073a638`; later
main checks and live production checks have separate receipts. On the live
custom domain, a fresh guest browser created a labelled synthetic tax case,
entered amounts and successfully calculated a fresh Rust result. The served
runtime manifest, JavaScript and WASM bytes match the deployed build exactly.
The guest draft is explicitly unsaved: workspace/device saving requires a
verified account, so this smoke check does not close production save/reopen or
account-history acceptance. The same guest flow opened a preliminary base
decision-report preview; hosted tax-memorandum/economic-assessment journeys
remain separate from that smoke and from the verified local/CI PDF cohorts.

The original archive-heading CI failure, earlier driver/build timeouts and the
successful-login prompt are retained with their corrections. PR #80's two newer
future-format attempts failed at different points: a post-boot inventory timeout,
and host replay rejection after the first application test passed. Neither is
counted as full future-data acceptance. Constructed temporary/backup fixtures do
not establish genuine interrupted-write recovery.

## PO/UX priorities

1. Review the deployed tax edit → calculate → save/reopen → report journey, with
   clear stale-result, missing-rate and recovery wording. Keep inputs visible and
   explain why a fresh calculation is needed.
2. Close iOS future-data and genuine interruption journeys with complete byte
   preservation, explicit refusal, restored state and freshly recomputed results.
3. Complete keyboard/focus, enlarged text and spoken screen-reader/gesture checks;
   readable screenshots alone do not prove accessible operation. Include PDF
   reading order and tagging.
4. Complete authorized provider-backed account/history and recovery checks before
   an external pilot. Pilot usability acceptance still requires actual target
   participants, not agent or trained-QA substitutes.

Physical Android/iOS checks remain open under the instruction to use CI and
emulators. Web publication, full mobile release acceptance and pilot readiness
are separate decisions.
