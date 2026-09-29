# Genesis: Juris Studio — Phase 2 development instructions

Prepared 15 September 2026 from `next-stage-status-2026-09-15.md` and `notion-reference-review-2026-09-15.md`. This is a reviewed implementation brief, not a new source-code, browser or deployment verification report.

## 1. Product mandate and corrections to the previous plan

Continue as the SaaS product owner, chief UX/UI designer and implementation lead. Complete a reliable case-action workflow and deliver the first governed case notebook. Evaluate each meaningful implementation step and correct the issues found before accepting it.

The supplied results establish the following starting position:

| Area | Reported position | Next instruction |
| --- | --- | --- |
| Production | Version 86, source `dca6af234ce27c76a6b1cb22359be9540d8e5049` | Confirm the latest deployed source before editing. Retain the existing administration recovery, PDF adapter and dispositions. |
| Unpublished candidate | Confirmed-save/refresh changes; the reference report identifies candidate lineage starting at `07ef848a602ba5a7d9be2153c360c34250b9e8c7` | Inspect the actual candidate head, working changes and divergence. Reconcile and extend it rather than rebuilding the patch. |
| Verification | 25 checks reported: 17 model/static-rendering, 6 route-handler and 2 PDF-adapter checks | Reuse their purpose; distinguish this historical result from checks run against the next candidate. |
| Browser | Tab discovery fails before page inspection | Resolve browser/environment access as a separate work item. This failure does not identify an application defect. |
| Authentication | HTTP preview lacks the production HTTPS authentication dispatcher | Use a supported HTTPS environment for provider verification. Preserve the existing authentication mechanism. |
| Plane | Archive surveyed; earlier record and newly reopened screenshots available | Reference access is complete. Use the existing evidence. |
| Notion | 101 archive PNGs plus 19 separate PNGs; 12 archive originals and all 19 separate originals visually inspected | Reference access is complete. State 31 inspected originals, not a full visual review of the set. |
| Notebook | No governed note entity or suitable editor/store currently exists | Implement a small persistent note feature. Legacy owner-only `caseFeedback` is unsuitable. |

Revise one sequencing decision from the previous brief: **browser acceptance remains mandatory for user-facing stages and release, but it must not freeze independent model, API, migration and contract work.** While browser access is blocked, complete bounded server work, source review and UI specifications. Keep the current unaccepted UI candidate reviewable instead of accumulating several unreviewed interface stages.

Treat the existing case as the dossier. Keep one light office design system: Coda for structured analysis, ClickUp for task semantics, Plane for navigation and recovery, Folk for concise record presentation, and Notion for readable notes and linked source presentation. Further reference collection is optional and must answer a specific unresolved question.

## 2. P0 — establish the acceptance environment and finish the affected journeys

Record the production version, candidate source, database migration state and exact environment associated with each verification result. The status reports are the starting record; inspect the current state before assuming it is unchanged.

Use the supported browser recovery procedure once for the current failure. If it remains unavailable, identify the environment dependency and prepare a concrete continuation route. Inspect supported hosting options for an HTTPS candidate environment with the real authentication dispatcher and controlled test data. Verify that its source matches the candidate under review.

If an authorized human can access that exact candidate in a normal browser, provide a short test script and accept clearly attributed manual evidence for rendered review. Record who executed it, which build/environment was used and the results. Production-v86 screenshots cannot accept a different unpublished candidate. Do not substitute a simulated identity, dummy sign-in route or weakened authorization for the real provider flow.

### Authentication, administration and persistence

Verify sign-in → return to intended case/action → save → reload → sign out/in → reopen. Then switch organizations and verify correct case visibility and server permissions. Retain the existing v86 administration work; fix current reproduced defects rather than designing a second account flow.

Keep three scopes distinguishable: personal account, organization membership/settings, and case participation. Organization membership does not itself prove case access. Explain missing access beside the attempted action, and handle zero-organization, expired-session and no-case-access states using supported recovery paths.

### Affected PDF path

Retest the user's affected path against the current adapter. First use a controlled case; use the affected private case within the existing authorization when available. Record any remaining error before selecting another fix.

