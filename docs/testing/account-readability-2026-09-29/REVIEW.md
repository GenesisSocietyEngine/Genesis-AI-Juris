# Account action readability and responsive fit — 29 September 2026

## Outcome and scope

The signed-in Account card must show a readable `Continue to your work` action, contain long identity text at desktop and narrow widths, and preserve ordinary navigation and separate sidebar sign-out. This amendment changes only `app/account/account.module.css`. Authentication, authorization, invitations, navigation destinations, copy and data handling are unchanged.

- Existing color amendment: `6146ca538d6650abf12b3db6877d4551b51a2835`, adopted through PR #58 head `c3d915a8ea0c21174345029e4faf9fc340b60e39` by normal fast-forward. The specific `.identity a` rule formerly cleared the primary action background while a later rule retained white text. `.identity .primaryLink` now restores the accent background.
- Additional fit amendment: `c86c83bd6dc62c5eee2ae825272e65e3821e7aa5`, tree `484669cc62614527b7a1848b24b68d255f724fb1`.
- Final CSS Git blob: `22b78b20858b7b6428f4dbcac13420cdc75fe25f`; SHA-256: `146d1323a6fa485c2e5d8bcf65e1405182ef0a21ae250447229e36ff4eeeae23`.

## Reproduced finding and recursive correction

Actual `/account`, ordinary local password sign-in, synthetic long display name and a 66-character `example.test` email. No sessions, memberships or production identities were seeded. The preexisting fixture contains only a synthetic user/profile and ordinary password credential.

At color-fixed `c3d915a`, a 390px viewport produced 420px document width. The identity card had 337px client width but 401px scroll width, and its children extended to x=419.67px. The 1024px layout had no page overflow, but squeezed the action into 117×102px and guidance into a 118px-wide third column. See [baseline measurements](BASELINE_MEASUREMENTS.json) and [narrow baseline](c3d-390-shot.png).

The correction uses a shrinkable identity column plus the action, places guidance across both columns, permits long name/email wrapping, and retains a single shrinkable column below 640px. The corrected 390/1024/1366px renders have no horizontal card overflow; the action is 54px high. At 390px, the vertical scrollbar consumes 15px: document width is 375px, within the 390px viewport, not a failed width measurement.

## Rendered evidence

[Browser measurements](BROWSER_MEASUREMENTS.json) record 18 actual states: 1366×900, 1024×900 and 390×844; OS light/dark color preference; default, actual pointer hover and keyboard focus reached with Shift+Tab then Tab. All 18 states fit, have meaningful content and no framework error overlay. All six keyboard states show a visible 2px accent outline with 3px offset. The primary action is white on `#2958b8` in all states and retains its `/studio` destination.

These are OS color preferences. Account uses fixed workspace tokens and has no Office/Afterhours selector; this is not a claim of Studio theme acceptance. No CSS zoom or substitute screenshot was used. Images contain only the synthetic test account.

Visual examples: [desktop](light-1366.png), [1024px](light-1024.png), [390px](light-390.png), [keyboard focus](light-390-keyboard.png). The implementing agent and root reviewer inspected actual renders; an independent read-only source reviewer accepted the exact CSS hash above, including the profile-missing variation where the continuation link is absent.

## Journey, source provenance and limits

Ordinary synthetic password submission completed `POST /api/auth/login 200` at 13:52:28Z. A subsequent Account tab in the same browser showed the authenticated identity card. Native pointer activation of `Continue to your work` reached `/studio`; the rendered page showed Case Studio, Create a case, Import and Continue recent work, with ordinary session reads returning 200 and no recorded browser errors. [Continuation snapshot](continuation-snapshot.txt).

`Sign out` is a separate 44px sidebar button below Account. At 390px, opening the ordinary Menu displayed the Workspace menu dialog and this button. See [mobile menu](menu-mobile-shot.png) and [snapshot](menu-mobile-snapshot.txt). This verifies discoverability; this CSS check does not newly certify sign-out/session revocation or all application journeys.

The Vite process started at clean `c3d915a` and received the exact CSS amendment through normal hot reload. Its packaged startup identity therefore remains `c3d915a` / application-input digest `f4d04c88024872e70ce5f5aead86aa82b79b0dbd99dd75a145979faeb538978d`; that startup label is not claimed as an attestation of the later rendered CSS. Final CSS bytes were independently hashed and committed unchanged as `c86c83b`. The separate final release gate binds the committed application source.

Existing targeted tests `auth-security.test.ts` and `b1-workspace-render.test.ts`: 28 passed, zero failed/skipped, process exit 0. `git diff --check` passed. No new tests mirror CSS declarations. Independent source review accepted the exact final hash; root independently inspected desktop, narrow and keyboard-focus screenshots.

Cold local Vite startup took 290397ms; the first Account response took 41.6s and exceeded the browser controller timeout. After ordinary login, the initial tab also produced CDP/controller timeouts. One fresh tab in the same synthetic browser recovered; subsequent rendering, measurements and continuation succeeded. Earlier timeouts are retained as local harness limitations, not counted as passes or evidence of hosted readiness.

No production browser, live identity, external email, membership, database migration or deployment was changed. No hosted sign-in, native/mobile acceptance, whole-application accessibility, screen-reader, 200% browser zoom, invitation delivery or production rollout claim follows from this local check. Public images contain the synthetic `example.test` account only; ignored credentials, profiles, raw helper files and database state are excluded.

[Manifest](MANIFEST.json) records SHA-256 and byte counts for the curated evidence. The source commit is separate from this documentation-only checkpoint.

Cleanup at 14:07:24Z: the owned browser session closed successfully; owned Vite PID 18320 and its owned workerd child were stopped after checking executable, command and creation time. Port 4397 had no listener and owned Chrome PID 4240 was absent. Other browsers, servers and native test runtimes were not stopped. [Validation receipt](VALIDATION.json).
