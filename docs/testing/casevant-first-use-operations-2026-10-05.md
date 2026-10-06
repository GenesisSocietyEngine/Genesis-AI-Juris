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
- Exact production-source full run completed: 1,173 tests, 1,170 passed, zero failed, three existing skips (478,935.8 ms). The reviewed functional source is `3d8b870d82acb3650e4089618a8f9c4f9e1963b8`.
- Canonical PR head `3c8134f599e7d5b47dfa818cb8b713cb7b823024` independently passed 1,191 of 1,194 tests with zero failures and three skips. Typecheck, lint, build, packaged browser/Worker Rust execution, tax report history and the independent PDF visual job passed. Main includes the implementation through ordinary PR #87 merge `8063bf697dbfad0ba96225a8ab98fbb3c265072a`.
- The aggregate web job remains **FAIL** at the complete dependency audit: GHSA-vfj7-8cjw-p6xm affects `braces` 3.0.3 and its development/build dependency chain (8 reported dependency findings). The official advisory currently lists no patched release. No manifest/lockfile change, forced framework downgrade, audit suppression or CI-policy change was made. A separate current `npm audit --omit=dev --json` completed with zero vulnerabilities. This is an open build-tool dependency issue, not a claim that the complete CI is green.
- Browser controller unavailable in the inspected environment; no live interaction, narrow-layout or 200% browser acceptance is claimed. New-user usability and external-pilot acceptance remain unmeasured.

## Publication receipt

- Saved Sites version: **109**, `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_2460a6455f508191930e486188684e7d`.
- Exact pushed/deployed source: `3d8b870d82acb3650e4089618a8f9c4f9e1963b8`; source tree `adfa48810b907be078adae3f55d09f347341e629`.
- Deployment: `appgdep_6ac3a133de148191a6c9a58c11103a9d`, **succeeded** at `2026-10-05T13:08:31.641047+00:00`.
- Public URL: https://studio.falcon-merlin.com ; native URL: https://genesis-juris-web.maxim-hayan.chatgpt.site. Existing public audience retained.
- Runtime environment revision: **42**. Preflight found release identity still naming v106 / `49a53edbb8979063b2c5f0febbf6711206b79459` while v108 was live. Updated only `GENESIS_DEPLOYMENT_VERSION` to `109` and `GENESIS_WEB_COMMIT` to the exact deployed source above; unrelated values and secrets retained.
- Site display title verified as **CaseVant by Falcon-Merlin Group** and current live version as **109**. The provider did not return a new screenshot with this deployment; the earlier v108 image is not presented as new UI evidence.

## Remaining readiness work

The functional prototype is suitable for a controlled demonstration. External-pilot readiness still requires the recorded five-person first-use study, current hosted account/save/reopen/report acceptance, operational notification delivery and appropriate professional review. Existing tests and this publication do not substitute for those results.

## Domain assessment boundary

The supplied registrar screenshot offers casevant.pro at an introductory EUR 6.99; renewal price and live registration availability were not independently confirmed. The public https://casevant.com/ page returns the title “Casevant — AI copilot for small-claims disputes”. Its ownership was not established. If it is a third-party product, this is a material naming-confusion concern in a close category. No domain was purchased, connected or redirected.

References: https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/37312893179 ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm .
