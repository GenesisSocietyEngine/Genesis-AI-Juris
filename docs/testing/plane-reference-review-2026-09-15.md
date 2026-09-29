# Plane reference review — 15 September 2026

## Baseline and evidence

The direct upload `Plane web Sep 2025(2).zip` resolves the previous reference-access blocker. It contains **403 PNG screenshots**, 145,370,043 archive bytes, SHA-256 `214a24f6a3c8817fb47e1f1e3b186b5729e9a7e71ceeb50663cdd0a1c11c78ef`. All files were extracted outside the product and checked against their ZIP CRC. All 403 screenshots were surveyed in nine numbered contact sheets; 13 representative originals were individually inspected: `Plane web Sep 2025 6.png`, `20.png`, `29.png`, `75.png`, `96.png`, `102.png`, `104.png`, `151.png`, `172.png`, `193.png`, `229.png`, `301.png`, and `402.png` (each abbreviated number retains the same `Plane web Sep 2025 ` filename prefix).

Genesis baseline: published version **85**, clean source `91fdb58340a5dbef1af9270f37cce1a43ea2fda9`, following the version-84 migration recovery. Starting reviews: [action tiles](action-tiles-2026-09-15.md) and [dependable actions](dependable-actions-2026-09-15.md). Their earlier inaccessible-archive statements remain historical records, superseded by this inspection.

The original screenshots are dated visual references, not evidence of Plane's current behavior, accessibility, server permissions or persistence. The selections below preserve their attribution. They are review material, not Genesis customer-facing product assets.

## Observed patterns and Genesis decisions

| Exact screenshot filename | Visible observation | Genesis adaptation / decision |
|---|---|---|
| Plane web Sep 2025 20.png | Quickstart cards have a short action title, purpose and text CTA; a completed card displays a check | Keep the prominent explicit Demo entry and verb-first action tiles. Derive completion from confirmed application state. No automatic Canopy opening. |
| Plane web Sep 2025 75.png | Workspace navigation and project navigation are separate; work items use compact status groups with counts | Retain global/case navigation distinction. Add meaningful queue groups and counts; keep dense records in lists. |
| Plane web Sep 2025 96.png | A selected row remains outlined behind a contextual work-item panel | Keep the exact deadline/citation identifiable and return to the originating queue/filter. A drawer is an option, not a reason to replace working navigation without browser review. |
| Plane web Sep 2025 104.png | Narrative and attributable activity occupy the main column; properties sit in a separate panel | Keep evidence readable. Place current review consequences beside the record; show actor, time and reason in audit history. |
| Plane web Sep 2025 29.png | The form shows project scope, then title/description, secondary metadata and explicit Save/Discard | Name the case and reviewed record before asking for a reason. Keep consequential confirmation separate from secondary controls. |
| Plane web Sep 2025 102.png | Confirmation names the record and consequence; an unavailable archive action explains its prerequisite | State deadline/citation consequences precisely. Retain original history and sealed outputs; offer the exact prerequisite for blocked actions. |
| Plane web Sep 2025 172.png | Applied filters remain visible, with group counts and a clear reset | Persist local queue selection across an action and return; calculate filter counts from the same current action model. |
| Plane web Sep 2025 151.png | Board cards carry compact status, owner and date metadata | Separate meaningful owner/urgency from explanatory text. Avoid copying the dense icon strip into User view. |
| Plane web Sep 2025 193.png | An empty state explains purpose and offers one action | Report empty states should point to the next supported prerequisite, such as creating the current sealed snapshot. |
| Plane web Sep 2025 6.png | A narrow onboarding form shows progress and hides an optional password field | Keep account continuation focused while retaining Genesis's supported authentication and input-preservation requirements. |
| Plane web Sep 2025 229.png | Readable document content is accompanied by Outline/Info/Assets controls | This supports the existing Coda-led document workspace. Keep citations and evidence details contextual. |
| Plane web Sep 2025 301.png | Account, workspace and project settings have separate scopes; a return link remains visible; deletion is collapsed | Explain administration scope and make return navigation reliable. Keep destructive controls contextual. |
| Plane web Sep 2025 402.png | An inline error appears above retained form fields, requirements and the submit control | Keep failed saves and authentication recovery beside retained input. Distinguish a confirmed write from a failed subsequent refresh. |

Design direction remains a light office workspace with restrained blue emphasis, shared typography, borders and spacing. Coda remains primary for documents and evidence; ClickUp remains primary for tasks and reviews. Plane now supplies **primary archive evidence** for navigation, contextual actions and progressive disclosure. Earlier official Plane blog examples are secondary and are no longer substitutes for the archive.

