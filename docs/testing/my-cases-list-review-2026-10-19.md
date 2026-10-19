# My cases list and editing usability

## Scope and source verification

User requested a more usable list and editing entry, with amended UI style. Before editing: clean isolated checkout and freshly fetched canonical main `e2b5283549c3447bf590b809788551b06147ea53`; native Sites v149 points to `bcd50f3342413fb5ac8cd55811a519d3c9b5239b`. The difference is seven Markdown files only. Existing Site remains public. Supported Sites opening returned the exact canonical checkout/HEAD. Root checkout belongs to another writer and is untouched.

## Acceptance before implementation

- Replace narrow four-column draft cards with readable full-width rows; retain complete long titles and distinguish duplicate titles by saved ID.
- Search loaded authorized records by title, author or ID; deterministic in-memory sorting by update/title without mutating records or implying global search.
- Readable bilingual UTC dates with exact original timestamp retained; accessible, clearly named Studio links preserve custom-case ID, organization and language.
- Owned and other authorized drafts remain distinct. Owner action says Edit; shared/admin action says Open. Studio remains responsible for effective authorization.
- Narrow EN/RU layouts have no content overflow, reachable actions and visible keyboard focus. Loading, failure, empty/search-empty and pagination remain explicit.
- No storage, schema, persistence, migration, source factory, report renderer or permission changes. Retain every existing/synthetic production case. No inline rename/delete or background writes.

## Evidence

Candidate checks: 11/11 My cases tests pass, including existing authority expiry/stale-response/pagination fences, plus immutable loaded-set search/sort, duplicate IDs, EN/RU UTC formatting, invalid dates and exact continuation links. TypeScript passes. Diff reviewed: presentation and memory-only selection helpers only; catalogue transport and server contracts unchanged.

Rendered actual row component with clearly labelled synthetic fixtures: desktop long titles and aligned actions visually reviewed; narrow Russian at actual 390 CSS pixels, document scroll width 375, no horizontal content overflow. This fixture is layout evidence, not authenticated application acceptance. Full-application preview and production acceptance remain separate. Review caught and removed a misleading no-results instruction to load more when the final page has no cursor.

## Final candidate and rollout status

Implementation merged through [PR 146](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/146), exact runtime candidate `d4547efd3fcc1f36207f121ffe43348fc8530f6f`. The isolated source is clean. The first local build was discarded after detecting a Windows stylesheet line-ending mismatch; restored the exact Git blob and rebuilt. Final release identity proves exact merged bytes:

- Application inputs SHA256 `f1ac3ce1875b3fb27ae64311d8e58cc27867907ee68423cb453880d9fc81ea57`.
- Hosting SHA256 `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe` (unchanged).
- Final local build and TypeScript pass. Final list/rendered-bundle cohort **13/13**, no failures/skips (overlaps the earlier 11; do not add them). JurisApp entry remains **319,350 / 325,000 bytes**.
- Exact-main [web/PDF run 39325726429](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/39325726429): Windows `pdf-visual` job **118310939469 succeeded**; `web-and-pdf` **118310940041 still running** at this checkpoint. Do not infer the full-suite result from local targeted tests or the PDF job.
- Synthetic row fixture checked at desktop and actual **390 CSS pixels in EN and RU**, document scroll width **375**. Keyboard Tab reaches the named Studio action with a solid focus outline. An earlier stale-tab press timed out; a fresh fixture tab passed. Static fixture evidence remains distinct from authenticated product interaction.
- Full application local preview serves but is signed out, so private-list interactions were not locally accepted. Authorized production v149 baseline: 25 loaded drafts, exact saved IDs 45,44,43,42,41,40,39,38,37,36,35,32,33,34,31,30,27,26,24,22,25,23,21,29,28 recorded read-only. No case save/delete/permission operation performed.

Supported Sites opening and packaging succeeded for that exact candidate. Previous-live archive verified against raw SHA256 `f677057fa72ac542b5a6a40e4c36f61fb01ca179f0d77720c16f3c783f3c1028`; extracted only checked `dist/` paths. Build retains **126 current + 50 previous assets = 176**; only the immediate predecessor's current manifest is carried forward.

Package: `C:/PROJECTS/Genesis-AI-Juris/.artifacts/casevant-list-d4547ef-20261019.tar`.
Raw package SHA256: `110af85fb349173f9e4c4a1add42805ff33d6215bb7962569f702fb0b75004fd`.

**Publication blocked by Sites archive upload connectivity.** Initial save response could not be retained by result handling; reconciled native version history before retrying. Two subsequent native save attempts explicitly failed connecting to `sdmntprindiasocentral.oaiusercontent.com`. Native newest-version reconciliation still returns **v149**, `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_3d8124b1d6288191bbe400b95efd92bd`, source `bcd50f3342413fb5ac8cd55811a519d3c9b5239b`. No v150 receipt or deployment exists. Production remains unchanged; do not call this UI shipped. Local package creation succeeded, so do not omit the archive to bypass the upload failure.

## Continuation: bounded publication and authenticated acceptance

1. Recheck the exact-main web/PDF run above; inspect any failure and correct/reversion/test before publication. Reverify canonical main and live v149 rather than assuming no concurrent release. If another application release exists, reconcile and retain its assets instead; do not overwrite it with this dated artifact.
2. For unchanged candidate, verify the existing archive hash, exact pushed Sites source `d4547ef...` and application/hosting hashes above. Use fresh Sites credentials/source helper if source synchronization is needed; never expose credentials. Keep docs-only closure distinct from application inputs.
3. Retry native `save_site_version` with the unchanged exact archive/source and existing project. Resolve uncertain outcomes with version history before another save. Preserve the existing public audience and DB/DOSSIER_DOCUMENTS bindings. After native save success, deploy its returned exact saved version ID, await terminal native success and record the receipt. Do not invent v150 or a deployment ID.
4. Verify all **176** assets on both existing origins against exact candidate and predecessor (or recomputed counts if a concurrent release required reconciliation); static bytes alone do not prove hydration or authentication.
5. Fresh authorized Chrome: inspect full desktop layout with global styles; compare baseline IDs/titles/exact timestamps and destinations. Search title/author/ID and no-match/reset; sort both date orders and title; load more while a search is active, confirming loaded-only disclosure. Preserve owner/shared grouping; do not add artificial sharing to manufacture a row.
6. Follow the named Edit link for preserved synthetic **45**, confirm the exact saved case/version/source and return to Personal. Do not amend user42 or create unnecessary writes. Test narrow EN/RU full application toolbar, long titles, focus, actions and horizontal overflow using actual measured CSS widths. Local row fixtures do not close this production check.
7. Save a production screenshot, append exact native/static/browser evidence here, and update current instructions/backlog/status through ordinary review. Preserve every original/synthetic case. The separate historical imports, same-tab account cancellation, original-source acquisition and product-research backlog remains open.

Local evidence directory: `.artifacts/my-cases-preview/` (final-tests.log, merged-build-exact.log, verified predecessor extraction and list-layout-desktop.png). This candidate adds no schema migration, user-edit merge, data cleanup or human-review approval.
