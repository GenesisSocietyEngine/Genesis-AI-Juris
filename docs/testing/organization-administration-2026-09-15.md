# Sign-in and organization administration review — 15 September 2026

## Baseline and diagnosis

Published baseline: **version 85**, product source `91fdb58340a5dbef1af9270f37cce1a43ea2fda9`. Starting checkout `adad70bf1870bd084809e9571cf21ab061cdaed4` adds only the Plane review. The current repair preserves those changes and the existing organization/case permission model.

The supplied `25a0fd8e-5530-41c8-bf64-d3c7e17e4267.png` shows an authenticated owner entering their own member ID as the invitation recipient. The server rejects self-invitation with HTTP 400. Production worker logs independently show an authenticated, same-origin `POST /api/organizations` returning 400; the log has no request body, so it does not conclusively identify that payload. The old UI discarded the response code and offered Sign in for every error, including validation. This is evidence of misleading recovery, not evidence that the shown account had signed out.

Source review also found: successful create/join results were not selected; a failed refresh could obscure a confirmed write; unrelated actions erased one-time invitation codes; suspended/removed members could receive unusable invitations; and password login while an identity was already active could report success without changing the effective account.

## Reference mapping and implemented behavior

| Observed reference | Genesis adaptation | Completion / recovery |
|---|---|---|
| `Plane web Sep 2025 301.png`: separate account/workspace/project settings scope and visible return navigation | Name the organization being managed; mark the current member; separate Account from Administration and explain organization roles versus case access | Account completion/sign-out retains a safe organization return destination and language. Opening another organization's cases uses a full navigation to clear client case state. |
| `Plane web Sep 2025 402.png`: error beside retained form input | Scoped invitation, membership, creation and acceptance feedback; associated invalid-field message and focus | Validation does not suggest sign-in. HTTP 401 offers sign-in in a separate tab plus refresh; missing profile offers profile completion in a separate tab plus refresh. Original form remains mounted. |
| `Plane web Sep 2025 29.png`: scope before fields and secondary metadata | Invite another person with recipient guidance; default role Member; creation collapsed until needed | Reject own ID and known existing memberships. Suspended access uses Restore access; removed membership remains protected. |

These are Genesis adaptations, not claims about Plane's backend behavior. Coda remains the document/evidence reference; ClickUp remains the task/review reference. Existing shared office typography, colors and controls are retained. The actual archive review is recorded in [Plane reference review](plane-reference-review-2026-09-15.md).

