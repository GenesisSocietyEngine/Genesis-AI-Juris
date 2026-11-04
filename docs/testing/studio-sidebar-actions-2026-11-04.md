# Studio sidebar actions — 4 November 2026

## Outcome and source

Remove the duplicate sidebar New blank case and Import case or prompt links. Replace the working editor's More actions popup with three native disclosure groups immediately after Case Studio: Start or review, Case briefs, and Files & backups. Use one rail depth, matching icons and one open action group at a time. Keep their compact subactions directly below their headings; preserve primary New draft, Save to workspace and analytical report controls.

Canonical base is `8d4f97a8eea5b4ee09b1a5678c892e2774f544bb`. Both public origins reverify v175 runtime `e6addb90fe3ab60eb16b1f079868c1530fec6ebd`, application hash `a14649c7b6e23c8de72dd8a66502995d9e22ecb9bcf9cb54a261e97d86fb1d41` and hosting hash `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. Main differs from the deployed runtime in documentation only. Sites opening verifies the selected existing project and checkout; its first network-restricted attempt fails, the network-enabled retry succeeds. Native diagnostic PR215 remains an independent unmerged draft.

## Implementation and preservation review

A React provider inside each Studio application instance supplies one sidebar DOM destination. The current editor portals its actual commands into that destination; no global command registry or copied case state are introduced. The slot unregisters on desktop/mobile remount. It is scoped to the Studio application rather than the shared authentication layout, so another cached page cannot register its commands into this sidebar; the authentication provider is unchanged. A bounded native listener on the owned slot closes the mobile drawer before an action opens another surface; portal events otherwise follow the editor's React ancestry. Native details/summary retain keyboard behavior; Escape closes the current group and focuses its summary. Developer-mode inline commands remain available.

Sidebar Markdown imports use the existing `loadStudioFile` owner, preserving its exact draft/prompt/account-context and sequencing checks. File selection, decoder, import preview, workspace/device save, sealed export and report handlers retain their contracts. The account-boundary requirement, copy protection, export-readiness restrictions and exact saved-version separate-tab inspection remain. No schema, case/source identifier, factory, carrier, recovery, authority policy, persistence or PDF renderer changes. Current Help text has no More actions instruction; dated historical transcripts/recordings remain untouched.

## Observed local browser acceptance

Only a newly created local tab at port 4199 and a blank local draft were used. No production case or existing tab was claimed, opened, saved, deleted or reloaded. The entry screen keeps its primary Create/import controls, while duplicate navigation links are absent. Working editor has no More actions popup.

Desktop: all three sidebar groups render below Open Case Studio. Case briefs opens its original import/export controls; Markdown export is disabled for the empty case. Actual Escape collapses the group and returns focus to its summary. A normal screenshot records the header and sidebar together.

Narrow: measured CSS viewport 390 × 640, document width 375 (no horizontal overflow). Drawer exposes all three groups and file/backup subactions. A valid viewport screenshot is retained, unlike the previous Help capture failure. Clicking Save on this device closes the drawer, restores navigation-button focus and shows the existing verified-account requirement; this is a refusal observation, not authenticated save acceptance. Switching to Russian preserves groups and readable wrapping; a screenshot records the narrow Russian actions. Temporary viewport override is reset. These local UI observations do not close old Help capture, S03 authenticated A/B or same-tab identity/timing rows.

Screenshots are retained under `.artifacts/sidebar-actions-20261104/desktop-en.jpg`, `mobile-en.jpg` and `mobile-ru.jpg`. Devtools only reports the browser extension's injected `data-scribe-recorder-ready` hydration attribute mismatch; no application exception is observed. Browser cache was not cleared.

## Checks and release gate

Focused navigation, bilingual action protection/readiness, Markdown presentation and prompt-file checks: 39 passed, zero failures/skips. Initial and final post-wiring strict typechecks pass; full CI is tracked separately. Touched new action/context/Markdown components lint with zero findings. Broader touched-file lint has no errors and seven pre-existing JurisApp unused-variable warnings; the newly introduced placeholder warning was removed. React review checks hook stability, one current owner, callback cleanup, SSR isolation, native disclosure semantics and 44px control sizing through existing sidebar styles.

Full web/PDF CI, ordinary PR integration, exact-main build provenance, existing Sites publication and fresh production browser verification remain required before delivery. Preserve the current public audience, environment and DB/DOSSIER_DOCUMENTS bindings. Retain v175 current client assets for existing tabs; do not retain an unbounded asset chain. Native checks remain separately reported under the existing web-only authorization; PR215 is not included.

## Continuation

Do not duplicate this navigation in the header or reintroduce removed sidebar creation/import links. Keep the entry screen's primary actions and current case handlers. Any future mobile or source-context amendment must demonstrate disposal of stale commands and retain working-case/file authority boundaries. Continue independent S03/S05 acceptance and all existing missing-original, owner recovery, historical-artifact, native and commercial limits; no disposal, governed merging, provider processing, analytics, pricing or outreach is added.

## User-led visual refinement and UI audit

The initial preview was correctly identified as too deeply indented and text-heavy. The same PR now flattens the action groups beside the main navigation, aligns their icon/text columns and uses single-depth child controls. Native named disclosures keep only one action group open, reducing rail scrolling. Compact subactions have a consistent subtle border and restrained hover/focus accent rather than large bold cards. Routine brief/file explanations move to small native help disclosures: hover shows their browser-native hint; click/Enter/tap exposes the same full text. Help remains usable without hover. Access, save, validation and confidentiality warnings remain visible in their existing flows.

The five workflow section controls now all have a visible frame, equal spacing, consistent hover/focus treatment and a stronger selected fill/border/inset line. Existing aria-pressed state, click owners and URLs are unchanged. Short EN/RU purpose hints use native titles, while their visible names remain self-explanatory. Reduced-motion preferences remove the added color transition. This is a bounded Studio navigation audit, not a claim that every editing form or S03/S05 acceptance row is complete.

Further independent refinement should measure the source/Review/return task paths and dense editing forms before changing their carriers or validation. Keep essential authority and missing-evidence warnings visible; do not hide them as cosmetic hover text. The older nested-rail screenshots are superseded visual drafts, not acceptance of this final refinement. Recheck the flattened rail and workflow frames at desktop/narrow EN/RU before publication.

### Final refinement observations

The revised action groups and primary navigation have equal measured width (182 CSS px in the normal browser configuration). Only the selected group is open. Routine notes are absent from the painted rail until requested; the same full explanation is exposed as native Help/title and by disclosure. Actual keyboard Tab focuses Sources & evidence with a visible teal outline. All five workflow controls have a 1px frame; selected Overview has the accent frame/fill/inset marker. At measured 390 × 640, document width is 375, four controls are 156.8 × 44 and Reports is 321.6 × 44. Russian file actions each measure 44px high and fit the full drawer width. A fresh screenshot after a visibility check confirms the expanded Russian actions; the immediate preceding capture had lagged one painted frame and was replaced rather than counted.

Final typecheck and touched navigation/action/tab/Markdown lint pass. Focused checks remain 39/39. Normal and narrow screenshots are `polished-desktop-en.jpg`, `polished-drawer-ru.jpg` and `polished-workflow-ru-narrow.jpg` under the ignored task directory. Earlier nested-rail screenshots are retained as superseded drafts. No claim of production, authenticated save or actual pointer-hover-tooltip timing is made from these local checks. Full final-candidate and exact-main CI remain release gates.

## Delivered — public Sites v176, 4 November 2026

[PR216](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/216) merged as `5e5840e23ac1da4141741accc178032a3273594b`. Candidate web/PDF 41805816254 and exact-main 41807361963 pass 1,895 tests / zero failures / three inherited skips plus two HTML checks, strict types/lint/history/contracts, packaged browser/Worker/tax execution, unchanged PDF locks and both zero-finding dependency audits. The [native release receipt](receipts/studio-ui-v176-2026-11-04.json) retains exact artifact/source/runtime/binding evidence and pending native snapshots.

Verified CI ZIP SHA-256 `609a967806e868750761fb7d0b776736782fd847e9c5afd9fc40a3403747114e`, 33,222,780 bytes / 548 entries, matches source/tree/all 588 runtime inputs before adoption. The input helper tar has SHA-256 `12c6413c4738766c02a3de5b189a677578ce83b76e8082f053835a8a32314ad2`; the native normalized saved archive is separately `sha256:bc06844d3f7dd05f523cd95918ec374ce6c2edfef942f1b9d1dfd8a627981331`. The helper's archive-location guard first refuses an .artifacts target before adoption; packaging then succeeds outside the checkout without rebuilding or changing source. One new saved version and one deployment occur.

Saved version `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_00d01b1b58b48191abc76eaea65c0b3e`, deployment `appgdep_6aeafddc2e888191898971bca4345305`, succeeds at 09:42:14 UTC. Both public origins verify exact source/application/hosting hashes and 194/194 assets: 137 current and 57 additional assets retained from v175's current manifest of 137 files. Public audience, environment revision 42 / all 13 returned representations and DB/DOSSIER_DOCUMENTS remain unchanged.

### Fresh production review

Only a new production tab and a blank unsaved working draft are used. Existing user tabs are not claimed/reloaded, saved rows are not opened and no Save, import, export or disposal control is activated. The existing authorized owner interface resolves normally. Duplicate navigation creation/import and the header popup are absent; all three flat groups and five framed workflow controls hydrate. Overview selection, title/Help purposes, Tab focus and keyboard help Enter/two-level Escape are observed. File/brief readiness guards remain intact; this is not authenticated persistence acceptance.

EN/RU drawer interaction and actual 390 × 640 CSS layout pass: page width 371, workflow controls 44 px and no horizontal overflow. Existing per-origin browser scaling initially produces 488 × 800 from a 390 × 640 override; a 312 × 512 override yields the measured 390 × 640 without changing zoom preferences. Production narrow screenshot capture times out in Page.captureScreenshot; no narrow production image is counted. Valid local narrow captures remain separate. Normal production screenshots pass; the viewport is reset to 1903 × 790 and final locale English. The released tab and the user-reviewed local preview are retained. No application exception or data loss is established by the capture failure.

### Amended continuation

Preserve this version and receipt; documentation-only closure must not create another Sites release. Observe existing main native runs to terminal before a documentation-only main push could cancel them. PR215 is unmerged and its native padding/completion investigation remains independent. Continue the existing S03/S05 and all historical/source/carrier/PDF/operator/commercial boundaries in canonical instructions. Use a separate testing tab/worktree while the user actively reviews the local preview. Do not restart its server or reset another tab's unsaved draft.

### Retained open diagnostics

Main iOS Tax Application 41807361978 fails when `simctl launch` exceeds 30 seconds; no application checkpoint or new padding assertion is observed. Its diagnostics also hit the screenshot limit of 1 second and EPERM. The artifact bound to the exact source is retained and hash-verified: ID 13311289701, SHA-256 `4c874918e1af149a83144520efd9de0962d96a4bc2f8d569733eb622a0dd61ba`, 147,086 bytes / 27 entries. Native Dart source is unchanged by this UI release. This failure does not establish the application's padding cause and is not closed by the successful web publication. Keep the remaining native lifecycle run intact before integrating documentation closure.

The fresh production tab returns eight errors with the same asynchronous message-channel-closed wording. The browser supplies the page URL but no stack/initiator; app/worker/public source search finds no browser-runtime messaging call site. That does not cover injected extensions or dependencies and does not establish a cause. No error suppression, browser security change or speculative application patch is added. Preserve this diagnostic separately from observed UI behavior; desktop interaction checks pass, while production narrow visual capture remains unverified.

Main iOS Native FFI lifecycle 41807362081 subsequently completes successfully before the documentation closure is integrated. The separate iOS Tax Application failure above remains unresolved; lifecycle success does not close it.

## PR217 follow-up — fresh production and CI review

Both live runtime identities remain exactly `5e5840e23ac1da4141741accc178032a3273594b`; canonical main is reverified before this documentation-only amendment. Existing cases, unsaved tabs and the active port 4199 preview remain untouched. One new blank production tab is used for view/disclosure/locale checks and closed afterward; no saved row or mutation/import/export control is activated.

### Responsive and keyboard evidence

At forced actual 390 × 640, DOM width/scroll width are both 371. Standard capture times out after 5000 ms. A supported 390 × 640 clip returns repeated tiles beyond the measured page and is retained as an anomaly, not accepted proof; a compensated 312 × 512 clip times out. No stylesheet or global zoom preference is changed to accommodate the capture tool. Clearing the override yields the browser's current actual 464 × 800 viewport, with document/scroll width 445. Normal viewport captures now succeed: EN workflow controls wrap to two columns plus full-width Reports, retain selected accents and show no horizontal overflow; RU file actions fit the drawer. These valid images do not close exact 390 × 640 visual acceptance.

Files help expands by visible AX click and native Escape closes it with focus retained. A supported text-locator Enter action reports no matching element while the same AX element remains present; this input/helper limit is not a demonstrated product defect. Locale switches and blank Overview are observed. English is restored and the override cleared before the new test tab is closed. The narrow organization/account footer is visibly dense and should receive a separate measured UX refinement; no speculative runtime amendment is folded into this docs closure.

### Console attribution investigation

Fresh initial warning/error logs are empty; four identical asynchronous message-channel errors later recur at 10:22:53 UTC with the RU page URL but no stack/initiator. The final scoped log is retained locally. App/Worker/public/packaged-JS searches find no Chrome/browser runtime messaging calls or the error wording. The document lists only the four expected same-origin runtime/framework/client script URLs; DOM script enumeration does not cover isolated extension worlds. [Chromium's extension message port source](https://chromium.googlesource.com/chromium/src/+/9256bc8b668f61e755ab587f623e7da94d8a6f47/extensions/browser/api/messaging/extension_message_port.cc) defines this error class, and [Chrome's messaging guide](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) describes asynchronous response-channel lifetime. That supports investigating extension messaging, not identifying an emitter or proving the product innocent. Keep attribution open until an actual initiator/stack is available. No error suppression, extension/security-setting change or telemetry is introduced.

### CI classification and retry

At initial PR217 head `baacb2d68b386186c737314e0991e355e445a646`, web/PDF, Rust, Android and Flutter gates pass. iOS editor-restart 41812300264 attempt 1 fails before application exercise when a Rust download cannot resolve its host; artifact creation separately fails ENOTFOUND. The raw failed log is retained with a digest in the [follow-up receipt](receipts/studio-ui-v176-pr217-followup-2026-11-04.json). No native application/padding result is established by this attempt. The same failed job is rerun without code/deadline changes; its result and native smoke 41812299745 must be recorded separately. Prior exact-runtime lifecycle success and Tax simulator launch failure remain dated evidence. Runtime inputs/PDF/data carriers are unchanged, and no new Sites publication is required.

PR217 integrates normally as `7e2f4b98b91675692d633f0da1ef8c0afbc4517f` at 10:29:32 UTC under the existing web-only Mac-pending authorization. The merge request returns a transient 502, but the authoritative PR state and fetched remote main confirm the merge. Native smoke 41812299745 then completes successfully; editor-restart attempt 2 remains running. The fresh findings are kept in a separate docs-only branch so neither PR217 native run is cancelled. Both runtime origins remain v176; no Sites save/deploy is requested.
