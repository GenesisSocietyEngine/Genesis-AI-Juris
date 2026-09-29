# Shared sign-out test correction — 27 September 2026

The resumed full suite failed the old `auth-security.test.ts` assertion that `AccountClient.tsx` directly calls `localStorage.removeItem`. Inspection found that AccountClient, NavigationSession and NavigationController are unchanged from the candidate's starting HEAD. Account renders the shared WorkspaceNavigation; its sign-out invokes NavigationController, which calls the real `clearNavigationStorage` after the server confirms logout. The failing assertion described an obsolete implementation location, not a newly reproduced loss of cleanup.

Profile deletion remains a separate path: `/api/me` checks governed responsibilities before identity deletion and clears the session cookie. CommunityView's confirmed DELETE invokes its existing `clearDeviceDraft` callback and removes its displayed account records. This review did not mutate or execute a real account deletion.

Changed only `tests/auth-security.test.ts`: the source contract checks the actual shared-navigation wiring. An additional behavioral check executes the real controller and cleanup helper with synthetic in-memory storage. It verifies failed logout preserves retry and retained data; confirmed logout clears the terminating account's scoped/legacy drafts, same-tab continuations and organization selection before navigation; other-account and unrelated storage remain intact. Server deletion constraints, no-store responses and the no-credential-storage assertions remain unchanged.

Validation on pinned Node 22.23.2:

- `node --experimental-sqlite --import tsx --test tests/auth-security.test.ts`: **10/10 PASS**, zero skipped, exit 0; [host log](evidence/continuation-auth-security-host.log).
- The initial sandbox attempt failed in the tsx bootstrap at `uv_os_get_passwd ENOMEM` before tests executed; [preserved log](evidence/continuation-auth-security.log). The successful local execution used automatic approval review, without changing test or security behavior to bypass the environment error.
- Focused ESLint on `tests/auth-security.test.ts` passed with exit 0 and [no diagnostics](evidence/continuation-auth-security-lint.log); scoped `git diff --check` passed. Full-suite and final candidate status remain coordinator-owned.

These are synthetic code-level checks, not hosted logout, cross-tab browser or profile-deletion acceptance. No account/auth product source, schema, credentials, real storage or production setting changed in this correction.
