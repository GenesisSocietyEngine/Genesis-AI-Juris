# CaseVant first use and operations — 2026-10-05

## Source and task ownership

- Production starting point: Site v108, source `7b6aa7c2c68746c7dfd79175eab8d7ee26a1cbbb`, clean checkout `/workspace/sites/casevant-rebrand`.
- Canonical main observed before implementation: `41cb6552e97846d03cb047c6cf0f4ae30984f079`. Preserve its separately integrated changes when reconciling the scoped patch.
- This task owns first-use guidance, operations dashboard usability and the requested `CaseVant by Falcon-Merlin Group` attribution. No database, access, calculation or report-authority changes are planned.

## Starting maturity evidence

- Exact production-source full web test run: 1,170 tests; 1,166 passed, one failed, three existing migration-rehearsal skips. The failure asserts the removed `useState<Theme>("office")` implementation; fixed light styling is intentional. Align that assertion with the rendered light-theme contract.
- Current main CI independently has 1,191 tests: 1,187 passed, the same one failed, three skipped. PDF visual job passed. These counts belong to distinct source states.
- The v108 provider screenshot confirms the desktop white/light-blue visual presentation. It does not prove click-through, narrow-screen or 200% browser acceptance.
- The inspected current-main five-participant validation packet remains NOT_RUN. No completed usability study or external-pilot acceptance is inferred.

## Implementation outcome and acceptance criteria

Help a new user understand the next action, when work has really been saved, how to reopen it and how to obtain a preliminary report. Reuse the existing guarded create, save, authentication continuation, review and report actions. Guidance must derive from current content and server-confirmed save state, never a synthetic completion flag. Existing drafts and permissions must remain intact.

Help the administrator refresh and export an actionable diagnostic snapshot. Reads must have a bounded deadline and cancellation; an old response cannot overwrite a newer one. Optional automatic refresh runs only while this page is visible. A failed refresh must identify retained data as old; loss of authorization must clear it. Download only allowlisted operational metadata and counts, excluding identities, case contents, tokens and arbitrary response fields. External alerts remain explicitly unavailable until independently configured.

Preserve the supplied logo and white/light-blue theme. Apply the user's exact company attribution. Review changed wording, long attribution, keyboard controls and responsive CSS before publication.

## Review and validation

- Implemented state-derived next action and a three-checkpoint disclosure. Reused existing guarded callbacks; save confirmation comes from `visibleWorkspaceState`, so edits invalidate the confirmation. An already saved copy opens separately, preserving current work. Guidance defers to existing conflict/error/auth recovery panels. Anonymous sign-in and incomplete-profile actions have distinct wording. Oversized saves have an adjacent explanation.
- Entry explains personal versus team storage, when sign-in is needed and a concrete task for exploring Canopy.
- Operations reads reuse the existing tested 15-second deadline including response bodies. Abort old reads before replacement; timeout continuations have no state-changing side effects. Optional one-minute polling checks document visibility and excludes overlapping requests. Authorization failures clear prior data and disable polling. Failed refreshes retain and label the previous snapshot.
- Diagnostic JSON explicitly projects dates, release metadata and finite counters; arbitrary payload fields, identities, case content and raw error messages are excluded. No external notification service is represented as connected.
- Applied `by Falcon-Merlin Group` to the sidebar and document description; long attribution wraps. Kept existing logo and social-preview image/metadata, report engine and calculation/data models unchanged.
- Reviewed React dependencies, lazy loading, cancellation/unmount behavior, semantic details/checkbox/button controls, focus styles, 44px controls, long-text wrapping and responsive one-column rules. No new dependency or browser-storage flag.
- Focused existing and new checks: 30/30 passed. Separate onboarding/return/My Cases/deadline checks: 27/27 passed (overlap exists; do not sum as unique tests). Typecheck and complete verified production build passed, including Rust assets/corpus, migration checks and route parity.
- Aligned the pre-existing release-hotfix assertion with the fixed light-theme contract; retained its training-caption/archive assertions.
- Main differs in `JurisApp.tsx` and `release-hotfix.test.ts`; a three-way merge retained those current-main changes with no conflicts. Other scoped existing files match main's baseline exactly.
- Full final-source tests, canonical CI and publication receipts are pending. Browser controller unavailable in the inspected environment; do not substitute unapproved browser control or claim browser acceptance. New-user usability and external-pilot acceptance remain unmeasured.