Verify current sealed snapshot → generate report → open/preview → download → reopen saved output. Check identity, revision, source references, portrait A4 pages and graph continuity. A preview failure should retain an existing generated report and offer its secure download; a generation failure should preserve selected options and explain retry or prerequisites.

**Acceptance evidence:** an identified signed-in browser build completes both journeys. Keep browser evidence separate from the already successful fixture PDFs and trusted-header route tests. If inaccessible, mark these journeys Blocked and continue independently verifiable work below.

## 3. P0 — complete the write, receipt and recovery contract

Review the existing `SavedOutcomePanel`, `savedOutcomeReceipt`, `loadMatter` completion handling and exact-audit retrieval. Preserve their case, record, revision and event binding. Extend the bounded candidate to the failure states explicitly left unfinished.

### Separate write truth from refreshed view truth

1. Preserve a confirmed receipt while subsequent reads are pending or fail.
2. Make **Retry update** a read-only operation through the same receipt-aware refresh path for every retry control.
3. Accept refreshed state only when case identity is correct, the case revision is at least the confirmed write's resulting revision, and readiness corresponds to that refreshed revision. A later valid revision from another authorized change is acceptable; an older or mismatched readiness result is not.
4. Retain request-generation guards across A → B → A navigation and across newer outcomes, in both success and failure callbacks.
5. Preserve chronological audit ordering while making the exact authorized event addressable. Distinguish missing, inaccessible and failed audit retrieval without redirecting to an unrelated record.

### Review the hidden-workspace trade-off

The candidate currently withholds the action workspace until a complete refresh succeeds. Test an alternative: keep the case header, navigation, confirmed receipt and authorized read-only record access available; label the prior queue **Updating** or **May be outdated** and disable actions whose eligibility depends on unverified readiness.

Compare the alternatives in an actual rendered failure/retry journey. Prefer the approach that allows useful inspection while preventing incorrect action and false counts. Clear inaccessible data on a confirmed authorization failure. A stale view is not permission to retain data after access is revoked. If no trusted prior state exists, use a loading/error state rather than an invented empty queue.

### Finish failure-specific recovery

| Scenario | Required behavior |
| --- | --- |
| Write confirmed; refresh failed | Show the receipt and read-only Retry update. Never repeat the mutation to refresh the view. |
| Request interrupted; write outcome unknown | Reconcile the original operation with authoritative state. Replay only under the verified existing idempotency contract for the same immutable payload. |
| User changes the proposal after an uncertain write | Preserve the submitted operation separately from the newly edited draft. Resolve the original outcome before allowing an explicit new operation; never reuse an operation key with changed content. |
| Revision conflict | Show the current server record and the user's proposed change together. Preserve input and require explicit resubmission against the current revision. |
| Session expiry | Retain supported draft state, use the real provider continuation and return to the same case/record. Apply the actual confidentiality and ownership rules to any persisted draft. |
| Field validation failure | Keep entered values, explain the exact field and move focus appropriately. |
| Permission revoked | Explain the current restriction, remove prohibited cached content and stop retrying a forbidden write. |

Document each existing endpoint's receipt, revision and replay capabilities before creating a common client adapter. Add only demonstrated server-contract gaps. Apply the resulting pattern to the most relevant existing non-disposition write, such as information-request receipt, then to the new notes increment. The mounted notification panel itself does not require permanent storage: reload can retrieve the actual saved record and history.

**Acceptance:** controlled route/model checks establish the state transitions, and rendered checks establish feedback, focus, retained input and return behavior. Include a lost response after a committed write, a changed draft after uncertainty, refresh failure, a conflict and case-switch races. Do not report Stage 2 complete while these paths still use the older behavior.

## 4. P1 — make the queue and exact-record review complete

Build one canonical action collection for titles, related findings, ordering, deduplication, counts and filters. Preserve all reasons when multiple findings refer to the same action and record. Distinct requests must retain distinct identities even if their labels resemble one another.

Use specific verb-first titles, such as a request's actual subject. Display owner, urgency, due date and review status only where returned or validly derived. Define stable ordering using known deadline urgency, blocking effect and required review; document tie-breaking. Do not label the first six unsorted entries as priority actions.

