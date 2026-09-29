# Independent preservation review — My cases and Studio departure

Reviewed 27 September 2026 in `.worktrees/ux-convergence-2026-09-27`, based on `bf5799383a52b6617cd9d4a0acf47af780086218` plus the current uncommitted UX candidate. Reviewer: `review_flows`; no product edits were made by this reviewer.

## Intended outcome and acceptance criteria

The review checks that the new My cases entry and Studio departure guard do not lose work, present unconfirmed saves as durable, or retain private catalogue metadata across authority boundaries. Acceptance for this bounded source/test review requires:

- Personal and Team retain their distinct existing entity IDs, authorization and continuation routes, including legacy Matter deep links.
- The Personal catalogue clears private results after a failed or invalid read and on logout/expiry; stale asynchronous responses cannot restore old data.
- Exact saved work may leave without a false dirty warning; unsaved content, prompt, history and pending operations remain protected. Save/auth failures must not establish a clean baseline.
- Existing sign-in continuation excludes private/protected/server-owned work and rejects account/continuation mismatches; explicit logout remains available.

## Findings and evidence

No concrete material defect was confirmed in `app/matters/MyCasesClient.tsx`, `app/matters/studio-case-catalogue.ts`, `app/studio-departure.ts` or their reviewed integration points. No speculative product change was added.

The catalogue reads the existing authenticated server projection with no-store behavior, merges pagination by server ID, uses no persistent client cache and refreshes after same-identity verification. Its request ticket and authority scope fence late results; failed reads remove existing private metadata. The wrapper retains the existing Matter component for deep links and uses ordinary links subject to the shared departure controller. Role, version, visibility and storage wording remain explicit; no save receipt is inferred from the Updated date.

The departure helper checks the full authoring baseline in addition to existing server content/publication fingerprints, including legacy fingerprint compatibility. It protects unapplied prompt content and persisted-history differences, gives pending operations precedence and does not create new storage. The reviewed parent establishes workspace baselines only after an exact verified save receipt/open result and device baselines only after the existing eligible device save/restore path. Changing privacy on an existing saved case remains its own server-confirmed action; it does not establish a content-save baseline. Failed network/conflict responses do not call the baseline callback. Existing StudioSessionAuthority remains responsible for private concealment/discard.

Targeted verification: **45/45 PASS**, using host Node **v24.21.0**:

`node --import tsx --test tests/my-cases.test.ts tests/studio-departure.test.ts tests/studio-save-receipt.test.ts tests/onboarding-continuation.test.ts tests/sidebar-navigation.test.ts tests/navigation-shell.test.ts`

Evidence: [targeted-host-node.log](evidence/preservation-review/targeted-host-node.log). Tests include actual extracted parent/auth handlers, controller/history behavior, same-title distinct IDs, pagination, expiry and logout fences, same-identity grant refresh, saved-baseline changes, pending operations, sign-in storage failure and stale receipt rejection. `git diff --check` also completed with exit 0.

The first sandbox attempt failed before test execution because the tsx loader's `os.userInfo()` received `uv_os_get_passwd ENOMEM`; [initial log](evidence/preservation-review/targeted-current-node.log). The identical bounded command passed under approved host execution. This was an execution-environment failure, not a passing product check. This run used the available Node 24 executable and does not claim a new pinned Node 22 run.

## Limits and gate

This is an independent source/test review, not a browser-first usability review or hosted acceptance. The reviewer did not operate a browser, alter accounts, send invitations, mutate hosted data, commit or publish. Browser behavior at 390 px/zoom, full keyboard/focus handling, authorized Save/reload/reopen, natural expiry, two-window conflicts and successful/cancelled real sign-in remain subject to the coordinating acceptance matrix and separate evidence. Local response fixtures and static markup do not substitute for those checks.

Bounded source/test gate: **PASS**. No additional product correction required by this review. Hosted A07–A10 and complete-journey release readiness are not promoted to PASS by this result.
