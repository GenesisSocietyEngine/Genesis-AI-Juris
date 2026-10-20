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
