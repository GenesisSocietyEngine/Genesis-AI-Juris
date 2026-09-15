# Genesis: Juris — next-stage progress and release assessment

Reviewed 15 September 2026. **Partial implementation; unpublished and not accepted for release.**

**Reference update later on 15 September:** the replacement Notion upload is now accessible. `Notion web Jun 2026 89.zip` contains 101 PNGs; 19 separate PNGs also arrived. All files passed integrity checks, and 31 originals were visually inspected. See the [Notion review and amended design mapping](notion-reference-review-2026-09-15.md). The browser discovery retry still times out, so this resolves reference access without changing the implementation/release acceptance status below.

## Baseline and review environment

The live product is [Genesis: Juris Studio](https://studio.falcon-merlin.com), published **version 86**, source `dca6af234ce27c76a6b1cb22359be9540d8e5049`. The starting checkout was clean and matched that source. Version 86 already contains the organization/account recovery work described in [Administration review](organization-administration-2026-09-15.md). This reconciles the supplied brief's version-85 baseline and preserves the prior PDF adapter, governed dispositions and Plane review. No new production version was deployed in this iteration.

The [supplied next-stage brief](next-stage-brief-2026-09-15.md) requires rendered review before accepting a user-facing stage. The supported managed preview starts at `http://terminal.local:4173/`, but browser tab discovery repeatedly returns **`CDP operation refresh tabs timed out after 20000ms`**, including the final retry after the candidate changes. The documented browser recovery procedure was inspected; the existing browser connection was reused. No alternative driver or injected browser identity was used. This is a browser-control failure before page inspection, not evidence that an application route failed.

Authentication is a separate dependency. The earlier record reproduced `/signin-with-chatgpt` returning 404 on the HTTP preview: that environment lacks the production HTTPS authentication dispatcher. This iteration could not re-observe the provider journey or the user's private case. No placeholder sign-in route, weakened cookie policy or authorization workaround was added.

**Acceptance decision:** preserve one bounded source candidate for review; keep subsequent queue/review/notes stages at audit and implementation-design status until P0 rendered review is available.

## Implemented candidate: confirmed save versus refresh

The observed source defect was a citation completion message claiming the queue had refreshed before `loadMatter` finished. The receipt was discarded and loading errors were not observable by the completion handler.

| Actual state | Candidate behavior | Exact destination / recovery |
|---|---|---|
| Disposition write confirmed, refresh pending | Retain the returned receipt; show “Outcome saved. Updating case actions…” | Case overview; the queue is withheld while its current state is unverified |
| Write and complete authoritative refresh confirmed | Show saved outcome and updated case actions | Overview → next case actions, using the returned case revision and matching readiness revision |
| Write confirmed, refresh failed or partial | Preserve reason, outcome, actor/time when returned, supporting reference and audit identity | **Retry update** performs reads only; it does not repeat the mutation |
| Open reviewed record | Preserve case and record identity | Tasks & reviews → exact deadline, or Evidence → exact source citation |
| Inspect recorded history | Fetch the returned audit ID under the existing dossier permission boundary | Audit → focusable `audit-<event ID>` target; inaccessible/missing events receive an explanation |
| Switch case during a request | Discard obsolete completion/navigation callbacks | Clear retained outcome state on case change; older requests cannot update the new case context |

`SavedOutcomePanel` reuses existing office-theme controls and metadata layouts. `savedOutcomeReceipt` checks the case, record, submitted outcome/reason/support, before/after revisions and audit identity instead of treating any successful response as confirmation. Legacy missing actor/time fields are labelled honestly. Citation consequences continue to distinguish retirement from assertion repair and report regeneration.

The exact audit query extends the existing activity GET with an optional `event_id`, rather than creating a new mutation or changing schema. It requires the same authorized dossier access and binds the event to that dossier. Ordinary paginated history remains available.

**Material trade-off:** this bounded candidate hides the case action workspace until a complete post-save refresh succeeds, retaining the receipt and retry control above it. This avoids presenting stale counts as current but temporarily limits navigation. A browser comparison must assess whether retaining a visibly outdated, read-only queue would be clearer before UI acceptance.

**Stage 2 is not complete.** Interrupted writes, changed proposals after an uncertain save, conflict comparison, session-expiry draft continuation and field-specific recovery still use the older implementation. Comparable non-disposition mutations also need the same receipt/refresh contract. These are outstanding P0 work, not features claimed by this candidate. The new receipt panel is retained during the mounted case session; reload retrieves authoritative records, not a persisted notification panel.

## Self-review and amendments

| Finding during this iteration | Amendment | Evidence and limit |
|---|---|---|
| Generic retry could load data without clearing the receipt's failed-refresh state, leaving the workspace hidden | Route both retry controls through the same receipt-aware refresh operation | Source review and deferred-read model checks; interactive recovery still unverified |
| A successful refresh could contain a different case or readiness computed from another revision | Check case identity and readiness revision before declaring the queue updated | Source review; model checks reject older/partial refresh results |
| An old exact-audit request could navigate after A → B → A or a newer outcome | Capture and compare the outcome request sequence in success and failure paths | Independent source review; browser race exercise outstanding |
| Inserting an old audit event first would break chronological presentation | Preserve server sequence ordering while retaining the requested event in the bounded list | Source review; rendered focus/scroll outstanding |
| React lint rejected reading the new receipt ref during render | Use component state for the render-visible receipt | Final lint has no errors; static rendering and build passed |
| The supplied Canopy notes exercise could imply D09 proves staffing | Separate delivery context from staffing support in the design below | Canonical source review; no canonical case data changed |

The React review covered state ownership, stale-response guards, callback typing, reuse of shared controls and rendering semantics. Static markup checks cover the actual new receipt panel and safe initial workspace markup. They do not demonstrate visual appearance, keyboard operation or browser persistence.

## Queue and exact-record audit: next implementation map

These are source-confirmed gaps and proposed amendments, **not implemented stages**.

| Current action point | Proposed action / exact destination | Required UI or model change | Completion behavior |
|---|---|---|---|
| Different information requests share a generic title | “Provide …” using the actual request → `request-response`, retaining `requestId` | Preserve request identity, related findings and available owner/date/priority as distinct fields | Confirm write, refresh canonical queue, restore filter and selection |
| First six readiness findings are labelled “priority” | Ordered overview queue → `matter-next-actions` | One canonical collection for stable urgency/blocker ordering, deduplication, filters and counts; preserve all reasons | “View all N actions”; announce updated counts; distinguish unavailable readiness from completion |
| Historical deadline tile needs a second opener | Exact `deadline-<id>` disposition form | Auto-open only the explicitly selected eligible historical record; show original date/timezone and focus the form | Keep original deadline/history; show confirmed receipt and remaining readiness |
| Future/projected deadlines receive historical wording | Exact deadline using the supported date-appropriate action | Match server eligibility: open workspace deadline whose due instant is in the past; preserve simulation restrictions | No historical disposition implied for an ineligible record |
| Citation dependency uses a bare fragment that may not be loaded | “Review assertion” → exact `assertion-<id>` | Load/select the target using local navigation; explain missing/inaccessible assertions | Retirement does not repair dependencies; current outputs stay stale until review and regeneration |
| Queue disclosure resets after navigating away | Return to originating case action selection | Own filter/disclosure/selection state above section unmounts; reset on case/organization change | Counts and selected action agree with authoritative state |

The existing server disposition rules remain the domain source of truth: deadline outcomes are **Fulfilled**, **Waived** and **No longer applicable**. No invented “superseded” choice was added. Citation retirement preserves historical acceptance, audit records and old sealed output bytes. Reviewers' existing snapshot permission and writers' package-linking restriction remain intact.

## Connected dossier and notes: implementation design only

The existing case is the dossier. Governed documents, immutable document versions, source anchors, assertions and information requests already exist. There is **no governed notebook/note entity or editor** to reuse. Legacy `caseFeedback` is owner-only feedback on older custom cases and is unsuitable for shared dossier notes.

The smallest proposed increment is a **Case notebook inside Documents & evidence**, with working notes and a searchable **Link existing** picker. It adds no competing global case/dossier navigation. Notes need persistent identity, their own immutable revisions and save receipts; contextual associations need same-case document/version/optional-anchor constraints. Backlinks must come from those authorized relationships, including authorized counts. Unlinking removes the association only. Begin without private-note claims or cross-case source reuse.

Use existing case read authority and owner/contributor update authority; enforce active organization and case participation again inside the write transaction. A contextual note edit should advance its own revision, rather than automatically invalidating governed case snapshots. Creating or reviewing an evidentiary assertion must use the existing dossier revision, source acceptance, audit and staleness rules. This is an architectural recommendation, not a schema introduced in this candidate.

**Canopy correction:** D09 v1 is **Cold-chain and delivery service model** (`app/canopy-source-history.ts`), covering delivery capacity, Sol Hart, contingency arrangements and review controls. D08 v2 is **Staffing confirmation addendum**, Leadership (`app/canopy-fixture.ts`), containing Noah Wren's confirmation of Inez Reed and the minimum team. The proposed “Staffing analysis” note should link D09 as context and D08 v2 as the actual staffing source before explicit assertion review.

The first acceptance journey remains: two notes link an existing source; open its exact version/passage and return with unsaved text intact; inspect authorized backlinks; unlink one association; reload; verify the source and second link survive; update the source without changing the old citation; submit an assertion for review. Denied access, concurrent edits and interrupted saves require separate checks. None of these note interactions is implemented or verified yet.

## Reference evidence

The actual Plane archive is available. Its earlier review records integrity checking and a 403-image survey with 13 individual originals: [Plane reference record](plane-reference-review-2026-09-15.md). This iteration reopened **`Plane web Sep 2025 402.png`** (inline error beside retained fields) and **`Plane web Sep 2025 29.png`** (scope, narrative fields, metadata, Save/Discard). These observed presentation patterns support the recovery/receipt candidate; they do not prove Plane's persistence or accessibility.

The remaining queue/review mappings above use the existing attributed record for `75.png`, `172.png`, `96.png`, `104.png` and `102.png`, not a claimed new inspection of those originals. Coda remains the document/evidence direction, ClickUp the task/review direction, and Folk the previously proposed concise-record direction. No new authenticated Folk/Mobbin screens were inspected.

The initial `Notion web Jun 2026.zip` upload failed. The later replacement archive and individual screenshots are now inspected as recorded in the [Notion reference review](notion-reference-review-2026-09-15.md). Their document, contextual-editor, attachment and table patterns are primary visual evidence. The inspected screens do not establish a relational picker/backlink/unlink journey. Official Notion documentation remains a **secondary reference** for searchable relations and reciprocal associations; Genesis's permissions, immutable evidence versions and review semantics are our adaptation. Sources: [Notion relations](https://www.notion.com/help/relations-and-rollups), [database pages](https://www.notion.com/help/intro-to-databases), [subpages](https://www.notion.com/help/create-a-subpage).

## Verification evidence

**25 focused checks passed in this iteration**, with evidence separated by environment:

| Evidence class | Result | What it establishes |
|---|---|---|
| Model/deferred-callback and actual React static rendering | 17/17 | Receipt binding, pending/failed/successful read feedback, read-only retry, stale callback rejection, existing workspace contracts and actual receipt markup. This is not interactive browser evidence. |
| Actual application route handlers with isolated Miniflare D1/R2 | 6/6 | Governed lifecycle/report prerequisites; deadline/citation permission, replay, conflict and persistence checks; old report preservation; exact audit retrieval, anonymous/foreign organization/missing-event denial. Trusted headers simulate hosting transport, not browser login. |
| Actual PDF stream adapter and controlled fixtures | 2/2 | Missing-font failures reject correctly; Canopy and Tax fixture PDFs generate with the existing adapter. No private-case browser claim. |
| Build and strict TypeScript | Passed | Current candidate bundles; canonical mobile contract lock passes. The lock is not a mobile-device check. |
| Lint | Passed with one existing warning | No errors; pre-existing unused `allMigrations` in `tests/dossier-persistence.test.ts`. |
| Required browser review | Blocked | CDP discovery timeout before desktop or narrow page inspection. No new screenshots, focus, touch, menu or interaction pass. |

Commands: `node --import tsx --test tests/saved-outcome.test.ts tests/dossier-workspace-ui.test.ts`; `node --experimental-sqlite --import tsx --test --test-name-pattern='P1 ERP|Dependable actions' tests/p1-organization-erp.test.ts`; `node --import tsx --test tests/pdf-blob.test.ts`; Sites `build-site.mjs`; `npm run lint`.

The isolated deadline fixture temporarily relaxes and then restores its creation guard to install synthetic historical data; production protections are unchanged. [Recorded server disposition evidence](next-stage-2026-09-15/server-disposition-evidence.json) contains synthetic actors/records, outcome/audit receipts and the old-PDF-preserved result.

### Controlled PDF artifacts and visual review

- [Canopy controlled PDF](next-stage-2026-09-15/canopy-controlled.pdf): 15 pages. All pages programmatically checked as portrait A4. Visually inspected pages 1, 7, 12 and 15: cover, narrative/table, graph and connector/text alternative.
- [Tax controlled PDF](next-stage-2026-09-15/tax-controlled.pdf): 9 pages. All pages programmatically checked as portrait A4. Visually inspected pages 1, 6, 8 and 9: cover, sign-off, graph and text alternative.

These are generated **draft QA fixtures**, not the user's private Tax case or a signed-in, saved/sealed browser output. The separate server route suite exercises governed output preservation. Inspected pages show readable wrapping, no apparent clipping and visible graph continuity references. Remaining visual polish: the Tax fixture's last graph page is sparse; report graph headers/text alternatives contain technical labels and dense metadata. Those findings were recorded without broadening this reliability candidate into an unreviewed report redesign.

Representative page images: [Canopy cover](next-stage-2026-09-15/canopy-page-1.png), [Canopy graph](next-stage-2026-09-15/canopy-page-12.png), [Tax graph](next-stage-2026-09-15/tax-page-8.png). These are actual PDF renders, **not new application screenshots**.

Existing [task before](action-tiles-images/tasks-before.jpg), [task after](action-tiles-images/tasks-after.jpg), [Studio entry](action-tiles-images/studio-actions.jpg) and prior audit records remain historical evidence. The task after image came from a labelled synthetic callback harness. No fresh before/after application pair, updated SVG audit, private-case crash capture or rendered candidate screenshot was produced in this iteration.

## Completion matrix and release decision

| Requested item | Status | Evidence / remaining dependency |
|---|---|---|
| Affected PDF path | **Blocked** | Adapter and controlled PDFs pass; actual signed-in generation/open/download/reopen and the user's affected case need a functioning supported browser in an authenticated environment. |
| Save/refresh feedback | **Implemented but unverified** | Bounded confirmed-save candidate passes model/static checks; required rendered failure/retry review is blocked. Unknown-write, conflict and expired-session flows remain incomplete. |
| Queue ordering and counts | **Blocked** | Audit and exact mapping complete; implementation follows accepted P0 review. No new ordered/filterable queue claimed. |
| Deadline/citation reviews | **Implemented but unverified** | Existing server transitions and persistence/denial/conflict checks pass; receipt/audit candidate added. Direct form opening, unloaded assertions and browser completion remain outstanding. |
| Connected dossier and notes | **Blocked** | Source/entity/permission design complete and amended against the now-accessible Notion screenshots; no notes feature yet. It follows P0 acceptance, which remains blocked by browser access. |
| Persistence and organization scope | **Blocked** | Prior v86 administration changes retained; isolated server checks remain distinct from real reload/new-session/switching. Supported authenticated browser required. |
| First-use/mobile | **Blocked** | No registration-inclusive observed timing, new narrow-screen review or native-device test. No two-minute achievement claim. |
| Plane archive | **Verified** | Earlier integrity/survey record plus two original screens reopened for this candidate. |
| Notion reference set | **Verified** | Replacement ZIP with 101 PNGs and 19 separate PNGs passed integrity checks; 31 originals visually inspected. See the separate reference review for coverage and limits. |
| Controlled report generation | **Verified** | Actual PDFs generated; all-page dimensions and the stated representative visual checks completed. |

**Guided-demo readiness:** existing demonstrated sample paths remain usable conditionally, but this iteration cannot certify the complete guided Canopy journey or accept the new candidate. Keep the unresolved PDF/authentication boundaries visible to the demonstrator.

**Unattended self-service trial:** hold. Priority order: (1) restore supported browser and verify the affected authenticated PDF and saved-work journeys; (2) complete unknown-write/conflict/session recovery and review the current receipt candidate on desktop/narrow screens; (3) implement and verify queue ordering/counts and exact-record review; (4) implement the connected-note increment with permission/version/failure checks; (5) conduct observed onboarding timing, native-device review and report visual polish. A successful build and isolated server tests do not replace these acceptance conditions.
