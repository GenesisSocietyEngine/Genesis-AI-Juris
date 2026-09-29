# Private output authority correction — 25 September 2026

The intended outcome is that an already-open protected Studio report cannot issue a new private file after the server session ends. A verified same-account return must recheck saved-case access, require a new report action, and preserve unsaved input while access is merely unconfirmed. Confirmed logout, case revocation or account change clears protected in-memory work. Unrelated local drafts and public demos retain their local behavior.

This is a local source correction based on production candidate `6dd1d7bd05a588e2969eae9fc6bbc0f745fb5165`. The root agent reported the actual failure on review v7 `b00a9a2e727942d8213f6a83151d91c9d2b518c0`: ordinary logout succeeded at `2026-09-25T13:04:12.034Z`, but a previously opened private report tab produced a new receipt at `2026-09-25T13:09:30.937Z`. These observations explain the regression target; local tests below are not hosted acceptance.

## Change and review

- Normal sign-out emits a same-origin suspension signal before its request and a revocation signal only after confirmed success. Failed logout keeps the existing retry path. The signal contains no identity, case content, token or grant.
- Protected output uses fresh, bounded, no-store server checks for the same identity and the existing saved-case copy policy. Redirects, malformed responses, missing authentication, transport failures and revoked access fail closed. PDF rendering rechecks immediately before creating a downloadable artifact; epochs reject old callbacks even after same-account re-entry.
- Recovery checks saved-case **view** permission before showing retained content. Inspection permission remains distinct from export permission. Preview URLs and current receipts are invalidated on authority changes.
- The existing private PDF, receipt JSON, custom-case JSON, Markdown and private-derived played-case export routes use the boundary. Protected Studio-derived play is concealed on unconfirmed access, cleared on revocation, and protected against late callbacks. Interrupted run requests retain their data and show a sync error without automatic retry.
- Confirmed protected discard advances the existing Studio component key, clearing child report form fields. Anonymous/local drafts are preserved when another tab signs out. Public/local played-case export remains local.

Independent agent review found and verified corrections for saved-case view recovery, unrelated local draft retention, protected derived play, and interrupted play state. The final React synchronization uses an external-store subscription with the latest committed component context. The source review also checked listener cleanup, hidden/inert content, preview disposal, existing departure behavior and late results. This is technical review, not independent professional case approval.

No SQL, migrations, migration ledger, hosting bindings, report fingerprint algorithm, report approval logic, feature scope or deployment configuration changed. No application commit, build, push, native save or deployment was performed by this subtask.

## Local verification

Pinned runtime: Node `22.23.2`, using the existing dependency junction with the unchanged lockfile.

| Check | Result | Evidence |
| --- | --- | --- |
| Six focused suites: authority, actual parent export/boundary, report dialog, navigation, report model, download recovery | 68 tests PASS, 0 failures | [focused-04.log](focused-04.log) |
| Affected parent/authority tests after the subscription adjustment | 26 tests PASS, 0 failures | [final-parent.log](final-parent.log) |
| Actual parent boundary/export tests after the final protected-child reset and assertion | 2 tests PASS, 0 failures | [final-parent-revoke.log](final-parent-revoke.log) |
| Full TypeScript, `tsc --noEmit --incremental false` | Exit 0 before the final one-line existing-key reset and its test assertion | [typecheck-06.log](typecheck-06.log) |
| ESLint on all ten changed product/test paths | Exit 0, no warnings, before that final one-line reset/assertion | [lint-02.log](lint-02.log) |
| Final whitespace check | `git diff --check`, exit 0 | Recorded at handoff |

The full focused command was `node --import tsx --test tests/studio-session-authority.test.ts tests/studio-private-exports.test.ts tests/report-receipt-dialog.test.ts tests/sidebar-navigation.test.ts tests/case-report.test.ts tests/report-download-recovery.test.ts`. Subsequent runs were confined to affected tests. The first sandbox launch failed during the runtime's user-profile lookup; the scoped local test runs completed using the approved executor. No network was exercised by these tests.

Tests execute the real authority class, normal sign-out signal producer/listeners, actual report/Markdown parent callbacks, report receipt/download helpers, and extracted unchanged handler bodies from the real Studio component. HTTP, React hooks, DOM/file handoff and PDF bytes are modeled. They cover stale cached permission without focus or broadcast, 401/redirect/HTML/malformed/error cases, revocation during rendering, delayed callbacks, same-account return, view-versus-export policy, local draft retention, and output denial without false success.

## Remaining acceptance

The exact committed successor still needs the declared build and real-browser acceptance: private preview in one tab, ordinary logout in another, no subsequent private output or stale preview, normal re-entry with a newly generated report, saved-case revocation/recovery, protected derived play, and preservation of an unrelated local draft. Existing source tests do not prove these hosted results. This correction does not establish a release GO or authorize an external pilot.
