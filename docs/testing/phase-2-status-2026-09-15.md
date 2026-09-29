# Genesis: Juris Studio — Phase 2 progress and release assessment

Date: 15 September 2026. Instruction source: `phase-2-brief-2026-09-15.md`.

**Substantive backend work is implemented and verified in an unpublished candidate. It is not a self-service release.** The notebook editor and new canonical queue have deliberately not been added as further unreviewed UI stages.

## Baseline and acceptance environment

- Live Site, rechecked through Sites: **v86**, `dca6af234ce27c76a6b1cb22359be9540d8e5049`, active at https://studio.falcon-merlin.com.
- Starting review branch: `codex/next-stage-review-2026-09-15`, clean at `7693504ddedc85bea7f7dffa8bfe178dadb8a46f`. Its code parent `07ef848` contains the retained disposition receipt candidate; `7693504` adds reference documentation.
- Phase 2 product source: **9236c02a294c4c9a43cd49cb3113fba06a889c6b**. Subsequent report-only commits do not change this tested product source.
- v86 source migration baseline: `0000`–`0021`, 22 journal entries. New candidate migration: `0022_loving_juggernaut.sql`. The fresh-schema and populated v86 upgrade fixtures passed. No production migration was run; the hosted migration ledger was not queried directly.
- Supported browser discovery returned Chrome; the documented tab retry failed with `CDP operation refresh tabs timed out after 20000ms`. No candidate browser observations or new screenshots are claimed.
- Sites reports no candidate preview URL. The documented managed preview is internal HTTP; `/signin-with-chatgpt`, `/signout-with-chatgpt` and `/callback` belong to the HTTPS Sites dispatcher. A local 404 on that sign-in path does not establish an application route defect. No replacement authentication route, injected browser identity, new production site, or unreviewed deployment was used.

**Remaining acceptance dependency:** an exact-candidate HTTPS environment with the supported authentication dispatcher and a working browser connection, or clearly attributed human browser evidence from that same candidate. Production v86 evidence cannot accept this candidate. See `phase-2-browser-acceptance-2026-09-15.md`.

## Completion matrix

Statuses describe separate layers; “Backend verified” does not mean “Browser verified.”

| Work package | Implementation | Backend / contract evidence | Browser | Release |
|---|---|---|---|---|
| Authenticated onboarding, account return, save/reload/sign-out/in | Existing implementation; recovery requirements Designed | Synthetic-provider route tests exercise durable records; no real sign-in proof | **Blocked** | **Blocked** |
| Organization and case-role boundaries | **Implemented** | **Backend verified**: same-case readers, owner/contributor note writes, denied reviewer/viewer writes, foreign organization denial, late membership and case-role revocation | **Blocked** | **Blocked** |
| Historical deadline disposition and stale citation retirement | **Implemented**, including original-operation GET and exact receipt-key binding | **Backend verified**: immutable original dates/acceptance, original replay after later case revisions, audit, denial, dependency readiness, sealed-byte preservation | **Blocked** for revised recovery UI | **Blocked** |
| Information-request save receipts | **Implemented** API; shared UI adapter still Designed | **Backend verified**: create/status receipts, lost-response recovery, current-revision conflicts, same-actor lookup, exact request retrieval and fresh readiness read | **Blocked** | **Blocked** |
| Unknown-write, changed-draft and conflict recovery contract | **Implemented** headless model; bounded disposition UI repairs | **Contract verified**: immutable submitted bytes, separate edited draft, explicit new operation after comparison, session/validation/permission states and A→B→A epochs | **Blocked**; full form lifecycle not accepted | **Blocked** |
| Canonical action queue and exact targets | **Implemented** model and exact assertion/request APIs; UI integration Designed | **Contract / backend verified**: preserved reasons, stable distinct actions, AI review filter, first-six/count model, case/org-owned state, exact identity and late-response rejection | **Blocked** | **Blocked** |
| Working notes and source relationships, increment A | **Implemented** | **Backend verified**: fresh/upgrade schema, save/reload/history, concurrent writes, replay, permission fences, exact sources, backlinks/counts, duplicate linking and safe unlink | Editor not implemented yet | **Blocked** |
| Focused notebook editor and source picker, increment B | **Designed** | API ready; no editor callbacks or browser simulation presented as implementation | **Blocked** pending P0 UI acceptance | **Blocked** |
| PDF generation, preview/download/reopen | Existing implementation | **Backend verified** regression of actual report routes and preserved PDF bytes; prior PDF layout review is separately attributed | Reported browser failure **Blocked** for candidate retest | **Blocked** |
| References | **Designed / documented** | Prior Plane archive review and 31 inspected Notion screens retained; no repeat collection | Not a runtime claim | Not applicable |
| Timed first use and mobile | Test pack **Designed** | Mobile contract lock passes; this is not a device/layout check | **Blocked**, including native mobile and registration-inclusive timing | **Blocked** |

## What changed and why

### 1. Reliable saved-operation contracts

Information-request create/status mutations now accept a durable `idempotencyKey`. A successful request, its audit and its original result are committed together. Replaying the same actor/case/key and exact payload returns that original result even after another case update. Reusing the key for different content produces `operation_key_conflict`. Existing clients without a key remain compatible but do not acquire replay guarantees automatically.

Mutation responses are receipts, without a post-commit readiness computation that could fail after a successful save. The subsequent case GET supplies current readiness. The integration test checks that its computed revision matches the current case revision. This is an intentional API amendment; old UI consumers did not use mutation-response readiness.

Dispositions now expose an actor-scoped original-operation lookup. Receipt validation checks the submitted key as well as record, reason, outcome/source, revisions and audit identity. A later case revision does not rewrite the original receipt revision.

The recovery model distinguishes uncertain writes, validation errors, conflicts, expired sessions, denied access and confirmed receipts. It retains edited input separately from the immutable original submission. A 404 operation lookup alone is not proof that an in-flight write cannot still commit; only the identical operation may be replayed until resolved.

### 2. Bounded repairs to the existing P0 interface

- A confirmed read denial clears retained case data, action selection and saved-outcome content.
- Case visits carry a generation; late A responses cannot affect a new A visit after A→B→A.
- Changing cases resets the previous case's mutation lock without letting an old callback unlock a new write.
- A disposition with an uncertain result preserves its original payload/key through refresh and close/reopen. “Check original save” first checks the exact operation; it does not silently submit changed input under a new identity.
- A changed account or denied access clears confidential disposition form content. Validation focus is applied after the disabled form is enabled again.

These are source-reviewed changes with build and render-contract checks. **They have not been exercised in a browser.** The current disposition form prevents editing while an operation is unresolved. The more complete changed-draft and comparison model is not yet wired into all forms. Private draft survival across a full-page authentication redirect, section unmount and every generic case mutation remains incomplete; no browser-storage workaround was added.

### 3. Persistent case working notes

New case-scoped records provide blank, meeting and analysis notes, immutable title/body revisions, actor/time attribution and replayable operation receipts. Reads use existing case access; writes require an active owner or contributor. The existing organization transaction fence is supplemented by a database check of the active case participant and captured role at write time.

Source associations pin an existing document version and optional citation from that exact version and case. Database constraints reject foreign/mismatched tuples. Duplicate active links are rejected; unlinking preserves the source, historical relationship and links from other notes. Reciprocal application certificates prevent a link/unlink history event from committing without its actual relationship change.

Backlinks and linked-source/history lists are bounded and expose explicit cursors and truthful counts. Lists and history omit note bodies; exact revision reads return the content. Sources expose pinned/current-version distinction, document status, locator and retirement separately from original acceptance. A contextual note link does not confer evidence acceptance or assertion support.

Working-note writes do not advance the governed case revision or invalidate existing reports. Notes are deliberately absent from existing snapshots and report inputs. Any later governed inclusion must pin an immutable note revision.

Narrow hardening limit: the supported API atomically applies note revisions and the current pointer. Direct privileged SQL could insert an ordinary non-association revision without advancing that pointer; there is no separate database certificate for every ordinary save-pointer application. This is not reachable through the implemented API. Do not introduce another writer that omits its guarded batch.

### 4. Canonical queue and exact destinations

The new pure action collection preserves distinct reasons and record identities, orders known urgent/overdue work before blockers/reviews, and differentiates unavailable/outdated readiness from an empty current queue. Distinct graph and simulation work remains separate even when it uses the same package control. AI proposals remain visible in the review filter.

A case/organization-owned queue-state contract preserves filter, disclosure, selection and scroll anchor on same-case return. Exact assertion and request endpoints can retrieve a target outside the initially loaded collection; the resolver verifies case and record identities and drops both late success and failure. It preserves the originating action/output identity for prerequisite return paths.

**These models are not yet the live Action Center.** Integrating the collection, exact loading, retained queue state and report-prerequisite return navigation is the next UI stage after P0 acceptance.

## Review ledger and corrections

| Stage | Outcome and self-review | Actual evidence | Remaining rendered gate |
|---|---|---|---|
| Baseline | Kept v86 live; reconciled review branch and 22-migration source baseline | Sites metadata, clean initial Git state | Browser connection unavailable |
| Notes foundation | Added exact anchor tuple, strict revisions, bounded metadata reads, explicit retired status and reciprocal source-application binding after review | Fresh SQLite schema plus populated Miniflare v86 upgrade; real API persistence and permission tests | No editor yet |
| Request receipts | Bound embedded request identity/status/proof to its audit; reject padded keys and incompatible selectors; removed misleading post-commit readiness dependency | Real request create/receipt/replay/conflict/GET tests | Generic form adapter pending |
| Queue/recovery models | Fixed order-dependent package grouping and missing AI-review classification | Model permutations, filters, context/race tests | Not integrated into UI |
| P0 UI repair | Fixed stale private form data, case-switch mutation lock and hidden uncertain-save recovery control; corrected hook declaration order found by lint | Source review, React checklist, typecheck/build and render contracts | Desktop/narrow-screen/focus/failure interactions unverified |