Show up to six actions initially, with an accurate **View all N actions** control. Preserve filter, disclosure, selection and useful scroll position above section unmounts, and reset them on a genuine case or organization change. Distinguish no matching results, no outstanding work and unavailable readiness.

Make an eligible historical-deadline action open the selected disposition form directly. Match the existing server rule: an open workspace deadline whose due instant is in the past, with simulation restrictions retained. Use the actual outcomes **Fulfilled**, **Waived** and **No longer applicable**. Show the original date/timezone and preserve history. Future/projected records need their supported date-appropriate workflow.

Replace bare assertion fragments with a supported target-loading path. Source review reports that `openAction` focuses loaded targets but does not retrieve unloaded ones: implement that missing behavior. Bind loading, selection and focus to the exact authorized assertion and current case. Explain inaccessible or missing records; never choose a different item as a fallback.

**Acceptance:** exercise a second request, duplicate findings, an unloaded assertion, an ineligible future deadline, a completed action under a filter and A → B → A navigation. Confirm keyboard access, narrow layouts, truthful counts and return state. Citation retirement must leave unresolved dependent assertions and outdated outputs visible.

## 5. P1 — implement the governed Case notebook in two increments

### Increment A: persistent note and source-association foundation

The first feature is one **Case notebook inside Documents & evidence**. Avoid an extra global dossier hierarchy. Add additional notebook containers only if a demonstrated need warrants them after this increment.

Inspect the repository's migration, transaction, identity and storage conventions, then implement the smallest compatible model:

| Concept | Required semantics |
| --- | --- |
| Note | Persistent identity bound to an organization and case; current title/type/body revision; author and saved-time information. |
| Note revision | Immutable previous title/body content, revision identity, author/time and a concurrency guard for the next save. |
| Contextual source association | Identity linking a note to an existing same-case document and exact version, with an optional same-version anchor; creator/history and explicit unlink semantics. |
| Save/association receipt | The confirmed object/revision and operation result required for feedback, replay handling and reliable refresh. |

Choose concrete table and endpoint names from project conventions after inspecting the existing source. Keep updates atomic. Re-check active organization, case participation and owner/contributor write authority within the database transaction or equivalent atomic authorization mechanism. Use existing case-read authority for reading; retain current reviewer/viewer restrictions.

Ordinary note edits advance the note's revision and history, without automatically changing the governed dossier revision or invalidating its reports. Linking contextual material is not evidence acceptance. If note content is later incorporated into an assertion, decision package or report, use the governed submission path and pin the included note revision and source references. An accepted report must not later render mutable live note text.

Enforce same-case document/version/anchor constraints, validate anchors against their document versions, and make repeated identical association requests produce one relationship. Derive backlinks from actual authorized associations. Apply access checks to both entries and counts.

Start with **Working material · shared with this case**. Private notes and cross-case shared sources are outside this increment. Do not reuse legacy `caseFeedback` or add a client-only notes store that appears to be durable.

Test the migration on a fresh database and an upgrade fixture matching the v86 schema. Check existing governed records, dispositions and sealed output preservation. Record compatibility and recovery behavior for the candidate; production migration follows the normal verified release process.

**Server acceptance:** save/reload and immutable revision retrieval, simultaneous-edit conflict, denied writes, replay after interruption, invalid or foreign source association, duplicate linking, authorized backlink counts and safe unlinking. These checks can proceed while rendered review is blocked.

### Increment B: focused editor and complete linking journey

Use shared `--workspace-*` tokens and existing accessible controls. Create the minimal required editor rather than a general block-editor or automation platform. A title field, readable plain/rich text surface supported by the chosen implementation, small formatting set and compact linked-source list are sufficient.

The initial interface includes:

- A note list with title, type, author and server-confirmed saved time, plus **Create note**.
- Lightweight Blank, Meeting notes and Analysis starting structures.
- One **Save note** primary action, secondary **Link existing**, and contextual advanced actions.
- A searchable picker of authorized same-case documents, versions and anchors, with already-linked entries marked; **Upload new** stays distinct.
- Compact source rows with title, referenced version and available page/section; **Open source** primary and secure **Download** secondary.
- A permission-filtered **Used in** section with exact links back to notes or assertions, labelled by relationship type.
- **Unlink** acting only on the contextual association. It must preserve the source, its other relationships and evidence decisions.