## Current action → next change → exact destination → completion

These are concrete proposals grounded in source inspection. They are **not implemented changes in this reference-only checkpoint**.

| Current action point | Proposed tile / presentation | Exact destination | Required change | Completion behavior |
|---|---|---|---|---|
| Different requests share “Provide requested information” and generic “Needs attention” | A concise verb-first title identifying the actual request; separate returned owner, priority and overdue status | Tasks & reviews → `request-response`, retaining `requestId` | Build metadata from `RequestItem` and readiness findings; show concise next interaction | Only confirmed receipt removes the action; reload and counts agree |
| “Show priority actions” currently means the first six unsorted findings | Meaningful urgency ordering and compact filter/count controls | Overview → `matter-next-actions` | Explicit stable ordering, deduplication and filter model; distinguish blocking work and report prerequisites | Return to the same case/filter; announce updated result count |
| Historical deadline tile opens a register entry, then a second opener | Exact historical-outcome review with record/date/timezone visible | Tasks & reviews → `deadline-<id>` → disposition form | Auto-open only the explicitly selected review; focus its heading/control; preserve reason on recoverable failure | Verified receipt, successful readiness reload and explicit return to queue |
| Citation retirement links dependent assertions with plain fragment anchors | Review panel with explicit “Review assertion” actions | Evidence review → `assertion-<id>` | Reuse known local target/focus behavior, including when a dependent item is not currently loaded | Retirement remains distinct from assertion repair; outputs stay stale until review/regeneration |
| Citation success message says the queue “has been refreshed” before `loadMatter` finishes | “Outcome saved; refreshing case actions…” followed by result-aware feedback | Overview → `matter-next-actions` | Make reload success/failure observable; avoid claiming updated readiness before successful fetch | A failed refresh retains accurate save confirmation plus a retry action; no false ready state |
| Future open workspace deadlines receive historical-outcome wording | “Review deadline” with date-appropriate instruction | Tasks & reviews → exact deadline | Determine historical eligibility before presenting disposition as the next step; retain server enforcement | Future/projected dates keep their supported workflow; historical outcomes retain original date |
| Every failed disposition offers the same refresh action | Recovery specific to session expiry, conflict or an uncertain write | Same disposition form; Account only when sign-in is required | Retain reason/outcome/support; distinguish retrying the same idempotent write from refreshing a changed revision | No false success, silent resubmission or lost input |
| A recorded disposition displays only generic completion text | Compact outcome receipt with reason, actor/time and supporting reference | Exact review record → Audit → `audit-<auditEventId>` | Type and display returned receipt fields with a known local audit target | Original history remains inspectable; citation retirement does not imply repaired assertions |

## Review and verification outcome

- **Verified — actual Plane archive:** integrity checked; 403-image overview and 13 individual references inspected. [Workflow selections](plane-reference-images/workflow.jpg) and [supporting selections](plane-reference-images/supporting.jpg).
- **Verified — source baseline:** native Site metadata reports version 85; local checkout matches its last published source and was clean before this documentation checkpoint.
- **Reviewed — existing Genesis presentation:** prior `tasks-after.jpg` shows the actual component in a labelled synthetic callback harness. It is not a new screenshot or authenticated persistence proof. Source review covered `MatterActionCenter`, `matter-actions`, `DispositionReview`, their completion handlers and shared tile styling.
- **Blocked — new rendered review:** supervised preview started successfully. Existing browser tab discovery and a fresh tab both failed with `CDP operation refresh tabs timed out after 20000ms`. The documented recovery path was used; no alternative browser driver or injected authenticated identity was used.
- **Blocked — PDF/private session retest:** browser failure prevented retesting the corrected adapter through the interface or the user's private case. Previous controlled PDF tests remain the available evidence.
- **Unchanged verification limits:** real authenticated saving/reopening/organization switching, registration-inclusive timing and native mobile remain unverified. The Plane archive is no longer a blocker.

The user's requirement to inspect and exercise each meaningful implementation stage remains in force. No new product UI stage was started after browser recovery failed, and no new before/after or browser-success claim is made. This checkpoint changes review documentation only; production remains version 85. Resume with the queue/confirmation stage above when browser verification is available, then review desktop, narrow screens, keyboard/focus, failure and return paths before continuing.

**Readiness:** archive/reference readiness is complete. Guided demonstration remains limited to previously verified paths. Self-service readiness remains on hold pending the real authenticated journey and private-case PDF retest.
