# UI/UX and functionality refinement review — 20 October 2026

## Opening and outcome

Native Sites remains public v152 at casevant.pro. Canonical main was ce23ff4 at opening; PR #155's two web/PDF runs and PDF visual gates passed, and the ordinary PR merge produced5dbb2cf4ff915334648937483dd811ebd109527e. Local checkout was clean, fast-forwarded and branched for this slice. Android/editor/simulator jobs were still pending separately at merge; they are not claimed complete. No live binding, audience or saved case was changed.

Review current production task journeys and amend the canonical continuation instructions. Implement the already-proposed bounded release-awareness notice while preserving draft, source, account, recovery and export contracts. The development plan defines acceptance before edits.

## Fresh production observations

Authorized Chrome Maxim, fresh task-owned tabs only; existing user and unsaved tabs were not reloaded. Case #47 was opened from a submitted search for “materials and search return”. Its Review 1 item action opened the connected evidence form, selected Sources and evidence, and focused the required title input. Its material inventory showed9 reference documents and1 working evidence record, explicit review status, readable text controls, ZIP/per-file actions and N01…N14 sorted destinations. No form data was added and no save/write/delete was invoked.

Browser Back traversed section history and restored the submitted query with1 result. After clearing search and loading page two, all 47 authorized catalogue rows were visible. The historical ERP 2.2 case #16 opened with191 nodes / 307 connections and Saved-to-workspace status. Returning restored 47 entries, proving two-page depth restoration for this EN journey; it does not prove every language/account/race combination or an A/B save.

Measured EN/RU lists at 390 × 561 CSS pixels had no horizontal document overflow. The pagination click reached the bottom at scrollY 7515.6 of 8077 px and loaded the remaining results. The viewport capability requested390×560 but initially produced585×840 because of browser scale; adjusted requests were measured rather than assumed. Temporary sizing is reset after review. Pointer reachability is not keyboard acceptance.

Tab delivery from the unique enabled search input timed out; observed focus remained the search input. Click submission worked. The desktop correction screenshot file was blank on inspection; a390px capture timed out. These files do not prove visual appearance. Do not infer a product keyboard defect or call a blank screenshot a passed visual check. Current source inspection confirms semantic native controls, but actual keyboard and complete visual acceptance remain open.

## Findings and execution order

- Repair stale continuation status: its opening called v150 current while later sections recorded v152.
- Retain delivered Review/search/materials behavior. Avoid repeating those features based on old screenshots.
- Add safe release awareness for future long-lived tabs; never automatically refresh them.
- Investigate repeated saved-state/first-use prompts and residual Back-to-actions state as separate bounded refinements, preserving unadded inputs and all current qualifications.
- Keep original-artifact, production-owner-recovery, account race and full historical save/export rows open according to their real prerequisites.

Implementation, test and release results are appended after execution. A reviewed candidate is not a production release.

## Implemented candidate and review corrections

`/api/studio-release` returns only validated packaged source/application/hosting identities with no-store headers; unavailable build identity returns503. The optional Studio notice compares application/hosting hashes, not source-only documentation commits. Checks omit credentials and case/search/account context, reject redirects and oversized streamed bodies, throttle focus checks, stop while hidden, abort after 5 seconds and cancel on unmount. Offline/malformed failures do not block the editor. No persisted field, template, source packet, recovery bytes or authority rule changes.

The in-flow EN/RU notice keeps update options collapsed. Save and sealed-JSON export use existing handlers, with save-envelope, saved-state, authority and pending-operation guards. A new-tab/noopener link opens a fresh Studio; it does not send the draft or refresh the current tab. Unadded form input and export-vs-save distinctions remain explicit. Dismissal is in-memory for the exact application/hosting mismatch. No notice auto-focuses; explicit dismissal restores the previous visible, connected control when available. An optional loader owns chunk failure through the established local recovery guard, and a local boundary prevents a failed notice render from interrupting the editor.

Review corrections: replaced an unguarded React.lazy notice import with the silent optional loader so a failed update chunk cannot trigger global recovery/reload. Restored original-control focus on explicit dismissal. Restricted the export offer to confirmed saved/submitted state and verified output authority; the export handler still rechecks exact content and authority. The initial test bundle lacked an output path for CSS modules; its harness was corrected. ESLint caught the reserved local name `module`, which was renamed; pre-existing JurisApp warnings are separate.

## Render and interaction evidence

Because authorized Chrome capture was blank/timed out, a separate loopback 4177 synthetic component harness rendered the actual notice component plus its generated CSS and retained application global stylesheet. Its conspicuous synthetic label is retained in screenshots. It contains no case/account/authentication/storage data and invokes only synthetic callbacks. This is component evidence, not full-application or production save evidence.

Desktop EN appearance and actual 390 × 640 RU layout were inspected: readable teal/warm accents, wrapped Russian actions, no horizontal overflow, minimum 44 px controls, native details and no overlay. Local IAB Tab focused the Save control, Enter invoked only the labelled synthetic callback, and Enter on Keep working dismissed the notice while retaining synthetic content. This does not close production Chrome keyboard acceptance. Screenshots: `.artifacts/release-notice-en-component-20261020.png`, `.artifacts/release-notice-ru-narrow-component-20261020.png`. All temporary browser viewport overrides were reset.

The first notice release cannot retrofit itself into existing v152 tabs. A genuine cross-deployment notice check remains pending until an already-featured tab encounters a later application/hosting identity. Do not manufacture this result or describe synthetic component callbacks as authenticated saves.

## Candidate verification

The final focused release/provenance/recovery/chunk cohort passed 11/11, with no skips. It executes the actual notice effect with modelled timers/DOM and verifies same-application silence, streamed-size limits, timeout/late-response refusal, hidden/throttled polling, exact-identity dismissal, explicit focus restoration and no automatic save/export/navigation/storage. The optional loader's rejected chunk and departed-editor paths are covered. Six of these tests are the new notice slice; overlapping earlier cohorts are not added as unique coverage.