Keep unsaved note text, selection and scroll position when opening a source and returning. Handle preview failure without losing the note or hiding an available authorized download. Preserve record identity through rename. Use bounded case-scoped retrieval/search rather than loading an entire organization into the client.

An ordinary contextual link may include working/unreviewed material with accurate status. **Submit sourced assertion** must use the existing valid, accepted, non-retired same-case anchor rules and dossier revision. Its result remains awaiting review. Neither saving a note nor checking a box accepts evidence or completes a governed review.

### Canonical Canopy exercise

Use a working copy. **D09 v1 is Cold-chain and delivery service model**, providing delivery context. **D08 v2, Leadership, is Staffing confirmation addendum**, providing the staffing confirmation. Verify exact document/version/anchor identity against the fixtures before binding it; never substitute D09 as proof of staffing.

Create a Staffing analysis note, link D09 as context and D08 v2 for the staffing source, open the precise passage and return with unsaved text intact. Link a source in a second note; inspect authorized backlinks; unlink one relationship; reload and verify the original source and second link survive. Submit a sourced assertion through the existing review path. Introduce a newer source version and show it separately while preserving the referenced old version and previous sealed outputs.

**Browser acceptance:** complete that journey on desktop and a narrow viewport with keyboard focus, dismissal, failure recovery and saved-state checks. An independently tested note API is Backend verified, not a completed notes feature.

## 6. Evidence-based reference mapping and report polish

Use the following already inspected references. Attribute them to the supplied review record and re-open the originals during the implementing stage's visual comparison.

| Change | Exact reference(s) | Limitation to preserve |
| --- | --- | --- |
| Error beside retained fields; clear scope and save/discard | `Plane web Sep 2025 402.png`, `Plane web Sep 2025 29.png` | Appearance does not prove recovery semantics. |
| Queue/filter context | Plane `75.png`, `172.png`, `96.png` using the full filename prefix | These are earlier inspected references, not new browser evidence. |
| Focused entry choices | `Notion web Jun 2026 8.png` | Preserve the supported auth mechanism and six case steps. |
| Reading and authorship | Notion `40.png`, `60.png`, `89.png`, `100.png` | Derive saved time and review status from Genesis; do not copy an unexplained Verified badge. |
| Create versus link; upload versus link | Notion `144.png`, `145.png`, `149.png` | The inspected menus do not establish a relational picker or evidence acceptance. |
| Compact PDF/source row and optional preview | Notion `181.png`, `182.png` | Prefer on-demand preview; the embedded grid is not an action queue. |
| Role/status comparison | Notion `281.png`, `291.png` | Permissions remain domain rules, not arbitrary editable categories. |
| Case-note list | Notion `453.png` | Avoid reproducing raw mention markup in titles. |

All abbreviated Notion filenames retain `Notion web Jun 2026 ` before the number. The inspected set does not show the entire picker → backlink → unlink flow. That workflow comes from the user's requirement, prior official-documentation support and Genesis's domain model. Do not cite an unseen screenshot as proof.

Retain optional contextual assistance as a later enhancement. Large covers, permanent AI panels, generic automation builders and extra nested tabs are not needed for this notebook increment.

After report correctness is verified, perform a bounded report-polish pass: improve the sparse final Tax graph page where possible; replace technical display labels with plain-language headings; place necessary detailed identifiers in a suitable appendix or developer-oriented section. Preserve citation identifiers, reading order, page references, graph continuity and the text alternative. Generate new outputs without rewriting old sealed bytes. Compare the changed pages visually rather than rerunning unrelated broad checks.

## 7. Work sequencing and completion rules

| Work package | Useful work while browser is blocked | Acceptance dependency |
| --- | --- | --- |
| Environment/authenticated PDF | Source/environment diagnosis, controlled reports, exact manual test script | Real supported signed-in browser on the identified build |
| Write recovery | Contract implementation, route/model tests, candidate source review | Rendered failure/recovery review before UI acceptance |
| Queue/exact targets | Canonical action model, target-loading contracts, UI specification | Accept the P0 interface before adding and accepting this UI stage |
| Notes foundation | Migration/API/permission/revision implementation and focused tests | Backend review can complete independently |
| Notes interface | Component design and reference mapping | Accepted recovery patterns plus working rendered review |
| Self-service assessment | Prepared timed script and test accounts | Full real authenticated journey, output verification and appropriate device evidence |