## Verification record

- **14/14 real-route and migration checks passed** with isolated Miniflare D1/R2, actual handlers and synthetic provider headers. This includes a fresh database, a populated v86 upgrade, server-side report generation/download, dispositions, notes and request recovery. Case-role removal is a controlled fixture-only database change made immediately before the tested write; organization revocation uses the actual administration handler. No production records were changed.
- **39/39 model/source/render checks passed.** This includes recovery and action models plus existing workspace normalization and SSR contracts. SSR/callback models are not browser observations.
- Production build and strict TypeScript validation passed. The existing canonical mobile contract lock passed for 18 deterministic routes; it does not test responsive appearance or touch.
- Lint passed with one pre-existing unused-variable warning in `tests/dossier-persistence.test.ts`.
- The entire repository test suite was not rerun; checks were focused on the changed persistence, permissions, recovery, targets and report-preservation risks.
- Evidence: `phase-2-2026-09-15/backend-evidence.json` and `phase-2-2026-09-15/contract-checks.txt`.

Commands:

```bash
node --experimental-sqlite --import tsx --test --test-name-pattern='P1 ERP|Dependable actions|Phase 2' tests/p1-organization-erp.test.ts
node --import tsx --test tests/phase2-recovery-actions.test.ts tests/saved-outcome.test.ts tests/action-destinations.test.ts tests/dossier-workspace-ui.test.ts tests/dossier-requests-activity-route.test.ts
npm run lint
node /root/.codex/plugins/cache/openai-curated-remote/sites/0.1.62/scripts/build-site.mjs
```

## References and missing visual evidence

Existing records remain authoritative for what was actually inspected: `plane-reference-review-2026-09-15.md`, `notion-reference-review-2026-09-15.md` and the Notion manifest. Exact relevant observed screenshots include:

| Observed reference | Observed pattern | Genesis adaptation / status |
|---|---|---|
| `Plane web Sep 2025 29.png` | Scoped work-item editing with save/discard controls | Separate proposal from committed receipt; model/backend implemented |
| `Plane web Sep 2025 402.png` | Inline error alongside retained form input | Field-specific recovery and retained proposal; disposition amendment awaits browser review |
| `Plane web Sep 2025 172.png` | Filters, counts and reset controls | One canonical action collection drives counts/filter state; model implemented |
| `Notion web Jun 2026 145.png` and `149.png` | Contextual page/link choices and separate add/link entries | Focused “Save note” and “Link existing source”; editor specification only |
| `Notion web Jun 2026 181.png` and `182.png` | Compact source/file rows and content context | Version-pinned source metadata and locators; API implemented |
| `Notion web Jun 2026 281.png` | Separate role/status/person columns | Preserve explicit administration semantics; no arbitrary role-property editor |

No inspected screenshot proves a governed relation-picker → backlinks → unlink transaction. That is a Genesis requirement and original adaptation. Coda's document/readability direction and ClickUp's ownership/review direction remain unchanged.

Available historical assets: `action-tiles-images/tasks-before.jpg`, `tasks-after.jpg`, `studio-actions.jpg`, `studio-complete.jpg`; prior report renders under `next-stage-2026-09-15/`. The old “after” task image is a prior harness view, not authenticated persistence evidence. **New exact-candidate desktop/mobile before-and-after screenshots are missing**, as is a new rendered comparison of hidden versus retained read-only workspace. The referenced standalone SVG audit was not located in the available review records. They must be captured under the acceptance pack.

## Release assessment and next priorities

**Guided demo:** the existing published baseline can remain a guided demonstration, with previously recorded limitations. This Phase 2 candidate is suitable for technical review of its backend work; customer-facing notebook or new-queue demonstrations are not ready.

**Self-service trial:** do not release yet. Real authenticated saving/reopening, organization switching, the reported PDF browser path, complete recovery interactions, registration-inclusive timing and responsive/keyboard review have no exact-candidate browser evidence.

Priority order:

1. Establish supported HTTPS candidate acceptance and complete the P0 browser pack; fix findings before release.
2. Finish the request receipt UI adapter and parent-owned draft/comparison lifecycle. Compare retained read-only workspace versus current hiding; choose after rendered testing.
3. Integrate the canonical queue and exact loading with return context; then implement the notebook editor and full source-link journey as separately reviewed stages.
4. Run the Canopy working-copy exercise and current sealed report journey; then polish sparse report pages/technical headings without rewriting old sealed bytes.
5. Measure registration-inclusive first use against the approximately two-minute goal and complete narrow-screen, keyboard and native-mobile checks where available.
