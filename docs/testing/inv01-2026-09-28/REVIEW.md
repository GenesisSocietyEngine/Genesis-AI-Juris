# INV01 implementation review — 28 September 2026

Baseline: isolated `codex/inv01-2026-09-28`, clean at `a84316cef4398f88790806bceec78b7afba49464`. Read root AGENTS.md, PO_UX_STATUS.md, UX_REQUIREMENTS.md, POST_RECONCILIATION_CLOSURE.md, RELEASE_DECISION.md and the full original runbook in Downloads. Existing R `a1fae95` technical PASS remains historical; it is not acceptance of these changes.

## Slice 1: recipient-bound invitation service

Intended outcome: an owner selects an explicit organization, supplies an email and permitted role, and creates an expiring invitation. The recipient authenticates, proves access to that mailbox with a separate challenge, reviews the exact organization and role, and explicitly accepts. Creating an invitation proves neither delivery nor membership.

Acceptance: no guessed actor or provider verification flag; no secret persisted/logged; 256-bit random tokens; current owner/organization checks at commit; atomic single use and idempotent retry; pending/accepted/expired/revoked/superseded states; rotation on resend; rate limits; generic unrelated-account denials. Existing actor-bound invitations and identity model remain compatible. No real mail is sent in this execution.

Authentication finding: trusted Sites email headers and local session records do not expose an `email_verified` claim. Neither is treated as mailbox verification. Copied invitation links alone cannot prove mailbox ownership because the inviter knows the link. A separate account-bound mailbox challenge is required. Mail transport uses the existing Resend provider only with explicit invitation configuration; missing configuration is BLOCKED. Synthetic tests capture mail with an isolated sink, not external outreach.

## Slice 2: invitation user journey

Slice 1 review: independent reviewer found recipient-resend limiter keyed by rotating ID, two concurrent-acceptance pre-batch false-failure paths, proof expiry compared to captured time, and accepted retry unnecessarily tied to old inviter revisions. Corrected each; declarative accepted-tuple schema aligned, and private identity response fences added. Initial real-route/isolated-D1 test run: 7 groups PASS, 0 failures/skips (113.5s). It captures synthetic mail in memory and does not prove live email delivery or provider signup. Strict nonincremental TypeScript exit 0. Two initial sandbox launch failures (Node 24 and pinned Node 22 `os.userInfo` ENOMEM before assertions) retained; approved unsandboxed pinned Node 22.23.2 execution resolved the runtime issue. Later extensions/retests remain separate.

Intended outcome: normal users invite by email and follow direct links without member IDs or codes. Explicit organization context, role, delivery status, retry/revoke, and acceptance consent are visible. Legacy codes are secondary. Unsaved administration forms retain the existing departure guard. Invitation credentials use a URL fragment and bounded tab continuation across authentication; no token enters server page URLs or auth return parameters.

Acceptance: keyboard labels/status/error association, narrow and long-content rendering, account/context-change late-response protection, wrong-account explanation, no automatic membership or organization switch, safe authentication continuation.

## Evidence and gates

Implementation, verification and deployment are separate. Verification results will be appended after execution. Engineering and production remain BLOCKED; pilot NO-GO; human validation 0/5. No publish, source-v2 chooser workaround, external invitation or production QA is authorized in this run. The original 42-row ledger is preserved.

### Browser/independent review corrections

Observed invitation creation through the local ordinary-password UI: explicit organization, pending status, no delivery claim with mail disabled, no membership grant. Keyboard Enter submitted successfully; preceding automation click timed out before submission. Initial role context included the inviter's Owner label and omitted the invitee role from history. Corrected the invitation context to organization name/reference and added explicit invited role to share/history.

Independent review found a late-response schedule across invitation hash changes and obsolete role on accepted-link preview. Acceptance criteria for corrections: a response for link A cannot affect link B or erase B's continuation; accepted preview reports current authorized membership role. Added per-continuation generation fences for reads/mutations and current-role preview. The existing 32-pass evidence predates these corrections and is not their retest.

### Slice 3: cross-tab invitation isolation

Intended outcome: logout started in another tab immediately suspends private invitation UI; completed logout clears tab-local invitation/proof credentials even when the invitation page is unmounted. A failed logout must not be undone by automatic focus refresh. Acceptance: same-origin boundary signal only invalidates (never grants); late reads cannot restore old identity; ordinary explicit navigation/sign-in remains required after account change. Exercise actual two-tab local logout where available and deterministic boundary/late-read tests. Existing Studio protections and ordinary same-tab logout must remain intact.

### Slice 3 review and executed evidence

58 tests PASS, 0 failures/skips in `final-invitation-navigation-tests.log` (147.7s). Includes real route/isolated D1 invitation groups, actual component mutation-handler deferred A→B schedules, session-boundary storage events, legacy navigation/Studio authority and auth-security checks. Independent reviewer rechecked all three corrections and found no new material regression. Scope is code/handler review, not live-mail or full UX clearance.

Migration compatibility retest: 6 PASS, 0 failures/skips in `migration-legacy-retest.log`. First run exposed 0023 breakpoint formatting and two filtered tests whose setup was omitted; corrected migration platform formatting and reran the dependency-complete selection. Kept both failure and success logs. Snapshot comparison: 78 existing tables byte-for-byte structurally unchanged, exactly two additive tables, zero removed.

