# UI/UX and functionality refinement review — 20 October 2026

## Opening and outcome

Native Sites remains public v152 at casevant.pro. Canonical main was ce23ff4 at opening; PR155's two web/PDF runs and PDF visual gates passed, and the ordinary PR merge produced5dbb2cf4ff915334648937483dd811ebd109527e. Local checkout was clean, fast-forwarded and branched for this slice. Android/editor/simulator jobs were still pending separately at merge; they are not claimed complete. No live binding, audience or saved case was changed.

Review current production task journeys and amend the canonical continuation instructions. Implement the already-proposed bounded release-awareness notice while preserving draft, source, account, recovery and export contracts. The development plan defines acceptance before edits.

## Fresh production observations

Authorized Chrome Maxim, fresh task-owned tabs only; existing user and unsaved tabs were not reloaded. Case47 was opened from a submitted search for “materials and search return”. Its Review1item action opened the connected evidence form, selected Sources and evidence, and focused the required title input. Its material inventory showed9 reference documents and1 working evidence record, explicit review status, readable text controls, ZIP/per-file actions and N01…N14 sorted destinations. No form data was added and no save/write/delete was invoked.

Browser Back traversed section history and restored the submitted query with1 result. After clearing search and loading page two, all47 authorized catalogue rows were visible. The historical ERP2.2 case16 opened with191nodes/307connections and Saved-to-workspace status. Returning restored47 entries, proving two-page depth restoration for this EN journey; it does not prove every language/account/race combination or an A/B save.

Measured EN/RU lists at390×561 CSS pixels had no horizontal document overflow. The pagination click reached the bottom at scrollY7515.6 of8077px and loaded the remaining results. The viewport capability requested390×560 but initially produced585×840 because of browser scale; adjusted requests were measured rather than assumed. Temporary sizing is reset after review. Pointer reachability is not keyboard acceptance.

Tab delivery from the unique enabled search input timed out; observed focus remained the search input. Click submission worked. The desktop correction screenshot file was blank on inspection; a390px capture timed out. These files do not prove visual appearance. Do not infer a product keyboard defect or call a blank screenshot a passed visual check. Current source inspection confirms semantic native controls, but actual keyboard and complete visual acceptance remain open.

## Findings and execution order

- Repair stale continuation status: its opening called v150 current while later sections recorded v152.
- Retain delivered Review/search/materials behavior. Avoid repeating those features based on old screenshots.
- Add safe release awareness for future long-lived tabs; never automatically refresh them.
- Investigate repeated saved-state/first-use prompts and residual Back-to-actions state as separate bounded refinements, preserving unadded inputs and all current qualifications.
- Keep original-artifact, production-owner-recovery, account race and full historical save/export rows open according to their real prerequisites.

Implementation, test and release results are appended after execution. A reviewed candidate is not a production release.

## Implemented candidate and review corrections

`/api/studio-release` returns only validated packaged source/application/hosting identities with no-store headers; unavailable build identity returns503. The optional Studio notice compares application/hosting hashes, not source-only documentation commits. Checks omit credentials and case/search/account context, reject redirects and oversized streamed bodies, throttle focus checks, stop while hidden, abort after5seconds and cancel on unmount. Offline/malformed failures do not block the editor. No persisted field, template, source packet, recovery bytes or authority rule changes.

The in-flow EN/RU notice keeps update options collapsed. Save and sealed-JSON export use existing handlers, with save-envelope, saved-state, authority and pending-operation guards. A new-tab/noopener link opens a fresh Studio; it does not send the draft or refresh the current tab. Unadded form input and export-vs-save distinctions remain explicit. Dismissal is in-memory for the exact application/hosting mismatch. No notice auto-focuses; explicit dismissal restores the previous visible, connected control when available. An optional loader owns chunk failure through the established local recovery guard, and a local boundary prevents a failed notice render from interrupting the editor.

Review corrections: replaced an unguarded React.lazy notice import with the silent optional loader so a failed update chunk cannot trigger global recovery/reload. Restored original-control focus on explicit dismissal. Restricted the export offer to confirmed saved/submitted state and verified output authority; the export handler still rechecks exact content and authority. The initial test bundle lacked an output path for CSS modules; its harness was corrected. ESLint caught the reserved local name `module`, which was renamed; pre-existing JurisApp warnings are separate.

## Render and interaction evidence

Because authorized Chrome capture was blank/timed out, a separate loopback4177 synthetic component harness rendered the actual notice component plus its generated CSS and retained application global stylesheet. Its conspicuous synthetic label is retained in screenshots. It contains no case/account/authentication/storage data and invokes only synthetic callbacks. This is component evidence, not full-application or production save evidence.

Desktop EN appearance and actual390×640 RU layout were inspected: readable teal/warm accents, wrapped Russian actions, no horizontal overflow, minimum44px controls, native details and no overlay. Local IAB Tab focused the Save control, Enter invoked only the labelled synthetic callback, and Enter on Keep working dismissed the notice while retaining synthetic content. This does not close production Chrome keyboard acceptance. Screenshots: `.artifacts/release-notice-en-component-20261020.png`, `.artifacts/release-notice-ru-narrow-component-20261020.png`. All temporary browser viewport overrides were reset.

The first notice release cannot retrofit itself into existing v152 tabs. A genuine cross-deployment notice check remains pending until an already-featured tab encounters a later application/hosting identity. Do not manufacture this result or describe synthetic component callbacks as authenticated saves.

## Candidate verification

The final focused release/provenance/recovery/chunk cohort passed11/11, with no skips. It executes the actual notice effect with modelled timers/DOM and verifies same-application silence, streamed-size limits, timeout/late-response refusal, hidden/throttled polling, exact-identity dismissal, explicit focus restoration and no automatic save/export/navigation/storage. The optional loader's rejected chunk and departed-editor paths are covered. Six of these tests are the new notice slice; overlapping earlier cohorts are not added as unique coverage.

TypeScript passed after correcting the loader test seam's inferred module type to the actual required default-component contract. Changed-file ESLint passed with zero errors and seven inherited unused-variable warnings in JurisApp. No warning was suppressed, dependency added, source/template factory changed or report lock rewritten. Logs are retained under `.artifacts/studio-release-notice-*-20261020.log`. Exact merged-source CI/build and Sites rollout are recorded below only after completion.