TypeScript passed after correcting the loader test seam's inferred module type to the actual required default-component contract. Changed-file ESLint passed with zero errors and seven inherited unused-variable warnings in JurisApp. No warning was suppressed, dependency added, source/template factory changed or report lock rewritten. Logs are retained under `.artifacts/studio-release-notice-*-20261020.log`. Exact merged-source CI/build and Sites rollout are recorded below only after completion.

## Delivered — public Sites v153

Published 20 October 2026 at 13:28 Europe/Paris (native receipt 11:28 UTC) to the existing public CaseVant Site. [Implementation PR #156](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/156) merged normally to runtime `3d36b98c40b6fec9d62867b3474cce3f214cfb04`. The Sites source helper opened that exact canonical merge, built it and packaged the retained predecessor assets. [Exact-main web/PDF gate](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/39413848632/job/118597951312) and [PDF visual gate](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/39413848632/job/118597951777) succeeded before deployment, including all 47 full PDFs and unchanged bilingual concise/tax baselines. Other platform/editor/simulator jobs are separate and are not claimed complete. Local full-suite result: 1,752 passed / 0 failed / 3 inherited skips, 1,755 total. The reviewed head 2b4fabc and merge 3d36b98 have the identical Git tree `64f71efdb41581df98080d6ee8f0583e7007ad51`; canonical merge CI is the exact-source release gate.

| Receipt | Exact value |
| --- | --- |
| Saved version | `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_03048b23f39c81919a498b8e5176fed0` ·153 |
| Deployment | `appgdep_6ad7504a8acc8191a511ea6e8fb6547f` ·succeeded |
| Environment/audience | 42 / public, unchanged |
| Application inputs | `6ef4fa2cb7d1be615ca95bec75e55358220f3eb46f4ba585e6bdf493e04fca4d` |
| Hosting config | `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe` |
| Raw local archive |30,373,723 bytes, SHA256 `183e9686da9d08337f95b7de28db1dfb4078a90d6412ef28801c22d3333facf8` |
| Native normalized archive |49,387,520 bytes / 576 files, SHA256 `6e911beb9d2973b45e81c9fa75689621d12e30e2482ca88511a07068b4bf2f44` |
| Client assets |136 current + 48 additional retained v152;184/184 verified on each origin |
| Initial Studio entry |283,345 / 325,000 bytes; cap unchanged |

Raw gzip and native normalized tar identities describe different representations; do not equate their hashes. Retained predecessor is actual v152 source 3f0fda5, whose original raw archive and native receipt were pinned before extraction. Public [casevant.pro](https://casevant.pro) and [Sites origin](https://genesis-juris-web.maxim-hayan.chatgpt.site) both returned the exact current source/application/hosting identity from the new anonymous GET endpoint with `private, no-store`. Asset receipts retain their truthful `browserHydrationVerified:false`/`authenticatedWorkflowsVerified:false`; separate browser observations follow. Local receipts: `.artifacts/notice-v153-*-assets-20261020.json` and `.artifacts/notice-v153-live-release-identities-20261020.json`. [Portable receipt](receipts/ui-ux-v153-2026-10-20.json).

The exact merged built Worker also passed local anonymous GET 200 / POST 405 with identical public metadata and an unchanged initialized synthetic D1 schema/sentinel. Its first probe expected only `no-store`, but the existing security middleware correctly strengthened it to `private, no-store`. A later probe initially included lazy D1 provider metadata initialization in the baseline; it was corrected by initializing a labelled sentinel before snapshotting. These were fixture corrections, not production data changes. No production mutation request was used for this endpoint check.

### Fresh authenticated production observation

Chrome Maxim opened an independent, task-owned v153 view of existing synthetic #47. The settled UI showed its exact title, Saved-to-workspace status and Review 1 item. While visible, the current build showed zero update notices, as expected for matching identities. Review 1 item opened Sources and evidence and focused the required evidence-title control; the unchanged9-document library and N01…N14 destinations remained available. No content was entered and no save, export, delete or transfer was invoked. Every existing/unsaved case is retained. The test tab is retained for a later legitimate update check; do not reload it to simplify that check.

Chrome screenshot capture again timed out. Its successful DOM/focus observation is not complete visual or keyboard acceptance, and the quiet initial load is not a cross-deployment notice observation. The local synthetic component screenshots and keyboard test remain separate evidence.

### Amended next execution

1. Reduce repeated saved-state/first-use guidance using the bounded existing-state design in the continuation instructions; preserve confirmed header status, all unadded input, report access and failure/conflict paths.
2. On the next legitimate application release, use the retained v153 QA tab to observe the notice, exact draft/authority preservation, restricted actions and explicit dismissal/new-tab behavior. Do not auto-refresh any old user tab or manufacture a second deployment for acceptance.
3. Continue live materials multi-record move/delete Cancel/transfer/Undo and actual downloads on clearly labelled synthetic copies. Preserve every prior case.
4. Keep production keyboard/complete visual, original-v149 round trips, full historical A/B saves, same-tab account/source cancellation and legitimate owner recovery explicitly open. The retained old-client tab focus operation timed out; export root cause remains unconfirmed. Check visible export eligibility and feedback before awaiting a file, and use ordinary local synthetic save/seal where required. Never inject unsupported payloads into production cases to create a test source.
5. Keep the 43 missing-source disclosures, frozen historical factories and full tax/evidence/protection/history carriers. Governed user-edit merge, evaluator targets, operator readiness and commercial consent gates remain separate future work.

Documentation closure changes no application/hosting input and needs no additional runtime deployment.