At each step: state the user problem and expected behavior; implement the bounded change; review source/contracts and relevant risks; inspect and exercise rendered UI when applicable; correct findings; record exactly what passed and what remains unverified.

Use statuses with clear meanings: **Designed**, **Implemented**, **Backend verified**, **Browser verified**, **Release accepted**, or **Blocked**, adding the missing evidence. A feature may be Backend verified and awaiting browser review. Avoid labelling a completed design or tested API simply Blocked because a later dependency remains unavailable.

Tie evidence to the candidate source and environment. Keep historical test counts, current automated tests, static rendering, browser interactions, PDF renders and human/device results separate. A narrow viewport is not a native-device test. Report observed onboarding timing with its start/end boundaries rather than treating the two-minute target as achieved by assumption.

Do not release an unreviewed user-facing candidate to satisfy an environment test. Use the existing release authorization and normal reviewable release route once its gates pass; identify the deployed version and run a focused post-deployment smoke check before reporting publication as verified.

## 8. Required next handoff

Deliver a concise progress report and links to:

1. The reconciled source candidate and a change summary tied to the actual user problems.
2. The complete write/recovery contract and its controlled failure evidence.
3. The canonical action model and queue/target verification result.
4. The note migration/API contract and focused permission, revision and association checks.
5. The implemented notebook journey when browser acceptance is available, with selected before/after screenshots.
6. A controlled generated PDF and the affected signed-in path result.
7. An evidence matrix showing implementation, backend, browser and release status separately for each work package.

If browser access is still unavailable, the minimum useful handoff is a reconciled candidate, completed independently verifiable P0 contracts, a tested notes foundation where feasible, and a precise candidate-specific browser test pack. State the outstanding environment dependency once and what evidence will close it.

Start with candidate reconciliation and acceptance-environment diagnosis. Complete write recovery next; progress the independent notes foundation; then implement and review the queue and notebook interfaces in bounded stages.

## 9. Product-owner self-review and amendments

| Potential weakness | Reviewed adjustment | Evidence still required |
| --- | --- | --- |
| Repeating the same browser-blocked checkpoint | Separate backend development from browser/UI acceptance, with a supported candidate environment or attributed manual verification route. | Exact-build browser evidence before UI release. |
| Losing unpublished work | Reconcile the existing candidate and production v86 before changing code. | Actual source/working-tree record. |
| Hiding all useful work after a saved action | Compare a labelled read-only stale view with the current withheld workspace, keeping permissions and mutation eligibility enforced. | Rendered recovery comparison. |
| Demanding the refresh equal the receipt revision forever | Allow a later authoritative case revision when its readiness matches and it is not older than the write. | Out-of-order and concurrent-change checks. |
| Replaying a changed uncertain mutation | Bind replay to the original immutable operation; preserve later draft changes separately. | Lost-response and changed-proposal tests. |
| Inventing notebook infrastructure or reusing an unsuitable store | Implement a minimal governed note model; no legacy `caseFeedback`, private-note scope or cross-case reuse in the first increment. | Migration, permissions, persistence and revision evidence. |
| Notes stale every report, or silently rewrite an accepted report | Independent note revisions for working text; pin explicitly included note revisions through governed submission. | Report/source-version preservation checks. |
| Repeating the incorrect Canopy source mapping | D09 v1 for delivery context; D08 v2 Leadership for staffing support. | Exact fixture/anchor review and the sourced-assertion exercise. |
| Treating source linking as evidence acceptance | Separate contextual association, anchored citation and explicit assertion review. | Real linking and review journey. |
| Overclaiming Notion coverage | State the actual 31-original inspection coverage and absent backlink-flow evidence. | Reference attribution per change. |
| Adding a large new customization product | One case notebook, simple editor, compact linked records and existing navigation. | User task completion, not feature count. |

The next phase is successful when users can trust a saved outcome, reach the exact remaining action, assemble notes from existing case sources and obtain the correct report. Backend progress, interface usability and release readiness must each have their own evidence.