Form feedback follows [WAI form notification guidance](https://www.w3.org/WAI/tutorials/forms/notifications/). Authorization remains server-side for every action, consistent with [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). No role is broadened and no authentication bypass is introduced.

## Stage reviews

### 1. Organization state, invitations and feedback

Acceptance: distinguish validation, session expiry, missing profile, concurrency, failed write and failed post-save refresh; preserve input through recoverable failures; use the server's organization receipt after create/join/select.

Implemented receipt checks bind organization identity, acting account, active status and revisions. A successful write followed by failed loading says the change was saved and must not be resubmitted. Invitation codes remain scoped to their organization and survive unrelated actions until explicitly dismissed. The client guards duplicate in-flight submissions. Invalid/HTML error bodies cannot turn an HTTP 401 into a generic parsing failure.

Review corrections: moved selection failures outside the optional selected-organization panel; retained input while completing a profile in another tab; distinguished expired session context; blocked invitations for suspended/removed memberships on both client and server. Restoring access remains a revision-checked action with an audit event.

Browser inspection was attempted after this stage. Tab discovery failed with `CDP operation refresh tabs timed out after 20000ms`. No rendered layout/interaction pass is claimed. Source, model and actual-handler checks below provide narrower evidence.

### 2. Account identity and return navigation

Acceptance: a signed-in user sees their current identity and an explicit sign-out action; password login cannot silently create a second effective account; sign-out and profile completion preserve the intended return page.

Password login/recovery forms are hidden while authenticated; the login handler rejects an already authenticated request with `409 already_authenticated`. A stale anonymous tab receiving that response refreshes its current identity. Confirmed local sign-out performs a full navigation, avoiding retained busy/private state. ChatGPT sign-out retains the Account return context. Optional credentials remain attached to the confirmed ChatGPT identity.

Review corrections: fixed the successful sign-out path that could leave controls disabled; handled sign-in from another tab; retained organization/language continuation. Repeated submissions are guarded. Trusted ChatGPT identity precedence, local-account platform-admin restrictions, cookies and membership policies remain intact.

Browser connection was retried after this stage and again failed with the same CDP timeout. Static rendering proves safe initial markup and absence of password-login controls in the signed-in account state, not client interactions or identity-provider behavior.

## Verification evidence

Environment: managed Linux Sites checkout, supervised preview started at `http://terminal.local:4173/`; Node test runner, esbuild, Miniflare D1/R2 and real application route handlers. Test actors and organizations are synthetic and isolated from production. Trusted identity headers in the harness model Sites dispatch; they are not real browser authentication.

| Check | Result | Evidence / precise limit |
|---|---|---|
| Invitation validation, role restrictions and audit | **Verified — server tests** | Real handlers reject self, active, suspended and removed invitations; no extra invitation or audit rows on denial. Outsider/member invitation attempts denied. Suspend, restore and remove persist; stale revision conflicts; three member-change audit records. |
| Active-identity login guard | **Verified — server tests** | Trusted identity receives 409, no session cookie and no new session row. |
| Local enrollment → sign-out → password login | **Verified — server tests** | Real register/logout/login handlers; active cookie blocks a second login; revoked cookie permits sign-in and a new session. This is not a browser journey. |
| Error recovery model, organization receipt and continuation | **Verified — model checks** | English/Russian recovery distinctions; saved/refresh-failed wording; reject wrong actor/organization/revision; safe exact Account return. |
| Initial anonymous organization and signed-in/out account rendering | **Verified — static React rendering** | Actual components rendered with only routing/CSS adapted for Node. No private member inputs before authorization; password login only in signed-out markup. |
| Focused test totals | **Verified** | 31/31 model/security/SSR checks across five test files; 3/3 independent Administration handler tests. |
| Build and typecheck | **Verified** | Sites build, strict TypeScript and canonical mobile contract lock passed. The lock is not mobile-device testing. |
| Lint | **Verified with existing warning** | No errors in the repository; pre-existing unused `allMigrations` warning in `tests/dossier-persistence.test.ts`. |
| Create/join/select, code retention, failure/retry UI, keyboard and responsive layout | **Implemented but unverified in browser** | Browser CDP failed repeatedly before page inspection. Layout uses existing breakpoints and focus rules; actual desktop/narrow overflow, focus and touch behavior require browser review. |
| Real authenticated persistence, organization switching and sign-in-provider return | **Blocked** | Active desktop session is not connected to the available review browser. HTTP managed preview does not supply the production authentication dispatcher. No real account/session or native mobile test is claimed. |
| Before/after evidence | **Partial** | User-supplied screenshot is the before state. No new after screenshot could be captured; no synthetic image is presented as live UI. |

Commands: `node --experimental-sqlite --import tsx --test --test-name-pattern='Administration:' tests/p1-organization-erp.test.ts`; `node --import tsx --test tests/organization-admin-model.test.ts tests/organization-client.test.ts tests/onboarding-continuation.test.ts tests/dossier-workspace-ui.test.ts tests/auth-security.test.ts`; `npm run lint`; Sites `build-site.mjs`.

An obsolete security test rejected even removal of session-storage continuations during sign-out; it now permits deletion while continuing to forbid reads/writes. The previous organization UI test matched implementation strings; it now checks actual safe server-rendered markup.

## Release assessment

This is a bounded repair for observed administration defects, with no database migration or changes to canonical cases. Server behavior is verified in isolated integration tests; interactive and visual readiness is not yet verified. Priority remaining checks: (1) real ChatGPT sign-in/sign-out and saved-work return; (2) organization create/join/select, retained invitation input/code and refresh recovery in browser; (3) desktop/narrow keyboard/focus/overflow and native mobile. The earlier private-case PDF retest remains separate and outstanding.

Guided-demo readiness remains limited to previously verified journeys. **Do not recommend self-service-trial release until real authenticated saving/reopening and organization switching are demonstrated in a browser.**
