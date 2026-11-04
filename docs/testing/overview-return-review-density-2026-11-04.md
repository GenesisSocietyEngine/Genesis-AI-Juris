# Overview return and Review density — 4 November 2026

## Source and preservation

Work begins from PR220 documentation head eee48205debf2853c2fde911745906a5e5d4f344, based on canonical main/deployed runtime 45ce35a75e978fc8e678c4623943e8c615860f33. Both live identities are verified before editing. PR220's web/PDF gates pass while the main native lifecycle is retained to terminal before documentation-only integration. No v177 rebuild/publication is made for that closure. The next runtime slice uses a separate checkout and port 4203 with an isolated Vite cache; shared dependency-cache invalidation must not reload the retained 4199/4201 previews.

No existing case, saved row or user tab is modified. Local synthetic tests use separate tabs and retain their unsubmitted input/working copy; no workspace Save, provider call or production write is used.

## Slice 1 — origin-aware Overview correction return

Outcome: an explicit field/node correction opened from Overview returns there, with useful next-action focus, instead of detouring into Review. Review-origin corrections retain their exact finding ID and existing fallback when a finding resolves. Ordinary section/history navigation consumes the old origin.

The new per-instance navigation memory contains only two booleans. Its owner is replaced on case ID/version, declared source, saved identity, account storage scope, language, authority epoch/access, edit permission and restore context changes. It deliberately survives ordinary content edits. No draft snapshot, carrier, permission or history is serialized. Explicit imports/reset clear it. Return reuses the existing openOverview path and actual focus helper; it does not invent a guided Review step for Overview.

Tests execute the real root handlers, return-label/focus expressions and useMemo owner. They cover one-shot returns, nested node inspection, Review precedence, ordinary navigation/history, identity/source/account/language/access cancellation, A→B→A non-resurrection, unchanged full draft/input/history and denied context. Forty-seven focused checks pass. Strict typecheck passes after correcting a missing format in a synthetic test reference. Lint has zero errors and the same seven inherited unused-variable warnings in JurisApp; no new warnings are introduced.

### Local browser review

A new blank local tab uses keyboard Enter from Overview to the existing brief textarea. The label is Back to Overview. Unsubmitted synthetic text survives Return and reopening; focus returns to the Overview next-action control. A second local tab opens a standard independent Canopy working copy. Its publishable context is amended with a clearly labelled synthetic note; Confirm context and return returns to Overview, retains the amendment and focuses Add evidence. The prepared recommendation correctly becomes Requires reassessment. This confirms context review only, not evidence acceptance or professional approval. These are unauthenticated local application observations, not S03 stored-case acceptance.

Screenshot overview-return-en.jpg is retained under .artifacts/ux-return. Both synthetic tabs remain open with their work. Full candidate/main CI, final bilingual/narrow checks and publication remain separate gates.

## Next independently reviewable slice

Compact Review's repeated action-card presentation while preserving every action finding ID, warning text, exact callback and Review return route. Measure the warning region before/after at equal viewport sizes; do not claim fewer controls, faster retrieval or human approval merely from denser rendering. Essential warnings remain visible; routine action-purpose text may move to a native hint with self-explanatory visible action names. Save/report/access constraints remain unchanged.

## Slice 2 — compact exact-finding Review controls

The Review warning list now presents each full finding text once, with its destination (Open brief, Open field, Inspect node or Developer controls). Exact action IDs and callbacks are unchanged; findings are never combined because their destinations match. Routine purpose remains supplementary title/ARIA-describedby text; no essential instruction depends on hover. The count, idless validation failures, checking/complete state, report restriction and save/restore/size/access conditions are retained.

At equal actual local viewports, the six blank-case warning controls occupy 490.60 px rather than 917.20 px at 390 × 640 (46.5% reduction), and 304.00 px rather than 376.10 px at 1522 × 688 (19.2% reduction). All original warning text remains visible. Minimum target height is 68.10 px narrow and 44 px wide; no horizontal document overflow is observed. This measures layout, not task speed, fewer findings or professional acceptance. Source and screenshots are under .artifacts/ux-return.

The actual local app passes Tab from brief to participants, Enter to its correction, Back to review finding and settled focus on action-participants. EN/RU narrow layouts are visually inspected; the Russian Overview action shows Вернуться к обзору and returns to Overview. Changing language during that correction invalidates the old origin and shows the ordinary case-action return, rather than resurrecting a stale Overview context. Both retained synthetic tabs still contain their exact unsubmitted brief/amendment after development refreshes; no user tab or saved case is edited. React review confirms instance-scoped origin memory, primitive context dependencies, native keyboard controls, no effect-driven draft writes and no added provider/network behavior.

Sixty-four focused checks pass, including actual rendered warning controls and every callback in EN/RU, idless/checking/completed behavior, full draft/check byte preservation, original Review return, Overview context fences, evidence input and save constraints. The first restricted-shell attempt failed in the Windows tsx loader before any test ran (user-info ENOMEM); rerunning the exact checks outside that restriction passes. Strict typecheck passes. Final candidate CI and exact-main release verification remain required; this audit does not relabel local browser evidence as authenticated production acceptance.

## PR220 closure

Docs-only PR220 merged normally on 4 November 2026 at 12:22 UTC as 7c63f786777055293adec8dbb3ba424f2a7e0b69. Both prior-main native runs 41821098391 and 41821098496 reached success before integration. PR220 web/PDF, Rust, Android, Flutter and native smoke checks passed; its two Mac editor-process-restart jobs were pending at merge under standing web-only authorization. No v177 rebuild, Site version or deployment was created for PR220.

Post-step review caught the installed accessibility lint rule rejecting aria-description on button. The implementation now uses the established aria-describedby relationship to hidden supplementary purpose text, with the full warning and destination still visible. This removes the new warning rather than suppressing lint.
