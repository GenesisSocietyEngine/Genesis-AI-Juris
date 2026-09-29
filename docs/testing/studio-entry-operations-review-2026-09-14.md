# Case Studio entry and Operations UX review

The product owner's review-after-every-step requirement is now recorded in `AGENTS.md`.

## Step 1 — Entry and starter case

Acceptance: the main address opens Case Studio; a fresh visit opens Canopy in the portrait map; saved work, imports, sign-in continuation and explicit navigation retain priority. Home does not promote the tax template. Demo choices remain together.

Implementation review: the server entry selects Studio on both domains; `/templates` explicitly selects the catalogue. Starter loading follows identity resolution and device restoration, checks cancellation and intervening edits, and uses a fresh Canopy copy. Canonical source fixtures and signatures remain unchanged. The existing explicit Canopy fixture URL retains its behavior. The tax promotion was removed; the specialist template remains available through Studio's secondary actions.

Evaluation: entry and continuation rules are covered by focused route tests. Browser verification and final validation are recorded below when complete.

## Step 2 — Navigation and Operations

Acceptance: one consistent primary navigation with readable labels; secondary controls remain reachable without crowding; document titles wrap without overlapping internal IDs; visible guidance explains the next action.

Implementation review: a shared header now exposes Case Studio, Operations, Demo cases, Templates and My cases as actual links. Account, organizations, help, restore/export and appearance controls remain available under a keyboard-accessible More disclosure. The header wraps without hiding labels. Workspace navigation uses the same names and order. Operations starts Canopy when no run is active and preserves an active run. Numbered document selectors have flexible title columns; internal references remain in collapsed record details. Unavailable stamina and billable metrics are omitted; unknown action cost is still explicitly “Not specified”, never implied to be free. Numbered, linked guidance leads to the brief, documents and actions.

Evaluation: 38 focused checks passed, including English/Russian navigation with organization context, long GreenFire references, device isolation, portrait source preservation and guided steps. TypeScript and lint passed before the final wording and race-condition review. The review found and corrected a race: explicit navigation/Operations now cancels only automatic starter loading, without blocking saved-draft restoration. Direct browser checks were attempted, but the browser service timed out listing tabs and inspecting the existing dialog; the kernel reset. No visual pass is claimed.

## Step 3 — Complete journey and publication

Acceptance: exercise default Canopy, portrait orientation, navigation, demo case play, document selection and bilingual wording; validate the build and record any limitations before publication.

Final review: checked routing, asynchronous starter cancellation, fresh-copy creation, portrait projection, source-reference preservation, semantic navigation and responsive CSS. The journey review corrected the player return destination for launches from Help and Community; completed operation stages now retain their numbers. The React review checked effect cleanup, existing-work precedence, late imports and bundle separation. No account, source fixture, canonical runtime, schema, permissions or deployment audience changes were needed.

Verification: focused checks, strict TypeScript and lint passed. The canonical lock verified all 18 deterministic routes. The production build and its two compiled-asset checks passed before the final navigation-label correction; the final repeat also passed. Browser recovery after the service reset also failed to list tabs. Interactive and visual validation, narrow-viewport rendering and 200% zoom could not be completed in this turn. These remain explicit verification limitations, not reported passes.

Evaluation: the requested entry, navigation, wording and structural alignment defects are addressed. The evidence supports publishing the bounded fixes; final visual appearance still needs confirmation in a working browser. Future changes must follow the review-after-every-step rule in `AGENTS.md`.

Final gate: 39 focused tests passed, 2 compiled-asset checks passed, strict TypeScript and lint passed, and the production build passed with the unchanged 18-route canonical lock. Initial client chunk: 322,343 bytes (limit 325,000). The final diff has no whitespace errors. Publication uses the existing public Site.
