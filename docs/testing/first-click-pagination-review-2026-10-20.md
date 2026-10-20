# First-click pagination review — 20 October 2026

## Outcome and baseline

One Load more activation must finish the requested page depth after a successful same-authority focus verification. Every page remains a fresh authorized read; stale results and account/workspace changes cannot restore private metadata. No case writes, migration, template, report or authority-policy changes are in scope.

Opening: clean canonical main `fa7ac7f3300dec1ebc735893c8f3ee3b89e05fc0`; Site154, owner/public. Local application input hash `3429cc26e309a89cc6bfa21f9e147cda7c6152178f6c4da324a4f6ee3452fa21` and hosting hash `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe` match the live release document. Runtime source `5a7fe8b36be9238b1cd7f9e09ce8e3b3d9d7336e` differs only through the documented docs closure. Source helper opened the exact clean canonical checkout before editing.

Fresh authenticated Chrome tab178218857 reproduced25 → loading →25 on its first activation. This is a production observation before the correction. No saved case was opened, amended or deleted for that reproduction.

## Diagnosis and bounded correction

NavigationSession verifies access on window focus. A successful verification publishes the ready session even for an unchanged identity/selection. StudioCaseCatalogue intentionally rechecks server visibility on that notification, aborting the active catalogue request. Previously it then requested only page one, discarding both loaded and pending page depth. A deterministic test using the real NavigationController and catalogue reproduces the failed first activation when focus verification completes during Load more. That test failed before the correction and passes afterwards. The live browser reproduction establishes the symptom; it does not provide a captured network trace proving the ordering of that individual production request.

The catalogue now remembers requested depth only within its exact authority scope. Revalidation clears old metadata and rebuilds that depth from fresh page-one results and newly returned cursors. Query changes, explicit refresh, lost authority and disposal reset the depth. Repeated pagination while loading remains bounded. Existing epoch/abort/session fences, no-store credentials, loaded-only sorting and server search remain intact. Removed access can shrink the fresh results; a failed revalidation still clears private metadata and shows the existing error/retry state.

## Verification checkpoint

- Regression failed against the unchanged catalogue with the expected missing second page.
- Corrected My cases, navigation shell and saved-case navigation cohort:42 pass,0 fail,0 skip.
- Tests cover active pagination interrupted by verification, fresh cursor use, searched depth, removed metadata, duplicate activation, authority cancellation, late responses, query reset and zero writes. Existing visibility refresh, error/malformed reads, search and return-depth checks remain passing.
- Source/browser/local fixture, exact-main CI and native rollout evidence must be recorded separately below before claiming release.

## Remaining acceptance

Production pointer and keyboard confirmation after publication; actual measured narrow/short-height EN/RU; browser Back/Forward depth; full exact-main web/PDF gates and both-origin assets. Preserve all48 existing cases and held47/48 inputs. Broader recovery, downloaded-file, historical-package, source-content and same-tab account-switch acceptance from the canonical instructions remains open. This correction does not close those rows.

## Delivered — public Sites v155

PR160 merged runtime `4f1c0ba92584aa2286680660b51267b0c447dc18`. [Machine receipt](receipts/first-click-pagination-v155-2026-10-20.json): saved version `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_81b6f44f4ef48191914b5cc7170aba2f`, deployment `appgdep_6ad76a7c7c548191931b14691d990206`, succeeded20October13:20:23UTC /15:20:23Paris, environment42. Public audience and DB/R2 bindings unchanged. Application hash `b5833a06e79e235ef31cd38f61cf0c53fc5055c1a7a6b370729e33a8d5ba3ae2`; unchanged hosting hash `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`.

Exact-main web job118645307836 and PDF job118645307071 succeeded in run39427989444:1761 tests,1758 pass,0 fail,3 inherited skips. All47 Full PDFs, bilingual concise baselines and tax/packaged-Worker gates passed. Local strict typecheck and7 packaged provenance/retention tests passed; these overlap full-suite checks and are not additional full-suite totals. Native simulator118646550327 was queued and editor118645959501 running at publication; this is a web-only controller amendment, not completed native acceptance. No gate or workflow was disabled.

The Sites source helper built and pushed the exact merged commit. Raw local archive30374358bytes, SHA256 `cf2276056d3a4019736e56c445e7e3ae01119c558690ea1461b96092df254375`. Sites reported normalized tar49408000bytes/579files/hash `da793fd53967cad91d29fa52544a1eda0ba1a22c051b69293c1cc4a2250f2129`; that normalized hash was returned by Sites, not independently recomputed from the gzip. The predecessor v154 raw archive was hash/size pinned, its native tar paths/types validated before extraction to a new confined directory, and provenance checked. This extraction did not use the strict GNU-only old-artifact inspector. Retention verified136 current +51 previous assets; both production origins verified187/187 hashes/MIME and separately returned the exact public release document. Asset proof alone is not authenticated browser acceptance.

### Actual browser observations after publication

- Fresh authorized Chrome English tab178218860:25 → loading →48 after one pointer activation; More removed. Fresh Russian tab178218863:25 → loading →48 after one pointer activation. No second activation was needed.
- All48 displayed catalogue identities/title/time/destination tuples match the pre-release baseline. Only opaque hashes were retained locally. This is metadata comparison, not stored-case byte equality. No cases were created, saved, overwritten or deleted in this stage.
- Search submitted through Enter for QA; one pagination activation returned25 →40 results, with the normalized query and loaded title sort retained. Existing synthetic48 reopened as Saved without editing. Back restored input QA, query qa, title sort and40 rows/two pages. Forward reopened the same48 identity; Back restored the list again.
- A fresh filtered page was then submitted through Enter. English Tab reached Load more; after the browser's scrolling settled the focused button was within the measured viewport (top776/bottom823, height842). One Enter activation returned25 →40. This closes the concrete desktop English pagination keyboard row; it does not establish Russian or short-height production keyboard acceptance.
- Isolated local browser: real My cases component and navigation/catalogue controllers, synthetic transport only. Deliberately overlapping a focus verification with the first next-page read completed25 →48. At measured390×562, document width375, Russian Tab placed the44px pagination button in view and Enter returned25 →48. Local screenshot `.artifacts/pagination-ru-local-result-20261020.png` is local synthetic evidence, not production pixels.

### Limits and next work

Chrome's requested390px override again left actual desktop width2280; it was reset. Russian key delivery timed out while pointer/DOM observations worked, so do not infer a product keyboard defect. Production screenshot capture timed out; no production image file was created. A final normal-language-button activation was attempted, but subsequent browser inspection timed out, so English restoration is unconfirmed. One initial pointer Search activation left the query unapplied; Enter submitted successfully. This is an unconfirmed activation, not proof of a search defect or passed pointer-Search acceptance; reproduce independently before amending behavior.

Prior held tab IDs178218781/178218806 were absent from the current inventory. No close, reload, discard or replacement was issued for them, and retained input cannot be verified anew in this run. Preserve any available recovery copies and remaining user tabs. All synthetic saved cases remain untouched.

Remaining: actual narrow/short-height EN/RU production checks, Russian keyboard when delivery works, operator-authorized owner recovery, actual downloaded file bytes, historical package/old-application compatibility and isolated same-tab authority transitions. The source tests exercise cancellation/late results/zero writes; they do not close those production rows. Next bounded product amendment remains Back-to-actions history state, after independent reproduction and preservation of input/Undo. Do not redeploy this runtime merely for Markdown closure.
