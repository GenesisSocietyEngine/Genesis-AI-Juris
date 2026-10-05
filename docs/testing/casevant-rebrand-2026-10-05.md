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
- Strict TypeScript validation passed after updating the navigation fixture.
- Existing navigation/entry/Canopy/account focused checks: 58 passed, 0 failed. Operations navigation rechecked after removing the obsolete theme props from its fixture: 2 passed.
- Source diff reviewed, with no auth/backend/schema/migration/report-engine changes. Only expected UI, metadata, tests, brand asset and this review note are included.
- Measured contrast: main text/white 14.63:1; muted text/white 7.09:1; muted text/light blue 6.57:1; teal/light blue 5.87:1; primary label/pale-blue button 9.96:1.
- Mobile rules retain the 800px navigation breakpoint; create/import precede the example on narrow screens. Long case titles use wrapping and existing navigation departure guards are retained. These are source-level checks, not a claim of browser execution.
- Browser limitation: managed preview requires the control-browser skill, which is absent from the complete available executor and cloud catalogs. No substitute browser path was improvised. Desktop, mobile and 200% live visual checks were not executed. Publication is not conditional on that unavailable check.
- Dependency installer hit a registry timeout. Restored an isolated copy of already installed dependencies from the existing workspace with the identical package-lock SHA-256 `2de0f13ff467e19b3857ae5bbeeb3290902a5ffa6af2a30eb3972da6ad908777`. Dependency inputs are unchanged.

## Publication acceptance

Run the existing verified build (strict types, tax assets, D1 migration checks and parity lock), then the built-artifact metadata/lazy-bundle checks. Publish the resulting scoped v107-based source through Sites; preserve public access and runtime bindings. Record exact version and successful deployment in delivery evidence.
