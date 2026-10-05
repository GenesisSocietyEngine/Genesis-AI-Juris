# CaseVant production redesign — 2026-10-05

## Scope and source ownership

- Owner: this CaseVant redesign task, isolated checkout `/workspace/sites/casevant-rebrand`.
- Opened production v107 at `36f95740c5519486f8ce6d7511b60a7ff8ba6889`; starting working tree clean.
- Canonical GitHub main observed at `e05cf3c660779d625c1cc676c7822d9875b46513`. It includes separate work not present in production. The production candidate retains v107 functionality; the visual patch will be reconciled separately with current canonical main.
- Explicit user authorization: use the supplied logo, redesign CaseVant with white/light-blue backgrounds, and publish production.
- Existing case, account, organization, navigation, persistence, report access and calculations remain within their existing contracts.

## Implementation step: coherent visual identity

Outcome: recognize CaseVant immediately and read all working surfaces comfortably.

Acceptance: supplied mark used unchanged; CaseVant with `by Genesis`; exact slogan `Make your case.` and explanation `Evidence, options and outcomes. Connected.`; white/light-blue surfaces, dark text, restrained teal/lime; no dark-theme control; create/import/recent/demo affordances preserved; responsive navigation and long titles wrap; brand metadata updated without replacing existing social-preview artwork. No new dependencies, data migrations or auth changes.

Review evidence and publication result will be recorded below after verification.

## Review of the visual slice

- Supplied PNG hash verified identical to the production asset (5,063 bytes); logo is not redrawn.
- Existing create, import, continue, demo, saved-case, account and organization handlers/routes retained. The only removed preference is the dark-theme switch, following the owner's fixed-light direction. No added hooks, requests, dependencies or persistence state. React component review completed.
- Existing navigation/entry/Canopy/account focused checks: 58 passed, 0 failed. Operations navigation rechecked after removing the obsolete theme props from its fixture: 2 passed.
- Source diff reviewed, with no auth/backend/schema/migration/report-engine changes. Only expected UI, metadata, tests, brand asset and this review note are included.
- Measured contrast: main text/white 14.63:1; muted text/white 7.09:1; muted text/light blue 6.57:1; teal/light blue 5.87:1; primary label/pale-blue button 9.96:1.
- Mobile rules retain the 800px navigation breakpoint; create/import precede the example on narrow screens. Long case titles use wrapping and existing navigation departure guards are retained. These are source-level checks, not a claim of browser execution.
- Browser limitation: managed preview requires the control-browser skill, which is absent from the complete available executor and cloud catalogs. No substitute browser path was improvised. Desktop, mobile and 200% live visual checks were not executed. Publication is not conditional on that unavailable check.
- Dependency installer hit a registry timeout. Restored an isolated copy of already installed dependencies from the existing workspace with the identical package-lock SHA-256 `2de0f13ff467e19b3857ae5bbeeb3290902a5ffa6af2a30eb3972da6ad908777`. Dependency inputs are unchanged.

## Publication acceptance

Run the existing verified build (strict types, tax assets, D1 migration checks and parity lock), then the built-artifact metadata/lazy-bundle checks. Publish the resulting scoped v107-based source through Sites; preserve public access and runtime bindings. Record exact version and successful deployment in delivery evidence.

## Verified production publication

- Production source committed and pushed by the Sites workflow: `7b6aa7c2c68746c7dfd79175eab8d7ee26a1cbbb`.
- Verified build passed: strict TypeScript, tax source/asset/corpus checks, both migration checks, 18-route parity lock, Workers production output.
- Both built-artifact checks passed: CaseVant metadata/worker and bounded lazy client bundle.
- Saved version **108**: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_57052fc522cc8191b5c6b00c77d20494`.
- Deployment `appgdep_6ac393fd092c8191a00ed51b47dfbf62` returned **succeeded** at 2026-10-05T12:12:10.368510+00:00; environment revision 41 retained.
- Native production URL: https://genesis-juris-web.maxim-hayan.chatgpt.site. Existing custom production URL retained: https://studio.falcon-merlin.com.
- Site display title updated to **CaseVant by Genesis**. Public audience and D1/R2 bindings retained.
- Canonical visual patch synchronized separately at `b728801de0f39be02e16ca2dc0de4caf0d8696f1`, PR #86. All touched existing files matched main except JurisApp.tsx, where only the four theme-removal hunks were applied to main's own file to preserve its newer work.
- Canonical hosted CI runs were still in progress when production completed. Repository auto-merge is disabled; ordinary PR integration is tracked separately and does not substitute for deployment verification.
- Remaining limitations: no browser visual QA or fresh authenticated end-to-end run; PDF rendering engines, historical author credits and existing social-preview artwork were outside this web-design slice.
