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
