# Scheduling and Outlook-style workspace review — 6 November 2026

Development branch: `codex/casevant-next-major`. Starting HEAD: `a84d0e3`. Canonical main checked at start: `6255ed49a4dc2e65bc2d42d8b3d4fdf01240342d`. All changed functional paths belong to this task. No production database, user case or live provider was modified.

## User outcomes and acceptance

Add timed events with IANA timezones, finite recurring tasks and shared in-app reminders, retaining AI-assisted workflow building and outcome reports. The user's subsequent UI direction replaces spacious tiles with Outlook-style navigation, command bars, contiguous rows and reading panes. The supplied screenshot is visual reference only.

Accept scheduling only with validated local/UTC consistency, explicit daylight-saving ambiguity handling, atomic recurrence, immutable revisions, authorized access, replay recovery and independently completed occurrences. Accept layout after desktop and narrow rendering, readable long labels and reachable selection actions. Existing draft/authority/report invariants remain in force.

## Implementation

Events store local start/end, IANA zone, explicit fold choice and UTC instants. Gaps reject saving; repeated local times require earlier/later selection. Calendars can change display timezone, include every spanned day and treat midnight end as exclusive. All-day dates stay fixed. Supported local years are 1970–2100 and event duration is at most 31 days. Resolution uses the host's Intl timezone data; future rule changes are not silently substituted for stored instants.

Tasks can be generated daily, weekly or monthly with an interval and a preview of 2–52 occurrences, subject to the existing 200-item plan limit. Monthly dates clamp to month end while retaining the original anchor. Each occurrence is independently editable/completable, starts open with unchecked checklist entries, and retains immutable series identity. Local reminder times are preserved across daylight-saving changes; any invalid occurrence blocks the entire series. There is no infinite scheduler or series-wide editing.

Reminders are shared case data. The case workspace offers dismiss and one-hour snooze; firm work exposes due/upcoming inboxes. Completion suppresses reminders. Snooze uses server time. No email, push, OS notifications or background delivery is implemented. The open UI refreshes its clock every 30 seconds and on focus.

Firm work now uses flat, selectable rows with a separate reading pane and explicit Open in case action. Selection is read-only. The pane is constrained to currently visible authorized records. At narrow widths it stacks above results and receives focus on selection. Navigation, cases, task editors and templates use compact, flat controls. Wide case work has an initially expanded case list; collapsing it returns the reading surface to full width. Existing mobile navigation and case-section selector remain available. AI Studio, saved drafts and report destinations remain reachable.

## Evidence

- 101 focused tests passed: real SQLite/D1 practice handlers, scheduling, firm pagination/authority, versioned templates, navigation, draft continuity, practice controller, report model and statement status.
- Type checking and targeted ESLint passed. Production build status is recorded below once complete.
- Synthetic browser: nonexistent Paris DST time disabled save; New York cross-midnight event appeared on two New York days and one Paris day; snooze removed a due reminder without completing work.
- Synthetic browser: monthly Jan 31 series previewed Feb 28, Mar 31 and Apr 30; lost-response recovery produced exactly four tasks; completing one left other occurrences unchanged.
- Firm reminder inbox showed due and upcoming groups independently.
- Desktop screenshot inspection confirmed contiguous rows and selected details. Integrated case fixture confirmed the case-list/reading-surface layout. Actual 390px iframe inspection with Russian navigation and long task titles confirmed wrapping and visible reading-pane actions. Initial review found an empty collapsed sidebar and off-screen mobile preview; both were corrected and visibly rechecked.
- Browser checks use synthetic component/controller fixtures, not authenticated production or live integrations. Full release CI, PDF visual export suite and external calendar/provider delivery were not run. No production acceptance is claimed.

## Migration and rollback

Apply `0026_practice_scheduling_guard.sql` before enabling this client, retaining prior migrations. Back up the database using the existing deployment process. Scheduling plans carry version 1; the database refuses revisions that discard scheduling metadata/version through an old handler. Modern updates must explicitly clear timing/reminders. Preserve all revisions and the trigger on rollback: old clients may read legacy plans but cannot overwrite scheduled plans. Do not drop operational data to roll back UI.

AI proposals, case carriers, decision packages, immutable history and outcome-report calculations are not converted into operational task status. Task completion does not certify evidence or establish a case outcome.

Final checks: portable production build passed (type checking, WASM asset verification, migration breakpoints, 18-route mobile parity lock, all five vinext build stages). After the two layout corrections, 45 rendering/navigation checks passed again and targeted lint remained clean. Build emitted existing route-classification/plugin timing notices; these are not production acceptance. Final canonical remote main remains `6255ed49a4dc2e65bc2d42d8b3d4fdf01240342d`; the remote next-major branch is absent. This checkpoint is local, not merged, pushed or deployed. Screenshot: local ignored `.artifacts/outlook-workspace.jpg`.
