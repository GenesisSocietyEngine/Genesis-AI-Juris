# Local organization acceptance and dirty-departure correction

Date: 29 September 2026. Base: `43deadd14209faa2a824c99f6d97c676f1465304`. This receipt supplements, rather than rewrites, the earlier port review. The earlier statement that browser journeys were NOT_RUN describes that earlier checkpoint.

## Intended outcome and bounded extension

A newly created organization appears as a choice without changing the managed organization or losing another form's draft. A confirmed create followed by a failed read offers refresh without another create. Expiry hides private details, exposes sign-in recovery, and restores recoverable input after the same user authenticates. Explicitly discarding a draft when opening another organization's cases must actually navigate.

The local browser reproduced one additional P2 in the shared navigation path: Open cases with a dirty invitation field opened the confirmation dialog, but Discard and continue silently closed it without a selection request. Root explicitly authorized the narrow extension to `app/navigation-controller.ts`, `app/LegacyGenesisNavigation.tsx`, the existing navigation regression test and this evidence. No provider or authentication source was changed.

`requestDeparture` had created an intent, then `select` immediately created another before returning the dirty risk. The dialog therefore retained an obsolete plan. `select` now accepts an optional validated current-plan continuation; the actual navigation component forwards its existing plan. A stale continuation returns before any mutation or request. Direct selection still starts a new intent, including no-op attempts. Existing readiness, busy, actor, receipt, epoch, authority, uncertain-write and sign-out checks remain in place.

## Local browser setup and limits

Used the isolated checkout's pinned Node 22.23.2, existing installed dependencies, fresh worktree-local D1/R2, tracked migrations 0000–0023, own server on 127.0.0.1:4297 and own local fault proxy on 4298. Agent-browser 0.27.0 used session `org-amendment-43deadd` and an isolated task profile. Other agents' browser sessions and servers were untouched.

One synthetic `example.test` account was provisioned using the actual password-credential function and schema-generated actor identity, following existing local auth fixture practice. No session or membership was seeded; ordinary password login established the session and the UI created organizations. The first seed attempt supplied an invalid actor format and was rejected by the real constraint; retry omitted it so the existing database trigger generated the identity. Credentials and local state remain ignored and are not published.

The test-only proxy adapts the tracked INV01 fault proxy. It preserves authentication and request headers, logs only method/path/status/action, and injects one GET503 after a real create201. Expiry was induced only for this synthetic account by setting its local session expiry in the isolated database. No production data, provider mail, bypass identity, remote migration or real-account membership was used.

| Journey | Observed result |
| --- | --- |
| Native create Alpha | POST201, organization list and shared rail refreshed; personal managed context and unrelated email draft retained. |
| Manage with dirty draft, then Stay | Confirmation shown; choosing Stay retained the draft and current context. |
| Native create Beta, confirmed write then injected GET503 | Correct saved/do-not-submit-again message; no premature instruction to use a missing Manage entry. |
| Refresh after the failed Beta read | Actual GET200 and rail session refresh; Beta appeared and draft/context remained. Exactly one Beta create POST, two create POSTs total across Alpha/Beta. |
| Original dirty Open cases, then Discard | FAIL on original base: trusted native clicks reached both controls, dialog closed, same URL, no selection POST. Clearing the draft manually then opening cases succeeded. |
| Amended dirty Open cases, then Discard | PASS after restarting the server on amended source: exactly one select POST200 at 11:18:44.555Z, My cases rendered, session and dossier reads200. |
| Actual expired session read | GET401; private organization inputs removed; page-level Sign in in a new tab and I've signed in — refresh controls visible. |
| Same-user password recovery and original-tab refresh | A settled, enabled, unobstructed native password button submitted POST/login200 at 11:23:47.358Z. Returning to original tab t1 and clicking I've signed in — refresh restored the same Alpha organization and exact `expiry-retained@example.test` draft. |

The initial password click/Enter attempts did not submit, and the initial session was established through programmatic native form submission. That initial action is not pointer/keyboard acceptance. The later settled native pointer click above independently proves ordinary local-password submission. Several off-screen first clicks did not dispatch the intended event; explicit scroll followed by settled control activation was used. No account-form defect is established by those attempts.

The browser controller returned OS10060 during both password-login return navigations. The second authentication tab's automatic return remains **NOT_VERIFIED**. A bounded switch to the original stable tab recovered observation and allowed the actual refresh/restoration check; no browser-state or authentication data was fabricated. The provider `/signin-with-chatgpt` route renders404 on this local Vite target, so provider-link completion is **BLOCKED locally**. The separate account tab was deliberately opened at the supported ordinary-password page, not claimed as provider recovery.

This is local HTTP/rendered-state acceptance. It does not establish hosted ordinary authentication, live email delivery, positive invitation acceptance, cross-account or role-revocation browser journeys, assistive-technology speech, narrow-layout acceptance, production rollout or pilot readiness. These remaining applicable gates are unchanged.

## Regression, independent review and evidence

The existing test harness extracts the actual navigation component handlers and uses the real NavigationController. Five new cases cover requestDeparture → dirty → explicit Discard, Stay, pending writes, superseding departure/direct selection, authority expiry/revocation and direct stale-continuation rejection before mutation. This harness remains distinct from browser acceptance.

The first new-test setup used organization IDs below the existing length constraint and did not establish a ready session. It was corrected, with an explicit ready-baseline assertion. That run is retained locally and is not the genuine reproduction. On unchanged product source the valid-fixture RED run had 9 PASS / 2 FAIL, including the exact expected select request versus actual empty request list. After the minimal fix the three relevant files produced **46 PASS / 0 FAIL / 0 SKIP**. Strict nonincremental TypeScript, focused ESLint and `git diff --check` passed. No dependency, authorization or test-rule relaxation occurred.

Independent architecture reviewer `claude_product_acceptance` read the actual diff, recomputed all three source hashes, inspected genuine red/green evidence and approved the bounded fix. Adversarial reviewer `tax_independent_review` confirmed stale continuations reject before mutation, direct no-op selection still supersedes older intent, and synchronous busy publication fences duplicate invocation. Root independently inspected the source diff. These are source/test reviews; the browser observations above are separately attributed to the executing agent.

Evidence is in [navigation-correction](evidence/navigation-correction/receipt.json): exact commands/times/exits and source SHA256, normalized red/green/type/lint logs, credential-free HTTP records, selected browser snapshots and event/geometry observations. Original raw bytes remain ignored; raw and published hashes are recorded. Only the two shared-navigation files and one test changed beyond the prior port, plus this documentation. The original two ported organization source/test blobs remain untouched.

The local P2 reproduction is corrected and proportionately verified. Hosted CI on the amended commit and the final combined-candidate aggregate remain separate required checks owned by the parent integration session. No push, merge or deployment is claimed by this receipt.