Ordinary local browser evidence (28 September, isolated D1/R2, no mail configuration): owner create, pending delivery-unavailable wording, resend/superseded history, revoke, wrong-account generic denial, fragment removed from URL, invitation retained through ordinary recipient password sign-in, heading focus on preview, mailbox-unavailable response and disabled acceptance. Two-tab logout removed preview and continuation from the other tab without a manual refresh. Unsaved recipient field `retained-inv01@example.test` visibly survived organization departure → Stay, with focus restored to the original link. Keyboard Enter/Tab exercised. Desktop 1536-wide and mobile requested 390×844 (content width 375 with scrollbar) inspected; long organization/email text wrapped, recipient scrollWidth equaled clientWidth. Screenshots inspected in the browser tool; no screenshot artifact saved. Some automation element-preparation/click timeouts sent no input; changed to keyboard activation with state inspection.

Browser review found stale anonymous shared-layout state after local login; full navigation to the server-validated return destination corrected it, and authenticated recipient continuation was retested successfully. The synthetic accounts were pre-provisioned with ordinary password credentials in this isolated store. This does not prove provider signup or verified provider claims. Actual 200% browser zoom, real screen reader, live mail, hosted candidate, positive browser acceptance with mailbox delivery, and cross-tab role-loss UX remain unverified. API role/race tests and viewport checks are not substitutes.

### Slice 4: exact citation focus and truthful document acceptance

Intended outcome: assertion/proposal source activation lands keyboard focus on the exact cited excerpt within one action, not BODY or a review button. Document status stays distinct from the exact file version recorded in a real acceptance audit event.

Acceptance: preserve native hash/history and modified-link behavior; include document/version/location in the focused accessible name; never substitute another source for a missing anchor. Show only exact recorded version acceptance, make loaded-history uncertainty explicit, and do not infer replacement review from `accepted_source` or choose another version when the current pointer is missing. Do not create/rewrite audit events, reset statuses, or use any upload workaround. The retained original BODY reproduction plus current static code establishes the defect; a fresh original-fixture browser reproduction remains blocked by isolated-fixture prerequisites. Verify rendering/projection and actual focus handler with explicit simulation limits.

### Slice 4 review and retests

42 focused tests PASS, zero failures/skips (`source-review-tests.log`, 5.9s). Real parent component render plus actual link callbacks and projection tests cover exact audit/version matching, missing/wrong audit records, missing current pointer, absent citation, assertion/proposal links, repeated/modified activation and choosing the container instead of review controls. Synthetic records in tests/previews are explicitly modeled, not stored professional reviews.

Independent reviewer findings were corrected: add review/older/retired status to the focus description; give the new focus target a visible outline and forced-colors rule; use neutral wording if version metadata is absent. Final independent read-only delta review found no material leftover. Browser preview caught a punctuation encoding defect in the warning; fixed and rebuilt before final inspection.

Fresh scoped browser reproduction: `build-source-preview.mjs` renders actual baseline `a84316c` and candidate section components to standalone synthetic HTML. Both use current CSS; neither is hydrated or connected to an API/store. Baseline native link + Enter moved focus to BODY. Candidate native link + Enter moved focus to `LI#source-synthetic_anchor`, with accessible document/version/page/paragraph label and excerpt/status description, visible outline, and native hash. Back removed the hash. At narrow 390×844 the long citation, outline, warning and version distinction wrapped without visible clipping. Current v2 and recorded v1 acceptance appeared separately. The explicit React focus handler is covered by component callback tests, not execution in this static browser preview. Real screen-reader speech, full authenticated source-v2 flow and actual 200% zoom remain unverified. No upload/alternate transport or review event was created.

### Candidate verification boundaries

Strict TypeScript `typecheck-candidate.log`: exit 0. Focused lint `lint-candidate.log`: exit 0, no warnings; earlier invitation selection had one unused suppression warning, removed. Canonical mobile lock `parity-lock.log`: PASS, 18 deterministic routes and unchanged canonical bundle; this is not a new mobile/native runtime test. Line endings in changed source/test files normalized to required LF, without rewriting retained historical evidence. `git diff --check`: PASS. The prior R full aggregate is historical and is not relabeled as the new candidate's full aggregate.

| Scope | Implementation | Verification | Deployment |
| --- | --- | --- | --- |
| INV01 | Email recipient flow, separate mailbox proof, safe acceptance, resend/revoke/history, secondary legacy support | 58 targeted invitation/navigation/auth tests; ordinary local browser scopes above; delivery/provider signup/positive mail browser path BLOCKED | NOT DEPLOYED |
| Source presentation | Exact-source focus and document-vs-file acceptance distinction | 42 focused tests; native focus and narrow rendered component checks; authenticated replacement flow and real SR pending | NOT DEPLOYED |
| Original 42 rows | Preserved without promotion; nine stages + UX01–16 + A01–17 | Original evidence/remaining gates retained; these subsets do not close entire rows | No new deployment |

Production metadata rechecked at 04:50:19 UTC (`production-final-readback.json`): active public v102, attributed `bf579938…`, succeeded environment 39, no preview. No remote mutations, real invitations or publishing. Local candidate uses independent worktree D1/R2 and synthetic seeded accounts; it is not the required hosted QA environment.
